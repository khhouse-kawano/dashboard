# 新春1億円CP期（2025/12/27〜2026/01/25）注文反響の歩留まり分析

日付：2026-11-13　ブランチ：なし（分析だけ。リポジトリのコードは変えていない）

## 依頼
- 期間内に届いた注文事業の全反響（master_data）と、そのうち面談した顧客（interview_sheet.interview_log）の分析
- 反響元（sales_promotion_name・hp_campaign）ごと、課・店舗ごとの KPI の歩留まり
- ダウンロードの「反響一覧【KHG】 - 2026新春1億円CP入力用.csv」の店舗ごとの集計と、キャンペーンの活用方法
- HTML で出力。上部にコントロールタブ

## 出力
- `C:\Users\shinji-kawano\Downloads\新春CP期_注文反響の歩留まり分析.html`（1ファイル。集計値だけを埋め込み、氏名は含まない）
- タブ：概要／反響媒体別／キャンペーン別／課×媒体／店舗×媒体／面談した顧客／新春1億円CP（入力表）／CPの活用方法
- 上部の操作：率の基準（反響に対する率・前の段階に対する率）、表示する反響数、見出しクリックで並べ替え

## 集計の定義
- 対象：ローカル DB（本番の写し。反響日の最大は 2026/11/04）の master_data、show_dashboard = 1、反響日（step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99）が期間内。
  - ⚠️ 反響日に「2026-03-01」のようなハイフン区切りが混ざっており、文字列の比較（BETWEEN '2025/12/27' AND '2026/01/25'）だと期間外が入る（1,840件になる）。日付として解釈してから絞った（919件）。
  - 状態「重複」45件を除いた 874件。
- KPI 列：初回面談 01J82Z5F1GQB02S1DEBZPBFDW7／2回目以降面談 01JSENACS2FC422ZHEZWNSXNYA／事前審査 01JSE0CRECT96FMYTZ1ZREC3QR／契約 01J82Z5F1RR18Z792C7KZS88QG（interviewKpi.ts の ORDER_MAP と同じ）。
- 面談した顧客：interview_log に「初回面談」「2回目以降面談」「オンライン面談」が1件以上（267人）。本文（note）は読まず action と day だけを取り出した。
- 課：shop_list（division = 注文事業）の section。
- CSV：重複2行（同じ氏名・同じ店舗）を除く46件。初回来場日の年の打ち間違い1件、店舗の入力間違い1件（追客状況の欄に記載）を直した。氏名から「様」と空白を除いて顧客DBと照合（35件一致）。

## 主な結果
- 反響 874 → 初回面談 280（32.0%）→ 2回目以降面談 111（12.7%）→ 事前審査 66 → 契約 48（5.5%）
- HPの新春CP反響 58 → 初回面談 38（65.5%）→ 2回目 11 → 契約 5（8.6%）。来場予約は 75 → 契約 12（16.0%）
- HOME'S 232・タウンライフ 196 は初回面談率 12.1%・7.1%
- 面談1回で止まる 155人（契約率 10.3%）、2回 82人（25.6%）
- 入力表：エントリー 46 → 契約済 16。2週間以内の再来場でのエントリーは 4/6 が契約。申込実績0の店舗が8店舗

## 確認
- Playwright（sync の node_modules）でライト・ダーク・幅390px を表示。8タブすべてを開き、率の切り替え・課の切り替え・並べ替え・店舗の選択を操作して、エラー0、横スクロールなし。
- 氏名を含む抽出ファイルは削除した。

