import React, { useEffect, useMemo, useContext, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import AuthContext from '../../context/AuthContext';
import { removeSpaces, NEXT_QUICK, addDaysISO, LEAD_END_REASONS, BUY_END_REASONS } from './leadUtiles';
// 💡 追加: DocumentViewerをインポート
import DocumentViewer from './DocumentViewer';

// 💡 追加: 変更内容プレビューで表示するフィールド名の日本語ラベル
const FIELD_LABELS: Record<string, string> = {
    receivedDate: '受信日', seller: '売主名', name: '顧客名', source: '反響元', portal: 'ポータル',
    phone: '連絡先(電話)', mail: '連絡先(メール)', staff: '担当', addr1: '住所', addr: '住所',
    phase: 'フェーズ', endReason: '終了理由', category: '区分', budget: '予算・希望価格', price: '価格',
    connectDate: '通電日', viewDate: '内見日', visitDate: '訪問査定日', baikaiDate: '媒介契約日',
    contactDate: '接触日', contractDate: '契約日', followDate: 'フォロー日', fee: '仲介手数料',
    nextDate: '次回連絡日', nextNote: '次回アクション', note: '備考',
};

// ==========================================
// 💡 型定義
// ==========================================
export type LeadCategory = 'buy' | 'sell' | 'buyOpportunity' | 'sellOpportunity';

export type CallLog = {
    date: string | null;
    type: string | null; // 'call' | 'sms' | 'mail'
    staff: string | null;
    note: string | null | undefined;
};

export type LeadEditProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    customerInfo: any;
    setCustomerInfo: React.Dispatch<React.SetStateAction<any>>;
    leadCategory: LeadCategory;
    staffList: string[];
};

// 💡 追加: DocumentViewerへ渡すデータの型定義
export type initialData = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null; // 区分
    phone?: string | null;    // 連絡先(電話)
    mail?: string | null;     // 連絡先(メール)
    addr: string | null;
    price: number | null;
    fee: number | null;
};

// ==========================================
// 💡 ヘルパー関数
// ==========================================
const calcBrokerageFee = (priceVal: string | number | null | undefined): number | null => {
    if (!priceVal) return null;
    const price = Number(String(priceVal).replace(/[^\d.-]/g, ''));
    if (isNaN(price) || price === 0) return null;
    
    const actualPrice = price < 1000000 ? price * 10000 : price;
    
    if (actualPrice <= 8000000) {
        return 300000;
    } else {
        return actualPrice * 0.03 + 60000;
    }
};

const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const formatDate = (dateStr: string | null | Date) => {
    if (!dateStr || String(dateStr).startsWith('0000')) return '―';
    if (dateStr instanceof Date) {
        const y = dateStr.getFullYear();
        const m = String(dateStr.getMonth() + 1).padStart(2, '0');
        const d = String(dateStr.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    }
    return dateStr.replace(/-/g, '/');
};

const actionTypeMap: Record<string, string> = {
    call: '架電',
    sms: 'SMS送信',
    mail: 'メール送信'
};

// 💡 共通のコンパクト入力スタイル
const compactInputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '11px',
    padding: '4px 8px',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    height: '28px',
    color: '#495057',
    backgroundColor: '#fff',
    outline: 'none',
    appearance: 'none',
};

// 💡 共通フォームグループ部品
const FormGroup = ({ label, width, children }: { label: string, width?: string, children: React.ReactNode }) => (
    <div style={{ width: width || 'auto', flexGrow: width ? 0 : 1 }}>
        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '2px', display: 'block' }}>
            {label}
        </label>
        {children}
    </div>
);

