import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useState, useContext, useMemo, useId } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import Logo from '../assets/images/logo.png';
import Estate from './Estate';
import { useIsSp } from '../utils/isSp';
import apiClient from "../utils/apiClient";
import { isPendingSync } from './list/listTags';
import { missingLostFields } from '../utils/informationUtils';
import RealtyMenu from './realty/RealtyMenu';
import GuideSearchPanel, { GuideListItem, divisionColorOf, divisionLabelOf, fetchGuideListOnce } from './guide/GuideSearchPanel';
import { GUIDE_COMMON, allowedGuideDivisions, isGuideCategory, openGuide } from './guide/openGuide';

type UnSync = { inquiry_date: string, sync: number, duplicate_flag: number, support_flag: number, black_flag: number };
type Cancel = Record<string, string>;
type Props = {
    key: number,
    onReload: () => void
};

// 💡 メニュー項目の型定義
type Badge = { label: string; top: string };
type MenuItem = {
    id: string;
    path: string;
    icon: string;
    // 💡 string から React.ReactNode に変更することで <span> 等のJSXが使用可能になります
    label: React.ReactNode;
    show: boolean;               // 表示条件
    exact?: boolean;             // パスの完全一致でアクティブ判定をするか
    activePaths?: string[];      // 複数のパスでアクティブ判定する場合
    isAdminOnly?: boolean;       // 管理者バッジを表示するか
    badges?: Badge[];            // 通知バッジの設定
};

/**
 * 進行中（または完了済み）の menu リクエスト。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **Menu は App.tsx で2箇所にマウントされている。**
 *   PC用（`.modal_menu`）とスマホ用（`.modal_menu_sp`）の両方が常に
 *   マウントされ、CSS で見た目だけを切り替えている。
 *   ⚠️ そのため何もしないと **useEffect が2回走り、同じデータを2回取る。**
 *     2026-09-14 の実測では 18.2MB を2回（3.25秒 / 2.88秒）取得していた。
 *
 * ⚠️ どちらか片方だけレンダリングする形にはできない。
 *   `useIsSp()` の初期値が false（PC扱い）なので、スマホでは
 *   「PC用がマウント → useEffect で判定 → 差し替え」となり**結局2回走る。**
 *
 * ⚠️ `key`（再読み込みのたびに変わる）が同じ間は同じ Promise を返す。
 *   完了後も保持するので、2つ目のインスタンスが後からマウントされても
 *   再取得しない。
 * ─────────────────────────────────────────────
 */
let menuRequest: { key: number, promise: Promise<any> } | null = null;

const fetchMenuOnce = (key: number) => {
    if (menuRequest && menuRequest.key === key) return menuRequest.promise;
    menuRequest = { key, promise: apiClient.post("", { request: "menu" }) };
    return menuRequest.promise;
};

