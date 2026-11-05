import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { useNavigate } from 'react-router-dom';
import {
    LEDGER_BAIKAI_TYPES, LEDGER_CATEGORIES, LEDGER_FREQS, ledgerFormOf, ledgerFormProblems, ledgerFormWarning, maxExpiryOf,
} from './leadLinks';
import type { LedgerForm, LedgerLinkResult } from './leadLinks';
import type { Row } from '../summary/kpi';

/**
 * 売り反響の「媒介紐付」（v2.2.247 新規。v2.2.248 で連動トリガー仕様書の ① に合わせた）。売り反響 → 媒介獲得台帳。
 *
 * ─────────────────────────────────────────────
 *   開く      … 売り反響の値を台帳の項目に写して出す（ledgerFormOf）
 *   登録      … 前提条件（ledgerFormProblems。仕様書 ①）を確かめ、onSubmit に渡す。作るのは ② の planner:ledger_link
 *   作れたら  … 台帳 No. と「媒介獲得台帳で開く」を出す（仕様書 共通ルール 4）
 *   キャンセル … 何も保存しない（台帳も反響の段階も変わらない）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 利用者の指示（2026-11-05）: 台帳へつなぐのは売り反響の画面だけ。流れは「モーダル → 売り反響の値を必要な項目へ反映 → 登録」。
 * ⚠️ 必須（仕様書 ①）: 媒介の種類・媒介契約日（未来は不可）・満了日（専任・専属専任は3か月以内。一般は超えると警告）・売出価格・担当者・売主・所在地・種別
 */

type Props = {
    /** 対象の売り反響（null は閉じている） */
    lead: Row | null;
    /** 担当の選択肢（設定の担当者の氏名） */
    staffNames: string[];
    onClose: () => void;
    /** 「登録」。作れた（すでにあった）ら結果、作れなかったら null（画面は開いたまま） */
    onSubmit: (lead: Row, form: LedgerForm) => Promise<LedgerLinkResult | null>;
};

const str = (v: unknown): string => (v == null ? '' : String(v));
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: 0 };
const req = <span className="text-danger">*</span>;

/** 選択肢に無い今の値（反響で手入力された区分など）も消さずに出す */
const withCurrent = (options: string[], current: string): string[] =>
    current && !options.includes(current) ? [...options, current] : options;

