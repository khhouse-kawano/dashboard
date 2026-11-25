import React, { useEffect, useState, useContext, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Table from "react-bootstrap/Table";
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import SurveyList from '../Survey';
import CancelList from '../CancelList';
import CallStatusList from '../header/callStatus/CallStatusList';
import LostStatusList from '../LostStatusList';
import InformationEdit from '../information/InformationEdit';
import { useIsSp } from '../../utils/isSp';
import { useDebounce } from './useDebounce';
import apiClient from '../../utils/apiClient';
import { safeParse, hotleadStyle, staffOptionsOf, decodeRows, hotleadActions } from './databaseUtils';
import type { HotleadActions } from './databaseUtils';
import { GiftDot, GiftLegend } from './GiftMark';
import { thisYear } from '../../utils/thisYear';
import { missingLostFields } from '../../utils/informationUtils';
import { isDelete } from '../../utils/deletedCustomer';
// ⚠️ 役職→社員番号の並びを借りている。同じ並びを2箇所に書くと片方だけ腐る
import { sortStaff } from '../header/ambassador/useAmbassadorMaster';
import NexusBadge from '../NexusBadge';
import { isNexusRow } from '../../utils/nexusUtils';
import { CustomerNameCell, cleanCustomerName } from './customerName2';
import { descending } from '../../utils/descending';
// ⚠️ v2.2.291 見た目を建売の顧客DB（DatabaseKaeru.tsx）とそろえる（rk_ と DBK_CSS を借りる）。GET の条件を画面の URL にも出す
import { RankingStyle } from '../rankingUi';
import { DBK_CSS } from './databaseListStyle';
import { readListUrl, useListUrlSync, useOnListChange } from './listUrl';
import { isRecordSearch, RecordCell, RECORD_COL_WIDTH, RECORD_CSS, recordErrorOf, RecordSearchCard, type RecordMap } from './recordSearch';
import { useCallStatusOptions, withCurrent } from './callStatusOptions';

/** v2.2.297 キャンセル集計・失注集計のボタンの中の「要回答」の札（赤） */
const DUE_CSS = `
.dbo_due { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: #dc3545; color: #fff; font-size: 10px; font-weight: 700; line-height: 1.6; vertical-align: 1px; }
`;

// --- 型定義 ---
type ShopList = { brand: string; shop: string; section: string };
/** 担当営業。⚠️ サーバーは `SELECT * FROM staff_list WHERE rank = 1` を返している */
type StaffList = {
    name: string; shop: string; section: string; position: string;
    period: string; category: number | string; khg_id: string; status: string;
};
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
    /** ポータルサイト名（SUUMO など）。v2.2.281。反響一覧から取り込んだときに付く。ポータル以外は空 */
    portal_site?: string;
    status?: string;
    customer?: string;
    /** 氏名②（customer_contacts_name_2）。⚠️ v2.2.187 追加。⚠️ 値があるときだけ顧客名の2行目に出す・名前検索の対象 */
    customer_2?: string;
    /** フリガナ。⚠️ Nexus アイコンの判定にだけ使う（検索には使っていない） */
    customer_contacts_name_kana?: string;
    staff?: string;
    phone_number?: string;
    /**
     * メールアドレス。
     * ⚠️⚠️ **2026-09-30 に返すようにした列**（v2.2.154）。
     *   ⚠️ ⚠️ **①② の両方のSQLに入っていないと undefined になり、検索が常に0件になる。**
     */
    mail?: string;
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
/**
 * 大文字小文字を区別しない部分一致。
 *
 * ⚠️⚠️ **メールアドレスの検索にだけ使う**（2026-09-30 / v2.2.154）。
 *   ⚠️ ⚠️ **他の検索欄は区別する作りのまま。** ⚠️ 勝手に揃えないこと。
 *   ⚠️ メールは台帳に `Taro@…` と `taro@…` が混在するため、
 *     ⚠️ **区別すると「あるはずの顧客が出ない」という形で外れる。**
 */
const strIncludesCI = (val: any, sub: string) =>
    sub ? String(val ?? '').toLowerCase().includes(sub.toLowerCase()) : true;
const arrIncludes = (arr: any, v: any) => v ? (Array.isArray(arr) ? arr.includes(v) : String(arr ?? '').includes(v)) : true;

/**
 * 応答の顧客一覧を画面用にする（検索用の列を先に作っておく）。
 * ⚠️ v2.2.271: ② は「列名1回＋値の並び」、① は配列で返す。decodeRows がどちらも配列にする。
 * ⚠️ 非表示・元に戻す（handleGarbage）のあとも必ずここを通す（以前は通しておらず、その後の名前・住所の検索が効かなかった）。
 */
const prepareCustomers = (data: unknown): CustomerItem[] =>
    decodeRows<CustomerItem>(data).map(c => ({
        ...c,
        search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
        _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '')
    }));

