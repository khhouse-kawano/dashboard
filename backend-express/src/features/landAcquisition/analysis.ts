import type { AuthenticatedStaff } from '../../types/staff';
import { execute, query, withTransaction } from '../../db/pool';
import {
    AP_SELECT, AREA_OTHER, approachOf, audit, decOrNull, fail, int, intOrNull, loadAreas, loadCalcData, loadKpiDefs, loadMembers, loadSettings,
    membersOfSel, numOf, ok, str, todayJst, whoOf, withCalc, ymOrEmpty,
    type Body, type LandMember, type LandResult, type Row,
} from './index';
import {
    AP_BREAKDOWN, AUTO_KPI_KEYS, REPLY_LEVEL_ORDER, STATUS_SETTLED, avgRate, bottleneckRows, computeActual, convOf, fyMonths, fyProgress,
    monthProgress, rate, replyPending, sumActuals, worstStage, ymOf,
    type Actual, type BnCompare,
} from './logic';

/**
 * 土地仕入の仕入分析・目標・月次レビュー・設定（v2.2.311。移行元の「ダッシュボード」の分析の部分・「月次入力」・「個人別実績」・「設定・データ」）。
 * ⚠️ 式は logic.ts（移行元と同じ）。⚠️ 担当の絞り込みは sel（'' / 'm:<id>' / 'a:<id>'）。
 */

/** 実績・目標を数える道具（land_summary と同じ数え方） */
const buildCalc = async () => {
    const [settings, members, areas, kpiDefs, data, targets] = await Promise.all([
        loadSettings(), loadMembers(), loadAreas(), loadKpiDefs(), loadCalcData(),
        query<Row>('SELECT period_type, period, member_id, kpi_key, value FROM land_target'),
    ]);
    const keys = kpiDefs.map(k => k.key);
    const activeIds = new Set(members.filter(m => m.active).map(m => m.id));
    const cache = new Map<string, Actual>();
    const actualOf = (set: Set<number> | null, m: string): Actual => {
        const ck = `${m}|${set ? [...set].sort().join(',') : '*'}`;
        if (!cache.has(ck)) cache.set(ck, computeActual(m, set, { deals: data.calcDeals, approaches: data.approaches, daily: data.daily, manual: data.manual }, keys));
        return cache.get(ck)!;
    };
    /** 目標。⚠️ set が null（チーム）なら稼働中の人だけ */
    const targetOf = (set: Set<number> | null, periodType: 'month' | 'year', period: string): Record<string, number> => {
        const t: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
        for (const r of targets) {
            if (String(r.period_type) !== periodType || String(r.period) !== period) continue;
            const id = Number(r.member_id);
            if (set === null ? !activeIds.has(id) : !set.has(id)) continue;
            const k = String(r.kpi_key);
            if (k in t) t[k] += numOf(r.value);
        }
        return t;
    };
    return { settings, members, areas, kpiDefs, data, keys, activeIds, actualOf, targetOf };
};

/**
 * 仕入ダッシュボード（GET land_summary）。scope = month（対象月）/ fy（年度の累計）。sel で担当・エリアに絞る。
 * 返すもの：KPI ごとの実績・目標・達成率、経過率、買付の返答期日アラート、案件化待ち、担当者別の進捗、月次推移、エリア別
 */