const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
    const navigate = useNavigate();
    const [form, setForm] = useState<LedgerForm | null>(null);
    const [busy, setBusy] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    const [done, setDone] = useState<LedgerLinkResult | null>(null);

    useEffect(() => {
        setForm(lead ? ledgerFormOf(lead) : null);
        setBusy(false);
        setProblems([]);
        setDone(null);
    }, [lead]);

    if (!lead || !form) return null;

    const set = (patch: Partial<LedgerForm>) => setForm(prev => (prev ? { ...prev, ...patch } : prev));
    /** 媒介契約日を変えたら、満了日を「3か月後の前日」に入れ直す（仕様書の初期値） */
    const setBaikaiDate = (baikaiDate: string) => set({ baikaiDate, ...(/^\d{4}-\d{2}-\d{2}$/.test(baikaiDate) ? { expiry: maxExpiryOf(baikaiDate) } : {}) });

    const submit = async () => {
        const p = ledgerFormProblems(form);
        setProblems(p);
        if (p.length > 0) return;
        const warn = ledgerFormWarning(form);
        if (warn && !window.confirm(warn)) return;
        setBusy(true);
        try {
            const r = await onSubmit(lead, form);
            if (r) setDone(r);
        } finally {
            setBusy(false);
        }
    };

    const openLedger = () => {
        if (!done) return;
        onClose();
        navigate(`/broker?ledgerNo=${done.no}`);
    };

    const general = form.baikaiType === '一般媒介';

    return (
        <Modal show onHide={busy ? undefined : onClose} size="lg" centered>
            <Modal.Header closeButton={!busy}>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>🔗 媒介紐付（媒介獲得台帳へ登録）</Modal.Title>
            </Modal.Header>
            {done ? (
                <>
                    <Modal.Body style={{ fontSize: '13px' }}>
                        <p className="mb-2">
                            {done.status === 'exists'
                                ? <>この売り反響は、すでに <b>媒介獲得台帳 No.{done.no}</b> につながっています（新しくは作っていません）。</>
                                : <><b>媒介獲得台帳 No.{done.no}</b> を作り、売り反響を「媒介受託」にしました。</>}
                        </p>
                        <p className="text-muted mb-0" style={{ fontSize: '11px' }}>媒介獲得台帳で、レインズ登録日・鍵の預かりなどを続けて入れてください。</p>
                    </Modal.Body>
                    <Modal.Footer>
                        <button className="btn btn-light border btn-sm" onClick={onClose}>閉じる</button>
                        <button className="btn btn-primary btn-sm fw-bold" onClick={openLedger}>媒介獲得台帳で No.{done.no} を開く</button>
                    </Modal.Footer>
                </>
            ) : (
                <>
                    <Modal.Body style={{ fontSize: '12px' }}>
                        <div className="row g-2">
                            <div className="col-12 text-muted">
                                売り反響：<b>{str(lead.seller || lead.name) || '（名称なし）'}</b>／{str(lead.source) || '反響元未設定'}／段階 {str(lead.phase) || '―'}
                                <br />売り反響の値を下の項目に入れてあります。確かめて、足りないところを直してから「登録」を押してください。<span className="text-danger">*</span> は必須です。
                            </div>
                            {problems.length > 0 && (
                                <div className="col-12">
                                    <div className="rlt-alert" style={{ borderRadius: '6px', padding: '8px 12px', fontSize: '11px', border: '1px solid #f1aeb5', background: '#f8d7da', color: '#842029' }}>
                                        次の項目を確かめてください：{problems.join('・')}
                                    </div>
                                </div>
                            )}
                            <div className="col-md-4"><div style={label}>媒介の種類 {req}</div>
                                <select className="form-select form-select-sm" value={form.baikaiType} onChange={e => set({ baikaiType: e.target.value })}>
                                    {LEDGER_BAIKAI_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div className="col-md-4"><div style={label}>媒介契約日 {req}</div>
                                <input type="date" className="form-control form-control-sm" value={form.baikaiDate} onChange={e => setBaikaiDate(e.target.value)} /></div>
                            <div className="col-md-4"><div style={label}>有効期間の満了日 {req}</div>
                                <input type="date" className="form-control form-control-sm" value={form.expiry} onChange={e => set({ expiry: e.target.value })} /></div>
                            <div className="col-12 text-muted" style={{ fontSize: '10px', marginTop: 0 }}>
                                満了日は「契約日の3か月後の前日」が入ります。専任媒介・専属専任媒介は3か月を超えられません（宅建業法）。一般媒介は超えると確かめる画面が出ます。
                            </div>
                            {general && (
                                <div className="col-12"><div style={label}>一般媒介の他の依頼先（明示型のとき。任意）</div>
                                    <input className="form-control form-control-sm" placeholder="○○不動産・△△ホーム など" value={form.otherBrokers} onChange={e => set({ otherBrokers: e.target.value })} /></div>
                            )}
                            <div className="col-md-4"><div style={label}>売出価格(円) {req}</div>
                                <input type="number" min={1} className="form-control form-control-sm" value={form.price ?? ''} onChange={e => set({ price: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-4"><div style={label}>担当者 {req}</div>
                                <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
                                    <option value="">選択してください</option>
                                    {withCurrent(staffNames, form.staff).map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="col-md-4"><div style={label}>連絡頻度</div>
                                <select className="form-select form-select-sm" value={form.freq} onChange={e => set({ freq: e.target.value })}>
                                    {LEDGER_FREQS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div className="col-md-6"><div style={label}>売主 {req}</div>
                                <input className="form-control form-control-sm" value={form.seller} onChange={e => set({ seller: e.target.value })} /></div>
                            <div className="col-md-6"><div style={label}>連絡先（電話・メール）</div>
                                <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
                            <div className="col-md-4"><div style={label}>市区町村</div>
                                <input className="form-control form-control-sm" value={form.addr1} onChange={e => set({ addr1: e.target.value })} /></div>
                            <div className="col-md-8"><div style={label}>物件の所在地（番地まで） {req}</div>
                                <input className="form-control form-control-sm" value={form.addr2} onChange={e => set({ addr2: e.target.value })} /></div>
                            <div className="col-md-4"><div style={label}>物件の種別 {req}</div>
                                <select className="form-select form-select-sm" value={form.category} onChange={e => set({ category: e.target.value })}>
                                    <option value="">選択してください</option>
                                    {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div className="col-md-8"><div style={label}>備考</div>
                                <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                            <div className="col-12 text-muted mt-2">
                                📌 登録すると、媒介獲得台帳に1行を作り（現況は「情報整理中」）、この売り反響の段階を「媒介受託」にします。どちらか一方だけが保存されることはありません。キャンセルすると、何も変わりません。
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button className="btn btn-light border btn-sm" disabled={busy} onClick={onClose}>キャンセル</button>
                        <button className="btn btn-primary btn-sm fw-bold" disabled={busy} onClick={() => void submit()}>{busy ? '登録しています…' : '登録'}</button>
                    </Modal.Footer>
                </>
            )}
        </Modal>
    );
};

export default LedgerLinkModal;
