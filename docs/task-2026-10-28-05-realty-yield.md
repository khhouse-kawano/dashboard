# 2026-10-28 不動産企画係: 歩留まりを以前のアプリと同じに・取り込みの全面差し替え（v2.2.225）

## 依頼
- 「v2.2.224 はすでにデプロイしているので新しいブランチ（v2.2.225）で修正を反映させて」
- 「2で進める」（売り反響・買い反響の画面の歩留まりを以前のアプリの数え方に合わせる）
- 「既存の brokerage_listings テーブルはないものとして考えてよい」
- 「明日から不動産企画係が使い始めるので歩留まりのぶれやルールの変更があると困惑する」「realty ディレクトリはアプリケーション最優先」
- 途中（次の版で対応）: 旧アプリのダッシュボード → チームサマリー、その他は旧アプリのメニューをそのまま移行（月次売上管理・月次媒介管理・失注・他決の分析・今日の架電キュー・架電ナビなど）、メニューの見出し（日々の行動・集計・分析・入力・台帳）も出す、UI のトンマナだけ Dashboard に寄せる

## 決めたこと
- 売り反響・買い反響の画面の上の部分（タイル5つ・反響元別／ポータル別ファネル・担当者別ファネル）を、以前のアプリの renderLeads / renderBuyLeads と同じ計算・同じ列にした（common/leadFunnel.ts・LeadFunnelPanel.tsx）
  - 以前の Dashboard の定義（通電＝段階が訪問査定以降か contactDate がその月、受託に contractDate の月も、架電はその月に受信した反響の全架電、買いは「内見済み」）はすべてやめた
  - 期間は以前のアプリと同じ「月別（今期）／通期（期ごと）／全期間」（LeadHeader に periodGroups を足した）。既定は今月（今期に無ければ期首月）
  - 一覧の「架電」の数も、type の無い記録を架電に数える（以前のアプリの actCounts）
- チームサマリーの一括査定KPI・買い反響KPIを以前のアプリと同じ列にした（前月比のマイナスも表示）
- 取り込みに**全面差し替え**（hideScope = all）。ファイルに無い表示中の行はすべて非表示（deleted_by = '以前のアプリに無い行'）。画面の既定
- `planner:lead` が settings も返す（② と ① の planner_lead.php）
- v2.2.224 のマージに入っていなかった販売報告の取り込みの直し（7c180a57）を cherry-pick
- 営業司令塔（以前のアプリは点数で並べる別の仕組み V12）は、メニューの移植の段で丸ごと移す

## 確認したこと
- ローカルに今日のバックアップ（2637件）を全面差し替えで取り込み（非表示118件。Dashboard だけの売り47・買い62・変更履歴7・通知2）
- 画面（Playwright）と以前のアプリのコード（V18 のまま。バックアップに当てた）を突き合わせ: **58項目すべて一致**
  - 売り反響・買い反響 × 期間8つ（2026年6〜10月・2026年度通期・2025年度通期・全期間）× タイル・反響元別・担当者別
  - チームサマリー 2026年6〜10月 × 一括査定KPI・買い反響KPI（全列）
  - ⚠️ 反響元別で件数が同じ行の並びは比べていない（以前のアプリも Supabase から取った順のままで決まっていない）
- 既定の期間が今月（m:2026-10）・ページのエラー無し
- 型チェック（②）・本番ビルド（フロント）・php -l

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/realty/common | **leadFunnel.ts（新規）** | 以前のアプリの leadKpi / buyKpi / leadStaffFunnel / buyStaffFunnel / 反響元別・ポータル別 / periodHas / fyStartOf / periodSelHtml など |
| frontend/src/components/realty/common | **LeadFunnelPanel.tsx（新規）** | タイル・反響元別（ポータル別）・担当者別の3つ |
| frontend/src/components/realty/common | LeadHeader.tsx | periodGroups（期間のグループ選択） |
| frontend/src/components/realty/sell・buy | LeadSell.tsx・LeadBuy.tsx | 古い集計（PeriodSummary・is〜・sourceSummary/portalSummary・staffSummary・calcRate・getThisWeekDates）を外し、LeadFunnelPanel・期間・設定につないだ |
| frontend/src/components/realty/summary | Summary.tsx | KPI 表を以前のアプリの列に。使わなくなった formatYen を削除 |
| frontend/src/components/realty/settings | RealtyImport.tsx | 非表示の範囲（全面差し替え／以前のアプリで消えた行だけ）。範囲を変えたら下見をやり直す |
| backend-express/src/features/realty | index.ts | readSettings を共通化、runPlannerLead が settings も返す |
| backend-express/src/features/realty | importer.ts | HideScope・NOT_IN_APP・JSON_COLUMNS（cherry-pick） |
| backend/src/handlers/plannerAction | planner_lead.php | settings も返す |
| backend/scripts/sql | 2026-10-28_realty_import_2_check.sql | 「うち以前のアプリに無い行」 |
| backend/scripts/sql | 2026-10-28_update_log_2.2.225.sql（新規） | 更新履歴＋記事2本。ローカルに流した（no=325） |
| backend/scripts/guide/articles/common | screen-245.md（新規）・screen-270.md | 記事 |

## コード

### frontend/src/components/realty/common/leadFunnel.ts（新規・全文）
```tsx
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
```

