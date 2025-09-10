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
import Rank from "./components/trash/Rank";
import Log from "./components/Log";
import Calendar from "./components/CalendarHome"
import Database from "./components/Database";
import User from "./components/User";
import AuthProvider from "./context/AuthProvider";
import Customer from "./components/Customers";
import Rank_Re from "./components/Rank"
import ShopTrendDev from "./components/ShopTrendDev";
import ListDev from './components/List_Dev';
import Survey from './components/Survey';
import CampaignHome from './components/CampaignHome'
import NewCampaign from './components/NewCampaign'
import RankDev from "./components/Rank_dev";
import DatabaseDev from "./components/Database_dev";

function App() {

  return (
    <AuthProvider>
    <Router basename="/dashboard/">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contract" element={<Contract />} />
        <Route path="/customer" element={<Customer />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/result" element={<Result />} />
        <Route path="/shopTrend" element={<ShopTrendDev />} />
        <Route path="/customerTrend" element={<CustomerTrend />} />
        <Route path="/list" element={<ListDev />} />
        <Route path="/database" element={<Database />} />
        <Route path="/budget" element={<BudgetAccounting />} />
        <Route path="/rank" element={<RankDev />} />
        <Route path="/log" element={<Log />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/campaign" element={<CampaignHome />} />
        <Route path="/editcampaign" element={<NewCampaign />} />
        <Route path="/test" element={<DatabaseDev />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  </AuthProvider>
  );
}

export default App;