## 使ったスクリプト（scratchpad。リポジトリには入れていない）
```python
# 新春CP期間（2025/12/27〜2026/01/25）の注文反響の分析。出力は集計値だけ（氏名は出さない）。
import csv, json, sys, re, statistics
from collections import defaultdict, Counter
from datetime import date

TSV, SHOPS, CSVF, OUT = sys.argv[1:5]
START, END = '2025/12/27', '2026/01/25'

def d(s):
    m = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})', s or '')
    return date(int(m[1]), int(m[2]), int(m[3])) if m else None

def norm_name(s):
    return re.sub(r'[\s　・様]', '', s or '')

def dec(s):
    if not s or s == 'NULL':
        return []
    try:
        arr = json.loads(s)
    except Exception:
        return []
    out = []
    for a in arr:
        a = a or ''
        if '\\u' in a:
            try: a = json.loads('"' + a + '"')
            except Exception: pass
        out.append(a)
    return out

# ---- 店舗→課
shop_section = {}
for l in open(SHOPS, encoding='utf-8'):
    f = l.rstrip('\n').split('\t')
    if len(f) >= 2 and f[1] and f[1] != 'NULL':
        shop_section[f[0]] = f[1]

# ---- DB 行（改行入りの媒体名で割れた行をつなぐ）
rows, buf = [], []
for l in open(TSV, encoding='utf-8'):
    f = l.rstrip('\n').split('\t')
    if buf:
        f = buf[:-1] + [buf[-1] + f[0]] + f[1:]
        buf = []
    if len(f) < 15:
        buf = f; continue
    rows.append(f)

MEET = {'初回面談', '2回目以降面談', 'オンライン面談'}
all_cust, period = [], []
for f in rows:
    acts, days = dec(f[13]), dec(f[14])
    c = dict(id=f[0], shop=f[1], medium=f[2].strip() or '（未入力）', campaign=f[3].strip() if f[3] not in ('', 'NULL') else '',
             status=f[4], reg=f[5], first=f[6], second=f[7], screen=f[8], contract=f[9], show=f[11] == '1', name=norm_name(f[12]),
             acts=acts, days=days)
    c['section'] = shop_section.get(c['shop'], '（課なし）')
    c['brand'] = re.match(r'^(KH|DJH|なごみ|2L|FH|PGH|JH)', c['shop'])[1] if re.match(r'^(KH|DJH|なごみ|2L|FH|PGH|JH)', c['shop']) else 'その他'
    meets = [dd for a, dd in zip(acts, days) if a in MEET]
    c['meet_log'] = len(meets) > 0
    c['meet_n'] = len(meets)
    c['log_n'] = len([a for a in acts if a])
    c['line'] = 'LINEグループ作成' in acts
    all_cust.append(c)
    rd = d(c['reg'])
    if c['show'] and rd and d(START) <= rd <= d(END):
        period.append(c)

dup = [c for c in period if c['status'] == '重複']
base = [c for c in period if c['status'] != '重複']

STAGES = [('reg', '反響'), ('first', '初回面談'), ('second', '2回目以降面談'), ('screen', '事前審査'), ('contract', '契約')]
def has(c, k):
    return bool(d(c[k])) if k != 'reg' else True

def funnel(cs):
    r = {k: sum(1 for c in cs if has(c, k)) for k, _ in STAGES}
    r['meet_log'] = sum(1 for c in cs if c['meet_log'])
    r['lost'] = sum(1 for c in cs if c['status'] == '失注')
    r['mgmt'] = sum(1 for c in cs if c['status'] == '会社管理')
    return r

def group(cs, key):
    g = defaultdict(list)
    for c in cs: g[key(c)].append(c)
    return {k: funnel(v) for k, v in g.items()}

def cross(cs, k1, k2):
    g = defaultdict(lambda: defaultdict(list))
    for c in cs: g[k1(c)][k2(c)].append(c)
    return {a: {b: funnel(v) for b, v in m.items()} for a, m in g.items()}

def camp_label(c):
    s = c['campaign']
    if not s: return '（キャンペーンなし）'
    return s

def camp_type(c):
    s = c['campaign']
    if not s: return '（なし）'
    if '1億円' in s: return '2026新春1億円CP'
    if '来場予約' in s: return '来場予約'
    if '会員登録' in s: return '会員登録'
    if '資料請求' in s or 'カタログ' in s: return '資料請求'
    if '見学会' in s: return '完成見学会'
    if '見積' in s: return '簡単見積もり'
    if 'フェア' in s or 'オープン' in s or 'キャンペーン' in s or '祭' in s: return 'フェア・その他CP'
    return 'その他'

def lag(cs, a, b):
    xs = [(d(c[b]) - d(c[a])).days for c in cs if d(c[a]) and d(c[b]) and 0 <= (d(c[b]) - d(c[a])).days <= 400]
    return dict(n=len(xs), median=statistics.median(xs) if xs else None, mean=round(sum(xs) / len(xs), 1) if xs else None)

# 面談（interview_log）の顧客
met = [c for c in base if c['meet_log']]
nomet = [c for c in base if not c['meet_log']]
def meet_detail(cs):
    out = funnel(cs)
    out['avg_meet'] = round(sum(c['meet_n'] for c in cs) / len(cs), 2) if cs else 0
    out['line'] = sum(1 for c in cs if c['line'])
    return out
meet_dist = Counter(min(c['meet_n'], 6) for c in met)
meet_vs_contract = {}
for n in range(1, 7):
    cs = [c for c in met if min(c['meet_n'], 6) == n]
    meet_vs_contract[n] = dict(n=len(cs), contract=sum(1 for c in cs if d(c['contract'])))
# 反響→初回面談までの日数の分布
def bucket(x):
    return '当日' if x == 0 else '1〜3日' if x <= 3 else '4〜7日' if x <= 7 else '8〜14日' if x <= 14 else '15〜30日' if x <= 30 else '31日〜'
first_lag = defaultdict(lambda: [0, 0])
for c in base:
    if d(c['first']) and d(c['reg']) and d(c['first']) >= d(c['reg']):
        b = bucket((d(c['first']) - d(c['reg'])).days)
        first_lag[b][0] += 1
        first_lag[b][1] += 1 if d(c['contract']) else 0
# 反響日以前に初回面談（来場が先・あとで反響登録）
pre_visit = sum(1 for c in base if d(c['first']) and d(c['reg']) and d(c['first']) < d(c['reg']))

# 週ごとの反響
weekly = defaultdict(lambda: Counter())
for c in base:
    dt = d(c['reg'])
    wk = (dt - date(2025, 12, 27)).days // 7
    weekly[wk]['all'] += 1
    if '1億円' in c['campaign']: weekly[wk]['cp'] += 1
    if d(c['first']): weekly[wk]['first'] += 1
    if d(c['contract']): weekly[wk]['contract'] += 1

# ---- CSV（新春1億円CPの入力用）
BR = [('国分ハウジング', 'KH'), ('デイジャストハウス', 'DJH'), ('ニーエルホーム', '2L'), ('なごみ工務店', 'なごみ'), ('ジャスフィーホーム', 'JH')]
def shop_of(s):
    s = (s or '').replace('　', ' ').strip()
    for jp, ab in BR:
        if s.startswith(jp):
            return ab + s[len(jp):].strip()
    return s
rs = list(csv.reader(open(CSVF, encoding='utf-8-sig')))
entries, targets = [], []
for r in rs[1:]:
    r = r + [''] * (17 - len(r))
    if r[12] and r[12] != '店舗':
        def num(x):
            try: return float(x)
            except: return None
        targets.append(dict(shop=shop_of(r[12]) if r[12] != '合計' else '合計', target=num(r[13]), applied=num(r[14]), contract=num(r[15])))
    if not r[0]: continue
    entries.append(dict(shop=shop_of(r[0]), name=norm_name(r[2] + r[3]), first=r[4], entry=r[5], next=r[6], plan=r[7], site=r[8], done=r[9].strip(), memo=r[10], staff=r[1]))
# 重複（同じ氏名・同じ店舗）
seen, uniq, dup_csv = set(), [], 0
for e in entries:
    k = (e['name'], e['shop'])
    if e['name'] and k in seen:
        dup_csv += 1; continue
    seen.add(k); uniq.append(e)
# 入力の誤り（初回来場がエントリーより1年近く後 → 前年の打ち間違い）
fixes = 0
for e in uniq:
    f, en = d(e['first']), d(e['entry'])
    if f and en and (f - en).days > 300:
        e['first'] = '%d/%02d/%02d' % (f.year - 1, f.month, f.day); fixes += 1
    if 'KH薩摩川内店' in e['memo'] and e['shop'].startswith('DJH'):
        e['shop'] = 'KH薩摩川内店'; fixes += 1
# DB と氏名で突き合わせ（同ブランドを優先）
by_name = defaultdict(list)
for c in all_cust:
    if c['name']: by_name[c['name']].append(c)
matched = 0
for e in uniq:
    cand = by_name.get(e['name'], [])
    if not cand:
        e['db'] = None; continue
    br = re.match(r'^(KH|DJH|なごみ|2L|JH)', e['shop'])
    same = [c for c in cand if br and c['shop'].startswith(br[1])]
    c = sorted(same or cand, key=lambda x: x['reg'], reverse=True)[0]
    e['db'] = c; matched += 1

def entry_kind(e):
    f, en = d(e['first']), d(e['entry'])
    if not f or not en: return '不明'
    gap = (en - f).days
    if gap <= 0: return '初回来場でエントリー'
    if gap <= 14: return '2週間以内の再来場'
    return '既存客の掘り起こし（15日以上前に来場）'

cp_shop = defaultdict(lambda: Counter())
for e in uniq:
    s = cp_shop[e['shop']]
    s['entry'] += 1
    if e['done'] == '〇': s['done'] += 1
    if e['done'] == '×': s['lost'] += 1
    if e['plan'] and e['done'] != '〇': s['plan'] += 1
    s[entry_kind(e)] += 1
    if e['db']:
        s['matched'] += 1
cp_kind = Counter(entry_kind(e) for e in uniq)
cp_kind_done = Counter(entry_kind(e) for e in uniq if e['done'] == '〇')
cp_medium = Counter((e['db']['medium'] if e['db'] else '（顧客DBで見つからず）') for e in uniq)
cp_medium_done = Counter((e['db']['medium'] if e['db'] else '（顧客DBで見つからず）') for e in uniq if e['done'] == '〇')
lead = [(d(e['plan']) - d(e['entry'])).days for e in uniq if e['done'] == '〇' and d(e['plan']) and d(e['entry'])]
memo_cat = Counter()
for e in uniq:
    m = e['memo']
    if e['done'] == '〇' or '契約' in m or '成約' in m: k = '契約・成約'
    elif '土地' in m: k = '土地待ち・土地提案'
    elif '他決' in m or '中断' in m or '延期' in m or '没' in m: k = '他決・中断・延期'
    elif '間取' in m or 'ＰＴ' in m or 'PT' in m or '審査' in m or '融資' in m: k = 'プラン・資金計画中'
    elif m.strip(): k = '商談継続・その他'
    else: k = '追客状況が未記入'
    memo_cat[k] += 1

# DB 側で新春CP（hp_campaign）経由の反響
cp_web = [c for c in base if '1億円' in c['campaign']]
cp_web_shop = group(cp_web, lambda c: c['shop'])

out = dict(
    period=[START, END], n_period=len(period), n_dup=len(dup), n_base=len(base),
    stages=STAGES, total=funnel(base),
    by_medium=group(base, lambda c: c['medium']),
    by_campaign=group(base, camp_label),
    by_camptype=group(base, camp_type),
    by_section=group(base, lambda c: c['section']),
    by_shop=group(base, lambda c: c['shop']),
    by_brand=group(base, lambda c: c['brand']),
    sec_medium=cross(base, lambda c: c['section'], lambda c: c['medium']),
    shop_medium=cross(base, lambda c: c['shop'], lambda c: c['medium']),
    sec_camptype=cross(base, lambda c: c['section'], camp_type),
    shop_section={k: v for k, v in shop_section.items()},
    lags=dict(reg_first=lag(base, 'reg', 'first'), first_second=lag(base, 'first', 'second'), reg_contract=lag(base, 'reg', 'contract')),
    meet=dict(met=meet_detail(met), nomet=meet_detail(nomet), dist=meet_dist, vs_contract=meet_vs_contract,
              by_medium=group(met, lambda c: c['medium']), by_section=group(met, lambda c: c['section']), by_shop=group(met, lambda c: c['shop']),
              by_camptype=group(met, camp_type), first_lag=first_lag, pre_visit=pre_visit),
    weekly={k: dict(v) for k, v in sorted(weekly.items())},
    csv=dict(rows=len(entries), uniq=len(uniq), dup=dup_csv, fixes=fixes, matched=matched,
             shop={k: dict(v) for k, v in cp_shop.items()}, kind=cp_kind, kind_done=cp_kind_done,
             medium=cp_medium, medium_done=cp_medium_done, lead=dict(n=len(lead), median=statistics.median(lead) if lead else None),
             memo=memo_cat, targets=targets,
             web=dict(n=len(cp_web), funnel=funnel(cp_web), by_shop=cp_web_shop, by_medium=group(cp_web, lambda c: c['medium']))),
)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=lambda o: dict(o) if isinstance(o, Counter) else str(o))
print('period', len(period), 'dup', len(dup), 'base', len(base), 'met', len(met), 'csv', len(entries), len(uniq), 'matched', matched, 'fixes', fixes, 'cpweb', len(cp_web))
```

