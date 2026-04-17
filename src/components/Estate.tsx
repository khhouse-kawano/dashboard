import React, { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import axios from 'axios';
import { headers } from '../utils/headers';
import { townList } from '../utils/townList';

type Props = { estateId: string };

type EstateList = {
    property_id: number;
    property_name: string;
    address_pref: string;
    address_city: string;
    address_town: string;
    railway_line: string;
    land_area: number;
    price: number;
    zoning1: string;
    unit_price_tsubo: number;
    bcr1: number;
    far1: number;
    listing_company: string;
    info_source: string;
    registered_at: string; // API からは string で来る想定に変更
    updated_at: string;
    best_use: string,
    walk_time1: number
};

const Estate = ({ estateId }: Props) => {
    const [search, setSearch] = useState('');
    const [targetId, setTargetId] = useState('');
    const [targetPref, setTargetPref] = useState<string>('');
    const [listLength, setListLength] = useState<number>(20);
    const [targetTown, setTargetTown] = useState<string>('');
    const [towns, setTowns] = useState<string[]>([]);
    const [showDetail, setShowDetail] = useState(false);
    const [targetBudget, setTargetBudget] = useState<number | null>(null);
    const [targetLand, setTargetLand] = useState<number | null>(null);
    const [forHouse, setForHouse] = useState(false);
    const [walkTime, setWalkTime] = useState<number | null>(null);

    const [originalList, setOriginalList] = useState<EstateList[]>([]);
    const [estateList, setEstateList] = useState<EstateList[]>([]);

    useEffect(() => {
        if (estateId) {
            setTargetId(estateId);
            const fetchEstate = async () => {
                const response = await axios.post(
                    'https://khg-marketing.info/dashboard/api/',
                    { demand: 'get_customer_estate', id: estateId },
                    { headers }
                );
            };
            fetchEstate();
        }

        const fetchData = async () => {
            try {
                const response = await axios.post(
                    'https://khg-marketing.info/dashboard/api/',
                    { demand: 'get_estate_info' },
                    { headers }
                );
                setOriginalList(response.data || []);
            } catch (e) {
                console.error(e);
                alert('土地情報の取得に失敗');
            }
        };

        fetchData();
    }, [estateId]);

    useEffect(() => {
        setTowns(townList[targetPref] ?? []);

        const filtered = originalList.filter(o => {
            const pref = String(o.address_pref ?? '');
            const city = String(o.address_city ?? '');
            const town = String(o.address_town ?? '');

            return (
                (targetPref
                    ? pref.includes(targetPref)
                    : true
                )

                && (targetTown
                    ? (pref.includes(targetTown) || city.includes(targetTown) || town.includes(targetTown))
                    : true
                )

                && (targetLand
                    ? o.land_area >= targetLand
                    : true
                )

                && (targetBudget
                    ? (o.price >= targetBudget - 499 && o.price <= targetBudget)
                    : true
                )

                && (forHouse
                    ? o.best_use === '住宅用地' : true
                )

                && (walkTime
                    ? o.walk_time1 <= walkTime && o.walk_time1 !== 0 : true
                )
            );
        });


        setEstateList(filtered);
    }, [originalList, targetPref, targetTown, targetBudget, targetLand, forHouse, walkTime]);

    const selectStyle = { fontSize: '12px', borderRadius: '4px', border: '1px solid #d3d3d3' };

    return (
        <>
            <div className="d-flex mb-3 align-items-center">
                <div style={{ fontSize: '11px' }} className="me-3">
                    <span className="text-success fw-bold pe-1" style={{ fontSize: '17px' }}>{estateList.length}</span>
                    件HIT{search && `※${search}検索`}
                </div>
                <div className="me-3">
                    <select className="p-1" style={selectStyle} onChange={(e) => setListLength(Number(e.target.value))} value={listLength}>
                        {[20, 50, 100, 200].map(num => <option value={num} key={num}>{num}件表示</option>)}
                    </select>
                </div>
                <div className="me-3">
                    <select className="p-1" style={selectStyle} value={targetPref}
                        onChange={(e) => {
                            setEstateList([]);
                            setTargetPref(e.target.value);
                            setTargetTown('');
                        }}>
                        <option value="">エリア(県)を選択</option>
                        {['鹿児島県', '宮崎県', '大分県', '熊本県', '佐賀県'].map((pref, index) =>
                            <option value={pref} key={index}>{pref}</option>
                        )}
                    </select>
                </div>

                <div className="me-3">
                    <select className="p-1" style={selectStyle} value={targetTown}
                        onChange={(e) => setTargetTown(e.target.value)}>
                        <option value="">エリアを絞り込む</option>
                        {towns.map((town, index) => <option value={town} key={index}>{town}</option>)}
                    </select>
                </div>

                {!showDetail && <div className="me-3">
                    <div className="bg-success text-white py-1 px-2 rounded" style={{ fontSize: '12px', cursor: 'pointer' }}
                        onClick={() => setShowDetail(!showDetail)}>条件を絞り込む</div>
                </div>}

                {targetId && <div className="bg-success text-white py-1 px-2 rounded" style={{ fontSize: '12px', cursor: 'pointer' }}
                    onClick={() => setShowDetail(!showDetail)}>検索条件を保存</div>}

            </div>

            {showDetail &&
                <div className="p-3 rounded mb-3 position-relative" style={{ backgroundColor: '#05811a15' }}>
                    <div className="d-flex align-items-center">
                        <div className="me-3 d-flex align-items-center">
                            <input type="text" style={{ ...selectStyle, height: '27px', width: '280px' }} placeholder='フリーワード検索 駅名、学校区等'
                                onChange={() => { }} />
                            <div className="bg-success text-white py-1 px-2 rounded ms-1" style={{ fontSize: '12px', cursor: 'pointer' }}>条件追加</div>
                        </div>

                        <div className="me-3">
                            <select className="p-1" style={selectStyle}
                                onChange={(e) => setTargetBudget(Number(e.target.value))}>
                                <option value="">希望予算を選択</option>
                                {['500', '1000', '1500', '2000', '2500', '3000', '3500', '4000', '4500', '5000', '5500'].map((budget, index) =>
                                    <option key={index} value={budget}>{index > 0 && Number(budget) - 499}~{budget}万円</option>)}
                            </select>
                        </div>

                        <div className="me-3">
                            <select className="p-1" style={selectStyle}
                                onChange={(e) => setTargetLand(Number(e.target.value))}>
                                <option value="">希望土地面積を選択</option>
                                {['40', '50', '60', '70', '80', '90', '100', '150', '200', '250', '300'].map((land, index) =>
                                    <option key={index} value={land}>{land}㎡以上</option>)}
                            </select>
                        </div>

                        <div className="me-3">
                            <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'>
                                <input type='checkbox' className='me-1'
                                    onChange={() => setForHouse(!forHouse)}
                                    style={{ cursor: 'pointer' }}
                                />住宅用地のみ表示</label>
                        </div>

                        <div className="me-3">
                            <select className="p-1" style={selectStyle}
                                onChange={(e) => setWalkTime(Number(e.target.value))}>
                                <option value="">駅からの徒歩</option>
                                {['1', '3', '5', '7', '10', '15', '20'].map((time, index) =>
                                    <option key={index} value={time}>{time}分以内</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="position-absolute bg-success px-2 py-1 rounded-pill text-white" style={{ top: '-12px', right: '0', fontSize: '12px', cursor: 'pointer' }}
                        onClick={() => setShowDetail(false)}>×</div>
                </div>}

            {estateList.length === 0 ? (
                <div style={{ height: '80vh' }}>
                    <div className="text-center mt-1 w-100">
                        <i className="fa-solid fa-arrows-rotate sticky-column pointer spinning me-1"></i>Loading...
                    </div>
                </div>
            ) : (
                <div className="w-100" style={{ overflowX: 'auto' }}>
                    <div style={{ width: '1300px' }}>
                        <Table bordered striped>
                            <tbody style={{ fontSize: '11px' }}>
                                <tr>
                                    <td>No</td>
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
                                    <td>掲載</td>
                                    <td></td>
                                </tr>

                                {estateList
                                    .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
                                    .slice(0, listLength)
                                    .map((item, index) => (
                                        <tr key={item.property_id ?? `${index}`}>
                                            <td>{index + 1}</td>
                                            <td>{item.property_name ? item.property_name : '-'}</td>
                                            <td>{item.address_pref}{item.address_city}{item.address_town}</td>
                                            <td>{item.railway_line}</td>
                                            <td>{item.registered_at ? new Date(item.registered_at).toLocaleDateString() : '-'}</td>
                                            <td>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}</td>
                                            <td>
                                                {item.land_area}㎡
                                                <br />
                                                ({(Math.round((item.land_area / 3.305785) * 100) / 100).toLocaleString()}坪)
                                            </td>
                                            <td>￥{(item.price ?? 0).toLocaleString()}万</td>
                                            <td>{item.zoning1}</td>
                                            <td>￥{(item.unit_price_tsubo ?? 0).toLocaleString()}</td>
                                            <td>{item.bcr1 ?? '-'}%</td>
                                            <td>{item.far1 ?? '-'}%</td>
                                            <td>{item.listing_company}</td>
                                            <td>{item.info_source}</td>
                                            <td><div className="bg-success text-white rounded px-2 py-1 text-center">詳細</div></td>
                                        </tr>
                                    ))}
                            </tbody>
                        </Table>
                    </div>
                </div>
            )}
        </>
    );
};

export default Estate;