export const runLandSummary = async (body: Body): Promise<LandResult> => {
    const c = await buildCalc();
    const today = todayJst();
    const fy = int(body.fy, c.settings.fyStart) || c.settings.fyStart;
    const months = fyMonths(fy);
    const scope = str(body.scope) === 'fy' ? 'fy' : 'month';
    const month = months.includes(ymOrEmpty(body.month)) ? ymOrEmpty(body.month) : (months.includes(today.slice(0, 7)) ? today.slice(0, 7) : months[0]);
    const sel = str(body.sel, 20);
    const keys = c.keys;
    const scopeActual = (s: Set<number> | null): Actual => (scope === 'fy' ? sumActuals(months.map(m => c.actualOf(s, m))) : c.actualOf(s, month));
    const scopeTarget = (s: Set<number> | null) => (scope === 'fy' ? c.targetOf(s, 'year', String(fy)) : c.targetOf(s, 'month', month));

    const set = membersOfSel(sel, c.members);
    const actual = scopeActual(set);
    const target = scopeTarget(set);
    const progress = scope === 'fy' ? fyProgress(fy, today) : monthProgress(month, today);
    const kpis = c.kpiDefs.map(k => ({ ...k, actual: actual[k.key] ?? 0, target: target[k.key] ?? 0, rate: rate(actual[k.key] ?? 0, target[k.key] ?? 0) }));

    // 買付の返答期日アラート（⚠️ 対象月に関係なく、今の返答待ち全部）
    const inSel = (id: number | null) => set === null || (id !== null && set.has(id));
    const pending = c.data.deals.filter(d => replyPending(d) && inSel(d.memberId))
        .map(d => withCalc(d, today, c.settings.warnDays))
        .sort((a, b) => (REPLY_LEVEL_ORDER[a.replyLevel] - REPLY_LEVEL_ORDER[b.replyLevel]) || String(a.replyDue ?? '9999').localeCompare(String(b.replyDue ?? '9999')));
    const alertCounts = { over: 0, today: 0, soon: 0, ok: 0, unset: 0, total: pending.length, act: 0 };
    for (const d of pending) alertCounts[d.replyLevel as 'over' | 'today' | 'soon' | 'ok' | 'unset']++;
    alertCounts.act = alertCounts.over + alertCounts.today;

    // 案件化待ち（案件候補で、まだ案件にしていないアプローチ）
    const candParams: unknown[] = [];
    let candCond = '';
    if (set) { if (set.size === 0) candCond = ' AND 1 = 0'; else { candCond = ` AND a.member_id IN (${[...set].map(() => '?').join(', ')})`; candParams.push(...set); } }
    const candidates = (await query<Row>(`${AP_SELECT} AND a.is_candidate = 1 AND NOT EXISTS (SELECT 1 FROM land_deal d WHERE d.ap_id = a.id AND d.delete_flag = 0)${candCond} ORDER BY a.ap_date DESC, a.id DESC LIMIT 20`, candParams as never[])).map(approachOf);

    // 担当者別の進捗（稼働中の人。sel で絞っていればその中だけ）
    const memberRows = c.members.filter(m => m.active && inSel(m.id)).map(m => {
        const one = new Set([m.id]);
        const a = scopeActual(one); const t = scopeTarget(one);
        return { id: m.id, name: m.name, areaName: m.areaName, actual: Object.fromEntries(keys.map(k => [k, a[k] ?? 0])), target: t, avgRate: avgRate(a, t, keys) };
    });

    // 月次推移（年度の12か月。sel の範囲）
    const trend = months.map(m => {
        const a = c.actualOf(set, m); const t = c.targetOf(set, 'month', m);
        return { month: m, actual: Object.fromEntries(keys.map(k => [k, a[k] ?? 0])), target: t };
    });

    // エリア別（チーム全員のときだけ）
    const areaRows = set !== null ? [] : [...c.areas.map(a => ({ id: a.id, name: a.label })), { id: 0, name: AREA_OTHER }].map(a => {
        const s = new Set(c.members.filter(m => (a.id === 0 ? m.areaId === null : m.areaId === a.id)).map(m => m.id));
        if (s.size === 0) return null;
        const act = scopeActual(s); const t = scopeTarget(new Set([...s].filter(id => c.activeIds.has(id))));
        return { id: a.id, name: a.name, memberCount: [...s].filter(id => c.activeIds.has(id)).length, actual: Object.fromEntries(keys.map(k => [k, act[k] ?? 0])), target: t, avgRate: avgRate(act, t, keys) };
    }).filter(Boolean);

    // 進行中の案件（工程が終わっていないもの）
    const open = c.data.deals.filter(d => inSel(d.memberId) && !['契約', STATUS_SETTLED, '見送り'].includes(d.status));
    const openCounts: Record<string, number> = {};
    for (const d of open) openCounts[d.status] = (openCounts[d.status] ?? 0) + 1;

    return ok({
        fy, months, scope, month, sel, today, progress, kpis, avgRate: avgRate(actual, target, keys),
        breakdown: Object.fromEntries(AP_BREAKDOWN.map(b => [b.k, actual[b.k] ?? 0])), apRec: actual.apRec ?? 0,
        alert: { counts: alertCounts, rows: pending.slice(0, 30) }, candidates, members: memberRows, trend, areas: areaRows,
        openCounts, openTotal: open.length,
        autoKeys: AUTO_KPI_KEYS,
    });
};

