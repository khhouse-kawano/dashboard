# 2026-10-15 年代別ペルソナ分析（歩留まり・契約者像・商談の話題）HTML レポート

## 依頼
- master_data の生年月日、また全テーブルで年齢が分かるテーブルを参考に、年代ごとの歩留まりと契約数を出す
- master_data・interview_sheet と紐づけて、年代ごとのペルソナとして分かることを深掘りしてまとめる

## 出力
- `C:/Users/shinji-kawano/Downloads/persona_by_age_2026-10-15.html`（集計値だけ。顧客ごとのデータ・電話・メールは入っていない。リポジトリには入れていない）
- コードの変更なし

## 年齢の出所（ローカルDB）
| 表 | 列 | 年齢あり | master_data と突き合わせ |
|---|---|---|---|
| master_data | customer_contacts_birth_date | 2,017 | 同じ行（反響取得日時点の年齢に換算） |
| homes_db | age_homes | 4,115 | 電話→メール |
| townlife_db | age_townlife | 3,402 | 電話→メール |
| hotlead_db | age | 1,621 | 電話→メール |
| mochiie_db | age_mochiie | 457 | 電話→メール |
| sumai_step_db / event_db / smile_fes | age（「36～40歳代」は中央値に換算） | 195 / 89 / 61 | 電話→メール |
| before_interview | birth | 34 | id |
| funding_plan | k_h_age | 9 | id |
- 優先順: master_data 生年月日 → 事前アンケート生年月日 → ポータル等の年齢。18〜90歳以外は捨てた
- 生年月日とポータルの年齢が両方ある 244人中 229人（94%）が±2歳以内で一致
- 結果: 重複を除く 24,091人中 9,498人（39%）、契約者 989人中 410人（41%）に年齢が付いた
- 年齢を持つ列があるがここで使っていない表: catalog_kaeru / member_kaeru / reserve_kaeru / allGrit_kaeru（建売）、suumo_db（25件しか入っていない）、ieuru_resale / suumo_db_resale / iei_db（中古・売却）

## ⚠️ 偏りの扱い
- master_data の生年月日は契約した人ほど入っている（生年月日がある人の契約率 17.3%）
- → 歩留まり（01）は**反響の時点で分かっていた年齢**（ポータル等の申込時の年齢）だけで出した
- → 契約者の年代構成（02〜03）は出所を問わず使った

## 定義
- 面談＝初回面談以降の日付あり／次アポ＝事前審査・第二面談・契約の日付あり／契約＝status 契約済み
- 率は反響取得日 2026-06 までの反響。status＝重複は除く
- 属性: 年収=HOME'S、平屋・子ども・大人の人数=タウンライフ、土地=HOME'S・持ち家計画、予算=HOME'S→タウンライフ→持ち家計画→顧客台帳（「0人」「0万円」は既定値なので使わない）
- 商談の話題: interview_sheet.interview_log の note に、言葉（例 建て替え＝「建替|建て替」）が1回でも出た顧客の割合

## 主な結果
| 年代 | 契約者に占める割合 | 反響時点の年齢での契約率 | 土地あり | 平屋希望 | 建物予算（中央値） |
|---|---|---|---|---|---|
| 20代以下 | 27% | 0.89% | 16% | 55% | 2,750万円 |
| 30代 | 43% | 1.47% | 22% | 51% | 2,750万円 |
| 40代 | 17% | 1.02% | 36% | 64% | 2,250万円 |
| 50代 | 8% | 0.78% | 48% | 81% | 2,000万円 |
| 60代以上 | 5% | 0.27% | 62% | 80% | 2,000万円 |
- 契約者の年齢 中央値34歳（半数が29〜42歳）
- 40代は面談率が最も高い（10.4%）が契約率は30代より低い。計画中止で止まる割合が最も高い
- 商談の話題: 建て替え 1%（20代以下）→ 20%（60代以上）、老後 4% → 13%、子ども・学区 17%（30代）→ 5%（60代以上）、60代以上は予算・価格 44%・他社比較 39%
- SNS広告の契約者は30代が56%

## スクリプト（スクラッチ。リポジトリには入れていない）
- 抽出: master_data（b5）、ポータル等（b6）、interview_sheet（b7）を `--raw -N` で1行1JSON
- age.cjs（突き合わせ・年齢の決定）→ persona.cjs（集計）→ persona_report.cjs（HTML）

