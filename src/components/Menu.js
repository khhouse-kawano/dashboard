import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";

const Menu = ({brand}) => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navigate = useNavigate();

    const contract = async (event) => {
        event.preventDefault();
    
        try {
        navigate("/contract", {
            state: {
            brand: brand
                },
            });
            } catch (error) {
                console.error("Error:", error);
            }
        };

    const mediumSearch = async (event) => {
        event.preventDefault();
    
        try {
        navigate("/customer", {
            state: {
            brand: brand
                },
            });
            } catch (error) {
                console.error("Error:", error);
            }
        };

    const shopSearch = async (event) =>{
        event.preventDefault();
        try {
            navigate("/shop", {
                state: {
                    brand: brand
                },
            });
        } catch (error) {
            console.error("Error:", error);
        }
    }

    const customerTrend = async() =>{
        navigate("/customerTrend", {
            state: {
            brand: brand
            },
        });
    }

    const shopTrend = async() =>{
        navigate("/shopTrend", {
            state: {
                brand: brand
            },
        });
    }

    const campaign = async() =>{
        navigate("/campaign",{
            state:{
                brand:brand
            },
        })
    }

    const list = async() =>{
        navigate("/list",{
            state:{
                brand:brand
            },
        })
    }

    const budget = async() =>{
        navigate("/budget",{
            state:{
                brand:brand
            },
        })
    }

    const budgetAccounting = async() =>{
        navigate("/budgetAccounting",{
            state:{
                brand:brand
            },
        })
    }

    const rank = async() =>{
        navigate("/rank",{
            state:{
                brand:brand
            },
        })
    }

    const loginLog = async() =>{
        navigate("/log",{
            state:{
                brand:brand
            },
        });
    };

    const calendar = async() =>{
        navigate("/calendar",{
            state:{
                brand: brand
            },
        });
    };

    const database = async() =>{
        navigate("/database",{
            state:{
                brand: brand
            },
        });
    };

    const home = async() =>{
        navigate("/");
    }



  return (
    <div className='d-flex mt-2'>
        <div className='menuLogo m-3' onClick={home}><img src='https://khg-marketing.info/home/images/logo.png' alt="PG-CLOUDダッシュボード" className='w-100'/></div>
        <div className="menu d-flex flex-wrap">
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold ${currentPath === "/contract" ? "selected ": ""}`} onClick={currentPath === "/contract" ? null : contract}>契約者数</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/rank" ? "selected": ""}`} onClick={currentPath === "/rank" ? null : rank}>店舗・担当別反響</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold ${currentPath === "/customer" ? "selected": ""}`} onClick={currentPath === "/customer" ? null : mediumSearch}>販促媒体別広告費</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold ${currentPath === "/shop" ? "selected": ""}`} onClick={currentPath === "/shop" ? null : shopSearch}>店舗別広告費</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/database" ? "selected": ""}`} onClick={currentPath === "/database" ? null : database}>顧客データベース</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold ${currentPath === "/customerTrend" ? "selected": ""}`} onClick={currentPath === "/customerTrend" ? null : customerTrend}>販促媒体別反響推移</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold ${currentPath === "/shopTrend" ? "selected": ""}`} onClick={currentPath === "/shopTrend" ? null : shopTrend}>店舗別反響推移</div>
            <div className={`category btn me-1 mb-1  btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/calendar" ? "selected": ""}`} onClick={currentPath === "/calendar" ? null : calendar}>カレンダー</div>
            <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/list" ? "selected": ""}`} onClick={currentPath === "/list" ? null : list}>反響一覧</div>
            {/* <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/list" ? "selected": ""}`} onClick={currentPath === "/list" ? null : list}>反響一覧<div className='position-absolute accounting bg-primary text-white rounded px-1'>6/1より</div></div> */}
            {/* <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/database" ? "selected": ""}`} onClick={currentPath === "/database" ? null : database}>PG CLOUDデータベース</div> */}
            { brand === "BrandAdmin" || brand === "Master" ? <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath.includes("/campaign") || currentPath.includes("/editcampaign") ? "selected": ""}`} onClick={currentPath === "/campaign" ? null : campaign}>キャンペーン管理<div className='position-absolute accounting bg-primary text-white rounded px-1'>管理者専用</div></div> : null}
            { brand === "BrandAdmin" || brand === "Master" ? <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/budget" ? "selected": ""}`} onClick={currentPath === "/budget" ? null : budget}>予算詳細<div className='position-absolute accounting bg-primary text-white rounded px-1'>管理者専用</div></div> : null}
            { brand === "BrandAdmin" || brand === "Master" ? <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/budgetAccounting" ? "selected": ""}`} onClick={currentPath === "/budgetAccounting" ? null : budgetAccounting}>予算詳細<div className='position-absolute accounting bg-danger text-white rounded px-1'>経理用</div></div> : null}
            { brand === "BrandAdmin" || brand === "Master" ? <div className={`category btn me-1 mb-1 btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/log" ? "selected": ""}`} onClick={currentPath === "/log" ? null : loginLog}>ログイン履歴<div className='position-absolute accounting bg-primary text-white rounded px-1'>管理者専用</div></div> : null}
        </div>
    </div>
  )
}

export default Menu