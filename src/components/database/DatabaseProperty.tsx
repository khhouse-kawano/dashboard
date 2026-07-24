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
type Property = Record<string, string>;
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

// 💡 スペースと null を安全に除去するヘルパー（PHPからのデータ揺れ対策）
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
    const [selectedShop, setSelectedShop] = useState<string>('')
    const [selectedRank, setSelectedRank] = useState<string>('')
    const [searchedName, setSearchedName] = useState<string>('')
    const [searchedStaff, setSearchedStaff] = useState<string>('');
    const [searchedAddress, setSearchedAddress] = useState<string>('');
    const [checkedCompanyProperty, setCheckedCompanyProperty] = useState(false);
    const [checkedMap, setCheckedMap] = useState(false);
    const [checkedContract, setCheckedContract] = useState(false);
    const [targetProperty, setTargetProperty] = useState<Property>({});
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const ranks = ['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
    const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'property' });
                const shopList = category === 'spec' ? (response.data.shop ?? []).map((s: any) => s.shop) : categoryList;
                setShopArray(shopList);
                setDisplayLength(response.data.property?.length || 0);
                setStaffArray(response.data.staff || []);
                setOriginalPropertyList(response.data.property || []);
                setCustomerList(response.data.customer || []);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [category]);

    const filteredCustomer = useMemo(() => {
        return customerList.filter(c => c.property_name);
    }, [customerList]);

    const normalizePropertyName = (str?: string | null) => {
        if (!str) return '';
        return String(str)
            .replace(/[（(]非?公開[）)]/g, '') // 全角・半角の (公開) と (非公開) を削除
            .replace(/[\s ]+/g, '');         // 全角・半角スペースを削除
    };

    const propertyList = useMemo(() => {
        const targetStaffs = staffArray.filter(s => s.shop === selectedShop).map(s => safeClean(s.name));

        const categoryMapping: Record<string, string> = {
            'spec': '株式会社国分ハウジング不動産本店',
            'used': '国分ハウジンググループ中古住宅専門店'
        };

        const expectedStore = categoryMapping[category];

        const formate = (value: string) => {
            return new Date((value ?? '').replace(/\//g, '-')).getTime();
        };

        const isContract = (value: string) => {
            const recentDate = originalPropertyList.sort((a, b) => formate(b.registered) - formate(a.registered))[0]?.registered;
            return recentDate !== value;
        };

        return originalPropertyList.filter(o => {



            // --- フィルター処理部 ---
            // (o は originalPropertyList の1行分)
            const safePropName = normalizePropertyName(o.property_name);

            const baseCustomers = filteredCustomer.filter(f => {
                const customerPropName = normalizePropertyName(f.property_name);

                if (!safePropName || !customerPropName) return false;

                return customerPropName.includes(safePropName);
            });

            console.log(safePropName)
            const hasSelectedRank = baseCustomers.some(f => f.rank === selectedRank);

            const isMatchStore = expectedStore
                ? safeClean(o.store_name) === expectedStore
                : true;

            return (
                isMatchStore
                && (checkedCompanyProperty ? safeClean(o.agency) === '株式会社国分ハウジング' : true)
                && (selectedShop ? targetStaffs.includes(safeClean(o.property_staff)) : true)
                && (searchedName ? (o.property_name || '').includes(searchedName) : true)
                && (searchedAddress ? (o.address || '').includes(searchedAddress) : true)
                && (searchedStaff ? safeClean(o.property_staff).includes(safeClean(searchedStaff)) : true)
                && (selectedRank ? hasSelectedRank : true)
                && (checkedContract ? isContract(o.registered) : !isContract(o.registered))
            );
        });
    }, [originalPropertyList, checkedCompanyProperty, selectedShop, searchedName, searchedAddress, searchedStaff, selectedRank, filteredCustomer, staffArray, category, checkedContract]);


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

    const containerStyle = { width: '100%', height: '600px' };
    const [zoom, setZoom] = useState(10);
    const mapRef = useRef<google.maps.Map | null>(null);

    useEffect(() => {
        if (!targetId) return;
        const target = originalPropertyList.find(o => o.property_id === targetId);
        if (target) setTargetProperty(target);
    }, [targetId, originalPropertyList]);

    const [editId, setEditId] = useState('');
    const closeInformationEdit = async () => setEditId('');

    const [targetSort, setTargetSort] = useState('register');
    const sortMapping: Record<string, string> = {
        'register': 'property_name',
        'tour': 'property_tour_name'
    };

    return (
        <>
            <div className="content database bg-white p-2">
                <div className='px-3 d-flex flex-wrap align-items-center'>
                    {category === 'spec' && <div className="m-1">
                        <select className="target" onChange={(e) => setSelectedShop(e.target.value)}>
                            <option value="">店舗を選択</option>
                            {shopArray.map((item, index) => <option key={index} value={item} selected={selectedShop === item}>{item}</option>)}
                        </select>
                    </div>}
                    <div className="m-1">
                        <select className="target" onChange={(e) => setSelectedRank(e.target.value)}>
                            <option value="">ランクを選択</option>
                            {ranks.map((rank, rIndex) => <option key={rIndex} value={rank} selected={rank === selectedRank}>{rank}</option>)}
                        </select>
                    </div>
                    <div className="m-1">
                        <input className="target" type='text' placeholder='物件名で検索' onChange={(e) => setSearchedName(e.target.value)} />
                    </div>
                    <div className="m-1">
                        <input className="target" type='text' placeholder='住所で検索' onChange={(e) => setSearchedAddress(e.target.value)} />
                    </div>
                    <div className="m-1">
                        <input className="target" type='text' placeholder='営業名で検索' onChange={(e) => setSearchedStaff(e.target.value)} />
                    </div>
                </div>

                <div className='px-3 d-flex flex-wrap align-items-center' style={{ fontSize: '11px' }}>
                    <div className="m-1">
                        <label className='d-flex align-items-center'>
                            <input type='checkbox' onChange={() => setCheckedCompanyProperty(!checkedCompanyProperty)} checked={checkedCompanyProperty} />自社物件を表示
                        </label>
                    </div>
                    <div className="m-1">
                        <label className='d-flex align-items-center'>
                            <input type='checkbox' onChange={() => setCheckedContract(!checkedContract)} checked={checkedContract} />契約済みの物件を表示
                        </label>
                    </div>
                    <div className="m-1">
                        <label className='d-flex align-items-center'>
                            <input type='checkbox' onChange={() => setCheckedMap(!checkedMap)} checked={checkedMap} />MAPを表示
                        </label>
                    </div>
                    {checkedMap && <>
                        <div style={{ width: "12px" }}><img src={Blue} className="w-100" alt="blue-pin" /></div>
                        <div style={{ marginLeft: "4px" }}>自社物件</div>
                        <div style={{ width: "12px", marginLeft: "20px" }}><img src={Red} className="w-100" alt="red-pin" /></div>
                        <div style={{ marginLeft: "4px" }}>仲介物件</div>
                    </>}
                </div>

                <div className="d-md-flex">
                    <div className="d-flex flex-wrap align-items-center">
                        <div className="">{propertyList.length}<span style={{ fontSize: '12px' }}> 件中 {sliceStart + 1}件~{propertyList.length > activePage * basicLength ? activePage * basicLength : propertyList.length}件</span></div>
                        <div className="ms-1" style={{ fontSize: '11px' }}>
                            表示件数
                            <select style={{ fontSize: '11px', borderRadius: '5px', width: '70px' }} onChange={(e) => setBasicLength(Number(e.target.value))}>
                                <option value='20'>20件</option>
                                <option value='50'>50件</option>
                                <option value='100'>100件</option>
                                <option value='500'>500件</option>
                            </select>
                        </div>
                    </div>
                    <div className="d-flex flex-wrap align-items-center">
                        <div className="m-1 pt-3">
                            <ul className="custom-pagination">
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
                                <li><button onClick={() => handlePageClick(activePage + 1 < Math.ceil(displayLength / basicLength) ? activePage + 1 : Math.ceil(displayLength / basicLength))}>›</button></li>
                                <li><button onClick={() => handlePageClick(Math.ceil(displayLength / basicLength))}>»</button></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className='table-wrapper'>
                    <Table style={{ fontSize: '11px', textAlign: 'center' }} bordered striped>
                        <tbody className='align-middle'>
                            <tr>
                                <td>No</td>
                                <td>サマリ</td>
                                <td>物件名</td>
                                <td>住所</td>
                                <td>反響数<span onClick={() => setTargetSort('register')} className='pointer'>▼</span></td>
                                <td>案内数<span onClick={() => setTargetSort('tour')} className='pointer'>▼</span></td>
                                <td>建築時期</td>
                                <td>価格</td>
                                <td>取扱</td>
                                <td>担当</td>
                            </tr>
                            {propertyList
                                .sort((a, b) => {
                                    const sortKey = sortMapping[targetSort];
                                    if (!sortKey) return 0;

                                    // 💡 比較元の物件名も正規化
                                    const safePropA = normalizePropertyName(a.property_name);
                                    const safePropB = normalizePropertyName(b.property_name);

                                    // 💡 Aの反響/案内数をカウント（空文字マッチ防御付き）
                                    const sortA = filteredCustomer.filter(f => {
                                        const customerVal = normalizePropertyName(f[sortKey]);
                                        if (!safePropA || !customerVal) return false;
                                        return customerVal.includes(safePropA);
                                    }).length;

                                    // 💡 Bの反響/案内数をカウント（空文字マッチ防御付き）
                                    const sortB = filteredCustomer.filter(f => {
                                        const customerVal = normalizePropertyName(f[sortKey]);
                                        if (!safePropB || !customerVal) return false;
                                        return customerVal.includes(safePropB);
                                    }).length;

                                    return sortB - sortA;
                                })
                                .slice(sliceStart, sliceStart + basicLength).map((item, index) => {
                                    // 💡 正規化済みの検索元（物件名）
                                    const safePropName = normalizePropertyName(item.property_name);

                                    // 💡 堅牢化した反響数（register）のフィルター
                                    const register = filteredCustomer.filter(f => {
                                        const customerPropName = normalizePropertyName(f.property_name);
                                        if (!safePropName || !customerPropName) return false;
                                        return customerPropName.includes(safePropName) && f.register;
                                    });

                                    // 💡 堅牢化した案内数（tour）のフィルター
                                    const tour = filteredCustomer.filter(f => {
                                        const customerTourName = normalizePropertyName(f.property_tour_name);
                                        if (!safePropName || !customerTourName) return false;
                                        return customerTourName.includes(safePropName);
                                    });

                                    return <tr key={item.property_id || index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }}
                                                onClick={() => setTargetId(item.property_id || '')}>詳細</div>
                                        </td>
                                        <td>{item.property_name}</td>
                                        <td>{item.address}</td>
                                        <td>{register.length}</td>
                                        <td>{tour.length}</td>
                                        <td>{item.building_age}</td>
                                        <td>{item.price}</td>
                                        <td>{item.agency}</td>
                                        <td>{item.property_staff}</td>
                                    </tr>
                                })}
                        </tbody>
                    </Table>
                </div>
            </div>

            {/* モーダル群 */}
            <Modal show={!!targetId} onHide={() => setTargetId('')} size='lg'>
                <Modal.Header closeButton>{targetProperty?.property_name || ''} 反響一覧</Modal.Header>
                <Modal.Body>
                    <Table>
                        <tbody style={{ fontSize: '11px' }}>
                            <tr>
                                <td style={{ width: '20%' }}>所在地</td>
                                <td style={{ width: '30%' }}>{targetProperty?.address}</td>
                                <td style={{ width: '20%' }}>担当営業</td>
                                <td style={{ width: '30%' }}>{targetProperty?.property_staff}</td>
                            </tr>
                            <tr>
                                <td>価格</td>
                                <td>{targetProperty?.price}</td>
                                <td>取扱</td>
                                <td>{targetProperty?.seller}</td>
                            </tr>
                            <tr>
                                <td>土地面積</td>
                                <td>{targetProperty?.land_area}</td>
                                <td>建築面積</td>
                                <td>{targetProperty?.building_area}</td>
                            </tr>
                            <tr>
                                <td>間取り</td>
                                <td>{targetProperty?.layout}</td>
                                <td>建築時期</td>
                                <td>{targetProperty?.building_age}</td>
                            </tr>
                        </tbody>
                    </Table>
                    <Table bordered>
                        <tbody style={{ fontSize: '11px' }}>
                            <tr>
                                <td>No</td>
                                <td>顧客名</td>
                                <td>ランク</td>
                                <td>反響取得日</td>
                                <td>初回来場日</td>
                                <td>販促媒体</td>
                            </tr>
                            {filteredCustomer.filter(f => {
                                // 💡 ターゲット（表示中の物件）と顧客の物件名の両方を正規化して比較
                                const safeTargetProp = normalizePropertyName(targetProperty?.property_name);
                                const customerPropName = normalizePropertyName(f.property_name);

                                // 空文字による全件マッチバグを防御
                                if (!safeTargetProp || !customerPropName) return false;

                                return customerPropName.includes(safeTargetProp);
                            }).map((item, index) =>
                                <tr key={item.id || index}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <span style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
                                            onClick={() => setEditId(item.id)}>{item.customer}
                                        </span>
                                    </td>
                                    <td>{item.rank}</td>
                                    <td>{item.register}</td>
                                    <td>{item.interview}</td>
                                    <td>{item.medium}</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>

            <Modal show={checkedMap} onHide={() => setCheckedMap(false)} size='xl'>
                <Modal.Header closeButton>物件一覧</Modal.Header>
                <Modal.Body>
                    <div className='px-3 d-flex flex-wrap align-items-center'>
                        {category === 'spec' && <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedShop(e.target.value)}>
                                <option value="">店舗を選択</option>
                                {shopArray.map((item, index) => <option key={index} value={item} selected={selectedShop === item}>{item}</option>)}
                            </select>
                        </div>}
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedRank(e.target.value)}>
                                <option value="">ランクを選択</option>
                                {ranks.map((rank, rIndex) => <option key={rIndex} value={rank} selected={rank === selectedRank}>{rank}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <input className="target" type='text' placeholder='物件名で検索' onChange={(e) => setSearchedName(e.target.value)} />
                        </div>
                        <div className="m-1">
                            <input className="target" type='text' placeholder='住所で検索' onChange={(e) => setSearchedAddress(e.target.value)} />
                        </div>
                        <div className="m-1">
                            <input className="target" type='text' placeholder='営業名で検索' onChange={(e) => setSearchedStaff(e.target.value)} />
                        </div>
                    </div>
                    <div className='px-3 d-flex flex-wrap align-items-center' style={{ fontSize: '11px' }}>
                        <div className="m-1">
                            <label className='d-flex align-items-center'>
                                <input type='checkbox' onChange={() => setCheckedCompanyProperty(!checkedCompanyProperty)} checked={checkedCompanyProperty} />自社物件を表示
                            </label>
                        </div>
                        <div className="m-1">
                            <label className='d-flex align-items-center'>
                                <input type='checkbox' onChange={() => setCheckedContract(!checkedContract)} checked={checkedContract} />契約済みの物件を表示
                            </label>
                        </div>
                        <div className="m-1">
                            <label className='d-flex align-items-center'>
                                <input type='checkbox' onChange={() => setCheckedMap(!checkedMap)} checked={checkedMap} />MAPを表示
                            </label>
                        </div>
                        {checkedMap && <>
                            <div style={{ width: "12px" }}><img src={Blue} className="w-100" alt="blue" /></div>
                            <div style={{ marginLeft: "4px" }}>自社物件</div>
                            <div style={{ width: "12px", marginLeft: "20px" }}><img src={Red} className="w-100" alt="red" /></div>
                            <div style={{ marginLeft: "4px" }}>仲介物件</div>
                        </>}
                    </div>
                    <div className='p-2'>
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={mapCenter}
                            zoom={zoom}
                            onLoad={(map) => { mapRef.current = map; }}
                            options={{
                                gestureHandling: "greedy",
                                scrollwheel: true,
                                mapId: "4b6e2e3028fa3ddba1806a73",
                                streetViewControl: false,
                                mapTypeControl: true,
                                fullscreenControl: true,
                                disableDefaultUI: false,
                            }}
                        >
                            {propertyList.map((item) => {
                                const coords = parseLatLng(item.lat_lng);
                                if (!coords) return null;
                                return (
                                    <MarkerF
                                        key={item.property_id || `marker_${coords.lat}_${coords.lng}`}
                                        position={coords}
                                        icon={safeClean(item.agency) === '株式会社国分ハウジング'
                                            ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                                            : "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                                        }
                                        onClick={() => setTargetId(item.property_id || '')}
                                    />
                                );
                            })}
                        </GoogleMap>
                    </div>
                </Modal.Body>
            </Modal>

            {category === 'spec' && <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />}
            {category === 'used' && <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />}
        </>
    );
}

export default DatabaseProperty;