/**
 * 土地仕入（仕入KPI管理 v7.3 の移行。v2.2.311）の計算。DB に触らない。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **frontend/src/components/landAcquisition/landLogic.ts と同じ中身にすること**（画面でも同じ式を使う）。
 *   片方だけ直すと、② の集計と画面の表示（買付の上限・坪単価・返答の残り日数）が食い違う。
 * ⚠️ 式は移行元（仕入KPI管理 v7.3 の actualCompute・simMaxOffer・tsuboUnitOf・replyLevel・setDealStatus）と同じ。
 * ─────────────────────────────────────────────
 */

/** 6指標（land_kpi_def の calc = auto の kpi_key）。⚠️ これ以外の KPI は手入力の実績だけで数える */
export const AUTO_KPI_KEYS = ['ap', 'info', 'prop', 'offer', 'contract', 'lots'] as const;

/** 工程の順番。⚠️ 並び順がそのまま「次へ」の順。⚠️ 決まりに使うので選択肢の表（land_option）には置かない */
export const STATUS = ['情報取得', '社長提案', '買付', '契約', '決済完了', '見送り'] as const;
export const STATUS_SETTLED = '決済完了';
export const STATUS_CLOSED: string[] = ['契約', '決済完了', '見送り'];

/** アプローチの内訳（種別 → まとめ入力の列）。⚠️ 未知の種別は訪問に寄せる */
export const AP_BREAKDOWN: { k: string; label: string }[] = [
    { k: 'visit', label: '訪問' }, { k: 'call', label: '架電' }, { k: 'recv', label: '受電' },
    { k: 'mail', label: 'メール' }, { k: 'fax', label: 'FAX' },
    { k: 'direct', label: '直案件' }, { k: 'bring', label: '業者持込' },
];
export const apTypeKey = (t: string): string => AP_BREAKDOWN.find(b => b.label === String(t ?? '').trim())?.k ?? 'visit';
/** 案件になりやすい種別。記録のとき「案件候補」を既定で ON にする */
export const AP_TYPES_LEAD = ['直案件', '業者持込'];

export const TSUBO_M2 = 3.305785;
export const SIM_DEFAULT = { expenseRate: 5, profitRate: 15 };
export const ALERT_DEFAULT = { leadDays: 7, warnDays: 3 };

const pad = (n: number): string => String(n).padStart(2, '0');
export const ymOf = (date: string | null | undefined): string => (date ? String(date).slice(0, 7) : '');

/** 年度（6月始まり）の12か月 */
export const fyMonths = (fy: number): string[] =>
    Array.from({ length: 12 }, (_, i) => {
        const m = 6 + i;
        return `${fy + Math.floor((m - 1) / 12)}-${pad(((m - 1) % 12) + 1)}`;
    });
/** その日付が入る年度 */
export const fyOf = (date: string): number => {
    const y = Number(date.slice(0, 4)); const m = Number(date.slice(5, 7));
    return m >= 6 ? y : y - 1;
};

/** 達成率（目標が 0 のときは null＝「—」） */
export const rate = (a: number, t: number): number | null => (t > 0 ? Math.round((a / t) * 100) : null);

/** 月の経過率（当月は今日まで、過去は100%、未来は0%） */
export const monthProgress = (month: string, today: string): { pct: number; day: number; days: number } => {
    const y = Number(month.slice(0, 4)); const mm = Number(month.slice(5, 7));
    const days = new Date(y, mm, 0).getDate();
    const cur = today.slice(0, 7);
    if (month < cur) return { pct: 100, day: days, days };
    if (month > cur) return { pct: 0, day: 0, days };
    const d = Number(today.slice(8, 10));
    return { pct: Math.round((d / days) * 100), day: d, days };
};
/** 年度の経過率（各月の経過率を足した「経過月数」） */
export const fyProgress = (fy: number, today: string): { pct: number; day: number; days: number } => {
    const done = fyMonths(fy).reduce((s, m) => s + monthProgress(m, today).pct / 100, 0);
    return { pct: Math.round((done / 12) * 100), day: Math.round(done * 10) / 10, days: 12 };
};

const num = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(/[,，\s]/g, ''));
    return Number.isFinite(n) ? n : null;
};
const rateOr = (v: unknown, def: number): number => {
    const t = String(v ?? '').replace(/[,，%％\s]/g, '');
    if (t === '') return def;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : def;
};

/**
 * 簡易事業収支の買付上限（万円）。
 * 買付上限額 ＝ 想定総販売価格 −（想定建築費 ＋ 予想解体・造成費）− 想定総販売価格 ×（諸経費率 ＋ 目標利益率）÷ 100
 * ⚠️ 想定総販売価格が空・0以下なら null（未算定）
 */
