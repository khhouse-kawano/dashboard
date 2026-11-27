import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import AuthContext from '../../../context/AuthContext';
import SatBaseImport from './SatBaseImport';
import { useListUrlSync } from '../../database/listUrl';
import { useDebounce } from '../../database/useDebounce';
import {
    filterAndSortSatbase, satbaseKpiOf, satbaseOptionsOf, SATBASE_SORT_KEYS,
    type SatbaseKpi, type SatbaseOptions,
} from './satbaseFilter';

/**
 * SatBaseサマリー（ヘッダー → システム管理 → SatBaseサマリー。/satbase）。
 * ⚠️ v2.2.231 でメニューごと外し、v2.2.309 でシステム管理に戻した。⚠️ **Master だけ**（headerScreens.tsx の allow。② の satbase_* も auth: 'master'）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 元データは SatBase の物件台帳（中間加工）の写し。テーブル `satbase_property`（約1,900行 / 42列）。
 *   ⚠️ 写しを新しくするのは「物件更新」（SatBaseImport.tsx。CSV の取り込み）だけ。
 *
 * ⚠️⚠️ **画面から変更できるのは2列だけ。**
 *   ⚠️ 広告出稿状況（`ad_posted`）と Instagram投稿状況（`instagram_posted`）。他の列は SatBase 側が正（features/satbase.ts の許可リスト）。
 *
 * ⚠️ v2.2.309 から ② の satbase_page（GET）で、絞り込み・並べ替えをした30件ずつを読む。
 *   表の下の端に近づいたら次の30件を読む。条件と並びは URL にも出す（その URL で開くと同じ一覧）。
 *   ⚠️ ② に届かないときは、今までの POST の satbase_list（全件）に切り替えて satbaseFilter.ts で絞る（② と同じ式）。
 *
 * ⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。ここに実装しないこと。
 * ─────────────────────────────────────────────
 */

type Property = Record<string, string | number | null>;

type Column = {
    key: string;
    label: string;
    /** 右寄せにする（金額・ID） */
    numeric?: boolean;
    /** 既定で表示するか */
    defaultShown: boolean;
};

/**
 * 表示できる列。⚠️ 表の列順もこの配列の順。
 * ⚠️ 決済日（仕入）/ 契約日（仕入）/ 位置情報 は実データが全件空なので、既定では出さない（2026-09-22 の指示）。
 */
const COLUMNS: Column[] = [
    { key: 'property_id', label: '物件ID', numeric: true, defaultShown: true },
    { key: 'property_name', label: '物件名称', defaultShown: true },
    { key: 'progress_status', label: '工程状況', defaultShown: true },
    { key: 'sales_status', label: '販売状況', defaultShown: true },
    { key: 'prefecture', label: '県', defaultShown: true },
    { key: 'area', label: 'エリア', defaultShown: true },
    { key: 'team', label: 'チーム（係）', defaultShown: true },
    { key: 'sales_price', label: '販売価格', numeric: true, defaultShown: true },
    { key: 'land_cost', label: '内土地代', numeric: true, defaultShown: false },
    { key: 'sales_period', label: '販売期間', defaultShown: true },
    { key: 'spec', label: '仕様', defaultShown: true },
    { key: 'plan', label: 'プラン', defaultShown: false },
    { key: 'usage_type', label: '用途', numeric: true, defaultShown: false },
    { key: 'customer_name', label: 'お客様名', defaultShown: false },
    { key: 'contract_staff', label: '契約担当', defaultShown: true },
    { key: 'site_staff', label: '現場管理/営業担当', defaultShown: false },
    { key: 'design_staff', label: '設計', defaultShown: false },
    { key: 'construction_staff', label: '施工管理', defaultShown: false },
    { key: 'foundation_start_date', label: '基礎着工日', defaultShown: false },
    { key: 'desired_start_date', label: '着工希望日', defaultShown: false },
    { key: 'completion_date', label: '完工日', defaultShown: false },
    { key: 'exterior_completion_date', label: '外構完了', defaultShown: false },
    { key: 'permit_date', label: '確認許可日', defaultShown: false },
    { key: 'contract_recorded_date', label: '契約計上日', defaultShown: true },
    { key: 'payment_date', label: '入金日', defaultShown: false },
    { key: 'delivery_date', label: '引渡日', defaultShown: true },
    { key: 'portal_posted_date', label: 'ポータル掲載日', defaultShown: false },
    { key: 'kaeru_hp_posted_date', label: 'かえるHP掲載', defaultShown: false },
    { key: 'price_changed_date', label: '販売価格変更日', defaultShown: false },
    { key: 'previous_sales_price', label: '変更前販売価格', numeric: true, defaultShown: false },
    { key: 'ground_improvement', label: '地盤改良', numeric: true, defaultShown: false },
    { key: 'schedule_created', label: '工程表作成済み', numeric: true, defaultShown: false },
    { key: 'land_id', label: '土地ID', numeric: true, defaultShown: false },
    { key: 'property_id_general', label: '物件ID（一般）', numeric: true, defaultShown: false },
    { key: 'property_id_manager', label: 'ID（管理職）', numeric: true, defaultShown: false },
    { key: 'purchase_settlement_date', label: '決済日（仕入）', defaultShown: false },
    { key: 'purchase_contract_date', label: '契約日（仕入）', defaultShown: false },
    { key: 'lat_lng', label: '位置情報', defaultShown: false },
    { key: 'updated', label: '最終更新', defaultShown: false },
    { key: 'updated_by', label: '更新者', defaultShown: false },
];