---

## 追加の依頼（同日）：各タブの上部に「数値の要約 → 打ち手（深掘り）→ 以下、参照する統計」
- 概要・反響媒体別・キャンペーン別・課×媒体・店舗×媒体・面談した顧客・新春1億円CP の7タブの上に、要約（番号付き）と打ち手のカードを置いた。「CPの活用方法」タブはそれ自体が打ち手なので変えていない。
- 打ち手のカード：急ぎ／改善／伸ばす の札、理由、誰が・いつ・何を・見る数字。数字で示せるものには「見込み」（例：ポータルの初回面談率+5ポイント → 初回面談+26件・契約+4.5件）。
- 課×媒体・店舗×媒体は、選んだ課・店舗の数字から要約と打ち手を作る（`localBrief`）。決まり：ポータルが3割以上で初回面談率が全体の7割未満／初回面談率が全体の8割未満／2回目の率が全体未満／CPのエントリー0／会社管理2割以上／失注2割以上／契約の多い媒体／契約率が全体の1.5倍以上。最大4枚。
- 文中の数字はすべて埋め込んだ集計値から計算している（手で書いた数字は無い）。
- 直した不具合：店舗タブの合計行の「課」に undefined が出ていた（前の版から）。ポータルの反響が0件の店舗で要約に undefined が出た（`pick` に0の行を足した）。
- 確認：Playwright で全タブ・7課・27店舗を切り替え、本文に NaN・undefined・Infinity が無いこと、エラー0、幅390pxで横スクロールなし。

