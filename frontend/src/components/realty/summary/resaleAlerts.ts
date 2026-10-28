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
