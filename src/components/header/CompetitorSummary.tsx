import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import apiClient from '../../utils/apiClient';

// --- 型定義 ---
type Summary = Record<string, string>;

const styles = {
    select: { border: '1px solid #D3D3D3', borderRadius: '4px', height: '32px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none' },
    input: { border: '1px solid #D3D3D3', borderRadius: '4px', height: '32px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none' },
    label: { color: '#4a5568', fontSize: '12px', fontWeight: 'bold', letterSpacing: '.6px', marginBottom: '0' }
};

const CompetitorSummary: React.FC = () => {
    // --- State ---
    const [data, setData] = useState<Summary[]>([]);
    const [list, setList] = useState<string[]>([]);
    const [shops, setShops] = useState<Summary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // 各種セレクトボックス用のState
    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');

    // モーダル用のState
    const [loseModalShow, setLoseModalShow] = useState(false);
    const [loseReasons, setLoseReasons] = useState<{ reason: string, count: number }[]>([]);
    const [modalTargetMaker, setModalTargetMaker] = useState('');

    const itemsPerPage = 20;

    // --- API連携 ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'competitor' });
                setData(response.data.contract);
                const houseMaker = response.data.maker.map((m: any) => m.label);
                setList(houseMaker);
                const filteredShop = response.data.shop.filter((s: any) => !s.shop.includes('未設定') && !s.shop.includes('全店舗'));
                setShops(filteredShop);
            } catch (error) {
                console.error("データの取得に失敗しました", error);
            }
        };
        fetchData();
    }, []);

    // --- 事前フィルター ---
    const targetData = useMemo(() => {
        const targetShops = shops.filter(s => s.section === targetSection).map(s => s.shop);
        return data.filter(d => {
            let match = true;
            if (targetShop && d.shop !== targetShop) match = false;
            if (targetSection && !targetShops.includes(d.shop)) match = false;
            return match;
        });
    }, [data, targetShop, targetSection, shops]);

    // --- データの集計 ---
    const filteredList = useMemo(() => {
        const khData = targetData.filter(d => d.shop?.startsWith('KH'));
        const djhData = targetData.filter(d => d.shop?.startsWith('DJH'));
        const nagomiData = targetData.filter(d => d.shop?.startsWith('なごみ'));
        const nieruData = targetData.filter(d => d.shop?.startsWith('2L'));
        const jhData = targetData.filter(d => d.shop?.startsWith('JH'));
        const pghData = targetData.filter(d => d.shop?.startsWith('PG'));

        const getMetrics = (dataSet: Summary[], makerName: string) => {
            const total = dataSet.filter(d => d.competitor?.includes(makerName) || d.lost_competitor?.includes(makerName));
            const base = dataSet.filter(d => d.competitor?.includes(makerName));
            const contract = base.filter(d => d.contract);
            const lose = dataSet.filter(d => d.lost_competitor?.includes(makerName));
            const follow = base.filter(b => b.status === '見込み' && !b.lost_competitor?.includes(makerName));
            return { total, contract, lose, follow };
        };

        const newList = list
            .map((l) => {
                const khg = getMetrics(targetData, l);
                return {
                    name: l,
                    sortCount: khg.total.length,
                    khg,
                    kh: getMetrics(khData, l),
                    djh: getMetrics(djhData, l),
                    nagomi: getMetrics(nagomiData, l),
                    nieru: getMetrics(nieruData, l),
                    jh: getMetrics(jhData, l),
                    pgh: getMetrics(pghData, l),
                };
            })
            .sort((a, b) => b.sortCount - a.sortCount);

        return newList;
    }, [list, targetData]);

    const searchedList = useMemo(() => {
        if (!searchTerm) return filteredList;
        return filteredList.filter((item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [filteredList, searchTerm]);

    const totalPages = Math.ceil(searchedList.length / itemsPerPage) || 1;

    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return searchedList.slice(startIndex, startIndex + itemsPerPage);
    }, [searchedList, currentPage, itemsPerPage]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleSelectChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        setter(e.target.value);
        setCurrentPage(1);
    };

    const pageNumbers = useMemo(() => {
        const maxPages = 5;
        let start = Math.max(1, currentPage - 2);
        let end = start + maxPages - 1;
        if (end > totalPages) {
            end = totalPages;
            start = Math.max(1, end - maxPages + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [currentPage, totalPages]);

    // 💡 失注理由のカンマ分割集計ロジック
    const handleLoseClick = (loseRecords: Summary[], makerName: string) => {
        const reasonsMap: Record<string, number> = {};
        
        loseRecords.forEach(record => {
            const reasonStr = record.lost_reason_detail;
            
            if (!reasonStr) {
                reasonsMap['理由未設定'] = (reasonsMap['理由未設定'] || 0) + 1;
                return;
            }

            const reasons = reasonStr.split(',');
            reasons.forEach(r => {
                const cleanReason = r.trim();
                if (cleanReason) {
                    reasonsMap[cleanReason] = (reasonsMap[cleanReason] || 0) + 1;
                }
            });
        });

        const sortedReasons = Object.entries(reasonsMap)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count);

        setModalTargetMaker(makerName);
        setLoseReasons(sortedReasons);
        setLoseModalShow(true);
    };

    // 💡 色とアクションを分けた描画ヘルパー
    const renderCountCell = (records: Summary[], type: 'total' | 'contract' | 'lose' | 'follow', makerName: string) => {
        const count = records.length;
        if (count > 0) {
            if (type === 'lose') {
                return (
                    <span
                        className="text-danger fw-bold"
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                        onClick={() => handleLoseClick(records, makerName)}
                        title="クリックで失注理由の内訳を表示"
                    >
                        {count}
                    </span>
                );
            }
            let color = "#3182ce"; // 総数（青）
            if (type === 'contract') color = "#38a169"; // 契約（緑）
            if (type === 'follow') color = "#d69e2e"; // 追客（オレンジ）
            return <span style={{ color, fontWeight: 'bold' }}>{count}</span>;
        }
        return <span style={{ color: '#cbd5e0' }}>{count}</span>;
    };

    // 💡 テーブルの横幅・スタイルロジックを【完全な初期版】へ復元しつつ、色だけすっきり
    const renderBrandSubHeaders = (addLeftBorder: boolean = true) => (
        <>
            <th className={`text-nowrap py-1 bg-light ${addLeftBorder ? 'border-start border-2' : ''}`} style={{ fontSize: '0.75rem', minWidth: '35px', color: '#4a5568' }}>総数</th>
            <th className="text-nowrap py-1 bg-light" style={{ fontSize: '0.75rem', minWidth: '35px', color: '#4a5568' }}>契約</th>
            <th className="text-nowrap py-1 bg-light" style={{ fontSize: '0.75rem', minWidth: '35px', color: '#4a5568' }}>失注</th>
            <th className="text-nowrap py-1 bg-light" style={{ fontSize: '0.75rem', minWidth: '35px', color: '#4a5568' }}>追客</th>
        </>
    );

    const renderBrandCells = (metrics: { total: Summary[], contract: Summary[], lose: Summary[], follow: Summary[] }, makerName: string, addLeftBorder: boolean = true) => (
        <>
            <td className={`py-2 ${addLeftBorder ? 'border-start border-2' : ''}`}>{renderCountCell(metrics.total, 'total', makerName)}</td>
            <td className="py-2">{renderCountCell(metrics.contract, 'contract', makerName)}</td>
            <td className="py-2">{renderCountCell(metrics.lose, 'lose', makerName)}</td>
            <td className="py-2">{renderCountCell(metrics.follow, 'follow', makerName)}</td>
        </>
    );

    const containerStyle: React.CSSProperties = {
        fontSize: '0.85rem',
        backgroundColor: '#f8f9fa',
        padding: '16px',
        borderRadius: '8px'
    };

    return (
        <div style={containerStyle}>
            {/* 上部コントロール */}
            <div className="row gx-2 gy-2 mb-3 align-items-center">
                <div className="col-auto">
                    <select style={styles.select} value={targetSection} onChange={handleSelectChange(setTargetSection)}>
                        <option value="">全課を表示</option>
                        <option value="鹿児島営業1課">鹿児島営業1課</option>
                        <option value="鹿児島営業2課">鹿児島営業2課</option>
                        <option value="鹿児島営業3課">鹿児島営業3課</option>
                        <option value="宮崎営業課">宮崎営業課</option>
                        <option value="熊本営業課">熊本営業課</option>
                        <option value="大分・佐賀営業課">大分・佐賀営業課</option>
                    </select>
                </div>
                <div className="col-auto">
                    <select style={styles.select} value={targetShop} onChange={handleSelectChange(setTargetShop)}>
                        <option value="">全店舗を表示</option>
                        {shops.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                    </select>
                </div>

                <div className="col-auto ms-auto d-flex align-items-center gap-2">
                    <label htmlFor="search-competitor" className="text-nowrap mb-0" style={styles.label}>
                        競合名検索:
                    </label>
                    <input
                        id="search-competitor"
                        type="text"
                        placeholder="名称を入力..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        style={{ ...styles.input, maxWidth: '180px' }}
                    />
                </div>
            </div>

            <div className="d-flex justify-content-end mb-2 text-secondary fw-bold" style={{ fontSize: '12px' }}>
                該当: {searchedList.length} 件
            </div>

            {/* 💡 テーブルの構造を初期コードに完全復元 */}
            <div className="table-responsive bg-white rounded-3 shadow-sm border-0">
                <table className="table table-bordered table-hover text-center align-middle mb-0" style={{ minWidth: '1300px' }}>
                    <thead className="table-light">
                        <tr>
                            <th rowSpan={2} className="align-middle text-nowrap py-2 border-end border-2" style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 1, color: '#4a5568' }}>競合他社名</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light" style={{ color: '#4a5568' }}>KHG</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2" style={{ color: '#4a5568' }}>KH</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2" style={{ color: '#4a5568' }}>DJH</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2" style={{ color: '#4a5568' }}>なごみ</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2" style={{ color: '#4a5568' }}>2L</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2" style={{ color: '#4a5568' }}>JH</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2" style={{ color: '#4a5568' }}>PGH</th>
                        </tr>
                        <tr>
                            {renderBrandSubHeaders(false)}
                            {renderBrandSubHeaders()}
                            {renderBrandSubHeaders()}
                            {renderBrandSubHeaders()}
                            {renderBrandSubHeaders()}
                            {renderBrandSubHeaders()}
                            {renderBrandSubHeaders()}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedList.length > 0 ? (
                            paginatedList.map((row, index) => (
                                <tr key={`${row.name}-${index}`}>
                                    <td className="text-start fw-bold text-nowrap py-2 border-end border-2" style={{ position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1, color: '#2d3748' }}>{row.name}</td>
                                    {renderBrandCells(row.khg, row.name, false)}
                                    {renderBrandCells(row.kh, row.name)}
                                    {renderBrandCells(row.djh, row.name)}
                                    {renderBrandCells(row.nagomi, row.name)}
                                    {renderBrandCells(row.nieru, row.name)}
                                    {renderBrandCells(row.jh, row.name)}
                                    {renderBrandCells(row.pgh, row.name)}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={29} className="py-5 text-muted">
                                    該当するデータがありません
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
                <nav aria-label="Page navigation" className="mt-3">
                    <ul className="pagination pagination-sm justify-content-center mb-0 shadow-sm">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                前へ
                            </button>
                        </li>
                        {pageNumbers.map((page) => (
                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                <button className="page-link" onClick={() => setCurrentPage(page)}>
                                    {page}
                                </button>
                            </li>
                        ))}
                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                次へ
                            </button>
                        </li>
                    </ul>
                </nav>
            )}

            {/* 💡 失注理由サマリモーダル */}
            <Modal show={loseModalShow} onHide={() => setLoseModalShow(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title style={{ color: '#495057', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        <i className="bi bi-bar-chart-line-fill me-2 text-danger"></i>
                        {modalTargetMaker} の失注理由内訳
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-3 pb-4">
                    <div className="card shadow-sm border-0 rounded-3">
                        <Table bordered className="mb-0 text-center align-middle" style={{ fontSize: '13px', borderColor: '#e2e8f0' }}>
                            <thead style={{ backgroundColor: '#f8f9fa' }}>
                                <tr>
                                    <th style={{ color: '#718096', fontWeight: '500', width: '70%' }}>失注理由</th>
                                    <th style={{ color: '#718096', fontWeight: '500', width: '30%' }}>件数</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loseReasons.map((item, index) => (
                                    <tr key={index}>
                                        <td className="text-start" style={{ color: '#4a5568', fontWeight: 'bold' }}>{item.reason}</td>
                                        <td style={{ color: '#e53e3e', fontWeight: 'bold', fontSize: '14px' }}>{item.count}</td>
                                    </tr>
                                ))}
                                {loseReasons.length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="text-muted py-3">データがありません</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default CompetitorSummary;