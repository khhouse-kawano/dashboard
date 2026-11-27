import React, { useContext, useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import { PropertyBasicInfo, PropertyMap, PropertyPvSummary, propertyPvOf } from './propertyParts';
import PortalDetailModal, { type PortalDetail } from './PortalDetailModal';
import LeadEdit from '../realty/common/LeadEdit';
import { loadRecords } from '../realty/common/realtyState';
import { isSoftDeleted, recordFieldChanges, saveBrokerageRecord } from '../realty/common/leadUtiles';
import { DSK_KIND } from '../realty/summary/mediaKpi';
import type { Row } from '../realty/summary/kpi';

/**
 * 媒介獲得台帳の「物件の状況」（v2.2.307。PropertyRegister.tsx のタブ。DatabaseBroker.tsx から開いたときだけ）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 出すのは、いえらぶと連携済み（台帳の property_db_id がある）・保存済みの台帳だけ（PropertyRegister 側で判定）。
 * ⚠️ 物件は ② の property_detail（GET）。② に届かないときは今までの property:detail（POST）。⚠️ PropertySummary.tsx と同じ読み方。
 * ⚠️ 基本情報・PVサマリ・地図は propertyParts.tsx（物件の詳細と同じ部品）。PV は物件DB と同じ式で、数字を押すと掲載サマリ（PortalDetailModal.tsx）。
 * ⚠️ 報告書作成は、この画面を閉じて物件の詳細（PropertySummary.tsx）を報告書の編集から開く（onOpenReport）。
 *   ⚠️ 報告書の印刷は「.modal 以外を隠す」作りなので、この画面（モーダル）の中では印刷しない。
 * ⚠️ 買い反響は brokerage_listings の kind = buyLeads で、ledgerId がこの台帳の id のもの（自動の紐付け ieloveMatch.ts・手での紐付け LeadEdit.tsx）。
 *   ⚠️ 物件名では結ばない（realty-handoff.md の決まり）。
 * ⚠️ 歩留まりの段は買い反響の一覧・チームサマリーと同じ（realty/summary/mediaKpi.ts の DSK_KIND.buy.steps。⚠️ ここで段の定義を書かない）。
 * ⚠️ 顧客の編集は買い反響の顧客画面（LeadEdit。leadCategory = buy）。保存は買い反響の一覧（LeadBuy.tsx の handleApiPatch）と同じ。
 * ─────────────────────────────────────────────
 */

type Props = {
    /** 台帳の id（brokerage_listings.id。買い反響の ledgerId） */
    ledgerId: string;
    /** いえらぶの物件番号（台帳の property_db_id ＝ property_db.property_id） */
    propertyDbId: string;
    /** 担当営業の選択肢（LeadEdit に渡す） */
    staffList: string[];
    /** 報告書作成（この画面を閉じて、物件の詳細を報告書の編集から開く） */
    onOpenReport: () => void;
};

const BUY = DSK_KIND.buy;
/** 段ごとに、その段に着いた日として出す列（⚠️ 日付の無い段は ✓ だけ） */
const STEP_DATE: Record<string, string> = { leads: 'receivedDate', connects: 'connectDate', views: 'viewDate', offers: 'applicationDate', wins: 'contractDate' };
/** 段に達しているか（⚠️ 最初の段＝反響は全員） */
const reached = (l: Row, k: string): boolean => {
    const step = BUY.steps.find((s) => s.k === k);
    return !step?.f || step.f(l);
};
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '—');

const CSS = `
.lps_funnel { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.lps_step { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; text-align: left; cursor: pointer; font: inherit; }
.lps_step:hover:not(:disabled) { border-color: #5e72e4; box-shadow: 0 1px 4px rgba(94,114,228,.18); }
.lps_step:focus-visible { outline: 2px solid #5e72e4; outline-offset: 1px; }
.lps_step:disabled { cursor: default; opacity: .65; }
.lps_step_label { font-size: 11px; color: #718096; font-weight: 700; }
.lps_step_value { font-size: 20px; font-weight: 700; color: #2d3748; line-height: 1.2; font-variant-numeric: tabular-nums; }
.lps_step_rate { font-size: 10px; color: #0f766e; font-weight: 700; font-variant-numeric: tabular-nums; }
.lps_list th { background: #f8f9fa; color: #718096; font-weight: 500; white-space: nowrap; font-size: 11px; }
.lps_list td { font-size: 12px; white-space: nowrap; vertical-align: middle; }
.lps_date { color: #2f855a; font-weight: 700; font-variant-numeric: tabular-nums; }
.lps_note { font-size: 11px; color: #6b7280; }
`;

