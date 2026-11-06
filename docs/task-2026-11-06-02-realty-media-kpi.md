# 作業記録 v2.2.254　不動産企画係：チームサマリーに売りKPI・買いKPI

## 依頼
- 2026-11-06「254に着手」→ テーマを確かめ、回答「売りKPI・買いKPI」
- 計画（以前のアプリ v14.30 の媒体別KPIを写す・置き場所・数え方・操作・確かめ方）を出し、「進めてよい」

## 何ができるようになったか
チームサマリーの見出しのすぐ下（歩留まりファネルの前）に、「📊 売りKPI」「🏠 買いKPI」の2枚のカード。以前のアプリ v14.30 と同じ位置・同じ数え方。

| カード | 行 | 段 | 率 |
|---|---|---|---|
| 売りKPI | 反響媒体（設定の反響元の順） | 売却反響 → 通電 → 通電アポ → 訪問査定 → 受託 | 通電率・アポ率・通電査定率・査定受託率 |
| 買いKPI | ポータル（設定の買いポータルの順） | 買い反響 → 通電 → 内見予約 → 内見 → 購入申込 → 成約 | 通電率・内見率・申込率・成約率 |

- 集計の軸：媒体別（既定）・担当者別（設定の担当者は0件でも行を出す）・担当者×媒体（指標を選ぶ。行・列の合計）
- 期間：期首〜対象月の累計（既定。対象月はチームサマリーで選んだ月、通期なら今月）・今期の各月・各期の通期・過去すべて
- 絞り込み：媒体別は担当（全員・未割当のみ・各担当）、担当者別は媒体
- 率はチーム合計より ±5pt で緑・赤（クロスは同じ媒体のチーム合計と比べる）。分母0は「―」
- 媒体が空は「（未設定）」、担当が空は「（未割当）」で最後に
- 「⬇ CSV」：表示中の表。クロスは縦持ち（担当者・媒体・各段・各率）。BOM 付き。ファイル名は `売りKPI_媒体別_6月-11月累計.csv` の形（以前のアプリと同じ）
- 表示の条件は端末ごと・保存しない（以前のアプリと同じ）

### 数え方
- 受信月コホート（その期間に受信した反響が、いまどこまで進んだか）。`common/leadFunnel.ts` の `recvMonthKey`・`periodHas`・`fyStartOf` をそのまま使う → 歩留まりファネルと合計が一致する
- 段の条件は以前のアプリの `DSK_KIND` のまま
  - 売り 通電：通電日あり か フェーズが通電済以降
  - 売り 通電アポ：アポ日あり か 訪問査定日あり か フェーズが訪問査定予定以降
  - 売り 訪問査定：訪問査定日あり か フェーズが訪問査定済以降、受託：媒介受託
  - 買い 通電：通電日あり か 通電済以降、内見予約：内見日あり か 内見予約以降、内見：内見日あり か 内見済以降、購入申込：購入申込・成約、成約：成約
- ⚠️ アポ日（以前のアプリの `l.appt.date`）は Dashboard に列が無い。架電ナビ（② `calls.ts` の navi_save）が原本 `raw_data.appt` に書いているので、そこから読む

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/realty/summary | **mediaKpi.ts**（新規） | 集計。`DSK_KIND`・`DSK_AXES`・`DSK_NOSRC`・`DSK_NOSTAFF`・`dskAgg`・`dskLabel`・`dskRate`・`dskTone`・`dskMetricVal`・`dskCsv`、内部の `apptDate`・`dskPeriodHas`・`dskRank`・`dskNew`・`dskAdd`。型 `DskKind`・`DskAxis`・`DskState`・`DskDef`・`DskStep`・`DskRate`・`DskRow`・`DskAgg` |
| frontend/src/components/realty/summary | **MediaKpiCard.tsx**（新規） | 画面（カード1枚）。専用の `<style>`（接頭辞 `mkpi_`）。見た目はサマリーの他のカードに合わせた |
| frontend/src/components/realty/summary | Summary.tsx | `MediaKpiCard` を2枚、歩留まりファネルの前に。`mediaKpi`（設定の反響元・買いポータル・担当者の氏名・対象月） |
| backend/scripts/guide/articles/common | screen-240.md | 記事「チームサマリー（不動産企画係）」に「売りKPI・買いKPI」の節 |
| backend/scripts/sql | 2026-11-06_update_log_2.2.254.sql（新規） | 更新履歴＋記事の SQL |
| frontend/src/utils | version.ts | 2.2.254 |

- ⚠️ ②・① の PHP・DB は変えていない。データは今の `planner:summary`（売り・買い反響の全件と設定）をそのまま使う

