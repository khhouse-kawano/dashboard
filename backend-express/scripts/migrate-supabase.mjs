/**
 * Supabase (records / app_state) → MariaDB (brokerage_listings / app_state) 移行スクリプト
 *
 * 設計方針
 *   - UPSERT のみ。DELETE は一切行わない。
 *     MariaDB 側にしか存在しない行（Supabase で削除済み、または独自追加）は保持する。
 *   - 突合キーは `id`（brokerage_listings.id の UNIQUE 制約）。
 *     Supabase の records.id はクライアント生成の文字列 ID であり、UUID ではない。
 *   - records.data の各キーは、同名カラムがあればそこへ、なければ raw_data のみに入る。
 *     raw_data には常に data 全体の JSON を保持するため、マッピング漏れでも情報は失われない。
 *
 * 使い方
 *   cd backend-express
 *   SUPABASE_URL=... SUPABASE_KEY=... node scripts/migrate-supabase.mjs --dry-run
 *   SUPABASE_URL=... SUPABASE_KEY=... node scripts/migrate-supabase.mjs
 *
 * 環境変数
 *   SUPABASE_URL / SUPABASE_KEY  必須
 *   DB_HOST(127.0.0.1) DB_PORT(3307) DB_NAME(local_db) DB_USER(local_user) DB_PASS(local_password)
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL と SUPABASE_KEY を環境変数で指定してください。');
  process.exit(1);
}

const DB = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  database: process.env.DB_NAME ?? 'local_db',
  user: process.env.DB_USER ?? 'local_user',
  password: process.env.DB_PASS ?? 'local_password',
  charset: 'utf8mb4',
};

/** brokerage_listings が保持しない Supabase 側のメタ情報。raw_data 側にのみ残す。 */
const PAGE_SIZE = 1000;

/** 集計した警告。同じ理由の警告が大量に出ても要約1行にまとめる。 */
const warnings = new Map();
const warn = (reason, detail) => {
  const entry = warnings.get(reason) ?? { count: 0, samples: [] };
  entry.count += 1;
  if (entry.samples.length < 3) entry.samples.push(detail);
  warnings.set(reason, entry);
};

// ---------------------------------------------------------------------------
// Supabase 取得
// ---------------------------------------------------------------------------

