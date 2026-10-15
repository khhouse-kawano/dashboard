# 2026-10-15 契約分析（キャンペーン区分別・紹介元別）HTML レポート

## 依頼
- hp_campaign の名前から「マイホームフェア系」か「見学会系」かを分け、ブランド・店舗・エリアごとの契約を master_data で分析して HTML で出す
- 同じ HTML に、sales_promotion_name が「紹介」の顧客の introduction_person_category 別の歩留まりも出す
- それぞれ深掘りした結果を見たい

## 出力
- `C:/Users/shinji-kawano/Downloads/contract_analysis_2026-10-15.html`（1ファイル。外部はフォントだけ）
- ⚠️ 顧客ごとの実データは入っていない（集計値とキャンペーン名だけ）。⚠️ リポジトリには入れていない
- コードの変更なし（①②・フロント・DB いずれも変更なし）

## データ
- ローカルDB `local_db.master_data`（反響取得日の最大 2026/10/02）。担当店舗 `in_charge_store` → `shop_list.area` でエリア
- キャンペーン: hp_campaign あり 4,690件（重複 432件を除き 4,258件、契約 263件、328種類）
- 紹介: sales_promotion_name LIKE '%紹介%' 810件（重複 34件を除き 776件、契約 246件）

## 定義
| 項目 | 定義 |
|---|---|
| 反響 | 上の対象。**status＝重複は除く** |
| 面談 | 初回面談・事前審査・第二面談・契約のいずれかの日付がある、または契約済み |
| 次アポ | 事前審査・第二面談・契約のいずれかの日付がある、または契約済み |
| 契約 | status＝契約済み（営業別契約率と同じ） |
| 率の母数 | 反響取得日が **2026-06 まで**（契約までの日数が中央値38日・9割が99日以内のため） |

列IDは staffContract.ts と同じ（初回面談・事前審査・第二面談・契約・反響取得日）。

## キャンペーンの区分（上から順に判定）
| 区分 | 名前の条件 |
|---|---|
| 常設の来場予約 | 「【…】来場予約」「ホームページ来場予約」「〇〇からの来場予約」「店舗来場予約」など |
| 見学会系 | 見学会・見学・モデルハウス・展示場・グランドオープン・ショールーム・オープンハウス・完成・完全予約制・「〇〇町｜平屋」のような物件ページ |
| 相談会系 | 相談会・セミナー・勉強会 |
| マイホームフェア系 | フェア・フェスタ・フェス・祭・キャンペーン・感謝・記念・ブラックフライデー・商談会 |
| 資料請求・会員登録・見積 | 資料請求・会員登録・カタログ・見積・土地・はじめてばこ |
| その他 | 上のどれにも当たらないもの（新商品「Fit」誕生、LP など） |

## 主な結果（〜2026-06 の反響）
| 区分 | 反響 | 面談率 | 次アポ率 | 契約率 |
|---|---|---|---|---|
| 常設の来場予約 | 1,089 | 71.8% | 36.2% | **10.7%** |
| マイホームフェア系 | 580 | 65.5% | 26.7% | 6.0% |
| 見学会系 | 468 | 63.5% | 25.2% | 5.3% |
| 相談会系 | 140 | 65.0% | 24.3% | 2.9% |
| 資料請求・会員登録・見積 | 960 | 13.5% | 8.4% | 3.4% |
| 紹介（全体） | 586 | 86.2% | 64.5% | **36.3%** |

- フェア vs 見学会: KH は見学会（9.1%）、DJH はフェア（15.8%）が上。宮崎はフェア、熊本は見学会が上。鹿児島はほぼ同じ。大分・佐賀はどちらも低い
- 紹介元: 協力業者 66.7% / 社員 56.5% / オーナー様 45.6% / SUUMOカウンター 35.9% / 未入力 26.7%（未入力が約4割）

