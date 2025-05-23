import React,{ useState } from 'react';
import { useLocation } from 'react-router-dom';
import Menu from './Menu.js';
import CalendarShop from "./Calendar";
import CalendarList from "./CalendarList";
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';


const CalendarHome = () => {
  const location = useLocation();
  const { brand } = location.state || {};
  const [activeTab, setActiveTab] = useState<string | null>('list');
  return (
    <div>
      <Menu brand={brand} />
      <div className='container bg-white py-3 mt-2'>
        <Tabs
          defaultActiveKey="list"
          className='justify-content-center'
          onSelect={key => setActiveTab(key)}
        >
          <Tab eventKey="list" title="全体リスト">
            <CalendarList activeTab={activeTab}/>
          </Tab>
          <Tab eventKey="shop" title="店舗ごとに表示">
            <CalendarShop activeTab={activeTab}/>
          </Tab>
        </Tabs>
      </div>
    </div>
  )
}

export default CalendarHome
