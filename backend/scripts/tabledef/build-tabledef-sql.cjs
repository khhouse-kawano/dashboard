#!/usr/bin/env node
/**
 * テーブル定義書の原稿（tables/<テーブル名>.md）から、① に流す SQL を作る（v2.2.301）。
 *
 * ─────────────────────────────────────────────
 * 使い方（リポジトリの直下で）:
 *   node backend/scripts/tabledef/build-tabledef-sql.cjs                       … すべての原稿
 *   node backend/scripts/tabledef/build-tabledef-sql.cjs master_data.md ...    … 指定した原稿だけ（tables/ からの道のり）
 *   node backend/scripts/tabledef/build-tabledef-sql.cjs --check <列の一覧.tsv> … 原稿と実物の列が合っているかだけ見る（SQL は出さない）
 *     列の一覧.tsv は「テーブル名<TAB>列名」の行（information_schema.COLUMNS をローカルで書き出したもの）
 *   ⚠️ 出力は標準出力。⚠️ その版の update_log の SQL ファイルの末尾に貼る（CLAUDE.md「テーブル定義書」）。
 *
 * 原稿の形:
 *   ---
 *   table: master_data
 *   title: 注文住宅の顧客
 *   business: order            （order 注文 / spec 建売 / used 中古リノベ / realty 不動産企画 / common 共通）
 *   source: 改修               （改修＝これまでの改修で扱った / 推論＝登録値から推した）
 *   copy_of: master_data       （省略可。バックアップの表など。列の説明が無い列は、この表の原稿の説明を使う）
 *   ---
 *   テーブルの説明（複数行可）
 *
 *   ## 列
 *   - id: 説明
 *   - name [推論]: 説明         （[推論] / [改修] で列ごとに出典を変えられる。省略するとテーブルの source）
 *
 * ⚠️ 原稿に無い列の説明は消す（⚠️ 原稿が正）。⚠️ 型・NULL・既定値は持たない（画面が実物から読む）。
 * ⚠️ 説明にお客様の名前・電話・住所などの実際の値を書かない。
 * ⚠️ 説明や出典が変わった行だけ updated_version（frontend/src/utils/version.ts の newVersion）を上げる。
 * ─────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'tables');
const BUSINESSES = ['order', 'spec', 'used', 'realty', 'common'];
const SOURCES = ['改修', '推論'];
const COLUMN = /^- (\S+?)(?: \[(改修|推論)\])?[:：] ?(.*)$/;

const version = (() => {
  const text = fs.readFileSync(path.join(__dirname, '../../../frontend/src/utils/version.ts'), 'utf8');
  const m = /newVersion\s*=\s*['"]([^'"]+)['"]/.exec(text);
  if (m === null) throw new Error('version.ts の newVersion が読めません');
  return m[1];
})();

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";

const parse = (file) => {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (m === null) throw new Error(`${file}: 先頭の --- で囲んだ見出し情報がありません`);
  const meta = Object.fromEntries(m[1].split('\n').filter((l) => l.includes(':')).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const [descPart, colPart] = m[2].split(/^## 列\s*$/m);
  if (colPart === undefined) throw new Error(`${file}: 「## 列」の見出しがありません`);
  if (!meta.table) throw new Error(`${file}: table がありません`);
  if (`${meta.table}.md` !== file) throw new Error(`${file}: ファイル名は「${meta.table}.md」にしてください`);
  if (!meta.title) throw new Error(`${file}: title がありません`);
  if (!BUSINESSES.includes(meta.business)) throw new Error(`${file}: business は ${BUSINESSES.join(' / ')} のどれか`);
  if (!SOURCES.includes(meta.source)) throw new Error(`${file}: source は ${SOURCES.join(' / ')} のどれか`);
  const columns = [];
  for (const line of colPart.split('\n')) {
    if (line.trim() === '') continue;
    const c = COLUMN.exec(line);
    if (c === null) throw new Error(`${file}: 列の行の形が違います: ${line}`);
    if (columns.some((x) => x.name === c[1])) throw new Error(`${file}: 列 ${c[1]} が2回あります`);
    columns.push({ name: c[1], source: c[2] ?? meta.source, description: c[3].trim() });
  }
  return { file, table: meta.table, title: meta.title, business: meta.business, source: meta.source, copyOf: meta.copy_of ?? '', description: descPart.trim(), columns };
};

const listAll = () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort() : []);
const all = listAll().map(parse);
const byTable = new Map(all.map((d) => [d.table, d]));

/** copy_of の表の説明で、空の列を埋める */
const resolved = (d) => {
  if (d.copyOf === '') return d.columns;
  const base = byTable.get(d.copyOf);
  if (base === undefined) throw new Error(`${d.file}: copy_of の ${d.copyOf}.md がありません`);
  return d.columns.map((c) => {
    if (c.description !== '') return c;
    const b = base.columns.find((x) => x.name === c.name);
    return b ? { ...c, description: b.description, source: b.source } : c;
  });
};

