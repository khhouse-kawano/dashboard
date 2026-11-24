import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
// ⚠️ 共有された URL の ?id= で顧客編集を開くため（下の useEffect 参照）
import { useSearchParams } from 'react-router-dom';
import Table from "react-bootstrap/Table";
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import CallStatusList from '../header/callStatus/CallStatusList';
import InformationEditKaeru from '../information/InformationEditKaeru';
import IntegrateModal from './IntegrateModal';
import { useIsSp } from '../../utils/isSp';
import { PastCustomer } from './PastCustomer';
import { useDebounce } from './useDebounce';
import { kataToHira, staffOptionsOf, decodeRows } from './databaseUtils';
import { thisYear } from '../../utils/thisYear';
// ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
import { sortStaff } from '../header/ambassador/useAmbassadorMaster';
import { GiftDot, GiftLegend } from './GiftMark';
import { CustomerNameCell, cleanCustomerName } from './customerName2';
import { descending } from '../../utils/descending';
// ⚠️ v2.2.290 見た目を販促媒体別（CustomerKaeru）・目標達成状況（RankKaeru）とそろえる（rk_ の CSS を借りる）
import { RankingStyle } from '../rankingUi';
// ⚠️ v2.2.291 表・絞り込みの CSS は注文（DatabaseOrder.tsx）と共通
import { DBK_CSS } from './databaseListStyle';
// ⚠️ v2.2.291 GET の条件を画面の URL にも出す・URL の条件で開く
import { readListUrl, useListUrlSync, useOnListChange } from './listUrl';
import { isRecordSearch, RecordCell, RECORD_COL_WIDTH, RECORD_CSS, RecordSearchCard, type RecordMap } from './recordSearch';
import { useCallStatusOptions, withCurrent } from './callStatusOptions';

type shopList = { brand: string, shop: string, section: string };
// ⚠️ position / khg_id は担当営業セレクトの並べ替えに使う（2026-09-14 追加）。
//   サーバーは `SELECT *` なので元から返っている
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, period: string, position: string, khg_id: string, section: string, status: string };
type CustomerList = Record<string, string>;

/** v2.2.288 入居希望地（planned_construction_site・_2・_3）のうち、値のあるもの（⚠️ 前後の空白を除く） */
const plannedSites = (item: CustomerList): string[] =>
    [item.planned_construction_site, item.planned_construction_site_2, item.planned_construction_site_3]
        .map((v) => String(v ?? '').trim())
        .filter((v) => v !== '');

type Props = {
    onReload: () => void,
    key: number
};

/** ふりがな検索用の値（空白を消して平仮名にする） */
const kanaKey = (kana: string | undefined): string => kataToHira((kana || '').replace(/[\s\u3000]+/g, ''));

/**
 * 応答の顧客一覧を画面用にする（検索用の列を先に作っておく）。
 * ⚠️ v2.2.271: ② は「列名1回＋値の並び」、① は配列で返す。decodeRows がどちらも配列にする。
 * ⚠️ _kana（ふりがなの空白を消して平仮名にしたもの）も読み込み時に1回だけ作る（以前は絞り込みのたびに全行で作っていた）。
 */
const prepareCustomers = (data: unknown): CustomerList[] =>
    decodeRows<CustomerList>(data).map(c => ({
        ...c,
        search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
        _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, ''),
        _kana: kanaKey(c.customer_contacts_name_kana)
    }));