## テスト（ローカル）
- ① 経由（`localhost:8080`）：トークン無し `planner:summary` → 401。トークン有りで、テストの反響の `raw_data.appt.date` が画面に届くこと
- テストの反響1件（イエウール・担当なし・通電済・アポ日だけあり・今月受信）を入れて、Playwright（3100、`scratchpad/pw_254.cjs`）で確かめ、最後に消した
  - 媒体別（期首〜今月の累計）の各行・各段 = SQL で数えた値（売り 合計 304/192/121/107/31、買い 107/73/40/35/14/7）
  - テストの反響が「通電アポ」に入る（アポ日だけで数える）
  - 期間を今期の通期にしたとき、売り・買いの反響数と売りの通電が歩留まりファネルと一致
  - 担当者別：設定の4人＋（未割当）、合計は媒体別と同じ。媒体（イエウール）で絞ると SQL のイエウールと一致
  - 媒体別×未割当のみ：合計 = SQL の担当なしの件数
  - クロス：件数（売却反響）の右下 = 媒体別の合計。通電率で緑9・赤9のセル
  - CSV：ファイル名 `売りKPI_担当者×媒体_6月-11月累計.csv`、BOM 付き・縦持ちの見出し、売却反響の合計 = 媒体別の合計
  - 上で 2026年8月を選ぶと「2026年6月〜2026年8月 累計」になる
  - 画面のエラー 0
- 一時スタッフ（id 999999）とテストの反響は消した。開発サーバーは止めた
- リファクタリング：Summary.tsx で2回書いていた対象月の式を `mediaKpi.month` にまとめた。そのあとテストを通し直した（すべて OK）
- 気づいたこと：ローカルの売り反響に「HOME'S」が1件ある（ほかは「HOME's」）。以前のアプリと同じく別の行として数える。記事に注意を書いた

## 業務ガイド
- 記事「チームサマリー（不動産企画係）」（common/screen-240.md）
  - 要約と「上から順に」に売りKPI・買いKPI
  - 新しい節「売りKPI・買いKPI」：段と率の定義、通電アポの数え方、軸・期間・絞り込み・色分け・未設定・未割当・CSV
  - 注意：媒体の書き方が違うと別の媒体になる
- SQL は `2026-11-06_update_log_2.2.254.sql` の末尾。ローカルに流した（更新履歴の文はローカルでは UPDATE で直した。no=353）

## 追加した関数・コンポーネント（全文）

