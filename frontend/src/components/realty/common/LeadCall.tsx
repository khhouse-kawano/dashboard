import React, { useRef, useMemo, useState, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { NEXT_QUICK, addDaysISO } from './leadUtiles';

export type CallLog = {
    date: string | null;
    type: string | null; // 'call' | 'sms' | 'mail'
    staff: string | null;
    note: string | null | undefined;
};

export type LeadCallProps = {
    isOpen: boolean;
    onClose: () => void;
    targetLead: any;
    userName: string;
    // 💡 追加: 記録と同時に次回連絡日・内容も更新できるよう拡張（未指定なら従来どおり次回連絡日は変更しない）
    onSaveLog: (leadId: string, updatedCallDatesJson: string, nextDate?: string, nextNote?: string) => void;
};

// ==========================================
// 💡 ヘルパー関数
// ==========================================
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

// ==========================================
// 💡 保守性を高める工夫1: スタイルの一元管理
// ==========================================
const customStyles = {
    inputBase: {
        width: '100%',
        boxSizing: 'border-box',
        fontSize: '11px',
        padding: '4px 8px',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        height: '28px', // 💡 ここで高さを完全固定
        color: '#495057',
        backgroundColor: '#fff',
        outline: 'none',
        appearance: 'none', // 💡 BootstrapやOS固有の矢印・スタイルを完全リセット
    } as React.CSSProperties,
    btnPrimary: {
        backgroundColor: '#0d6efd',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        padding: '0 16px',
        fontSize: '11px',
        fontWeight: 'bold',
        height: '26px',
        cursor: 'pointer',
    } as React.CSSProperties,
    btnSecondary: {
        backgroundColor: '#fff',
        color: '#6c757d',
        border: '1px solid #ced4da',
        borderRadius: '4px',
        padding: '0 16px',
        fontSize: '11px',
        fontWeight: 'bold',
        height: '26px',
        cursor: 'pointer',
    } as React.CSSProperties,
};

// ==========================================
// 💡 保守性を高める工夫2: フォームの共通部品化
// ==========================================
const FormGroup = ({ label, width, children }: { label: string, width?: string, children: React.ReactNode }) => (
    <div style={{ width: width || 'auto', flexGrow: width ? 0 : 1 }}>
        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '4px', display: 'block' }}>
            {label}
        </label>
        {children}
    </div>
);

