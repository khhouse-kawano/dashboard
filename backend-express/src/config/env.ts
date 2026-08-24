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

  db: {
    host: requireEnv('DB_HOST'),
    port: numberEnv('DB_PORT', 3306),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASS'),
  },
} as const;

export const isProduction = nodeEnv === 'production';
