/**
 * 分析API用のAPIキーを発行する。
 *
 * 使い方
 *   本番（VPS。dist にビルド済み）:
 *     docker compose -f docker-compose.prod.yml --env-file .env.prod exec express-api \
 *       node dist/cli/issueAnalysisKey.js --staff-id 12 --label "A部長 ノートPC" --days 365
 *
 *   ローカル開発（tsx で直接）:
 *     docker exec -it dashboard-express-api-1 \
 *       npx tsx src/cli/issueAnalysisKey.ts --staff-id 1 --label "検証用" --days 1
 *
 * ⚠️ src/ の下に置いてあるのは、本番イメージが dist しか持たないため。
 *   scripts/ に置くと tsconfig の include（src/**）から外れてビルドされず、
 *   本番では tsx も入っていない（--omit=dev）ので実行できない。
 *
 * ⚠️ キー本体はこの実行時にしか表示されない。DBにはハッシュしか残らないため、
 *   控え忘れた場合は再発行するしかない（それが正しい挙動）。
 *
 * ⚠️ 出力されたキーはチャットやメールに貼らないこと。
 *   パスワード管理ツール経由で本人に渡す。
 */

import { randomBytes } from 'node:crypto';
import { execute, query, closePool } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';
import { ANALYSIS_KEY_PREFIX, hashApiKey } from '../middlewares/apiKeyAuth';

interface StaffRow extends RowDataPacket {
  id: number;
  name: string;
  brand: string;
}

/** コマンドライン引数を name=value / --name value の両方で拾う */
const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] !== undefined) return process.argv[index + 1];
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline?.split('=').slice(1).join('=');
};

/**
 * エラーを表示して終了する。
 *
 * ⚠️ アロー関数を const に代入する形にしないこと。
 *   TypeScript は「never を返す関数を呼んだ後は到達しない」という絞り込みを、
 *   関数宣言（または明示的な型注釈付きの変数）に対してしか行わない。
 *   const + アローだと、この呼び出しの後も引数が undefined のままと見なされる。
 */
function fail(message: string): never {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

const main = async (): Promise<void> => {
  const staffId = Number(arg('staff-id'));
  const label = arg('label');
  const days = arg('days') === undefined ? null : Number(arg('days'));

  if (!Number.isInteger(staffId) || staffId <= 0) {
    fail('--staff-id に staff.id を指定してください');
  }
  if (label === undefined || label.trim() === '') {
    fail('--label に用途がわかる名前を指定してください（例: "A部長 ノートPC"）');
  }
  if (days !== null && (!Number.isInteger(days) || days <= 0)) {
    fail('--days には有効日数を正の整数で指定してください');
  }

  // 権限の確認。Master 以外に発行しても認証時に弾かれるだけなので、ここで止める
  const staffRows = await query<StaffRow>(
    'SELECT id, name, brand FROM staff WHERE id = ? LIMIT 1',
    [staffId]
  );
  const staff = staffRows[0];

  if (staff === undefined) {
    fail(`staff.id = ${staffId} が見つかりません`);
    return;
  }
  if (staff.brand !== 'Master') {
    fail(
      `${staff.name}（id=${staffId}）の権限は「${staff.brand || '(空)'}」です。` +
        '分析APIのキーは Master 権限のスタッフにしか発行できません。'
    );
  }

  // 256bit の乱数。base64url なので記号は - と _ だけになり、
  // シェルや環境変数に貼ってもエスケープの事故が起きにくい
  const secret = randomBytes(32).toString('base64url');
  const key = `${ANALYSIS_KEY_PREFIX}${secret}`;

  const expiresAt =
    days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

  await execute(
    `INSERT INTO analysis_api_key (staff_id, label, key_hash, key_prefix, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [staffId, label.trim(), hashApiKey(key), `${ANALYSIS_KEY_PREFIX}${secret.slice(0, 6)}`, expiresAt]
  );

  console.log('');
  console.log('APIキーを発行しました。この表示は一度きりです。');
  console.log('------------------------------------------------------------');
  console.log(`  所有者   : ${staff.name}（staff.id = ${staffId}）`);
  console.log(`  用途     : ${label.trim()}`);
  console.log(`  有効期限 : ${expiresAt ?? '無期限'}`);
  console.log('');
  console.log(`  APIキー  : ${key}`);
  console.log('------------------------------------------------------------');
  console.log('');
  console.log('MCPサーバーの環境変数 KHG_ANALYSIS_API_KEY に設定してください。');
  console.log('チャットやメールに貼らず、パスワード管理ツール経由で渡すこと。');
  console.log('');
};

main()
  .catch((error: unknown) => {
    console.error('キーの発行に失敗しました', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closePool();
  });
