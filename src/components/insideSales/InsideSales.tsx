import React, { useEffect, useState, useMemo } from 'react';
import Card from 'react-bootstrap/Card';
import apiClient from '../../utils/apiClient';
import { useIsSp } from '../../utils/isSp';

// ==========================================
// 💡 型定義
// ==========================================
type FlatLog = {
    logId: string; // アコーディオン制御用のユニークID
    name: string;
    shop: string;
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string;
};

// スペース除去ヘルパー
const removeSpaces = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[\s\u3000]+/g, '');
};

// YYYY-MM-DD フォーマットヘルパー
const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// 指定週の月〜日を取得するヘルパー
const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // 月曜始まり
    start.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    return days;
};

const InsideSales = () => {
    const isSp = useIsSp();
    
    // 💡 状態管理
    const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
    const [selectedStaff, setSelectedStaff] = useState<string>(''); // 初期値は空文字（全件表示）
    const [originalData, setOriginalData] = useState<Record<string, string>[]>([]);
    const [staffList, setStaffList] = useState<string[]>([]);
    const [baseDate, setBaseDate] = useState<Date>(new Date()); // 今日を基準
    const [expandedLogIds, setExpandedLogIds] = useState<string[]>([]);
    const [displayLimit, setDisplayLimit] = useState<number>(10);

    // ==========================================
    // 💡 データ取得
    // ==========================================
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'inside', roll: 'list' });
                if (response.data && response.data.call) {
                    setOriginalData(response.data.call);
                    // APIから取得したスタッフリストをセット
                    if (response.data.staff) {
                        setStaffList(response.data.staff.map((s: any) => s.name));
                    }
                }
            } catch (e) {
                console.error("データ取得エラー:", e);
            }
        };
        fetchData();
    }, []);

    // ==========================================
    // 💡 スクロール監視 (無限スクロール)
    // ==========================================
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100) {
                setDisplayLimit(prev => prev + 10);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 表示条件変更時に表示上限をリセット
    useEffect(() => {
        setDisplayLimit(10);
    }, [baseDate, viewMode, selectedStaff]);

    // ==========================================
    // 💡 データ加工・集計 (フラット化)
    // ==========================================
    const flatLogs = useMemo(() => {
        const logs: FlatLog[] = [];
        originalData.forEach((item, index) => {
            if (item.call_log) {
                try {
                    const parsed = JSON.parse(String(item.call_log));
                    parsed.forEach((log: any, logIndex: number) => {
                        logs.push({
                            logId: `${index}-${logIndex}`,
                            name: String(item.name || ''),
                            shop: String(item.shop || ''),
                            day: log.day || '',
                            time: log.time || '',
                            action: log.action || '',
                            note: log.note || '',
                            staff: log.staff || ''
                        });
                    });
                } catch (e) {
                    console.error("JSON Parse Error:", e);
                }
            }
        });
        // 時間順（昇順）にソート
        return logs.sort((a, b) => a.time.localeCompare(b.time));
    }, [originalData]);

    // セレクトボックス用のスタッフ一覧（万が一APIのstaff配列が無い場合のフォールバック含む）
    const uniqueStaffList = useMemo(() => {
        if (staffList.length > 0) return staffList;
        const names = flatLogs.map(l => removeSpaces(l.staff)).filter(Boolean);
        return Array.from(new Set(names));
    }, [flatLogs, staffList]);

    // 💡 担当者でフィルタリング
    const filteredLogs = useMemo(() => {
        // 未選択（空文字）の場合は全件表示
        if (!selectedStaff) return flatLogs;
        return flatLogs.filter(l => removeSpaces(l.staff) === selectedStaff);
    }, [flatLogs, selectedStaff]);

    // カレンダーの表示日付
    const targetDays = useMemo(() => {
        if (viewMode === 'day') return [baseDate];
        return getWeekDays(baseDate);
    }, [baseDate, viewMode]);

    // ==========================================
    // 💡 操作ハンドラー
    // ==========================================
    const handlePrev = () => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 1));
        setBaseDate(d);
    };

    const handleNext = () => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 1));
        setBaseDate(d);
    };

    const handleToday = () => setBaseDate(new Date());

    const toggleExpand = (logId: string) => {
        setExpandedLogIds(prev => 
            prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]
        );
    };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%' }}>
            {/* ヘッダー・コントロール群 */}
            <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 border-bottom pb-3 gap-3">
                <h4 className="fw-bold text-secondary mb-0" style={{ letterSpacing: '1px', paddingTop: isSp ? '30px' : '' }}>
                    <i className="bi bi-telephone-outbound me-2 text-primary"></i>架電履歴カレンダー
                </h4>

                <div className="d-flex align-items-center gap-3">
                    {/* スタッフ選択 */}
                    <div className="d-flex align-items-center">
                        <label className="text-muted fw-bold me-2 mb-0" style={{ fontSize: '12px' }}>担当者</label>
                        <select
                            className="form-select form-select-sm shadow-sm border-primary fw-bold text-primary"
                            style={{ width: '150px', cursor: 'pointer' }}
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                        >
                            <option value="">全員を表示</option>
                            {uniqueStaffList.map(s => <option key={s} value={removeSpaces(s)}>{s}</option>)}
                        </select>
                    </div>

                    {/* 日/週 切り替えトグル */}
                    <div className="btn-group shadow-sm" role="group">
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
                            onClick={() => setViewMode('week')}
                        >
                            週
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
                            onClick={() => setViewMode('day')}
                        >
                            日
                        </button>
                    </div>
                </div>
            </div>

            {/* カレンダー操作パネル */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-white border shadow-sm fw-bold text-secondary px-3" onClick={handlePrev}>
                        <i className="bi bi-chevron-left me-1"></i>前
                    </button>
                    <button className="btn btn-sm btn-white border shadow-sm fw-bold text-primary px-3" onClick={handleToday}>
                        今日
                    </button>
                </div>
                <h5 className="fw-bold text-dark mb-0 px-2" style={{ fontSize: 'min(4vw, 16px)' }}>
                    {viewMode === 'week'
                        ? `${formatDate(targetDays[0])} 〜 ${formatDate(targetDays[6])}`
                        : formatDate(targetDays[0])
                    }
                </h5>
                <button className="btn btn-sm btn-white border shadow-sm fw-bold text-secondary px-3" onClick={handleNext}>
                    次<i className="bi bi-chevron-right ms-1"></i>
                </button>
            </div>

            {/* 💡 横幅100%固定・スクロールラッパー */}
            <div className="w-100" style={{ overflowX: 'auto', paddingBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: viewMode === 'week' ? 'repeat(7, 1fr)' : '1fr',
                        gap: '12px',
                        minWidth: viewMode === 'week' ? '1400px' : '100%' 
                    }}
                >
                    {targetDays.map(d => {
                        const dateStr = formatDate(d);
                        const dayLogs = filteredLogs.filter(l => l.day === dateStr);
                        const weekDayStr = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
                        const isToday = dateStr === formatDate(new Date());

                        return (
                            <div key={dateStr} className="d-flex flex-column">
                                {/* 日付ヘッダー */}
                                <div className={`text-center fw-bold mb-2 p-2 rounded shadow-sm border ${isToday ? 'border-primary bg-primary text-white' : 'border-light bg-white'}`}>
                                    <span style={{ fontSize: '13px', color: isToday ? '#fff' : (d.getDay() === 0 ? '#e53e3e' : d.getDay() === 6 ? '#3182ce' : '#4a5568') }}>
                                        {dateStr} ({weekDayStr})
                                    </span>
                                </div>

                                {/* 架電カードリスト */}
                                <div className="d-flex flex-column gap-2" style={{ flexGrow: 1, backgroundColor: '#f4f5f7', padding: '8px', borderRadius: '6px' }}>
                                    {dayLogs.length > 0 ? (
                                        dayLogs.slice(0, displayLimit).map((log) => {
                                            const isExpanded = expandedLogIds.includes(log.logId);
                                            const isLongNote = log.note.length > 20;
                                            const truncatedNote = isLongNote ? log.note.substring(0, 20) + '...' : log.note;

                                            return (
                                                <Card 
                                                    key={log.logId} 
                                                    className="shadow-sm border-0" 
                                                    style={{ borderLeft: '3px solid #5e72e4' }}
                                                >
                                                    <Card.Body className="p-2">
                                                        {/* 1行目: 時間 / 店舗 / アクション */}
                                                        <div className="d-flex justify-content-between align-items-center mb-1 gap-2">
                                                            <div className="d-flex align-items-center gap-2 text-muted fw-bold" style={{ fontSize: '10px' }}>
                                                                <span>{log.time}</span>
                                                                <span><i className="bi bi-shop me-1"></i>{log.shop}</span>
                                                            </div>
                                                            <span className="badge bg-light text-primary border border-primary px-1 py-0" style={{ fontSize: '9px' }}>
                                                                {log.action}
                                                            </span>
                                                        </div>

                                                        {/* 💡 顧客名 と 架電スタッフ（未選択時） */}
                                                        <div className="d-flex justify-content-between align-items-center mb-2 gap-1">
                                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '12px' }}>
                                                                {log.name} 様
                                                            </div>
                                                            {/* 担当者が全員表示(空文字)の場合は、誰が架電したかわかるようにバッジを表示 */}
                                                            {!selectedStaff && (
                                                                <span className="badge bg-secondary text-white" style={{ fontSize: '9px', fontWeight: 'normal' }}>
                                                                    <i className="bi bi-headset me-1"></i>{log.staff}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* note表示 (クリック展開) */}
                                                        <div 
                                                            className="text-secondary p-2 rounded" 
                                                            style={{ 
                                                                fontSize: '11px', 
                                                                whiteSpace: 'pre-wrap', 
                                                                wordBreak: 'break-word',
                                                                backgroundColor: isExpanded ? '#fffaf0' : '#f8f9fa',
                                                                cursor: isLongNote ? 'pointer' : 'default',
                                                                transition: 'background-color 0.2s'
                                                            }}
                                                            onClick={() => isLongNote && toggleExpand(log.logId)}
                                                        >
                                                            {isExpanded ? log.note : truncatedNote}
                                                            
                                                            {isLongNote && (
                                                                <div className="text-primary text-end mt-1 fw-bold" style={{ fontSize: '9px' }}>
                                                                    {isExpanded ? (
                                                                        <span><i className="bi bi-chevron-up"></i> 閉じる</span>
                                                                    ) : (
                                                                        <span><i className="bi bi-chevron-down"></i> 続きを読む</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center text-muted p-2" style={{ fontSize: '10px' }}>
                                            -
                                        </div>
                                    )}
                                    {/* さらに表示のアナウンス */}
                                    {dayLogs.length > displayLimit && (
                                        <div className="text-center text-muted mt-2" style={{ fontSize: '10px' }}>
                                            ...スクロールしてさらに表示
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default InsideSales;