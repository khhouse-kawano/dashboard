import React, { useEffect, useState, useContext, useMemo, useRef, useCallback } from 'react';
// ⚠️ 共有された URL の ?id= で顧客編集を開くため（下の useEffect 参照）
import { useSearchParams } from 'react-router-dom';
import Table from "react-bootstrap/Table";
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import InformationEditResale from '../information/InformationEditResale';
import CallStatusList from '../header/callStatus/CallStatusList';
import IntegrateModal from './IntegrateModal';
import { useIsSp } from '../../utils/isSp';
import { generateULID } from '../../utils/createULID';
import apiClient from '../../utils/apiClient';
import { toHalfWidth, decodeRows } from './databaseUtils';
import PropertyRegister from './PropertyRegister';
import { BrokerData } from './PropertyRegister';
import { generateNewId } from './databaseUtils';
import { CustomerNameCell } from './customerName2';
import { descending } from '../../utils/descending';
// ⚠️ v2.2.292 注文・建売（DatabaseOrder.tsx・DatabaseKaeru.tsx）と同じ作りにする（1ページずつ GET・条件を URL に出す・見た目）
import { useDebounce } from './useDebounce';
import { RankingStyle } from '../rankingUi';
import { DBK_CSS } from './databaseListStyle';
import { readListUrl, useListUrlSync, useOnListChange } from './listUrl';
import { isRecordSearch, RecordCell, RECORD_COL_WIDTH, RECORD_CSS, recordErrorOf, RecordSearchCard, readRecordMatch, recordMatchParam, recordWordsOf, type RecordMap, type RecordMatch } from './recordSearch';
import { useCallStatusOptions, withCurrent } from './callStatusOptions';

/**
 * v2.2.292 中古だけの列の固定（左から 編集・複製・店舗・顧客名）。⚠️ DBK_CSS の dbk_fix の後ろに置いて上書きする。
 * ⚠️ 幅と left をそろえること（編集 70px → 複製 50px → 店舗 100px → 顧客名 170px）。
 */
const DBU_CSS = `
.database.dbu_wrap .dbu_copy { left: 70px; width: 50px; min-width: 50px; }
.database.dbu_wrap .dbu_shop { left: 120px; width: 100px; min-width: 100px; }
.database.dbu_wrap .dbk_fix3 { left: 220px; border-right: 2px solid #d1d5db; }
.dbu_copy_btn { cursor: pointer; color: #4b5563; }
.dbu_copy_btn:hover { color: #2563eb; }
`;

type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, position: string };
type CustomerList = Record<string, string>;
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

type Props = {
    onReload: () => void,
    key: number
};

const positions = ['常務', '部長', '課長', '課長代理', '店長', '店長代理', '一般'];

/** 担当営業の並び（役職順）。⚠️ 媒介の登録（PropertyRegister）の担当の候補に使う */
const sortByPosition = (staff: staffList[]): staffList[] => [...staff].sort((a, b) => positions.indexOf(a.position) - positions.indexOf(b.position));

/** 応答の顧客一覧を配列にする（⚠️ ② は「列名1回＋値の並び」、① は配列で返す。decodeRows がどちらも配列にする） */
const prepareCustomers = (data: unknown): CustomerList[] => decodeRows<CustomerList>(data);

/** 架電記録のうち action の日を1つ選ぶ（asc: 古い順の先頭 / desc: 新しい順の先頭）。⚠️ ② の list.ts の pickCallDay と同じ */
const pickCallDay = (callLog: CallAction[] | undefined, action: string, order: 'asc' | 'desc'): string => {
    if (!callLog) return '';
    return callLog.filter(c => c.action === action).sort((a, b) => {
        const diff = new Date(a.day).getTime() - new Date(b.day).getTime();
        return order === 'asc' ? diff : -diff;
    })[0]?.day ?? '';
};