### age.cjs
```js
const fs = require('fs');
const S = process.argv[2];
const read = (f) => fs.readFileSync(S + '/' + f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const M = read('b5.jsonl'), P = read('b6.jsonl');
const digits = (v) => { let d = String(v || '').replace(/[^\d]/g, ''); if (d.startsWith('81')) d = '0' + d.slice(2); return d.length >= 10 ? d : ''; };
const mail = (v) => { const m = String(v || '').trim().toLowerCase(); return /@/.test(m) ? m : ''; };
const date = (v) => { const m = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(String(v || '').trim()); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const byTel = new Map(), byMail = new Map(), byId = new Map();
for (const r of M) {
  byId.set(r.id, r);
  for (const t of [digits(r.mob), digits(r.tel)]) if (t) { if (!byTel.has(t)) byTel.set(t, []); byTel.get(t).push(r); }
  const e = mail(r.mail); if (e) { if (!byMail.has(e)) byMail.set(e, []); byMail.get(e).push(r); }
}
const ageNum = (v) => { const s = String(v || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)); const r = /(\d{2})\s*[～~〜-]\s*(\d{2})/.exec(s); if (r) return Math.round((+r[1] + +r[2]) / 2); const m = /(\d{2})\s*代/.exec(s); if (m) return +m[1] + 5; const n = /^\s*(\d{2})(\.0+)?\s*(歳|才)?\s*$/.exec(s); return n ? +n[1] : null; };
const stats = {};
for (const p of P) {
  stats[p.src] = stats[p.src] || { rows: 0, age: 0, matched: 0 };
  stats[p.src].rows++;
  let age = null;
  if (p.src === 'before') { const b = date(p.birth); if (b) age = { birth: b }; }
  else { const a = ageNum(p.age); if (a !== null && a >= 18 && a <= 90) age = { age: a }; }
  if (!age) continue;
  stats[p.src].age++;
  let hits = [];
  if (p.id && byId.has(p.id)) hits = [byId.get(p.id)];
  else { const t = digits(p.tel), e = mail(p.mail); hits = (t && byTel.get(t)) || (e && byMail.get(e)) || []; }
  if (hits.length) stats[p.src].matched++;
  for (const r of hits) { r.portal = r.portal || []; r.portal.push({ src: p.src, ...age, p }); }
}
console.log(stats);
// 年齢の決定: 生年月日（master_data → before_interview）→ ポータルの年齢
let src = {}, agree = [0, 0];
for (const r of M) {
  const inq = date(r.inq) || date(r.iv) || new Date(2026, 9, 1);
  let age = null, how = '';
  const bd = date(r.bd);
  const fromBirth = (b) => { let a = inq.getFullYear() - b.getFullYear(); if (inq < new Date(inq.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  if (bd) { const a = fromBirth(bd); if (a >= 18 && a <= 90) { age = a; how = 'master_data 生年月日'; } }
  if (age === null) { const b = (r.portal || []).find((x) => x.birth); if (b) { const a = fromBirth(b.birth); if (a >= 18 && a <= 90) { age = a; how = '事前アンケート 生年月日'; } } }
  const pa = (r.portal || []).find((x) => x.age);
  if (age !== null && pa) { agree[1]++; if (Math.abs(age - pa.age) <= 2) agree[0]++; }
  if (age === null && pa) { age = pa.age; how = { homes: "HOME'S", townlife: 'タウンライフ', hotlead: 'ホットリード', mochiie: '持ち家計画', sumai_step: 'すまいステップ', event: 'イベント受付', smile: 'スマイルフェス', funding: '資金計画書' }[pa.src] || pa.src; }
  r.age = age; r.ageSrc = how;
  src[how || '不明'] = (src[how || '不明'] || 0) + 1;
}
console.log(src, 'agree(±2y)', agree);
fs.writeFileSync(S + '/aged.json', JSON.stringify(M.map(({ mob, tel, mail, ...rest }) => ({ ...rest, portal: (rest.portal || []).map((x) => ({ src: x.src, ...Object.fromEntries(Object.entries(x.p).filter(([k]) => !['tel', 'mail', 'id', 'birth'].includes(k))) })) }))));
```

