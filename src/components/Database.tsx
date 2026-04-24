import React, { useEffect, useState, useContext, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import axios from "axios";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { headers } from '../utils/headers';
import SurveyList from './Survey';
import CancelList from './CancelList';
import CallStatusList from './CallStatusList';
import InformationEdit from './InformationEdit';
import Estate from './Estate';

type shopList = { brand: string, shop: string, section: string };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number };
type CustomerList = { id: string; shop: string; customer: string; staff: string; status: string; rank: string; medium: string; interview: string; register: string; call_status: string, reserved_interview: string, full_address: string; phone_number: string; trash: number, cancel_status: string, rank_period: string };
type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number }
type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string
};
type CallLog = {
    id: string;
    shop: string;
    staff: string;
    name: string;
    status: string;
    reserved_interview: string;
    call_log: CallAction[];
    add: Boolean;
};

const Database = () => {
    const { brand } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<shopList[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [staffArray, setStaffArray] = useState<staffList[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalDatabase, setOriginalDatabase] = useState<CustomerList[]>([]);
    const [selectedShop, setSelectedShop] = useState<string>('')
    const [selectedRegister, setSelectedRegister] = useState<string>('')
    const [selectedReserve, setSelectedReserve] = useState<string>('')
    const [selectedRank, setSelectedRank] = useState<string>('')
    const [selectedMedium, setSelectedMedium] = useState<string>('')
    const [selectedStatus, setSelectedStatus] = useState<string>('')
    const [searchedName, setSearchedName] = useState<string>('')
    const [searchedStaff, setSearchedStaff] = useState<string>('');
    const [searchedPhone, setSearchedPhone] = useState<string>('')
    const [searchedAddress, setSearchedAddress] = useState<string>('')
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [callStatus, setCallStatus] = useState<string>('');
    const [activePage, setActivePage] = useState<number>(1);
    const [sliceStart, setSliceStart] = useState<number>(0);
    const [basicLength, setBasicLength] = useState<number>(20);
    const [trash, setTrash] = useState<number>(1);
    const { token } = useContext(AuthContext);
    const [open, setOpen] = useState(false);
    const [familyList, setFamilyList] = useState<string[]>([]);
    const [familyStatus, setFamilyStatus] = useState<boolean>(false);
    const [firstCallDate, setFirstCallDate] = useState<CallLog[]>([]);
    const [callStatusShow, setCallStatusShow] = useState(false);
    const [surveyShow, setSurveyShow] = useState(false);
    const [cancelListShow, setCancelListShow] = useState(false);

    const formate = (value: string) => {
        return (value ?? '').replace(/-/g, '/');
    };

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/\//g, '-');
    }

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'database' }, { headers });
                await setOriginalDatabase(response.data.customer);
                await setShopArray(response.data.shop.filter((item: shopList) => !item.shop.includes('店舗未設定')));
                await setMediumArray(response.data.medium.filter(item => item.list_medium === 1).map((item: MediumType) => item.medium));
                await setDisplayLength(response.data.customer.length);
                await setStaffArray(response.data.staff);
                const familyId = response.data.family.map(f => f.id);
                await setFamilyList(familyId);
                const filteredCallResponse = response.data.call.map(item => ({
                    ...item,
                    call_log: item.call_log ? JSON.parse(item.call_log) : []
                }))
                await setFirstCallDate(filteredCallResponse);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    const filteredDatabase = useMemo(() => {
        return originalDatabase.filter(item => {
            const sName = searchedName ?? '';

            const formattedName = sName.includes('&')
                ? sName.split('&')[0]
                : sName.includes('+')
                    ? sName.split('+')[0]
                    : sName;

            const formattedNumber = sName.includes('&')
                ? sName.split('&')[1]
                : searchedPhone ?? '';

            const formattedAddress = sName.includes('+')
                ? sName.split('+')[1]
                : '';

            // 安全に includes を呼ぶためのヘルパー
            const strIncludes = (val: any, sub: string) => (sub ? String(val ?? '').includes(sub) : true);
            const arrIncludes = (arr: any, v: any) => (v ? (Array.isArray(arr) ? arr.includes(v) : String(arr ?? '').includes(v)) : true);

            // ここで各プロパティが undefined のときでも安全に評価される
            return (trash === 1 ? (item.trash ?? 0) !== 0 : true)
                && (trash === 0 ? (item.trash ?? 0) !== 1 : true)
                && (selectedShop ? arrIncludes(item.shop, selectedShop) : true)
                && (selectedRegister ? strIncludes(item.register, dateFormate(selectedRegister)) : true)
                && (selectedReserve === 'notVisited'
                    ? ((item.reserved_interview ?? '') !== '' && (item.interview ?? '') === '')
                    : (selectedReserve ? strIncludes(item.interview, dateFormate(selectedReserve)) : true))
                && (selectedRank ? arrIncludes(item.rank, selectedRank) : true)
                && (selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
                && (searchedName ? strIncludes(item.customer, formattedName) : true)
                && (searchedStaff ? strIncludes(item.staff, searchedStaff.split(' ')[0]) : true)
                && ((searchedPhone || searchedName) ? strIncludes(item.phone_number, formattedNumber) : true)
                && (formattedAddress ? strIncludes(item.full_address, formattedAddress) : true)
                && (searchedAddress ? String((item.full_address ?? '').replace(/[\s　]+/g, "")).includes(searchedAddress) : true)
                && (callStatus ? (item.call_status ?? '') === callStatus : true)
                && (familyStatus ? familyList.includes(item.id) : true);
        });
    }, [
        originalDatabase,
        selectedShop,
        selectedRegister,
        selectedReserve,
        selectedRank,
        selectedMedium,
        selectedStatus,
        searchedName,
        searchedStaff,
        searchedAddress,
        callStatus,
        searchedPhone,
        trash,
        familyList,
        familyStatus,
    ]);


    useEffect(() => {
        setActivePage(1);
        setSliceStart(0);
    }, [
        originalDatabase,
        selectedShop,
        selectedRegister,
        selectedReserve,
        selectedRank,
        selectedMedium,
        selectedStatus,
        searchedName,
        searchedStaff,
        searchedAddress,
        callStatus,
        searchedPhone,
        trash,
        familyList,
        familyStatus,
    ]);

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

    const [editId, setEditId] = useState('')

    const handleGarbage = async (id: string, name: string) => {
        if (!id) return;
        const result = window.confirm(`${name}様を${trash === 1 ? '削除しますか？' : '元に戻しますか？'}`);
        if (result) {
            const fetchData = async () => {
                try {
                    const postData = {
                        request: 'database_trash',
                        show_dashboard: trash === 1 ? 0 : 1,
                        id: id
                    };
                    const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", postData, { headers });
                    await setOriginalDatabase(response.data.customer);
                } catch (error) {
                    console.error("Error fetching data:", error);
                }
            };
            await fetchData();
        } else {
            return;
        }
    };

    const [insideSalesCategory, setInsideSalesCategory] = useState('kumamoto');

    const closeInformationEdit = async () => {
        setEditId('');
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'database_reload' }, { headers });
            await setOriginalDatabase(response.data.customer);
        }
        fetchData();
    };

    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}>
                    <MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i className="fa-solid fa-bars hamburger"
                        onClick={() => setOpen(true)} />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i className="fa-solid fa-xmark hamburger position-absolute"
                        onClick={() => setOpen(false)} />
                    <MenuDev brand={brand} />
                </div>
                <div className='content database bg-white p-2'>
                    <div className='p-3 d-flex flex-wrap'>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedShop(e.target.value)}>
                                <option value="">店舗を選択</option>
                                {shopArray.map((item, index) => <option key={index} value={item.shop}>{item.shop}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedRegister(e.target.value)}>
                                <option value="">反響月を選択</option>
                                {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedReserve(e.target.value)}>
                                <option value="">初回来場月を選択</option>
                                <option value="notVisited">未来場・来場キャンセル</option>
                                {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedRank(e.target.value)}>
                                <option value="">ランクを選択</option>
                                <option value="Aランク">Aランク</option>
                                <option value="Bランク">Bランク</option>
                                <option value="Cランク">Cランク</option>
                                <option value="Dランク">Dランク</option>
                                <option value="Eランク">Eランク</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedMedium(e.target.value)}>
                                <option value="">販促媒体を選択</option>
                                {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedStatus(e.target.value)}>
                                <option value="">ステータスを選択</option>
                                <option value="見込み">見込み</option>
                                <option value="契約済み">契約済み</option>
                                <option value="失注">失注</option>
                                <option value="会社管理">会社管理</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => {
                                setCallStatus(e.target.value);
                            }}>
                                <option value="">架電状況</option>
                                <option value="未通電">未通電</option>
                                <option value="継続">継続</option>
                                <option value="来場アポ">来場アポ</option>
                                <option value="来場済み">来場済み</option>
                                <option value="架電停止">架電停止</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => {
                                if (e.target.value) {
                                    setFamilyStatus(true);
                                } else {
                                    setFamilyStatus(false);
                                }
                            }}>
                                <option value="">家族情報</option>
                                <option value="入力済み">入力済み</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='顧客名で検索(&電話番号+住所)' onChange={(e) => setSearchedName(e.target.value)} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='営業名で検索' onChange={(e) => setSearchedStaff(e.target.value)} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='電話番号で検索' onChange={(e) => setSearchedPhone(e.target.value)} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='住所で検索' onChange={(e) => setSearchedAddress(e.target.value)} />
                        </div>
                        <div className="bg-primary text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                            onClick={() => setEditId('new')}>新規登録</div>
                    </div>
                    <div className="d-md-flex">
                        <div className="d-flex flex-wrap align-items-center">
                            <div className="">{filteredDatabase.length}<span style={{ fontSize: '12px' }}> 件中 {sliceStart + 1}件~{filteredDatabase.length > activePage * basicLength ? activePage * basicLength : filteredDatabase.length}件</span></div>
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
                            {trash === 1 && <div className="bg-primary text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setTrash(0)}>ゴミ箱へ移動</div>}
                            {trash === 0 && <div className="bg-primary text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setTrash(1)}>一覧へ戻る</div>}
                            <div className="bg-danger text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setCallStatusShow(true)}>架電状況集計</div>
                            <div className="bg-danger text-white ms-1 rounded position-relative" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setCancelListShow(true)}>キャンセル集計
                                <div className="position-absolute bg-danger text-white d-flex align-items-center justify-content-center"
                                    style={{ top: '-28px', width: '90px', height: '20px', borderRadius: '10px', left: 'calc( 50% - 45px)', letterSpacing: '1px' }}>要対応{originalDatabase.filter(item => {
                                        const now = new Date();
                                        const today = now.getTime();
                                        const target = new Date(dateFormate(item.reserved_interview)).getTime();
                                        const start = new Date('2026-01-01');
                                        const base = start.getTime();

                                        return target < today && base < target && (!item.interview && !item.cancel_status) && trash === 1
                                    }).length}件</div>
                                <div className="position-absolute triangle"></div>
                            </div>
                            <div className="bg-danger text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setSurveyShow(true)}>アンケート集計</div>
                        </div>
                    </div>
                    <div className='table-wrapper'>
                        <Table responsive style={{ fontSize: '11px', textAlign: 'center' }} bordered striped className='list_table database_list'>
                            <thead>
                                <tr className='align-middle'>
                                    <td>顧客情報編集</td>
                                    <td>店舗</td>
                                    <td>顧客名</td>
                                    <td>担当営業</td>
                                    <td>ステータス</td>
                                    <td>反響日</td>
                                    <td>初回通電日</td>
                                    <td>初回来場日<br /><span style={{ fontSize: '9px' }}>(来場予約日)</span></td>
                                    <td>ランク</td>
                                    <td>販促媒体</td>
                                    <td>住所</td>
                                    <td>架電状況</td>
                                    <td>架電件数</td>
                                    <td>{trash === 1 ? 'ゴミ箱' : '元に戻す'}</td>
                                </tr>
                            </thead>
                            <tbody className='align-middle'>
                                {filteredDatabase
                                    .sort((a, b) => {
                                        const tA = a.register ? Date.parse(a.register) : Number.NEGATIVE_INFINITY;
                                        const tB = b.register ? Date.parse(b.register) : Number.NEGATIVE_INFINITY;
                                        const timeA = Number.isNaN(tA) ? Number.NEGATIVE_INFINITY : tA;
                                        const timeB = Number.isNaN(tB) ? Number.NEGATIVE_INFINITY : tB;
                                        return timeB - timeA;
                                    })
                                    .slice(sliceStart, sliceStart + basicLength).map((item, index) => {
                                        const callLog = firstCallDate.find(f => f.id === item.id)?.call_log;
                                        const firstDate = callLog ?
                                            callLog.filter(c => c.action === '架電').sort((a, b) => {
                                                const dateA = new Date(a.day);
                                                const dateB = new Date(b.day);
                                                return dateA.getTime() - dateB.getTime()
                                            })[0]?.day ?? ''
                                            : '';
                                        const callLength = callLog ? callLog.filter(c => c.action === '架電').length : 0;
                                        return <tr key={index}>
                                            <td><div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }}
                                                onClick={() => {
                                                    setEditId(item.id);
                                                }}>編集</div></td>
                                            <td>{item.shop}</td>
                                            <td>
                                                <div className='position-relative'>{item.customer ?? ''}</div>
                                            </td>
                                            <td>{item.staff ?? ''}</td>
                                            <td>{item.status ?? ''}</td>
                                            <td>{formate(item.register)}</td>
                                            <td>{formate(firstDate)}</td>
                                            <td>{formate(item.interview)}<br /><span style={{ fontSize: '10px', fontWeight: '700' }}>{item.reserved_interview ? <>({formate(item.reserved_interview)})</> : ''}</span></td>
                                            <td>{(item.rank ?? '').replace('ランク', '')}</td>
                                            <td>{item.medium}</td>
                                            <td style={{ textAlign: 'left' }}>{item.full_address}</td>
                                            <td>{item.call_status}</td>
                                            <td>{callLength}</td>
                                            <td style={{ cursor: 'pointer' }} onClick={() => handleGarbage(item.id, item.customer)}>{trash === 1 ? <i className="fa-solid fa-trash"></i> : <i className="fa-solid fa-trash-can-arrow-up"></i>}</td>
                                        </tr>
                                    })}
                            </tbody>
                        </Table>
                    </div>
                </div>
                <InformationEdit id={editId} token={token} onClose={closeInformationEdit} brand={brand} />
                <CallStatusList
                    callStatusShow={callStatusShow}
                    setCallStatusShow={setCallStatusShow}
                    shopArray={shopArray}
                    monthArray={monthArray}
                    staffArray={staffArray}
                    originalDatabase={originalDatabase}
                    insideSalesCategory={insideSalesCategory}
                    setInsideSalesCategory={setInsideSalesCategory} />
                <SurveyList
                    surveyShow={surveyShow}
                    setSurveyShow={setSurveyShow}
                />
                <CancelList
                    cancelListShow={cancelListShow}
                    setCancelListShow={setCancelListShow}
                />
            </div>
        </div >
    )
}

export default Database