/**
 * 仕入分析（GET）。scope = month / fy、month、sel、heat（ヒートマップの指標。'' は平均達成率）。
 * 返すもの：ボトルネック診断、担当者別の工程別転換率、達成率ヒートマップ、失注・見送りの要因、適正在庫、動いた案件の数
 */
export const runLandAnalysis = async (body: Body): Promise<LandResult> => {
    const c = await buildCalc();
    const today = todayJst();
    const fy = int(body.fy, c.settings.fyStart) || c.settings.fyStart;
    const months = fyMonths(fy);
    const scope = str(body.scope) === 'fy' ? 'fy' : 'month';
    const month = months.includes(ymOrEmpty(body.month)) ? ymOrEmpty(body.month) : (months.includes(today.slice(0, 7)) ? today.slice(0, 7) : months[0]);
    const sel = str(body.sel, 20);
    const set = membersOfSel(sel, c.members);
    const isOne = /^m:\d+$/.test(sel);
    const heat = c.keys.includes(str(body.heat, 30)) ? str(body.heat, 30) : '';

    const scopeActual = (s: Set<number> | null) => (scope === 'fy' ? sumActuals(months.map(m => c.actualOf(s, m))) : c.actualOf(s, month));
    const scopeTarget = (s: Set<number> | null) => (scope === 'fy' ? c.targetOf(s, 'year', String(fy)) : c.targetOf(s, 'month', month));

    // ボトルネック診断（移行元の bnCompares）
    const cur = convOf(scopeActual(set));
    const compares: BnCompare[] = [];
    if (scope === 'fy') {
        compares.push({ label: '年間目標比', conv: convOf(scopeTarget(set)), judged: true });
        if (isOne) compares.push({ label: 'チーム年度比', conv: convOf(scopeActual(null)), judged: true });
        else compares.push({ label: `${Number(month.slice(5, 7))}月比`, conv: convOf(c.actualOf(null, month)), judged: false });
    } else {
        const i = months.indexOf(month);
        compares.push({ label: '先月比', conv: i > 0 ? convOf(c.actualOf(set, months[i - 1])) : null, judged: true });
        compares.push(isOne
            ? { label: 'チーム比', conv: convOf(c.actualOf(null, month)), judged: true }
            : { label: '年度平均比', conv: convOf(sumActuals(months.map(m => c.actualOf(null, m)))), judged: true });
    }
    const bn = bottleneckRows(cur, compares);
    const worst = worstStage(bn);

    // 担当者別の工程別転換率（＋チーム合計・目標から逆算）
    const inSel = (id: number | null) => set === null || (id !== null && set.has(id));
    const activeInSel = c.members.filter(m => m.active && inSel(m.id));
    const convRows = [
        ...activeInSel.map(m => ({ label: m.name, kind: 'member', conv: convOf(scopeActual(new Set([m.id]))) })),
        { label: 'チーム合計', kind: 'team', conv: convOf(scopeActual(set)) },
        { label: `${scope === 'fy' ? '年間目標' : '月間目標'}（逆算）`, kind: 'target', conv: convOf(scopeTarget(set)) },
    ];

    // 達成率ヒートマップ（担当者・エリア・チーム × 12か月＋通期）
    const cellOf = (s: Set<number> | null, m: string | null): number | null => {
        const a = m === null ? sumActuals(months.map(x => c.actualOf(s, x))) : c.actualOf(s, m);
        const tSet = s === null ? null : new Set([...s].filter(id => c.activeIds.has(id)));
        const t = m === null ? c.targetOf(tSet, 'year', String(fy)) : c.targetOf(tSet, 'month', m);
        return heat ? rate(a[heat] ?? 0, t[heat] ?? 0) : avgRate(a, t, c.keys);
    };
    const heatRow = (label: string, kind: string, s: Set<number> | null) => ({ label, kind, cells: months.map(m => cellOf(s, m)), fy: cellOf(s, null) });
    const areaSets = [...c.areas.map(a => ({ id: a.id, label: a.label })), { id: 0, label: AREA_OTHER }]
        .map(a => ({ label: a.label, set: new Set(c.members.filter(m => m.active && (a.id === 0 ? m.areaId === null : m.areaId === a.id)).map(m => m.id)) }))
        .filter(a => a.set.size > 0);
    const heatmap = {
        months, metric: heat,
        rows: [
            ...c.members.filter(m => m.active).map(m => heatRow(m.name, 'member', new Set([m.id]))),
            ...areaSets.map(a => heatRow(a.label, 'area', a.set)),
            heatRow('チーム', 'team', null),
        ],
    };

    // 失注・見送りの要因（対象期間に5つの日付のどれかが入った案件のうち、見送り・否決）
    const inPeriod = (v: string | null) => (scope === 'fy' ? months.includes(ymOf(v)) : ymOf(v) === month);
    const dealsPeriod = c.data.deals.filter(d => inSel(d.memberId) && [d.infoDate, d.propDate, d.offerDate, d.contractDate, d.settleDate].some(x => x && inPeriod(x)));
    const lostDeals = dealsPeriod.filter(d => d.status === '見送り' || d.replyResult === '否決');
    const lostAgg: Record<string, number> = {};
    for (const d of lostDeals) lostAgg[d.lostReason || '未登録'] = (lostAgg[d.lostReason || '未登録'] ?? 0) + 1;
    const settledPeriod = dealsPeriod.filter(d => d.status === STATUS_SETTLED);

    // 適正在庫（担当者の絞り込みに合わせる。集計期間は持たない今の値）
    const stockRows = (await query<Row>('SELECT s.*, m.name AS member_name, m.area_id FROM land_stock s LEFT JOIN land_member m ON m.id = s.member_id WHERE s.fy = ? ORDER BY s.sort, s.id', [fy]))
        .filter(r => inSel(r.member_id === null ? null : Number(r.member_id)))
        .map(r => ({
            id: Number(r.id), memberId: r.member_id === null ? null : Number(r.member_id), memberName: String(r.member_name ?? ''),
            areaName: String(r.area_name), proper: Number(r.proper), stock: Number(r.stock), sales: Number(r.sales),
            group: r.area_id === null ? AREA_OTHER : (c.areas.find(a => a.id === Number(r.area_id))?.label ?? AREA_OTHER),
        }));

    const ta = scopeActual(set);
    return ok({
        fy, months, scope, month, sel,
        bottleneck: { rows: bn, worst, thresholds: { rate: 15, pt: 3, base: 3 } },
        convRows, heatmap,
        lost: { total: lostDeals.length, lots: lostDeals.reduce((s, d) => s + d.lots, 0), byReason: lostAgg },
        settled: { count: settledPeriod.length, lots: settledPeriod.reduce((s, d) => s + d.lots, 0) },
        contract: { count: ta.contract ?? 0, lots: ta.lots ?? 0 },
        info: { total: ta.info ?? 0, deal: ta.infoDeal ?? 0, ap: ta.apInfo ?? 0, log: ta.logInfo ?? 0 },
        apManual: ta.man_ap ?? 0,
        stock: stockRows,
    });
};