/** ⚠️ トグルの2列は列の選択から外している（⚠️ 常に出す。この画面の主目的のため） */
const TOGGLES: { key: string; label: string }[] = [
    { key: 'ad_posted', label: '広告出稿' },
    { key: 'instagram_posted', label: 'Instagram' },
];

/** ⚠️ 選んだ列を憶えておく。⚠️ 40列から毎回選び直すのは現実的でない */
const STORAGE_KEY = 'satbase_visible_columns';

/** v2.2.309 1回に読む件数（1画面に収まる程度）。表の下の端からこの高さ（px）まで近づいたら次を読む */
const PAGE_SIZE = 30;
const LOAD_MORE_MARGIN = 200;
/** 既定の並び（物件IDの新しい順） */
const DEFAULT_SORT = { key: 'property_id', dir: 'desc' as 'asc' | 'desc' };

const defaultVisible = (): string[] => COLUMNS.filter(c => c.defaultShown).map(c => c.key);

const loadVisible = (): string[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return defaultVisible();
        const parsed = JSON.parse(saved) as string[];
        // ⚠️ 列を減らしたときに備えて、実在する列だけに絞る
        const known = parsed.filter(key => COLUMNS.some(c => c.key === key));
        return known.length > 0 ? known : defaultVisible();
    } catch {
        return defaultVisible();
    }
};

const formatValue = (column: Column, value: string | number | null): string => {
    if (value === null || value === undefined || value === '') return '';
    if (column.numeric && column.key !== 'property_id'
        && column.key !== 'property_id_general' && column.key !== 'property_id_manager'
        && column.key !== 'land_id' && column.key !== 'usage_type'
        && column.key !== 'schedule_created') {
        const num = Number(value);
        return isNaN(num) ? String(value) : num.toLocaleString();
    }
    // ⚠️ 日付は `2026-09-22T00:00:00.000Z` で返ることがあるので日付だけにする
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
};

/** 今日（利用者の PC の日付。予備のときのカードの数に使う） */
const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY_OPTIONS: SatbaseOptions = { progress: [], sales: [], pref: [], team: [] };

