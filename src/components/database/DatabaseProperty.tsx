import React, { useEffect, useState, useContext, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../context/AuthContext';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import Blue from "../../assets/images/blue_ping.png";
import Red from "../../assets/images/red_ping.png";
import InformationEditKaeru from '../information/InformationEditKaeru';
import InformationEditResale from '../information/InformationEditResale';
import apiClient from '../../utils/apiClient';
import PropertySummary from './PropertySummary';
import { removeAllSpaces } from './databaseUtils';

type shopList = { brand: string, shop: string, section: string };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number };
type Property = Record<string, string | number>;
type Customer = Record<string, string>;

// 💡 モーダル内の洗練されたデザイン用スタイル
const modalStyles = {
    card: { border: 'none', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '16px', backgroundColor: '#fff' },
    cardHeader: { backgroundColor: '#fff', borderBottom: '1px solid #edf2f7', padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#4a5568', borderRadius: '8px 8px 0 0' },
    table: { margin: 0, fontSize: '12px', borderCollapse: 'collapse' as const, width: '100%' },
    th: { backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500', width: '22%', padding: '10px 12px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' },
    td: { color: '#2d3748', fontWeight: 'bold', padding: '10px 12px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }
};

const parseLatLng = (latLngStr?: string | null) => {
    if (!latLngStr || typeof latLngStr !== 'string') return null;
    const parts = latLngStr.split(',');
    if (parts.length !== 2) return null;
    const lat = Number(parts[0].trim());
    const lng = Number(parts[1].trim());
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
};

const safeClean = (str?: string | null) => str ? String(str).replace(/[\s ]+/g, "") : "";

const DatabaseProperty = () => {
    const { token, category, authority } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<string[]>([]);
    const [staffArray, setStaffArray] = useState<staffList[]>([]);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [originalPropertyList, setOriginalPropertyList] = useState<Property[]>([]);
    const [sliceStart, setSliceStart] = useState<number>(0);
    const [basicLength, setBasicLength] = useState<number>(20);
    const [targetId, setTargetId] = useState('');
    const [activePage, setActivePage] = useState<number>(1);
    const [selectedShop, setSelectedShop] = useState<string>('');
    const [selectedRank, setSelectedRank] = useState<string>('');
    const [searchedName, setSearchedName] = useState<string>('');
    const [searchedStaff, setSearchedStaff] = useState<string>('');
    const [searchedAddress, setSearchedAddress] = useState<string>('');
    const [checkedCompanyProperty, setCheckedCompanyProperty] = useState(false);
    const [checkedMap, setCheckedMap] = useState(false);
    const [checkedContract, setCheckedContract] = useState(false);
    const [targetProperty, setTargetProperty] = useState<Property>({});
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [suumoSummary, setSuumoSummary] = useState<Record<string, string>[]>([]);
    const [homesSummary, setHomesSummary] = useState<Record<string, string>[]>([]);
    const [athomeSummary, setAthomeSummary] = useState<Record<string, string>[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'pv_total', direction: 'desc' });
    const [editId, setEditId] = useState('');

    const [portalModal, setPortalModal] = useState<{ type: 'SUUMO' | "HOME'S" | 'athome', data: Record<string, string> } | null>(null);

    const ranks = ['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
    const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];
    const categoryMapping: Record<string, string> = {
        spec: '株式会社 国分ハウジング不動産 本店',
        used: '国分ハウジンググループ中古住宅専門店'
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'property', roll: 'list' });
                const shopList = category === 'spec' ? (response.data.shop ?? []).map((s: any) => s.shop) : categoryList;
                setShopArray(shopList);
                setDisplayLength(response.data.property?.length || 0);
                setStaffArray(response.data.staff || []);
                const filteredList = response.data.property.filter((p: any) => removeAllSpaces(p.store_name) === removeAllSpaces(categoryMapping[category])) || [];
                setOriginalPropertyList(filteredList);
                const filteredCustomerList = response.data.customer.filter((c: any) => removeAllSpaces(c.category) === removeAllSpaces(categoryMapping[category])) || [];
                setCustomerList(filteredCustomerList);
                setSuumoSummary(response.data.suumo);
                setAthomeSummary(response.data.athome);
                setHomesSummary(response.data.homes);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [category]);

    const filteredCustomer = useMemo(() => {
        return customerList.filter(c => c.property_name);
    }, [customerList]);

    const normalizePropertyName = (str?: string | null | number) => {
        if (!str) return '';
        return String(str)
            .replace(/[（(]非?公開[）)]/g, '')
            .replace(/[\s ]+/g, '');
    };

    const propertyList = useMemo(() => {
        const targetStaffs = staffArray.filter(s => s.shop === selectedShop).map(s => safeClean(s.name));
        const expectedStore = categoryMapping[category];

        const formate = (value: string) => new Date((value ?? '').replace(/\//g, '-')).getTime();
        const isContract = (value: string) => {
            const recentDate = [...originalPropertyList].sort((a, b) => formate(String(b.registered)) - formate(String(a.registered)))[0]?.registered;
            return recentDate !== value;
        };

        const targetList = originalPropertyList.filter(o => {
            const safePropName = normalizePropertyName(o.property_name);
            const baseCustomers = filteredCustomer.filter(f => {
                const customerPropName = normalizePropertyName(f.property_name);
                if (!safePropName || !customerPropName) return false;
                return customerPropName.includes(safePropName);
            });
            const hasSelectedRank = baseCustomers.some(f => f.rank === selectedRank);
            const isMatchStore = expectedStore ? safeClean(String(o.store_name)) === safeClean(expectedStore) : true;
            return (
                isMatchStore
                && (checkedCompanyProperty ? safeClean(String(o.agency)) === '株式会社国分ハウジング' : true)
                && (selectedShop ? targetStaffs.includes(safeClean(String(o.property_staff))) : true)
                && (searchedName ? (String(o.property_name) || '').includes(searchedName) : true)
                && (searchedAddress ? (String(o.address) || '').includes(searchedAddress) : true)
                && (searchedStaff ? safeClean(String(o.property_staff)).includes(safeClean(searchedStaff)) : true)
                && (selectedRank ? hasSelectedRank : true)
                && (checkedContract ? isContract(String(o.registered)) : !isContract(String(o.registered)))
            );
        });

        const mappedResult = targetList.map(t => {
            const safePropName = normalizePropertyName(t.property_name);
            const base = filteredCustomer.filter(f => {
                const customerPropName = normalizePropertyName(f.property_name);
                if (!safePropName || !customerPropName) return false;
                return customerPropName.includes(safePropName);
            });

            const rawSuumo = suumoSummary.find(s => String(s.management_no).trim() === String(t.property_id).trim());
            const rawHomes = homesSummary.find(s => String(s.company_management_number).trim() === String(t.property_id).trim());
            const targetIdStr = String(t.property_id ?? '').trim();
            const rawAthome = athomeSummary.find(a => {
                const no = String(a.management_no ?? '').trim();
                return no.slice(-6) === targetIdStr || no === targetIdStr;
            });

            const pv_suumo = rawSuumo?.pv_total;
            const now = new Date();
            const today = now.getDate() || 1;
            const pv_homes = rawHomes?.detail_page_views;
            const formattedHomes = Math.ceil((Number(pv_homes ?? 0) / today) * 10) / 10;

            let pv_athome = 0;
            if (rawAthome?.start_date && rawAthome?.end_date) {
                const startDateStr = String(rawAthome.start_date).replace(/\//g, '-');
                const endDateStr = String(rawAthome.end_date).replace(/\//g, '-');
                const startDate = new Date(startDateStr);
                const endDate = new Date(endDateStr);
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    const diffTime = endDate.getTime() - startDate.getTime();
                    const elapsedDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                    pv_athome = Math.ceil((Number(rawAthome.pv_total ?? 0) / elapsedDays) * 10) / 10;
                }
            }

            return {
                property_id: t.property_id,
                property_name: t.property_name,
                address: t.address,
                register: base.filter(b => b.register),
                building_age: t.building_age,
                price: t.price,
                agency: t.agency,
                property_staff: t.property_staff,
                pv_total: Number(pv_suumo ?? 0) + Number(formattedHomes ?? 0) + Number(pv_athome ?? 0),
                pv_suumo: Number(pv_suumo ?? 0),
                pv_homes: formattedHomes,
                pv_athome,
                raw_suumo: rawSuumo,
                raw_homes: rawHomes,
                raw_athome: rawAthome
            };
        });

        const sortedResult = [...mappedResult].sort((a, b) => {
            const getValue = (item: Record<string, any>, key: string): number => {
                if (key === 'register' || key === 'tour') return item[key]?.length ?? 0;
                return Number(item[key] ?? 0);
            };
            const aValue = getValue(a, sortConfig.key);
            const bValue = getValue(b, sortConfig.key);
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sortedResult;
    }, [
        originalPropertyList, checkedCompanyProperty, selectedShop, searchedName,
        searchedAddress, searchedStaff, selectedRank, filteredCustomer, staffArray,
        category, checkedContract, suumoSummary, homesSummary, athomeSummary,
        sortConfig
    ]);

    const pages: Record<string, number | null> = { page1: null, page2: null, page3: null, page4: null, page5: null };
    Object.entries(pages).forEach(([key, _], index) => {
        if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
            pages[key] = activePage + index - 4;
        } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
            pages[key] = activePage + index - 3;
        } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
            pages[key] = activePage + index - 2;
        } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
            pages[key] = activePage + index - 2;
        } else if (index > 0 && (Math.ceil(displayLength / basicLength) < index + 1)) {
            pages[key] = null;
        } else {
            pages[key] = index + 1;
        }
    });

    const handlePageClick = async (page: number) => {
        setActivePage(page);
        setSliceStart((page - 1) * basicLength);
    };

    useEffect(() => {
        if (!targetId) return;
        const target = originalPropertyList.find(o => o.property_id === targetId);
        if (target) setTargetProperty(target);
    }, [targetId, originalPropertyList]);

    const closeInformationEdit = async () => setEditId('');

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key) return <span className="text-muted ms-1 opacity-25" style={{ fontSize: '10px' }}>↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▲</span> : <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▼</span>;
    };

    const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8f9fa', whiteSpace: 'nowrap' };

    return (
        <>
            <div className="content database bg-light p-3">
                {/* 検索コントロール群 */}
                <div className='d-flex flex-wrap align-items-center mb-2 gap-2'>
                    {category === 'spec' && (
                        <select className="form-select form-select-sm w-auto shadow-sm" onChange={(e) => setSelectedShop(e.target.value)} value={selectedShop}>
                            <option value="">店舗を選択</option>
                            {shopArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                        </select>
                    )}
                    <select className="form-select form-select-sm w-auto shadow-sm" onChange={(e) => setSelectedRank(e.target.value)} value={selectedRank}>
                        <option value="">ランクを選択</option>
                        {ranks.map((rank, rIndex) => <option key={rIndex} value={rank}>{rank}</option>)}
                    </select>
                    <input className="form-control form-control-sm w-auto shadow-sm" type='text' placeholder='物件名で検索' onChange={(e) => setSearchedName(e.target.value)} />
                    <input className="form-control form-control-sm w-auto shadow-sm" type='text' placeholder='住所で検索' onChange={(e) => setSearchedAddress(e.target.value)} />
                    <input className="form-control form-control-sm w-auto shadow-sm" type='text' placeholder='営業名で検索' onChange={(e) => setSearchedStaff(e.target.value)} />
                </div>

                <div className='d-flex flex-wrap align-items-center mb-3 gap-3' style={{ fontSize: '12px' }}>
                    <div className="form-check">
                        <input className="form-check-input shadow-sm" type='checkbox' id="checkCompany" onChange={() => setCheckedCompanyProperty(!checkedCompanyProperty)} checked={checkedCompanyProperty} />
                        <label className="form-check-label" htmlFor="checkCompany">自社物件を表示</label>
                    </div>
                    <div className="form-check">
                        <input className="form-check-input shadow-sm" type='checkbox' id="checkContract" onChange={() => setCheckedContract(!checkedContract)} checked={checkedContract} />
                        <label className="form-check-label" htmlFor="checkContract">契約済みの物件を表示</label>
                    </div>
                    <div className="form-check">
                        <input className="form-check-input shadow-sm" type='checkbox' id="checkMap" onChange={() => setCheckedMap(!checkedMap)} checked={checkedMap} />
                        <label className="form-check-label" htmlFor="checkMap">MAPを表示</label>
                    </div>
                </div>

                {/* ページネーション & 件数表示 */}
                <div className="d-flex justify-content-between align-items-end mb-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="fw-bold text-secondary">
                            全 {propertyList.length} 件 <span className="fw-normal" style={{ fontSize: '12px' }}>({sliceStart + 1} ~ {Math.min(activePage * basicLength, propertyList.length)}件)</span>
                        </div>
                        <select className="form-select form-select-sm shadow-sm" style={{ width: '80px' }} value={basicLength} onChange={(e) => setBasicLength(Number(e.target.value))}>
                            <option value='20'>20件</option>
                            <option value='50'>50件</option>
                            <option value='100'>100件</option>
                            <option value='500'>500件</option>
                        </select>
                    </div>
                    <div>
                        <ul className="custom-pagination m-0">
                            <li><button onClick={() => handlePageClick(1)}>«</button></li>
                            <li><button onClick={() => handlePageClick(Math.max(activePage - 1, 1))}>‹</button></li>
                            {Object.entries(pages).map(([key, value]) => {
                                if (value === null) return null;
                                return (
                                    <li key={key} className={activePage === value ? 'active' : ''}>
                                        <button onClick={() => handlePageClick(value)}>{value}</button>
                                    </li>
                                );
                            })}
                            <li><button onClick={() => handlePageClick(Math.min(activePage + 1, Math.ceil(displayLength / basicLength)))}>›</button></li>
                            <li><button onClick={() => handlePageClick(Math.ceil(displayLength / basicLength))}>»</button></li>
                        </ul>
                    </div>
                </div>

                {/* テーブルUI */}
                <div className="card shadow-sm border-0 rounded-3">
                    <div className="card-body p-0">
                        <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                            <table className="table table-hover align-middle mb-0 text-center text-nowrap" style={{ fontSize: '12px' }}>
                                <thead className="table-light border-bottom border-2" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th className="py-2" style={{ width: '40px' }}>No</th>
                                        <th className="py-2">詳細</th>
                                        <th className="py-2 text-start">物件名</th>
                                        <th className="py-2 text-start">住所</th>
                                        <th className="py-2" style={thStyle} onClick={() => requestSort('register')}>反響数 {getSortIcon('register')}</th>
                                        <th className="py-2 border-start bg-light" style={thStyle} onClick={() => requestSort('pv_total')}>総PV {getSortIcon('pv_total')}</th>
                                        <th className="py-2 bg-light text-success" style={thStyle} onClick={() => requestSort('pv_suumo')}>SUUMO {getSortIcon('pv_suumo')}</th>
                                        <th className="py-2 bg-light text-danger" style={thStyle} onClick={() => requestSort('pv_homes')}>HOME'S {getSortIcon('pv_homes')}</th>
                                        <th className="py-2 bg-light text-primary" style={thStyle} onClick={() => requestSort('pv_athome')}>athome {getSortIcon('pv_athome')}</th>
                                        <th className="py-2 border-start">建築時期</th>
                                        <th className="py-2 text-end">価格</th>
                                        <th className="py-2">取扱</th>
                                        <th className="py-2">担当</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {propertyList.slice(sliceStart, sliceStart + basicLength).map((item, index) => (
                                        <tr key={item.property_id || index}>
                                            <td className="text-muted">{sliceStart + index + 1}</td>
                                            <td>
                                                <button className='btn btn-sm btn-outline-danger rounded-pill px-3 py-0' style={{ fontSize: "11px" }} onClick={() => setTargetId(String(item.property_id || ''))}>詳細</button>
                                            </td>
                                            <td className="text-start fw-bold" style={{ minWidth: '150px', maxWidth: '250px' }}>
                                                <div style={{ maxHeight: '3.5em', overflowY: 'auto', whiteSpace: 'normal', wordBreak: 'break-word', paddingRight: '4px' }}>
                                                    {item.property_name}
                                                </div>
                                            </td>
                                            <td className="text-start text-muted" style={{ minWidth: '150px', maxWidth: '250px' }}>
                                                <div style={{ maxHeight: '3.5em', overflowY: 'auto', whiteSpace: 'normal', wordBreak: 'break-word', paddingRight: '4px' }}>
                                                    {item.address}
                                                </div>
                                            </td>
                                            <td className="fw-bold">{item.register.length}</td>
                                            <td className="border-start bg-light fw-bold">{Number(item.pv_total || 0).toLocaleString()}</td>

                                            <td className="bg-light text-success fw-bold">
                                                {item.raw_suumo ? (
                                                    <span className="text-decoration-underline" style={{ cursor: 'pointer' }} onClick={() => setPortalModal({ type: 'SUUMO', data: item.raw_suumo! })}>
                                                        {Number(item.pv_suumo || 0).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span>{Number(item.pv_suumo || 0).toLocaleString()}</span>
                                                )}
                                            </td>

                                            <td className="bg-light text-danger fw-bold">
                                                {item.raw_homes ? (
                                                    <span className="text-decoration-underline" style={{ cursor: 'pointer' }} onClick={() => setPortalModal({ type: "HOME'S", data: item.raw_homes! })}>
                                                        {Number(item.pv_homes || 0).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span>{Number(item.pv_homes || 0).toLocaleString()}</span>
                                                )}
                                            </td>

                                            <td className="bg-light text-primary fw-bold">
                                                {item.raw_athome ? (
                                                    <span className="text-decoration-underline" style={{ cursor: 'pointer' }} onClick={() => setPortalModal({ type: 'athome', data: item.raw_athome! })}>
                                                        {Number(item.pv_athome || 0).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span>{Number(item.pv_athome || 0).toLocaleString()}</span>
                                                )}
                                            </td>

                                            <td className="border-start">{item.building_age}</td>
                                            <td className="text-end">{item.price}</td>
                                            <td>{item.agency}</td>
                                            <td>{item.property_staff}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* 💡 洗練されたポータル詳細情報用モーダル */}
            <Modal show={!!portalModal} onHide={() => setPortalModal(null)} size="lg" centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title style={{ color: '#495057', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        {portalModal?.type === 'SUUMO' && <i className="bi bi-phone me-2 text-success"></i>}
                        {portalModal?.type === "HOME'S" && <i className="bi bi-house me-2 text-danger"></i>}
                        {portalModal?.type === 'athome' && <i className="bi bi-geo-alt me-2 text-primary"></i>}
                        {portalModal?.type} 掲載サマリ
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-3 pb-4" style={{ backgroundColor: '#fafbfe' }}>

                    {/* === SUUMO View === */}
                    {portalModal?.type === 'SUUMO' && portalModal.data && (
                        <div className="row g-3">
                            <div className="col-12">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>概要・キャッチ</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>基本情報</th><td style={modalStyles.td}>{portalModal.data.basic_info}</td></tr>
                                            <tr><th style={modalStyles.th}>立地・価格</th><td style={modalStyles.td}>{portalModal.data.location_and_price}</td></tr>
                                            <tr><th style={modalStyles.th}>サマリー</th><td style={modalStyles.td}>{portalModal.data.summary}</td></tr>
                                            <tr><th style={modalStyles.th}>キャッチ・PR</th><td style={modalStyles.td}>{portalModal.data.catch_and_layout}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>ステータス・画像</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>成約状況</th><td style={modalStyles.td}>{portalModal.data.contract_status}</td></tr>
                                            <tr><th style={modalStyles.th}>ネット掲載</th><td style={modalStyles.td}>{portalModal.data.suumo_net_status}</td></tr>
                                            <tr><th style={modalStyles.th}>総画像数</th><td style={modalStyles.td}>{portalModal.data.total_images} 枚</td></tr>
                                            <tr><th style={modalStyles.th}>更新日時</th><td style={modalStyles.td}>{portalModal.data.timestamps_info}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>PV・反響</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>累計 PV</th><td style={{ ...modalStyles.td, color: '#38a169', fontSize: '16px' }}>{portalModal.data.pv_total}</td></tr>
                                            <tr><th style={modalStyles.th}>直近1週 PV</th><td style={{ ...modalStyles.td, color: '#2b6cb0', fontSize: '14px' }}>{portalModal.data.pv_recent_week}</td></tr>
                                            <tr><th style={modalStyles.th}>オプション</th><td style={modalStyles.td}>{portalModal.data.suumo_net_options}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === HOME'S View === */}
                    {portalModal?.type === "HOME'S" && portalModal.data && (
                        <div className="row g-3">
                            <div className="col-12">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>物件情報</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>物件名</th><td style={modalStyles.td}>{portalModal.data.property_name}</td></tr>
                                            <tr><th style={modalStyles.th}>住所</th><td style={modalStyles.td}>{portalModal.data.address}</td></tr>
                                            <tr><th style={modalStyles.th}>交通</th><td style={modalStyles.td}>{portalModal.data.railway_line} {portalModal.data.station} <span className="ms-2 text-muted">徒歩{portalModal.data.walk_minutes}分</span></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>価格・属性</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>価格</th><td style={{ ...modalStyles.td, color: '#e53e3e' }}>{portalModal.data.price_rent}</td></tr>
                                            <tr><th style={modalStyles.th}>種別 / 築年</th><td style={modalStyles.td}>{portalModal.data.property_type} / {portalModal.data.construction_year}</td></tr>
                                            <tr><th style={modalStyles.th}>間取り</th><td style={modalStyles.td}>{portalModal.data.layout || '-'} <span className="ms-2 text-muted">{portalModal.data.exclusive_area || ''}</span></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>掲載・反響</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>ステータス</th><td style={modalStyles.td}>{portalModal.data.status}</td></tr>
                                            <tr><th style={modalStyles.th}>閲覧数 (PV)</th><td style={{ ...modalStyles.td, color: '#c53030', fontSize: '16px' }}>{portalModal.data.detail_page_views}</td></tr>
                                            <tr><th style={modalStyles.th}>問合せ数</th><td style={modalStyles.td}>{portalModal.data.inquiries_count} 件 <span className="text-muted ms-2">(率: {portalModal.data.inquiry_rate})</span></td></tr>
                                            <tr><th style={modalStyles.th}>掲載 / 更新</th><td style={{ ...modalStyles.td, fontSize: '11px' }}>{portalModal.data.created_date} / {portalModal.data.updated_date}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === athome View === */}
                    {portalModal?.type === 'athome' && portalModal.data && (
                        <div className="row g-3">
                            <div className="col-12">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>物件情報</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>住所</th><td style={modalStyles.td}>{portalModal.data.address}</td></tr>
                                            <tr><th style={modalStyles.th}>交通</th><td style={modalStyles.td}>{portalModal.data.line_station}</td></tr>
                                            <tr><th style={modalStyles.th}>種目 / 掲載日</th><td style={modalStyles.td}>{portalModal.data.property_type} <span className="ms-3 text-muted">公開: {portalModal.data.published_date}</span></td></tr>
                                            <tr><th style={modalStyles.th}>価格</th><td style={{ ...modalStyles.td, color: '#e53e3e', fontSize: '14px' }}>{portalModal.data.price_man_yen} 万円</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>PV詳細 <span className="fw-normal text-muted ms-2" style={{ fontSize: '11px' }}>{portalModal.data.start_date} ~ {portalModal.data.end_date}</span></div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>合計 PV</th><td style={{ ...modalStyles.td, color: '#2b6cb0', fontSize: '16px' }}>{portalModal.data.pv_total}</td></tr>
                                            <tr><th style={modalStyles.th}>PC / SP</th><td style={modalStyles.td}>{portalModal.data.pv_pc} / {portalModal.data.pv_sp}</td></tr>
                                            <tr><th style={modalStyles.th}>お気に入り</th><td style={modalStyles.td}>{portalModal.data.favorite_count} 件</td></tr>
                                            <tr><th style={modalStyles.th}>画像 / ムービー</th><td style={modalStyles.td}>{portalModal.data.photo_count} 枚 / 再生: {portalModal.data.movie_play_count} 回</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div style={modalStyles.card}>
                                    <div style={modalStyles.cardHeader}>反響詳細</div>
                                    <table style={modalStyles.table}>
                                        <tbody>
                                            <tr><th style={modalStyles.th}>合計 反響</th><td style={{ ...modalStyles.td, color: '#d69e2e', fontSize: '16px' }}>{portalModal.data.inquiry_total}</td></tr>
                                            <tr><th style={modalStyles.th}>PC / SP</th><td style={modalStyles.td}>{portalModal.data.inquiry_pc} / {portalModal.data.inquiry_sp}</td></tr>
                                            <tr><th style={modalStyles.th}>通話 / LINE</th><td style={modalStyles.td}>{portalModal.data.inquiry_call} / {portalModal.data.inquiry_line}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            <PropertySummary
                targetId={targetId}
                setTargetId={setTargetId}
                setEditId={setEditId}
            />
            {category === 'spec' && <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />}
            {category === 'used' && <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />}
        </>
    );
}

export default DatabaseProperty;