// ---------------------------------------------------------------------------
// 目標・手入力の実績（目標・月次入力）
// ---------------------------------------------------------------------------
/** 目標・月次入力（GET）。month の月間目標・手入力の実績・自動で数えた実績と、年度の年間目標 */
export const runLandTargets = async (body: Body): Promise<LandResult> => {
    const c = await buildCalc();
    const months = fyMonths(c.settings.fyStart);
    const month = ymOrEmpty(body.month) || (months.includes(todayJst().slice(0, 7)) ? todayJst().slice(0, 7) : months[0]);
    const fy = c.settings.fyStart;
    const [targets, manual] = await Promise.all([
        query<Row>("SELECT period_type, period, member_id, kpi_key, value FROM land_target WHERE (period_type = 'month' AND period = ?) OR (period_type = 'year' AND period = ?)", [month, String(fy)]),
        query<Row>('SELECT member_id, kpi_key, value FROM land_manual_actual WHERE ym = ?', [month]),
    ]);
    const pick = (rows: Row[], filter: (r: Row) => boolean) => {
        const out: Record<number, Record<string, number>> = {};
        for (const r of rows.filter(filter)) (out[Number(r.member_id)] ??= {})[String(r.kpi_key)] = numOf(r.value);
        return out;
    };
    const members = c.members.map((m: LandMember) => {
        const a = c.actualOf(new Set([m.id]), month);
        return {
            id: m.id, name: m.name, areaName: m.areaName, active: m.active,
            auto: Object.fromEntries(c.keys.map(k => [k, (AUTO_KPI_KEYS as readonly string[]).includes(k) ? a[`auto_${k}`] ?? 0 : 0])),
        };
    });
    return ok({
        month, fy, months, kpiDefs: c.kpiDefs, members,
        monthTargets: pick(targets, r => String(r.period_type) === 'month'),
        yearTargets: pick(targets, r => String(r.period_type) === 'year'),
        manual: pick(manual, () => true),
    });
};

