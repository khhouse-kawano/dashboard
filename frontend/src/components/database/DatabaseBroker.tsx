import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { dateFormate, generateNewId, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus, getContractExpirationDate, getRemainingDays, getContractStatusInfo } from './databaseUtils';
import PropertyRegister from './PropertyRegister';
import InformationEditResale from '../information/InformationEditResale';
import PropertySummary from './PropertySummary';

export interface BrokerData {
    internal_id: number;
    id: string;
    kind: string | null;
    no?: number | null;
    freq?: string | null;
    note?: string | null;
    addr1?: string | null;
    addr2?: string | null;
    addr?: string | null;
    price?: number | null;
    budget?: number | null;
    fee?: number | null;
    feeManual?: number | null;
    staff?: string | null;
    portal?: string | null;
    seller?: string | null;
    customer?: string | null;
    name?: string | null;
    source?: string | null;
    contact?: string | null;
    keyInfo?: string | null;
    category?: string | null;
    keyStatus?: string | null;
    baikaiType?: string | null;
    propStatus?: string | null;
    currentStatus?: string | null;
    type?: string | null;
    phase?: string | null;
    priority?: string | null;
    property?: string | null;
    targetProperty?: string | null;
    endReason?: string | null;
    reinsDate?: string | null;
    contractDate?: string | null;
    receivedDate?: string | null;
    created_at?: string;
    updated_at?: string;
    master_data_id?: string | null;
    property_db_id?: string | null;
    property_db_name?: string | null;
    show_dashboard?: number;
    [key: string]: any;
}

type SortKey = 'displayName' | 'displayAddress' | 'displayPrice' | 'phase' | 'staff' | 'date' | 'medium' | 'updated_at';