## 抽出SQL（ローカルDB。`--raw -N` で1行1JSON）
```sql
SELECT JSON_OBJECT('ref', IF(m.sales_promotion_name LIKE '%紹介%', 1, 0),
 'c', IFNULL(m.hp_campaign,''), 'ip', IFNULL(m.introduction_person_category,''), 'b', IFNULL(m.brand,''), 's', IFNULL(m.in_charge_store,''), 'a', IFNULL(sl.area,''), 'st', IFNULL(m.status,''),
 'inq', IFNULL(m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,''), 'iv', IFNULL(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,''),
 'sc', IFNULL(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,''), 'ap', IFNULL(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,''), 'ct', IFNULL(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,''))
FROM master_data m LEFT JOIN (SELECT shop, MIN(area) area FROM shop_list GROUP BY shop) sl ON sl.shop = m.in_charge_store
WHERE (m.hp_campaign IS NOT NULL AND m.hp_campaign <> '') OR m.sales_promotion_name LIKE '%紹介%';
```

## 集計スクリプト（agg.cjs。node agg.cjs rows.jsonl agg.json）
```js
const fs = require('fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const MATURE = '2026-06';
const has = (v) => String(v || '').trim() !== '';
const date = (v) => { const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(v || '').trim()); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const CATS = [
  ['常設の来場予約', /(^|】|～|への|からの|ホームページ|店舗)来場予約/],
  ['見学会系', /見学会|見学|モデルハウス|展示場|グランドオープン|ショールーム|オープンハウス|完成|完全予約制|｜/],
  ['相談会系', /相談会|セミナー|勉強会/],
  ['マイホームフェア系', /フェア|フェスタ|フェス|祭|キャンペーン|感謝|記念|ブラックフライデー|商談会/],
  ['資料請求・会員登録・見積', /資料請求|会員登録|カタログ|見積|土地|はじめてばこ/],
];
const catOf = (name) => { for (const [k, re] of CATS) if (re.test(name)) return k; return 'その他'; };
const BRAND = { '国分ハウジング': 'KH', 'デイジャストハウス': 'DJH', 'なごみ工務店': 'なごみ', 'ジャスフィーホーム': 'JH', 'ニーエルホーム': '2L', 'PG HOUSE': 'PGH' };
const brandOf = (b) => BRAND[b] || (b === '' ? '（空）' : b);
for (const r of rows) {
  r.valid = r.st !== '重複';
  r.contract = r.st === '契約済み';
  r.meet = r.contract || has(r.iv) || has(r.sc) || has(r.ap) || has(r.ct);
  r.next = r.contract || has(r.sc) || has(r.ap) || has(r.ct);
  r.cat = r.c ? catOf(r.c) : '';
  r.brand = brandOf(r.b);
  r.area = r.a || '（店舗未定・不明）';
  const d = date(r.inq); r.month = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
  const c = date(r.ct); r.lag = d && c && r.contract ? Math.round((c - d) / 86400000) : null;
}
const stat = (list) => {
  const v = list.filter((r) => r.valid);
  const n = v.length, meet = v.filter((r) => r.meet).length, next = v.filter((r) => r.next).length, ct = v.filter((r) => r.contract).length;
  const m = v.filter((r) => r.month !== '' && r.month <= MATURE);
  const lags = v.map((r) => r.lag).filter((x) => x !== null && x >= 0).sort((a, b) => a - b);
  return { all: list.length, dup: list.length - n, n, meet, next, ct, mn: m.length, mmeet: m.filter((r) => r.meet).length, mnext: m.filter((r) => r.next).length, mct: m.filter((r) => r.contract).length, lagMed: lags.length ? lags[Math.floor(lags.length / 2)] : null };
};
const groupBy = (list, key) => { const m = new Map(); for (const r of list) { const k = typeof key === 'function' ? key(r) : r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
const camp = rows.filter((r) => r.c);
const ref = rows.filter((r) => r.ref);
const out = {
  camp: {
    total: stat(camp),
    byCat: [...groupBy(camp, 'cat')].map(([k, l]) => ({ k, ...stat(l) })),
    byBrandCat: [...groupBy(camp, (r) => r.brand + '|' + r.cat)].map(([k, l]) => ({ k, ...stat(l) })),
    byAreaCat: [...groupBy(camp, (r) => r.area + '|' + r.cat)].map(([k, l]) => ({ k, ...stat(l) })),
    byShopCat: [...groupBy(camp, (r) => (r.s || '（空）') + '|' + r.cat)].map(([k, l]) => ({ k, ...stat(l) })),
    byShop: [...groupBy(camp, (r) => (r.s || '（空）'))].map(([k, l]) => ({ k, brand: l[0].brand, area: l[0].area, ...stat(l) })),
    byCampaign: [...groupBy(camp, 'c')].map(([k, l]) => ({ k, cat: l[0].cat, ...stat(l) })),
    byMonthCat: [...groupBy(camp, (r) => r.month + '|' + r.cat)].map(([k, l]) => ({ k, ...stat(l) })),
  },
  ref: {
    total: stat(ref),
    byCat: [...groupBy(ref, (r) => r.ip.trim() || '（未入力）')].map(([k, l]) => ({ k, ...stat(l) })),
    byBrandCat: [...groupBy(ref, (r) => r.brand + '|' + (r.ip.trim() || '（未入力）'))].map(([k, l]) => ({ k, ...stat(l) })),
    byAreaCat: [...groupBy(ref, (r) => r.area + '|' + (r.ip.trim() || '（未入力）'))].map(([k, l]) => ({ k, ...stat(l) })),
    byYearCat: [...groupBy(ref, (r) => (r.month.slice(0, 4) || '不明') + '|' + (r.ip.trim() || '（未入力）'))].map(([k, l]) => ({ k, ...stat(l) })),
    byBrand: [...groupBy(ref, 'brand')].map(([k, l]) => ({ k, ...stat(l) })),
    byArea: [...groupBy(ref, 'area')].map(([k, l]) => ({ k, ...stat(l) })),
  },
};
fs.writeFileSync(process.argv[3], JSON.stringify(out));
const p = (x, n) => n ? (x / n * 100).toFixed(1) + '%' : '-';
const show = (t, a) => { console.log('== ' + t); for (const r of a.sort((x, y) => y.n - x.n)) console.log(r.k.padEnd(28), r.n, 'meet', p(r.meet, r.n), 'next', p(r.next, r.n), 'ct', r.ct, p(r.ct, r.n), 'lag', r.lagMed); };
console.log('camp', out.camp.total, 'ref', out.ref.total);
show('camp cat', out.camp.byCat);
show('ref cat', out.ref.byCat);
show('camp brand|cat', out.camp.byBrandCat.filter(r => r.n >= 30));
show('camp area|cat', out.camp.byAreaCat.filter(r => r.n >= 30));
const months = {}; for (const r of camp.filter(r=>r.valid)) { months[r.month] = months[r.month] || [0,0]; months[r.month][0]++; if (r.contract) months[r.month][1]++; } console.log(Object.entries(months).sort());
const lags = camp.concat(ref).filter(r=>r.contract && r.lag!==null).map(r=>r.lag).sort((a,b)=>a-b); console.log('lag q', lags[Math.floor(lags.length*.25)], lags[Math.floor(lags.length*.5)], lags[Math.floor(lags.length*.75)], lags[Math.floor(lags.length*.9)], lags.length);
fs.writeFileSync(process.argv[3].replace('.json','_map.json'), JSON.stringify(out.camp.byCampaign.map(r=>[r.k,r.cat,r.n,r.ct])));
```

HTML は report.cjs（agg.json → HTML。表・色・所見の文章）で作成。所見の数字は agg.json の値を確認して書いた。