const LeadEdit: React.FC<LeadEditProps> = ({
    isOpen,
    onClose,
    onSave,
    customerInfo,
    setCustomerInfo,
    leadCategory,
    staffList
}) => {
    const { userName } = useContext(AuthContext);

    // 💡 追加: 契約書モーダルの表示状態
    const [documentShow, setDocumentShow] = useState(false);

    // 💡 追加: 変更内容プレビュー用スナップショット（モーダルを開いた時点の状態）
    const [snapshot, setSnapshot] = useState<any>({});
    useEffect(() => {
        if (isOpen) setSnapshot({ ...customerInfo });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const changedFields = useMemo(() => {
        const out: { field: string; from: string; to: string }[] = [];
        const keys = new Set([...Object.keys(snapshot || {}), ...Object.keys(customerInfo || {})]);
        keys.forEach(k => {
            if (k === 'callDates' || k === 'id') return; // 架電履歴・IDは別UIで扱うため対象外
            const from = (snapshot as any)?.[k];
            const to = (customerInfo as any)?.[k];
            if (String(from ?? '') !== String(to ?? '')) {
                out.push({ field: FIELD_LABELS[k] || k, from: from === undefined || from === null || from === '' ? '（未設定）' : String(from), to: to === undefined || to === null || to === '' ? '（未設定）' : String(to) });
            }
        });
        return out;
    }, [snapshot, customerInfo]);

    const isSellType = leadCategory === 'sell' || leadCategory === 'sellOpportunity';
    const isOpportunityType = leadCategory === 'buyOpportunity' || leadCategory === 'sellOpportunity';
    const isBasicLead = leadCategory === 'buy' || leadCategory === 'sell';

    const nameLabel = isSellType ? '売主名' : '顧客名';
    const sourceLabel = isSellType ? '反響元' : 'ポータル';

    const phaseList = isSellType
        ? ['反響受信', '追客中', '通電済み', '机上査定', '訪問査定', '査定書提出', '媒介受託', '売却済', '追客終了']
        : ['反響受信', '追客中', '通電済み', '内見予約', '内見済み', '購入申込', '成約', '追客終了'];

    let titleLabel = '';
    switch (leadCategory) {
        case 'buy': titleLabel = '買'; break;
        case 'sell': titleLabel = '売'; break;
        case 'buyOpportunity': titleLabel = '買 (商談・契約)'; break;
        case 'sellOpportunity': titleLabel = '売 (商談・契約)'; break;
    }

    // ==========================================
    // 💡 DocumentViewer用の初期データ生成
    // ==========================================
    const initialDocData: initialData = useMemo(() => {
        // 型定義に合致するよう媒介種別をフォールバック
        const bt = customerInfo.baikaiType;
        const validBaikaiTypes = ['専任媒介', '専属専任媒介', '一般媒介'];
        const safeBaikaiType = validBaikaiTypes.includes(bt) ? bt : '専任媒介';

        // 費用のパース
        const feeVal = customerInfo.fee !== undefined && customerInfo.fee !== null && customerInfo.fee !== '' 
            ? Number(customerInfo.fee) 
            : null;

        // 価格のパース（売/買の両対応）
        const priceVal = customerInfo.price || customerInfo.budget;
        const parsedPrice = priceVal ? Number(priceVal) : null;

        return {
            name: customerInfo.name || customerInfo.seller || null,
            baikaiType: safeBaikaiType as '専任媒介' | '専属専任媒介' | '一般媒介',
            category: customerInfo.category || null,
            phone: customerInfo.phone || null,
            mail: customerInfo.mail || null,
            addr: customerInfo.addr1 || customerInfo.addr || null,
            price: parsedPrice,
            fee: feeVal,
        };
    }, [customerInfo]);

    // ==========================================
    // 💡 仲介手数料の自動計算と手入力検知
    // ==========================================
    const autoFee = useMemo(() => calcBrokerageFee(customerInfo.price || customerInfo.budget), [customerInfo.price, customerInfo.budget]);

    useEffect(() => {
        if (isOpportunityType && autoFee !== null) {
            if (customerInfo.fee === null || customerInfo.fee === undefined || customerInfo.fee === '') {
                setCustomerInfo((prev: any) => ({ ...prev, fee: autoFee }));
            }
        }
    }, [autoFee, customerInfo.fee, isOpportunityType, setCustomerInfo]);

    const isManualFee = customerInfo.fee && autoFee !== null && Number(customerInfo.fee) !== autoFee;

    // ==========================================
    // 💡 架電履歴・メモ追加機能
    // ==========================================
    const [memoTime, setMemoTime] = useState(getCurrentDateTime());
    const [memoType, setMemoType] = useState('call');
    const [memoNote, setMemoNote] = useState('');

    const addLog = (newLog: CallLog) => {
        let logs: CallLog[] = [];
        try {
            logs = JSON.parse(customerInfo.callDates || '[]');
        } catch (e) { }
        logs.push(newLog);
        setCustomerInfo((prev: any) => ({ ...prev, callDates: JSON.stringify(logs) }));
    };

    const handleQuickCall = () => {
        const now = getCurrentDateTime();
        addLog({ date: now, type: 'call', staff: userName || '不明', note: '' });
    };

    const handleAddMemo = () => {
        if (!memoTime || !memoType) return;
        addLog({ date: memoTime, type: memoType, staff: userName || '不明', note: memoNote });
        setMemoTime(getCurrentDateTime());
        setMemoType('call');
        setMemoNote('');
    };

    const sortedCallLogs = useMemo(() => {
        if (!customerInfo.callDates) return [];
        try {
            const logs: CallLog[] = JSON.parse(customerInfo.callDates);
            return logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        } catch (e) {
            return [];
        }
    }, [customerInfo.callDates]);

    const callCount = sortedCallLogs.filter(log => log.type === 'call').length;

    // ==========================================
    // 💡 担当変更確認ダイアログ（source.html の担当変更確認と同等）
    // ==========================================
    const handleStaffChange = (newStaff: string) => {
        const prevStaff = removeSpaces(customerInfo.staff);
        const nextStaffNorm = removeSpaces(newStaff);
        if (prevStaff && nextStaffNorm && prevStaff !== nextStaffNorm) {
            if (!window.confirm(`担当を「${customerInfo.staff}」から「${newStaff}」に変更します。よろしいですか？`)) return;
        }
        setCustomerInfo({ ...customerInfo, staff: newStaff });
    };

    // ==========================================
    // 💡 フェーズ変更（追客終了になったら終了理由をリセット）
    // ==========================================
    const handlePhaseChange = (val: string) => {
        setCustomerInfo((prev: any) => ({ ...prev, phase: val, endReason: val === '追客終了' ? prev.endReason : '' }));
    };

    // ==========================================
    // 💡 次回アクション必須化・追客終了理由の必須化（source.html の V12.requireNext() 相当）
    // ==========================================
    const handleSaveClick = () => {
        if (customerInfo.phase === '追客終了') {
            if (!customerInfo.endReason) {
                alert('追客終了の理由を選択してください。');
                return;
            }
        } else if (!customerInfo.nextDate || !String(customerInfo.nextNote || '').trim()) {
            alert('次回アクション（次回連絡日・次回アクション内容）は必須です。');
            return;
        }
        onSave();
    };

    // 💡 次回連絡日クイック設定ボタン（source.html の nextBar() 相当）
    const nextQuickButtons = (
        <div className="col-12" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '-4px' }}>
            {NEXT_QUICK.map(q => (
                <button
                    key={q.label}
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                    style={{ fontSize: '10px' }}
                    onClick={() => setCustomerInfo({ ...customerInfo, nextDate: addDaysISO(null, q.days) })}
                >
                    {q.label}
                </button>
            ))}
        </div>
    );

    return (
        <>
            <Modal show={isOpen} onHide={onClose} centered size="lg">
                <Modal.Header closeButton className="border-bottom-0 pb-0 bg-light pt-2 px-3">
                    <Modal.Title className="fw-bold text-secondary" style={{ fontSize: '15px' }}>
                        <i className="bi bi-person-lines-fill me-2 text-primary"></i>顧客情報編集 ({titleLabel})
                    </Modal.Title>
                </Modal.Header>
                
                <Modal.Body className="pt-3 pb-3 px-3 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    <div className="bg-white rounded shadow-sm border p-3">
                        
                        {/* 基本情報 */}
                        <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>
                            <i className="bi bi-info-circle me-1"></i>基本情報
                        </h6>
                        <div className="row g-2 mb-3">
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>受信日</label>
                                <input type="date" style={compactInputStyle} value={customerInfo.receivedDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, receivedDate: e.target.value })} />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>{nameLabel}</label>
                                <input type="text" style={compactInputStyle} value={customerInfo.seller || customerInfo.name || ''} onChange={e => setCustomerInfo({ ...customerInfo, seller: e.target.value, name: e.target.value })} />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>{sourceLabel}</label>
                                <select style={compactInputStyle} value={customerInfo.source || customerInfo.portal || ''} onChange={e => setCustomerInfo({ ...customerInfo, source: e.target.value, portal: e.target.value })}>
                                    <option value="">選択してください</option>
                                    {['SUUMO', 'アットホーム', "HOME'S", '一括査定サイト', '自社HP', '紹介', 'チラシ', 'その他'].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>連絡先 (電話)</label>
                                <input type="text" style={compactInputStyle} value={customerInfo.phone || ''} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })} />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>連絡先 (メール)</label>
                                <input type="email" style={compactInputStyle} value={customerInfo.mail || ''} onChange={e => setCustomerInfo({ ...customerInfo, mail: e.target.value })} />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>担当</label>
                                <select style={compactInputStyle} value={removeSpaces(customerInfo.staff)} onChange={e => handleStaffChange(e.target.value)}>
                                    <option value="">担当を選択</option>
                                    {staffList.map(s => <option key={s} value={removeSpaces(s)}>{s}</option>)}
                                </select>
                            </div>
                            <div className="col-12">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>住所 / 物件所在地</label>
                                <input type="text" style={compactInputStyle} value={customerInfo.addr1 || customerInfo.addr || ''} onChange={e => setCustomerInfo({ ...customerInfo, addr1: e.target.value, addr: e.target.value })} />
                            </div>
                        </div>

                        {/* 詳細・アクション設定 */}
                        <h6 className="fw-bold text-secondary mb-2 border-top pt-2" style={{ fontSize: '12px' }}>
                            <i className="bi bi-card-checklist me-1"></i>詳細・アクション設定
                        </h6>
                        <div className="row g-2 mb-3">
                            <div className="col-md-4">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>フェーズ</label>
                                <select style={compactInputStyle} value={customerInfo.phase || ''} onChange={e => handlePhaseChange(e.target.value)}>
                                    <option value="">フェーズを選択</option>
                                    {phaseList.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            {/* ▼ 追客終了の場合は理由を必須入力 ▼ */}
                            {customerInfo.phase === '追客終了' && (
                                <div className="col-md-4">
                                    <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>終了理由 <span className="text-danger">*必須</span></label>
                                    <select style={compactInputStyle} value={customerInfo.endReason || ''} onChange={e => setCustomerInfo({ ...customerInfo, endReason: e.target.value })}>
                                        <option value="">理由を選択</option>
                                        {(isSellType ? LEAD_END_REASONS : BUY_END_REASONS).map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* ▼ 買い (buy) の場合 ▼ */}
                            {leadCategory === 'buy' && (
                                <>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>区分</label>
                                        <select style={compactInputStyle} value={customerInfo.category || ''} onChange={e => setCustomerInfo({ ...customerInfo, category: e.target.value })}>
                                            <option value="">区分を選択</option>
                                            {['戸建', 'マンション', '土地', 'その他'].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>予算・希望価格(円)</label>
                                        <input type="number" style={compactInputStyle} value={customerInfo.budget || ''} onChange={e => setCustomerInfo({ ...customerInfo, budget: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>通電日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.connectDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, connectDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>内見日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.viewDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, viewDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日 <span className="text-danger">*必須</span></label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                    </div>
                                    {nextQuickButtons}
                                    <div className="col-12">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション(メモ)</label>
                                        <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
                                    </div>
                                </>
                            )}

                            {/* ▼ 売り (sell) の場合 ▼ */}
                            {leadCategory === 'sell' && (
                                <>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>区分</label>
                                        <select style={compactInputStyle} value={customerInfo.category || ''} onChange={e => setCustomerInfo({ ...customerInfo, category: e.target.value })}>
                                            <option value="">区分を選択</option>
                                            {['戸建', 'マンション', '土地', 'その他'].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>想定価格・査定額(円)</label>
                                        <input type="number" style={compactInputStyle} value={customerInfo.price || ''} onChange={e => setCustomerInfo({ ...customerInfo, price: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>通電日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.connectDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, connectDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>訪問査定日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.visitDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, visitDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>媒介契約日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.baikaiDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, baikaiDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日 <span className="text-danger">*必須</span></label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                    </div>
                                    {nextQuickButtons}
                                    <div className="col-12">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション(メモ)</label>
                                        <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
                                    </div>
                                </>
                            )}

                            {/* ▼ 売・買の商談 (Opportunity) の場合 ▼ */}
                            {isOpportunityType && (
                                <>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>区分</label>
                                        <select style={compactInputStyle} value={customerInfo.category || ''} onChange={e => setCustomerInfo({ ...customerInfo, category: e.target.value })}>
                                            <option value="">区分を選択</option>
                                            {['戸建', 'マンション', '土地', 'その他'].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>物件(成約)価格(円)</label>
                                        <input type="number" style={compactInputStyle} value={customerInfo.price || customerInfo.budget || ''} onChange={e => setCustomerInfo({ ...customerInfo, price: e.target.value, budget: e.target.value })} />
                                    </div>
                                    
                                    <div className="col-md-4">
                                        <div className="d-flex justify-content-between align-items-center mb-0">
                                            <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>仲介手数料(円)</label>
                                            {isManualFee && (
                                                <span className="badge bg-warning text-dark px-1 py-0" style={{ fontSize: '9px' }}>
                                                    <i className="bi bi-pencil-fill me-1"></i>手入力
                                                </span>
                                            )}
                                        </div>
                                        <input 
                                            type="number" 
                                            className={isManualFee ? 'text-primary fw-bold bg-light' : ''}
                                            style={compactInputStyle}
                                            value={customerInfo.fee || ''} 
                                            onChange={e => setCustomerInfo({ ...customerInfo, fee: e.target.value })} 
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>接触日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.contactDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, contactDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>契約日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.contractDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, contractDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>フォロー日</label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.followDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, followDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション予定日 <span className="text-danger">*必須</span></label>
                                        <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                    </div>
                                    {nextQuickButtons}
                                    <div className="col-12">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション内容</label>
                                        <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 備考 */}
                        <div className="row g-2 border-top pt-2">
                            <div className="col-12">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>備考</label>
                                <textarea
                                    style={{ ...compactInputStyle, height: '40px', resize: 'none', lineHeight: '1.2' }}
                                    value={customerInfo.note || ''}
                                    onChange={e => setCustomerInfo({ ...customerInfo, note: e.target.value })}
                                />
                            </div>
                        </div>
                        
                        {/* 架電履歴・メモ追加部分 */}
                        {isBasicLead && (
                            <div className="mt-3 border-top pt-3 bg-light rounded px-3 pb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="fw-bold text-secondary mb-0" style={{ fontSize: '12px' }}>
                                        <i className="bi bi-telephone-fill me-1 text-primary"></i>架電履歴・メモ
                                        <span className="ms-2 badge bg-primary rounded-pill">{callCount}</span>
                                    </h6>
                                    <button
                                        className="btn btn-primary btn-sm py-0 px-3 rounded-pill shadow-sm"
                                        style={{ fontSize: '10px', fontWeight: 'bold' }}
                                        onClick={handleQuickCall}
                                    >
                                        📞架電
                                    </button>
                                </div>

                                <div className="bg-white rounded border mb-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                    {sortedCallLogs.length > 0 ? (
                                        <Table size="sm" className="mb-0 align-middle text-nowrap" style={{ fontSize: '10px' }}>
                                            <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th className="text-muted border-bottom-0 py-1">日時</th>
                                                    <th className="text-muted border-bottom-0 py-1">アクション</th>
                                                    <th className="text-muted border-bottom-0 py-1">担当</th>
                                                    <th className="text-muted border-bottom-0 w-100 py-1">メモ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedCallLogs.map((log, idx) => (
                                                    <tr key={idx}>
                                                        <td className="fw-bold text-dark py-1">
                                                            {formatDate(log.date ? new Date(log.date) : null)} {log.date?.slice(11, 16)}
                                                        </td>
                                                        <td className="py-1">
                                                            <span className="badge bg-light text-secondary border" style={{ fontSize: '9px' }}>
                                                                {actionTypeMap[log.type || ''] || log.type}
                                                            </span>
                                                        </td>
                                                        <td className="py-1 text-muted">{log.staff}</td>
                                                        <td className="py-1 text-muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: '150px' }}>
                                                            {log.note || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    ) : (
                                        <div className="text-center text-muted py-3" style={{ fontSize: '10px' }}>履歴はありません。</div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>
                                    <FormGroup label="日時" width="130px">
                                        <input type="datetime-local" style={compactInputStyle} value={memoTime} onChange={e => setMemoTime(e.target.value)} />
                                    </FormGroup>
                                    <FormGroup label="アクション" width="90px">
                                        <select style={{ ...compactInputStyle, cursor: 'pointer' }} value={memoType} onChange={e => setMemoType(e.target.value)}>
                                            <option value="call">架電</option>
                                            <option value="sms">SMS送信</option>
                                            <option value="mail">メール送信</option>
                                        </select>
                                    </FormGroup>
                                    <FormGroup label="メモ内容">
                                        <textarea 
                                            style={{ ...compactInputStyle, resize: 'none', lineHeight: '18px', overflow: 'hidden' }} 
                                            placeholder="メモを入力..." 
                                            value={memoNote} 
                                            onChange={e => setMemoNote(e.target.value)} 
                                        />
                                    </FormGroup>
                                    <div style={{ paddingTop: '15px' }}>
                                        <button 
                                            className="btn btn-secondary btn-sm py-0 px-3 fw-bold shadow-sm" 
                                            style={{ fontSize: '11px', height: '28px' }} 
                                            onClick={handleAddMemo}
                                        >
                                            追加
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 💡 追加: 変更内容プレビュー（保存前の今回セッションの差分。サーバー側の永続履歴ではない） */}
                        {changedFields.length > 0 && (
                            <div className="mt-3 border-top pt-3">
                                <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>
                                    <i className="bi bi-clock-history me-1"></i>変更内容
                                    <span className="ms-2 badge bg-secondary rounded-pill">{changedFields.length}</span>
                                </h6>
                                <div className="bg-light rounded border" style={{ maxHeight: '110px', overflowY: 'auto' }}>
                                    <Table size="sm" className="mb-0 align-middle" style={{ fontSize: '10px' }}>
                                        <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th className="text-muted border-bottom-0 py-1">項目</th>
                                                <th className="text-muted border-bottom-0 py-1">変更前</th>
                                                <th className="text-muted border-bottom-0 py-1">変更後</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {changedFields.map((c, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-1 fw-bold text-dark">{c.field}</td>
                                                    <td className="py-1 text-muted">{c.from}</td>
                                                    <td className="py-1 text-primary fw-bold">{c.to}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal.Body>

                {/* 💡 修正: justify-content-between に変更し、左側に契約書ボタンを配置 */}
                <Modal.Footer className="bg-light border-top-0 pt-0 pb-3 d-flex justify-content-between align-items-center">
                    <div>
                        <button
                            className="btn btn-outline-primary btn-sm px-3 fw-bold"
                            style={{ fontSize: '11px' }}
                            onClick={() => setDocumentShow(true)}
                        >
                            <i className="fa-solid fa-file-contract me-1 text-secondary"></i> 契約書
                        </button>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={onClose}>キャンセル</button>
                        <button className="btn btn-primary btn-sm px-4 fw-bold shadow-sm" style={{ fontSize: '11px' }} onClick={handleSaveClick}>保存する</button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* 💡 追加: 契約書モーダル */}
            <DocumentViewer 
                documentShow={documentShow} 
                setDocumentShow={setDocumentShow} 
                initialData={initialDocData} 
            />
        </>
    );
};

export default LeadEdit;