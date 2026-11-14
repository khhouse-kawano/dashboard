# 自社サイトのページ別アクセス（tracking_touches.csv の分析）

日付：2026-11-13　ブランチ：なし（分析だけ。リポジトリのコードは変えていない）

## 依頼（途中の追加指示を含む）
- ダウンロードの `tracking_touches.csv` を分析。landing_url が https://kh-house.jp/ のもの、`/lp/261128_akiirofes/` が最初に記録された日以降の、ページごとのアクセス数のサマリーを HTML で。
- 追加：ie-miru（www.ie-miru.jp）も含める。→ 予約ページは省く → やはり予約ページも含めてよい（最終：含める）。
- 追加：https://www.ie-miru.jp/cms/yoyaku/khsendai/events/152092 と https://kh-house.jp/lp/261128_akiirofes/ の2ページを見やすく。名前は「解析対象」。

## 出力
- `C:\Users\shinji-kawano\Downloads\自社サイト ページ別アクセス（2026-11-06〜）.html`（集計値だけ。訪問者ID・IP は含まない）
- タブ：解析対象（最初に開く）／概要／ページ別／日別。上部でサイト（すべて・国分ハウジング・いえみる）・分類・ページ検索・表示する訪問数を切り替え。解析対象の2ページは、どの表でも色付きの行。

