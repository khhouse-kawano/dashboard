import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { loadRecords } from './realtyState';
import { safeParse } from './leadUtiles';
import { BUYER_ATTRS, guessProperty, isOwnStock, registerBuyOffer, unlinkBuyOffer } from './leadLinks';
import type { BuyOfferInput, CoBroker } from './leadLinks';
import { fmtYen, stdFee } from '../summary/kpi';
import type { Row, StaffSetting } from '../summary/kpi';

/**
 * 媒介獲得台帳の「買付登録」（v2.2.246 新規）。以前のアプリ v14.29 の openCoBroker / saveCoBroker と同じ入力・同じ確かめ方。
 *
 * ─────────────────────────────────────────────
 *   他社客付け … 客付け会社が必須。商談案件「売」を1件（自社は売主側の片手）
 *   自社客付け … 買い反響から買主を選ぶ。商談案件「売」「買」の2件（両手）
 *   作ったら台帳の現況を「買付有」にし、台帳に案件をつなぐ（common/leadLinks.ts の registerBuyOffer）
 *
 * ⚠️ 案件につながっている台帳では、登録の代わりに案件の No. と「連携を解除」を出す（二重に作らない）。
 * ⚠️ 自社が売主（媒介種別が買取・売主が自社名義）の物件は、仲介手数料を計上しない（既定で印が付く）。
 * ─────────────────────────────────────────────
 */

type Props = {
    /** 対象の台帳（null は閉じている） */
    ledger: Row | null;
    staffSettings: StaffSetting[];
    userName: string;
    onClose: () => void;
    /** 登録・解除したあと。台帳に保存した値を返す（一覧を直すため） */
    onSaved: (ledgerId: string, ledgerFields: Row) => void;
};

const str = (v: unknown): string => (v == null ? '' : String(v));
/** 台帳の coBroker（⚠️ DB からは JSON の文字列で届くことがある） */
const coBrokerOf = (v: unknown): Partial<CoBroker> | null => {
    const o = typeof v === 'string' ? safeParse(v) : v;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Partial<CoBroker>) : null;
};
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: 0 };