## 追加した部分（template.html の JS。全文）
```js
// ---- 各タブの上：数値の要約 → 打ち手（深掘り）
const P = (a,b) => fp(pct(a,b));
const PORTAL = ["HOME'S",'タウンライフ','SUUMO','カゴスマ','ハウジングバザール','持ち家計画'];
const ZERO = {reg:0, first:0, second:0, screen:0, contract:0, meet_log:0, lost:0, mgmt:0};
const pick = (m, keys) => sum([ZERO, ...keys.map(k=>m[k]).filter(Boolean)]);
const LV = {good:'伸ばす', warn:'改善', bad:'急ぎ'};
const VC = D.meet.vs_contract;
const MET1 = VC['1'];
const METM = ['2','3','4','5','6'].reduce((t,k)=>({n:t.n+VC[k].n, contract:t.contract+VC[k].contract}), {n:0, contract:0});
const R1 = MET1.contract/MET1.n, RM = METM.contract/METM.n;
const BASE1 = T.first/T.reg, BASE2 = T.second/T.first, BASEC = T.contract/T.reg, F2C = T.contract/T.first;
const n1 = v => (Math.round(v*10)/10).toFixed(1);

function act(a){
  return `<div class="cp_act"><h4><span class="cp_pill ${a.lv}">${LV[a.lv]}</span>${a.t}</h4><p class="why">${a.why}</p>
    <dl><dt>誰が</dt><dd>${a.who}</dd><dt>いつ</dt><dd>${a.when}</dd><dt>何を</dt><dd>${a.what}</dd><dt>見る数字</dt><dd>${a.kpi}</dd></dl>
    ${a.eff ? `<div class="eff">見込み：${a.eff}</div>` : ''}</div>`;
}
function brief(sums, acts){
  return `<div class="cp_brief">
    <div class="cp_sum"><p class="cp_eyebrow">数値の要約</p><ol>${sums.filter(Boolean).map(s=>`<li>${s}</li>`).join('')}</ol></div>
    <div class="cp_acts"><p class="cp_eyebrow" style="margin:0">打ち手（深掘り）</p>${acts.filter(Boolean).map(act).join('')}</div>
  </div><div class="cp_divider">以下、参照する統計</div>`;
}
const byRate = (rows, k, min=10) => rows.filter(r=>r.reg>=min).sort((a,b)=>(b[k]/b.reg)-(a[k]/a.reg));

const BRIEF = {};
BRIEF.overview = () => {
  const pm = pick(D.by_medium, PORTAL), noVisit = T.reg - T.first, pmNo = pm.reg - pm.first, stop = T.first - T.second;
  const secs = byRate(objRows(D.by_section), 'contract', 1);
  const best = secs[0], worst = secs[secs.length-1];
  const labels = ['12/27〜1/2','1/3〜1/9','1/10〜1/16','1/17〜1/23','1/24〜1/25'];
  const wk = Object.entries(D.weekly).sort((a,b)=>b[1].all-a[1].all)[0];
  const cp = D.by_camptype['2026新春1億円CP'];
  const add1 = Math.round(pm.reg*0.05), add2 = Math.round(T.first*0.5) - T.second;
  return brief([
    `反響 ${T.reg}件 → 初回面談 ${T.first}件（${P(T.first,T.reg)}）→ 2回目以降面談 ${T.second}件（${P(T.second,T.reg)}）→ 契約 ${T.contract}件（${P(T.contract,T.reg)}）。`,
    `一番大きく落ちるのは「反響→初回面談」。<b>${noVisit}件（${P(noVisit,T.reg)}）が面談に至っていない</b>。そのうち ${pmNo}件（${P(pmNo,noVisit)}）はポータル（HOME'S・タウンライフ・SUUMO など）の反響。`,
    `次に落ちるのは「初回面談→2回目」。初回面談した ${T.first}人のうち <b>${stop}人（${P(stop,T.first)}）が2回目に進んでいない</b>。面談が1回だけの顧客の契約率は ${fp(R1*100)}、2回以上は ${fp(RM*100)}。`,
    `課の差：契約率は ${esc(best.name)} ${P(best.contract,best.reg)} が最も高く、${esc(worst.name)} ${P(worst.contract,worst.reg)} が最も低い。`,
    `新春CP（ホームページのキャンペーン名）の反響は ${cp.reg}件で、全体の ${P(cp.reg,T.reg)}。週ごとでは ${labels[wk[0]]} が最も多い（${wk[1].all}件）。`,
  ], [
    {lv:'bad', t:'ポータルの反響を48時間以内に来場へつなぐ',
      why:`ポータルの反響 ${pm.reg}件の初回面談率は ${P(pm.first,pm.reg)}。面談に至っていない反響の大半がここにある。`,
      who:'各店舗の反響担当（課長が毎朝、前日分の連絡の結果を確認）', when:'反響の当日〜翌日',
      what:'電話がつながらなければ SMS で「新春CPの特典は来場してエントリーした方が対象」と期限つきで案内し、来場日時の候補を2つ出す。資料を送っただけで終わらせない。',
      kpi:`ポータル反響の初回面談率（今 ${P(pm.first,pm.reg)}）`,
      eff:`初回面談率を5ポイント上げると初回面談 <b>+${add1}件</b>。今の「初回面談→契約」の率（${fp(F2C*100)}）で契約 <b>+${n1(add1*F2C)}件</b>。`},
    {lv:'bad', t:'初回面談で2回目の日程を決めて帰す',
      why:`2回目に進まなかった顧客が ${stop}人。面談が2回以上の顧客は、1回だけの顧客の約${n1(RM/R1)}倍契約している。`,
      who:'営業担当（課長が日報で2回目の予約の有無を確認）', when:'初回面談の終わり',
      what:'2回目を「土地・資金計画・CPの特典の確定」の場と決め、その場で日時を予約する。予約できなかった顧客には3日以内に電話する。',
      kpi:`初回面談→2回目の率（今 ${fp(BASE2*100)}）`,
      eff:`2回目の率を50%にすると2回目 <b>+${add2}人</b>。1回だけと2回以上の契約率の差で契約 <b>+${n1(add2*(RM-R1))}件</b>。`},
    {lv:'warn', t:'課ごとの弱い段階を課長会議で確かめる',
      why:`契約率は課によって約${n1((best.contract/best.reg)/(worst.contract/worst.reg))}倍の差がある。`,
      who:'営業部長・各課長', when:'月1回の課長会議',
      what:`契約率の高い課（${esc(best.name)}）の初回面談→2回目の運び方（同席・提案資料）を共有する。「課 × 媒体」タブで、課ごとにどの段階で落ちているかを確かめる。`,
      kpi:'課ごとの初回面談率・2回目の率・契約率'},
  ]);
};

