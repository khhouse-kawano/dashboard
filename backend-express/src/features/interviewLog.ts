import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../db/pool';
import type { SqlParam, Tx } from '../db/pool';
import { logger } from '../utils/logger';
import {
  INTERVIEW_TABLE,
  actionMapFor,
  actionOptionsFor,
  deriveKpiColumns,
  resolveClearedColumns,
} from './interviewKpi';
import type { InterviewCategory, InterviewLogEntry } from './interviewKpi';

/**
 * 商談ステップ（components/InterviewLog.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元
 *   backend/src/handlers/interviewLog.php                 （参照）
 *   backend/src/handlers/interviewLog_update_interview.php （書き込み）
 *
 * ⚠️⚠️ **① の PHP ハンドラは実在する。** 書き込み側は転送失敗時に ① で
 *   再実行されると interview_sheet と KPI 列が二重に更新されるため、
 *   express_proxy.php の expressProxyExclusive() でフォールバックを禁止している。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **2026-09-09 に移植元の欠陥を3つ直した。** 挙動が PHP と変わる。
 *
 *   (1) 更新先が master_data 固定だった
 *       InterviewLog.tsx は RankOrder / RankKaeru / RankResale の3画面から
 *       開かれる。建売・中古の顧客は master_data に id が無いため、
 *       KPI の UPDATE は**0件更新で黙って何もしていなかった**。
 *       → id からテーブルを判定する（id は3テーブルで重複しない。実測0件）。
 *
 *   (2) 同じアクションが複数あると「配列の最後」が勝っていた
 *       PHP は `SET col = ?, col = ?` と同じ列を並べており、
 *       MariaDB の「最後が勝つ」に依存していた。最古でも最新でもなく
 *       並び順依存。
 *       → **最も古い日付**を採る（features/interviewKpi.ts）。
 *
 *   (3) actionMap が事業ごとに違うのに1つしか無かった
 *       建売の「申し込み」「自社契約」、中古の「売買契約」などは
 *       PHP の actionMap に無く、選んでも KPI が入らなかった。
 *       → 事業ごとの actionMap を interviewKpi.ts に集約した。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface InterviewLogResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

// ---------------------------------------------------------------------------
// 事業の判定
// ---------------------------------------------------------------------------

/**
 * id がどの事業の顧客かを調べる。
 *
 * ⚠️⚠️ **リクエストの category を信用しない。** InterviewLog.tsx は
 *   3つの Rank 画面から開かれるが、どの事業かを送っていない。
 *   送るように変えても、画面と顧客が食い違えば別テーブルを更新してしまう。
 *   id から引くのが確実である。
 *
 * ⚠️ id は3テーブルで重複しない（2026-09-09 に実データで確認。交差すべて0件）。
 *   もし将来重複したら、この関数は最初に見つかった方を返す。
 *   ⚠️ その場合は判定方法を見直すこと。
 *
 * ⚠️ 中古だけ actionMap が in_charge_store（取引区分）で切り替わるので
 *   併せて返す。
 */
interface CustomerRef {
  category: InterviewCategory;
  /** 中古の取引区分（買い:中古リノベ 等）。他事業では null */
  dealType: string | null;
}

