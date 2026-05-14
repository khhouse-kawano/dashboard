import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';
import axios from "axios";
import { headers } from '../utils/headers';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import Logo from '../assets/images/logo.png';
import { borderRadius, fontSize, letterSpacing, width } from "@mui/system";
import { bottom } from "@popperjs/core";
import Estate from './Estate';

type UnSync = { inquiry_date: string, sync: number, black_list: string };
type Cancel = { interview: string, reserved_interview: string, cancel_status: string };
type Props = {
    key: number,
    onReload: () => void
};
const MenuDev = ({ key, onReload }: Props) => {
    const { brand } = useContext(AuthContext);
    const location = useLocation();
    const currentPath = location.pathname;
    const { category } = useContext(AuthContext);
    const { version } = useContext(AuthContext);
    const [unSyncList, setUnSyncList] = useState<UnSync[]>([]);
    const [sync, setSync] = useState(0);
    const [cancelList, setCancelList] = useState<Cancel[]>([]);
    const [cancel, setCancel] = useState(0);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [estateId, setEstateId] = useState('');
    const [newEstate, setNewEstate] = useState<number | null>(0);

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/\//g, '-');
    }

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "menu" }, { headers });
            setUnSyncList(response.data.inquiry);
            setCancelList(response.data.customer);
            setNewEstate(response.data.estate);
        };
        fetchData();

        setMonthArray(getYearMonthArray(2025, 1).slice(5));
    }, [key]);

    useEffect(() => {
        const total = unSyncList.filter(c => {
            return monthArray.includes(c.inquiry_date.slice(0, 7)) && c.sync === 0 && (c.black_list.split('duplicate').length % 2 !== 0 && c.black_list.split('support').length % 2 !== 0 && c.black_list.split('black').length % 2 !== 0)
        }).length;
        setSync(total);
    }, [unSyncList]);

    useEffect(() => {
        const total = cancelList.filter(item => {
            const now = new Date();
            const today = now.getTime();
            const target = new Date(dateFormate(item.reserved_interview)).getTime();
            const start = new Date('2026-01-01');
            const base = start.getTime();
            return target < today && base < target && (!item.interview && !item.cancel_status)
        }).length;
        setCancel(total);
    }, [cancelList])

    const navigate = useNavigate();

    const categoryMapping = {
        'order': {
            label: '注文営業',
            class: 'text-white bg-primary rounded px-2 py-0 ms-1'
        },
        'spec': {
            label: '建売営業',
            class: 'text-white bg-success rounded px-2 py-0 ms-1'
        },
        'used': {
            label: '中古住宅',
            class: 'text-white bg-warning rounded px-2 py-0 ms-1'
        }
    };

    return (
        <>{currentPath !== '/login' && currentPath !== '/home' &&
            <>
                <div className="d-md-flex flex-column p-2" style={{ height: '100vh', borderRight: '1px solid #D3D3D3' }}>
                    <div className="menuLogo m-3 position-relative" onClick={() => navigate("/home", { state: { brand: brand, }, })}>
                        <img src={Logo} alt="PG-CLOUDダッシュボード" className="w-100" />
                        <div style={{ fontSize: '10px', bottom: '-10px', right: '0' }} className="position-absolute">
                            ver{version}<span style={{ fontSize: '8px', textAlign: 'center' }}
                                className={categoryMapping[category].class}>{categoryMapping[category].label}</span></div>
                    </div>
                    <div className={`category_menu  ps-3 ${currentPath === "/company" ? "selected " : ""}`}
                        onClick={() => navigate("/company", { state: { brand: brand, }, })}><i className="fa-solid fa-rainbow me-1 text-secondary"></i>全社報告用フォーマット</div>
                    <div className={`position-relative category_menu  ps-3 ${currentPath === "/list" ? "selected " : ""}`}
                        onClick={() => navigate("/list", { state: { brand: brand, }, })}><i className="fa-solid fa-phone me-1 text-secondary"></i>反響一覧{sync > 0 && <div className="position-absolute menu_sync">未同期 {sync}件</div>}</div>
                    <div className={`position-relative category_menu  ps-3 ${currentPath === "/database" ? "selected " : ""}`}
                        onClick={() => navigate("/database", { state: { brand: brand, }, })}><i className="fa-solid fa-magnifying-glass me-1 text-secondary"></i>顧客データベース{(cancel > 0 && category === 'order') && <div className="position-absolute menu_sync">要回答 {cancel}件</div>}</div>
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/rank" ? "selected " : ""}`}
                        onClick={() => navigate("/rank", { state: { brand: brand, }, })}><i className="fa-solid fa-person me-1 text-secondary"></i>店舗・担当別反響</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/customer" ? "selected " : ""}`}
                        onClick={() => navigate("/customer", { state: { brand: brand, }, })}><i className="fa-solid fa-mobile-screen me-1 text-secondary"></i>販促媒体別広告費</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/shop" ? "selected " : ""}`}
                        onClick={() => navigate("/shop", { state: { brand: brand, }, })}><i className="fa-solid fa-chart-pie me-1 text-secondary"></i>店舗別広告費</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/customerTrend" ? "selected " : ""}`}
                        onClick={() => navigate("/customerTrend", { state: { brand: brand, }, })}><i className="fa-solid fa-chart-bar me-1 text-secondary"></i>販促媒体別反響推移</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/shopTrend" ? "selected " : ""}`}
                        onClick={() => navigate("/shopTrend", { state: { brand: brand, }, })}><i className="fa-solid fa-shop me-1 text-secondary"></i>店舗別反響推移</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/calendar" ? "selected " : ""}`}
                        onClick={() => navigate("/calendar", { state: { brand: brand, }, })}><i className="fa-solid fa-calendar me-1 text-secondary"></i>カレンダー</div>}
                    {category === 'order' && <div className={`position-relative category_menu  ps-3`}
                        onClick={() => setEstateId('search')}><i className="fa-solid fa-map me-1 text-secondary"></i>土地情報{sync > 0 && <div className="position-absolute menu_sync">新着 {newEstate}件</div>}</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/map" ? "selected " : ""}`}
                        onClick={() => navigate("/map", { state: { brand: brand, }, })}><i className="fa-solid fa-map me-1 text-secondary"></i>エリア別反響MAP</div>}
                    {/* {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/market" ? "selected " : ""}`}
                    onClick={() => navigate("/market", { state: { brand: brand, }, })}>マーケット情報</div>} */}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/kengakuCloud" ? "selected " : ""}`}
                        onClick={() => navigate("/kengakuCloud", { state: { brand: brand, }, })}><i className="fa-solid fa-book-open me-1 text-secondary"></i>KengakuCloudマニュアル</div>}
                    {category === 'order' && <div className={`category_menu  ps-3 ${currentPath === "/registered_estate" ? "selected " : ""}`}
                        onClick={() => navigate("/registered_estate", { state: { brand: brand, }, })}><i className="fa-solid fa-clipboard-user me-1 text-secondary"></i>土地情報登録状況</div>}
                    {category === 'used' && <div className={`category_menu  ps-3  ${currentPath.includes("/resale_performance") ? "selected" : ""}`}
                        onClick={() => navigate("/resale_performance", { state: { brand: brand, }, })}>予実サマリー</div>}
                    {category === 'used' && <div className={`category_menu  ps-3  ${currentPath.includes("/portal_buy") ? "selected" : ""}`}
                        onClick={() => navigate("/portal_buy", { state: { brand: brand, }, })}>売買買い媒体別KPI</div>}
                    {category === 'used' && <div className={`category_menu  ps-3  ${currentPath.includes("/portal_sell") ? "selected" : ""}`}
                        onClick={() => navigate("/portal_sell", { state: { brand: brand, }, })}>売買売り媒体別KPI</div>}
                    {category === 'used' && <div className={`category_menu  ps-3  ${currentPath.includes("/used_buy") ? "selected" : ""}`}
                        onClick={() => navigate("/used_buy", { state: { brand: brand, }, })}>中古リノベ媒体別KPI</div>}
                    {category === 'used' && <div className={`category_menu  ps-3  ${currentPath.includes("/customerResale") ? "selected" : ""}`}
                        onClick={() => navigate("/customerResale", { state: { brand: brand, }, })}>架電KPI集計</div>}
                    {category === 'used' && <div className={`category_menu  ps-3  ${currentPath.includes("/resale_manual") ? "selected" : ""}`}
                        onClick={() => navigate("/resale_manual", { state: { brand: brand, }, })}>いえらぶCLOUD入力マニュアル</div>}
                    {category === 'spec' && <div className={`category_menu  ps-3  ${currentPath.includes("/property") ? "selected" : ""}`}
                        onClick={() => navigate("/property", { state: { brand: brand, }, })}><i className="fa-solid fa-house me-1 text-secondary"></i>物件データベース</div>}
                    {category === 'spec' && <div className={`category_menu  ps-3  ${currentPath.includes("/specBudget") ? "selected" : ""}`}
                        onClick={() => navigate("/specBudget", { state: { brand: brand, }, })}>広告費レポート</div>}
                    {category === 'spec' && <div className={`category_menu  ps-3  ${currentPath.includes("/specCustomer") ? "selected" : ""}`}
                        onClick={() => navigate("/specCustomer", { state: { brand: brand, }, })}>反響レポート</div>}
                    {(brand === "BrandAdmin" || brand === "Master") && category === 'order' ? (
                        <div className={`category_menu  ps-3  ${currentPath.includes("/campaign") || currentPath.includes("/editcampaign") ? "selected" : ""}`}
                            onClick={() => navigate("/campaign", { state: { brand: brand, }, })}>
                            <i className="fa-solid fa-calendar-days me-1 text-secondary"></i>キャンペーン管理<span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>管理者専用</span>
                        </div>
                    ) : null}
                    {brand === "BrandAdmin" || brand === "Master" ? (
                        <div className={`category_menu  ps-3  ${currentPath.includes("/budget") ? "selected" : ""}`}
                            onClick={() => navigate("/budget", { state: { brand: brand, }, })}>
                            <i className="fa-solid fa-money-check me-1 text-secondary"></i>予算詳細<span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>管理者専用</span>
                        </div>
                    ) : null}
                </div>
            </>}
            <Estate estateId={estateId} setEstateId={setEstateId} />
        </>
    );
}

export default MenuDev