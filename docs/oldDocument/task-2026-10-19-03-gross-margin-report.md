# 受注完工DB（CSV）から営業別の契約時粗利率を期ごとに出す（2026-10-19）

⚠️ リポジトリのコードは変えていない（集計と HTML の書き出しのみ）。

## 依頼
- `Downloads/最新版★ハウジンググループ受注完工【KHG】 - データベース (1).csv` から、粗利率を期ごとに算出して HTML に書き出す
- 期：2027年5月期（2026/06〜2027/05）・2026年5月期・2025年5月期。期は「契約計上年月日」で判定。上部に期間選択
- 営業担当・営業所属課・事業所の表記を staff_list / shop_list / section_list に寄せる
- 契約時税込請負金額・最終金合計・契約時粗利額・契約時粗利率で並べ替えできる見出し。顧客名は載せない。先頭列は営業名
- 注文営業と建売営業は別帳票、既定は注文営業

## 出力
- `C:\Users\shinji-kawano\Downloads\gross_margin_by_rep_2026-10-19.html`（1ファイルで完結・外部通信なし）

## 決めたこと
- 契約時粗利率 ＝ Σ契約時粗利額 ÷ Σ契約時税込請負金額（粗利額の入っている契約だけ）。
  - 元の表の「契約時粗利率」は税抜の請負金額で割った行が混ざる（2027年5月期の注文で36/194件）ため、合計からは計算し直した。内訳に「表の粗利率」と「計算した粗利率」を並べ、ずれに印。
  - 粗利額が請負金額を超える1件（51,212,818円）は入力誤りとみなし除外。
- 最終金合計は「#REF!」が多い（2026年5月期の注文で535/552件）。一変差額・追加契約金額も参照切れのため補わず、値のある契約だけを合計し「n/N件」を併記。
- 帳票は「種別」で分ける（注文 → 注文営業、建売・売建 → 建売営業、空欄2件は店舗の事業で判定）。
- 表記の寄せ方
  - 営業名：空白・異体字を正規化して staff_list.name に（黒葛󠄀原 → 黒葛原 など）。名簿に無い13人は元の名前のまま「名簿なし」。
  - 事業所：「X」→ shop_list の「X店」。なごみ霧島 → なごみ姶良霧島店。KH本社 → 名簿の KH 店舗（無ければ KH霧島店）。ニーエル → 名簿の 2L 店舗（無ければ 2L鹿児島店）。かえる・空欄 → その期の staff_list の店舗（係）。
  - 課：寄せた店舗の shop_list.section（無ければ staff_list.section → 元の値）。旧称の 1課〜4課・鹿児島営業一課なども現在の課名になる。
  - 名簿はその期の period（2027/2026/2025）の行を優先、無ければ最も近い期。

## 分かったこと（元の表の問題）
- 建売営業は契約時粗利額がほぼ未入力（2025年5月期 0/248件・2026年5月期 2/319件・2027年5月期 0/90件）→ 粗利率を出せない。
- 最終金合計・一変差額・追加契約金額の式が参照切れ（#REF!）。

## 確認（Playwright）
- 既定：注文営業・2027年5月期（196件・82人・粗利率 27.50%）。各列の見出しで昇順・降順。期・帳票の切り替え、課・事業所の絞り込み、営業名検索、内訳の開閉。顧客名（邸名）が HTML に含まれないこと。400px 幅で横にはみ出さないこと。

## スクリプト（scratchpad。全文）

### parse.cjs
```js
const fs = require('fs');
const parseCsv = (t) => { const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); } return rows; };
const raw = parseCsv(fs.readFileSync(__dirname + '/src.csv', 'utf8').replace(/^﻿/, ''));
const header = raw[1].map((h) => h.replace(/\s+/g, ''));
const idx = (n) => header.indexOf(n);
const recs = raw.slice(2).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
module.exports = { header, recs, idx };
if (require.main === module) {
  console.log(header.map((h, i) => i + ':' + h).join(' | '));
  const yen = (s) => Number(String(s).replace(/[^\d.-]/g, '')) || 0;
  const inP = recs.filter((r) => r['契約計上年月日'] >= '2024/06/01' && r['契約計上年月日'] <= '2027/05/31');
  console.log('rows', recs.length, 'in periods', inP.length);
  const cnt = (k) => { const m = {}; inP.forEach((r) => m[r[k]] = (m[r[k]] || 0) + 1); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  for (const k of ['種別', '会社', '事業所', '営業所属課', '契約会社', 'ブランド仕様']) console.log(k, JSON.stringify(cnt(k)));
  console.log('営業担当', cnt('営業担当').length, JSON.stringify(cnt('営業担当')));
  console.log('sample money', inP.slice(0, 5).map((r) => [r['契約計上年月日'], r['契約時税込請負金額'], r['最終金合計'], r['契約時粗利額'], r['契約時粗利率']].join(' ; ')).join('\n'));
  console.log('date formats', [...new Set(inP.map((r) => r['契約計上年月日'].replace(/\d/g, 'n')))]);
  console.log('all date formats', [...new Set(recs.map((r) => r['契約計上年月日'].replace(/\d/g, 'n')))].slice(0, 10));
  console.log('粗利率 formats', [...new Set(inP.map((r) => r['契約時粗利率'].replace(/\d/g, 'n')))].slice(0, 10));
  console.log('粗利額 empty', inP.filter((r) => !r['契約時粗利額']).length, '請負 empty', inP.filter((r) => !r['契約時税込請負金額']).length);
}
```