export const simMaxOffer = (d: { simSales?: unknown; simBuild?: unknown; simDemolition?: unknown; simExpenseRate?: unknown; simProfitRate?: unknown }): number | null => {
    const sales = num(d.simSales);
    if (sales === null || sales <= 0) return null;
    const build = num(d.simBuild) ?? 0; const demo = num(d.simDemolition) ?? 0;
    const er = rateOr(d.simExpenseRate, SIM_DEFAULT.expenseRate);
    const pr = rateOr(d.simProfitRate, SIM_DEFAULT.profitRate);
    return Math.round((sales - build - demo - (sales * (er + pr)) / 100) * 10) / 10;
};

/** 坪単価（万円/坪）＝ 購入金額（無ければ想定仕入価格）÷ 地積（坪）。⚠️ 保存しない。毎回計算する */
export const dealPriceOf = (d: { buyPrice?: unknown; price?: unknown }): number | null => num(d.buyPrice) ?? num(d.price);
export const tsuboUnitOf = (d: { buyPrice?: unknown; price?: unknown; landM2?: unknown }): number | null => {
    const p = dealPriceOf(d); const m2 = num(d.landM2);
    if (p === null || p <= 0 || m2 === null || m2 <= 0) return null;
    return Math.round((p / (m2 / TSUBO_M2)) * 10) / 10;
};
export const m2ToTsubo = (m2: unknown): number | null => {
    const v = num(m2);
    return v === null || v <= 0 ? null : Math.round((v / TSUBO_M2) * 100) / 100;
};

