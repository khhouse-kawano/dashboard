import React, { useState, useMemo, useEffect } from 'react';
import apiClient from '../../utils/apiClient';

// --- 型定義 ---
type Summary = Record<string, string>;

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

    // 1ページあたりの表示件数を 20 に変更
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

    // --- 事前フィルター (Selectボックスの条件でベースデータを絞り込む) ---
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
        // 各ブランドのデータを事前に分割しておく
        const khData = targetData.filter(d => d.shop?.startsWith('KH'));
        const djhData = targetData.filter(d => d.shop?.startsWith('DJH'));
        const nagomiData = targetData.filter(d => d.shop?.startsWith('なごみ'));
        const nieruData = targetData.filter(d => d.shop?.startsWith('2L'));
        const jhData = targetData.filter(d => d.shop?.startsWith('JH'));
        const pghData = targetData.filter(d => d.shop?.startsWith('PG'));

        // 特定のデータセットから4つの指標（客数、勝、負、追客中）を算出するヘルパー
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
                // KHG用（targetData全体を使用）
                const khg = getMetrics(targetData, l);
                
                return {
                    name: l,
                    sortCount: khg.total.length, // ソート用のカウント（総客数を使用）
                    khg,
                    kh: getMetrics(khData, l),
                    djh: getMetrics(djhData, l),
                    nagomi: getMetrics(nagomiData, l),
                    nieru: getMetrics(nieruData, l),
                    jh: getMetrics(jhData, l),
                    pgh: getMetrics(pghData, l),
                };
            })
            // 先にMapで集計してからsortCountで並び替える
            .sort((a, b) => b.sortCount - a.sortCount);

        return newList;
    }, [list, targetData]);

    // --- テキスト検索機能 ---
    const searchedList = useMemo(() => {
        if (!searchTerm) return filteredList;
        return filteredList.filter((item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [filteredList, searchTerm]);

    // --- ページネーション ---
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

    // 色を変えるロジック(0より大きい場合は青字の太文字)を残し、下線をなくす
    const renderCountCell = (records: Summary[]) => {
        const count = records.length;
        if (count > 0) {
            return <span className="text-primary fw-bold">{count}</span>;
        }
        return <span className="text-muted">{count}</span>;
    };

    // UIヘルパー: ブランドの列ヘッダーを生成（addLeftBorder で一番左の区切り線の有無を制御）
    const renderBrandSubHeaders = (addLeftBorder: boolean = true) => (
        <>
            <th className={`text-nowrap py-1 bg-light ${addLeftBorder ? 'border-start border-2' : ''}`} style={{ fontSize: '0.75rem', minWidth: '35px' }}>客数</th>
            <th className="text-nowrap py-1 bg-light" style={{ fontSize: '0.75rem', minWidth: '35px' }}>勝</th>
            <th className="text-nowrap py-1 bg-light" style={{ fontSize: '0.75rem', minWidth: '35px' }}>負</th>
            <th className="text-nowrap py-1 bg-light" style={{ fontSize: '0.75rem', minWidth: '35px' }}>追客</th>
        </>
    );

    // UIヘルパー: 1つのブランドに対するTD列（4列）を生成
    const renderBrandCells = (metrics: { total: Summary[], contract: Summary[], lose: Summary[], follow: Summary[] }, addLeftBorder: boolean = true) => (
        <>
            <td className={`py-2 ${addLeftBorder ? 'border-start border-2' : ''}`}>{renderCountCell(metrics.total)}</td>
            <td className="py-2">{renderCountCell(metrics.contract)}</td>
            <td className="py-2">{renderCountCell(metrics.lose)}</td>
            <td className="py-2">{renderCountCell(metrics.follow)}</td>
        </>
    );

    const containerStyle: React.CSSProperties = {
        fontSize: '0.85rem',
    };

    return (
        <div style={containerStyle}>
            {/* 上部コントロール */}
            <div className="row gx-2 gy-2 mb-3 align-items-center">
                <div className="col-auto">
                    <select className="form-select form-select-sm" value={targetShop} onChange={handleSelectChange(setTargetShop)}>
                        <option value="">店舗を選択...</option>
                        {shops.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                    </select>
                </div>
                <div className="col-auto">
                    <select className="form-select form-select-sm" value={targetSection} onChange={handleSelectChange(setTargetSection)}>
                        <option value="">課を選択...</option>
                        <option value="鹿児島営業1課">鹿児島営業1課</option>
                        <option value="鹿児島営業2課">鹿児島営業2課</option>
                        <option value="鹿児島営業3課">鹿児島営業3課</option>
                        <option value="宮崎営業課">宮崎営業課</option>
                        <option value="熊本営業課">熊本営業課</option>
                        <option value="大分・佐賀営業課">大分・佐賀営業課</option>
                    </select>
                </div>

                <div className="col-auto ms-auto d-flex align-items-center gap-2">
                    <label htmlFor="search-competitor" className="text-nowrap mb-0 fw-bold">
                        競合名検索:
                    </label>
                    <input
                        id="search-competitor"
                        type="text"
                        placeholder="名称を入力..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="form-control form-control-sm"
                        style={{ maxWidth: '180px' }}
                    />
                </div>
            </div>

            <div className="d-flex justify-content-end mb-2 text-secondary">
                全 {searchedList.length} 件
            </div>

            {/* テーブル */}
            <div className="table-responsive">
                <table className="table table-bordered table-hover text-center align-middle mb-0" style={{ minWidth: '1300px' }}>
                    <thead className="table-light">
                        <tr>
                            <th rowSpan={2} className="align-middle text-nowrap py-2 border-end border-2" style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>競合他社名</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light">KHG</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2">KH</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2">DJH</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2">なごみ</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2">2L</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2">JH</th>
                            <th colSpan={4} className="text-nowrap py-2 bg-light border-start border-2">PGH</th>
                        </tr>
                        <tr>
                            {/* KHGだけ左ボーダーなし、それ以外は左ボーダーあり */}
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
                                    {/* 競合他社名（スクロール時にも見えるようにstickyを付与） */}
                                    <td className="text-start fw-bold text-nowrap py-2 border-end border-2" style={{ position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1 }}>{row.name}</td>
                                    
                                    {/* 各ブランドごとの内訳（KHGだけ左側の区切り線を無効化） */}
                                    {renderBrandCells(row.khg, false)}
                                    {renderBrandCells(row.kh)}
                                    {renderBrandCells(row.djh)}
                                    {renderBrandCells(row.nagomi)}
                                    {renderBrandCells(row.nieru)}
                                    {renderBrandCells(row.jh)}
                                    {renderBrandCells(row.pgh)}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                {/* 列数が 1 (社名) + 7 (ブランド) * 4 (指標) = 29列 になります */}
                                <td colSpan={29} className="py-4 text-muted">
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
                    <ul className="pagination pagination-sm justify-content-center mb-0">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button
                                className="page-link"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                前へ
                            </button>
                        </li>

                        {pageNumbers.map((page) => (
                            <li
                                key={page}
                                className={`page-item ${currentPage === page ? 'active' : ''}`}
                            >
                                <button
                                    className="page-link"
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            </li>
                        ))}

                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button
                                className="page-link"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                次へ
                            </button>
                        </li>
                    </ul>
                </nav>
            )}
        </div>
    );
};

export default CompetitorSummary;