/** rows を JSON 文字列でも配列でも受ける（⚠️ ① を通ると {} が [] になるので、画面は文字列で送る） */
const rowsOf = (v: unknown): Record<string, unknown>[] => {
    let x = v;
    if (typeof v === 'string') { try { x = JSON.parse(v); } catch { return []; } }
    return Array.isArray(x) ? x.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : [];
};

/** 目標の保存（POST land:target_save）。periodType = month / year。rows = [{memberId, kpiKey, value}]。⚠️ 0 や空は消す */
export const runLandTargetSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const type = str(body.periodType);
    const period = str(body.period, 7);
    if (!((type === 'month' && /^\d{4}-\d{2}$/.test(period)) || (type === 'year' && /^\d{4}$/.test(period)))) return fail(400, '期間が正しくありません。');
    return saveGrid(staff, rowsOf(body.rows), (r) => [type, period, r.memberId, r.kpiKey],
        'INSERT INTO land_target (period_type, period, member_id, kpi_key, value, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)',
        'DELETE FROM land_target WHERE period_type = ? AND period = ? AND member_id = ? AND kpi_key = ?',
        'target', `${type === 'year' ? '年間' : '月間'}目標 ${period}`);
};
/** 手入力の実績の保存（POST land:manual_save）。ym・rows = [{memberId, kpiKey, value}] */
export const runLandManualSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const ym = ymOrEmpty(body.ym);
    if (!ym) return fail(400, '月が正しくありません。');
    return saveGrid(staff, rowsOf(body.rows), (r) => [ym, r.memberId, r.kpiKey],
        'INSERT INTO land_manual_actual (ym, member_id, kpi_key, value, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)',
        'DELETE FROM land_manual_actual WHERE ym = ? AND member_id = ? AND kpi_key = ?',
        'target', `手入力の実績 ${ym}`);
};
const saveGrid = async (
    staff: AuthenticatedStaff, rows: Record<string, unknown>[],
    keyOf: (r: { memberId: number; kpiKey: string }) => unknown[], upsert: string, del: string, act: string, label: string
): Promise<LandResult> => {
    const who = whoOf(staff);
    const [members, kpis] = await Promise.all([loadMembers(), loadKpiDefs()]);
    const memberIds = new Set(members.map(m => m.id)); const keys = new Set(kpis.map(k => k.key));
    let n = 0;
    await withTransaction(async (tx) => {
        for (const r of rows) {
            const memberId = intOrNull(r.memberId); const kpiKey = str(r.kpiKey, 30);
            if (memberId === null || !memberIds.has(memberId) || !keys.has(kpiKey)) continue;
            const v = decOrNull(r.value);
            const k = keyOf({ memberId, kpiKey });
            if (v === null || v === 0) await tx.execute(del, k as never[]);
            else await tx.execute(upsert, [...k, v, who] as never[]);
            n++;
        }
    });
    await audit(who, act, '目標', label, `${n}件`);
    return ok({ saved: n });
};