const LedgerPropertyStatus = ({ ledgerId, propertyDbId, staffList, onOpenReport }: Props) => {
    const { userName } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [property, setProperty] = useState<Record<string, any> | null>(null);
    const [portalRows, setPortalRows] = useState<{ suumo: any; homes: any; athome: any }>({ suumo: null, homes: null, athome: null });
    const [leads, setLeads] = useState<Row[]>([]);
    const [portal, setPortal] = useState<PortalDetail | null>(null);
    /** 一覧を開いている段（null なら閉じている） */
    const [listStep, setListStep] = useState<string | null>(null);
    const [editing, setEditing] = useState<Row | null>(null);
    const [customerInfo, setCustomerInfo] = useState<any>({});

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                let detail;
                try {
                    detail = await apiClient.get('', { params: { request: 'property_detail', id: propertyDbId } });
                    if (detail?.data?.status !== 'success') throw new Error('invalid property_detail response');
                } catch (e) {
                    console.error('property_detail に失敗しました。今までの読み込みに切り替えます:', e);
                    detail = await apiClient.post('', { request: 'property', roll: 'detail', id: propertyDbId });
                }
                const { records } = await loadRecords(['buyLeads']);
                if (cancelled) return;
                setProperty(detail.data?.property ?? null);
                setPortalRows({ suumo: detail.data?.suumo ?? null, homes: detail.data?.homes ?? null, athome: detail.data?.athome ?? null });
                setLeads((records.buyLeads ?? []).filter((l) => text(l.ledgerId) === ledgerId && !isSoftDeleted(l)));
            } catch (e) {
                if (cancelled) return;
                console.error('物件の状況の読み込みに失敗しました', e);
                setError('物件の状況を読み込めませんでした。時間をおいて開き直してください。');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        // ⚠️ setTimeout(0) で1回にまとめる（StrictMode で effect が2回走ったときに2回読まない）
        const timer = window.setTimeout(() => { void load(); }, 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [ledgerId, propertyDbId]);

    const pv = useMemo(() => propertyPvOf(portalRows.suumo, portalRows.homes, portalRows.athome), [portalRows]);
    /** 段ごとの人数（⚠️ 最初の段＝反響の数） */
    const counts = useMemo(() => Object.fromEntries(BUY.steps.map((s) => [s.k, leads.filter((l) => reached(l, s.k)).length])), [leads]);
    /** 一覧に出す反響（新しい反響日から） */
    const listRows = useMemo(() => (listStep === null ? [] : leads
        .filter((l) => reached(l, listStep))
        .sort((a, b) => text(b.receivedDate).localeCompare(text(a.receivedDate)))), [leads, listStep]);

    const openEdit = (l: Row) => {
        setEditing(l);
        setCustomerInfo({ ...l });
    };
    /** 保存（⚠️ 買い反響の一覧 LeadBuy.tsx の handleApiPatch と同じ。id は送らない。保存できてから履歴を残す） */
    const saveEdit = async () => {
        if (!editing) return;
        const id = text(editing.id);
        const { id: _omit, ...fields } = customerInfo as Row;
        try {
            await saveBrokerageRecord(id, fields);
            await recordFieldChanges({
                entity: 'buy', entityId: id, entityNo: null,
                label: text(editing.name) || text(editing.targetProperty) || id,
                before: editing, after: fields, by: userName || '不明',
            });
            setLeads((prev) => prev.map((l) => (text(l.id) === id ? { ...l, ...fields } : l)));
            setEditing(null);
        } catch (e) {
            console.error('[LedgerPropertyStatus] 保存に失敗しました', e);
            alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
        }
    };

    if (loading) return <div className="text-center text-muted py-5"><span className="spinner-border spinner-border-sm me-2"></span>物件の状況を読み込んでいます…</div>;
    if (error) return <div className="alert alert-danger mb-0" style={{ fontSize: '13px' }}>{error}</div>;

    const stepLabel = BUY.steps.find((s) => s.k === listStep)?.label ?? '';

    return (
        <>
            <style>{CSS}</style>
            <div className="d-flex align-items-center justify-content-between mb-2 px-1 gap-2 flex-wrap">
                <span className="text-muted" style={{ fontSize: '12px' }}>
                    <i className="bi bi-building me-1" style={{ color: '#a0aec0' }}></i>
                    {property?.property_name || '—'}（いえらぶ No.{propertyDbId}）
                </span>
                <button type="button" className="btn btn-sm btn-primary shadow-sm rounded-pill px-3 fw-bold" onClick={onOpenReport} disabled={!property}>
                    <i className="bi bi-file-earmark-pdf-fill me-1"></i>報告書作成
                </button>
            </div>
            {!property && <div className="alert alert-warning py-2" style={{ fontSize: '12px' }}>いえらぶの物件（No.{propertyDbId}）が物件DB にありません。基本情報・閲覧数は出せません。</div>}
            <div className="row g-3">
                {property && <div className="col-12"><PropertyBasicInfo property={property} /></div>}
                {property && (
                    <div className="col-12">
                        <PropertyPvSummary pv={pv} onPortal={setPortal} suumo={portalRows.suumo} homes={portalRows.homes} athome={portalRows.athome} />
                    </div>
                )}

                <div className="col-12">
                    <div className="card shadow-sm border-0 rounded-3">
                        <div className="card-header bg-white border-bottom-0 pt-3 pb-1 d-flex align-items-baseline gap-2">
                            <h6 className="fw-bold mb-0" style={{ fontSize: '13px', color: '#4a5568' }}>買い反響の歩留まり</h6>
                            <span className="lps_note">この物件につながった買い反響 {counts.leads ?? 0} 件</span>
                        </div>
                        <div className="card-body pt-2 pb-3 px-3">
                            <div className="lps_funnel">
                                {BUY.steps.map((s, i) => {
                                    const n = counts[s.k] ?? 0;
                                    return (
                                        <button key={s.k} type="button" className="lps_step" disabled={n === 0} onClick={() => setListStep(s.k)}
                                            aria-label={`${s.label} ${n}人の一覧を開く`}>
                                            <div className="lps_step_label">{s.label}</div>
                                            <div className="lps_step_value">{n}</div>
                                            <div className="lps_step_rate">{i === 0 ? '　' : `反響の ${pct(n, counts.leads ?? 0)}`}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="lps_note mt-2">数字を押すと、その段に着いたお客様の一覧が開きます。段の数え方は買い反響の一覧と同じです（期間で区切らず、この物件のすべての買い反響）。</div>
                        </div>
                    </div>
                </div>

                {property?.lat_lng && <div className="col-12"><PropertyMap latLng={property.lat_lng} /></div>}
            </div>

            <PortalDetailModal portal={portal} onClose={() => setPortal(null)} />

            {/* ⚠️ 指示どおり md（size を付けない）。列が多いので表は横に動かせる（table-responsive） */}
            <Modal show={listStep !== null && editing === null} onHide={() => setListStep(null)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title style={{ fontSize: '15px', fontWeight: 'bold', color: '#495057' }}>
                        買い反響：{stepLabel}（{listRows.length}人）
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-2">
                    <div className="table-responsive">
                        <table className="table table-sm table-hover mb-0 lps_list">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>反響日</th>
                                    <th>顧客名</th>
                                    <th>担当営業</th>
                                    {BUY.steps.slice(1).map((s) => <th key={s.k} className="text-center">{s.label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {listRows.map((l) => (
                                    <tr key={text(l.id)}>
                                        <td>
                                            <button type="button" className="btn btn-sm btn-outline-primary py-0 px-2" style={{ fontSize: '11px' }} onClick={() => openEdit(l)}>編集</button>
                                        </td>
                                        <td>{text(l.receivedDate) || '—'}</td>
                                        <td>{text(l.name) || '—'}</td>
                                        <td>{text(l.staff) || '—'}</td>
                                        {BUY.steps.slice(1).map((s) => (
                                            <td key={s.k} className="text-center">
                                                {reached(l, s.k) ? <span className="lps_date">{text(l[STEP_DATE[s.k] ?? '']) || '✓'}</span> : ''}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="lps_note mt-2">段に着いていれば、その日（日付の記録が無い段は ✓）を出します。</div>
                </Modal.Body>
            </Modal>

            <LeadEdit
                isOpen={editing !== null}
                onClose={() => setEditing(null)}
                onSave={() => { void saveEdit(); }}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                leadCategory="buy"
                staffList={staffList}
            />
        </>
    );
};

export default LedgerPropertyStatus;