const DatabaseKaeru = ({ }: Props) => {
    const { authority, category } = useContext(AuthContext);
    /** v2.2.293 架電状況の選択肢（DB の call_status。② に届かないときは今までの固定の選択肢） */
    const callStatusOptions = useCallStatusOptions(category);
    /** v2.2.291 開いたときの URL の条件（⚠️ 下の state の初期値にだけ使う） */
    const [initUrl] = useState(() => readListUrl(new URLSearchParams(window.location.search)));
    const [shopArray, setShopArray] = useState<shopList[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [staffArray, setStaffArray] = useState<staffList[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalDatabase, setOriginalDatabase] = useState<CustomerList[]>([]);
    const [selectedShop, setSelectedShop] = useState<string>(initUrl.get('shop'))
    /**
     * セレクトで選んだ担当営業。
     * ⚠️ 既存の担当者名テキスト検索とは別に持つ。同姓の担当者が増えたため（指示）。
     */
    const [selectedStaff, setSelectedStaff] = useState<string>(initUrl.get('staff'))
    const [selectedRegister, setSelectedRegister] = useState<string>(initUrl.get('register'))
    const [selectedReserve, setSelectedReserve] = useState<string>(initUrl.get('reserve'))
    const [selectedRank, setSelectedRank] = useState<string>(initUrl.get('rank'))
    const [selectedMedium, setSelectedMedium] = useState<string>(initUrl.get('medium'))
    const [selectedStatus, setSelectedStatus] = useState<string>(initUrl.get('status'))
    // 過去に担当した営業名で絞り込むための、該当顧客IDの一覧。
    // 以前は架電・面談ログを全件ブラウザに載せて部分一致を取っていたが、
    // ログだけで約30MBあり、サーバー側が memory_limit を超えて応答できなくなっていた。
    // 検索は past_staff_search API に任せ、ここではIDだけを持つ。
    const [pastCustomerIds, setPastCustomerIds] = useState<string[]>([]);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [callStatus, setCallStatus] = useState<string>(initUrl.get('callStatus'));
    const [activePage, setActivePage] = useState<number>(initUrl.page);
    const [sliceStart, setSliceStart] = useState<number>((initUrl.page - 1) * initUrl.perPage);
    const [basicLength, setBasicLength] = useState<number>(initUrl.perPage);
    const [trash, setTrash] = useState<number>(initUrl.trash);
    const { token } = useContext(AuthContext);
    const [familyList, setFamilyList] = useState<string[]>([]);
    const [familyStatus, setFamilyStatus] = useState<boolean>(initUrl.get('family') === '1');
    const skipPageReset = useRef(false);
    const [integrate, setIntegrate] = useState<CustomerList>({});
    const [integrateList, setIntegrateList] = useState<CustomerList[]>([]);
    const [callStatusShow, setCallStatusShow] = useState(false);
    const [selectedFollow, setSelectedFollow] = useState(initUrl.get('follow'));

    const [pastCustomerShow, setPastCustomerShow] = useState(false);

    const nameSearch = useDebounce(initUrl.get('name'), 300);
    const kanaSearch = useDebounce(initUrl.get('kana'), 300);
    const staffSearch = useDebounce(initUrl.get('staffText'), 300);
    const phoneSearch = useDebounce(initUrl.get('phone'), 300);
    const addressSearch = useDebounce(initUrl.get('address'), 300);
    const mailSearch = useDebounce(initUrl.get('mail'), 300);
    // 過去担当者の検索は入力のたびにAPIを叩くため、他の検索と同じくデバウンスする
    const pastStaffSearch = useDebounce(initUrl.get('pastStaff'), 300);
    /**
     * v2.2.288 入居希望地（planned_construction_site・_2・_3）で検索。
     * ⚠️ 入力欄は areaSearch（300ms 待つ）。⚠️ 確定した値を selectedArea に入れ、絞り込みは selectedArea で行う
     *   （次のブランチで GET の引数にそのまま使うため）。
     */
    const areaSearch = useDebounce(initUrl.get('area'), 300);
    const [selectedArea, setSelectedArea] = useState(initUrl.get('area'));
    useEffect(() => { setSelectedArea(areaSearch.debouncedValue); }, [areaSearch.debouncedValue]);

    /**
     * v2.2.289 顧客を1ページずつ ② から GET で読む（request database_list。② の features/database/list.ts）。
     * ⚠️ 絞り込み・並べ替え・ページ分けは ② が行い、画面は今のページの行（pageRows）と件数（serverTotal）だけを持つ。
     * ⚠️ 条件・ページ・表示件数・非表示リストの state が変わったら取り直す（listParams・activePage・basicLength）。
     * ⚠️⚠️ ② に届かないとき（① に PHP が無い）は serverMode を false にして、今までどおり全件を POST（request database。
     *   ① の予備あり）で読み、下の filteredDatabase で絞り込む。⚠️ filteredDatabase と ② の絞り込みは同じ条件にしてある（片方だけ直さない）。
     */
    const [serverMode, setServerMode] = useState(true);
    const [pageRows, setPageRows] = useState<CustomerList[]>([]);
    /** v2.2.296 商談・架電記録から検索する語（⚠️ ボタンで決めた値。ほかの条件と一緒に ② に送る）と、今のページの当たった記録 */
    const [recordSearch, setRecordSearch] = useState(initUrl.get('record'));
    const [pageRecords, setPageRecords] = useState<RecordMap>({});
    const [serverTotal, setServerTotal] = useState(0);
    const [listLoading, setListLoading] = useState(false);
    /** 取り直すきっかけ（編集を閉じた・非表示に切り替えた・名寄せをしたあと） */
    const [listReloadKey, setListReloadKey] = useState(0);
    /** 古い応答で新しい条件の結果を上書きしない */
    const listSeqRef = useRef(0);
    /** 選択肢（担当・店舗・媒体）を読み込み済みか（⚠️ 最初の1回だけ master=1 で取る） */
    const mastersLoadedRef = useRef(false);
    const reloadList = () => setListReloadKey((k) => k + 1);

    const isSp = useIsSp();

    /**
     * 担当営業の選択肢。⚠️ 条件と並び順は databaseUtils.ts の staffOptionsOf を見ること。
     * ⚠️ `thisYear` は**年度**（6月始まり）。暦年で比べると候補が0件になる。
     */
    const staffOptions = useMemo(
        () => staffOptionsOf(staffArray, selectedShop, thisYear, sortStaff),
        [staffArray, selectedShop]
    );

    const formate = (value: string) => {
        return (value ?? '').replace(/-/g, '/');
    };

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/\//g, '-');
    };

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
    }, []);

    // ⚠️ v2.2.289 全件の読み込みは、② に届かなかったとき（serverMode が false）だけ
    useEffect(() => {
        if (serverMode) return;
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'database', category });

                const customers = prepareCustomers(response.data.customer);
                setOriginalDatabase(customers);

                await setShopArray(response.data.shop.filter((item: shopList) => !item.shop.includes('店舗未設定')));
                await setMediumArray(response.data.medium.map(item => item.medium));
                await setDisplayLength(customers.length);
                await setStaffArray(response.data.staff);

                const familyId = response.data.family.map(f => f.id);
                await setFamilyList(familyId);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [serverMode]);

    // 過去に担当した営業名で該当する顧客IDを取ってくる。
    // 検索語が空のときはAPIを呼ばず、絞り込み自体を無効にする。
    useEffect(() => {
        const staff = pastStaffSearch.debouncedValue;

        // ⚠️ v2.2.289 ② で読むときは ② が過去担当でも絞る（ここでは呼ばない）
        if (serverMode || !staff) {
            setPastCustomerIds([]);
            return;
        }

        // 入力を打ち替えている間は複数のリクエストが並ぶ。
        // 古い応答が後から届いて新しい検索結果を上書きしないよう、
        // 検索語が変わった時点で前のリクエストの結果を捨てる。
        let ignore = false;

        (async () => {
            try {
                const response = await apiClient.post("", { request: 'past_staff_search', staff });
                if (!ignore) setPastCustomerIds(response.data.ids ?? []);
            } catch (error) {
                console.error("Error searching past staff:", error);
                if (!ignore) setPastCustomerIds([]);
            }
        })();

        return () => { ignore = true; };
    }, [pastStaffSearch.debouncedValue, serverMode]);

    // ⚠️ v2.2.271: 家族の有無も集合で引く（以前は familyList.includes で総当たり）
    const familyIdSet = useMemo(() => new Set(familyList), [familyList]);

    // includes() だと顧客数×ID数の総当たりになるため、集合にしてから引く
    const pastCustomerIdSet = useMemo(() => new Set(pastCustomerIds), [pastCustomerIds]);

    const strIncludes = (val: any, sub: string) => (sub ? String(val ?? '').includes(sub) : true);
    const arrIncludes = (arr: any, v: any) => (v ? (Array.isArray(arr) ? arr.includes(v) : String(arr ?? '').includes(v)) : true);

    const filteredDatabase = useMemo(() => {
        // 💡 パフォーマンス最適化: 検索キーワードの正規化（スペース除去＆平仮名変換）は filter の外で1度だけ実行する
        const cleanFormattedName = nameSearch.debouncedValue.replace(/[\s\u3000]+/g, '');
        const normalizedKanaSearch = kataToHira(kanaSearch.debouncedValue.replace(/[\s\u3000]+/g, ''));
        // v2.2.288 入居希望地は空白を無視して比べる（住所の検索と同じ）
        const cleanArea = selectedArea.replace(/[\s\u3000]+/g, '');

        const result = originalDatabase.filter(item => {
            return (trash === 1 ? (Number(item.trash) ?? 0) !== 0 : true)
                && (trash === 0 ? (Number(item.trash) ?? 0) !== 1 : true)
                && (selectedShop ? arrIncludes(item.shop, selectedShop) : true)
                // ⚠️ セレクトは1人を選ぶので**完全一致**。部分一致にすると
                //   同姓の担当者を分けるという目的が果たせない
                && (selectedStaff ? (item.staff ?? '') === selectedStaff : true)
                && (selectedRegister ? strIncludes(item.register, dateFormate(selectedRegister)) : true)
                && (selectedReserve === 'notVisited'
                    ? ((item.reserved_interview ?? '') !== '' && (item.interview ?? '') === '')
                    : (selectedReserve ? strIncludes(item.interview, dateFormate(selectedReserve)) : true))
                && (selectedRank ? arrIncludes(item.rank, selectedRank) : true)
                && (selectedMedium === 'SUUMO(ポータル反響)' ? item.portal_site === 'SUUMO' : selectedMedium ? arrIncludes(item.medium, selectedMedium) : true)
                && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
                // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象
                && (nameSearch.debouncedValue ? (strIncludes(item._cleanCustomer, cleanFormattedName) || strIncludes(cleanCustomerName(item.customer_2), cleanFormattedName)) : true)
                // 💡 修正: 正規化されたデータ同士で比較する
                // ⚠️ v2.2.271: _kana は prepareCustomers が読み込み時に作る。⚠️ 名寄せ（IntegrateModal）のあとの行には無いので、その場で作る
                && (kanaSearch.debouncedValue ? strIncludes(item._kana ?? kanaKey(item.customer_contacts_name_kana), normalizedKanaSearch) : true)
                && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
                && (phoneSearch.debouncedValue ? (strIncludes(item.phone_number, phoneSearch.debouncedValue) || strIncludes(item.phone_number_2, phoneSearch.debouncedValue)) : true)
                && (mailSearch.debouncedValue ? (strIncludes(item.mail, mailSearch.debouncedValue) || strIncludes(item.mail_2, mailSearch.debouncedValue)) : true)
                && (addressSearch.debouncedValue ? String((item.full_address ?? '').replace(/[\s ]+/g, "")).includes(addressSearch.debouncedValue) : true)
                && (cleanArea ? plannedSites(item).some((site) => site.replace(/[\s\u3000]+/g, '').includes(cleanArea)) : true)
                && (callStatus ? (item.call_status ?? '') === callStatus : true)
                && (familyStatus ? familyIdSet.has(item.id) : true)
                && (pastStaffSearch.debouncedValue ? pastCustomerIdSet.has(item.id) : true)
                && (selectedFollow === '追客中' ? arrIncludes(['Aランク', 'Bランク', 'Cランク', 'Dランク'], item.rank) : selectedFollow === '追客終了' ? arrIncludes(['Eランク', 'Fランク', 'Gランク', 'Hランク'], item.rank) : true)
                && (pastStaffSearch.debouncedValue ? pastCustomerIdSet.has(item.id) : true); // ※既存コードにあった重複の記述をそのまま残しています
        });

        return result.sort((a, b) => {
            const dateA = a.register || "";
            const dateB = b.register || "";
            return dateB.localeCompare(dateA);
        });
    }, [
        originalDatabase,
        selectedShop,
        selectedStaff,
        selectedRegister,
        selectedReserve,
        selectedRank,
        selectedMedium,
        selectedStatus,
        selectedFollow,
        nameSearch.debouncedValue,
        kanaSearch.debouncedValue,
        staffSearch.debouncedValue,
        phoneSearch.debouncedValue,
        addressSearch.debouncedValue,
        mailSearch.debouncedValue,
        selectedArea,
        callStatus,
        pastStaffSearch.debouncedValue,
        trash,
        familyList,
        familyStatus,
        pastCustomerIdSet
    ]);

    const normalize = (val?: string | null) => (val || '').replace(/[\s ]+/g, '');

    const duplicateDictionary = useMemo(() => {
        const dict: Record<string, string[]> = {};

        originalDatabase.forEach(item => {

            const emails = [normalize(item.mail), normalize(item.mail_2)].filter(Boolean);
            emails.forEach(email => {
                if (!dict[email]) dict[email] = [];
                if (!dict[email].includes(item.id)) dict[email].push(item.id);
            });

            const phones = [normalize(item.phone_number), normalize(item.phone_number_2)].filter(Boolean);
            phones.forEach(phone => {
                if (!dict[phone]) dict[phone] = [];
                if (!dict[phone].includes(item.id)) dict[phone].push(item.id);
            });

        });

        return dict;
    }, [originalDatabase]);


    /** v2.2.289 ② に送る条件（⚠️ 空の条件は送らない） */
    const listParams = useMemo(() => Object.fromEntries(Object.entries({
        trash: String(trash),
        shop: selectedShop, staff: selectedStaff, register: selectedRegister, reserve: selectedReserve, rank: selectedRank,
        medium: selectedMedium, status: selectedStatus, follow: selectedFollow, callStatus, family: familyStatus ? '1' : '',
        name: nameSearch.debouncedValue, kana: kanaSearch.debouncedValue, staffText: staffSearch.debouncedValue,
        pastStaff: pastStaffSearch.debouncedValue, phone: phoneSearch.debouncedValue, mail: mailSearch.debouncedValue,
        address: addressSearch.debouncedValue, area: selectedArea, record: recordSearch,
    }).filter(([, v]) => v !== '')), [
        trash, selectedShop, selectedStaff, selectedRegister, selectedReserve, selectedRank, selectedMedium, selectedStatus,
        selectedFollow, callStatus, familyStatus, nameSearch.debouncedValue, kanaSearch.debouncedValue, staffSearch.debouncedValue,
        pastStaffSearch.debouncedValue, phoneSearch.debouncedValue, mailSearch.debouncedValue, addressSearch.debouncedValue, selectedArea,
        recordSearch,
    ]);

    /**
     * 条件・表示件数が変わったら1ページ目へ（⚠️ v2.2.289 で表示件数・ふりがなも対象にした）。
     * ⚠️ v2.2.291 条件が実際に変わったときだけ戻す（URL の page で開いたときに1へ戻さないため。予備のときは全件・家族の読み込みも対象）。
     */
    useOnListChange(`${JSON.stringify(listParams)}|${basicLength}`, [originalDatabase, familyList], () => {
        if (skipPageReset.current) {
            skipPageReset.current = false;
            return;
        }
        setActivePage(1);
        setSliceStart(0);
    });

    /** v2.2.291 送る条件・ページ・表示件数を画面の URL にも出す */
    useListUrlSync(listParams, activePage, basicLength);

    /**
     * v2.2.289 今の条件・ページを ② から GET で読む。
     * ⚠️ setTimeout(0) で1回にまとめる（条件を変えると、上の effect がページを1に戻すので、古いページで1回読まないように）。
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
                        ...(mastersLoadedRef.current ? {} : { master: 1 }),
                    },
                });
                if (seq !== listSeqRef.current) return;
                const data = response.data;
                if (!data || data.status !== 'ok') throw new Error('database_list の応答が正しくありません');
                if (Array.isArray(data.shop)) {
                    setShopArray(data.shop.filter((item: shopList) => !item.shop.includes('店舗未設定')));
                    setMediumArray(data.medium.map((item: { medium: string }) => item.medium));
                    setStaffArray(data.staff);
                    mastersLoadedRef.current = true;
                }
                setPageRows(prepareCustomers(data.customer));
                setPageRecords(data.record ?? {});
                setServerTotal(Number(data.total) || 0);
                setDisplayLength(Number(data.total) || 0);
                // ⚠️ ページが件数より後ろなら、② が最後のページに寄せて返す。画面もそれに合わせる
                if (Number(data.page) !== activePage) {
                    setActivePage(Number(data.page));
                    setSliceStart((Number(data.page) - 1) * basicLength);
                }
            } catch (error) {
                if (seq !== listSeqRef.current) return;
                console.error('database_list に失敗しました。全件の読み込みに切り替えます:', error);
                setServerMode(false);
            } finally {
                if (seq === listSeqRef.current) setListLoading(false);
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [serverMode, category, listParams, activePage, basicLength, listReloadKey]);

    /** 表に出す行と件数（⚠️ ② で読むときは今のページの行。予備のときは画面で絞った結果を切る） */
    const visibleRows = serverMode ? pageRows : filteredDatabase.slice(sliceStart, sliceStart + basicLength);
    const totalCount = serverMode ? serverTotal : filteredDatabase.length;
    /** v2.2.296 商談・架電記録から検索しているか（⚠️ 真のときだけ「商談・架電内容」の列を出す） */
    const recordMode = isRecordSearch(recordSearch, serverMode);

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
                    // ⚠️ v2.2.289 ② で読むときは今のページを読み直す（① が返す全件は使わない）
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
        // ⚠️ v2.2.291 URL の ?id= だけを外す（残すと、URL の条件を書き直したときに編集がまた開く。条件は残す）
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('id');
        setSearchParams(nextParams, { replace: true });
        // ⚠️ v2.2.289 ② で読むときは今のページを読み直すだけ（ページは変えない）。
        //   ⚠️ skipPageReset を立てない（立てると、次に条件を変えたときにページが1に戻らない）
        if (serverMode) {
            reloadList();
            return;
        }
        const prevPage = activePage;

        skipPageReset.current = true;

        const fetchData = async () => {
            const response = await apiClient.post("", { request: 'database', category });
            setOriginalDatabase(prepareCustomers(response.data.customer));
        }

        await fetchData();
        setActivePage(prevPage);
    };

    const integrationCustomer = async (customer: Record<string, string>) => {
        setIntegrate(customer);

        // ⚠️ v2.2.289 ② で読むときは全件を持っていないので、② に候補を頼む（条件は下と同じ）
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

        const customerMails = [customer.mail, customer.mail_2].filter(Boolean);
        const customerPhones = [customer.phone_number, customer.phone_number_2].filter(Boolean);

        const filteredDuplicate = originalDatabase.filter(o => {
            if (o.id === customer.id) return false; // 自分自身は除外

            const targetMails = [o.mail, o.mail_2].filter(Boolean);
            const targetPhones = [o.phone_number, o.phone_number_2].filter(Boolean);

            const hasDuplicateMail = customerMails.some(mail => targetMails.includes(mail));

            const hasDuplicatePhone = customerPhones.some(phone => targetPhones.includes(phone));

            return hasDuplicateMail || hasDuplicatePhone;
        });

        setIntegrateList(filteredDuplicate);
    };


    return (
        <>
            <RankingStyle />
            <style>{DBK_CSS}</style>
            <style>{RECORD_CSS}</style>
            <div className='content database bg-white rk_wrap dbk_wrap'>
                <div className="rk_head">
                    <span className="rk_title">顧客DB（建売分譲事業）</span>
                </div>
                <div className='rk_bar dbk_bar'>
                    <div className="m-1">
                        <select
                            className="target"
                            value={selectedShop}
                            onChange={(e) => {
                                // ⚠️ 店舗を変えたら担当営業を外す。別の店舗の担当者が
                                //   残ると、条件に合う顧客が無く**0件**になる
                                setSelectedStaff('');
                                setSelectedShop(e.target.value);
                            }}
                        >
                            <option value="">店舗を選択</option>
                            {shopArray.map((item, index) => <option key={index} value={item.shop}>{item.shop}</option>)}
                        </select>
                    </div>
                    {/* ⚠️ 店舗を選んだときだけ出す（指示）。色を付けて他と見分けられるようにしている */}
                    {selectedShop && (
                        <div className="m-1">
                            <select
                                className="target"
                                value={selectedStaff}
                                style={{
                                    backgroundColor: selectedStaff ? '#2563eb' : '#eff6ff',
                                    color: selectedStaff ? '#fff' : '#2563eb',
                                    borderColor: '#2563eb',
                                    fontWeight: 700,
                                }}
                                onChange={(e) => setSelectedStaff(e.target.value)}
                            >
                                <option value="">担当営業を選択</option>
                                {staffOptions.map((item, index) =>
                                    <option key={index} value={item.name}>
                                        {item.name}{item.position ? `（${item.position}）` : ''}
                                    </option>)}
                            </select>
                        </div>
                    )}
                    <div className="m-1">
                        <select className="target" value={selectedRegister} onChange={(e) => setSelectedRegister(e.target.value)}>
                            <option value="">反響月を選択</option>
                            {descending(monthArray).map((item, index) => <option key={index} value={item}>{item}</option>)}
                        </select>
                    </div>
                    {!isSp && <>
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
                            <option value="Fランク">Fランク</option>
                        </select>
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <select className="target" value={selectedMedium} onChange={(e) => setSelectedMedium(e.target.value)}>
                                <option value="">販促媒体を選択</option>
                                {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
                                {authority !== 'ordinary' && <option value='SUUMO(ポータル反響)'>SUUMO(ポータル反響)</option>}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                                <option value="">ステータスを選択</option>
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
                            <select className="target" value={callStatus} onChange={(e) => {
                                setCallStatus(e.target.value);
                            }}>
                                <option value="">架電状況</option>
                                {/* ⚠️ v2.2.293 選択肢は DB（call_status）から。⚠️ URL で開いた値が非表示でも残す */}
                                {withCurrent(callStatusOptions.statuses, callStatus).map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={selectedFollow} onChange={(e) => {
                                setSelectedFollow(e.target.value)
                            }}>
                                <option value="">追客状況</option>
                                <option value="追客中">追客中</option>
                                <option value="追客終了">追客終了</option>
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
                        <input className="target" placeholder='顧客名で検索'
                            value={nameSearch.inputValue} onChange={nameSearch.onChange} />
                    </div>
                    <div className="m-1">
                        <input className="target" placeholder='顧客名(ふりがな)で検索'
                            value={kanaSearch.inputValue} onChange={kanaSearch.onChange} />
                    </div>
                    <div className="m-1">
                        <input className="target" placeholder='営業名で検索'
                            value={staffSearch.inputValue} onChange={staffSearch.onChange} />
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <input className="target" placeholder='過去に担当した営業名で検索'
                                value={pastStaffSearch.inputValue} onChange={pastStaffSearch.onChange} />
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
                                value={addressSearch.inputValue} onChange={addressSearch.onChange} />
                        </div>
                        <div className="m-1">
                            <input className="target" placeholder='入居希望地で検索'
                                value={areaSearch.inputValue} onChange={areaSearch.onChange} />
                        </div>
                    </>}
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
                        <RecordSearchCard value={recordSearch} onSearch={setRecordSearch} disabled={!serverMode} loading={listLoading} />
                        {!isSp && <>
                            {trash === 1 && <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setTrash(0)}>非表示リストへ移動</button>}
                            {trash === 0 && <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setTrash(1)}>一覧へ戻る</button>}
                            <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setCallStatusShow(true)}>架電状況集計</button>
                        </>}
                    </div>
                </div>
                <div className="w-100 mb-1">
                    <GiftLegend />
                </div>
                <div className="w-100 dbk_table_wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ width: `${2020 + (recordMode ? RECORD_COL_WIDTH : 0)}px` }}>{/* v2.2.288 入居希望地の列のぶん広げた（1900px → 2020px） */}
                        {/* ⚠️ v2.2.290 縞模様（striped）は外した。罫線・見出しの色は DBK_CSS の dbk_table */}
                        <Table className='dbk_table' style={{ fontSize: isSp ? '9px' : '12px', textAlign: 'center' }} bordered>
                            <tbody className='align-middle'>
                                <tr className='align-middle sticky-header'>
                                    {/* ⚠️ v2.2.289 左の4列（編集・店舗・顧客名・担当営業）は横に動かしても残す（dbk_fix。CSS は databaseListStyle.ts の DBK_CSS） */}
                                    <td className='dbk_fix dbk_fix1'>顧客情報編集</td>
                                    <td className='dbk_fix dbk_fix2'>店舗</td>
                                    <td className='dbk_fix dbk_fix3'>顧客名<br /><span className='text-success fw-bold'><i className="fa-solid fa-user-plus pe-1"></i>重複顧客</span></td>
                                    <td className='dbk_fix dbk_fix4'>担当営業</td>
                                    {recordMode && <td>商談・架電内容</td>}
                                    <td>ステータス</td>
                                    <td>反響日</td>
                                    <td>初回面談</td>
                                    <td>ランク</td>
                                    <td>反響経路</td>
                                    <td>販促媒体</td>
                                    <td>住所</td>
                                    <td>連絡先①</td>
                                    <td>連絡先②</td>
                                    <td>架電状況</td>
                                    <td>架電件数</td>
                                    <td>入居希望地</td>
                                    <td>{trash === 1 ? '非表示' : '元に戻す'}</td>
                                </tr>
                                {visibleRows
                                    .map(item => {
                                        const targetEmails = [normalize(item.mail), normalize(item.mail_2)].filter(Boolean);
                                        const targetPhones = [normalize(item.phone_number), normalize(item.phone_number_2)].filter(Boolean);

                                        // ⚠️ v2.2.289 ② で読むときは ② が全顧客で調べた印（duplicate）を使う
                                        const isDuplicate = serverMode ? Number(item.duplicate) === 1 : (
                                            targetEmails.some(email => (duplicateDictionary[email] || []).some(id => id !== item.id)) ||
                                            targetPhones.some(phone => (duplicateDictionary[phone] || []).some(id => id !== item.id)));
                                        return <tr key={item.id}>
                                            <td className='dbk_fix dbk_fix1'><button type="button" className='dbk_edit' onClick={() => setEditId(item.id)}>編集</button></td>
                                            <td className='dbk_fix dbk_fix2'>{item.shop}</td>
                                            {/* ⚠️ v2.2.187: 氏名②があるときだけ「アイコン（縦中央）／氏名①・氏名②の2行」 */}
                                            <td className='dbk_fix dbk_fix3'><CustomerNameCell
                                                icons={<>
                                                    <GiftDot gift={item.gift} />
                                                    {(isDuplicate && item.integration) && <span style={{ cursor: 'pointer' }}
                                                        onClick={() => integrationCustomer(item)}><i className="fa-solid fa-user-plus pe-1 text-success"></i></span>}
                                                </>}
                                                name={item.customer ?? ''}
                                                name2={item.customer_2} /></td>
                                            <td className='dbk_fix dbk_fix4'>{item.staff ?? ''}</td>
                                            {recordMode && <RecordCell group={pageRecords[item.id ?? '']} />}
                                            <td>{item.status ?? ''}</td>
                                            <td>{formate(item.register)}</td>
                                            <td>{formate(item.interview) || formate(item.tour)}</td>
                                            <td>{(item.rank ?? '').replace('ランク', '')}</td>
                                            <td>{item.hp_campaign}</td>
                                            <td>{item.medium}</td>
                                            <td style={{ textAlign: 'left' }}>{item.full_address}</td>
                                            <td style={{ textAlign: 'left' }}>{item.mail}<br />{item.phone_number}</td>
                                            <td style={{ textAlign: 'left' }}>{item.mail_2}<br />{item.phone_number_2}</td>
                                            <td>{item.call_status}</td>
                                            <td>{item.call_log || '0'}</td>
                                            {/* v2.2.288 入居希望地。⚠️ 値のある欄だけを、2つ以上なら改行して縦に並べる */}
                                            <td style={{ textAlign: 'left' }}>{plannedSites(item).map((site, i) => <React.Fragment key={i}>{i > 0 && <br />}{site}</React.Fragment>)}</td>
                                            <td style={{ cursor: 'pointer' }} onClick={() => handleGarbage(item.id, item.customer)}>{trash === 1 ? <i className="fa-solid fa-ban"></i> : <i className="fa-solid fa-rotate-left"></i>}</td>
                                        </tr>
                                    })}
                            </tbody>
                        </Table>
                    </div>

                </div>
            </div>
            <PastCustomer pastCustomerShow={pastCustomerShow} setPastCustomerShow={setPastCustomerShow} />
            {/* ⚠️ v2.2.289 ② で読むときは、名寄せのあとに ① が返す全件は使わず、今のページを読み直す */}
            <IntegrateModal integrate={integrate} setIntegrate={setIntegrate} integrateList={integrateList} setIntegrateList={setIntegrateList}
                setOriginalDatabase={serverMode ? () => reloadList() : setOriginalDatabase} />
            <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
            <CallStatusList
                callStatusShow={callStatusShow}
                setCallStatusShow={setCallStatusShow}
            />
        </>
    )
}

export default DatabaseKaeru