### frontend/src/components/realty/summary/mediaKpi.ts（新規）
```ts
/**
 * 売りKPI・買いKPI（v2.2.254）。チームサマリーの「媒体別KPI」の集計。
 *
 * ⚠️ 移植元は以前のアプリ v14.30 の DSK_KIND・dskAgg・dskCsv（括弧の中は移植元の名前）。数字が一致するよう定義をそのまま写している。
 *   売りは反響元（source）、買いはポータル（portal）ごとに、歩留まりと各段の移行率を出す。
 *   受信月コホート基準（歩留まりファネル・common/leadFunnel.ts と同じ数え方）。
 * 集計軸: 'src' 媒体別／'staff' 担当者別／'cross' 担当者×媒体
 * 期間: 'cum'（期首〜対象月の累計）と、leadFunnel.ts の期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）
 */
import { fyStartOf, periodHas, periodLabel, periodShort, recvMonthKey } from '../common/leadFunnel';
import { monthLabel } from './kpi';
import type { Row } from './kpi';

export type DskKind = 'sell' | 'buy';
export type DskAxis = 'src' | 'staff' | 'cross';
/** 画面内の表示条件（端末ごと・保存しない）。staff は '__none' で未割当のみ */
export type DskState = { p: string; staff: string; src: string; axis: DskAxis; metric: string };

export const DSK_AXES: Record<DskAxis, string> = { src: '媒体別', staff: '担当者別', cross: '担当者×媒体' };
export const DSK_NOSRC = '（未設定）';
export const DSK_NOSTAFF = '（未割当）';

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const LEAD_AFTER_CONNECT = ['通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_APPO = ['訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_VISIT = ['訪問査定済', '査定書提出', '媒介受託'];

/** アポの日付（以前のアプリの l.appt.date）。⚠️ Dashboard に列が無く、架電ナビが原本（raw_data）の appt に書く */
const apptDate = (l: Row): string => {
    const raw = l.raw_data;
    if (typeof raw !== 'string' || raw === '') return '';
    try {
        const p: unknown = JSON.parse(raw);
        const a = p !== null && typeof p === 'object' ? (p as { appt?: unknown }).appt : null;
        return a !== null && typeof a === 'object' ? str((a as { date?: unknown }).date) : '';
    } catch {
        return '';
    }
};

export type DskStep = { k: string; label: string; f?: (l: Row) => boolean };
export type DskRate = { k: string; label: string; a: string; b: string };
export type DskDef = { title: string; key: 'source' | 'portal'; keyLabel: string; csv: string; from: string; steps: DskStep[]; rates: DskRate[] };

/** 売りKPI・買いKPI の定義（DSK_KIND） */
export const DSK_KIND: Record<DskKind, DskDef> = {
    sell: {
        title: '📊 売りKPI', key: 'source', keyLabel: '反響媒体', csv: '売りKPI', from: '📨売り反響',
        steps: [
            { k: 'leads', label: '売却反響' },
            { k: 'connects', label: '通電', f: l => !!l.connectDate || LEAD_AFTER_CONNECT.includes(str(l.phase)) },
            { k: 'appos', label: '通電アポ', f: l => !!apptDate(l) || !!l.visitDate || LEAD_AFTER_APPO.includes(str(l.phase)) },
            { k: 'visits', label: '訪問査定', f: l => !!l.visitDate || LEAD_AFTER_VISIT.includes(str(l.phase)) },
            { k: 'wins', label: '受託', f: l => str(l.phase) === '媒介受託' },
        ],
        rates: [
            { k: 'r1', label: '通電率', a: 'connects', b: 'leads' },
            { k: 'r2', label: 'アポ率', a: 'appos', b: 'connects' },
            { k: 'r3', label: '通電査定率', a: 'visits', b: 'connects' },
            { k: 'r4', label: '査定受託率', a: 'wins', b: 'visits' },
        ],
    },
    buy: {
        title: '🏠 買いKPI', key: 'portal', keyLabel: 'ポータル', csv: '買いKPI', from: '🏠買い反響',
        steps: [
            { k: 'leads', label: '買い反響' },
            { k: 'connects', label: '通電', f: l => !!l.connectDate || ['通電済', '内見予約', '内見済', '購入申込', '成約'].includes(str(l.phase)) },
            { k: 'appos', label: '内見予約', f: l => !!l.viewDate || ['内見予約', '内見済', '購入申込', '成約'].includes(str(l.phase)) },
            { k: 'views', label: '内見', f: l => !!l.viewDate || ['内見済', '購入申込', '成約'].includes(str(l.phase)) },
            { k: 'offers', label: '購入申込', f: l => ['購入申込', '成約'].includes(str(l.phase)) },
            { k: 'wins', label: '成約', f: l => str(l.phase) === '成約' },
        ],
        rates: [
            { k: 'r1', label: '通電率', a: 'connects', b: 'leads' },
            { k: 'r2', label: '内見率', a: 'views', b: 'connects' },
            { k: 'r3', label: '申込率', a: 'offers', b: 'views' },
            { k: 'r4', label: '成約率', a: 'wins', b: 'offers' },
        ],
    },
};

/** 1行（媒体・担当・合計）。各段の件数は steps の k をキーに持つ */
export type DskRow = { name: string; counts: Record<string, number> };

/** その期間に入るか（dskPeriodHas）。'cum' は期首〜対象月 */
const dskPeriodHas = (p: string, tm: string, mk: string, fs: string | undefined): boolean => {
    if (p !== 'cum') return periodHas(p, mk, fs);
    if (!mk) return false;
    return mk >= fyStartOf(tm, fs) && mk <= tm;
};

/** 見出しの期間（dskLabel） */
export const dskLabel = (p: string, tm: string, fs: string | undefined): string =>
    p === 'cum' ? `${monthLabel(fyStartOf(tm, fs))}〜${monthLabel(tm)} 累計` : periodLabel(p);

/** 並び順：設定の順 → 設定にないもの → 未設定（dskRank） */
const dskRank = (list: string[], none: string) => (s: string): number =>
    s === none ? 1e6 : list.indexOf(s) < 0 ? 1e5 : list.indexOf(s);

const dskNew = (K: DskDef, name: string): DskRow => ({ name, counts: Object.fromEntries(K.steps.map(s => [s.k, 0])) });
const dskAdd = (K: DskDef, o: DskRow, l: Row): void => {
    o.counts.leads++;
    for (const s of K.steps) if (s.f && s.f(l)) o.counts[s.k]++;
};

export type DskAgg = {
    K: DskDef;
    list: DskRow[];
    T: DskRow;
    cross: Record<string, Record<string, DskRow>>;
    colList: string[];
    colT: Record<string, DskRow>;
};

/**
 * 期間・絞り込みに合う反響を、行キー（媒体 or 担当）ごと、クロス時は担当×媒体ごとに集計（dskAgg）。
 * order は設定の並び（売り sources・買い buyPortals）。担当者別・クロスは staffNames の行を0件でも出す。
 */
export const dskAgg = (kind: DskKind, rows: Row[], st: DskState, tm: string, fs: string | undefined, order: string[], staffNames: string[]): DskAgg => {
    const K = DSK_KIND[kind];
    const byRow: Record<string, DskRow> = {};
    const cross: Record<string, Record<string, DskRow>> = {};
    const cols = new Set<string>();
    const srcOf = (l: Row) => str(l[K.key]) || DSK_NOSRC;
    const staffOf = (l: Row) => str(l.staff) || DSK_NOSTAFF;
    const rowOf = st.axis === 'src' ? srcOf : staffOf;
    if (st.axis !== 'src') staffNames.forEach(n => { byRow[n] = dskNew(K, n); });
    for (const l of rows) {
        if (!dskPeriodHas(st.p, tm, recvMonthKey(l), fs)) continue;
        if (st.axis === 'src' && st.staff && (st.staff === '__none' ? !!l.staff : str(l.staff) !== st.staff)) continue;
        if (st.axis === 'staff' && st.src && srcOf(l) !== st.src) continue;
        const r = rowOf(l);
        dskAdd(K, (byRow[r] = byRow[r] ?? dskNew(K, r)), l);
        if (st.axis === 'cross') {
            const c = srcOf(l);
            cols.add(c);
            const x = (cross[r] = cross[r] ?? {});
            dskAdd(K, (x[c] = x[c] ?? dskNew(K, c)), l);
        }
    }
    const rank = st.axis === 'src' ? dskRank(order, DSK_NOSRC) : dskRank(staffNames, DSK_NOSTAFF);
    const list = Object.values(byRow).sort((a, b) => rank(a.name) - rank(b.name) || b.counts.leads - a.counts.leads);
    const T = dskNew(K, '合計');
    for (const o of list) for (const s of K.steps) T.counts[s.k] += o.counts[s.k];
    const cr = dskRank(order, DSK_NOSRC);
    const colList = [...cols].sort((a, b) => cr(a) - cr(b));
    const colT: Record<string, DskRow> = {};
    for (const c of colList) {
        colT[c] = dskNew(K, c);
        for (const r of Object.keys(cross)) {
            const v = cross[r][c];
            if (v) for (const s of K.steps) colT[c].counts[s.k] += v.counts[s.k];
        }
    }
    return { K, list, T, cross, colList, colT };
};

/** 率（funnelRate）。分母0は ― */
export const dskRate = (a: number, b: number): string => (b ? `${((a / b) * 100).toFixed(1)}%` : '―');

/** 率の色分け（dskRc）：チーム合計より5pt以上低いと 'low'、高いと 'high' */
export const dskTone = (o: DskRow, T: DskRow, r: DskRate): '' | 'low' | 'high' => {
    const b = o.counts[r.b], tb = T.counts[r.b];
    if (!b || !tb) return '';
    const d = o.counts[r.a] / b - T.counts[r.a] / tb;
    return d <= -0.05 ? 'low' : d >= 0.05 ? 'high' : '';
};

/** クロス表のセルの値（dskMetricVal）。率か件数 */
export const dskMetricVal = (K: DskDef, o: DskRow, mk: string): string => {
    const r = K.rates.find(x => x.k === mk);
    return r ? dskRate(o.counts[r.a], o.counts[r.b]) : String(o.counts[mk] ?? 0);
};

/**
 * CSV の中身とファイル名（dskCsv）。⚠️ クロス表は全指標を縦持ち（Excel のピボットでそのまま使える形）。
 * 率は分母0なら空欄。BOM は付けない（保存する側で付ける）
 */
export const dskCsv = (A: DskAgg, st: DskState, tm: string, fs: string | undefined): { text: string; fileName: string } => {
    const { K, list, T } = A;
    const r = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '');
    const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    const vals = (o: DskRow) => [...K.steps.map(s => o.counts[s.k]), ...K.rates.map(x => r(o.counts[x.a], o.counts[x.b]))];
    if (st.axis === 'cross') {
        lines.push(['担当者', K.keyLabel, ...K.steps.map(s => s.label), ...K.rates.map(x => x.label)].map(q).join(','));
        for (const o of list) for (const c of A.colList) {
            const v = A.cross[o.name]?.[c];
            if (v) lines.push([o.name, c, ...vals(v)].map(q).join(','));
        }
    } else {
        lines.push([st.axis === 'src' ? K.keyLabel : '担当者', ...K.steps.map(s => s.label), ...K.rates.map(x => x.label)].map(q).join(','));
        for (const o of [...list, T]) lines.push([o.name, ...vals(o)].map(q).join(','));
    }
    const short = (mk: string) => `${Number(mk.slice(5, 7))}月`;
    const sub = st.axis === 'src' && st.staff && st.staff !== '__none' ? `_${st.staff}` : st.axis === 'staff' && st.src ? `_${st.src}` : '';
    const per = st.p === 'cum' ? `${short(fyStartOf(tm, fs))}-${short(tm)}累計` : periodShort(st.p);
    return { text: lines.join('\r\n'), fileName: `${K.csv}_${DSK_AXES[st.axis]}_${per}${sub}.csv` };
};
```