### frontend/src/components/realty/common/LeadFunnelPanel.tsx（新規・全文）
```tsx
import React, { useMemo } from 'react';
import {
    buyKpi, buyPortalFunnel, buyStaffFunnel, periodLabel, periodShort, rate, sellKpi, sellSourceFunnel, sellStaffFunnel, teamCalls,
} from './leadFunnel';
import type { Period } from './leadFunnel';
import { fmtYen, fmtYen0 } from '../summary/kpi';
import type { Row, Settings } from '../summary/kpi';

/**
 * 売り反響・買い反響の画面の上の部分（v2.2.225）: タイル5つ・反響元別（ポータル別）ファネル・担当者別ファネル。
 *
 * ⚠️ 移植元は本番アプリ（V18）の renderLeads / renderBuyLeads の上半分。列・率の分母・見出しを同じにしている。
 *   計算は leadFunnel.ts（以前のアプリの関数のまま）。
 */

type Props = {
    kind: 'sell' | 'buy';
    /** その画面の反響（削除済みは除いたもの） */
    rows: Row[];
    period: Period;
    settings: Settings & { srcCosts?: Record<string, number>; portalCosts?: Record<string, number> };
};

const STYLE = `
.rlt-fn-tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.rlt-fn-tile { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 4px rgba(0,0,0,.05); }
.rlt-fn-tile .lbl { font-size: 11px; color: #6c757d; font-weight: bold; }
.rlt-fn-tile .val { font-size: 24px; font-weight: bold; color: #212529; font-variant-numeric: tabular-nums; }
.rlt-fn-tile .val.green { color: #198754; }
.rlt-fn-tile .sub { font-size: 10px; color: #6c757d; margin-top: 2px; line-height: 1.5; }
.rlt-fn-card { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.rlt-fn-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; padding: 10px 14px 6px; }
.rlt-fn-head h3 { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; }
.rlt-fn-head .note { font-size: 10px; color: #6c757d; }
.rlt-fn-wrap { overflow-x: auto; }
.rlt-fn-tbl { width: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
.rlt-fn-tbl th { background: #f8f9fa; color: #495057; font-weight: bold; padding: 6px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; }
.rlt-fn-tbl td { padding: 4px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; }
.rlt-fn-tbl .r { text-align: right; }
.rlt-fn-tbl td.auto { background: #f3faf5; }
.rlt-fn-tbl tr.total td { font-weight: bold; background: #f1f3f5; }
.rlt-fn-tbl td.empty { text-align: center; color: #6c757d; padding: 12px; }
`;

const LeadFunnelPanel: React.FC<Props> = ({ kind, rows, period, settings }) => {
    const fs = settings.fiscalStart;
    const staffNames = useMemo(() => (settings.staff ?? []).map(s => String(s.name ?? '').trim()).filter(Boolean), [settings.staff]);
    const tc = useMemo(() => (kind === 'sell' ? teamCalls(rows, []) : teamCalls([], rows)), [kind, rows]);
    const ps = periodShort(period);
    const pl = periodLabel(period);

    if (kind === 'sell') {
        const k = sellKpi(rows, period, fs);
        const src = sellSourceFunnel(rows, period, fs, settings.srcCosts);
        const st = sellStaffFunnel(rows, period, fs, staffNames);
        const TT = src.reduce((t, o) => ({ leads: t.leads + o.leads, connects: t.connects + o.connects, visits: t.visits + o.visits, wins: t.wins + o.wins, cost: t.cost + o.cost }), { leads: 0, connects: 0, visits: 0, wins: 0, cost: 0 });
        const T = st.reduce((t, o) => ({ leads: t.leads + o.leads, calls: t.calls + o.calls, connects: t.connects + o.connects, visits: t.visits + o.visits, props: t.props + o.props, wins: t.wins + o.wins }), { leads: 0, calls: 0, connects: 0, visits: 0, props: 0, wins: 0 });
        return (
            <>
                <style>{STYLE}</style>
                <div className="rlt-fn-tiles">
                    <div className="rlt-fn-tile"><div className="lbl">{ps}受信リード</div><div className="val">{k.leads}</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">架電数(延べ・{ps})</div><div className="val">{k.calls}</div>
                        <div className="sub">本日 {tc.day.s}件／今週 {tc.week.s}件（チーム）<br />💬LINE {k.acts.line}件／✉️メール {k.acts.mail}件</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">通電</div><div className="val">{k.connects}</div><div className="sub">通電率 {rate(k.connects, k.leads)}</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">訪問査定</div><div className="val">{k.visits}</div><div className="sub">獲得率 {rate(k.visits, k.leads)}／査定書提出 {k.props}件</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">媒介受託</div><div className="val green">{k.wins}</div><div className="sub">受託率 {rate(k.wins, k.leads)}（査定比 {rate(k.wins, k.visits)}）</div></div>
                </div>

                <div className="rlt-fn-card">
                    <div className="rlt-fn-head"><h3>反響元別ファネル（受信分・自動集計／{pl}）</h3><span className="note">上部の「対象期間」で切り替わります（単月・通期・全期間）</span></div>
                    <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                        <th>反響元</th><th className="r">リード</th><th className="r">通電</th><th className="r">通電率</th><th className="r">訪問査定</th><th className="r">査定率</th>
                        <th className="r">媒介受託</th><th className="r">受託率(リード比)</th><th className="r">受託率(査定比)</th><th className="r">反響単価</th><th className="r">反響費用</th><th className="r">媒介獲得単価</th>
                    </tr></thead><tbody>
                        {src.length === 0 && <tr><td colSpan={12} className="empty">{pl}に受信したリードはまだありません</td></tr>}
                        {src.map(o => (
                            <tr key={o.name}>
                                <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                                <td className="r auto">{o.visits}</td><td className="r auto">{rate(o.visits, o.leads)}</td><td className="r auto">{o.wins}</td>
                                <td className="r auto">{rate(o.wins, o.leads)}</td><td className="r auto">{rate(o.wins, o.visits)}</td>
                                <td className="r">{o.unit ? fmtYen(o.unit) : '―'}</td><td className="r auto">{fmtYen0(o.cost)}</td>
                                <td className="r auto">{o.wins && o.cost ? fmtYen(Math.round(o.cost / o.wins)) : '―'}</td>
                            </tr>
                        ))}
                        {src.length > 0 && (
                            <tr className="total">
                                <td>合計</td><td className="r">{TT.leads}</td><td className="r">{TT.connects}</td><td className="r">{rate(TT.connects, TT.leads)}</td>
                                <td className="r">{TT.visits}</td><td className="r">{rate(TT.visits, TT.leads)}</td><td className="r">{TT.wins}</td>
                                <td className="r">{rate(TT.wins, TT.leads)}</td><td className="r">{rate(TT.wins, TT.visits)}</td><td className="r"></td>
                                <td className="r">{fmtYen0(TT.cost)}</td><td className="r">{TT.wins && TT.cost ? fmtYen(Math.round(TT.cost / TT.wins)) : '―'}</td>
                            </tr>
                        )}
                    </tbody></table></div>
                </div>

                <div className="rlt-fn-card">
                    <div className="rlt-fn-head"><h3>担当者別ファネル（受信分・自動集計／{pl}）</h3><span className="note">受信月コホート基準。架電数のみ対象期間の実施日ベース（📞のみ・リード担当者基準）</span></div>
                    <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                        <th>担当者</th><th className="r">リード</th><th className="r">架電</th><th className="r">通電</th><th className="r">通電率</th><th className="r">訪問査定</th><th className="r">査定率</th>
                        <th className="r">査定書提出</th><th className="r">媒介受託</th><th className="r">受託率(リード比)</th><th className="r">受託率(査定比)</th>
                    </tr></thead><tbody>
                        {st.length === 0 && <tr><td colSpan={11} className="empty">担当者が登録されていません</td></tr>}
                        {st.map(o => (
                            <tr key={o.name}>
                                <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.calls}</td>
                                <td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                                <td className="r auto">{o.visits}</td><td className="r auto">{rate(o.visits, o.leads)}</td>
                                <td className="r auto">{o.props}</td><td className="r auto">{o.wins}</td>
                                <td className="r auto">{rate(o.wins, o.leads)}</td><td className="r auto">{rate(o.wins, o.visits)}</td>
                            </tr>
                        ))}
                        {st.length > 0 && (
                            <tr className="total">
                                <td>チーム合計</td><td className="r">{T.leads}</td><td className="r">{T.calls}</td><td className="r">{T.connects}</td><td className="r">{rate(T.connects, T.leads)}</td>
                                <td className="r">{T.visits}</td><td className="r">{rate(T.visits, T.leads)}</td><td className="r">{T.props}</td><td className="r">{T.wins}</td>
                                <td className="r">{rate(T.wins, T.leads)}</td><td className="r">{rate(T.wins, T.visits)}</td>
                            </tr>
                        )}
                    </tbody></table></div>
                </div>
            </>
        );
    }

    const k = buyKpi(rows, period, fs);
    const pf = buyPortalFunnel(rows, period, fs, settings.portalCosts);
    const st = buyStaffFunnel(rows, period, fs, staffNames);
    const TT = pf.reduce((t, o) => ({ leads: t.leads + o.leads, connects: t.connects + o.connects, views: t.views + o.views, offers: t.offers + o.offers, cost: t.cost + o.cost }), { leads: 0, connects: 0, views: 0, offers: 0, cost: 0 });
    const T = st.reduce((t, o) => ({ leads: t.leads + o.leads, calls: t.calls + o.calls, connects: t.connects + o.connects, views: t.views + o.views, offers: t.offers + o.offers, wins: t.wins + o.wins }), { leads: 0, calls: 0, connects: 0, views: 0, offers: 0, wins: 0 });
    return (
        <>
            <style>{STYLE}</style>
            <div className="rlt-fn-tiles">
                <div className="rlt-fn-tile"><div className="lbl">{ps}反響受信</div><div className="val">{k.leads}</div></div>
                <div className="rlt-fn-tile"><div className="lbl">架電数(延べ・{ps})</div><div className="val">{k.calls}</div>
                    <div className="sub">本日 {tc.day.b}件／今週 {tc.week.b}件（チーム）<br />💬LINE {k.acts.line}件／✉️メール {k.acts.mail}件</div></div>
                <div className="rlt-fn-tile"><div className="lbl">通電</div><div className="val">{k.connects}</div><div className="sub">通電率 {rate(k.connects, k.leads)}</div></div>
                <div className="rlt-fn-tile"><div className="lbl">内見</div><div className="val">{k.views}</div><div className="sub">内見率 {rate(k.views, k.leads)}</div></div>
                <div className="rlt-fn-tile"><div className="lbl">購入申込</div><div className="val green">{k.offers}</div><div className="sub">申込率 {rate(k.offers, k.leads)}／成約 {k.wins}</div></div>
            </div>

            <div className="rlt-fn-card">
                <div className="rlt-fn-head"><h3>ポータル別ファネル（受信分・自動集計／{pl}）</h3><span className="note">上部の「対象期間」で切り替わります（単月・通期・全期間）</span></div>
                <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                    <th>ポータル</th><th className="r">反響</th><th className="r">通電</th><th className="r">通電率</th><th className="r">内見</th><th className="r">内見率</th>
                    <th className="r">購入申込</th><th className="r">申込率(反響比)</th><th className="r">申込率(内見比)</th><th className="r">反響単価</th><th className="r">反響費用</th><th className="r">申込単価</th>
                </tr></thead><tbody>
                    {pf.length === 0 && <tr><td colSpan={12} className="empty">{pl}に受信した買い反響はまだありません</td></tr>}
                    {pf.map(o => (
                        <tr key={o.name}>
                            <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                            <td className="r auto">{o.views}</td><td className="r auto">{rate(o.views, o.leads)}</td><td className="r auto">{o.offers}</td>
                            <td className="r auto">{rate(o.offers, o.leads)}</td><td className="r auto">{rate(o.offers, o.views)}</td>
                            <td className="r">{o.unit ? fmtYen(o.unit) : '―'}</td><td className="r auto">{fmtYen0(o.cost)}</td>
                            <td className="r auto">{o.offers && o.cost ? fmtYen(Math.round(o.cost / o.offers)) : '―'}</td>
                        </tr>
                    ))}
                    {pf.length > 0 && (
                        <tr className="total">
                            <td>合計</td><td className="r">{TT.leads}</td><td className="r">{TT.connects}</td><td className="r">{rate(TT.connects, TT.leads)}</td>
                            <td className="r">{TT.views}</td><td className="r">{rate(TT.views, TT.leads)}</td><td className="r">{TT.offers}</td>
                            <td className="r">{rate(TT.offers, TT.leads)}</td><td className="r">{rate(TT.offers, TT.views)}</td><td className="r"></td>
                            <td className="r">{fmtYen0(TT.cost)}</td><td className="r">{TT.offers && TT.cost ? fmtYen(Math.round(TT.cost / TT.offers)) : '―'}</td>
                        </tr>
                    )}
                </tbody></table></div>
            </div>

            <div className="rlt-fn-card">
                <div className="rlt-fn-head"><h3>担当者別ファネル（受信分・自動集計／{pl}）</h3><span className="note">受信月コホート基準。架電数のみ対象期間の実施日ベース（📞のみ・反響担当者基準）</span></div>
                <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                    <th>担当者</th><th className="r">反響</th><th className="r">架電</th><th className="r">通電</th><th className="r">通電率</th><th className="r">内見</th><th className="r">内見率</th>
                    <th className="r">購入申込</th><th className="r">申込率(反響比)</th><th className="r">申込率(内見比)</th><th className="r">成約</th>
                </tr></thead><tbody>
                    {st.length === 0 && <tr><td colSpan={11} className="empty">担当者が登録されていません</td></tr>}
                    {st.map(o => (
                        <tr key={o.name}>
                            <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.calls}</td>
                            <td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                            <td className="r auto">{o.views}</td><td className="r auto">{rate(o.views, o.leads)}</td>
                            <td className="r auto">{o.offers}</td><td className="r auto">{rate(o.offers, o.leads)}</td>
                            <td className="r auto">{rate(o.offers, o.views)}</td><td className="r auto">{o.wins}</td>
                        </tr>
                    ))}
                    {st.length > 0 && (
                        <tr className="total">
                            <td>チーム合計</td><td className="r">{T.leads}</td><td className="r">{T.calls}</td><td className="r">{T.connects}</td><td className="r">{rate(T.connects, T.leads)}</td>
                            <td className="r">{T.views}</td><td className="r">{rate(T.views, T.leads)}</td><td className="r">{T.offers}</td>
                            <td className="r">{rate(T.offers, T.leads)}</td><td className="r">{rate(T.offers, T.views)}</td><td className="r">{T.wins}</td>
                        </tr>
                    )}
                </tbody></table></div>
            </div>
        </>
    );
};

export default LeadFunnelPanel;
```

### 直したファイル（差分）
```diff
diff --git a/backend-express/src/features/realty/importer.ts b/backend-express/src/features/realty/importer.ts
index 813df04f..ec4ce27a 100644
--- a/backend-express/src/features/realty/importer.ts
+++ b/backend-express/src/features/realty/importer.ts
@@ -22,7 +22,7 @@ import type { Result } from './index';
  *   ・同じポータル反響（反響番号 extId が同じで id が違う）が Dashboard にもあるときは、**以前のアプリを正**にする。
  *     Dashboard の行の id を以前のアプリの id に付け替えてから上書きする（変更履歴・通知・商談の紐づけの id も付け替える）
  *   ・以前のアプリで消えた行（前に取り込んだが今のファイルに無い）は**非表示**（論理削除）。行は消さない
- *     ⚠️ 対象は「以前のアプリから取り込んだ行」（raw_data がある行）だけ。Dashboard で入った行は触らない
+ *     ⚠️ v2.2.225: 全面差し替え（hideScope = all）では、Dashboard で入った行もファイルに無ければ非表示（HideScope の注記）
  * ⚠️ Dashboard だけの列（show_dashboard・deleted_*・master_data_id・property_db_*）は取り込みで上書きしない。
  *   ⚠️ ただし、この取り込みで非表示にした行がファイルに戻ってきたら、表示に戻す。
  * ─────────────────────────────────────────────
@@ -43,8 +43,10 @@ const IMPORT_KINDS = [
   'logs', 'notices', 'sellerReports', 'viewings', 'comments',
 ] as const;
 
-/** この取り込みで非表示にした印（deleted_by） */
+/** この取り込みで非表示にした印（deleted_by）。以前のアプリから取り込んだ行で、今のファイルに無いもの */
 const DELETED_BY = '以前のアプリで削除';
+/** 全面差し替え（hideScope = all）で非表示にした、以前のアプリから来ていない行（Dashboard のポータル取り込みなど） */
+const NOT_IN_APP = '以前のアプリに無い行';
 /** ファイルの行がこれより少なければ、消えた行の非表示を断る（違うファイル・途中で切れたファイルの事故よけ） */
 const MIN_RECORDS_FOR_HIDE = 300;
 /** 非表示にする行が、以前のアプリから取り込んだ行のこの割合を超えたら断る */
@@ -192,27 +194,37 @@ const readKeys = (raw: unknown): { id: string; kind: string; extId: string | nul
 
 type KindCount = { file: number; insert: number; update: number; merge: number; conflict: number; hide: number };
 
-/** 以前のアプリから取り込んだ、表示中の行（非表示にする候補） */
-const importedVisibleRows = () =>
+/**
+ * 非表示にする範囲（v2.2.225）。
+ *   all      … **全面差し替え**。ファイルに無い表示中の行はすべて非表示（Dashboard のポータル取り込み・Dashboard で入れた行も）
+ *   imported … 以前のアプリから取り込んだ行（raw_data がある行）のうち、ファイルに無いものだけ（v2.2.224 の動き）
+ * ⚠️ 2026-10-28 の利用者の指示: 「既存の brokerage_listings は無いものとして考えてよい」「明日から不動産企画係が使い始める」
+ *   → 画面は all を既定にする。同じ反響が反響番号の作り方の違いで2行になっていた分（109件）もこれで消える
+ */
+type HideScope = 'all' | 'imported';
+const hideScopeOf = (v: unknown): HideScope => (v === 'all' ? 'all' : 'imported');
+
+/** 非表示にする候補（表示中の行） */
+const visibleRows = (scope: HideScope) =>
   query<DynamicRow>(
     `SELECT id, kind FROM brokerage_listings
-      WHERE raw_data IS NOT NULL AND kind IN (${IMPORT_KINDS.map(() => '?').join(', ')})
+      WHERE ${scope === 'imported' ? 'raw_data IS NOT NULL AND ' : ''}kind IN (${IMPORT_KINDS.map(() => '?').join(', ')})
         AND (show_dashboard IS NULL OR show_dashboard <> 0)`,
     [...IMPORT_KINDS]
   );
 
-/** 非表示にする行（以前のアプリから取り込んだが、今のファイルに無い） */
-const rowsToHide = async (fileIds: Set<string>) => {
-  const imported = await importedVisibleRows();
-  return { imported, hide: imported.filter((r) => !fileIds.has(String(r.id))) };
+/** 非表示にする行（今のファイルに無い） */
+const rowsToHide = async (fileIds: Set<string>, scope: HideScope) => {
+  const candidates = await visibleRows(scope);
+  return { candidates, hide: candidates.filter((r) => !fileIds.has(String(r.id))) };
 };
 
 /** 非表示を断る理由（無ければ null） */
-const hideRefusal = (fileCount: number, importedCount: number, hideCount: number): string | null => {
+const hideRefusal = (fileCount: number, candidateCount: number, hideCount: number): string | null => {
   if (hideCount === 0) return null;
-  if (fileCount < MIN_RECORDS_FOR_HIDE) return `ファイルの行が ${fileCount} 件しかありません。違うファイルの可能性があるため、消えた行の非表示はしません`;
-  if (hideCount > importedCount * MAX_HIDE_RATIO) {
-    return `非表示にする行が ${hideCount} 件（以前のアプリから取り込んだ行の ${Math.round((hideCount / importedCount) * 100)}%）と多すぎます。古いファイルや途中で切れたファイルの可能性があるため、非表示はしません`;
+  if (fileCount < MIN_RECORDS_FOR_HIDE) return `ファイルの行が ${fileCount} 件しかありません。違うファイルの可能性があるため、非表示はしません`;
+  if (hideCount > candidateCount * MAX_HIDE_RATIO) {
+    return `非表示にする行が ${hideCount} 件（いま表示中の行の ${Math.round((hideCount / candidateCount) * 100)}%）と多すぎます。古いファイルや途中で切れたファイルの可能性があるため、非表示はしません`;
   }
   return null;
 };
@@ -249,7 +261,7 @@ export const runImportCheck = async (body: Record<string, unknown>): Promise<Res
     else kc.insert++;
   }
 
-  const { imported, hide } = await rowsToHide(new Set(ids));
+  const { candidates, hide } = await rowsToHide(new Set(ids), hideScopeOf(body.hideScope));
   for (const r of hide) c(String(r.kind)).hide++;
 
   return ok({
@@ -257,7 +269,7 @@ export const runImportCheck = async (body: Record<string, unknown>): Promise<Res
     counts,
     total: keys.length,
     hide: hide.length,
-    hideRefusal: hideRefusal(keys.length, imported.length, hide.length),
+    hideRefusal: hideRefusal(keys.length, candidates.length, hide.length),
     dupExtIds,
   });
 };
@@ -348,15 +360,15 @@ export const runImportRecords = async (body: Record<string, unknown>): Promise<R
       const updates = cols.filter((c) => c !== 'id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`);
       // ⚠️ この取り込みで非表示にした行が戻ってきたら表示に戻す。⚠️ deleted_by は最後に（左から順に評価される）
       updates.push(
-        'show_dashboard = IF(deleted_by <=> ?, 1, show_dashboard)',
-        'deleted_at = IF(deleted_by <=> ?, NULL, deleted_at)',
-        'deleted_by = IF(deleted_by <=> ?, NULL, deleted_by)'
+        'show_dashboard = IF(deleted_by IN (?, ?), 1, show_dashboard)',
+        'deleted_at = IF(deleted_by IN (?, ?), NULL, deleted_at)',
+        'deleted_by = IF(deleted_by IN (?, ?), NULL, deleted_by)'
       );
       const res = await executeLarge(
         `INSERT INTO brokerage_listings (${cols.map((c) => `\`${c}\``).join(', ')})
          VALUES (${cols.map(() => '?').join(', ')})
          ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
-        [...cols.map((c) => row[c]), DELETED_BY, DELETED_BY, DELETED_BY]
+        [...cols.map((c) => row[c]), DELETED_BY, NOT_IN_APP, DELETED_BY, NOT_IN_APP, DELETED_BY, NOT_IN_APP]
       );
       // ⚠️ mysql2 は既定で FOUND_ROWS を付けるので、変わらない行も affectedRows = 1（新規と同じ）になる。
       //   新規かどうかは、書く前に同じ id の行があったかで決める。あった行は 2 = 更新、それ以外 = 変わらない
@@ -378,7 +390,7 @@ export const runImportRecords = async (body: Record<string, unknown>): Promise<R
 // ---------------------------------------------------------------------------
 
 /**
- * body = { ids: ファイルの全行の id, hide: true/false, settingsJson, weeklyJson, complianceJson（それぞれ文字列にした JSON。parseJsonText の注記） }
+ * body = { ids: ファイルの全行の id, hide: true/false, hideScope: 'all' | 'imported', settingsJson, weeklyJson, complianceJson（それぞれ文字列にした JSON。parseJsonText の注記） }
  * ⚠️ 行の書き込みが全部終わってから呼ぶ（途中で呼ぶと、まだ書いていない行を「消えた」と判断しないよう ids はファイル全体）
  */
 export const runImportFinish = async (body: Record<string, unknown>): Promise<Result> => {
@@ -388,15 +400,17 @@ export const runImportFinish = async (body: Record<string, unknown>): Promise<Re
   let hidden = 0;
   let hideSkipped: string | null = null;
   if (body.hide === true) {
-    const { imported, hide } = await rowsToHide(new Set(ids));
-    hideSkipped = hideRefusal(ids.length, imported.length, hide.length);
+    const { candidates, hide } = await rowsToHide(new Set(ids), hideScopeOf(body.hideScope));
+    hideSkipped = hideRefusal(ids.length, candidates.length, hide.length);
     if (hideSkipped === null) {
       for (let i = 0; i < hide.length; i += 500) {
         const chunk = hide.slice(i, i + 500).map((r) => String(r.id));
+        // ⚠️ 以前のアプリから取り込んだ行（raw_data あり）は「以前のアプリで削除」、それ以外は「以前のアプリに無い行」
         const res = await executeLarge(
-          `UPDATE brokerage_listings SET show_dashboard = 0, deleted_at = NOW(), deleted_by = ?
+          `UPDATE brokerage_listings
+              SET show_dashboard = 0, deleted_at = NOW(), deleted_by = IF(raw_data IS NULL, ?, ?)
             WHERE id IN (${chunk.map(() => '?').join(', ')})`,
-          [DELETED_BY, ...chunk]
+          [NOT_IN_APP, DELETED_BY, ...chunk]
         );
         hidden += res.affectedRows;
       }
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 4a16bfb8..ea419439 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -53,13 +53,30 @@ const TO_NORM = "REPLACE(REPLACE(`to`, ' ', ''), '　', '')";
 const realtyStaffList = (): Promise<DynamicRow[]> =>
   query<DynamicRow>("SELECT * FROM staff_list WHERE shop = '不動産企画係'");
 
-/** 移植元: plannerAction/planner_lead.php。⚠️ kind で絞るのは画面側 */
+/** app_state.settings（無ければ・読めなければ空のオブジェクト） */
+const readSettings = async (): Promise<unknown> => {
+  const state = await query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1");
+  try {
+    const raw = state[0]?.data;
+    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
+    // ⚠️ PHP の json_decode(…, true) は空のオブジェクトを [] にする。画面は Object として読むので {} で返す
+    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
+  } catch {
+    return {};
+  }
+};
+
+/**
+ * 移植元: plannerAction/planner_lead.php。⚠️ kind で絞るのは画面側
+ * ⚠️ v2.2.225: 売り反響・買い反響の画面の歩留まり（担当者・反響単価・期首月）のため settings も返す
+ */
 export const runPlannerLead = async (): Promise<Result> => {
-  const [lead, staff] = await Promise.all([
+  const [lead, staff, settings] = await Promise.all([
     query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads', 'ledger', 'resales')"),
     realtyStaffList(),
+    readSettings(),
   ]);
-  return ok({ lead, staff });
+  return ok({ lead, staff, settings });
 };
 
 /**
@@ -67,23 +84,14 @@ export const runPlannerLead = async (): Promise<Result> => {
  * ⚠️ v2.2.222: チームサマリーの売上・媒介獲得・朝礼用アラートのため、商談案件（deals）と媒介台帳（ledger）も返す。
  */
 export const runPlannerSummary = async (): Promise<Result> => {
-  const [lead, deals, ledger, staff, state] = await Promise.all([
+  const [lead, deals, ledger, staff, settings] = await Promise.all([
     query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads')"),
     query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'deals'"),
     query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'ledger'"),
     realtyStaffList(),
-    query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1"),
+    readSettings(),
   ]);
-  let settings: unknown = {};
-  try {
-    const raw = state[0]?.data;
-    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
-    if (parsed !== null && typeof parsed === 'object') settings = parsed;
-  } catch {
-    settings = {};
-  }
-  // ⚠️ PHP の json_decode(…, true) は空のオブジェクトを [] にする。画面は Object として読むので {} で返す
-  return ok({ lead, deals, ledger, staff, settings: Array.isArray(settings) && settings.length === 0 ? {} : settings });
+  return ok({ lead, deals, ledger, staff, settings });
 };
 
 // ---------------------------------------------------------------------------
diff --git a/backend/scripts/sql/2026-10-28_realty_import_2_check.sql b/backend/scripts/sql/2026-10-28_realty_import_2_check.sql
index 435549ed..a10126f6 100644
--- a/backend/scripts/sql/2026-10-28_realty_import_2_check.sql
+++ b/backend/scripts/sql/2026-10-28_realty_import_2_check.sql
@@ -11,12 +11,14 @@ SELECT k.kind AS 種類,
        IFNULL(a.cnt, 0) AS 取り込み後,
        IFNULL(a.visible, 0) AS うち表示中,
        IFNULL(a.hidden_import, 0) AS うち以前のアプリで削除,
+       IFNULL(a.hidden_not_in_app, 0) AS うち以前のアプリに無い行,
        IFNULL(a.hidden_dup, 0) AS うち重複で非表示
   FROM (SELECT DISTINCT kind FROM brokerage_listings) k
   LEFT JOIN (SELECT kind, COUNT(*) cnt FROM brokerage_listings_bk_import GROUP BY kind) b ON b.kind = k.kind
   LEFT JOIN (SELECT kind, COUNT(*) cnt,
                     SUM(show_dashboard IS NULL OR show_dashboard <> 0) visible,
                     SUM(deleted_by = '以前のアプリで削除') hidden_import,
+                    SUM(deleted_by = '以前のアプリに無い行') hidden_not_in_app,
                     SUM(deleted_by = '以前のアプリと重複') hidden_dup
                FROM brokerage_listings GROUP BY kind) a ON a.kind = k.kind
  ORDER BY k.kind;
diff --git a/backend/src/handlers/plannerAction/planner_lead.php b/backend/src/handlers/plannerAction/planner_lead.php
index e0d8002b..54543a60 100644
--- a/backend/src/handlers/plannerAction/planner_lead.php
+++ b/backend/src/handlers/plannerAction/planner_lead.php
@@ -15,9 +15,20 @@ $stmt_staff = $pdo->prepare($sql_staff);
 $stmt_staff->execute();
 $response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);
 
+// ⚠️ v2.2.225: 売り反響・買い反響の画面の歩留まり（担当者・反響単価・期首月）のため設定も返す（② の features/realty と同じ）
+$stmt_state = $pdo->prepare("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1");
+$stmt_state->execute();
+$raw_state = $stmt_state->fetchColumn();
+$response_settings = $raw_state ? json_decode($raw_state, true) : null;
+if (!is_array($response_settings) || $response_settings === []) {
+    // ⚠️ 空の配列で返すと json_encode が [] にする。画面は Object として読むので {} にする
+    $response_settings = new stdClass();
+}
+
 $result = [
     "lead" => $response_lead,
-    "staff" => $response_staff
+    "staff" => $response_staff,
+    "settings" => $response_settings
 ];
 
 echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
diff --git a/frontend/src/components/realty/buy/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
index ef40d1a8..98a95a42 100644
--- a/frontend/src/components/realty/buy/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -1,7 +1,10 @@
 import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
 import apiClient from '../../../utils/apiClient';
 import { thisYear } from '../../../utils/thisYear';
-import Table from 'react-bootstrap/Table';
+import LeadFunnelPanel from '../common/LeadFunnelPanel';
+import { callCountOf, defaultPeriod, periodGroups, periodHas, recvMonthKey } from '../common/leadFunnel';
+import type { Period } from '../common/leadFunnel';
+import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, safeParse, BUY_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
@@ -45,17 +48,8 @@ type BuyLead = {
     docDraft?: string | null;
 };
 
-type PeriodSummary = {
-    count: number;
-    contact: number;
-    view: number;
-    apply: number;
-    contract: number;
-    call: number;
-    today: number;
-    thisWeek: number;
-    mail: number;
-};
+/** 設定のうち歩留まりの表で使うもの（担当者・期首月・反響単価） */
+type LeadSettings = Settings & { srcCosts?: Record<string, number>; portalCosts?: Record<string, number> };
 
 type initialData = {
     name: string | null;
@@ -73,16 +67,8 @@ type initialData = {
 // ==========================================
 // 💡 ヘルパー関数
 // ==========================================
-const parseCallCounts = (callDatesJson: string | null) => {
-    try {
-        // 💡 修正: safeParse を用いて安全にパース
-        const parsed = safeParse(callDatesJson) || [];
-        const calls = parsed.filter((c: CallLog) => c.type === 'call');
-        return { call: calls.length, sms: 0, mail: 0 };
-    } catch (e) {
-        return { call: 0, sms: 0, mail: 0 };
-    }
-};
+/** 一覧の「架電」の数。⚠️ v2.2.225: 以前のアプリと同じく type の無い記録も架電に数える（leadFunnel.ts の callCountOf） */
+const parseCallCounts = (callDatesJson: string | null) => ({ call: callCountOf({ callDates: callDatesJson }), sms: 0, mail: 0 });
 
 const formatYen = (num: string | number | null) => {
     if (!num) return '―';
@@ -100,35 +86,12 @@ const formatDate = (dateStr: string | null | Date) => {
     return dateStr.replace(/-/g, '/');
 };
 
-const calcRate = (part: number, total: number) => {
-    if (total === 0) return '0.0%';
-    return ((part / total) * 100).toFixed(1) + '%';
-};
-
 const getCurrentDateTime = () => {
     const now = new Date();
     now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
     return now.toISOString().slice(0, 16);
 };
 
-const getThisWeekDates = () => {
-    const now = new Date();
-    const day = now.getDay();
-    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
-    const start = new Date(now.setDate(diff));
-
-    const days: string[] = [];
-    for (let i = 0; i < 7; i++) {
-        const d = new Date(start);
-        d.setDate(d.getDate() + i);
-        const y = d.getFullYear();
-        const m = String(d.getMonth() + 1).padStart(2, '0');
-        const dt = String(d.getDate()).padStart(2, '0');
-        days.push(`${y}-${m}-${dt}`);
-    }
-    return days;
-};
-
 // 💡 仲介手数料の自動計算（800万円以下: 30万円、800万円超: 3% + 6万円）
 const calcBrokerageFee = (priceVal: string | number | null | undefined): number | null => {
     if (!priceVal) return null;
@@ -215,7 +178,9 @@ const LeadBuy = () => {
     const [isAdding, setIsAdding] = useState(false);
 
     const [displayLimit, setDisplayLimit] = useState<number>(15);
-    const [selectedMonth, setSelectedMonth] = useState<string>('');
+    // ⚠️ v2.2.225: 期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）と設定。歩留まりは以前のアプリと同じ計算（common/leadFunnel.ts）
+    const [period, setPeriod] = useState<Period>('');
+    const [settings, setSettings] = useState<LeadSettings>({});
 
     const [isCallModalOpen, setIsCallModalOpen] = useState(false);
     const [callTargetLead, setCallTargetLead] = useState<BuyLead | null>(null);
@@ -232,24 +197,6 @@ const LeadBuy = () => {
     const newStaffRef = useRef<HTMLSelectElement>(null);
     const newPhaseRef = useRef<HTMLSelectElement>(null);
 
-    const formattedMonth = selectedMonth.replace('年', '-').replace('月', '-');
-
-    const isReceived = (receivedDate: string | null) => {
-        return !!receivedDate && receivedDate.includes(formattedMonth)
-    };
-    const isContacted = (phase: string, contactDate: string | null) => {
-        return ['内見予約', '内見済み', '購入申込', '成約'].includes(phase) || (!!contactDate && contactDate.includes(formattedMonth));
-    };
-    const isViewed = (phase: string, viewDate: string | null) => {
-        return ['内見済み', '購入申込', '成約'].includes(phase) || (!!viewDate && viewDate.includes(formattedMonth));
-    };
-    const isApplied = (phase: string, appliCationDate: string | null) => {
-        return ['購入申込', '成約'].includes(phase) || (!!appliCationDate && appliCationDate.includes(formattedMonth));
-    };
-    const isContracted = (phase: string, contractDate: string | null) => {
-        return phase === '成約' || (!!contractDate && contractDate.includes(formattedMonth));
-    };
-
     const now = new Date();
     const year = now.getFullYear();
     const month = now.getMonth() + 1;
@@ -272,6 +219,10 @@ const LeadBuy = () => {
                         nextNote: l.nextNote || null
                     }));
                     setLeads(responseLead);
+                    // ⚠️ v2.2.225: 担当者・反響単価・期首月（歩留まりの表）。期間の既定は今月（今期に無ければ期首月）
+                    const st: LeadSettings = response.data.settings ?? {};
+                    setSettings(st);
+                    setPeriod(prev => prev || defaultPeriod(st.fiscalStart));
                     setStaffList(response.data.staff.filter((s: any) => s.period === String(thisYear)).map((s: any) => s.name));
                 }
             } catch (e) {
@@ -294,58 +245,18 @@ const LeadBuy = () => {
         return () => window.removeEventListener('scroll', handleScroll);
     }, []);
 
-    const availableMonths = useMemo(() => {
-        const months = leads.map(l => {
-            if (!l.receivedDate || l.receivedDate.startsWith('0000')) return '';
-            const [y, m] = l.receivedDate.split('-');
-            return `${y}-${m}`;
-        }).filter(Boolean);
-        return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
-    }, [leads]);
+    /** ⚠️ v2.2.225: 期間の選択肢（以前のアプリと同じ: 月別（今期）／通期／全期間） */
+    const periodOptions = useMemo(() => periodGroups(settings.fiscalStart, leads as unknown as Row[]), [settings.fiscalStart, leads]);
 
-    // 💡 修正: フィルタリングと同時に降順ソートを実行
+    /** 一覧は選んだ期間に受信した反響（受信日の新しい順） */
     const filteredLeads = useMemo(() => {
-        let result = leads;
-        if (selectedMonth) {
-            result = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
-        }
-        // receivedDate の降順ソート
+        const result = period ? leads.filter(l => periodHas(period, recvMonthKey(l as unknown as Row), settings.fiscalStart)) : leads;
         return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
-    }, [leads, selectedMonth]);
+    }, [leads, period, settings.fiscalStart]);
 
     useEffect(() => {
         setDisplayLimit(15);
-    }, [selectedMonth]);
-
-
-    const periodSummary = useMemo<PeriodSummary>(() => {
-        let total = { count: 0, contact: 0, view: 0, apply: 0, contract: 0, call: 0, today: 0, thisWeek: 0, mail: 0 };
-
-        const callLogArray = filteredLeads.map(f => safeParse(f.callDates));
-        const flatLogs = callLogArray.flat();
-
-        total.call = flatLogs.filter((f: CallLog) => f?.type === 'call').length;
-
-        const thisWeekDates = getThisWeekDates();
-
-        const todayLength = flatLogs.filter((c: CallLog) => c?.date && c.date.startsWith(today)).length;
-        const thisWeekLength = flatLogs.filter((c: CallLog) => c?.date && thisWeekDates.some(d => c.date?.startsWith(d))).length;
-        const mailLength = flatLogs.filter((c: CallLog) => c?.type === 'mail').length;
-
-        total.today = todayLength;
-        total.thisWeek = thisWeekLength;
-        total.mail = mailLength;
-
-        filteredLeads.forEach(lead => {
-            if (isReceived(lead.receivedDate)) { total.count++; }
-            if (isContacted(lead.phase, lead.contactDate)) { total.contact++; }
-            if (isViewed(lead.phase, lead.viewDate)) { total.view++; }
-            if (isApplied(lead.phase, lead.applicationDate)) { total.apply++; }
-            if (isContracted(lead.phase, lead.contractDate)) { total.contract++; }
-        });
-
-        return total;
-    }, [filteredLeads, selectedMonth, today]);
+    }, [period]);
 
     // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）
     const nextActionAlert = useMemo(() => {
@@ -358,52 +269,6 @@ const LeadBuy = () => {
         return { overdue, missing };
     }, [filteredLeads, today]);
 
-    const portalSummary = useMemo(() => {
-        const summary: Record<string, any> = {};
-        let total = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };
-
-        filteredLeads.forEach(lead => {
-            const portal = lead.portal || 'その他';
-            if (!summary[portal]) summary[portal] = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };
-
-            summary[portal].count++;
-            total.count++;
-
-            if (isContacted(lead.phase, lead.contactDate)) { summary[portal].contact++; total.contact++; }
-            if (isViewed(lead.phase, lead.viewDate)) { summary[portal].view++; total.view++; }
-            if (isApplied(lead.phase, lead.applicationDate)) { summary[portal].apply++; total.apply++; }
-            if (isContracted(lead.phase, lead.contractDate)) { summary[portal].contract++; total.contract++; }
-        });
-
-        const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
-        return { sorted, total };
-    }, [filteredLeads]);
-
-    const staffSummary = useMemo(() => {
-        const summary: Record<string, any> = {};
-        let total = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };
-
-        filteredLeads.forEach(lead => {
-            const rawStaff = lead.staff || '未割当';
-            const staffKey = rawStaff !== '未割当' ? removeSpaces(rawStaff) : rawStaff;
-
-            if (!summary[staffKey]) {
-                summary[staffKey] = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };
-            }
-
-            summary[staffKey].count++;
-            total.count++;
-
-            if (isContacted(lead.phase, lead.contactDate)) { summary[staffKey].contact++; total.contact++; }
-            if (isViewed(lead.phase, lead.viewDate)) { summary[staffKey].view++; total.view++; }
-            if (isApplied(lead.phase, lead.applicationDate)) { summary[staffKey].apply++; total.apply++; }
-            if (isContracted(lead.phase, lead.contractDate)) { summary[staffKey].contract++; total.contract++; }
-        });
-
-        const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
-        return { sorted, total };
-    }, [filteredLeads]);
-
     /**
      * brokerage_listings の1行を部分更新する。
      * 画面を先に更新し（楽観的更新）、保存に失敗したら元の値へ戻す。
@@ -613,9 +478,10 @@ const LeadBuy = () => {
     return (
         <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
             <LeadHeader
-                selectedMonth={selectedMonth}
-                setSelectedMonth={setSelectedMonth}
-                availableMonths={availableMonths}
+                selectedMonth={period}
+                setSelectedMonth={setPeriod}
+                availableMonths={[]}
+                periodGroups={periodOptions}
                 handleAddClick={handleAddClick}
                 isAdding={isAdding}
                 headerLabel={headerLabel}
@@ -624,121 +490,8 @@ const LeadBuy = () => {
 
             {!isLoading && (
                 <>
-                    {/* サマリーエリア */}
-                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', minWidth: '1200px' }}>
-                        {[
-                            { label: `${selectedMonth || '全期間'}受信リード`, value: periodSummary.count, color: '#3182ce', sub: '' },
-                            { label: `架電数(${selectedMonth || '全期間'})`, value: periodSummary.call, color: '#38b2ac', sub: `本日 ${periodSummary.today}件／今週 ${periodSummary.thisWeek}件（チーム）\n✉️メール ${periodSummary.mail}件` },
-                            { label: '通電', value: periodSummary.contact, color: '#ed8936', sub: `通電率 ${calcRate(periodSummary.contact, periodSummary.count)}` },
-                            { label: '内見', value: periodSummary.view, color: '#9f7aea', sub: `内見率 ${calcRate(periodSummary.view, periodSummary.contact)}` },
-                            { label: '購入申込', value: periodSummary.apply, color: '#48bb78', sub: `申込率 ${calcRate(periodSummary.apply, periodSummary.count)}／成約 ${periodSummary.contract}` },
-                        ].map((item, idx) => (
-                            <div key={idx} style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${item.color}` }}>
-                                <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold', marginBottom: '4px' }}>{item.label}</div>
-                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.color === '#48bb78' ? '#198754' : '#212529' }}>{item.value}</div>
-                                {item.sub && <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{item.sub}</div>}
-                            </div>
-                        ))}
-                    </div>
-
-                    {/* ファネルエリア */}
-                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', minWidth: '1200px', flexWrap: 'wrap' }}>
-                        {/* ポータル別ファネル */}
-                        <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
-                            <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
-                                ポータル別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
-                            </h6>
-                            <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
-                                <thead className="bg-light">
-                                    <tr>
-                                        <th style={compactThStyle} className="text-start ps-2">ポータル</th>
-                                        <th style={compactThStyle} className="text-end">反響</th>
-                                        <th style={compactThStyle} className="text-end">通電</th>
-                                        <th style={compactThStyle} className="text-end">通電率</th>
-                                        <th style={compactThStyle} className="text-end">内見</th>
-                                        <th style={compactThStyle} className="text-end">内見率</th>
-                                        <th style={compactThStyle} className="text-end">購入申込</th>
-                                        <th style={compactThStyle} className="text-end">申込率(反響比)</th>
-                                        <th style={compactThStyle} className="text-end">成約</th>
-                                    </tr>
-                                </thead>
-                                <tbody>
-                                    {portalSummary.sorted.map(([portal, stats]) => (
-                                        <tr key={portal}>
-                                            <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{portal}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
-                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.view}</td>
-                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.view, stats.contact)}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.apply}</td>
-                                            <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.apply, stats.count)}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contract}</td>
-                                        </tr>
-                                    ))}
-                                    <tr style={{ backgroundColor: '#f8f9fa' }}>
-                                        <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">合計</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.count}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.contact}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(portalSummary.total.contact, portalSummary.total.count)}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.view}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(portalSummary.total.view, portalSummary.total.contact)}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{portalSummary.total.apply}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(portalSummary.total.apply, portalSummary.total.count)}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.contract}</td>
-                                    </tr>
-                                </tbody>
-                            </Table>
-                        </div>
-
-                        {/* 担当者別ファネル */}
-                        <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
-                            <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
-                                担当者別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
-                            </h6>
-                            <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
-                                <thead className="bg-light">
-                                    <tr>
-                                        <th style={compactThStyle} className="text-start ps-2">担当者</th>
-                                        <th style={compactThStyle} className="text-end">反響</th>
-                                        <th style={compactThStyle} className="text-end">通電</th>
-                                        <th style={compactThStyle} className="text-end">通電率</th>
-                                        <th style={compactThStyle} className="text-end">内見</th>
-                                        <th style={compactThStyle} className="text-end">内見率</th>
-                                        <th style={compactThStyle} className="text-end">購入申込</th>
-                                        <th style={compactThStyle} className="text-end">申込率(反響比)</th>
-                                        <th style={compactThStyle} className="text-end">成約</th>
-                                    </tr>
-                                </thead>
-                                <tbody>
-                                    {staffSummary.sorted.map(([staff, stats]) => (
-                                        <tr key={staff}>
-                                            <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{staff}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
-                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.view}</td>
-                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.view, stats.contact)}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.apply}</td>
-                                            <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.apply, stats.count)}</td>
-                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contract}</td>
-                                        </tr>
-                                    ))}
-                                    <tr style={{ backgroundColor: '#f8f9fa' }}>
-                                        <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">チーム合計</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.count}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.contact}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.contact, staffSummary.total.count)}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.view}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.view, staffSummary.total.contact)}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{staffSummary.total.apply}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(staffSummary.total.apply, staffSummary.total.count)}</td>
-                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.contract}</td>
-                                    </tr>
-                                </tbody>
-                            </Table>
-                        </div>
-                    </div>
+                    {/* ⚠️ v2.2.225: タイル・ポータル別・担当者別ファネルは以前のアプリ（renderBuyLeads）と同じ計算（common/LeadFunnelPanel.tsx） */}
+                    <LeadFunnelPanel kind="buy" rows={leads as unknown as Row[]} period={period} settings={settings} />
                 </>
             )}
 
diff --git a/frontend/src/components/realty/common/LeadHeader.tsx b/frontend/src/components/realty/common/LeadHeader.tsx
index 5b6c949e..82262ae2 100644
--- a/frontend/src/components/realty/common/LeadHeader.tsx
+++ b/frontend/src/components/realty/common/LeadHeader.tsx
@@ -26,6 +26,11 @@ type Props = {
     allowAllPeriod?: boolean;
     /** 月の後ろに付ける文言（既定「 受信分」）。⚠️ チームサマリーは契約月の集計も含むので付けない */
     monthSuffix?: string;
+    /**
+     * ⚠️ v2.2.225: 期間をグループで選ぶ（以前のアプリの periodSelHtml: 月別（今期）／通期／全期間）。
+     *   渡したときは availableMonths・allowAllPeriod・monthSuffix は使わず、selectedMonth に 'm:…' 'fy:…' 'all' が入る
+     */
+    periodGroups?: { label: string; options: { value: string; label: string }[] }[];
 };
 
 // ==========================================