// ---------------------------------------------------------------------------
// 月次レビュー（個人別実績）
// ---------------------------------------------------------------------------
export const runLandReview = async (body: Body): Promise<LandResult> => {
    const memberId = intOrNull(body.memberId);
    if (memberId === null) return fail(400, '担当者を選んでください。');
    const rows = await query<Row>('SELECT * FROM land_review WHERE member_id = ? ORDER BY ym DESC LIMIT 24', [memberId]);
    return ok({
        reviews: rows.map(r => ({
            ym: String(r.ym), phase: String(r.phase), bottleneck: String(r.bottleneck), good: String(r.good ?? ''),
            theme: String(r.theme ?? ''), comment: String(r.comment ?? ''), updatedBy: String(r.updated_by), updatedAt: String(r.updated_at),
        })),
    });
};
export const runLandReviewSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const memberId = intOrNull(body.memberId); const ym = ymOrEmpty(body.ym);
    if (memberId === null || !ym) return fail(400, '担当者と月を選んでください。');
    const v = [str(body.phase, 80), str(body.bottleneck, 80), str(body.good, 5000), str(body.theme, 5000), str(body.comment, 5000)];
    await execute(
        'INSERT INTO land_review (ym, member_id, phase, bottleneck, good, theme, comment, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        + ' ON DUPLICATE KEY UPDATE phase = VALUES(phase), bottleneck = VALUES(bottleneck), good = VALUES(good), theme = VALUES(theme), comment = VALUES(comment), updated_by = VALUES(updated_by)',
        [ym, memberId, ...v, whoOf(staff)]
    );
    await audit(whoOf(staff), 'update', '月次レビュー', String(memberId), ym);
    return ok({ saved: true });
};

