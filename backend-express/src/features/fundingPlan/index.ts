import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../../db/pool';
import type { SqlParam, Tx } from '../../db/pool';
import { logger } from '../../utils/logger';
import {
  ALL_VALUE_COLUMNS,
  BOOL_COLUMNS,
  DATE_COLUMNS,
  JSON_COLUMNS,
  NUMBER_COLUMNS,
  TEXT_COLUMNS,
} from './columns';
import {
  buildInitialPlan,
  buildMasterDataWriteBack,
  shopLabel,
  shopPickerLabel,
} from './mapping';
import type { FamilyMember } from './mapping';
import { writeBackToFamilyInfo } from './familyInfoWriteBack';

/**
 * AIデジタル資金計画書（funding_plan）。
 *
 * ─────────────────────────────────────────────
 * 画面は React ではなく、元の2,539行のバニラJSアプリをそのまま使う。
 *
 *   frontend/public/funding-plan/index.html  … 計算ロジック（触らない）
 *   frontend/src/components/information/FundingPlan.tsx … 起動ボタンだけ
 *
 *   ⚠️ 計算ロジック（住宅ローン控除・太陽光・FPシミュレーション）を
 *     React に書き直すと、数字がずれても気づけない。移植せず据え置く。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ この request には ① に PHP ハンドラが**存在しない**。
 *   アンバサダー／紹介キャンペーン／家族情報と同じ「Express のみ」の扱いで、
 *   ① が自動フォールバックしても 404 になるだけで二重実行にならない。
 *   そのため書き込み（roll = 'save'）も許可リストに入れてよい。
 *
 * ⚠️ 逆に `backend/src/handlers/funding_plan.php` を**作ってはいけない。**
 *   作った瞬間に二重実行の経路ができる。
 *
 * ⚠️ ② が落ちるとこの画面だけ動かなくなる（フォールバック先が無い）。
 *
 * テーブル: backend/scripts/sql/2026-09-08_funding_plan.sql
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** ハンドラの戻り値。ステータスコードを出し分けるため本文と一緒に持つ */
export interface FundingPlanResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const TEXT_SET = new Set<string>(TEXT_COLUMNS);
const NUMBER_SET = new Set<string>(NUMBER_COLUMNS);
const DATE_SET = new Set<string>(DATE_COLUMNS);
const BOOL_SET = new Set<string>(BOOL_COLUMNS);
const JSON_SET = new Set<string>(JSON_COLUMNS);

/**
 * DECIMAL(14,3) に収まる範囲。
 *
 * ⚠️ 範囲外を渡すと MariaDB は strict モードでエラーにし、
 *   **保存が丸ごと失敗する**（面談中に「保存できません」になる）。
 *   桁あふれは弾いて null にし、他の項目は保存できるようにする。
 */
const DECIMAL_MAX = 99999999999.999;

// ---------------------------------------------------------------------------
// 値の正規化（HTML から来た値 → DB に入れる値）
// ---------------------------------------------------------------------------

