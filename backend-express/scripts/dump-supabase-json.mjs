/**
 * Supabase → backend/src/handlers/*.json 書き出しスクリプト
 *
 * 本番へは DB を直接触らず、この JSON を addTale.php で取り込む運用にする。
 * （本番 DB へのネットワーク経路を用意しなくても、ファイルを置くだけで反映できる）
 *
 * 出力:
 *   backend/src/handlers/data.json       … records（[{id, kind, data}]）
 *   backend/src/handlers/app_state.json  … app_state（[{key, data}]）
 *
 * 使い方:
 *   cd backend-express
 *   SUPABASE_URL=... SUPABASE_KEY=... node scripts/dump-supabase-json.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL と SUPABASE_KEY を環境変数で指定してください。');
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../backend/src/handlers');

const PAGE_SIZE = 1000;

const supabaseGet = async (query, headers = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...headers },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${query} が ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
};

/** PostgREST の既定上限が 1000 件なので Range ヘッダでページングする */
const fetchAllRecords = async () => {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await supabaseGet('records?select=id,kind,data&order=id', {
      Range: `${offset}-${offset + PAGE_SIZE - 1}`,
    });
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
};

const main = async () => {
  const records = await fetchAllRecords();
  const appState = await supabaseGet('app_state?select=key,data');

  const byKind = {};
  for (const r of records) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

  // addTale.php が読む形式に合わせる。records はキー順も含めて Supabase のまま。
  const dataPath = path.join(OUT_DIR, 'data.json');
  const statePath = path.join(OUT_DIR, 'app_state.json');

  fs.writeFileSync(dataPath, JSON.stringify(records, null, 4) + '\n', 'utf8');
  fs.writeFileSync(statePath, JSON.stringify(appState, null, 4) + '\n', 'utf8');

  console.log(`data.json      : ${records.length} 件`);
  for (const [kind, count] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind}: ${count}`);
  }
  console.log(`app_state.json : ${appState.map((s) => s.key).join(', ')}`);
  console.log(`\n出力先: ${OUT_DIR}`);
};

main().catch((error) => {
  console.error('\n書き出しに失敗しました:', error);
  process.exit(1);
});