BRIEF.medium = () => {
  const m = D.by_medium, pm = pick(m, PORTAL), np = {reg:T.reg-pm.reg, first:T.first-pm.first, contract:T.contract-pm.contract};
  const intro = m['紹介'], sns = m['SNS広告'], ag = m['ALLGRIT'];
  return brief([
    `ポータル（HOME'S・タウンライフ・SUUMO など）${pm.reg}件は反響の ${P(pm.reg,T.reg)}。初回面談率 ${P(pm.first,pm.reg)}、契約 ${pm.contract}件（${P(pm.contract,pm.reg)}）。`,
    `ポータル以外の ${np.reg}件は初回面談率 ${P(np.first,np.reg)}。<b>契約の ${P(np.contract,T.contract)}はポータル以外から</b>。`,
    `紹介は ${intro.reg}件と少ないが、初回面談 ${P(intro.first,intro.reg)}・契約 ${P(intro.contract,intro.reg)}で最も強い。`,
    `有料の媒体ではSNS広告がよい（${sns.reg}件、初回面談 ${P(sns.first,sns.reg)}・契約 ${P(sns.contract,sns.reg)}）。`,
    `ALLGRIT は初回面談 ${P(ag.first,ag.reg)}と来場は多いが、契約は ${ag.contract}件（${P(ag.contract,ag.reg)}）。`,
  ], [
    {lv:'bad', t:'ポータルの反響を種類で分けて追う',
      why:`ポータルは数が多い一方、${pm.reg - pm.first}件が初回面談に至っていない。`,
      who:'反響担当・課長', when:'反響の当日〜翌日。CP期間は毎日',
      what:'一括資料請求（タウンライフ・HOME\'S）は資料が届く日に電話し、来場の特典としてCPを案内する。SUUMO は地域や土地の条件が決まっている顧客が多いので、土地の情報を添えて来場を誘う。',
      kpi:`ポータルの初回面談率（今 ${P(pm.first,pm.reg)}）`,
      eff:`ポータルの初回面談率を10%台→15%にすると、初回面談 <b>+${Math.round(pm.reg*0.15)-pm.first}件</b>。`},
    {lv:'warn', t:'ALLGRIT は来場後の見極めを先にする',
      why:`来場はするが、契約は ${ag.contract}件。アンケートの謝礼が目当ての来場が混ざっている可能性がある。`,
      who:'マーケティング担当・営業担当', when:'初回面談の時。媒体の評価は毎月',
      what:'初回面談で建築の時期・土地・予算を必ず確かめる。ALLGRIT 経由の2回目の率と契約を毎月見て、2か月続けて契約が0なら予算をSNS広告へ移す。',
      kpi:'ALLGRIT 経由の2回目の率・契約数'},
    {lv:'good', t:'CP期間はSNS広告に予算を寄せる',
      why:`SNS広告は来場（${P(sns.first,sns.reg)}）と契約（${sns.contract}件）の両方が取れている。`,
      who:'マーケティング担当', when:'CP期間の前〜期間中',
      what:'CPの特典を前面に出した広告を出し、来場予約のフォームへ直接つなぐ。資料請求だけのフォームには送らない。',
      kpi:'SNS広告の反響数・初回面談率'},
    {lv:'good', t:'紹介とCPを組み合わせる',
      why:`紹介の契約率は ${P(intro.contract,intro.reg)}で、全体（${fp(BASEC*100)}）の約${n1((intro.contract/intro.reg)/BASEC)}倍。`,
      who:'営業担当・アフター担当', when:'契約時・引渡し時・CPの開始時',
      what:'契約した顧客・引渡し済みの顧客に、紹介された方もCPの対象になることを案内する。',
      kpi:'紹介の反響数'},
  ]);
};

