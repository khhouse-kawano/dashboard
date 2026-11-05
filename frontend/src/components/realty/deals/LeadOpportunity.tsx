import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../../context/AuthContext';
import DocumentViewer from '../documents/DocumentViewer';
import PlannerGenerator, { PlannerInputState } from '../documents/PlannerGenerator';
import LeadNotifications from '../common/LeadNotifications';
import {
    saveBrokerageRecord, recordFieldChanges, softDeleteRecord,
    DEAL_PHASES, DEAL_LOST_REASONS, NEXT_EXEMPT,
} from '../common/leadUtiles';
import { loadRecords } from '../common/realtyState';
import { CONFIRMED, dealFee, dealReform, dealReformGp, fmtYen, fmtYen0, pct, shareOf, stdFee, todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';

/**
 * 商談案件管理（不動産企画係）。⚠️ v2.2.244 で以前のアプリ v14.29 の「🏷 商談案件管理」（renderDeals / editDeal / saveDeal）に作り直した。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **読むのは商談案件（brokerage_listings の kind = deals）。**
 *   v2.2.243 までは媒介台帳と買い反響をフェーズで絞って出しており、商談案件そのもの（67件）が1件も出ていなかった。
 *   月次売上・失注分析は商談案件で数えるので、ここで直した値がそのまま集計に出る。
 *
 * ⚠️⚠️ **案件は必ず反響からできる。この画面では作れない**（v2.2.245 で「＋ 商談案件を追加」を消した。制作者の要望）。
 *   ここで作ると、売主・買主がどの反響から来たのか分からない案件ができてしまうため。
 *   ・買い反響を「購入申込」にしたときの転記（common/leadLinks.ts の buyToDeal）
 *   ・媒介台帳の買付登録（⚠️ まだ移していない。v2.2.246 の予定）
 * ⚠️ 失注にするときは失注理由が必須（lostReason・lostDate・lostNote。2026-11-04_realty_deal_lost.sql で列にした）。
 * ⚠️ 仲介手数料は成約価格から自動計算（800万円以下＝30万円／超＝3%＋6万円・税抜。kpi.ts の stdFee）。手入力した額があればそちら（feeManual）。
 * ⚠️ 削除は論理削除（show_dashboard = 0）。以前のアプリは消していた。
 * ─────────────────────────────────────────────
 */

type InitialDoc = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null;
    phone?: string | null;
    mail?: string | null;
    addr: string | null;
    price: number | null;
    fee: number | null;
    recordId?: string | null;
    docDraft?: string | null;
};

/** 編集画面の入力（⚠️ 数字の欄も文字で持つ。空欄と 0 を区別するため） */
type Form = {
    no: string; property: string; type: string; price: string; fee: string;
    staff: string; subStaff: string; subRatio: string; customer: string; phase: string;
    lostReason: string; lostNote: string; nextDate: string; nextNote: string;
    contactDate: string; contractDate: string; settleDate: string; followDate: string; note: string;
    reformPrice: string; reformGp: string; reformNote: string;
};

const DEAL_TYPES = ['売', '買', '買取'];

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
/** 'YYYY-MM-DD'。⚠️ 0000-00-00 は空 */
const day = (v: unknown): string => {
    const s = str(v).slice(0, 10);
    return s.startsWith('0000') ? '' : s;
};
const diffDays = (from: string, to: string): number =>
    Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);

const formOf = (d: Row): Form => ({
    no: str(d.no), property: str(d.property), type: str(d.type) || '売', price: num(d.price) ? String(num(d.price)) : '',
    fee: num(d.feeManual) ? str(d.fee) : '',
    staff: str(d.staff), subStaff: str(d.subStaff), subRatio: num(d.subRatio) ? String(num(d.subRatio)) : '',
    customer: str(d.customer), phase: str(d.phase) || '初回接触',
    lostReason: str(d.lostReason), lostNote: str(d.lostNote), nextDate: day(d.nextDate), nextNote: str(d.nextNote),
    contactDate: day(d.contactDate), contractDate: day(d.contractDate), settleDate: day(d.settleDate), followDate: day(d.followDate),
    note: str(d.note),
    reformPrice: dealReform(d) ? String(dealReform(d)) : '', reformGp: dealReformGp(d) ? String(dealReformGp(d)) : '',
    reformNote: str(d.reformNote),
});

