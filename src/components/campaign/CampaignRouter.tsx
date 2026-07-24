import React, { useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import CampaignSummary from './CampaignSummary';
import CampaignList from './CampaignList';

const CampaignRouter = () => {
  const [activeTab, setActiveTab] = useState<string | null>('summary');

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

export default CampaignRouter