const detectCustomer = async (
  tx: Tx | null,
  id: string
): Promise<CustomerRef | null> => {
  const run = async (sql: string, params: SqlParam[]): Promise<DynamicRow[]> =>
    tx === null ? query<DynamicRow>(sql, params) : tx.query<DynamicRow>(sql, params);

  const categories: InterviewCategory[] = ['order', 'spec', 'used'];

  for (const category of categories) {
    const rows = await run(
      `SELECT in_charge_store FROM ${INTERVIEW_TABLE[category]} WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) continue;

    return {
      category,
      dealType: category === 'used' ? asString(rows[0]?.in_charge_store) : null,
    };
  }

  return null;
};

// ---------------------------------------------------------------------------
// 参照
// ---------------------------------------------------------------------------

const SHEET_SQL = 'SELECT * FROM interview_sheet WHERE id = ?';

/**
 * ⚠️ 別名（as）は PHP と同じにする。InterviewLog.tsx が
 *   customer / medium / register で読んでいる。
 *
 * ⚠️⚠️ PHP は master_data 固定だった。建売・中古の顧客では
 *   `customer` が false で返り、画面が `customer.customer` で落ちていた。
 *   ここでは id から判定したテーブルを見る。
 */
const customerSql = (category: InterviewCategory): string => `
  SELECT id,
         customer_contacts_name as customer,
         sales_promotion_name as medium,
         step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register
    FROM ${INTERVIEW_TABLE[category]}
   WHERE id = ?
`;

/**
 * 商談ステップの取得。
 *
 * ⚠️ `interview_log` 列は**文字列のまま**返す（pool.ts の jsonStrings: true）。
 *   InterviewLog.tsx が typeof === 'string' で分岐して JSON.parse している。
 *
 * ⚠️ 該当なしのとき PHP は `false` を返していた（PDO::fetch の戻り値）。
 *   互換のため false のままにしている。
 */
export const runInterviewLogShow = async (rawId: unknown): Promise<InterviewLogResult> => {
  const id = asString(rawId).trim();

  // ⚠️ 空文字で検索しない。interview_sheet に id が空の行があると
  //   他人の商談ステップが返る（family_info で実際に起きた事故と同じ形）
  if (id === '') {
    return { httpStatus: 200, body: { interview: false, customer: false, actions: [] } };
  }

  const ref = await detectCustomer(null, id);

  if (ref === null) {
    // ⚠️ 3事業のどこにも居ない顧客。PHP と同じく false を返す
    const sheets = await query<DynamicRow>(SHEET_SQL, [id]);
    return {
      httpStatus: 200,
      body: { interview: sheets[0] ?? false, customer: false, actions: [] },
    };
  }

  const [sheets, customers] = await Promise.all([
    query<DynamicRow>(SHEET_SQL, [id]),
    query<DynamicRow>(customerSql(ref.category), [id]),
  ]);

  return {
    httpStatus: 200,
    body: {
      interview: sheets[0] ?? false,
      customer: customers[0] ?? false,
      // ⚠️ 追加のキー。事業に合った選択肢を画面へ渡す（interviewKpi.ts 参照）。
      //   ① の PHP は返さないので、フォールバック時は空配列になる。
      //   InterviewLog.tsx は空なら注文用の既定に落とす
      category: ref.category,
      actions: actionOptionsFor(ref.category, ref.dealType),
    },
  };
};

// ---------------------------------------------------------------------------
// 書き込み
// ---------------------------------------------------------------------------

/**
 * interview_log を配列にする。
 * ⚠️ PHP は配列でなければ json_decode を試し、失敗したら空配列にしていた。
 *   フロントは常に配列を送るが、同じ寛容さを保つ。
 */
const toLogArray = (raw: unknown): InterviewLogEntry[] => {
  if (Array.isArray(raw)) return raw as InterviewLogEntry[];
  const s = asString(raw).trim();
  if (s === '') return [];
  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as InterviewLogEntry[]) : [];
  } catch {
    return [];
  }
};

const SHEET_EXISTS_SQL = 'SELECT 1 FROM interview_sheet WHERE id = ?';
const SHEET_UPDATE_SQL =
  'UPDATE interview_sheet SET interview_log = ?, shop = ? WHERE id = ?';
const SHEET_INSERT_SQL =
  'INSERT INTO interview_sheet (id, shop, name, interview_log) VALUES (?, ?, ?, ?)';

/**
 * 商談ステップの保存。
 *
 * ⚠️ interview_sheet の upsert と KPI 列の更新を**同じトランザクション**で行う。
 *   PHP は別々に実行しており、片方だけ成功する状態がありえた。
 *
 * @param body.removed 画面で削除された行（任意）。
 *   ⚠️ 付いていれば、対応する KPI 列を**条件付きで**空にする。
 *     条件は interviewKpi.ts の resolveClearedColumns を参照
 *     （残りの log から導出できず、かつ現在値が削除した日付と一致する場合のみ）。
 *   ⚠️ 無条件に空にすると、ポータル同期や直接編集で入った日付を消す。
 */
export const runInterviewLogUpdate = async (body: unknown): Promise<InterviewLogResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id).trim();
  if (id === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '顧客IDが指定されていません。' },
    };
  }

  const shop = asString(data.shop);
  const name = asString(data.name);
  const logs = toLogArray(data.interview_log);
  const removed = toLogArray(data.removed);

  // ⚠️ 正規化した配列を保存する。壊れた JSON を保存すると
  //   次回の読み込みで JSON.parse が落ちて画面が真っ白になる。
  //   ⚠️ 既に移植済みの information:update_interview_log と同じ形
  //     （生の UTF-8。PHP の \uXXXX エスケープとはバイト列が違うが、
  //       利用側は JSON 関数と json_decode だけなので影響しない）
  const logJson = JSON.stringify(logs);

  try {
    const result = await withTransaction(async (tx) => {
      const ref = await detectCustomer(tx, id);

      // ⚠️ interview_sheet は顧客が3事業のどこにも居なくても保存する。
      //   PHP も存在確認をしていなかった（記録だけは残す）
      const exists = await tx.query<DynamicRow>(SHEET_EXISTS_SQL, [id]);
      if (exists.length > 0) {
        await tx.execute(SHEET_UPDATE_SQL, [logJson, shop, id]);
      } else {
        await tx.execute(SHEET_INSERT_SQL, [id, shop, name, logJson]);
      }

      if (ref === null) {
        // ⚠️ 3事業のどこにも居ない。KPI 列の更新先が無い
        logger.warn(`interviewLog: 顧客が見つからないため KPI を更新しませんでした id=${id}`);
        return { updated: [] as string[], cleared: [] as string[], category: null };
      }

      const actionMap = actionMapFor(ref.category, ref.dealType);
      const derived = deriveKpiColumns(logs, actionMap);

      // 削除された行に対応する列を空にできるか調べる。
      // ⚠️ 現在値を読む必要があるので、対象列だけ SELECT する
      const candidateColumns = Array.from(
        new Set(Object.values(actionMap))
      );
      let cleared: string[] = [];

      if (removed.length > 0 && candidateColumns.length > 0) {
        const currentRows = await tx.query<DynamicRow>(
          `SELECT ${candidateColumns.join(', ')} FROM ${INTERVIEW_TABLE[ref.category]} WHERE id = ?`,
          [id]
        );
        const current = currentRows[0] ?? {};
        cleared = resolveClearedColumns(removed, derived, current, actionMap);
      }

      const setParts: string[] = [];
      const params: SqlParam[] = [];

      // ⚠️ 導出できた列は**常に上書きする**（2026-09-09 決定）。
      //   従来の `!information[key]` のような「既に値があれば触らない」条件を
      //   入れないこと。それが「あとから修正しても保存されない」の原因だった。
      for (const [column, day] of derived) {
        setParts.push(`${column} = ?`);
        params.push(day);
      }
      for (const column of cleared) {
        setParts.push(`${column} = ?`);
        params.push('');
      }

      if (setParts.length === 0) {
        return { updated: [], cleared: [], category: ref.category };
      }

      params.push(id);
      await tx.execute(
        `UPDATE ${INTERVIEW_TABLE[ref.category]} SET ${setParts.join(', ')} WHERE id = ?`,
        params
      );

      return {
        updated: Array.from(derived.keys()),
        cleared,
        category: ref.category,
      };
    });

    return {
      httpStatus: 200,
      body: {
        status: 'success',
        message: `${name || 'お客様'}の商談ステップを保存しました。`,
        // ⚠️ 何を書き換えたか返す。黙って KPI 列を書き換えると気づけない
        kpiUpdated: result.updated,
        kpiCleared: result.cleared,
        category: result.category,
      },
    };
  } catch (error) {
    // ⚠️ PHP は例外メッセージをそのまま返していた。ここでは返さずログに残す
    logger.error(`interviewLog の保存に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '保存に失敗しました。時間をおいて再度お試しください。' },
    };
  }
};