const Menu = ({ key, onReload }: Props) => {
    const { authority, category, version, shopName } = useContext(AuthContext);
    const location = useLocation();
    const currentPath = location.pathname;
    const fullPath = location.pathname + location.search;
    const navigate = useNavigate();
    const isSp = useIsSp();

    /**
     * サーバーが数えた件数。
     * ⚠️ null なら旧形式（全件を受け取ってフロントで数える）。
     *   ⚠️ ① と ② の両方が新しい形になったら、旧経路ごと消してよい。
     */
    const [serverCounts, setServerCounts] = useState<{ sync: number, cancel: number, lost: number } | null>(null);
    const [unSyncList, setUnSyncList] = useState<UnSync[]>([]);
    const [sync, setSync] = useState(0);
    const [cancelList, setCancelList] = useState<Cancel[]>([]);
    const [cancel, setCancel] = useState(0);
    const [lost, setLost] = useState(0);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [estateId, setEstateId] = useState('');

    /**
     * 業務ガイドの検索（v2.2.198）。⚠️ 記事の一覧は最初に文字を入れたときに取る（⚠️ メニューを開くたびには取らない）。
     * ⚠️ 選んだ記事は PC なら右側（GuideSearchPanel）、スマホなら業務ガイドの窓で開く。
     */
    const [searchGuide, setSearchGuide] = useState('');
    const [guideList, setGuideList] = useState<GuideListItem[] | null>(null);
    const [guideListFailed, setGuideListFailed] = useState(false);
    const [guideActive, setGuideActive] = useState(0);
    const [guideId, setGuideId] = useState<number | null>(null);
    /** ⚠️ Menu は2回マウントされるので、候補の id は useId で分ける */
    const guideListId = useId();
    const canSearchGuide = isGuideCategory(category) && allowedGuideDivisions(authority, category, shopName).length > 0;

    const dateFormate = (value: string) => (value ?? '').replace(/\//g, '-');

    useEffect(() => {
        const fetchData = async () => {
            // ⚠️ 2箇所からマウントされるので、同じ key の間は1回しか取りに行かない
            const response = await fetchMenuOnce(key);
            const data = response.data ?? {};

            // ⚠️⚠️ **新旧どちらの応答でも動くようにしてある。**
            //   2026-09-14 にサーバー側で COUNT するよう変えた（18.2MB → 数十バイト）。
            //   ⚠️ ① と ② のどちらが応答するかで形が変わりうるため、
            //     デプロイの順序やフォールバックで壊れないよう両対応にしている。
            //   ⚠️ ① と ② の両方が新しい形になったら、下の旧経路は消してよい。
            if (typeof data.sync === 'number') {
                setServerCounts({ sync: data.sync, cancel: data.cancel ?? 0, lost: data.lost ?? 0 });
            } else {
                // 旧形式（全件を受け取ってフロントで数える）
                setServerCounts(null);
                setUnSyncList(data.inquiry ?? []);
                setCancelList(data.customer ?? []);
            }
        };
        fetchData();
        setMonthArray(getYearMonthArray(2025, 1).slice(5));
    }, [key]);

    useEffect(() => {
        // ⚠️ サーバーが数えてくれた場合はそのまま使う
        if (serverCounts) {
            setSync(serverCounts.sync);
            return;
        }
        const total = unSyncList.filter(c => {
            return monthArray.includes(c.inquiry_date.slice(0, 7)) && isPendingSync(c);
        }).length;
        setSync(total);
    }, [unSyncList, monthArray, serverCounts]);

    useEffect(() => {
        // ⚠️ サーバーが数えてくれた場合はそのまま使う
        if (serverCounts) {
            setCancel(serverCounts.cancel);
            setLost(serverCounts.lost);
            return;
        }
        const cancelLength = cancelList.filter(item => {
            const now = new Date();
            const today = now.getTime();
            const target = new Date(dateFormate(item.reserved_interview)).getTime();
            const base = new Date('2026-01-01').getTime();
            return target < today && base < target && (!item.interview && !item.cancel_status) && item.status !== '重複'
        }).length;
        setCancel(cancelLength);

        const lostLength = cancelList.filter(item => {
            const now = new Date();
            const today = now.getTime();
            const target = new Date(dateFormate(item.register)).getTime();
            const base = new Date('2026-06-01').getTime();
            /**
             * ⚠️⚠️ **判定は informationUtils の `missingLostFields()` に集約した**
             *   （2026-09-17）。⚠️ 以前はここに条件が写されており、
             *   ⚠️ **② が数えなかったときだけ古い基準の件数が出ていた。**
             * ⚠️ ここで条件を書き足さないこと。
             */
            return target < today && base < target && item.status === '失注' && missingLostFields(item).length > 0 && Number(item.trash) === 1;
        }).length
        setLost(lostLength);
    }, [cancelList, serverCounts]);

    const handleNavigate = (path: string) => {
        setGuideId(null);
        navigate(path, { state: { authority } });
    };

    // ⚠️ ページ・事業を移ったら記事を閉じる（⚠️ 記事の「画面を開く」で移ったときも）
    useEffect(() => { setGuideId(null); }, [fullPath, category]);

    const loadGuideList = () => {
        setGuideListFailed(false);
        fetchGuideListOnce().then(setGuideList).catch(() => setGuideListFailed(true));
    };

    const onSearchGuide = (value: string) => {
        setSearchGuide(value);
        setGuideActive(0);
        if (guideList === null && value.trim() !== '') loadGuideList();
    };

    /** 候補。⚠️ タイトルに含むもの・いまの事業と全事業共通の記事だけ・公開中だけ */
    const guideKeyword = searchGuide.trim().toLowerCase();
    const guideSuggestions = useMemo(() => {
        if (guideKeyword === '' || guideList === null) return [];
        return guideList
            .filter((a) => a.published !== 0 && (a.division === category || a.division === GUIDE_COMMON))
            .filter((a) => a.title.toLowerCase().includes(guideKeyword))
            .slice(0, GUIDE_SUGGEST_MAX);
    }, [guideList, guideKeyword, category]);

    const chooseGuide = (item: GuideListItem) => {
        setSearchGuide('');
        if (isSp) { openGuide(item.title); return; }
        setGuideId(item.id);
    };

    const onSearchGuideKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') { setSearchGuide(''); return; }
        if (guideSuggestions.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setGuideActive((i) => (i + 1) % guideSuggestions.length); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setGuideActive((i) => (i - 1 + guideSuggestions.length) % guideSuggestions.length); }
        if (e.key === 'Enter') { e.preventDefault(); chooseGuide(guideSuggestions[Math.min(guideActive, guideSuggestions.length - 1)]); }
    };

    /** タイトルの一致した部分に印を付ける */
    const markMatch = (title: string): React.ReactNode => {
        const at = title.toLowerCase().indexOf(guideKeyword);
        if (at < 0) return title;
        return <>{title.slice(0, at)}<mark>{title.slice(at, at + guideKeyword.length)}</mark>{title.slice(at + guideKeyword.length)}</>;
    };

    const checkIsActive = (item: MenuItem) => {
        if (item.activePaths) return item.activePaths.some(p => fullPath.includes(p));
        return item.exact ? fullPath === item.path : fullPath.includes(item.path);
    };

    const categoryMapping = {
        'order': { label: '注文営業', class: 'text-white bg-primary rounded px-2 py-0 ms-1' },
        'spec': { label: '建売営業', class: 'text-white bg-success rounded px-2 py-0 ms-1' },
        'used': { label: '中古リノベ', class: 'text-white bg-warning rounded px-2 py-0 ms-1' },
        'realty': { label: '不動産企画係', class: 'text-white bg-info rounded px-2 py-0 ms-1' },
    };

    const MENU_CONFIG: MenuItem[] = useMemo(() => [
        { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'realty', exact: true },
        // ⚠️ v2.2.225: 不動産企画係（category = realty）の項目は realty/RealtyMenu.tsx に移した（以前のアプリと同じ並び・見出し）
        {
            id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
            badges: (category === 'order' && sync > 0) ? [{ label: `未同期 ${sync}件`, top: '8px' }] : []
        },
        { id: 'list_renove', path: '/list?shop=renove', icon: 'fa-phone', label: '反響一覧', show: category === 'used', exact: true },
        {
            id: 'database', path: '/database', icon: 'fa-magnifying-glass', label: '顧客DB', show: category !== 'realty', exact: true,
            badges: category === 'order' ? [
                cancel > 0 ? { label: `来場未入力 ${cancel}件`, top: '2px' } : null,
                lost > 0 ? { label: `失注未入力 ${lost}件`, top: '16px' } : null
            ].filter(Boolean) as Badge[] : []
        },
        { id: 'rank', path: '/rank', icon: 'fa-person', label: '店舗・担当別反響', show: category !== 'realty', exact: true },
        { id: 'map', path: '/map', icon: 'fa-map', label: '反響MAP', show: category !== 'realty', exact: true },
        /**
         * ⚠️ 建売（spec）も 2026-09-16 から表示する。
         *   ⚠️ 画面（customer/CustomerKaeru.tsx）も ② の `customer:spec` も
         *     **元からあった**が、ここが `order` だけだったため
         *     ⚠️ **URL を直接開かないと辿り着けなかった。**
         *   ⚠️ `used`（中古）は画面が無いので出さない。
         */
        { id: 'customer', path: '/customer', icon: 'fa-mobile-screen', label: '販促媒体別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        /**
         * ⚠️⚠️ **建売（spec）にも出す**（2026-09-18 の指示で**戻した**）。
         *   ⚠️ 経緯: 2026-09-11 に `ShopKaeru.tsx` を足して spec にも出していたが、
         *     ⚠️ 2026-09-16 に「要件を整理するので一旦消す」と言われて外していた。
         *     ⚠️ ⚠️ **画面（shop/ShopKaeru.tsx）と ② の `shop:spec` は消していない**ので、
         *       この1行を戻すだけで済んだ。
         *   ⚠️ `used`（中古）は画面が無いので元から出していない。
         *
         * ⚠️⚠️ **建売では「販促媒体別広告費」と契約率の分母が違う**（2026-09-18 時点）。
         *   店舗別広告費（ShopKaeru） … 契約率 ＝ 契約 ÷ **接触数**
         *   販促媒体別広告費（CustomerKaeru） … 契約率 ＝ 契約 ÷ **申込**
         *   ⚠️ **同じ名前の列で数字が違う。** 揃えるかは利用者の判断を待っている。
         */
        { id: 'shop', path: '/shop', icon: 'fa-chart-pie', label: '店舗別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        { id: 'customerTrend', path: '/customerTrend', icon: 'fa-chart-bar', label: '販促媒体別反響推移', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'realty', exact: true },
        { id: 'calendar', path: '/calendar', icon: 'fa-calendar', label: 'カレンダー', show: !isSp && category === 'order', exact: true },
        { id: 'property_spec', path: '/property', icon: 'fa-house', label: '物件DB', show: !isSp && category === 'spec', exact: false },
        { id: 'campaign', path: '/campaign', activePaths: ['/campaign', '/editcampaign'], icon: 'fa-calendar-days', label: 'キャンペーン管理', show: !isSp && category === 'order' && (authority === "BrandAdmin" || authority === "Master"), isAdminOnly: true },
        { id: 'budget', path: '/budget', icon: 'fa-money-check', label: '予算詳細', show: !isSp && (authority === "BrandAdmin" || authority === "Master"), exact: false, isAdminOnly: true },
        { id: 'photo', path: '/photo', icon: 'fa-camera', label: 'K-snap登録', show: !isSp && category === 'order', exact: false },
        { id: 'photo', path: '/insideSales', icon: 'fa-camera', label: 'ISカレンダー', show: (authority === 'insideSales' || authority === 'Master') && category === 'order', exact: false, isAdminOnly: true },
    ], [isSp, category, authority, sync, cancel, lost]);

    if (currentPath === '/login' || currentPath === '/home') return null;

    return (
        <>
            <div className="d-md-flex flex-column p-2" style={{ height: '100vh', borderRight: '1px solid #D3D3D3', overflowY: 'auto' }}>
                <div className="menuLogo m-3 position-relative" style={{ cursor: 'pointer' }} onClick={() => handleNavigate("/home")}>
                    <img src={Logo} alt="PG-CLOUDダッシュボード" className="w-100" />
                    <div style={{ fontSize: '10px', bottom: '-10px', right: '0' }} className="position-absolute">
                        ver{version}
                        <span style={{ fontSize: '8px', textAlign: 'center' }} className={categoryMapping[category as keyof typeof categoryMapping]?.class || ''}>
                            {categoryMapping[category as keyof typeof categoryMapping]?.label || ''}
                        </span>
                    </div>
                </div>

                {canSearchGuide && (
                    <div className="mg_search">
                        <style>{GUIDE_SEARCH_CSS}</style>
                        <div className="mg_box">
                            <i className="fa-solid fa-book-open mg_icon" aria-hidden="true"></i>
                            <input type="search" className="mg_input" placeholder="業務ガイドを探す" value={searchGuide}
                                onChange={(e) => onSearchGuide(e.target.value)} onKeyDown={onSearchGuideKey}
                                role="combobox" aria-label="業務ガイドの記事を探す" aria-controls={guideListId} aria-expanded={guideKeyword !== ''} />
                        </div>
                        {guideKeyword !== '' && (
                            <ul className="mg_suggest" id={guideListId} role="listbox" aria-label="業務ガイドの記事">
                                {guideListFailed ? (
                                    <li className="mg_note">読み込めませんでした。<button type="button" className="mg_retry" onClick={loadGuideList}>もう一度</button></li>
                                ) : guideList === null ? (
                                    <li className="mg_note">読み込み中…</li>
                                ) : guideSuggestions.length === 0 ? (
                                    <li className="mg_note">該当する記事がありません</li>
                                ) : guideSuggestions.map((a, i) => (
                                    <li key={a.id} role="option" aria-selected={i === guideActive}
                                        className={`mg_item${i === guideActive ? ' is_active' : ''}`}
                                        onMouseEnter={() => setGuideActive(i)} onClick={() => chooseGuide(a)}>
                                        <span className="mg_title">{markMatch(a.title)}</span>
                                        <span className="mg_sub">
                                            <span className="mg_div" style={{ '--mg-div': divisionColorOf(a.division) } as React.CSSProperties}>{divisionLabelOf(a.division)}</span>
                                            {a.section}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* ⚠️ v2.2.225: 不動産企画係は以前のアプリと同じ並び・見出しの専用メニュー（realty/RealtyMenu.tsx） */}
                {category === 'realty' && (
                    <RealtyMenu isSp={isSp} isActive={(path) => fullPath === path || (path === '/broker' && currentPath === '/broker')} onNavigate={handleNavigate} />
                )}
                {category !== 'realty' && MENU_CONFIG.filter(item => item.show).map((item, index) => {
                    const isActive = checkIsActive(item);
                    return (
                        <div
                            key={`${item.id}-${index}`}
                            className={`position-relative category_menu ps-3 ${isActive ? "selected" : ""}`}
                            onClick={() => handleNavigate(item.path)}
                        >
                            <i className={`fa-solid ${item.icon} me-1 text-secondary`}></i>
                            {item.label}
                            {item.isAdminOnly && (
                                <span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>
                                    管理者専用
                                </span>
                            )}
                            {item.badges?.map((badge, idx) => (
                                <div key={idx} className="position-absolute menu_sync" style={{ top: badge.top, right: '10px' }}>
                                    {badge.label}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            <Estate estateId={estateId} setEstateId={setEstateId} />
            {guideId !== null && guideList !== null && !isSp && (
                <GuideSearchPanel articleId={guideId} articles={guideList} onSelect={setGuideId} onClose={() => setGuideId(null)} />
            )}
        </>
    );
}

/** 業務ガイドの検索の候補の数 */
const GUIDE_SUGGEST_MAX = 10;

/** 業務ガイドの検索（v2.2.198）。⚠️ 接頭辞 mg_。⚠️ 色は業務ガイド（Guide.tsx）に合わせる */
const GUIDE_SEARCH_CSS = `
.mg_search { margin: 4px 4px 10px; font-size: 12px; }
.mg_box { position: relative; }
.mg_icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-size: 11px; color: #0f766e; pointer-events: none; }
.mg_input { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 5px 8px 5px 26px; font-size: 12px; background: #f8fafc; color: #1f2937; }
.mg_input::placeholder { color: #9ca3af; }
.mg_input:focus { outline: 2px solid #99f6e4; border-color: #14b8a6; background: #fff; }
.mg_suggest { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;
              box-shadow: 0 6px 16px rgba(15, 23, 42, .08); max-height: 50vh; overflow-y: auto; }
.mg_item { display: flex; flex-direction: column; gap: 1px; padding: 5px 7px; border-radius: 6px; cursor: pointer; line-height: 1.4; }
.mg_item.is_active { background: #ecfdf5; }
.mg_title { font-weight: 700; color: #1f2937; word-break: break-all; }
.mg_title mark { padding: 0; background: linear-gradient(transparent 55%, #fef08a 55%); color: inherit; }
.mg_sub { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #6b7280; }
.mg_div { color: #fff; background: var(--mg-div); border-radius: 999px; padding: 0 6px; font-weight: 700; white-space: nowrap; }
.mg_note { padding: 6px 7px; color: #9ca3af; }
.mg_retry { border: none; background: none; padding: 0; color: #0f766e; font-weight: 700; text-decoration: underline; cursor: pointer; font-size: 12px; }
`;

export default Menu;