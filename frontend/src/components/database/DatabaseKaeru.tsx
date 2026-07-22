import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
import Table from "react-bootstrap/Table";
import axios from "axios";
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { headers } from '../../utils/headers';
import CallStatusList from '../CallStatusList';
import InformationEditKaeru from '../information/InformationEditKaeru';
import IntegrateModal from './IntegrateModal';
import { useIsSp } from '../../utils/isSp';
import { PastCustomer } from './PastCustomer';
import { useDebounce } from './useDebounce';

type shopList = { brand: string, shop: string, section: string };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, period: string };
type CustomerList = Record<string, string>;

type Props = {
    onReload: () => void,
    key: number
};

const DatabaseKaeru = ({ }: Props) => {
    const { authority, category } = useContext(AuthContext);
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
    const [searchedPastStaff, setSearchedPastStaff] = useState('');
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [callStatus, setCallStatus] = useState<string>('');
    const [activePage, setActivePage] = useState<number>(1);
    const [sliceStart, setSliceStart] = useState<number>(0);
    const [basicLength, setBasicLength] = useState<number>(20);
    const [trash, setTrash] = useState<number>(1);
    const { token } = useContext(AuthContext);
    const [familyList, setFamilyList] = useState<string[]>([]);
    const [familyStatus, setFamilyStatus] = useState<boolean>(false);
    const skipPageReset = useRef(false);
    const [integrate, setIntegrate] = useState<CustomerList>({});
    const [integrateList, setIntegrateList] = useState<CustomerList[]>([]);
    const [pastCustomer, setPastCustomer] = useState<Record<string, string>[]>([]);
    const [callStatusShow, setCallStatusShow] = useState(false);

    const [pastCustomerShow, setPastCustomerShow] = useState(false);

    //　オリジナルフック
    const nameSearch = useDebounce('', 300);
    const staffSearch = useDebounce('', 300);
    const phoneSearch = useDebounce('', 300);
    const addressSearch = useDebounce('', 300);
    const mailSearch = useDebounce('', 300);

    const isSp = useIsSp();

    const formate = (value: string) => {
        return (value ?? '').replace(/-/g, '/');
    };

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/\//g, '-');
    };

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'database_kaeru' }, { headers });

                const customers = response.data.customer.map((c: any) => ({
                    ...c,
                    search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
                    _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '') // ★あらかじめスペースを消しておく
                }));
                setOriginalDatabase(customers);

                await setShopArray(response.data.shop.filter((item: shopList) => !item.shop.includes('店舗未設定')));
                await setMediumArray(response.data.medium.map(item => item.medium));
                await setDisplayLength(response.data.customer.length);
                await setStaffArray(response.data.staff);

                const familyId = response.data.family.map(f => f.id);
                await setFamilyList(familyId);
                const callList = response.data.call.map(r => ({ id: r.id, log: r.call_log }));
                const interviewList = response.data.interview.map(r => ({ id: r.id, log: r.call_log }));
                setPastCustomer([...callList, ...interviewList]);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    // 1. 事前計算（useMemoで囲む）
    const pastCustomerIds = useMemo(() => {
        return searchedPastStaff
            ? pastCustomer.filter(p => p.log?.includes(searchedPastStaff)).map(p => p.id)
            : [];
    }, [pastCustomer, searchedPastStaff]);

    const strIncludes = (val: any, sub: string) => (sub ? String(val ?? '').includes(sub) : true);
    const arrIncludes = (arr: any, v: any) => (v ? (Array.isArray(arr) ? arr.includes(v) : String(arr ?? '').includes(v)) : true);

    const filteredDatabase = useMemo(() => {
        const result = originalDatabase.filter(item => {
            const cleanFormattedName = nameSearch.debouncedValue.replace(/[\s\u3000]+/g, '');

            return (trash === 1 ? (Number(item.trash) ?? 0) !== 0 : true)
                && (trash === 0 ? (Number(item.trash) ?? 0) !== 1 : true)
                && (selectedShop ? arrIncludes(item.shop, selectedShop) : true)
                && (selectedRegister ? strIncludes(item.register, dateFormate(selectedRegister)) : true)
                && (selectedReserve === 'notVisited'
                    ? ((item.reserved_interview ?? '') !== '' && (item.interview ?? '') === '')
                    : (selectedReserve ? strIncludes(item.interview, dateFormate(selectedReserve)) : true))
                && (selectedRank ? arrIncludes(item.rank, selectedRank) : true)
                && (selectedMedium === 'SUUMO(ポータル反響)' ? (item.medium === 'SUUMO' && !item.hp_campaign) : selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
                && (nameSearch.debouncedValue ? strIncludes(item._cleanCustomer, cleanFormattedName) : true)
                && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
                && (phoneSearch.debouncedValue ? strIncludes(item.phone_number, phoneSearch.debouncedValue) : true)
                && (mailSearch.debouncedValue ? strIncludes(item.mail, mailSearch.debouncedValue) : true)
                && (addressSearch.debouncedValue ? String((item.full_address ?? '').replace(/[\s　]+/g, "")).includes(addressSearch.debouncedValue) : true)
                && (callStatus ? (item.call_status ?? '') === callStatus : true)
                && (familyStatus ? familyList.includes(item.id) : true)
                && (searchedPastStaff ? pastCustomerIds.includes(item.id) : true)
                && (searchedPastStaff ? pastCustomerIds.includes(item.id) : true);
        });

        return result.sort((a, b) => {
            const dateA = a.register || "";
            const dateB = b.register || "";
            return dateB.localeCompare(dateA);
        });
    }, [
        originalDatabase,
        selectedShop,
        selectedRegister,
        selectedReserve,
        selectedRank,
        selectedMedium,
        selectedStatus,
        nameSearch.debouncedValue,
        staffSearch.debouncedValue,
        phoneSearch.debouncedValue,
        addressSearch.debouncedValue,
        mailSearch.debouncedValue,
        callStatus,
        searchedPastStaff,
        trash,
        familyList,
        familyStatus,
        pastCustomerIds // 追加
    ]);

    const duplicateDictionary = useMemo(() => {
        const dict: Record<string, string[]> = {};

        originalDatabase.forEach(item => {
            if (item.mail) {
                if (!dict[item.mail]) dict[item.mail] = [];
                dict[item.mail].push(item.id);
            }
            if (item.phone_number) {
                if (!dict[item.phone_number]) dict[item.phone_number] = [];
                dict[item.phone_number].push(item.id);
            }
        });

        return dict;
    }, [originalDatabase]);

    useEffect(() => {
        if (skipPageReset.current) {
            skipPageReset.current = false;
            return;
        }
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
        nameSearch.debouncedValue,
        staffSearch.debouncedValue,
        phoneSearch.debouncedValue,
        addressSearch.debouncedValue,
        mailSearch.debouncedValue,
        callStatus,
        searchedPastStaff,
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
    });

    const handlePageClick = async (page: number) => {
        setActivePage(page);
        setSliceStart((page - 1) * basicLength);
    };

    const [editId, setEditId] = useState('');

    const handleGarbage = async (id: string, name: string) => {
        if (!id) return;
        const result = window.confirm(`${name}様を${trash === 1 ? '削除しますか？' : '元に戻しますか？'}`);
        if (result) {
            const fetchData = async () => {
                try {
                    const postData = {
                        request: 'database_kaeru_trash',
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

    const closeInformationEdit = async () => {
        setEditId('');
        const prevPage = activePage;

        skipPageReset.current = true;

        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'database_kaeru' }, { headers });
            setOriginalDatabase(response.data.customer);
        }

        await fetchData();
        setActivePage(prevPage);
    };

    const integrationCustomer = (customer: Record<string, string>) => {
        setIntegrate(customer);
        const filteredDuplicate = originalDatabase.filter(o =>
            o.id !== customer.id
            && ((o.mail !== '' && o.mail === customer.mail) || (o.phone_number !== '' && o.phone_number === customer.phone_number))
        );
        setIntegrateList(filteredDuplicate);
    };

    const handleIntegrate = () => {
        const filteredList = [integrate, ...integrateList];

        const baseCustomer = filteredList.find(f => f.integration === '1');
        const integrateTargets = filteredList.filter(f => f.show_dashboard === '0');

        if (!baseCustomer) {
            alert('名寄せ先（統合先）が選択されていません。');
            return;
        }

        if (integrateTargets.length === 0) {
            alert('統合されるデータが一つも選択されていません。');
            return;
        }

        const postData = {
            base: baseCustomer,
            integrateList: integrateTargets.map(i => i.id).join(','),
            request: 'integrate',
            category
        };

        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", postData, { headers });
                setOriginalDatabase(response.data.customer);
            } catch (error) {
                console.error("名寄せ処理中にエラーが発生しました", error);
                alert("通信エラーが発生しました。");
            }
        };

        fetchData();

        setIntegrate({});
        setIntegrateList([]);
    };

    return (
        <>
            <div className='content database bg-white p-2'>
                <div className='p-1 p-md-3 d-flex flex-wrap'>
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
                    {!isSp && <>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedReserve(e.target.value)}>
                                <option value="">初回来場月を選択</option>
                                <option value="notVisited">未来場・来場キャンセル</option>
                                {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div></>}
                    <div className="m-1">
                        <select className="target" onChange={(e) => setSelectedRank(e.target.value)}>
                            <option value="">ランクを選択</option>
                            <option value="Sランク">Sランク</option>
                            <option value="Aランク">Aランク</option>
                            <option value="Bランク">Bランク</option>
                            <option value="Cランク">Cランク</option>
                            <option value="Dランク">Dランク</option>
                            <option value="Eランク">Eランク</option>
                            <option value="Fランク">Fランク</option>
                        </select>
                    </div>
                    {!isSp && <>
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
                                <option value="追客中">追客中</option>
                                <option value="接触（通話・返信）">接触（通話・返信）</option>
                                <option value="アポイント確定">アポイント確定</option>
                                <option value="来店あり">来店あり</option>
                                <option value="申込み済み">申込み済み</option>
                                <option value="事前取得（現金確認含む）">事前取得（現金確認含む）</option>
                                <option value="契約済み">契約済み</option>
                                <option value="追客終了">追客終了</option>
                                <option value="解約">解約</option>
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
                        </div></>}
                    <div className="m-1">
                        <input className="target" placeholder='顧客名で検索(&電話番号+住所)'
                            value={nameSearch.inputValue} onChange={nameSearch.onChange} />
                    </div>
                    <div className="m-1">
                        <input className="target" placeholder='営業名で検索'
                            value={staffSearch.inputValue} onChange={staffSearch.onChange} />
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <input className="target" placeholder='過去に担当した営業名で検索' onChange={(e) => setSearchedPastStaff(e.target.value)} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='電話番号で検索'
                                value={phoneSearch.inputValue} onChange={phoneSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='メールアドレスで検索'
                                value={mailSearch.inputValue} onChange={mailSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='住所で検索'
                                value={addressSearch.inputValue} onChange={addressSearch.onChange} />                        </div>
                    </>}
                    <div className="bg-success text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
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
                    <div className="d-flex flex-wrap align-items-center mb-1">
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
                        {!isSp && <>
                            {trash === 1 && <div className="bg-primary text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setTrash(0)}>非表示リストへ移動</div>}
                            {trash === 0 && <div className="bg-primary text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setTrash(1)}>一覧へ戻る</div>}
                            <div className="bg-danger text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setCallStatusShow(true)}>架電状況集計</div>
                        </>}
                    </div>
                </div>
                <div className="w-100" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ width: '1700px' }}>
                        <Table style={{ fontSize: isSp ? '9px' : '11px', textAlign: 'center' }} bordered striped>
                            <tbody className='align-middle'>
                                <tr className='align-middle sticky-header'>
                                    <td>顧客情報編集</td>
                                    <td>店舗</td>
                                    <td>顧客名<br /><span className='text-success fw-bold'><i className="fa-solid fa-user-plus pe-1"></i>重複顧客</span></td>
                                    <td>担当営業</td>
                                    <td>ステータス</td>
                                    <td>反響日</td>
                                    <td>面談<br />(物件案内)</td>
                                    <td>次回アクション</td>
                                    <td>ランク</td>
                                    <td>反響経路</td>
                                    <td>販促媒体</td>
                                    <td>住所</td>
                                    <td>連絡先</td>
                                    <td>架電状況</td>
                                    <td>架電件数</td>
                                    <td>{trash === 1 ? '非表示' : '元に戻す'}</td>
                                </tr>
                                {filteredDatabase
                                    .slice(sliceStart, sliceStart + basicLength)
                                    .map(item => {
                                        const duplicateMailIds = item.mail ? duplicateDictionary[item.mail] || [] : [];
                                        const duplicatePhoneIds = item.phone_number ? duplicateDictionary[item.phone_number] || [] : [];
                                        const isDuplicate =
                                            duplicateMailIds.some(id => id !== item.id) ||
                                            duplicatePhoneIds.some(id => id !== item.id);
                                        return <tr key={item.id}>
                                            <td><div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }}
                                                onClick={() => {
                                                    setEditId(item.id);
                                                }}>編集</div></td>
                                            <td>{item.shop}</td>
                                            <td>{isDuplicate && <span style={{ cursor: 'pointer' }}
                                                onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}{item.customer ?? ''}</td>
                                            <td>{item.staff ?? ''}</td>
                                            <td>{item.status ?? ''}</td>
                                            <td>{formate(item.register)}</td>
                                            <td>{formate(item.interview)}
                                                <br />{item.tour && `(${formate(item.tour)})`}
                                            </td>
                                            <td>{item.interview && formate(item.interview)}{item.cancel_status && <span className='text-danger fw-bold'
                                                style={{ fontSize: '8px' }}>キャンセル({item.cancel_status})</span>}<br /><span style={{ fontSize: '10px', fontWeight: '700' }}>{item.reserved_interview ? <>({formate(item.reserved_interview)})</> : ''}</span></td>
                                            <td>{(item.rank ?? '').replace('ランク', '')}</td>
                                            <td>{item.hp_campaign}</td>
                                            <td>{item.medium}</td>
                                            <td style={{ textAlign: 'left' }}>{item.full_address}</td>
                                            <td style={{ textAlign: 'left' }}>{item.mail}<br />{item.phone_number}</td>
                                            <td>{item.call_status}</td>
                                            <td>{item.call_log || '0'}</td>
                                            <td style={{ cursor: 'pointer' }} onClick={() => handleGarbage(item.id, item.customer)}>{trash === 1 ? <i className="fa-solid fa-ban"></i> : <i className="fa-solid fa-rotate-left"></i>}</td>
                                        </tr>
                                    })}
                            </tbody>
                        </Table>
                    </div>

                </div>
            </div>
            <PastCustomer pastCustomerShow={pastCustomerShow} setPastCustomerShow={setPastCustomerShow} />
            <IntegrateModal integrate={integrate} setIntegrate={setIntegrate} integrateList={integrateList} setIntegrateList={setIntegrateList} handleIntegrate={handleIntegrate} />
            <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <CallStatusList
                callStatusShow={callStatusShow}
                setCallStatusShow={setCallStatusShow}
            />
        </>
    )
}

export default DatabaseKaeru