// ---------------------------------------------------------------------------
// 契約見込みの登録（handlers/contract_ex_update.php）
// ---------------------------------------------------------------------------

/**
 * 契約見込み数の登録（RankOrder.tsx の「当月確約数」など）。
 *
 * ⚠️ ON DUPLICATE KEY UPDATE は contract_expected に
 *   (date, section, shop) の UNIQUE キーがあることを前提にしている
 *   （PHP から引き継いだ前提）。キーが無いと同じ組み合わせの行が増え続ける。
 *
 * ⚠️ PHP ハンドラが実在するため、フォールバック禁止に登録している。
 */
export const runContractExpectedUpdate = async (body: unknown): Promise<InterviewLogResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  try {
    await execute(
      `INSERT INTO contract_expected (\`date\`, \`section\`, \`shop\`, \`count\`)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`count\` = VALUES(\`count\`)`,
      [
        asString(data.date),
        asString(data.section),
        asString(data.shop),
        // ⚠️ count は数値列。空文字を渡すと strict モードでエラーになるため 0 にする
        Number.isFinite(Number(data.count)) ? Number(data.count) : 0,
      ]
    );

    return { httpStatus: 200, body: { status: 'success' } };
  } catch (error) {
    logger.error(`contract_expected の保存に失敗しました: ${(error as Error).message}`);
    return { httpStatus: 500, body: { status: 'error', message: '登録に失敗しました。' } };
  }
};
