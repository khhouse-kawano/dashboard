import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { errorText, landGet, landPost, mapUrlOf, fmtNum, type LandDeal, type LandMaster, type LandVendor } from './landApi';
import { DueBadge, Field, MapLink, MemberSelect } from './LandParts';
import { REPLY_CLASS, STATUS_CLASS } from './landStyle';
import { m2ToTsubo, replyLevel, simMaxOffer, tsuboUnitOf, daysUntil, replyPending, TSUBO_M2 } from './landLogic';

/**
 * 仕入案件の登録・編集（v2.2.311。移行元の openDealModal）。
 *
 * ⚠️ 区分は移行元と同じ：基本／情報提供業者・仕入条件／事業収支シミュレーション（土地買付上限）／買付の返答管理／見送り・失注の記録。
 * ⚠️ 保存は ② の land:deal_save。⚠️ ステータスを変えると、② が日付などを埋める（買付なら返答期日＝買付日＋既定の日数）。
 * ⚠️ 業者名がマスタに無ければ、② が業者を作る。
 * ⚠️ 資料（図面など）の添付は v2.2.313 で移す（今は移行元のアプリで見る）。
 */

type Form = Partial<LandDeal>;
export interface DealPreset { memberId?: number | null; vendorId?: number | null; vendorName?: string; address?: string; mapUrl?: string; landM2?: number | null; apId?: number; memo?: string }