/** 今日から見た残り日数（過ぎていればマイナス） */
export const daysUntil = (date: string | null | undefined, today: string): number | null => {
    if (!date) return null;
    const a = Date.parse(`${date}T00:00:00Z`); const b = Date.parse(`${today}T00:00:00Z`);
    return Number.isNaN(a) || Number.isNaN(b) ? null : Math.round((a - b) / 86400000);
};
export const addDays = (date: string, n: number): string => {
    const t = new Date(`${date}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + n);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export type ReplyLevel = 'over' | 'today' | 'soon' | 'ok' | 'unset' | 'done';
/** 返答待ち＝ステータスが買付で、返答結果が未登録 */
export const replyPending = (d: { status: string; replyResult: string }): boolean => d.status === '買付' && !d.replyResult;
export const replyLevel = (d: { status: string; replyResult: string; replyDue: string | null }, today: string, warnDays: number): ReplyLevel => {
    if (!replyPending(d)) return 'done';
    const n = daysUntil(d.replyDue, today);
    if (n === null) return 'unset';
    if (n < 0) return 'over';
    if (n === 0) return 'today';
    return n <= warnDays ? 'soon' : 'ok';
};
export const REPLY_LEVEL_ORDER: Record<ReplyLevel, number> = { over: 0, today: 1, soon: 2, unset: 3, ok: 4, done: 5 };

export const nextStatus = (s: string): string | null => {
    const i = (STATUS as readonly string[]).indexOf(s);
    if (i < 0 || s === STATUS_SETTLED || s === '見送り') return null;
    return STATUS[i + 1];
};

/** ステータスを変えたときに埋める日付など（移行元の setDealStatus と同じ） */
export interface StatusFields {
    status: string; propDate: string | null; offerDate: string | null; contractDate: string | null; settleDate: string | null;
    offerTo: string; vendorName: string; replyDue: string | null; replyResult: string; replyDate: string | null;
}
export const applyStatus = <T extends StatusFields>(d: T, ns: string, today: string, leadDays: number): T => {
    const r = { ...d };
    if (ns === '社長提案' && !r.propDate) r.propDate = today;
    if (ns === '買付') {
        if (!r.propDate) r.propDate = today;
        if (!r.offerDate) r.offerDate = today;
        if (!r.offerTo) r.offerTo = r.vendorName || '';
        if (!r.replyDue) r.replyDue = addDays(r.offerDate || today, leadDays);
    }
    if (ns === '契約' && !r.contractDate) r.contractDate = today;
    if (ns === STATUS_SETTLED) {
        if (!r.contractDate) r.contractDate = today;
        if (!r.settleDate) r.settleDate = today;
    }
    // 契約・決済まで進んだのに返答が未登録の案件は「承諾」で締める（アラートに残さない）
    if ((ns === '契約' || ns === STATUS_SETTLED) && !r.replyResult && (r.replyDue || r.offerDate)) {
        r.replyResult = '承諾';
        if (!r.replyDate) r.replyDate = today;
    }
    r.status = ns;
    return r;
};

// ---------------------------------------------------------------------------
// 実績（移行元の actualCompute）
// ---------------------------------------------------------------------------
export interface CalcDeal { id: number; memberId: number | null; infoDate: string | null; propDate: string | null; offerDate: string | null; contractDate: string | null; lots: number; apId: number | null }
export interface CalcApproach { id: number; memberId: number | null; date: string; type: string; infoCount: number }
export interface CalcDaily { memberId: number | null; date: string; counts: Record<string, number>; info: number }
export interface CalcManual { ym: string; memberId: number; kpiKey: string; value: number }

export type Actual = Record<string, number>;

/**
 * 1か月の実績。members＝対象の担当者（null は全員）。
 * 業者AP  ＝ アプローチ1件ずつ ＋ まとめ入力
 * 情報取得 ＝ 案件の情報取得日 ＋ アプローチの情報取得数（⚠️ 案件にした件数は引く）＋ まとめ入力の情報取得数
 * 社長提案・買付・契約 ＝ 案件のその日付。仕入区画 ＝ 契約日が入った案件の区画数
 * ⚠️ 最後に手入力の実績（land_manual_actual）を足す。auto_<key> に自動の分、man_<key> に手入力の分も残す
 */
export const computeActual = (
    month: string, members: Set<number> | null,
    data: { deals: CalcDeal[]; approaches: CalcApproach[]; daily: CalcDaily[]; manual: CalcManual[] },
    kpiKeys: string[]
): Actual => {
    const has = (id: number | null) => members === null || (id !== null && members.has(id));
    const r: Actual = { apRec: 0, apInfo: 0, logInfo: 0, infoDeal: 0 };
    for (const k of kpiKeys) r[k] = 0;
    for (const b of AP_BREAKDOWN) { r[b.k] = 0; r[`log_${b.k}`] = 0; }
    for (const l of data.daily) {
        if (ymOf(l.date) !== month || !has(l.memberId)) continue;
        for (const b of AP_BREAKDOWN) r[`log_${b.k}`] += Number(l.counts[b.k] || 0);
        r.logInfo += Number(l.info || 0);
    }
    const apDealCnt = new Map<number, number>();
    for (const d of data.deals) if (d.apId) apDealCnt.set(d.apId, (apDealCnt.get(d.apId) ?? 0) + 1);
    for (const a of data.approaches) {
        if (ymOf(a.date) !== month || !has(a.memberId)) continue;
        r.apRec++;
        r[apTypeKey(a.type)]++;
        r.apInfo += Math.max(0, Number(a.infoCount || 0) - (apDealCnt.get(a.id) ?? 0));
    }
    for (const b of AP_BREAKDOWN) r[b.k] += r[`log_${b.k}`];
    r.ap = AP_BREAKDOWN.reduce((s, b) => s + r[b.k], 0);
    r.info = 0; r.prop = 0; r.offer = 0; r.contract = 0; r.lots = 0;
    for (const d of data.deals) {
        if (!has(d.memberId)) continue;
        if (ymOf(d.infoDate) === month) { r.info++; r.infoDeal++; }
        if (ymOf(d.propDate) === month) r.prop++;
        if (ymOf(d.offerDate) === month) r.offer++;
        if (ymOf(d.contractDate) === month) { r.contract++; r.lots += Number(d.lots || 0); }
    }
    r.info += r.apInfo + r.logInfo;
    for (const k of kpiKeys) r[`auto_${k}`] = (AUTO_KPI_KEYS as readonly string[]).includes(k) ? r[k] : 0;
    for (const k of kpiKeys) if (!(AUTO_KPI_KEYS as readonly string[]).includes(k)) r[k] = 0;
    for (const m of data.manual) {
        if (m.ym !== month || !has(m.memberId) || !kpiKeys.includes(m.kpiKey)) continue;
        r[m.kpiKey] += Number(m.value || 0);
    }
    for (const k of kpiKeys) r[`man_${k}`] = r[k] - r[`auto_${k}`];
    return r;
};

/** 複数か月の実績を足す（年度累計） */
export const sumActuals = (list: Actual[]): Actual => {
    const acc: Actual = {};
    for (const a of list) for (const [k, v] of Object.entries(a)) acc[k] = (acc[k] ?? 0) + Number(v || 0);
    return acc;
};

/** 平均達成率（目標が入っている KPI だけ） */
export const avgRate = (a: Actual, t: Record<string, number>, keys: string[]): number | null => {
    const ps = keys.map(k => rate(a[k] ?? 0, t[k] ?? 0)).filter((v): v is number => v !== null);
    return ps.length ? Math.round(ps.reduce((s, v) => s + v, 0) / ps.length) : null;
};