const BuyOfferModal = ({ ledger, staffSettings, userName, onClose, onSaved }: Props) => {
    const [deals, setDeals] = useState<Row[]>([]);
    const [buyLeads, setBuyLeads] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<BuyOfferInput | null>(null);
    const [leadId, setLeadId] = useState('');
    const [leadQ, setLeadQ] = useState('');
    const [showLost, setShowLost] = useState(false);

    const staffNames = useMemo(() => staffSettings.map(s => str(s.name)).filter(Boolean), [staffSettings]);

    useEffect(() => {
        if (!ledger) return;
        const cb = coBrokerOf(ledger.coBroker) ?? {};
        const abbr = str(ledger.staff);
        setForm({
            kind: 'out', company: str(cb.company), person: str(cb.person), contact: str(cb.contact),
            price: Number(cb.price) || Number(ledger.price) || 0, contractDate: str(cb.contractDate), deliveryDate: str(cb.deliveryDate),
            buyerName: str(cb.buyerName), buyerAttr: str(cb.buyerAttr) || BUYER_ATTRS[0], property: guessProperty(ledger),
            staff: staffSettings.find(s => s.abbr === abbr)?.name ?? '', noFee: isOwnStock(ledger), note: str(cb.note),
        });
        setLeadId(''); setLeadQ(''); setShowLost(false);
        setLoading(true);
        loadRecords(['deals', 'buyLeads'])
            .then(({ records }) => { setDeals(records.deals); setBuyLeads(records.buyLeads); })
            .catch(e => { console.error('[BuyOfferModal] 読み込みに失敗しました', e); alert('商談案件・買い反響を読み込めませんでした。'); onClose(); })
            .finally(() => setLoading(false));
    }, [ledger, staffSettings, onClose]);

    const linked = ledger ? deals.find(d => str(d.id) === str(ledger.dealId)) : undefined;
    const dangling = !!ledger && str(ledger.dealId) !== '' && !linked && !loading;

    /** 買主の候補（自社客付け）。名前・ポータル・問合せ物件・台帳No. で探す。⚠️ 追客終了は印を付けたときだけ */
    const leadOptions = useMemo(() => {
        const q = leadQ.trim();
        return buyLeads
            .filter(b => showLost || str(b.phase) !== '追客終了')
            .filter(b => !q || [b.name, b.portal, b.targetProperty, b.contact, b.ledgerNo].some(v => str(v).includes(q)))
            .sort((a, b) => str(b.receivedDate).localeCompare(str(a.receivedDate)))
            .slice(0, 30);
    }, [buyLeads, leadQ, showLost]);
    const selectedLead = buyLeads.find(b => str(b.id) === leadId) ?? null;

    if (!ledger || !form) return null;
    const set = (p: Partial<BuyOfferInput>) => setForm(prev => (prev ? { ...prev, ...p } : prev));
    const own = form.kind === 'own';
    const ledNo = str(ledger.no) || '―';

    const save = async () => {
        if (busy) return;
        const inp: BuyOfferInput = { ...form, company: form.company.trim(), property: form.property.trim(), buyerName: form.buyerName.trim() };
        const miss: string[] = [];
        if (own) {
            if (!selectedLead) { alert('買主となる買い反響を選んでください。'); return; }
            const bd = deals.find(d => str(d.id) === str(selectedLead.dealId));
            if (bd && !window.confirm(`この買い反響は、既に商談案件 No.${str(bd.no)}「${str(bd.property)}」（${str(bd.phase)}）につながっています。\nこのまま登録すると、買い反響のつながりが新しく作る「買」案件に置き換わります（No.${str(bd.no)} は消えません）。続けますか？`)) return;
            if (str(selectedLead.phase) === '追客終了' && !window.confirm('この買い反響は「追客終了」です。買付登録して商談案件を作りますか？')) return;
            if (str(selectedLead.ledgerId) && str(selectedLead.ledgerId) !== str(ledger.id) && !window.confirm(`この買い反響は、別の物件（台帳No.${str(selectedLead.ledgerNo) || '―'}）につながっています。\n台帳No.${ledNo} の買付として登録しますか？（買い反響側のつながり先は変えません）`)) return;
            inp.company = '';
            if (!inp.buyerName) inp.buyerName = str(selectedLead.name);
            if (!inp.staff) inp.staff = str(selectedLead.staff);
        } else if (!inp.company) {
            miss.push('客付け会社名');
        }
        if (!inp.price) miss.push('買付金額');
        if (!inp.property) miss.push('物件名');
        if (miss.length) { alert(`未入力の項目があります：${miss.join('・')}`); return; }
        if (inp.contractDate && inp.deliveryDate && inp.deliveryDate < inp.contractDate && !window.confirm('引渡希望日が契約希望日より前になっています。このまま登録しますか？')) return;
        const listPrice = Number(ledger.price) || 0;
        if (listPrice && inp.price < listPrice * 0.7 && !window.confirm(`買付金額が販売価格（${fmtYen(listPrice)}）を大きく下回っています。このまま登録しますか？`)) return;

        setBusy(true);
        try {
            const r = await registerBuyOffer(ledger, inp, own ? selectedLead : null, userName || '不明');
            onSaved(str(ledger.id), r.ledgerFields);
            alert(r.buyNo
                ? `商談案件 No.${r.sellNo}（売）・No.${r.buyNo}（買）を作り、台帳 No.${ledNo}・買い反響とつなぎました。\n商談案件管理で物件名・価格・担当を確かめてください。`
                : `商談案件 No.${r.sellNo} を作り、台帳 No.${ledNo} とつなぎました。\n商談案件管理で物件名・価格・担当を確かめてください。`);
            onClose();
        } catch (e) {
            console.error('[BuyOfferModal] 買付登録に失敗しました', ledger.id, e);
            alert('買付登録に失敗しました。商談案件管理で、途中まで作られた案件が無いか確かめてから、もう一度お試しください。');
        } finally {
            setBusy(false);
        }
    };

    const unlink = async () => {
        if (!window.confirm(`台帳 No.${ledNo} と商談案件のつながりを解除します。\n（商談案件そのものは消えません。必要なら商談案件管理で失注にしてください）\nよろしいですか？`)) return;
        setBusy(true);
        try {
            onSaved(str(ledger.id), await unlinkBuyOffer(ledger, userName || '不明'));
            alert('連携を解除しました。もう一度登録できます。');
            onClose();
        } catch (e) {
            console.error('[BuyOfferModal] 解除に失敗しました', ledger.id, e);
            alert('解除に失敗しました。もう一度お試しください。');
        } finally {
            setBusy(false);
        }
    };

    const cb = coBrokerOf(ledger.coBroker);

    return (
        <Modal show onHide={onClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>
                    {linked ? '⚠ 既に商談案件へ連携済みです' : `🤝 買付登録（台帳 No.${ledNo}）`}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ fontSize: '12px' }}>
                {loading ? (
                    <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
                ) : linked ? (
                    <div>
                        <p className="mb-2">台帳 No.{ledNo}（{str(ledger.seller)}）は、すでに <b>商談案件 No.{str(linked.no)}「{str(linked.property)}」</b>（{str(linked.phase)}）へ連携されています。</p>
                        {cb?.company && <p className="mb-2 text-muted">客付け：{cb.company}{cb.person ? `（${cb.person}）` : ''}／買主：{cb.buyerName || '―'}</p>}
                        <p className="text-muted mb-0">買付の条件は、商談案件管理で直してください。買付が白紙になったときは「連携を解除」してから、もう一度登録できます。</p>
                    </div>
                ) : (
                    <div className="row g-2">
                        <div className="col-12 text-muted">
                            売主：<b>{str(ledger.seller) || '（未入力）'}</b>／{str(ledger.baikaiType) || '媒介種別未設定'}／{str(ledger.addr1)}{str(ledger.addr2).split('http')[0].trim()}
                            {Number(ledger.price) ? `／販売価格 ${fmtYen(Number(ledger.price))}` : ''}
                        </div>
                        {dangling && <div className="col-12 text-danger">⚠ 以前につないだ商談案件が見つかりません。登録すると、新しい商談案件を作ってつなぎ直します。</div>}
                        <div className="col-12">
                            <div style={label}>客付け区分</div>
                            <select className="form-select form-select-sm" value={form.kind} onChange={e => set({ kind: e.target.value as 'out' | 'own' })}>
                                <option value="out">🤝 他社客付け（他社のお客様。自社は売主側の片手）</option>
                                <option value="own">🏠 自社客付け（自社の買い反響のお客様。両手）</option>
                            </select>
                        </div>
                        {own ? (
                            <div className="col-12">
                                <div style={label}>買主＝買い反響から選ぶ <span className="text-danger">*</span></div>
                                <div className="d-flex gap-2 align-items-center mb-1">
                                    <input className="form-control form-control-sm" placeholder="顧客名・ポータル・問合せ物件・台帳No. で探す" value={leadQ} onChange={e => setLeadQ(e.target.value)} />
                                    <label className="d-flex align-items-center gap-1 text-nowrap" style={{ cursor: 'pointer' }}>
                                        <input type="checkbox" checked={showLost} onChange={e => setShowLost(e.target.checked)} />追客終了も出す
                                    </label>
                                </div>
                                <select className="form-select form-select-sm" size={6} value={leadId} onChange={e => setLeadId(e.target.value)} aria-label="買い反響">
                                    {leadOptions.map(b => (
                                        <option key={str(b.id)} value={str(b.id)}>
                                            {str(b.receivedDate).slice(0, 10)}　{str(b.name) || '（名称なし）'}　{str(b.portal)}　{str(b.phase)}{str(b.dealId) ? '（案件連携済）' : ''}　{str(b.targetProperty)}
                                        </option>
                                    ))}
                                </select>
                                {selectedLead && <div className="text-muted mt-1">選択中：{str(selectedLead.name)}（担当 {str(selectedLead.staff) || '未割当'}）</div>}
                            </div>
                        ) : (
                            <>
                                <div className="col-md-4"><div style={label}>客付け会社名 <span className="text-danger">*</span></div>
                                    <input className="form-control form-control-sm" placeholder="○○不動産（株）" value={form.company} onChange={e => set({ company: e.target.value })} /></div>
                                <div className="col-md-4"><div style={label}>客付け担当者名</div>
                                    <input className="form-control form-control-sm" value={form.person} onChange={e => set({ person: e.target.value })} /></div>
                                <div className="col-md-4"><div style={label}>客付け連絡先（TEL・メール）</div>
                                    <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
                            </>
                        )}
                        <div className="col-md-4"><div style={label}>買付金額(円) <span className="text-danger">*</span></div>
                            <input type="number" className="form-control form-control-sm" value={form.price || ''} onChange={e => set({ price: Number(e.target.value) || 0 })} /></div>
                        <div className="col-md-4"><div style={label}>契約希望日（＝商談案件の契約日。月次売上の計上月）</div>
                            <input type="date" className="form-control form-control-sm" value={form.contractDate} onChange={e => set({ contractDate: e.target.value })} /></div>
                        <div className="col-md-4"><div style={label}>引渡（決済）希望日</div>
                            <input type="date" className="form-control form-control-sm" value={form.deliveryDate} onChange={e => set({ deliveryDate: e.target.value })} /></div>
                        <div className="col-md-4"><div style={label}>買主氏名{own ? '（空なら買い反響の名前）' : ''}</div>
                            <input className="form-control form-control-sm" value={form.buyerName} onChange={e => set({ buyerName: e.target.value })} /></div>
                        <div className="col-md-4"><div style={label}>買主属性</div>
                            <select className="form-select form-select-sm" value={form.buyerAttr} onChange={e => set({ buyerAttr: e.target.value })}>
                                {BUYER_ATTRS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select></div>
                        <div className="col-md-4"><div style={label}>自社担当者</div>
                            <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
                                <option value=""></option>
                                {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select></div>
                        <div className="col-12"><div style={label}>物件名（商談案件に入る） <span className="text-danger">*</span></div>
                            <input className="form-control form-control-sm" value={form.property} onChange={e => set({ property: e.target.value })} /></div>
                        <div className="col-12">
                            <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.noFee} onChange={e => set({ noFee: e.target.checked })} />仲介手数料を計上しない（自社が売主＝買取再販の物件）
                            </label>
                            <div className="text-muted">{form.noFee ? '自社が売主のため、仲介手数料は 0 円で登録します' : `仲介手数料（自動計算・税抜）：${fmtYen(stdFee(form.price))}`}</div>
                        </div>
                        <div className="col-12"><div style={label}>備考（買付条件・融資の利用・特約など）</div>
                            <input className="form-control form-control-sm" placeholder="ローン特約あり（○○銀行）・引渡猶予2週間 など" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                        <div className="col-12 text-muted mt-2">
                            {own
                                ? '📌 登録すると、商談案件管理に「売」案件（売主側）と「買」案件（買主側）の2件を作り、台帳・買い反響の両方につなぎます。両手のため、仲介手数料はそれぞれの案件で自動計算します。'
                                : `📌 登録すると、商談案件管理に「売」案件（自社＝元付）を1件作り、台帳の現況を「買付有」にします。買主側は他社客付けのため、自社の手数料は売主側の片手です。`}
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                {linked ? (
                    <>
                        <button className="btn btn-outline-danger btn-sm me-auto" disabled={busy} onClick={() => void unlink()}>連携を解除</button>
                        <button className="btn btn-primary btn-sm" onClick={onClose}>閉じる</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-light border btn-sm" onClick={onClose}>キャンセル</button>
                        <button className="btn btn-primary btn-sm fw-bold" disabled={busy || loading} onClick={() => void save()}>{busy ? '登録しています…' : '登録'}</button>
                    </>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default BuyOfferModal;
