/**
 * チームサマリーの集計（v2.2.222）。
 *
 * ⚠️ 移植元は本番の不動産企画係アプリ（khf-eigyokanri.netlify.app。V18）の renderDash と、その下で使う関数。
 *   数字が本番と一致するよう、**定義をそのまま写している**（関数名の後ろの括弧は移植元の名前）。
 *   ⚠️ 移植元を直したら、ここも同じように直すこと（切り替えまでは本番と並べて見比べるため）。
 *
 * 入力は brokerage_listings の行（planner:summary が返す lead・deals・ledger）と app_state の settings。
 */

export type Row = Record<string, unknown>;

export type StaffSetting = {
    id?: string;
    abbr?: string;
    name?: string;
    /** 年間予算（売上計上額・円） */
    budget?: number;
    /** 今月目標（売上計上額・円） */
    monthlyGoal?: number;
    /** 年間の媒介受託目標（件） */
    baikaiTarget?: number;
};

export type Settings = {
    staff?: StaffSetting[];
    srcCosts?: Record<string, number>;
    portalCosts?: Record<string, number>;
    /** 期首月（YYYY-MM） */
    fiscalStart?: string;
    showDashAlerts?: boolean;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;

/** 'YYYY-MM-DD'（ローカル日付） */
export const todayStr = (now = new Date()): string =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const addDays = (ds: string, n: number): string => {
    const d = new Date(`${ds}T00:00:00`);
    d.setDate(d.getDate() + n);
    return todayStr(d);
};

/** 期首から12か月（months） */
export const fiscalMonths = (fiscalStart: string | undefined): string[] => {
    const [y, m] = (fiscalStart && /^\d{4}-\d{2}$/.test(fiscalStart) ? fiscalStart : `${new Date().getFullYear()}-01`)
        .split('-').map(Number);
    return Array.from({ length: 12 }, (_, i) => {
        const mm = ((m - 1 + i) % 12) + 1;
        const yy = y + Math.floor((m - 1 + i) / 12);
        return `${yy}-${String(mm).padStart(2, '0')}`;
    });
};

/** 前月（prevMonth） */
export const prevMonth = (mk: string): string => {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** 'YYYY年M月'（mLabelFull） */
export const monthLabel = (mk: string): string => {
    const [y, m] = mk.split('-');
    return `${y}年${Number(m)}月`;
};

// ---------------------------------------------------------------------------
// 架電の記録（callDates）
// ---------------------------------------------------------------------------

type CallEntry = { date?: string; type?: string; staff?: string } | string;

/** callDates は JSON 文字列で入っている（配列のこともある） */
export const callsOf = (row: Row): CallEntry[] => {
    const raw = row.callDates;
    if (Array.isArray(raw)) return raw as CallEntry[];
    if (typeof raw !== 'string' || raw.trim() === '') return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as CallEntry[]) : [];
    } catch {
        return [];
    }
};

/** 架電の種類（callType）。⚠️ type が無い・知らない値は「架電」 */
const callType = (c: CallEntry): 'call' | 'line' | 'mail' => {
    const t = typeof c === 'object' && c !== null ? str(c.type) : '';
    return t === 'line' || t === 'mail' ? t : 'call';
};

/** 架電の日（callDay） */
const callDay = (c: CallEntry): string => (typeof c === 'object' && c !== null ? str(c.date) : str(c)).slice(0, 10);

// ---------------------------------------------------------------------------
// 反響の KPI（leadKpi / buyKpi）。⚠️ 受信月コホート。架電数だけはその月に行った架電（📞のみ）
// ---------------------------------------------------------------------------

const recvMonth = (l: Row): string => {
    const mk = str(l.receivedDate).slice(0, 7);
    return /^\d{4}-\d{2}$/.test(mk) ? mk : '';
};

