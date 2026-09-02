import React, { useEffect, useState, useMemo, useContext } from 'react';
import Table from 'react-bootstrap/Table';
import Card from 'react-bootstrap/Card';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';
import apiClient from '../utils/apiClient';
import { thisYear } from '../utils/thisYear';

// ==========================================
// 💡 型定義
// ==========================================
type BrokerageListing = {
    id: string;
    kind: string | null;
    staff: string | null;
    fee: string | number | null;
    price: string | number | null;
    feeManual: string | number | boolean | null;
    contractDate: string | null; // YYYY-MM-DD
    phase: string | null;
    customer?: string | null;
    [key: string]: any;
};

type Staff = Record<string, string>;

type ModalItem = {
    customer: string;
    contractDate: string;
    fee: number;
};

const positions = ['常務', '部長', '課長', '課長代理', '店長', '店長代理', '一般'];

// 6月始まりの会計年度に対応した月の配列
const FISCAL_MONTHS = ['06', '07', '08', '09', '10', '11', '12', '01', '02', '03', '04', '05'];

// 担当者ごとの年間目標
const TARGET_SALES: Record<string, number> = {
    '時任聡一朗': 36000000,
    '宮城智一': 30000000,
    '永田倫也': 30000000,
    '岡崎真夕': 18000000,
};

const removeSpaces = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[\s\u3000]+/g, '');
};

const calculateBrokerageFee = (price: number | null): number => {
    if (!price || price === 0) return 0;
    if (price > 4000000) return (price * 0.03) + 60000;
    if (price > 2000000) return (price * 0.04) + 20000;
    return price * 0.05;
};