const DatabaseResale = ({ onReload, key }: Props) => {
    const { authority, category } = useContext(AuthContext);
    /** v2.2.293 架電状況の選択肢（DB の call_status。② に届かないときは今までの固定の選択肢） */
    const callStatusOptions = useCallStatusOptions(category);
    /** v2.2.292 開いたときの URL の条件（⚠️ 下の state の初期値にだけ使う） */
    const [initUrl] = useState(() => readListUrl(new URLSearchParams(window.location.search)));
    const [shopArray, setShopArray] = useState<string[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [staffArray, setStaffArray] = useState<staffList[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalDatabase, setOriginalDatabase] = useState<CustomerList[]>([]);
    const [selectedShop, setSelectedShop] = useState<string>(initUrl.get('shop'))
    const [selectedRegister, setSelectedRegister] = useState<string>(initUrl.get('register'))
    const [selectedReserve, setSelectedReserve] = useState<string>(initUrl.get('reserve'))
    const [selectedRank, setSelectedRank] = useState<string>(initUrl.get('rank'))
    const [selectedMedium, setSelectedMedium] = useState<string>(initUrl.get('medium'))
    const [selectedStatus, setSelectedStatus] = useState<string>(initUrl.get('status'))
    // ⚠️ v2.2.292 文字の検索は打ち終わってから（300ms）絞る（② に1文字ごとに問い合わせないため。注文・建売と同じ）
    const nameSearch = useDebounce(initUrl.get('name'), 300);
    const staffSearch = useDebounce(initUrl.get('staffText'), 300);
    const phoneSearch = useDebounce(initUrl.get('phone'), 300);
    const mailSearch = useDebounce(initUrl.get('mail'), 300);
    const addressSearch = useDebounce(initUrl.get('address'), 300);
    const searchedName = nameSearch.debouncedValue;
    const searchedStaff = staffSearch.debouncedValue;
    const searchedPhone = phoneSearch.debouncedValue;
    const searchedMail = mailSearch.debouncedValue;
    const searchedAddress = addressSearch.debouncedValue;
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [callStatus, setCallStatus] = useState<string>(initUrl.get('callStatus'));
    const [activePage, setActivePage] = useState<number>(initUrl.page);
    const [sliceStart, setSliceStart] = useState<number>((initUrl.page - 1) * initUrl.perPage);
    const [basicLength, setBasicLength] = useState<number>(initUrl.perPage);
    const [trash, setTrash] = useState<number>(initUrl.trash);
    const { token } = useContext(AuthContext);
    const [familyList, setFamilyList] = useState<string[]>([]);
    const [familyStatus, setFamilyStatus] = useState<boolean>(initUrl.get('family') === '1');
    const [firstCallDate, setFirstCallDate] = useState<CallLog[]>([]);
    const [callStatusShow, setCallStatusShow] = useState(false);
    const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];
    const skipPageReset = useRef(false);
    const [integrate, setIntegrate] = useState<CustomerList>({});
    const [integrateList, setIntegrateList] = useState<CustomerList[]>([]);
    const [broker, setBroker] = useState<Record<string, string>[]>([]);

    const isSp = useIsSp();

    const formate = (value: string) => {
        return (value ?? '').replace(/-/g, '/');
    };

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/\//g, '-');
    };

    /**
     * v2.2.292 顧客を1ページずつ ② から GET で読む（request database_list。② の features/database/list.ts の runUsedList）。
     * ⚠️ 絞り込み・並べ替え・ページ分けは ② が行い、画面は今のページの行（pageRows）と件数（serverTotal）だけを持つ。
     * ⚠️ 重複の印（duplicate）・初回通電日（first_call）・次回架電日（next_call）は ② が行に付け、媒介は今のページの分だけ返す。
     * ⚠️⚠️ ② に届かないときは serverMode を false にして、今までどおり全件を POST（request database。① が返す）で読み、
     *   下の filteredDatabase で絞り込む。⚠️ filteredDatabase と ② の絞り込みは同じ条件にしてある（片方だけ直さない）。
     */
    const [serverMode, setServerMode] = useState(true);
    const [pageRows, setPageRows] = useState<CustomerList[]>([]);
    /** v2.2.296 商談・架電記録から検索する語（⚠️ ボタンで決めた値。ほかの条件と一緒に ② に送る）と、今のページの当たった記録 */
    const [recordSearch, setRecordSearch] = useState(initUrl.get('record'));
    /** v2.2.306 空白で区切った語の合わせ方（すべて含む＝既定／いずれかを含む）。URL・② のキーは recordMode */
    const [recordMatch, setRecordMatch] = useState<RecordMatch>(() => readRecordMatch(initUrl.get('recordMode')));
    const [pageRecords, setPageRecords] = useState<RecordMap>({});
    /** v2.2.297 記録の検索が失敗した理由（⚠️ 失敗しても予備の全件読み込みには切り替えない） */
    const [recordError, setRecordError] = useState('');
    const [serverTotal, setServerTotal] = useState(0);
    const [listLoading, setListLoading] = useState(false);
    /** 取り直すきっかけ（編集を閉じた・非表示・複製・名寄せ・媒介の保存のあと） */
    const [listReloadKey, setListReloadKey] = useState(0);
    /** 古い応答で新しい条件の結果を上書きしない */
    const listSeqRef = useRef(0);
    /** 選択肢を読み込み済みか（⚠️ 最初の1回だけ master=1 で取る） */
    const mastersLoadedRef = useRef(false);
    const reloadList = () => setListReloadKey((k) => k + 1);

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        setShopArray(categoryList);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** 全件の読み込み（⚠️ v2.2.292 ② に届かなかったとき＝予備のときだけ使う） */
    const fetchDatabase = useCallback(async (isInitial = false) => {
        try {
            const response = await apiClient.post("", { request: 'database', category });
            const customers = prepareCustomers(response.data.customer);
            setOriginalDatabase(customers);
            const filtered = response.data.broker.filter(b => b.kind === 'ledger' && b.show_dashboard === 1 && Boolean(b.master_data_id));
            setBroker(filtered);
            if (!isInitial) return;
            setMediumArray(response.data.medium.map(item => item.medium));
            setDisplayLength(customers.length);
            setStaffArray(sortByPosition(response.data.staff));
            const familyId = response.data.family.map(f => f.id);
            setFamilyList(familyId);
            const filteredCallResponse = response.data.call.map(item => ({
                ...item,
                call_log: item.call_log ? JSON.parse(item.call_log) : []
            }))
            setFirstCallDate(filteredCallResponse);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }, [category]);

    // ⚠️ v2.2.292 全件の読み込みは、② に届かなかったとき（serverMode が false）だけ
    useEffect(() => {
        if (serverMode) return;
        fetchDatabase(true);
    }, [fetchDatabase, serverMode]);

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
                // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象（⚠️ この画面は空白を消さずに比べる既存の規則に合わせる）
                && (searchedName ? (strIncludes(item.customer, formattedName) || strIncludes(item.customer_2, formattedName)) : true)
                && (searchedStaff ? strIncludes(item.staff, searchedStaff.split(' ')[0]) : true)
                && ((searchedPhone || searchedName) ? strIncludes(item.phone_number, formattedNumber) : true)
                && (searchedMail ? strIncludes(item.mail, searchedMail) : true)
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
        searchedMail,
        callStatus,
        searchedPhone,
        trash,
        familyList,
        familyStatus,
    ]);

    const duplicateDictionary = useMemo(() => {
        const dict: Record<string, string[]> = {};

        originalDatabase.forEach(item => {
            if (item.mail) {
                if (!dict[item.mail]) dict[item.mail] = [];
                dict[item.mail].push(item.id);
            }
            const formattedNumber = toHalfWidth(item.phone_number);
            if (formattedNumber) {
                if (!dict[formattedNumber]) dict[formattedNumber] = [];
                dict[formattedNumber].push(item.id);
            }
        });

        return dict;
    }, [originalDatabase]);

    /** v2.2.292 ② に送る条件（⚠️ 空の条件は送らない。キーは URL にもそのまま出る） */
    const listParams = useMemo(() => Object.fromEntries(Object.entries({
        trash: String(trash),
        shop: selectedShop, register: selectedRegister, reserve: selectedReserve, rank: selectedRank,
        medium: selectedMedium, status: selectedStatus, callStatus, family: familyStatus ? '1' : '',
        name: searchedName, staffText: searchedStaff, phone: searchedPhone, mail: searchedMail, address: searchedAddress,
        record: recordSearch,
        // ⚠️ v2.2.306 検索語があるときだけ。既定（すべて含む）は出さない（② には下の GET で毎回送る）
        recordMode: recordSearch ? recordMatchParam(recordMatch) : '',
    }).filter(([, v]) => v !== '')), [
        trash, selectedShop, selectedRegister, selectedReserve, selectedRank, selectedMedium, selectedStatus, callStatus,
        familyStatus, searchedName, searchedStaff, searchedPhone, searchedMail, searchedAddress, recordSearch, recordMatch,
    ]);

    /**
     * 条件・表示件数が変わったら1ページ目へ。
     * ⚠️ v2.2.292 以前は全件を読み直したときにも戻していた。② で読むと全件は手元に無いので、条件が実際に変わったときに戻す
     *   （URL の page で開いたときは戻さない。予備のときは全件の読み込みも対象）。
     */
    useOnListChange(`${JSON.stringify(listParams)}|${basicLength}`, [originalDatabase, familyList], () => {
        if (skipPageReset.current) {
            skipPageReset.current = false;
            return;
        }
        setActivePage(1);
        setSliceStart(0);
    });

    /** v2.2.292 送る条件・ページ・表示件数を画面の URL にも出す */
    useListUrlSync(listParams, activePage, basicLength);

    /**
     * v2.2.292 今の条件・ページを ② から GET で読む（DatabaseOrder.tsx・DatabaseKaeru.tsx と同じ作り）。
     * ⚠️ setTimeout(0) で1回にまとめる（条件を変えると、上の処理がページを1に戻すので、古いページで1回読まないように）。
     */
    useEffect(() => {
        if (!serverMode) return;
        const timer = window.setTimeout(async () => {
            const seq = ++listSeqRef.current;
            setListLoading(true);
            try {
                const response = await apiClient.get('', {
                    params: {
                        request: 'database_list', category, ...listParams, page: activePage, perPage: basicLength,
                        // ⚠️ v2.2.306 合わせ方は検索語があれば毎回送る（送らないと ② は語を区切らない）
                        ...(listParams.record ? { recordMode: recordMatch } : {}),
                        ...(mastersLoadedRef.current ? {} : { master: 1 }),
                    },
                });
                if (seq !== listSeqRef.current) return;
                const data = response.data;
                if (!data || data.status !== 'ok') throw new Error('database_list の応答が正しくありません');
                if (Array.isArray(data.staff)) {
                    setMediumArray((data.medium ?? []).map((item: { medium: string }) => item.medium));
                    setStaffArray(sortByPosition(data.staff));
                    mastersLoadedRef.current = true;
                }
                setPageRows(prepareCustomers(data.customer));
                setPageRecords(data.record ?? {});
                setRecordError('');
                // ⚠️ 媒介は今のページの分だけ（表の broker.find が顧客 id で引く）
                setBroker(data.broker ?? []);
                setServerTotal(Number(data.total) || 0);
                setDisplayLength(Number(data.total) || 0);
                // ⚠️ ページが件数より後ろなら、② が最後のページに寄せて返す。画面もそれに合わせる
                if (Number(data.page) !== activePage) {
                    setActivePage(Number(data.page));
                    setSliceStart((Number(data.page) - 1) * basicLength);
                }
            } catch (error) {
                if (seq !== listSeqRef.current) return;
                // ⚠️ v2.2.297 記録の検索の失敗は予備に落とさない（落とすと検索が使えなくなる）。一覧は前のまま残し、カードに理由を出す
                if (listParams.record) {
                    console.error('database_list（商談・架電記録の検索）に失敗しました:', error);
                    setRecordError(recordErrorOf(error));
                    return;
                }
                console.error('database_list に失敗しました。全件の読み込みに切り替えます:', error);
                setServerMode(false);
            } finally {
                if (seq === listSeqRef.current) setListLoading(false);
            }
        }, 0);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode, category, listParams, activePage, basicLength, listReloadKey]);

    /** 表に出す行と件数（⚠️ ② で読むときは今のページの行。予備のときは画面で絞った結果を並べて切る） */
    const visibleRows = useMemo(() => serverMode ? pageRows : [...filteredDatabase]
        .sort((a, b) => {
            const tA = a.register ? Date.parse(a.register) : Number.NEGATIVE_INFINITY;
            const tB = b.register ? Date.parse(b.register) : Number.NEGATIVE_INFINITY;
            const timeA = Number.isNaN(tA) ? Number.NEGATIVE_INFINITY : tA;
            const timeB = Number.isNaN(tB) ? Number.NEGATIVE_INFINITY : tB;
            return timeB - timeA;
        })
        .slice(sliceStart, sliceStart + basicLength), [serverMode, pageRows, filteredDatabase, sliceStart, basicLength]);
    const totalCount = serverMode ? serverTotal : filteredDatabase.length;
    /** v2.2.296 商談・架電記録から検索しているか（⚠️ 真のときだけ「商談・架電内容」の列を出す） */
    const recordMode = isRecordSearch(recordSearch, serverMode) && recordError === '';

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

    const [editId, setEditId] = useState('')
    const [searchParams, setSearchParams] = useSearchParams();

    /**
     * URL の `?id=` で顧客編集を開く。
     *
     * ⚠️⚠️ **DatabaseOrder.tsx と同じ仕組み。** 2026-09-14 にこちらへも入れた。
     *   紹介・アンバサダーの反響一覧（header/InquiryAmbassador.tsx）に
     *   「顧客編集ページのURLをコピー」するボタンがあり、
     *   そのリンクを受けるのがここである。
     *   ⚠️ これが無いと、共有されたリンクを開いても
     *     **黙って顧客一覧が開くだけ**になる（エラーも出ない）。
     *
     * ⚠️ 2つ目の useEffect は、画面で顧客を開いたときに URL へ反映するため。
     *   これがあるから、開いている状態の URL をそのまま共有できる。
     */
    useEffect(() => {
        const urlId = searchParams.get('id');
        if (urlId) setEditId(urlId);
    }, [searchParams]);

    useEffect(() => {
        if (!editId) return;
        const newParams = new URLSearchParams(searchParams);
        newParams.set('id', editId);
        setSearchParams(newParams);
    }, [editId, searchParams, setSearchParams]);


    const handleGarbage = async (id: string, name: string) => {
        if (!id) return;
        const result = window.confirm(`${name}様を${trash === 1 ? '削除しますか？' : '元に戻しますか？'}`);
        if (result) {
            const fetchData = async () => {
                try {
                    const postData = {
                        request: 'database',
                        show_dashboard: trash === 1 ? 0 : 1,
                        id: id,
                        category,
                        roll: 'trash'
                    };
                    const response = await apiClient.post("", postData);
                    // ⚠️ v2.2.292 ② で読むときは今のページを読み直す（① が返す全件は使わない）
                    if (serverMode) reloadList();
                    else setOriginalDatabase(prepareCustomers(response.data.customer));
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
        // ⚠️ v2.2.292 URL の ?id= だけを外す（条件は URL に残す）
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('id');
        setSearchParams(nextParams, { replace: true });
        // ⚠️ v2.2.292 ② で読むときは今のページを読み直すだけ（ページは変えない）
        if (serverMode) {
            reloadList();
            return;
        }
        const prevPage = activePage;

        skipPageReset.current = true;

        await fetchDatabase();

        setActivePage(prevPage);
    };


    const integrationCustomer = async (customer: Record<string, string>) => {
        setIntegrate(customer);

        // ⚠️ v2.2.292 ② で読むときは全件を持っていないので、② に候補を頼む（条件は下と同じ）
        if (serverMode) {
            try {
                const response = await apiClient.get('', { params: { request: 'database_list', category, dupOf: customer.id } });
                setIntegrateList(prepareCustomers(response.data.customer));
            } catch (error) {
                console.error('名寄せの候補を読み込めませんでした:', error);
                setIntegrateList([]);
            }
            return;
        }

        const filteredDuplicate = originalDatabase.filter(o =>
            o.id !== customer.id
            && ((o.mail !== '' && o.mail === customer.mail) || (o.phone_number !== '' && o.phone_number === customer.phone_number))
        );
        setIntegrateList(filteredDuplicate);
    };

    const handleCopy = (id: string, customerName: string) => {
        if (!id) return;
        if (window.confirm(`${customerName}様のデータを複製しますか?`)) {
            const postData = {
                id,
                newId: generateULID(),
                request: 'database',
                roll: 'copy',
                category
            };

            const fetchData = async () => {
                try {
                    const response = await apiClient.post("", postData);
                    // ⚠️ v2.2.292 ② で読むときは今のページを読み直す
                    if (serverMode) reloadList();
                    else setOriginalDatabase(prepareCustomers(response.data.customer));
                } catch (error: any) {
                    console.error(error);
                    alert(`エラー: ${error.response?.data?.message || "通信エラーが発生しました"}`);
                }
            };
            fetchData();
        };
    };

    // 媒介獲得用の状態管理
    const [targetPropertyId, setTargetPropertyId] = useState<string>('');
    const [editData, setEditData] = useState<Partial<BrokerData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [brokerCustomer, setBrokerCustomer] = useState('');

    useEffect(() => {
        if (!targetPropertyId) return;
        const targetPropertyData = broker.find(b => b.id === targetPropertyId);
        setEditData(targetPropertyData ?? {});
    }, [targetPropertyId])

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
            // ⚠️ v2.2.292 ② で読むときは今のページを読み直す（媒介も今のページの分だけ持つ）
            if (serverMode) reloadList();
            else setBroker(response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1 && Boolean(b.master_data_id)));
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
    return (
        <>
            <RankingStyle />
            <style>{DBK_CSS + DBU_CSS}</style>
            <style>{RECORD_CSS}</style>
            <div className='content database bg-white rk_wrap dbk_wrap dbu_wrap'>
                <div className="rk_head">
                    <span className="rk_title">顧客DB（中古リノベ事業）</span>
                </div>
                <div className='rk_bar dbk_bar'>
                    <div className="m-1">
                        <select className="target" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
                            <option value="">店舗を選択</option>
                            {shopArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                        </select>
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <select className="target" value={selectedRegister} onChange={(e) => setSelectedRegister(e.target.value)}>
                                <option value="">反響月を選択</option>
                                {descending(monthArray).map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={selectedReserve} onChange={(e) => setSelectedReserve(e.target.value)}>
                                <option value="">初回来場月を選択</option>
                                <option value="notVisited">未来場・来場キャンセル</option>
                                {descending(monthArray).map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div></>}
                    <div className="m-1">
                        <select className="target" value={selectedRank} onChange={(e) => setSelectedRank(e.target.value)}>
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
                            <select className="target" value={selectedMedium} onChange={(e) => setSelectedMedium(e.target.value)}>
                                <option value="">販促媒体を選択</option>
                                {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                                <option value="">ステータスを選択</option>
                                <option value="見込み">見込み</option>
                                <option value="契約済み">契約済み</option>
                                <option value="失注">失注</option>
                                <option value="会社管理">会社管理</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={callStatus} onChange={(e) => {
                                setCallStatus(e.target.value);
                            }}>
                                <option value="">架電状況</option>
                                {/* ⚠️ v2.2.293 選択肢は DB（call_status）から。⚠️ URL で開いた値が非表示でも残す */}
                                {withCurrent(callStatusOptions.statuses, callStatus).map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={familyStatus ? '入力済み' : ''} onChange={(e) => {
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
                        <input className="target" placeholder='顧客名で検索' value={nameSearch.inputValue} onChange={nameSearch.onChange} />
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <input className="target" placeholder='営業名で検索' value={staffSearch.inputValue} onChange={staffSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='電話番号で検索' value={phoneSearch.inputValue} onChange={phoneSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='メールアドレスで検索' value={mailSearch.inputValue} onChange={mailSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='住所で検索' value={addressSearch.inputValue} onChange={addressSearch.onChange} />
                        </div></>}
                    <button type="button" className="rk_btn m-1" onClick={() => setEditId('new')}>新規登録</button>
                </div>
                <div className="d-md-flex">
                    <div className="d-flex flex-wrap align-items-center">
                        <div><span className="dbk_count_num">{totalCount}</span><span className="dbk_count_sub"> 件中 {totalCount === 0 ? 0 : sliceStart + 1}件~{totalCount > activePage * basicLength ? activePage * basicLength : totalCount}件</span>
                            {listLoading && <span className="ms-2 dbk_count_sub">読み込み中…</span>}</div>
                        <div className="ms-2 dbk_count_sub">
                            表示件数
                            <select className="rk_select ms-1" value={basicLength} onChange={(e) => setBasicLength(Number(e.target.value))}>
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
                        {/* ⚠️ v2.2.297 同じ語で押したら読み直す（失敗のあとにもう一度試せるように） */}
                        <RecordSearchCard value={recordSearch} onSearch={(keyword) => (keyword === recordSearch ? reloadList() : setRecordSearch(keyword))} disabled={!serverMode} loading={listLoading} error={recordError}
                            match={recordMatch} onMatch={setRecordMatch} />
                        {!isSp && <>
                            {trash === 1 && <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setTrash(0)}>非表示リストへ移動</button>}
                            {trash === 0 && <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setTrash(1)}>一覧へ戻る</button>}
                            <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setCallStatusShow(true)}>架電状況集計</button></>}
                    </div>
                </div>
                <div className="w-100 dbk_table_wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ width: `${1700 + (recordMode ? RECORD_COL_WIDTH : 0)}px` }}>
                        {/* ⚠️ v2.2.292 縞模様（striped）は外した。罫線・見出しの色は databaseListStyle.ts の DBK_CSS */}
                        <Table className='dbk_table' style={{ fontSize: isSp ? '9px' : '12px', textAlign: 'center' }} bordered>
                            <tbody className='align-middle'>
                                <tr className='align-middle sticky-header'>
                                    {/* ⚠️ v2.2.292 左の4列（編集・複製・店舗・顧客名）は横に動かしても残す（上の DBU_CSS） */}
                                    <td className='dbk_fix dbk_fix1'>顧客情報編集</td>
                                    <td className='dbk_fix dbu_copy'>複製</td>
                                    <td className='dbk_fix dbu_shop'>店舗</td>
                                    <td className='dbk_fix dbk_fix3'>顧客名</td>
                                    <td>担当営業</td>
                                    {recordMode && <td>商談・架電内容</td>}
                                    <td>ステータス</td>
                                    <td>架電状況</td>
                                    <td>架電件数</td>
                                    <td>反響日</td>
                                    <td>初回通電日</td>
                                    <td>次回架電日</td>
                                    <td>ランク</td>
                                    <td>販促媒体</td>
                                    <td>住所</td>
                                    <td>連絡先</td>
                                    <td>{trash === 1 ? '非表示' : '元に戻す'}</td>
                                </tr>
                                {visibleRows.map((item, index) => {
                                        // ⚠️ v2.2.292 ② で読むときは ② が付けた初回通電日・次回架電日・重複の印を使う（予備のときは今までどおり画面で作る）
                                        const callLog = serverMode ? undefined : firstCallDate.find(f => f.id === item.id)?.call_log;
                                        const firstDate = serverMode ? (item.first_call ?? '') : pickCallDay(callLog, '通電', 'asc');
                                        const nextDate = serverMode ? (item.next_call ?? '') : pickCallDay(callLog, '次回架電日', 'desc');
                                        const isDuplicate = serverMode ? Number(item.duplicate) === 1 : (
                                            (item.mail ? duplicateDictionary[item.mail] || [] : []).some(id => id !== item.id) ||
                                            (item.phone_number ? duplicateDictionary[toHalfWidth(item.phone_number)] || [] : []).some(id => id !== item.id));
                                        const targetBroker = broker.find(b => b.master_data_id === item.id);
                                        const isBroker = targetBroker && item.shop === '売り:ポータル';
                                        const isBrokerNone = !targetBroker && item.shop === '売り:ポータル';
                                        return <tr key={item.id ?? index}>
                                            <td className='dbk_fix dbk_fix1'><button type="button" className='dbk_edit' onClick={() => setEditId(item.id)}>編集</button></td>
                                            <td className='dbk_fix dbu_copy'>
                                                <span className='dbu_copy_btn' onClick={() => handleCopy(item.id, item.customer ?? '')}><i className="fa-solid fa-user-plus"></i></span></td>
                                            <td className='dbk_fix dbu_shop'>{item.shop}</td>
                                            {/* ⚠️ v2.2.187: 氏名②があるときだけ「アイコン（縦中央）／氏名①・氏名②の2行」。⚠️ 媒介のボタンは氏名①の右（今までどおり） */}
                                            <td className='dbk_fix dbk_fix3'><CustomerNameCell
                                                icons={isDuplicate && <span style={{ cursor: 'pointer' }}
                                                    onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}
                                                name={item.customer ?? ''}
                                                name2={item.customer_2}
                                                after={<>
                                                {isBroker && <span className='bg-warning rounded ms-1 p-1 fw-bold'
                                                    style={{ fontSize: '9px', textDecoration: 'underline dotted', cursor: 'pointer' }}
                                                    onClick={() => {
                                                        setBrokerCustomer(item.id);
                                                        setTargetPropertyId(targetBroker?.id);
                                                    }}>
                                                    媒介編集</span>}
                                                {isBrokerNone && <span className='bg-danger rounded ms-1 p-1 fw-bold text-white'
                                                    style={{ fontSize: '9px', textDecoration: 'underline dotted', cursor: 'pointer' }}
                                                    onClick={() => {
                                                        setBrokerCustomer(item.id);
                                                        handleAddNew();
                                                    }}>
                                                    媒介追加</span>}
                                                </>} /></td>
                                            <td>{item.staff ?? ''}</td>
                                            {recordMode && <RecordCell group={pageRecords[item.id ?? '']} words={recordWordsOf(recordSearch)} />}
                                            <td>{item.status ?? ''}</td>
                                            <td>{item.call_status}</td>
                                            <td>{item.call_log || '0'}</td>
                                            <td>{formate(item.register)}</td>
                                            <td>{formate(firstDate)}</td>
                                            <td>{formate(nextDate)}</td>
                                            <td>{(item.rank ?? '').replace('ランク', '')}</td>
                                            <td>{item.medium}</td>
                                            <td style={{ textAlign: 'left' }}>{item.full_address}</td>
                                            <td style={{ textAlign: 'left' }}>{item.mail}<br />{item.phone_number}</td>
                                            <td style={{ cursor: 'pointer' }} onClick={() => handleGarbage(item.id, item.customer)}>{trash === 1 ? <i className="fa-solid fa-ban"></i> : <i className="fa-solid fa-rotate-left"></i>}</td>
                                        </tr>
                                    })}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
            {/* ⚠️ v2.2.292 ② で読むときは、名寄せのあとに ① が返す全件は使わず、今のページを読み直す */}
            <IntegrateModal integrate={integrate} setIntegrate={setIntegrate} integrateList={integrateList} setIntegrateList={setIntegrateList}
                setOriginalDatabase={serverMode ? () => reloadList() : setOriginalDatabase} />
            <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <CallStatusList
                callStatusShow={callStatusShow}
                setCallStatusShow={setCallStatusShow}
            />
            <PropertyRegister
                targetPropertyId={targetPropertyId}
                setTargetPropertyId={setTargetPropertyId}
                editData={editData} setEditData={setEditData}
                staffList={[...new Set(staffArray.filter(s => s.shop === '中古住宅専門店' || s.shop === '不動産企画係').map(s => s.name))]}
                isSaving={isSaving}
                handleUpdate={handleUpdate}
                customerId={brokerCustomer} />
        </>
    )
}

export default DatabaseResale
