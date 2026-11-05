import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { LEDGER_BAIKAI_TYPES, LEDGER_CATEGORIES, LEDGER_FREQS, ledgerFormError, ledgerFormOf } from './leadLinks';
import type { LedgerForm } from './leadLinks';
import type { Row } from '../summary/kpi';

/**
 * 売り反響の「媒介紐付」（v2.2.247 新規）。売り反響 → 媒介獲得台帳。
 *
 * ─────────────────────────────────────────────
 *   開く   … 売り反響の値を台帳の項目に写して出す（ledgerFormOf。以前のアプリの leadToLedger と同じ写し方）
 *   登録   … 必須（媒介契約日・媒介種別・売主）を確かめ、onSubmit に渡す。台帳を作るのは呼び出し側（LeadSell.tsx）
 *   キャンセル … 何も保存しない（台帳も反響の段階も変わらない）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 利用者の指示（2026-11-05）: 台帳へつなぐのは売り反響の画面だけ。流れは「モーダル → 売り反響の値を必要な項目へ反映 → 登録」。
 *   v2.2.246 までは媒介契約日だけを聞き、すぐに台帳を作っていた（媒介種別は専任媒介のまま、販売価格は査定額のまま）。
 */

type Props = {
    /** 対象の売り反響（null は閉じている） */
    lead: Row | null;
    /** 担当の選択肢（設定の担当者の氏名） */
    staffNames: string[];
    onClose: () => void;
    /** 「登録」。台帳を作れたら true（閉じる）。false なら開いたまま */
    onSubmit: (lead: Row, form: LedgerForm) => Promise<boolean>;
};

const str = (v: unknown): string => (v == null ? '' : String(v));
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: 0 };
const req = <span className="text-danger">*</span>;

/** 選択肢に無い今の値（反響で手入力された区分など）も消さずに出す */
const withCurrent = (options: string[], current: string): string[] =>
    current && !options.includes(current) ? [...options, current] : options;

const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
    const [form, setForm] = useState<LedgerForm | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setForm(lead ? ledgerFormOf(lead) : null);
        setBusy(false);
    }, [lead]);

    if (!lead || !form) return null;

    const set = (patch: Partial<LedgerForm>) => setForm(prev => (prev ? { ...prev, ...patch } : prev));

    const submit = async () => {
        const err = ledgerFormError(form);
        if (err) { alert(err); return; }
        setBusy(true);
        try {
            if (await onSubmit(lead, form)) onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal show onHide={busy ? undefined : onClose} size="lg" centered>
            <Modal.Header closeButton={!busy}>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>🔗 媒介紐付（媒介獲得台帳へ登録）</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ fontSize: '12px' }}>
                <div className="row g-2">
                    <div className="col-12 text-muted">
                        売り反響：<b>{str(lead.seller || lead.name) || '（名称なし）'}</b>／{str(lead.source) || '反響元未設定'}／段階 {str(lead.phase) || '―'}
                        <br />売り反響の値を下の項目に入れてあります。確かめて、足りないところを直してから「登録」を押してください。
                    </div>
                    <div className="col-md-4"><div style={label}>媒介契約日 {req}</div>
                        <input type="date" className="form-control form-control-sm" value={form.baikaiDate} onChange={e => set({ baikaiDate: e.target.value })} /></div>
                    <div className="col-md-4"><div style={label}>媒介種別 {req}</div>
                        <select className="form-select form-select-sm" value={form.baikaiType} onChange={e => set({ baikaiType: e.target.value })}>
                            {LEDGER_BAIKAI_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                    <div className="col-md-4"><div style={label}>担当</div>
                        <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
                            <option value="">（未割当）</option>
                            {withCurrent(staffNames, form.staff).map(s => <option key={s} value={s}>{s}</option>)}
                        </select></div>
                    <div className="col-md-6"><div style={label}>売主 {req}</div>
                        <input className="form-control form-control-sm" value={form.seller} onChange={e => set({ seller: e.target.value })} /></div>
                    <div className="col-md-6"><div style={label}>連絡先（電話・メール）</div>
                        <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
                    <div className="col-md-4"><div style={label}>市区町村</div>
                        <input className="form-control form-control-sm" value={form.addr1} onChange={e => set({ addr1: e.target.value })} /></div>
                    <div className="col-md-8"><div style={label}>所在地（番地まで）</div>
                        <input className="form-control form-control-sm" value={form.addr2} onChange={e => set({ addr2: e.target.value })} /></div>
                    <div className="col-md-4"><div style={label}>区分</div>
                        <select className="form-select form-select-sm" value={form.category} onChange={e => set({ category: e.target.value })}>
                            <option value="">選択してください</option>
                            {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                    <div className="col-md-4"><div style={label}>販売価格(円)（初めは査定額）</div>
                        <input type="number" className="form-control form-control-sm" value={form.price ?? ''} onChange={e => set({ price: Number(e.target.value) || null })} /></div>
                    <div className="col-md-4"><div style={label}>連絡頻度</div>
                        <select className="form-select form-select-sm" value={form.freq} onChange={e => set({ freq: e.target.value })}>
                            {LEDGER_FREQS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                    <div className="col-12"><div style={label}>備考</div>
                        <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                    <div className="col-12 text-muted mt-2">
                        📌 登録すると、媒介獲得台帳に1行を作り（現況は「情報整理中」）、この売り反響の段階を「媒介受託」にします。キャンセルすると、何も変わりません。
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn btn-light border btn-sm" disabled={busy} onClick={onClose}>キャンセル</button>
                <button className="btn btn-primary btn-sm fw-bold" disabled={busy} onClick={() => void submit()}>{busy ? '登録しています…' : '登録'}</button>
            </Modal.Footer>
        </Modal>
    );
};

export default LedgerLinkModal;
