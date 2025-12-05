import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';

const MenuDev = ({ brand }) => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navigate = useNavigate();
    return (
        <div className="d-md-flex flex-column p-2" style={{ height: '100vh', borderRight: '1px solid #D3D3D3' }}>
            <div className="menuLogo m-3" onClick={() => navigate("/", { state: { brand: brand, }, })}>
                <img src="https://khg-marketing.info/home/images/logo.png" alt="PG-CLOUDダッシュボード" className="w-100" />
            </div>
            {/* <div className={`category_menu  mb-2 px-2 ${currentPath === "/contract" ? "selected " : ""}`}
                onClick={() => navigate("/contract", { state: { brand: brand, }, })}>契約者数</div> */}
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/list" ? "selected " : ""}`}
                onClick={() => navigate("/list", { state: { brand: brand, }, })}>反響一覧</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/rank" ? "selected " : ""}`}
                onClick={() => navigate("/rank", { state: { brand: brand, }, })}>店舗・担当別反響</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/customer" ? "selected " : ""}`}
                onClick={() => navigate("/customer", { state: { brand: brand, }, })}>販促媒体別広告費</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/shop" ? "selected " : ""}`}
                onClick={() => navigate("/shop", { state: { brand: brand, }, })}>店舗別広告費</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/database" ? "selected " : ""}`}
                onClick={() => navigate("/database", { state: { brand: brand, }, })}>顧客データベース</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/customerTrend" ? "selected " : ""}`}
                onClick={() => navigate("/customerTrend", { state: { brand: brand, }, })}>販促媒体別反響推移</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/shopTrend" ? "selected " : ""}`}
                onClick={() => navigate("/shopTrend", { state: { brand: brand, }, })}>店舗別反響推移</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/calendar" ? "selected " : ""}`}
                onClick={() => navigate("/calendar", { state: { brand: brand, }, })}>カレンダー</div>
            <div className={`category_menu  mb-2 px-2 ${currentPath === "/map" ? "selected " : ""}`}
                onClick={() => navigate("/map", { state: { brand: brand, }, })}>エリア別反響MAP</div>
            <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/resale") ? "selected" : ""}`}
                onClick={() => navigate("/resale", { state: { brand: brand, }, })}>
                顧客一覧<span className="bg-warning rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>中専</span>
            </div>
            <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/customerResale") ? "selected" : ""}`}
                onClick={() => navigate("/customerResale", { state: { brand: brand, }, })}>
                担当別反響レポート<span className="bg-warning rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>中専</span>
            </div>
            <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/customerTrendResale") ? "selected" : ""}`}
                onClick={() => navigate("/customerTrendResale", { state: { brand: brand, }, })}>
                期間別反響レポート<span className="bg-warning rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>中専</span>
            </div>
            <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/specBudget") ? "selected" : ""}`}
                onClick={() => navigate("/specBudget", { state: { brand: brand, }, })}>
                広告費レポート<span className="bg-success text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>かえる</span>
            </div>
            <div className={`category_menu  mb-2 px-2  ${currentPath.includes("/specCustomer") ? "selected" : ""}`}
                onClick={() => navigate("/specCustomer", { state: { brand: brand, }, })}>
                反響レポート<span className="bg-success text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>かえる</span>
            </div>
            {brand === "BrandAdmin" || brand === "Master" ? (
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