/** 文字列列。⚠️ 制御文字を落とす。VARCHAR の長さは DB 側で切らせず先に切る */
const cleanText = (value: unknown, maxLength: number): string | null => {
  const s = asString(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (s === '') return null;
  return s.length > maxLength ? s.slice(0, maxLength) : s;
};

/** TEXT 列。⚠️ 改行（\n）は残す。商談メモが1行になってしまう */
const cleanTextarea = (value: unknown): string | null => {
  const s = asString(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return s === '' ? null : s;
};

const cleanNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // ⚠️ 桁あふれは保存全体を失敗させないため null にする
  if (Math.abs(n) > DECIMAL_MAX) return null;
  return n;
};

/**
 * DATE 列。
 * ⚠️ 空文字は必ず null にする。'' を DATE に入れると
 *   strict モードでエラー、非 strict では '0000-00-00' になる。
 */
const cleanDate = (value: unknown): string | null => {
  const s = asString(value).trim().replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const cleanBool = (value: unknown): number =>
  value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;

/**
 * JSON 列。
 * ⚠️ 文字列で来たら**そのまま**保存する（フロントが JSON.stringify 済みの場合）。
 *   ここで再度 stringify すると二重エンコードになる。
 */
const cleanJson = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s === '') return null;
    // ⚠️ 壊れた JSON をそのまま入れると、次回の読み込みで JSON.parse が落ちて
    //   画面が真っ白になる。ここで検証して弾く
    try {
      JSON.parse(s);
      return s;
    } catch {
      logger.warn('funding_plan: JSON として解釈できない値を無視しました');
      return null;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/** 列ごとに適切な正規化をかける */
const normalize = (column: string, value: unknown): SqlParam => {
  if (JSON_SET.has(column)) return cleanJson(value);
  if (NUMBER_SET.has(column)) return cleanNumber(value);
  if (DATE_SET.has(column)) return cleanDate(value);
  if (BOOL_SET.has(column)) return cleanBool(value);
  if (TEXT_SET.has(column)) {
    // ⚠️ textarea の6列だけ TEXT で長さ無制限。他は VARCHAR(191) / VARCHAR(64)
    const isTextarea = ['k_landwish', 'k_worry', 'k_youbou', 'k_memo', 's_bikou', 'bk_memo'].includes(
      column
    );
    return isTextarea ? cleanTextarea(value) : cleanText(value, 191);
  }
  return null;
};

// ---------------------------------------------------------------------------
// 取得
// ---------------------------------------------------------------------------

const CUSTOMER_SQL = 'SELECT * FROM master_data WHERE id = ?';
const FAMILY_SQL = 'SELECT family_info FROM family_info WHERE id = ?';
const PLAN_SQL = 'SELECT * FROM funding_plan WHERE id = ?';

/**
 * 店舗の選択肢。
 *
 * ⚠️ value は master_data.in_charge_store と同じ値、label は
 *   お客様に見せる表記。**value を label にしないこと。**
 *   label には同名が並ぶ（KH宮崎店 と PGH宮崎店 がどちらも「宮崎店」）ため、
 *   label を保存すると事業ブランドが判別できなくなる。
 *
 * ⚠️ 注文事業のみ。資金計画書は注文住宅の資金計画であり、
 *   建売・中古は対象外。
 */
const SHOP_SQL = `
  SELECT shop
    FROM shop_list
   WHERE show_flag = 1
     AND division = '注文事業'
     AND shop NOT LIKE '%未設定%'
     AND shop NOT LIKE '%全店舗%'
   ORDER BY brand_sort, shop
`;

/**
 * DECIMAL を数値に直す。
 *
 * ⚠️⚠️ mysql2 は DECIMAL を**文字列**で返す（精度を落とさないため）。
 *   そのまま返すと `"620.000"` になり、画面の `<input type="number">` に
 *   `620.000` と表示される。計算は parseFloat されるので狂わないが、
 *   お客様の前で開く画面なので見た目を整える。
 *
 * ⚠️ DECIMAL(14,3) は有効桁14。JS の Number（倍精度）は15〜17桁あるため、
 *   この範囲では丸め誤差は出ない。桁を増やすときはここを見直すこと。
 */
const decimalToNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const parseFamily = (raw: unknown): FamilyMember[] => {
  const s = asString(raw).trim();
  if (s === '') return [];
  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as FamilyMember[]) : [];
  } catch {
    // ⚠️ 家族情報が壊れていても資金計画書は開けるようにする
    logger.warn('funding_plan: family_info の JSON が壊れています');
    return [];
  }
};

export interface FundingPlanGetBody {
  status: 'ok';
  /** 保存済みの行があったか。false なら master_data からの初期値を返している */
  exists: boolean;
  /** 資金計画書の値。exists=false のときは master_data から取り込めた項目だけ */
  plan: Record<string, unknown>;
  /** 取り込み元の顧客名・店舗（画面のヘッダー表示用） */
  customer: { id: string; name: string; shop: string; shopLabel: string; staff: string };
  /**
   * 担当店舗の選択肢。
   * value=保存する値（in_charge_store）／label=印刷用／pickerLabel=選択肢用
   */
  shopOptions: { value: string; label: string; pickerLabel: string }[];
}

/**
 * 資金計画書を1件取得する。
 *
 * ⚠️ 保存済みの行が無い場合、master_data と family_info から**初期値を組み立てて**返す。
 *   これが要件の「初めて開いた際に master_data より連携できる項目を抽出する」。
 *   ⚠️ この時点では **DB に書かない**。営業が開いただけで行が増えると、
 *     「作成済みの資金計画書」の件数が実態と合わなくなる。
 */