const args = process.argv.slice(2);
if (args[0] === '--check') {
  // 原稿と実物の列を比べる
  const rows = fs.readFileSync(args[1], 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split('\t'));
  const actual = new Map();
  for (const [t, c] of rows) actual.set(t, [...(actual.get(t) ?? []), c]);
  const problems = [];
  for (const [t, cols] of actual) {
    const d = byTable.get(t);
    if (d === undefined) { problems.push(`${t}: 原稿がありません`); continue; }
    const names = d.columns.map((c) => c.name);
    const missing = cols.filter((c) => !names.includes(c));
    const extra = names.filter((c) => !cols.includes(c));
    if (missing.length) problems.push(`${t}: 原稿に無い列 ${missing.join(', ')}`);
    if (extra.length) problems.push(`${t}: 実物に無い列 ${extra.join(', ')}`);
    const empty = resolved(d).filter((c) => c.description === '').map((c) => c.name);
    if (empty.length) problems.push(`${t}: 説明が空の列 ${empty.join(', ')}`);
  }
  for (const d of all) if (!actual.has(d.table)) problems.push(`${d.table}: 実物にテーブルがありません`);
  process.stdout.write(problems.length ? problems.join('\n') + `\n問題 ${problems.length} 件\n` : `OK（${all.length} テーブル）\n`);
  process.exit(problems.length ? 1 : 0);
}

const targets = args.length > 0 ? args.map((f) => byTable.get(path.basename(f, '.md')) ?? parse(path.basename(f))) : all;

/** 説明・出典が変わったときだけ版と日時を上げる（⚠️ MariaDB は左から順に代入するので、この2つを先に書く） */
const touch = (cols) => `updated_version = IF(${cols.map((c) => `${c} <=> VALUES(${c})`).join(' AND ')}, updated_version, VALUES(updated_version)),
    updated_at = IF(${cols.map((c) => `${c} <=> VALUES(${c})`).join(' AND ')}, updated_at, VALUES(updated_at))`;

const out = [];
out.push('-- ---------------------------------------------------------------');
out.push(`-- テーブル定義書（${targets.length} テーブル）。backend/scripts/tabledef/build-tabledef-sql.cjs で作成（${version}）`);
out.push('-- ⚠️ 先に table_definition / column_definition の表があること（2026-11-25_update_log_2.2.301.sql）');
out.push('-- ⚠️ 原稿に無い列の説明は消す（原稿が正）');
out.push('-- ---------------------------------------------------------------');
for (const d of targets) {
  const cols = resolved(d);
  out.push(`-- ${d.table}：${d.title}`);
  out.push(`INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES (${q(d.table)}, ${q(d.title)}, ${q(d.business)}, ${q(d.description)}, ${q(d.source)}, ${q(version)}, NOW())
  ON DUPLICATE KEY UPDATE ${touch(['title', 'business', 'description', 'source'])},
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);`);
  out.push(`DELETE FROM column_definition WHERE table_name = ${q(d.table)}${cols.length ? ` AND column_name NOT IN (${cols.map((c) => q(c.name)).join(', ')})` : ''};`);
  if (cols.length) {
    out.push(`INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
${cols.map((c) => `  (${q(d.table)}, ${q(c.name)}, ${q(c.description)}, ${q(c.source)}, ${q(version)}, NOW())`).join(',\n')}
  ON DUPLICATE KEY UPDATE ${touch(['description', 'source'])},
    description = VALUES(description), source = VALUES(source);`);
  }
}
process.stdout.write(out.join('\n') + '\n');
