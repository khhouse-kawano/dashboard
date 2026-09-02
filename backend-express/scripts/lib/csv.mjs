/**
 * CSV取り込みの共通処理。
 *
 * 外部ライブラリを足さずに済むよう、必要な範囲だけ自前で持つ。
 * 対象CSVはGoogleスプレッドシートの書き出しで、引用符内に改行とカンマを含む。
 */

/**
 * RFC4180 準拠の最小CSVパーサ。
 * 引用符内の改行・カンマ・エスケープされた引用符（""）に対応する。
 */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  // 先頭のBOMを落とす。付いたままだと1列目のヘッダ名が一致しなくなる。
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }

  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
};

/**
 * 日付らしき文字列を YYYY-MM-DD に正規化する。日付でなければ null。
 *
 * 対象CSVには `2024/8/8`（1桁）、`2024-08-08`（ISO）が混在し、
 * さらに `2026/0307/27` `2026/11/111` のような明らかな打ち間違いもある。
 * 暦日として成立しない値・年が範囲外の値は null にして、呼び出し側で警告させる。
 *
 * @param {string} raw
 * @param {{minYear?: number, maxYear?: number}} [range]
 */
export const normalizeDate = (raw, range = {}) => {
  const { minYear = 2000, maxYear = 2035 } = range;
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') return null;

  const matched = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(trimmed);
  if (matched === null) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  // new Date は 2月31日 を 3月3日 に繰り上げてしまうので、往復させて検算する
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (year < minYear || year > maxYear) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * 警告の集約。
 *
 * 同じ理由の警告が数百件出ても、ログは理由ごとに1行にまとめる。
 * **サンプルには氏名・住所などの個人情報を渡さないこと。**
 * 行番号や物件IDのような、元データを引けば特定できる非個人情報だけを使う。
 */
export const createWarningCollector = () => {
  const warnings = new Map();

  return {
    warn(reason, sample) {
      const entry = warnings.get(reason) ?? { count: 0, samples: [] };
      entry.count += 1;
      if (sample !== undefined && entry.samples.length < 5) entry.samples.push(sample);
      warnings.set(reason, entry);
    },
    report() {
      if (warnings.size === 0) {
        console.log('  警告なし');
        return;
      }
      for (const [reason, { count, samples }] of [...warnings.entries()].sort((a, b) => b[1].count - a[1].count)) {
        const suffix = samples.length > 0 ? `  例: ${samples.join(', ')}${count > samples.length ? ' ...' : ''}` : '';
        console.log(`  [${String(count).padStart(4)}件] ${reason}${suffix}`);
      }
    },
    total() {
      return [...warnings.values()].reduce((sum, entry) => sum + entry.count, 0);
    },
  };
};

/** MariaDB への接続設定。パスワードはログに出さない。 */
export const dbConfig = () => ({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  database: process.env.DB_NAME ?? 'local_db',
  user: process.env.DB_USER ?? 'local_user',
  password: process.env.DB_PASS ?? 'local_password',
  charset: 'utf8mb4',
});

/** 1000件ずつに分けて一括INSERTするためのヘルパ */
export const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