const SatBaseDatabase = () => {
    const { authority } = useContext(AuthContext);
    const isMaster = authority === 'Master';
    const [importOpen, setImportOpen] = useState(false);

    /** 開いたときの URL の条件（⚠️ state の初期値にだけ使う） */
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const urlValue = (key: string) => initUrl.get(key) ?? '';
    const urlFlag = (key: string) => (urlValue(key) === '0' || urlValue(key) === '1' ? urlValue(key) : '');

    /**
     * ふだん（serverMode）は ② の satbase_page で30件ずつ（loadedRows・total・kpi・options）。
     * ⚠️ ② に届かないときは serverMode を false にして、POST の satbase_list（全件）を allRows に読み、画面で絞る。
     */
    const [serverMode, setServerMode] = useState(true);
    const [loadedRows, setLoadedRows] = useState<Property[]>([]);
    const [total, setTotal] = useState(0);
    const [serverKpi, setServerKpi] = useState<SatbaseKpi | null>(null);
    const [serverOptions, setServerOptions] = useState<SatbaseOptions>(EMPTY_OPTIONS);
    const [allRows, setAllRows] = useState<Property[]>([]);
    const [shownCount, setShownCount] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState<string>('');
    const listSeqRef = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    /* 絞り込み（⚠️ キーは ② に送るキー・URL のキーと同じ。文字の検索は 300ms 待ってから） */
    const keywordSearch = useDebounce(urlValue('keyword'), 300);
    const keyword = keywordSearch.debouncedValue;
    const [progressStatus, setProgressStatus] = useState(urlValue('progress'));
    const [salesStatus, setSalesStatus] = useState(urlValue('sales'));
    const [prefecture, setPrefecture] = useState(urlValue('pref'));
    const [team, setTeam] = useState(urlValue('team'));
    /**
     * ⚠️ トグル2列の絞り込み。'' = すべて / '1' = 済み / '0' = 未。
     *   ⚠️ 数値ではなく文字列で持つ（`0` を偽と判定して「未」が「すべて」と同じ挙動になるのを防ぐ）。
     */
    const [adPosted, setAdPosted] = useState(urlFlag('ad'));
    const [instagramPosted, setInstagramPosted] = useState(urlFlag('insta'));
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>(() => ({
        key: SATBASE_SORT_KEYS.includes(urlValue('sort')) ? urlValue('sort') : DEFAULT_SORT.key,
        dir: urlValue('dir') === 'asc' ? 'asc' : urlValue('dir') === 'desc' ? 'desc' : DEFAULT_SORT.dir,
    }));

    /* 表示する列 */
    const [visible, setVisible] = useState<string[]>(loadVisible);
    const [columnPanel, setColumnPanel] = useState(false);

    /** ② に送る条件（⚠️ URL にも出す。既定の並びと空の条件は出さない） */
    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        const add = (k: string, v: string) => { if (v.trim() !== '') p[k] = v; };
        add('keyword', keyword);
        add('progress', progressStatus);
        add('sales', salesStatus);
        add('pref', prefecture);
        add('team', team);
        add('ad', adPosted);
        add('insta', instagramPosted);
        if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) {
            p.sort = sort.key;
            p.dir = sort.dir;
        }
        return p;
    }, [keyword, progressStatus, salesStatus, prefecture, team, adPosted, instagramPosted, sort]);
    useListUrlSync(listParams, 1, 20, []);

    /** offset 件目から limit 件を GET で読む。replace＝読み込み済みを入れ替える（条件を変えた・読み直し） */
    const fetchPage = async (offset: number, limit: number, replace: boolean) => {
        const seq = ++listSeqRef.current;
        setLoading(true);
        try {
            const res = await apiClient.get('', { params: { request: 'satbase_page', ...listParams, offset, limit } });
            if (seq !== listSeqRef.current) return;
            const data = res?.data;
            if (!data || data.status !== 'ok' || !Array.isArray(data.rows)) throw new Error('invalid satbase_page response');
            setLoadedRows(prev => (replace ? data.rows : [...prev.slice(0, offset), ...data.rows]));
            setTotal(Number(data.total) || 0);
            setServerKpi(data.kpi ?? null);
            setServerOptions(data.options ?? EMPTY_OPTIONS);
            setError('');
            setLoading(false);
        } catch (e) {
            if (seq !== listSeqRef.current) return;
            console.error('satbase_page に失敗しました。全件の読み込みに切り替えます:', e);
            setServerMode(false);
        }
    };

    /** 予備：今までの POST の satbase_list（全件） */
    const fetchAll = async () => {
        setLoading(true);
        try {
            const res = await apiClient.post('', { request: 'satbase_list' });
            setAllRows((res.data?.properties ?? []) as Property[]);
            setError('');
        } catch (e) {
            console.error(e);
            setError('物件データを取得できませんでした。時間をおいて再度お試しください。');
        } finally {
            setLoading(false);
        }
    };

    /** 物件更新（CSV）のあと：読み込み済みの範囲を読み直す */
    const reloadList = () => {
        if (serverMode) void fetchPage(0, Math.max(PAGE_SIZE, loadedRows.length), true);
        else void fetchAll();
    };

    // 条件を変えたら初めの30件から（⚠️ setTimeout(0) で StrictMode の2回の effect を1回にまとめる）
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        if (!serverMode) { setShownCount(PAGE_SIZE); return; }
        const timer = window.setTimeout(() => { void fetchPage(0, PAGE_SIZE, true); }, 0);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode, listParams]);

    // ⚠️ 全件の読み込みは、② に届かなかったとき（serverMode が false）だけ
    useEffect(() => {
        if (!serverMode) void fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode]);

    /** 予備のときの絞り込み・並べ替え（② と同じ式） */
    const processedFallback = useMemo(() => (serverMode ? [] : filterAndSortSatbase(allRows, {
        keyword, progress: progressStatus, sales: salesStatus, pref: prefecture, team, ad: adPosted, insta: instagramPosted,
    }, sort.key, sort.dir)), [serverMode, allRows, keyword, progressStatus, salesStatus, prefecture, team, adPosted, instagramPosted, sort]);

    const rows = serverMode ? loadedRows : processedFallback.slice(0, shownCount);
    const totalCount = serverMode ? total : processedFallback.length;
    const hasMore = rows.length < totalCount;
    const kpi = useMemo(
        () => (serverMode ? serverKpi : satbaseKpiOf(processedFallback, todayLocal())),
        [serverMode, serverKpi, processedFallback]);
    const options = useMemo(
        () => (serverMode ? serverOptions : satbaseOptionsOf(allRows)),
        [serverMode, serverOptions, allRows]);

    /** 表の下の端に近づいたら次の30件（スクロールのたびと、読み終わったとき。⚠️ 1画面に収まって下の端が見えたままのときも続けて読む） */
    const loadMoreIfNearBottom = () => {
        const el = scrollRef.current;
        if (!el || loading || !hasMore || el.scrollHeight - el.scrollTop - el.clientHeight >= LOAD_MORE_MARGIN) return;
        if (serverMode) void fetchPage(loadedRows.length, PAGE_SIZE, false);
        else setShownCount(c => c + PAGE_SIZE);
    };
    useEffect(() => {
        loadMoreIfNearBottom();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, rows.length, totalCount]);

    const shownColumns = useMemo(() => COLUMNS.filter(c => visible.includes(c.key)), [visible]);

    const saveVisible = (next: string[]) => {
        setVisible(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ⚠️ プライベートウィンドウ等で保存できなくても、画面は動かす
        }
    };
    const toggleColumn = (key: string) =>
        saveVisible(visible.includes(key) ? visible.filter(k => k !== key) : [...visible, key]);

    /** 見出しを押したとき：同じ列なら向きを変え、別の列なら新しい順（大きい順）から */
    const requestSort = (key: string) =>
        setSort(s => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
    const sortIcon = (key: string) => (
        <span className={`sb_sort_icon${sort.key === key ? ' is_active' : ''}`}>
            {sort.key !== key ? '↕' : sort.dir === 'asc' ? '▲' : '▼'}
        </span>
    );

    /**
     * トグルの更新。⚠️ 先に画面を書き換えてから送る（待たせない）。⚠️ 失敗したら元に戻す
     * （戻さないと、保存できていないのに保存できたように見えたままになる）。
     */
    const toggle = async (property: Property, column: string) => {
        const propertyId = Number(property.property_id);
        const before = Number(property[column] ?? 0);
        const after = before === 1 ? 0 : 1;
        const patch = (value: number) => (current: Property[]) =>
            current.map(p => (Number(p.property_id) === propertyId ? { ...p, [column]: value } : p));

        setSaving(`${propertyId}:${column}`);
        setLoadedRows(patch(after));
        setAllRows(patch(after));
        try {
            const res = await apiClient.post('', { request: 'satbase_update', propertyId, column, value: after });
            if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '更新できませんでした。');
            setError('');
        } catch (e) {
            console.error(e);
            setLoadedRows(patch(before));
            setAllRows(patch(before));
            setError('更新できませんでした。通信の状態を確認して、もう一度お試しください。');
        } finally {
            setSaving('');
        }
    };

    const fyLabel = kpi ? `${kpi.fyStart.slice(0, 4)}年6月〜今日` : '';
    const colCount = TOGGLES.length + shownColumns.length;

    return (
        <div className="sb_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル（接頭辞 sb_）。共通CSSを汚さない。見た目は GoogleReview.tsx にそろえる */}
            <style>{`
                .sb_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 16px 40px 20px; box-sizing: border-box; }
                .sb_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; min-height: 0; flex: 1; }
                .sb_head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .sb_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .sb_note { font-size: 11px; color: #6b7280; }
                .sb_btn { font-size: 12px; padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 999px;
                          background: #fff; color: #374151; cursor: pointer; white-space: nowrap; }
                .sb_btn:hover { background: #f3f4f6; }
                .sb_btn.is_on { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
                .sb_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .sb_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sb_input, .sb_select { font-size: 12px; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px;
                                        background: #fff; color: #1f2937; }
                .sb_input { width: 220px; }
                .sb_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .sb_kpi_card { flex: 1 1 150px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sb_kpi_label { font-size: 11px; color: #6b7280; }
                .sb_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sb_kpi_sub { font-size: 10px; color: #9ca3af; }
                .sb_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .sb_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca;
                            border-radius: 8px; padding: 6px 12px; }
                .sb_panel { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; background: #fff; flex-shrink: 0; }
                .sb_panel_head { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
                .sb_panel_list { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px 18px; }
                .sb_check { font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
                .sb_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; flex: 1 1 auto; min-height: 0; }
                .sb_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sb_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 12px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap;
                         cursor: pointer; user-select: none; text-align: left; }
                .sb_th:hover { background: #eef2f7; }
                .sb_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sb_sort_icon.is_active { color: #2563eb; }
                .sb_td { border-bottom: 1px solid #f1f5f9; padding: 8px 12px; white-space: nowrap; vertical-align: middle; }
                .sb_row:hover > .sb_td { background: #f8fafc; }
                .sb_num { text-align: right; font-variant-numeric: tabular-nums; }
                .sb_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; }
                .sb_empty { color: #9ca3af; font-size: 12px; text-align: center; padding: 24px; }
                .sb_more { color: #6b7280; font-size: 11px; padding: 10px 12px; }
                .sb_toggle { width: 38px; height: 20px; border-radius: 999px; border: none; background: #d1d5db;
                             position: relative; cursor: pointer; padding: 0; transition: background 0.15s; }
                .sb_toggle[data-on="1"] { background: #2563eb; }
                .sb_toggle:disabled { opacity: 0.5; cursor: wait; }
                .sb_knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
                           background: #fff; transition: transform 0.15s; }
                .sb_toggle[data-on="1"] .sb_knob { transform: translateX(18px); }
                @media (max-width: 900px) { .sb_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sb_inner">
                {/* ⚠️ ボタンは左に並べる（右下の Active users の表示に隠れるため） */}
                <div className="sb_head mb-2">
                    <span className="sb_title">
                        <i className="fa-solid fa-building me-2 text-primary" aria-hidden="true" />
                        SatBaseサマリー
                    </span>
                    <button className={`sb_btn${columnPanel ? ' is_on' : ''}`} onClick={() => setColumnPanel(v => !v)}>
                        <i className="fa-solid fa-table-columns me-1" aria-hidden="true" />表示項目（{shownColumns.length}/{COLUMNS.length}）
                    </button>
                    {isMaster && (
                        <button className="sb_btn" onClick={() => setImportOpen(true)}>
                            <i className="fa-solid fa-file-csv me-1" aria-hidden="true" />物件更新
                        </button>
                    )}
                    <span className="sb_note">建売の物件台帳（SatBase）の写しです。数字は、最後に「物件更新」で取り込んだときのものです。</span>
                </div>

                {error !== '' && <div className="sb_error mb-2">{error}</div>}

                <div className="sb_bar mb-3">
                    <div>
                        <div className="sb_label">物件名称・物件ID</div>
                        <input className="sb_input" placeholder="例: 国分広瀬" value={keywordSearch.inputValue} onChange={keywordSearch.onChange} />
                    </div>
                    {([
                        ['工程状況', progressStatus, setProgressStatus, options.progress],
                        ['販売状況', salesStatus, setSalesStatus, options.sales],
                        ['県', prefecture, setPrefecture, options.pref],
                        ['チーム（係）', team, setTeam, options.team],
                    ] as [string, string, (v: string) => void, string[]][]).map(([label, value, set, list]) => (
                        <div key={label}>
                            <div className="sb_label">{label}</div>
                            <select className="sb_select" value={value} onChange={(e) => set(e.target.value)}>
                                <option value="">すべて</option>
                                {/* ⚠️ URL の値が選択肢に無くても見えるように足す */}
                                {(value !== '' && !list.includes(value) ? [value, ...list] : list).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                    ))}
                    <div>
                        <div className="sb_label">広告出稿</div>
                        <select className="sb_select" value={adPosted} onChange={(e) => setAdPosted(e.target.value)}>
                            <option value="">すべて</option>
                            <option value="1">出稿済み</option>
                            <option value="0">未出稿</option>
                        </select>
                    </div>
                    <div>
                        <div className="sb_label">Instagram</div>
                        <select className="sb_select" value={instagramPosted} onChange={(e) => setInstagramPosted(e.target.value)}>
                            <option value="">すべて</option>
                            <option value="1">投稿済み</option>
                            <option value="0">未投稿</option>
                        </select>
                    </div>
                    <span className="sb_note">
                        {totalCount.toLocaleString()} 件中 {rows.length.toLocaleString()} 件を表示
                        {hasMore && '（下へスクロールすると続きを読みます）'}
                    </span>
                </div>

                <div className="sb_kpi mb-3">
                    {([
                        ['該当件数', kpi?.total, '絞り込んだ物件'],
                        ['今期の着工棟数', kpi?.started, fyLabel],
                        ['着工予定', kpi?.planned, '基礎着工日が明日以降'],
                        ['建築中', kpi?.building, '工程状況'],
                        ['販売中', kpi?.selling, '販売状況'],
                        ['販売中で広告未出稿', kpi?.sellingNoAd, '広告出稿のトグルが未'],
                    ] as [string, number | undefined, string][]).map(([label, value, sub]) => (
                        <div className="sb_kpi_card" key={label}>
                            <div className="sb_kpi_label">{label}</div>
                            <div className="sb_kpi_value" style={label === '販売中で広告未出稿' && (value ?? 0) > 0 ? { color: '#b45309' } : undefined}>
                                {value === undefined ? '…' : value.toLocaleString()}
                            </div>
                            <div className="sb_kpi_sub">{sub}</div>
                        </div>
                    ))}
                </div>

                <div className="sb_caution mb-2">
                    着工棟数・着工予定は、用途が建売の物件（モデルハウス・注文・土地のみは含めない）を「基礎着工日」で数えます。キャンセルの物件は数えません。
                    今期は6月から今日までです。カードの数は、上の絞り込みに合う物件から数えます。
                </div>

                {columnPanel && (
                    <div className="sb_panel mb-2">
                        <div className="sb_panel_head">
                            <span>表示する項目</span>
                            <button className="sb_btn" onClick={() => saveVisible(defaultVisible())}>既定に戻す</button>
                        </div>
                        <div className="sb_panel_list">
                            {COLUMNS.map(c => (
                                <label key={c.key} className="sb_check">
                                    <input type="checkbox" checked={visible.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                                    {c.label}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="sb_table_wrap" ref={scrollRef} onScroll={loadMoreIfNearBottom}>
                    <table className="sb_table">
                        <thead>
                            <tr>
                                {[...TOGGLES, ...shownColumns].map(c => (
                                    <th key={c.key} className="sb_th" onClick={() => requestSort(c.key)}>{c.label}{sortIcon(c.key)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(p => (
                                <tr key={String(p.property_id)} className="sb_row">
                                    {TOGGLES.map(t => (
                                        <td key={t.key} className="sb_td">
                                            <button
                                                className="sb_toggle"
                                                data-on={Number(p[t.key] ?? 0) === 1 ? '1' : '0'}
                                                disabled={saving === `${Number(p.property_id)}:${t.key}`}
                                                onClick={() => void toggle(p, t.key)}
                                                aria-label={`${p.property_name} の${t.label}`}
                                            >
                                                <span className="sb_knob" />
                                            </button>
                                        </td>
                                    ))}
                                    {shownColumns.map(c => (
                                        <td key={c.key} className={`sb_td${c.numeric ? ' sb_num' : ''}`}>
                                            {(c.key === 'progress_status' || c.key === 'sales_status') && p[c.key]
                                                ? <span className="sb_tag">{formatValue(c, p[c.key] ?? null)}</span>
                                                : formatValue(c, p[c.key] ?? null)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td className="sb_td sb_empty" colSpan={colCount}>{loading ? '読み込み中…' : '条件に合う物件がありません。'}</td></tr>
                            )}
                            {rows.length > 0 && (hasMore || loading) && (
                                <tr>
                                    <td className="sb_more" colSpan={colCount}>
                                        {loading ? <><span className="spinner-border spinner-border-sm me-1" style={{ width: '.8rem', height: '.8rem' }} />読み込み中…</> : '下へスクロールすると続きを読みます'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isMaster && <SatBaseImport show={importOpen} setShow={setImportOpen} onImported={reloadList} />}
        </div>
    );
};

export default SatBaseDatabase;