export const runFundingPlanGet = async (rawId: unknown): Promise<FundingPlanResult> => {
  const id = asString(rawId).trim();

  if (id === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '顧客IDが指定されていません。' },
    };
  }

  const [customerRows, planRows, shopRows] = await Promise.all([
    query<DynamicRow>(CUSTOMER_SQL, [id]),
    query<DynamicRow>(PLAN_SQL, [id]),
    query<DynamicRow>(SHOP_SQL),
  ]);

  const customer = customerRows[0];
  if (customer === undefined) {
    // ⚠️ master_data に無い ID は 404。存在しない顧客の資金計画書を
    //   作れてしまうと、後から紐付け先が無い行が残る
    return {
      httpStatus: 404,
      body: { status: 'error', message: '該当する顧客が見つかりません。' },
    };
  }

  const shopOptions = shopRows.map((r) => {
    const value = asString(r.shop);
    // ⚠️ label（印刷用）と pickerLabel（選択肢用）は別物。
    //   label は DJH の8店舗すべてが「DAY JUST HOUSE」になり重複するため、
    //   選択肢には店名を括弧で添えたものを使う。
    return { value, label: shopLabel(value), pickerLabel: shopPickerLabel(value) };
  });

  const customerHeader = {
    id,
    name: asString(customer.customer_contacts_name),
    shop: asString(customer.in_charge_store),
    shopLabel: shopLabel(customer.in_charge_store),
    staff: asString(customer.in_charge_user),
  };

  const saved = planRows[0];
  if (saved !== undefined) {
    // ⚠️ 管理用の列は返さない。HTML 側の S に混ぜると保存時に送り返され、
    //   updated_at を手で上書きすることになる
    const plan: Record<string, unknown> = {};
    for (const column of ALL_VALUE_COLUMNS) {
      if (!(column in saved)) continue;
      plan[column] = NUMBER_SET.has(column) ? decimalToNumber(saved[column]) : saved[column];
    }
    return {
      httpStatus: 200,
      body: {
        status: 'ok',
        exists: true,
        plan,
        customer: customerHeader,
        shopOptions,
      } satisfies FundingPlanGetBody,
    };
  }

  const familyRows = await query<DynamicRow>(FAMILY_SQL, [id]);
  const family = parseFamily(familyRows[0]?.family_info);

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      exists: false,
      plan: buildInitialPlan(customer, family),
      customer: customerHeader,
      shopOptions,
    } satisfies FundingPlanGetBody,
  };
};

// ---------------------------------------------------------------------------
// 保存
// ---------------------------------------------------------------------------

/**
 * master_data へ書き戻す。
 *
 * ⚠️⚠️ 顧客台帳を書き換える処理である。以下を必ず守ること。
 *   ・列名は buildMasterDataWriteBack が返すものだけを使う
 *     （リクエストの値を列名に使うと SQL インジェクションになる）
 *   ・空の項目は含まれない（既存の値を空で上書きしないため）
 *   ・同じトランザクションで行う。資金計画書だけ保存されて
 *     顧客台帳が古いまま、という状態を作らない
 */
const writeBackToMasterData = async (
  tx: Tx,
  id: string,
  plan: Record<string, unknown>,
  touched: ReadonlySet<string>
): Promise<string[]> => {
  const items = buildMasterDataWriteBack(plan, touched);
  if (items.length === 0) return [];

  const sets = items.map((i) => `\`${i.column}\` = ?`).join(', ');
  const params: SqlParam[] = [...items.map((i) => i.value), id];

  await tx.execute(`UPDATE master_data SET ${sets} WHERE id = ?`, params);

  return items.map((i) => i.column);
};

/**
 * 変更履歴を master_data_log に残す。
 *
 * ⚠️ 顧客台帳を書き換えたことを追跡できるようにする。
 *   Dashboard の顧客詳細（roll: 'log'）と同じテーブル・同じ形にそろえる。
 */
const LOG_SQL = `
  INSERT INTO master_data_log (id, customer, staff, updated_at, log)
  VALUES (?, ?, ?, ?, ?)
`;

const nowForLog = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
};

/**
 * 資金計画書を削除する。
 *
 * ⚠️⚠️ **master_data には触らない。** 書き戻した年収・自己資金などは
 *   顧客台帳に残る。資金計画書を消したからといって顧客の聞き取り内容を
 *   消すのは行き過ぎであり、どこまで戻すべきかも決められない
 *   （書き戻し前の値を保存していない）。
 *
 * ⚠️ 物理削除する。営業が「作り直したい」ときに使うもので、
 *   履歴を残す要件は出ていない。必要になったら deleted_at 方式へ変える。
 */
