# 2026-10-05-07　注文事業の勝因分析（HTML出力）

## 依頼

> 勝因分析をしてほしい
> master_dataの契約(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG)が2026/06/01以降の顧客
> そしてこの顧客IDと一致するinterview_sheetのidのinterview_logも参照
> どういう面談をしているか／勝ちパターンがないか／200件弱のデータから分析してHTML出力してほしい

## 成果物

| 場所 | ファイル |
|---|---|
| `C:\Users\shinji-kawano\Downloads\` | **勝因分析_注文事業_2026-10-05.html**（新規・リポジトリ外） |

- リポジトリのコードは変更していない。DBは読み取りのみ（ローカル local_db）。
- 顧客データを含むため、Artifact として公開はしていない。HTMLに氏名・電話・住所は載せていない。

## 調べてわかったこと

- 契約日の列は `2026/03/22` と `2026-06-06` の書式が混在している。文字列のまま `>= '2026-06-01'` で比べると、`2026/...` がすべて対象に入ってしまう（295件になる）。`STR_TO_DATE(REPLACE(col,'/','-'),'%Y-%m-%d')` でそろえると **196件**。
- interview_sheet.interview_log は JSON 配列 `[{day, action, note, staff}]`。196件すべてに記録があり、合計は1,100件。
- `JSON_OBJECT()` に interview_log を入れると、文字列ではなく配列のまま埋め込まれる（JSON列のため）。node 側で `JSON.parse` を重ねると失敗する。

## 比較の方法

- 比較対象は、初回面談が 2026/5/1〜8/15 の注文事業の顧客（契約日なし・重複を除く）984人と、同じ期間に初回面談をした契約者145人。合計1,129人。
- 行動は、面談メモのキーワードで判定した（正規表現は下のスクリプトを参照）。

## 主な結果

| 項目 | 結果 |
|---|---|
| 初回→契約 | 中央値31日、面談4回、面談の間隔7日 |
| 面談回数別の契約率 | 1回 1.2% → 3回 21.9% → 5回以上 38.2% |
| 2回目までにテスクロ | 38.5%（なしは18.9%） |
| 2回目までに事前審査 | 29.7%（なしは18.2%） |
| 初回で次回アポ | 16.1%（なしは8.4%） |
| 紹介者あり | 34.5%（なしは9.7%） |
| 差がつかなかった行動 | LINE、モデル案内、競合の聞き取り、資金計画 |

## 使ったSQL（契約者の抽出・個人情報の列は取り出していない）
```sql
SELECT JSON_OBJECT(
 'id', m.id, 'shop', m.in_charge_store, 'staff', m.in_charge_user, 'brand', m.brand, 'category', m.category, 'status', m.status,
 'medium', m.sales_promotion_name, 'medium2', m.sales_promotion_name_2, 'reaction', m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
 'first', m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, 'second', m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
 'line', m.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN, 'preexam', m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
 'zero', m.step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, 'contract', m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
 'rank', m.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, 'survey', m.customized_input_01J95TC6KEES87F0YXH29AJP7K,
 'event', m.customized_input_01JRCT12N9X24PCQ5QZPAYKB93, 'priority', m.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
 'win', m.competitor_win_reason, 'gap', m.competitor_price_gap, 'competitors', m.competitors_text, 'competitor', m.competitor,
 'land', m.has_owned_land, 'budget', m.budget, 'income', m.customer_contacts_annual_income, 'birth', LEFT(m.customer_contacts_birth_date,4),
 'motivation', m.house_hunting_motivation, 'inquiry', m.inquiry_reason, 'intro', m.introduction_person_category, 'tags', m.customer_tags,
 'price', m.contraction_contract_price, 'count', m.customer_contacts_count, 'desired_date', m.desired_purchase_date,
 'log', (SELECT s.interview_log FROM interview_sheet s WHERE s.id = m.id ORDER BY s.no DESC LIMIT 1),
 'sheets', (SELECT COUNT(*) FROM interview_sheet s WHERE s.id = m.id)
) FROM master_data m
WHERE STR_TO_DATE(REPLACE(m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,'/','-'),'%Y-%m-%d') >= '2026-06-01';
```

## 比較対象の抽出SQL
```sql
SELECT JSON_OBJECT(
 'id', m.id, 'shop', m.in_charge_store, 'staff', m.in_charge_user, 'category', m.category, 'status', m.status,
 'medium', m.sales_promotion_name, 'reaction', m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
 'first', m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, 'second', m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
 'preexam', m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, 'contract', m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
 'rank', m.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, 'priority', m.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
 'land', m.has_owned_land, 'intro', m.introduction_person_category, 'lost', m.customized_input_01JRF9CZSW65A151WR30NA4PB3,
 'reason', m.last_action_step_migration_item_name,
 'log', (SELECT s.interview_log FROM interview_sheet s WHERE s.id = m.id ORDER BY s.no DESC LIMIT 1)
) FROM master_data m
WHERE m.category IN ('order','注文')
  AND (m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG IS NULL OR m.step_migration_item_01J82Z5F1RR18Z792C7KZS88QG = '') AND m.status <> '重複'
  AND STR_TO_DATE(REPLACE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,'/','-'),'%Y-%m-%d') BETWEEN '2026-05-01' AND '2026-08-15'
  AND EXISTS (SELECT 1 FROM interview_sheet s WHERE s.id = m.id);