const MonthlySalesReport = () => {
    const { category, shopName } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(false);
    const [listings, setListings] = useState<BrokerageListing[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);

    // 表示対象の年度（例: 2026）
    const [targetYear, setTargetYear] = useState<number>(2026);

    // 💡 内訳モーダル用のState
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState<ModalItem[]>([]);
    const [modalTitle, setModalTitle] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'broker', roll: 'report' });
                if (response.data) {
                    const brokerResponse = response.data.brokerage.filter((b: BrokerageListing) => b.kind === 'deals');
                    setListings(brokerResponse || []);
                    
                    const staffResponse = (response.data.staff || [])
                        .sort((a: Staff, b: Staff) => {
                            const positionA = positions.indexOf(a.position) !== -1 ? positions.indexOf(a.position) : 6;
                            const positionB = positions.indexOf(b.position) !== -1 ? positions.indexOf(b.position) : 6;
                            return positionA - positionB;
                        })
                        .filter((s: Staff) => s.period === String(thisYear) && s.section === '中古住宅専門店');
                    
                    setStaffList(staffResponse);
                }
            } catch (error) {
                console.error("データの取得に失敗しました:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // ==========================================
    // 💡 データ集計ロジック (ご提示のロジックを完全維持)
    // ==========================================
    const aggregatedData = useMemo(() => {
        const staffStats: Record<string, any> = {};
        const teamTotal = {
            monthlyAll: Object.fromEntries(FISCAL_MONTHS.map(m => [m, 0])),
            monthlyConf: Object.fromEntries(FISCAL_MONTHS.map(m => [m, 0])),
            monthlyCount: Object.fromEntries(FISCAL_MONTHS.map(m => [m, 0])),
            yearlyAll: 0,
            yearlyConf: 0,
            yearlyCount: 0,
            target: 0
        };

        staffList.forEach(staffObj => {
            const originalName = staffObj.name;
            if (!originalName) return;
            
            const normalizedName = removeSpaces(originalName);
            const target = TARGET_SALES[normalizedName] || TARGET_SALES[originalName] || 0; 
            
            staffStats[normalizedName] = {
                name: originalName,
                monthlyAll: Object.fromEntries(FISCAL_MONTHS.map(m => [m, 0])),
                monthlyConf: Object.fromEntries(FISCAL_MONTHS.map(m => [m, 0])),
                monthlyCount: Object.fromEntries(FISCAL_MONTHS.map(m => [m, 0])),
                yearlyAll: 0,
                yearlyConf: 0,
                yearlyCount: 0,
                target: target
            };
            teamTotal.target += target;
        });

        listings.forEach(item => {
            if (item.kind !== 'deals') return;

            const rawStaffName = item.staff || '';
            const normalizedStaffName = removeSpaces(rawStaffName);
            const contractDate = item.contractDate;
            const phase = item.phase || '';

            if (!contractDate || contractDate === '0000-00-00' || !staffStats[normalizedStaffName]) return;

            let fee = Number(item.fee);
            if (!item.fee && String(item.feeManual) === "0" && Number(item.price) > 0) {
                fee = calculateBrokerageFee(Number(item.price));
            } else {
                fee = fee || 0;
            }

            const [yearStr, monthStr] = contractDate.split('-');
            const month = monthStr;
            const year = Number(yearStr);

            const isTargetPeriod = (Number(month) >= 6 && year === targetYear) || (Number(month) <= 5 && year === targetYear + 1);

            if (isTargetPeriod && FISCAL_MONTHS.includes(month)) {
                const isConfirmed = ['契約済', '契約予定', '決済完了'].includes(phase);

                staffStats[normalizedStaffName].monthlyAll[month] += fee;
                staffStats[normalizedStaffName].yearlyAll += fee;
                staffStats[normalizedStaffName].monthlyCount[month] += 1;
                staffStats[normalizedStaffName].yearlyCount += 1;

                teamTotal.monthlyAll[month] += fee;
                teamTotal.yearlyAll += fee;
                teamTotal.monthlyCount[month] += 1;
                teamTotal.yearlyCount += 1;

                if (isConfirmed) {
                    staffStats[normalizedStaffName].monthlyConf[month] += fee;
                    staffStats[normalizedStaffName].yearlyConf += fee;

                    teamTotal.monthlyConf[month] += fee;
                    teamTotal.yearlyConf += fee;
                }
            }
        });

        const sortedStaffs = Object.values(staffStats).sort((a, b) => b.yearlyAll - a.yearlyAll);

        return { sortedStaffs, teamTotal };
    }, [listings, staffList, targetYear]);

    // ==========================================
    // 💡 セルクリック時の内訳フィルタリング処理
    // ==========================================
    const handleCellClick = (staffName: string, targetMonth: string, type: 'all' | 'conf' | 'count') => {
        const filtered = listings.filter(item => {
            if (item.kind !== 'deals') return false;

            const normalizedStaffName = removeSpaces(item.staff || '');
            if (staffName !== '' && normalizedStaffName !== removeSpaces(staffName)) return false;

            const contractDate = item.contractDate;
            if (!contractDate || contractDate === '0000-00-00') return false;

            const [yearStr, monthStr] = contractDate.split('-');
            if (monthStr !== targetMonth) return false;

            const year = Number(yearStr);
            const isTargetPeriod = (Number(monthStr) >= 6 && year === targetYear) || (Number(monthStr) <= 5 && year === targetYear + 1);
            if (!isTargetPeriod) return false;

            let fee = Number(item.fee);
            if (!item.fee && String(item.feeManual) === "0" && Number(item.price) > 0) {
                fee = calculateBrokerageFee(Number(item.price));
            } else {
                fee = fee || 0;
            }

            if (fee <= 0) return false;

            if (type === 'conf') {
                const phase = item.phase || '';
                if (!['契約済', '契約予定', '決済完了'].includes(phase)) return false;
            }

            return true;
        }).map(item => {
            let fee = Number(item.fee);
            if (!item.fee && String(item.feeManual) === "0" && Number(item.price) > 0) {
                fee = calculateBrokerageFee(Number(item.price));
            } else {
                fee = fee || 0;
            }
            return {
                customer: item.customer || '設定なし',
                contractDate: item.contractDate || '',
                fee: fee
            };
        });

        setModalData(filtered);

        let typeLabel = '全体売上';
        if (type === 'conf') typeLabel = '確定売上';
        if (type === 'count') typeLabel = '契約件数';

        const staffLabel = staffName === '' ? 'チーム合計' : staffName;
        setModalTitle(`${staffLabel} - ${Number(targetMonth)}月 ${typeLabel} 内訳`);

        setShowModal(true);
    };

    // ==========================================
    // 💡 UI ヘルパー関数
    // ==========================================
    const formatYen = (num: number) => {
        if (!num || num === 0) return '0';
        return '¥' + num.toLocaleString();
    };

    const calcRate = (result: number, target: number) => {
        if (!target || target === 0) return '0.0%';
        return ((result / target) * 100).toFixed(1) + '%';
    };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#fafbfe', minHeight: '100vh' }}>
            {/* 💡 カスタムスタイル：適度な余白でバランス良く収める */}
            <style>{`
                .table-balanced th, .table-balanced td {
                    padding: 10px 12px !important;
                    vertical-align: middle;
                }
            `}</style>

            <div className="d-flex flex-wrap justify-content-between align-items-end mb-3 border-bottom pb-3 gap-3">
                <h4 className="fw-bold text-secondary mb-0" style={{ letterSpacing: '1px' }}>
                    <i className="fa-solid fa-chart-line me-2 text-primary"></i>📈 月次売上管理
                    <span className="text-muted ms-3" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                        契約日＝計上月・単位:円。商談案件管理から自動集計。失注は除外。
                    </span>
                </h4>

                <select
                    className="form-select form-select-sm shadow-sm border-primary text-primary fw-bold"
                    style={{ width: 'auto', cursor: 'pointer' }}
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                >
                    <option value={2025}>2025年度 (25年6月〜26年5月)</option>
                    <option value={2026}>2026年度 (26年6月〜27年5月)</option>
                </select>
            </div>

            {isLoading ? (
                <div className="text-center mt-5">
                    <div className="spinner-border text-primary" role="status"></div>
                </div>
            ) : (
                <>
                    {/* 💡 Card 1: 担当者別 月次売上 (全体) */}
                    <Card className="shadow-sm border-0 rounded-3 mb-4">
                        <Card.Header className="bg-white border-bottom-0 pt-3 pb-1">
                            <h6 className="fw-bold mb-0 text-dark">担当者別 月次売上</h6>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <div className="table-responsive w-100">
                                <Table bordered hover className="mb-0 text-center align-middle text-nowrap table-balanced" style={{ fontSize: '12px' }}>
                                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                                        <tr>
                                            <th className="text-start text-secondary">担当者</th>
                                            {FISCAL_MONTHS.map(m => <th key={m} className="text-secondary">{Number(m)}月</th>)}
                                            <th className="text-secondary">年間実績</th>
                                            <th className="text-secondary">年間目標</th>
                                            <th className="text-secondary">達成率</th>
                                            <th className="text-secondary">順位</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aggregatedData.sortedStaffs.map((staff, index) => (
                                            <tr key={staff.name}>
                                                <td className="text-start fw-bold text-dark">{staff.name}</td>
                                                {FISCAL_MONTHS.map(m => (
                                                    <td
                                                        key={m}
                                                        className={staff.monthlyAll[m] > 0 ? "text-primary fw-bold" : "text-muted"}
                                                        style={staff.monthlyAll[m] > 0 ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
                                                        onClick={() => staff.monthlyAll[m] > 0 && handleCellClick(staff.name, m, 'all')}
                                                    >
                                                        {formatYen(staff.monthlyAll[m])}
                                                    </td>
                                                ))}
                                                <td className="fw-bold text-dark">{formatYen(staff.yearlyAll)}</td>
                                                <td className="text-danger">{formatYen(staff.target)}</td>
                                                <td className="fw-bold">{calcRate(staff.yearlyAll, staff.target)}</td>
                                                <td><span className="badge bg-secondary rounded-pill">{index + 1}</span></td>
                                            </tr>
                                        ))}
                                        <tr style={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #dee2e6' }}>
                                            <td className="text-start fw-bold text-dark">チーム合計</td>
                                            {FISCAL_MONTHS.map(m => (
                                                <td
                                                    key={m}
                                                    className={aggregatedData.teamTotal.monthlyAll[m] > 0 ? "text-dark fw-bold" : "text-muted"}
                                                    style={aggregatedData.teamTotal.monthlyAll[m] > 0 ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
                                                    onClick={() => aggregatedData.teamTotal.monthlyAll[m] > 0 && handleCellClick('', m, 'all')}
                                                >
                                                    {formatYen(aggregatedData.teamTotal.monthlyAll[m])}
                                                </td>
                                            ))}
                                            <td className="fw-bold text-primary">{formatYen(aggregatedData.teamTotal.yearlyAll)}</td>
                                            <td className="fw-bold text-danger">{formatYen(aggregatedData.teamTotal.target)}</td>
                                            <td className="fw-bold">{calcRate(aggregatedData.teamTotal.yearlyAll, aggregatedData.teamTotal.target)}</td>
                                            <td>-</td>
                                        </tr>
                                    </tbody>
                                </Table>
                            </div>
                        </Card.Body>
                    </Card>

                    <div className="row g-4 mb-4">
                        {/* 💡 Card 2: 内訳① 確定売上 */}
                        <div className="col-12 col-xl-6">
                            <Card className="shadow-sm border-0 rounded-3 h-100">
                                <Card.Header className="bg-white border-bottom-0 pt-3 pb-1">
                                    <h6 className="fw-bold mb-0 text-dark">内訳①：確定売上 <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>(契約済＋契約予定＋決済完了)</span></h6>
                                </Card.Header>
                                <Card.Body className="p-0">
                                    <div className="table-responsive w-100">
                                        <Table bordered hover className="mb-0 text-center align-middle text-nowrap table-balanced" style={{ fontSize: '12px' }}>
                                            <thead style={{ backgroundColor: '#f8f9fa' }}>
                                                <tr>
                                                    <th className="text-start text-secondary">担当者</th>
                                                    {FISCAL_MONTHS.map(m => <th key={m} className="text-secondary">{Number(m)}月</th>)}
                                                    <th className="text-secondary">年間確定計</th>
                                                    <th className="text-secondary">見込み残</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {aggregatedData.sortedStaffs.map(staff => (
                                                    <tr key={staff.name}>
                                                        <td className="text-start fw-bold text-dark">{staff.name}</td>
                                                        {FISCAL_MONTHS.map(m => (
                                                            <td
                                                                key={m}
                                                                className={staff.monthlyConf[m] > 0 ? "text-success fw-bold" : "text-muted"}
                                                                style={staff.monthlyConf[m] > 0 ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
                                                                onClick={() => staff.monthlyConf[m] > 0 && handleCellClick(staff.name, m, 'conf')}
                                                            >
                                                                {formatYen(staff.monthlyConf[m])}
                                                            </td>
                                                        ))}
                                                        <td className="fw-bold text-success">{formatYen(staff.yearlyConf)}</td>
                                                        <td className="text-muted">{formatYen(staff.yearlyAll - staff.yearlyConf)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Card.Body>
                            </Card>
                        </div>

                        {/* 💡 Card 3: 内訳② 月次契約件数 */}
                        <div className="col-12 col-xl-6">
                            <Card className="shadow-sm border-0 rounded-3 h-100">
                                <Card.Header className="bg-white border-bottom-0 pt-3 pb-1">
                                    <h6 className="fw-bold mb-0 text-dark">内訳②：月次契約件数 <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>(契約日ベース)</span></h6>
                                </Card.Header>
                                <Card.Body className="p-0">
                                    <div className="table-responsive w-100">
                                        <Table bordered hover className="mb-0 text-center align-middle text-nowrap table-balanced" style={{ fontSize: '12px' }}>
                                            <thead style={{ backgroundColor: '#f8f9fa' }}>
                                                <tr>
                                                    <th className="text-start text-secondary">担当者</th>
                                                    {FISCAL_MONTHS.map(m => <th key={m} className="text-secondary">{Number(m)}月</th>)}
                                                    <th className="text-secondary">年間件数</th>
                                                    <th className="text-secondary">1件平均</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {aggregatedData.sortedStaffs.map(staff => (
                                                    <tr key={staff.name}>
                                                        <td className="text-start fw-bold text-dark">{staff.name}</td>
                                                        {FISCAL_MONTHS.map(m => (
                                                            <td 
                                                                key={m} 
                                                                className={staff.monthlyCount[m] > 0 ? "text-dark fw-bold" : "text-muted"}
                                                                style={staff.monthlyCount[m] > 0 ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
                                                                onClick={() => staff.monthlyCount[m] > 0 && handleCellClick(staff.name, m, 'count')}
                                                            >
                                                                {staff.monthlyCount[m] > 0 ? staff.monthlyCount[m] : 0}
                                                            </td>
                                                        ))}
                                                        <td className="fw-bold text-primary">{staff.yearlyCount}</td>
                                                        <td className="text-dark">
                                                            {staff.yearlyCount > 0 ? formatYen(Math.floor(staff.yearlyAll / staff.yearlyCount)) : '¥0'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Card.Body>
                            </Card>
                        </div>
                    </div>
                </>
            )}

            {/* 💡 内訳表示用モーダル */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
                <Modal.Header closeButton className="border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold text-secondary" style={{ fontSize: '16px' }}>
                        <i className="bi bi-list-ul me-2"></i>{modalTitle}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-3 pb-4">
                    {modalData.length > 0 ? (
                        <div className="table-responsive">
                            <Table bordered hover className="mb-0 text-center align-middle text-nowrap table-balanced" style={{ fontSize: '12px' }}>
                                <thead style={{ backgroundColor: '#f8f9fa' }}>
                                    <tr>
                                        <th className="text-start text-secondary">顧客名</th>
                                        <th className="text-secondary">契約日</th>
                                        <th className="text-secondary">売上</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalData.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="text-start fw-bold text-dark">{item.customer}</td>
                                            <td className="text-muted">{item.contractDate}</td>
                                            <td className="text-primary fw-bold">{formatYen(item.fee)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center text-muted py-4">データが見つかりません。</div>
                    )}
                </Modal.Body>
            </Modal>

        </div>
    );
};

export default MonthlySalesReport;