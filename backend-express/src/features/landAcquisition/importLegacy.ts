import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction, type Tx } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { AP_BREAKDOWN, STATUS } from './logic';
import { autoLinkMembers, dateOrNull, type LandResult } from './index';

/**
 * 移行元（仕入KPI管理 v7.3）の JSON バックアップを取り込む（v2.2.311。Master だけ）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移行元の「設定・データ → 書き出し・バックアップ → JSON」で書き出したファイル（中身は移行元のデータ S そのもの）。
 *   ⚠️ 画面が資料（_files。図面などの画像）を外し、JSON を **文字列のまま** payload で送る（① を通ると {} が [] になるため）。
 * ⚠️ 取り込むと、土地仕入の記録（案件・業者・アプローチ・まとめ入力・日報・目標・手入力の実績・レビュー・適正在庫・更新履歴）を
 *   **入れ替える**。⚠️ 担当者・エリアは名前で突き合わせて残す（スタッフとの結び付けを消さない）。
 *   ⚠️ 選択肢・KPI の定義・反響ソースには触らない。
 * ⚠️ dryRun なら件数だけ返す（書かない）。
 * ⚠️ 移行元の id は legacy_id に残す（案件の発生元アプローチ・業者のつながりを、新しい id に付け替える）。
 * ─────────────────────────────────────────────
 */

type Row = RowDataPacket & Record<string, unknown>;
type Obj = Record<string, unknown>;
const NAME_ALIAS: Record<string, string> = { '馬場崎': '馬場﨑', '髙村': '高村' };
const canon = (n: unknown): string => { const t = String(n ?? '').trim(); return NAME_ALIAS[t] ?? t; };
const s = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);
const n0 = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.round(x) : 0; };
const dec = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const x = Number(String(v).replace(/[,，\s]/g, ''));
    return Number.isFinite(x) ? x : null;
};
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === 'object') : []);
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

/** 置き換える表（⚠️ 担当者・エリア・選択肢・KPI・反響ソース・設定は入れない） */
const REPLACE_TABLES = ['land_deal', 'land_approach', 'land_vendor', 'land_daily_count', 'land_report', 'land_target', 'land_manual_actual', 'land_review', 'land_stock'];

