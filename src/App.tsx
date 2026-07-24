import React, { useEffect, useState } from "react";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Calendar from "./components/Calendar";
import Category from "./components/Category";
import ShopRouter from './components/shop/ShopRouter';
import BudgetAccounting from "./components/BudgetAccounting";
import DatabaseRouter from "./components/database/DatabaseRouter";
import DatabaseProperty from "./components/database/DatabaseProperty";
import RankRouter from "./components/rank/RankRouter";
import AuthProvider from "./context/AuthProvider";
import Customer from "./components/customer/CustomerRouter";
import { ShopTrendRouter } from "./components/shopTrend/ShopTrendRouter";
import Company from "./components/company/Company";
import NewCampaign from "./components/NewCampaign";
import ListRouter from "./components/list/ListRouter";
import Photo from "./components/photo/Photo";
import Hab from "./components/Hab";
import BudgetKaeru from "./components/BudgetKaeru";
import Market from "./components/Market";
import Login from "./components/Login";
import KengakuCloud from "./components/KengakuCloud";
import ActiveUser from "./components/ActiveUser";
import { GoogleMapContext } from "./context/GoogleMapContext";
import { useJsApiLoader } from "@react-google-maps/api";
import MenuD from "./components/Menu";
import Dev from "./components/Dev";
import Header from "./components/header/Header";
import CustomerTrendRouter from "./components/customerTrend/CustomerTrendRouter";
import MapRouter from "./components/map/MapRouter";
import { useIsSp } from './utils/isSp';
import CampaignRouter from './components/campaign/CampaignRouter';
const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];

export default function App() {
  const clientId = process.env.REACT_APP_CLIENT_ID;
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return (
    <GoogleMapContext.Provider value={{ isLoaded }}>
      <GoogleOAuthProvider clientId={clientId || ""}>
        <Router basename="/dashboard">
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </Router>
      </GoogleOAuthProvider>
    </GoogleMapContext.Provider>
  );
}

function AppInner() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const [menuKey, setMenuKey] = useState(0);
  const reload = () => {
    setMenuKey(prev => prev + 1);
  };
  const isSp = useIsSp();

  useEffect(() => {
    if (!isSp) return;
    setOpen(true);
  }, []);



  return (
    <>
      <ActiveUser />
      <div className='outer-container'>
        {currentPath !== '/login' && <Header key={menuKey} />}
        <div className="d-flex pt-4">
          {currentPath !== '/home' && currentPath !== '/login' && <>
            {/* PC用メニュー */}
            <div className="modal_menu">
              <MenuD key={menuKey} onReload={reload} />
            </div>

            {/* スマホ用ヘッダー */}
            <div className="header_sp">
              <i
                className="fa-solid fa-bars hamburger"
                onClick={() => setOpen(true)}
              />
            </div>

            {/* スマホ用：メニュー展開時の背景（外側タップで閉じる用） */}
            {open && (
              <div className="overlay_sp" onClick={() => setOpen(false)} />
            )}

            {/* スマホ用メニュー */}
            <div className={`modal_menu_sp ${open ? "open" : ""}`}>
              <i
                className="fa-solid fa-xmark hamburger position-absolute"
                onClick={() => setOpen(false)}
              />
              <MenuD key={menuKey} onReload={reload} />
            </div>
          </>}
          <Routes>
            <Route path="/dev" element={<Dev />} />
            <Route path="/" element={<Category />} />
            <Route path="/home" element={<Category />} />
            <Route path="/login" element={<Login />} />
            <Route path="/company" element={<Company />} />
            <Route path="/customer" element={<Customer />} />
            <Route path="/shop" element={<ShopRouter />} />
            <Route path="/shopTrend" element={<ShopTrendRouter />} />
            <Route path="/customerTrend" element={<CustomerTrendRouter />} />
            <Route path="/list" element={<ListRouter onReload={reload} />} />
            <Route path="/database" element={<DatabaseRouter onReload={reload} key={menuKey} />} />
            <Route path="/budget" element={<BudgetAccounting />} />
            <Route path="/rank" element={<RankRouter />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/campaign" element={<CampaignRouter />} />
            <Route path="/editcampaign" element={<NewCampaign />} />
            <Route path="/map" element={<MapRouter />} />
            <Route path="/specBudget" element={<BudgetKaeru />} />
            <Route path="/market" element={<Market />} />
            <Route path="/property" element={<DatabaseProperty />} />
            <Route path="/photo" element={<Photo />} />
            <Route path="/kengakuCloud" element={<KengakuCloud />} />
            <Route path="*" element={<Category />} />
          </Routes>
        </div>
      </div>
      {/* // <AuthProvider>
    //   <Router basename="/home/">
    //     <Routes>
    //       <Route path="/" element={<Home />} />
    //       <Route path="*" element={<Home />} />
    //     </Routes>
    //   </Router>
    // </AuthProvider>
    // <AuthProvider>
    //   <Router basename="/home/">
    //     <Routes>
    //       <Route path="/" element={<Home />} />
    //       <Route path="*" element={<Home />} />
    //     </Routes>
    //   </Router>
    // </AuthProvider> */}
    </>
  );
}
