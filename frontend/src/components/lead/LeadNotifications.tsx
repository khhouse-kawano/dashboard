import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import { fetchNotices, markNoticesRead, isUnread, NoticeRow } from './leadUtiles';

// ==========================================
// 💡 通知ベル
//    自分（ログイン中の担当者）宛の通知を表示し、既読にする。
//    通知は担当変更などのタイミングで logs と一緒に書き込まれる。
// ==========================================

/** 通知種別ごとの見た目。未知の種別でも落ちないよう info にフォールバックする。 */
const TYPE_STYLE: Record<string, { icon: string; color: string; label: string }> = {
    assign: { icon: '📥', color: '#0d6efd', label: '担当割当' },
    unassign: { icon: '📤', color: '#6c757d', label: '担当解除' },
    cobroker: { icon: '🤝', color: '#198754', label: '協力会社' },
    info: { icon: 'ℹ️', color: '#6c757d', label: 'お知らせ' },
};

const styleOf = (type: string | null) => TYPE_STYLE[type ?? 'info'] ?? TYPE_STYLE.info;

/** '2026-08-26T11:00:00' → '8/26 11:00'。相対表記のほうが分かりやすい直近は「n分前」等にする。 */
const formatAt = (at: string | null): string => {
    if (!at) return '';
    const d = new Date(at.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return at;

    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'たった今';
    if (diffMin < 60) return `${diffMin}分前`;
    if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}時間前`;
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const styles = {
    wrapper: { position: 'relative', display: 'inline-block' } as React.CSSProperties,
    bell: {
        position: 'relative', height: '26px', padding: '0 10px', fontSize: '13px',
        border: '1px solid #ced4da', borderRadius: '4px', backgroundColor: '#fff',
        cursor: 'pointer', lineHeight: '24px',
    } as React.CSSProperties,
    badge: {
        position: 'absolute', top: '-6px', right: '-6px', minWidth: '16px', height: '16px',
        padding: '0 4px', borderRadius: '8px', backgroundColor: '#dc3545', color: '#fff',
        fontSize: '10px', fontWeight: 'bold', lineHeight: '16px', textAlign: 'center',
    } as React.CSSProperties,
    panel: {
        position: 'absolute', top: '30px', right: 0, width: '340px', maxHeight: '420px',
        overflowY: 'auto', backgroundColor: '#fff', border: '1px solid #dee2e6',
        borderRadius: '6px', boxShadow: '0 6px 18px rgba(0,0,0,0.15)', zIndex: 1050,
    } as React.CSSProperties,
    panelHead: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #dee2e6',
        position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1,
    } as React.CSSProperties,
    item: { padding: '8px 12px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' } as React.CSSProperties,
};

type Props = {
    /** 通知をクリックしたときに対象案件へ移動したい場合に指定する */
    onSelectNotice?: (notice: NoticeRow) => void;
};

const LeadNotifications: React.FC<Props> = ({ onSelectNotice }) => {
    const { userName } = useContext(AuthContext);

    const [isOpen, setIsOpen] = useState(false);
    const [notices, setNotices] = useState<NoticeRow[]>([]);
    const [unread, setUnread] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        if (!userName) return;
        setIsLoading(true);
        try {
            const result = await fetchNotices(userName, { limit: 50 });
            setNotices(result.notices);
            setUnread(result.unread);
        } catch (e) {
            // 通知の取得失敗で業務画面を止めたくないため、alert は出さずログのみ
            console.error('[LeadNotifications] 通知の取得に失敗しました', e);
        } finally {
            setIsLoading(false);
        }
    }, [userName]);

    // 初回と、以後は定期的に未読を取りに行く。
    // 担当変更は他人の操作で発生するため、画面を開いたままでも気づけるようにする。
    useEffect(() => {
        load();
        const timer = window.setInterval(load, 3 * 60 * 1000);
        return () => window.clearInterval(timer);
    }, [load]);

    // パネルの外側をクリックしたら閉じる
    useEffect(() => {
        if (!isOpen) return;
        const onClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [isOpen]);

    const handleOpen = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next) load();   // 開くたびに最新化する
    };

    const handleReadOne = async (notice: NoticeRow) => {
        onSelectNotice?.(notice);
        if (!userName || !isUnread(notice)) return;

        // 先に画面へ反映し、失敗したら戻す
        const snapshot = notices;
        const snapshotUnread = unread;
        setNotices(prev => prev.map(n => (n.id === notice.id ? { ...n, read: 1 } : n)));
        setUnread(prev => Math.max(0, prev - 1));
        try {
            const remaining = await markNoticesRead(userName, { ids: [notice.id] });
            setUnread(remaining);
        } catch (e) {
            console.error('[LeadNotifications] 既読処理に失敗しました', notice, e);
            setNotices(snapshot);
            setUnread(snapshotUnread);
        }
    };

    const handleReadAll = async () => {
        if (!userName || unread === 0) return;

        const snapshot = notices;
        const snapshotUnread = unread;
        setNotices(prev => prev.map(n => ({ ...n, read: 1 })));
        setUnread(0);
        try {
            const remaining = await markNoticesRead(userName, { all: true });
            setUnread(remaining);
        } catch (e) {
            console.error('[LeadNotifications] 一括既読に失敗しました', e);
            setNotices(snapshot);
            setUnread(snapshotUnread);
        }
    };

    // ログイン情報が無いと誰宛の通知か決められないので、ベル自体を出さない
    if (!userName) return null;

    return (
        <div style={styles.wrapper} ref={wrapperRef}>
            <button
                style={styles.bell}
                className="shadow-sm"
                onClick={handleOpen}
                title={unread > 0 ? `未読の通知が${unread}件あります` : '通知'}
            >
                🔔
                {unread > 0 && <span style={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
            </button>

            {isOpen && (
                <div style={styles.panel}>
                    <div style={styles.panelHead}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#495057' }}>
                            通知{unread > 0 ? `（未読 ${unread}件）` : ''}
                        </span>
                        <button
                            className="btn btn-link btn-sm p-0"
                            style={{ fontSize: '10px', textDecoration: 'none' }}
                            onClick={handleReadAll}
                            disabled={unread === 0}
                        >
                            すべて既読にする
                        </button>
                    </div>

                    {isLoading && notices.length === 0 && (
                        <div style={{ padding: '16px', fontSize: '11px', color: '#6c757d', textAlign: 'center' }}>読み込み中…</div>
                    )}

                    {!isLoading && notices.length === 0 && (
                        <div style={{ padding: '16px', fontSize: '11px', color: '#6c757d', textAlign: 'center' }}>通知はありません</div>
                    )}

                    {notices.map(notice => {
                        const unreadFlag = isUnread(notice);
                        const s = styleOf(notice.type);
                        return (
                            <div
                                key={notice.id}
                                style={{ ...styles.item, backgroundColor: unreadFlag ? '#f0f7ff' : '#fff' }}
                                onClick={() => handleReadOne(notice)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '12px' }}>{s.icon}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: s.color }}>{notice.title}</span>
                                    {unreadFlag && (
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc3545' }} />
                                    )}
                                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#adb5bd' }}>{formatAt(notice.at)}</span>
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#495057', lineHeight: 1.5 }}>{notice.body}</div>
                                <div style={{ fontSize: '9.5px', color: '#adb5bd', marginTop: '2px' }}>{notice.by} が変更</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LeadNotifications;
