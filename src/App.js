import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Contract from "./components/Contract";
import Customer from "./components/Customer";
import Result from "./components/Result";
import Shop from "./components/Shop";
import ShopTrend from "./components/ShopTrend";
import CustomerTrend from "./components/CustomerTrend";
import Campaign from "./components/Campaign";
import List from "./components/List";
import Budget from "./components/Budget";
import BudgetAccounting from "./components/BudgetAccounting";
import Rank from "./components/Rank";
import Log from "./components/Log";
import Calendar from "./components/CalendarHome"
import Drop from "./components/Drop";
import User from "./components/User";

function App() {
  return (
    <Router basename="/dashboard/">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contract" element={<Contract />} />
        <Route path="/customer" element={<Customer />} />
        <Route path="/result" element={<Result />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shopTrend" element={<ShopTrend />} />
        <Route path="/customerTrend" element={<CustomerTrend />} />
        <Route path="/campaign" element={<Campaign />} />
        <Route path="/list" element={<List />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/budgetAccounting" element={<BudgetAccounting />} />
        <Route path="/rank" element={<Rank />} />
        <Route path="/log" element={<Log />} />
        <Route path="/calendar" element={<Calendar />} />
      </Routes>
    </Router>
  );
}

export default App;