### persona.cjs
```js
// 年代別ペルソナの集計。入力: aged.json（age.cjs）/ b7.jsonl（商談シート）。出力: persona.json
const fs = require('fs');
const S = process.argv[2];
const M = JSON.parse(fs.readFileSync(S + '/aged.json', 'utf8'));
const LOGS = fs.readFileSync(S + '/b7.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const MATURE = '2026-06';
const has = (v) => String(v || '').trim() !== '';
const date = (v) => { const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(v || '').trim()); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const GROUPS = ['20代以下', '30代前半', '30代後半', '40代前半', '40代後半', '50代', '60代以上'];
const DECADES = ['20代以下', '30代', '40代', '50代', '60代以上'];
const band = (a) => (a < 30 ? '20代以下' : a < 35 ? '30代前半' : a < 40 ? '30代後半' : a < 45 ? '40代前半' : a < 50 ? '40代後半' : a < 60 ? '50代' : '60代以上');
const decade = (a) => (a < 30 ? '20代以下' : a < 40 ? '30代' : a < 50 ? '40代' : a < 60 ? '50代' : '60代以上');

// 商談シート
const logOf = new Map();
for (const r of LOGS) {
  let log = r.log;
  if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
  if (!Array.isArray(log)) log = log ? [log] : [];
  logOf.set(r.id, log);
}

for (const r of M) {
  r.valid = r.st !== '重複';
  r.contract = r.st === '契約済み';
  r.meet = r.contract || has(r.iv) || has(r.sc) || has(r.ap) || has(r.ct);
  r.next = r.contract || has(r.sc) || has(r.ap) || has(r.ct);
  const d = date(r.inq); r.month = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
  const c = date(r.ct); r.lag = d && c && r.contract ? Math.round((c - d) / 86400000) : null;
  r.band = r.age === null ? null : band(r.age);
  r.dec = r.age === null ? null : decade(r.age);
  // 反響の時点で分かっていた年齢か（ポータル・イベント受付の申込時の年齢）
  r.atInquiry = ["HOME'S", 'タウンライフ', 'ホットリード', '持ち家計画', 'すまいステップ', 'イベント受付', 'スマイルフェス'].includes(r.ageSrc);
}

const stat = (list) => {
  const v = list.filter((r) => r.valid);
  const m = v.filter((r) => r.month !== '' && r.month <= MATURE);
  const lags = v.map((r) => r.lag).filter((x) => x !== null && x >= 0).sort((a, b) => a - b);
  return {
    n: v.length, ct: v.filter((r) => r.contract).length,
    mn: m.length, mmeet: m.filter((r) => r.meet).length, mnext: m.filter((r) => r.next).length, mct: m.filter((r) => r.contract).length,
    lagMed: lags.length ? lags[Math.floor(lags.length / 2)] : null,
  };
};
const group = (list, key, order) => order.map((k) => ({ k, ...stat(list.filter((r) => key(r) === k)) }));

const aged = M.filter((r) => r.age !== null && r.valid);
const atInq = aged.filter((r) => r.atInquiry);
const out = {};

out.coverage = {
  total: M.filter((r) => r.valid).length,
  aged: aged.length,
  bySrc: Object.entries(aged.reduce((o, r) => ((o[r.ageSrc] = (o[r.ageSrc] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]),
  contracted: M.filter((r) => r.valid && r.contract).length,
  contractedAged: aged.filter((r) => r.contract).length,
  birthContractRate: (() => { const b = aged.filter((r) => r.ageSrc === 'master_data 生年月日'); return [b.filter((r) => r.contract).length, b.length]; })(),
};

// ① 歩留まり（反響時点の年齢だけ）
out.funnelBand = group(atInq, (r) => r.band, GROUPS);
out.funnelDec = group(atInq, (r) => r.dec, DECADES);
for (const med of ["HOME'S", 'タウンライフ']) out['funnel_' + med] = group(atInq.filter((r) => r.med === med), (r) => r.dec, DECADES);

// ② 契約者の年代構成（出所を問わない）
const contracted = aged.filter((r) => r.contract);
out.contractMix = DECADES.map((k) => ({ k, n: contracted.filter((r) => r.dec === k).length }));
out.contractMixBand = GROUPS.map((k) => ({ k, n: contracted.filter((r) => r.band === k).length }));
out.inquiryMix = DECADES.map((k) => ({ k, n: atInq.filter((r) => r.dec === k).length }));
const ages = contracted.map((r) => r.age).sort((a, b) => a - b);
out.contractAgeMedian = ages[Math.floor(ages.length / 2)];
out.contractAgeQ = [ages[Math.floor(ages.length * 0.25)], ages[Math.floor(ages.length * 0.75)]];

// ③ 年代 × 媒体・ブランド・エリア（年代が分かる全員。契約は全期間）
const crossOf = (key, min) => {
  const keys = Object.entries(aged.reduce((o, r) => ((o[key(r)] = (o[key(r)] || 0) + 1), o), {})).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { keys, cells: keys.map((k) => DECADES.map((d) => { const l = aged.filter((r) => key(r) === k && r.dec === d); return { n: l.length, ct: l.filter((r) => r.contract).length }; })) };
};
out.byMedium = crossOf((r) => r.med || '（空）', 150);
out.byBrand = crossOf((r) => r.b || '（空）', 100);
out.byArea = crossOf((r) => r.a || '（不明）', 100);

// ④ ペルソナ属性（年代ごと）
const P = (r, src) => (r.portal || []).find((x) => x.src === src);
const yen = (s) => { const t = String(s || '').replace(/,/g, ''); const nums = [...t.matchAll(/(\d{3,5})/g)].map((m) => +m[1]); if (!nums.length) return null; if (/未満|～\d/.test(t) && nums.length === 1 && /^～|未満/.test(t.trim()) ) return nums[0] * 0.9; return nums.reduce((a, b) => a + b, 0) / nums.length; };
const persona = {};
for (const d of DECADES) {
  const l = aged.filter((r) => r.dec === d);
  const pick = (f) => l.map(f).filter((v) => v !== null && v !== undefined && v !== '');
  const dist = (vals) => { const o = {}; for (const v of vals) o[v] = (o[v] || 0) + 1; return { n: vals.length, d: Object.entries(o).sort((a, b) => b[1] - a[1]) }; };
  const med = (vals) => { const s = vals.filter((v) => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b); return s.length ? { n: s.length, med: s[Math.floor(s.length / 2)] } : { n: 0, med: null }; };
  persona[d] = {
    n: l.length,
    income: dist(pick((r) => P(r, 'homes')?.inc || null)),
    budget: med(pick((r) => yen(P(r, 'homes')?.bud) ?? yen(P(r, 'townlife')?.bud) ?? yen(P(r, 'mochiie')?.bud) ?? (/^[1-9]/.test(String(r.bud).replace(/,/g, '')) ? +String(r.bud).replace(/[^\d]/g, '') : null))),
    land: dist(pick((r) => { const h = P(r, 'homes')?.est; if (h) return /あり/.test(h) ? 'あり' : 'なし'; const m = P(r, 'mochiie')?.est; if (m) return /あり/.test(m) ? 'あり' : 'なし'; return null; })),
    floor: dist(pick((r) => P(r, 'townlife')?.floor || null)),
    child: dist(pick((r) => { const t = P(r, 'townlife')?.child; return t ? t.replace('5人以上', '5人+') : null; })),
    adult: dist(pick((r) => P(r, 'townlife')?.adult || null)),
    house: dist(pick((r) => (has(r.house) ? r.house : null) || (P(r, 'hotlead')?.house && P(r, 'hotlead').house !== '不明' ? P(r, 'hotlead').house : null))),
    emp: dist(pick((r) => (has(r.emp) ? r.emp : null))),
    gender: dist(pick((r) => (has(r.gen) ? r.gen : null))),
    lost: dist(pick((r) => (!r.contract && ['失注', '計画中止', '計画延期', 'ブラックリスト', '建築エリア外', '物貰い', '連絡不能', 'その他'].includes(r.last) ? r.last : null))),
    medium: dist(pick((r) => r.med || null)),
    // 契約者だけの属性
    ctLand: dist(l.filter((r) => r.contract).map((r) => { const h = P(r, 'homes')?.est; return h ? (/あり/.test(h) ? 'あり' : 'なし') : null; }).filter(Boolean)),
    ctFloor: dist(l.filter((r) => r.contract).map((r) => P(r, 'townlife')?.floor || null).filter(Boolean)),
  };
}
out.persona = persona;

// ⑤ 商談シート（年代が分かり、シートがある顧客）
const KW = [
  ['平屋', /平屋/], ['土地探し', /土地/], ['実家・親', /実家|両親|親御|義父|義母|お父|お母|親の/], ['子ども・学区', /子供|子ども|お子|学区|小学校|中学校|保育|幼稚園/],
  ['資金・ローン', /資金|ローン|審査|借入|金利|返済/], ['予算・価格', /予算|価格|値引|金額|見積/], ['他社・競合', /他社|競合|比較|検討中の会社|ハウスメーカー/],
  ['建て替え', /建替|建て替/], ['二世帯・同居', /二世帯|2世帯|同居/], ['老後・将来', /老後|将来|定年|退職|年金/], ['間取り・プラン', /間取|プラン|図面/], ['性能・耐震', /性能|耐震|断熱|気密|省エネ|ZEH/],
];
const sheet = {};
for (const d of DECADES) {
  const l = aged.filter((r) => r.dec === d && logOf.has(r.id));
  const kw = KW.map(([k, re]) => {
    const hit = l.filter((r) => logOf.get(r.id).some((e) => re.test(String(e.note || ''))));
    return { k, n: hit.length, ct: hit.filter((r) => r.contract).length };
  });
  const meetings = (r) => logOf.get(r.id).filter((e) => /面談|事前審査|物件案内/.test(String(e.action || ''))).length;
  const ct = l.filter((r) => r.contract);
  const mm = ct.map(meetings).sort((a, b) => a - b);
  const notes = l.reduce((s, r) => s + logOf.get(r.id).filter((e) => has(e.note)).length, 0);
  sheet[d] = { n: l.length, ct: ct.length, kw, meetMed: mm.length ? mm[Math.floor(mm.length / 2)] : null, notes };
}
out.sheet = sheet;
out.kwKeys = KW.map(([k]) => k);

fs.writeFileSync(S + '/persona.json', JSON.stringify(out));
const p = (x, n) => (n ? ((x / n) * 100).toFixed(1) : '-');
console.log('coverage', JSON.stringify(out.coverage));
for (const t of ['funnelBand', 'funnelDec', "funnel_HOME'S", 'funnel_タウンライフ']) { console.log('==', t); for (const r of out[t]) console.log(r.k.padEnd(8), 'n', r.n, 'mn', r.mn, '面談', p(r.mmeet, r.mn), '次', p(r.mnext, r.mn), '契', r.mct, p(r.mct, r.mn), 'lag', r.lagMed); }
console.log('contractMix', JSON.stringify(out.contractMix), 'inqMix', JSON.stringify(out.inquiryMix), 'median', out.contractAgeMedian, out.contractAgeQ);
console.log('contractMixBand', JSON.stringify(out.contractMixBand));
for (const d of DECADES) { const x = persona[d]; console.log('\n##', d, x.n, '| income', JSON.stringify(x.income.d.slice(0, 4)), x.income.n, '| budget', JSON.stringify(x.budget), '| land', JSON.stringify(x.land), '| floor', JSON.stringify(x.floor), '| child', JSON.stringify(x.child.d.slice(0,4)), x.child.n, '| adult', JSON.stringify(x.adult.d.slice(0,3)), '| house', JSON.stringify(x.house.d.slice(0, 4)), x.house.n, '| emp', JSON.stringify(x.emp.d.slice(0,3)), '| lost', JSON.stringify(x.lost.d.slice(0, 5)), x.lost.n, '| med', JSON.stringify(x.medium.d.slice(0, 5)), '| ctLand', JSON.stringify(x.ctLand), '| ctFloor', JSON.stringify(x.ctFloor)); }
for (const d of DECADES) { const x = sheet[d]; console.log('sheet', d, x.n, x.ct, 'meetMed', x.meetMed, x.kw.map((k) => k.k + ':' + p(k.n, x.n) + '(' + p(k.ct, k.n) + ')').join(' ')); }
console.log('medium', JSON.stringify(out.byMedium)); console.log('brand', JSON.stringify(out.byBrand)); console.log('area', JSON.stringify(out.byArea));
```