const phaseClass = (p: string): string =>
    p === '決済完了' ? 'secondary' : p === '契約済' ? 'success' : p === '契約予定' ? 'primary' : p === '失注' ? 'danger' : 'warning';

const LeadOpportunity = () => {
    const { userName } = useContext(AuthContext);

    const [deals, setDeals] = useState<Row[]>([]);
    const [staffNames, setStaffNames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedPhase, setSelectedPhase] = useState('');
    const [hideSettled, setHideSettled] = useState(true);
    const [showReform, setShowReform] = useState(true);

    /** 編集中（null は閉じている） */
    const [form, setForm] = useState<Form | null>(null);
    const [editingId, setEditingId] = useState('');

    const [documentShow, setDocumentShow] = useState(false);
    const [docData, setDocData] = useState<InitialDoc | undefined>(undefined);
    const [plannerShow, setPlannerShow] = useState(false);
    const [plannerData, setPlannerData] = useState<Partial<PlannerInputState> | undefined>(undefined);

    const today = todayStr();

    useEffect(() => {
        setIsLoading(true);
        loadRecords(['deals'])
            .then(({ records, settings }) => {
                setDeals(records.deals);
                setStaffNames((settings.staff ?? []).map(s => str(s.name)).filter(Boolean));
            })
            .catch(e => {
                console.error('[LeadOpportunity] 商談案件の読み込みに失敗しました', e);
                alert('商談案件を読み込めませんでした。時間をおいて開き直してください。');
            })
            .finally(() => setIsLoading(false));
    }, []);

    // -----------------------------------------------------------------------
    // 保存
    // -----------------------------------------------------------------------

    /** 1件を部分更新する（先に画面を直し、失敗したら戻す）。⚠️ 成功してから履歴を残す */
    const patchDeal = useCallback(async (id: string, fields: Row): Promise<boolean> => {
        const before = deals.find(d => str(d.id) === id);
        setDeals(prev => prev.map(d => (str(d.id) === id ? { ...d, ...fields } : d)));
        try {
            await saveBrokerageRecord(id, fields);
            if (before) {
                await recordFieldChanges({
                    entity: 'deal', entityId: id, entityNo: num(before.no) || null,
                    label: str(before.property) || str(before.customer) || id,
                    before, after: fields, by: userName || '不明',
                });
            }
            return true;
        } catch (e) {
            console.error('[LeadOpportunity] 保存に失敗しました', { id, fields }, e);
            setDeals(prev => prev.map(d => (str(d.id) === id && before ? before : d)));
            alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
            return false;
        }
    }, [deals, userName]);

    /** 一覧の数字の欄（成約価格・リフォーム）。⚠️ 値が変わったときだけ保存 */
    const saveNumber = (d: Row, field: 'price' | 'reformPrice' | 'reformGp', raw: string) => {
        const next = raw.trim() === '' ? 0 : Math.round(Number(raw));
        if (!Number.isFinite(next)) { alert('数字で入力してください。'); return; }
        if (field === 'reformPrice' && next < 0) { alert('リフォーム受注金額は0以上で入力してください。'); return; }
        if (next === Math.round(num(d[field]))) return;
        void patchDeal(str(d.id), { [field]: next });
    };

    /** 一覧のフェーズ。⚠️ 失注は理由が要るので編集画面を開く（以前のアプリの lostDialog） */
    const changePhase = (d: Row, e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        const prev = str(d.phase);
        if (next === prev) return;
        if (next === '失注') {
            e.target.value = prev;
            if (!window.confirm('フェーズを「失注」にすると月次売上の集計から除外されます。よろしいですか？\n失注理由を入れる画面を開きます。')) return;
            openEdit(d, { phase: '失注' });
            return;
        }
        void patchDeal(str(d.id), { phase: next });
    };

    const openEdit = (d: Row, preset: Partial<Form> = {}) => {
        setEditingId(str(d.id));
        setForm({ ...formOf(d), ...preset });
    };

    const patchForm = (p: Partial<Form>) => setForm(prev => (prev ? { ...prev, ...p } : prev));

    /** 編集画面の保存（以前のアプリの saveDeal と同じ確かめ方） */
    const saveForm = async () => {
        if (!form) return;
        const price = Math.round(Number(form.price) || 0);
        const rfPrice = Math.max(0, Math.round(Number(form.reformPrice) || 0));
        const rfGp = Math.round(Number(form.reformGp) || 0);
        if (!form.property.trim()) { alert('物件名を入力してください。'); return; }
        const fields: Row = {
            no: Number(form.no) || null, property: form.property.trim(), type: form.type, price,
            feeManual: form.fee.trim() !== '', fee: form.fee.trim() !== '' ? Math.round(Number(form.fee)) : null,
            contactDate: form.contactDate, staff: form.staff, subStaff: form.subStaff, subRatio: Number(form.subRatio) || 0,
            customer: form.customer.trim(), phase: form.phase,
            contractDate: form.contractDate, settleDate: form.settleDate, followDate: form.followDate, note: form.note.trim(),
            nextDate: form.nextDate, nextNote: form.nextNote.trim(),
            reformPrice: rfPrice, reformGp: rfGp, reformNote: form.reformNote.trim(),
        };
        if (form.phase === '失注') {
            if (!form.lostReason) { alert('失注にするときは「失注理由」を選んでください。'); return; }
            const cur = deals.find(d => str(d.id) === editingId);
            fields.lostReason = form.lostReason;
            fields.lostNote = form.lostNote.trim();
            fields.lostDate = (cur && str(cur.phase) === '失注' && day(cur.lostDate)) || today;
        }
        if (!NEXT_EXEMPT.includes(form.phase)) {
            if (!form.nextDate || !form.nextNote.trim()) { alert('次回アクション（予定日・内容）は必須です。'); return; }
            if (form.nextDate < today && !window.confirm('次回アクション予定日が過去の日付です。このまま保存しますか？')) return;
        }
        if (rfGp !== 0 && rfPrice === 0) { alert('リフォーム受注金額を入力してください（粗利のみの登録はできません）。'); return; }
        if (rfPrice > 0 && rfGp > rfPrice && !window.confirm(`リフォーム粗利（${fmtYen(rfGp)}）が受注金額（${fmtYen(rfPrice)}）を上回っています。\nこのまま保存しますか？`)) return;
        // ⚠️ 手入力の額が規定の計算と同じなら自動計算に戻す（以前のアプリと同じ）
        if (fields.feeManual && stdFee(price) === fields.fee) { fields.feeManual = false; fields.fee = null; }

        if (await patchDeal(editingId, fields)) setForm(null);
    };

    const deleteDeal = async () => {
        if (!editingId || !window.confirm('この商談案件を削除しますか？\n（一覧と集計から外れます。データは残ります）')) return;
        try {
            await softDeleteRecord(editingId, userName || '不明');
            setDeals(prev => prev.filter(d => str(d.id) !== editingId));
            setForm(null);
        } catch (e) {
            console.error('[LeadOpportunity] 削除に失敗しました', editingId, e);
            alert('削除できませんでした。もう一度お試しください。');
        }
    };

    // -----------------------------------------------------------------------
    // 契約書・精算書
    // -----------------------------------------------------------------------

    const openDocument = (d: Row) => {
        const price = num(d.price) || null;
        setDocData({
            name: str(d.customer) || null, baikaiType: '専任媒介', category: null, phone: null, mail: null,
            addr: str(d.property) || null, price, fee: price ? dealFee(d) : null,
            recordId: str(d.id), docDraft: str(d.docDraft) || null,
        });
        setDocumentShow(true);
    };

    /** 以前のアプリの fromDeal(d) → SETL.open(dealId) */
    const openPlanner = (d: Row) => {
        const data: Partial<PlannerInputState> = {};
        if (str(d.property)) data.propName = str(d.property);
        if (num(d.price)) data.price = num(d.price);
        if (day(d.contractDate)) data.contractDate = day(d.contractDate);
        if (day(d.settleDate)) data.delivery = day(d.settleDate);
        if (str(d.customer)) {
            if (str(d.type) === '買') data.buyer = str(d.customer); else data.seller = str(d.customer);
        }
        setPlannerData(data);
        setPlannerShow(true);
    };

    // -----------------------------------------------------------------------
    // 集計・一覧
    // -----------------------------------------------------------------------

    /** 担当者別サマリー（以前のアプリと同じ: 失注を除く・共同担当も数える・リフォームは売上割合で按分） */
    const summary = useMemo(() => {
        const rows = staffNames.map(nm => {
            const dd = deals.filter(d => (str(d.staff) === nm || str(d.subStaff) === nm) && str(d.phase) !== '失注');
            const c = dd.filter(d => CONFIRMED.includes(str(d.phase))).length;
            return {
                nm, n: dd.length, c, p: dd.length - c,
                s: dd.filter(d => str(d.type) === '売').length, b: dd.filter(d => str(d.type) === '買').length,
                k: dd.filter(d => str(d.type) === '買取').length,
                rp: dd.reduce((a, d) => a + shareOf(d, nm, dealReform), 0), rg: dd.reduce((a, d) => a + shareOf(d, nm, dealReformGp), 0),
            };
        });
        const t = rows.reduce((a, r) => ({ n: a.n + r.n, c: a.c + r.c, p: a.p + r.p, s: a.s + r.s, b: a.b + r.b, k: a.k + r.k, rp: a.rp + r.rp, rg: a.rg + r.rg }),
            { n: 0, c: 0, p: 0, s: 0, b: 0, k: 0, rp: 0, rg: 0 });
        return { rows, t };
    }, [deals, staffNames]);

    const list = useMemo(() => deals
        .filter(d => {
            if (selectedStaff && str(d.staff) !== selectedStaff && str(d.subStaff) !== selectedStaff) return false;
            if (selectedPhase && str(d.phase) !== selectedPhase) return false;
            if (hideSettled && str(d.phase) === '決済完了' && !selectedPhase) return false;
            return true;
        })
        // ⚠️ 契約日の古い順（未入力は最後）。以前のアプリと同じ
        .sort((a, b) => ((day(a.contractDate) || '9999') < (day(b.contractDate) || '9999') ? -1 : 1)),
    [deals, selectedStaff, selectedPhase, hideSettled]);

    const totals = useMemo(() => ({
        fee: list.reduce((a, d) => a + dealFee(d), 0),
        rp: list.reduce((a, d) => a + dealReform(d), 0),
        rg: list.reduce((a, d) => a + dealReformGp(d), 0),
    }), [list]);

    const numInput = (d: Row, field: 'price' | 'reformPrice' | 'reformGp') => (
        <input
            key={`${str(d.id)}-${field}-${str(d[field])}`}
            type="number"
            className="form-control form-control-sm text-end"
            style={{ fontSize: '11px', minWidth: '96px' }}
            defaultValue={Math.round(num(d[field])) || ''}
            onBlur={e => saveNumber(d, field, e.target.value)}
        />
    );

    const dateInput = (d: Row, field: 'contractDate' | 'settleDate') => (
        <input
            key={`${str(d.id)}-${field}-${day(d[field])}`}
            type="date"
            className="form-control form-control-sm"
            style={{ fontSize: '11px', minWidth: '118px' }}
            defaultValue={day(d[field])}
            onChange={e => { if (e.target.value !== day(d[field])) void patchDeal(str(d.id), { [field]: e.target.value }); }}
        />
    );

    const th: React.CSSProperties = { fontSize: '11px', whiteSpace: 'nowrap', color: '#6c757d' };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
            <div className="d-flex flex-wrap justify-content-between align-items-end mb-3 pb-2 border-bottom" style={{ minWidth: '1200px' }}>
                <div>
                    <h4 className="fw-bold text-secondary mb-2" style={{ letterSpacing: '1px' }}>
                        <i className="bi bi-briefcase me-2 text-primary"></i>商談案件管理
                    </h4>
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        1行1案件。成約価格・進捗フェーズ・契約日・決済予定日・リフォーム受注額・粗利は一覧のまま直せます（自動保存）。
                        仲介手数料は成約価格から自動計算（800万円以下＝30万円／超＝価格×3％＋6万円・税抜）。税込10％を併記。
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2 mt-3 mt-md-0">
                    <LeadNotifications />
                    {/* ⚠️ v2.2.245: 「＋ 商談案件を追加」は消した（案件は反響から作る。上の注記） */}
                    <span className="text-muted" style={{ fontSize: '11px' }}>案件は買い反響を「購入申込」にすると作られます</span>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
            ) : (
                <>
                    <div className="card shadow-sm border-0 rounded-3 mb-3" style={{ minWidth: '1000px', maxWidth: '1300px' }}>
                        <div className="card-header bg-white border-bottom-0 pt-3 pb-1">
                            <h6 className="fw-bold text-dark mb-0">担当者別サマリー（自動集計）</h6>
                            <div className="text-muted" style={{ fontSize: '11px' }}>失注を除きます。リフォームは共同担当がいる案件を、仲介手数料と同じ売上割合で按分しています。</div>
                        </div>
                        <div className="card-body p-0">
                            <table className="table table-sm table-bordered table-hover mb-0 text-end align-middle text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="table-light">
                                    <tr>
                                        <th className="text-start ps-3" style={th}>担当者</th><th style={th}>案件数</th><th style={th}>契約件数</th><th style={th}>契約率</th>
                                        <th style={th}>未決案件</th><th style={th}>売 件数</th><th style={th}>買 件数</th><th style={th}>買取 件数</th>
                                        <th style={th}>リフォーム受注額</th><th style={th}>リフォーム粗利</th><th style={th}>リフォーム粗利率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.rows.map(r => (
                                        <tr key={r.nm}>
                                            <td className="text-start ps-3 fw-bold">{r.nm}</td><td>{r.n}</td><td>{r.c}</td><td>{r.n ? pct(r.c / r.n) : '―'}</td>
                                            <td>{r.p}</td><td>{r.s}</td><td>{r.b}</td><td>{r.k}</td>
                                            <td>{fmtYen0(r.rp)}</td><td>{fmtYen0(r.rg)}</td><td>{r.rp ? pct(r.rg / r.rp) : '―'}</td>
                                        </tr>
                                    ))}
                                    <tr className="table-light fw-bold">
                                        <td className="text-start ps-3">チーム合計</td><td>{summary.t.n}</td><td>{summary.t.c}</td><td>{summary.t.n ? pct(summary.t.c / summary.t.n) : '―'}</td>
                                        <td>{summary.t.p}</td><td>{summary.t.s}</td><td>{summary.t.b}</td><td>{summary.t.k}</td>
                                        <td>{fmtYen0(summary.t.rp)}</td><td>{fmtYen0(summary.t.rg)}</td><td>{summary.t.rp ? pct(summary.t.rg / summary.t.rp) : '―'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-3 mb-2" style={{ fontSize: '12px', minWidth: '1000px' }}>
                        <label className="d-flex align-items-center gap-1 text-muted fw-bold">担当
                            <select className="form-select form-select-sm" style={{ width: '140px', fontSize: '12px' }} value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                                <option value="">全員</option>
                                {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                        <label className="d-flex align-items-center gap-1 text-muted fw-bold">フェーズ
                            <select className="form-select form-select-sm" style={{ width: '130px', fontSize: '12px' }} value={selectedPhase} onChange={e => setSelectedPhase(e.target.value)}>
                                <option value="">すべて</option>
                                {DEAL_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>
                        <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={hideSettled} onChange={e => setHideSettled(e.target.checked)} />決済完了を隠す
                        </label>
                        <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={showReform} onChange={e => setShowReform(e.target.checked)} />リフォームの列
                        </label>
                        <span className="text-muted">{list.length}件表示</span>
                    </div>

                    <div className="card shadow-sm border-0 rounded-3" style={{ minWidth: '1500px' }}>
                        <div className="card-body p-0 table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0 text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                    <tr>
                                        <th style={th}>No.</th><th style={th}>物件名</th><th style={th} className="text-center">種別</th>
                                        <th style={th} className="text-end">成約価格(円)</th><th style={th} className="text-end">仲介手数料(円)</th>
                                        {showReform && <><th style={th} className="text-end">リフォーム受注額</th><th style={th} className="text-end">リフォーム粗利</th><th style={th} className="text-end">粗利率</th></>}
                                        <th style={th}>担当者</th><th style={th}>顧客名</th><th style={th}>進捗フェーズ</th>
                                        <th style={th}>契約日</th><th style={th}>決済予定日</th><th style={th} className="text-end">経過日数</th>
                                        <th style={th}>備考</th><th style={th}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.length === 0 && (
                                        <tr><td colSpan={showReform ? 16 : 13} className="text-center text-muted py-5">該当する案件がありません</td></tr>
                                    )}
                                    {list.map(d => {
                                        const id = str(d.id);
                                        const fee = dealFee(d);
                                        const rp = dealReform(d);
                                        const rg = dealReformGp(d);
                                        const contact = day(d.contactDate);
                                        const phase = str(d.phase);
                                        return (
                                            <tr key={id}>
                                                <td className="text-muted">{str(d.no)}</td>
                                                <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>{str(d.property)}</td>
                                                <td className="text-center">{str(d.type)}</td>
                                                <td className="text-end">{numInput(d, 'price')}</td>
                                                <td className={`text-end ${num(d.feeManual) ? 'bg-warning bg-opacity-25' : ''}`}>
                                                    {fmtYen(fee)}{num(d.feeManual) ? <span className="ms-1 text-muted">手入力</span> : null}
                                                    <div className="text-muted" style={{ fontSize: '10px' }}>税込 {fmtYen(Math.round(fee * 1.1))}</div>
                                                </td>
                                                {showReform && <>
                                                    <td className="text-end">{numInput(d, 'reformPrice')}</td>
                                                    <td className="text-end">{numInput(d, 'reformGp')}</td>
                                                    <td className={`text-end ${rp && rg < 0 ? 'text-danger' : ''}`}>{rp ? pct(rg / rp) : '―'}</td>
                                                </>}
                                                <td>
                                                    {str(d.staff)}
                                                    {str(d.subStaff) && <div className="text-muted" style={{ fontSize: '10px' }}>+{str(d.subStaff)}（{num(d.subRatio)}%）</div>}
                                                </td>
                                                <td>{str(d.customer)}</td>
                                                <td>
                                                    <select
                                                        key={`${id}-phase-${phase}`}
                                                        className={`form-select form-select-sm border-${phaseClass(phase)}`}
                                                        style={{ fontSize: '11px', minWidth: '104px' }}
                                                        defaultValue={phase}
                                                        onChange={e => changePhase(d, e)}
                                                    >
                                                        {DEAL_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                                                        {phase && !DEAL_PHASES.includes(phase) && <option value={phase}>{phase}</option>}
                                                    </select>
                                                    {phase === '失注' && str(d.lostReason) && <div className="text-danger" style={{ fontSize: '10px' }}>{str(d.lostReason)}</div>}
                                                </td>
                                                <td>{dateInput(d, 'contractDate')}</td>
                                                <td>{dateInput(d, 'settleDate')}</td>
                                                <td className="text-end">{contact ? diffDays(contact, today) : '―'}</td>
                                                <td style={{ maxWidth: '200px', whiteSpace: 'normal' }} className="text-muted">
                                                    {str(d.note)}
                                                    {str(d.reformNote) && <div>🔧{str(d.reformNote)}</div>}
                                                </td>
                                                <td>
                                                    <div className="d-flex gap-1">
                                                        <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openDocument(d)} title="媒介契約書・事前説明書を作成">契約書</button>
                                                        <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openPlanner(d)} title="決済精算書・請求書・領収証を作成">精算書</button>
                                                        <button className="btn btn-outline-primary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openEdit(d)}>編集</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {showReform && (
                            <div className="card-footer bg-white text-muted" style={{ fontSize: '11px' }}>
                                表示中{list.length}件の合計　仲介手数料 <b>{fmtYen(totals.fee)}</b>　＋　リフォーム粗利 <b>{fmtYen(totals.rg)}</b>　＝　売上計上額 <b>{fmtYen(totals.fee + totals.rg)}</b>
                                　／　参考：リフォーム受注額 {fmtYen0(totals.rp)}（粗利率 {totals.rp ? pct(totals.rg / totals.rp) : '―'}）　※按分前の案件ベース金額
                            </div>
                        )}
                    </div>
                </>
            )}

            <Modal show={form !== null} onHide={() => setForm(null)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>商談案件を編集</Modal.Title>
                </Modal.Header>
                {form && (
                    <Modal.Body style={{ fontSize: '12px' }}>
                        <div className="row g-2">
                            <div className="col-md-2"><label className="form-label mb-0 text-muted fw-bold">No.</label>
                                <input type="number" className="form-control form-control-sm" value={form.no} onChange={e => patchForm({ no: e.target.value })} /></div>
                            <div className="col-md-7"><label className="form-label mb-0 text-muted fw-bold">物件名 <span className="text-danger">*</span></label>
                                <input className="form-control form-control-sm" value={form.property} onChange={e => patchForm({ property: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">種別</label>
                                <select className="form-select form-select-sm" value={form.type} onChange={e => patchForm({ type: e.target.value })}>
                                    {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select></div>

                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">物件（成約）価格(円)</label>
                                <input type="number" className="form-control form-control-sm" value={form.price} onChange={e => patchForm({ price: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">仲介手数料(円) <span className="fw-normal">空欄＝自動計算</span></label>
                                <input type="number" className="form-control form-control-sm" value={form.fee} placeholder="自動" onChange={e => patchForm({ fee: e.target.value })} />
                                <div className="text-muted" style={{ fontSize: '10px' }}>
                                    {form.fee.trim() ? '手入力額を使います（黄色表示）' : `自動計算：${fmtYen(stdFee(Number(form.price) || 0))}`}
                                </div></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">顧客名</label>
                                <input className="form-control form-control-sm" value={form.customer} onChange={e => patchForm({ customer: e.target.value })} /></div>

                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">主担当者</label>
                                <select className="form-select form-select-sm" value={form.staff} onChange={e => patchForm({ staff: e.target.value })}>
                                    <option value=""></option>
                                    {[...staffNames, ...(form.staff && !staffNames.includes(form.staff) ? [form.staff] : [])].map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">共同担当（按分用）</label>
                                <select className="form-select form-select-sm" value={form.subStaff} onChange={e => patchForm({ subStaff: e.target.value })}>
                                    <option value="">なし</option>
                                    {[...staffNames, ...(form.subStaff && !staffNames.includes(form.subStaff) ? [form.subStaff] : [])].map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">共同担当の売上割合(%)</label>
                                <input type="number" min={0} max={100} className="form-control form-control-sm" value={form.subRatio} placeholder="例: 50" onChange={e => patchForm({ subRatio: e.target.value })} /></div>

                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">進捗フェーズ</label>
                                <select className="form-select form-select-sm" value={form.phase} onChange={e => patchForm({ phase: e.target.value })}>
                                    {[...DEAL_PHASES, ...(form.phase && !DEAL_PHASES.includes(form.phase) ? [form.phase] : [])].map(p => <option key={p} value={p}>{p}</option>)}
                                </select></div>
                            {form.phase === '失注' && <>
                                <div className="col-md-4"><label className="form-label mb-0 text-danger fw-bold">失注理由 <span>*必須</span></label>
                                    <select className="form-select form-select-sm" value={form.lostReason} onChange={e => patchForm({ lostReason: e.target.value })}>
                                        <option value=""></option>
                                        {[...DEAL_LOST_REASONS, ...(form.lostReason && !DEAL_LOST_REASONS.includes(form.lostReason) ? [form.lostReason] : [])].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select></div>
                                <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">失注の詳細（次に活かすこと）</label>
                                    <input className="form-control form-control-sm" value={form.lostNote} placeholder="例：ローン本審査で否決" onChange={e => patchForm({ lostNote: e.target.value })} /></div>
                            </>}
                            {!NEXT_EXEMPT.includes(form.phase) && <>
                                <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">次回アクション予定日 <span className="text-danger">*</span></label>
                                    <input type="date" className="form-control form-control-sm" value={form.nextDate} onChange={e => patchForm({ nextDate: e.target.value })} /></div>
                                <div className="col-md-8"><label className="form-label mb-0 text-muted fw-bold">次回アクション内容 <span className="text-danger">*</span></label>
                                    <input className="form-control form-control-sm" value={form.nextNote} placeholder="ローン事前審査の結果確認 など" onChange={e => patchForm({ nextNote: e.target.value })} /></div>
                            </>}

                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">接触日</label>
                                <input type="date" className="form-control form-control-sm" value={form.contactDate} onChange={e => patchForm({ contactDate: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">契約日 <span className="fw-normal">入力月に売上計上</span></label>
                                <input type="date" className="form-control form-control-sm" value={form.contractDate} onChange={e => patchForm({ contractDate: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">決済予定日</label>
                                <input type="date" className="form-control form-control-sm" value={form.settleDate} onChange={e => patchForm({ settleDate: e.target.value })} /></div>
                            <div className="col-md-3"><label className="form-label mb-0 text-muted fw-bold">フォロー期日</label>
                                <input type="date" className="form-control form-control-sm" value={form.followDate} onChange={e => patchForm({ followDate: e.target.value })} /></div>
                            <div className="col-12"><label className="form-label mb-0 text-muted fw-bold">備考</label>
                                <input className="form-control form-control-sm" value={form.note} onChange={e => patchForm({ note: e.target.value })} /></div>

                            <div className="col-12 border-top pt-2 mt-2 fw-bold">🔧 リフォーム受注（この商談に付随する工事）
                                <div className="fw-normal text-muted" style={{ fontSize: '11px' }}>未受注なら空欄のままで構いません。<b>売上に計上されるのは「粗利」のみ</b>で、受注金額は粗利率を見るための参考値です。</div></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">リフォーム受注金額(円)</label>
                                <input type="number" min={0} className="form-control form-control-sm" value={form.reformPrice} placeholder="0" onChange={e => patchForm({ reformPrice: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">リフォーム粗利(円)</label>
                                <input type="number" className="form-control form-control-sm" value={form.reformGp} placeholder="0" onChange={e => patchForm({ reformGp: e.target.value })} />
                                {Number(form.reformPrice) > 0 && <div className="text-muted" style={{ fontSize: '10px' }}>粗利率 {pct((Number(form.reformGp) || 0) / Number(form.reformPrice))}</div>}</div>
                            <div className="col-md-4"><label className="form-label mb-0 text-muted fw-bold">リフォーム内容・備考</label>
                                <input className="form-control form-control-sm" value={form.reformNote} placeholder="外壁塗装・水回り交換 など" onChange={e => patchForm({ reformNote: e.target.value })} /></div>
                        </div>
                    </Modal.Body>
                )}
                <Modal.Footer>
                    <button className="btn btn-outline-danger btn-sm me-auto" onClick={() => void deleteDeal()}>削除</button>
                    <button className="btn btn-light border btn-sm" onClick={() => setForm(null)}>キャンセル</button>
                    <button className="btn btn-primary btn-sm fw-bold" onClick={() => void saveForm()}>保存</button>
                </Modal.Footer>
            </Modal>

            <DocumentViewer documentShow={documentShow} setDocumentShow={setDocumentShow} initialData={docData} />
            <PlannerGenerator plannerShow={plannerShow} setPlannerShow={setPlannerShow} initialData={plannerData} />
        </div>
    );
};

export default LeadOpportunity;
