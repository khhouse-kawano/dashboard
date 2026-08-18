import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useState, useContext, useMemo } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import Logo from '../assets/images/logo.png';
import Estate from './Estate';
import { useIsSp } from '../utils/isSp';
import apiClient from "../utils/apiClient";

type UnSync = { inquiry_date: string, sync: number, black_list: string };
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

const Menu = ({ key, onReload }: Props) => {
    const { authority, category, version } = useContext(AuthContext);
    const location = useLocation();
    const currentPath = location.pathname;
    const fullPath = location.pathname + location.search;
    const navigate = useNavigate();
    const isSp = useIsSp();

    const [unSyncList, setUnSyncList] = useState<UnSync[]>([]);
    const [sync, setSync] = useState(0);
    const [cancelList, setCancelList] = useState<Cancel[]>([]);
    const [cancel, setCancel] = useState(0);
    const [lost, setLost] = useState(0);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [estateId, setEstateId] = useState('');

    const dateFormate = (value: string) => (value ?? '').replace(/\//g, '-');

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post("", { request: "menu" });
            setUnSyncList(response.data.inquiry);
            setCancelList(response.data.customer);
        };
        fetchData();
        setMonthArray(getYearMonthArray(2025, 1).slice(5));
    }, [key]);

    useEffect(() => {
        const total = unSyncList.filter(c => {
            return monthArray.includes(c.inquiry_date.slice(0, 7)) && c.sync === 0 && (c.black_list.split('duplicate').length % 2 !== 0 && c.black_list.split('support').length % 2 !== 0 && c.black_list.split('black').length % 2 !== 0)
        }).length;
        setSync(total);
    }, [unSyncList, monthArray]);

    useEffect(() => {
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
            const isReasonMissing = !item.competitor_lost_contract_reason || item.competitor_lost_contract_reason === 'null';
            const isCompetitorMissing = item.competitor_lost_contract_reason === '競合負け' && (!item.competitor_name || item.competitor_name === 'null');
            const isDetailMissing = item.competitor_lost_contract_reason === '競合負け' &&
                (
                    !item.customized_input_01JRF9CZSW65A151WR30NA4PB3 || item.customized_input_01JRF9CZSW65A151WR30NA4PB3 === 'null' ||
                    !item.customized_input_01JSE7H4MQES619NBWX6PQDFRH || item.customized_input_01JSE7H4MQES619NBWX6PQDFRH === 'null' || String(item.customized_input_01JSE7H4MQES619NBWX6PQDFRH).trim() === ''
                );
            return target < today && base < target && item.status === '失注' && (isReasonMissing || isCompetitorMissing || isDetailMissing) && Number(item.trash) === 1;
        }).length
        setLost(lostLength);
    }, [cancelList]);

    const handleNavigate = (path: string) => {
        navigate(path, { state: { authority } });
    };

    const checkIsActive = (item: MenuItem) => {
        if (item.activePaths) return item.activePaths.some(p => fullPath.includes(p));
        return item.exact ? fullPath === item.path : fullPath.includes(item.path);
    };

    const categoryMapping = {
        'order': { label: '注文営業', class: 'text-white bg-primary rounded px-2 py-0 ms-1' },
        'spec': { label: '建売営業', class: 'text-white bg-success rounded px-2 py-0 ms-1' },
        'used': { label: '中古リノベ', class: 'text-white bg-warning rounded px-2 py-0 ms-1' },
        'planner': { label: '不動産企画係', class: 'text-white bg-info rounded px-2 py-0 ms-1' },
    };

    const MENU_CONFIG: MenuItem[] = useMemo(() => [
        { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'planner', exact: true },
        { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'planner', exact: true },
        { id: 'leadSell', path: '/leadSell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'planner', exact: true },
        { id: 'leadBuy', path: '/leadBuy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'planner', exact: true },
        { id: 'report', path: '/leadOpportunity', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'planner', exact: true },
        {
            id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
            badges: (category === 'order' && sync > 0) ? [{ label: `未同期 ${sync}件`, top: '8px' }] : []
        },
        { id: 'list_renove', path: '/list?shop=renove', icon: 'fa-phone', label: '反響一覧', show: category === 'used', exact: true },
        {
            id: 'database', path: '/database', icon: 'fa-magnifying-glass', label: '顧客DB', show: category !== 'planner', exact: true,
            badges: category === 'order' ? [
                cancel > 0 ? { label: `来場未入力 ${cancel}件`, top: '2px' } : null,
                lost > 0 ? { label: `失注未入力 ${lost}件`, top: '16px' } : null
            ].filter(Boolean) as Badge[] : []
        },
        { id: 'rank', path: '/rank', icon: 'fa-person', label: '店舗・担当別反響', show: category !== 'planner', exact: true },
        { id: 'map', path: '/map', icon: 'fa-map', label: '反響MAP', show: category !== 'planner', exact: true },
        { id: 'customer', path: '/customer', icon: 'fa-mobile-screen', label: '販促媒体別広告費', show: !isSp && category === 'order', exact: true },
        { id: 'shop', path: '/shop', icon: 'fa-chart-pie', label: '店舗別広告費', show: !isSp && category === 'order', exact: true },
        { id: 'property_used', path: '/property', icon: 'fa-house', label: '掲載物件一覧', show: category === 'planner', exact: false },
        { id: 'broker', path: '/broker', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'planner', exact: false },
        { id: 'customerTrend', path: '/customerTrend', icon: 'fa-chart-bar', label: '販促媒体別反響推移', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'planner', exact: true },
        { id: 'calendar', path: '/calendar', icon: 'fa-calendar', label: 'カレンダー', show: !isSp && category === 'order', exact: true },
        { id: 'property_spec', path: '/property', icon: 'fa-house', label: '物件DB', show: !isSp && category === 'spec', exact: false },
        { id: 'campaign', path: '/campaign', activePaths: ['/campaign', '/editcampaign'], icon: 'fa-calendar-days', label: 'キャンペーン管理', show: !isSp && category === 'order' && (authority === "BrandAdmin" || authority === "Master"), isAdminOnly: true },
        { id: 'budget', path: '/budget', icon: 'fa-money-check', label: '予算詳細', show: !isSp && (authority === "BrandAdmin" || authority === "Master"), exact: false, isAdminOnly: true },
        { id: 'photo', path: '/photo', icon: 'fa-camera', label: 'K-snap登録', show: !isSp && category === 'order', exact: false },
        { id: 'photo', path: '/insideSales', icon: 'fa-camera', label: 'ISカレンダー', show: (authority === 'insideSales' || authority === 'Master') && category === 'order', exact: false, isAdminOnly: true },
        { id: 'customer', path: '/customer', icon: 'fa-mobile-screen', label: '販促媒体別広告費', show: !isSp && category === 'order', exact: true },
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

                {MENU_CONFIG.filter(item => item.show).map((item, index) => {
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
        </>
    );
}

export default Menu;