### build.cjs
```js
// 受注完工DB（CSV）→ 期ごとの粗利率（営業別）HTML。表記は staff_list / shop_list / section_list に寄せる
const fs = require('fs');
const { recs } = require('./parse.cjs');
const db = fs.readFileSync(__dirname + '/db.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const staff = db.filter((r) => !r.t), shops = db.filter((r) => r.t);
const OUT = process.argv[2];

const PERIODS = [
  { key: '2027', label: '2027年5月期', from: '2026-06-01', to: '2027-05-31' },
  { key: '2026', label: '2026年5月期', from: '2025-06-01', to: '2026-05-31' },
  { key: '2025', label: '2025年5月期', from: '2024-06-01', to: '2025-05-31' },
];
const norm = (s) => String(s ?? '').normalize('NFKC').replace(/[\u{E0100}-\u{E01EF}︀-️]/gu, '').replace(/[\s　]+/g, '')
  .replace(/髙/g, '高').replace(/﨑/g, '崎').replace(/濵/g, '浜').replace(/德/g, '徳');
const date = (s) => { const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const periodOf = (d) => PERIODS.find((p) => d >= p.from && d <= p.to)?.key ?? null;
const yen = (s) => /\d/.test(s) && !/#/.test(s) ? Math.round(Number(s.replace(/[^\d.-]/g, ''))) : null;
const pct = (s) => /\d/.test(s) && !/#/.test(s) ? Number(s.replace(/[^\d.]/g, '')) : null;

// ── 表記の寄せ先
const staffByName = new Map();
for (const s of staff) { const k = norm(s.name); if (!staffByName.has(k)) staffByName.set(k, []); staffByName.get(k).push(s); }
const shopByName = new Map(shops.map((s) => [norm(s.shop), s]));
const SHOP_ALIAS = { 'なごみ霧島': 'なごみ姶良霧島店' };
const csvShopToDb = (raw) => {
  const n = norm(raw); if (n === '') return null;
  if (SHOP_ALIAS[n]) return shopByName.get(norm(SHOP_ALIAS[n])) ?? null;
  return shopByName.get(n + '店') ?? shopByName.get(n) ?? null;
};
const staffFor = (name, period) => {
  const list = staffByName.get(norm(name)); if (!list) return null;
  return list.find((s) => s.period === period) ?? [...list].sort((a, b) => Math.abs(+a.period - +period) - Math.abs(+b.period - +period))[0];
};

const mapLog = { shop: {}, section: {}, name: {} };
const note = (kind, from, to) => { if (from === to) return; const k = `${from} → ${to}`; mapLog[kind][k] = (mapLog[kind][k] || 0) + 1; };
const unmatched = {};

const contracts = [];
for (const r of recs) {
  const d = date(r['契約計上年月日']); const period = periodOf(d); if (!period) continue;
  const rawName = r['営業担当'], rawShop = r['事業所'], rawSection = r['営業所属課'];
  const st = staffFor(rawName, period);
  const name = st ? st.name : rawName.normalize('NFKC').replace(/[\s　]+/g, ' ').trim() || '（営業担当なし）';
  if (st) note('name', rawName, st.name); else unmatched[name] = (unmatched[name] || 0) + 1;

  // 事業所: CSV の値を shop_list の店舗名に。⚠️ 寄せられない（KH本社・ニーエル・かえる・空）は staff_list のその期の店舗
  let shop = csvShopToDb(rawShop)?.shop ?? null;
  let shopFrom = 'csv';
  const staffShop = st?.shop ?? '';
  // ⚠️ ブランド名だけの事業所は、名簿の店舗が同じブランドならそれ、違えばブランドの代表店舗
  if (norm(rawShop) === 'ニーエル') { shop = staffShop.startsWith('2L') ? staffShop : '2L鹿児島店'; shopFrom = staffShop.startsWith('2L') ? 'staff' : 'csv'; }
  if (norm(rawShop) === 'KH本社') { shop = staffShop.startsWith('KH') ? staffShop : 'KH霧島店'; shopFrom = staffShop.startsWith('KH') ? 'staff' : 'csv'; }
  // ⚠️ 「かえる」は建売の事業所名だけなので、名簿の係（鹿児島1係など）が分かればそちら
  if (shop === 'かえる' && staffShop) { shop = staffShop; shopFrom = 'staff'; }
  if (shop === null && st && st.shop) { shop = st.shop; shopFrom = 'staff'; }
  if (shop === null) { shop = rawShop || '（事業所なし）'; shopFrom = 'raw'; }
  note('shop', rawShop || '（空）', shop + (shopFrom === 'staff' ? '（名簿）' : ''));
  // 課: shop_list の課 → 無ければ staff_list の課 → 無ければ CSV のまま
  const section = shopByName.get(norm(shop))?.section || st?.section || rawSection || '（課なし）';
  note('section', rawSection || '（空）', section);

  const kind = r['種別'] === '注文' ? 'order' : (r['種別'] === '建売' || r['種別'] === '売建') ? 'spec'
    : (shopByName.get(norm(shop))?.division === '建売分譲事業' ? 'spec' : 'order');
  const ukeoi = yen(r['契約時税込請負金額']);
  let arari = yen(r['契約時粗利額']);
  const sheetRate = pct(r['契約時粗利率']);
  // ⚠️ 粗利額が請負金額を超える行は入力の誤りとみなし、粗利の集計から外す
  const outlier = arari !== null && ukeoi !== null && arari > ukeoi;
  contracts.push({
    p: period, k: kind, d, n: name, sh: shop, se: section, br: r['ブランド仕様'], t: r['種別'] || '',
    u: ukeoi, f: yen(r['最終金合計']), a: outlier ? null : arari, r: sheetRate, x: outlier ? arari : null, m: !st,
  });
}

const sorted = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const meta = {
  periods: PERIODS, generated: '2026-10-19', source: '最新版★ハウジンググループ受注完工【KHG】 - データベース (1).csv',
  unmatched: sorted(unmatched),
  shopMap: sorted(mapLog.shop), sectionMap: sorted(mapLog.section), nameMap: sorted(mapLog.name),
};
const sectionOrder = [];
for (const s of shops) if (s.section && !sectionOrder.includes(s.section)) sectionOrder.push(s.section);
meta.sectionOrder = sectionOrder;
meta.shopOrder = shops.map((s) => s.shop);

const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const html = tpl.replace('/*__DATA__*/null', JSON.stringify({ meta, contracts }).replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log('contracts', contracts.length, 'unmatched', JSON.stringify(meta.unmatched), 'outliers', contracts.filter((c) => c.x !== null).length);
console.log('shop map', meta.shopMap.slice(0, 50).map(([k, v]) => k + ':' + v).join(' / '));
console.log('section map', meta.sectionMap.map(([k, v]) => k + ':' + v).join(' / '));
console.log('name map', meta.nameMap.map(([k, v]) => k + ':' + v).join(' / '));
```

