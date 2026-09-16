import React, { useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import CampaignSummary from './CampaignSummary';
import CampaignList from './CampaignList';
import FormBuilder from './FormBuilder';

/**
 * キャンペーン関連の画面。
 *
 * ⚠️⚠️ **`activeTab` の初期値は `defaultActiveKey` と必ず揃えること。**
 *   ⚠️ 2026-09-16 まで、初期値が `'summary'` なのに最初に開くタブは `list` だった。
 *     ⚠️ 表示されているタブと、子が受け取る activeTab が**食い違う**状態で、
 *       activeTab を見て読み込む子は**別のタブを開いて戻るまで動かない**。
 */
const CampaignRouter = () => {
  // ⚠️ 下の defaultActiveKey と同じ値にすること
  const [activeTab, setActiveTab] = useState<string | null>('list');

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
            {/* ⚠️ 指示により**一番右**に置いている。並びを変えないこと */}
            <Tab eventKey="builder" title="フォーム作成">
              <FormBuilder activeTab={activeTab} />
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>


  )
}

export default CampaignRouter
