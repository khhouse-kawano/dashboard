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