@@ -104,6 +109,7 @@ const LeadHeader: React.FC<Props> = ({
     nextActionAlert,
     allowAllPeriod = true,
     monthSuffix = ' 受信分',
+    periodGroups,
 }) => {
     const hasAlert = !!nextActionAlert && (nextActionAlert.overdue > 0 || nextActionAlert.missing > 0);
     return (
@@ -118,15 +124,23 @@ const LeadHeader: React.FC<Props> = ({
                     {/* form-selectクラスはドロップダウンの矢印UIを維持するために残しつつ、スタイルを上書き */}
                     <select
                         className="form-select shadow-sm"
-                        style={customStyles.selectBox}
+                        style={periodGroups ? { ...customStyles.selectBox, width: '260px' } : customStyles.selectBox}
                         value={selectedMonth}
                         onChange={(e) => setSelectedMonth(e.target.value)}
                     >
-                        {allowAllPeriod && <option value="">全期間</option>}
-                        {availableMonths.map(m => {
-                            const [y, mon] = m.split('-');
-                            return <option key={m} value={m}>{`${y}年${Number(mon)}月${monthSuffix}`}</option>;
-                        })}
+                        {periodGroups ? periodGroups.map(g => (
+                            <optgroup key={g.label} label={g.label}>
+                                {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
+                            </optgroup>
+                        )) : (
+                            <>
+                                {allowAllPeriod && <option value="">全期間</option>}
+                                {availableMonths.map(m => {
+                                    const [y, mon] = m.split('-');
+                                    return <option key={m} value={m}>{`${y}年${Number(mon)}月${monthSuffix}`}</option>;
+                                })}
+                            </>
+                        )}
                     </select>
                 </div>
                 
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index 434e0de7..2717268f 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -1,7 +1,10 @@
 import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
 import apiClient from '../../../utils/apiClient';
 import { thisYear } from '../../../utils/thisYear';
-import Table from 'react-bootstrap/Table';
+import LeadFunnelPanel from '../common/LeadFunnelPanel';
+import { callCountOf, defaultPeriod, periodGroups, periodHas, recvMonthKey } from '../common/leadFunnel';
+import type { Period } from '../common/leadFunnel';
+import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, safeParse, LEAD_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
@@ -80,17 +83,8 @@ export type SellLead = {
   deleted_by?: string | null;
 };
 
-type PeriodSummary = {
-  count: number;     // リード数
-  contact: number;   // 通電数
-  visit: number;     // 訪問査定数
-  propose: number;   // 査定書提出数
-  contract: number;  // 媒介受託数
-  call: number;      // 架電総数
-  today: number;     // 本日架電数
-  thisWeek: number;  // 今週架電数
-  mail: number;      // メール数
-};
+/** 設定のうち歩留まりの表で使うもの（担当者・期首月・反響単価） */
+type LeadSettings = Settings & { srcCosts?: Record<string, number>; portalCosts?: Record<string, number> };
 
 type initialData = {
     name: string | null;
@@ -105,15 +99,8 @@ type initialData = {
     docDraft?: string | null;   // 保存済みの下書き JSON
 };
 
-const parseCallCounts = (callDatesJson: string | null) => {
-  try {
-    const parsed = safeParse(callDatesJson) || [];
-    const calls = parsed.filter((c: CallLog) => c.type === 'call');
-    return { call: calls.length, sms: 0, mail: 0 };
-  } catch (e) {
-    return { call: 0, sms: 0, mail: 0 };
-  }
-};
+/** 一覧の「架電」の数。⚠️ v2.2.225: 以前のアプリと同じく type の無い記録も架電に数える（leadFunnel.ts の callCountOf） */
+const parseCallCounts = (callDatesJson: string | null) => ({ call: callCountOf({ callDates: callDatesJson }), sms: 0, mail: 0 });
 
 const formatDate = (dateStr: string | null | Date) => {
   if (!dateStr || String(dateStr).startsWith('0000')) return '―';
@@ -126,35 +113,6 @@ const formatDate = (dateStr: string | null | Date) => {
   return dateStr.replace(/-/g, '/');
 };
 
-const calcRate = (part: number, total: number) => {
-  if (total === 0) return '0.0%';
-  return ((part / total) * 100).toFixed(1) + '%';
-};
-
-const getCurrentDateTime = () => {
-  const now = new Date();
-  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
-  return now.toISOString().slice(0, 16);
-};
-
-const getThisWeekDates = () => {
-  const now = new Date();
-  const day = now.getDay();
-  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
-  const start = new Date(now.setDate(diff));
-
-  const days: string[] = [];
-  for (let i = 0; i < 7; i++) {
-    const d = new Date(start);
-    d.setDate(d.getDate() + i);
-    const y = d.getFullYear();
-    const m = String(d.getMonth() + 1).padStart(2, '0');
-    const dt = String(d.getDate()).padStart(2, '0');
-    days.push(`${y}-${m}-${dt}`);
-  }
-  return days;
-};
-
 const getLastAction = (callDatesJson: string | null) => {
   if (!callDatesJson) return '―';
   try {
@@ -223,7 +181,9 @@ const LeadSell = () => {
   const [isAdding, setIsAdding] = useState(false);
 
   const [displayLimit, setDisplayLimit] = useState<number>(15);
-  const [selectedMonth, setSelectedMonth] = useState<string>('');
+  // ⚠️ v2.2.225: 期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）と設定。歩留まりは以前のアプリと同じ計算（common/leadFunnel.ts）
+  const [period, setPeriod] = useState<Period>('');
+  const [settings, setSettings] = useState<LeadSettings>({});
 
   const [isCallModalOpen, setIsCallModalOpen] = useState(false);
   const [callTargetLead, setCallTargetLead] = useState<SellLead | null>(null);
@@ -240,24 +200,6 @@ const LeadSell = () => {
   const newStaffRef = useRef<HTMLSelectElement>(null);
   const newPhaseRef = useRef<HTMLSelectElement>(null);
 
-  const formattedMonth = selectedMonth.replace('年', '-').replace('月', '-');
-
-  const isReceived = (receivedDate: string | null) => {
-    return !!receivedDate && receivedDate.includes(formattedMonth);
-  };
-  const isContacted = (phase: string | null, contactDate: string | null) => {
-    return ['訪問査定', '査定書提出', '媒介受託', '売却済'].includes(phase || '') || (!!contactDate && contactDate.includes(formattedMonth));
-  };
-  const isVisited = (phase: string | null, visitDate: string | null) => {
-    return ['訪問査定', '査定書提出', '媒介受託', '売却済'].includes(phase || '') || (!!visitDate && visitDate.includes(formattedMonth));
-  };
-  const isProposed = (phase: string | null) => {
-    return ['査定書提出', '媒介受託', '売却済'].includes(phase || '');
-  };
-  const isContracted = (phase: string | null, contractDate: string | null) => {
-    return ['媒介受託', '売却済'].includes(phase || '') || (!!contractDate && contractDate.includes(formattedMonth));
-  };
-
   const dateFormate = (date: string | null) => {
     return (date === '0000-00-00' || !date) ? '' : date;
   };
@@ -283,6 +225,10 @@ const LeadSell = () => {
             nextNote: l.nextNote || null
           }));
           setLeads(responseLead);
+          // ⚠️ v2.2.225: 担当者・反響単価・期首月（歩留まりの表）。期間の既定は今月（今期に無ければ期首月）
+          const st: LeadSettings = response.data.settings ?? {};
+          setSettings(st);
+          setPeriod(prev => prev || defaultPeriod(st.fiscalStart));
           setStaffList(response.data.staff.filter((s: any) => s.period === String(thisYear)).map((s: any) => s.name));
         }
       } catch (e) {
@@ -305,55 +251,18 @@ const LeadSell = () => {
     return () => window.removeEventListener('scroll', handleScroll);
   }, []);
 
-  const availableMonths = useMemo(() => {
-    const months = leads.map(l => {
-      if (!l.receivedDate || l.receivedDate.startsWith('0000')) return '';
-      const [y, m] = l.receivedDate.split('-');
-      return `${y}-${m}`;
-    }).filter(Boolean);
-    return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
-  }, [leads]);
+  /** ⚠️ v2.2.225: 期間の選択肢（以前のアプリと同じ: 月別（今期）／通期／全期間） */
+  const periodOptions = useMemo(() => periodGroups(settings.fiscalStart, leads as unknown as Row[]), [settings.fiscalStart, leads]);
 
+  /** 一覧は選んだ期間に受信した反響（受信日の新しい順） */
   const filteredLeads = useMemo(() => {
-    let result = leads;
-    if (selectedMonth) {
-      result = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
-    }
+    const result = period ? leads.filter(l => periodHas(period, recvMonthKey(l as unknown as Row), settings.fiscalStart)) : leads;
     return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
-  }, [leads, selectedMonth]);
+  }, [leads, period, settings.fiscalStart]);
 
   useEffect(() => {
     setDisplayLimit(15);
-  }, [selectedMonth]);
-
-  const periodSummary = useMemo<PeriodSummary>(() => {
-    let total = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0, call: 0, today: 0, thisWeek: 0, mail: 0 };
-
-    const callLogArray = filteredLeads.map(f => safeParse(f.callDates));
-    const flatLogs = callLogArray.flat();
-
-    total.call = flatLogs.filter((f: CallLog) => f?.type === 'call').length;
-
-    const thisWeekDates = getThisWeekDates();
-
-    const todayLength = flatLogs.filter((c: CallLog) => c?.date && c.date.startsWith(today)).length;
-    const thisWeekLength = flatLogs.filter((c: CallLog) => c?.date && thisWeekDates.some(d => c.date?.startsWith(d))).length;
-    const mailLength = flatLogs.filter((c: CallLog) => c?.type === 'mail').length;
-
-    total.today = todayLength;
-    total.thisWeek = thisWeekLength;
-    total.mail = mailLength;
-
-    filteredLeads.forEach(lead => {
-      if (isReceived(lead.receivedDate)) { total.count++; }
-      if (isContacted(lead.phase, lead.contactDate)) { total.contact++; }
-      if (isVisited(lead.phase, lead.visitDate)) { total.visit++; }
-      if (isProposed(lead.phase)) { total.propose++; }
-      if (isContracted(lead.phase, lead.contractDate)) { total.contract++; }
-    });
-
-    return total;
-  }, [filteredLeads, selectedMonth, today]);
+  }, [period]);
 
   // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）
   const nextActionAlert = useMemo(() => {
@@ -366,52 +275,6 @@ const LeadSell = () => {
     return { overdue, missing };
   }, [filteredLeads, today]);
 
-  const sourceSummary = useMemo(() => {
-    const summary: Record<string, any> = {};
-    let total = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };
-
-    filteredLeads.forEach(lead => {
-      const source = lead.source || lead.portal || 'その他';
-      if (!summary[source]) summary[source] = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };
-
-      summary[source].count++;
-      total.count++;
-
-      if (isContacted(lead.phase, lead.contactDate)) { summary[source].contact++; total.contact++; }
-      if (isVisited(lead.phase, lead.visitDate)) { summary[source].visit++; total.visit++; }
-      if (isProposed(lead.phase)) { summary[source].propose++; total.propose++; }
-      if (isContracted(lead.phase, lead.contractDate)) { summary[source].contract++; total.contract++; }
-    });
-
-    const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
-    return { sorted, total };
-  }, [filteredLeads]);
-
-  const staffSummary = useMemo(() => {
-    const summary: Record<string, any> = {};
-    let total = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };
-
-    filteredLeads.forEach(lead => {
-      const rawStaff = lead.staff || '未割当';
-      const staffKey = rawStaff !== '未割当' ? removeSpaces(rawStaff) : rawStaff;
-
-      if (!summary[staffKey]) {
-        summary[staffKey] = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };
-      }
-
-      summary[staffKey].count++;
-      total.count++;
-
-      if (isContacted(lead.phase, lead.contactDate)) { summary[staffKey].contact++; total.contact++; }
-      if (isVisited(lead.phase, lead.visitDate)) { summary[staffKey].visit++; total.visit++; }
-      if (isProposed(lead.phase)) { summary[staffKey].propose++; total.propose++; }
-      if (isContracted(lead.phase, lead.contractDate)) { summary[staffKey].contract++; total.contract++; }
-    });
-
-    const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
-    return { sorted, total };
-  }, [filteredLeads]);
-
 
   /**
    * brokerage_listings の1行を部分更新する。
@@ -668,9 +531,10 @@ const LeadSell = () => {
   return (
     <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
       <LeadHeader
-        selectedMonth={selectedMonth}
-        setSelectedMonth={setSelectedMonth}
-        availableMonths={availableMonths}
+        selectedMonth={period}
+        setSelectedMonth={setPeriod}
+        availableMonths={[]}
+        periodGroups={periodOptions}
         handleAddClick={handleAddClick}
         isAdding={isAdding}
         headerLabel={headerLabel}
@@ -679,127 +543,8 @@ const LeadSell = () => {
 
       {!isLoading && (
         <>
-          {/* サマリーエリア */}
-          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', minWidth: '1200px' }}>
-            {[
-              { label: `${selectedMonth || '全期間'}受信リード`, value: periodSummary.count, color: '#3182ce', sub: '' },
-              { label: `架電数(${selectedMonth || '全期間'})`, value: periodSummary.call, color: '#38b2ac', sub: `本日 ${periodSummary.today}件／今週 ${periodSummary.thisWeek}件（チーム）\n✉️メール ${periodSummary.mail}件` },
-              { label: '通電', value: periodSummary.contact, color: '#ed8936', sub: `通電率 ${calcRate(periodSummary.contact, periodSummary.count)}` },
-              { label: '訪問査定', value: periodSummary.visit, color: '#9f7aea', sub: `獲得率 ${calcRate(periodSummary.visit, periodSummary.contact)}／査定書提出 ${periodSummary.propose}件` },
-              { label: '媒介受託', value: periodSummary.contract, color: '#48bb78', sub: `受託率(リード比) ${calcRate(periodSummary.contract, periodSummary.count)}\n受託率(査定比) ${calcRate(periodSummary.contract, periodSummary.visit)}` },
-            ].map((item, idx) => (
-              <div key={idx} style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${item.color}` }}>
-                <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold', marginBottom: '4px' }}>{item.label}</div>
-                <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.color === '#48bb78' ? '#198754' : '#212529' }}>{item.value}</div>
-                {item.sub && <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{item.sub}</div>}
-              </div>
-            ))}
-          </div>
-
-          {/* ファネルエリア */}
-          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', minWidth: '1200px', flexWrap: 'wrap' }}>
-            {/* 💡 反響元（Source）別ファネル */}
-            <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
-              <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
-                反響元別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
-              </h6>
-              <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
-                <thead className="bg-light">
-                  <tr>
-                    <th style={compactThStyle} className="text-start ps-2">反響元</th>
-                    <th style={compactThStyle} className="text-end">反響</th>
-                    <th style={compactThStyle} className="text-end">通電</th>
-                    <th style={compactThStyle} className="text-end">通電率</th>
-                    <th style={compactThStyle} className="text-end">訪問査定</th>
-                    <th style={compactThStyle} className="text-end">獲得率(通電比)</th>
-                    <th style={compactThStyle} className="text-end">査定書提出</th>
-                    <th style={compactThStyle} className="text-end">媒介受託</th>
-                    <th style={compactThStyle} className="text-end">受託率(反響比)</th>
-                    <th style={compactThStyle} className="text-end">受託率(査定比)</th>
-                  </tr>
-                </thead>
-                <tbody>
-                  {sourceSummary.sorted.map(([source, stats]) => (
-                    <tr key={source}>
-                      <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{source}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
-                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.visit}</td>
-                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.visit, stats.contact)}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.propose}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.contract}</td>
-                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.count)}</td>
-                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.visit)}</td>
-                    </tr>
-                  ))}
-                  <tr style={{ backgroundColor: '#f8f9fa' }}>
-                    <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">合計</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.count}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.contact}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(sourceSummary.total.contact, sourceSummary.total.count)}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.visit}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(sourceSummary.total.visit, sourceSummary.total.contact)}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.propose}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{sourceSummary.total.contract}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(sourceSummary.total.contract, sourceSummary.total.count)}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(sourceSummary.total.contract, sourceSummary.total.visit)}</td>
-                  </tr>
-                </tbody>
-              </Table>
-            </div>
-
-            {/* 担当者別ファネル */}
-            <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
-              <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
-                担当者別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
-              </h6>
-              <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
-                <thead className="bg-light">
-                  <tr>
-                    <th style={compactThStyle} className="text-start ps-2">担当者</th>
-                    <th style={compactThStyle} className="text-end">反響</th>
-                    <th style={compactThStyle} className="text-end">通電</th>
-                    <th style={compactThStyle} className="text-end">通電率</th>
-                    <th style={compactThStyle} className="text-end">訪問査定</th>
-                    <th style={compactThStyle} className="text-end">獲得率(通電比)</th>
-                    <th style={compactThStyle} className="text-end">査定書提出</th>
-                    <th style={compactThStyle} className="text-end">媒介受託</th>
-                    <th style={compactThStyle} className="text-end">受託率(反響比)</th>
-                    <th style={compactThStyle} className="text-end">受託率(査定比)</th>
-                  </tr>
-                </thead>
-                <tbody>
-                  {staffSummary.sorted.map(([staff, stats]) => (
-                    <tr key={staff}>
-                      <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{staff}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
-                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.visit}</td>
-                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.visit, stats.contact)}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold">{stats.propose}</td>
-                      <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.contract}</td>
-                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.count)}</td>
-                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.visit)}</td>
-                    </tr>
-                  ))}
-                  <tr style={{ backgroundColor: '#f8f9fa' }}>
-                    <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">チーム合計</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.count}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.contact}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.contact, staffSummary.total.count)}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.visit}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.visit, staffSummary.total.contact)}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.propose}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{staffSummary.total.contract}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(staffSummary.total.contract, staffSummary.total.count)}</td>
-                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(staffSummary.total.contract, staffSummary.total.visit)}</td>
-                  </tr>
-                </tbody>
-              </Table>
-            </div>
-          </div>
+          {/* ⚠️ v2.2.225: タイル・反響元別・担当者別ファネルは以前のアプリ（renderLeads）と同じ計算（common/LeadFunnelPanel.tsx） */}
+          <LeadFunnelPanel kind="sell" rows={leads as unknown as Row[]} period={period} settings={settings} />
         </>
       )}
 
diff --git a/frontend/src/components/realty/settings/RealtyImport.tsx b/frontend/src/components/realty/settings/RealtyImport.tsx
index cf68f5c6..6b070f7d 100644
--- a/frontend/src/components/realty/settings/RealtyImport.tsx
+++ b/frontend/src/components/realty/settings/RealtyImport.tsx
@@ -100,12 +100,27 @@ const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
     const [parsed, setParsed] = useState<Parsed | null>(null);
     const [check, setCheck] = useState<Check | null>(null);
     const [hide, setHide] = useState(true);
+    /**
+     * 非表示にする範囲（② の importer.ts の HideScope）。
+     * ⚠️ v2.2.225: 既定は全面差し替え（2026-10-28「既存の brokerage_listings は無いものとして考えてよい」）
+     */
+    const [hideScope, setHideScope] = useState<'all' | 'imported'>('all');
     const [busy, setBusy] = useState(false);
     const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
     const [result, setResult] = useState<{ totals: Totals; hidden: number; hideSkipped: string | null; warnings: string[]; errors: string[] } | null>(null);
 
     const reset = () => { setParsed(null); setCheck(null); setResult(null); setProgress(null); };
 
+    /** 下見。⚠️ 非表示の件数は範囲で変わるので、範囲を変えたら呼び直す */
+    const runCheck = async (p: Parsed, scope: 'all' | 'imported') => {
+        const c = await post('import_check', {
+            records: p.records.map(r => ({ id: r.id, kind: r.kind, extId: r.data.extId ?? null })),
+            hideScope: scope,
+        });
+        setCheck(c as unknown as Check);
+        setHide(!c.hideRefusal);
+    };
+
     const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
         const f = e.target.files?.[0];
         e.target.value = '';
@@ -114,12 +129,21 @@ const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
         setBusy(true);
         try {
             const p = parseBackup(f.name, await f.text());
-            const c = await post('import_check', {
-                records: p.records.map(r => ({ id: r.id, kind: r.kind, extId: r.data.extId ?? null })),
-            });
+            await runCheck(p, hideScope);
             setParsed(p);
-            setCheck(c as unknown as Check);
-            setHide(!c.hideRefusal);
+        } catch (err) {
+            alert((err as Error).message);
+        } finally {
+            setBusy(false);
+        }
+    };
+
+    const changeScope = async (scope: 'all' | 'imported') => {
+        setHideScope(scope);
+        if (!parsed) return;
+        setBusy(true);
+        try {
+            await runCheck(parsed, scope);
         } catch (err) {
             alert((err as Error).message);
         } finally {
@@ -129,7 +153,9 @@ const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
 
     const run = async () => {
         if (!parsed || !check) return;
-        const hideNote = hide && check.hide > 0 ? `\n以前のアプリで消えた ${check.hide} 件を非表示にします。` : '';
+        const hideNote = hide && check.hide > 0
+            ? `\n${hideScope === 'all' ? 'ファイルに無い' : '以前のアプリで消えた'} ${check.hide} 件を非表示にします。`
+            : '';
         if (!window.confirm(`${parsed.records.length} 件を取り込み、設定・週次行動計画・コンプライアンスを以前のアプリの内容で置き換えます。${hideNote}\nよろしいですか？`)) return;
         setBusy(true);
         const totals: Totals = { inserted: 0, updated: 0, unchanged: 0, merged: 0, retired: 0, failed: 0 };
@@ -150,6 +176,7 @@ const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
             const fin = await post('import_finish', {
                 ids: parsed.records.map(r => r.id),
                 hide: hide && !check.hideRefusal,
+                hideScope,
                 settingsJson: JSON.stringify(parsed.settings),
                 weeklyJson: JSON.stringify(parsed.weekly),
                 complianceJson: JSON.stringify(parsed.compliance),
@@ -188,7 +215,7 @@ const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
                                     <th>種類</th><th className="r">ファイル</th><th className="r">新規</th><th className="r">更新</th>
                                     <th className="r" title="同じ反響番号の行が Dashboard にある。以前のアプリの内容にそろえる">そろえる</th>
                                     <th className="r" title="同じ反響の行が Dashboard に2行ある。Dashboard 側を非表示にする">重複</th>
-                                    <th className="r" title="以前のアプリで消えた行">非表示</th>
+                                    <th className="r" title="ファイルに無いため非表示にする行（範囲は下で選ぶ）">非表示</th>
                                 </tr></thead>
                                 <tbody>
                                     {KINDS.filter(k => check.counts[k.key]).map(k => {
@@ -207,9 +234,19 @@ const RealtyImport: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
                             <p className="rlt-sub">ファイルの中で反響番号が重複している反響が {check.dupExtIds.length} 件あります。その反響は反響番号を空にして取り込みます。</p>
                         )}
                         {check.hideRefusal && <div className="rlt-alert" style={{ marginTop: 8 }}>{check.hideRefusal}</div>}
+                        <div className="rlt-sub" style={{ margin: '8px 0' }}>
+                            <label style={{ display: 'block' }}>
+                                <input type="radio" name="rlt-hide-scope" checked={hideScope === 'all'} disabled={busy} onChange={() => changeScope('all')} />{' '}
+                                <b>全面差し替え</b>：ファイルに無い行はすべて非表示（Dashboard のポータル取り込みで入った反響も）
+                            </label>
+                            <label style={{ display: 'block' }}>
+                                <input type="radio" name="rlt-hide-scope" checked={hideScope === 'imported'} disabled={busy} onChange={() => changeScope('imported')} />{' '}
+                                以前のアプリで消えた行だけ非表示（Dashboard で入った行は残す）
+                            </label>
+                        </div>
                         <label className="rlt-sub" style={{ display: 'block', margin: '8px 0' }}>
                             <input type="checkbox" checked={hide} disabled={!!check.hideRefusal || busy} onChange={e => setHide(e.target.checked)} />{' '}
-                            以前のアプリで消えた行（{check.hide} 件）を非表示にする（行は消さないので戻せます）
+                            {hideScope === 'all' ? 'ファイルに無い行' : '以前のアプリで消えた行'}（{check.hide} 件）を非表示にする（行は消さないので戻せます）
                         </label>
                         <p className="rlt-sub">設定・週次行動計画・コンプライアンスは、以前のアプリの内容で置き換えます。</p>
                         <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index cf71b095..89b722e3 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -55,11 +55,6 @@ type SummaryLead = {
 // ==========================================
 // 💡 ヘルパー関数・定数
 // ==========================================
-const formatYen = (num: number | string | null | undefined) => {
-    if (num == null || isNaN(Number(num))) return '―';
-    return `¥${Number(num).toLocaleString()}`;
-};
-
 const formatMan = (num: number | string | null | undefined) => {
     if (num == null || isNaN(Number(num))) return '―';
     return `${Math.round(Number(num) / 10000).toLocaleString()}万`;
@@ -925,73 +920,82 @@ const Summary = () => {
                     </div>
 
                     {/* ==========================================
-                        📊 6. 反響KPI (売り/買い 横並び)
+                        📊 6. 一括査定KPI・買い反響KPI
+                        ⚠️ v2.2.225: 以前のアプリ（renderDash）と同じ列・同じ表示にした（前月比はマイナスもそのまま出す）
                     ========================================== */}
-                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
-                        {/* 売り反響KPI */}
-                        <div style={{ ...s.card, flex: 1, minWidth: '550px' }}>
-                            <div style={s.cardTitle}>
-                                一括査定KPIサマリー（{selectedMonth.replace('-', '年')}月）
-                            </div>
-                            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
-                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
-                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
+                    <div style={s.card}>
+                        <div style={s.cardTitle}>
+                            一括査定KPIサマリー（{monthLabel(selectedMonth)}受信リード・チーム合計）
+                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>売り反響から自動集計</span>
+                        </div>
+                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
+                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
+                                <thead>
+                                    <tr>
+                                        {['リード受信数', '架電数(延べ)', '通電数', '通電率', '訪問査定獲得数', '査定獲得率', '媒介受託数', '受託率(リード比)', '受託率(査定比)', '目標受託数', '目標達成率', '前月比受託数', '反響費用', '媒介獲得単価']
+                                            .map(h => <th key={h} style={{ ...s.th, textAlign: 'right' }}>{h}</th>)}
+                                    </tr>
+                                </thead>
+                                <tbody>
+                                    {sellKpiSummary.leads === 0 && sellKpiSummary.calls === 0 ? (
+                                        <tr><td colSpan={14} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{monthLabel(selectedMonth)}受信のリードはまだ登録されていません</td></tr>
+                                    ) : (
                                         <tr>
-                                            <th style={s.th}>リード数</th>
-                                            <th style={s.th}>架電数</th>
-                                            <th style={s.th}>通電率</th>
-                                            <th style={s.th}>査定率</th>
-                                            <th style={s.th}>受託率(リード比)</th>
-                                            <th style={s.th}>目標達成率</th>
-                                            <th style={s.th}>獲得単価</th>
-                                        </tr>
-                                    </thead>
-                                    <tbody>
-                                        <tr style={{ backgroundColor: '#fff' }}>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{sellKpiSummary.leads}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{sellKpiSummary.calls}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(sellKpiSummary.connects, sellKpiSummary.leads)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(sellKpiSummary.visits, sellKpiSummary.leads)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#198754', fontWeight: 'bold' }}>{calcRate(sellKpiSummary.wins, sellKpiSummary.leads)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#fff8f1', color: '#fd7e14' }}>{calcRate(sellKpiSummary.wins, sellKpiSummary.target)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{sellKpiSummary.wins ? formatYen(sellKpiSummary.cost / sellKpiSummary.wins) : '―'}</td>
+                                            <td style={s.td}>{sellKpiSummary.leads}</td>
+                                            <td style={s.td}>{sellKpiSummary.calls}</td>
+                                            <td style={s.td}>{sellKpiSummary.connects}</td>
+                                            <td style={s.td}>{calcRate(sellKpiSummary.connects, sellKpiSummary.leads)}</td>
+                                            <td style={s.td}>{sellKpiSummary.visits}</td>
+                                            <td style={s.td}>{calcRate(sellKpiSummary.visits, sellKpiSummary.leads)}</td>
+                                            <td style={s.td}>{sellKpiSummary.wins}</td>
+                                            <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.leads)}</td>
+                                            <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.visits)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#fff8e1' }}>{sellKpiSummary.target}</td>
+                                            <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.target)}</td>
+                                            <td style={s.td}>{sellKpiSummary.lastMonthDiff >= 0 ? '+' : ''}{sellKpiSummary.lastMonthDiff}</td>
+                                            <td style={s.td}>{fmtYen0(sellKpiSummary.cost)}</td>
+                                            <td style={s.td}>{sellKpiSummary.wins && sellKpiSummary.cost ? fmtYen(Math.round(sellKpiSummary.cost / sellKpiSummary.wins)) : '―'}</td>
                                         </tr>
-                                    </tbody>
-                                </table>
-                            </div>
+                                    )}
+                                </tbody>
+                            </table>
                         </div>
+                    </div>
 
-                        {/* 買い反響KPI */}
-                        <div style={{ ...s.card, flex: 1, minWidth: '550px' }}>
-                            <div style={s.cardTitle}>
-                                買い反響KPIサマリー（{selectedMonth.replace('-', '年')}月）
-                            </div>
-                            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
-                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
-                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
+                    <div style={s.card}>
+                        <div style={s.cardTitle}>
+                            買い反響KPIサマリー（{monthLabel(selectedMonth)}受信・チーム合計）
+                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>買い反響から自動集計</span>
+                        </div>
+                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
+                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
+                                <thead>
+                                    <tr>
+                                        {['反響受信数', '架電数(延べ)', '通電数', '通電率', '内見数', '内見率', '購入申込', '申込率(反響比)', '成約数', '前月比申込', '反響費用', '申込単価']
+                                            .map(h => <th key={h} style={{ ...s.th, textAlign: 'right' }}>{h}</th>)}
+                                    </tr>
+                                </thead>
+                                <tbody>
+                                    {buyKpiSummary.leads === 0 && buyKpiSummary.calls === 0 ? (
+                                        <tr><td colSpan={12} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{monthLabel(selectedMonth)}受信の買い反響はまだ登録されていません</td></tr>
+                                    ) : (
                                         <tr>
-                                            <th style={s.th}>反響数</th>
-                                            <th style={s.th}>通電率</th>
-                                            <th style={s.th}>内見率</th>
-                                            <th style={s.th}>申込率(反響比)</th>
-                                            <th style={s.th}>成約数</th>
-                                            <th style={s.th}>前月比申込</th>
-                                            <th style={s.th}>申込単価</th>
+                                            <td style={s.td}>{buyKpiSummary.leads}</td>
+                                            <td style={s.td}>{buyKpiSummary.calls}</td>
+                                            <td style={s.td}>{buyKpiSummary.connects}</td>
+                                            <td style={s.td}>{calcRate(buyKpiSummary.connects, buyKpiSummary.leads)}</td>
+                                            <td style={s.td}>{buyKpiSummary.views}</td>
+                                            <td style={s.td}>{calcRate(buyKpiSummary.views, buyKpiSummary.leads)}</td>
+                                            <td style={s.td}>{buyKpiSummary.offers}</td>
+                                            <td style={s.td}>{calcRate(buyKpiSummary.offers, buyKpiSummary.leads)}</td>
+                                            <td style={s.td}>{buyKpiSummary.wins}</td>
+                                            <td style={s.td}>{buyKpiSummary.lastMonthDiff >= 0 ? '+' : ''}{buyKpiSummary.lastMonthDiff}</td>
+                                            <td style={s.td}>{fmtYen0(buyKpiSummary.cost)}</td>
+                                            <td style={s.td}>{buyKpiSummary.offers && buyKpiSummary.cost ? fmtYen(Math.round(buyKpiSummary.cost / buyKpiSummary.offers)) : '―'}</td>
                                         </tr>
-                                    </thead>
-                                    <tbody>
-                                        <tr style={{ backgroundColor: '#fff' }}>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{buyKpiSummary.leads}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(buyKpiSummary.connects, buyKpiSummary.leads)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(buyKpiSummary.views, buyKpiSummary.leads)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#198754', fontWeight: 'bold' }}>{calcRate(buyKpiSummary.offers, buyKpiSummary.leads)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{buyKpiSummary.wins}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>+{buyKpiSummary.lastMonthDiff}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{buyKpiSummary.offers ? formatYen(buyKpiSummary.cost / buyKpiSummary.offers) : '―'}</td>
-                                        </tr>
-                                    </tbody>
-                                </table>
-                            </div>
+                                    )}
+                                </tbody>
+                            </table>
                         </div>
                     </div>
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 1cdda918..44500bf2 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.224';
+export const newVersion = '2.2.225';
```

---
## 追記（同日）: 以前のアプリと同じメニュー・集計・分析（同じ v2.2.225 に追加。まだデプロイ前のため）
### 依頼
- 「旧アプリケーションのダッシュボードを Dashboard のチームサマリーへ。その他は旧アプリケーションのメニューをそのまま移行すること。月次売上管理・月次媒介管理・失注・他決の分析なども追加する。同じ画面で UI のトンマナだけ Dashboard に寄せる形へ」
- 「今日の架電キュー・架電ナビ（一括査定）なども。旧アプリの 日々の行動・集計・分析・入力・台帳 といったラベルも Dashboard のメニューに表示する。Menu.tsx が不都合なら realty 内に独自の Menu コンポーネントを準備してもよい」
- 利用者の回答（AskUserQuestion）: 明日までは「メニュー＋集計・分析」を先に／月次報告書・掲載物件一覧は最後に残す／call_logs・practice_logs は Supabase から CSV で出してもらう（架電ナビの版で）／AI ロープレはあとで決める

### 決めたこと・作ったもの
- **realty/RealtyMenu.tsx（新規）**: 以前のアプリの VIEWS と同じ見出し（日々の行動・集計・分析・入力・台帳・点検・管理）と順番。「ダッシュボード」は「チームサマリー」。最後に見出し「Dashboard」（月次報告書・掲載物件一覧）。未移行は「移行中」→ /realtyPending?view=…（**realty/RealtyPending.tsx（新規）**: 以前のアプリへの案内）。Menu.tsx は category = realty のときこれを出し、MENU_CONFIG の不動産企画係の項目は消した
- **realty/sales/MonthlySales.tsx（新規）**: 月次売上管理（renderSales・salesChart・drillSales）。**common/ComboChart.tsx（新規）**: 2軸の複合グラフ（comboChart・niceMax・svgTextW）
- **realty/bmonthly/BaikaiMonthly.tsx（新規・分身）**: 月次媒介管理（renderBMonthly）
- **realty/lost/LostAnalysis.tsx（新規・分身）**: 失注・他決の分析（renderLost）。他決の詳細などは raw_data から読む
- **realty/summary/CommandCenter.tsx（新規・分身）**: 営業司令塔（V12 の端末計算 local。Supabase の RPC と同じ配点）。チームサマリーの最下段。「次回設定」（書き込み）は作らず「開く」で各画面へ
- **realty/summary/resaleAlerts.ts（新規）**: 朝礼用アラートの買取再販の期限（RSA.dashAlerts・alertsOf・deadlines）
- Summary.tsx: 以前のダッシュボードと同じ並びにした（上にあった Dashboard 独自の営業司令塔と、その計算 dashboardSummary・toDoSummary・isOver など を削除）。買取再販の期限アラートを朝礼用アラートの最後に
- kpi.ts: dealFee・dealReform・dealReformGp・dealSales・dealShares・sumByStaffMonth（filter つき）・fmtMan・shareOf を export
- ② `planner:records`（種類を指定して行と設定を読む。削除済みは除く）。express_proxy.php の両方の一覧に。realtyState.ts に loadRecords
- 業務ガイド: 新規「月次売上管理」「月次媒介管理」「失注・他決の分析」（各・不動産企画係）、「不動産企画係の画面（入口と権限）」にメニューの節、「チームサマリー」を以前のダッシュボードの並びに

### 確認したこと
- メニュー（Playwright）: 見出し5つ・項目の並びが以前のアプリと同じ、未移行5つに「移行中」、各画面で選ばれた項目が光る
- チームサマリーの並び（画面の写しで確認）・買取再販の期限アラートの表示
- 月次売上管理: 担当者別の今期12か月（万円表示）が以前のアプリの計算（バックアップに当てたもの）と**一致**。セルを押すと内訳
- 月次媒介管理（分身）: 全33行・今期12か月の全セルで違い0
- 失注・他決の分析（分身）: 16期間で数字は一致（並び順と、未入力の一覧の先頭50件の選ばれ方だけが違う。以前のアプリでも決まった順ではない）
- 営業司令塔（分身）: 全員分・自分の担当分ともタイル・3タブ（各40行）・点数の内訳まで一致（今日=2026-10-28 で固定）
- 歩留まりの58項目の突き合わせも、組み込み後にもう一度**すべて一致**
- 型チェック・本番ビルド・① を通した planner:records の 401

### frontend/src/components/realty/RealtyMenu.tsx（新規・全文）
```tsx
import React from 'react';

/**
 * 不動産企画係のメニュー（v2.2.225）。Menu.tsx が category = realty のときだけ、通常の項目の代わりに出す。
 *
 * ⚠️ 並び・見出し・名前は以前のアプリ（V18 の VIEWS）と同じ。「ダッシュボード」は Dashboard では「チームサマリー」。
 *   ⚠️ 2026-10-28 の指示: 旧アプリのメニューをそのまま移行。見出し（日々の行動・集計・分析・入力・台帳・点検・管理）も出す。
 *   見た目（アイコン・選ばれたときの色）は Dashboard のメニュー（.category_menu）に合わせる。
 * ⚠️ まだ移していない画面は「移行中」を付け、/realtyPending?view=… で以前のアプリを案内する。移したら path を差し替える。
 * ⚠️ URL は1段にする（`/realty/…` にしない。App.tsx の注記）。
 */

export type RealtyMenuItem = { id: string; path: string; icon: string; label: string; pending?: boolean; spOk?: boolean };
type Group = { label: string; items: RealtyMenuItem[] };

export const REALTY_MENU: Group[] = [
    {
        label: '日々の行動', items: [
            { id: 'callq', path: '/realtyPending?view=callq', icon: 'fa-phone', label: '今日の架電キュー', pending: true },
            { id: 'navi', path: '/realtyPending?view=navi', icon: 'fa-compass', label: '架電ナビ（一括査定）', pending: true },
        ],
    },
    {
        label: '集計・分析', items: [
            { id: 'dash', path: '/summary', icon: 'fa-chart-line', label: 'チームサマリー' },
            { id: 'sales', path: '/realtySales', icon: 'fa-chart-column', label: '月次売上管理' },
            { id: 'bmonthly', path: '/realtyBaikaiMonthly', icon: 'fa-chart-area', label: '月次媒介管理' },
            { id: 'lost', path: '/realtyLost', icon: 'fa-puzzle-piece', label: '失注・他決の分析' },
        ],
    },
    {
        label: '入力・台帳', items: [
            { id: 'leads', path: '/leadSell', icon: 'fa-envelope-open-text', label: '売り反響（一括査定）' },
            { id: 'buyleads', path: '/leadBuy', icon: 'fa-house', label: '買い反響（ポータル）' },
            { id: 'deals', path: '/leadOpportunity', icon: 'fa-tags', label: '商談案件管理' },
            { id: 'resale', path: '/leadResale', icon: 'fa-hammer', label: '買取再販案件' },
            { id: 'ledger', path: '/broker', icon: 'fa-file-signature', label: '媒介獲得台帳', spOk: true },
            { id: 'srep', path: '/realtyPending?view=srep', icon: 'fa-bullhorn', label: '売主への販売報告', pending: true },
            { id: 'renew', path: '/realtyPending?view=renew', icon: 'fa-clipboard-list', label: '媒介更新履歴', pending: true },
            { id: 'weekly', path: '/realtyWeekly', icon: 'fa-calendar-week', label: '週次行動計画' },
        ],
    },
    {
        label: '点検・管理', items: [
            { id: 'quality', path: '/realtyPending?view=quality', icon: 'fa-magnifying-glass', label: 'データ品質チェック', pending: true },
            { id: 'comp', path: '/realtyCompliance', icon: 'fa-triangle-exclamation', label: 'コンプライアンス' },
            { id: 'settings', path: '/realtySettings', icon: 'fa-gear', label: '設定・データ管理' },
        ],
    },
    {
        // ⚠️ 2026-10-28: Dashboard にだけある画面は最後に残す
        label: 'Dashboard', items: [
            { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書' },
            { id: 'property', path: '/property', icon: 'fa-building', label: '掲載物件一覧', spOk: true },
        ],
    },
];

/** 移行中の画面の名前（RealtyPending.tsx が使う） */
export const pendingLabelOf = (view: string): string =>
    REALTY_MENU.flatMap(g => g.items).find(i => i.pending && i.id === view)?.label ?? '';

const STYLE = `
.rlt-menu-grp { font-size: 10px; font-weight: bold; color: #868e96; letter-spacing: .08em; padding: 10px 8px 2px 12px; }
.rlt-menu-pending { font-size: 8px; padding: 1px 4px; border-radius: 3px; background: #e9ecef; color: #6c757d; margin-left: 6px; }
`;

type Props = {
    isSp: boolean;
    /** 選ばれているか（Menu.tsx の判定をそのまま使う） */
    isActive: (path: string) => boolean;
    onNavigate: (path: string) => void;
};

const RealtyMenu: React.FC<Props> = ({ isSp, isActive, onNavigate }) => (
    <>
        <style>{STYLE}</style>
        {REALTY_MENU.map(g => {
            // ⚠️ スマホでは以前の Dashboard と同じく、台帳・物件だけ出す（ほかは PC 幅の画面）
            const items = g.items.filter(i => !isSp || i.spOk);
            if (items.length === 0) return null;
            return (
                <React.Fragment key={g.label}>
                    <div className="rlt-menu-grp">{g.label}</div>
                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`position-relative category_menu ps-3 ${isActive(item.path) ? 'selected' : ''}`}
                            onClick={() => onNavigate(item.path)}
                        >
                            <i className={`fa-solid ${item.icon} me-1 text-secondary`}></i>
                            {item.label}
                            {item.pending && <span className="rlt-menu-pending">移行中</span>}
                        </div>
                    ))}
                </React.Fragment>
            );
        })}
    </>
);

export default RealtyMenu;
```

### frontend/src/components/realty/RealtyPending.tsx（新規・全文）
```tsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { REALTY_CSS } from './common/realtyState';
import { pendingLabelOf } from './RealtyMenu';

/**
 * まだ移していない画面の案内（v2.2.225）。メニューの「移行中」の項目から開く（/realtyPending?view=…）。
 * ⚠️ 移し終えたら RealtyMenu.tsx の path を本物の画面に差し替える。
 */

/** 以前のアプリ（移すまではこちらを使う） */
const OLD_APP_URL = 'https://khf-eigyokanri.netlify.app/';

const RealtyPending: React.FC = () => {
    const [params] = useSearchParams();
    const label = pendingLabelOf(params.get('view') ?? '') || 'この画面';
    return (
        <div className="rlt-page">
            <style>{REALTY_CSS}</style>
            <div className="rlt-head"><h1><i className="fa-solid fa-person-digging me-2" style={{ color: '#0d6efd' }}></i>{label}</h1></div>
            <div className="rlt-card">
                <div className="rlt-body" style={{ paddingTop: 16, fontSize: 13 }}>
                    <p>「{label}」は、いま Dashboard へ移している途中です。移し終えるまでは、以前のアプリの同じ画面をお使いください。</p>
                    <a className="rlt-btn" href={OLD_APP_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', textDecoration: 'none' }}>
                        以前のアプリを開く <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default RealtyPending;
```

### frontend/src/components/realty/common/ComboChart.tsx（新規・全文）
```tsx
import React from 'react';
import { monthLabel } from '../summary/kpi';

/**
 * 2軸の複合グラフ（棒＝左軸、折れ線＝右軸の％）。v2.2.225。
 * ⚠️ 移植元は以前のアプリの comboChart（niceMax・svgTextW を含む）。目盛り・色・凡例・数字の出し方を同じにしている。
 */

export type ComboBar = { name: string; vals: number[]; fill: string; stroke?: string; overlay?: { name: string; vals: number[]; fill: string } };

type Props = {
    mks: string[];
    bars: ComboBar[];
    line?: { name: string; vals: (number | null)[]; color?: string };
    W?: number;
    H?: number;
    minMax?: number;
    aria?: string;
    axisL?: string;
    axisR?: string;
    /** 左軸の目盛り */
    fmtL: (v: number) => string;
    /** 棒の上の数字 */
    fmtB: (v: number) => string;
    /** ツールチップ */
    fmtT: (v: number) => string;
};

/** 切りのよい最大値（niceMax） */
const niceMax = (v: number): number => {
    if (!(v > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / e;
    const st = m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return st * e;
};

/** 文字の幅の見積もり（svgTextW） */
const textW = (t: string): number => {
    let w = 0;
    for (const ch of t) w += ch.charCodeAt(0) < 128 ? 5.6 : 10;
    return w;
};

const mShort = (mk: string) => `${Number(mk.slice(5, 7))}月`;

const ComboChart: React.FC<Props> = (o) => {
    const mks = o.mks;
    const n = mks.length || 1;
    const W = o.W ?? 880, H = o.H ?? 300;
    const pad = { l: 66, r: 62, t: 36, b: 34 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / n;
    const groups = o.bars.filter(g => g && g.vals);
    let maxL = o.minMax ?? 1;
    for (const g of groups) {
        for (const v of g.vals) if (v > maxL) maxL = v;
        if (g.overlay) for (const v of g.overlay.vals) if (v > maxL) maxL = v;
    }
    maxL = niceMax(maxL);
    const lv = o.line?.vals ?? [];
    const lc = o.line?.color ?? '#1a6b3c';
    let maxR = 100;
    for (const v of lv) if (v !== null && v > maxR) maxR = v;
    maxR = Math.ceil(maxR / 25) * 25;
    const T = 4;
    const yL = (v: number) => pad.t + ih - (ih * Math.min(v, maxL)) / maxL;
    const yR = (v: number) => pad.t + ih - (ih * Math.min(v, maxR)) / maxR;
    const gn = groups.length || 1, slot = (bw * 0.78) / gn, off = bw * 0.11;
    const hasLine = !!o.line && lv.some(v => v !== null);

    // 凡例の並び
    const legend: React.ReactNode[] = [];
    let lx = pad.l;
    const chip = (key: string, fill: string, label: string, stroke?: string) => {
        legend.push(
            <g key={key}>
                <rect x={lx} y={7} width={10} height={10} fill={fill} stroke={stroke} />
                <text x={lx + 14} y={16} fontSize={10} fill="#57534e">{label}</text>
            </g>
        );
        lx += 18 + textW(label);
    };
    groups.forEach((g, i) => { chip(`b${i}`, g.fill, g.name, g.stroke); if (g.overlay) chip(`o${i}`, g.overlay.fill, g.overlay.name); });

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={o.aria ?? '複合グラフ'} style={{ maxWidth: '100%', height: 'auto' }}>
            {Array.from({ length: T + 1 }, (_, i) => {
                const y = pad.t + (ih * i) / T, a = (maxL * (T - i)) / T, b = (maxR * (T - i)) / T;
                return (
                    <g key={`t${i}`}>
                        <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#e6e4e0" />
                        <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#78716c">{o.fmtL(a)}</text>
                        <text x={W - pad.r + 6} y={y + 4} textAnchor="start" fontSize={10} fill={lc}>{Math.round(b)}%</text>
                    </g>
                );
            })}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke="#c9c3ba" />
            <line x1={W - pad.r} y1={pad.t} x2={W - pad.r} y2={pad.t + ih} stroke={lc} opacity={0.55} />
            {mks.map((mk, i) => {
                const last = groups[groups.length - 1];
                const lvv = last ? last.vals[i] || 0 : 0;
                const lcx = pad.l + bw * i + off + slot * (gn - 1) + slot * 0.45;
                return (
                    <g key={mk}>
                        {groups.map((g, gi) => {
                            const x = pad.l + bw * i + off + slot * gi, w = slot * 0.9, v = g.vals[i] || 0;
                            const ov = g.overlay ? g.overlay.vals[i] || 0 : 0;
                            return (
                                <g key={gi}>
                                    {v > 0 && <rect x={x} y={yL(v)} width={w} height={pad.t + ih - yL(v)} fill={g.fill} stroke={g.stroke}><title>{`${mShort(mk)} ${g.name}：${o.fmtT(v)}`}</title></rect>}
                                    {ov > 0 && g.overlay && <rect x={x} y={yL(ov)} width={w} height={pad.t + ih - yL(ov)} fill={g.overlay.fill}><title>{`${mShort(mk)} ${g.overlay.name}：${o.fmtT(ov)}`}</title></rect>}
                                </g>
                            );
                        })}
                        {lvv > 0 && <text x={lcx} y={yL(lvv) - 4} textAnchor="middle" fontSize={9} fill="#44403c">{o.fmtB(lvv)}</text>}
                        <text x={pad.l + bw * i + bw / 2} y={pad.t + ih + 15} textAnchor="middle" fontSize={10} fill="#57534e">{mShort(mk)}</text>
                    </g>
                );
            })}
            {hasLine && (
                <>
                    {maxR >= 100 && <line x1={pad.l} y1={yR(100)} x2={W - pad.r} y2={yR(100)} stroke={lc} strokeDasharray="4 3" opacity={0.45}><title>年間目標 100%</title></line>}
                    {(() => {
                        const pts = lv.map((v, i) => (v === null ? null : `${pad.l + bw * i + bw / 2},${yR(v)}`)).filter(Boolean);
                        return pts.length > 1 ? <polyline fill="none" stroke={lc} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} /> : null;
                    })()}
                    {lv.map((v, i) => v === null ? null : (
                        <g key={`p${i}`}>
                            <circle cx={pad.l + bw * i + bw / 2} cy={yR(v)} r={3.4} fill="#fff" stroke={lc} strokeWidth={1.8}><title>{`${monthLabel(mks[i])} 累計達成進捗率：${v.toFixed(1)}%`}</title></circle>
                            <text x={pad.l + bw * i + bw / 2} y={yR(v) - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={lc} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{v.toFixed(0)}%</text>
                        </g>
                    ))}
                </>
            )}
            {legend}
            {hasLine && (
                <g>
                    <line x1={lx} y1={12} x2={lx + 16} y2={12} stroke={lc} strokeWidth={2} />
                    <circle cx={lx + 8} cy={12} r={3.2} fill="#fff" stroke={lc} strokeWidth={1.6} />
                    <text x={lx + 21} y={16} fontSize={10} fill={lc}>{o.line?.name}</text>
                </g>
            )}
            <text x={pad.l - 6} y={pad.t - 9} textAnchor="end" fontSize={9} fill="#78716c">{o.axisL ?? ''}</text>
            <text x={W - pad.r + 6} y={pad.t - 9} textAnchor="start" fontSize={9} fill={lc}>{o.axisR ?? ''}</text>
        </svg>
    );
};

export default ComboChart;
```

### frontend/src/components/realty/sales/MonthlySales.tsx（新規・全文）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import ComboChart from '../common/ComboChart';
import {
    CONFIRMED, dealCountByStaffMonth, dealFee, dealReform, dealReformGp, dealSales, fiscalMonths, fmtCnt, fmtMan, fmtYen, fmtYen0,
    monthLabel, pct, shareOf, sumByStaffMonth, sumRow, todayStr,
} from '../summary/kpi';
import type { Row, Settings, StaffMonth } from '../summary/kpi';

/**
 * 月次売上管理（不動産企画係。v2.2.225）。
 *
 * ⚠️ 移植元は以前のアプリの「📈 月次売上管理」（renderSales・salesChart・drillSales）。表・グラフ・内訳の中身は同じ。見た目だけ Dashboard に寄せた。
 *   ・契約日＝計上月。失注は除く。売上計上額＝仲介手数料＋リフォーム粗利（受注額は参考）
 *   ・共同担当は売上を割合で按分、件数は0.5件ずつ（kpi.ts の dealShares）
 * ⚠️ 内訳の「書類」の列（以前のアプリの書類添付）は、書類の移植の段で足す。
 */

const STYLE = `
.rlt-sl-tbl td.clk { cursor: pointer; }
.rlt-sl-tbl td.clk:hover { background: #e7f1ff !important; }
.rlt-sl-tbl td.auto { background: #f3faf5; }
.rlt-sl-tbl td.warn { background: #fff8e1; }
.rlt-sl-chips { display: flex; gap: 6px; margin-left: auto; }
.rlt-sl-chip { font-size: 11px; border: 1px solid #ced4da; border-radius: 12px; padding: 2px 10px; background: #fff; cursor: pointer; }
.rlt-sl-chip.on { background: #0d6efd; border-color: #0d6efd; color: #fff; }
.rlt-sl-modal { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1050; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; }
.rlt-sl-modal .box { background: #fff; border-radius: 8px; max-width: 1200px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
.rlt-sl-modal .head { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: bold; font-size: 14px; }
.rlt-sl-badge { display: inline-block; font-size: 10px; font-weight: bold; border-radius: 4px; padding: 1px 6px; }
`;

/** フェーズのバッジ（phaseBadge） */
const PHASE_COLORS: Record<string, [string, string]> = {
    決済完了: ['#e9ecef', '#495057'], 契約済: ['#d1e7dd', '#0f5132'], 契約予定: ['#cfe2ff', '#084298'], 失注: ['#f8d7da', '#842029'],
};
const PhaseBadge: React.FC<{ phase: string }> = ({ phase }) => {
    const [bg, fg] = PHASE_COLORS[phase] ?? ['#fff3cd', '#664d03'];
    return <span className="rlt-sl-badge" style={{ background: bg, color: fg }}>{phase}</span>;
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const mShort = (mk: string) => `${Number(mk.slice(5, 7))}月`;

type RfMode = 'price' | 'gp' | 'fee';
type Drill = { staff: string; mk: string; mode: 'all' | 'conf' };

/** 累計の線を引く最後の月（cumEnd）: 実績のある最後の月と今月の遅いほう */
const cumEnd = (mks: string[], vals: number[]): number => {
    let last = -1;
    vals.forEach((v, i) => { if (v) last = i; });
    return Math.max(last, mks.indexOf(todayStr().slice(0, 7)));
};

const MonthlySales: React.FC = () => {
    const [deals, setDeals] = useState<Row[]>([]);
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const [rfMode, setRfMode] = useState<RfMode>('price'); // 以前のアプリの S.salesRfMode の既定
    const [drill, setDrill] = useState<Drill | null>(null);

    useEffect(() => {
        loadRecords(['deals'])
            .then(r => { setDeals(r.records.deals); setSettings(r.settings); })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const mks = useMemo(() => fiscalMonths(settings.fiscalStart), [settings.fiscalStart]);
    const rows = useMemo(() => (settings.staff ?? []).filter(s => s.name), [settings.staff]);
    const agg = useMemo(() => ({
        all: sumByStaffMonth(deals, dealSales),
        conf: sumByStaffMonth(deals, dealSales, d => CONFIRMED.includes(str(d.phase))),
        cnt: dealCountByStaffMonth(deals),
        fee: sumByStaffMonth(deals, dealFee),
        rfP: sumByStaffMonth(deals, dealReform),
        rfG: sumByStaffMonth(deals, dealReformGp),
    }), [deals]);

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const { all, conf, cnt, fee: feeOnly, rfP, rfG } = agg;
    const cell = (m: StaffMonth, name: string, mk: string) => m[name]?.[mk] ?? 0;
    const teamMonth = (m: StaffMonth, mk: string) => rows.reduce((a, s) => a + cell(m, String(s.name), mk), 0);
    const teamYear = (m: StaffMonth) => rows.reduce((a, s) => a + sumRow(m[String(s.name)], mks), 0);

    // ① 担当者別 月次売上
    const annuals = rows.map(s => ({ s, tot: sumRow(all[String(s.name)], mks) }));
    const rank = [...annuals].sort((a, b) => b.tot - a.tot);
    const teamTot = annuals.reduce((a, x) => a + x.tot, 0);
    const teamBud = rows.reduce((a, s) => a + (Number(s.budget) || 0), 0);

    // グラフ（salesChart）
    const vals = mks.map(mk => teamMonth(all, mk));
    const cvals = mks.map(mk => teamMonth(conf, mk));
    const mGoal = rows.reduce((a, s) => a + (Number(s.monthlyGoal) || 0), 0);
    const tgt = mks.map(() => (mGoal > 0 ? mGoal : teamBud ? Math.round(teamBud / 12) : 0));
    const end = cumEnd(mks, vals);
    let cum = 0;
    const line = vals.map((v, i) => { cum += v; return teamBud > 0 && i <= end ? (cum / teamBud) * 100 : null; });

    // ③ リフォーム
    const RSET = {
        price: { d: rfP, ttl: 'リフォーム受注額（売上には計上しません）' },
        gp: { d: rfG, ttl: 'リフォーム粗利（売上に計上）' },
        fee: { d: feeOnly, ttl: '仲介手数料のみ（リフォーム粗利を除く）' },
    }[rfMode];
    const yFee = teamYear(feeOnly), ySales = teamYear(all), yRf = teamYear(rfP), yRg = teamYear(rfG);

    const clk = (v: number, d: Drill) => (v ? { className: 'r auto clk', onClick: () => setDrill(d), title: 'クリックで内訳表示' } : { className: 'r auto' });

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-chart-line me-2" style={{ color: '#0d6efd' }}></i>月次売上管理</h1>
                <p className="rlt-sub">契約日＝計上月・単位:円。商談案件管理から自動集計（緑）。失注は除外。<b>リフォームは受注額ではなく粗利を売上に計上</b>し、仲介手数料と合算しています。内訳は③で確認できます。</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>担当者別 月次売上（仲介手数料＋リフォーム粗利）</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}
                    <th className="r">年間実績</th><th className="r">年間目標</th><th className="r">達成率</th><th className="r">順位</th>
                </tr></thead><tbody>
                    {annuals.map(({ s, tot }) => {
                        const n = String(s.name);
                        const r = rank.findIndex(x => x.s === s) + 1;
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(all, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'all' })}>{v ? fmtMan(v) : '0'}</td>; })}
                                <td className="r"><b>{fmtYen(tot)}</b></td><td className="r warn">{fmtYen(Number(s.budget) || 0)}</td>
                                <td className="r">{s.budget ? pct(tot / Number(s.budget)) : '―'}</td><td className="r">{tot > 0 ? r : '-'}</td>
                            </tr>
                        );
                    })}
                    <tr className="total">
                        <td>チーム合計</td>
                        {mks.map(mk => { const v = teamMonth(all, mk); return <td key={mk} {...clk(v, { staff: '', mk, mode: 'all' })} className={`r ${v ? 'clk' : ''}`}>{fmtMan(v)}</td>; })}
                        <td className="r">{fmtYen(teamTot)}</td><td className="r">{fmtYen(teamBud)}</td><td className="r">{teamBud ? pct(teamTot / teamBud) : '―'}</td><td></td>
                    </tr>
                </tbody></table></div>
                <div className="rlt-body rlt-sub" style={{ paddingTop: 8 }}>月別セルは万円表示・年間は円表示です。数字の入ったセルをクリックすると、その月の内訳（物件・顧客・手数料・リフォーム）が表示されます。この表は<b>売上計上額（仲介手数料＋リフォーム粗利）</b>の集計です。リフォーム受注額は売上に含めません。</div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>月次売上グラフ（2軸複合：棒＝実績・目標／折線＝累計達成進捗率）</h3>
                    <span className="rlt-note">左軸＝月次の売上目標と実績（濃紺＝確定／淡色＝見込含む全体）。右軸＝年間予算に対する、その月までの累計達成進捗率</span></div>
                <div className="rlt-body" style={{ overflowX: 'auto' }}>
                    <ComboChart
                        mks={mks} W={880} H={300} minMax={1000000}
                        aria="月次売上（実績・目標）と年間予算に対する累計達成進捗率の2軸複合グラフ"
                        axisL="金額（万円）" axisR="累計達成率（％）"
                        fmtL={v => `${(v / 10000).toFixed(0)}万`} fmtB={v => (v / 10000).toFixed(0)} fmtT={v => fmtYen(v)}
                        bars={[
                            { name: '月次目標', vals: tgt, fill: '#efece7', stroke: '#c9c3ba' },
                            { name: '実績（見込含む）', vals, fill: '#b9c8d4', overlay: { name: 'うち確定', vals: cvals, fill: '#22405c' } },
                        ]}
                        line={{ name: '累計達成進捗率（年間予算比）', vals: line, color: '#1a6b3c' }}
                    />
                </div>
                <div className="rlt-body rlt-sub">月次目標は設定の「今月目標売上」の合計（未設定なら年間予算÷12）。累計達成進捗率＝（当月までの実績累計 ÷ 年間予算合計）で、上の表の「達成率」と同じ基準（見込を含む）です。グラフは売上計上額（仲介手数料＋リフォーム粗利）ベースです。</div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>内訳①：確定売上（契約済＋契約予定＋決済完了）</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}<th className="r">年間確定計</th><th className="r">見込み残</th>
                </tr></thead><tbody>
                    {rows.map(s => {
                        const n = String(s.name);
                        const cTot = sumRow(conf[n], mks), aTot = sumRow(all[n], mks);
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(conf, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'conf' })}>{fmtMan(v)}</td>; })}
                                <td className="r"><b>{fmtYen(cTot)}</b></td><td className="r">{fmtYen(aTot - cTot)}</td>
                            </tr>
                        );
                    })}
                </tbody></table></div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>内訳②：月次契約件数（契約日ベース）</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}<th className="r">年間件数</th><th className="r">1件平均売上</th>
                </tr></thead><tbody>
                    {rows.map(s => {
                        const n = String(s.name);
                        const c = sumRow(cnt[n], mks), tot = sumRow(all[n], mks);
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(cnt, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'all' })}>{fmtCnt(v)}</td>; })}
                                <td className="r"><b>{fmtCnt(c)}</b></td><td className="r">{c ? fmtYen(tot / c) : '―'}</td>
                            </tr>
                        );
                    })}
                </tbody></table></div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head">
                    <h3>内訳③：仲介手数料／リフォーム粗利・受注額</h3>
                    <span className="rlt-note">商談案件管理で入力したリフォーム受注額・粗利を契約日の月に計上（失注は除外・共同担当は売上割合で按分）。<b>売上に計上されるのは粗利のみ</b>です</span>
                    <div className="rlt-sl-chips">
                        {([['fee', '仲介手数料のみ'], ['gp', 'リフォーム粗利'], ['price', 'リフォーム受注額（参考）']] as const).map(([k, l]) => (
                            <button key={k} className={`rlt-sl-chip ${rfMode === k ? 'on' : ''}`} onClick={() => setRfMode(k)}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="rlt-body rlt-sub">年間累計　仲介手数料 <b>{fmtYen(yFee)}</b>　＋　リフォーム粗利 <b>{fmtYen(yRg)}</b>　＝　売上計上額 <b>{fmtYen(ySales)}</b>　／　参考：リフォーム受注額 <b>{fmtYen0(yRf)}</b>（粗利率 {yRf ? pct(yRg / yRf) : '―'}）</div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者<br /><span className="rlt-note">{RSET.ttl}</span></th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}<th className="r">年間計</th>
                    {rfMode === 'fee' ? <><th className="r">年間リフォーム<br />粗利</th><th className="r">売上計上額</th></>
                        : rfMode === 'gp' ? <><th className="r">年間受注額</th><th className="r">粗利率</th></>
                            : <><th className="r">年間粗利</th><th className="r">粗利率</th></>}
                </tr></thead><tbody>
                    {rows.map(s => {
                        const n = String(s.name);
                        const yv = sumRow(RSET.d[n], mks), sp = sumRow(rfP[n], mks), sg = sumRow(rfG[n], mks);
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(RSET.d, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'all' })}>{v ? fmtMan(v) : '0'}</td>; })}
                                <td className="r"><b>{fmtYen(yv)}</b></td>
                                {rfMode === 'fee' ? <><td className="r">{fmtYen0(sg)}</td><td className="r"><b>{fmtYen(yv + sg)}</b></td></>
                                    : <><td className="r">{fmtYen0(rfMode === 'gp' ? sp : sg)}</td><td className="r">{sp ? pct(sg / sp) : '―'}</td></>}
                            </tr>
                        );
                    })}
                    {(() => {
                        const tv = mks.map(mk => teamMonth(RSET.d, mk));
                        const yv = tv.reduce((a, x) => a + x, 0);
                        return (
                            <tr className="total">
                                <td>チーム合計</td>
                                {mks.map((mk, i) => <td key={mk} className={`r ${tv[i] ? 'clk' : ''}`} onClick={tv[i] ? () => setDrill({ staff: '', mk, mode: 'all' }) : undefined}>{fmtMan(tv[i])}</td>)}
                                <td className="r">{fmtYen(yv)}</td>
                                {rfMode === 'fee' ? <><td className="r">{fmtYen0(yRg)}</td><td className="r"><b>{fmtYen(yv + yRg)}</b></td></>
                                    : <><td className="r">{fmtYen0(rfMode === 'gp' ? yRf : yRg)}</td><td className="r">{yRf ? pct(yRg / yRf) : '―'}</td></>}
                            </tr>
                        );
                    })()}
                </tbody></table></div>
                <div className="rlt-body rlt-sub" style={{ paddingTop: 8 }}>月別セルは万円表示・年間計は円表示です。「リフォーム受注額」は売上には計上せず、粗利率を確認するための参考値として表示しています。上部の月次売上表・グラフ・年間予算進捗は、いずれも<b>仲介手数料＋リフォーム粗利</b>で集計しています。</div>
            </div>

            {drill && <SalesDrill deals={deals} drill={drill} onClose={() => setDrill(null)} />}
        </div>
    );
};