BRIEF.campaign = () => {
  const ct = D.by_camptype, cp = ct['2026新春1億円CP'], rv = ct['来場予約'], mem = sum([ct['会員登録'], ct['資料請求']].filter(Boolean)), none = ct['（なし）'];
  const khKey = Object.keys(D.by_campaign).find(k=>k.includes('KH共通】2026新春'));
  const kh = D.by_campaign[khKey] || {reg:0};
  return brief([
    `新春CPの反響 ${cp.reg}件：初回面談 ${P(cp.first,cp.reg)} → 2回目 ${P(cp.second,cp.first)}（初回面談した人のうち）→ 契約 ${cp.contract}件（${P(cp.contract,cp.reg)}）。`,
    `来場予約（${rv.reg}件）は初回面談 ${P(rv.first,rv.reg)}・2回目 ${P(rv.second,rv.first)}・契約 ${P(rv.contract,rv.reg)}。<b>CPは来場までは来場予約に近いが、2回目から先で差がつく</b>。`,
    `会員登録・資料請求（${mem.reg}件）は初回面談 ${P(mem.first,mem.reg)}にとどまる。`,
    `CPの反響の ${P(kh.reg,cp.reg)}がKH。DJH・JH・なごみ・2L は合わせて ${cp.reg-kh.reg}件。`,
    `キャンペーンを経由していない反響は ${none.reg}件（${P(none.reg,T.reg)}）で、初回面談 ${P(none.first,none.reg)}。`,
  ], [
    {lv:'bad', t:'CPのエントリーを「来場予約」の形にする',
      why:`契約率は来場予約 ${P(rv.contract,rv.reg)}に対してCP ${P(cp.contract,cp.reg)}。CPは来場の後が弱い。`,
      who:'マーケティング担当（フォーム）・営業担当（確認の電話）', when:'次のCPの準備の時',
      what:'CPのフォームで来場日時の予約を必須にする。予約の確認の電話で建築の時期・土地の有無を聞いておく。特典の条件を「来場＋2回目の面談でエントリー確定」にする。',
      kpi:'CP反響の2回目の率・契約率',
      eff:`CPの契約率を来場予約と同じにすると、同じ反響数で契約 <b>+${n1(cp.reg*(rv.contract/rv.reg) - cp.contract)}件</b>。`},
    {lv:'warn', t:'会員登録・資料請求の顧客にCPを案内する',
      why:`会員登録・資料請求の ${mem.reg - mem.first}件が面談に至っていない。すでに連絡先がある顧客である。`,
      who:'マーケティング担当', when:'CPの開始時と締切の1週間前',
      what:'メール・LINE で、来場するとCPにエントリーできることと締切を案内する。',
      kpi:'会員登録・資料請求からの初回面談率'},
    {lv:'warn', t:'KH以外のブランドにもCPの入口を置く',
      why:`KH以外のCP反響は ${cp.reg-kh.reg}件。ブランドのホームページ・SNS からCPへの導線が少ない。`,
      who:'マーケティング担当', when:'CPの開始前',
      what:'DJH・JH・なごみ・2L のホームページとSNSに、CPのバナーと来場予約を置く。ブランドごとにCPの反響と来場を週ごとに確認する。',
      kpi:'ブランドごとのCP反響数'},
  ]);
};

function localBrief(label, r, med, cp){
  const pm = pick(med, PORTAL);
  const rows = objRows(med).filter(x=>x.reg>=3);
  const best = rows.filter(x=>x.contract>0).sort((a,b)=>b.contract-a.contract || b.first/b.reg-a.first/a.reg)[0];
  const weak = rows.filter(x=>x.reg>=5).sort((a,b)=>a.first/a.reg-b.first/b.reg)[0];
  const acts = [];
  if(pm.reg >= 5 && pm.reg/r.reg >= 0.3 && pm.first/pm.reg < BASE1*0.7)
    acts.push({lv:'bad', t:'ポータルの反響を来場につなぐ', why:`ポータルの反響が ${pm.reg}件（${P(pm.reg,r.reg)}）あり、初回面談率は ${P(pm.first,pm.reg)}。`,
      who:`${esc(label)}の反響担当`, when:'反響の当日〜翌日',
      what:'電話・SMS で、CPの特典を来場の理由にして来場日時の候補を2つ出す。つながらない顧客は3日間続けて連絡する。',
      kpi:`ポータルの初回面談率（今 ${P(pm.first,pm.reg)}）`, eff:`5ポイント上げると初回面談 <b>+${Math.max(1,Math.round(pm.reg*0.05))}件</b>。`});
  else if(r.reg >= 5 && r.first/r.reg < BASE1*0.8)
    acts.push({lv:'bad', t:'反響から初回面談までを立て直す', why:`初回面談率 ${P(r.first,r.reg)}は全体（${fp(BASE1*100)}）より低い。${weak ? `特に ${esc(weak.name)}（${weak.reg}件・${P(weak.first,weak.reg)}）。` : ''}`,
      who:`${esc(label)}の反響担当・課長`, when:'反響の当日〜翌日',
      what:'反響ごとに連絡の結果（つながった・来場の約束）を記録し、課長が毎朝確認する。来場の理由としてCPの特典を案内する。',
      kpi:'初回面談率'});
  if(r.first >= 5 && r.second/r.first < BASE2)
    acts.push({lv:'bad', t:'初回面談で2回目の日程を決める', why:`初回面談した ${r.first}人のうち2回目に進んだのは ${r.second}人（${P(r.second,r.first)}。全体 ${fp(BASE2*100)}）。`,
      who:'営業担当（課長が日報で確認）', when:'初回面談の終わり',
      what:'2回目を「土地・資金計画・CPの特典の確定」の場と決めて、その場で予約する。1回で止まっている顧客には、CPの締切を理由に2回目を提案する。',
      kpi:`2回目の率（今 ${P(r.second,r.first)}）`, eff:`全体の率まで上げると2回目 <b>+${Math.max(1,Math.round(r.first*BASE2)-r.second)}人</b>。`});
  if(!(cp.entry))
    acts.push({lv:'bad', t:'新春CPを使っていない', why:'入力表にエントリーが1件もない。', who:'店長・課長', when:'次のCPの開始前',
      what:'店舗のエントリー数・契約数の目標を入れ、再来場の顧客と止まっている見込み客の一覧を作ってから始める。', kpi:'エントリー数'});
  if(r.reg >= 10 && r.mgmt/r.reg >= 0.2)
    acts.push({lv:'warn', t:'会社管理の顧客に声をかける', why:`会社管理が ${r.mgmt}件（${P(r.mgmt,r.reg)}）。担当が付かないまま止まっている。`,
      who:'課長が担当を割り当てる', when:'CPの開始時',
      what:'会社管理の顧客にCPの案内を送り、反応があった顧客に担当を付ける。', kpi:'会社管理からの初回面談数'});
  if(r.reg >= 10 && r.lost/r.reg >= 0.2)
    acts.push({lv:'warn', t:'失注の理由を確かめる', why:`失注が ${r.lost}件（${P(r.lost,r.reg)}）。`, who:'課長', when:'月1回',
      what:'失注の理由（他社・時期・予算・連絡がつかない）を数え、多い理由への対策を決める。', kpi:'理由ごとの失注数'});
  if(best)
    acts.push({lv:'good', t:`${esc(best.name)}を伸ばす`, why:`契約が最も多い媒体（反響 ${best.reg}件・初回面談 ${P(best.first,best.reg)}・契約 ${best.contract}件）。`,
      who:'店長・マーケティング担当', when:'CP期間の前',
      what: best.name==='紹介' ? '契約者・引渡し済みの顧客に、紹介された方もCPの対象になることを案内する。' : 'CPの特典をこの媒体の案内に載せ、予算や配布を寄せる。',
      kpi:`${esc(best.name)}の反響数`});
  if(r.reg >= 10 && r.contract/r.reg >= BASEC*1.5)
    acts.push({lv:'good', t:'進め方をほかへ共有する', why:`契約率 ${P(r.contract,r.reg)}は全体（${fp(BASEC*100)}）の約${n1((r.contract/r.reg)/BASEC)}倍。`,
      who:'課長', when:'課長会議', what:'初回面談→2回目→契約の運び方（同席・提案資料・期限の伝え方）をまとめて共有する。', kpi:'—'});
  return brief([
    `反響 ${r.reg}件 → 初回面談 ${r.first}件（${P(r.first,r.reg)}。全体 ${fp(BASE1*100)}）→ 2回目 ${r.second}件（初回面談した人の ${P(r.second,r.first)}。全体 ${fp(BASE2*100)}）→ 契約 ${r.contract}件（${P(r.contract,r.reg)}。全体 ${fp(BASEC*100)}）。`,
    `ポータルの反響 ${pm.reg}件（${P(pm.reg,r.reg)}）、初回面談率 ${P(pm.first,pm.reg)}。`,
    best ? `契約が最も多い媒体は ${esc(best.name)}（反響 ${best.reg}件・契約 ${best.contract}件）。` : '契約のある媒体はまだない。',
    weak && weak !== best ? `来場につながりにくいのは ${esc(weak.name)}（反響 ${weak.reg}件・初回面談 ${P(weak.first,weak.reg)}）。` : '',
    `失注 ${r.lost}件（${P(r.lost,r.reg)}）・会社管理 ${r.mgmt}件（${P(r.mgmt,r.reg)}）。`,
    `新春CPの入力表：エントリー ${cp.entry||0}件・契約済 ${cp.done||0}件。`,
  ], acts.slice(0,4));
}
BRIEF.section = () => {
  const secs = secList(); if(!S.sec || !D.sec_medium[S.sec]) S.sec = secs[0];
  const cp = Object.entries(D.csv.shop).filter(([s])=>D.shop_section[s]===S.sec).reduce((t,[,v])=>({entry:t.entry+(v.entry||0), done:t.done+(v.done||0)}), {entry:0, done:0});
  return `<h2>${esc(S.sec)}</h2>` + localBrief(S.sec, D.by_section[S.sec], D.sec_medium[S.sec], cp);
};
BRIEF.shop = () => {
  const shops = Object.keys(D.by_shop);
  if(!S.shop || !D.shop_medium[S.shop]) S.shop = shops.sort((a,b)=>D.by_shop[b].reg-D.by_shop[a].reg)[0];
  return `<h2>${esc(S.shop)}<span class="cp_muted" style="font-weight:400">（${esc(D.shop_section[S.shop]||'')}。下の「店舗 × 反響媒体」で店舗を切り替えると、ここも切り替わります）</span></h2>`
    + localBrief(S.shop, D.by_shop[S.shop], D.shop_medium[S.shop], D.csv.shop[S.shop]||{});
};

