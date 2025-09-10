import React, { useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from "react-router-dom";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import axios from "axios";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';
import type { MasterData } from "./MasterData.ts";

type shopList = { brand: string, shop: string };
type staffList = { name: string; shop: string; pg_id: string; category: number };
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; };
type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number }

const Database = () => {
  const navigate = useNavigate();
  const { brand } = useContext(AuthContext);
  const [shopArray, setShopArray] = useState<shopList[]>([]);
  const [mediumArray, setMediumArray] = useState<string[]>([]);
  const [staffArray, setStaffArray] = useState<staffList[]>([]);
  const [monthArray, setMonthArray] = useState<string[]>([]);
  const [originalDatabase, setOriginalDatabase] = useState<customerList[]>([]);
  const [filteredDatabase, setFilteredDatabase] = useState<customerList[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('')
  const [selectedRegister, setSelectedRegister] = useState<string>('')
  const [selectedReserve, setSelectedReserve] = useState<string>('')
  const [selectedRank, setSelectedRank] = useState<string>('')
  const [selectedMedium, setSelectedMedium] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchedName, setSearchedName] = useState<string>('')
  const [searchedStaff, setSearchedStaff] = useState<string>('')
  const [displayLength, setDisplayLength] = useState<number>(20);
  const [beforeSurvey, setBeforeSurvey] = useState<number | null>(null);
  const [beforeInterview, setBeforeInterview] = useState<number | null>(null);
  const [afterInterview, setAfterInterview] = useState<number | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [sliceStart, setSliceStart] = useState<number>(0);
  const [modalShow, setModalShow] = useState(false);
  const [basicLength, setBasicLength] = useState<number>(20);
  const [question, setQuestion] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string[]>([]);
  const createEmptyMasterData = (): MasterData => {
    const keys = Object.keys({} as MasterData) as (keyof MasterData)[];
    return keys.reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {} as MasterData);
  };
  const [masterData, setMasterData] = useState<MasterData>(createEmptyMasterData());
  const [updatedData, setUpdatedData] = useState<MasterData>(createEmptyMasterData());

  useEffect(() => {
    // if( !brand || brand.trim() === "") navigate("/");
    const getYearMonthArray = (startYear: number, startMonth: number) => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const yearMonthArray: string[] = [];
      let year = startYear;
      let month = startMonth;

      while (
        year < currentYear ||
        (year === currentYear && month <= currentMonth)
      ) {
        const formattedMonth = month.toString().padStart(2, "0");
        yearMonthArray.push(`${year}/${formattedMonth}`);

        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      return yearMonthArray;
    };
    setMonthArray(getYearMonthArray(2025, 1));

    const fetchData = async () => {
      try {
        const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
        const [customerResponse, shopResponse, mediumResponse, staffResponse] = await Promise.all([
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
        ]);
        await setOriginalDatabase(customerResponse.data);
        await setShopArray(shopResponse.data.filter((item: shopList) => !item.shop.includes('店舗未設定')));
        await setMediumArray(mediumResponse.data.map((item: MediumType) => item.medium));
        await setDisplayLength(customerResponse.data.length);
        await setStaffArray(staffResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const filtered = originalDatabase.filter(item => {
        if (selectedShop && !item.shop.includes(selectedShop)) return false;
        if (selectedRegister && !item.register.includes(selectedRegister)) return false;
        if (selectedReserve && !item.reserve.includes(selectedReserve)) return false;
        if (selectedRank && !item.rank.includes(selectedRank)) return false;
        if (selectedMedium && !item.medium.includes(selectedMedium)) return false;
        if (selectedStatus && !item.status.includes(selectedStatus)) return false;
        if (searchedName && !item.name.includes(searchedName)) return false;
        if (searchedStaff && !item.staff.includes(searchedStaff)) return false;
        if (beforeSurvey !== null && item.before_survey !== beforeSurvey) return false;
        if (beforeInterview !== null && item.before_interview !== beforeInterview) return false;
        if (afterInterview !== null && item.after_interview !== afterInterview) return false;
        return true;
      });

      await setFilteredDatabase(filtered);
      await setDisplayLength(filtered.length);
    };

    setActivePage(1);
    setSliceStart(0);
    fetchData();
  }, [
    originalDatabase,
    selectedShop,
    selectedRegister,
    selectedReserve,
    selectedRank,
    selectedMedium,
    selectedStatus,
    searchedName,
    searchedStaff,
    beforeSurvey,
    beforeInterview,
    afterInterview
  ]);


  // ページングリンク

  let page1;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page1 = activePage - 4;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page1 = activePage - 3;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page1 = activePage - 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page1 = activePage - 2;
  } else {
    page1 = 1
  }

  let page2;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page2 = activePage - 3;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page2 = activePage - 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page2 = activePage - 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page2 = activePage - 1;
  } else if (Math.ceil(displayLength / basicLength) < 2) {
    page2 = null;
  } else {
    page2 = 2
  }

  let page3;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page3 = activePage - 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page3 = activePage - 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page3 = activePage;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page3 = activePage;
  } else if (Math.ceil(displayLength / basicLength) < 3) {
    page3 = null;
  } else {
    page3 = 3;
  }

  let page4;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page4 = activePage - 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page4 = activePage;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page4 = activePage + 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page4 = activePage + 1;
  } else if (Math.ceil(displayLength / basicLength) < 4) {
    page4 = null;
  } else {
    page4 = 4;
  }

  let page5;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page5 = activePage;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page5 = activePage + 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page5 = activePage + 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page5 = activePage + 2;
  } else if (Math.ceil(displayLength / basicLength) < 5) {
    page5 = null;
  } else {
    page5 = 5;
  }

  const handlePageClick = async (page: number) => {
    setActivePage(page);
    setSliceStart((page - 1) * basicLength);
  };


  // モーダル画面
  const showSurvey = async (idValue: string, request: string, name: string, shop: string) => {
    if (request === 'before_visit') {
      const nameValue = name.replace(/　| /g, "");
      const brandValue = shop.slice(0, 2);
      const postData = {
        name: nameValue,
        brand: brandValue,
        demand: 'show_before_survey'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const filtered: string[] = Object.values(response.data);
          setAnswer(filtered.slice(4));
          setQuestion(['来場前アンケート', '氏名', 'いつから検討を始めたか', '入居希望時期', '何社の住宅会社へ訪問したか', '検討し始めた理由', 'その他検討理由', '今後の予定'
            , 'その他行動予定', '希望する家の広さ', '希望の間取り', '重視項目', '入居予定人数', '総予算', '月々の希望返済額', '前年度年収', '勤続年数', '年収のある家族', '年収のある家族の年収'
            , '自己資金での支払い予定', 'その他ローン', '来場日に希望すること', 'その他希望', 'どのような住まいが希望か', 'その他希望', '希望エリア', '紹介者様', 'メールアドレス'
          ]);
        } catch (error) {
          alert('アンケートデータの取得に失敗')
        }
      };
      await fetchData();
    } else if (request === 'before_interview') {
      const nameValue = name.replace(/　| /g, "");
      const brandValue = shop.slice(0, 2);
      const postData = {
        id: idValue,
        name: nameValue,
        brand: brandValue,
        demand: 'show_before_interview'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const filtered: string[] = Object.values(response.data);
          setAnswer(filtered.slice(2, 15))
          setQuestion(['面談前アンケート', '氏名', '来場店舗', 'お問合せのきっかけ', 'おうちづくりを検討したきっかけ', '注文住宅に興味を持った理由', '新築の計画', '希望入居時期', '土地の状況'
            , '建築予定地', 'こだわりたいポイント', '総予算', '要望', 'その他意見等']);
        } catch (error) {
          alert('アンケートデータの取得に失敗')
        }
      };
      await fetchData();
    } else if (request === 'after_interview') {
      const nameValue = name.replace(/　| /g, "");
      const brandValue = shop.slice(0, 2);
      const postData = {
        id: idValue,
        name: nameValue,
        brand: brandValue,
        demand: 'show_after_interview'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const filtered: string[] = Object.values(response.data);
          const sliced1 = filtered.slice(4);
          const result = sliced1.slice(0, 1).concat(sliced1.slice(2));

          setAnswer(result);
          setQuestion(['面談後アンケート', '氏名', '面談で伝えた内容', '持ち家が欲しいと思えたか', '条件さえ整えば今すぐ家を建てようと思えたか', '最も重視したい項目', '弊社は家づくりの第一候補となれたか', 'ほかで気になるメーカー', '接客担当'
            , '接客の満足度', '提案の満足度', 'もっと知りたかった点、改善してほしい点', '担当変更について', '次回相談したい内容や要望、質問など']);
        } catch (error) {
          alert('アンケートデータの取得に失敗')
        }
      };
      await fetchData();
    } else if (request === 'information_edit') {
      const postData = {
        id: idValue,
        demand: 'show_customer_interview'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          setMasterData(response.data);
          setQuestion(['顧客情報修正']);
        } catch (error) {
          alert('アンケートデータの取得に失敗')
        }
      };
      await fetchData();
    }
    setModalShow(true);
  };

  const modalClose = () => {
    setAnswer([]);
    setQuestion([]);
    setModalShow(false);
  }

  return (
    <div>
      <Menu brand={brand} />
      <div className='container bg-white py-3 mt-2'>
        <div className='pb-3 row'>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => setSelectedShop(e.target.value)}>
              <option value="">店舗を選択</option>
              {shopArray.map((item, index) => <option key={index} value={item.shop}>{item.shop}</option>)}
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => setSelectedRegister(e.target.value)}>
              <option value="">反響月を選択</option>
              {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => setSelectedReserve(e.target.value)}>
              <option value="">初回来場月を選択</option>
              {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => setSelectedRank(e.target.value)}>
              <option value="">ランクを選択</option>
              <option value="Aランク">Aランク</option>
              <option value="Bランク">Bランク</option>
              <option value="Cランク">Cランク</option>
              <option value="Dランク">Dランク</option>
              <option value="Eランク">Eランク</option>
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => setSelectedMedium(e.target.value)}>
              <option value="">販促媒体を選択</option>
              {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">ステータスを選択</option>
              <option value="見込み">見込み</option>
              <option value="契約済み">契約済み</option>
              <option value="失注">失注</option>
              <option value="会社管理">会社管理</option>
            </select>
          </div>
        </div>
        <div className='pb-3 row'>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => {
              const value = e.target.value;
              setBeforeSurvey(value === "" ? null : Number(value));
            }}
            >
              <option value="">来場前アンケート</option>
              <option value="1">回答済み</option>
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => {
              const value = e.target.value;
              setBeforeInterview(value === "" ? null : Number(value));
            }}>
              <option value="">面談前アンケート</option>
              <option value="1">回答済み</option>
            </select>
          </div>
          <div className="d-flex col-2">
            <select className="form-select campaign position-relative me-2" style={{ fontSize: '13px' }} onChange={(e) => {
              const value = e.target.value;
              setAfterInterview(value === "" ? null : Number(value));
            }}>
              <option value="">面談後アンケート</option>
              <option value="1">回答済み</option>
            </select>
          </div>
          <div className="d-flex col">
            <input className="form-control campaign position-relative me-2" placeholder='顧客名で検索' style={{ fontSize: '13px' }} onChange={(e) => setSearchedName(e.target.value)} />
          </div>
          <div className="d-flex col">
            <input className="form-control campaign position-relative me-2" placeholder='営業名で検索' style={{ fontSize: '13px' }} onChange={(e) => setSearchedStaff(e.target.value)} />
          </div>
        </div>
        <div className="d-flex align-items-center">
          <div className="">{filteredDatabase.length}<span style={{ fontSize: '12px' }}> 件中 {sliceStart + 1}件~{filteredDatabase.length > activePage * basicLength ? activePage * basicLength : filteredDatabase.length}件 　　表示件数</span>
          </div>
          <div className="ms-1">
            <select style={{ fontSize: '11px', borderRadius: '5px', width: '70px' }} onChange={(e) => setBasicLength(Number(e.target.value))}>
              <option value='20'>20件</option>
              <option value='50'>50件</option>
              <option value='100'>100件</option>
              <option value='500'>500件</option>
            </select>
          </div>
          <div className="ms-5 pt-3">
            <ul className="custom-pagination">
              <li>
                <button onClick={() => handlePageClick(1)}>«</button>
              </li>
              <li>
                <button onClick={() => handlePageClick(Math.max(activePage - 1, 1))}>‹</button>
              </li>

              <li className={activePage === page1 ? 'active' : ''}>
                <button onClick={() => handlePageClick(page1)}>{page1}</button>
              </li>
              {page2 !== null && (
                <li className={activePage === page2 ? 'active' : ''}>
                  <button onClick={() => handlePageClick(page2)}>{page2}</button>
                </li>
              )}
              {page3 !== null && (
                <li className={activePage === page3 ? 'active' : ''}>
                  <button onClick={() => handlePageClick(page3)}>{page3}</button>
                </li>
              )}
              {page4 !== null && (
                <li className={activePage === page4 ? 'active' : ''}>
                  <button onClick={() => handlePageClick(page4)}>{page4}</button>
                </li>
              )}
              {page5 !== null && (
                <li className={activePage === page5 ? 'active' : ''}>
                  <button onClick={() => handlePageClick(page5)}>{page5}</button>
                </li>
              )}

              <li>
                <button onClick={() => handlePageClick(activePage + 1 < Math.ceil(displayLength / basicLength) ? activePage + 1 : Math.ceil(displayLength / basicLength))}>›</button>
              </li>
              <li>
                <button onClick={() => handlePageClick(Math.ceil(displayLength / basicLength))}>»</button>
              </li>
            </ul>
          </div>
        </div>
        <Table striped>
          <thead style={{ fontSize: "11px", textAlign: 'center' }}>
            <tr>
              <th>顧客情報編集</th>
              <th>店舗</th>
              <th>顧客名</th>
              <th>担当営業</th>
              <th>ステータス</th>
              <th>反響日</th>
              <th>初回来場日</th>
              <th>ランク</th>
              <th>販促媒体</th>
              <th>来場前<br />アンケート</th>
              <th>面談前<br />アンケート</th>
              <th>面談後<br />アンケート</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: "12px", textAlign: 'center' }}>
            {filteredDatabase.slice(sliceStart, sliceStart + basicLength).map((item, index) =>
              <tr key={index}>
                <td><div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto' }} onClick={() => showSurvey(item.id, 'information_edit', '', '')}>編集</div></td>
                <td>{item.shop}</td>
                <td>{item.name}</td>
                <td>{item.staff}</td>
                <td>{item.status}</td>
                <td>{item.register}</td>
                <td>{item.reserve}</td>
                <td>{item.rank}</td>
                <td>{item.medium}</td>
                <td>{item.before_survey !== 1 || <div className='hover bg-primary text-white' style={{ fontSize: "11px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto' }} onClick={() => showSurvey(item.id, 'before_visit', item.name, item.shop)}>詳細</div>}</td>
                <td>{item.before_interview !== 1 || <div className='hover bg-primary text-white' style={{ fontSize: "11px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto' }} onClick={() => showSurvey(item.id, 'before_interview', item.name, item.shop)}>詳細</div>}</td>
                <td>{item.after_interview !== 1 || <div className='hover bg-primary text-white' style={{ fontSize: "11px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto' }} onClick={() => showSurvey(item.id, 'after_interview', item.name, item.shop)}>詳細</div>}</td>
              </tr>)}
          </tbody>
        </Table>
      </div>
      <Modal show={modalShow} onHide={modalClose} size='xl' style={{ overflowY: 'hidden', padding: '1rem' }}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '13px' }}>{question[0]}
            {question[0] === '顧客情報修正' &&
              <div className="d-flex flex-wrap " style={{ width: '100%', marginTop: '10px' }}>
                <div className='menu_tab' onClick={()=> document.getElementById('customer_contacts_name')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>お客様名</div>
                <div className='menu_tab' onClick={()=> document.getElementById('in_charge_user')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>担当営業</div>
                <div className='menu_tab' onClick={()=> document.getElementById('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>お問い合わせ日</div>
                <div className='menu_tab' onClick={()=> document.getElementById('step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>初回来場日</div>
                <div className='menu_tab' onClick={()=> document.getElementById('step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>LINEグループ作成日</div>
                <div className='menu_tab' onClick={()=> document.getElementById('step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>事前審査</div>
                <div className='menu_tab' onClick={()=> document.getElementById('step_migration_item_01JSENACS2FC422ZHEZWNSXNYA')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>次回来場日</div>
                <div className='menu_tab' onClick={()=> document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>連絡先</div>
                <div className='menu_tab' onClick={()=> document.getElementById('address')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>住所</div>
                <div className='menu_tab' onClick={()=> document.getElementById('has_owned_land')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>土地の有無</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>重視項目</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customized_input_01JSE7RNV3VK78YC2GYAG0554D')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>契約スケジュール</div>
                <div className='menu_tab' onClick={()=> document.getElementById('budget')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>予算総額</div>
                <div className='menu_tab' onClick={()=> document.getElementById('monthly_repayment_amount')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>月々支払予算</div>
                <div className='menu_tab' onClick={()=> document.getElementById('repayment_years')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>返済希望年数</div>
                <div className='menu_tab' onClick={()=> document.getElementById('current_rent')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>現居家賃</div>
                <div className='menu_tab' onClick={()=> document.getElementById('self_budget')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>自己資金</div>
                <div className='menu_tab' onClick={()=> document.getElementById('current_utility_costs')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>現居光熱費</div>
                <div className='menu_tab' onClick={()=> document.getElementById('current_loan_balance')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>負債総額</div>
                <div className='menu_tab' onClick={()=> document.getElementById('current_contract_type')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>現居契約形態</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customer_contacts_employment_type')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>雇用形態</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customer_contacts_employer_name')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>勤務先名</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customer_contacts_employer_address')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>勤務先住所</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customer_contacts_years_of_service')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>勤続年数</div>
                <div className='menu_tab' onClick={()=> document.getElementById('customer_contacts_annual_income')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>年収</div>
                <div className='menu_tab' onClick={()=> document.getElementById('desired_land_area')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>希望土地面積</div>
                <div className='menu_tab' onClick={()=> document.getElementById('land_budget')?.scrollIntoView({ behavior: 'smooth', block: 'start'})}>土地予算</div>
                <div className='menu_tab'>土地予算</div>
                <div className='menu_tab'>土地予算</div>
              </div>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ height: '70vh', overflowY: 'auto', padding: '1rem', width: '%' }}>
          {question[0] === '来場前アンケート' || question[0] === '面談前アンケート' || question[0] === '面談後アンケート' ? (
            <div className="d-flex flex-wrap" style={{ margin: '0 auto' }}>
              {answer.map((item, index) => (
                <div className="box m-2" style={{ width: '30%', borderBottom: '1px solid #D3D3D3', paddingBottom: '5px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px' }}>{question[index + 1]}</div>
                  <div style={{ fontSize: '13px', letterSpacing: '.6px' }}>{item}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <tbody>
                  <tr id='customer_contacts_name'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>お客様名</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='名前（漢字）' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_name}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_name: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_name: e.target.value
                            }
                          ));
                        }} />
                      <input type='text' placeholder='名前（かな）' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_name_kana}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_name_kana: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_name_kana: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>担当店舗</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px', paddingLeft: '15px' }}>{masterData.in_charge_store}</td>
                  </tr>
                  <tr id='in_charge_user'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>担当営業</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.in_charge_user}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              in_charge_user: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              in_charge_user: e.target.value
                            }
                          ));
                        }}>
                        {staffArray.filter(item => item.shop === masterData.in_charge_store).map((item, index) =>
                          <option key={index} value={item.name}>{item.name}</option>
                        )}
                      </select>
                    </td>
                  </tr>
                  <tr id='step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>お問い合わせ日</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 && masterData.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99.replace(/\//g, "-")}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>初回来場日</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 && masterData.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7.replace(/\//g, "-")}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>LINEグループ作成日</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN && masterData.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN.replace(/\//g, "-")}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>事前審査</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR && masterData.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR.replace(/\//g, "-")}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>次回来場日</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA && masterData.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA.replace(/\//g, "-")}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='contact'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>連絡先</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='固定電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_phone_number}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_phone_number: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_phone_number: e.target.value
                            }
                          ));
                        }} />
                      <input type='text' placeholder='携帯電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_mobile_phone_number}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_mobile_phone_number: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_mobile_phone_number: e.target.value
                            }
                          ));
                        }} />
                      <input type='text' placeholder='メールアドレス' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '250px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_email}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_email: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_email: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='address'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>住所</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='郵便番号' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '100px', paddingLeft: '10px' }} value={masterData.postal_code}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              postal_code: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              postal_code: e.target.value
                            }
                          ));
                        }} />
                      <input type='text' placeholder='住所' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '400px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.full_address}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              full_address: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              full_address: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='has_owned_land'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の有無</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.has_owned_land}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              has_owned_land: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              has_owned_land: e.target.value
                            }
                          ));
                        }}>
                        <option value="無">無</option><option value="有">有</option>
                      </select>
                    </td>
                  </tr>
                  <tr id='customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>重視項目</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: e.target.value
                            }
                          ));
                        }}>
                        <option value="">選択してください</option>
                        <option value="性能">性能</option>
                        <option value="デザイン">デザイン</option>
                        <option value="価格">価格</option>
                        <option value="アフターサービス">アフターサービス</option>
                      </select>
                    </td>
                  </tr>
                  <tr id='customized_input_01JSE7RNV3VK78YC2GYAG0554D'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>契約スケジュール</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01JSE7RNV3VK78YC2GYAG0554D}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customized_input_01JSE7RNV3VK78YC2GYAG0554D: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customized_input_01JSE7RNV3VK78YC2GYAG0554D: e.target.value
                            }
                          ));
                        }}>
                        <option value="">選択してください</option>
                        <option value="半月内">半月内</option>
                        <option value="月内">月内</option>
                        <option value="1か月後">1か月後</option>
                        <option value="3か月後">3か月後</option>
                        <option value="価格">価格</option>
                        <option value="9か月後">9か月後</option>
                        <option value="1年以上後">1年以上後</option>
                      </select>
                    </td>
                  </tr>
                  <tr id='budget'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>予算総額</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.budget ? masterData.budget.replace('万円', '') : ''}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              budget: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              budget: e.target.value
                            }
                          ));
                        }} />万円
                    </td>
                  </tr>
                  <tr id='monthly_repayment_amount'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>月々支払予算</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.monthly_repayment_amount ? Number(masterData.monthly_repayment_amount) / 10000 : ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const sanitized = raw.replace(/[^\d.]/g, '');
                          const parsed = parseFloat(sanitized);
                          if (!isNaN(parsed)) {
                            const valueInYen = String(Math.round(parsed * 10000));
                            setMasterData(prev => ({ ...prev, monthly_repayment_amount: valueInYen }));
                            setUpdatedData(prev => ({ ...prev, monthly_repayment_amount: valueInYen }));
                          } else {
                            setMasterData(prev => ({ ...prev, monthly_repayment_amount: '' }));
                            setUpdatedData(prev => ({ ...prev, monthly_repayment_amount: '' }));
                          }
                        }}
                      />万円
                    </td>
                  </tr>
                  <tr id='repayment_years'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>返済希望年数</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.repayment_years ? masterData.repayment_years.replace(/[年\/]/g, '') : ''}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              repayment_years: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              repayment_years: e.target.value
                            }
                          ));
                        }} />年
                    </td>
                  </tr>
                  <tr id='current_rent'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居家賃</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='現居家賃' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.current_rent ? masterData.current_rent.replace('万円', '') : ''}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              current_rent: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              current_rent: e.target.value
                            }
                          ));
                        }} />万円
                    </td>
                  </tr>
                  <tr id='self_budget'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>自己資金</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.self_budget ? Number(masterData.self_budget) / 10000 : ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const sanitized = raw.replace(/[^\d.]/g, '');
                          const parsed = parseFloat(sanitized);
                          if (!isNaN(parsed)) {
                            const valueInYen = String(Math.round(parsed * 10000));
                            setMasterData(prev => ({ ...prev, self_budget: valueInYen }));
                            setUpdatedData(prev => ({ ...prev, self_budget: valueInYen }));
                          } else {
                            setMasterData(prev => ({ ...prev, self_budget: '' }));
                            setUpdatedData(prev => ({ ...prev, self_budget: '' }));
                          }
                        }}
                      />万円
                    </td>
                  </tr>
                  <tr id='current_utility_costs'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居光熱費</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type="text" placeholder="現居光熱費" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.current_utility_costs}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              current_utility_costs: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              current_utility_costs: e.target.value
                            }
                          ));
                        }} />万円
                    </td>
                  </tr>
                  <tr id='current_loan_balance'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>負債総額</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.current_loan_balance ? Number(masterData.current_loan_balance) / 10000 : ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const sanitized = raw.replace(/[^\d.]/g, '');
                          const parsed = parseFloat(sanitized);
                          if (!isNaN(parsed)) {
                            const valueInYen = String(Math.round(parsed * 10000));
                            setMasterData(prev => ({ ...prev, current_loan_balance: valueInYen }));
                            setUpdatedData(prev => ({ ...prev, current_loan_balance: valueInYen }));
                          } else {
                            setMasterData(prev => ({ ...prev, current_loan_balance: '' }));
                            setUpdatedData(prev => ({ ...prev, current_loan_balance: '' }));
                          }
                        }}
                      />万円
                    </td>
                  </tr>
                  <tr id='current_contract_type'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居契約形態</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.current_contract_type}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              current_contract_type: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              current_contract_type: e.target.value
                            }
                          ));
                        }}>
                        <option value="">選択してください</option>
                        <option value="賃貸(マンション)">賃貸(マンション)</option>
                        <option value="賃貸(戸建)">賃貸(戸建)</option>
                        <option value="持家(マンション)">持家(マンション)</option>
                        <option value="持家(戸建)">持家(戸建)</option>
                        <option value="賃貸(アパート)">賃貸(アパート)</option>
                      </select>
                    </td>
                  </tr>
                  <tr id='customer_contacts_employment_type'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>雇用形態</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_employment_type}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_employment_type: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_employment_type: e.target.value
                            }
                          ));
                        }}>
                        <option value="">選択してください</option>
                        <option value="経営者">経営者</option>
                        <option value="正社員">正社員</option>
                        <option value="契約社員">契約社員</option>
                        <option value="パート・アルバイト">パート・アルバイト</option>
                        <option value="派遣社員">派遣社員</option>
                        <option value="専業主婦">専業主婦</option>
                      </select>
                    </td>
                  </tr>
                  <tr id='customer_contacts_employer_name'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先名</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.customer_contacts_employer_name}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_employer_name: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_employer_name: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='customer_contacts_employer_address'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先住所</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.customer_contacts_employer_address}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_employer_address: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_employer_address: e.target.value
                            }
                          ));
                        }} />
                    </td>
                  </tr>
                  <tr id='customer_contacts_years_of_service'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤続年数</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.customer_contacts_years_of_service}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_years_of_service: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_years_of_service: e.target.value
                            }
                          ));
                        }} />年
                    </td>
                  </tr>
                  <tr id='customer_contacts_annual_income'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>年収</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.customer_contacts_annual_income ? masterData.customer_contacts_annual_income.replace('万円', '') : ''}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              customer_contacts_annual_income: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              customer_contacts_annual_income: e.target.value
                            }
                          ));
                        }} />万円
                    </td>
                  </tr>
                  <tr id='desired_land_area'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>希望土地面積</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.desired_land_area}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              desired_land_area: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              desired_land_area: e.target.value
                            }
                          ));
                        }} />坪
                    </td>
                  </tr>
                  <tr id='land_budget'>
                    <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の予算</td>
                    <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                      <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                        value={masterData.land_budget ? masterData.land_budget.replace('万円', '') : ''}
                        onChange={(e) => {
                          setMasterData(prev => (
                            {
                              ...prev,
                              land_budget: e.target.value
                            }
                          ));
                          setUpdatedData(prev => (
                            {
                              ...prev,
                              land_budget: e.target.value
                            }
                          ));
                        }} />万円
                    </td>
                  </tr>
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default Database
