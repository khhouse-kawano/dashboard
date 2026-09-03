import React, { useContext, useEffect, useState } from 'react';
import { Modal, Table, Badge, Nav } from 'react-bootstrap';
import AuthContext from "../../context/AuthContext";
type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };

type Customer = Record<string, string>;

/** 予算。Company.tsx と同じ形。category = 'shop' の行を店舗別ランキングで使う */
type Achievement = { category: string, name: string, period: string, value: string };

/** 集計の単位。個人別＝担当者ごと、店舗別＝店舗ごと */
type RankMode = 'staff' | 'shop';

/**
 * ランキング1行。
 *
 * 個人別と店舗別で表の構造は同じなので、意味だけを差し替えて使い回す。
 *   個人別 … label = 氏名 / sub = 所属店舗
 *   店舗別 … label = 店舗 / sub = 課
 */
type RankedRow = {
    label: string;
    sub: string;
    totalCount: number;
    periodCount: number;
    /** 予算。店舗別のときだけ使う。個人別では常に0 */
    budget: number;
    rank: number;
};

type Props = {
    showRanking: boolean,
    setShowRanking: React.Dispatch<React.SetStateAction<boolean>>,
    customerList: Customer[],
    monthArray: string[],
    staffList: Staff[],
    achievement: Achievement[]
};

