import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction, type Tx } from '../../db/pool';
import { logger } from '../../utils/logger';
import type { AuthenticatedStaff } from '../../types/staff';
import {
    ALERT_DEFAULT, AP_BREAKDOWN, AP_TYPES_LEAD, STATUS, STATUS_SETTLED,
    applyStatus, daysUntil, fyMonths, fyOf, m2ToTsubo,
    nextStatus, replyLevel, replyPending, simMaxOffer, tsuboUnitOf, ymOf,
    type CalcApproach, type CalcDaily, type CalcDeal, type CalcManual,
} from './logic';

/**
 * 土地仕入（建売営業のメニューの「土地仕入」。v2.2.311〜）。移行元は「仕入KPI管理 v7.3」（Netlify・Supabase の1ページのアプリ）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 使えるのは担当事業（staff.shop）が spec・all の人（registry.ts の LAND_SHOPS）。移行元の取り込みだけ Master。
 * ⚠️ 担当者は land_member（名前は移行元の表記）。Dashboard のスタッフとは staff_id で結ぶ（ログインした人＝自分の担当）。
 * ⚠️ 絞り込みの「担当」は sel で受ける：'' ＝チーム全員 / 'm:<land_member.id>' ＝1人 / 'a:<land_area.id>'（'a:0' はその他）＝エリアの合算。
 * ⚠️ 計算の式は logic.ts（画面の landLogic.ts と同じ中身）。
 * ⚠️ 消すのは delete_flag = 1（案件・業者・アプローチ）。まとめ入力・日報は移行元と同じく行を消す。
 * ─────────────────────────────────────────────
 */

export interface LandResult { httpStatus: number; body: Record<string, unknown> }
export const ok = (body: Record<string, unknown>): LandResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
export const fail = (httpStatus: number, message: string): LandResult => ({ httpStatus, body: { status: 'error', message } });

export type Row = RowDataPacket & Record<string, unknown>;
export type Body = Record<string, unknown>;

