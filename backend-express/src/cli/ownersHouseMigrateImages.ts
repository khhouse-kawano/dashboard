/**
 * オーナーズハウスの画像の引っ越し（v2.2.285）。kh-house.jp の画像を ② の置き場へ取り込み、ownershouse の画像の列をファイル名にする。
 *
 *   本番（VPS）：dcp exec express-api node dist/cli/ownersHouseMigrateImages.js
 *   ローカル   ：docker exec dashboard-express-api-1 npx tsx src/cli/ownersHouseMigrateImages.ts
 *
 * ⚠️ 何度実行してもよい（済んだ列は飛ばす）。⚠️ 最後の行の NG が 0 なら完了。
 */
import { pool } from '../db/pool';
import { migrateOwnersHouseImages } from '../features/ownersHouse/images';

const main = async (): Promise<void> => {
  const { moved, failed } = await migrateOwnersHouseImages((line) => console.log(line));
  console.log(`引っ越し：${moved} 枚　NG：${failed} 枚`);
  await pool.end();
  process.exitCode = failed > 0 ? 1 : 0;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
