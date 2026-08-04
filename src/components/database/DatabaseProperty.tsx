import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../context/AuthContext';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import Blue from "../../assets/images/blue_ping.png";
import Red from "../../assets/images/red_ping.png";
import InformationEditKaeru from '../information/InformationEditKaeru';
import InformationEditResale from '../information/InformationEditResale';
import apiClient from '../../utils/apiClient';

type shopList = { brand: string, shop: string, section: string };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number };
type Property = Record<string, string | number>;
type Customer = Record<string, string>;

// 💡 経緯度の安全な抽出
const parseLatLng = (latLngStr?: string | null) => {
    if (!latLngStr || typeof latLngStr !== 'string') return null;
    const parts = latLngStr.split(',');
    if (parts.length !== 2) return null;

    const lat = Number(parts[0].trim());
    const lng = Number(parts[1].trim());

    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
};

// 💡 スペースと null を安全に除去するヘルパー
const safeClean = (str?: string | null) => str ? String(str).replace(/[\s ]+/g, "") : "";

const mapCenter = {
    lat: 31.70765588374035,
    lng: 130.61416374485538
};

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

    // ★ ソート設定の管理
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'pv_total', direction: 'desc' });

    const ranks = ['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
    const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];
    const categoryMapping: Record<string, string> = {
        spec: '株式会社 国分ハウジング不動産 本店',
        used: '国分ハウジンググループ中古住宅専門店'
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'property' });
                const shopList = category === 'spec' ? (response.data.shop ?? []).map((s: any) => s.shop) : categoryList;
                setShopArray(shopList);
                setDisplayLength(response.data.property?.length || 0);
                setStaffArray(response.data.staff || []);
                const filteredList = response.data.property.filter((p: any) => p.store_name === categoryMapping[category]) || [];
                setOriginalPropertyList(filteredList);
                const filteredCustomerList = response.data.customer.filter((c: any) => c.category === categoryMapping[category]) || [];
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

        const formate = (value: string) => {
            return new Date((value ?? '').replace(/\//g, '-')).getTime();
        };

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

        // 1. マッピング処理
        const mappedResult = targetList.map(t => {
            const safePropName = normalizePropertyName(t.property_name);

            const base = filteredCustomer.filter(f => {
                const customerPropName = normalizePropertyName(f.property_name);
                if (!safePropName || !customerPropName) return false;
                return customerPropName.includes(safePropName);
            });

            // SUUMO
            const pv_suumo = suumoSummary.find(s => String(s.management_no).trim() === String(t.property_id).trim())?.pv_total;

            const now = new Date();
            const today = now.getDate() || 1;

            // HOMES
            const pv_homes = homesSummary.find(s => String(s.company_management_number).trim() === String(t.property_id).trim())?.detail_page_views;
            const formattedHomes = Math.ceil((Number(pv_homes ?? 0) / today) * 10) / 10;

            // ATHOME 検索 (trim & nullガード)
            const targetIdStr = String(t.property_id ?? '').trim();
            const athomeTarget = athomeSummary.find(a => {
                const no = String(a.management_no ?? '').trim();
                return no.slice(-6) === targetIdStr || no === targetIdStr;
            });
            
            // ATHOME 経過日数と1日あたりPVの安全な計算
            let pv_athome = 0;
            if (athomeTarget?.start_date && athomeTarget?.end_date) {
                const startDateStr = String(athomeTarget.start_date).replace(/\//g, '-');
                const startDate = new Date(startDateStr);

                const endDateStr = String(athomeTarget.end_date).replace(/\//g, '-');
                const endDate = new Date(endDateStr);

                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    const diffTime = endDate.getTime() - startDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const elapsedDays = Math.max(1, diffDays);
                    const rawPv = Number(athomeTarget.pv_total ?? 0);
                    pv_athome = Math.ceil((rawPv / elapsedDays) * 10) / 10;
                }
            }

            const pv_total = Number(pv_suumo ?? 0) + Number(formattedHomes ?? 0) + Number(pv_athome ?? 0);

            return {
                property_id: t.property_id,
                property_name: t.property_name,
                address: t.address,
                register: base.filter(b => b.register), // Array
                tour: base.filter(b => b.tour),         // Array
                building_age: t.building_age,
                price: t.price,
                agency: t.agency,
                property_staff: t.property_staff,
                pv_total,                               // Number
                pv_suumo: Number(pv_suumo ?? 0),        // Number
                pv_homes: formattedHomes,               // Number
                pv_athome                               // Number
            };
        });

        // 2. 💡 マッピング後の結果を sortConfig に基づいてソートする
        const sortedResult = [...mappedResult].sort((a, b) => {
            // TypeScriptの型エラーを回避しつつ、配列(length)と数値を比較可能な数値に統一するヘルパー
            const getValue = (item: Record<string, any>, key: string): number => {
                if (key === 'register' || key === 'tour') {
                    return item[key]?.length ?? 0;
                }
                return Number(item[key] ?? 0);
            };

            const aValue = getValue(a, sortConfig.key);
            const bValue = getValue(b, sortConfig.key);

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sortedResult;
        
        // 💡 依存配列に sortConfig を追加（これがないとクリックしても再計算されません）
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

    const [editId, setEditId] = useState('');
    const closeInformationEdit = async () => setEditId('');

    // ★ 汎用ソートハンドラー
    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key) return <span className="text-muted ms-1 opacity-25" style={{ fontSize: '10px' }}>↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▲</span> : <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▼</span>;
    };

    const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8f9fa', whiteSpace: 'nowrap' };

    return (
        // UI側の変更は不要です (省略せずにそのまま表示可能ですが、ここでは元のコードを保持します)
        // ... (以下略。return 内部はご提示いただいたものと全く同じで動作します)
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
                    {checkedMap && (
                        <div className="d-flex align-items-center ms-2">
                            <img src={Blue} width="14" alt="blue-pin" /> <span className="ms-1 me-3">自社物件</span>
                            <img src={Red} width="14" alt="red-pin" /> <span className="ms-1">仲介物件</span>
                        </div>
                    )}
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

                {/* ★ モダンなカード＆テーブルUI */}
                <div className="card shadow-sm border-0 rounded-3">
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0 text-center" style={{ fontSize: '12px' }}>
                                <thead className="table-light border-bottom border-2">
                                    <tr>
                                        <th className="py-2" style={{ width: '40px' }}>No</th>
                                        <th className="py-2">詳細</th>
                                        <th className="py-2 text-start">物件名</th>
                                        <th className="py-2 text-start">住所</th>
                                        <th className="py-2" style={thStyle} onClick={() => requestSort('register')}>反響数 {getSortIcon('register')}</th>
                                        <th className="py-2" style={thStyle} onClick={() => requestSort('tour')}>案内数 {getSortIcon('tour')}</th>
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
                                    {propertyList.slice(sliceStart, sliceStart + basicLength)
                                        .map((item, index) => {
                                            return (
                                                <tr key={item.property_id || index}>
                                                    <td className="text-muted">{sliceStart + index + 1}</td>
                                                    <td>
                                                        <button className='btn btn-sm btn-outline-danger rounded-pill px-3 py-0' style={{ fontSize: "11px" }} onClick={() => setTargetId(String(item.property_id || ''))}>詳細</button>
                                                    </td>
                                                    <td className="text-start fw-bold">{item.property_name}</td>
                                                    <td className="text-start text-muted">{item.address}</td>
                                                    <td className="fw-bold">{item.register.length}</td>
                                                    <td className="fw-bold">{item.tour.length}</td>

                                                    <td className="border-start bg-light fw-bold">{Number(item.pv_total || 0).toLocaleString()}</td>
                                                    <td className="bg-light text-success fw-bold">{Number(item.pv_suumo || 0).toLocaleString()}</td>
                                                    <td className="bg-light text-danger fw-bold">{Number(item.pv_homes || 0).toLocaleString()}</td>
                                                    <td className="bg-light text-primary fw-bold">{Number(item.pv_athome || 0).toLocaleString()}</td>

                                                    <td className="border-start">{item.building_age}</td>
                                                    <td className="text-end">{item.price}</td>
                                                    <td>{item.agency}</td>
                                                    <td>{item.property_staff}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* 詳細モーダル等は変更なし */}
            <Modal show={!!targetId} onHide={() => setTargetId('')} size='lg' centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">{targetProperty?.property_name || ''}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-2">
                    <p className="text-muted mb-3"><i className="bi bi-geo-alt-fill"></i> {targetProperty?.address}</p>

                    {/* 基本情報テーブル */}
                    <div className="card shadow-sm border-0 mb-4">
                        <Table bordered className="mb-0 text-center align-middle" style={{ fontSize: '12px' }}>
                            <tbody>
                                <tr className="bg-light">
                                    <th style={{ width: '20%' }} className="text-muted fw-normal">所在地</th>
                                    <td style={{ width: '30%' }} className="fw-bold">{targetProperty?.address}</td>
                                    <th style={{ width: '20%' }} className="text-muted fw-normal">担当営業</th>
                                    <td style={{ width: '30%' }} className="fw-bold">{targetProperty?.property_staff}</td>
                                </tr>
                                <tr>
                                    <th className="bg-light text-muted fw-normal">価格</th>
                                    <td className="text-danger fw-bold">{targetProperty?.price}</td>
                                    <th className="bg-light text-muted fw-normal">取扱</th>
                                    <td className="fw-bold">{targetProperty?.seller}</td>
                                </tr>
                                <tr className="bg-light">
                                    <th className="text-muted fw-normal">土地面積</th>
                                    <td className="fw-bold">{targetProperty?.land_area}</td>
                                    <th className="text-muted fw-normal">建築面積</th>
                                    <td className="fw-bold">{targetProperty?.building_area}</td>
                                </tr>
                                <tr>
                                    <th className="bg-light text-muted fw-normal">間取り</th>
                                    <td className="fw-bold">{targetProperty?.layout}</td>
                                    <th className="bg-light text-muted fw-normal">建築時期</th>
                                    <td className="fw-bold">{targetProperty?.building_age}</td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>

                    {/* ★ Google Map Iframe (lat_lngを利用) */}
                    {targetProperty?.lat_lng && (
                        <div className="rounded-3 overflow-hidden shadow-sm mb-4" style={{ height: '300px', backgroundColor: '#e9ecef' }}>
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${targetProperty.lat_lng}&hl=ja&z=16&output=embed`}
                                allowFullScreen
                                title="Property Location Map"
                            ></iframe>
                        </div>
                    )}

                    <h6 className="fw-bold mt-4 mb-2">反響・顧客一覧</h6>
                    <div className="card shadow-sm border-0">
                        <Table hover responsive className="mb-0 text-center align-middle" style={{ fontSize: '12px' }}>
                            <thead className="table-light">
                                <tr>
                                    <th className="py-2">No</th>
                                    <th className="py-2">顧客名</th>
                                    <th className="py-2">ランク</th>
                                    <th className="py-2">反響取得日</th>
                                    <th className="py-2">初回来場日</th>
                                    <th className="py-2">販促媒体</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomer.filter(f => {
                                    const safeTargetProp = normalizePropertyName(targetProperty?.property_name);
                                    const customerPropName = normalizePropertyName(f.property_name);
                                    if (!safeTargetProp || !customerPropName) return false;
                                    return customerPropName.includes(safeTargetProp);
                                }).map((item, index) => (
                                    <tr key={item.id || index}>
                                        <td className="text-muted">{index + 1}</td>
                                        <td>
                                            <span className="text-primary fw-bold pointer" style={{ textDecoration: 'underline dotted' }} onClick={() => setEditId(item.id)}>
                                                {item.customer}
                                            </span>
                                        </td>
                                        <td><span className="badge bg-secondary">{item.rank}</span></td>
                                        <td>{item.register}</td>
                                        <td>{item.interview}</td>
                                        <td>{item.medium}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>
            {category === 'spec' && <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />}
            {category === 'used' && <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />}
        </>
    );
}

export default DatabaseProperty;