### template.html
```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>営業別 契約時粗利率</title>
<style>
:root {
  --ink: #1f2937; --muted: #6b7280; --faint: #9ca3af; --line: #e5e7eb; --line2: #f1f5f9;
  --surface: #f8fafc; --ground: #ffffff; --accent: #0f766e; --accent-soft: #ecfdf5; --accent-line: #99f6e4;
  --order: #0d6efd; --spec: #198754; --warn-bg: #fffbeb; --warn-line: #fde68a; --warn-ink: #78350f;
  --good: #0f766e; --mid: #374151; --low: #b45309; --bar: #ccfbf1;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #e5e7eb; --muted: #9ca3af; --faint: #6b7280; --line: #334155; --line2: #1e293b;
    --surface: #111827; --ground: #0b1220; --accent: #2dd4bf; --accent-soft: #10302c; --accent-line: #115e59;
    --order: #60a5fa; --spec: #4ade80; --warn-bg: #2a2110; --warn-line: #713f12; --warn-ink: #fcd34d;
    --good: #2dd4bf; --mid: #d1d5db; --low: #fbbf24; --bar: #134e4a;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-size: 13px; line-height: 1.6;
       font-family: "Hiragino Sans", "Yu Gothic UI", "Meiryo", system-ui, sans-serif; }
.gm_wrap { max-width: 1280px; margin: 0 auto; padding: 20px 20px 60px; }
.gm_head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.gm_title { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: .01em; }
.gm_src { font-size: 11px; color: var(--muted); }

/* 絞り込みバー（上部に固定） */
.gm_panel { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: flex-end;
            background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; margin: 12px 0 14px; }
.gm_field { display: flex; flex-direction: column; gap: 3px; }
.gm_label { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .04em; }
.gm_seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--ground); }
.gm_seg button { border: none; background: none; color: var(--ink); padding: 5px 12px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.gm_seg button + button { border-left: 1px solid var(--line); }
.gm_seg button[aria-pressed="true"] { background: var(--accent); color: #fff; font-weight: 700; }
.gm_seg.is_kind button[aria-pressed="true"][data-kind="order"] { background: var(--order); }
.gm_seg.is_kind button[aria-pressed="true"][data-kind="spec"] { background: var(--spec); }
.gm_seg small { display: block; font-size: 10px; opacity: .8; font-weight: 400; }
.gm_select, .gm_search { border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px;
                         background: var(--ground); color: var(--ink); min-width: 150px; }
.gm_select:focus, .gm_search:focus, .gm_seg button:focus-visible, th button:focus-visible, .gm_name:focus-visible { outline: 2px solid var(--accent-line); outline-offset: 1px; }
.gm_reset { border: none; background: none; color: var(--accent); font-size: 12px; font-weight: 700; cursor: pointer; padding: 6px 0; text-decoration: underline; }

/* KPI カード */
.gm_kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 14px; }
.gm_kpi { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--ground); }
.gm_kpi_label { font-size: 11px; color: var(--muted); font-weight: 700; }
.gm_kpi_value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.gm_kpi_sub { font-size: 11px; color: var(--faint); }
.gm_kpi.is_main { border-color: var(--accent-line); background: var(--accent-soft); }
.gm_kpi.is_main .gm_kpi_value { color: var(--accent); font-size: 24px; }

/* 注意書き */
.gm_notice { background: var(--warn-bg); border: 1px solid var(--warn-line); color: var(--warn-ink); border-radius: 10px;
             padding: 8px 12px; font-size: 12px; margin-bottom: 12px; }
.gm_notice[hidden] { display: none; }

/* 表 */
.gm_table_wrap { overflow: auto; border: 1px solid var(--line); border-radius: 10px; max-height: calc(100vh - 150px); }
table { border-collapse: separate; border-spacing: 0; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--line2); white-space: nowrap; text-align: right; }
th:nth-child(-n+3), td:nth-child(-n+3) { text-align: left; }
thead th { position: sticky; top: 0; z-index: 2; background: var(--surface); border-bottom: 1px solid var(--line); font-size: 11px; color: var(--muted); }
th button { border: none; background: none; font: inherit; font-weight: 700; color: inherit; cursor: pointer; padding: 0; white-space: nowrap; }
th button:hover { color: var(--ink); }
th[aria-sort="ascending"] button, th[aria-sort="descending"] button { color: var(--accent); }
th .gm_arrow { display: inline-block; width: 1em; font-size: 10px; }
tbody tr.gm_row:hover td { background: var(--surface); }
tfoot td { position: sticky; bottom: 0; background: var(--surface); font-weight: 700; border-top: 1px solid var(--line); }
td:first-child { position: sticky; left: 0; background: var(--ground); z-index: 1; }
thead th:first-child { left: 0; z-index: 3; }
tfoot td:first-child { z-index: 2; background: var(--surface); }
tbody tr.gm_row:hover td:first-child { background: var(--surface); }
.gm_name { border: none; background: none; font: inherit; color: var(--ink); font-weight: 700; cursor: pointer; padding: 0; text-align: left; }
.gm_name::before { content: "▸"; display: inline-block; width: 1.1em; color: var(--faint); font-size: 10px; }
.gm_name[aria-expanded="true"]::before { content: "▾"; color: var(--accent); }
.gm_tag { font-size: 10px; color: var(--low); border: 1px solid var(--warn-line); background: var(--warn-bg); border-radius: 999px; padding: 0 6px; margin-left: 6px; font-weight: 700; }
.gm_more { color: var(--faint); font-size: 11px; margin-left: 4px; }
.gm_cov { display: block; font-size: 10px; color: var(--faint); font-weight: 400; }
.gm_rate { display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end; }
.gm_rate_bar { width: 60px; height: 6px; border-radius: 3px; background: var(--line2); overflow: hidden; }
.gm_rate_bar i { display: block; height: 100%; background: var(--bar); border-right: 2px solid var(--good); }
.gm_rate.is_good b { color: var(--good); }
.gm_rate.is_low b { color: var(--low); }
.gm_na { color: var(--faint); font-weight: 400; }

/* 契約の内訳 */
tr.gm_detail > td { padding: 0 0 10px 28px; background: var(--surface); position: static; }
.gm_detail_table { width: auto; min-width: 70%; font-size: 12px; background: var(--ground); border: 1px solid var(--line); border-radius: 8px; }
.gm_detail_table th { position: static; background: var(--ground); }
.gm_detail_table td:first-child { position: static; }
.gm_flag { font-size: 10px; color: var(--low); }

/* 説明 */
.gm_notes { margin-top: 18px; font-size: 12px; color: var(--muted); border: 1px solid var(--warn-line); background: var(--warn-bg);
            border-radius: 10px; padding: 10px 14px; }
.gm_notes ul { margin: 4px 0; padding-left: 1.3em; }
.gm_notes b { color: var(--ink); }
details { margin-top: 10px; border: 1px solid var(--line); border-radius: 10px; padding: 8px 14px; font-size: 12px; }
summary { cursor: pointer; font-weight: 700; }
.gm_map { columns: 3 240px; column-gap: 24px; margin: 8px 0 0; padding: 0; list-style: none; }
.gm_map li { break-inside: avoid; padding: 1px 0; color: var(--muted); }
.gm_map b { color: var(--ink); font-weight: 400; }
@media (max-width: 640px) {
  .gm_wrap { padding: 12px 12px 40px; }
  .gm_panel { position: static; }
  .gm_rate_bar { display: none; }
}
</style>
</head>
<body>
<div class="gm_wrap">
  <div class="gm_head">
    <h1 class="gm_title">営業別 契約時粗利率</h1>
    <span class="gm_src" id="src"></span>
  </div>

  <div class="gm_panel" role="group" aria-label="絞り込み">
    <div class="gm_field"><span class="gm_label">帳票</span><div class="gm_seg is_kind" id="kinds"></div></div>
    <div class="gm_field"><span class="gm_label">期（契約計上年月日）</span><div class="gm_seg" id="periods"></div></div>
    <label class="gm_field"><span class="gm_label">課</span><select class="gm_select" id="section"></select></label>
    <label class="gm_field"><span class="gm_label">事業所</span><select class="gm_select" id="shop"></select></label>
    <label class="gm_field"><span class="gm_label">営業名</span><input class="gm_search" id="q" type="search" placeholder="名前で探す"></label>
    <button type="button" class="gm_reset" id="reset">絞り込みを外す</button>
  </div>

  <div class="gm_kpis" id="kpis"></div>
  <div class="gm_notice" id="notice" hidden></div>

  <div class="gm_table_wrap">
    <table>
      <thead><tr id="thead"></tr></thead>
      <tbody id="tbody"></tbody>
      <tfoot id="tfoot"></tfoot>
    </table>
  </div>

  <div class="gm_notes">
    <ul>
      <li><b>期</b>は「契約計上年月日」で分けています（6月〜翌5月）。</li>
      <li><b>契約時粗利率</b>＝契約時粗利額の合計 ÷ 契約時税込請負金額の合計。粗利額が入っている契約だけで計算します（件数の下の「粗利 n件」）。</li>
      <li><b>最終金合計</b>は、元の表で「#REF!」（式の参照切れ）になっている契約が多く、値のある契約だけを足しています（「n/N件」）。一変差額・追加契約金額も同じく参照切れのため、計算で補っていません。</li>
      <li>粗利額が請負金額より大きい契約は入力の誤りとみなし、粗利の計算から外しています（内訳に印）。</li>
      <li>元の表の「契約時粗利率」には、税抜の請負金額で割ったと見られる行があります。内訳の「表の粗利率」と「計算した粗利率」がずれる行がそれです。</li>
      <li><b>帳票</b>は「種別」で分けています（注文 → 注文営業、建売・売建 → 建売営業）。</li>
      <li>営業名・課・事業所は、ダッシュボードの名簿（staff_list・shop_list・section_list）の表記に寄せています（下の「表記の寄せ方」）。</li>
      <li>営業名の左の▸を押すと、その営業の契約の内訳が開きます（お客様の名前は載せていません）。</li>
    </ul>
  </div>

  <details>
    <summary>表記の寄せ方（元の表 → ダッシュボードの名簿）</summary>
    <p><b>事業所</b>：店舗名に寄せました（例：KH鹿児島 → KH鹿児島店）。KH本社・ニーエル・かえる・空欄のように店舗名にない値は、その期の名簿の店舗にしています（「（名簿）」）。</p>
    <ul class="gm_map" id="mapShop"></ul>
    <p><b>課</b>：店舗の課（shop_list）に寄せました（例：1課・鹿児島営業一課 → 鹿児島営業1課）。</p>
    <ul class="gm_map" id="mapSection"></ul>
    <p><b>営業名</b>：空白・異体字の違いを名簿の名前に寄せました。</p>
    <ul class="gm_map" id="mapName"></ul>
    <p><b>名簿に無い営業</b>（元の表の名前のまま・表に「名簿なし」）：</p>
    <ul class="gm_map" id="unmatched"></ul>
  </details>
</div>

<script>
const DATA = /*__DATA__*/null;
const { meta, contracts } = DATA;
const KINDS = [{ key: 'order', label: '注文営業' }, { key: 'spec', label: '建売営業' }];
const COLS = [
  { key: 'name', label: '営業名', type: 'text' },
  { key: 'section', label: '課', type: 'text' },
  { key: 'shop', label: '事業所', type: 'text' },
  { key: 'n', label: '件数', type: 'num' },
  { key: 'u', label: '契約時税込請負金額', type: 'num' },
  { key: 'f', label: '最終金合計', type: 'num' },
  { key: 'a', label: '契約時粗利額', type: 'num' },
  { key: 'rate', label: '契約時粗利率', type: 'num' },
];
const state = { kind: 'order', period: meta.periods[0].key, section: '', shop: '', q: '', sort: 'u', dir: 'desc', open: new Set() };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtYen = (v) => v === null ? '<span class="gm_na">—</span>' : '¥' + Math.round(v).toLocaleString('ja-JP');
const fmtMan = (v) => v === null ? '—' : (v / 1e8 >= 1 ? (v / 1e8).toFixed(2) + '億円' : Math.round(v / 1e4).toLocaleString('ja-JP') + '万円');
const fmtPct = (v) => v === null ? '—' : (v * 100).toFixed(2) + '%';
const topOf = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);

const sumUp = (rows) => {
  const s = { n: rows.length, u: 0, f: 0, fN: 0, a: 0, aN: 0, uA: 0 };
  for (const c of rows) {
    if (c.u !== null) s.u += c.u;
    if (c.f !== null) { s.f += c.f; s.fN++; }
    if (c.a !== null && c.u) { s.a += c.a; s.aN++; s.uA += c.u; }
  }
  s.rate = s.uA > 0 ? s.a / s.uA : null;
  return s;
};

const scoped = () => contracts.filter((c) => c.k === state.kind && c.p === state.period);
const filtered = () => {
  const q = state.q.trim().replace(/\s+/g, '');
  return scoped().filter((c) => (!state.section || c.se === state.section) && (!state.shop || c.sh === state.shop)
    && (!q || c.n.replace(/\s+/g, '').includes(q)));
};

const byRep = (rows) => {
  const g = new Map();
  for (const c of rows) { if (!g.has(c.n)) g.set(c.n, []); g.get(c.n).push(c); }
  return [...g.entries()].map(([name, list]) => {
    const s = sumUp(list); const sec = {}, sh = {};
    list.forEach((c) => { sec[c.se] = (sec[c.se] || 0) + 1; sh[c.sh] = (sh[c.sh] || 0) + 1; });
    return { name, list, section: topOf(sec)[0][0], sectionMore: Object.keys(sec).length - 1, shop: topOf(sh)[0][0], shopMore: Object.keys(sh).length - 1,
      missing: list.some((c) => c.m), ...s };
  });
};

const sortRows = (rows) => {
  const col = COLS.find((c) => c.key === state.sort); const d = state.dir === 'asc' ? 1 : -1;
  return rows.sort((x, y) => {
    let a = x[state.sort], b = y[state.sort];
    if (col.type === 'text') return d * String(a).localeCompare(String(b), 'ja');
    // ⚠️ 値の無い行（粗利未入力など）は並べ方によらず下へ
    if (a === null && b === null) return 0; if (a === null) return 1; if (b === null) return -1;
    if (state.sort === 'f') { a = x.fN ? a : null; b = y.fN ? b : null; if (a === null) return 1; if (b === null) return -1; }
    return d * (a - b) || y.u - x.u;
  });
};

const rateCell = (rate, cov) => {
  if (rate === null) return `<span class="gm_na">未入力</span>${cov}`;
  const cls = rate >= 0.3 ? 'is_good' : rate < 0.25 ? 'is_low' : '';
  const w = Math.max(0, Math.min(100, rate / 0.4 * 100));
  return `<span class="gm_rate ${cls}"><span class="gm_rate_bar" aria-hidden="true"><i style="width:${w}%"></i></span><b>${fmtPct(rate)}</b></span>${cov}`;
};

const renderControls = () => {
  $('kinds').innerHTML = KINDS.map((k) => `<button type="button" data-kind="${k.key}" aria-pressed="${k.key === state.kind}">${k.label}</button>`).join('');
  $('periods').innerHTML = meta.periods.map((p) => `<button type="button" data-period="${p.key}" aria-pressed="${p.key === state.period}">${p.label}<small>${p.from.slice(0, 7).replace('-', '/')}〜${p.to.slice(0, 7).replace('-', '/')}</small></button>`).join('');
  const rows = scoped();
  const secs = [...new Set(rows.map((c) => c.se))].sort((a, b) => (meta.sectionOrder.indexOf(a) + 1 || 999) - (meta.sectionOrder.indexOf(b) + 1 || 999));
  const shopsIn = [...new Set(rows.filter((c) => !state.section || c.se === state.section).map((c) => c.sh))]
    .sort((a, b) => (meta.shopOrder.indexOf(a) + 1 || 999) - (meta.shopOrder.indexOf(b) + 1 || 999));
  if (state.section && !secs.includes(state.section)) state.section = '';
  if (state.shop && !shopsIn.includes(state.shop)) state.shop = '';
  $('section').innerHTML = `<option value="">すべて</option>` + secs.map((s) => `<option${s === state.section ? ' selected' : ''}>${esc(s)}</option>`).join('');
  $('shop').innerHTML = `<option value="">すべて</option>` + shopsIn.map((s) => `<option${s === state.shop ? ' selected' : ''}>${esc(s)}</option>`).join('');
};

const render = () => {
  renderControls();
  const rows = filtered(); const t = sumUp(rows);
  const period = meta.periods.find((p) => p.key === state.period);
  $('kpis').innerHTML = [
    { label: '契約時粗利率', value: fmtPct(t.rate), sub: `粗利の入力 ${t.aN}/${t.n}件`, main: true },
    { label: '契約件数', value: t.n.toLocaleString('ja-JP') + '件', sub: `${period.label}・${KINDS.find((k) => k.key === state.kind).label}` },
    { label: '契約時税込請負金額', value: fmtMan(t.u), sub: t.n ? `1件あたり ${fmtMan(t.u / t.n)}` : '' },
    { label: '最終金合計', value: t.fN ? fmtMan(t.f) : '—', sub: `値のある契約 ${t.fN}/${t.n}件` },
    { label: '契約時粗利額', value: t.aN ? fmtMan(t.a) : '—', sub: t.aN ? `1件あたり ${fmtMan(t.a / t.aN)}` : '入力なし' },
  ].map((k) => `<div class="gm_kpi${k.main ? ' is_main' : ''}"><div class="gm_kpi_label">${k.label}</div><div class="gm_kpi_value">${k.value}</div><div class="gm_kpi_sub">${k.sub}</div></div>`).join('');

  const notices = [];
  if (t.n > 0 && t.aN / t.n < 0.5) notices.push(`この帳票・期は、元の表に<b>契約時粗利額がほとんど入っていません</b>（${t.aN}/${t.n}件）。粗利率は参考にならないため、元の表への入力が必要です。`);
  if (t.n > 0 && t.fN / t.n < 0.5) notices.push(`最終金合計は ${t.fN}/${t.n}件しか値がありません（元の表で「#REF!」）。合計は値のある契約だけです。`);
  $('notice').hidden = notices.length === 0;
  $('notice').innerHTML = notices.join('<br>');

  $('thead').innerHTML = COLS.map((c) => {
    const sorted = state.sort === c.key; const aria = sorted ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th aria-sort="${aria}"><button type="button" data-sort="${c.key}">${c.label}<span class="gm_arrow">${sorted ? (state.dir === 'asc' ? '▲' : '▼') : ''}</span></button></th>`;
  }).join('');

  const reps = sortRows(byRep(rows));
  $('tbody').innerHTML = reps.map((r) => {
    const open = state.open.has(r.name);
    const main = `<tr class="gm_row">
      <td><button type="button" class="gm_name" data-rep="${esc(r.name)}" aria-expanded="${open}">${esc(r.name)}</button>${r.missing ? '<span class="gm_tag">名簿なし</span>' : ''}</td>
      <td>${esc(r.section)}${r.sectionMore ? `<span class="gm_more">ほか${r.sectionMore}</span>` : ''}</td>
      <td>${esc(r.shop)}${r.shopMore ? `<span class="gm_more">ほか${r.shopMore}</span>` : ''}</td>
      <td>${r.n}</td>
      <td>${fmtYen(r.u)}</td>
      <td>${r.fN ? fmtYen(r.f) : fmtYen(null)}<span class="gm_cov">${r.fN}/${r.n}件</span></td>
      <td>${r.aN ? fmtYen(r.a) : fmtYen(null)}</td>
      <td>${rateCell(r.rate, `<span class="gm_cov">粗利 ${r.aN}件</span>`)}</td>
    </tr>`;
    if (!open) return main;
    const lines = [...r.list].sort((a, b) => a.d.localeCompare(b.d)).map((c) => {
      const calc = c.a !== null && c.u ? c.a / c.u : null;
      const diff = calc !== null && c.r !== null && Math.abs(calc * 100 - c.r) >= 0.06;
      return `<tr><td>${c.d.replace(/-/g, '/')}</td><td>${esc(c.sh)}</td><td>${esc(c.br)}</td><td>${esc(c.t)}</td>
        <td>${fmtYen(c.u)}</td><td>${fmtYen(c.f)}</td><td>${c.x !== null ? `<span class="gm_flag">¥${c.x.toLocaleString('ja-JP')}（請負超・除外）</span>` : fmtYen(c.a)}</td>
        <td>${c.r === null ? '<span class="gm_na">—</span>' : c.r.toFixed(2) + '%'}</td>
        <td>${calc === null ? '<span class="gm_na">—</span>' : fmtPct(calc)}${diff ? ' <span class="gm_flag">ずれ</span>' : ''}</td></tr>`;
    }).join('');
    return main + `<tr class="gm_detail"><td colspan="${COLS.length}"><table class="gm_detail_table"><thead><tr>
      <th>契約計上日</th><th>事業所</th><th>ブランド</th><th>種別</th><th>税込請負金額</th><th>最終金合計</th><th>粗利額</th><th>表の粗利率</th><th>計算した粗利率</th>
      </tr></thead><tbody>${lines}</tbody></table></td></tr>`;
  }).join('') || `<tr><td colspan="${COLS.length}" style="text-align:center;color:var(--faint);padding:24px">該当する契約がありません</td></tr>`;

  $('tfoot').innerHTML = `<tr><td>合計（${reps.length}人）</td><td></td><td></td><td>${t.n}</td><td>${fmtYen(t.u)}</td>
    <td>${t.fN ? fmtYen(t.f) : fmtYen(null)}<span class="gm_cov">${t.fN}/${t.n}件</span></td><td>${t.aN ? fmtYen(t.a) : fmtYen(null)}</td>
    <td>${rateCell(t.rate, `<span class="gm_cov">粗利 ${t.aN}件</span>`)}</td></tr>`;
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.kind) { state.kind = b.dataset.kind; state.section = ''; state.shop = ''; state.open.clear(); render(); }
  else if (b.dataset.period) { state.period = b.dataset.period; state.open.clear(); render(); }
  else if (b.dataset.sort) {
    const k = b.dataset.sort;
    if (state.sort === k) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.sort = k; state.dir = COLS.find((c) => c.key === k).type === 'text' ? 'asc' : 'desc'; }
    render();
  } else if (b.dataset.rep !== undefined) { const n = b.dataset.rep; state.open.has(n) ? state.open.delete(n) : state.open.add(n); render(); }
  else if (b.id === 'reset') { state.section = ''; state.shop = ''; state.q = ''; $('q').value = ''; render(); }
});
$('section').addEventListener('change', (e) => { state.section = e.target.value; state.shop = ''; render(); });
$('shop').addEventListener('change', (e) => { state.shop = e.target.value; render(); });
$('q').addEventListener('input', (e) => { state.q = e.target.value; render(); });

$('src').textContent = `元データ：${meta.source}（${meta.generated} 作成）`;
const list = (id, rows) => { $(id).innerHTML = rows.map(([k, v]) => `<li><b>${esc(k)}</b>（${v}件）</li>`).join('') || '<li>なし</li>'; };
list('mapShop', meta.shopMap); list('mapSection', meta.sectionMap); list('mapName', meta.nameMap); list('unmatched', meta.unmatched);
render();
</script>
</body>
</html>
```
