import React, { useContext, useState } from "react";
import { GoogleOAuthProvider } from '@react-oauth/google';
import AuthContext from './context/AuthContext';
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Calendar from "./components/Calendar";
import Category from "./components/Category";
import Shop from "./components/Shop";
import CustomerTrend from "./components/CustomerTrend";
import BudgetAccounting from "./components/BudgetAccounting";
import DatabaseRouter from "./components/database/DatabaseRouter";
import DatabaseProperty from "./components/database/DatabaseProperty";
import RankRouter from "./components/rank/RankRouter";
import AuthProvider from "./context/AuthProvider";
import Customer from "./components/Customers";
import { ShopTrendRouter } from "./components/shopTrend/ShopTrendRouter";
import CampaignHome from "./components/CampaignHome";
import Company from "./components/Company";
import NewCampaign from "./components/NewCampaign";
import ListRouter from "./components/list/ListRouter";
import Khf from "./components/KhfDatabase";
import Map from "./components/Map";
import Resale from "./components/Resale";
import Spec from "./components/Spec";
import Hab from "./components/Hab";
import BudgetKaeru from "./components/BudgetKaeru";
import CustomerKaeru from "./components/CustomerKaeru";
import CustomerResale from "./components/CustomerResale";
import CustomerTrendResale from "./components/CustomerTrendResale";
import Market from "./components/Market";
import ResalePerformance from "./components/ResalePerformance"; 
import PortalBuy from "./components/PortalBuy";
import PortalSell from "./components/PortaSell";
import UsedBuy from "./components/UsedBuy";
import RegisteredEstate from "./components/RegisteredEstate";
import ResaleManual from "./components/ResaleManual";
import Login from "./components/Login";
import KengakuCloud from "./components/KengakuCloud";
import ActiveUser from "./components/ActiveUser";
import { GoogleMapContext } from "./context/GoogleMapContext";
import { useJsApiLoader } from "@react-google-maps/api";
import MenuD from "./components/Menu";
import Dev from "./components/Dev";

export default function App() {
  const clientId = process.env.REACT_APP_CLIENT_ID;
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_API_KEY || "",
    libraries: ['marker'],
  });

  return (
    <GoogleMapContext.Provider value={{ isLoaded }}>
      {/* ↓ ここに追加！ clientId を渡してルーター全体を囲みます */}
      <GoogleOAuthProvider clientId={clientId ||""}>
        <Router basename="/dashboard">
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </Router>
      </GoogleOAuthProvider>
      {/* ↑ ここまで */}
    </GoogleMapContext.Provider>
  );
}

// Router の内側で useLocation を使う
function AppInner() {
  const { brand } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const location = useLocation(); // ← ここなら OK
  const currentPath = location.pathname;
  const [menuKey, setMenuKey] = useState(0);
  const reload = () => {
    setMenuKey(prev => prev + 1);
  };


  return (
    <>
      <ActiveUser />
      <div className='outer-container'>
        <div className="d-flex">
          {currentPath !== '/home' && currentPath !== '/login' && <>
            <div className="modal_menu">
              <MenuD key={menuKey} onReload={reload} />
            </div>
            <div className="header_sp">
              <i
                className="fa-solid fa-bars hamburger"
                onClick={() => setOpen(true)}
              />
            </div>
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
            <Route path="/shop" element={<Shop />} />
            <Route path="/shopTrend" element={<ShopTrendRouter />} />
            <Route path="/customerTrend" element={<CustomerTrend />} />
            <Route path="/list" element={<ListRouter onReload={reload} />} />
            <Route path="/database" element={<DatabaseRouter onReload={reload} key={menuKey} />} />
            <Route path="/budget" element={<BudgetAccounting />} />
            <Route path="/rank" element={<RankRouter />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/campaign" element={<CampaignHome />} />
            <Route path="/editcampaign" element={<NewCampaign />} />
            <Route path="/map" element={<Map />} />
            <Route path="/resale" element={<Resale />} />
            <Route path="/specBudget" element={<BudgetKaeru />} />
            <Route path="/specCustomer" element={<CustomerKaeru />} />
            <Route path="/customerResale" element={<CustomerResale />} />
            <Route path="/customerTrendResale" element={<CustomerTrendResale />} />
            <Route path="/market" element={<Market />} />
            <Route path="/resale_performance" element={<ResalePerformance />} />
            <Route path="/portal_buy" element={<PortalBuy />} />
            <Route path="/used_buy" element={<UsedBuy />} />
            <Route path="/portal_sell" element={<PortalSell />} />
            <Route path="/registered_estate" element={<RegisteredEstate />} />
            <Route path="/resale_manual" element={<ResaleManual />} />
            <Route path="/property" element={<DatabaseProperty />} />
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
