import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Calendar from "./components/Calendar";
import Category from "./components/Category";
import Contract from "./components/Contract";
import Shop from "./components/Shop";
import CustomerTrend from "./components/CustomerTrend";
import Campaign from "./components/Campaign";
import BudgetAccounting from "./components/BudgetAccounting";
import Log from "./components/Log";
import Database from "./components/Database";
import AuthProvider from "./context/AuthProvider";
import Customer from "./components/Customers";
import ShopTrend from "./components/ShopTrend";
import CampaignHome from "./components/CampaignHome";
import Company from "./components/Company";
import NewCampaign from "./components/NewCampaign";
import Rank from "./components/Rank";
import List from "./components/List";
import Khf from "./components/KhfDatabase";
import Map from "./components/Map";
import Resale from "./components/Resale";
import Spec from "./components/Spec";
import Hab from "./components/Hab";
import BudgetKaeru from "./components/BudgetKaeru";
import CustomerKaeru from "./components/CustomerKaeru";
import ShopReview from "./components/ShopReview";
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
import Dev from "./components/Dev";

function App() {
  return (
    <Router basename="/dashboard">

      <AuthProvider>
        <Routes>
          <Route path="/" element={<Category />} />
          <Route path="/home" element={<Category />} />
          <Route path="/login" element={<Login />} />
          <Route path="/company" element={<Company />} />
          <Route path="/contract" element={<Contract />} />
          <Route path="/customer" element={<Customer />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shopTrend" element={<ShopTrend />} />
          <Route path="/customerTrend" element={<CustomerTrend />} />
          <Route path="/list" element={<List />} />
          <Route path="/database" element={<Database />} />
          <Route path="/budget" element={<BudgetAccounting />} />
          <Route path="/rank" element={<Rank />} />
          <Route path="/log" element={<Log />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/campaign" element={<CampaignHome />} />
          <Route path="/editcampaign" element={<NewCampaign />} />
          <Route path="/map" element={<Map />} />
          <Route path="/resale" element={<Resale />} />
          <Route path="/specBudget" element={<BudgetKaeru />} />
          <Route path="/specCustomer" element={<CustomerKaeru />} />
          <Route path="/shopReview" element={<ShopReview />} />
          <Route path="/customerResale" element={<CustomerResale />} />
          <Route path="/customerTrendResale" element={<CustomerTrendResale />} />
          <Route path="/market" element={<Market />} />
          <Route path="/resale_performance" element={<ResalePerformance />} />
          <Route path="/portal_buy" element={<PortalBuy />} />
          <Route path="/used_buy" element={<UsedBuy />} />
          <Route path="/portal_sell" element={<PortalSell />} />
          <Route path="/registered_estate" element={<RegisteredEstate />} />
          <Route path="/resale_manual" element={<ResaleManual />} />
          <Route path="*" element={<Category />} />
        </Routes>
      </AuthProvider>
    </Router>

    // <AuthProvider>
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
    // </AuthProvider>
  );
}

export default App;
