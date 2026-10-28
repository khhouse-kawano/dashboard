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