BRIEF.meet = () => {
  const M = D.meet, met = M.met, no = M.nomet, L = M.first_lag;
  const lr = k => L[k] ? P(L[k][1], L[k][0]) : '—';
  const mm = byRate(objRows(M.by_medium), 'contract', 5);
  const ms = byRate(objRows(M.by_section), 'contract', 5);
  const re = Math.round(MET1.n*0.1);
  return brief([
    `面談の記録がある顧客は ${met.reg}人（反響の ${P(met.reg,T.reg)}）。<b>契約 ${T.contract}件のうち ${met.contract}件（${P(met.contract,T.contract)}）がこの人たち</b>。記録がない ${no.reg}人からの契約は ${no.contract}件。`,
    `面談が1回で止まった顧客 ${MET1.n}人（${P(MET1.n,met.reg)}）の契約率は ${fp(R1*100)}。2回以上の ${METM.n}人は ${fp(RM*100)}。`,
    `反響から初回面談までの日数と契約率：当日 ${lr('当日')}・1〜3日 ${lr('1〜3日')}・4〜7日 ${lr('4〜7日')}・15〜30日 ${lr('15〜30日')}。早さより、面談の中身と次の約束で差がついている。`,
    `媒体では ${mm.slice(0,2).map(r=>`${esc(r.name)}（${P(r.contract,r.reg)}）`).join('・')} の契約率が高く、${esc(mm[mm.length-1].name)}（${P(mm[mm.length-1].contract,mm[mm.length-1].reg)}）が低い。`,
    `課では ${esc(ms[0].name)}（${P(ms[0].contract,ms[0].reg)}）が高く、${esc(ms[ms.length-1].name)}（${P(ms[ms.length-1].contract,ms[ms.length-1].reg)}）が低い。`,
  ], [
    {lv:'bad', t:'面談1回で止まった顧客に2回目を提案する',
      why:`${MET1.n}人が1回で止まっている。2回目に進んだ顧客の契約率は約${n1(RM/R1)}倍。`,
      who:'営業担当（店舗ごとの一覧は課長が作る）', when:'次のCPの開始時と締切の2週間前',
      what:'1回だけの顧客を店舗ごとに一覧にし、CPの締切を理由に2回目（土地・資金計画の提案）を案内する。',
      kpi:'1回だけの顧客の2回目の予約数',
      eff:`1回だけの顧客の1割（${re}人）が2回目に進めば、契約 <b>+${n1(re*(RM-R1))}件</b>。`},
    {lv:'bad', t:'初回面談で聞くこと・2回目で出すものをそろえる',
      why:`初回面談の後、${T.first - T.second}人が2回目に進んでいない。課によって2回目の率に大きな差がある。`,
      who:'課長が型を作り、営業担当が使う', when:'初回面談・2回目の面談',
      what:'初回面談で必ず聞くこと（建築の時期・土地・予算・比べている会社）と、2回目で出すもの（概算・土地の情報・CPの特典の確定）を決め、商談ステップのメモに残す。',
      kpi:'初回面談→2回目の率'},
    {lv:'warn', t:`${esc(ms[0].name)}の進め方を共有する`,
      why:`面談した顧客の契約率が ${esc(ms[0].name)} ${P(ms[0].contract,ms[0].reg)}、${esc(ms[ms.length-1].name)} ${P(ms[ms.length-1].contract,ms[ms.length-1].reg)}。`,
      who:'営業部長・課長', when:'課長会議',
      what:'契約率の高い課の面談の回し方（回数・間隔・同席）を、低い課で試す。',
      kpi:'課ごとの面談した顧客の契約率'},
  ]);
};

