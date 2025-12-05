import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import Menu from './Menu.js';
import CalendarShop from "./Calendar";
import CalendarList from "./CalendarList";
import CalendarTable from './CalendarTable';
import CalendarCampaign from './CalendarCampaign';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import AuthContext from '../context/AuthContext';
import MenuDev from "./MenuDev";

const CalendarHome = () => {
  const { brand } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('list');

  useEffect(() => {
    if (!brand || brand.trim() === "") navigate("/");
  }, [])

  return (
    <div className='outer-container'>
      <div className="d-flex">
        <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} /></div>
        <div className='content calendar bg-white p-2'>
          <Tabs
            defaultActiveKey="shop"
            className='justify-content-center'
            onSelect={key => setActiveTab(key)}
            style={{ fontSize: '13px' }}
          >
            <Tab eventKey="shop" title="店舗ごとに表示">
              <CalendarShop activeTab={activeTab} />
            </Tab>
            <Tab eventKey="list" title="全体リスト">
              <CalendarList activeTab={activeTab} />
            </Tab>
            <Tab eventKey="table" title="来場者集計">
              <CalendarTable activeTab={activeTab} />
            </Tab>
            <Tab eventKey="campaign" title="キャンペーン集計">
              <CalendarCampaign activeTab={activeTab} />
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default CalendarHome
