import React, { useState, useMemo, useEffect, useContext, useCallback, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { dateFormate, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus } from './databaseUtils';
import { deadlineClass, deadlineText, expiryDeadline, holidaysOf, reinsDeadline, reportDeadline } from '../realty/common/deadlines';
import type { Holidays } from '../realty/common/deadlines';
import PropertyRegister from './PropertyRegister';
import InformationEditResale from '../information/InformationEditResale';
import PropertySummary from './PropertySummary';
import BuyOfferModal from '../realty/common/BuyOfferModal';
import { OFFER_STATUS } from '../realty/common/leadLinks';
import { loadRecords } from '../realty/common/realtyState';
import AuthContext from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import type { Row, StaffSetting } from '../realty/summary/kpi';
import { useListUrlSync } from './listUrl';
import { useDebounce } from './useDebounce';
import { filterAndSortLedgers, LEDGER_SORT_KEYS, type LedgerSortKey } from './brokerLedgerFilter';

export interface BrokerData {
    internal_id: number;
    id: string;
    kind: string | null;
    no?: number | null;
    freq?: string | null;
    note?: string | null;
    addr1?: string | null;
    addr2?: string | null;
    addr?: string | null;
    price?: number | null;
    budget?: number | null;
    fee?: number | null;
    feeManual?: number | null;
    staff?: string | null;
    portal?: string | null;
    seller?: string | null;
    customer?: string | null;
    name?: string | null;
    source?: string | null;
    contact?: string | null;
    keyInfo?: string | null;
    category?: string | null;
    keyStatus?: string | null;
    baikaiType?: string | null;
    propStatus?: string | null;
    /** 有効期間の満了日（v2.2.248 の媒介紐付から入る）。直近の販売報告日（v2.2.249 から期限の計算に使う） */
    expiry?: string | null;
    lastReportDate?: string | null;
    /** 媒介物件（v2.2.250。realty_properties.id。同じ物件の台帳は同じ値） */
    propertyId?: string | null;
    currentStatus?: string | null;
    /** つないだ商談案件（売側）の id（v2.2.246 の買付登録。以前のアプリの l.dealId） */
    dealId?: string | null;
    /** 他社客付けの内容（JSON） */
    coBroker?: unknown;
    type?: string | null;
    phase?: string | null;
    priority?: string | null;
    property?: string | null;
    targetProperty?: string | null;
    endReason?: string | null;
    reinsDate?: string | null;
    contractDate?: string | null;
    receivedDate?: string | null;
    created_at?: string;
    updated_at?: string;
    master_data_id?: string | null;
    property_db_id?: string | null;
    property_db_name?: string | null;
    show_dashboard?: number;
    [key: string]: any;
}

/** いえらぶの物件とのつながり（v2.2.258。② の features/realty/ieloveMatch.ts の IeloveState） */
type IeloveState = 'linked' | 'review' | 'unmatched' | 'none';
const IELOVE_LABEL: Record<IeloveState, string> = { linked: 'つながっている', review: '要確認', unmatched: 'いえらぶ未採番', none: '該当なし' };
const IELOVE_BADGE: Record<IeloveState, string> = {
    linked: 'bg-success bg-opacity-75', review: 'bg-warning text-dark', unmatched: 'bg-light text-secondary border', none: 'bg-secondary bg-opacity-50',
};

type SortKey = LedgerSortKey;
const IELOVE_STATES = Object.keys(IELOVE_LABEL) as IeloveState[];

/** v2.2.308 1回に読む件数（1画面に収まる程度。下までスクロールすると次の分を読む） */
const PAGE_SIZE = 30;
/** 表の下の端からこの高さ（px）まで近づいたら、次の分を読む */
const LOAD_MORE_MARGIN = 200;

/**
 * v2.2.308 左に固定する5列（No・編集・反響元・担当・媒介契約日）の幅と左の位置。
 * ⚠️ 幅を決めないと左の位置がずれるので、5列は幅を固定し、はみ出す文字は「…」にする（title で全部見える）
 */
const FIX_WIDTHS = [44, 64, 120, 96, 100];
const FIX_LEFTS = FIX_WIDTHS.map((_, i) => FIX_WIDTHS.slice(0, i).reduce((a, b) => a + b, 0));
const fixStyle = (i: number): React.CSSProperties => ({ left: FIX_LEFTS[i], width: FIX_WIDTHS[i], minWidth: FIX_WIDTHS[i], maxWidth: FIX_WIDTHS[i] });
const fixClass = (i: number) => `dbb_fix${i === FIX_WIDTHS.length - 1 ? ' dbb_fix_last' : ''}`;
const DBB_CSS = `
.dbb_table thead th { position: sticky; top: 0; z-index: 10; }
.dbb_table .dbb_fix { position: sticky; z-index: 5; overflow: hidden; text-overflow: ellipsis; }
.dbb_table thead th.dbb_fix { z-index: 12; }
.dbb_table .dbb_fix_last::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 1px; background: #dee2e6; }
`;

const DatabaseBroker = () => {
    /** v2.2.308 開いたときの URL の条件（⚠️ 下の state の初期値にだけ使う） */
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const urlValue = (key: string) => initUrl.get(key) ?? '';
    /**
     * v2.2.308 ふだん（serverMode）は ② の broker_ledger_list（GET）で30件ずつ読む（loadedRows・total）。
     * ⚠️ ② に届かないときは serverMode を false にして、今までの broker:list（POST・全件）を allLedgers に読み、
     *   brokerLedgerFilter.ts で絞って30件ずつ出す。
     */
    const [serverMode, setServerMode] = useState(true);
    const [loadedRows, setLoadedRows] = useState<BrokerData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [allLedgers, setAllLedgers] = useState<BrokerData[]>([]);
    const [shownCount, setShownCount] = useState(PAGE_SIZE);
    /** 読み込み済みの台帳（編集・買付登録で行を探す） */
    const originalData = serverMode ? loadedRows : allLedgers;
    const [staffList, setStaffList] = useState<string[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    /** ② が返す、いえらぶの状態ごとの件数の元（つながっている台帳の数と、つながっていない台帳の id） */
    const [ieloveBase, setIeloveBase] = useState<{ linked: number; unlinkedIds: string[] } | null>(null);
    const [sameProperty, setSameProperty] = useState<Record<string, string[]>>({});
    /** 古い応答で新しい条件の結果を上書きしない */
    const listSeqRef = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // === 検索用のState ===（⚠️ v2.2.308 文字の検索は 300ms 待ってから絞る。URL の条件で開く）
    const addressSearch = useDebounce(urlValue('address'), 300);
    const customerSearch = useDebounce(urlValue('customer'), 300);
    const searchAddress = addressSearch.debouncedValue;
    const searchCustomer = customerSearch.debouncedValue;
    const [searchStaff, setSearchStaff] = useState<string>(urlValue('staff'));
    const [searchCategory, setSearchCategory] = useState<string>(urlValue('propCategory'));
    const [searchStatus, setSearchStatus] = useState(urlValue('status'));

    // === テーブル制御用のState ===
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>(() => ({
        key: (LEDGER_SORT_KEYS as string[]).includes(urlValue('sort')) ? urlValue('sort') as SortKey : 'date',
        direction: urlValue('dir') === 'asc' ? 'asc' : 'desc',
    }));

    // === モーダル制御用のState ===
    const [targetPropertyId, setTargetPropertyId] = useState<string>('');
    const [targetCustomer, setTargetCustomer] = useState<BrokerData | null>(null);
    const [customerId, setCustomerId] = useState('');

    // === 編集(Update)用のState ===
    const [editData, setEditData] = useState<Partial<BrokerData>>({});
    const [isSaving, setIsSaving] = useState(false);

    const [targetId, setTargetId] = useState('');
    /** v2.2.307 物件の詳細を報告書の編集から開くか（台帳の「物件の状況」の報告書作成から開いたとき） */
    const [summaryReport, setSummaryReport] = useState(false);
    /** v2.2.307 開いている台帳の、保存済みのいえらぶ番号（「物件の状況」のタブを出すか。⚠️ 編集中の値ではなく保存済みの値） */
    const statusPropertyDbId = useMemo(
        () => String(originalData.find(d => d.id === targetPropertyId)?.property_db_id ?? ''),
        [originalData, targetPropertyId]);
    /** v2.2.307 報告書作成：台帳の画面を閉じて、物件の詳細を報告書の編集から開く（⚠️ 印刷は物件の詳細のモーダルだけで行うため） */
    const openReportFromLedger = (propertyDbId: string) => {
        setTargetPropertyId('');
        setEditData({});
        setSummaryReport(true);
        setTargetId(propertyDbId);
    };

    /**
     * ⚠️ v2.2.246: 買付登録（realty/common/BuyOfferModal.tsx）。
     *   担当者の設定（略称→氏名）と、つないだ商談案件の No. を出すために商談案件も読む。
     */
    const { userName } = useContext(AuthContext);
    const [offerLedger, setOfferLedger] = useState<BrokerData | null>(null);
    const [staffSettings, setStaffSettings] = useState<StaffSetting[]>([]);
    const [dealNoById, setDealNoById] = useState<Record<string, string>>({});
    // ⚠️ v2.2.249: レインズ登録の期限を営業日で数えるための休業日（設定画面の「休業日」。common/deadlines.ts）
    const [holidays, setHolidays] = useState<Holidays>(holidaysOf(undefined));
    /** 今日（期限の残り日数の基準。利用者の PC の日付） */
    const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
    const loadDeals = useCallback(() => {
        loadRecords(['deals'])
            .then(({ records, settings }) => {
                setStaffSettings(settings.staff ?? []);
                setHolidays(holidaysOf(settings.holidays));
                setDealNoById(Object.fromEntries(records.deals.map(d => [String(d.id), String(d.no ?? '―')])));
            })
            .catch(e => console.error('[DatabaseBroker] 商談案件の読み込みに失敗しました', e));
    }, []);
    useEffect(() => { loadDeals(); }, [loadDeals]);

    /**
     * ⚠️ v2.2.258: いえらぶの物件とのつながり（② の broker:ielove_candidates。features/realty/ieloveMatch.ts）。
     *   台帳 id → 状態（linked つながっている・review 候補あり＝要確認・unmatched 候補なし＝いえらぶ未採番・none 該当なし）
     */
    const [ielove, setIelove] = useState<Record<string, { state: IeloveState; count: number }> | null>(null);
    const loadIelove = useCallback(() => {
        apiClient.post('', { request: 'broker', roll: 'ielove_candidates' })
            .then(res => setIelove(res.data?.ledgers ?? {}))
            .catch(e => console.error('[DatabaseBroker] いえらぶの物件とのつながりを読めませんでした', e));
    }, []);
    // ⚠️ v2.2.308 計算に数秒かかるので、一覧（broker_ledger_list）とは別に1回だけ読む（読み終わるまで札は「…」）
    useEffect(() => { loadIelove(); }, [loadIelove]);
    const ieloveStateOf = (item: BrokerData): IeloveState | '' =>
        item.property_db_id ? 'linked' : ielove?.[item.id]?.state ?? '';
    const [searchIelove, setSearchIelove] = useState<IeloveState | ''>(() =>
        (IELOVE_STATES as string[]).includes(urlValue('ielove')) ? urlValue('ielove') as IeloveState : '');
    const [matching, setMatching] = useState(false);
    /** 「いえらぶと突き合わせ」：今すぐ ② の突き合わせを動かし、一覧を読み直す */
    const runIeloveMatch = async () => {
        setMatching(true);
        try {
            const res = await apiClient.post('', { request: 'broker', roll: 'ielove_match' });
            if (res.data?.status !== 'success') throw new Error(res.data?.message || '突き合わせに失敗しました');
            await reloadList();
            alert(`いえらぶの物件と突き合わせました。\n台帳 ${res.data.ledgers}件・買い反響 ${res.data.buyLeads}件を新しくつなぎました。`);
        } catch (e) {
            console.error(e);
            alert('いえらぶの物件との突き合わせに失敗しました。');
        } finally {
            setMatching(false);
        }
    };
    const closeOffer = useCallback(() => setOfferLedger(null), []);

    /**
     * ⚠️ v2.2.248: 売り反響の「媒介紐付」で台帳を作ったあとの「媒介獲得台帳で開く」（/broker?ledgerNo=…）。
     *   その台帳の行を黄色にし、見えるところまで動かす（連動トリガー仕様書 共通ルール 4）
     */
    const [searchParams] = useSearchParams();
    const focusNo = searchParams.get('ledgerNo') ?? '';
    /** 買付登録・解除のあと、一覧の台帳を直し、案件の No. を読み直す */
    const onOfferSaved = (ledgerId: string, fields: Row) => {
        const patch = (prev: BrokerData[]) => prev.map(d => (d.id === ledgerId ? { ...d, ...fields } as BrokerData : d));
        setLoadedRows(patch);
        setAllLedgers(patch);
        loadDeals();
    };

    /** v2.2.308 ② に送る条件（⚠️ URL にも同じキーで出す。既定の並び＝媒介契約日の新しい順と、空の条件は出さない） */
    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        const add = (k: string, v: string) => { if (v) p[k] = v; };
        add('address', searchAddress);
        add('customer', searchCustomer);
        add('staff', searchStaff);
        add('propCategory', searchCategory);
        add('status', searchStatus);
        add('ielove', searchIelove);
        if (sortConfig.key !== 'date' || sortConfig.direction !== 'desc') {
            p.sort = sortConfig.key;
            p.dir = sortConfig.direction;
        }
        return p;
    }, [searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus, searchIelove, sortConfig]);
    // ⚠️ ?ledgerNo=（売り反響の「媒介獲得台帳で開く」）は残す
    useListUrlSync(listParams, 1, 20, ['ledgerNo']);

    /**
     * v2.2.308 ② から offset 件目から limit 件を GET で読む。replace＝読み込み済みを捨てて入れ替える（条件を変えた・読み直し）。
     * ⚠️ 初めの分には ledgerNo を付ける（② がその台帳の行が入るところまで返す）
     */
    const fetchPage = async (offset: number, limit: number, replace: boolean) => {
        const seq = ++listSeqRef.current;
        setLoading(true);
        try {
            const response = await apiClient.get('', {
                params: { request: 'broker_ledger_list', ...listParams, offset, limit, ...(offset === 0 && focusNo ? { ledgerNo: focusNo } : {}) },
            });
            if (seq !== listSeqRef.current) return;
            const data = response?.data;
            if (!data || data.status !== 'ok' || !Array.isArray(data.rows)) throw new Error('invalid broker_ledger_list response');
            setLoadedRows(prev => (replace ? data.rows : [...prev.slice(0, offset), ...data.rows]));
            setTotal(Number(data.total) || 0);
            setStaffList(data.staffList ?? []);
            setCategoryOptions(data.categories ?? []);
            setIeloveBase(data.ieloveBase ?? null);
            setSameProperty(prev => ({ ...prev, ...(data.sameProperty ?? {}) }));
            setLoading(false);
        } catch (e) {
            if (seq !== listSeqRef.current) return;
            console.error('broker_ledger_list に失敗しました。全件の読み込みに切り替えます:', e);
            setServerMode(false);
        }
    };

    /** 予備：今までの broker:list（POST・全件）。⚠️ ② と同じ並びの元（internal_id の順）にそろえる */
    const fetchAllLedgers = async () => {
        const now = new Date();
        const year = now.getFullYear();
        const thisYear = now.getMonth() <= 4 ? year : year + 1;
        try {
            const response = await apiClient.post('', { request: 'broker', roll: 'list' });
            const filtered = response.data.brokerage.filter((b: BrokerData) => b.kind === 'ledger' && b.show_dashboard === 1);
            setAllLedgers([...filtered].sort((a, b) => a.internal_id - b.internal_id));
            const filteredStaff = response.data.staff.filter((s: Record<string, string>) => (s.shop === '不動産企画係' || s.shop === '中古住宅専門店') && s.period === String(thisYear)).map((s: Record<string, string>) => s.name);
            setStaffList(filteredStaff);
        } catch (e) {
            alert('通信エラーが発生しました');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    /** 保存・非表示・いえらぶとの突き合わせのあと：読み込み済みの範囲を読み直す */
    const reloadList = async () => {
        loadIelove();
        if (serverMode) await fetchPage(0, Math.max(PAGE_SIZE, loadedRows.length), true);
        else await fetchAllLedgers();
    };

    // データ取得（⚠️ 条件を変えたら初めの30件から。setTimeout(0) で StrictMode の2回の effect を1回にまとめる）
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        if (!serverMode) { setShownCount(PAGE_SIZE); return; }
        const timer = window.setTimeout(() => { fetchPage(0, PAGE_SIZE, true); }, 0);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode, listParams]);

    // ⚠️ 全件の読み込みは、② に届かなかったとき（serverMode が false）だけ
    useEffect(() => {
        if (serverMode) return;
        fetchAllLedgers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode]);

    // 💡 編集ボタンを押した時に、選択された行のデータをフォームの初期値としてセットする
    useEffect(() => {
        if (targetPropertyId) {
            const target = originalData.find(d => d.id === targetPropertyId);
            if (target) setEditData(target);
        } else {
            setEditData({}); // 閉じた時にリセット
        }
    }, [targetPropertyId, originalData]);



    // === 動的セレクトボックスの選択肢を生成 ===
    const uniqueStaffList = useMemo(() => {
        const staffs = originalData.map(d => d.staff).filter(Boolean) as string[];
        return Array.from(new Set(staffs)).sort();
    }, [originalData]);

    // === フィルタリング＆ソート処理 ===（⚠️ v2.2.308 予備のときだけ。ふだんは ② が絞って並べる。brokerLedgerFilter.ts）
    const processedFallback = useMemo(() => {
        if (serverMode) return [];
        return filterAndSortLedgers(allLedgers, {
            address: searchAddress, customer: searchCustomer, staff: searchStaff,
            propCategory: searchCategory, status: searchStatus, ielove: searchIelove,
        }, sortConfig.key, sortConfig.direction, ieloveStateOf);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ieloveStateOf は ielove だけを読む
    }, [serverMode, allLedgers, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus, searchIelove, ielove]);

    /** 表に出す行と、条件に合う件数 */
    const visibleRows = serverMode ? loadedRows : processedFallback.slice(0, shownCount);
    const totalCount = serverMode ? total : processedFallback.length;
    const hasMore = visibleRows.length < totalCount;

    /** 物件種別の選択肢（⚠️ 予備のときは読んだ台帳から） */
    const uniqueCategoryList = useMemo(() => {
        if (serverMode) return categoryOptions;
        const categories = allLedgers.map(d => d.category).filter(Boolean) as string[];
        return Array.from(new Set(categories)).sort();
    }, [serverMode, categoryOptions, allLedgers]);

    /** いえらぶの状態ごとの件数（絞り込みの選択肢に出す。⚠️ ふだんは ② の ieloveBase＝表示する台帳すべてから数える） */
    const ieloveCounts = useMemo(() => {
        const c: Record<string, number> = {};
        if (serverMode) {
            if (!ieloveBase) return c;
            if (ieloveBase.linked > 0) c.linked = ieloveBase.linked;
            for (const id of ieloveBase.unlinkedIds) { const s = ielove?.[id]?.state; if (s) c[s] = (c[s] ?? 0) + 1; }
            return c;
        }
        for (const d of allLedgers) { const s = ieloveStateOf(d); if (s) c[s] = (c[s] ?? 0) + 1; }
        return c;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ieloveStateOf は ielove だけを読む
    }, [serverMode, ieloveBase, allLedgers, ielove]);

    // ⚠️ v2.2.250: 媒介物件ごとの台帳 No.（同じ物件に台帳が2件以上あるとき、一覧に「同じ物件の台帳 N件」を出す）
    //   ⚠️ v2.2.308 ふだんは ② が、読んだ行の物件の分を返す（sameProperty）
    const ledgerNosByProperty = useMemo(() => {
        if (serverMode) return sameProperty;
        const m: Record<string, string[]> = {};
        for (const d of allLedgers) {
            if (!d.propertyId) continue;
            (m[d.propertyId] = m[d.propertyId] ?? []).push(String(d.no ?? '―'));
        }
        return m;
    }, [serverMode, sameProperty, allLedgers]);

    // ⚠️ v2.2.308 予備のとき、?ledgerNo= の行が入るところまで出す（ふだんは ② が初めの分でそこまで返す）
    const focusShownRef = useRef(false);
    useEffect(() => {
        if (serverMode || focusNo === '' || focusShownRef.current || processedFallback.length === 0) return;
        focusShownRef.current = true;
        const at = processedFallback.findIndex(d => String(d.no ?? '') === focusNo);
        if (at >= PAGE_SIZE) setShownCount(at + 1);
    }, [serverMode, focusNo, processedFallback]);

    // ⚠️ v2.2.248: ?ledgerNo= の行が一覧に出たら、見えるところまで動かす（1回だけ）
    const [focusedNo, setFocusedNo] = useState('');
    useEffect(() => {
        if (focusNo === '' || focusedNo === focusNo) return;
        const el = document.getElementById(`ledger-row-${focusNo}`);
        if (!el) return;
        el.scrollIntoView({ block: 'center' });
        setFocusedNo(focusNo);
    }, [focusNo, focusedNo, visibleRows]);

    /*
     * ⚠️ v2.2.245: ページ割りをやめ、媒介契約日の新しい順に全件を1枚で出していた。
     * ⚠️ v2.2.308: 表示に時間がかかるので、30件ずつ読み、表の下の端までスクロールしたら次の30件を読む。
     */
    const loadMore = () => {
        if (loading || !hasMore) return;
        if (serverMode) fetchPage(loadedRows.length, PAGE_SIZE, false);
        else setShownCount(c => c + PAGE_SIZE);
    };
    /** 表の下の端が見えていたら次の分を読む（スクロールのたびと、読み終わったとき。⚠️ 1画面に収まって下の端が見えたままのときも続けて読む） */
    const loadMoreIfNearBottom = () => {
        const el = scrollRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_MARGIN) loadMore();
    };
    useEffect(() => {
        loadMoreIfNearBottom();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, visibleRows.length, totalCount]);

    // === UIヘルパー ===
    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };


    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <span className="text-muted ms-1 opacity-25" style={{ fontSize: '10px' }
        }>↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▲</span> : <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▼</span >;
    };

    const handleUpdate = async () => {
        if (!targetPropertyId) return;
        setIsSaving(true);
        // ⚠️ v2.2.246: 現況を「買付有」にして保存したら買付登録へ案内する（以前のアプリの cbPromptOnStatus）
        const before = originalData.find(d => d.id === targetPropertyId);
        const toOffer = editData.currentStatus === OFFER_STATUS && before?.currentStatus !== OFFER_STATUS && !(before?.dealId && dealNoById[before.dealId]);
        try {
            const payload = {
                request: 'broker',
                roll: 'update',
                id: targetPropertyId,
                data: editData
            };
            const response = await apiClient.post('', payload);
            if (response.data.status === 'error') alert('更新に失敗しました');
            const filtered = (response.data.brokerage ?? []).filter((b: BrokerData) => b.kind === 'ledger' && b.show_dashboard === 1);
            // ⚠️ v2.2.258: 保存のあと ② がいえらぶと突き合わせるので、札も読み直す（v2.2.308 から読み込み済みの範囲を読み直す）
            await reloadList();
            const saved = filtered.find((b: BrokerData) => b.id === targetPropertyId);
            if (toOffer && saved && response.data.status !== 'error'
                && window.confirm('台帳の現況を「買付有」にしました。\n商談案件管理へつなぐには、買付の内容（買主・買付金額・契約希望日）が要ります。\n買付登録の画面を開きますか？')) {
                setOfferLedger(saved);
            }
        } catch (e) {
            console.error(e);
            alert('更新に失敗しました。');
        } finally {
            setIsSaving(false);
            setTargetPropertyId('');

        }
    };


    useEffect(() => {
        if (targetPropertyId) {
            const target = originalData.find(d => d.id === targetPropertyId);
            if (target) {
                setEditData(target);
            }
        } else {
            setEditData({});
        }
    }, [targetPropertyId, originalData]);

    const onClose = () => {
        setCustomerId('');
    };

    // 💡 非表示（論理削除）処理
    const handleDelete = async (id: string) => {
        if (!window.confirm('この物件をダッシュボードから非表示にしますか？')) return;

        try {
            const payload = {
                request: 'broker',
                roll: 'update',
                id: id,
                data: { show_dashboard: 0 }
            };

            const response = await apiClient.post('', payload);

            if (response.data.status === 'error') {
                alert('非表示処理に失敗しました');
                return;
            }

            // 成功時、読み込み済みの範囲を読み直して画面から消す（v2.2.308）
            await reloadList();

        } catch (e) {
            console.error(e);
            alert('通信エラーが発生しました。');
        }
    };

    return (
        <div className="content bg-light p-3">

            {/* === 🔍 検索フィルターエリア === */}
            <div className="card shadow-sm border-0 rounded-3 mb-3">
                <div className="card-body bg-white rounded-3">
                    <div className="row g-2">
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">① 住所で検索</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="例: 鹿児島市"
                                value={addressSearch.inputValue}
                                onChange={addressSearch.onChange}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">② 顧客名で検索</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="例: 山田"
                                value={customerSearch.inputValue}
                                onChange={customerSearch.onChange}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">③ 物件ステータスで検索</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchStatus}
                                onChange={(e) => setSearchStatus(e.target.value)}
                            >
                                <option value="">すべて</option>
                                <option value="アクティブ">アクティブ</option>
                                <option value="媒介終了">媒介終了</option>
                                <option value="成約完了">成約完了</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">④ 担当者</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchStaff}
                                onChange={(e) => setSearchStaff(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {staffList.map(staff => (
                                    <option key={staff} value={staff}>{staff}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">⑤ 物件種別</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchCategory}
                                onChange={(e) => setSearchCategory(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {uniqueCategoryList.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        {/* ⚠️ v2.2.258: いえらぶの物件とのつながり */}
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">⑥ いえらぶ</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchIelove}
                                onChange={(e) => setSearchIelove(e.target.value as IeloveState | '')}
                            >
                                <option value="">すべて</option>
                                {(Object.keys(IELOVE_LABEL) as IeloveState[]).map(s => (
                                    <option key={s} value={s}>{IELOVE_LABEL[s]}（{ieloveCounts[s] ?? 0}件）</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 件数表示 ＆ ページネーション（上部） === */}
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-3">
                    <div className="fw-bold text-secondary">
                        該当 {totalCount} 件
                        {hasMore && <span className="fw-normal ms-2" style={{ fontSize: '11px' }}>（{visibleRows.length}件を表示中。下へスクロールすると続きを読みます）</span>}
                    </div>
                    {/*
                      ⚠️ v2.2.245: 「媒介追加」を消した。媒介は必ず売り反響の「媒介受託」から作る（v2.2.248 からは売り反響の「媒介紐付」→ ② の planner:ledger_link）。
                        ここで作ると、売主がどの反響から来たのか分からない物件ができてしまう（制作者の要望）。
                    */}
                    <span className="text-muted" style={{ fontSize: '11px' }}>媒介は売り反響を「媒介受託」にすると作られます</span>
                </div>
                {/* ⚠️ v2.2.258: ふだんは ② が30分ごとと台帳の保存のあとに突き合わせる。いえらぶに登録した直後に、すぐつなぎたいとき用 */}
                <button className="btn btn-sm btn-outline-success bg-white rounded-pill px-3 py-0" style={{ fontSize: '11px' }}
                    disabled={matching} onClick={runIeloveMatch}
                    title="所在地・種別が一致するいえらぶの物件が1件だけの台帳をつなぎ、ポータルの買い反響を台帳へつなぎます（30分ごとにも自動で動きます）">
                    {matching ? <span className="spinner-border spinner-border-sm me-1" style={{ width: '.8rem', height: '.8rem' }}></span> : <i className="bi bi-arrow-repeat me-1"></i>}
                    いえらぶと突き合わせ
                </button>
            </div>

            {/* === テーブルUI === */}
            <div className="card shadow-sm border-0 rounded-3">
                <div className="card-body p-0">
                    {/* ⚠️ v2.2.308 見出しは上に、左の5列（No〜媒介契約日）は左に固定（DBB_CSS）。下の端までスクロールすると次の30件を読む */}
                    <style>{DBB_CSS}</style>
                    <div ref={scrollRef} className="table-responsive" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }} onScroll={loadMoreIfNearBottom}>
                        <table className="table table-hover align-middle mb-0 text-center text-nowrap dbb_table" style={{ fontSize: '12px' }}>
                            <thead className="table-light border-bottom border-2">
                                <tr>
                                    <th className={`py-2 ${fixClass(0)}`} style={fixStyle(0)}>No</th>
                                    <th className={`py-2 ${fixClass(1)}`} style={fixStyle(1)}>編集</th>
                                    <th className={`py-2 ${fixClass(2)}`} style={{ ...thStyle, ...fixStyle(2) }} onClick={() => requestSort('medium')}>反響元 {getSortIcon('medium')}</th>
                                    <th className={`py-2 ${fixClass(3)}`} style={{ ...thStyle, ...fixStyle(3) }} onClick={() => requestSort('staff')}>担当 {getSortIcon('staff')}</th>
                                    <th className={`py-2 ${fixClass(4)}`} style={{ ...thStyle, ...fixStyle(4) }} onClick={() => requestSort('date')}>媒介契約日 {getSortIcon('date')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('updated_at')}>情報更新日 {getSortIcon('updated_at')}</th>
                                    <th className="py-2">契約満了予定</th>
                                    <th className="py-2">残日数</th>
                                    <th className="py-2">更新状態</th>
                                    <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayName')}>顧客名 {getSortIcon('displayName')}</th>
                                    <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayAddress')}>物件 / 住所 {getSortIcon('displayAddress')}</th>
                                    <th className="py-2 text-end" style={thStyle} onClick={() => requestSort('displayPrice')}>金額 / 予算 {getSortIcon('displayPrice')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('phase')}>フェーズ {getSortIcon('phase')}</th>
                                    {/* ⚠️ v2.2.246: 買付登録（他社・自社の客付け）→ 商談案件 */}
                                    <th className="py-2">客付・案件</th>
                                    <th className="py-2">REINZ</th>
                                    <th className="py-2">販売報告</th>
                                    <th className="py-2">物件状態</th>
                                    <th className="py-2">MAP</th>
                                    <th className="py-2">ポータル連携（いえらぶ）</th>
                                    {/* 💡 追加: サマリー列 */}
                                    <th className="py-2">サマリー</th>
                                    <th className="py-2">非表示</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.length > 0 ? (
                                    visibleRows.map((item, index) => {
                                        const displayPrice = item.price || 0;

                                        const rawAddress = [item.addr1, item.addr2, item.addr, item.property, item.targetProperty]
                                            .filter(Boolean)
                                            .join(' ');

                                        const addressParsed = parseTextWithUrl(rawAddress);
                                        const noteParsed = parseTextWithUrl(item.note);
                                        const mapUrl = addressParsed.mapUrl || noteParsed.mapUrl;

                                        // ⚠️ v2.2.249: 期限は連動トリガー仕様書 ②（common/deadlines.ts）。満了日は expiry（無ければ契約日の3か月後の前日）。
                                        //   以前は専任・専属専任だけ、30日前から「期限間近」だった。今は一般も出し、14日前から（仕様書）。媒介終了・成約完了は出さない
                                        const expiry = expiryDeadline(item, today);
                                        const reins = reinsDeadline(item, today, holidays);
                                        const report = reportDeadline(item, today);

                                        return (
                                            <tr key={item.id} id={`ledger-row-${String(item.no ?? '')}`} style={focusNo !== '' && String(item.no ?? '') === focusNo ? { outline: '2px solid #fd7e14', background: '#fff3cd' } : undefined}>
                                                <td className={`text-muted ${fixClass(0)}`} style={fixStyle(0)}>{index + 1}</td>
                                                <td className={fixClass(1)} style={fixStyle(1)}>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger rounded-pill px-3 py-0"
                                                        style={{ fontSize: "11px" }}
                                                        onClick={() => setTargetPropertyId(item.id)}
                                                    >
                                                        編集
                                                    </button>
                                                </td>
                                                <td className={fixClass(2)} style={fixStyle(2)} title={item.source || ''}>{item.source || '-'}</td>
                                                <td className={fixClass(3)} style={fixStyle(3)} title={item.staff || ''}>{item.staff || '-'}</td>
                                                <td className={`text-muted ${fixClass(4)}`} style={fixStyle(4)}>{dateFormate(item.contractDate || '')}</td>
                                                <td className="text-muted">{dateFormate(item.updated_at || '')}</td>
                                                <td className="text-muted">{expiry ? expiry.date.replace(/-/g, '/') : '-'}</td>
                                                <td className="text-end fw-bold">
                                                    {expiry ? <span className={expiry.days < 0 ? 'text-danger' : ''}>{expiry.days}日</span> : '-'}
                                                </td>
                                                <td>
                                                    {expiry ? (
                                                        <span className={`badge ${deadlineClass(expiry.state)}`} title="満了日の14日前から「期限間近」">
                                                            {expiry.state === 'over' ? '★ 期限切れ' : expiry.state === 'soon' ? '⚠ 期限間近' : '有効'}
                                                        </span>
                                                    ) : <span className="text-muted">-</span>}
                                                </td>
                                                <td className="text-start">
                                                    <span
                                                        className={`${item.master_data_id ? 'text-primary' : 'text-dark'} ${item.master_data_id ? 'fw-bold' : ''}`}
                                                        style={{
                                                            cursor: item.master_data_id ? 'pointer' : '',
                                                            textDecoration: item.master_data_id ? 'underline dotted' : 'none'
                                                        }}
                                                        onClick={() => item.master_data_id ? setCustomerId(item.master_data_id) : null}
                                                    >
                                                        {item.seller || '未登録'}
                                                    </span>
                                                </td>
                                                <td className="text-start text-truncate" style={{ maxWidth: '200px' }} title={addressParsed.cleanText}>
                                                    {addressParsed.cleanText || '-'}
                                                    {(() => {
                                                        const nos = item.propertyId ? ledgerNosByProperty[item.propertyId] ?? [] : [];
                                                        if (nos.length < 2) return null;
                                                        const list = nos.map(n => `No.${n}`).join('・');
                                                        return (
                                                            <button type="button" className="badge bg-info text-dark border-0 ms-1" style={{ fontSize: '9px', cursor: 'pointer' }}
                                                                title={`同じ物件の台帳：${list}`} onClick={() => alert(`同じ物件（媒介物件）の台帳：${list}`)}>
                                                                同じ物件の台帳 {nos.length}件
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="text-end fw-bold text-danger">
                                                    {displayPrice > 0 ? displayPrice.toLocaleString() : '-'}
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-dark border">{item.currentStatus || '-'}</span>
                                                </td>
                                                <td>
                                                    {item.dealId && dealNoById[item.dealId] ? (
                                                        <button className="btn btn-sm btn-success bg-opacity-75 rounded-pill px-2 py-0" style={{ fontSize: '11px' }}
                                                            title="商談案件につながっています（押すと解除の画面）" onClick={() => setOfferLedger(item)}>
                                                            案件No.{dealNoById[item.dealId]}
                                                        </button>
                                                    ) : item.propStatus === '媒介終了' ? (
                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                                                    ) : (
                                                        <button className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-2 py-0" style={{ fontSize: '11px' }}
                                                            title="他社・自社の客付けの買付を登録して、商談案件管理へつなぐ" onClick={() => setOfferLedger(item)}>
                                                            🤝買付登録{item.dealId ? '（連携切れ）' : ''}
                                                        </button>
                                                    )}
                                                </td>
                                                <td>
                                                    {/* ⚠️ v2.2.249: 専属専任・専任で未登録なら、期限（契約日の翌日から5・7営業日目）と残りの日数 */}
                                                    {reins && reins.state !== 'done' ? (
                                                        <span className={`badge ${deadlineClass(reins.state)}`} title="レインズ登録の期限（休業日を数えない）">
                                                            要登録 {deadlineText(reins)}
                                                        </span>
                                                    ) : (
                                                        <span className={`badge ${getReinsStatus(item.reinsDate, item.baikaiType).color}`}>
                                                            {getReinsStatus(item.reinsDate, item.baikaiType).label}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {/* ⚠️ v2.2.249: 次の販売報告の期限（初回は契約日から、2回目からは直近の報告日から。専属専任7日・専任14日） */}
                                                    {report ? (
                                                        <span className={`badge ${deadlineClass(report.state)}`} title={item.lastReportDate ? `直近の報告 ${dateFormate(item.lastReportDate)}` : '初回の販売報告'}>
                                                            {deadlineText(report)}
                                                        </span>
                                                    ) : <span className="text-muted">-</span>}
                                                </td>
                                                <td>
                                                    <span className={`badge ${getPropertyStatus(item.propStatus ?? '').color}`}>
                                                        {getPropertyStatus(item.propStatus ?? '').label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {mapUrl ? (
                                                        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-0 shadow-sm" style={{ fontSize: '11px' }}>
                                                            <i className="bi bi-geo-alt-fill"></i> MAP
                                                        </a>
                                                    ) : <span className="text-muted" style={{ fontSize: '11px' }}>-</span>}
                                                </td>
                                                <td>
                                                    {/* ⚠️ v2.2.258: いえらぶの番号・要確認・未採番・該当なし。押すと編集画面（候補から選べる） */}
                                                    {(() => {
                                                        const s = ieloveStateOf(item);
                                                        if (!s) return <span className="text-muted" style={{ fontSize: '11px' }}>…</span>;
                                                        const text = s === 'linked' ? `No.${item.property_db_id}`
                                                            : s === 'review' ? `要確認 ${ielove?.[item.id]?.count ?? 0}件` : IELOVE_LABEL[s];
                                                        const title = s === 'linked' ? `${item.property_db_name || ''}${item.property_db_match === 'auto' ? '（自動でつないだ）' : ''}`
                                                            : s === 'review' ? '所在地が近いいえらぶの物件があります。編集画面で選んでください'
                                                            : s === 'unmatched' ? 'いえらぶにまだ登録されていません（登録されると自動でつながります）' : 'いえらぶに載せない物件';
                                                        return (
                                                            <button type="button" className={`badge border-0 ${IELOVE_BADGE[s]}`} style={{ fontSize: '10px', cursor: 'pointer' }}
                                                                title={title} onClick={() => setTargetPropertyId(item.id)}>
                                                                {text}
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                {/* 💡 追加: サマリーセル */}
                                                <td>
                                                    {item.property_db_id ? (
                                                        <button
                                                            className="btn btn-sm btn-outline-info rounded-pill px-3 py-0 fw-bold"
                                                            style={{ fontSize: "11px" }}
                                                            onClick={() => setTargetId(String(item.property_db_id))}
                                                        >
                                                            <i className="bi bi-bar-chart-line-fill me-1"></i>詳細
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-link text-secondary p-0 border-0"
                                                        title="非表示にする"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={21} className="text-center py-4 text-muted">
                                            {loading ? '読み込み中…' : '該当するデータが見つかりません。'}
                                        </td>
                                    </tr>
                                )}
                                {visibleRows.length > 0 && (hasMore || loading) && (
                                    <tr>
                                        <td colSpan={21} className="text-start py-2 text-muted" style={{ fontSize: '11px' }}>
                                            {loading ? <><span className="spinner-border spinner-border-sm me-1" style={{ width: '.8rem', height: '.8rem' }}></span>読み込み中…</> : '下へスクロールすると続きを読みます'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <InformationEditResale id={customerId} token="" onClose={onClose} authority="" />
            <PropertyRegister
                targetPropertyId={targetPropertyId}
                setTargetPropertyId={setTargetPropertyId}
                editData={editData} setEditData={setEditData}
                staffList={staffList}
                isSaving={isSaving}
                handleUpdate={handleUpdate}
                statusPropertyDbId={statusPropertyDbId}
                onOpenReport={openReportFromLedger} />
            <BuyOfferModal
                ledger={offerLedger as Row | null}
                staffSettings={staffSettings}
                userName={userName || ''}
                onClose={closeOffer}
                onSaved={onOfferSaved}
            />
            <PropertySummary
                targetId={targetId}
                setTargetId={(v) => { setTargetId(v); setSummaryReport(false); }}
                setEditId={setCustomerId}
                openReport={summaryReport}
            />
        </div>
    );
};

export default DatabaseBroker;