const supabaseGet = async (path, headers = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...headers },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${path} が ${res.status} ${res.statusText} を返しました: ${await res.text()}`);
  }
  return res.json();
};

/** records を PAGE_SIZE 件ずつ全件取得する（PostgREST の既定上限が 1000 件のため）。 */
const fetchAllRecords = async () => {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await supabaseGet('records?select=id,kind,data,updated_at&order=id', {
      Range: `${offset}-${offset + PAGE_SIZE - 1}`,
    });
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
};

// ---------------------------------------------------------------------------
// 値の変換
// ---------------------------------------------------------------------------

/**
 * カラムの型に合わせて JSON の値を SQL 用の値へ変換する。
 * 変換できない値は例外を投げずに null とし、警告として集計する
 * （1件の異常データで移行全体を止めないため。原本は raw_data に残る）。
 */
const coerce = (value, column, context) => {
  if (value === null || value === undefined || value === '') return null;

  const { dataType, maxLength, name } = column;

  // 日付系: 'YYYY-MM-DD' または 'YYYY-MM-DDTHH:mm' の先頭10文字だけを採用する
  if (dataType === 'date') {
    const text = String(value);
    const matched = /^(\d{4}-\d{2}-\d{2})/.exec(text);
    if (!matched) {
      warn(`${name}: 日付として解釈できない値を NULL にしました`, `${context} = ${JSON.stringify(value)}`);
      return null;
    }
    return matched[1];
  }

  // 数値系: boolean は 0/1、数値文字列は数値へ。それ以外は NULL。
  if (dataType === 'int' || dataType === 'bigint' || dataType === 'tinyint') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(num)) {
      warn(`${name}: 数値として解釈できない値を NULL にしました`, `${context} = ${JSON.stringify(value)}`);
      return null;
    }
    return num;
  }

  // 文字列系: オブジェクト・配列は JSON 文字列にして格納する
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // varchar のけた溢れは strict モードで INSERT ごと失敗するため、切り詰めて続行する
  if (maxLength !== null && text.length > maxLength) {
    warn(`${name}: ${maxLength}文字を超えたため切り詰めました`, `${context} (${text.length}文字)`);
    return text.slice(0, maxLength);
  }
  return text;
};

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

const main = async () => {
  console.log(DRY_RUN ? '=== DRY RUN（DBには書き込みません）===\n' : '=== 本実行 ===\n');

  const connection = await mysql.createConnection(DB);
  try {
    // --- 対象テーブルのカラム定義を取得（マッピングはカラム名の一致で決める） ---
    const [columnRows] = await connection.query(
      `SELECT column_name, data_type, character_maximum_length
         FROM information_schema.columns
        WHERE table_schema = ? AND table_name = 'brokerage_listings'`,
      [DB.database]
    );
    const columns = new Map(
      columnRows.map((row) => [
        row.COLUMN_NAME ?? row.column_name,
        {
          name: row.COLUMN_NAME ?? row.column_name,
          dataType: row.DATA_TYPE ?? row.data_type,
          maxLength: row.CHARACTER_MAXIMUM_LENGTH ?? row.character_maximum_length ?? null,
        },
      ])
    );

    // 移行スクリプトが値を組み立ててはいけないカラム（DB が自動採番・自動更新する）
    const RESERVED = new Set(['internal_id', 'created_at', 'updated_at']);

    // --- 既存 ID を控えて、新規追加と更新を区別できるようにする ---
    const [existingRows] = await connection.query('SELECT id FROM brokerage_listings WHERE id IS NOT NULL');
    const existingIds = new Set(existingRows.map((row) => row.id));

    // --- Supabase から取得 ---
    const records = await fetchAllRecords();
    console.log(`Supabase records: ${records.length} 件を取得しました`);

    const byKind = {};
    for (const record of records) byKind[record.kind] = (byKind[record.kind] ?? 0) + 1;
    console.log(
      Object.entries(byKind)
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => `  ${kind}: ${count}`)
        .join('\n')
    );

    // --- 行の組み立て ---
    const unmappedKeys = new Set();
    const rows = records.map((record) => {
      const data = record.data ?? {};
      const context = `${record.kind}/${record.id}`;

      // id と kind は records の列を正とする（data 側の id と食い違っても records を優先）
      const row = {
        id: record.id,
        kind: record.kind,
        raw_data: JSON.stringify(data),
      };

      for (const [key, value] of Object.entries(data)) {
        if (key === 'id' || key === 'kind') continue;
        const column = columns.get(key);
        if (!column || RESERVED.has(key)) {
          unmappedKeys.add(`${record.kind}.${key}`);
          continue;
        }
        row[key] = coerce(value, column, `${context}.${key}`);
      }
      return row;
    });

    if (unmappedKeys.size > 0) {
      console.log(`\n[情報] 対応カラムが無く raw_data にのみ保持したキー: ${[...unmappedKeys].sort().join(', ')}`);
    }

    const inserts = rows.filter((row) => !existingIds.has(row.id)).length;
    console.log(`\n新規追加: ${inserts} 件 / 更新: ${rows.length - inserts} 件`);
    console.log(`（MariaDB 側にのみ存在する ${existingIds.size - (rows.length - inserts)} 件は削除せず保持します）`);

    // --- app_state ---
    const appStates = await supabaseGet('app_state?select=key,data,updated_at');
    console.log(`\nSupabase app_state: ${appStates.map((state) => state.key).join(', ')}`);

    if (DRY_RUN) {
      printWarnings();
      console.log('\nDRY RUN のため書き込みは行いませんでした。');
      return;
    }

    // --- 書き込み ---
    await connection.beginTransaction();
    try {
      let done = 0;
      for (const row of rows) {
        const keys = Object.keys(row);
        const sql =
          `INSERT INTO brokerage_listings (${keys.map((key) => `\`${key}\``).join(', ')}) ` +
          `VALUES (${keys.map(() => '?').join(', ')}) ` +
          `ON DUPLICATE KEY UPDATE ${keys
            .filter((key) => key !== 'id')
            .map((key) => `\`${key}\` = VALUES(\`${key}\`)`)
            .join(', ')}`;
        await connection.execute(sql, keys.map((key) => row[key]));
        done += 1;
        if (done % 200 === 0) console.log(`  ... ${done}/${rows.length}`);
      }

      for (const state of appStates) {
        await connection.execute(
          'INSERT INTO app_state (`key`, `data`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)',
          [state.key, JSON.stringify(state.data)]
        );
      }

      await connection.commit();
      console.log(`\n完了: brokerage_listings ${rows.length} 件 / app_state ${appStates.length} 件を UPSERT しました。`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    printWarnings();
  } finally {
    await connection.end();
  }
};

const printWarnings = () => {
  if (warnings.size === 0) {
    console.log('\n警告はありません。');
    return;
  }
  console.log('\n--- 警告 ---');
  for (const [reason, entry] of warnings) {
    console.log(`[${entry.count}件] ${reason}`);
    for (const sample of entry.samples) console.log(`    例: ${sample}`);
  }
};

main().catch((error) => {
  console.error('\n移行に失敗しました:', error);
  process.exit(1);
});