const LEAD_AFTER_CONNECT = ['通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_VISIT = ['訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_PROPOSAL = ['査定書提出', '媒介受託'];

export type LeadKpi = { leads: number; calls: number; connects: number; visits: number; props: number; wins: number };
export type BuyKpi = { leads: number; calls: number; connects: number; views: number; offers: number; wins: number };

const countCallsIn = (rows: Row[], mk: string): number =>
    rows.reduce((a, l) => a + callsOf(l).filter((c) => callDay(c).slice(0, 7) === mk && callType(c) === 'call').length, 0);

export const leadKpi = (leads: Row[], mk: string): LeadKpi => {
    const ls = leads.filter((l) => recvMonth(l) === mk);
    const phase = (l: Row) => str(l.phase);
    return {
        leads: ls.length,
        calls: countCallsIn(leads, mk),
        connects: ls.filter((l) => str(l.connectDate) !== '' || LEAD_AFTER_CONNECT.includes(phase(l))).length,
        visits: ls.filter((l) => str(l.visitDate) !== '' || LEAD_AFTER_VISIT.includes(phase(l))).length,
        props: ls.filter((l) => LEAD_AFTER_PROPOSAL.includes(phase(l))).length,
        wins: ls.filter((l) => phase(l) === '媒介受託').length,
    };
};

export const buyKpi = (buyLeads: Row[], mk: string): BuyKpi => {
    const ls = buyLeads.filter((l) => recvMonth(l) === mk);
    const after = (l: Row, ps: string[]) => ps.includes(str(l.phase));
    return {
        leads: ls.length,
        calls: countCallsIn(buyLeads, mk),
        connects: ls.filter((l) => str(l.connectDate) !== '' || after(l, ['通電済', '内見予約', '内見済', '購入申込', '成約'])).length,
        views: ls.filter((l) => str(l.viewDate) !== '' || after(l, ['内見済', '購入申込', '成約'])).length,
        offers: ls.filter((l) => after(l, ['購入申込', '成約'])).length,
        wins: ls.filter((l) => str(l.phase) === '成約').length,
    };
};

/** その月に受信した反響の反響費用（srcCost / portalCost の合計） */
export const leadCost = (rows: Row[], mk: string, costs: Record<string, number> | undefined, key: 'source' | 'portal'): number =>
    rows.filter((l) => recvMonth(l) === mk).reduce((a, l) => a + num(costs?.[str(l[key])]), 0);

// ---------------------------------------------------------------------------
// 商談案件の売上（dealFee / dealShares / dealSumByStaffMonth）
// ---------------------------------------------------------------------------

/** 確定とみなす商談のフェーズ（CONFIRMED） */
export const CONFIRMED = ['契約済', '契約予定', '決済完了'];

/** 標準の仲介手数料（stdFee）。800万円以下は30万円、それ超は 3%＋6万円 */
const stdFee = (price: number): number => (!price || price <= 0 ? 0 : price <= 8_000_000 ? 300_000 : Math.round(price * 0.03 + 60_000));

/** 仲介手数料（dealFee）。手入力のときはその値 */
export const dealFee = (d: Row): number => (num(d.feeManual) ? num(d.fee) : stdFee(num(d.price)));
export const dealReform = (d: Row): number => Math.max(0, Math.round(num(d.reformPrice)));
export const dealReformGp = (d: Row): number => Math.round(num(d.reformGp));
/** 売上計上額＝仲介手数料＋リフォーム粗利（dealSales） */
export const dealSales = (d: Row): number => dealFee(d) + dealReformGp(d);

export type Share = { name: string; ratio: number; cnt: number };

/**
 * 主担当と共同担当の按分（dealShares）。
 * 共同担当なし・割合0・同一人物 → 主担当100%・1件／主担当なし → 共同担当100%・1件／両方 → 売上は割合、件数は0.5件ずつ
 */
export const dealShares = (d: Row): Share[] => {
    const main = str(d.staff).trim();
    const sub = str(d.subStaff).trim();
    const r = Math.min(100, Math.max(0, num(d.subRatio)));
    if (!sub || r <= 0 || sub === main) return main ? [{ name: main, ratio: 1, cnt: 1 }] : [];
    if (!main) return [{ name: sub, ratio: 1, cnt: 1 }];
    return [{ name: main, ratio: (100 - r) / 100, cnt: 0.5 }, { name: sub, ratio: r / 100, cnt: 0.5 }];
};

export type StaffMonth = Record<string, Record<string, number>>;

/** 担当者 × 契約月の集計（dealSumByStaffMonth）。⚠️ 契約日のない案件・失注は数えない。filter で絞れる（確定だけ など） */
export const sumByStaffMonth = (deals: Row[], pick: (d: Row) => number, filter?: (d: Row) => boolean): StaffMonth => {
    const out: StaffMonth = {};
    for (const d of deals) {
        const cd = str(d.contractDate);
        if (!cd || str(d.phase) === '失注') continue;
        if (filter && !filter(d)) continue;
        const mk = cd.slice(0, 7);
        const v = pick(d);
        for (const sh of dealShares(d)) {
            const row = (out[sh.name] = out[sh.name] ?? {});
            row[mk] = (row[mk] ?? 0) + Math.round(v * sh.ratio);
        }
    }
    return out;
};

export const salesByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealSales);
export const feeByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealFee);
export const reformByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealReform);
export const reformGpByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealReformGp);

/** 契約件数（dealCountByStaffMonth）。⚠️ 共同担当ありは0.5件ずつ */
export const dealCountByStaffMonth = (deals: Row[]): StaffMonth => {
    const out: StaffMonth = {};
    for (const d of deals) {
        const cd = str(d.contractDate);
        if (!cd || str(d.phase) === '失注') continue;
        const mk = cd.slice(0, 7);
        for (const sh of dealShares(d)) {
            const row = (out[sh.name] = out[sh.name] ?? {});
            row[mk] = (row[mk] ?? 0) + sh.cnt;
        }
    }
    return out;
};

