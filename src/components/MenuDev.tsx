import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';
import axios from "axios";
import { headers } from '../utils/headers';

type UnSync = { inquiry_date: string, sync: number, black_list: string };
type Cancel = { reserve: string, reserved_status: string, cancel_status: string };
const MenuDev = ({ brand }) => {
    const location = useLocation();
    const currentPath = location.pathname;
    const { category } = useContext(AuthContext);
    const [unSyncList, setUnSyncList] = useState<UnSync[]>([]);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const [sync, setSync] = useState(0);
    const [cancelList, setCancelList] = useState<Cancel[]>([]);
    const [cancel, setCancel] = useState(0);


    useEffect(() => {
        const fetchData = async () => {
            const syncRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "inquiry_list" }, { headers });
            const cancelRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers });
            setUnSyncList(syncRes.data);
            setCancelList(cancelRes.data);
        };
        fetchData();
    }, []);

    useEffect(() => {
        const total = unSyncList.filter(c => {
            return c.inquiry_date.includes(`${year}/${month}`) && c.sync === 0 && (c.black_list.split('duplicate').length % 2 !== 0 && c.black_list.split('support').length % 2 !== 0 && c.black_list.split('black').length % 2 !== 0)
        }).length;
        setSync(total);
    }, [unSyncList]);

    useEffect(() => {
        const total = cancelList.filter(item => {
            const now = new Date();
            const today = now.getTime();
            const target = new Date(item.reserved_status).getTime();
            const start = new Date('2026-01-01');
            const base = start.getTime();
            return target < today && base < target && (!item.reserve && !item.cancel_status)
        }).length;
        setCancel(total);
    }, [cancelList])


    const navigate = useNavigate();
    return (
        <div className="d-md-flex flex-column p-2" style={{ height: '100vh', borderRight: '1px solid #D3D3D3' }}>
            <div className="menuLogo m-3" onClick={() => navigate("/home", { state: { brand: brand, }, })}>
                <img src="https://khg-marketing.info/home/images/logo.png" alt="PG-CLOUDダッシュボード" className="w-100" />
            </div>
            {/* <div className={`category_menu  mb-2 px-2 ${currentPath === "/contract" ? "selected " : ""}`}
                onClick={() => navigate("/contract", { state: { brand: brand, }, })}>契約者数</div> */}
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/company" ? "selected " : ""}`}
                onClick={() => navigate("/company", { state: { brand: brand, }, })}>全社報告用フォーマット</div>
            {category === 'order' && <div className={`position-relative category_menu  mb-2 px-2 ${currentPath === "/list" ? "selected " : ""}`}
                onClick={() => navigate("/list", { state: { brand: brand, }, })}>反響一覧{sync > 0 && <div className="position-absolute menu_sync">未同期 {sync}件</div>}</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/rank" ? "selected " : ""}`}
                onClick={() => navigate("/rank", { state: { brand: brand, }, })}>店舗・担当別反響</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/customer" ? "selected " : ""}`}
                onClick={() => navigate("/customer", { state: { brand: brand, }, })}>販促媒体別広告費</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/shop" ? "selected " : ""}`}
                onClick={() => navigate("/shop", { state: { brand: brand, }, })}>店舗別広告費</div>}
            {category === 'order' && <div className={`position-relative category_menu  mb-2 px-2 ${currentPath === "/database" ? "selected " : ""}`}
                onClick={() => navigate("/database", { state: { brand: brand, }, })}>顧客データベース{cancel > 0 && <div className="position-absolute menu_sync">要回答 {cancel}件</div>}</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/customerTrend" ? "selected " : ""}`}
                onClick={() => navigate("/customerTrend", { state: { brand: brand, }, })}>販促媒体別反響推移</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/shopTrend" ? "selected " : ""}`}
                onClick={() => navigate("/shopTrend", { state: { brand: brand, }, })}>店舗別反響推移</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/calendar" ? "selected " : ""}`}
                onClick={() => navigate("/calendar", { state: { brand: brand, }, })}>カレンダー</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/map" ? "selected " : ""}`}
                onClick={() => navigate("/map", { state: { brand: brand, }, })}>エリア別反響MAP</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/market" ? "selected " : ""}`}
                onClick={() => navigate("/market", { state: { brand: brand, }, })}>マーケット情報</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/kengakuCloud" ? "selected " : ""}`}
                onClick={() => navigate("/kengakuCloud", { state: { brand: brand, }, })}>KengakuCloudマニュアル</div>}
            {category === 'order' && <div className={`category_menu  mb-2 px-2 ${currentPath === "/registered_estate" ? "selected " : ""}`}
                onClick={() => navigate("/registered_estate", { state: { brand: brand, }, })}>土地情報登録状況</div>}
            {/* {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/resale") ? "selected" : ""}`}
                onClick={() => navigate("/resale", { state: { brand: brand, }, })}>顧客一覧</div>} */}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/resale_performance") ? "selected" : ""}`}
                onClick={() => navigate("/resale_performance", { state: { brand: brand, }, })}>予実サマリー</div>}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/portal_buy") ? "selected" : ""}`}
                onClick={() => navigate("/portal_buy", { state: { brand: brand, }, })}>売買買い媒体別KPI</div>}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/portal_sell") ? "selected" : ""}`}
                onClick={() => navigate("/portal_sell", { state: { brand: brand, }, })}>売買売り媒体別KPI</div>}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/used_buy") ? "selected" : ""}`}
                onClick={() => navigate("/used_buy", { state: { brand: brand, }, })}>中古リノベ媒体別KPI</div>}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/customerResale") ? "selected" : ""}`}
                onClick={() => navigate("/customerResale", { state: { brand: brand, }, })}>架電KPI集計</div>}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/resale_manual") ? "selected" : ""}`}
                onClick={() => navigate("/resale_manual", { state: { brand: brand, }, })}>いえらぶCLOUD入力マニュアル</div>}
            {/* {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/customerResale") ? "selected" : ""}`}
                onClick={() => navigate("/customerResale", { state: { brand: brand, }, })}>担当別反響レポート</div>}
            {category === 'used' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/customerTrendResale") ? "selected" : ""}`}
                onClick={() => navigate("/customerTrendResale", { state: { brand: brand, }, })}>期間別反響レポート</div>} */}
            {category === 'spec' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/specBudget") ? "selected" : ""}`}
                onClick={() => navigate("/specBudget", { state: { brand: brand, }, })}>広告費レポート</div>}
            {category === 'spec' && <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/specCustomer") ? "selected" : ""}`}
                onClick={() => navigate("/specCustomer", { state: { brand: brand, }, })}>反響レポート</div>}
            {(brand === "BrandAdmin" || brand === "Master") && category === 'order' ? (
                <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/campaign") || currentPath.includes("/editcampaign") ? "selected" : ""}`}
                    onClick={() => navigate("/campaign", { state: { brand: brand, }, })}>
                    キャンペーン管理<span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>管理者専用</span>
                </div>
            ) : null}
            {brand === "BrandAdmin" || brand === "Master" ? (
                <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/budget") ? "selected" : ""}`}
                    onClick={() => navigate("/budget", { state: { brand: brand, }, })}>
                    予算詳細<span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>管理者専用</span>
                </div>
            ) : null}
            {brand === "BrandAdmin" || brand === "Master" ? (
                <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/log") ? "selected" : ""}`}
                    onClick={() => navigate("/log", { state: { brand: brand, }, })}>
                    ログイン履歴<span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>管理者専用</span>
                </div>
            ) : null}
        </div>
    );
}

export default MenuDev