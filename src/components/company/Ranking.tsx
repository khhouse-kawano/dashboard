import React, { useContext, useEffect, useState } from 'react';
import { Modal, Table, Badge } from 'react-bootstrap';
import AuthContext from "../../context/AuthContext";

type Customer = Record<string, string>;

type RankedStaff = {
    name: string;
    shop: string;
    totalCount: number;
    periodCount: number;
    rank: number;
};

type Props = {
    showRanking: boolean,
    setShowRanking: React.Dispatch<React.SetStateAction<boolean>>,
    customerList: Customer[],
    monthArray: string[]
};

const Ranking = ({ showRanking, setShowRanking, customerList, monthArray }: Props) => {
    const { category } = useContext(AuthContext);
    const [targetCustomer, setTargetCustomer] = useState<RankedStaff[]>([]);
    
    // 💡 期間絞り込み用のState
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

    // 💡 ソート用のState
    const [sortConfig, setSortConfig] = useState<{ key: 'total' | 'period', direction: 'desc' | 'asc' }>({ 
        key: 'total', 
        direction: 'desc' 
    });

    const formate = (value: string) => {
        return (value ?? '').replace(/\//g, '-').slice(0, 7);
    };

    useEffect(() => {
        if (customerList.length === 0) return;
        const categoryMapping: Record<string, string> = {
            'order': '注文', 'spec': '建売'
        };

        // ベースとなる全体の契約済みリスト
        const baseFiltered = customerList.filter(c =>
            c.category === categoryMapping[category] &&
            c.status === '契約済み' &&
            monthArray.includes(formate(c.contract))
        );

        const uniqueName = [...new Set(baseFiltered.map(f => f.staff))];
        
        // 💡 総計と期間計の両方をあらかじめ計算する
        let formattedList = uniqueName.map(u => {
            const target = baseFiltered.filter(f => f.staff === u);
            
            const periodTarget = target.filter(c => 
                (!startMonth || formate(c.contract) >= startMonth) &&
                (!endMonth || formate(c.contract) <= endMonth)
            );

            return {
                name: u,
                shop: target[0]?.shop ?? '',
                totalCount: target.length,
                periodCount: periodTarget.length
            };
        });

        // 💡 選択されているキーと向きでソート
        formattedList.sort((a, b) => {
            const valA = sortConfig.key === 'total' ? a.totalCount : a.periodCount;
            const valB = sortConfig.key === 'total' ? b.totalCount : b.periodCount;
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // 同着を考慮した順位付け
        let previousValue = -1;
        let actualRank = 1;

        const rankedList: RankedStaff[] = formattedList.map((item, index) => {
            const currentValue = sortConfig.key === 'total' ? item.totalCount : item.periodCount;
            if (currentValue !== previousValue) {
                actualRank = index + 1;
            }
            previousValue = currentValue;
            return { ...item, rank: actualRank };
        });

        // フェアな足切りロジック
        let displayList = rankedList;
        if (rankedList.length > 10) {
            const thresholdScore = sortConfig.key === 'total' ? rankedList[9].totalCount : rankedList[9].periodCount;
            displayList = rankedList.filter(item => {
                const val = sortConfig.key === 'total' ? item.totalCount : item.periodCount;
                if (sortConfig.direction === 'desc') return val >= thresholdScore;
                return val <= thresholdScore;
            });
        }

        setTargetCustomer(displayList);
    }, [customerList, monthArray, category, startMonth, endMonth, sortConfig]);

    // 💡 ソートが昇順(asc)の時はワーストランキングになるため王冠を外す配慮
    const renderRankIcon = (rank: number) => {
        if (sortConfig.direction === 'asc') return `${rank}位`;
        
        if (rank === 1) return <><i className="fa-solid fa-crown text-warning me-1"></i>1位</>;
        if (rank === 2) return <><i className="fa-solid fa-crown me-1" style={{ color: '#C0C0C0' }}></i>2位</>;
        if (rank === 3) return <><i className="fa-solid fa-crown me-1" style={{ color: '#CD7F32' }}></i>3位</>;
        return `${rank}位`;
    };

    // ソートの切り替えハンドラー
    const handleSort = (key: 'total' | 'period') => {
        let direction: 'desc' | 'asc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // ソートアイコンの取得
    const getSortIcon = (key: 'total' | 'period') => {
        if (sortConfig.key !== key) return <i className="fa-solid fa-sort ms-1" style={{ color: '#dee2e6' }}></i>;
        return sortConfig.direction === 'desc' 
            ? <i className="fa-solid fa-sort-down ms-1 text-primary"></i> 
            : <i className="fa-solid fa-sort-up ms-1 text-primary"></i>;
    };

    const showPeriodCol = startMonth !== '' || endMonth !== '';

    return (
        <Modal show={showRanking} onHide={() => setShowRanking(false)} centered>
            <Modal.Header closeButton className="bg-light border-bottom-0 py-2">
                <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
                    <i className="fa-solid fa-ranking-star me-2 text-primary"></i>
                    {category === 'order' ? '注文事業' : '建売事業'} 契約ランキング
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">
                
                {/* 期間選択フィルターバー */}
                <div className="d-flex align-items-center justify-content-end gap-2 px-3 py-2 bg-light border-bottom">
                    <div className="d-flex align-items-center gap-1">
                        <label className="text-muted mb-0 fw-bold" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>開始月</label>
                        <select 
                            className="form-select form-select-sm shadow-sm" 
                            style={{ width: '100px', fontSize: '11px', cursor: 'pointer' }} 
                            value={startMonth} 
                            onChange={e => setStartMonth(e.target.value)}
                        >
                            <option value="">未選択</option>
                            {monthArray.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
                        </select>
                    </div>
                    <span className="text-muted" style={{ fontSize: '11px' }}>〜</span>
                    <div className="d-flex align-items-center gap-1">
                        <label className="text-muted mb-0 fw-bold" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>終了月</label>
                        <select 
                            className="form-select form-select-sm shadow-sm" 
                            style={{ width: '100px', fontSize: '11px', cursor: 'pointer' }} 
                            value={endMonth} 
                            onChange={e => setEndMonth(e.target.value)}
                        >
                            <option value="">未選択</option>
                            {monthArray.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
                        </select>
                    </div>
                </div>

                {/* 💡 ダッシュボードらしくフォントサイズと余白を小さく(12px / py-2) */}
                <Table hover className="align-middle mb-0 text-center" style={{ fontSize: '12px' }}>
                    <thead className="bg-light text-muted">
                        <tr>
                            <th className="py-2" style={{ width: '60px' }}>順位</th>
                            <th className="py-2 text-start">氏名</th>
                            <th className="py-2">所属</th>
                            
                            {showPeriodCol && (
                                <th 
                                    className="py-2 text-info" 
                                    style={{ width: '80px', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => handleSort('period')}
                                >
                                    期間計 {getSortIcon('period')}
                                </th>
                            )}
                            
                            <th 
                                className="py-2" 
                                style={{ width: '80px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('total')}
                            >
                                総計 {getSortIcon('total')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {targetCustomer.map((item, index) => (
                            <tr key={`${item.name}_${index}`} className={item.rank <= 3 && sortConfig.direction === 'desc' ? "fw-bold" : ""}>
                                <td className="py-2">
                                    {item.rank <= 3 && sortConfig.direction === 'desc' ? (
                                        <span style={{ fontSize: '13px' }}>{renderRankIcon(item.rank)}</span>
                                    ) : (
                                        <Badge bg="secondary" pill className="fw-normal">{item.rank}</Badge>
                                    )}
                                </td>
                                <td className="text-start py-2">{item.name}</td>
                                <td className="text-muted py-2" style={{ fontSize: '11px' }}>{item.shop}</td>
                                
                                {showPeriodCol && (
                                    <td className="text-info fw-bold py-2" style={{ fontSize: '13px' }}>{item.periodCount}</td>
                                )}
                                
                                <td className="text-primary fw-bold py-2" style={{ fontSize: '13px' }}>{item.totalCount}</td>
                            </tr>
                        ))}
                        {targetCustomer.length === 0 && (
                            <tr>
                                <td colSpan={showPeriodCol ? 5 : 4} className="py-4 text-muted">該当するデータがありません</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Modal.Body>
        </Modal>
    );
};

export default Ranking;