## 数え方
- tracking_touches は「訪問の入口」（訪問の最初のページ。30分あいたら次の訪問）。サイト内の移動の閲覧（PV）は入らない（tracker.js の visit()／send()）。
- 期間：秋色フェスLPの初回記録 2026-11-06 11:30:52 の日の0時から、CSV の最終 2026-11-13 16:18:57 まで。
- 流入元は source 列で分けた：meta・Facebook/Instagram・ig・meta-SiteLink・FB/IG → 広告：Meta、google → 広告：Google、yahoo → 広告：Yahoo!、organic/* → 自然検索、direct → 直接、social/*・threads・line → SNS、flyer・flier・QR・living・Posting → チラシ・QR・紙面、LP → 自社LPから、iemiru → いえみる内、introductory → 紹介、test は除外、その他 → その他の参照元。
- ページは URL のパス（? 以降は記録されていない）。いえみるは「/cms/yoyaku/店舗/」から店舗ごとに分類（khsendai → KH薩摩川内 など）。

## 主な数字
- 全体 60,416回・訪問者 22,880人・362ページ（kh-house.jp 58,285回・296ページ、いえみる 2,131回・66ページ。いえみるはこの期間すべて予約ページ）。94.1%が広告から（Meta 89.8%）。
- 秋色フェスLP：816回・706人・kh-house.jp の9位・Meta 広告 95.2%・キャンペーン名「261128_薩摩川内店_あきいろフェス」。
- いえみる予約 #152092：44回・21人・いえみるの9位。チラシ・QR 16回（Posting 4 を含む）、直接 12回、Meta 6回、LP のリンク（utm_source=LP）2回。
- 両方のページから訪問を始めた人 4人。

## 確認
- Playwright：ライト・ダークで3サイト × 4タブに NaN・undefined なし・表が空でない、分類の押下・行の展開・並べ替え・検索・サイト切り替え、エラー0、幅390pxで横スクロールなし（途中で 524px にはみ出したので、解析対象のカード内の表を折り返すよう直した）。

## 使ったスクリプト（scratchpad。リポジトリには入れていない）
```python
# tracking_touches.csv：kh-house.jp の入口ページごとの訪問数（秋色フェスLPが最初に記録された日から）。
# 出力は集計値だけ（訪問者ID・IP は出さない）。
import csv, json, sys, re
from collections import Counter, defaultdict
from urllib.parse import urlsplit, unquote

SRC, OUT = sys.argv[1:3]
SITES = {'kh-house.jp': '国分ハウジング', 'www.ie-miru.jp': 'いえみる'}
HOST = 'kh-house.jp'
AKI = '/lp/261128_akiirofes/'

def channel(s):
    s = (s or '').strip()
    l = s.lower()
    if l in ('meta', 'facebook/instagram', 'ig', 'meta-sitelink', 'fb/ig'): return '広告：Meta'
    if l == 'google': return '広告：Google'
    if l == 'yahoo': return '広告：Yahoo!'
    if l == 'tiktok': return '広告：TikTok'
    if l.startswith('organic/'): return '自然検索'
    if l == 'direct': return '直接（ブックマーク・URL入力など）'
    if l.startswith('social/') or l in ('threads', 'line'): return 'SNS（広告以外）'
    if l in ('flyer', 'flier', 'qr', 'living', 'posting'): return 'チラシ・QR・紙面'
    if l == 'lp': return '自社LPから'
    if l == 'iemiru': return 'いえみる内'
    if l == 'introductory': return '紹介'
    if l in ('test', 'null', ''): return '除外'
    return 'その他の参照元'

def device(ua):
    if re.search(r'iPhone|Android.+Mobile|Mobile Safari', ua): return 'スマホ'
    if re.search(r'iPad|Android', ua): return 'タブレット'
    return 'PC'

def page_of(u):
    p = urlsplit(u).path or '/'
    p = unquote(p)
    p = re.sub(r'/index\.(html?|php)$', '/', p)
    if not p.endswith('/') and '.' not in p.rsplit('/', 1)[-1]: p += '/'
    return p

BRAND = [('kokubuhousinggroup', 'グループ'), ('djh', 'DJH'), ('ngm', 'なごみ'), ('2l', '2L'), ('kh', 'KH')]
AREA = {'sendai': '薩摩川内', 'kagoshima': '鹿児島', 'nobeoka': '延岡', 'kanoya': '鹿屋', 'saga': '佐賀', 'miyazaki': '宮崎',
        'kirishima': '霧島', 'kumamoto': '熊本', 'oita': '大分', 'miyakonojo': '都城', 'aira': '姶良', 'izumi': '出水',
        'kaseda': '加世田', 'yatsushiro': '八代', 'kurume': '久留米'}

def iemiru_store(slug):
    for pre, name in BRAND:
        if slug.startswith(pre):
            rest = slug[len(pre):]
            return name + AREA.get(rest, rest)
    return slug

def group_of(p):
    m = re.match(r'^/cms/yoyaku/([^/]+)/', p)
    if m: return 'いえみる予約：' + iemiru_store(m[1])
    if p == '/': return 'トップ'
    seg = p.strip('/').split('/')[0]
    return {'lp': 'LP', 'event': 'イベント', 'plan': '間取り・プラン', 'works': '施工事例', 'model': 'モデルハウス',
            'modelhouse': 'モデルハウス', 'news': 'お知らせ', 'blog': 'ブログ', 'column': 'コラム', 'company': '会社案内',
            'contact': 'お問い合わせ', 'reserve': '来場予約', 'shop': '店舗', 'campaign': 'キャンペーン', 'land': '土地',
            'voice': 'お客様の声', 'lineup': '商品', 'product': '商品', 'reservation_2025': '来場予約', 'reservation': '来場予約',
            'owners_house': 'オーナーズハウス', 'hiraya': '平屋', 'gallery': '施工事例', 'cost': '費用', 'concept': 'コンセプト', 'ambassador': 'アンバサダー'}.get(seg, '/' + seg + '/')

rows = []
first = None
for x in csv.DictReader(open(SRC, encoding='utf-8-sig', newline='')):
    u = x['landing_url']
    host = urlsplit(u).hostname or ''
    if host not in SITES: continue
    if host == HOST and AKI in u and (first is None or x['created_at'] < first): first = x['created_at']
    rows.append((x['created_at'], page_of(u), x['visitor_id'], channel(x['source']), x['utm_campaign'], x['utm_content'],
                 device(x['user_agent']), SITES[host]))
start_day = first[:10]
data = [r for r in rows if r[0][:10] >= start_day and r[3] != '除外']
excluded = sum(1 for r in rows if r[0][:10] >= start_day and r[3] == '除外')
days = sorted({r[0][:10] for r in data})
last = max(r[0] for r in data)

def agg(sub):
    pg = defaultdict(lambda: {'n': 0, 'v': set(), 'ch': Counter(), 'day': Counter(), 'dev': Counter(), 'first': None})
    for t, p, v, ch, camp, cont, dev, site in sub:
        g = pg[(site, p)]; g['n'] += 1; g['v'].add(v); g['ch'][ch] += 1; g['day'][t[:10]] += 1; g['dev'][dev] += 1
        g['first'] = t if g['first'] is None or t < g['first'] else g['first']
    pages = [{'site': site, 'page': p, 'group': group_of(p), 'n': g['n'], 'visitors': len(g['v']), 'ch': dict(g['ch']),
              'day': dict(g['day']), 'dev': dict(g['dev']), 'first': g['first']} for (site, p), g in pg.items()]
    pages.sort(key=lambda r: -r['n'])
    grp = defaultdict(lambda: {'n': 0, 'v': set(), 'pages': 0})
    for p in pages: grp[p['group']]['pages'] += 1
    for r in sub:
        g = grp[group_of(r[1])]; g['n'] += 1; g['v'].add(r[2])
    groups = sorted([{'group': k, 'n': g['n'], 'visitors': len(g['v']), 'pages': g['pages']} for k, g in grp.items()], key=lambda r: -r['n'])
    total = {'n': len(sub), 'visitors': len({r[2] for r in sub}), 'pages': len(pages), 'ch': dict(Counter(r[3] for r in sub)),
             'dev': dict(Counter(r[6] for r in sub)), 'day': dict(Counter(r[0][:10] for r in sub))}
    day_ch = defaultdict(Counter)
    for r in sub: day_ch[r[0][:10]][r[3]] += 1
    return {'total': total, 'pages': pages, 'groups': groups, 'day_ch': {d: dict(c) for d, c in day_ch.items()}}

by_site = {'すべて': agg(data)}
for name in SITES.values():
    sub = [r for r in data if r[7] == name]
    if sub: by_site[name] = agg(sub)

# 注目の2ページ（2026-11-13 の指示）。秋色フェスLP と、いえみるの KH薩摩川内のイベント予約
FOCUS = [('国分ハウジング', AKI, 'kh-house.jp' + AKI), ('いえみる', '/cms/yoyaku/khsendai/events/152092/', 'www.ie-miru.jp/cms/yoyaku/khsendai/events/152092')]

def detail(site, path, url):
    sub = [r for r in data if r[7] == site and r[1] == path]
    vis = {r[2] for r in sub}
    other = Counter()
    for r in data:
        if r[2] in vis and not (r[7] == site and r[1] == path): other[(r[7], r[1])] += 1
    also_v = len({r[2] for r in data if r[2] in vis and not (r[7] == site and r[1] == path)})
    hour = Counter(int(r[0][11:13]) for r in sub)
    camp = Counter(((r[4] if r[4] not in ('', 'NULL') else '（なし）'), r[3]) for r in sub)
    rep = Counter(min(c, 5) for c in Counter(r[2] for r in sub).values())
    site_pages = by_site[site]['pages']
    rank = next((k + 1 for k, q in enumerate(site_pages) if q['page'] == path), None)
    return {'site': site, 'page': path, 'url': url, 'n': len(sub), 'visitors': len(vis),
            'first': min((r[0] for r in sub), default=''), 'rank': rank, 'site_pages': len(site_pages), 'site_n': by_site[site]['total']['n'],
            'day': dict(Counter(r[0][:10] for r in sub)), 'ch': dict(Counter(r[3] for r in sub)), 'dev': dict(Counter(r[6] for r in sub)),
            'hour': {h: hour.get(h, 0) for h in range(24)},
            'campaign': [{'campaign': c, 'ch': ch, 'n': n} for (c, ch), n in camp.most_common(20)],
            'repeat': {('5回以上' if k == 5 else f'{k}回'): v for k, v in sorted(rep.items())},
            'also': [{'site': s2, 'page': p2, 'n': n} for (s2, p2), n in other.most_common(12)], 'also_visitors': also_v, '_v': vis}

focus = [detail(*f) for f in FOCUS]
both_v = focus[0]['_v'] & focus[1]['_v']
for f in focus: del f['_v']
out = {'sites': list(SITES.values()), 'hosts': SITES, 'aki': AKI, 'start_day': start_day, 'last': last, 'days': days,
       'excluded': excluded, 'by_site': by_site, 'focus': focus, 'focus_both': len(both_v), 'aki_first': first}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('focus', [(f['page'], f['n'], f['visitors'], f['rank'], f['ch']) for f in focus], 'both', len(both_v))
```

解析対象タブ（tt_focus_tab.js）
```js
const focusName = (f) => f.site === 'いえみる' ? 'いえみる予約 KH薩摩川内 #152092' : '秋色フェスLP';
R.focus = () => {
  const [a, b] = D.focus;
  const days = D.days.length;
  const dmax = Math.max(1, ...D.focus.flatMap((f) => D.days.map((d) => f.day[d] || 0)));
  const card = (f) => {
    const ad = adShare(f.ch), once = f.repeat['1回'] || 0;
    const hmax = Math.max(1, ...Object.values(f.hour));
    const peak = Object.entries(f.hour).sort((x, y) => y[1] - x[1])[0];
    const chs = CH.filter((k) => f.ch[k]).sort((x, y) => f.ch[y] - f.ch[x]);
    const cls = (k) => k.startsWith('広告') ? 'ad' : k.startsWith('直接') ? 'dir' : k.startsWith('チラシ') ? 'fly' : 'oth';
    return `<div class="tt_card tt_focus">
      <p class="tt_eyebrow">解析対象・${esc(f.site)}</p>
      <h3 style="font-size:16px;margin:2px 0 4px">${esc(focusName(f))}</h3>
      <a class="tt_url" href="https://${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.url)}</a>
      <div class="tt_kpis" style="margin-top:10px">
        <div class="tt_kpi hl"><div class="l">訪問数</div><div class="v">${fmt(f.n)}</div><div class="r">1日あたり ${(f.n / days).toFixed(1)}</div></div>
        <div class="tt_kpi"><div class="l">訪問者数</div><div class="v">${fmt(f.visitors)}</div><div class="r">1人あたり ${(f.n / Math.max(1, f.visitors)).toFixed(2)}回</div></div>
        <div class="tt_kpi"><div class="l">${esc(f.site)}での順位</div><div class="v">${f.rank}位</div><div class="r">${fmt(f.site_pages)}ページ中・構成比 ${fp(pc(f.n, f.site_n))}</div></div>
        <div class="tt_kpi"><div class="l">広告から</div><div class="v">${fp(pc(ad, f.n))}</div><div class="r">${fmt(ad)}回</div></div>
      </div>
      <h4 class="tt_h4">流入元</h4>
      <div class="tt_stack">${chs.map((k) => `<span title="${k} ${fmt(f.ch[k])}回" style="flex:${f.ch[k]}" class="${cls(k)}"></span>`).join('')}</div>
      <table class="tt_tbl" style="margin-top:6px"><tbody>${chs.map((k) => `<tr><td><span class="tt_dot ${cls(k)}"></span>${k}</td><td class="n">${fmt(f.ch[k])}</td><td class="n">${fp(pc(f.ch[k], f.n))}</td></tr>`).join('')}</tbody></table>
      <h4 class="tt_h4">時間帯（いちばん多いのは ${peak[0]}時台）</h4>
      <div class="tt_cols" style="height:70px">${Object.entries(f.hour).map(([h, v]) => `<div title="${h}時台 ${fmt(v)}回" style="height:${v / hmax * 100}%"></div>`).join('')}</div>
      <div class="tt_axis">${Object.keys(f.hour).map((h) => `<span>${h % 6 === 0 ? h : ''}</span>`).join('')}</div>
      <h4 class="tt_h4">キャンペーン名（utm_campaign）</h4>
      <table class="tt_tbl"><tbody>${f.campaign.map((c) => `<tr><td class="pg" title="${esc(c.campaign)}">${esc(c.campaign)}</td><td>${esc(c.ch)}</td><td class="n">${fmt(c.n)}</td></tr>`).join('')}</tbody></table>
      <p class="tt_muted" style="margin:8px 0 0">端末：${Object.entries(f.dev).map(([k, v]) => `${k} ${fmt(v)}`).join('・')}　／　期間中に1回だけ来た人 ${fp(pc(once, f.visitors))}　／　最初の記録 ${f.first.slice(5, 16).replace('-', '/')}</p>
    </div>`;
  };
  const dayRows = D.days.map((d) => `<tr><td>${md(d)}${d === D.days[days - 1] ? ' <span class="tt_muted">途中</span>' : ''}</td>${D.focus.map((f) => `<td class="n">${bar(f.day[d] || 0, dmax)}</td>`).join('')}</tr>`).join('');
  const alsoRows = (f) => f.also.map((x) => `<tr class="${isFocus(x) ? 'is_aki' : ''}"><td class="pg" title="${esc(x.page)}">${x.site !== '国分ハウジング' ? '[いえみる] ' : ''}${esc(x.page)}</td><td class="n">${fmt(x.n)}</td></tr>`).join('');
  return `
  <div class="tt_sum"><p class="tt_eyebrow">数値の要約</p><ol>
    <li><b>${esc(focusName(a))}</b>：${fmt(a.n)}回・訪問者 ${fmt(a.visitors)}人。${fp(pc(a.ch['広告：Meta'] || 0, a.n))}が Meta 広告からで、スマホが ${fp(pc(a.dev['スマホ'] || 0, a.n))}。kh-house.jp の入口ページの ${a.rank}位。</li>
    <li><b>${esc(focusName(b))}</b>：${fmt(b.n)}回・訪問者 ${fmt(b.visitors)}人。広告からは ${fp(pc(adShare(b.ch), b.n))}で、直接 ${fmt(b.ch['直接（ブックマーク・URL入力など）'])}回・チラシ/QR ${fmt(b.ch['チラシ・QR・紙面'])}回・その他の参照元 ${fmt(b.ch['その他の参照元'])}回が中心。いえみるの入口ページの ${b.rank}位。</li>
    <li>両方のページから訪問を始めた人は <b>${fmt(D.focus_both)}人</b>（LP の訪問者の ${fp(pc(D.focus_both, a.visitors))}）。</li>
    <li>${md(D.days[0])}〜${md(D.days[days - 1])}（最終日は ${D.last.slice(11, 16)} まで）。数は「訪問の入口になった回数」で、サイト内でほかのページから移ってきた閲覧は入らない。</li>
  </ol></div>
  <div class="tt_grid2">${card(a)}${card(b)}</div>
  <div class="tt_grid2">
    <div class="tt_card"><h3>日ごとの訪問数（2ページを同じ目盛りで）</h3><div class="tt_wrap"><table class="tt_tbl"><thead><tr><th>日</th>${D.focus.map((f) => `<th class="n">${esc(focusName(f))}</th>`).join('')}</tr></thead>
      <tbody>${dayRows}<tr class="total"><td>合計</td>${D.focus.map((f) => `<td class="n">${fmt(f.n)}</td>`).join('')}</tr></tbody></table></div></div>
    <div class="tt_card"><h3>同じ人がほかに入口にしたページ</h3>
      <div class="tt_grid2" style="gap:10px">${D.focus.map((f) => `<div><b style="font-size:12px">${esc(focusName(f))} に来た人（${fmt(f.also_visitors)}人）</b><div class="tt_wrap" style="max-height:300px"><table class="tt_tbl"><thead><tr><th>ページ</th><th class="n">訪問数</th></tr></thead><tbody>${alsoRows(f) || '<tr><td colspan="2" class="tt_muted">なし</td></tr>'}</tbody></table></div></div>`).join('')}</div>
      <p class="tt_muted">色付きの行は、もう一方の解析対象ページ。</p></div>
  </div>`;
};
```