/** 表の Hotlead 欄に出すもの（v2.2.271: 読み込み時に1回だけ作り、id で引く） */
type HotleadInfo = { status: string; url: string; reason: string; actions: HotleadActions | null };
const EMPTY_HOTLEAD: HotleadInfo = { status: '', url: '', reason: '', actions: null };


const DatabaseOrder = ({ onReload }: Props) => {
    const { authority, category, token } = useContext(AuthContext);
    /** v2.2.293 架電状況の選択肢（DB の call_status。② に届かないときは今までの固定の選択肢） */
    const callStatusOptions = useCallStatusOptions(category);
    /** v2.2.291 開いたときの URL の条件（⚠️ 下の state の初期値にだけ使う） */
    const [initUrl] = useState(() => readListUrl(new URLSearchParams(window.location.search)));

    // データリスト関連
    const [originalDatabase, setOriginalDatabase] = useState<CustomerItem[]>([]);
    const [shopArray, setShopArray] = useState<ShopList[]>([]);
    const [staffArray, setStaffArray] = useState<StaffList[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [familyList, setFamilyList] = useState<Record<string, any>[]>([]);
    const [introductoryList, setIntroductoryList] = useState<string[]>([]);
    const [eventList, setEventList] = useState<Record<string, any>[]>([]);
    const [hotleadList, setHotledList] = useState<Record<string, any>[]>([]);

    // 検索・フィルター条件
    const [selectedShop, setSelectedShop] = useState<string>(initUrl.get('shop'));
    /**
     * セレクトで選んだ担当営業。
     * ⚠️ テキスト検索（staffSearch）とは別に持つ。あちらは部分一致で、
     *   同姓の担当者が増えたため1人を選べるようにした（指示）。
     */
    const [selectedStaff, setSelectedStaff] = useState<string>(initUrl.get('staff'));
    const [selectedRegister, setSelectedRegister] = useState<string>(initUrl.get('register'));
    const [selectedReserve, setSelectedReserve] = useState<string>(initUrl.get('reserve'));
    const [selectedRank, setSelectedRank] = useState<string>(initUrl.get('rank'));
    const [selectedMedium, setSelectedMedium] = useState<string>(initUrl.get('medium'));
    const [selectedIntroductory, setSelectedIntroductory] = useState<string>(initUrl.get('introductory'));
    const [selectedStatus, setSelectedStatus] = useState<string>(initUrl.get('status'));
    const [searchedEvent, setSearchedEvent] = useState<string>(initUrl.get('event'));
    const [callStatus, setCallStatus] = useState<string>(initUrl.get('callStatus'));
    const [trash, setTrash] = useState<number>(initUrl.trash);
    const [familyStatus, setFamilyStatus] = useState<boolean>(initUrl.get('family') === '1');
    const [snapStatus, setSnapStatus] = useState(initUrl.get('snap') === '1');
    const [hotleadStatus, sethotleadStatus] = useState(initUrl.get('hotlead'));

    // 表示・ページネーション
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [activePage, setActivePage] = useState<number>(initUrl.page);
    const [sliceStart, setSliceStart] = useState<number>((initUrl.page - 1) * initUrl.perPage);
    const [basicLength, setBasicLength] = useState<number>(initUrl.perPage);

    // モーダル・集計表示制御
    const [callStatusShow, setCallStatusShow] = useState(false);
    const [surveyShow, setSurveyShow] = useState(false);
    const [cancelListShow, setCancelListShow] = useState(false);
    const [loseListShow, setLoseListShow] = useState(false);
    const [cancelLength, setCancelLength] = useState<number>(0);
    const [loseLength, setLoseLength] = useState<number>(0);
    const [editId, setEditId] = useState('');

    // カスタムフック・URLパラメータ
    const nameSearch = useDebounce(initUrl.get('name'), 300);
    const staffSearch = useDebounce(initUrl.get('staffText'), 300);
    const phoneSearch = useDebounce(initUrl.get('phone'), 300);
    const addressSearch = useDebounce(initUrl.get('address'), 300);
    /** ⚠️ メールアドレス。⚠️ **大文字小文字を区別しない**（strIncludesCI） */
    const mailSearch = useDebounce(initUrl.get('mail'), 300);
    const familySearch = useDebounce(initUrl.get('familyName'), 300);
    const isSp = useIsSp();

    /**
     * v2.2.291 顧客を1ページずつ ② から GET で読む（request database_list。② の features/database/list.ts の runOrderList）。
     * ⚠️ 絞り込み・並べ替え・ページ分けは ② が行い、画面は今のページの行（pageRows）と件数（serverTotal）だけを持つ。
     * ⚠️ Hotlead は今のページの分だけ、キャンセル・失注の要回答の件数は最初の1回（master=1）に ② が返す。
     * ⚠️⚠️ ② に届かないときは serverMode を false にして、今までどおり全件を POST（request database。① の予備あり）で読み、
     *   下の filteredDatabase で絞り込む。⚠️ filteredDatabase と ② の絞り込みは同じ条件にしてある（片方だけ直さない）。
     */
    const [serverMode, setServerMode] = useState(true);
    const [pageRows, setPageRows] = useState<CustomerItem[]>([]);
    /** v2.2.296 商談・架電記録から検索する語（⚠️ ボタンで決めた値。ほかの条件と一緒に ② に送る）と、今のページの当たった記録 */
    const [recordSearch, setRecordSearch] = useState(initUrl.get('record'));
    const [pageRecords, setPageRecords] = useState<RecordMap>({});
    /** v2.2.297 記録の検索が失敗した理由（⚠️ 失敗しても予備の全件読み込みには切り替えない） */
    const [recordError, setRecordError] = useState('');
    const [serverTotal, setServerTotal] = useState(0);
    const [listLoading, setListLoading] = useState(false);
    /** 取り直すきっかけ（編集を閉じた・非表示に切り替えたあと） */
    const [listReloadKey, setListReloadKey] = useState(0);
    /** 古い応答で新しい条件の結果を上書きしない */
    const listSeqRef = useRef(0);
    /** 選択肢・要回答の件数を読み込み済みか（⚠️ 最初の1回だけ master=1 で取る） */
    const mastersLoadedRef = useRef(false);
    const reloadList = () => setListReloadKey((k) => k + 1);

    /**
     * 担当営業の選択肢。⚠️ 条件と並び順は databaseUtils.ts の staffOptionsOf を見ること。
     * ⚠️ `thisYear` は**年度**（6月始まり）。暦年で比べると候補が0件になる。
     */
    const staffOptions = useMemo(
        () => staffOptionsOf(staffArray, selectedShop, thisYear, sortStaff),
        [staffArray, selectedShop]
    );

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

            const customers = prepareCustomers(response.data.customer);

            setOriginalDatabase(customers);

            if (isInitial) {
                setShopArray(response.data.shop.filter((item: ShopList) => !item.shop.includes('店舗未設定')));
                // ⚠️ これまで使っていなかったが、応答には元から含まれている
                setStaffArray(response.data.staff ?? []);
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
                    // ⚠️ v2.2.271: 個人情報の削除依頼があった顧客は数えない。① ② とも一覧から除いて返すが、念のため画面でも除く
                    if (isDelete(item)) return;

                    const cTarget = new Date(dateFormate(item.reserved_interview)).getTime();
                    if (cTarget < nowTime && cancelBase < cTarget && !item.interview && !item.cancel_status && item.status !== '重複') {
                        cCount++;
                    }

                    const lTarget = new Date(dateFormate(item.register)).getTime();
                    if (lTarget < nowTime && loseBase < lTarget && item.status === '失注') {
                        /**
                         * ⚠️⚠️ **判定は informationUtils の `missingLostFields()` に集約した**
                         *   （2026-09-17）。⚠️ 以前はここに条件が写されており、
                         *   ⚠️ **LostStatusList.tsx と食い違うと件数が合わなかった。**
                         * ⚠️ **ここで条件を書き足さないこと。** 向こうだけ直すと必ずずれる。
                         */
                        if (missingLostFields(item).length > 0) lCount++;
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
    }, []);

    // ⚠️ v2.2.291 全件の読み込みは、② に届かなかったとき（serverMode が false）だけ
    useEffect(() => {
        if (serverMode) return;
        fetchDatabase(true);
    }, [fetchDatabase, serverMode]);

    /**
     * 家族・Hotlead の索引（v2.2.271）。⚠️ 読み込み時に1回だけ作る。
     *   以前は絞り込みのたびに全顧客 × Hotlead（約2,800件）を find で総当たりし、
     *   家族は includes で引いていた（解除のたびに 1.7〜2.5秒止まっていた）。
     */
    const familyIdSet = useMemo(() => new Set(familyList.map(f => f.id)), [familyList]);
    const familyNames = useMemo(() => familyList.flatMap(f => {
        const parsedList = safeParse(f.family_info) || [];
        return parsedList.map((info: any) => ({ name: info.name, id: f.id }));
    }), [familyList]);
    const hotleadMap = useMemo(() => {
        const map = new Map<string, HotleadInfo>();
        hotleadList.forEach(h => {
            // ⚠️ 同じ id が2行あったら、以前の find と同じく最初の行を使う
            if (map.has(h.id)) return;
            map.set(h.id, {
                status: h.status ?? '',
                url: h.hotlead_url ?? '',
                reason: h.ticket_stop_reason_type ?? '',
                actions: hotleadActions(h)
            });
        });
        return map;
    }, [hotleadList]);

    // フィルタリング・ソート処理
    const filteredDatabase = useMemo(() => {
        const sName = nameSearch.debouncedValue ?? '';
        const formattedName = sName.includes('&') ? sName.split('&')[0] : sName.includes('+') ? sName.split('+')[0] : sName;
        const formattedNumber = sName.includes('&') ? sName.split('&')[1] : phoneSearch.debouncedValue ?? '';
        const formattedAddress = sName.includes('+') ? sName.split('+')[1] : '';
        const cleanFormattedName = formattedName.replace(/[\s\u3000]+/g, '');

        const filteredFamilyID = familySearch.debouncedValue
            ? new Set(familyNames.filter(f => f.name.includes(familySearch.debouncedValue)).map(f => f.id))
            : null;

        const hotleadIds = hotleadStatus
            ? new Set(hotleadList.filter(h => h.status === hotleadStatus).map(h => h.id))
            : null;

        // 型安全なmapとsort
        const result = originalDatabase.filter(item => {
            return (trash === 1 ? Number(item.trash ?? 0) !== 0 : true)
                && (trash === 0 ? Number(item.trash ?? 0) !== 1 : true)
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
                && (selectedIntroductory ? arrIncludes(item.introduction_person_category, selectedIntroductory) : true)
                && (selectedStatus ? arrIncludes(item.status, selectedStatus) : true)
                // ⚠️ v2.2.187: 氏名②（customer_2）も名前検索の対象
                && (nameSearch.debouncedValue ? (strIncludes(item._cleanCustomer, cleanFormattedName) || strIncludes(cleanCustomerName(item.customer_2), cleanFormattedName)) : true)
                && (staffSearch.debouncedValue ? strIncludes(item.staff, staffSearch.debouncedValue.split(' ')[0]) : true)
                && ((phoneSearch.debouncedValue || nameSearch.debouncedValue) ? strIncludes(item.phone_number, formattedNumber) : true)
                && (formattedAddress ? strIncludes(item.full_address, formattedAddress) : true)
                && (addressSearch.debouncedValue ? strIncludes(item.search_address, addressSearch.debouncedValue) : true)
                // ⚠️ メールだけ大文字小文字を区別しない（strIncludesCI）
                && (mailSearch.debouncedValue ? strIncludesCI(item.mail, mailSearch.debouncedValue) : true)
                && (filteredFamilyID ? filteredFamilyID.has(item.id) : true)
                && (callStatus ? (item.call_status ?? '') === callStatus : true)
                && (familyStatus ? familyIdSet.has(item.id) : true)
                && (searchedEvent ? (item.event === searchedEvent && item.medium === 'イベント') : true)
                && (snapStatus ? item.k_snap : true)
                && (hotleadIds ? hotleadIds.has(item.hotlead_id) : true);
        });
        // ⚠️ v2.2.271: Hotlead 欄の中身は全行には付けない。表に出す行だけ hotlead() が hotleadMap から引く

        // registerの型エラー解消部分（文字列化して安全に比較）
        return result.sort((a, b) => {
            const dateA = String(a.register ?? "");
            const dateB = String(b.register ?? "");
            return dateB.localeCompare(dateA);
        });
    }, [
        originalDatabase, selectedShop, selectedStaff, selectedRegister, selectedReserve,
        selectedRank, selectedMedium, selectedStatus, nameSearch.debouncedValue,
        staffSearch.debouncedValue, phoneSearch.debouncedValue, callStatus, addressSearch.debouncedValue,
        // ⚠️⚠️ **入れ忘れると、入力しても一覧が絞り込まれない**
        mailSearch.debouncedValue,
        familySearch.debouncedValue, selectedIntroductory, trash, familyIdSet, familyNames, familyStatus,
        snapStatus, searchedEvent, hotleadStatus, hotleadList
    ]);

    /** v2.2.291 ② に送る条件（⚠️ 空の条件は送らない。キーは URL にもそのまま出る） */
    const listParams = useMemo(() => Object.fromEntries(Object.entries({
        trash: String(trash),
        shop: selectedShop, staff: selectedStaff, register: selectedRegister, reserve: selectedReserve, rank: selectedRank,
        medium: selectedMedium, introductory: selectedIntroductory, status: selectedStatus, callStatus,
        hotlead: hotleadStatus, family: familyStatus ? '1' : '', snap: snapStatus ? '1' : '', event: searchedEvent,
        name: nameSearch.debouncedValue, staffText: staffSearch.debouncedValue, phone: phoneSearch.debouncedValue,
        mail: mailSearch.debouncedValue, address: addressSearch.debouncedValue, familyName: familySearch.debouncedValue,
        record: recordSearch,
    }).filter(([, v]) => v !== '')), [
        trash, selectedShop, selectedStaff, selectedRegister, selectedReserve, selectedRank, selectedMedium, selectedIntroductory,
        selectedStatus, callStatus, hotleadStatus, familyStatus, snapStatus, searchedEvent, nameSearch.debouncedValue,
        staffSearch.debouncedValue, phoneSearch.debouncedValue, mailSearch.debouncedValue, addressSearch.debouncedValue,
        familySearch.debouncedValue, recordSearch,
    ]);

    /**
     * 条件・表示件数が変わったら1ページ目へ。
     * ⚠️ v2.2.291 以前は絞り込んだ件数が変わったときに戻していた。② で読むと全件は手元に無いので、条件が実際に変わったときに戻す
     *   （URL の page で開いたときは戻さない。予備のときは全件の読み込みも対象）。
     */
    useOnListChange(`${JSON.stringify(listParams)}|${basicLength}`, [originalDatabase], () => {
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
     * v2.2.291 今の条件・ページを ② から GET で読む（DatabaseKaeru.tsx と同じ作り）。
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
                        ...(mastersLoadedRef.current ? {} : { master: 1 }),
                    },
                });
                if (seq !== listSeqRef.current) return;
                const data = response.data;
                if (!data || data.status !== 'ok') throw new Error('database_list の応答が正しくありません');
                if (Array.isArray(data.shop)) {
                    setShopArray(data.shop.filter((item: ShopList) => !item.shop.includes('店舗未設定')));
                    setStaffArray(data.staff ?? []);
                    setMediumArray(data.medium.filter((item: MediumType) => item.list_medium === 1).map((item: MediumType) => item.medium));
                    setIntroductoryList((data.introductory ?? []).map((i: { name: string }) => i.name));
                    setEventList(data.event ?? []);
                    setCancelLength(Number(data.cancelCount) || 0);
                    setLoseLength(Number(data.loseCount) || 0);
                    mastersLoadedRef.current = true;
                }
                setPageRows(prepareCustomers(data.customer));
                setPageRecords(data.record ?? {});
                setRecordError('');
                // ⚠️ Hotlead は今のページの分だけ（hotleadMap が id で引く）
                setHotledList(data.hotlead ?? []);
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
    }, [serverMode, category, listParams, activePage, basicLength, listReloadKey]);

    /** 表に出す行と件数（⚠️ ② で読むときは今のページの行。予備のときは画面で絞った結果を切る） */
    const visibleRows = serverMode ? pageRows : filteredDatabase.slice(sliceStart, sliceStart + basicLength);
    const totalCount = serverMode ? serverTotal : filteredDatabase.length;
    /** v2.2.296 商談・架電記録から検索しているか（⚠️ 真のときだけ「商談・架電内容」の列を出す） */
    const recordMode = isRecordSearch(recordSearch, serverMode) && recordError === '';

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
            // ⚠️ v2.2.291 ② で読むときは今のページを読み直す（① が返す全件は使わない）
            if (serverMode) reloadList();
            else setOriginalDatabase(prepareCustomers(response.data.customer));
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const closeInformationEdit = async () => {
        setEditId('');
        // ⚠️ v2.2.291 URL の ?id= だけを外す（以前は URL を空にしていた。条件が URL に載るようになったので残す）
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('id');
        setSearchParams(nextParams, { replace: true });
        // ⚠️ v2.2.291 ② で読むときは今のページを読み直すだけ（ページは変えない）
        if (serverMode) {
            reloadList();
            return;
        }
        const prevPage = activePage;
        skipPageReset.current = true;

        await fetchDatabase();

        setActivePage(prevPage);
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

    /** ⚠️ v2.2.271: 表に出す行の分だけ hotleadMap から引いて作る（以前は絞り込みのたびに全行分を作っていた） */
    const hotlead = (item: CustomerItem) => {
        const h = hotleadMap.get(item.hotlead_id ?? '') ?? EMPTY_HOTLEAD;
        return <div onClick={() => window.open(h.url, '_blank', 'noopener,noreferrer')}>
            <div style={hotleadStyle(h.status)}
            >{h.status}</div>
            {h.status && <div className="text-secondary" style={{ fontSize: '8px' }}>{h.reason}</div>}
            <div style={{ cursor: 'pointer' }}>{h.actions && (
                <div className='d-flex align-items-center text-secondary'>
                    <i className="fa-solid fa-phone me-1"></i>{h.actions.calls}
                    <i className="fa-solid fa-envelope mx-1"></i>{h.actions.mails}
                    <i className="fa-solid fa-comment-sms mx-1"></i>{h.actions.sms}</div>)}</div>
        </div>
    }

    return (
        <>
            <RankingStyle />
            <style>{DBK_CSS}</style>
            <style>{RECORD_CSS}</style>
            <style>{DUE_CSS}</style>
            <div className='content database bg-white rk_wrap dbk_wrap'>
                <div className="rk_head">
                    <span className="rk_title">顧客DB（注文事業）</span>
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
                    {/* ⚠️ 店舗を選んだときだけ出す（指示）。店舗未選択では候補が作れない。
                           ⚠️ 色を付けて他のセレクトと見分けられるようにしている（指示） */}
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
                                {authority !== 'ordinary' && <option value='SUUMO(ポータル反響)'>SUUMO(ポータル反響)</option>}
                            </select>
                        </div>
                        {selectedMedium === '紹介' && <div className="m-1">
                            <select className="target" value={selectedIntroductory} onChange={(e) => setSelectedIntroductory(e.target.value)}>
                                <option value="">紹介者を選択</option>
                                {introductoryList.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                        </div>}
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
                            <select className="target" value={hotleadStatus} onChange={(e) => sethotleadStatus(e.target.value)}>
                                <option value="">Hotlead</option>
                                <option value="対応停止">対応停止</option>
                                <option value="アポ予約済み">アポ予約済み</option>
                                <option value="対応中">対応中</option>
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
                        </div>
                        <div className="m-1">
                            <select className="target" value={snapStatus ? '登録済み' : ''} onChange={(e) => {
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
                            <select className="target" value={searchedEvent} onChange={(e) => {
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
                            {/* ⚠️ 電話番号の隣に置く（⚠️ **連絡先の欄をまとめる**）。⚠️ 大文字小文字は区別しない */}
                            <input className="target" placeholder='メールアドレスで検索'
                                value={mailSearch.inputValue} onChange={mailSearch.onChange} />
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
                        <RecordSearchCard value={recordSearch} onSearch={(keyword) => (keyword === recordSearch ? reloadList() : setRecordSearch(keyword))} disabled={!serverMode} loading={listLoading} error={recordError} />
                        {!isSp && <>
                            {trash === 1 && <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setTrash(0)}>非表示リストへ移動</button>}
                            {trash === 0 && <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setTrash(1)}>一覧へ戻る</button>}
                            <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setCallStatusShow(true)}>架電状況集計</button>
                            {/* ⚠️ v2.2.291 要回答は赤のまま（目立たせるため。指示）
                                ⚠️ v2.2.297 ボタンの上の吹き出しをやめ、ボタンの中の札にした（上に浮かせると記録の検索の枠と重なる）。0件なら出さない */}
                            <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setCancelListShow(true)}>キャンセル集計
                                {cancelLength > 0 && <span className="dbo_due">要回答 {cancelLength}</span>}
                            </button>
                            <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setLoseListShow(true)}>失注集計
                                {loseLength > 0 && <span className="dbo_due">要回答 {loseLength}</span>}
                            </button>
                            <button type="button" className="rk_btn rk_btn_ghost ms-1" onClick={() => setSurveyShow(true)}>アンケート集計</button></>}
                    </div>
                </div>
                <div className="w-100 mb-1">
                    {/* ⚠️ nexus は**注文事業だけ**。建売分譲にはこのアイコンを出していない */}
                    <GiftLegend nexus />
                </div>
                <div className="w-100 dbk_table_wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ width: `${1600 + (recordMode ? RECORD_COL_WIDTH : 0)}px` }}>
                        {/* ⚠️ v2.2.291 縞模様（striped）は外した。罫線・見出しの色は databaseListStyle.ts の DBK_CSS */}
                        <Table className='dbk_table' style={{ fontSize: isSp ? '9px' : '12px', textAlign: 'center' }} bordered>
                            <tbody className='align-middle'>
                                <tr className='align-middle sticky-header'>
                                    {/* ⚠️ v2.2.291 左の4列（編集・店舗・顧客名・担当営業）は横に動かしても残す（建売と同じ dbk_fix） */}
                                    <td className='dbk_fix dbk_fix1'>顧客情報編集</td>
                                    <td className='dbk_fix dbk_fix2'>店舗</td>
                                    <td className='dbk_fix dbk_fix3'>顧客名</td>
                                    <td className='dbk_fix dbk_fix4'>担当営業</td>
                                    {recordMode && <td>商談・架電内容</td>}
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
                                {visibleRows
                                    .map(item => {
                                        return <tr key={item.id}>
                                            <td className='dbk_fix dbk_fix1'><button type="button" className='dbk_edit' onClick={() => setEditId(item.id)}>編集</button></td>
                                            <td className='dbk_fix dbk_fix2'>{safeFormate(item.shop)}</td>
                                            {/*
                                              ⚠️⚠️ **Nexus アイコンはギフトのドットの隣に置く**（2026-09-25 の指示）。
                                                ⚠️ **改行しないこと。** 行の高さが揃わなくなり、一覧が読みにくくなる。
                                            */}
                                            {/* ⚠️ v2.2.187: 氏名②があるときだけ「アイコン（縦中央）／氏名①・氏名②の2行」（⚠️ その行だけ高くなる。2026-10-12 に了承済み） */}
                                            <td className='dbk_fix dbk_fix3'><CustomerNameCell
                                                icons={<>
                                                    <GiftDot gift={item.gift} />
                                                    {/* ⚠️ `item.rank` は `Sランク` の形。⚠️ **表示用に「ランク」を落とす前の値**を渡すこと */}
                                                    {isNexusRow(item.customer, item.customer_contacts_name_kana, item.rank) && <NexusBadge className='me-1' />}
                                                    {item.k_snap && <i className="fa-solid fa-camera me-1 text-warning"></i>}
                                                </>}
                                                name={safeFormate(item.customer)}
                                                name2={item.customer_2} /></td>
                                            <td className='dbk_fix dbk_fix4'>{safeFormate(item.staff)}</td>
                                            {recordMode && <RecordCell group={pageRecords[item.id]} />}
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
