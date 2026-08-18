import React, { useEffect, useMemo, useContext, useState, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import AuthContext from '../../context/AuthContext';
// 💡 追加: 突合用のヘルパー関数をインポート
import { removeSpaces } from './leadUtiles';

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

// 💡 共通のコンパクト入力スタイル（余白・文字サイズ縮小）
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
    appearance: 'none', // ブラウザ固有のスタイル（太さ）をリセット
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
    // 💡 架電履歴・メモ追加機能（完全統合版）
    // ==========================================
    const [memoTime, setMemoTime] = useState(getCurrentDateTime());
    const [memoType, setMemoType] = useState('call');
    const [memoNote, setMemoNote] = useState('');

    // ログ追加の共通関数
    const addLog = (newLog: CallLog) => {
        let logs: CallLog[] = [];
        try {
            logs = JSON.parse(customerInfo.callDates || '[]');
        } catch (e) { }
        logs.push(newLog);
        setCustomerInfo((prev: any) => ({ ...prev, callDates: JSON.stringify(logs) }));
    };

    // ① 📞 クイック架電 (アラートなし)
    const handleQuickCall = () => {
        const now = getCurrentDateTime();
        addLog({ date: now, type: 'call', staff: userName || '不明', note: '' });
    };

    // ② 📝 詳細メモ追加
    const handleAddMemo = () => {
        if (!memoTime || !memoType) return;
        addLog({ date: memoTime, type: memoType, staff: userName || '不明', note: memoNote });
        // 追加後にフォームをリセット
        setMemoTime(getCurrentDateTime());
        setMemoType('call');
        setMemoNote('');
    };

    // 履歴を古い順（昇順）にソートして表示用配列を作成
    const sortedCallLogs = useMemo(() => {
        if (!customerInfo.callDates) return [];
        try {
            const logs: CallLog[] = JSON.parse(customerInfo.callDates);
            return logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        } catch (e) {
            return [];
        }
    }, [customerInfo.callDates]);

    // 架電数のカウント
    const callCount = sortedCallLogs.filter(log => log.type === 'call').length;

    return (
        <Modal show={isOpen} onHide={onClose} centered size="lg">
            <Modal.Header closeButton className="border-bottom-0 pb-0 bg-light pt-2 px-3">
                <Modal.Title className="fw-bold text-secondary" style={{ fontSize: '15px' }}>
                    <i className="bi bi-person-lines-fill me-2 text-primary"></i>顧客情報編集 ({titleLabel})
                </Modal.Title>
            </Modal.Header>
            
            {/* 💡 スクロール可能領域 (高さ制限を設け、モーダル自体が画面外にはみ出ないようにする) */}
            <Modal.Body className="pt-3 pb-3 px-3 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="bg-white rounded shadow-sm border p-3">
                    
                    {/* ==========================================
                        【上部】共通表示部分
                    ========================================== */}
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
                            {/* 💡 スタッフ名の突合改善: removeSpaces でスペースを無視してマッチング */}
                            <select style={compactInputStyle} value={removeSpaces(customerInfo.staff)} onChange={e => setCustomerInfo({ ...customerInfo, staff: e.target.value })}>
                                <option value="">担当を選択</option>
                                {staffList.map(s => <option key={s} value={removeSpaces(s)}>{s}</option>)}
                            </select>
                        </div>
                        {/* 💡 住所/物件所在地は全幅(col-12) */}
                        <div className="col-12">
                            <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>住所 / 物件所在地</label>
                            <input type="text" style={compactInputStyle} value={customerInfo.addr1 || customerInfo.addr || ''} onChange={e => setCustomerInfo({ ...customerInfo, addr1: e.target.value, addr: e.target.value })} />
                        </div>
                    </div>

                    {/* ==========================================
                        【中部】leadCategory によって切り替わる部分
                    ========================================== */}
                    <h6 className="fw-bold text-secondary mb-2 border-top pt-2" style={{ fontSize: '12px' }}>
                        <i className="bi bi-card-checklist me-1"></i>詳細・アクション設定
                    </h6>
                    <div className="row g-2 mb-3">
                        <div className="col-md-4">
                            <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>フェーズ</label>
                            <select style={compactInputStyle} value={customerInfo.phase || ''} onChange={e => setCustomerInfo({ ...customerInfo, phase: e.target.value })}>
                                <option value="">フェーズを選択</option>
                                {phaseList.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        
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
                                    <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日</label>
                                    <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                </div>
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
                                    <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回連絡日</label>
                                    <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                </div>
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
                                
                                {/* 💡 手数料入力: 手入力検知で文字色を変え、バッジを表示 */}
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
                                    <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション予定日</label>
                                    <input type="date" style={compactInputStyle} value={customerInfo.nextDate?.replace(/\//g, '-') || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextDate: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>次回アクション内容</label>
                                    <input type="text" style={compactInputStyle} value={customerInfo.nextNote || ''} onChange={e => setCustomerInfo({ ...customerInfo, nextNote: e.target.value })} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* ==========================================
                        【下部】共通表示部分 (備考)
                    ========================================== */}
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
                    
                    {/* ==========================================
                        💡 架電履歴・メモ追加部分（buy/sellのみ・完全統合）
                    ========================================== */}
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

                            {/* 履歴テーブル */}
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

                            {/* 新規メモ追加フォーム（高さ統一） */}
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
                                    {/* 💡 textareaはスクロールバーが出ないように高さをInputと合わせる */}
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
                </div>
            </Modal.Body>
            <Modal.Footer className="bg-light border-top-0 pt-0 pb-3 d-flex justify-content-end align-items-center">
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={onClose}>キャンセル</button>
                    <button className="btn btn-primary btn-sm px-4 fw-bold shadow-sm" style={{ fontSize: '11px' }} onClick={onSave}>保存する</button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default LeadEdit;