/** セルを押したときの内訳（drillSales）。⚠️ 担当者を指定して開いたときは按分後の金額 */
const SalesDrill: React.FC<{ deals: Row[]; drill: Drill; onClose: () => void }> = ({ deals, drill, onClose }) => {
    const { staff, mk, mode } = drill;
    const list = deals.filter(d => {
        const cd = str(d.contractDate);
        if (!cd || cd.slice(0, 7) !== mk) return false;
        if (str(d.phase) === '失注') return false;
        if (staff && d.staff !== staff && d.subStaff !== staff) return false;
        if (mode === 'conf' && !CONFIRMED.includes(str(d.phase))) return false;
        return true;
    }).sort((a, b) => (str(a.contractDate) < str(b.contractDate) ? -1 : 1));
    const title = `${staff || 'チーム全体'}　${monthLabel(mk)}${mode === 'conf' ? '　確定売上の内訳' : '　売上内訳'}`;
    let tot = 0, rTot = 0, gTot = 0;
    const lines = list.map(d => {
        const fee = staff ? shareOf(d, staff, dealFee) : dealFee(d);
        const rf = staff ? shareOf(d, staff, dealReform) : dealReform(d);
        const rg = staff ? shareOf(d, staff, dealReformGp) : dealReformGp(d);
        tot += fee; rTot += rf; gTot += rg;
        return { d, fee, rf, rg };
    });
    return (
        <div className="rlt-sl-modal" onClick={onClose}>
            <div className="box" onClick={e => e.stopPropagation()}>
                <div className="head">📈 {title}<button className="rlt-btn sec" style={{ marginLeft: 'auto' }} onClick={onClose}>閉じる</button></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl"><thead><tr>
                    <th>物件名</th><th>種別</th><th>顧客名</th>{!staff && <th>担当</th>}
                    <th className="r">成約価格(円)</th><th className="r">仲介手数料(円)</th><th className="r">リフォーム<br />受注額(円)<br /><span className="rlt-note">※参考</span></th>
                    <th className="r">リフォーム<br />粗利(円)</th><th className="r">売上計上額(円)<br /><span className="rlt-note">手数料＋粗利</span></th><th>フェーズ</th><th>契約日</th>
                </tr></thead><tbody>
                    {lines.map(({ d, fee, rf, rg }) => (
                        <tr key={str(d.id)}>
                            <td>{str(d.property)}{d.reformNote ? <div className="rlt-note">🔧{str(d.reformNote)}</div> : null}</td>
                            <td>{str(d.type)}</td><td>{str(d.customer)}</td>
                            {!staff && <td>{str(d.staff)}{d.subStaff ? <><br /><span className="rlt-note">+{str(d.subStaff)}({Number(d.subRatio) || 0}%)</span></> : null}</td>}
                            <td className="r">{fmtYen(Number(d.price) || 0)}</td>
                            <td className="r" style={Number(d.feeManual) ? { background: '#fff8e1' } : undefined}>
                                {fmtYen(fee)}
                                {d.subStaff && d.subRatio ? <><br /><span className="rlt-note">按分 {str(d.staff)}{100 - (Number(d.subRatio) || 0)}% / {str(d.subStaff)}{Number(d.subRatio) || 0}%</span></> : null}
                            </td>
                            <td className="r">{fmtYen0(rf)}</td><td className="r">{fmtYen0(rg)}</td><td className="r"><b>{fmtYen(fee + rg)}</b></td>
                            <td><PhaseBadge phase={str(d.phase)} /></td><td>{str(d.contractDate).replace(/-/g, '/')}</td>
                        </tr>
                    ))}
                    {lines.length === 0 && <tr><td colSpan={staff ? 10 : 11} className="rlt-sub" style={{ textAlign: 'center' }}>該当なし</td></tr>}
                    <tr className="total">
                        <td colSpan={staff ? 3 : 4}>合計 {lines.length}件</td><td></td><td className="r">{fmtYen(tot)}</td>
                        <td className="r">{fmtYen0(rTot)}</td><td className="r">{fmtYen0(gTot)}</td><td className="r"><b>{fmtYen(tot + gTot)}</b></td><td colSpan={2}></td>
                    </tr>
                </tbody></table></div>
                <p className="rlt-sub" style={{ padding: '8px 16px' }}>手数料が黄色の行は手入力額（規定計算式と異なる金額）です。リフォーム受注額・粗利は商談案件管理で入力した金額（担当者を指定して開いた場合は按分後）。<b>売上計上額＝仲介手数料＋リフォーム粗利</b>で、受注額は売上に含めません。</p>
            </div>
        </div>
    );
};

