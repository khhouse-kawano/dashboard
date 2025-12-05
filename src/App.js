import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Contract from "./components/Contract";
import Result from "./components/Result";
import Shop from "./components/Shop";
import CustomerTrend from "./components/CustomerTrend";
import Campaign from "./components/Campaign";
import Budget from "./components/Budget";
import BudgetAccounting from "./components/BudgetAccounting";
import Log from "./components/Log";
import Calendar from "./components/CalendarHome";
import Database from "./components/Database";
import User from "./components/User";
import AuthProvider from "./context/AuthProvider";
import Customer from "./components/Customers";
import ShopTrendDev from "./components/ShopTrendDev";
import Survey from "./components/Survey";
import CampaignHome from "./components/CampaignHome";
import NewCampaign from "./components/NewCampaign";
import Rank from "./components/Rank";
import ListDev2 from "./components/List_Dev2";
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
import Dev from "./components/Dev";

function App() {
  return (
    <AuthProvider>
      <Router basename="/dashboard">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contract" element={<Contract />} />
          <Route path="/customer" element={<Customer />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/result" element={<Result />} />
          <Route path="/shopTrend" element={<ShopTrendDev />} />
          <Route path="/customerTrend" element={<CustomerTrend />} />
          <Route path="/list" element={<ListDev2 />} />
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
          <Route path="*" element={<Home />} />
          <Route path="/dev" element={<Dev />} />
          <Route path="/dev2" element={<ShopReview />} />
        </Routes>
      </Router>
    </AuthProvider>
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