### frontend/src/components/realty/summary/MediaKpiCard.tsx（新規）
```tsx
import React, { useMemo, useState } from 'react';
import { periodGroups } from '../common/leadFunnel';
import { todayStr } from './kpi';
import type { Row } from './kpi';
import { DSK_AXES, DSK_KIND, DSK_NOSRC, dskAgg, dskCsv, dskLabel, dskMetricVal, dskRate, dskTone } from './mediaKpi';
import type { DskAxis, DskKind, DskRow, DskState } from './mediaKpi';

/**
 * 売りKPI・買いKPI のカード（v2.2.254。以前のアプリ v14.30 の dashKpiCard）。チームサマリーの見出しの下に置く。
 * ⚠️ 表示の条件（軸・期間・絞り込み・指標）は端末ごと・保存しない（以前のアプリと同じ）。
 * ⚠️ 対象月（期間「期首〜対象月の累計」の終わり）は、チームサマリーで選んだ月。通期を選んでいるときは今月。
 */
type Props = {
    kind: DskKind;
    /** 売り反響（kind=sell）か買い反響（kind=buy）。削除済みは除いたもの */
    rows: Row[];
    /** 対象月（'YYYY-MM'） */
    targetMonth: string;
    fiscalStart: string | undefined;
    /** 設定の並び（売りは反響元 sources・買いはポータル buyPortals） */
    order: string[];
    /** 設定の担当者の氏名 */
    staffNames: string[];
};

const css = `
.mkpi_card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 4px rgba(0,0,0,.05);border:1px solid #e9ecef;margin-bottom:16px;min-width:1200px}
.mkpi_head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.mkpi_title{font-size:13px;font-weight:bold;color:#343a40;margin-right:4px}
.mkpi_sel{font-size:11px;padding:3px 6px;border:1px solid #ced4da;border-radius:4px;background:#fff;color:#343a40}
.mkpi_btn{margin-left:auto;font-size:11px;padding:3px 10px;border:1px solid #ced4da;border-radius:4px;background:#fff;cursor:pointer;color:#343a40}
.mkpi_btn:hover{background:#f1f3f5}
.mkpi_note{font-size:10px;color:#6c757d;margin-bottom:8px;line-height:1.6}
.mkpi_wrap{overflow-x:auto;border:1px solid #dee2e6;border-radius:4px}
.mkpi_tbl{width:100%;border-collapse:collapse}
.mkpi_tbl th{padding:6px 8px;font-size:11px;background:#f8f9fa;color:#495057;border-bottom:1px solid #dee2e6;white-space:nowrap;font-weight:bold;text-align:right;position:sticky;top:0}
.mkpi_tbl td{padding:6px 8px;font-size:11px;border-bottom:1px solid #dee2e6;text-align:right;font-variant-numeric:tabular-nums}
.mkpi_tbl th:first-child,.mkpi_tbl td:first-child{text-align:left;white-space:nowrap}
.mkpi_tbl td.mkpi_auto{background:#f8f9fa}
.mkpi_tbl tr.mkpi_total td{background:#f1f3f5;font-weight:bold}
.mkpi_tbl td.mkpi_empty{text-align:center;color:#6c757d}
.mkpi_high{color:#198754;font-weight:bold}
.mkpi_low{color:#dc3545;font-weight:bold}
.mkpi_small{font-size:10px;font-weight:normal;color:#6c757d}
.mkpi_foot{font-size:10px;color:#6c757d;margin-top:6px}
`;

const toneClass = (t: '' | 'low' | 'high') => (t === 'high' ? 'mkpi_high' : t === 'low' ? 'mkpi_low' : undefined);

const MediaKpiCard: React.FC<Props> = ({ kind, rows, targetMonth, fiscalStart, order, staffNames }) => {
    const K = DSK_KIND[kind];
    const [st, setSt] = useState<DskState>({ p: 'cum', staff: '', src: '', axis: 'src', metric: 'r1' });
    const set = (k: keyof DskState) => (e: React.ChangeEvent<HTMLSelectElement>) => setSt(v => ({ ...v, [k]: e.target.value }));
    const tm = /^\d{4}-\d{2}$/.test(targetMonth) ? targetMonth : todayStr().slice(0, 7);

    const A = useMemo(() => dskAgg(kind, rows, st, tm, fiscalStart, order, staffNames), [kind, rows, st, tm, fiscalStart, order, staffNames]);
    const groups = useMemo(() => periodGroups(fiscalStart, rows), [fiscalStart, rows]);
    const srcOptions = useMemo(() => [...new Set([...order, ...rows.map(l => String(l[K.key] ?? '') || DSK_NOSRC)])], [order, rows, K.key]);
    const label = dskLabel(st.p, tm, fiscalStart);
    const { list, T } = A;

    const downloadCsv = () => {
        const { text, fileName } = dskCsv(A, st, tm, fiscalStart);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' }));
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const rateDef = K.rates.map(r => (
        <React.Fragment key={r.k}>
            {r.k !== 'r1' && '／'}<b>{r.label}</b>＝{K.steps.find(s => s.k === r.a)?.label}÷{K.steps.find(s => s.k === r.b)?.label}
        </React.Fragment>
    ));
    const emptyMsg = `${label}に受信した反響はまだありません`;

    const renderCross = () => {
        const mr = K.rates.find(r => r.k === st.metric);
        const mLabel = mr ? mr.label : K.steps.find(s => s.k === st.metric)?.label ?? '';
        const cell = (v: DskRow | undefined, tot: DskRow, key: string) => {
            if (!v) return <td key={key}>―</td>;
            return (
                <td key={key} className={mr ? toneClass(dskTone(v, tot, mr)) : 'mkpi_auto'}
                    title={K.steps.map(s => `${s.label} ${v.counts[s.k]}`).join(' / ')}>
                    {dskMetricVal(K, v, st.metric)}
                </td>
            );
        };
        return (
            <>
                <div className="mkpi_wrap">
                    <table className="mkpi_tbl">
                        <thead>
                            <tr>
                                <th>担当者 ＼ {K.keyLabel}<div className="mkpi_small">（{mLabel}）</div></th>
                                {A.colList.map(c => <th key={c}>{c}</th>)}
                                <th>合計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!A.colList.length ? (
                                <tr><td colSpan={2} className="mkpi_empty">{emptyMsg}</td></tr>
                            ) : (
                                <>
                                    {list.map(o => (
                                        <tr key={o.name}>
                                            <td>{o.name}</td>
                                            {A.colList.map(c => cell(A.cross[o.name]?.[c], A.colT[c], c))}
                                            <td className={mr ? toneClass(dskTone(o, T, mr)) : undefined}><b>{dskMetricVal(K, o, st.metric)}</b></td>
                                        </tr>
                                    ))}
                                    <tr className="mkpi_total">
                                        <td>合計</td>
                                        {A.colList.map(c => <td key={c}>{dskMetricVal(K, A.colT[c], st.metric)}</td>)}
                                        <td>{dskMetricVal(K, T, st.metric)}</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mkpi_foot">率は同じ{K.keyLabel}のチーム合計と比べて色分けしています（担当者間の比較）。セルにマウスを乗せると各段の件数を表示します。</div>
            </>
        );
    };

    const renderFlat = () => {
        const tr = (o: DskRow, tot: boolean) => (
            <tr key={tot ? '__total' : o.name} className={tot ? 'mkpi_total' : undefined}>
                <td>{o.name}</td>
                {K.steps.map(s => <td key={s.k} className={tot ? undefined : 'mkpi_auto'}>{o.counts[s.k]}</td>)}
                {K.rates.map(r => <td key={r.k} className={tot ? undefined : toneClass(dskTone(o, T, r))}>{dskRate(o.counts[r.a], o.counts[r.b])}</td>)}
            </tr>
        );
        return (
            <div className="mkpi_wrap">
                <table className="mkpi_tbl">
                    <thead>
                        <tr>
                            <th>{st.axis === 'src' ? K.keyLabel : '担当者'}</th>
                            {K.steps.map(s => <th key={s.k}>{s.label}</th>)}
                            {K.rates.map(r => <th key={r.k}>{r.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {!T.counts.leads && !list.length
                            ? <tr><td colSpan={1 + K.steps.length + K.rates.length} className="mkpi_empty">{emptyMsg}</td></tr>
                            : <>{list.map(o => tr(o, false))}{tr(T, true)}</>}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="mkpi_card" data-kind={kind}>
            <style>{css}</style>
            <div className="mkpi_head">
                <span className="mkpi_title">{K.title} {DSK_AXES[st.axis]}（{label}）</span>
                <select className="mkpi_sel" value={st.axis} onChange={set('axis')} aria-label="集計の軸">
                    {(Object.keys(DSK_AXES) as DskAxis[]).map(k => <option key={k} value={k}>{DSK_AXES[k]}</option>)}
                </select>
                <select className="mkpi_sel" value={st.p} onChange={set('p')} aria-label="期間">
                    <option value="cum">期首〜対象月の累計</option>
                    {groups.map(g => (
                        <optgroup key={g.label} label={g.label}>
                            {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </optgroup>
                    ))}
                </select>
                {st.axis === 'src' && (
                    <select className="mkpi_sel" value={st.staff} onChange={set('staff')} aria-label="担当">
                        <option value="">担当：全員</option>
                        <option value="__none">未割当のみ</option>
                        {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                )}
                {st.axis === 'staff' && (
                    <select className="mkpi_sel" value={st.src} onChange={set('src')} aria-label={K.keyLabel}>
                        <option value="">{K.keyLabel}：すべて</option>
                        {srcOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                )}
                {st.axis === 'cross' && (
                    <select className="mkpi_sel" value={st.metric} onChange={set('metric')} aria-label="表示する指標">
                        <optgroup label="率">{K.rates.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}</optgroup>
                        <optgroup label="件数">{K.steps.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}</optgroup>
                    </select>
                )}
                <button type="button" className="mkpi_btn" onClick={downloadCsv} title="この表をCSVで保存">⬇ CSV</button>
            </div>
            <div className="mkpi_note">
                {K.from}から自動集計（受信月コホート基準）。{rateDef}。チーム合計より5pt以上<span className="mkpi_high">高い</span>・<span className="mkpi_low">低い</span>率を色分け。分母0は「―」。
            </div>
            {st.axis === 'cross' ? renderCross() : renderFlat()}
        </div>
    );
};

export default MediaKpiCard;
```

## git diff（既存ファイル）
```diff
diff --git a/backend/scripts/guide/articles/common/screen-240.md b/backend/scripts/guide/articles/common/screen-240.md
index 070465f3f..dd6b185ed 100644
--- a/backend/scripts/guide/articles/common/screen-240.md
+++ b/backend/scripts/guide/articles/common/screen-240.md
@@ -2,7 +2,7 @@
 title: チームサマリー（不動産企画係）
 section: 画面の使い方
 sort: 240
-summary: 以前のアプリの「ダッシュボード」と同じ画面。歩留まり・年間予算の進捗・担当者別のKPI（通期・月別）・架電実績・朝礼用アラート・営業司令塔。
+summary: 以前のアプリの「ダッシュボード」と同じ画面。売りKPI・買いKPI（媒体別・担当者別）・歩留まり・年間予算の進捗・担当者別のKPI（通期・月別）・架電実績・朝礼用アラート・営業司令塔。
 ---
 不動産企画係の画面の最初のページで、以前のアプリの「📊 ダッシュボード」と同じ画面です。事業を選ぶ画面で「不動産企画係」を押すと開きます（[[不動産企画係の画面（入口と権限）]]）。
 
@@ -10,6 +10,7 @@ summary: 以前のアプリの「ダッシュボード」と同じ画面。歩
 左上で選びます。開いたときは**通期**（今期の12か月。期首月は設定の値で、いまは6月はじまり）です。月ごとに見たいときは、同じところで**今期の月**を選びます。
 
 ## 上から順に（以前のアプリと同じ並び）
+- **売りKPI・買いKPI**：反響媒体（買いはポータル）ごとの歩留まりと移行率。下の「売りKPI・買いKPI」を見てください
 - **歩留まりファネル**：選んだ期間に受信した売り反響・買い反響が、どこまで進んだか（数え方は[[売り反響・買い反響の歩留まり（不動産企画係）]]）
 - **年間予算進捗**：期首から選んだ月までの**売上計上額の累計**を、担当者の年間予算の合計で割ったもの。経過月数に比べて遅れていれば赤、先行していれば緑です
   - 通期のときは、今期の12か月の合計です。先の月に契約日がある案件（契約予定）も入ります。遅れ・先行は、今月までの経過月数で比べます
@@ -21,6 +22,27 @@ summary: 以前のアプリの「ダッシュボード」と同じ画面。歩
 - **朝礼用アラート**：直近14日に商談リストへ登録された案件、新しく獲得した媒介、買取再販の期限・要対応（在庫日数・取得後2年・建物の按分）。14日を過ぎると自動で外れます
 - **営業司令塔**（最下段・押すと開く）：反響を点数で並べ、「今日やること」「ホットな反響」「停滞アラート」の3つのタブで出します。「自分の担当のみ」で絞れます。「開く」でその反響を直せます
 
+## 売りKPI・買いKPI
+売り反響は**反響媒体**（イエウール・すまいステップなど）、買い反響は**ポータル**（SUUMO・アットホームなど）ごとに、反響がどこまで進んだかと、段ごとの移行率を一覧にします。以前のアプリ（v14.30）の「売りKPI」「買いKPI」と同じ数え方です。
+- 売り：売却反響 → 通電 → 通電アポ → 訪問査定 → 受託
+  - 通電率＝通電÷売却反響、アポ率＝通電アポ÷通電、通電査定率＝訪問査定÷通電、査定受託率＝受託÷訪問査定
+  - 通電アポは、架電ナビでアポを取った反響・訪問査定の日が入っている反響・フェーズが訪問査定予定より先の反響です
+- 買い：買い反響 → 通電 → 内見予約 → 内見 → 購入申込 → 成約
+  - 通電率＝通電÷買い反響、内見率＝内見÷通電、申込率＝購入申込÷内見、成約率＝成約÷購入申込
+- 数え方は歩留まりファネルと同じで、**その期間に受信した反響**が、いまどこまで進んでいるかです
+
+カードの上の選択で、見方を変えられます（選んだ見方は保存されません。開き直すと元に戻ります）。
+- **集計の軸**：媒体別（はじめはこれ）・担当者別・担当者×媒体
+  - 担当者別は、設定の担当者を、反響が0件でも出します
+  - 担当者×媒体は、担当者を縦、媒体を横に並べた表です。表示する指標（各率か、各段の件数）を選べます。数字にマウスを乗せると、各段の件数が出ます
+- **期間**：はじめは「期首〜対象月の累計」です。対象月は、左上で選んだ月です（通期を選んでいるときは今月）。ほかに、今期の各月・期ごとの通期・過去すべてを選べます
+- **絞り込み**：媒体別のときは担当（全員・未割当のみ・各担当）、担当者別のときは媒体で絞れます
+- 率は、チーム合計より5ポイント以上**高いと緑**、**低いと赤**にします（担当者×媒体の表では、同じ媒体のチーム合計と比べます）。分母が0のときは「―」です
+- 媒体が空の反響は「（未設定）」、担当が空の反響は「（未割当）」の行にまとめて、最後に出します。媒体の並びは設定の反響元・買いポータルの順です
+- 「⬇ CSV」で、いま出ている表を保存できます。担当者×媒体の表は、担当者・媒体・各段の件数・各率を1行ずつ並べた形で保存するので、Excel のピボットテーブルにそのまま使えます
+
+> 注意：反響媒体の書き方が違うと、別の媒体として数えます（たとえば「HOME's」と「HOME'S」）。分かれていたら、売り反響・買い反響の画面で反響元をそろえてください。
+
 ## 売上の数え方
 - **売上計上額 ＝ 仲介手数料 ＋ リフォーム粗利**。リフォームの受注額は売上に入れず、参考として出します
 - 商談案件の**契約日の月**で数えます。失注した案件は数えません
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index fc133649d..83d47e00d 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -19,6 +19,8 @@ import { useNavigate } from 'react-router-dom';
 import CommandCenter from './CommandCenter';
 import { resaleDashAlerts } from './resaleAlerts';
 import { loadRecords } from '../common/realtyState';
+// ⚠️ v2.2.254: 売りKPI・買いKPI（以前のアプリ v14.30 の媒体別KPI）
+import MediaKpiCard from './MediaKpiCard';
 
 // ==========================================
 // 💡 型定義 (推論ベース)
@@ -351,6 +353,19 @@ const Summary = () => {
 
     const headerLabel = { title: 'チームサマリー', describe: '本日のタスク、追客予定、月次KPI、架電実績' };
 
+    /** ⚠️ v2.2.254: 売りKPI・買いKPI の並び（設定の反響元・買いポータル）・担当者（設定の氏名）・対象月 */
+    const mediaKpi = useMemo(() => {
+        const st = settings as Settings & { sources?: unknown; buyPortals?: unknown };
+        const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
+        return {
+            sources: list(st.sources),
+            buyPortals: list(st.buyPortals),
+            staffNames: (settings.staff ?? []).map(x => String(x.name ?? '')).filter(Boolean),
+            // 対象月（累計の終わり）。通期のときは今月
+            month: isFy ? todayStr().slice(0, 7) : selectedMonth,
+        };
+    }, [settings, isFy, selectedMonth]);
+
     /**
      * 📊 年間予算進捗・月次KPIサマリー（v2.2.222。本番アプリの renderDash と同じ集計）。
      *   売上計上額＝仲介手数料＋リフォーム粗利。商談案件の契約日ベース・共同担当は按分。
@@ -526,6 +541,15 @@ const Summary = () => {
 
             {!isLoading && (
                 <div>
+                    {/* ==========================================
+                        📊 1. 売りKPI・買いKPI（v2.2.254。以前のアプリと同じく見出しのすぐ下。summary/MediaKpiCard.tsx）
+                        ⚠️ 対象月は上で選んだ月。通期のときは今月
+                    ========================================== */}
+                    <MediaKpiCard kind="sell" rows={leads as unknown as Row[]} targetMonth={mediaKpi.month}
+                        fiscalStart={settings.fiscalStart} order={mediaKpi.sources} staffNames={mediaKpi.staffNames} />
+                    <MediaKpiCard kind="buy" rows={buyLeads as unknown as Row[]} targetMonth={mediaKpi.month}
+                        fiscalStart={settings.fiscalStart} order={mediaKpi.buyPortals} staffNames={mediaKpi.staffNames} />
+
                     {/* ==========================================
                         🔻 2. 歩留まりファネル
                     ========================================== */}
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 81928e53d..eeaf58dcf 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.253';
+export const newVersion = '2.2.254';
```
