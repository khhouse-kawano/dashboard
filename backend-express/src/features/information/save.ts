import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { MASTER_DATA_COLUMNS } from './masterDataColumns';

/**
 * 顧客詳細モーダルの**保存系**。
 *
 * 移植元:
 *   customer_info        → backend/src/handlers/informationAction/customer_info.php
 *   update_call_log      → backend/src/handlers/informationAction/information_update_call_log.php
 *   update_interview_log → backend/src/handlers/informationAction/information_update_interview_log.php
 *   log                  → backend/src/handlers/informationAction/information_log.php
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **これらは「フォールバック禁止」で運用する。**
 *
 *   ① にも同じ処理をする PHP が**残っている**。通常の許可リストに入れると
 *   「② が処理を完了 → 応答が失われる → ① でも実行」で二重登録になる。
 *
 *   そのため express_proxy.php の `expressProxyExclusive()` に登録し、
 *   転送に失敗したら ① では実行せず 502 を返す仕組みにした。
 *
 *   ⚠️ 代償: ② が落ちている間は保存ができない（502）。
 *     参照系は従来どおりフォールバックするので画面は開ける。
 *
 *   ⚠️ 障害時の切り戻しは expressProxyExclusive() から該当行を消すだけ。
 *     ① の PHP は消していないので、消せば即座に元へ戻る。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **競合PDFのアップロードはここでは扱わない。**
 *   ファイル本体は ① の `uploads/competitors/` に置き、その URL で
 *   配信している。② からは ① のファイルシステムへ書けない。
 *   フロント（InformationEdit.tsx）が
 *     ・PDF     … multipart で ① へ直接
 *     ・顧客情報 … JSON でゲートウェイへ
 *   の2リクエストに分けている。
 *   ⚠️ multipart は shouldProxyToExpress() が転送自体を拒否するため、
 *     ここへ来ることはない。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** ハンドラの戻り値。ステータスコードを出し分けるため本文と一緒に持つ */
export interface InformationSaveResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * category → 顧客テーブル名。
 *
 * ⚠️ この対応表以外の値を受け付けないこと。
 *   テーブル名は SQL に直接埋め込むため、外部からの値をそのまま通すと
 *   SQL インジェクションになる。
 */
const CUSTOMER_TABLES = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
} as const;

export type SaveCategory = keyof typeof CUSTOMER_TABLES;

const COLUMN_SET = new Set<string>(MASTER_DATA_COLUMNS);

// ---------------------------------------------------------------------------
// customer_info（master_data の upsert）
// ---------------------------------------------------------------------------

/** 'YYYY/MM/DD'（JST）。⚠️ PHP の date('Y/m/d') と同じ形にする */
const todaySlash = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')}`;
};

/**
 * 顧客情報を保存する（無ければ INSERT、あれば UPDATE）。
 *
 * ⚠️ **送られてきた列だけを書く。** リクエストに無い列は触らない。
 *   PHP の `array_key_exists($col, $data)` と同じ挙動で、
 *   フロントが一部の項目だけ送ってきたときに他を空で潰さないため。
 *
 * ⚠️ 空文字は NULL で保存する（PHP の `($val === '') ? null : $val`）。
 *   '' のまま入れると、日付列で '0000-00-00' になる。
 */
