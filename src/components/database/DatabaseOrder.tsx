import React, { useEffect, useState, useContext, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Table from "react-bootstrap/Table";
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import SurveyList from '../Survey';
import CancelList from '../CancelList';
import CallStatusList from '../CallStatusList';
import LostStatusList from '../LostStatusList';
import InformationEdit from '../information/InformationEdit';
import { useIsSp } from '../../utils/isSp';
import { useDebounce } from './useDebounce';
import apiClient from '../../utils/apiClient';
import { safeParse, hotleadStyle } from './databaseUtils';
import { GiftDot, GiftLegend } from './GiftMark';

// --- 型定義 ---
type ShopList = { brand: string; shop: string; section: string };
type MediumType = { id: number; medium: string; category: string; sort_key: number; response_medium: number; list_medium: number };

// 必要なプロパティを明示することで、mapやsort時の型エラーをなくす

interface CustomerItem extends Record<string, any> {
    id: string;
    trash: number | string;
    shop: string;
    register: string;
    interview?: string;
    reserved_interview?: string;
    rank?: string;
    medium?: string;
    status?: string;
    customer?: string;
    staff?: string;
    phone_number?: string;
    full_address?: string;
    search_address?: string;
    _cleanCustomer?: string;
    introduction_person_category?: string;
    k_snap?: boolean | number;
    call_status?: string;
    call_log?: string | number;
    cancel_status?: string;
    hotlead_id?: string;
    /** ギフト進呈可否。1 = 可 / 0 = 不可。判定条件は backend/src/core/gift.php */
    gift?: number;
}

type Props = {
    onReload: () => void;
    key?: number; // Reactの予約語に近いので、警告が出る場合は別名推奨
};

// --- ヘルパー関数 ---
const safeFormate = (value?: string) => (value ?? '').replace(/-/g, '/');
const dateFormate = (value?: string) => (value ?? '').replace(/\//g, '-');
const strIncludes = (val: any, sub: string) => sub ? String(val ?? '').includes(sub) : true;
const arrIncludes = (arr: any, v: any) => v ? (Array.isArray(arr) ? arr.includes(v) : String(arr ?? '').includes(v)) : true;


const DatabaseOrder = ({ onReload }: Props) => {
    const { authority, category, token } = useContext(AuthContext);

    // データリスト関連
    const [originalDatabase, setOriginalDatabase] = useState<CustomerItem[]>([]);
    const [shopArray, setShopArray] = useState<ShopList[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [familyList, setFamilyList] = useState<Record<string, any>[]>([]);
    const [introductoryList, setIntroductoryList] = useState<string[]>([]);
    const [eventList, setEventList] = useState<Record<string, any>[]>([]);
    const [hotleadList, setHotledList] = useState<Record<string, any>[]>([]);

    // 検索・フィルター条件
    const [selectedShop, setSelectedShop] = useState<string>('');
    const [selectedRegister, setSelectedRegister] = useState<string>('');
    const [selectedReserve, setSelectedReserve] = useState<string>('');
    const [selectedRank, setSelectedRank] = useState<string>('');
    const [selectedMedium, setSelectedMedium] = useState<string>('');
    const [selectedIntroductory, setSelectedIntroductory] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [searchedEvent, setSearchedEvent] = useState<string>('');
    const [callStatus, setCallStatus] = useState<string>('');
    const [trash, setTrash] = useState<number>(1);
    const [familyStatus, setFamilyStatus] = useState<boolean>(false);
    const [snapStatus, setSnapStatus] = useState(false);
    const [hotleadStatus, sethotleadStatus] = useState('');

    // 表示・ページネーション
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [activePage, setActivePage] = useState<number>(1);
    const [sliceStart, setSliceStart] = useState<number>(0);
    const [basicLength, setBasicLength] = useState<number>(20);

    // モーダル・集計表示制御
    const [callStatusShow, setCallStatusShow] = useState(false);
    const [surveyShow, setSurveyShow] = useState(false);
    const [cancelListShow, setCancelListShow] = useState(false);
    const [loseListShow, setLoseListShow] = useState(false);
    const [cancelLength, setCancelLength] = useState<number>(0);
    const [loseLength, setLoseLength] = useState<number>(0);
    const [editId, setEditId] = useState('');

    // カスタムフック・URLパラメータ
    const nameSearch = useDebounce('', 300);
    const staffSearch = useDebounce('', 300);
    const phoneSearch = useDebounce('', 300);
    const addressSearch = useDebounce('', 300);
    const familySearch = useDebounce('', 300);
    const isSp = useIsSp();
    const [searchParams, setSearchParams] = useSearchParams();
    const skipPageReset = useRef(false);

    // URL IDの監視
    useEffect(() => {
        const id = searchParams.get('id');
        if (id) setEditId(id);
    }, [searchParams]);

    useEffect(() => {
        if (!editId) return;
        const newParams = new URLSearchParams(searchParams);
        newParams.set('id', editId);
        setSearchParams(newParams);
    }, [editId, searchParams, setSearchParams]);

    // データ取得処理（マウント時および更新時に再利用）
    const fetchDatabase = useCallback(async (isInitial = false) => {
        try {
            const response = await apiClient.post("", { request: 'database', category });

            const customers: CustomerItem[] = response.data.customer.map((c: any) => ({
                ...c,
                search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
                _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '')
            }));

            setOriginalDatabase(customers);

            if (isInitial) {
                setShopArray(response.data.shop.filter((item: ShopList) => !item.shop.includes('店舗未設定')));
                setMediumArray(response.data.medium.filter((item: MediumType) => item.list_medium === 1).map((item: MediumType) => item.medium));
                setDisplayLength(customers.length);
                setFamilyList(response.data.family);
                setIntroductoryList(response.data.introductory.map((i: any) => i.name));
                setEventList(response.data.event);
                setHotledList(response.data.hotlead);

                // キャンセル・失注集計
                const nowTime = new Date().getTime();
                const cancelBase = new Date('2026-01-01').getTime();
                const loseBase = new Date('2026-06-01').getTime();
                let cCount = 0;
                let lCount = 0;

                customers.forEach((item) => {
                    if (Number(item.trash) !== 1) return;

                    const cTarget = new Date(dateFormate(item.reserved_interview)).getTime();
                    if (cTarget < nowTime && cancelBase < cTarget && !item.interview && !item.cancel_status && item.status !== '重複') {
                        cCount++;
                    }

                    const lTarget = new Date(dateFormate(item.register)).getTime();
                    if (lTarget < nowTime && loseBase < lTarget && item.status === '失注') {
                        const isReasonMissing = !item.competitor_lost_contract_reason || item.competitor_lost_contract_reason === 'null';
                        const isCompetitorMissing = item.competitor_lost_contract_reason === '競合負け' && (!item.competitor_name || item.competitor_name === 'null');
                        const isDetailMissing = item.competitor_lost_contract_reason === '競合負け' &&
                            (!item.customized_input_01JRF9CZSW65A151WR30NA4PB3 || item.customized_input_01JRF9CZSW65A151WR30NA4PB3 === 'null' ||
                                !item.customized_input_01JSE7H4MQES619NBWX6PQDFRH || item.customized_input_01JSE7H4MQES619NBWX6PQDFRH === 'null' || String(item.customized_input_01JSE7H4MQES619NBWX6PQDFRH).trim() === '');

                        if (isReasonMissing || isCompetitorMissing || isDetailMissing) lCount++;
                    }
                });
                setCancelLength(cCount);
                setLoseLength(lCount);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }, [category]);

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        fetchDatabase(true);
    }, [fetchDatabase]);

    // フィルタリング・ソート処理
    const filteredDatabase = useMemo(() => {
        const sName = nameSearch.debouncedValue ?? '';
        const formattedName = sName.includes('&') ? sName.split('&')[0] : sName.includes('+') ? sName.split('+')[0] : sName;
        const formattedNumber = sName.includes('&') ? sName.split('&')[1] : phoneSearch.debouncedValue ?? '';
        const formattedAddress = sName.includes('+') ? sName.split('+')[1] : '';
        const cleanFormattedName = formattedName.replace(/[\s\u3000]+/g, '');

        const familyIds = familyList.map(f => f.id);
        const filteredFamilyID = familyList.flatMap(f => {
            const parsedList = safeParse(f.family_info) || [];
            return parsedList.map(info => ({ name: info.name, id: f.id }));
        }).filter(f => f.name.includes(familySearch.debouncedValue)).map(f => f.id);

        const hotleadIds = hotleadList.filter(h => hotleadStatus ? h.status === hotleadStatus : true).map(h => h.id);

        // 型安全なmapとsort
        const result = originalDatabase.filter(item => {
            return (trash === 1 ? Number(item.trash ?? 0) !== 0 : true)
                && (trash === 0 ? Number(item.trash ?? 0) !== 1 : true)
                && (selectedShop ? arrIncludes(item.shop, selectedShop) : true)
                && (selectedRegister ? strIncludes(item.register, dateFormate(selectedRegister)) : true)
                && (selectedReserve === 'notVisited'
                    ? ((item.reserved_interview ?? '') !== '' && (item.interview ?? '') === '')
                    : (selectedReserve ? strIncludes(item.interview, dateFormate(selectedReserve)) : true))
                && (selectedRank ? arrIncludes(item.rank, selectedRank) : true)
                && (selectedMedium === 'SUUMO(ポータル反響)' ? (item.medium === 'SUUMO' && !item.reserved_interview) : selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                && (selectedIntroductory ? arrIncludes(item.introduction_person_category, selectedIntroductory) : true)
                && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
                && (nameSearch.debouncedValue ? strIncludes(item._cleanCustomer, cleanFormattedName) : true)
                && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
                && ((phoneSearch.debouncedValue || nameSearch.debouncedValue) ? strIncludes(item.phone_number, formattedNumber) : true)
                && (formattedAddress ? strIncludes(item.full_address, formattedAddress) : true)
                && (addressSearch.debouncedValue ? strIncludes(item.search_address, addressSearch.debouncedValue) : true)
                && (familySearch.debouncedValue ? filteredFamilyID.includes(item.id) : true)
                && (callStatus ? (item.call_status ?? '') === callStatus : true)
                && (familyStatus ? familyIds.includes(item.id) : true)
                && (searchedEvent ? (item.event === searchedEvent && item.medium === 'イベント') : true)
                && (snapStatus ? item.k_snap : true)
                && (hotleadStatus ? hotleadIds.includes(item.hotlead_id) : true);
        }).map(r => {
            const targetStatus = hotleadList.find(h => h.id === r.hotlead_id) ?? {};
            const targetAction = targetStatus?.action_history ?
                (<div className='d-flex align-items-center text-secondary'>
                    <i className="fa-solid fa-phone me-1"></i>{targetStatus?.action_history.split('架電').length - 1}
                    <i className="fa-solid fa-envelope mx-1"></i>{targetStatus?.action_history.split('メール').length - 1}
                    <i className="fa-solid fa-comment-sms mx-1"></i>{targetStatus?.action_history.split('SMS').length - 1}</div>) : '';
            return {
                ...r, hotlead: {
                    status: targetStatus?.status ?? '',
                    url: targetStatus?.hotlead_url ?? '',
                    action: targetAction,
                    reason: targetStatus?.ticket_stop_reason_type ?? ''
                }
            };
        });

        // registerの型エラー解消部分（文字列化して安全に比較）
        return result.sort((a, b) => {
            const dateA = String(a.register ?? "");
            const dateB = String(b.register ?? "");
            return dateB.localeCompare(dateA);
        });
    }, [
        originalDatabase, selectedShop, selectedRegister, selectedReserve,
        selectedRank, selectedMedium, selectedStatus, nameSearch.debouncedValue,
        staffSearch.debouncedValue, phoneSearch.debouncedValue, callStatus, addressSearch.debouncedValue,
        familySearch.debouncedValue, selectedIntroductory, trash, familyList, familyStatus,
        snapStatus, searchedEvent, hotleadStatus, hotleadList
    ]);

    // 条件変更時にページをリセットする
    useEffect(() => {
        if (skipPageReset.current) {
            skipPageReset.current = false;
            return;
        }
        setActivePage(1);
        setSliceStart(0);
    }, [filteredDatabase.length]); // 依存配列を絞り込み、filteredDatabaseの件数が変わった時にリセットする方針に変更

    // ページネーション生成（スッキリと配列化）
    const totalPages = Math.ceil((displayLength || 1) / basicLength);
    const paginationRange = () => {
        let start = Math.max(1, activePage - 2);
        let end = Math.min(totalPages, start + 4);
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    const handlePageClick = (page: number) => {
        setActivePage(page);
        setSliceStart((page - 1) * basicLength);
    };

    // 操作系ハンドラ
    const handleGarbage = async (id: string, name?: string) => {
        if (!id) return;
        const result = window.confirm(`${name}様を${trash === 1 ? '削除しますか？' : '元に戻しますか？'}`);
        if (!result) return;

        try {
            const response = await apiClient.post("", {
                request: 'database',
                show_dashboard: trash === 1 ? 0 : 1,
                id, category, roll: 'trash'
            });
            setOriginalDatabase(response.data.customer);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const closeInformationEdit = async () => {
        setEditId('');
        const prevPage = activePage;
        skipPageReset.current = true;

        await fetchDatabase();

        setActivePage(prevPage);
        setSearchParams({});
    };

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

    const hotlead = (item: any) => {
        if (!item.hotlead) return;
        return <div onClick={() => window.open(item.hotlead.url, '_blank', 'noopener,noreferrer')}>
            <div style={hotleadStyle(item.hotlead.status)}
            >{item.hotlead.status}</div>
            {item.hotlead.status && <div className="text-secondary" style={{ fontSize: '8px' }}>{item.hotlead.reason}</div>}
            <div style={{ cursor: 'pointer' }}>{item.hotlead.action}</div>
        </div>
    }

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
                    {!isSp && <>
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
                        </select>
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedMedium(e.target.value)}>
                                <option value="">販促媒体を選択</option>
                                {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                                {authority !== 'ordinary' && <option value='SUUMO(ポータル反響)'>SUUMO(ポータル反響)</option>}
                            </select>
                        </div>
                        {selectedMedium === '紹介' && <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedIntroductory(e.target.value)}>
                                <option value="">紹介者を選択</option>
                                {introductoryList.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>}
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
                            <select className="target" onChange={(e) => sethotleadStatus(e.target.value)}>
                                <option value="">Hotlead</option>
                                <option value="対応停止">対応停止</option>
                                <option value="アポ予約済み">アポ予約済み</option>
                                <option value="対応中">対応中</option>
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
                            <select className="target" onChange={(e) => {
                                if (e.target.value) {
                                    setSnapStatus(true);
                                } else {
                                    setSnapStatus(false);
                                }
                            }}>
                                <option value="">K-Snap</option>
                                <option value="登録済み">登録済み</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => {
                                setSearchedEvent(e.target.value);
                            }}>
                                <option value="">イベント名を選択</option>
                                {eventList.map(event =>
                                    <option value={`${event.startDate}_${event.title}`} key={`${event.startDate}_${event.title}`}>{event.startDate}_{event.title}</option>
                                )}
                            </select>
                        </div></>}
                    <div className="m-1">
                        <input className="target" placeholder='顧客名で検索(&電話番号+住所)'
                            value={nameSearch.inputValue} onChange={nameSearch.onChange} />
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <input className="target" placeholder='営業名で検索'
                                value={staffSearch.inputValue} onChange={staffSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='電話番号で検索'
                                value={phoneSearch.inputValue} onChange={phoneSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='住所で検索'
                                value={addressSearch.inputValue} onChange={addressSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='家族名で検索'
                                value={familySearch.inputValue} onChange={familySearch.onChange} />
                        </div>
                    </>}
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
                        {!isSp && <>
                            {trash === 1 && <div className="bg-primary text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setTrash(0)}>非表示リストへ移動</div>}
                            {trash === 0 && <div className="bg-primary text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setTrash(1)}>一覧へ戻る</div>}
                            <div className="bg-danger text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setCallStatusShow(true)}>架電状況集計</div>
                            <div className="bg-danger text-white ms-1 rounded position-relative" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setCancelListShow(true)}>キャンセル集計
                                <div className="position-absolute bg-danger text-white d-flex align-items-center justify-content-center"
                                    style={{ top: '-28px', width: '60px', height: '20px', borderRadius: '10px', left: 'calc( 50% - 30px)', letterSpacing: '1px', fontSize: '8px' }}>要回答{cancelLength}件</div>
                                <div className="position-absolute triangle"></div>
                            </div>
                            <div className="bg-danger text-white ms-1 rounded position-relative" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setLoseListShow(true)}>失注集計
                                <div className="position-absolute bg-danger text-white d-flex align-items-center justify-content-center"
                                    style={{ top: '-28px', width: '60px', height: '20px', borderRadius: '10px', left: 'calc( 50% - 30px)', letterSpacing: '1px', fontSize: '8px' }}>要回答{loseLength}件</div>
                                <div className="position-absolute triangle"></div>
                            </div>
                            <div className="bg-danger text-white ms-1 rounded" style={{ fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                onClick={() => setSurveyShow(true)}>アンケート集計</div></>}
                    </div>
                </div>
                <div className="w-100 mb-1">
                    <GiftLegend />
                </div>
                <div className="w-100" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ width: '1600px' }}>
                        <Table style={{ fontSize: isSp ? '9px' : '11px', textAlign: 'center' }} bordered striped>
                            <tbody className='align-middle'>
                                <tr className='align-middle sticky-header'>
                                    <td>顧客情報編集</td>
                                    <td>店舗</td>
                                    <td>顧客名</td>
                                    <td>担当営業</td>
                                    <td>ステータス</td>
                                    <td>反響日</td>
                                    <td>初回来場日<br /><span style={{ fontSize: '9px' }}>(来場予約日)</span></td>
                                    <td>ランク</td>
                                    <td>販促媒体</td>
                                    <td>住所</td>
                                    <td>自社架電状況</td>
                                    <td>自社架電件数</td>
                                    <td>Hotlead<br />ステータス</td>
                                    <td>{trash === 1 ? '非表示' : '元に戻す'}</td>
                                </tr>
                                {filteredDatabase
                                    .slice(sliceStart, sliceStart + basicLength)
                                    .map(item => {
                                        return <tr key={item.id}>
                                            <td><div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }}
                                                onClick={() => {
                                                    setEditId(item.id);
                                                }}>編集</div></td>
                                            <td>{safeFormate(item.shop)}</td>
                                            <td><GiftDot gift={item.gift} />{item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}{safeFormate(item.customer)}</td>
                                            <td>{safeFormate(item.staff)}</td>
                                            <td>{safeFormate(item.status)}</td>
                                            <td>{safeFormate(item.register)}</td>
                                            <td>{item.interview && safeFormate(item.interview)}{item.cancel_status && <span className='text-danger fw-bold'
                                                style={{ fontSize: '8px' }}>キャンセル({item.cancel_status})</span>}<br /><span style={{ fontSize: '10px', fontWeight: '700' }}>{item.reserved_interview ? <>({safeFormate(item.reserved_interview)})</> : ''}</span></td>
                                            <td>{(item.rank ?? '').replace('ランク', '')}</td>
                                            <td>{item.medium}{(item.medium === '紹介' && item.introduction_person_category) && <><br /><span className='bg-danger text-white px-1 rounded' style={{ fontSize: '8px', whiteSpace: 'nowrap' }}>{safeFormate(item.introduction_person_category)}</span></>}</td>
                                            <td style={{ textAlign: 'left' }}>{item.full_address}</td>
                                            <td>{item.call_status}</td>
                                            <td>{item.call_log || '0'}</td>
                                            <td>{hotlead(item)}</td>
                                            <td style={{ cursor: 'pointer' }} onClick={() => handleGarbage(item.id, item.customer)}>{trash === 1 ? <i className="fa-solid fa-ban"></i> : <i className="fa-solid fa-rotate-left"></i>}</td>
                                        </tr>
                                    })}
                            </tbody>
                        </Table>
                    </div></div>
            </div>
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <CallStatusList
                callStatusShow={callStatusShow}
                setCallStatusShow={setCallStatusShow}
            />
            <SurveyList
                surveyShow={surveyShow}
                setSurveyShow={setSurveyShow}
            />
            <CancelList
                cancelListShow={cancelListShow}
                setCancelListShow={setCancelListShow}
                onReload={onReload}
                shopArray={shopArray}
            />
            <LostStatusList
                loseListShow={loseListShow}
                setLoseListShow={setLoseListShow}
                onReload={onReload}
                shopArray={shopArray}
            />
        </>
    )
}

export default DatabaseOrder
