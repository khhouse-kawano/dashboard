import React, { useEffect, useState, useContext } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import AuthContext from '../context/AuthContext';
import CampaignSummary from './Campaign';
import CampaignList from './CampaignList';
import { useNavigate } from "react-router-dom";


const CampaignDev = () => {
  const [activeTab, setActiveTab] = useState<string | null>('summary');
  const { brand } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!brand || brand.trim() === "") navigate("/");
  }, [])
  return (

    <div className='content database bg-white p-2'>
      <div className="table-wrapper">
        <div className="list_table">
          <Tabs
            defaultActiveKey="list"
            style={{ fontSize: '13px', width: '80vw' }}
            className='justify-content-center mt-3'
            onSelect={key => setActiveTab(key)}
            justify>
            <Tab eventKey="list" title="キャンペーン作成">
              <CampaignList activeTab={activeTab} />
            </Tab>
            <Tab eventKey="summary" title="キャンペーン別反響">
              <CampaignSummary activeTab={activeTab} />
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>


  )
}

export default CampaignDev