export const runLandImport = async (staff: AuthenticatedStaff, body: Obj): Promise<LandResult> => {
    let data: Obj;
    try {
        data = obj(typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload);
    } catch {
        return { httpStatus: 400, body: { status: 'error', message: 'JSON を読めませんでした。移行元の「書き出し・バックアップ」の JSON を選んでください。' } };
    }
    if (!Array.isArray(data.members)) {
        return { httpStatus: 400, body: { status: 'error', message: '仕入KPI管理のバックアップではありません（担当者の一覧がありません）。' } };
    }
    const members = arr(data.members);
    const vendors = arr(data.vendors); const approaches = arr(data.approaches); const deals = arr(data.deals);
    const logs = arr(data.logs); const reports = arr(data.reports); const stock = arr(data.stock); const audits = arr(data.audit);
    const targets = obj(data.targets); const manual = obj(data.manual); const annual = obj(data.annual); const reviews = obj(data.reviews);
    const fyStart = Number(data.fyStart) || new Date().getFullYear();
    const counts = {
        members: members.length, vendors: vendors.length, approaches: approaches.length, deals: deals.length,
        dailyCounts: logs.length, reports: reports.length, stock: stock.length, audit: audits.length,
        targetMonths: Object.keys(targets).length, reviews: Object.keys(reviews).length,
    };
    if (body.dryRun === true || body.dryRun === '1' || body.dryRun === 'true') {
        const existing = await query<Row>('SELECT (SELECT COUNT(*) FROM land_deal) AS deals, (SELECT COUNT(*) FROM land_vendor) AS vendors, (SELECT COUNT(*) FROM land_approach) AS approaches');
        return { httpStatus: 200, body: { status: 'ok', dryRun: true, counts, existing: existing[0], fyStart } };
    }

    const who = s(staff.name, 60);
    const result = await withTransaction(async (tx: Tx) => {
        // ---- エリア・担当者（名前で突き合わせる。無ければ作る） ----
        const areaId = new Map<string, number>();
        for (const r of await tx.query<Row>('SELECT id, name FROM land_area')) areaId.set(String(r.name), Number(r.id));
        const areaOf = async (name: string): Promise<number | null> => {
            if (name === '' || name === 'その他') return null;
            if (!areaId.has(name)) {
                const res = await tx.execute('INSERT INTO land_area (name, sort) VALUES (?, ?)', [name, 100 + areaId.size]);
                areaId.set(name, res.insertId);
            }
            return areaId.get(name)!;
        };
        const memberId = new Map<string, number>();
        for (const r of await tx.query<Row>('SELECT id, name FROM land_member')) memberId.set(String(r.name), Number(r.id));
        let sort = 0;
        for (const m of members) {
            const name = canon(m.name);
            if (name === '') continue;
            const aId = await areaOf(s(m.area, 40));
            const active = m.active === false ? 0 : 1;
            sort++;
            if (memberId.has(name)) {
                await tx.execute('UPDATE land_member SET area_id = ?, active = ?, sort = ? WHERE id = ?', [aId, active, sort, memberId.get(name)!]);
            } else {
                const res = await tx.execute('INSERT INTO land_member (name, area_id, active, sort) VALUES (?, ?, ?, ?)', [name, aId, active, sort]);
                memberId.set(name, res.insertId);
            }
        }
        /** 記録に出てくるのに担当者マスタに無い名前は、停止中の担当者として作る（記録を担当者から離さない） */
        const mid = async (name: unknown): Promise<number | null> => {
            const nm = canon(name);
            if (nm === '') return null;
            if (!memberId.has(nm)) {
                const res = await tx.execute('INSERT INTO land_member (name, area_id, active, sort) VALUES (?, NULL, 0, 999)', [nm]);
                memberId.set(nm, res.insertId);
            }
            return memberId.get(nm)!;
        };

        // ⚠️ 主キーで条件を付ける（安全な更新モード（SQL_SAFE_UPDATES）の接続でも止まらないように）
        for (const t of REPLACE_TABLES) await tx.execute(`DELETE FROM ${t} WHERE id > 0`);

        // ---- 業者 ----
        const vendorId = new Map<string, number>();
        for (const v of vendors) {
            const name = s(v.name, 120);
            if (name === '') continue;
            const rank = s(v.rank, 1).toUpperCase();
            const temp = s(v.temp, 4);
            const res = await tx.execute(
                'INSERT INTO land_vendor (legacy_id, name, vkind, contact, tel, email, area, addr, url, owner_member_id, vendor_rank, temp, last_visit, buy_count, memo, created_by, updated_by)'
                + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [s(v.id, 32) || null, name, s(v.vkind, 30), s(v.contact, 60), s(v.tel, 40), s(v.email, 120), s(v.area, 60), s(v.addr, 200), s(v.url, 300),
                    await mid(v.owner), ['A', 'B', 'C', 'D', 'E'].includes(rank) ? rank : '', ['◎', '〇', '△', '✕'].includes(temp) ? temp : '',
                    dateOrNull(v.lastVisit), n0(v.buyCount), String(v.memo ?? ''), who, who]
            );
            if (v.id) vendorId.set(String(v.id), res.insertId);
        }
        const vid = (id: unknown): number | null => (id ? vendorId.get(String(id)) ?? null : null);

        // ---- アプローチ ----
        const apId = new Map<string, number>();
        let apSkipped = 0;
        for (const a of approaches) {
            const date = dateOrNull(a.date);
            if (date === null) { apSkipped++; continue; }
            const res = await tx.execute(
                'INSERT INTO land_approach (legacy_id, ap_date, ap_time, member_id, vendor_id, vendor_name, ap_type, contact, reaction, info_count, memo, address, map_url, land_m2, is_candidate, created_by, updated_by)'
                + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [s(a.id, 32) || null, date, /^\d{2}:\d{2}$/.test(s(a.time, 5)) ? s(a.time, 5) : '', await mid(a.member), vid(a.vendorId), s(a.vendorName, 120),
                    AP_BREAKDOWN.some(b => b.label === s(a.type, 20)) ? s(a.type, 20) : '訪問', s(a.contact, 60), s(a.reaction, 30), n0(a.infoCount),
                    String(a.memo ?? ''), s(a.address, 200), s(a.mapUrl, 500), dec(a.landM2), a.isCandidate === true ? 1 : 0, s(a.createdBy, 60), s(a.createdBy, 60)]
            );
            if (a.id) apId.set(String(a.id), res.insertId);
        }

        // ---- 案件 ----
        // ⚠️ 買付の上限・坪単価は保存しない（毎回 logic.ts で計算する）
        for (const d of deals) {
            const status = (STATUS as readonly string[]).includes(s(d.status, 20)) ? s(d.status, 20) : '情報取得';
            const er = dec(d.simExpenseRate); const pr = dec(d.simProfitRate);
            await tx.execute(
                'INSERT INTO land_deal (legacy_id, member_id, kind, vendor_id, vendor_name, address, map_url, lots, land_m2, price, seller_name, agent_name, buy_price, terms, terms_memo, status,'
                + ' info_date, prop_date, offer_date, contract_date, settle_date, memo, sim_sales, sim_build, sim_demolition, sim_expense_rate, sim_profit_rate,'
                + ' offer_to, reply_due, reply_result, reply_date, reply_memo, lost_reason, lost_memo, ap_id, created_by, updated_by)'
                + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [s(d.id, 32) || null, await mid(d.member), s(d.kind, 20) || '新規開拓', vid(d.vendorId), s(d.vendor, 120), s(d.address, 200), s(d.mapUrl, 500),
                    n0(d.lots), dec(d.landM2), dec(d.price), s(d.sellerName, 120), s(d.agentName, 120), dec(d.buyPrice), s(d.terms, 30), s(d.termsMemo, 500), status,
                    dateOrNull(d.infoDate), dateOrNull(d.propDate), dateOrNull(d.offerDate), dateOrNull(d.contractDate), dateOrNull(d.settleDate),
                    String(d.memo ?? ''), dec(d.simSales), dec(d.simBuild), dec(d.simDemolition), er !== null && er >= 0 ? er : 5, pr !== null && pr >= 0 ? pr : 15,
                    s(d.offerTo, 120), dateOrNull(d.replyDue), s(d.replyResult, 20), dateOrNull(d.replyDate), s(d.replyMemo, 500),
                    s(d.lostReason, 30), s(d.lostMemo, 500), d.apId ? apId.get(String(d.apId)) ?? null : null, s(d.createdBy, 60), s(d.updatedBy ?? d.createdBy, 60)]
            );
        }

        // ---- まとめ入力・日報 ----
        for (const l of logs) {
            const date = dateOrNull(l.date);
            if (date === null) continue;
            await tx.execute(
                `INSERT INTO land_daily_count (legacy_id, count_date, member_id, ${AP_BREAKDOWN.map(b => `cnt_${b.k}`).join(', ')}, cnt_info, note, updated_by) VALUES (?, ?, ?, ${AP_BREAKDOWN.map(() => '?').join(', ')}, ?, ?, ?)`,
                [s(l.id, 32) || null, date, await mid(l.member), ...AP_BREAKDOWN.map(b => n0(l[b.k])), n0(l.info), s(l.note, 500), s(l.updatedBy, 60)]
            );
        }
        for (const r of reports) {
            const date = dateOrNull(r.date);
            if (date === null) continue;
            await tx.execute(
                'INSERT INTO land_report (legacy_id, report_date, member_id, done, info, issue, next_plan, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [s(r.id, 32) || null, date, await mid(r.member), String(r.done ?? ''), String(r.info ?? ''), String(r.issue ?? ''), String(r.next ?? ''), s(r.createdBy, 60), s(r.updatedBy ?? r.createdBy, 60)]
            );
        }

        // ---- 目標（月間・年間）・手入力の実績 ----
        const KPI = ['ap', 'info', 'prop', 'offer', 'contract', 'lots'];
        const putTarget = async (type: string, period: string, name: string, vals: Obj) => {
            const m = await mid(name);
            if (m === null) return;
            for (const k of KPI) {
                const v = Number(vals[k] ?? 0);
                if (!Number.isFinite(v) || v === 0) continue;
                await tx.execute('INSERT INTO land_target (period_type, period, member_id, kpi_key, value, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [type, period, m, k, v, who]);
            }
        };
        for (const [ym, byName] of Object.entries(targets)) {
            if (!/^\d{4}-\d{2}$/.test(ym)) continue;
            for (const [name, vals] of Object.entries(obj(byName))) await putTarget('month', ym, name, obj(vals));
        }
        for (const [name, vals] of Object.entries(annual)) await putTarget('year', String(fyStart), name, obj(vals));
        for (const [ym, byName] of Object.entries(manual)) {
            if (!/^\d{4}-\d{2}$/.test(ym)) continue;
            for (const [name, vals] of Object.entries(obj(byName))) {
                const m = await mid(name);
                if (m === null) continue;
                for (const k of KPI) {
                    const v = Number(obj(vals)[k] ?? 0);
                    if (!Number.isFinite(v) || v === 0) continue;
                    await tx.execute('INSERT INTO land_manual_actual (ym, member_id, kpi_key, value, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [ym, m, k, v, who]);
                }
            }
        }

        // ---- 月次レビュー（キーは「YYYY-MM|名前」）・適正在庫 ----
        for (const [key, rv] of Object.entries(reviews)) {
            const [ym, name] = key.split('|');
            if (!/^\d{4}-\d{2}$/.test(ym ?? '')) continue;
            const m = await mid(name);
            if (m === null) continue;
            const r = obj(rv);
            await tx.execute(
                'INSERT INTO land_review (ym, member_id, phase, bottleneck, good, theme, comment, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE phase = VALUES(phase), bottleneck = VALUES(bottleneck), good = VALUES(good), theme = VALUES(theme), comment = VALUES(comment)',
                [ym, m, s(r.phase, 80), s(r.bottleneck, 80), String(r.good ?? ''), String(r.theme ?? ''), String(r.comment ?? ''), who]
            );
        }
        let stockSort = 0;
        for (const r of stock) {
            stockSort++;
            await tx.execute('INSERT INTO land_stock (fy, member_id, area_name, proper, stock, sales, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [fyStart, await mid(r.member), s(r.area, 60), n0(r.proper), n0(r.stock), n0(r.sales), stockSort]);
        }

        // ---- 設定（年度・返答期日のアラート） ----
        const alert = obj(data.alert);
        const setSetting = (k: string, v: string) => tx.execute('INSERT INTO land_setting (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [k, v]);
        await setSetting('fy_start', String(fyStart));
        if (Number.isFinite(Number(alert.leadDays))) await setSetting('alert_lead_days', String(Math.min(90, Math.max(0, Math.round(Number(alert.leadDays))))));
        if (Number.isFinite(Number(alert.warnDays))) await setSetting('alert_warn_days', String(Math.min(60, Math.max(0, Math.round(Number(alert.warnDays))))));

        // ---- 更新履歴（移行元の分を残してから、取り込んだことを足す） ----
        for (const x of audits) {
            const at = String(x.at ?? '').replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/, '$1 $2:00');
            await tx.execute('INSERT INTO land_audit (at, user_name, act, target, name, note) VALUES (?, ?, ?, ?, ?, ?)',
                [/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(at) ? at : new Date().toISOString().slice(0, 19).replace('T', ' '), s(x.user, 60), s(x.act, 20), s(x.target, 30), s(x.name, 200), s(x.note, 500)]);
        }
        const linked = await autoLinkMembers(tx);
        await tx.execute('INSERT INTO land_audit (user_name, act, target, name, note) VALUES (?, ?, ?, ?, ?)',
            [who, 'import', '移行', '仕入KPI管理', `案件 ${deals.length}件／業者 ${vendors.length}社／アプローチ ${approaches.length - apSkipped}件`]);
        return { apSkipped, linked };
    });
    return { httpStatus: 200, body: { status: 'ok', counts, ...result } };
};