// ---------------------------------------------------------------------------
// 設定（仕入設定）
// ---------------------------------------------------------------------------
/** 仕入設定（GET）：設定・適正在庫・選択肢（止めたものも）・反響ソース・KPI の定義・エリア・更新履歴 */
export const runLandSettingsData = async (): Promise<LandResult> => {
    const settings = await loadSettings();
    const [stock, options, sources, kpis, areas, audits] = await Promise.all([
        query<Row>('SELECT * FROM land_stock WHERE fy = ? ORDER BY sort, id', [settings.fyStart]),
        query<Row>('SELECT list_key, value, sort, active FROM land_option ORDER BY list_key, sort, id'),
        query<Row>('SELECT * FROM land_source ORDER BY sort, id'),
        query<Row>('SELECT * FROM land_kpi_def ORDER BY sort, id'),
        query<Row>('SELECT * FROM land_area ORDER BY sort, id'),
        query<Row>('SELECT at, user_name, act, target, name, note FROM land_audit ORDER BY at DESC, id DESC LIMIT 200'),
    ]);
    const opt: Record<string, { value: string; active: boolean }[]> = {};
    for (const o of options) (opt[String(o.list_key)] ??= []).push({ value: String(o.value), active: Number(o.active) === 1 });
    return ok({
        settings,
        stock: stock.map(r => ({ id: Number(r.id), memberId: r.member_id === null ? null : Number(r.member_id), areaName: String(r.area_name), proper: Number(r.proper), stock: Number(r.stock), sales: Number(r.sales) })),
        options: opt,
        sources: sources.map(r => ({ id: Number(r.id), name: String(r.name), kind: String(r.kind), memo: String(r.memo), sort: Number(r.sort), active: Number(r.active) === 1 })),
        kpiDefs: kpis.map(r => ({ id: Number(r.id), key: String(r.kpi_key), label: String(r.label), unit: String(r.unit), calc: String(r.calc), description: String(r.description), sort: Number(r.sort), active: Number(r.active) === 1 })),
        areas: areas.map(r => ({ id: Number(r.id), name: String(r.name), label: String(r.label), sort: Number(r.sort), active: Number(r.active) === 1 })),
        audit: audits.map(r => ({ at: String(r.at), user: String(r.user_name), act: String(r.act), target: String(r.target), name: String(r.name), note: String(r.note) })),
    });
};

/** 設定の保存（年度・返答期日の日数） */
export const runLandSettingSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const items: [string, unknown, number, number][] = [['fy_start', body.fyStart, 2000, 2100], ['alert_lead_days', body.leadDays, 0, 90], ['alert_warn_days', body.warnDays, 0, 60]];
    for (const [k, v, lo, hi] of items) {
        if (v === undefined) continue;
        const n = Number(v);
        if (!Number.isInteger(n) || n < lo || n > hi) return fail(400, `値が正しくありません（${lo}〜${hi}）。`);
        await execute('INSERT INTO land_setting (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [k, String(n)]);
    }
    await audit(whoOf(staff), 'system', '設定', '年度・アラート', JSON.stringify(body).slice(0, 200));
    return ok({ settings: await loadSettings() });
};

/** 適正在庫の保存（その年度の行を入れ替える）。rows = [{memberId, areaName, proper, stock, sales}] */
export const runLandStockSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const fy = int(body.fy);
    if (fy < 2000 || fy > 2100) return fail(400, '年度が正しくありません。');
    const rows = rowsOf(body.rows).filter(r => str(r.areaName, 60) !== '' || intOrNull(r.memberId) !== null);
    const n0 = (v: unknown) => Math.max(0, int(v));
    await withTransaction(async (tx) => {
        await tx.execute('DELETE FROM land_stock WHERE fy = ?', [fy]);
        let sort = 0;
        for (const r of rows) {
            sort++;
            await tx.execute('INSERT INTO land_stock (fy, member_id, area_name, proper, stock, sales, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [fy, intOrNull(r.memberId), str(r.areaName, 60), n0(r.proper), n0(r.stock), n0(r.sales), sort]);
        }
    });
    await audit(whoOf(staff), 'update', '適正在庫', `${fy}年度`, `${rows.length}行`);
    return ok({ saved: rows.length });
};

/**
 * 選択肢の保存（1つの種類をまるごと）。values = [{value, active}]。
 * ⚠️ 消さずに止める（active = 0）。⚠️ 使っている値を消すと、保存済みの記録が選べなくなるため。
 */
