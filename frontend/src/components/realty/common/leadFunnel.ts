/**
 * 売り反響・買い反響の画面の歩留まり（v2.2.225）。
 *
 * ⚠️ 移植元は本番の不動産企画係アプリ（V18）の renderLeads / renderBuyLeads と、その下で使う関数。
 *   **数字が以前のアプリと一致するよう、定義をそのまま写している**（括弧の中は移植元の名前）。
 *   ⚠️ 2026-10-28 の指示: 明日から不動産企画係が使い始めるので、歩留まりのぶれやルールの変更があると困る。realty はアプリケーション（以前のアプリ）が最優先
 *
 * 期間（P）: 'm:YYYY-MM'（単月）・'fy:YYYY-MM'（通期。期首月）・'all'（全期間）
 * 受信月コホート基準（その期間に受信した反響が、どこまで進んだか）。架電だけは「その期間にした架電」（📞のみ）。
 */
import { callStats, callsOf, fiscalMonths, monthLabel, todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';

export type Period = string;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 受信月（recvMonthKey）。'YYYY-MM' でなければ空 */
export const recvMonthKey = (l: Row): string => {
    const mk = str(l.receivedDate).slice(0, 7);
    return /^\d{4}-\d{2}$/.test(mk) ? mk : '';
};

/** その年月が属する期の期首月（fyStartOf）。⚠️ 期首月の月だけを設定から使う */
export const fyStartOf = (mk: string, fiscalStart: string | undefined): string => {
    const fs = Number(str(fiscalStart || '2026-06').slice(5, 7)) || 4;
    const [y, m] = mk.split('-').map(Number);
    return `${m >= fs ? y : y - 1}-${String(fs).padStart(2, '0')}`;
};

/** その期間に入るか（periodHas） */
export const periodHas = (p: Period, mk: string, fiscalStart: string | undefined): boolean => {
    if (!mk) return false;
    if (p === 'all') return true;
    if (p.startsWith('m:')) return mk === p.slice(2);
    if (p.startsWith('fy:')) return fyStartOf(mk, fiscalStart) === p.slice(3);
    return false;
};

/** 'YYYY年度（YYYY/M〜YYYY/M）'（fyLabel） */
const fyLabel = (start: string): string => {
    const [y, m] = start.split('-').map(Number);
    const e = fiscalMonths(start)[11];
    return `${y}年度（${y}/${m}〜${Number(e.slice(0, 4))}/${Number(e.slice(5, 7))}）`;
};

/** 見出し（periodLabel） */
export const periodLabel = (p: Period): string => {
    if (p === 'all') return '全期間（過去すべて）';
    if (p.startsWith('m:')) return monthLabel(p.slice(2));
    return `${fyLabel(p.slice(3))}通期`;
};

/** タイル用の短い見出し（periodShort） */
export const periodShort = (p: Period): string => {
    if (p === 'all') return '全期間';
    if (p.startsWith('m:')) return `${Number(p.slice(7, 9))}月`;
    return `${p.slice(3, 7)}年度通期`;
};

export type PeriodGroup = { label: string; options: { value: string; label: string }[] };

/** 期間の選択肢（periodSelHtml）: 月別（今期）／通期（期ごと）／全期間 */
export const periodGroups = (fiscalStart: string | undefined, rows: Row[]): PeriodGroup[] => {
    const months = fiscalMonths(fiscalStart);
    const fys = new Set([fyStartOf(months[0], fiscalStart)]);
    for (const l of rows) {
        const mk = recvMonthKey(l);
        if (mk) fys.add(fyStartOf(mk, fiscalStart));
    }
    return [
        { label: '月別（今期）', options: months.map(mk => ({ value: `m:${mk}`, label: monthLabel(mk) })) },
        { label: '通期（期ごと）', options: [...fys].sort().reverse().map(f => ({ value: `fy:${f}`, label: `${fyLabel(f)}通期` })) },
        { label: '全期間', options: [{ value: 'all', label: '過去すべて（全通期合計）' }] },
    ];
};

/** 既定の期間: 今月（今期に無ければ期首月） */
export const defaultPeriod = (fiscalStart: string | undefined): Period => {
    const months = fiscalMonths(fiscalStart);
    const cur = todayStr().slice(0, 7);
    return `m:${months.includes(cur) ? cur : months[0]}`;
};

/** 架電の種類（callType）。⚠️ type が無い・知らない値は「架電」 */
const callType = (c: unknown): 'call' | 'line' | 'mail' => {
    const t = c !== null && typeof c === 'object' ? str((c as { type?: unknown }).type) : '';
    return t === 'line' || t === 'mail' ? t : 'call';
};
const callDay = (c: unknown): string =>
    (c !== null && typeof c === 'object' ? str((c as { date?: unknown }).date) : str(c)).slice(0, 10);

/** 一覧の「架電」の数（actCounts(l).call）。⚠️ type の無い記録も架電に数える */
export const callCountOf = (l: Row): number => callsOf(l).filter(c => callType(c) === 'call').length;

/** その期間にした架電・LINE・メール（leadKpi / buyKpi の acts） */
const actsIn = (rows: Row[], p: Period, fs: string | undefined) => {
    const acts = { call: 0, line: 0, mail: 0 };
    for (const l of rows) for (const c of callsOf(l)) if (periodHas(p, callDay(c).slice(0, 7), fs)) acts[callType(c)]++;
    return acts;
};

// ---------------------------------------------------------------------------
// 売り反響
// ---------------------------------------------------------------------------

const LEAD_AFTER_CONNECT = ['通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_VISIT = ['訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_PROPOSAL = ['査定書提出', '媒介受託'];
const sellConnected = (l: Row) => !!l.connectDate || LEAD_AFTER_CONNECT.includes(str(l.phase));
const sellVisited = (l: Row) => !!l.visitDate || LEAD_AFTER_VISIT.includes(str(l.phase));
const sellProposed = (l: Row) => LEAD_AFTER_PROPOSAL.includes(str(l.phase));
const sellWon = (l: Row) => str(l.phase) === '媒介受託';

export type SellKpi = { leads: number; calls: number; acts: { call: number; line: number; mail: number }; connects: number; visits: number; props: number; wins: number };

/** 上のタイル（leadKpi） */
export const sellKpi = (leads: Row[], p: Period, fs: string | undefined): SellKpi => {
    const ls = leads.filter(l => periodHas(p, recvMonthKey(l), fs));
    const acts = actsIn(leads, p, fs);
    return {
        leads: ls.length, calls: acts.call, acts,
        connects: ls.filter(sellConnected).length,
        visits: ls.filter(sellVisited).length,
        props: ls.filter(sellProposed).length,
        wins: ls.filter(sellWon).length,
    };
};

export type SourceRow = { name: string; leads: number; connects: number; visits: number; wins: number; unit: number; cost: number };

/** 反響元別ファネル（renderLeads の bySrc）。反響の多い順 */
export const sellSourceFunnel = (leads: Row[], p: Period, fs: string | undefined, costs: Record<string, number> | undefined): SourceRow[] => {
    const by: Record<string, SourceRow> = {};
    for (const l of leads.filter(x => periodHas(p, recvMonthKey(x), fs))) {
        const s = str(l.source) || '（未設定）';
        const unit = Number(costs?.[s]) || 0;
        const o = (by[s] = by[s] ?? { name: s, leads: 0, connects: 0, visits: 0, wins: 0, unit, cost: 0 });
        o.leads++;
        if (sellConnected(l)) o.connects++;
        if (sellVisited(l)) o.visits++;
        if (sellWon(l)) o.wins++;
    }
    return Object.values(by).map(o => ({ ...o, cost: o.leads * o.unit })).sort((a, b) => b.leads - a.leads);
};

export type SellStaffRow = { name: string; leads: number; calls: number; connects: number; visits: number; props: number; wins: number };

/** 担当者別ファネル（leadStaffFunnel）。⚠️ 架電はその期間にした📞を、反響の担当者で数える */
export const sellStaffFunnel = (leads: Row[], p: Period, fs: string | undefined, staffNames: string[]): SellStaffRow[] => {
    const rows: Record<string, SellStaffRow> = {};
    const get = (n: string) => (rows[n] = rows[n] ?? { name: n, leads: 0, calls: 0, connects: 0, visits: 0, props: 0, wins: 0 });
    staffNames.forEach(get);
    for (const l of leads) {
        const nm = str(l.staff) || '（未割当）';
        for (const c of callsOf(l)) if (callType(c) === 'call' && periodHas(p, callDay(c).slice(0, 7), fs)) get(nm).calls++;
        if (!periodHas(p, recvMonthKey(l), fs)) continue;
        const o = get(nm);
        o.leads++;
        if (sellConnected(l)) o.connects++;
        if (sellVisited(l)) o.visits++;
        if (sellProposed(l)) o.props++;
        if (sellWon(l)) o.wins++;
    }
    return Object.values(rows).filter(o => o.leads || o.calls || staffNames.includes(o.name));
};

// ---------------------------------------------------------------------------
// 買い反響
// ---------------------------------------------------------------------------

const buyConnected = (l: Row) => !!l.connectDate || ['通電済', '内見予約', '内見済', '購入申込', '成約'].includes(str(l.phase));
const buyViewed = (l: Row) => !!l.viewDate || ['内見済', '購入申込', '成約'].includes(str(l.phase));
const buyOffered = (l: Row) => ['購入申込', '成約'].includes(str(l.phase));
const buyWon = (l: Row) => str(l.phase) === '成約';

export type BuyKpi = { leads: number; calls: number; acts: { call: number; line: number; mail: number }; connects: number; views: number; offers: number; wins: number };

/** 上のタイル（buyKpi） */
export const buyKpi = (buyLeads: Row[], p: Period, fs: string | undefined): BuyKpi => {
    const ls = buyLeads.filter(l => periodHas(p, recvMonthKey(l), fs));
    const acts = actsIn(buyLeads, p, fs);
    return {
        leads: ls.length, calls: acts.call, acts,
        connects: ls.filter(buyConnected).length,
        views: ls.filter(buyViewed).length,
        offers: ls.filter(buyOffered).length,
        wins: ls.filter(buyWon).length,
    };
};

export type PortalRow = { name: string; leads: number; connects: number; views: number; offers: number; unit: number; cost: number };

/** ポータル別ファネル（renderBuyLeads の byP）。反響の多い順 */
export const buyPortalFunnel = (buyLeads: Row[], p: Period, fs: string | undefined, costs: Record<string, number> | undefined): PortalRow[] => {
    const by: Record<string, PortalRow> = {};
    for (const l of buyLeads.filter(x => periodHas(p, recvMonthKey(x), fs))) {
        const s = str(l.portal) || '（未設定）';
        const unit = Number(costs?.[s]) || 0;
        const o = (by[s] = by[s] ?? { name: s, leads: 0, connects: 0, views: 0, offers: 0, unit, cost: 0 });
        o.leads++;
        if (buyConnected(l)) o.connects++;
        if (buyViewed(l)) o.views++;
        if (buyOffered(l)) o.offers++;
    }
    return Object.values(by).map(o => ({ ...o, cost: o.leads * o.unit })).sort((a, b) => b.leads - a.leads);
};

export type BuyStaffRow = { name: string; leads: number; calls: number; connects: number; views: number; offers: number; wins: number };

/** 担当者別ファネル（buyStaffFunnel） */
export const buyStaffFunnel = (buyLeads: Row[], p: Period, fs: string | undefined, staffNames: string[]): BuyStaffRow[] => {
    const rows: Record<string, BuyStaffRow> = {};
    const get = (n: string) => (rows[n] = rows[n] ?? { name: n, leads: 0, calls: 0, connects: 0, views: 0, offers: 0, wins: 0 });
    staffNames.forEach(get);
    for (const l of buyLeads) {
        const nm = str(l.staff) || '（未割当）';
        for (const c of callsOf(l)) if (callType(c) === 'call' && periodHas(p, callDay(c).slice(0, 7), fs)) get(nm).calls++;
        if (!periodHas(p, recvMonthKey(l), fs)) continue;
        const o = get(nm);
        o.leads++;
        if (buyConnected(l)) o.connects++;
        if (buyViewed(l)) o.views++;
        if (buyOffered(l)) o.offers++;
        if (buyWon(l)) o.wins++;
    }
    return Object.values(rows).filter(o => o.leads || o.calls || staffNames.includes(o.name));
};

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

/** チームの本日・今週の架電（teamCalls）。kind = s（売り）／ b（買い） */
export const teamCalls = (sellLeads: Row[], buyLeads: Row[]) => {
    const cs = callStats(sellLeads, buyLeads);
    const sum = (bucket: 'day' | 'week') => {
        let s = 0, b = 0;
        for (const k of Object.keys(cs.out)) { s += cs.out[k][bucket].s; b += cs.out[k][bucket].b; }
        return { s, b };
    };
    return { day: sum('day'), week: sum('week') };
};

/** 率（funnelRate）。分母が0なら ― */
export const rate = (a: number, b: number): string => (b ? `${((a / b) * 100).toFixed(1)}%` : '―');