```

## 集計スクリプト（行動比較・面談回数・属性）
```js
const fs=require('fs');
const load=f=>fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).map(r=>({...r,log:(Array.isArray(r.log)?r.log:(r.log?JSON.parse(r.log):[])).slice().sort((a,b)=>String(a.day).localeCompare(String(b.day)))}));
const W=load(process.argv[2]),B=load(process.argv[3]);
const D=s=>{if(!s)return null;const t=Date.parse(String(s).replace(/\//g,'-').slice(0,10));return isNaN(t)?null:t};const DAY=864e5;
const q=(a,p)=>{a=a.filter(x=>x!=null&&!isNaN(x)).sort((x,y)=>x-y);if(!a.length)return null;return a[Math.min(a.length-1,Math.floor(a.length*p))]};
const isIv=e=>/面談|事前審査/.test(e.action);
const FEAT={
 '事前審査':/事前|仮審査|審査/,
 '資金計画・FP':/資金計画|FP|ＦＰ|ハッピーライフ|ローン相談|月々|返済/,
 '土地案内・買付':/土地(案内|提案|紹介)|現地案内|買付|分譲地/,
 'プラン提示':/プラン|間取り|図面|P1|PT|ゾーニング/,
 '見積提示':/見積/,
 'テスクロ・CL':/テスクロ|TCL|クロージング|ｸﾛｰｼﾞﾝｸﾞ|(^|[^A-Z])CL/,
 '構造ブース・モデル・見学会':/構造|モデル|見学会|完見/,
 '敷地調査・現調':/敷地調査|敷調|現調|現地調査|役所調査|役調|解体/,
 '夫婦そろって':/ご夫婦|ご夫妻|お二人|おふたり|2名|２名|ご家族/,
 '親御様':/親御|ご両親|お父様|お母様|義親|父親|母親|祖父/,
 '競合確認':/競合|他社|一条|タマ|昭和|アイダ|七呂|センチュリー|ヤマサ|丸商|リブワーク|NEO|ネオ/,
 'LINE':/LINE|ライン|line|Line/,
 '次回アポ確定':/次回|次アポ|➀次回|①次回/,
 'キャンペーン・補助金':/キャンペーン|ｷｬﾝﾍﾟｰﾝ|補助金|値引|地盤改良/,
 '建築申込・手付金':/建築申込|申込金|申込書|手付|内諾|依頼書/,
 '初回シート様式(①〜⑪)':/[①➀].{0,15}次回アポ/,
};
const textOf=es=>es.map(e=>e.action+' '+(e.note||'')).join(' ');
function firstN(r,n){const es=r.log.filter(e=>e.action!=='契約');const out=[];let c=0;for(const e of es){out.push(e);if(/面談/.test(e.action)){c++;if(c>=n)break}}return out}
const iv=r=>r.log.filter(e=>/面談/.test(e.action));
// ---------- 1. 契約者196件の記述統計
const S={};
S.n=W.length;
S.leadFirstContract=[.25,.5,.75].map(p=>q(W.map(r=>{const f=D(iv(r)[0]?.day||r.first),c=D(r.contract);return f&&c?(c-f)/DAY:null}),p));
S.reactionFirst=[.25,.5,.75].map(p=>q(W.map(r=>{const f=D(r.first),c=D(r.reaction);return f&&c?(f-c)/DAY:null}).filter(x=>x>=0),p));
S.ivCount=[.25,.5,.75].map(p=>q(W.map(r=>iv(r).filter(e=>D(e.day)<=D(r.contract)).length),p));
const gaps=[];W.forEach(r=>{const ds=iv(r).map(e=>D(e.day)).filter(x=>x&&x<=D(r.contract));for(let i=1;i<ds.length;i++)gaps.push((ds[i]-ds[i-1])/DAY)});S.ivGap=[.25,.5,.75].map(p=>q(gaps,p));
S.first2second=[.25,.5,.75].map(p=>q(W.map(r=>{const v=iv(r);return v.length>1?(D(v[1].day)-D(v[0].day))/DAY:null}),p));
S.leadBuckets=(()=>{const a=W.map(r=>{const f=D(iv(r)[0]?.day||r.first),c=D(r.contract);return f&&c?(c-f)/DAY:null}).filter(x=>x!=null);return {'〜14日':a.filter(x=>x<=14).length,'15〜30日':a.filter(x=>x>14&&x<=30).length,'31〜60日':a.filter(x=>x>30&&x<=60).length,'61〜90日':a.filter(x=>x>60&&x<=90).length,'91日〜':a.filter(x=>x>90).length}})();
S.ivBuckets=(()=>{const m={};W.forEach(r=>{let n=iv(r).filter(e=>D(e.day)<=D(r.contract)).length;const k=n>=8?'8回以上':n+'回';m[k]=(m[k]||0)+1});return m})();
// 事前審査のタイミング(何回目の面談までに出るか)
S.preexamAt=(()=>{const m={};W.forEach(r=>{const es=r.log.filter(e=>e.action!=='契約');let c=0,at=null;for(const e of es){if(/面談/.test(e.action))c++;if(FEAT['事前審査'].test(e.action+' '+(e.note||''))){at=Math.max(c,1);break}}const k=at==null?'記載なし':(at>=4?'4回目以降':at+'回目まで');m[k]=(m[k]||0)+1});return m})();
// 契約者全体での各要素の出現率(契約前の全記録)
S.featAll=Object.fromEntries(Object.entries(FEAT).map(([k,re])=>[k,W.filter(r=>re.test(textOf(r.log.filter(e=>e.action!=='契約'&&D(e.day)<=D(r.contract))))).length]));
// 媒体・重視・土地・紹介
const tally=f=>{const m={};W.forEach(r=>{const v=(f(r)||'(未入力)').toString().trim();m[v]=(m[v]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])};
S.medium=tally(r=>r.medium);S.priority=tally(r=>r.priority);S.land=tally(r=>r.land);S.intro=tally(r=>r.intro);S.shop=tally(r=>r.shop);
S.month=tally(r=>String(r.contract).replace(/\//g,'-').slice(0,7)).sort();
S.withCompetitors=W.filter(r=>r.competitors).length;S.winFilled=W.filter(r=>r.win).length;
S.status=tally(r=>r.status);
// ---------- 2. コホート比較(初回 2026/5/1〜8/15)
const inWin=r=>{const f=D(r.first);return f&&f>=D('2026-05-01')&&f<=D('2026-08-15')};
const Wc=W.filter(inWin);const C=[...Wc.map(r=>({...r,won:1})),...B.map(r=>({...r,won:0}))];
S.cohort={won:Wc.length,lost:B.length,rate:Wc.length/C.length};
S.cohortStatus=(()=>{const m={};B.forEach(r=>m[r.status]=(m[r.status]||0)+1);return m})();
// 面談回数別契約率
S.byIv=(()=>{const g={};C.forEach(r=>{let n=iv(r).filter(e=>!r.won||D(e.day)<=D(r.contract)).length;const k=n>=5?'5回以上':n+'回';(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return g})();
// 2回目までの日数別(2回以上面談した人)
S.bySecondGap=(()=>{const g={};C.forEach(r=>{const v=iv(r);if(v.length<2)return;const d=(D(v[1].day)-D(v[0].day))/DAY;const k=d<=7?'7日以内':d<=14?'8〜14日':d<=30?'15〜30日':'31日以上';(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return g})();
// 初回+2回目までの要素(2回以上面談した人に限定して比較)
const C2=C.filter(r=>iv(r).length>=2);
S.c2={n:C2.length,won:C2.filter(r=>r.won).length};
S.feat2=Object.entries(FEAT).map(([k,re])=>{const has=C2.filter(r=>re.test(textOf(firstN(r,2))));const no=C2.filter(r=>!re.test(textOf(firstN(r,2))));return {k,has:has.length,hasWon:has.filter(r=>r.won).length,no:no.length,noWon:no.filter(r=>r.won).length}});
// 初回のみの要素(全員)
S.feat1=Object.entries(FEAT).map(([k,re])=>{const has=C.filter(r=>re.test(textOf(firstN(r,1))));const no=C.filter(r=>!re.test(textOf(firstN(r,1))));return {k,has:has.length,hasWon:has.filter(r=>r.won).length,no:no.length,noWon:no.filter(r=>r.won).length}});
// 初回メモの長さ
S.noteLen=(()=>{const g={};C.forEach(r=>{const l=(firstN(r,1).map(e=>e.note||'').join('')).length;const k=l===0?'空欄':l<50?'50字未満':l<200?'50〜199字':'200字以上';(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return g})();
S.byMedium=(()=>{const g={};C.forEach(r=>{const k=(r.medium||'(未入力)').trim();(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return Object.entries(g).filter(([k,v])=>v[0]>=15).sort((a,b)=>b[1][1]/b[1][0]-a[1][1]/a[1][0])})();
S.byPriority=(()=>{const g={};C.forEach(r=>{const k=(r.priority||'(未入力)').trim();(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return g})();
S.byLand=(()=>{const g={};C.forEach(r=>{const k=(r.land||'(未入力)').trim();(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return g})();
S.byIntro=(()=>{const g={};C.forEach(r=>{const k=r.intro?'紹介者あり':'紹介者なし';(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});return g})();
S.lostReasons=(()=>{const m={};B.forEach(r=>{const k=(r.lost||'').trim();if(k)m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12)})();
fs.writeFileSync(process.argv[4],JSON.stringify(S,null,1));console.log(JSON.stringify(S));
```

## 集計スクリプト（事前審査のタイミング・勝因の分類）
```js
const fs=require('fs');
const load=f=>fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).map(r=>({...r,log:(Array.isArray(r.log)?r.log:(r.log?JSON.parse(r.log):[])).slice().sort((a,b)=>String(a.day).localeCompare(String(b.day)))}));
const W=load(process.argv[2]),B=load(process.argv[3]);
const D=s=>{if(!s)return null;const t=Date.parse(String(s).replace(/\//g,'-').slice(0,10));return isNaN(t)?null:t};const DAY=864e5;
const iv=r=>r.log.filter(e=>/面談/.test(e.action));
// 実際に事前審査を動かした記録(記入・提出・承認・申込)
const PRE=e=>e.action==='事前審査'||/(事前|仮審査|審査).{0,12}(記入|提出|承認|申込|申し込み|用紙|書類|回答|否決)|(記入|提出).{0,6}(事前|審査)/.test(e.note||'');
const at=r=>{let c=0;for(const e of r.log.filter(e=>e.action!=='契約')){if(/面談/.test(e.action))c++;if(PRE(e))return Math.max(c,1)}return null};
const m={};W.forEach(r=>{const a=at(r);const k=a==null?'記録なし':a>=4?'4回目以降':a+'回目まで';m[k]=(m[k]||0)+1});console.log('preexamAt',JSON.stringify(m));
const inWin=r=>{const f=D(r.first);return f&&f>=D('2026-05-01')&&f<=D('2026-08-15')};
const C=[...W.filter(inWin).map(r=>({...r,won:1})),...B.map(r=>({...r,won:0}))].filter(r=>iv(r).length>=2);
const g={};C.forEach(r=>{const a=at(r);const k=a==null?'2回目までに無し':a<=2?'2回目までに実施':'2回目までに無し';(g[k]=g[k]||[0,0])[0]++;if(r.won)g[k][1]++});console.log('preexam within2',JSON.stringify(g));
// 勝因カテゴリ
const CAT={'紹介・人間関係':/紹介|知人|OB|後輩|人柄|相性|気に入|信頼|人勝ち|味方|社長/,'競合を回らせない／単独折衝':/単独|競合(無|な)|他社競合無|行かせ|回らせ|回らない|除外|排除|スケジュール|先の先/,'資金計画・ローン・補助金':/資金計画|FP|ローン|補助金|予算取り|融資/,'提案力（プラン・間取り・土地）':/提案|プラン|間取り|図面|土地/,'スピード・レスポンス':/スピード|迅速|早急|早期|中2日|レスポンス|密の連絡/,'総額・建てた後のコスト':/総額|総体|メンテナンス|ランニング|不明瞭|建築後/,'性能・商品力':/性能|商品|構造|仕様|設備/,'キャンペーン':/キャンペーン/};
const wins=W.filter(r=>r.win&&!/^(不明|記載なし)$/.test(r.win.trim()));console.log('winN',wins.length);
console.log(JSON.stringify(Object.entries(CAT).map(([k,re])=>[k,wins.filter(r=>re.test(r.win)).length])));
// 事前審査→契約日数
const pc=W.map(r=>{const e=r.log.find(PRE);return e?(D(r.contract)-D(e.day))/DAY:null}).filter(x=>x!=null&&x>=0).sort((a,b)=>a-b);console.log('preexam->contract q',pc[Math.floor(pc.length*.25)],pc[Math.floor(pc.length/2)],pc[Math.floor(pc.length*.75)],pc.length);
// 建築申込→契約
const ac=W.map(r=>{const e=r.log.find(e=>/建築申込|申込金|申込書|手付|内諾|依頼書/.test(e.note||''));return e?(D(r.contract)-D(e.day))/DAY:null}).filter(x=>x!=null&&x>=0).sort((a,b)=>a-b);console.log('apply->contract med',ac[Math.floor(ac.length/2)],ac.length);
// 1回だけで契約した10件
W.filter(r=>iv(r).filter(e=>D(e.day)<=D(r.contract)).length<=1).forEach(r=>console.log('one',r.medium,r.intro||'',r.land||'',(r.win||'').slice(0,40)));
```