export default MonthlySales;
```

### frontend/src/components/realty/summary/resaleAlerts.ts（新規・全文）
```tsx
/**
 * 朝礼用アラートの「🏗 買取再販の期限・要対応」（v2.2.225）。
 *
 * ⚠️ 移植元は以前のアプリの RSA モジュールの dashAlerts・alertsOf・deadlines（と rsHoldDays・daysTo）。判定と文言は同じ。
 *   ・保有中（仕入決済済（保有）・工事中・販売中・売買契約済）の案件だけ
 *   ・在庫180日以上（365日以上は赤）／取得後2年まで180日以内（90日以内は赤）／居住用賃貸なら第3年度末まで180日以内
 *   ・土地以外で仕入建物の按分が無い（黄）・販売価格があるのに販売建物の按分が無い（赤）
 * ⚠️ 按分の情報（anbun）と期首月（settings.rsVat.fyStart）は DB の列に無いので、原本（raw_data）と設定から読む。
 */
import type { Row } from './kpi';
import { todayStr } from './kpi';

const RS_HOLD = ['仕入決済済（保有）', '工事中', '販売中', '売買契約済'];
const RS_DONE = '決済完了';

export type ResaleAlert = { lv: number; t: string };

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const rsNum = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** 'YYYY-MM-DD' → [年, 月, 日]（parts） */
const parts = (s: unknown): [number, number, number] | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(s));
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
/** 日付を作る（ymd）。日は0や負でもよい（前月末など） */
const ymd = (y: number, m: number, d: number): string => {
    const t = new Date(Date.UTC(y, m - 1, d));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};
/** a − b の日数（diffDays） */
const diffDays = (a: string, b: string): number =>
    Math.round((new Date(`${a.slice(0, 10)}T00:00:00`).getTime() - new Date(`${b.slice(0, 10)}T00:00:00`).getTime()) / 86400000);

/** 原本（raw_data）と列を合わせた案件（列の値を優先） */
export const resaleOf = (row: Row): Row => {
    let raw: Row = {};
    try {
        const p: unknown = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;
        if (p && typeof p === 'object' && !Array.isArray(p)) raw = p as Row;
    } catch { /* 原本が読めなければ列だけ */ }
    const out: Row = { ...raw };
    for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined && v !== '') out[k] = v;
    return out;
};

/** 期限（deadlines）: 取得後2年・第3年度末 */
const deadlines = (r: Row, fyStart: number) => {
    const p = parts(r.buySettleDate);
    if (!p) return { two: '', y3: '' };
    const fsY = p[1] < fyStart ? p[0] - 1 : p[0];
    return { two: ymd(p[0] + 2, p[1], p[2] - 1), y3: ymd(fsY + 4, fyStart, 0) };
};

/** 在庫日数（rsHoldDays） */
const holdDays = (r: Row, today: string): number | null => {
    const st = str(r.buySettleDate || r.buyContractDate);
    if (!st) return null;
    const en = r.status === RS_DONE && r.sellSettleDate ? str(r.sellSettleDate) : today;
    const d = diffDays(en, st);
    return Number.isFinite(d) ? d : null;
};

/** 1件の要対応（alertsOf） */
export const alertsOf = (r: Row, fyStart: number, today = todayStr()): ResaleAlert[] => {
    const out: ResaleAlert[] = [];
    if (!RS_HOLD.includes(str(r.status))) return out;
    const dl = deadlines(r, fyStart);
    const anbun = (r.anbun && typeof r.anbun === 'object' ? r.anbun : {}) as Row;
    const daysTo = (d: string) => (d ? diffDays(d, today) : null);
    const d = holdDays(r, today);
    if (d !== null && d >= 180) out.push({ lv: d >= 365 ? 2 : 1, t: `在庫${d}日` });
    const k2 = daysTo(dl.two);
    if (k2 !== null && k2 <= 180) out.push({ lv: k2 <= 90 ? 2 : 1, t: k2 < 0 ? '取得後2年を超過' : `取得後2年まであと${k2}日` });
    if (anbun.rental) {
        const k3 = daysTo(dl.y3);
        if (k3 !== null && k3 <= 180) out.push({ lv: k3 <= 90 ? 2 : 1, t: k3 < 0 ? '第3年度末を超過' : `第3年度末まであと${k3}日` });
    }
    if (r.category !== '土地' && !rsNum(r.buyBuilding)) out.push({ lv: 1, t: '仕入建物 未按分' });
    if (r.category !== '土地' && rsNum(r.sellPrice) && !rsNum(r.sellBuilding)) out.push({ lv: 2, t: '販売建物 未按分' });
    return out;
};

/** 朝礼用アラートに出す一覧（dashAlerts）。⚠️「未按分」の黄は出さない。重い順 */
export const resaleDashAlerts = (rows: Row[], fyStart: number, today = todayStr()) =>
    rows.map(resaleOf)
        .map(r => ({ r, a: alertsOf(r, fyStart, today).filter(a => !/未按分/.test(a.t) || a.lv >= 2) }))
        .filter(o => o.a.length)
        .sort((x, y) => Math.max(...y.a.map(a => a.lv)) - Math.max(...x.a.map(a => a.lv)));
```

### frontend/src/components/realty/summary/CommandCenter.tsx（新規・全文）
```tsx
import React, { useMemo, useState } from 'react';
import { callsOf, fmtYen, todayStr } from './kpi';
import type { Row } from './kpi';

/**
 * 営業司令塔（v2.2.225。チームサマリーの最下段）。
 *
 * ⚠️ 移植元は本番アプリ（V18）の V12 モジュール（renderDash の最後の V12.card()）。
 *   以前のアプリはふだん Supabase の RPC（khf_command_center）で集計し、失敗したときだけ端末で計算していた。
 *   端末の計算（local）は「SQL と同じ配点」なので、ここではそれを写している（関数名の後ろの括弧は移植元の名前）。
 *   点数・抽出・並び・件数は以前のアプリと同じ。見た目だけ Dashboard に寄せた（接頭辞 rlt-cc-）。
 *
 * props
 *   leads / buyLeads / deals … brokerage_listings の行（削除済みは除いたもの）。⚠️ callDates は JSON 文字列のままでよい（callsOf で読む）
 *   me     … ログインしている人の名前（「自分の担当のみ」）。⚠️ 空白は除いて比べる（Dashboard のログイン名と案件の担当の表記の揺れ対策）
 *   onOpen … 「開く」を押したとき（kind = 'leads' | 'buyLeads' | 'deals'）。Summary.tsx が編集画面につなぐ
 *   today  … 'YYYY-MM-DD'（省略時は今日。検証用）
 *
 * ⚠️ 作っていないもの: 「完了→次回設定」「次回設定」（V12.done → askNext → commitNext。次回アクションの保存＝書き込み）。
 *   次回アクションは「開く」から各画面の編集で直す。
 */

type Kind = 'leads' | 'buyLeads' | 'deals';

type Props = {
    leads: Row[];
    buyLeads: Row[];
    deals: Row[];
    me?: string;
    onOpen?: (kind: Kind, id: string) => void;
    today?: string;
};

// ---------------------------------------------------------------------------
// 配点（V12 の P・REASON・CLOSED。Supabase の khf_scoring_params と同じ既定値）
// ---------------------------------------------------------------------------

const P = {
    phase: {
        'リード受信': 2, '架電中': 8, '通電済': 18, '訪問査定予定': 28, '訪問査定済': 33, '査定書提出': 35,
        '反響受信': 2, '追客中': 8, '内見予約': 26, '内見済': 32, '購入申込': 35,
    } as Record<string, number>,
    capRecency: 15, capActivity: 20, capReason: 20, capPrice: 10,
    recency: [[7, 15], [14, 11], [30, 7], [60, 3]] as [number, number][],
    connected: 10, perAct: 2, recent7: 6,
    price: [[50000000, 10], [30000000, 7], [15000000, 4]] as [number, number][],
    overduePerDay: 1, overdueMax: 15, noNext: 8,
    stale: { leads: [7, 14, 21], buyLeads: [5, 10, 14], deals: [5, 10, 14] } as Record<Kind, number[]>,
    hot: 70, warm: 45,
};
const REASON: [string, number][] = [['相続', 12], ['遺産', 12], ['空き家', 8], ['空家', 8], ['転勤', 12], ['転居', 8], ['住替', 10], ['住み替', 10],
    ['買替', 10], ['離婚', 12], ['財産分与', 12], ['資金', 8], ['現金化', 12], ['ローン返済', 10], ['任意売却', 14],
    ['施設', 8], ['介護', 8], ['急ぎ', 14], ['至急', 14], ['早期', 12], ['今すぐ', 14], ['年内', 10], ['3か月', 10], ['半年', 6],
    ['査定書', 6], ['価格更新', 6], ['価格改定', 6], ['買取', 8], ['他社', -6], ['検討中', -4], ['未定', -6], ['様子見', -8]];
const CLOSED = ['追客終了', '媒介受託', '成約', '失注', '決済完了'];
const KINDLBL: Record<Kind, { icon: string; label: string }> = {
    leads: { icon: 'fa-envelope', label: '売り反響' },
    buyLeads: { icon: 'fa-house', label: '買い反響' },
    deals: { icon: 'fa-tag', label: '商談案件' },
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 日数の差 a − b（diffDays） */
const diffDays = (a: string, b: string): number =>
    Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000);

/** 'YYYY/M/D'（fmtD） */
const fmtD = (ds: string): string => {
    if (!ds) return '―';
    const [y, m, d] = ds.slice(0, 10).split('-');
    if (!d) return ds;
    return `${y}/${Number(m)}/${Number(d)}`;
};

// ---------------------------------------------------------------------------
// 計算（V12 の local と、その下の pick / lastTouch / score / staleOf / taskState / todayRows）
// ---------------------------------------------------------------------------

export type CcRow = {
    id: string; kind: Kind; staff: string; phase: string;
    counterpart: string; subject: string;
    next_date: string; next_note: string; received_date: string; connect_date: string; last_touch: string;
    visit_date: string; view_date: string; act_total: number; amount: number | null; reason_src: string; is_closed: boolean;
    hot_score: number; hot_label: string; hot_breakdown: Record<string, number>;
    stale_rank: number; stale_label: string; days_stale: number; task_state: string; days_overdue: number; due_date?: string;
};

/** 最後に架電（LINE・メールを含む）した日（lastTouch） */
const lastTouch = (r: Row): string => {
    const a = callsOf(r)
        .map(c => str(c !== null && typeof c === 'object' ? (c.date || c) : c).slice(0, 10))
        .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
    return a.length ? a.sort()[a.length - 1] : '';
};

/** 1行を共通の形にする（pick） */
const pick = (kind: Kind, r: Row) => {
    const isBuy = kind === 'buyLeads';
    const isDeal = kind === 'deals';
    return {
        id: str(r.id), kind, staff: str(r.staff), phase: str(r.phase),
        counterpart: str(isDeal ? r.customer : r.name) || '（顧客名なし）',
        subject: str(isDeal ? r.property : isBuy ? r.targetProperty : r.addr),
        next_date: str(r.nextDate), next_note: str(r.nextNote),
        received_date: str(r.receivedDate) || str(r.contactDate),
        connect_date: str(r.connectDate), last_touch: lastTouch(r),
        visit_date: str(r.visitDate), view_date: str(r.viewDate),
        act_total: callsOf(r).length,
        amount: Number(isBuy ? r.budget : r.price) || null,
        reason_src: [r.reason, r.timing, r.note, r.nextNote, r.targetProperty].filter(Boolean).map(str).join(' '),
        is_closed: CLOSED.includes(str(r.phase)),
    };
};
type Picked = ReturnType<typeof pick>;

/** ホット度（score） */
const score = (o: Picked, t: string) => {
    if (o.is_closed) return { hot: 0, label: '対象外', bd: {} as Record<string, number> };
    const ptPhase = P.phase[o.phase] || 0;
    let ptRec = 0;
    if (o.received_date) {
        const dl = diffDays(t, o.received_date);
        for (const p of P.recency) { if (dl <= p[0]) { ptRec = p[1]; break; } }
    }
    let ptAct = (o.connect_date ? P.connected : 0) + o.act_total * P.perAct
        + ((o.last_touch && diffDays(t, o.last_touch) <= 7) ? P.recent7 : 0);
    ptAct = Math.min(P.capActivity, ptAct);
    let ptRea = 0;
    for (const p of REASON) if (o.reason_src.indexOf(p[0]) >= 0) ptRea += p[1];
    ptRea = Math.max(0, Math.min(P.capReason, ptRea));
    let ptPri = 0;
    if (o.amount) { ptPri = 1; for (const p of P.price) { if (o.amount >= p[0]) { ptPri = p[1]; break; } } }
    const od = o.next_date ? Math.max(0, diffDays(t, o.next_date)) : 0;
    const pen = (o.next_date ? 0 : P.noNext) + Math.min(P.overdueMax, od * P.overduePerDay);
    const raw = ptPhase + ptRec + ptAct + ptRea + ptPri - pen;
    return {
        hot: Math.max(0, Math.min(100, Math.round(raw))),
        label: raw >= P.hot ? 'ホット' : raw >= P.warm ? 'ウォーム' : 'コールド',
        bd: { phase: ptPhase, recency: ptRec, activity: ptAct, reason: ptRea, price: ptPri, penalty: pen },
    };
};

/** 停滞（staleOf）。起点は最後の架電、無ければ受信日 */
const staleOf = (o: Picked, t: string) => {
    if (o.is_closed) return { rank: 0, label: '対象外', days: 0 };
    const base = o.last_touch || o.received_date;
    if (!base) return { rank: 0, label: '判定不可', days: 0 };
    const d = diffDays(t, base);
    const th = P.stale[o.kind] || P.stale.leads;
    return {
        rank: d >= th[2] ? 3 : d >= th[1] ? 2 : d >= th[0] ? 1 : 0,
        label: d >= th[2] ? '危険' : d >= th[1] ? '警告' : d >= th[0] ? '注意' : '正常', days: d,
    };
};

/** 次回アクションの状態（taskState） */
const taskState = (o: Picked, t: string): string => {
    if (o.is_closed) return '対象外';
    if (!o.next_date) return '未設定';
    return o.next_date < t ? '期日超過' : o.next_date === t ? '本日' : (diffDays(o.next_date, t) <= 7 ? '今週' : '予定');
};

/** 今日やること（todayRows）。次回アクション期日＋訪問査定日／内見日 */
const todayRows = (en: CcRow[], t: string): CcRow[] => {
    const rows: CcRow[] = en.filter(x => !x.is_closed && x.next_date && x.next_date <= t).map(x => ({ ...x, due_date: x.next_date }));
    const seen = new Set(rows.map(x => `${x.kind}:${x.id}`));
    for (const x of en) {
        if (x.is_closed || seen.has(`${x.kind}:${x.id}`)) continue;
        const d = x.kind === 'leads' ? x.visit_date : x.kind === 'buyLeads' ? x.view_date : '';
        if (!d || d > t) continue;
        rows.push({ ...x, due_date: d, next_note: x.next_note || (x.kind === 'leads' ? '訪問査定日' : '内見日'), days_overdue: Math.max(0, diffDays(t, d)) });
    }
    return rows.sort((a, b) => b.days_overdue - a.days_overdue || b.hot_score - a.hot_score).slice(0, 40);
};

const norm = (s: string) => s.replace(/[\s　]/g, '');

/** 全体の集計（local） */
export const buildCommandCenter = (src: Record<Kind, Row[]>, me: string, mine: boolean, t: string = todayStr()) => {
    const rows: Picked[] = [];
    for (const kind of ['leads', 'buyLeads', 'deals'] as Kind[]) for (const r of src[kind] || []) rows.push(pick(kind, r));
    const target = (mine && me) ? rows.filter(x => norm(x.staff) === norm(me)) : rows;
    const en: CcRow[] = target.map(o => {
        const s = score(o, t);
        const st = staleOf(o, t);
        return {
            ...o, hot_score: s.hot, hot_label: s.label, hot_breakdown: s.bd,
            stale_rank: st.rank, stale_label: st.label, days_stale: st.days, task_state: taskState(o, t),
            days_overdue: o.next_date ? Math.max(0, diffDays(t, o.next_date)) : 0,
        };
    });
    const open = en.filter(x => !x.is_closed);
    return {
        summary: {
            active: open.length,
            today: en.filter(x => x.task_state === '本日').length,
            overdue: en.filter(x => x.task_state === '期日超過').length,
            no_next: en.filter(x => x.task_state === '未設定').length,
            stale: open.filter(x => x.stale_rank >= 2).length,
            hot: open.filter(x => x.hot_label === 'ホット').length,
            warm: open.filter(x => x.hot_label === 'ウォーム').length,
        },
        today: todayRows(en, t),
        hot: open.filter(x => x.hot_score >= P.warm).sort((a, b) => b.hot_score - a.hot_score).slice(0, 40),
        stale: open.filter(x => x.stale_rank >= 2).sort((a, b) => b.days_stale - a.days_stale).slice(0, 40),
    };
};

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