BRIEF.cp = () => {
  const C = D.csv, tt = (C.targets.find(t=>t.shop==='合計')||{});
  const doneN = Object.values(C.shop).reduce((t,e)=>t+(e.done||0),0);
  const K = ['初回来場でエントリー','2週間以内の再来場','既存客の掘り起こし（15日以上前に来場）'];
  const kd = k => `${C.kind[k]||0}件（契約 ${C.kind_done[k]||0}・${P(C.kind_done[k]||0, C.kind[k]||0)}）`;
  const top = Object.entries(C.shop).sort((a,b)=>(b[1].entry||0)-(a[1].entry||0)).slice(0,3);
  const zero = C.targets.filter(t=>t.shop!=='合計' && !t.applied).map(t=>esc(t.shop));
  const nTarget = C.targets.filter(t=>t.shop!=='合計' && t.target).length;
  return brief([
    `エントリー ${C.uniq}件 → 契約済 ${doneN}件（${P(doneN,C.uniq)}）。入力表の右側の合計は申込 ${tt.applied}・契約 ${tt.contract}、1〜3月の契約目標 ${tt.target}（目標が入っているのは ${nTarget}店舗だけ）。`,
    `エントリーの時期：初回来場で ${kd(K[0])}、2週間以内の再来場 ${kd(K[1])}、15日以上前に来場した顧客の掘り起こし ${kd(K[2])}。<b>再来場のときのエントリーが最も契約につながっている</b>。`,
    `エントリーの多い店舗：${top.map(([s,v])=>`${esc(s)}（${v.entry}件・契約 ${v.done||0}）`).join('、')}。`,
    `申込実績0の店舗が ${zero.length}店舗（${zero.join('、')}）。`,
    `追客状況が未記入 ${C.memo['追客状況が未記入']||0}件、顧客DBで氏名が見つからない ${C.uniq-C.matched}件。`,
  ], [
    {lv:'good', t:'「再来場でエントリー → その場で契約予定日」を型にする',
      why:`2週間以内の再来場でのエントリーは ${P(C.kind_done[K[1]]||0, C.kind[K[1]]||0)}が契約。エントリーから契約予定日までは中央値 ${C.lead.median}日。`,
      who:'営業担当', when:'初回来場（案内）と2回目の来場（エントリー）',
      what:'初回来場ではCPの内容と締切を伝えるだけにし、エントリーは2回目の来場（プランの提案）で受ける。エントリーと同時に契約予定日を決め、入力表に書く。',
      kpi:'エントリー→契約の率'},
    {lv:'bad', t:'全店舗で目標を入れてから始める',
      why:`申込実績0の店舗が ${zero.length}店舗。目標が入っていたのは ${nTarget}店舗だけ。`,
      who:'店長が入れ、課長が週1回確認', when:'CPの開始前・期間中は毎週',
      what:'店舗ごとにエントリー数・契約数の目標を入れる。週1回、課長が入力表の数と目標を見比べ、遅れている店舗と対象の顧客を話し合う。',
      kpi:'店舗ごとのエントリー数と目標の差'},
    {lv:'warn', t:'掘り起こしの対象を先に作り、提案を用意してから声をかける',
      why:`掘り起こしのエントリーは ${kd(K[2])}。店舗によって結果の差が大きい。`,
      who:'営業担当・課長', when:'CPの開始の1週間前',
      what:'「土地待ち」「計画延期」「会社管理」の顧客を一覧にする。土地の情報・資金計画などの次の提案を用意してから、CPを理由に連絡する。',
      kpi:'掘り起こしのエントリーの契約率'},
    {lv:'warn', t:'入力表をやめて顧客DBで管理する',
      why:`${C.uniq-C.matched}件が顧客DBと合わず、担当者の欄が空・「#REF!」の行もある。CPの効果を正しく測れない。`,
      who:'マーケティング担当・システム担当', when:'次のCPの準備の時',
      what:'エントリーを顧客DBのキャンペーン欄（タグ）で記録し、入力表の右側の集計は顧客DBから自動で出す。',
      kpi:'顧客DBと合わない件数（0にする）'},
  ]);
};

// ---- 描画
```

---

## 追加の依頼（同日・3回目）：題の変更・打ち手を下部へ・アンカーリンク
- ファイル名を `2026年5月期 新春キャンペーン結果分析.html` に変えた（前の `新春CP期_注文反響の歩留まり分析.html` は消した）。`<title>` と見出しも「2026年5月期 新春キャンペーン結果分析」。
- 各タブの並び：数値の要約（上）→ 参照する統計 → 打ち手（下）。打ち手は2列のカード。
  - `brief()` が要約と打ち手を `<!--cp_split-->` で区切って返し、`render()` が統計の前後に分けて置く。
- アンカーリンク：上部の操作バーに「要約・統計・打ち手」（今のタブに合わせて出す）、要約の枠に「統計へ ↓」「打ち手へ ↓」、打ち手の下に「↑ 要約へ」「↑ 統計へ」。固定ヘッダーに隠れないよう `scroll-margin-top`、動きを減らす設定でなければなめらかに移動。
- 確認（Playwright）：ライト・ダークで全タブの並び（要約 → 統計 → 打ち手）、リンクで移動できること、NaN・undefined なし、エラー0、幅390pxで横スクロールなし。
  - 打ち手はページの最後なので、「打ち手」へ飛んでも見出しは画面の最上部まで来ない（ページの下端で止まる）。