const OPTION_KEYS = ['deal_kind', 'ap_type', 'reaction', 'reply_result', 'lost_reason', 'deal_terms', 'vendor_kind', 'phase', 'bottleneck'];
export const runLandOptionSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const listKey = str(body.listKey, 30);
    if (!OPTION_KEYS.includes(listKey)) return fail(400, '選択肢の種類が正しくありません。');
    const values = rowsOf(body.values).map(v => ({ value: str(v.value, 80), active: v.active === false || v.active === 0 || v.active === '0' ? 0 : 1 })).filter(v => v.value !== '');
    if (values.filter(v => v.active).length === 0) return fail(400, '使う選択肢を1つ以上残してください。');
    await withTransaction(async (tx) => {
        await tx.execute('UPDATE land_option SET active = 0 WHERE list_key = ?', [listKey]);
        let sort = 0;
        for (const v of values) {
            sort++;
            await tx.execute('INSERT INTO land_option (list_key, value, sort, active) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE sort = VALUES(sort), active = VALUES(active)', [listKey, v.value, sort, v.active]);
        }
    });
    await audit(whoOf(staff), 'system', '選択肢', listKey, values.map(v => v.value).join('・').slice(0, 400));
    return ok({ saved: values.length });
};

/** 反響ソースの保存（id が無ければ追加） */
export const runLandSourceSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    const name = str(body.name, 60);
    if (name === '') return fail(400, '反響ソースの名前を入れてください。');
    const v = [name, str(body.kind, 30), str(body.memo, 255), int(body.sort), body.active === false || body.active === 0 || body.active === '0' ? 0 : 1];
    try {
        if (id === null) await execute('INSERT INTO land_source (name, kind, memo, sort, active) VALUES (?, ?, ?, ?, ?)', v);
        else await execute('UPDATE land_source SET name = ?, kind = ?, memo = ?, sort = ?, active = ? WHERE id = ?', [...v, id]);
    } catch (e) {
        if ((e as { code?: string }).code === 'ER_DUP_ENTRY') return fail(409, `「${name}」はすでにあります。`);
        throw e;
    }
    await audit(whoOf(staff), id === null ? 'create' : 'update', '反響ソース', name);
    return ok({ saved: true });
};

/**
 * KPI の定義の保存（id が無ければ追加）。
 * ⚠️ 自動で数える6指標（calc = auto）は、キーと数え方を変えられない（名前・単位・説明・並び・使うかだけ）。
 * ⚠️ 新しい KPI は手入力（calc = manual）だけ。目標・実績は「目標・月次入力」で入れる。
 */
export const runLandKpiSave = async (staff: AuthenticatedStaff, body: Body): Promise<LandResult> => {
    const id = intOrNull(body.id);
    const label = str(body.label, 40);
    if (label === '') return fail(400, 'KPI の名前を入れてください。');
    const common = [label, str(body.unit, 10) || '件', str(body.description, 255), int(body.sort), body.active === false || body.active === 0 || body.active === '0' ? 0 : 1];
    if (id !== null) {
        const r = await execute('UPDATE land_kpi_def SET label = ?, unit = ?, description = ?, sort = ?, active = ? WHERE id = ?', [...common, id]);
        if (r.affectedRows === 0) return fail(404, 'KPI が見つかりません。');
    } else {
        const key = str(body.key, 30);
        if (!/^[a-z][a-z0-9_]{1,29}$/.test(key)) return fail(400, 'キーは英小文字で始まる英数字（2〜30文字）にしてください。');
        if ((AUTO_KPI_KEYS as readonly string[]).includes(key)) return fail(409, 'そのキーは使えません。');
        try {
            await execute("INSERT INTO land_kpi_def (kpi_key, label, unit, description, sort, active, calc) VALUES (?, ?, ?, ?, ?, ?, 'manual')", [key, ...common]);
        } catch (e) {
            if ((e as { code?: string }).code === 'ER_DUP_ENTRY') return fail(409, `キー「${key}」はすでにあります。`);
            throw e;
        }
    }
    await audit(whoOf(staff), id === null ? 'create' : 'update', 'KPI', label);
    return ok({ saved: true });
};