const DatabaseBroker = () => {
    const [originalData, setOriginalData] = useState<BrokerData[]>([]);
    const [staffList, setStaffList] = useState<string[]>([]);

    // === 検索用のState ===
    const [searchAddress, setSearchAddress] = useState<string>('');
    const [searchCustomer, setSearchCustomer] = useState<string>('');
    const [searchStaff, setSearchStaff] = useState<string>('');
    const [searchCategory, setSearchCategory] = useState<string>('');
    const [searchStatus, setSearchStatus] = useState('');

    // === テーブル制御用のState ===
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [activePage, setActivePage] = useState<number>(1);
    const [basicLength, setBasicLength] = useState<number>(20);

    // === モーダル制御用のState ===
    const [targetPropertyId, setTargetPropertyId] = useState<string>('');
    const [targetCustomer, setTargetCustomer] = useState<BrokerData | null>(null);
    const [customerId, setCustomerId] = useState('');

    // === 編集(Update)用のState ===
    const [editData, setEditData] = useState<Partial<BrokerData>>({});
    const [isSaving, setIsSaving] = useState(false);

    const [targetId, setTargetId] = useState('');


    // データ取得
    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const thisYear = now.getMonth() <= 4 ? year : year + 1;
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'broker', roll: 'list' });
                const filtered = response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1);
                setOriginalData(filtered);
                const filteredStaff = response.data.staff.filter(s => (s.shop === '不動産企画係' || s.shop === '中古住宅専門店') && s.period === String(thisYear)).map(s => s.name);
                setStaffList(filteredStaff);
            } catch (e) {
                alert('通信エラーが発生しました');
                console.error(e);
            }
        };
        fetchData();
    }, []);

    // 💡 検索条件が変更されたら、ページネーションを1ページ目に戻す
    useEffect(() => {
        setActivePage(1);
    }, [searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);

    // 💡 編集ボタンを押した時に、選択された行のデータをフォームの初期値としてセットする
    useEffect(() => {
        if (targetPropertyId) {
            const target = originalData.find(d => d.id === targetPropertyId);
            if (target) setEditData(target);
        } else {
            setEditData({}); // 閉じた時にリセット
        }
    }, [targetPropertyId, originalData]);



    // === 動的セレクトボックスの選択肢を生成 ===
    const uniqueStaffList = useMemo(() => {
        const staffs = originalData.map(d => d.staff).filter(Boolean) as string[];
        return Array.from(new Set(staffs)).sort();
    }, [originalData]);

    const uniqueCategoryList = useMemo(() => {
        const categories = originalData.map(d => d.category).filter(Boolean) as string[];
        return Array.from(new Set(categories)).sort();
    }, [originalData]);

    // === フィルタリング＆ソート処理 ===
    const processedData = useMemo(() => {
        // 1. まずフィルタリング（絞り込み）
        const filtered = originalData.filter(item => {
            // 住所の結合文字列を作成
            const combinedAddress = `${item.addr1 || ''} ${item.addr2 || ''} ${item.addr || ''} ${item.property || ''} ${item.targetProperty || ''}`.toLowerCase();
            const matchAddress = !searchAddress || combinedAddress.includes(searchAddress.toLowerCase());

            // 顧客名の結合文字列を作成
            const combinedCustomer = `${item.seller || ''} ${item.name || ''} ${item.customer || ''}`.toLowerCase();
            const matchCustomer = !searchCustomer || combinedCustomer.includes(searchCustomer.toLowerCase());

            // 担当と物件種別は完全一致 (未選択の場合は全て表示)
            const matchStaff = !searchStaff || item.staff === searchStaff;
            const matchCategory = !searchCategory || item.category === searchCategory;
            const matchStatus = !searchStatus || item.propStatus === searchStatus

            return matchAddress && matchCustomer && matchStaff && matchCategory && matchStatus;
        });

        // 2. 絞り込んだ結果をソート
        const getSortValue = (item: BrokerData, key: SortKey) => {
            switch (key) {
                case 'displayName': return item.seller || item.name || item.customer || '';
                case 'displayAddress': return `${item.addr1 || ''} ${item.addr2 || ''} ${item.addr || ''}`.trim() || item.property || item.targetProperty || '';
                case 'displayPrice': return item.price || item.budget || 0;
                case 'date': return item.receivedDate || item.contractDate || item.created_at || '';
                case 'phase': return item.phase || item.currentStatus || '';
                case 'staff': return item.staff || '';
                default: return '';
            }
        };

        filtered.sort((a, b) => {
            const aValue = getSortValue(a, sortConfig.key);
            const bValue = getSortValue(b, sortConfig.key);

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);

    // === ページネーション制御 ===
    const totalPages = Math.ceil(processedData.length / basicLength) || 1;
    const sliceStart = (activePage - 1) * basicLength;
    const paginatedData = processedData.slice(sliceStart, sliceStart + basicLength);

    const handlePrevPage = () => setActivePage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setActivePage(prev => Math.min(prev + 1, totalPages));

    // === UIヘルパー ===
    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };


    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <span className="text-muted ms-1 opacity-25" style={{ fontSize: '10px' }
        }>↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▲</span> : <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▼</span >;
    };

    const handleUpdate = async () => {
        if (!targetPropertyId) return;
        setIsSaving(true);
        try {
            const payload = {
                request: 'broker',
                roll: 'update',
                id: targetPropertyId,
                data: editData
            };
            const response = await apiClient.post('', payload);
            if (response.data.status === 'error') alert('更新に失敗しました');
            const filtered = response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1);
            setOriginalData(filtered);
        } catch (e) {
            console.error(e);
            alert('更新に失敗しました。');
        } finally {
            setIsSaving(false);
            setTargetPropertyId('');

        }
    };


    const handleAddNew = () => {
        const newId = generateNewId();
        setTargetPropertyId(newId);
        setEditData({ id: newId, kind: 'ledger' });
    };

    useEffect(() => {
        if (targetPropertyId) {
            const target = originalData.find(d => d.id === targetPropertyId);
            if (target) {
                setEditData(target);
            }
        } else {
            setEditData({});
        }
    }, [targetPropertyId, originalData]);

    const onClose = () => {
        setCustomerId('');
    };

    // 💡 非表示（論理削除）処理
    const handleDelete = async (id: string) => {
        if (!window.confirm('この物件をダッシュボードから非表示にしますか？')) return;

        try {
            const payload = {
                request: 'broker',
                roll: 'update',
                id: id,
                data: { show_dashboard: 0 }
            };

            const response = await apiClient.post('', payload);

            if (response.data.status === 'error') {
                alert('非表示処理に失敗しました');
                return;
            }

            // 成功時、show_dashboard が 1 のものだけを再セットして画面から消す
            const filtered = response.data.brokerage.filter((b: BrokerData) => b.kind === 'ledger' && b.show_dashboard === 1);
            setOriginalData(filtered);

        } catch (e) {
            console.error(e);
            alert('通信エラーが発生しました。');
        }
    };

    return (
        <div className="content bg-light p-3">

            {/* === 🔍 検索フィルターエリア === */}
            <div className="card shadow-sm border-0 rounded-3 mb-3">
                <div className="card-body bg-white rounded-3">
                    <div className="row g-2">
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">① 住所で検索</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="例: 鹿児島市"
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">② 顧客名で検索</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="例: 山田"
                                value={searchCustomer}
                                onChange={(e) => setSearchCustomer(e.target.value)}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">③ 物件ステータスで検索</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchStatus}
                                onChange={(e) => setSearchStatus(e.target.value)}
                            >
                                <option value="">すべて</option>
                                <option value="アクティブ">アクティブ</option>
                                <option value="媒介終了">媒介終了</option>
                                <option value="成約完了">成約完了</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">④ 担当者</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchStaff}
                                onChange={(e) => setSearchStaff(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {staffList.map(staff => (
                                    <option key={staff} value={staff}>{staff}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">⑤ 物件種別</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchCategory}
                                onChange={(e) => setSearchCategory(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {uniqueCategoryList.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 件数表示 ＆ ページネーション（上部） === */}
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-3">
                    <div className="fw-bold text-secondary">
                        該当 {processedData.length} 件 <span className="fw-normal" style={{ fontSize: '12px' }}>({processedData.length > 0 ? sliceStart + 1 : 0} ~ {Math.min(activePage * basicLength, processedData.length)}件)</span>
                    </div>
                    {/* 💡 新規追加ボタン */}
                    <button className="btn btn-sm btn-primary rounded-pill px-3 shadow-sm fw-bold" onClick={handleAddNew}>
                        <i className="bi bi-plus-circle me-1"></i> 媒介追加
                    </button>
                </div>

                {/* 💡 ページネーション UI */}
                {totalPages > 1 && (
                    <div className="btn-group shadow-sm">
                        <button className="btn btn-sm btn-outline-secondary bg-white" onClick={handlePrevPage} disabled={activePage === 1}>
                            <i className="bi bi-chevron-left"></i> 前へ
                        </button>
                        <span className="btn btn-sm btn-light border-secondary text-dark pe-none">
                            {activePage} / {totalPages}
                        </span>
                        <button className="btn btn-sm btn-outline-secondary bg-white" onClick={handleNextPage} disabled={activePage === totalPages}>
                            次へ <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* === テーブルUI === */}
            <div className="card shadow-sm border-0 rounded-3">
                <div className="card-body p-0">
                    <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <table className="table table-hover align-middle mb-0 text-center text-nowrap" style={{ fontSize: '12px' }}>
                            <thead className="table-light border-bottom border-2" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr>
                                    <th className="py-2" style={{ width: '40px' }}>No</th>
                                    <th className="py-2">編集</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('medium')}>反響元 {getSortIcon('medium')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('staff')}>担当 {getSortIcon('staff')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('date')}>媒介契約日 {getSortIcon('date')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('updated_at')}>情報更新日 {getSortIcon('updated_at')}</th>
                                    <th className="py-2">契約満了予定</th>
                                    <th className="py-2">残日数</th>
                                    <th className="py-2">更新状態</th>
                                    <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayName')}>顧客名 {getSortIcon('displayName')}</th>
                                    <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayAddress')}>物件 / 住所 {getSortIcon('displayAddress')}</th>
                                    <th className="py-2 text-end" style={thStyle} onClick={() => requestSort('displayPrice')}>金額 / 予算 {getSortIcon('displayPrice')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('phase')}>フェーズ {getSortIcon('phase')}</th>
                                    <th className="py-2">REINZ</th>
                                    <th className="py-2">物件状態</th>
                                    <th className="py-2">MAP</th>
                                    <th className="py-2">ポータル連携</th>
                                    {/* 💡 追加: サマリー列 */}
                                    <th className="py-2">サマリー</th>
                                    <th className="py-2">非表示</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((item, index) => {
                                        const displayPrice = item.price || 0;

                                        const rawAddress = [item.addr1, item.addr2, item.addr, item.property, item.targetProperty]
                                            .filter(Boolean)
                                            .join(' ');

                                        const addressParsed = parseTextWithUrl(rawAddress);
                                        const noteParsed = parseTextWithUrl(item.note);
                                        const mapUrl = addressParsed.mapUrl || noteParsed.mapUrl;

                                        const expirationDateStr = getContractExpirationDate(item.contractDate, item.baikaiType);
                                        const remainingDays = getRemainingDays(expirationDateStr);
                                        const contractStatusInfo = getContractStatusInfo(remainingDays);

                                        return (
                                            <tr key={item.id}>
                                                <td className="text-muted">{sliceStart + index + 1}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger rounded-pill px-3 py-0"
                                                        style={{ fontSize: "11px" }}
                                                        onClick={() => setTargetPropertyId(item.id)}
                                                    >
                                                        編集
                                                    </button>
                                                </td>
                                                <td>{item.source || '-'}</td>
                                                <td>{item.staff || '-'}</td>
                                                <td className="text-muted">{dateFormate(item.contractDate || '')}</td>
                                                <td className="text-muted">{dateFormate(item.updated_at || '')}</td>
                                                <td className="text-muted">{expirationDateStr}</td>
                                                <td className="text-end fw-bold">
                                                    {remainingDays !== null ? (
                                                        <span className={remainingDays < 0 ? 'text-danger' : ''}>
                                                            {remainingDays}日
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td>
                                                    {remainingDays !== null ? (
                                                        <span className={`badge ${contractStatusInfo.color}`}>
                                                            {contractStatusInfo.label}
                                                        </span>
                                                    ) : <span className="text-muted">-</span>}
                                                </td>
                                                <td className="text-start">
                                                    <span
                                                        className={`${item.master_data_id ? 'text-primary' : 'text-dark'} ${item.master_data_id ? 'fw-bold' : ''}`}
                                                        style={{
                                                            cursor: item.master_data_id ? 'pointer' : '',
                                                            textDecoration: item.master_data_id ? 'underline dotted' : 'none'
                                                        }}
                                                        onClick={() => item.master_data_id ? setCustomerId(item.master_data_id) : null}
                                                    >
                                                        {item.seller || '未登録'}
                                                    </span>
                                                </td>
                                                <td className="text-start text-truncate" style={{ maxWidth: '200px' }} title={addressParsed.cleanText}>
                                                    {addressParsed.cleanText || '-'}
                                                </td>
                                                <td className="text-end fw-bold text-danger">
                                                    {displayPrice > 0 ? displayPrice.toLocaleString() : '-'}
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-dark border">{item.currentStatus || '-'}</span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getReinsStatus(item.reinsDate, item.baikaiType).color}`}>
                                                        {getReinsStatus(item.reinsDate, item.baikaiType).label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getPropertyStatus(item.propStatus ?? '').color}`}>
                                                        {getPropertyStatus(item.propStatus ?? '').label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {mapUrl ? (
                                                        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-0 shadow-sm" style={{ fontSize: '11px' }}>
                                                            <i className="bi bi-geo-alt-fill"></i> MAP
                                                        </a>
                                                    ) : <span className="text-muted" style={{ fontSize: '11px' }}>-</span>}
                                                </td>
                                                <td>
                                                    {item.property_db_id ? (
                                                        <span className="badge bg-success bg-opacity-75">連携済み</span>
                                                    ) : (
                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                                                    )}
                                                </td>
                                                {/* 💡 追加: サマリーセル */}
                                                <td>
                                                    {item.property_db_id ? (
                                                        <button
                                                            className="btn btn-sm btn-outline-info rounded-pill px-3 py-0 fw-bold"
                                                            style={{ fontSize: "11px" }}
                                                            onClick={() => setTargetId(String(item.property_db_id))}
                                                        >
                                                            <i className="bi bi-bar-chart-line-fill me-1"></i>詳細
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-link text-secondary p-0 border-0"
                                                        title="非表示にする"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={19} className="text-center py-4 text-muted">
                                            該当するデータが見つかりません。
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <InformationEditResale id={customerId} token="" onClose={onClose} authority="" />
            <PropertyRegister
                targetPropertyId={targetPropertyId}
                setTargetPropertyId={setTargetPropertyId}
                editData={editData} setEditData={setEditData}
                staffList={staffList}
                isSaving={isSaving}
                handleUpdate={handleUpdate} />
            <PropertySummary
                targetId={targetId}
                setTargetId={setTargetId}
                setEditId={setCustomerId}
            />
        </div>
    );
};

export default DatabaseBroker;