/** 媒介獲得数（ledgerCountBy。契約日の月で数える）。⚠️ 台帳の担当は略称なので名前に直す */
export const ledgerCountByStaffMonth = (ledger: Row[], abbrToName: (ab: string) => string): StaffMonth => {
    const out: StaffMonth = {};
    for (const l of ledger) {
        const cd = str(l.contractDate);
        if (!cd) continue;
        const mk = cd.slice(0, 7);
        const k = abbrToName(str(l.staff));
        const row = (out[k] = out[k] ?? {});
        row[mk] = (row[mk] ?? 0) + 1;
    }
    return out;
};

export const sumRow = (row: Record<string, number> | undefined, mks: string[]): number =>
    mks.reduce((a, mk) => a + (row?.[mk] ?? 0), 0);

/** 0.5件の表示（fmtCnt） */
export const fmtCnt = (v: number): string => {
    const r = Math.round((Number(v) || 0) * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

// ---------------------------------------------------------------------------
// 架電実績（callStats）。⚠️ 実日付で本日・今週（月曜はじまり）・今月を数える。s/b は📞のみ
// ---------------------------------------------------------------------------

export type CallCell = { s: number; b: number; line: number; mail: number };
export type CallStats = { out: Record<string, { day: CallCell; week: CallCell; month: CallCell }>; today: string; wFrom: string };

const callCell = (): CallCell => ({ s: 0, b: 0, line: 0, mail: 0 });

const weekStart = (ds: string): string => {
    const d = new Date(`${ds}T00:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return todayStr(d);
};

export const callStats = (leads: Row[], buyLeads: Row[], now = new Date()): CallStats => {
    const today = todayStr(now);
    const wFrom = weekStart(today);
    const mFrom = `${today.slice(0, 7)}-01`;
    const out: CallStats['out'] = {};
    const bump = (nm: string, bucket: 'day' | 'week' | 'month', kind: 's' | 'b', tp: 'call' | 'line' | 'mail') => {
        const o = (out[nm] = out[nm] ?? { day: callCell(), week: callCell(), month: callCell() });
        if (tp === 'call') o[bucket][kind]++;
        else o[bucket][tp]++;
    };
    const scan = (rows: Row[], kind: 's' | 'b') => {
        for (const l of rows) {
            const nm = str(l.staff) || '（未割当）';
            for (const c of callsOf(l)) {
                const d = callDay(c);
                const tp = callType(c);
                if (d === today) bump(nm, 'day', kind, tp);
                if (d >= wFrom && d <= today) bump(nm, 'week', kind, tp);
                if (d >= mFrom && d <= today) bump(nm, 'month', kind, tp);
            }
        }
    };
    scan(leads, 's');
    scan(buyLeads, 'b');
    return { out, today, wFrom };
};

export const emptyCallCell = callCell;

// ---------------------------------------------------------------------------
// 朝礼用アラート（直近14日の新規）
// ---------------------------------------------------------------------------

export const ALERT_DAYS = 14;

/** 商談リストへの登録日（dealRegDate）。旧データは接触日・契約日で代用 */
export const dealRegDate = (d: Row): string => str(d.createdAt || d.contactDate || d.contractDate).slice(0, 10);

export const alertWindow = (now = new Date()): { from: string; to: string } => {
    const to = todayStr(now);
    return { from: addDays(to, -(ALERT_DAYS - 1)), to };
};

export const inWindow = (ds: string, w: { from: string; to: string }): boolean => {
    const v = ds.slice(0, 10);
    return !!v && v >= w.from && v <= w.to;
};

/** 「本日」「3日前」 */
export const daysAgoLabel = (ds: string, today: string): string => {
    const n = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${ds.slice(0, 10)}T00:00:00`).getTime()) / 86_400_000);
    return n <= 0 ? '本日' : `${n}日前`;
};

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

/** '¥1,234,567'（fmtYen）。値が無ければ ― */
export const fmtYen = (v: number | null | undefined): string =>
    v === null || v === undefined || Number.isNaN(v) ? '―' : `¥${Math.round(v).toLocaleString()}`;

/** '123万'（fmtMan）。万円に四捨五入 */
export const fmtMan = (v: number): string => `${Math.round(v / 10000).toLocaleString()}万`;

/** その人の取り分（dealFeeFor / dealReformFor / dealReformGpFor）。担当でなければ 0 */
export const shareOf = (d: Row, name: string, pick: (d: Row) => number): number => {
    const sh = dealShares(d).find(x => x.name === name);
    return sh ? Math.round(pick(d) * sh.ratio) : 0;
};

/** 0 のときは ―（fmtYen0） */
export const fmtYen0 = (v: number): string => (v > 0 ? fmtYen(v) : '―');

/** '12.3%'（pct）。分母0などは ― */
export const pct = (v: number | null): string => (v === null || !Number.isFinite(v) ? '―' : `${(v * 100).toFixed(1)}%`);