export const runInformationCustomerInfo = async (
  category: SaveCategory,
  body: unknown
): Promise<InformationSaveResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id).trim();
  if (id === '') {
    // ⚠️ PHP と同じ 200 + status:'error' を返す。
    //   フロントは status を見ていないが、コードを変えると
    //   例外になる箇所が出るかもしれないため形を揃える。
    return {
      httpStatus: 200,
      body: { status: 'error', message: 'IDが指定されていません。' },
    };
  }

  const tableName = CUSTOMER_TABLES[category];

  const columns: string[] = [];
  const values: SqlParam[] = [];
  for (const col of MASTER_DATA_COLUMNS) {
    if (col === 'id') continue;
    if (!(col in data)) continue;
    columns.push(col);
    const v = data[col];
    // ⚠️ 空文字は NULL。undefined / null もそのまま NULL
    values.push(v === '' || v === undefined ? null : (v as SqlParam));
  }

  try {
    const exists = await query<DynamicRow>(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);

    if (exists.length > 0) {
      // --- UPDATE ---
      if (columns.length === 0) {
        // ⚠️ PHP は更新対象が無いとき success を返している。同じにする
        return {
          httpStatus: 200,
          body: {
            status: 'success',
            message: `${asString(data.customer_contacts_name) || 'お客様'}様の情報を保存しました。`,
          },
        };
      }
      const sets = columns.map((c) => `\`${c}\` = ?`).join(', ');
      await execute(`UPDATE ${tableName} SET ${sets} WHERE id = ?`, [...values, id]);
    } else {
      // --- INSERT ---
      const insertCols = ['id', ...columns];
      const insertVals: SqlParam[] = [id, ...values];

      // ⚠️⚠️ 新規作成時のみ初回訪問日を補完する。**UPDATE では触らない。**
      //   既存顧客の初回訪問日を今日で上書きしてしまうため。
      //   （PHP も INSERT 句にだけ足している）
      if (!('first_interviewed_date' in data)) {
        insertCols.push('first_interviewed_date');
        insertVals.push(todaySlash());
      }

      await execute(
        `INSERT INTO ${tableName} (${insertCols.map((c) => `\`${c}\``).join(', ')})
         VALUES (${insertCols.map(() => '?').join(', ')})`,
        insertVals
      );
    }

    return {
      httpStatus: 200,
      body: {
        status: 'success',
        message: `${asString(data.customer_contacts_name) || 'お客様'}様の情報を保存しました。`,
      },
    };
  } catch (error) {
    // ⚠️ 例外の内容を応答に含めない（SQLや列名が漏れる）。
    //   ⚠️ PHP はメッセージに $e->getMessage() を含めていたが、そこは踏襲しない。
    logger.error(
      `customer_info の保存に失敗しました table=${tableName} id=${id}: ${(error as Error).message}`
    );
    return {
      httpStatus: 500,
      body: { status: 'error', message: '顧客情報の登録に失敗しました。' },
    };
  }
};

// ---------------------------------------------------------------------------
// update_call_log（call_sheet の upsert）
// ---------------------------------------------------------------------------

/**
 * 配列で来たログを JSON 文字列にする。
 *
 * ⚠️ 文字列で来たらそのまま使う。再度 stringify すると二重エンコードになり、
 *   次に読んだフロントの JSON.parse が「文字列」を受け取って壊れる。
 *
 * ⚠️ PHP は `json_encode($data['call_log'])` を無条件に呼んでおり、
 *   文字列で来た場合は二重エンコードしていた。ここは**直している**。
 *   フロント（InformationEdit.tsx）は常に配列を送るため差は出ない。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **PHP と保存されるバイト列が違う。これは意図した差である。**
 *
 *   PHP は `json_encode()` を **JSON_UNESCAPED_UNICODE なし**で呼ぶため
 *   日本語が `通電` にエスケープされる。
 *   JSON.stringify は生の UTF-8 で出す。
 *
 *     PHP    : [{"action":"通電"}]
 *     Express: [{"action":"通電"}]
 *
 *   JSON としては等価で、JSON.parse の結果も同じ。画面の挙動は変わらない。
 *
 *   ⚠️ 揃えていない理由
 *     ・本番データは**すでに両形式が混在している**
 *       （ローカルの call_sheet 16,287行中：エスケープ 12,377／生 3,889）
 *     ・ログ本文を検索する唯一の経路 past_staff_search.php は
 *       `JSON_SEARCH` を使っており、**保存形式に影響されない**
 *       （同ファイルの冒頭コメントに、LIKE では取りこぼすことが記録されている）
 *
 *   ⚠️ ここでエスケープを足して「PHP と同じ」にしないこと。
 *     生の UTF-8 のほうが LIKE でも当たるため、混在を減らす方向に働く。
 *   ⚠️ 差分比較ツール（cli/compareBackends）で call_log を比べると
 *     この差が出る。壊れているのではない。
 * ─────────────────────────────────────────────
 */
const asJsonText = (value: unknown): string => {
  if (typeof value === 'string') {
    const s = value.trim();
    if (s === '') return '[]';
    try {
      JSON.parse(s);
      return s;
    } catch {
      logger.warn('information: JSON として解釈できないログを [] に置き換えました');
      return '[]';
    }
  }
  try {
    return JSON.stringify(value ?? []);
  } catch {
    return '[]';
  }
};

const CALL_SELECT = 'SELECT no FROM call_sheet WHERE id = ?';

const CALL_UPDATE = `
  UPDATE call_sheet
     SET call_log = ?, status = ?, shop = ?, staff = ?, reserved_status = ?
   WHERE id = ?