const LeadCall: React.FC<LeadCallProps> = ({
    isOpen,
    onClose,
    targetLead,
    userName,
    onSaveLog
}) => {
    const memoTimeRef = useRef<HTMLInputElement>(null);
    const memoTypeRef = useRef<HTMLSelectElement>(null);
    const memoTextRef = useRef<HTMLTextAreaElement>(null);

    // 💡 次回連絡日・次回アクション内容（source.html の nextBar() 相当）
    const [nextDate, setNextDate] = useState('');
    const [nextNote, setNextNote] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setNextDate(targetLead?.nextDate ? String(targetLead.nextDate).replace(/\//g, '-') : '');
        setNextNote(targetLead?.nextNote || '');
    }, [isOpen, targetLead]);

    const sortedCallLogs = useMemo(() => {
        if (!targetLead?.callDates) return [];
        try {
            const logs: CallLog[] = JSON.parse(targetLead.callDates);
            return logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        } catch (e) {
            return [];
        }
    }, [targetLead]);

    const handleAddMemo = () => {
        const time = memoTimeRef.current?.value;
        const type = memoTypeRef.current?.value;
        const note = memoTextRef.current?.value;
        if (!time || !type || !targetLead) return;

        let logs: CallLog[] = [];
        try {
            logs = JSON.parse(targetLead.callDates || '[]');
        } catch (e) { }

        logs.push({ date: time, type, staff: userName || '不明', note });
        const updatedCallDates = JSON.stringify(logs);

        onSaveLog(targetLead.id, updatedCallDates, nextDate, nextNote);

        if (memoTimeRef.current) memoTimeRef.current.value = getCurrentDateTime();
        if (memoTextRef.current) memoTextRef.current.value = '';
        if (memoTypeRef.current) memoTypeRef.current.value = 'call';
        onClose();
    };

    return (
        <Modal show={isOpen} onHide={onClose} centered size="lg">
            <Modal.Header closeButton className="border-bottom-0 pb-0 bg-light pt-2 px-3">
                <Modal.Title className="fw-bold text-secondary" style={{ fontSize: '14px' }}>
                    <i className="bi bi-journal-text me-2 text-primary"></i>架電履歴・メモ
                    <span className="ms-2 text-dark" style={{ fontSize: '13px' }}>
                        {targetLead?.seller || targetLead?.name || '不明'} 様
                    </span>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="pt-2 pb-3 px-3 bg-light">
                {/* 履歴表示エリア */}
                <div className="mb-3 bg-white rounded shadow-sm border p-2" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '11px' }}>これまでの履歴</h6>
                    {sortedCallLogs.length > 0 ? (
                        <Table size="sm" className="mb-0 align-middle" style={{ fontSize: '10px' }}>
                            <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th className="text-muted py-1">日時</th>
                                    <th className="text-muted py-1">アクション</th>
                                    <th className="text-muted py-1">担当</th>
                                    <th className="text-muted w-50 py-1">メモ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCallLogs.map((log, idx) => (
                                    <tr key={idx}>
                                        <td className="fw-bold text-dark py-1">
                                            {formatDate(log.date ? new Date(log.date) : null)} {log.date?.slice(11, 16)}
                                        </td>
                                        <td className="py-1">
                                            <span className="badge bg-light text-primary border" style={{ fontSize: '9px' }}>
                                                {actionTypeMap[log.type || ''] || log.type}
                                            </span>
                                        </td>
                                        <td className="py-1 text-muted">{log.staff}</td>
                                        <td className="py-1 text-muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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

                {/* 新規追加フォームエリア */}
                <div className="bg-white rounded shadow-sm border p-3">
                    <h6 className="fw-bold text-secondary mb-3" style={{ fontSize: '11px' }}>新規履歴を追加</h6>
                    
                    {/* 💡 Bootstrapクラスを排除し、独自の共通コンポーネントで構築 */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <FormGroup label="日時" width="150px">
                            <input type="datetime-local" style={customStyles.inputBase} defaultValue={getCurrentDateTime()} ref={memoTimeRef} />
                        </FormGroup>

                        <FormGroup label="アクション" width="100px">
                            <select style={{ ...customStyles.inputBase, cursor: 'pointer' }} defaultValue="call" ref={memoTypeRef}>
                                <option value="call">架電</option>
                                <option value="sms">SMS送信</option>
                                <option value="mail">メール送信</option>
                            </select>
                        </FormGroup>

                        <FormGroup label="メモ内容">
                            {/* textareaも高さを28pxに固定し、1行入力として扱う */}
                            <textarea style={{ ...customStyles.inputBase, resize: 'none', lineHeight: '18px' }} placeholder="内容を入力してください..." ref={memoTextRef}></textarea>
                        </FormGroup>
                    </div>

                    {/* 💡 次回連絡予定（架電のたびに次のアクションを決めてから閉じる） */}
                    <div className="mt-3 pt-3 border-top">
                        <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '11px' }}>
                            <i className="bi bi-calendar-check me-1 text-primary"></i>次回連絡予定
                        </h6>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {NEXT_QUICK.map(q => (
                                <button
                                    key={q.label}
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: '10px' }}
                                    onClick={() => setNextDate(addDaysISO(null, q.days))}
                                >
                                    {q.label}
                                </button>
                            ))}
                            {nextDate && (
                                <button className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => setNextDate('')}>
                                    クリア
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <FormGroup label="次回連絡日" width="150px">
                                <input type="date" style={customStyles.inputBase} value={nextDate} onChange={e => setNextDate(e.target.value)} />
                            </FormGroup>
                            <FormGroup label="次回アクション内容">
                                <input type="text" style={customStyles.inputBase} placeholder="例）折り返し連絡・資料送付 など" value={nextNote} onChange={e => setNextNote(e.target.value)} />
                            </FormGroup>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', marginTop: '16px' }}>
                        <button style={customStyles.btnSecondary} onClick={onClose}>キャンセル</button>
                        <button style={{ ...customStyles.btnPrimary, marginLeft: '8px' }} onClick={handleAddMemo}>追加する</button>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default LeadCall;