const STYLE = `
.rlt-cc { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.rlt-cc-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; }
.rlt-cc-title { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; cursor: pointer; user-select: none; }
.rlt-cc-title i { color: #0d6efd; }
.rlt-cc-caret { display: inline-block; width: 14px; color: #6c757d; }
.rlt-cc-mini { font-size: 11px; color: #495057; }
.rlt-cc-mini b.r { color: #dc3545; }
.rlt-cc-note { font-size: 10px; color: #6c757d; }
.rlt-cc-sp { flex: 1; }
.rlt-cc-body { padding: 0 14px 14px; }
.rlt-cc-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
.rlt-cc-kpi { border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; border: 1px solid; }
.rlt-cc-kpi b { font-size: 20px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.rlt-cc-kpi span { font-size: 10px; }
.rlt-cc-kpi.red { background: #fdf2f2; border-color: #f5c2c7; color: #b02a37; }
.rlt-cc-kpi.amber { background: #fff8e6; border-color: #ffe08a; color: #8a6100; }
.rlt-cc-kpi.navy { background: #eef3fb; border-color: #c5d5ee; color: #22405c; }
.rlt-cc-kpi.gray { background: #f8f9fa; border-color: #dee2e6; color: #495057; }
.rlt-cc-tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.rlt-cc-tab { font-size: 11px; font-weight: bold; border: 1px solid #ced4da; background: #fff; color: #495057; border-radius: 16px; padding: 3px 12px; cursor: pointer; }
.rlt-cc-tab.on { background: #0d6efd; border-color: #0d6efd; color: #fff; }
.rlt-cc-badge { display: inline-block; border-radius: 10px; padding: 0 6px; font-size: 10px; font-weight: bold; color: #fff; }
.rlt-cc-badge.red { background: #dc3545; }
.rlt-cc-badge.amber { background: #e0a800; }
.rlt-cc-badge.navy { background: #22405c; }
.rlt-cc-badge.green { background: #198754; }
.rlt-cc-badge.gray { background: #adb5bd; }
.rlt-cc-wrap { overflow-x: auto; }
.rlt-cc-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.rlt-cc-tbl th { background: #f8f9fa; color: #495057; font-weight: bold; padding: 6px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; text-align: left; }
.rlt-cc-tbl td { padding: 4px 8px; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
.rlt-cc-tbl .c { text-align: center; }
.rlt-cc-tbl .r { text-align: right; font-variant-numeric: tabular-nums; }
.rlt-cc-tbl tr.late td { background: #fff5f5; }
.rlt-cc-tbl .sub { font-size: 10px; color: #6c757d; }
.rlt-cc-tbl .trunc { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rlt-cc-tbl td.empty { text-align: center; color: #6c757d; padding: 12px; }
.rlt-cc-btn { font-size: 11px; border: 1px solid #0d6efd; color: #0d6efd; background: #fff; border-radius: 4px; padding: 1px 10px; cursor: pointer; }
.rlt-cc-btn:hover { background: #0d6efd; color: #fff; }
`;

const OPEN_KEY = 'kh_v12_open';