const Ranking = ({ showRanking, setShowRanking, customerList, monthArray, staffList, achievement }: Props) => {
    const { category, authority } = useContext(AuthContext);
    const [targetCustomer, setTargetCustomer] = useState<RankedRow[]>([]);

    // 既定は個人別。従来の挙動を変えない
    const [mode, setMode] = useState<RankMode>('staff');

    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

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

        const targetStaff = staffList.map(s => s.name);

        // 💡 1. 集計対象の母集団。
        //
        //    ⚠️ 個人別・店舗別のどちらも「staffList に載っている担当者の契約」だけを数える。
        //      店舗別で担当者を問わず数えると、個人別の合計と店舗別の合計が一致せず
        //      「どちらが正しいのか」という問い合わせが必ず発生する。
        const inCategory = customerList.filter(c =>
            c.category === categoryMapping[category] &&
            c.staff && targetStaff.includes(c.staff)
        );

        // 実績0でも一覧に出すため、契約の有無に関わらず存在する値を集める
        const uniqueKeys = [...new Set(
            inCategory
                .map(c => mode === 'staff' ? c.staff : c.shop)
                .filter(v => v) // 空白やnullを除外
        )];

        // 💡 2. カウント用の契約済みベースリスト
        const baseFiltered = inCategory.filter(c =>
            c.status === '契約済み' &&
            monthArray.includes(formate(c.contract))
        );

        // 店舗 → 課。店舗別のときの「所属」列に使う
        const sectionByShop = new Map<string, string>();
        staffList.forEach(s => {
            if (s.shop && s.section && !sectionByShop.has(s.shop)) {
                sectionByShop.set(s.shop, s.section);
            }
        });

        let formattedList = uniqueKeys.map(key => {
            // カウント対象のデータ
            const target = baseFiltered.filter(f => (mode === 'staff' ? f.staff : f.shop) === key);

            const periodTarget = target.filter(c =>
                (!startMonth || formate(c.contract) >= startMonth) &&
                (!endMonth || formate(c.contract) <= endMonth)
            );

            // 個人別のときの所属店舗。
            // 実績0の場合 target が空になるため、母集団側から探す
            const sub = mode === 'staff'
                ? (inCategory.find(c => c.staff === key)?.shop ?? '')
                : (sectionByShop.get(key) ?? '');

            // 予算。店舗別のときだけ集計する。
            //
            // ⚠️ 期間が未指定なら monthArray 全体（＝総計に対応する予算）、
            //   指定されていればその範囲（＝期間計に対応する予算）を合計する。
            //   表示している実績と期間が揃っていないと比較の意味がなくなる。
            const budget = mode === 'shop'
                ? achievement
                    .filter(a => {
                        if (a.category !== 'shop' || a.name !== key) return false;
                        const period = formate(a.period);
                        if (!monthArray.includes(period)) return false;
                        if (startMonth && period < startMonth) return false;
                        if (endMonth && period > endMonth) return false;
                        return true;
                    })
                    // ⚠️ value は文字列。空欄や全角数字が入りうるので Number() が NaN になりうる
                    .reduce((sum, a) => sum + (Number(a.value) || 0), 0)
                : 0;

            return {
                label: key,
                sub,
                totalCount: target.length,
                periodCount: periodTarget.length,
                budget
            };
        });

        // 💡 3. ソート処理
        formattedList.sort((a, b) => {
            const valA = sortConfig.key === 'total' ? a.totalCount : a.periodCount;
            const valB = sortConfig.key === 'total' ? b.totalCount : b.periodCount;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // 💡 4. 同着を考慮した順位付け
        let previousValue = -1;
        let actualRank = 1;

        const rankedList: RankedRow[] = formattedList.map((item, index) => {
            const currentValue = sortConfig.key === 'total' ? item.totalCount : item.periodCount;
            if (currentValue !== previousValue) {
                actualRank = index + 1;
            }
            previousValue = currentValue;
            return { ...item, rank: actualRank };
        });

        // 💡 5. フェアな足切りロジック（Master権限の場合は全件表示）
        let displayList = rankedList;
        if (authority !== 'Master' && rankedList.length > 10) {
            const thresholdScore = sortConfig.key === 'total' ? rankedList[9].totalCount : rankedList[9].periodCount;
            displayList = rankedList.filter(item => {
                const val = sortConfig.key === 'total' ? item.totalCount : item.periodCount;
                if (sortConfig.direction === 'desc') return val >= thresholdScore;
                return val <= thresholdScore;
            });
        }

        setTargetCustomer(displayList);
    }, [customerList, monthArray, category, authority, startMonth, endMonth, sortConfig, staffList, mode, achievement]);

    const renderRankIcon = (rank: number) => {
        if (sortConfig.direction === 'asc') return `${rank}位`;

        if (rank === 1) return <><i className="fa-solid fa-crown text-warning me-1"></i>1位</>;
        if (rank === 2) return <><i className="fa-solid fa-crown me-1" style={{ color: '#C0C0C0' }}></i>2位</>;
        if (rank === 3) return <><i className="fa-solid fa-crown me-1" style={{ color: '#CD7F32' }}></i>3位</>;
        return `${rank}位`;
    };

    const handleSort = (key: 'total' | 'period') => {
        let direction: 'desc' | 'asc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: 'total' | 'period') => {
        if (sortConfig.key !== key) return <i className="fa-solid fa-sort ms-1" style={{ color: '#dee2e6' }}></i>;
        return sortConfig.direction === 'desc'
            ? <i className="fa-solid fa-sort-down ms-1 text-primary"></i>
            : <i className="fa-solid fa-sort-up ms-1 text-primary"></i>;
    };

    const showPeriodCol = startMonth !== '' || endMonth !== '';

    /**
     * 達成率（%）。小数第一位を切り上げた整数で返す。
     *
     * ⚠️ 予算が0だと Infinity、実績も0だと NaN になる。
     *   予算未設定の店舗が「Infinity%」と表示されるのを防ぐため 0% に丸める。
     */
    const achievementRate = (count: number, budget: number): number => {
        const rate = (count / budget) * 100;
        if (!Number.isFinite(rate)) return 0;
        return Math.ceil(rate);
    };

    /**
     * 達成率を出す対象の列。
     *
     * ⚠️ 予算は期間指定の有無で総計分／期間分が切り替わる（集計側の budget）。
     *   達成率もそれに合わせないと「総計の実績 ÷ 期間の予算」になり、
     *   意味のない数字が出る。
     */
    const rateBaseIsPeriod = showPeriodCol;

    return (
        <Modal show={showRanking} onHide={() => setShowRanking(false)} centered>
            <Modal.Header closeButton className="bg-light border-bottom-0 py-2">
                <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
                    <i className="fa-solid fa-ranking-star me-2 text-primary"></i>
                    {category === 'order' ? '注文事業' : '建売事業'} 契約ランキング
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">

                {/* 集計単位の切り替え。既定は個人別（従来の表示） */}
                <Nav
                    variant="tabs"
                    activeKey={mode}
                    onSelect={(key) => setMode(key === 'shop' ? 'shop' : 'staff')}
                    className="px-2 pt-2 bg-light"
                >
                    <Nav.Item>
                        <Nav.Link eventKey="staff" className="py-1 px-3" style={{ fontSize: '12px' }}>
                            <i className="fa-solid fa-user me-1"></i>個人別
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="shop" className="py-1 px-3" style={{ fontSize: '12px' }}>
                            <i className="fa-solid fa-store me-1"></i>店舗別
                        </Nav.Link>
                    </Nav.Item>
                </Nav>

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

                <Table hover className="align-middle mb-0 text-center" style={{ fontSize: '12px' }}>
                    <thead className="bg-light text-muted">
                        <tr>
                            <th className="py-2" style={{ width: '60px' }}>順位</th>
                            <th className="py-2 text-start">{mode === 'staff' ? '氏名' : '店舗'}</th>
                            <th className="py-2">{mode === 'staff' ? '所属' : '課'}</th>

                            {/* 予算。期間の指定に合わせて総計／期間計のどちらかに対応する */}
                            {mode === 'shop' && (
                                <th className="py-2 text-danger" style={{ width: '70px' }}>予算</th>
                            )}

                            {showPeriodCol && (
                                <th
                                    className="py-2 text-info"
                                    style={{ width: mode === 'shop' ? '110px' : '80px', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => handleSort('period')}
                                >
                                    期間計{mode === 'shop' && rateBaseIsPeriod ? '(達成率)' : ''} {getSortIcon('period')}
                                </th>
                            )}

                            <th
                                className="py-2"
                                style={{ width: mode === 'shop' && !rateBaseIsPeriod ? '110px' : '80px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('total')}
                            >
                                総計{mode === 'shop' && !rateBaseIsPeriod ? '(達成率)' : ''} {getSortIcon('total')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {targetCustomer.map((item, index) => (
                            <tr key={`${item.label}_${index}`} className={item.rank <= 3 && sortConfig.direction === 'desc' ? "fw-bold" : ""}>
                                <td className="py-2">
                                    {item.rank <= 3 && sortConfig.direction === 'desc' ? (
                                        <span style={{ fontSize: '13px' }}>{renderRankIcon(item.rank)}</span>
                                    ) : (
                                        <Badge bg="secondary" pill className="fw-normal">{item.rank}</Badge>
                                    )}
                                </td>
                                <td className="text-start py-2">{item.label}</td>
                                <td className="text-muted py-2" style={{ fontSize: '11px' }}>{item.sub}</td>

                                {mode === 'shop' && (
                                    <td className="text-danger fw-bold py-2" style={{ fontSize: '13px' }}>{item.budget}</td>
                                )}

                                {showPeriodCol && (
                                    <td className="text-info fw-bold py-2" style={{ fontSize: '13px' }}>
                                        {item.periodCount}
                                        {mode === 'shop' && rateBaseIsPeriod && (
                                            <span className="fw-normal ms-1" style={{ fontSize: '11px' }}>
                                                ({achievementRate(item.periodCount, item.budget)}%)
                                            </span>
                                        )}
                                    </td>
                                )}

                                <td className="text-primary fw-bold py-2" style={{ fontSize: '13px' }}>
                                    {item.totalCount}
                                    {mode === 'shop' && !rateBaseIsPeriod && (
                                        <span className="fw-normal ms-1" style={{ fontSize: '11px' }}>
                                            ({achievementRate(item.totalCount, item.budget)}%)
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {targetCustomer.length === 0 && (
                            <tr>
                                <td colSpan={4 + (showPeriodCol ? 1 : 0) + (mode === 'shop' ? 1 : 0)} className="py-4 text-muted">該当するデータがありません</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Modal.Body>
        </Modal>
    );
};

export default Ranking;