export const str = (v: unknown, max = 255): string => String(v ?? '').trim().slice(0, max);
export const int = (v: unknown, def = 0): number => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : def; };
export const intOrNull = (v: unknown): number | null => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
export const decOrNull = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(/[,，\s]/g, ''));
    return Number.isFinite(n) ? n : null;
};
export const numOf = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
/** 日付（YYYY-MM-DD）。⚠️ 移行元の「2026/9/1」「2026年9月1日」なども読む。読めなければ null */
export const dateOrNull = (v: unknown): string | null => {
    const s = String(v ?? '').trim().replace(/[年月]/g, '-').replace(/日/g, '').replace(/[/.]/g, '-');
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (!m) return null;
    const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return Number.isNaN(Date.parse(`${d}T00:00:00Z`)) ? null : d;
};
export const ymOrEmpty = (v: unknown): string => (/^\d{4}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');

/** 日本時間の今日 */
export const todayJst = (): string => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const nowJst = (): string => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
export const whoOf = (staff: AuthenticatedStaff): string => str(staff.name, 60);

export const audit = async (who: string, act: string, target: string, name: string, note = '', tx?: Tx): Promise<void> => {
    const sql = 'INSERT INTO land_audit (at, user_name, act, target, name, note) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [nowJst(), who, act, target, str(name, 200), str(note, 500)];
    try {
        if (tx) await tx.execute(sql, params); else await execute(sql, params);
    } catch (e) {
        // ⚠️ 履歴が書けなくても本体の保存は止めない（⚠️ 残せなかったことはログに出す）
        logger.error(`land: 更新履歴を書けませんでした: ${(e as Error).message}`);
    }
};

// ---------------------------------------------------------------------------
// マスタ（担当者・エリア・選択肢・KPI・反響ソース・設定）
// ---------------------------------------------------------------------------
export interface LandMember { id: number; name: string; areaId: number | null; areaName: string; staffId: number | null; active: boolean }
export interface Settings { fyStart: number; leadDays: number; warnDays: number }

export const loadSettings = async (): Promise<Settings> => {
    const rows = await query<Row>('SELECT setting_key, setting_value FROM land_setting');
    const map = new Map(rows.map(r => [String(r.setting_key), String(r.setting_value)]));
    const n = (k: string, def: number, lo: number, hi: number) => {
        const v = Number(map.get(k)); return Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : def;
    };
    return {
        fyStart: n('fy_start', fyOf(todayJst()), 2000, 2100),
        leadDays: n('alert_lead_days', ALERT_DEFAULT.leadDays, 0, 90),
        warnDays: n('alert_warn_days', ALERT_DEFAULT.warnDays, 0, 60),
    };
};

export const loadAreas = async (): Promise<{ id: number; name: string; label: string }[]> =>
    (await query<Row>('SELECT id, name, label FROM land_area WHERE active = 1 ORDER BY sort, id'))
        .map(r => ({ id: Number(r.id), name: String(r.name), label: String(r.label || r.name) }));

export const AREA_OTHER = 'その他';
export const loadMembers = async (): Promise<LandMember[]> =>
    (await query<Row>(
        'SELECT m.id, m.name, m.area_id, m.staff_id, m.active, a.label, a.name AS area_name FROM land_member m'
        + ' LEFT JOIN land_area a ON a.id = m.area_id ORDER BY m.active DESC, a.sort IS NULL, a.sort, m.sort, m.id'
    )).map(r => ({
        id: Number(r.id), name: String(r.name), areaId: r.area_id === null ? null : Number(r.area_id),
        areaName: r.area_id === null ? AREA_OTHER : String(r.label || r.area_name),
        staffId: r.staff_id === null ? null : Number(r.staff_id), active: Number(r.active) === 1,
    }));

export const loadKpiDefs = async (): Promise<{ key: string; label: string; unit: string; calc: string; description: string }[]> =>
    (await query<Row>('SELECT kpi_key, label, unit, calc, description FROM land_kpi_def WHERE active = 1 ORDER BY sort, id'))
        .map(r => ({ key: String(r.kpi_key), label: String(r.label), unit: String(r.unit), calc: String(r.calc), description: String(r.description) }));

/** sel（'' / 'm:ID' / 'a:ID'）→ 担当者の id の集合（null＝全員）。⚠️ 停止中の人も含める（過去の記録を落とさない） */
export const membersOfSel = (sel: string, members: LandMember[]): Set<number> | null => {
    const m = /^([ma]):(\d+)$/.exec(sel);
    if (!m) return null;
    const id = Number(m[2]);
    if (m[1] === 'm') return new Set([id]);
    return new Set(members.filter(x => (id === 0 ? x.areaId === null : x.areaId === id)).map(x => x.id));
};

export const runLandMaster = async (staff: AuthenticatedStaff): Promise<LandResult> => {
    const [settings, areas, members, kpiDefs, options, sources] = await Promise.all([
        loadSettings(), loadAreas(), loadMembers(), loadKpiDefs(),
        query<Row>('SELECT list_key, value FROM land_option WHERE active = 1 ORDER BY list_key, sort, id'),
        query<Row>('SELECT id, name, kind FROM land_source WHERE active = 1 ORDER BY sort, id'),
    ]);
    const opt: Record<string, string[]> = {};
    for (const o of options) (opt[String(o.list_key)] ??= []).push(String(o.value));
    const me = members.find(m => m.staffId === staff.id) ?? null;
    return ok({
        settings, areas, members, kpiDefs, options: opt, statuses: STATUS, apBreakdown: AP_BREAKDOWN, apTypesLead: AP_TYPES_LEAD,
        sources: sources.map(s => ({ id: Number(s.id), name: String(s.name), kind: String(s.kind) })),
        meMemberId: me?.id ?? null, today: todayJst(),
    });
};

// ---------------------------------------------------------------------------
// 案件
// ---------------------------------------------------------------------------
const DEAL_SELECT = 'SELECT d.*, m.name AS member_name, m.area_id FROM land_deal d LEFT JOIN land_member m ON m.id = d.member_id WHERE d.delete_flag = 0';

export interface LandDeal {
    id: number; memberId: number | null; memberName: string; areaId: number | null; kind: string; vendorId: number | null; vendorName: string;
    address: string; mapUrl: string; lots: number; landM2: number | null; price: number | null; sellerName: string; agentName: string;
    buyPrice: number | null; terms: string; termsMemo: string; status: string; infoDate: string | null; propDate: string | null;
    offerDate: string | null; contractDate: string | null; settleDate: string | null; memo: string; simSales: number | null;
    simBuild: number | null; simDemolition: number | null; simExpenseRate: number; simProfitRate: number; offerTo: string;
    replyDue: string | null; replyResult: string; replyDate: string | null; replyMemo: string; lostReason: string; lostMemo: string;
    apId: number | null; sourceId: number | null; createdBy: string; updatedBy: string; updatedAt: string;
}
const dealOf = (r: Row): LandDeal => ({
    id: Number(r.id), memberId: r.member_id === null ? null : Number(r.member_id), memberName: String(r.member_name ?? ''),
    areaId: r.area_id === null || r.area_id === undefined ? null : Number(r.area_id),
    kind: String(r.kind), vendorId: r.vendor_id === null ? null : Number(r.vendor_id), vendorName: String(r.vendor_name),
    address: String(r.address), mapUrl: String(r.map_url), lots: Number(r.lots), landM2: decOrNull(r.land_m2), price: decOrNull(r.price),
    sellerName: String(r.seller_name), agentName: String(r.agent_name), buyPrice: decOrNull(r.buy_price), terms: String(r.terms),
    termsMemo: String(r.terms_memo), status: String(r.status), infoDate: (r.info_date as string | null) ?? null,
    propDate: (r.prop_date as string | null) ?? null, offerDate: (r.offer_date as string | null) ?? null,
    contractDate: (r.contract_date as string | null) ?? null, settleDate: (r.settle_date as string | null) ?? null,
    memo: String(r.memo ?? ''), simSales: decOrNull(r.sim_sales), simBuild: decOrNull(r.sim_build), simDemolition: decOrNull(r.sim_demolition),
    simExpenseRate: numOf(r.sim_expense_rate), simProfitRate: numOf(r.sim_profit_rate), offerTo: String(r.offer_to),
    replyDue: (r.reply_due as string | null) ?? null, replyResult: String(r.reply_result), replyDate: (r.reply_date as string | null) ?? null,
    replyMemo: String(r.reply_memo), lostReason: String(r.lost_reason), lostMemo: String(r.lost_memo),
    apId: r.ap_id === null ? null : Number(r.ap_id), sourceId: r.source_id === null ? null : Number(r.source_id),
    createdBy: String(r.created_by), updatedBy: String(r.updated_by), updatedAt: String(r.updated_at),
});
const loadDeals = async (): Promise<LandDeal[]> => (await query<Row>(DEAL_SELECT)).map(dealOf);

/** 一覧・画面に付ける計算の値（⚠️ 保存しない） */
export const withCalc = (d: LandDeal, today: string, warnDays: number) => ({
    ...d,
    simMaxOffer: simMaxOffer(d), tsuboUnit: tsuboUnitOf(d), tsubo: m2ToTsubo(d.landM2),
    replyLevel: replyLevel(d, today, warnDays), replyDays: replyPending(d) ? daysUntil(d.replyDue, today) : null,
    nextStatus: nextStatus(d.status),
});

export const DEAL_SORT_KEYS = ['infoDate', 'propDate', 'offerDate', 'contractDate', 'settleDate', 'lots', 'price', 'tsuboUnit', 'replyDue', 'status', 'memberName', 'vendorName', 'updatedAt'];
const dealDates = (d: LandDeal) => [d.infoDate, d.propDate, d.offerDate, d.contractDate, d.settleDate];

export const runLandDealList = async (body: Body): Promise<LandResult> => {
    const [settings, members, all] = await Promise.all([loadSettings(), loadMembers(), loadDeals()]);
    const today = todayJst();
    const sel = str(body.sel, 20); const set = membersOfSel(sel, members);
    const status = str(body.status, 20); const kind = str(body.kind, 20); const due = str(body.due, 10);
    const month = str(body.month, 7); const q = str(body.q, 100).toLowerCase();
    const settled = String(body.settled ?? '') === '1';
    const fy = fyMonths(settings.fyStart);
    const inMonth = (v: string | null) => (month === 'fy' ? fy.includes(ymOf(v)) : ymOf(v) === month);

    let list = all.filter(d => (settled ? d.status === STATUS_SETTLED : true));
    if (set) list = list.filter(d => d.memberId !== null && set.has(d.memberId));
    if (!settled && status) list = list.filter(d => d.status === status);
    if (!settled && kind) list = list.filter(d => d.kind === kind);
    if (!settled && due) list = list.filter(d => {
        const lv = replyLevel(d, today, settings.warnDays);
        if (due === 'act') return lv === 'over' || lv === 'today';
        if (due === 'soon') return lv === 'over' || lv === 'today' || lv === 'soon';
        if (due === 'pending') return replyPending(d);
        if (due === 'unset') return lv === 'unset';
        if (due === 'done') return d.replyResult !== '';
        return true;
    });
    if (month) list = list.filter(d => (settled ? inMonth(d.settleDate || d.contractDate) : dealDates(d).some(x => x && inMonth(x))));
    if (q) list = list.filter(d => [d.vendorName, d.address, d.memo, d.memberName, d.sellerName, d.agentName, d.terms, d.termsMemo]
        .join(' ').toLowerCase().includes(q));

    const sortKey = DEAL_SORT_KEYS.includes(str(body.sort)) ? str(body.sort) : (settled ? 'settleDate' : 'infoDate');
    const dir = str(body.dir) === 'asc' ? 1 : -1;
    const calc = list.map(d => withCalc(d, today, settings.warnDays));
    const valueOf = (d: typeof calc[number]): string | number | null => {
        if (sortKey === 'settleDate') return d.settleDate || d.contractDate;
        if (sortKey === 'price') return d.buyPrice ?? d.price; // ⚠️ 購入金額（無ければ想定仕入価格）。坪単価と同じ考え方
        const v = (d as unknown as Record<string, unknown>)[sortKey];
        return v === '' || v === undefined ? null : (v as string | number | null);
    };
    calc.sort((a, b) => {
        const va = valueOf(a); const vb = valueOf(b);
        if (va === null && vb === null) return b.id - a.id;
        if (va === null) return 1; // ⚠️ 空はいつもいちばん下
        if (vb === null) return -1;
        const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ja');
        return c !== 0 ? c * dir : b.id - a.id;
    });

    const offset = Math.max(0, int(body.offset));
    const limit = Math.min(1000, Math.max(1, int(body.limit, 30)));
    const statusCounts: Record<string, number> = {};
    for (const d of list) statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
    return ok({
        rows: calc.slice(offset, offset + limit), total: calc.length, offset,
        sumLots: list.filter(d => d.status === '契約' || d.status === STATUS_SETTLED).reduce((s, d) => s + d.lots, 0),
        statusCounts,
        replyAct: list.filter(d => { const lv = replyLevel(d, today, settings.warnDays); return lv === 'over' || lv === 'today'; }).length,
    });
};

export const runLandDealGet = async (body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    if (id === null) return fail(400, '案件が指定されていません。');
    const [settings, rows] = await Promise.all([loadSettings(), query<Row>(`${DEAL_SELECT} AND d.id = ?`, [id])]);
    if (rows.length === 0) return fail(404, '案件が見つかりません（削除された可能性があります）。');
    return ok({ deal: withCalc(dealOf(rows[0]), todayJst(), settings.warnDays) });
};

/** 業者名から業者を探し、無ければ作る（移行元の ensureVendor）。⚠️ 名前が空なら null */
const ensureVendor = async (tx: Tx, name: string, who: string): Promise<number | null> => {
    if (name === '') return null;
    const hit = await tx.query<Row>('SELECT id FROM land_vendor WHERE name = ? AND delete_flag = 0 ORDER BY id LIMIT 1', [name]);
    if (hit.length > 0) return Number(hit[0].id);
    const r = await tx.execute("INSERT INTO land_vendor (name, vkind, created_by, updated_by) VALUES (?, '不動産業者', ?, ?)", [name, who, who]);
    await audit(who, 'create', '業者', name, '案件・アプローチの登録で自動追加', tx);
    return r.insertId;
};

/** 案件の列（画面のキー → 列・型） */
const DEAL_FIELDS: [string, string, 'str' | 'int' | 'dec' | 'date' | 'id', number?][] = [
    ['memberId', 'member_id', 'id'], ['kind', 'kind', 'str', 20], ['address', 'address', 'str', 200], ['mapUrl', 'map_url', 'str', 500],
    ['lots', 'lots', 'int'], ['landM2', 'land_m2', 'dec'], ['price', 'price', 'dec'], ['sellerName', 'seller_name', 'str', 120],
    ['agentName', 'agent_name', 'str', 120], ['buyPrice', 'buy_price', 'dec'], ['terms', 'terms', 'str', 30], ['termsMemo', 'terms_memo', 'str', 500],
    ['infoDate', 'info_date', 'date'], ['propDate', 'prop_date', 'date'], ['offerDate', 'offer_date', 'date'], ['contractDate', 'contract_date', 'date'],
    ['settleDate', 'settle_date', 'date'], ['memo', 'memo', 'str', 5000], ['simSales', 'sim_sales', 'dec'], ['simBuild', 'sim_build', 'dec'],
    ['simDemolition', 'sim_demolition', 'dec'], ['simExpenseRate', 'sim_expense_rate', 'dec'], ['simProfitRate', 'sim_profit_rate', 'dec'],
    ['offerTo', 'offer_to', 'str', 120], ['replyDue', 'reply_due', 'date'], ['replyResult', 'reply_result', 'str', 20], ['replyDate', 'reply_date', 'date'],
    ['replyMemo', 'reply_memo', 'str', 500], ['lostReason', 'lost_reason', 'str', 30], ['lostMemo', 'lost_memo', 'str', 500],
    ['apId', 'ap_id', 'id'], ['sourceId', 'source_id', 'id'],
];
const fieldValue = (type: string, v: unknown, max?: number): unknown => {
    if (type === 'str') return str(v, max ?? 255);
    if (type === 'int') return Math.max(0, int(v));
    if (type === 'dec') return decOrNull(v);
    if (type === 'date') return dateOrNull(v);
    return intOrNull(v);
};

/**
 * 案件を保存（⚠️ 送られた項目だけ書く。一覧からステータスだけ・返答だけを直すときも同じ口）。
 * ⚠️ ステータスが変わったら、移行元と同じく日付などを埋める（logic.ts の applyStatus）。
 * ⚠️ 業者名を送ったら、業者マスタに無い名前は業者を作る。
 */
export const runLandDealSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const who = whoOf(staff); const today = todayJst();
    const settings = await loadSettings();
    const id = intOrNull(body.id);
    const statusIn = body.status === undefined ? undefined : str(body.status, 20);
    if (statusIn !== undefined && !(STATUS as readonly string[]).includes(statusIn)) return fail(400, 'ステータスが正しくありません。');
    try {
        const saved = await withTransaction(async (tx) => {
            let before: LandDeal | null = null;
            if (id !== null) {
                const rows = await tx.query<Row>(`${DEAL_SELECT} AND d.id = ? FOR UPDATE`, [id]);
                if (rows.length === 0) throw new Error('NOT_FOUND');
                before = dealOf(rows[0]);
            }
            const set: Record<string, unknown> = {};
            for (const [key, col, type, max] of DEAL_FIELDS) if (body[key] !== undefined) set[col] = fieldValue(type, body[key], max);
            if (body.vendorName !== undefined) {
                const vname = str(body.vendorName, 120);
                set.vendor_name = vname;
                set.vendor_id = intOrNull(body.vendorId) ?? await ensureVendor(tx, vname, who);
            }
            if (id === null && set.info_date === undefined) set.info_date = today;
            // ⚠️ 率は NOT NULL。空にされたら既定に戻す
            if (set.sim_expense_rate === null) set.sim_expense_rate = 5;
            if (set.sim_profit_rate === null) set.sim_profit_rate = 15;
            // ステータス（⚠️ 新規は情報取得から。変えたときだけ日付を埋める）
            const prevStatus = before?.status ?? '';
            const ns = statusIn ?? (before ? before.status : '情報取得');
            if (ns !== prevStatus) {
                /** 今回送られた値（空にした値も含む）を優先し、無ければ保存済みの値 */
                const pick = <T,>(col: string, prev: T): T => (col in set ? (set[col] as T) : prev);
                const cur = {
                    status: prevStatus,
                    propDate: pick<string | null>('prop_date', before?.propDate ?? null),
                    offerDate: pick<string | null>('offer_date', before?.offerDate ?? null),
                    contractDate: pick<string | null>('contract_date', before?.contractDate ?? null),
                    settleDate: pick<string | null>('settle_date', before?.settleDate ?? null),
                    offerTo: pick<string>('offer_to', before?.offerTo ?? ''), vendorName: pick<string>('vendor_name', before?.vendorName ?? ''),
                    replyDue: pick<string | null>('reply_due', before?.replyDue ?? null),
                    replyResult: pick<string>('reply_result', before?.replyResult ?? ''),
                    replyDate: pick<string | null>('reply_date', before?.replyDate ?? null),
                };
                const r = before === null && ns === '情報取得' ? { ...cur, status: ns } : applyStatus(cur, ns, today, settings.leadDays);
                Object.assign(set, {
                    status: r.status, prop_date: r.propDate, offer_date: r.offerDate, contract_date: r.contractDate, settle_date: r.settleDate,
                    offer_to: r.offerTo, reply_due: r.replyDue, reply_result: r.replyResult, reply_date: r.replyDate,
                });
            }
            set.updated_by = who;
            const cols = Object.keys(set);
            let newId = id;
            if (id === null) {
                set.created_by = who;
                const all = Object.keys(set);
                const res = await tx.execute(`INSERT INTO land_deal (${all.join(', ')}) VALUES (${all.map(() => '?').join(', ')})`, all.map(c => set[c] as never));
                newId = res.insertId;
            } else {
                await tx.execute(`UPDATE land_deal SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => set[c] as never), id]);
            }
            const label = String(set.vendor_name ?? before?.vendorName ?? '') || String(set.address ?? before?.address ?? '') || '—';
            if (id === null) await audit(who, 'create', '案件', label, '', tx);
            else if (ns !== prevStatus) await audit(who, 'status', '案件', label, `${prevStatus} → ${ns}`, tx);
            else await audit(who, 'update', '案件', label, '', tx);
            const rows = await tx.query<Row>(`${DEAL_SELECT} AND d.id = ?`, [newId]);
            return dealOf(rows[0]);
        });
        return ok({ deal: withCalc(saved, today, settings.warnDays) });
    } catch (e) {
        if ((e as Error).message === 'NOT_FOUND') return fail(404, '案件が見つかりません（削除された可能性があります）。');
        throw e;
    }
};

export const runLandDealDelete = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    if (id === null) return fail(400, '案件が指定されていません。');
    const rows = await query<Row>('SELECT vendor_name, address FROM land_deal WHERE id = ? AND delete_flag = 0', [id]);
    if (rows.length === 0) return fail(404, '案件が見つかりません。');
    await execute('UPDATE land_deal SET delete_flag = 1, updated_by = ? WHERE id = ?', [whoOf(staff), id]);
    await audit(whoOf(staff), 'delete', '案件', String(rows[0].vendor_name || rows[0].address || '—'));
    return ok({ id });
};

// ---------------------------------------------------------------------------
// 業者
// ---------------------------------------------------------------------------
const vendorOf = (r: Row) => ({
    id: Number(r.id), name: String(r.name), vkind: String(r.vkind), contact: String(r.contact), tel: String(r.tel), email: String(r.email),
    area: String(r.area), addr: String(r.addr), url: String(r.url), ownerMemberId: r.owner_member_id === null ? null : Number(r.owner_member_id),
    ownerName: String(r.owner_name ?? ''), ownerAreaId: r.owner_area_id === null || r.owner_area_id === undefined ? null : Number(r.owner_area_id),
    rank: String(r.vendor_rank), temp: String(r.temp), lastVisit: (r.last_visit as string | null) ?? null, buyCount: Number(r.buy_count),
    memo: String(r.memo ?? ''), updatedBy: String(r.updated_by), updatedAt: String(r.updated_at),
});
export const VENDOR_SORT_KEYS = ['name', 'rank', 'temp', 'lastContact', 'ap', 'apMonth', 'deals', 'buyTotal', 'ownerName', 'updatedAt'];

export const runLandVendorList = async (body: Body): Promise<LandResult> => {
    const [settings, members] = await Promise.all([loadSettings(), loadMembers()]);
    const today = todayJst(); const month = today.slice(0, 7); const fy = fyMonths(settings.fyStart);
    const [vendors, apStats, dealStats] = await Promise.all([
        query<Row>('SELECT v.*, m.name AS owner_name, m.area_id AS owner_area_id FROM land_vendor v LEFT JOIN land_member m ON m.id = v.owner_member_id WHERE v.delete_flag = 0'),
        query<Row>("SELECT vendor_id, COUNT(*) AS ap, SUM(DATE_FORMAT(ap_date, '%Y-%m') = ?) AS ap_month, SUM(DATE_FORMAT(ap_date, '%Y-%m') BETWEEN ? AND ?) AS ap_fy, MAX(ap_date) AS last_ap FROM land_approach WHERE delete_flag = 0 AND vendor_id IS NOT NULL GROUP BY vendor_id", [month, fy[0], fy[11]]),
        query<Row>("SELECT vendor_id, COUNT(*) AS deals, SUM(status = '決済完了') AS settled, SUM(IF(status = '決済完了', lots, 0)) AS settled_lots FROM land_deal WHERE delete_flag = 0 AND vendor_id IS NOT NULL GROUP BY vendor_id"),
    ]);
    const ap = new Map(apStats.map(r => [Number(r.vendor_id), r]));
    const dl = new Map(dealStats.map(r => [Number(r.vendor_id), r]));
    const q = str(body.q, 100).toLowerCase();
    const vkind = str(body.vkind, 30); const rank = str(body.rank, 1); const temp = str(body.temp, 4);
    const ownerSet = membersOfSel(str(body.sel, 20), members);
    let list = vendors.map(r => {
        const v = vendorOf(r); const a = ap.get(v.id); const d = dl.get(v.id);
        const lastAp = (a?.last_ap as string | null) ?? null;
        const lastContact = [lastAp, v.lastVisit].filter((x): x is string => !!x).sort().pop() ?? null;
        const settledLots = numOf(d?.settled_lots);
        return {
            ...v, ap: numOf(a?.ap), apMonth: numOf(a?.ap_month), apFy: numOf(a?.ap_fy), deals: numOf(d?.deals),
            settledLots, buyTotal: v.buyCount + settledLots, lastContact,
            daysSince: lastContact ? Math.max(0, -(daysUntil(lastContact, today) ?? 0)) : null,
        };
    });
    if (q) list = list.filter(v => [v.name, v.contact, v.addr, v.area, v.tel, v.email, v.memo].join(' ').toLowerCase().includes(q));
    if (vkind) list = list.filter(v => v.vkind === vkind);
    if (rank) list = list.filter(v => (rank === '-' ? v.rank === '' : v.rank === rank));
    if (temp) list = list.filter(v => (temp === '-' ? v.temp === '' : v.temp === temp));
    if (ownerSet) list = list.filter(v => v.ownerMemberId !== null && ownerSet.has(v.ownerMemberId));
    const sortKey = VENDOR_SORT_KEYS.includes(str(body.sort)) ? str(body.sort) : 'lastContact';
    const dir = str(body.dir) === 'asc' ? 1 : -1;
    const TEMP_ORDER: Record<string, number> = { '◎': 4, '〇': 3, '△': 2, '✕': 1 };
    const val = (v: typeof list[number]): string | number | null => {
        if (sortKey === 'rank') return v.rank === '' ? null : 'EDCBA'.indexOf(v.rank); // ⚠️ A が大きい（新しい順＝大きい順で A から）
        if (sortKey === 'temp') return v.temp === '' ? null : TEMP_ORDER[v.temp] ?? null;
        const x = (v as unknown as Record<string, unknown>)[sortKey];
        return x === '' || x === undefined ? null : (x as string | number | null);
    };
    list.sort((a, b) => {
        const va = val(a); const vb = val(b);
        if (va === null && vb === null) return b.id - a.id;
        if (va === null) return 1;
        if (vb === null) return -1;
        const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ja');
        return c !== 0 ? c * dir : b.id - a.id;
    });
    const offset = Math.max(0, int(body.offset));
    const limit = Math.min(1000, Math.max(1, int(body.limit, 30)));
    const rankCounts: Record<string, number> = {};
    for (const v of list) rankCounts[v.rank || '-'] = (rankCounts[v.rank || '-'] ?? 0) + 1;
    return ok({
        rows: list.slice(offset, offset + limit), total: list.length, offset, rankCounts,
        stale60: list.filter(v => v.daysSince !== null && v.daysSince >= 60).length,
        apMonthTotal: list.reduce((s, v) => s + v.apMonth, 0),
        buyTotal: list.reduce((s, v) => s + v.buyTotal, 0),
    });
};

/** 業者の画面：業者・アプローチ履歴・この業者からの案件 */
export const runLandVendorGet = async (body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    if (id === null) return fail(400, '業者が指定されていません。');
    const rows = await query<Row>('SELECT v.*, m.name AS owner_name, m.area_id AS owner_area_id FROM land_vendor v LEFT JOIN land_member m ON m.id = v.owner_member_id WHERE v.id = ? AND v.delete_flag = 0', [id]);
    if (rows.length === 0) return fail(404, '業者が見つかりません。');
    const [aps, deals, settings] = await Promise.all([
        query<Row>(`${AP_SELECT} AND a.vendor_id = ? ORDER BY a.ap_date DESC, a.ap_time DESC, a.id DESC LIMIT 200`, [id]),
        query<Row>(`${DEAL_SELECT} AND d.vendor_id = ? ORDER BY d.info_date DESC, d.id DESC LIMIT 200`, [id]),
        loadSettings(),
    ]);
    const today = todayJst();
    return ok({ vendor: vendorOf(rows[0]), approaches: aps.map(approachOf), deals: deals.map(dealOf).map(d => withCalc(d, today, settings.warnDays)) });
};

const RANKS = ['A', 'B', 'C', 'D', 'E'];
const TEMPS = ['◎', '〇', '△', '✕'];
export const runLandVendorSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const who = whoOf(staff);
    const id = intOrNull(body.id);
    const name = str(body.name, 120);
    if (body.name !== undefined && name === '') return fail(400, '業者名を入れてください。');
    if (id === null && name === '') return fail(400, '業者名を入れてください。');
    const set: Record<string, unknown> = {};
    const s = (k: string, col: string, max: number) => { if (body[k] !== undefined) set[col] = str(body[k], max); };
    if (body.name !== undefined) set.name = name;
    s('vkind', 'vkind', 30); s('contact', 'contact', 60); s('tel', 'tel', 40); s('email', 'email', 120); s('area', 'area', 60);
    s('addr', 'addr', 200); s('url', 'url', 300); s('memo', 'memo', 5000);
    if (body.ownerMemberId !== undefined) set.owner_member_id = intOrNull(body.ownerMemberId);
    if (body.rank !== undefined) { const r = str(body.rank, 1).toUpperCase(); set.vendor_rank = RANKS.includes(r) ? r : ''; }
    if (body.temp !== undefined) { const t = str(body.temp, 4); set.temp = TEMPS.includes(t) ? t : ''; }
    if (body.lastVisit !== undefined) set.last_visit = dateOrNull(body.lastVisit);
    if (body.buyCount !== undefined) set.buy_count = Math.max(0, int(body.buyCount));
    set.updated_by = who;
    let newId = id;
    if (id === null) {
        const dup = await query<Row>('SELECT id FROM land_vendor WHERE name = ? AND delete_flag = 0 LIMIT 1', [name]);
        if (dup.length > 0) return fail(409, `「${name}」はすでに業者マスタにあります。`);
        set.created_by = who;
        const cols = Object.keys(set);
        newId = (await execute(`INSERT INTO land_vendor (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map(c => set[c] as never))).insertId;
        await audit(who, 'create', '業者', name);
    } else {
        const cols = Object.keys(set);
        const r = await execute(`UPDATE land_vendor SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ? AND delete_flag = 0`, [...cols.map(c => set[c] as never), id]);
        if (r.affectedRows === 0) return fail(404, '業者が見つかりません。');
        // ⚠️ 名前を変えたら、案件・アプローチの業者名もそろえる（移行元は名前で表示していた）
        if (body.name !== undefined) {
            await execute('UPDATE land_deal SET vendor_name = ? WHERE vendor_id = ?', [name, id]);
            await execute('UPDATE land_approach SET vendor_name = ? WHERE vendor_id = ?', [name, id]);
        }
        await audit(who, 'update', '業者', name || String(id));
    }
    return runLandVendorGet({ id: newId });
};

export const runLandVendorDelete = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    if (id === null) return fail(400, '業者が指定されていません。');
    const rows = await query<Row>('SELECT name FROM land_vendor WHERE id = ? AND delete_flag = 0', [id]);
    if (rows.length === 0) return fail(404, '業者が見つかりません。');
    // ⚠️ 案件・アプローチの業者名は残す（vendor_name）。業者マスタから外すだけ
    await execute('UPDATE land_vendor SET delete_flag = 1, updated_by = ? WHERE id = ?', [whoOf(staff), id]);
    await audit(whoOf(staff), 'delete', '業者', String(rows[0].name));
    return ok({ id });
};

// ---------------------------------------------------------------------------
// アプローチ・まとめ入力・日報
// ---------------------------------------------------------------------------
export const AP_SELECT = 'SELECT a.*, m.name AS member_name, m.area_id, (SELECT COUNT(*) FROM land_deal d WHERE d.ap_id = a.id AND d.delete_flag = 0) AS deal_count FROM land_approach a LEFT JOIN land_member m ON m.id = a.member_id WHERE a.delete_flag = 0';
export const approachOf = (r: Row) => ({
    id: Number(r.id), date: String(r.ap_date), time: String(r.ap_time), memberId: r.member_id === null ? null : Number(r.member_id),
    memberName: String(r.member_name ?? ''), vendorId: r.vendor_id === null ? null : Number(r.vendor_id), vendorName: String(r.vendor_name),
    type: String(r.ap_type), contact: String(r.contact), reaction: String(r.reaction), infoCount: Number(r.info_count), memo: String(r.memo ?? ''),
    address: String(r.address), mapUrl: String(r.map_url), landM2: decOrNull(r.land_m2), tsubo: m2ToTsubo(r.land_m2),
    isCandidate: Number(r.is_candidate) === 1, sourceId: r.source_id === null ? null : Number(r.source_id),
    dealCount: Number(r.deal_count ?? 0), createdBy: String(r.created_by), updatedBy: String(r.updated_by),
});

export const runLandApproachList = async (body: Body): Promise<LandResult> => {
    const members = await loadMembers();
    const where: string[] = []; const params: unknown[] = [];
    const set = membersOfSel(str(body.sel, 20), members);
    if (set) { if (set.size === 0) return ok({ rows: [], total: 0, offset: 0 }); where.push(`a.member_id IN (${[...set].map(() => '?').join(', ')})`); params.push(...set); }
    const month = ymOrEmpty(body.month);
    if (month) { where.push("DATE_FORMAT(a.ap_date, '%Y-%m') = ?"); params.push(month); }
    const type = str(body.type, 20);
    if (type) { where.push('a.ap_type = ?'); params.push(type); }
    const vendorId = intOrNull(body.vendorId);
    if (vendorId !== null) { where.push('a.vendor_id = ?'); params.push(vendorId); }
    if (String(body.candidate ?? '') === '1') where.push('a.is_candidate = 1 AND NOT EXISTS (SELECT 1 FROM land_deal d WHERE d.ap_id = a.id AND d.delete_flag = 0)');
    const q = str(body.q, 100);
    if (q) { where.push('CONCAT_WS(\' \', a.vendor_name, a.contact, a.memo, a.address) LIKE ?'); params.push(`%${q}%`); }
    const cond = where.length ? ` AND ${where.join(' AND ')}` : '';
    const offset = Math.max(0, int(body.offset));
    const limit = Math.min(1000, Math.max(1, int(body.limit, 30)));
    const [cnt, rows] = await Promise.all([
        query<Row>(`SELECT COUNT(*) AS n FROM land_approach a WHERE a.delete_flag = 0${cond}`, params as never[]),
        query<Row>(`${AP_SELECT}${cond} ORDER BY a.ap_date DESC, a.ap_time DESC, a.id DESC LIMIT ${limit} OFFSET ${offset}`, params as never[]),
    ]);
    return ok({ rows: rows.map(approachOf), total: Number(cnt[0]?.n ?? 0), offset });
};

export const runLandApproachSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const who = whoOf(staff);
    const id = intOrNull(body.id);
    const date = dateOrNull(body.date);
    if (id === null && date === null) return fail(400, '日付を入れてください。');
    if (id === null && intOrNull(body.memberId) === null) return fail(400, '担当者を選んでください。');
    const result = await withTransaction(async (tx) => {
        const set: Record<string, unknown> = {};
        if (body.date !== undefined) set.ap_date = date;
        if (body.time !== undefined) set.ap_time = /^\d{2}:\d{2}$/.test(str(body.time)) ? str(body.time) : '';
        if (body.memberId !== undefined) set.member_id = intOrNull(body.memberId);
        if (body.type !== undefined) set.ap_type = str(body.type, 20) || '訪問';
        for (const [k, col, max] of [['contact', 'contact', 60], ['reaction', 'reaction', 30], ['memo', 'memo', 5000], ['address', 'address', 200], ['mapUrl', 'map_url', 500]] as [string, string, number][]) {
            if (body[k] !== undefined) set[col] = str(body[k], max);
        }
        if (body.infoCount !== undefined) set.info_count = Math.max(0, int(body.infoCount));
        if (body.landM2 !== undefined) set.land_m2 = decOrNull(body.landM2);
        if (body.isCandidate !== undefined) set.is_candidate = body.isCandidate === true || body.isCandidate === 1 || body.isCandidate === '1' || body.isCandidate === 'true' ? 1 : 0;
        if (body.sourceId !== undefined) set.source_id = intOrNull(body.sourceId);
        if (body.vendorName !== undefined) {
            const vname = str(body.vendorName, 120);
            set.vendor_name = vname;
            set.vendor_id = intOrNull(body.vendorId) ?? await ensureVendor(tx, vname, who);
        }
        set.updated_by = who;
        let newId = id;
        if (id === null) {
            set.created_by = who;
            const cols = Object.keys(set);
            newId = (await tx.execute(`INSERT INTO land_approach (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map(c => set[c] as never))).insertId;
        } else {
            const cols = Object.keys(set);
            const r = await tx.execute(`UPDATE land_approach SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ? AND delete_flag = 0`, [...cols.map(c => set[c] as never), id]);
            if (r.affectedRows === 0) return null;
        }
        const rows = await tx.query<Row>(`${AP_SELECT} AND a.id = ?`, [newId]);
        const ap = approachOf(rows[0]);
        await audit(who, id === null ? 'create' : 'update', 'アプローチ', ap.vendorName || '—', `${ap.date} ${ap.type}`, tx);
        return ap;
    });
    if (result === null) return fail(404, 'アプローチが見つかりません。');
    return ok({ approach: result });
};

export const runLandApproachDelete = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    if (id === null) return fail(400, 'アプローチが指定されていません。');
    const rows = await query<Row>('SELECT vendor_name, ap_date FROM land_approach WHERE id = ? AND delete_flag = 0', [id]);
    if (rows.length === 0) return fail(404, 'アプローチが見つかりません。');
    await execute('UPDATE land_approach SET delete_flag = 1, updated_by = ? WHERE id = ?', [whoOf(staff), id]);
    await audit(whoOf(staff), 'delete', 'アプローチ', String(rows[0].vendor_name || '—'), String(rows[0].ap_date));
    return ok({ id });
};

const COUNT_COLS = AP_BREAKDOWN.map(b => `cnt_${b.k}`);
const dailyOf = (r: Row) => ({
    id: Number(r.id), date: String(r.count_date), memberId: r.member_id === null ? null : Number(r.member_id),
    counts: Object.fromEntries(AP_BREAKDOWN.map(b => [b.k, Number(r[`cnt_${b.k}`] ?? 0)])) as Record<string, number>,
    info: Number(r.cnt_info), note: String(r.note), updatedBy: String(r.updated_by),
});
const reportOf = (r: Row) => ({
    id: Number(r.id), date: String(r.report_date), memberId: r.member_id === null ? null : Number(r.member_id),
    done: String(r.done ?? ''), info: String(r.info ?? ''), issue: String(r.issue ?? ''), next: String(r.next_plan ?? ''),
    createdBy: String(r.created_by), updatedBy: String(r.updated_by), updatedAt: String(r.updated_at),
});

/** 日次・アプローチの画面：担当者×月の、まとめ入力・日報・日別の件数 */
export const runLandDaily = async (body: Body): Promise<LandResult> => {
    const memberId = intOrNull(body.memberId);
    const month = ymOrEmpty(body.month) || todayJst().slice(0, 7);
    if (memberId === null) return ok({ month, counts: [], reports: [], days: [] });
    const [counts, reports, aps] = await Promise.all([
        query<Row>("SELECT * FROM land_daily_count WHERE member_id = ? AND DATE_FORMAT(count_date, '%Y-%m') = ? ORDER BY count_date DESC", [memberId, month]),
        query<Row>("SELECT * FROM land_report WHERE member_id = ? AND DATE_FORMAT(report_date, '%Y-%m') = ? ORDER BY report_date DESC", [memberId, month]),
        query<Row>("SELECT ap_date, ap_type, info_count FROM land_approach WHERE delete_flag = 0 AND member_id = ? AND DATE_FORMAT(ap_date, '%Y-%m') = ?", [memberId, month]),
    ]);
    const days = new Map<string, { date: string; rec: number; log: number; info: number; byType: Record<string, number> }>();
    const day = (d: string) => {
        if (!days.has(d)) days.set(d, { date: d, rec: 0, log: 0, info: 0, byType: Object.fromEntries(AP_BREAKDOWN.map(b => [b.k, 0])) });
        return days.get(d)!;
    };
    const countRows = counts.map(dailyOf);
    for (const c of countRows) {
        const x = day(c.date);
        for (const b of AP_BREAKDOWN) { x.byType[b.k] += c.counts[b.k]; x.log += c.counts[b.k]; }
        x.info += c.info;
    }
    for (const a of aps) {
        const x = day(String(a.ap_date));
        const k = AP_BREAKDOWN.find(b => b.label === String(a.ap_type))?.k ?? 'visit';
        x.byType[k]++; x.rec++; x.info += Number(a.info_count);
    }
    return ok({ month, counts: countRows, reports: reports.map(reportOf), days: [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1)) });
};

/** まとめ入力（1日・1担当者に1件。同じ日に保存すると上書き。⚠️ 全部0なら消す） */
export const runLandDailySave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const who = whoOf(staff);
    const date = dateOrNull(body.date); const memberId = intOrNull(body.memberId);
    if (date === null || memberId === null) return fail(400, '日付と担当者を選んでください。');
    const counts = (body.counts ?? {}) as Record<string, unknown>;
    const values = AP_BREAKDOWN.map(b => Math.max(0, int(counts[b.k])));
    const info = Math.max(0, int(body.info));
    const note = str(body.note, 500);
    const hit = await query<Row>('SELECT id FROM land_daily_count WHERE count_date = ? AND member_id = ? ORDER BY id LIMIT 1', [date, memberId]);
    if (body.delete === true || body.delete === '1') {
        if (hit.length > 0) await execute('DELETE FROM land_daily_count WHERE count_date = ? AND member_id = ?', [date, memberId]);
        await audit(who, 'delete', 'まとめ入力', String(memberId), date);
        return ok({ deleted: true });
    }
    if (hit.length > 0) {
        await execute(`UPDATE land_daily_count SET ${COUNT_COLS.map(c => `${c} = ?`).join(', ')}, cnt_info = ?, note = ?, updated_by = ? WHERE id = ?`, [...values, info, note, who, Number(hit[0].id)]);
    } else {
        await execute(`INSERT INTO land_daily_count (count_date, member_id, ${COUNT_COLS.join(', ')}, cnt_info, note, updated_by) VALUES (?, ?, ${COUNT_COLS.map(() => '?').join(', ')}, ?, ?, ?)`, [date, memberId, ...values, info, note, who]);
    }
    await audit(who, 'daily', 'まとめ入力', String(memberId), `${date}／AP${values.reduce((s, v) => s + v, 0)}件・情報${info}件`);
    return ok({ saved: true });
};

/** 日報（1日・1担当者に1本。同じ日に保存すると上書き） */
export const runLandReportSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const who = whoOf(staff);
    const date = dateOrNull(body.date); const memberId = intOrNull(body.memberId);
    if (date === null || memberId === null) return fail(400, '日付と担当者を選んでください。');
    const hit = await query<Row>('SELECT id FROM land_report WHERE report_date = ? AND member_id = ? ORDER BY id LIMIT 1', [date, memberId]);
    if (body.delete === true || body.delete === '1') {
        if (hit.length > 0) await execute('DELETE FROM land_report WHERE report_date = ? AND member_id = ?', [date, memberId]);
        await audit(who, 'delete', '日報', String(memberId), date);
        return ok({ deleted: true });
    }
    const v = [str(body.done, 5000), str(body.info, 5000), str(body.issue, 5000), str(body.next, 5000)];
    if (v.every(x => x === '')) return fail(400, '日報の内容を入れてください。');
    if (hit.length > 0) await execute('UPDATE land_report SET done = ?, info = ?, issue = ?, next_plan = ?, updated_by = ? WHERE id = ?', [...v, who, Number(hit[0].id)]);
    else await execute('INSERT INTO land_report (report_date, member_id, done, info, issue, next_plan, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [date, memberId, ...v, who, who]);
    await audit(who, 'report', '日報', String(memberId), date);
    return ok({ saved: true });
};

// ---------------------------------------------------------------------------
// 集計（仕入ダッシュボード）
// ---------------------------------------------------------------------------
export const loadCalcData = async (): Promise<{ deals: LandDeal[]; approaches: CalcApproach[]; daily: CalcDaily[]; manual: CalcManual[]; calcDeals: CalcDeal[] }> => {
    const [deals, aps, daily, manual] = await Promise.all([
        loadDeals(),
        query<Row>('SELECT id, member_id, ap_date, ap_type, info_count FROM land_approach WHERE delete_flag = 0'),
        query<Row>('SELECT * FROM land_daily_count'),
        query<Row>('SELECT ym, member_id, kpi_key, value FROM land_manual_actual'),
    ]);
    return {
        deals,
        calcDeals: deals.map(d => ({ id: d.id, memberId: d.memberId, infoDate: d.infoDate, propDate: d.propDate, offerDate: d.offerDate, contractDate: d.contractDate, lots: d.lots, apId: d.apId })),
        approaches: aps.map(a => ({ id: Number(a.id), memberId: a.member_id === null ? null : Number(a.member_id), date: String(a.ap_date), type: String(a.ap_type), infoCount: Number(a.info_count) })),
        daily: daily.map(dailyOf).map(d => ({ memberId: d.memberId, date: d.date, counts: d.counts, info: d.info })),
        manual: manual.map(m => ({ ym: String(m.ym), memberId: Number(m.member_id), kpiKey: String(m.kpi_key), value: numOf(m.value) })),
    };
};

// ---------------------------------------------------------------------------
// 担当者とスタッフの結び付け（仕入設定）
// ---------------------------------------------------------------------------
/** 結び付けの候補（担当事業が spec・all のスタッフ）。⚠️ メール・トークンは返さない */
export const runLandStaffCandidates = async (): Promise<LandResult> => {
    const rows = await query<Row>("SELECT id, name, shop FROM staff WHERE flag = 1 AND shop IN ('spec', 'all') ORDER BY name");
    return ok({ staff: rows.map(r => ({ id: Number(r.id), name: String(r.name), shop: String(r.shop) })) });
};

export const runLandMemberSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const who = whoOf(staff);
    const id = intOrNull(body.id);
    if (id === null) return fail(400, '担当者が指定されていません。');
    const set: Record<string, unknown> = {};
    if (body.staffId !== undefined) {
        const sid = intOrNull(body.staffId);
        if (sid !== null) {
            const used = await query<Row>('SELECT name FROM land_member WHERE staff_id = ? AND id <> ?', [sid, id]);
            if (used.length > 0) return fail(409, `このスタッフは「${String(used[0].name)}」に結び付いています。先にそちらを外してください。`);
        }
        set.staff_id = sid;
    }
    if (body.areaId !== undefined) set.area_id = intOrNull(body.areaId);
    if (body.active !== undefined) set.active = body.active === true || body.active === 1 || body.active === '1' ? 1 : 0;
    const cols = Object.keys(set);
    if (cols.length === 0) return fail(400, '変える項目がありません。');
    const r = await execute(`UPDATE land_member SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => set[c] as never), id]);
    if (r.affectedRows === 0) return fail(404, '担当者が見つかりません。');
    await audit(who, 'member', '担当者', String(id), JSON.stringify(body).slice(0, 200));
    return ok({ members: await loadMembers() });
};

/** 空白を落とした名前（staff.name の「松窪 太郎」と担当者の「松窪」を比べる） */
const normName = (v: unknown): string => String(v ?? '').replace(/[\s　]/g, '');
/**
 * 担当者の名前で、まだ結び付いていない担当者をスタッフに結び付ける。
 * ⚠️ スタッフの名前が担当者の名前で始まり、候補が1人だけのときだけ（同じ名字が2人いれば結び付けない）。
 */
export const autoLinkMembers = async (exec: { query: Tx['query']; execute: Tx['execute'] }): Promise<number> => {
    const [members, staff] = await Promise.all([
        exec.query<Row>('SELECT id, name FROM land_member WHERE staff_id IS NULL'),
        exec.query<Row>("SELECT id, name FROM staff WHERE flag = 1 AND shop IN ('spec', 'all')"),
    ]);
    const used = new Set((await exec.query<Row>('SELECT staff_id FROM land_member WHERE staff_id IS NOT NULL')).map(r => Number(r.staff_id)));
    let n = 0;
    for (const m of members) {
        const key = normName(m.name);
        if (key === '') continue;
        const hits = staff.filter(s => normName(s.name).startsWith(key) && !used.has(Number(s.id)));
        if (hits.length !== 1) continue;
        await exec.execute('UPDATE land_member SET staff_id = ? WHERE id = ?', [Number(hits[0].id), Number(m.id)]);
        used.add(Number(hits[0].id));
        n++;
    }
    return n;
};
