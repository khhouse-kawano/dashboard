/**
 * 環境変数の読み込みと検証。
 *
 * 値は docker-compose.yml の `environment:` から渡される。
 * ここで一度だけ検証しておくことで、アプリ本体の各所で
 * `process.env.DB_HOST!` のような危険な非nullアサーションを書かずに済む。
 */

export type NodeEnv = 'development' | 'production' | 'test';

/** 必須の環境変数を取得する。未設定なら起動時点で落とす（後から謎の500になるのを防ぐ） */
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `環境変数 ${key} が設定されていません。docker-compose.yml の express-api > environment を確認してください。`
    );
  }
  return value;
};

/** 数値の環境変数を取得する。未設定・数値でない場合はフォールバック値を使う */
const numberEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`環境変数 ${key} は数値である必要があります（現在の値: ${raw}）。`);
  }
  return parsed;
};

const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv;

export const env = {
  nodeEnv,
  port: numberEnv('PORT', 3001),

  /** CORS を許可するオリジン。カンマ区切り。`*` を含めると全許可 */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ''),

  /**
   * リバースプロキシ（Nginx 等）を何段挟むか。
   * VPS で Nginx の背後に置く場合は 1。0 だと X-Forwarded-For を信用せず、
   * クライアントIPが常にプロキシのIPになってしまう。
   */
  trustProxy: numberEnv('TRUST_PROXY', 0),

  /** リクエストボディの上限。PDF等のアップロードを見込んで少し大きめ */
  bodyLimit: process.env.BODY_LIMIT ?? '10mb',

  /** 1リクエストの最大処理時間（ミリ秒）。重い集計SQLを考慮して長めに取る */
  requestTimeoutMs: numberEnv('REQUEST_TIMEOUT_MS', 120_000),

  /**
   * PHP互換ゲートウェイで、未移植のリクエストを転送する先。
   *
   * ⚠️ ① レンタルサーバーのゲートウェイURL を設定する。
   *   例: https://khg-marketing.info/dashboard/api/gateway/
   *   ② VPS 自身のURLを設定すると無限ループになる。
   *
   * 未設定の場合、未移植のリクエストは 400 で失敗する。
   * 移植が完了して転送が不要になったら空にする。
   */
  phpGatewayUrl: (() => {
    const raw = process.env.PHP_GATEWAY_URL;
    return raw === undefined || raw.trim() === '' ? undefined : raw.trim();
  })(),

  /** 転送のタイムアウト。① 側の重い集計を見込んで長めに取る */
  phpGatewayTimeoutMs: numberEnv('PHP_GATEWAY_TIMEOUT_MS', 120_000),

  /**
   * ゲートウェイの認証を一括で強化するスイッチ。
   *
   * ⚠️ これは「認証を有効にするか」ではない。
   *   auth: 'staff' / 'master' と宣言したエントリは、この値に関係なく**常に検証する**。
   *   宣言したのに効かない状態が一番危険なため。
   *
   *   このフラグが true になると、auth: 'none' のエントリにも staff 認証を要求する。
   *
   * ⚠️ true にすると、移植元のPHPが認証していないエンドポイント
   *   （menu / header / callStatusList など）が 401 を返すようになる。
   *   Token を送らずに動いていた画面が止まるため、既定は false。
   *   一括強化は ① の core/db.php を直すのと同時に行うべきもの。
   */
  gatewayRequireAuth: (process.env.GATEWAY_REQUIRE_AUTH ?? 'false') === 'true',

  db: {
    host: requireEnv('DB_HOST'),
    port: numberEnv('DB_PORT', 3306),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASS'),
  },
} as const;

export const isProduction = nodeEnv === 'production';