export const runFundingPlanDelete = async (rawId: unknown): Promise<FundingPlanResult> => {
  const id = asString(rawId).trim();
  if (id === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '顧客IDが指定されていません。' },
    };
  }

  try {
    const result = await execute('DELETE FROM funding_plan WHERE id = ?', [id]);
    return {
      httpStatus: 200,
      body: {
        status: 'ok',
        // ⚠️ 0件でも成功として返す。二重クリックでエラーを出さないため
        deleted: result.affectedRows,
        message: result.affectedRows > 0 ? '資金計画書を削除しました。' : '削除対象がありませんでした。',
      },
    };
  } catch (error) {
    logger.error(`funding_plan の削除に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '削除に失敗しました。' },
    };
  }
};

export const runFundingPlanSave = async (body: unknown): Promise<FundingPlanResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id).trim();
  if (id === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '顧客IDが指定されていません。' },
    };
  }

  const staff = cleanText(data.staff, 64) ?? '';

  /**
   * 画面で**人が編集した**キー。
   *
   * ⚠️⚠️ HTML は保存時にカルテの43項目すべてを送ってくる。未入力の項目にも
   *   DEF()（既定値）が入っているため、これで絞らないと
   *   「顧客を開いて保存しただけ」で d_years=35 のような既定値が
   *   顧客台帳に書き込まれる。
   *
   * ⚠️ 古いブラウザにキャッシュされた index.html は touched を送ってこない。
   *   その場合は空集合になり、**数値7項目だけが書き戻される**
   *   （2026-09-08 までの挙動）。壊れず、勝手に台帳を書き換えることもない。
   */
  const touched = new Set<string>(
    Array.isArray(data.touched)
      ? (data.touched as unknown[]).map((k) => asString(k)).filter((k) => k !== '')
      : []
  );

  // ⚠️ 送られてきたキーのうち、**列として存在するものだけ**を採用する。
  //   リクエストのキーをそのまま列名に使うと SQL インジェクションになる。
  const columns: string[] = [];
  const values: SqlParam[] = [];
  for (const column of ALL_VALUE_COLUMNS) {
    if (!(column in data)) continue;
    columns.push(column);
    values.push(normalize(column, data[column]));
  }

  if (columns.length === 0) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '保存する項目がありません。' },
    };
  }

  const plan: Record<string, unknown> = {};
  columns.forEach((c, i) => {
    plan[c] = values[i];
  });

  try {
    const outcome = await withTransaction(async (tx) => {
      // ⚠️ family_info の行が無いときの INSERT に使うので shop / name も引く
      const exists = await tx.query<DynamicRow>(
        'SELECT id, in_charge_store, customer_contacts_name FROM master_data WHERE id = ?',
        [id]
      );
      const customer = exists[0];
      if (customer === undefined) {
        // ⚠️ トランザクション内で投げる。ここで返すと commit されてしまう
        throw new Error('CUSTOMER_NOT_FOUND');
      }

      const cols = ['id', ...columns, 'updated_by'];
      const vals: SqlParam[] = [id, ...values, staff === '' ? null : staff];

      // ⚠️ 更新句に id は入れない。主キーであり、入れても意味が無い
      const updates = [...columns, 'updated_by']
        .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
        .join(', ');

      await tx.execute(
        `INSERT INTO funding_plan (${cols.map((c) => `\`${c}\``).join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updates}`,
        vals
      );

      const writtenColumns = await writeBackToMasterData(tx, id, plan, touched);

      // ⚠️ 奥様・お子様は master_data ではなく family_info（別テーブル）にある
      const family = await writeBackToFamilyInfo(tx, id, plan, touched, {
        shop: asString(customer.in_charge_store),
        name: asString(customer.customer_contacts_name),
      });

      if (writtenColumns.length > 0 || family !== null) {
        await tx.execute(LOG_SQL, [
          id,
          asString(plan.k_name),
          staff,
          nowForLog(),
          // ⚠️ 何を書き戻したかだけ残す。資金計画書の全項目を入れると
          //   1行が数十KBになり、履歴テーブルが急速に膨らむ
          JSON.stringify({
            source: 'funding_plan',
            columns: writtenColumns,
            values: buildMasterDataWriteBack(plan, touched),
            // ⚠️ family_info は列単位で表せないので、変更内容の説明を残す
            familyInfo: family?.changed ?? [],
          }),
        ]);
      }

      return { writtenColumns, family };
    });

    const notices: string[] = [];
    // ⚠️⚠️ 続柄が空のお子様は、次に計画書を開いても取り込まれない
    //   （buildInitialPlan が 息子／娘 だけを対象にしている）。
    //   黙っていると「追加したのに消えた」と見える。必ず知らせる。
    if (outcome.family !== null && outcome.family.addedKidsWithoutRelation > 0) {
      notices.push(
        `お子様${outcome.family.addedKidsWithoutRelation}名を家族情報に追加しました。` +
          '続柄（息子／娘）は Dashboard の家族情報で設定してください。'
      );
    }

    return {
      httpStatus: 200,
      body: {
        status: 'ok',
        message: `${asString(plan.k_name) || 'お客様'}の資金計画書を保存しました。`,
        // ⚠️ 画面に「顧客台帳にも反映した項目」を出せるようにして返す。
        //   黙って顧客台帳を書き換えると、営業が気づけない
        masterDataUpdated: outcome.writtenColumns,
        familyInfoUpdated: outcome.family?.changed ?? [],
        notices,
      },
    };
  } catch (error) {
    if ((error as Error).message === 'CUSTOMER_NOT_FOUND') {
      return {
        httpStatus: 404,
        body: { status: 'error', message: '該当する顧客が見つかりません。' },
      };
    }
    // ⚠️ 例外の内容を応答に含めない（SQLや列名が漏れる）
    logger.error(`funding_plan の保存に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '保存に失敗しました。時間をおいて再度お試しください。' },
    };
  }
};