const toInput = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const LandDealModal = ({ show, dealId, preset, master, onClose, onSaved }: {
    show: boolean; dealId: number | null; preset?: DealPreset; master: LandMaster;
    onClose: () => void; onSaved: (deal: LandDeal | null) => void;
}) => {
    const [form, setForm] = useState<Form>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [vendorHits, setVendorHits] = useState<LandVendor[]>([]);
    const today = master.today;

    useEffect(() => {
        if (!show) return;
        setError('');
        if (dealId === null) {
            setForm({
                memberId: preset?.memberId ?? master.meMemberId, kind: master.options.deal_kind?.[0] ?? '新規開拓', status: '情報取得', infoDate: today,
                vendorId: preset?.vendorId ?? null, vendorName: preset?.vendorName ?? '', address: preset?.address ?? '', mapUrl: preset?.mapUrl ?? '',
                landM2: preset?.landM2 ?? null, apId: preset?.apId ?? null, memo: preset?.memo ?? '', lots: 0,
                simExpenseRate: 5, simProfitRate: 15,
            });
            return;
        }
        setLoading(true);
        landGet<{ deal: LandDeal }>('land_deal_get', { id: dealId })
            .then((r) => setForm(r.deal))
            .catch((e) => setError(errorText(e, '案件を読み込めませんでした。')))
            .finally(() => setLoading(false));
    }, [show, dealId, preset, master, today]);

    // 業者名の候補（⚠️ 入れた文字で業者マスタを探す。300ms 待つ）
    const vname = form.vendorName ?? '';
    useEffect(() => {
        if (!show || vname.trim().length < 1) { setVendorHits([]); return; }
        const t = window.setTimeout(() => {
            landGet<{ rows: LandVendor[] }>('land_vendor_list', { q: vname.trim(), limit: 10, sort: 'name', dir: 'asc' })
                .then((r) => setVendorHits(r.rows)).catch(() => setVendorHits([]));
        }, 300);
        return () => window.clearTimeout(t);
    }, [show, vname]);

    const set = <K extends keyof LandDeal>(k: K, v: LandDeal[K] | null) => setForm((f) => ({ ...f, [k]: v }));
    const setNum = (k: keyof LandDeal) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value === '' ? null : e.target.value) as never);
    const setStr = (k: keyof LandDeal) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

    const maxOffer = useMemo(() => simMaxOffer(form), [form]);
    const unit = useMemo(() => tsuboUnitOf(form), [form]);
    const level = form.status ? replyLevel({ status: form.status, replyResult: form.replyResult ?? '', replyDue: form.replyDue ?? null }, today, master.settings.warnDays) : 'done';
    const isLost = form.status === '見送り' || form.replyResult === '否決';

    const save = async () => {
        if (!form.memberId) { setError('担当者を選んでください。'); return; }
        setSaving(true); setError('');
        try {
            const body: Record<string, unknown> = {};
            const keys: (keyof LandDeal)[] = ['memberId', 'kind', 'vendorName', 'address', 'mapUrl', 'lots', 'landM2', 'price', 'sellerName', 'agentName', 'buyPrice',
                'terms', 'termsMemo', 'status', 'infoDate', 'propDate', 'offerDate', 'contractDate', 'settleDate', 'memo', 'simSales', 'simBuild', 'simDemolition',
                'simExpenseRate', 'simProfitRate', 'offerTo', 'replyDue', 'replyResult', 'replyDate', 'replyMemo', 'lostReason', 'lostMemo', 'apId', 'sourceId'];
            for (const k of keys) if (form[k] !== undefined) body[k] = form[k] ?? '';
            // ⚠️ 候補から選んだ業者（か、開いたときの業者のまま）のときだけ id を送る。名前を書き換えると id は消える（② が名前で探す・作る）
            if (form.vendorId) body.vendorId = form.vendorId;
            if (dealId !== null) body.id = dealId;
            const r = await landPost<{ deal: LandDeal }>('deal_save', body);
            onSaved(r.deal);
        } catch (e) {
            setError(errorText(e, '保存できませんでした。通信の状態を確かめて、もう一度お試しください。'));
        } finally { setSaving(false); }
    };
    const remove = async () => {
        if (dealId === null || !window.confirm(`${form.vendorName || 'この案件'} を削除します。よろしいですか？`)) return;
        setSaving(true);
        try { await landPost('deal_delete', { id: dealId }); onSaved(null); } catch (e) { setError(errorText(e, '削除できませんでした。')); } finally { setSaving(false); }
    };

    const opt = (key: string) => master.options[key] ?? [];
    const date = (k: keyof LandDeal) => <input type="date" className="ld_input" value={toInput(form[k])} onChange={setStr(k)} />;
    const pending = form.status ? replyPending({ status: form.status, replyResult: form.replyResult ?? '' }) : false;

    return (
        <Modal show={show} onHide={onClose} size="xl" scrollable>
            <style>{'.ld_modal .modal-body { font-size: 13px; }'}</style>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: 15, fontWeight: 700 }}>{dealId === null ? '案件を登録' : '案件の詳細・編集'}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="ld_modal">
                {error !== '' && <div className="ld_error mb-2">{error}</div>}
                {loading ? <div className="ld_note">読み込み中…</div> : (
                    <>
                        <div className="ld_grid">
                            <Field label="担当者"><MemberSelect master={master} value={form.memberId ?? null} onChange={(v) => set('memberId', v)} /></Field>
                            <Field label="案件種別">
                                <select className="ld_select" value={form.kind ?? ''} onChange={setStr('kind')}>{opt('deal_kind').map((v) => <option key={v}>{v}</option>)}</select>
                            </Field>
                            <Field label="情報取得元の業者名">
                                <input className="ld_input" list="ld_vendor_hits" value={form.vendorName ?? ''} placeholder="マスタから選ぶか、新しい名前を入れる"
                                    onChange={(e) => { const v = e.target.value; const h = vendorHits.find((x) => x.name === v); setForm((f) => ({ ...f, vendorName: v, vendorId: h ? h.id : null })); }} />
                                <datalist id="ld_vendor_hits">{vendorHits.map((v) => <option key={v.id} value={v.name}>{v.vkind}</option>)}</datalist>
                            </Field>
                            {master.sources.length > 0 && (
                                <Field label="反響ソース">
                                    <select className="ld_select" value={form.sourceId ?? ''} onChange={(e) => set('sourceId', e.target.value === '' ? null : Number(e.target.value))}>
                                        <option value="">（なし）</option>
                                        {master.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </Field>
                            )}
                            <Field label="物件所在地" full>
                                <div className="d-flex align-items-center gap-1">
                                    <input className="ld_input flex-grow-1" value={form.address ?? ''} onChange={setStr('address')} />
                                    <MapLink url={mapUrlOf(form.address ?? '', form.mapUrl ?? '')} />
                                </div>
                            </Field>
                            <Field label="地図リンク（空なら所在地から作る。ピンの URL を貼ってもよい）" full>
                                <input className="ld_input" value={form.mapUrl ?? ''} onChange={setStr('mapUrl')} placeholder="https://www.google.com/maps/…" />
                            </Field>
                            <Field label="区画数"><input type="number" min={0} className="ld_input" value={toInput(form.lots)} onChange={setNum('lots')} /></Field>
                            <Field label={`土地面積（㎡）${m2ToTsubo(form.landM2) !== null ? `＝ ${m2ToTsubo(form.landM2)} 坪` : ''}`}>
                                <input type="number" min={0} step="0.01" className="ld_input" value={toInput(form.landM2)} onChange={setNum('landM2')} />
                            </Field>
                            <Field label="土地面積（坪で入れる）">
                                <input type="number" min={0} step="0.01" className="ld_input" placeholder="坪で入れると㎡に直す"
                                    onChange={(e) => set('landM2', e.target.value === '' ? null : Math.round(Number(e.target.value) * TSUBO_M2 * 100) / 100)} />
                            </Field>
                            <Field label="想定仕入価格（万円・任意）"><input type="number" className="ld_input" value={toInput(form.price)} onChange={setNum('price')} /></Field>
                        </div>

                        <div className="ld_section">
                            <div className="ld_section_title">ステータス・日付</div>
                            <div className="ld_grid">
                                <Field label="ステータス">
                                    <select className={`ld_select ld_pill ${STATUS_CLASS[form.status ?? ''] ?? ''}`} value={form.status ?? ''} onChange={setStr('status')}>
                                        {master.statuses.map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                </Field>
                                <Field label="情報取得日">{date('infoDate')}</Field>
                                <Field label="社長提案日">{date('propDate')}</Field>
                                <Field label="買付日">{date('offerDate')}</Field>
                                <Field label="契約日（現場）">{date('contractDate')}</Field>
                                <Field label="決済日（ゴール）">{date('settleDate')}</Field>
                                <Field label="概要メモ" full><textarea className="ld_textarea" value={form.memo ?? ''} onChange={setStr('memo')} /></Field>
                            </div>
                            <div className="ld_note mt-1">ステータスを進めて保存すると、空いている日付に今日が入ります（買付にすると、返答期日に買付日の{master.settings.leadDays}日後が入ります）。</div>
                        </div>

                        <div className="ld_section">
                            <div className="ld_section_title">情報提供業者・仕入条件</div>
                            <div className="ld_grid">
                                <Field label="売主名"><input className="ld_input" value={form.sellerName ?? ''} onChange={setStr('sellerName')} /></Field>
                                <Field label="媒介業者名"><input className="ld_input" value={form.agentName ?? ''} onChange={setStr('agentName')} /></Field>
                                <Field label="購入金額（仕入金額・万円）"><input type="number" className="ld_input" value={toInput(form.buyPrice)} onChange={setNum('buyPrice')} /></Field>
                                <Field label="坪単価（自動で計算）"><div className="ld_kpi_value" style={{ fontSize: 15 }}>{unit === null ? '—' : `${unit} 万円/坪`}</div></Field>
                                <Field label="契約条件">
                                    <select className="ld_select" value={form.terms ?? ''} onChange={setStr('terms')}>
                                        <option value="">（なし）</option>{opt('deal_terms').map((v) => <option key={v}>{v}</option>)}
                                    </select>
                                </Field>
                                <Field label="契約条件の補足"><input className="ld_input" value={form.termsMemo ?? ''} onChange={setStr('termsMemo')} /></Field>
                            </div>
                        </div>

                        <div className="ld_section">
                            <div className="ld_section_title">事業収支シミュレーション（土地買付上限）</div>
                            <div className="ld_grid">
                                <Field label="想定総販売価格（万円）"><input type="number" className="ld_input" value={toInput(form.simSales)} onChange={setNum('simSales')} placeholder="例）12000" /></Field>
                                <Field label="想定建築費（万円）"><input type="number" className="ld_input" value={toInput(form.simBuild)} onChange={setNum('simBuild')} placeholder="例）7200" /></Field>
                                <Field label="予想解体・造成費（万円）"><input type="number" className="ld_input" value={toInput(form.simDemolition)} onChange={setNum('simDemolition')} placeholder="例）450" /></Field>
                                <Field label="諸経費率（%）"><input type="number" className="ld_input" value={toInput(form.simExpenseRate)} onChange={setNum('simExpenseRate')} /></Field>
                                <Field label="目標利益率（%）"><input type="number" className="ld_input" value={toInput(form.simProfitRate)} onChange={setNum('simProfitRate')} /></Field>
                                <Field label="買付上限額">
                                    <div className="ld_kpi_value" style={{ fontSize: 17, color: maxOffer !== null && maxOffer < 0 ? '#b91c1c' : undefined }}>{maxOffer === null ? '—' : `${fmtNum(maxOffer, 1)} 万円`}</div>
                                </Field>
                            </div>
                            <div className="ld_note mt-1">買付上限額 ＝ 想定総販売価格 −（想定建築費 ＋ 予想解体・造成費）− 想定総販売価格 ×（諸経費率 ＋ 目標利益率）</div>
                            {maxOffer !== null && (
                                <button className="ld_btn is_sm mt-1" type="button" onClick={() => set('price', maxOffer)}>この額を想定仕入価格に入れる</button>
                            )}
                        </div>

                        <div className="ld_section">
                            <div className="ld_section_title d-flex align-items-center gap-2">
                                買付の返答管理
                                {pending && <DueBadge level={level} days={daysUntil(form.replyDue, today)} />}
                                {form.replyResult && <span className={`ld_pill ${REPLY_CLASS[form.replyResult] ?? ''}`}>{form.replyResult}</span>}
                            </div>
                            <div className="ld_grid">
                                <Field label="買付提出先（返答をもらう相手）"><input className="ld_input" value={form.offerTo ?? ''} onChange={setStr('offerTo')} /></Field>
                                <Field label="返答期日">{date('replyDue')}</Field>
                                <Field label="返答結果">
                                    <select className="ld_select" value={form.replyResult ?? ''} onChange={setStr('replyResult')}>
                                        <option value="">返答待ち</option>{opt('reply_result').map((v) => <option key={v}>{v}</option>)}
                                    </select>
                                </Field>
                                <Field label="回答日">{date('replyDate')}</Field>
                                <Field label="返答メモ" full><input className="ld_input" value={form.replyMemo ?? ''} onChange={setStr('replyMemo')} /></Field>
                            </div>
                        </div>

                        <div className="ld_section">
                            <div className="ld_section_title">見送り・失注の記録{isLost && !form.lostReason && <span className="ld_badge is_warn ms-2">理由が未登録</span>}</div>
                            <div className="ld_grid">
                                <Field label="失注理由（カテゴリ）">
                                    <select className="ld_select" value={form.lostReason ?? ''} onChange={setStr('lostReason')}>
                                        <option value="">（未登録）</option>{opt('lost_reason').map((v) => <option key={v}>{v}</option>)}
                                    </select>
                                </Field>
                                <Field label="失注の詳細メモ" full><input className="ld_input" value={form.lostMemo ?? ''} onChange={setStr('lostMemo')} /></Field>
                            </div>
                            <div className="ld_note mt-1">ステータスが「見送り」か、買付の返答が「否決」の案件で集計します。</div>
                        </div>
                        {dealId !== null && (
                            <div className="ld_note mt-3">登録：{form.createdBy || '—'}　更新：{form.updatedBy || '—'}（{form.updatedAt ?? ''}）</div>
                        )}
                    </>
                )}
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-start gap-2">
                <button className="ld_btn is_primary" disabled={saving || loading} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button>
                <button className="ld_btn" disabled={saving} onClick={onClose}>閉じる</button>
                {dealId !== null && <button className="ld_btn is_danger ms-auto" disabled={saving} onClick={() => void remove()}>削除</button>}
            </Modal.Footer>
        </Modal>
    );
};

export default LandDealModal;
