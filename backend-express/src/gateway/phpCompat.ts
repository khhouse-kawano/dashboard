/**
 * PHP と同じ形の JSON を返すためのヘルパー。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ このプロジェクトでは toPhpRows() を使わないこと
 *
 *   当初「PHPのPDOは全ての列を文字列で返す」という前提でこの変換を用意したが、
 *   2026-09-02 の差分比較で誤りだと判明した。
 *
 *   ① レンタルサーバーの core/db.php は
 *
 *     PDO::ATTR_EMULATE_PREPARES => false
 *
 *   を設定している。この場合 mysqlnd がネイティブ型を返すため、
 *   **PHP側も INT を数値として返す**。
 *
 *     PHP     : { "sync": 0, "id": 42 }
 *     mysql2  : { "sync": 0, "id": 42 }   ← そのままで一致する
 *
 *   ここで文字列化すると、かえって型が食い違って画面が壊れる。
 *   実際に menu の移植で 17,700行 × 4列すべてが差分になった。
 *
 *   従って通常の移植では**変換を挟まず、そのまま返す**のが正しい。
 *   このファイルの関数は、PHP側が明示的に文字列を組み立てている
 *   （number_format() や sprintf() を使っている等）ハンドラを移植する
 *   ときにだけ使う。使う前に必ず移植元のPHPを読むこと。
 * ─────────────────────────────────────────────
 *
 * 型が一致するかどうかは推測せず、必ず compareBackends.ts で確認する。
 * それが唯一の判断材料になる。
 */

/** PHP の PDO が返す形に寄せた値 */
export type PhpValue = string | null;

/**
 * 1行を PHP と同じ形（全ての値を文字列 or null）に変換する。
 *
 * ⚠️ 「文字列にすれば必ず一致する」わけではない。
 *   DECIMAL(10,2) は PHP では "1234.50"、Number 経由では "1234.5" になる。
 *   金額や小数を扱う列は compareBackends.ts で個別に確認すること。
 */
export const toPhpRow = (row: Record<string, unknown>): Record<string, PhpValue> => {
  const converted: Record<string, PhpValue> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      converted[key] = null;
      continue;
    }

    if (value instanceof Date) {
      // PHP は DATETIME を 'YYYY-MM-DD HH:MM:SS' で返す
      converted[key] = toMysqlDateTime(value);
      continue;
    }

    if (typeof value === 'boolean') {
      // MySQL の TINYINT(1) は PHP では "0" / "1"
      converted[key] = value ? '1' : '0';
      continue;
    }

    if (Buffer.isBuffer(value)) {
      converted[key] = value.toString('utf8');
      continue;
    }

    converted[key] = String(value);
  }

  return converted;
};

/** 複数行をまとめて変換する */
export const toPhpRows = (
  rows: Record<string, unknown>[]
): Record<string, PhpValue>[] => rows.map(toPhpRow);

/**
 * Date を MySQL の DATETIME 表記にする。
 *
 * ⚠️ toISOString() を使わないこと。UTCに変換されて9時間ずれる。
 *   PHP 側はサーバーのタイムゾーンでそのまま文字列を返している。
 */
export const toMysqlDateTime = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
};

/**
 * PHP の成功レスポンスと同じ形。
 *
 * ⚠️ ハンドラごとに形が違う（'status' を返すもの、返さないもの、
 *   'message' の有無など）。共通化せず、移植元のPHPに合わせること。
 *   ここは「よくある形」を書きやすくするためだけのもの。
 */
export const phpSuccess = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  status: 'success',
  ...extra,
});

export const phpError = (message: string): Record<string, unknown> => ({
  status: 'error',
  message,
});
