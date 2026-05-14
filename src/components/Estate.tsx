import React, { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import axios from 'axios';
import { headers } from '../utils/headers';
import { townList } from '../utils/townList';
import Modal from 'react-bootstrap/Modal';
import EstateInfo from './EstateInfo';

type Props = {
    estateId: string,
    setEstateId: React.Dispatch<React.SetStateAction<string>>
};

type EstateList = {
    property_id: string,
    property_name: string,
    address_pref: string,
    address_city: string,
    address_town: string,
    railway_line: string,
    land_area: number,
    price: number,
    zoning1: string,
    unit_price_tsubo: number,
    bcr1: number,
    far1: number,
    listing_company: string,
    info_source: string,
    registered_at: string, // API からは string で来る想定に変更
    updated_at: string,
    best_use: string,
    note1: string,
    walk_time1: number
};

type Area = {
    id: string,
    budget: number | null,
    pref: string,
    town: string,
    area: string[],
    land_area: number | null,
    walk: number | null,
    for_house: number
};

const Estate = ({ estateId, setEstateId }: Props) => {
    const [targetId, setTargetId] = useState('');
    const [showDetail, setShowDetail] = useState(false);

    const [targetArea, setTargetArea] = useState<Area>({
        id: '',
        budget: null,
        pref: '',
        town: '',
        area: [],
        land_area: null,
        walk: null,
        for_house: 0
    });

    const [originalList, setOriginalList] = useState<EstateList[]>([]);
    const [estateList, setEstateList] = useState<EstateList[]>([]);
    const [activePage, setActivePage] = useState<number>(1);
    const [sliceStart, setSliceStart] = useState<number>(0);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [basicLength, setBasicLength] = useState<number>(20);
    const [areaText, setAreaText] = useState('');
    const [propertyId, setPropertyId] = useState('');

    useEffect(() => {
        setTargetId(estateId);
    }, [estateId]);

    useEffect(() => {
        if (!targetId) return;

        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'estate', id: targetId }, { headers, timeout: 20000 });
                setOriginalList(response.data.estate);

                const rawArea = response.data.area?.area;

                let area: string[] = [];

                if (Array.isArray(rawArea)) {
                    area = rawArea;
                } else if (typeof rawArea === 'string' && rawArea.trim() !== '') {
                    try {
                        area = JSON.parse(rawArea);
                    } catch {
                        area = [];
                    }
                }

                const areaResponse = {
                    id: response.data.area?.id ?? '',
                    budget: response.data.area?.budget ?? null,
                    pref: response.data.area?.pref ?? '',
                    town: response.data.area?.town ?? '',
                    area,
                    land_area: response.data.area?.land_area ?? null,
                    walk: response.data.area?.walk ?? null,
                    for_house: response.data.area?.for_house ?? 0
                };

                setTargetArea(areaResponse);

                if (areaResponse.pref) setShowDetail(true);

            } catch (e) {
                console.error(e);
                console.error('土地情報の取得に失敗');
            }
        };

        fetchData();
    }, [targetId]);

    useEffect(() => {
        const filtered = originalList.filter(o => {
            const pref = String(o.address_pref ?? '');
            const city = String(o.address_city ?? '');
            const town = String(o.address_town ?? '');
            const name = String(o.property_name ?? '');
            const railway = String(o.railway_line ?? '');
            const zoning1 = String(o.zoning1 ?? '');
            const note = String(o.note1 ?? '');

            return (
                (targetArea.pref
                    ? pref.includes(targetArea.pref)
                    : true
                )

                && (targetArea.town
                    ? (pref.includes(targetArea.town) || city.includes(targetArea.town) || town.includes(targetArea.town))
                    : true
                )

                && (targetArea.land_area
                    ? o.land_area >= targetArea.land_area
                    : true
                )

                && (targetArea.budget
                    ? (o.price >= targetArea.budget - 499 && o.price <= targetArea.budget)
                    : true
                )

                && (targetArea.for_house === 1
                    ? o.best_use === '住宅用地' : true
                )

                && (targetArea.walk
                    ? o.walk_time1 <= targetArea.walk && o.walk_time1 !== 0 : true
                )

                && (targetArea.area.length > 0
                    ? targetArea.area.some(word =>
                        pref.includes(word) ||
                        city.includes(word) ||
                        town.includes(word) ||
                        railway.includes(word) ||
                        zoning1.includes(word) ||
                        note.includes(word)
                    )
                    : true)

            );
        });


        setEstateList(filtered);
        setDisplayLength(filtered.length)
    }, [originalList, targetArea]);

    // ページングリンク
    const pages = {
        page1: null,
        page2: null,
        page3: null,
        page4: null,
        page5: null
    };

    Object.entries(pages).map(([key, _], index) => {
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
    })

    const handlePageClick = async (page: number) => {
        setActivePage(page);
        setSliceStart((page - 1) * basicLength);
    };

    const inputStyle = { border: '1px solid #D3D3D3', borderRadius: '7px', height: '25px', width: '150px', paddingLeft: '10px', margin: '5px', fontSize: '12px' };

    const modalClose = () => {
        const fetchData = async () => {
            const postData = {
                ...targetArea,
                id: targetId,
                request: 'estate_area'
            }
            console.log(postData)
            if (estateId !== 'search') {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
            }

            setEstateId('');
            setActivePage(1);
            setSliceStart(0);
            setDisplayLength(20);
            setBasicLength(20);
            setEstateList([]);
            setTargetArea({
                id: '',
                budget: null,
                pref: '',
                town: '',
                area: [],
                land_area: null,
                walk: null,
                for_house: 0
            });
            setShowDetail(false);
        };
        fetchData();
    };

    return (
        <>
            <Modal show={!!estateId} onHide={modalClose} size='xl' style={{ overflow: 'hidden' }}>
                <Modal.Header closeButton>土地コーディネート</Modal.Header>
                <Modal.Body>
                    <div   >
                        <div className="d-flex mb-3 align-items-center">
                            <div style={{ fontSize: '11px' }} className="me-3">
                                <span className="text-success fw-bold pe-1" style={{ fontSize: '17px' }}>{estateList.length}</span>
                                件HIT
                            </div>
                            <div className="me-3">
                                <select className="p-1" style={inputStyle} value={targetArea.pref}
                                    onChange={(e) => {
                                        setTargetArea(prev =>
                                        ({
                                            ...prev,
                                            pref: e.target.value,
                                            town: '',
                                            area: []
                                        })
                                        );
                                    }}>
                                    <option value="">エリア(県)を選択</option>
                                    {['鹿児島県', '宮崎県', '大分県', '熊本県', '佐賀県'].map((pref, index) =>
                                        <option value={pref} key={index}
                                            selected={targetArea.pref === pref}>{pref}</option>
                                    )}
                                </select>
                            </div>
                            <div className="me-3">
                                <select className="p-1" style={inputStyle} value={targetArea.town}
                                    onChange={(e) =>
                                        setTargetArea(prev => ({
                                            ...prev,
                                            town: e.target.value
                                        }))
                                    }>
                                    <option value="">エリアを絞り込む</option>
                                    {(targetArea.pref ? townList[targetArea.pref] : []).map((town, index) =>
                                        <option value={town} key={index}
                                            selected={targetArea.town === town}>{town}</option>)}
                                </select>
                            </div>
                            {!showDetail && <div className="me-3">
                                <div className="bg-success text-white py-1 px-2 rounded" style={{ fontSize: '12px', cursor: 'pointer' }}
                                    onClick={() => setShowDetail(!showDetail)}>条件を絞り込む</div>
                            </div>}
                        </div>

                        {showDetail &&
                            <div className="p-3 rounded mb-3 position-relative" style={{ backgroundColor: '#05811a15' }}>
                                <div className="d-flex align-items-center">
                                    <div className="me-3 d-flex align-items-center">
                                        <div>
                                            <div className='d-flex align-items-center mb-2'><input type="text" style={{ ...inputStyle, width: '280px' }} placeholder='フリーワード検索 駅名、学校区等'
                                                value={areaText} onChange={(e) => setAreaText(e.target.value)}
                                            />
                                                <div className="bg-success text-white py-1 px-2 rounded ms-1" style={{ fontSize: '12px', cursor: 'pointer', height: '25px' }}
                                                    onClick={() => {
                                                        if (!areaText) return;
                                                        setTargetArea(prev => ({
                                                            ...prev,
                                                            area: [...prev.area, areaText]
                                                        }));
                                                        setAreaText('');
                                                    }}
                                                >条件追加</div>
                                            </div>
                                            {targetArea.area.length > 0 && <div className="d-flex" style={{ fontSize: '11px' }}
                                            >{targetArea.area.map(area =>
                                                <div className='me-3 bg-white p-1 rounded position-relative'>{area}
                                                    <div className="position-absolute text-white bg-success rounded-pill px-1"
                                                        style={{ top: '-7px', right: '-8px', fontSize: '9px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            const filteredArea = targetArea.area.filter(a => a !== area);
                                                            setTargetArea(prev => ({
                                                                ...prev,
                                                                area: filteredArea
                                                            }))
                                                        }}
                                                    >×</div>
                                                </div>
                                            )}</div>}
                                        </div>
                                    </div>

                                    <div className="me-3">
                                        <select className="p-1" style={inputStyle}
                                            onChange={(e) =>
                                                setTargetArea(prev => ({
                                                    ...prev,
                                                    budget: Number(e.target.value)
                                                }))
                                            }>
                                            <option value="">希望予算を選択</option>
                                            {['500', '1000', '1500', '2000', '2500', '3000', '3500', '4000', '4500', '5000', '5500'].map((budget, index) =>
                                                <option key={index} value={budget}
                                                    selected={targetArea.budget === Number(budget)}>{index > 0 && Number(budget) - 499}~{budget}万円</option>)}
                                        </select>
                                    </div>

                                    <div className="me-3">
                                        <select className="p-1" style={inputStyle}
                                            onChange={(e) =>
                                                setTargetArea(prev => ({
                                                    ...prev,
                                                    land_area: Number(e.target.value)
                                                }))
                                            }>
                                            <option value="">希望土地面積を選択</option>
                                            {['40', '50', '60', '70', '80', '90', '100', '150', '200', '250', '300'].map((land, index) =>
                                                <option key={index} value={land}
                                                    selected={targetArea.land_area === Number(land)}>{land}㎡以上</option>)}
                                        </select>
                                    </div>

                                    <div className="me-3">
                                        <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'>
                                            <input type='checkbox' className='me-1'
                                                checked={targetArea.for_house === 1}
                                                onChange={() => setTargetArea(prev => ({
                                                    ...prev,
                                                    for_house: prev.for_house === 1 ? 0 : 1
                                                }))}
                                                style={{ cursor: 'pointer' }}
                                            />住宅用地のみ表示</label>
                                    </div>

                                    <div className="me-3">
                                        <select className="p-1" style={inputStyle}
                                            onChange={(e) =>
                                                setTargetArea(prev => ({
                                                    ...prev,
                                                    walk: Number(e.target.value)
                                                }))
                                            }>
                                            <option value="">駅からの徒歩</option>
                                            {['1', '3', '5', '7', '10', '15', '20'].map((time, index) =>
                                                <option key={index} value={time}
                                                    selected={targetArea.walk === Number(time)}>{time}分以内</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="position-absolute bg-success px-2 py-1 rounded-pill text-white" style={{ top: '-12px', right: '0', fontSize: '12px', cursor: 'pointer' }}
                                    onClick={() => setShowDetail(false)}>×</div>
                            </div>}

                        <div className="d-flex flex-wrap align-items-center">
                            <div className="d-flex flex-wrap align-items-center">
                                <div style={{ fontSize: '12px' }}> {sliceStart + 1}件~{estateList.length > activePage * basicLength ? activePage * basicLength : estateList.length}件</div>
                                <div className="m-1" style={{ fontSize: '11px' }}>
                                    表示件数
                                    <select style={{ ...inputStyle, width: '80px' }} onChange={(e) => setBasicLength(Number(e.target.value))}>
                                        <option value='20'>20件</option>
                                        <option value='50'>50件</option>
                                        <option value='100'>100件</option>
                                        <option value='500'>500件</option>
                                    </select>
                                </div>
                            </div>
                            <div className="m-1" style={{ fontSize: '12px' }}>{sliceStart + 1}件~{estateList.length > activePage * basicLength ? activePage * basicLength : estateList.length}件</div>
                            <div className="m-1 pt-3">
                                <ul className="custom-pagination">
                                    <li>
                                        <button onClick={() => handlePageClick(1)}>«</button>
                                    </li>
                                    <li>
                                        <button onClick={() => handlePageClick(Math.max(activePage - 1, 1))}>‹</button>
                                    </li>
                                    {Object.entries(pages).map(([key, value]) => {
                                        if (value === null) return null;
                                        return (
                                            <li key={key} className={activePage === value ? 'active' : ''}>
                                                <button onClick={() => handlePageClick(value)}>
                                                    {value}
                                                </button>
                                            </li>
                                        );
                                    })}
                                    <li>
                                        <button onClick={() => handlePageClick(activePage + 1 < Math.ceil(displayLength / basicLength) ? activePage + 1 : Math.ceil(displayLength / basicLength))}>›</button>
                                    </li>
                                    <li>
                                        <button onClick={() => handlePageClick(Math.ceil(displayLength / basicLength))}>»</button>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {estateList.length === 0 ? (
                            <div style={{ height: '80vh' }}>
                                <div className="text-center mt-1 w-100">
                                    <i className="fa-solid fa-arrows-rotate sticky-column pointer spinning me-1"></i>土地情報を取得中...
                                </div>
                            </div>
                        ) : (
                            <div className="w-100" style={{ overflow: 'auto', height: '65vh' }}>
                                <div style={{ minWidth: '1300px', minHeight: '1000px' }}>
                                    <Table bordered striped style={{ display: 'block' }}>
                                        <tbody style={{ fontSize: '11px' }} className='align-middle'>
                                            <tr>
                                                <td colSpan={2} style={{ width: '130px' }}>No</td>
                                                <td style={{ width: '100px' }}>掲載</td>
                                                <td>物件名</td>
                                                <td>物件所在地</td>
                                                <td>沿線・駅</td>
                                                <td>登録日</td>
                                                <td>更新日</td>
                                                <td>土地面積</td>
                                                <td>価格</td>
                                                <td>用途地域</td>
                                                <td>坪単価</td>
                                                <td>建蔽率</td>
                                                <td>容積率</td>
                                                <td>不動産会社</td>
                                            </tr>

                                            {estateList
                                                .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
                                                .slice(sliceStart, sliceStart + basicLength)
                                                .map((item, index) => (
                                                    <tr key={item.property_id ?? `${index}`}>
                                                        <td>{index + 1}</td>
                                                        <td><div className="bg-success text-white rounded px-2 py-1 text-center"
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => setPropertyId(item.property_id)}>詳細</div></td>
                                                        <td>{item.info_source}</td>
                                                        <td>{item.property_name ? item.property_name : '-'}</td>
                                                        <td>{item.address_pref}{item.address_city}{item.address_town}</td>
                                                        <td>{item.railway_line}</td>
                                                        <td>{item.registered_at ? new Date(item.registered_at).toLocaleDateString() : '-'}</td>
                                                        <td>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}</td>
                                                        <td>
                                                            {item.land_area}㎡
                                                            <br />
                                                            ({(Number(Math.round((item.land_area / 3.305785) * 100) / 100)).toLocaleString()}坪)
                                                        </td>
                                                        <td>￥{Number((item.price ?? 0)).toLocaleString()}万</td>
                                                        <td>{item.zoning1}</td>
                                                        <td>￥{(Number(item.unit_price_tsubo).toLocaleString() ?? 0)}</td>
                                                        <td>{item.bcr1 ?? '-'}%</td>
                                                        <td>{item.far1 ?? '-'}%</td>
                                                        <td>{item.listing_company}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}</div>
                </Modal.Body>
            </Modal>
            <EstateInfo propertyId={propertyId} setPropertyId={setPropertyId} />
        </>
    );
};

export default Estate;
