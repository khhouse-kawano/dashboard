#!/usr/bin/env node
/**
 * 業務ガイドの記事（articles/<事業>/*.md）から、① に流す SQL を作る（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * 使い方（リポジトリの直下で）:
 *   node backend/scripts/guide/build-guide-sql.cjs                          … すべての記事
 *   node backend/scripts/guide/build-guide-sql.cjs order/screen-110.md ...  … 指定した記事だけ（articles/ からの道のり）
 *   ⚠️ 出力は標準出力。⚠️ その版の update_log の SQL ファイルの末尾に貼る（CLAUDE.md「業務ガイドの記事」）。
 *
 * 置き場所: articles/<事業>/<分類>-<並び順>.md
 *   ⚠️ 事業はフォルダ名で決まる（order 注文営業 / spec 建売営業 / used 中古リノベ / common 全事業共通）。
 *
 * 記事ファイルの形:
 *   ---
 *   title: 契約したら（注文営業）
 *   section: 業務の流れ        （業務の流れ / 画面の使い方 / 用語）
 *   sort: 40
 *   summary: 一覧に出す1行の説明
 *   ---
 *   本文（Markdown）
 *
 * ⚠️⚠️ **エージェントの内容を優先する**（2026-10-16 の指示）。
 *   ⚠️ 同じタイトルの記事が ① にあれば、手で直された記事でも**上書きする**。
 *   ⚠️ 上書きの直前の内容は guide_history に残す（⚠️ 画面で直した人の文章は消えない）。
 * ⚠️ タイトルは事業が違っても重複できない（⚠️ [[ ]] リンクはタイトルで探すため）。
 * ⚠️ タイトルを変えるときは、このスクリプトでは追えない（⚠️ 別の記事として作られる）。
 *   ⚠️ `UPDATE guide_article SET title = '新' WHERE title = '旧';` を先に手で書くこと。
 * ─────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'articles');
const SECTIONS = ['業務の流れ', '画面の使い方', '用語'];
const DIVISIONS = ['order', 'spec', 'used', 'common'];
const MAX_BODY_BYTES = 60000; // ⚠️ ② の features/guide.ts と同じ上限
const LINK = /\[\[([^[\]\n]+)\]\]/g;
/** ⚠️ v2.2.196: `[[画面:名前]]`（画面を開くボタン）。⚠️ 記事へのリンクとしては数えない */
const SCREEN = /^画面[:：](.+)$/;

/**
 * 画面の名前の一覧（frontend/src/components/guide/guideScreens.ts の GUIDE_SCREENS のキー）。
 * ⚠️ `// GUIDE_SCREENS_BEGIN` 〜 `// GUIDE_SCREENS_END` の間の `    '名前': {` の行を読む（⚠️ あちらの説明のとおり、この形を崩さない）。
 */
const screenNames = (() => {
  const file = path.join(__dirname, '../../../frontend/src/components/guide/guideScreens.ts');
  const text = fs.readFileSync(file, 'utf8');
  const block = /\/\/ GUIDE_SCREENS_BEGIN([\s\S]*?)\/\/ GUIDE_SCREENS_END/.exec(text);
  if (block === null) throw new Error(`${file}: GUIDE_SCREENS_BEGIN / END の印がありません`);
  return new Set([...block[1].matchAll(/^ {4}'([^']+)': \{/gm)].map((m) => m[1]));
})();

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";

const parse = (file) => {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (m === null) throw new Error(`${file}: 先頭の --- で囲んだ見出し情報がありません`);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const body = m[2].trim() + '\n';
  const division = file.split('/')[0];
  if (!DIVISIONS.includes(division)) throw new Error(`${file}: 事業のフォルダ（${DIVISIONS.join(' / ')}）の中に置いてください`);
  if (!meta.title) throw new Error(`${file}: title がありません`);
  if (/[[\]]/.test(meta.title)) throw new Error(`${file}: title に [ ] は使えません`);
  if (!SECTIONS.includes(meta.section)) throw new Error(`${file}: section は ${SECTIONS.join(' / ')} のどれか`);
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new Error(`${file}: 本文が長すぎます`);
  return { file, title: meta.title, section: meta.section, sort: Number(meta.sort) || 0, summary: meta.summary ?? '', division, body };
};

/** articles/ の下の .md（⚠️ `order/flow-010.md` の形） */
const listAll = () => DIVISIONS.flatMap((d) => {
  const dir = path.join(DIR, d);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => `${d}/${f}`) : [];
});

const all = listAll().map(parse);
const titleCount = new Map();
for (const a of all) titleCount.set(a.title, (titleCount.get(a.title) ?? 0) + 1);
for (const [t, n] of titleCount) if (n > 1) throw new Error(`同じタイトルの記事が ${n} 本あります: ${t}（⚠️ 事業が違っても重複できない）`);

const targets = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map((f) => parse(f.split(path.sep).join('/').replace(/^.*articles\//, '')))
  : all;

// ⚠️ [[ ]] の行き先が記事ファイルに無ければ知らせる（⚠️ 画面では赤いリンクになる）
// ⚠️ コード（` ` と ``` の中）は書き方の例なので見ない（⚠️ 画面でもリンクにならない）
const withoutCode = (body) => body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
for (const a of targets) {
  for (const [, t] of withoutCode(a.body).matchAll(LINK)) {
    const screen = SCREEN.exec(t.trim());
    if (screen !== null) {
      if (!screenNames.has(screen[1].trim())) process.stderr.write(`⚠️ ${a.file}: [[${t.trim()}]] の画面が guideScreens.ts にありません（赤い札になります）\n`);
      continue;
    }
    if (!titleCount.has(t.trim())) process.stderr.write(`⚠️ ${a.file}: [[${t.trim()}]] の記事がありません（赤いリンクになります）\n`);
  }
}

const out = [];
out.push('-- ---------------------------------------------------------------');
out.push(`-- 業務ガイドの記事（${targets.length}本）。backend/scripts/guide/build-guide-sql.cjs で作成`);
out.push('-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）');
out.push('-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す');
out.push('-- ---------------------------------------------------------------');
for (const a of targets) {
  out.push(`-- ${a.file}：${a.title}`);
  out.push(`INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = ${q(a.title)};`);
  out.push(`INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES (${q(a.title)}, ${q(a.division)}, ${q(a.section)}, ${q(a.summary)}, ${q(a.body)}, ${a.sort}, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);`);
}
process.stdout.write(out.join('\n') + '\n');