const CommandCenter: React.FC<Props> = ({ leads, buyLeads, deals, me = '', onOpen, today }) => {
    // ⚠️ 以前のアプリと同じく既定は折りたたみ。開いたかどうかはこの端末に覚える（kh_v12_open）
    const [open, setOpen] = useState<boolean>(() => {
        try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
    });
    const [mine, setMine] = useState(true);
    const [tab, setTab] = useState<'today' | 'hot' | 'stale'>('today');
    const [generatedAt, setGeneratedAt] = useState(() => new Date());

    const data = useMemo(
        () => buildCommandCenter({ leads, buyLeads, deals }, me, mine, today ?? todayStr()),
        // ⚠️ generatedAt は「↻ 再集計」で計算し直すため
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [leads, buyLeads, deals, me, mine, today, generatedAt]
    );
    const s = data.summary;

    const fold = () => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* 保存できなくても表示は切り替える */ }
    };
    const stamp = `${String(generatedAt.getHours()).padStart(2, '0')}:${String(generatedAt.getMinutes()).padStart(2, '0')}`;

    const hotBadge = (v: number, bd?: Record<string, number>) => (
        <span className={`rlt-cc-badge ${v >= P.hot ? 'red' : v >= P.warm ? 'amber' : 'gray'}`}
            title={bd ? `フェーズ${bd.phase || 0}／鮮度${bd.recency || 0}／接触${bd.activity || 0}／動機${bd.reason || 0}／価格${bd.price || 0}／減点-${bd.penalty || 0}` : undefined}>
            {v}
        </span>
    );
    const who = (x: CcRow) => (
        <>
            <td className="sub" style={{ whiteSpace: 'nowrap' }}><i className={`fa-solid ${KINDLBL[x.kind].icon} me-1`}></i>{KINDLBL[x.kind].label}</td>
            <td className="trunc" title={x.counterpart}><b>{x.counterpart}</b><div className="sub">{x.subject}</div></td>
            <td>{x.staff ? x.staff : <span className="rlt-cc-badge red">未割当</span>}</td>
        </>
    );
    const openBtn = (x: CcRow) => <button type="button" className="rlt-cc-btn" onClick={() => onOpen?.(x.kind, x.id)}>開く</button>;

    if (!open) {
        return (
            <div className="rlt-cc">
                <style>{STYLE}</style>
                <div className="rlt-cc-head">
                    <h3 className="rlt-cc-title" onClick={fold}><span className="rlt-cc-caret">▶</span><i className="fa-solid fa-bullseye me-1"></i>営業司令塔</h3>
                    <span className="rlt-cc-mini">
                        期日超過 <b className={s.overdue ? 'r' : ''}>{s.overdue}</b>／本日 <b>{s.today}</b>／次回未設定 <b className={s.no_next ? 'r' : ''}>{s.no_next}</b>／停滞 <b>{s.stale}</b>／ホット <b>{s.hot}</b>／追客中 <b>{s.active}</b>
                    </span>
                    <span className="rlt-cc-sp"></span>
                    <span className="rlt-cc-note" style={{ cursor: 'pointer' }} onClick={fold}>クリックで展開</span>
                </div>
            </div>
        );
    }

    const kpi = (n: number, lbl: string, cls: string) => <div className={`rlt-cc-kpi ${cls}`}><b>{n || 0}</b><span>{lbl}</span></div>;

    return (
        <div className="rlt-cc">
            <style>{STYLE}</style>
            <div className="rlt-cc-head">
                <h3 className="rlt-cc-title" onClick={fold}><span className="rlt-cc-caret">▼</span><i className="fa-solid fa-bullseye me-1"></i>営業司令塔</h3>
                <span className="rlt-cc-note">次回アクション・停滞・ホット度を一括算出（{stamp} 時点）</span>
                <span className="rlt-cc-sp"></span>
                <label className="rlt-cc-note" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> 自分の担当のみ{me ? `（${me}）` : ''}
                </label>
                <button type="button" className="rlt-cc-btn" onClick={() => setGeneratedAt(new Date())}>↻ 再集計</button>
            </div>
            <div className="rlt-cc-body">
                <div className="rlt-cc-kpis">
                    {kpi(s.overdue, '期日超過', 'red')}{kpi(s.today, '本日', 'amber')}
                    {kpi(s.no_next, '次回未設定', 'red')}{kpi(s.stale, '停滞', 'amber')}
                    {kpi(s.hot, 'ホット', 'navy')}{kpi(s.active, '追客中 合計', 'gray')}
                </div>
                <div className="rlt-cc-tabs">
                    <button type="button" className={`rlt-cc-tab ${tab === 'today' ? 'on' : ''}`} onClick={() => setTab('today')}>
                        ⏰ 今日やること <span className={`rlt-cc-badge ${data.today.length ? 'red' : 'green'}`}>{data.today.length}</span>
                    </button>
                    <button type="button" className={`rlt-cc-tab ${tab === 'hot' ? 'on' : ''}`} onClick={() => setTab('hot')}>
                        🔥 ホットな反響 <span className="rlt-cc-badge navy">{data.hot.length}</span>
                    </button>
                    <button type="button" className={`rlt-cc-tab ${tab === 'stale' ? 'on' : ''}`} onClick={() => setTab('stale')}>
                        🚨 停滞アラート <span className={`rlt-cc-badge ${data.stale.length ? 'amber' : 'green'}`}>{data.stale.length}</span>
                    </button>
                </div>

                <div className="rlt-cc-wrap">
                    {tab === 'today' && (
                        <table className="rlt-cc-tbl">
                            <thead><tr><th>区分</th><th>相手先</th><th>担当</th><th>予定日</th><th>次回アクション</th><th className="c">状態</th><th className="c">熱</th><th></th></tr></thead>
                            <tbody>
                                {data.today.map(x => {
                                    const od = x.days_overdue || 0;
                                    return (
                                        <tr key={`${x.kind}:${x.id}`} className={od > 0 ? 'late' : ''}>
                                            {who(x)}
                                            <td>{fmtD(x.due_date || x.next_date)}</td>
                                            <td className="trunc" title={x.next_note}>{x.next_note ? x.next_note : <span className="rlt-cc-badge red">内容未記入</span>}</td>
                                            <td className="c">{od > 0 ? <span className="rlt-cc-badge red">{od}日超過</span> : <span className="rlt-cc-badge navy">本日</span>}</td>
                                            <td className="c">{hotBadge(x.hot_score || 0, x.hot_breakdown)}</td>
                                            <td>{openBtn(x)}</td>
                                        </tr>
                                    );
                                })}
                                {data.today.length === 0 && <tr><td colSpan={8} className="empty">本日ぶん・期日超過ぶんの次回アクションはありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                    {tab === 'hot' && (
                        <table className="rlt-cc-tbl">
                            <thead><tr><th>区分</th><th>相手先</th><th>担当</th><th>フェーズ</th><th className="r">想定額</th><th className="c">ホット度</th><th>次回</th><th className="c">停滞</th><th></th></tr></thead>
                            <tbody>
                                {data.hot.map(x => (
                                    <tr key={`${x.kind}:${x.id}`}>
                                        {who(x)}
                                        <td className="sub">{x.phase}</td>
                                        <td className="r">{x.amount ? fmtYen(x.amount) : '―'}</td>
                                        <td className="c">{hotBadge(x.hot_score || 0, x.hot_breakdown)} <span className="sub">{x.hot_label}</span></td>
                                        <td className="sub">{x.next_date ? fmtD(x.next_date) : <span className="rlt-cc-badge red">未設定</span>}</td>
                                        <td className="c">{(x.days_stale || 0) > 0 ? `${x.days_stale}日` : '―'}</td>
                                        <td>{openBtn(x)}</td>
                                    </tr>
                                ))}
                                {data.hot.length === 0 && <tr><td colSpan={9} className="empty">{P.warm}点以上の反響はありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                    {tab === 'stale' && (
                        <table className="rlt-cc-tbl">
                            <thead><tr><th>区分</th><th>相手先</th><th>担当</th><th>フェーズ</th><th>最終対応</th><th className="c">経過</th><th className="c">判定</th><th className="c">熱</th><th></th></tr></thead>
                            <tbody>
                                {data.stale.map(x => (
                                    <tr key={`${x.kind}:${x.id}`} className={x.stale_rank >= 3 ? 'late' : ''}>
                                        {who(x)}
                                        <td className="sub">{x.phase}</td>
                                        <td>{x.last_touch ? fmtD(x.last_touch) : <span className="rlt-cc-badge red">記録なし</span>}</td>
                                        <td className="c">{x.days_stale}日</td>
                                        <td className="c"><span className={`rlt-cc-badge ${x.stale_rank >= 3 ? 'red' : 'amber'}`}>{x.stale_label}</span></td>
                                        <td className="c">{hotBadge(x.hot_score || 0)}</td>
                                        <td>{openBtn(x)}</td>
                                    </tr>
                                ))}
                                {data.stale.length === 0 && <tr><td colSpan={9} className="empty">停滞している案件はありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandCenter;
```

### frontend/src/components/realty/bmonthly/BaikaiMonthly.tsx（新規・全文）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import { fiscalMonths, fmtYen, monthLabel, pct, sumRow, todayStr } from '../summary/kpi';
import type { Row, Settings } from '../summary/kpi';

/**
 * 月次媒介管理（不動産企画係。v2.2.225）。
 *
 * ⚠️ 移植元は本番アプリ（V18）の「📉 月次媒介管理」（renderBMonthly）。表・列・注記・セルを押したときの内訳（drillBaikai）を同じにしている。
 *   括弧の中は移植元の関数名。見た目だけ Dashboard に寄せた。
 * 集計: 媒介台帳の媒介契約日（初回獲得日）の月で数える。期間は今期の12か月（期首月は設定）。
 * ⚠️ 内訳の「書類」ボタン（docBtn）は移していない（書類の画面を移すときに足す）。
 */

type BmSettings = Settings & { sources?: string[]; baikaiTypes?: string[] };
type CountMap = Record<string, Record<string, number>>;
type DrillKind = 'staff' | 'type' | 'source';

const STYLE = `
.rlt-bm .clk { cursor: pointer; text-decoration: underline dotted; }
.rlt-bm td.auto { background: #f3faf5; }
.rlt-bm td.warn { background: #fff8e1; }
.rlt-bm .tbl th, .rlt-bm .tbl td { white-space: nowrap; }
.rlt-bm .small { font-size: 11px; color: #6c757d; }
.rlt-bm .chartwrap { overflow-x: auto; }
.rlt-bm-badge { display: inline-block; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: bold; }
.rlt-bm-badge.navy { background: #e7f1ff; color: #0a58ca; }
.rlt-bm-badge.green { background: #d1e7dd; color: #0f5132; }
.rlt-bm-badge.gray { background: #efeeeb; color: #495057; }
.rlt-bm-modal { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.rlt-bm-modal .box { background: #fff; border-radius: 8px; max-width: 1100px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; }
.rlt-bm-modal .head { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #dee2e6; font-weight: bold; font-size: 13px; }
.rlt-bm-modal .body { padding: 12px 16px; overflow: auto; }
.rlt-bm-modal .foot { padding: 10px 16px; border-top: 1px solid #dee2e6; text-align: right; }
`;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 'M月'（mLabel） */
const mLabel = (mk: string): string => `${Number(mk.split('-')[1])}月`;

/** 'YYYY/M/D'（fmtD） */
const fmtD = (ds: unknown): string => {
    if (!ds) return '―';
    const [y, m, d] = str(ds).slice(0, 10).split('-');
    if (!d) return str(ds);
    return `${y}/${Number(m)}/${Number(d)}`;
};

/** 台帳を契約月で数える（ledgerCountBy）。keyFn が null なら数えない */
const ledgerCountBy = (ledger: Row[], keyFn: (l: Row) => string | null): CountMap => {
    const out: CountMap = {};
    for (const led of ledger) {
        const cd = str(led.contractDate);
        if (!cd) continue;
        const mk = cd.slice(0, 7);
        const k = keyFn(led);
        if (k == null) continue;
        const row = (out[k] = out[k] ?? {});
        row[mk] = (row[mk] ?? 0) + 1;
    }
    return out;
};

/** グラフの上限をきりの良い値に（niceMax） */
const niceMax = (v: number): number => {
    if (!(v > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / e;
    const st = m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return st * e;
};

/** 凡例の文字幅の目安（svgTextW） */
const svgTextW = (t: string): number => {
    let w = 0;
    for (const ch of t) w += ch.charCodeAt(0) < 128 ? 5.6 : 10;
    return w;
};

/** 累計の線を引く最後の月（cumEnd）: 実績がある最後の月と今月の遅い方 */
const cumEnd = (mks: string[], vals: number[]): number => {
    let last = -1;
    vals.forEach((v, i) => { if (v) last = i; });
    return Math.max(last, mks.indexOf(todayStr().slice(0, 7)));
};

/** 月次媒介獲得グラフ（baikaiChart → comboChart）。棒＝目標・実績／折線＝累計達成進捗率 */
const BaikaiChart: React.FC<{ mks: string[]; actual: number[]; annualTarget: number }> = ({ mks, actual, annualTarget }) => {
    const mt = annualTarget > 0 ? annualTarget / 12 : 0;
    const tgt = mks.map(() => mt);
    let cum = 0;
    const end = cumEnd(mks, actual);
    const line = actual.map((v, i) => { cum += v; return annualTarget > 0 && i <= end ? (cum / annualTarget) * 100 : null; });
    const bars = [
        { name: '月次目標（年間÷12）', vals: tgt, fill: '#efece7', stroke: '#c9c3ba' },
        { name: '媒介獲得実績', vals: actual, fill: '#1a6b3c', stroke: '' },
    ];
    const lineName = '累計達成進捗率（年間目標比）';
    const lc = '#22405c';
    const n = mks.length || 1;
    const W = 880, H = 300, pad = { l: 66, r: 62, t: 36, b: 34 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / n;
    let maxL = 5;
    for (const g of bars) for (const v of g.vals) if (v > maxL) maxL = v;
    maxL = niceMax(maxL);
    let maxR = 100;
    for (const v of line) if (v != null && v > maxR) maxR = v;
    maxR = Math.ceil(maxR / 25) * 25;
    const T = 4;
    const yL = (v: number) => pad.t + ih - (ih * Math.min(v, maxL)) / maxL;
    const yR = (v: number) => pad.t + ih - (ih * Math.min(v, maxR)) / maxR;
    const fmtL = (v: number) => `${Math.round(v * 10) / 10}件`;
    const gn = bars.length, slot = (bw * 0.78) / gn, off = bw * 0.11;
    const pts = line.map((v, i) => (v == null ? null : `${(pad.l + bw * i + bw / 2).toFixed(1)},${yR(v).toFixed(1)}`)).filter((p): p is string => p !== null);
    let lx = pad.l;
    const legend: React.ReactNode[] = [];
    for (const g of bars) {
        legend.push(<g key={g.name}><rect x={lx} y={7} width={10} height={10} fill={g.fill} stroke={g.stroke || undefined} /><text x={lx + 14} y={16} fontSize={10} fill="#57534e">{g.name}</text></g>);
        lx += 18 + svgTextW(g.name);
    }
    const hasLine = line.some(v => v != null);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="月次媒介獲得件数（実績・目標）と年間獲得目標に対する累計達成進捗率の2軸複合グラフ">
            {Array.from({ length: T + 1 }, (_, i) => {
                const y = pad.t + (ih * i) / T, a = (maxL * (T - i)) / T, b = (maxR * (T - i)) / T;
                return (
                    <g key={i}>
                        <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#e6e4e0" />
                        <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#78716c">{fmtL(a)}</text>
                        <text x={W - pad.r + 6} y={y + 4} textAnchor="start" fontSize={10} fill={lc}>{Math.round(b)}%</text>
                    </g>
                );
            })}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke="#c9c3ba" />
            <line x1={W - pad.r} y1={pad.t} x2={W - pad.r} y2={pad.t + ih} stroke={lc} opacity={0.55} />
            {mks.map((mk, i) => {
                const lv = bars[gn - 1].vals[i] || 0;
                const lcx = pad.l + bw * i + off + slot * (gn - 1) + slot * 0.45;
                return (
                    <g key={mk}>
                        {bars.map((g, gi) => {
                            const x = pad.l + bw * i + off + slot * gi, w = slot * 0.9, v = g.vals[i] || 0;
                            return v > 0 ? (
                                <rect key={g.name} x={x} y={yL(v)} width={w} height={pad.t + ih - yL(v)} fill={g.fill} stroke={g.stroke || undefined}>
                                    <title>{`${mLabel(mk)} ${g.name}：${v}件`}</title>
                                </rect>
                            ) : null;
                        })}
                        {lv > 0 && <text x={lcx} y={yL(lv) - 4} textAnchor="middle" fontSize={9} fill="#44403c">{String(lv)}</text>}
                        <text x={pad.l + bw * i + bw / 2} y={pad.t + ih + 15} textAnchor="middle" fontSize={10} fill="#57534e">{mLabel(mk)}</text>
                    </g>
                );
            })}
            {hasLine && (
                <>
                    {maxR >= 100 && <line x1={pad.l} y1={yR(100)} x2={W - pad.r} y2={yR(100)} stroke={lc} strokeDasharray="4 3" opacity={0.45}><title>年間目標 100%</title></line>}
                    {pts.length > 1 && <polyline fill="none" stroke={lc} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} />}
                    {line.map((v, i) => {
                        if (v == null) return null;
                        const x = pad.l + bw * i + bw / 2, y = yR(v);
                        return (
                            <g key={i}>
                                <circle cx={x} cy={y} r={3.4} fill="#fff" stroke={lc} strokeWidth={1.8}><title>{`${mLabel(mks[i])} 累計達成進捗率：${v.toFixed(1)}%`}</title></circle>
                                <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={lc} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{v.toFixed(0)}%</text>
                            </g>
                        );
                    })}
                </>
            )}
            {legend}
            {hasLine && (
                <g>
                    <line x1={lx} y1={12} x2={lx + 16} y2={12} stroke={lc} strokeWidth={2} />
                    <circle cx={lx + 8} cy={12} r={3.2} fill="#fff" stroke={lc} strokeWidth={1.6} />
                    <text x={lx + 21} y={16} fontSize={10} fill={lc}>{lineName}</text>
                </g>
            )}
            <text x={pad.l - 6} y={pad.t - 9} textAnchor="end" fontSize={9} fill="#78716c">件数（件）</text>
            <text x={W - pad.r + 6} y={pad.t - 9} textAnchor="start" fontSize={9} fill={lc}>累計達成率（％）</text>
        </svg>
    );
};

/** 物件状態（propBadge） */
const PropBadge: React.FC<{ s: string }> = ({ s }) =>
    s === 'アクティブ' ? <span className="rlt-bm-badge navy">アクティブ</span>
        : s === '成約完了' ? <span className="rlt-bm-badge green">成約完了</span>
            : <span className="rlt-bm-badge gray">{s || '―'}</span>;

const BaikaiMonthly: React.FC = () => {
    const [ledger, setLedger] = useState<Row[]>([]);
    const [deals, setDeals] = useState<Row[]>([]);
    const [settings, setSettings] = useState<BmSettings>({});
    const [loading, setLoading] = useState(true);
    const [drill, setDrill] = useState<{ kind: DrillKind; key: string; mk: string } | null>(null);

    useEffect(() => {
        loadRecords(['ledger', 'deals'])
            .then(({ records, settings: st }) => { setLedger(records.ledger); setDeals(records.deals); setSettings(st as BmSettings); })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const data = useMemo(() => {
        const mks = fiscalMonths(settings.fiscalStart);
        const staff = (settings.staff ?? []).filter(s => s.name);
        const baikaiTypes = settings.baikaiTypes ?? [];
        const sources = settings.sources ?? [];
        /** 略称 → 名前（abbrToName） */
        const abbrToName = (ab: string) => (settings.staff ?? []).find(x => x.abbr === ab)?.name ?? ab;
        const byStaff = ledgerCountBy(ledger, l => abbrToName(str(l.staff)) || '（担当未設定）');
        const byType = ledgerCountBy(ledger, l => (baikaiTypes.includes(str(l.baikaiType)) ? str(l.baikaiType) : '未分類'));
        const bySrc = ledgerCountBy(ledger, l => (sources.includes(str(l.source)) ? str(l.source) : '未分類'));
        const byStaffKaitori = ledgerCountBy(ledger, l => (str(l.baikaiType) === '買取' ? abbrToName(str(l.staff)) || '（担当未設定）' : null));
        const dealKaitori: CountMap = {};
        for (const d of deals) {
            if (str(d.type) !== '買取' || !str(d.contractDate) || str(d.phase) === '失注') continue;
            const nm = str(d.staff) || '（担当未設定）', mk = str(d.contractDate).slice(0, 7);
            const row = (dealKaitori[nm] = dealKaitori[nm] ?? {});
            row[mk] = (row[mk] ?? 0) + 1;
        }
        const teamRow = mks.map(mk => staff.reduce((a, s) => a + (byStaff[String(s.name)]?.[mk] ?? 0), 0));
        const teamTot = teamRow.reduce((a, b) => a + b, 0);
        const teamTgt = staff.reduce((a, s) => a + (Number(s.baikaiTarget) || 0), 0);
        const unset = ledger.filter(l => str(l.contractDate) && mks.includes(str(l.contractDate).slice(0, 7)) && !(settings.staff ?? []).some(s => s.abbr === str(l.staff))).length;
        return { mks, staff, baikaiTypes, sources, abbrToName, byStaff, byType, bySrc, byStaffKaitori, dealKaitori, teamRow, teamTot, teamTgt, unset };
    }, [ledger, deals, settings]);

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const { mks, staff, byStaff, byType, bySrc, byStaffKaitori, dealKaitori, teamRow, teamTot, teamTgt, unset, abbrToName } = data;

    /** 数字のセル。0 でなければ押すと内訳 */
    const cell = (v: number, kind: DrillKind | null, key: string, mk: string, cls = 'auto', blankZero = false) => (
        <td key={mk} className={`r ${cls} ${v && kind ? 'clk' : ''}`}
            onClick={v && kind ? () => setDrill({ kind, key, mk }) : undefined}
            title={v && kind ? 'クリックで内訳表示' : undefined}>
            {blankZero && !v ? '' : v}
        </td>
    );

    /** 媒介種別別・反響元別（matrix） */
    const matrix = (title: string, keys: string[], by: CountMap, kind: DrillKind) => {
        const tots = keys.map(k => sumRow(by[k], mks));
        const grand = tots.reduce((a, b) => a + b, 0);
        const unc = sumRow(by['未分類'], mks);
        return (
            <div className="rlt-card">
                <div className="rlt-card-head"><h3>{title}</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl tbl"><thead><tr>
                    <th></th>{mks.map(mk => <th key={mk} className="r">{mLabel(mk)}</th>)}<th className="r">年間合計</th><th className="r">構成比</th>
                </tr></thead><tbody>
                    {keys.map((k, i) => (
                        <tr key={k}>
                            <td>{k}</td>{mks.map(mk => cell(by[k]?.[mk] ?? 0, kind, k, mk))}
                            <td className="r"><b>{tots[i]}</b></td><td className="r">{grand ? pct(tots[i] / grand) : '―'}</td>
                        </tr>
                    ))}
                    <tr className="total">
                        <td>合計</td>{mks.map(mk => <td key={mk} className="r">{keys.reduce((a, k) => a + (by[k]?.[mk] ?? 0), 0)}</td>)}
                        <td className="r">{grand}</td><td></td>
                    </tr>
                    {unc > 0 && (
                        <tr>
                            <td>未分類 ⚠</td>{mks.map(mk => <td key={mk} className="r warn">{by['未分類']?.[mk] ?? 0}</td>)}
                            <td className="r warn">{unc}</td><td className="small">マスタと不一致</td>
                        </tr>
                    )}
                </tbody></table></div>
            </div>
        );
    };

    /** 担当者別 月次 買取（kaitoriTable） */
    const kaitoriTable = (title: string, note: string, by: CountMap, drillable: boolean) => {
        const names = staff.map(s => String(s.name));
        for (const k of Object.keys(by)) if (!names.includes(k)) names.push(k);
        const tots = names.map(n => sumRow(by[n], mks));
        const grand = tots.reduce((a, b) => a + b, 0);
        return (
            <div className="rlt-card">
                <div className="rlt-card-head"><h3>{title}</h3><span className="rlt-note">{note}</span></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mLabel(mk)}</th>)}<th className="r">年間合計</th><th className="r">構成比</th>
                </tr></thead><tbody>
                    {names.length === 0 && <tr><td colSpan={mks.length + 3} className="rlt-sub">担当者が登録されていません</td></tr>}
                    {names.map((n, i) => (
                        <tr key={n}>
                            <td>{n}</td>{mks.map(mk => cell(by[n]?.[mk] ?? 0, drillable ? 'staff' : null, n, mk, 'auto', true))}
                            <td className="r"><b>{tots[i]}</b></td><td className="r">{grand ? pct(tots[i] / grand) : '―'}</td>
                        </tr>
                    ))}
                    <tr className="total">
                        <td>チーム合計</td>{mks.map(mk => <td key={mk} className="r">{names.reduce((a, n) => a + (by[n]?.[mk] ?? 0), 0)}</td>)}
                        <td className="r">{grand}</td><td></td>
                    </tr>
                </tbody></table></div>
            </div>
        );
    };

    /** 内訳（drillBaikai） */
    const drillView = () => {
        if (!drill) return null;
        const { kind, key, mk } = drill;
        const baikaiTypes = data.baikaiTypes, sources = data.sources;
        const list = ledger.filter(l => {
            const cd = str(l.contractDate);
            if (!cd || cd.slice(0, 7) !== mk) return false;
            if (kind === 'staff' && key && abbrToName(str(l.staff)) !== key) return false;
            if (kind === 'type' && (baikaiTypes.includes(str(l.baikaiType)) ? str(l.baikaiType) : '未分類') !== key) return false;
            if (kind === 'source' && (sources.includes(str(l.source)) ? str(l.source) : '未分類') !== key) return false;
            return true;
        }).sort((a, b) => (str(a.contractDate) < str(b.contractDate) ? -1 : 1));
        const kindLbl = { staff: '担当', type: '媒介種別', source: '反響元' }[kind];
        const title = `${key || 'チーム全体'}　${monthLabel(mk)}　媒介獲得の内訳（${kindLbl}別）`;
        return (
            <div className="rlt-bm-modal" onClick={() => setDrill(null)}>
                <div className="box" onClick={e => e.stopPropagation()}>
                    <div className="head">📉 {title}</div>
                    <div className="body rlt-tblwrap">
                        <table className="rlt-tbl tbl"><thead><tr>
                            <th className="r">台帳No.</th><th>担当</th><th>売主名</th><th>所在地</th><th>媒介種別</th><th>反響元</th>
                            <th className="r">販売価格(円)</th><th>媒介契約日</th><th>物件状態</th>
                        </tr></thead><tbody>
                            {list.map(l => (
                                <tr key={str(l.id)}>
                                    <td className="r">{str(l.no) || '―'}</td><td>{str(l.staff)}</td><td><b>{str(l.seller)}</b></td>
                                    <td className="small">{str(l.addr1)}{l.addr2 ? ` ${str(l.addr2).split('http')[0].trim().slice(0, 20)}` : ''}</td>
                                    <td>{str(l.baikaiType) || '―'}</td><td>{str(l.source)}</td>
                                    <td className="r">{l.price ? fmtYen(Number(l.price)) : '―'}</td><td>{fmtD(l.contractDate)}</td>
                                    <td><PropBadge s={str(l.propStatus)} /></td>
                                </tr>
                            ))}
                            {list.length === 0 && <tr><td colSpan={9} className="rlt-sub">該当なし</td></tr>}
                            <tr className="total"><td colSpan={9}>合計 {list.length}件</td></tr>
                        </tbody></table>
                        <p className="small" style={{ marginTop: 8 }}>編集は媒介獲得台帳から行えます。</p>
                    </div>
                    <div className="foot"><button className="rlt-btn sec" onClick={() => setDrill(null)}>閉じる</button></div>
                </div>
            </div>
        );
    };

    return (
        <div className="rlt-page rlt-bm">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-chart-column me-2" style={{ color: '#0d6efd' }}></i>月次媒介管理</h1>
                <p className="rlt-sub">媒介契約日（初回獲得日）＝計上月。更新しても獲得月は動きません。媒介台帳から自動集計。</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>担当者別 月次獲得件数</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mLabel(mk)}</th>)}
                    <th className="r">年間合計</th><th className="r">年間目標</th><th className="r">達成率</th><th className="r">うち買取<br />(年間)</th><th className="r">台帳全期間</th>
                </tr></thead><tbody>
                    {staff.map(s => {
                        const name = String(s.name);
                        const tot = sumRow(byStaff[name], mks);
                        const tgt = Number(s.baikaiTarget) || 0;
                        const allCnt = ledger.filter(l => abbrToName(str(l.staff)) === name).length;
                        return (
                            <tr key={name}>
                                <td>{name}</td>{mks.map(mk => cell(byStaff[name]?.[mk] ?? 0, 'staff', name, mk))}
                                <td className="r"><b>{tot}</b></td><td className="r warn">{tgt}</td><td className="r">{tgt ? pct(tot / tgt) : '―'}</td>
                                <td className="r auto">{sumRow(byStaffKaitori[name], mks)}</td><td className="r">{allCnt}</td>
                            </tr>
                        );
                    })}
                    <tr className="total">
                        <td>チーム合計</td>{teamRow.map((v, i) => cell(v, 'staff', '', mks[i], ''))}
                        <td className="r">{teamTot}</td><td className="r">{teamTgt}</td><td className="r">{teamTgt ? pct(teamTot / teamTgt) : '―'}</td>
                        <td className="r">{staff.reduce((a, s) => a + sumRow(byStaffKaitori[String(s.name)], mks), 0)}</td><td className="r">{ledger.length}</td>
                    </tr>
                </tbody></table></div>
                <div className="rlt-body small" style={{ paddingTop: 8 }}>
                    {unset ? `⚠ 期間内で担当略称が設定と一致しない件数：${unset}件（担当未設定・枠外担当）。設定の略称を見直してください。` : '✅ 期間内の全件が設定済み担当に紐づいています。'}
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head">
                    <h3>月次媒介獲得グラフ（2軸複合：棒＝実績・目標／折線＝累計達成進捗率）</h3>
                    <span className="rlt-note">左軸＝月次の媒介獲得件数と目標。右軸＝年間獲得目標に対する、その月までの累計達成進捗率</span>
                </div>
                <div className="rlt-body chartwrap"><BaikaiChart mks={mks} actual={teamRow} annualTarget={teamTgt} /></div>
                <div className="rlt-body small">年間獲得目標はチーム合計 {teamTgt}件（設定の「年間媒介目標(件)」の合計）。月次目標はこれを12等分した参考値です。累計達成進捗率＝（当月までの獲得累計 ÷ 年間獲得目標）。</div>
            </div>

            {kaitoriTable('担当者別 月次 買取獲得件数（媒介獲得台帳）', '媒介種別＝「買取」の媒介契約日で計上。自社買取として仕入れた案件の獲得実績です', byStaffKaitori, true)}
            {kaitoriTable('担当者別 月次 買取契約件数（商談案件管理）', '商談案件管理の種別＝「買取」を契約日で計上（失注は除外）。台帳側と重複計上ではなく、契約ベースの参考値です', dealKaitori, false)}
            {matrix('媒介種別別 月次獲得件数', data.baikaiTypes, byType, 'type')}
            {matrix('反響元別 月次獲得件数', data.sources, bySrc, 'source')}

            {drillView()}
        </div>
    );
};

export default BaikaiMonthly;
```

### frontend/src/components/realty/lost/LostAnalysis.tsx（新規・全文）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import { fyStartOf, periodGroups, periodHas, periodShort, recvMonthKey } from '../common/leadFunnel';
import type { Period } from '../common/leadFunnel';
import { fiscalMonths, pct } from '../summary/kpi';
import type { Row } from '../summary/kpi';

/**
 * 失注・他決の分析（不動産企画係。v2.2.225）。
 *
 * ⚠️ 移植元は本番アプリ（V18）の「🧩 失注・他決の分析」（renderLost）。計算・表・見出し・注記は同じ（括弧の中は移植元の名前）。
 *   売り反響・買い反響は受信月、商談案件は失注日（未入力は登録日）で数える。
 * ⚠️ 他決の詳細（lostWhy・lostTo・lostPrice・lostNote）や商談の失注理由（lostReason・lostDate）は DB の列に無いので、
 *   以前のアプリの原本（raw_data）から読む（rowOf）。
 * ⚠️ 以前のアプリでは表の行を押すと編集画面が開いた。編集は売り反響・商談案件の画面で行う（この画面からは開かない）。
 */

/** 終了理由（LEAD_ENDS） */
const LEAD_ENDS = ['他決', '辞退・売却中止', '連絡不能', '対象外', 'その他'];
/** 商談の失注理由（DEAL_LOST_REASONS） */
const DEAL_LOST_REASONS = ['価格・条件が合わない', '他社で成約（他決）', 'ローン否決・資金計画', '物件の問題（調査・瑕疵など）', 'お客様都合で見送り', '売主都合（売止・価格変更）', '連絡不能', 'その他'];
/** 他決の決め手（LEAD_LOST_WHY） */
const LEAD_LOST_WHY = ['査定額が高かった', '大手の安心感', '知人・紹介・付き合い', '対応が早かった', '手数料・条件', '買取を選んだ', '地元での実績', '不明', 'その他'];
/** 買い反響の終了理由（BUY_ENDS） */
const BUY_ENDS = ['他決', '購入見送り', '連絡不能', '対象外', 'その他'];

const STYLE = `
.rlt-lost-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.rlt-lost-tile { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 4px rgba(0,0,0,.05); }
.rlt-lost-tile .lbl { font-size: 11px; color: #6c757d; font-weight: bold; }
.rlt-lost-tile .val { font-size: 24px; font-weight: bold; color: #212529; font-variant-numeric: tabular-nums; }
.rlt-lost-tile .sub { font-size: 10px; color: #6c757d; margin-top: 2px; }
.rlt-lost-bar { display: inline-block; width: 120px; height: 8px; background: #f1f3f5; border-radius: 4px; overflow: hidden; vertical-align: middle; }
.rlt-lost-bar i { display: block; height: 100%; background: #0d6efd; }
.rlt-lost .rlt-tbl td.num { font-variant-numeric: tabular-nums; }
@media (max-width: 900px) { .rlt-lost-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;

/** 行に原本（raw_data）の項目を足す。⚠️ DB の列にある項目は列の値を優先する */
const rowOf = (r: Row): Row => {
    let raw: Row = {};
    if (typeof r.raw_data === 'string' && r.raw_data !== '') {
        try {
            const p: unknown = JSON.parse(r.raw_data);
            if (p !== null && typeof p === 'object' && !Array.isArray(p)) raw = p as Row;
        } catch { /* 原本が読めなければ列だけ */ }
    }
    return { ...raw, ...r };
};

/** 'YYYY/M/D'（fmtD） */
const fmtD = (ds: unknown): string => {
    if (!ds) return '―';
    const [y, m, d] = str(ds).slice(0, 10).split('-');
    if (!d) return str(ds);
    return `${y}/${Number(m)}/${Number(d)}`;
};

/** 商談の失注月（dealLostMonth）: 失注日、無ければ登録日・接触日 */
const dealLostMonth = (d: Row): string => {
    const v = str(d.lostDate || d.createdAt || d.contactDate).slice(0, 7);
    return /^\d{4}-\d{2}$/.test(v) ? v : '';
};

type Cross = { m: Map<string, Record<string, number>>; keys: string[]; cols: string[] };

/** 行（keyF）× 列（colF）で数える（lostCross）。order は行の並び（無い値は末尾、同じなら件数の多い順） */
const lostCross = (rows: Row[], keyF: (r: Row) => unknown, cols: string[], colF: (r: Row) => unknown, order: string[]): Cross => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
        const k = str(keyF(r)) || '（未入力）';
        const c = str(colF(r)) || '（未割当）';
        if (!m.has(k)) m.set(k, {});
        const o = m.get(k)!;
        o[c] = (o[c] || 0) + 1;
        o.__t = (o.__t || 0) + 1;
    }
    const idx = (k: string) => { const i = order.indexOf(k); return i < 0 ? 99 : i; };
    const keys = [...m.keys()].sort((a, b) => idx(a) - idx(b) || m.get(b)!.__t - m.get(a)!.__t);
    return { m, keys, cols };
};

/** 横棒（lostBar） */
const LostBar: React.FC<{ n: number; max: number }> = ({ n, max }) => (
    <span className="rlt-lost-bar"><i style={{ width: `${max ? Math.round((n / max) * 100) : 0}%` }}></i></span>
);

/** 理由 × 担当などの表（lostTable） */
const LostTable: React.FC<{ title: string; x: Cross; total: number; note?: string }> = ({ title, x, total, note }) => {
    if (!x.keys.length) {
        return (
            <div className="rlt-card">
                <div className="rlt-card-head"><h3>{title}</h3></div>
                <div className="rlt-body"><p className="rlt-sub">該当するデータはありません。</p></div>
            </div>
        );
    }
    const max = Math.max(...x.keys.map(k => x.m.get(k)!.__t));
    const cols = x.cols.filter(c => x.keys.some(k => x.m.get(k)![c]));
    return (
        <div className="rlt-card">
            <div className="rlt-card-head"><h3>{title}</h3>{note && <span className="rlt-note">{note}</span>}</div>
            <div className="rlt-tblwrap">
                <table className="rlt-tbl">
                    <thead><tr>
                        <th>理由</th><th className="r">件数</th><th className="r">割合</th><th style={{ minWidth: 120 }}></th>
                        {cols.map(c => <th key={c} className="r">{c}</th>)}
                    </tr></thead>
                    <tbody>
                        {x.keys.map(k => {
                            const o = x.m.get(k)!;
                            return (
                                <tr key={k}>
                                    <td>{k}</td><td className="r num"><b>{o.__t}</b></td>
                                    <td className="r num">{pct(total ? o.__t / total : null)}</td>
                                    <td><LostBar n={o.__t} max={max} /></td>
                                    {cols.map(c => <td key={c} className="r num">{o[c] || ''}</td>)}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const LostAnalysis: React.FC = () => {
    const [leads, setLeads] = useState<Row[]>([]);
    const [buyLeads, setBuyLeads] = useState<Row[]>([]);
    const [deals, setDeals] = useState<Row[]>([]);
    const [fiscalStart, setFiscalStart] = useState<string | undefined>(undefined);
    const [sources, setSources] = useState<string[]>([]);
    const [staff, setStaff] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    /** 対象期間（S.lostPeriod）。既定は今期の通期（lostPeriod） */
    const [period, setPeriod] = useState<Period>('');

    useEffect(() => {
        loadRecords(['leads', 'buyLeads', 'deals'])
            .then(({ records, settings }) => {
                setLeads(records.leads.map(rowOf));
                setBuyLeads(records.buyLeads.map(rowOf));
                setDeals(records.deals.map(rowOf));
                setFiscalStart(settings.fiscalStart);
                setSources(Array.isArray(settings.sources) ? settings.sources.map(String) : []);
                setStaff((settings.staff ?? []).map(s => str(s.name)).filter(Boolean));
                setPeriod(`fy:${fyStartOf(fiscalMonths(settings.fiscalStart)[0], settings.fiscalStart)}`);
            })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const options = useMemo(() => periodGroups(fiscalStart, leads), [fiscalStart, leads]);

    const v = useMemo(() => {
        const P = period;
        const staffCols = staff.concat(['（未割当）']);
        const leadsP = leads.filter(l => periodHas(P, recvMonthKey(l), fiscalStart));
        const ended = leadsP.filter(l => l.phase === '追客終了');
        const takako = ended.filter(l => l.endReason === '他決');
        const noWhy = takako.filter(l => !l.lostWhy);
        const dealsLost = deals.filter(d => d.phase === '失注' && periodHas(P, dealLostMonth(d), fiscalStart));
        const buyP = buyLeads.filter(b => periodHas(P, recvMonthKey(b), fiscalStart));
        const buyEnded = buyP.filter(b => b.phase === '追客終了');
        const srcCols = [...new Set(sources.concat(ended.map(l => str(l.source) || '（未設定）')))];
        const lp = takako.filter(l => l.lostPrice && l.price);
        const gap = lp.length ? lp.reduce((s, l) => s + (num(l.lostPrice) - num(l.price)), 0) / lp.length : null;
        const co = new Map<string, number>();
        for (const l of takako) if (l.lostTo) co.set(str(l.lostTo), (co.get(str(l.lostTo)) || 0) + 1);
        const coRows = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        return { staffCols, leadsP, ended, takako, noWhy, dealsLost, buyEnded, srcCols, lp, gap, coRows };
    }, [period, leads, buyLeads, deals, sources, staff, fiscalStart]);

    /** 他決・失注の明細 CSV（lostCsv） */
    const downloadCsv = () => {
        const q = (x: unknown) => `"${str(x).replace(/"/g, '""')}"`;
        const rows: unknown[][] = [['区分', '受信日・失注日', '反響元・種別', '氏名・物件', '所在地', '担当', '理由', '決め手', '他決先', '他社価格(万円)', '自社査定額(万円)', 'メモ']];
        for (const l of leads) {
            if (l.phase === '追客終了' && periodHas(period, recvMonthKey(l), fiscalStart)) {
                rows.push(['売り反響', l.receivedDate, l.source, l.name, l.addr, l.staff, l.endReason, l.lostWhy, l.lostTo,
                    l.lostPrice ? Math.round(num(l.lostPrice) / 10000) : '', l.price ? Math.round(num(l.price) / 10000) : '', l.lostNote || l.note]);
            }
        }
        for (const d of deals) {
            if (d.phase === '失注' && periodHas(period, dealLostMonth(d), fiscalStart)) {
                rows.push(['商談案件', d.lostDate || d.createdAt || '', d.type, d.property, '', d.staff, d.lostReason, '', '', '',
                    d.price ? Math.round(num(d.price) / 10000) : '', d.lostNote]);
            }
        }
        const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `失注他決_${periodShort(period)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    if (loading || !period) return <div className="rlt-page"><style>{REALTY_CSS}</style><p className="rlt-sub">読み込み中…</p></div>;

    const { staffCols, leadsP, ended, takako, noWhy, dealsLost, buyEnded, srcCols, lp, gap, coRows } = v;

    return (
        <div className="rlt-page rlt-lost">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-puzzle-piece me-2" style={{ color: '#0d6efd' }}></i>失注・他決の分析</h1>
                <span className="rlt-sub">対象期間：</span>
                <select className="rlt-input" value={period} onChange={e => setPeriod(e.target.value)}>
                    {options.map(g => (
                        <optgroup key={g.label} label={g.label}>
                            {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </optgroup>
                    ))}
                </select>
                <button className="rlt-btn sec" onClick={downloadCsv}>⬇ 他決・失注の明細CSV</button>
            </div>
            <p className="rlt-sub" style={{ marginBottom: 12 }}>
                売り反響・買い反響は受信月、商談案件は失注日（未入力は登録日）で数えます。理由は編集画面の「終了理由」「他決の詳細」「失注理由」から集計。
            </p>

            <div className="rlt-lost-tiles">
                <div className="rlt-lost-tile"><div className="lbl">売り反響（{periodShort(period)}受信）</div><div className="val">{leadsP.length}</div>
                    <div className="sub">うち追客終了 {ended.length}件（{pct(leadsP.length ? ended.length / leadsP.length : null)}）</div></div>
                <div className="rlt-lost-tile"><div className="lbl">他決</div><div className="val">{takako.length}</div>
                    <div className="sub">決め手の入力 {takako.length - noWhy.length}／{takako.length}件</div></div>
                <div className="rlt-lost-tile"><div className="lbl">他社価格 − 自社査定額（平均）</div>
                    <div className="val">{gap === null ? '―' : `${gap >= 0 ? '+' : ''}${Math.round(gap / 10000).toLocaleString()}万円`}</div>
                    <div className="sub">両方が入っている他決 {lp.length}件</div></div>
                <div className="rlt-lost-tile"><div className="lbl">商談案件の失注</div><div className="val">{dealsLost.length}</div>
                    <div className="sub">理由の入力 {dealsLost.filter(d => d.lostReason).length}／{dealsLost.length}件</div></div>
            </div>

            <LostTable title="📨 売り反響：終了理由 × 担当" x={lostCross(ended, l => l.endReason, staffCols, l => l.staff, LEAD_ENDS)} total={ended.length} />
            <LostTable title="📨 売り反響：終了理由 × 反響元" x={lostCross(ended, l => l.endReason, srcCols, l => str(l.source) || '（未設定）', LEAD_ENDS)} total={ended.length} />
            <LostTable title="🏳 他決の決め手 × 担当" x={lostCross(takako, l => l.lostWhy, staffCols, l => l.staff, LEAD_LOST_WHY)} total={takako.length}
                note="「査定額が高かった」が多い場合は、査定の根拠説明・価格の出し方をロープレで重点的に練習する材料になります。" />

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>🏢 他決先（上位10社）</h3></div>
                {coRows.length ? (
                    <div className="rlt-tblwrap">
                        <table className="rlt-tbl">
                            <thead><tr><th>会社</th><th className="r">件数</th><th style={{ minWidth: 120 }}></th></tr></thead>
                            <tbody>
                                {coRows.map(([k, n]) => (
                                    <tr key={k}><td>{k}</td><td className="r num">{n}</td><td><LostBar n={n} max={coRows[0][1]} /></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <div className="rlt-body"><p className="rlt-sub">他決先の入力がまだありません。</p></div>}
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>✏️ 決め手が未入力の他決（{noWhy.length}件）</h3></div>
                {noWhy.length ? (
                    <>
                        <div className="rlt-body" style={{ paddingBottom: 4 }}>
                            <p className="rlt-sub">決め手は「売り反響(一括査定)」の画面で、その反響の編集から入力します。架電キュー・架電ナビで「終了」にした反響は、決め手が空欄のままです。</p>
                        </div>
                        <div className="rlt-tblwrap">
                            <table className="rlt-tbl">
                                <thead><tr><th>受信日</th><th>反響元</th><th>売主候補</th><th>物件所在地</th><th>担当</th></tr></thead>
                                <tbody>
                                    {noWhy.slice(0, 50).map(l => (
                                        <tr key={str(l.id)}><td>{fmtD(l.receivedDate)}</td><td>{str(l.source)}</td><td>{str(l.name)}</td><td>{str(l.addr)}</td><td>{str(l.staff)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : <div className="rlt-body"><p className="rlt-sub">未入力はありません。</p></div>}
            </div>

            <LostTable title="🏷 商談案件：失注理由 × 担当" x={lostCross(dealsLost, d => d.lostReason, staffCols, d => d.staff, DEAL_LOST_REASONS)} total={dealsLost.length} />
            {dealsLost.length > 0 && (
                <div className="rlt-card">
                    <div className="rlt-card-head"><h3>🏷 失注した商談案件</h3><span className="rlt-note">編集は「商談案件」の画面から行います</span></div>
                    <div className="rlt-tblwrap">
                        <table className="rlt-tbl">
                            <thead><tr><th>No.</th><th>物件</th><th>種別</th><th>担当</th><th>失注理由</th><th>詳細</th></tr></thead>
                            <tbody>
                                {dealsLost.map(d => (
                                    <tr key={str(d.id)}>
                                        <td>{str(d.no)}</td><td>{str(d.property)}</td><td>{str(d.type)}</td><td>{str(d.staff)}</td>
                                        <td>{str(d.lostReason) || '（未入力）'}</td><td className="rlt-sub">{str(d.lostNote)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <LostTable title="🏠 買い反響：終了理由 × 担当" x={lostCross(buyEnded, b => b.endReason, staffCols, b => b.staff, BUY_ENDS)} total={buyEnded.length} />
        </div>
    );
};

export default LostAnalysis;
```

### 直したファイル（追記分の差分）
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index ea419439..c147545a 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -94,6 +94,33 @@ export const runPlannerSummary = async (): Promise<Result> => {
   return ok({ lead, deals, ledger, staff, settings });
 };
 
+/** planner:records で読める種類（以前のアプリの SYNC_KINDS。features/realty/importer.ts と同じ） */
+const RECORD_KINDS = [
+  'deals', 'ledger', 'renewals', 'leads', 'buyLeads', 'docs', 'settlements', 'resales',
+  'logs', 'notices', 'sellerReports', 'viewings', 'comments',
+];
+
+/**
+ * 不動産企画係の行を種類を指定して読む（v2.2.225。② だけ）。以前のアプリから移す画面（月次売上・月次媒介・失注分析・営業司令塔など）用。
+ * body.kinds = ['deals', 'ledger', …]。⚠️ 削除済み（show_dashboard = 0）は返さない。設定（settings）も返す
+ * 応答: { status, records: { [kind]: 行[] }, settings }
+ */
+export const runPlannerRecords = async (body: Record<string, unknown>): Promise<Result> => {
+  const kinds = Array.isArray(body.kinds) ? [...new Set(body.kinds.map(String))] : [];
+  if (kinds.length === 0 || kinds.some((k) => !RECORD_KINDS.includes(k))) return fail(400, '読む種類（kinds）が正しくありません');
+  const [rows, settings] = await Promise.all([
+    query<DynamicRow>(
+      `SELECT * FROM brokerage_listings WHERE kind IN (${kinds.map(() => '?').join(', ')}) AND (show_dashboard IS NULL OR show_dashboard <> 0)`,
+      kinds
+    ),
+    readSettings(),
+  ]);
+  const records: Record<string, DynamicRow[]> = {};
+  for (const k of kinds) records[k] = [];
+  for (const r of rows) records[String(r.kind)].push(r);
+  return ok({ status: 'success', records, settings });
+};
+
 // ---------------------------------------------------------------------------
 // broker（媒介台帳など）
 // ---------------------------------------------------------------------------
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index d3e9242b..1b3b238d 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -167,6 +167,7 @@ import {
   runBrokerList,
   runBrokerUpdate,
   runPlannerLead,
+  runPlannerRecords,
   runPlannerSummary,
   shopForbidden,
 } from '../features/realty';
@@ -1213,6 +1214,7 @@ register({ request: 'activity', roll: 'read', summary: '【書き込み】不動
 // ⚠️ v2.2.223 新規（② だけ）。設定・週次行動計画・コンプライアンス（app_state）。features/realty/state.ts
 //   ⚠️ 本番アプリと同じく、担当事業が realty / all の人なら誰でも直せる。
 //     ⚠️ 例外は確定済みの月の週次目標（マスター・マネージャーだけ。state.ts の isWeeklyAdmin）
+register({ request: 'planner', roll: 'records', summary: '不動産企画係: 種類を指定して行と設定を読む（以前のアプリから移す画面用）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runPlannerRecords(body)) });
 register({ request: 'planner', roll: 'state', summary: '不動産企画係: 設定・週次行動計画・コンプライアンスと、架電実績を数える売り反響', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s) => runPlannerState(s)) });
 register({ request: 'planner', roll: 'settings', summary: '【書き込み】不動産企画係: 設定の項目を保存', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runPlannerSettings(body)) });
 register({ request: 'planner', roll: 'weekly', summary: '【書き込み】不動産企画係: 週次行動計画のセルを保存', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runPlannerWeekly(s, body)) });
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 90fcaebe..5ea82f32 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -157,6 +157,8 @@ function expressProxyRequests(): array
         'planner:import_check',
         'planner:import_records',
         'planner:import_finish',
+        // ⚠️ v2.2.225。以前のアプリから移す画面の読み出し（② だけ）。expressProxyExclusive() にも入れてある
+        'planner:records',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -814,6 +816,8 @@ function expressProxyExclusive(): array
         'planner:import_check',
         'planner:import_records',
         'planner:import_finish',
+        // v2.2.225 新規。以前のアプリから移す画面の読み出し。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'planner:records',
 
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 97405a00..b77e1ded 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -44,6 +44,10 @@ import LeadResale from "./components/realty/resale/LeadResale";
 import WeeklyPlan from "./components/realty/weekly/WeeklyPlan";
 import Compliance from "./components/realty/compliance/Compliance";
 import RealtySettings from "./components/realty/settings/RealtySettings";
+import MonthlySales from "./components/realty/sales/MonthlySales";
+import BaikaiMonthly from "./components/realty/bmonthly/BaikaiMonthly";
+import LostAnalysis from "./components/realty/lost/LostAnalysis";
+import RealtyPending from "./components/realty/RealtyPending";
 import Guide from "./components/guide/Guide";
 
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
@@ -191,6 +195,11 @@ function AppInner() {
             <Route path="/realtyWeekly" element={<RealtyRoute><WeeklyPlan /></RealtyRoute>} />
             <Route path="/realtyCompliance" element={<RealtyRoute><Compliance /></RealtyRoute>} />
             <Route path="/realtySettings" element={<RealtyRoute><RealtySettings /></RealtyRoute>} />
+            {/* ⚠️ v2.2.225: 以前のアプリのメニューから移した画面・まだ移していない画面の案内（realty/RealtyMenu.tsx） */}
+            <Route path="/realtySales" element={<RealtyRoute><MonthlySales /></RealtyRoute>} />
+            <Route path="/realtyBaikaiMonthly" element={<RealtyRoute><BaikaiMonthly /></RealtyRoute>} />
+            <Route path="/realtyLost" element={<RealtyRoute><LostAnalysis /></RealtyRoute>} />
+            <Route path="/realtyPending" element={<RealtyRoute><RealtyPending /></RealtyRoute>} />
             {/* ⚠️ v2.2.221〜222 の2段の URL。⚠️ 画面の中から移ってきたときだけ効く（再読み込みは上の理由で届かない） */}
             <Route path="/realty/summary" element={<Navigate to="/summary" replace />} />
             <Route path="/realty/report" element={<Navigate to="/report" replace />} />
diff --git a/frontend/src/components/Menu.tsx b/frontend/src/components/Menu.tsx
index 729ab8f8..f6161af5 100644
--- a/frontend/src/components/Menu.tsx
+++ b/frontend/src/components/Menu.tsx
@@ -10,6 +10,7 @@ import { useIsSp } from '../utils/isSp';
 import apiClient from "../utils/apiClient";
 import { isPendingSync } from './list/listTags';
 import { missingLostFields } from '../utils/informationUtils';
+import RealtyMenu from './realty/RealtyMenu';
 import GuideSearchPanel, { GuideListItem, divisionColorOf, divisionLabelOf, fetchGuideListOnce } from './guide/GuideSearchPanel';
 import { GUIDE_COMMON, allowedGuideDivisions, isGuideCategory, openGuide } from './guide/openGuide';
 
@@ -231,17 +232,7 @@ const Menu = ({ key, onReload }: Props) => {
 
     const MENU_CONFIG: MenuItem[] = useMemo(() => [
         { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'realty', exact: true },
-        // ⚠️ v2.2.223: 不動産企画係の URL は1段（`/realty/...` にしない。App.tsx の注記）
-        { id: 'summary', path: '/summary', icon: 'fa-chart-line', label: 'チームサマリー', show: !isSp && category === 'realty', exact: true },
-        { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'realty', exact: true },
-        { id: 'leadSell', path: '/leadSell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'realty', exact: true },
-        { id: 'leadBuy', path: '/leadBuy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'realty', exact: true },
-        { id: 'deals', path: '/leadOpportunity', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'realty', exact: true },
-        { id: 'leadResale', path: '/leadResale', icon: 'fa-arrows-rotate', label: '買取再販案件', show: !isSp && category === 'realty', exact: true },
-        // ⚠️ v2.2.223: 本番アプリから移植
-        { id: 'weekly', path: '/realtyWeekly', icon: 'fa-calendar-week', label: '週次行動計画', show: !isSp && category === 'realty', exact: true },
-        { id: 'compliance', path: '/realtyCompliance', icon: 'fa-list-check', label: 'コンプライアンス', show: !isSp && category === 'realty', exact: true },
-        { id: 'realtySettings', path: '/realtySettings', icon: 'fa-gear', label: '設定', show: !isSp && category === 'realty', exact: true },
+        // ⚠️ v2.2.225: 不動産企画係（category = realty）の項目は realty/RealtyMenu.tsx に移した（以前のアプリと同じ並び・見出し）
         {
             id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
             badges: (category === 'order' && sync > 0) ? [{ label: `未同期 ${sync}件`, top: '8px' }] : []
@@ -278,8 +269,6 @@ const Menu = ({ key, onReload }: Props) => {
          *   ⚠️ **同じ名前の列で数字が違う。** 揃えるかは利用者の判断を待っている。
          */
         { id: 'shop', path: '/shop', icon: 'fa-chart-pie', label: '店舗別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
-        { id: 'property_used', path: '/property', icon: 'fa-house', label: '掲載物件一覧', show: category === 'realty', exact: false },
-        { id: 'broker', path: '/broker', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'realty', exact: false },
         { id: 'customerTrend', path: '/customerTrend', icon: 'fa-chart-bar', label: '販促媒体別反響推移', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
         { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'realty', exact: true },
         { id: 'calendar', path: '/calendar', icon: 'fa-calendar', label: 'カレンダー', show: !isSp && category === 'order', exact: true },
@@ -338,7 +327,11 @@ const Menu = ({ key, onReload }: Props) => {
                     </div>
                 )}
 
-                {MENU_CONFIG.filter(item => item.show).map((item, index) => {
+                {/* ⚠️ v2.2.225: 不動産企画係は以前のアプリと同じ並び・見出しの専用メニュー（realty/RealtyMenu.tsx） */}
+                {category === 'realty' && (
+                    <RealtyMenu isSp={isSp} isActive={(path) => fullPath === path || (path === '/broker' && currentPath === '/broker')} onNavigate={handleNavigate} />
+                )}
+                {category !== 'realty' && MENU_CONFIG.filter(item => item.show).map((item, index) => {
                     const isActive = checkIsActive(item);
                     return (
                         <div
diff --git a/frontend/src/components/realty/common/realtyState.ts b/frontend/src/components/realty/common/realtyState.ts
index 28c313a7..58a5b3de 100644
--- a/frontend/src/components/realty/common/realtyState.ts
+++ b/frontend/src/components/realty/common/realtyState.ts
@@ -7,7 +7,7 @@
  */
 import apiClient from '../../../utils/apiClient';
 import { callsOf, prevMonth } from '../summary/kpi';
-import type { Row, StaffSetting } from '../summary/kpi';
+import type { Row, Settings, StaffSetting } from '../summary/kpi';
 
 export type Template = { id: string; title: string; body: string };
 
@@ -80,6 +80,18 @@ export const loadRealtyState = async (): Promise<RealtyState> => {
     };
 };
 
+export type RecordKind = 'deals' | 'ledger' | 'renewals' | 'leads' | 'buyLeads' | 'docs' | 'settlements' | 'resales'
+    | 'logs' | 'notices' | 'sellerReports' | 'viewings' | 'comments';
+
+/**
+ * 種類を指定して行と設定を読む（② の planner:records。v2.2.225）。以前のアプリから移す画面用。
+ * ⚠️ 削除済み（show_dashboard = 0）は入っていない。⚠️ 日付は 'YYYY-MM-DD'、callDates などは JSON 文字列のまま（kpi.ts の callsOf で読む）
+ */
+export const loadRecords = async <K extends RecordKind>(kinds: K[]): Promise<{ records: Record<K, Row[]>; settings: RealtySettings & Settings }> => {
+    const d = await post('records', { kinds });
+    return { records: (d.records ?? {}) as Record<K, Row[]>, settings: (d.settings ?? {}) as RealtySettings & Settings };
+};
+
 /** 設定の項目を保存して、保存後の設定全体を返す */
 export const saveRealtySettings = async (patch: Partial<RealtySettings>): Promise<RealtySettings> =>
     ((await post('settings', { patch })).settings as RealtySettings) ?? {};
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index 89b722e3..ba78cfc5 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -2,7 +2,7 @@ import React, { useState, useEffect, useMemo, useContext } from 'react';
 import apiClient from '../../../utils/apiClient';
 import LeadHeader from '../common/LeadHeader'; // パスは環境に合わせて調整してください
 import { thisYear } from '../../../utils/thisYear';
-import { removeSpaces, formatDate } from './summaryUtiles'; // パスは環境に合わせて調整してください
+import { formatDate } from './summaryUtiles';
 import AuthContext from '../../../context/AuthContext';
 // 💡 追加: タスク一覧の「開く」から顧客情報を編集する
 import LeadEdit, { LeadCategory } from '../common/LeadEdit';
@@ -14,6 +14,11 @@ import {
     monthLabel, pct, reformByStaffMonth, reformGpByStaffMonth, salesByStaffMonth, sumRow, todayStr,
 } from './kpi';
 import type { Row, Settings } from './kpi';
+// ⚠️ v2.2.225: 以前のダッシュボードと同じ並び（営業司令塔は最下段）・買取再販の期限アラート
+import { useNavigate } from 'react-router-dom';
+import CommandCenter from './CommandCenter';
+import { resaleDashAlerts } from './resaleAlerts';
+import { loadRecords } from '../common/realtyState';
 
 // ==========================================
 // 💡 型定義 (推論ベース)
@@ -65,20 +70,6 @@ const calcRate = (part: number, total: number) => {
     return ((part / total) * 100).toFixed(1) + '%';
 };
 
-const now = new Date();
-const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
-
-const isOver = (nextDate: string | null) => {
-    if (!nextDate) return false;
-    return new Date(nextDate).getTime() < today;
-};
-const isToday = (nextDate: string | null) => {
-    if (!nextDate) return false;
-    const t = new Date(nextDate).getTime();
-    return t >= today && t < today + 86400000;
-};
-const isNotNext = (nextDate: string | null) => !nextDate || nextDate.startsWith('0000');
-
 // 💡 アプリ全体設定（planner_summary が app_state.settings をそのまま返す）。⚠️ v2.2.222 から kpi.ts の Settings
 type AppSettings = Settings;
 
@@ -115,12 +106,6 @@ const prevMonth = (month: string) => {
     const d = new Date(y, m - 2, 1);
     return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
 };
-const isFollow = (phase: string | null) => ['追客中', '通電済み', '内見予約', '内見済み'].includes(phase || '');
-const diffDays = (base: string | null) => {
-    if (!base || base.startsWith('0000')) return null;
-    return Math.floor((today - new Date(base).getTime()) / (1000 * 60 * 60 * 24));
-};
-
 // ==========================================
 // 💡 コンパクトな共通スタイル
 // ==========================================
@@ -175,8 +160,6 @@ const Summary = () => {
     const { userName } = useContext(AuthContext);
 
     // State
-    const [myself, setMyself] = useState(false);
-    const [activeTab, setActiveTab] = useState('today');
     const [isLoading, setIsLoading] = useState(false);
 
     const [leads, setLeads] = useState<SummaryLead[]>([]); // 売り反響
@@ -195,8 +178,6 @@ const Summary = () => {
     const [customerInfo, setCustomerInfo] = useState<Partial<SummaryLead>>({});
     const [editCategory, setEditCategory] = useState<LeadCategory>('sell');
 
-    const realTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
-
     // 💡 データの取得 (モックの代わりにAPI呼び出しを想定)
     useEffect(() => {
         const fetchData = async () => {
@@ -217,6 +198,8 @@ const Summary = () => {
                         setBuyLeads(allLeads.filter(l => l.kind === 'buyLeads'));
                     }
                     setDeals(((response.data.deals ?? []) as Row[]).filter(d => !isSoftDeleted(d)));
+                    // ⚠️ v2.2.225: 買取再販の期限アラート（以前のアプリの朝礼用アラートの最後）
+                    loadRecords(['resales']).then(r => setResales(r.records.resales)).catch(e => console.error('[Summary] 買取再販を読めませんでした', e));
                     setLedger(((response.data.ledger ?? []) as Row[]).filter(l => !isSoftDeleted(l)));
                     if (response.data.staff) {
                         setStaffList(response.data.staff.filter((st: any) => st.period === String(thisYear)).map((st: any) => st.name));
@@ -233,70 +216,6 @@ const Summary = () => {
         fetchData();
     }, []);
 
-    // ==========================================
-    // 💡 1. 営業司令塔 KPIサマリー (売・買リードを合算)
-    // ==========================================
-    const dashboardSummary = useMemo(() => {
-        const summary = { over: 0, today: 0, next: 0, slowdown: 0, hot: 0, follow: 0 };
-
-        // 売りと買いのリードを統合して処理
-        const allLeads = [...leads, ...buyLeads];
-        const staffLeads = allLeads.filter(l => myself ? removeSpaces(l.staff) === removeSpaces(userName) : true);
-
-        staffLeads.forEach(lead => {
-            if (isOver(lead.nextDate)) summary.over++;
-            if (isToday(lead.nextDate)) summary.today++;
-            if (isNotNext(lead.nextDate) && isFollow(lead.phase)) summary.next++;
-            if (isFollow(lead.phase)) summary.follow++;
-
-            const elapsed = diffDays(lead.contactDate || lead.receivedDate);
-            if (elapsed && elapsed >= 14 && isFollow(lead.phase)) summary.slowdown++;
-
-            if (['内見済み', '訪問査定', '査定書提出', '購入申込'].includes(lead.phase || '')) {
-                summary.hot++;
-            }
-        });
-        return summary;
-    }, [leads, buyLeads, myself, userName]);
-
-    // ==========================================
-    // 💡 2. タスク・アラート抽出（司令塔下部のテーブル用）
-    // ==========================================
-    const toDoSummary = useMemo(() => {
-        // 売りと買いのリードを統合
-        const allLeads = [...leads, ...buyLeads];
-        let targetLeads = allLeads.filter(l => myself ? removeSpaces(l.staff) === removeSpaces(userName) : true);
-
-        if (activeTab === 'today') {
-            targetLeads = targetLeads.filter(l => isOver(l.nextDate) || isToday(l.nextDate));
-        } else if (activeTab === 'hot') {
-            targetLeads = targetLeads.filter(l => ['内見済み', '訪問査定', '査定書提出', '購入申込'].includes(l.phase || ''));
-        } else if (activeTab === 'stale') {
-            targetLeads = targetLeads.filter(l => {
-                const elapsed = diffDays(l.contactDate || l.receivedDate);
-                return isFollow(l.phase) && ((elapsed && elapsed >= 14) || isNotNext(l.nextDate));
-            });
-        }
-
-        return targetLeads.map(t => {
-            // kindプロパティがない場合などのフォールバック
-            const isBuy = t.kind === 'buyLeads' || t.targetProperty != null;
-            return {
-                id: t.id,
-                kindLabel: isBuy ? '買' : '売',
-                kindColor: isBuy ? '#0d6efd' : '#dc3545',
-                name: t.name || t.seller || '不明',
-                staff: t.staff || '未割当',
-                next: t.nextDate ? t.nextDate.split(' ')[0] : '未設定',
-                note: t.nextNote || t.note || '-',
-                diff: diffDays(t.nextDate) || 0,
-                addr: t.addr1 || t.addr || t.targetProperty || '住所不明',
-                contact: `${t.phone || ''} ${t.mail || ''}`.trim(),
-                phase: t.phase || '不明'
-            }
-        }).sort((a, b) => b.diff - a.diff);
-    }, [leads, buyLeads, myself, userName, activeTab]);
-
     // ==========================================
     // 💡 タスク一覧「開く」→ 顧客情報編集
     // ==========================================
@@ -484,6 +403,14 @@ const Summary = () => {
     }, [leads, buyLeads, settings.staff]);
 
     /** 🆕 朝礼用アラート（v2.2.222）。直近14日に商談リストへ登録した案件・新規の媒介獲得 */
+    const navigate = useNavigate();
+    const [resales, setResales] = useState<Row[]>([]);
+    /** 買取再販の期限・要対応（RSA.dashAlerts）。⚠️ 期首月は買取再販の消費税の設定（rsVat.fyStart。既定6月） */
+    const resaleAlerts = useMemo(() => {
+        const rsVat = (settings as { rsVat?: { fyStart?: number } }).rsVat;
+        return resaleDashAlerts(resales, Number(rsVat?.fyStart) || 6);
+    }, [resales, settings]);
+
     const alerts = useMemo(() => {
         const w = alertWindow();
         const staffSettings = settings.staff ?? [];
@@ -568,129 +495,6 @@ const Summary = () => {
 
             {!isLoading && (
                 <div>
-                    {/* ==========================================
-                        🎯 1. 営業司令塔 (KPI & タスク)
-                    ========================================== */}
-                    <div style={s.card}>
-                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
-                            <div style={s.cardTitle}>
-                                🎯 営業司令塔
-                                <span style={s.badge('#22405c')}>Dashboard集計</span>
-                                <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
-                                    次回アクション・停滞・ホット度をサーバ側で一括算出（{realTime} 時点）
-                                </span>
-                            </div>
-                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
-                                <label style={{ fontSize: '11px', color: '#495057', cursor: 'pointer', margin: 0 }}>
-                                    <input type="checkbox" checked={myself} onChange={(e) => setMyself(e.target.checked)} style={{ marginRight: '6px' }} />
-                                    自分の担当のみ（{userName}）
-                                </label>
-                                <button style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
-                                    ↻ 再集計
-                                </button>
-                            </div>
-                        </div>
-
-                        {/* KPI チップス */}
-                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
-                            <div style={{ flex: 1, border: '1px solid #ffcdd2', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff5f5' }}>
-                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc3545' }}>{dashboardSummary.over}</div>
-                                <div style={{ fontSize: '10px', color: '#dc3545' }}>期日超過</div>
-                            </div>
-                            <div style={{ flex: 1, border: '1px solid #ffecb3', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff8f1' }}>
-                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fd7e14' }}>{dashboardSummary.today}</div>
-                                <div style={{ fontSize: '10px', color: '#fd7e14' }}>本日</div>
-                            </div>
-                            <div style={{ flex: 1, border: '1px solid #ffcdd2', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff5f5' }}>
-                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc3545' }}>{dashboardSummary.next}</div>
-                                <div style={{ fontSize: '10px', color: '#dc3545' }}>次回未設定</div>
-                            </div>
-                            <div style={{ flex: 1, border: '1px solid #ffecb3', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff8f1' }}>
-                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fd7e14' }}>{dashboardSummary.slowdown}</div>
-                                <div style={{ fontSize: '10px', color: '#fd7e14' }}>停滞</div>
-                            </div>
-                            <div style={{ flex: 1, border: '1px solid #bbdefb', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f0f7ff' }}>
-                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d6efd' }}>{dashboardSummary.hot}</div>
-                                <div style={{ fontSize: '10px', color: '#0d6efd' }}>ホット</div>
-                            </div>
-                            <div style={{ flex: 1, border: '1px solid #e9ecef', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
-                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6c757d' }}>{dashboardSummary.follow}</div>
-                                <div style={{ fontSize: '10px', color: '#6c757d' }}>追客中 合計</div>
-                            </div>
-                        </div>
-
-                        {/* タブ */}
-                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
-                            <button onClick={() => setActiveTab('today')} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ced4da', backgroundColor: activeTab === 'today' ? '#343a40' : '#fff', color: activeTab === 'today' ? '#fff' : '#495057', fontWeight: 'bold' }}>
-                                ⏰ 今日やること <span style={s.badge('#dc3545')}>{dashboardSummary.over + dashboardSummary.today}</span>
-                            </button>
-                            <button onClick={() => setActiveTab('hot')} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ced4da', backgroundColor: activeTab === 'hot' ? '#343a40' : '#fff', color: activeTab === 'hot' ? '#fff' : '#495057', fontWeight: 'bold' }}>
-                                🔥 ホットな反響 <span style={s.badge('#0d6efd')}>{dashboardSummary.hot}</span>
-                            </button>
-                            <button onClick={() => setActiveTab('stale')} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ced4da', backgroundColor: activeTab === 'stale' ? '#343a40' : '#fff', color: activeTab === 'stale' ? '#fff' : '#495057', fontWeight: 'bold' }}>
-                                🚨 停滞アラート <span style={s.badge('#ffc107', '#212529')}>{dashboardSummary.slowdown + dashboardSummary.next}</span>
-                            </button>
-                        </div>
-
-                        {/* リスト表示部 */}
-                        <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
-                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
-                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
-                                    <tr>
-                                        <th style={{ ...s.th, width: '40px', textAlign: 'center' }}>区分</th>
-                                        <th style={{ ...s.th, width: '180px' }}>相手先 / 連絡先</th>
-                                        <th style={{ ...s.th, width: '80px' }}>担当</th>
-                                        <th style={{ ...s.th, width: '80px' }}>状態</th>
-                                        <th style={{ ...s.th, width: '90px' }}>予定日</th>
-                                        <th style={s.th}>次回アクション</th>
-                                        <th style={{ ...s.th, width: '60px', textAlign: 'center' }}>超過</th>
-                                        <th style={{ ...s.th, width: '80px', textAlign: 'center' }}>操作</th>
-                                    </tr>
-                                </thead>
-                                <tbody>
-                                    {toDoSummary.length > 0 ? (
-                                        toDoSummary.map((t) => (
-                                            <tr key={t.id} style={{ backgroundColor: t.diff > 0 ? '#fff5f5' : '#fff' }}>
-                                                <td style={{ ...s.td, textAlign: 'center' }}>
-                                                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: t.kindColor, border: `1px solid ${t.kindColor}`, padding: '1px 4px', borderRadius: '3px', backgroundColor: `${t.kindColor}15` }}>
-                                                        {t.kindLabel}
-                                                    </span>
-                                                </td>
-                                                <td style={s.td}>
-                                                    <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '12px' }}>{t.name}</div>
-                                                    <div style={{ fontSize: '10px', color: '#6c757d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
-                                                        {t.contact} / {t.addr}
-                                                    </div>
-                                                </td>
-                                                <td style={s.td}>{t.staff}</td>
-                                                <td style={s.td}>
-                                                    <span style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{t.phase}</span>
-                                                </td>
-                                                <td style={{ ...s.td, color: t.diff > 0 ? '#dc3545' : '#495057', fontWeight: t.diff > 0 ? 'bold' : 'normal' }}>
-                                                    {t.next}
-                                                </td>
-                                                <td style={s.td}>{t.note}</td>
-                                                <td style={{ ...s.td, textAlign: 'center' }}>
-                                                    {t.diff > 0 ? (
-                                                        <span style={s.badge('#dc3545')}>{t.diff}日</span>
-                                                    ) : '-'}
-                                                </td>
-                                                <td style={{ ...s.td, textAlign: 'center' }}>
-                                                    <button
-                                                        style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#0d6efd' }}
-                                                        onClick={() => handleOpenLead(t.id)}
-                                                    >開く</button>
-                                                </td>
-                                            </tr>
-                                        ))
-                                    ) : (
-                                        <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6c757d', fontSize: '11px' }}>該当するタスクはありません</td></tr>
-                                    )}
-                                </tbody>
-                            </table>
-                        </div>
-                    </div>
-
                     {/* ==========================================
                         🔻 2. 歩留まりファネル
                     ========================================== */}
@@ -1060,11 +864,45 @@ const Summary = () => {
                                     </tbody>
                                 </table>
                             ))}
-                        <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '8px' }}>
-                            ※ 買取再販の期限アラートと営業司令塔の詳細は、買取再販・商談案件の移植のときに足します。
-                        </div>
+                        {/* ⚠️ v2.2.225: 買取再販の期限・要対応（以前のアプリの RSA.dashAlerts。summary/resaleAlerts.ts） */}
+                        {showAlerts && resaleAlerts.length > 0 && (
+                            <>
+                                <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '12px 0 6px' }}>
+                                    🏗 買取再販の期限・要対応 <span style={s.badge('#fd7e14')}>{resaleAlerts.length}件</span>
+                                </div>
+                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
+                                    <thead><tr>{['物件', '仕入担当', 'ステータス', '内容', ''].map(h => <th key={h} style={{ ...s.th, textAlign: 'left' }}>{h}</th>)}</tr></thead>
+                                    <tbody>
+                                        {resaleAlerts.map(({ r, a }) => (
+                                            <tr key={String(r.id)}>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(r.property || '（名称未設定）')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(r.staff ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(r.status ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>
+                                                    {a.map(x => <span key={x.t} style={{ ...s.badge(x.lv >= 2 ? '#dc3545' : '#ffc107', x.lv >= 2 ? '#fff' : '#212529'), marginRight: 4 }}>{x.t}</span>)}
+                                                </td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>
+                                                    <button type="button" onClick={() => navigate('/leadResale')} style={{ fontSize: '10px', padding: '1px 8px', border: '1px solid #ced4da', background: '#fff', borderRadius: 4 }}>開く</button>
+                                                </td>
+                                            </tr>
+                                        ))}
+                                    </tbody>
+                                </table>
+                            </>
+                        )}
                     </div>
 
+                    {/* ==========================================
+                        🧭 8. 営業司令塔（v2.2.225。以前のアプリと同じく最下段・折りたたみ式。summary/CommandCenter.tsx）
+                    ========================================== */}
+                    <CommandCenter
+                        leads={leads as unknown as Row[]}
+                        buyLeads={buyLeads as unknown as Row[]}
+                        deals={deals}
+                        me={userName}
+                        onOpen={(kind, id) => (kind === 'deals' ? navigate('/leadOpportunity') : handleOpenLead(id))}
+                    />
+
                 </div>
             )}
 
diff --git a/frontend/src/components/realty/summary/kpi.ts b/frontend/src/components/realty/summary/kpi.ts
index fa74c503..3977c9cf 100644
--- a/frontend/src/components/realty/summary/kpi.ts
+++ b/frontend/src/components/realty/summary/kpi.ts
@@ -156,19 +156,19 @@ export const CONFIRMED = ['契約済', '契約予定', '決済完了'];
 const stdFee = (price: number): number => (!price || price <= 0 ? 0 : price <= 8_000_000 ? 300_000 : Math.round(price * 0.03 + 60_000));
 
 /** 仲介手数料（dealFee）。手入力のときはその値 */
-const dealFee = (d: Row): number => (num(d.feeManual) ? num(d.fee) : stdFee(num(d.price)));
-const dealReform = (d: Row): number => Math.max(0, Math.round(num(d.reformPrice)));
-const dealReformGp = (d: Row): number => Math.round(num(d.reformGp));
+export const dealFee = (d: Row): number => (num(d.feeManual) ? num(d.fee) : stdFee(num(d.price)));
+export const dealReform = (d: Row): number => Math.max(0, Math.round(num(d.reformPrice)));
+export const dealReformGp = (d: Row): number => Math.round(num(d.reformGp));
 /** 売上計上額＝仲介手数料＋リフォーム粗利（dealSales） */
-const dealSales = (d: Row): number => dealFee(d) + dealReformGp(d);
+export const dealSales = (d: Row): number => dealFee(d) + dealReformGp(d);
 
-type Share = { name: string; ratio: number; cnt: number };
+export type Share = { name: string; ratio: number; cnt: number };
 
 /**
  * 主担当と共同担当の按分（dealShares）。
  * 共同担当なし・割合0・同一人物 → 主担当100%・1件／主担当なし → 共同担当100%・1件／両方 → 売上は割合、件数は0.5件ずつ
  */
-const dealShares = (d: Row): Share[] => {
+export const dealShares = (d: Row): Share[] => {
     const main = str(d.staff).trim();
     const sub = str(d.subStaff).trim();
     const r = Math.min(100, Math.max(0, num(d.subRatio)));
@@ -179,12 +179,13 @@ const dealShares = (d: Row): Share[] => {
 
 export type StaffMonth = Record<string, Record<string, number>>;
 
-/** 担当者 × 契約月の集計（dealSumByStaffMonth）。⚠️ 契約日のない案件・失注は数えない */
-const sumByStaffMonth = (deals: Row[], pick: (d: Row) => number): StaffMonth => {
+/** 担当者 × 契約月の集計（dealSumByStaffMonth）。⚠️ 契約日のない案件・失注は数えない。filter で絞れる（確定だけ など） */
+export const sumByStaffMonth = (deals: Row[], pick: (d: Row) => number, filter?: (d: Row) => boolean): StaffMonth => {
     const out: StaffMonth = {};
     for (const d of deals) {
         const cd = str(d.contractDate);
         if (!cd || str(d.phase) === '失注') continue;
+        if (filter && !filter(d)) continue;
         const mk = cd.slice(0, 7);
         const v = pick(d);
         for (const sh of dealShares(d)) {
@@ -315,6 +316,15 @@ export const daysAgoLabel = (ds: string, today: string): string => {
 export const fmtYen = (v: number | null | undefined): string =>
     v === null || v === undefined || Number.isNaN(v) ? '―' : `¥${Math.round(v).toLocaleString()}`;
 
+/** '123万'（fmtMan）。万円に四捨五入 */
+export const fmtMan = (v: number): string => `${Math.round(v / 10000).toLocaleString()}万`;
+
+/** その人の取り分（dealFeeFor / dealReformFor / dealReformGpFor）。担当でなければ 0 */
+export const shareOf = (d: Row, name: string, pick: (d: Row) => number): number => {
+    const sh = dealShares(d).find(x => x.name === name);
+    return sh ? Math.round(pick(d) * sh.ratio) : 0;
+};
+
 /** 0 のときは ―（fmtYen0） */
 export const fmtYen0 = (v: number): string => (v > 0 ? fmtYen(v) : '―');
 
```