`;

const CALL_INSERT = `
  INSERT INTO call_sheet (id, shop, name, staff, call_log, status, reserved_status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

/**
 * 架電記録を保存する。
 *
 * ⚠️⚠️ **UPDATE では `name` を更新しない。** INSERT のときだけ入れる。
 *   移植元がそうなっている。揃えると顧客名の変更が call_sheet にも
 *   反映されるようになり、既存の挙動が変わる。
 *
 * ⚠️ call_sheet の text 列は NOT NULL かつ既定値なし。
 *   値を省くと strict モードで INSERT が失敗するため、必ず '' を入れる。
 *   （PHP は reserved_status に `?? ''` を付けておらず、未指定だと
 *     null が渡って失敗しうる状態だった。ここは直している）
 */
export const runInformationUpdateCallLog = async (
  body: unknown
): Promise<InformationSaveResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id).trim();
  const name = asString(data.name);

  if (id === '') {
    return {
      httpStatus: 200,
      body: { status: 'error', message: 'IDが指定されていません。' },
    };
  }

  try {
    const exists = await query<DynamicRow>(CALL_SELECT, [id]);
    const callLog = asJsonText(data.call_log);

    if (exists.length > 0) {
      await execute(CALL_UPDATE, [
        callLog,
        asString(data.status),
        asString(data.shop),
        asString(data.staff),
        asString(data.reserved_status),
        id,
      ]);
      return {
        httpStatus: 200,
        body: { status: 'success', message: `${name}様の架電記録の登録に成功しました。` },
      };
    }

    await execute(CALL_INSERT, [
      id,
      asString(data.shop),
      name,
      asString(data.staff),
      callLog,
      asString(data.status),
      asString(data.reserved_status),
    ]);
    // ⚠️ 移植元は INSERT のときだけ「アップデート」という文言になっている。
    //   逆に見えるが、そのまま揃える（フロントは文言を見ていない）
    return {
      httpStatus: 200,
      body: { status: 'success', message: `${name}様の架電記録のアップデートに成功しました。` },
    };
  } catch (error) {
    logger.error(`update_call_log に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '架電記録の登録に失敗しました。' },
    };
  }
};

// ---------------------------------------------------------------------------
// update_interview_log（interview_sheet の upsert）
// ---------------------------------------------------------------------------

const INTERVIEW_SELECT = 'SELECT no FROM interview_sheet WHERE id = ?';

const INTERVIEW_UPDATE = 'UPDATE interview_sheet SET interview_log = ?, shop = ? WHERE id = ?';

const INTERVIEW_INSERT =
  'INSERT INTO interview_sheet (id, shop, name, interview_log) VALUES (?, ?, ?, ?)';

/**
 * 面談記録を保存する。
 *
 * ⚠️ 架電記録と同じく、UPDATE では `name` を更新しない。
 */
export const runInformationUpdateInterviewLog = async (
  body: unknown
): Promise<InformationSaveResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id).trim();
  const name = asString(data.name);

  if (id === '') {
    return {
      httpStatus: 200,
      body: { status: 'error', message: '内部エラー: 必要なパラメータが不足しています。' },
    };
  }

  try {
    const exists = await query<DynamicRow>(INTERVIEW_SELECT, [id]);
    const interviewLog = asJsonText(data.interview_log);

    if (exists.length > 0) {
      await execute(INTERVIEW_UPDATE, [interviewLog, asString(data.shop), id]);
      return {
        httpStatus: 200,
        body: { status: 'success', message: `${name}様の面談記録の登録に成功しました。` },
      };
    }

    await execute(INTERVIEW_INSERT, [id, asString(data.shop), name, interviewLog]);
    return {
      httpStatus: 200,
      body: { status: 'success', message: `${name}様の面談記録のアップデートに成功しました。` },
    };
  } catch (error) {
    logger.error(`update_interview_log に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '面談記録の登録に失敗しました。' },
    };
  }
};

// ---------------------------------------------------------------------------
// log（master_data_log への追記）
// ---------------------------------------------------------------------------

const LOG_INSERT = `
  INSERT INTO master_data_log (id, customer, staff, updated_at, log)
  VALUES (?, ?, ?, ?, ?)
`;

/** 'YYYY/MM/DD HH:mm'（JST）。⚠️ PHP の date('Y/m/d H:i') と同じ形 */
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
 * 変更履歴を追記する。
 *
 * ⚠️⚠️ **UNIQUE キーが無い純粋な INSERT である。** 同じ内容を2回送れば
 *   2行できる。これがフォールバック禁止の仕組みを先に作った理由。
 *
 * ⚠️ 空文字ではなく NULL を入れる（PHP の bindNullable と同じ）。
 *   列はすべて NULL 許可。
 */
export const runInformationLog = async (body: unknown): Promise<InformationSaveResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const orNull = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const s = asString(value);
    return s === '' ? null : s;
  };

  try {
    const result: ResultSetHeader = await execute(LOG_INSERT, [
      orNull(data.id),
      orNull(data.customer),
      orNull(data.staff),
      nowForLog(),
      orNull(data.log),
    ]);
    // ⚠️ 移植元は何も出力していない（echo が無い）。
    //   PHP のときフロントは空文字を受け取っていたが、
    //   apiClient は Content-Type: application/json を期待するため
    //   JSON を返す。⚠️ フロントは応答を見ていない（await のみ）。
    return {
      httpStatus: 200,
      body: { status: 'success', no: result.insertId },
    };
  } catch (error) {
    logger.error(`information log の追記に失敗しました: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '更新履歴の記録に失敗しました。' },
    };
  }
};
