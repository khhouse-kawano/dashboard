import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Logo from "../assets/images/logo.png";

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

    const home = async() =>{
        navigate("/");
    }



  return (
    <>
    <div className='menuLogo m-3' onClick={home}><img src={Logo} alt="PG-CLOUDダッシュボード" className='w-100'/></div>
    <div className="container mt-5 mb-0 ps-0">
        <div className={`category btn btn-large text-dark px-2 fw-bold ${currentPath === "/contract" ? "selected contract": ""}`} onClick={currentPath === "/contract" ? null : contract}>契約者数</div>
        <div className={`category btn btn-large text-dark px-2 fw-bold ${currentPath === "/customer" ? "selected": ""}`} onClick={currentPath === "/customer" ? null : mediumSearch}>販促媒体別反響</div>
        <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/rank" ? "selected": ""}`} onClick={currentPath === "/rank" ? null : rank}>店舗・担当別反響</div>
        <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/shop" ? "selected": ""}`} onClick={currentPath === "/shop" ? null : shopSearch}>店舗・担当</div>
        <div className={`category btn btn-large text-dark px-2 fw-bold ${currentPath === "/customerTrend" ? "selected": ""}`} onClick={currentPath === "/customerTrend" ? null : customerTrend}>販促媒体別反響推移</div>
        <div className={`category btn btn-large text-dark px-2 fw-bold ${currentPath === "/shopTrend" ? "selected": ""}`} onClick={currentPath === "/shopTrend" ? null : shopTrend}>店舗別反響推移</div>
        { brand === "BrandAdmin" ? <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/campaign" ? "selected": ""}`} onClick={currentPath === "/campaign" ? null : campaign}>キャンペーン別反響<div className='position-absolute accounting bg-primary text-white rounded px-1'>管理者専用</div></div> : null}
        { brand === "BrandAdmin" ? <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/list" ? "selected": ""}`} onClick={currentPath === "/list" ? null : list}>反響一覧<div className='position-absolute accounting bg-danger text-white rounded px-1'>開発中</div></div> : null}
        { brand === "BrandAdmin" ? <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/budget" ? "selected": ""}`} onClick={currentPath === "/budget" ? null : budget}>予算詳細<div className='position-absolute accounting bg-primary text-white rounded px-1'>管理者専用</div></div> : null}
        { brand === "BrandAdmin" ? <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/budgetAccounting" ? "selected": ""}`} onClick={currentPath === "/budgetAccounting" ? null : budgetAccounting}>予算詳細<div className='position-absolute accounting bg-danger text-white rounded px-1'>経理用</div></div> : null}
        { brand === "BrandAdmin" ? <div className={`category btn btn-large text-dark px-2 fw-bold position-relative ${currentPath === "/log" ? "selected": ""}`} onClick={currentPath === "/log" ? null : loginLog}>ログイン履歴<div className='position-absolute accounting bg-primary text-white rounded px-1'>管理者専用</div></div> : null}
    </div>
    </>
  )
}

export default Menu