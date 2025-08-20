import React ,{ useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from "react-router-dom";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import axios from "axios";
import Pagination from 'react-bootstrap/Pagination';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';

type shopList = { brand: string, shop: string };
type staffList = { name: string, shop: string; pg_id: string; category: number };
type customerList = {[key: string]: string;};
type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number}

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
  const [activePage, setActivePage] = useState<number>(1);
  const [sliceStart, setSliceStart] = useState<number>(0);
  const [modalShow, setModalShow] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<customerList[]>([]);
  const [updateData, setUpdateData] = useState({
    id: "",
    shop: "",
    name: "",
    staff: "",
    register: "",
    reserve: "",
    rank: "",
    medium: "",
    appointment: "",
    line_group: "",
    screening: "",
    period: "",
    rival: "",
    estate: "",
    budget: "",
    importance: "",
    survey: "",
    note: ""
  })

  useEffect(()=>{
    // if( !brand || brand.trim() === "") navigate("/");
    const getYearMonthArray = (startYear:number, startMonth:number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;   
    const yearMonthArray = [];
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
              const [customerResponse, shopResponse, mediumResponse, staffResponse] = await Promise.all([
                axios.post("/dashboard/api/customerList.php"),
                axios.post("/dashboard/api/shopList.php", {demand: "database"}),
                axios.post("/dashboard/api/mediumList.php"),
                axios.post("/dashboard/api/staffList.php", {demand: "database"})
              ]);
              await setOriginalDatabase(customerResponse.data);
              await setShopArray(shopResponse.data.filter( (item: shopList) => !item.shop.includes('店舗未設定')));
              await setMediumArray(mediumResponse.data.map( (item: MediumType) => item.medium));
              await setDisplayLength(customerResponse.data.length);
              await setStaffArray(staffResponse.data);
            } catch (error) {
              console.error("Error fetching data:", error);
            }
          };
        
      fetchData();
    },[])

  useEffect(() => {
    const fetchData = async () =>{
      await setFilteredDatabase(originalDatabase.filter( item => 
        item.shop.includes(selectedShop) &&
        item.register.includes(selectedRegister) &&
        item.reserve.includes(selectedReserve) &&
        item.rank.includes(selectedRank) &&
        item.medium.includes(selectedMedium) &&
        item.status.includes(selectedStatus) &&
        item.name.includes(searchedName) &&
        item.staff.includes(searchedStaff)
      ));
      await setDisplayLength(originalDatabase.filter( item => 
        item.shop.includes(selectedShop) &&
        item.register.includes(selectedRegister) &&
        item.reserve.includes(selectedReserve) &&
        item.rank.includes(selectedRank) &&
        item.medium.includes(selectedMedium) &&
        item.status.includes(selectedStatus) &&
        item.name.includes(searchedName) &&
        item.staff.includes(searchedStaff)
      ).length);
    };
    setActivePage(1);
    setSliceStart(0);
    fetchData();
  }, [originalDatabase, selectedShop, selectedMedium, selectedRank, selectedRegister, selectedReserve, selectedStatus, searchedName, searchedStaff])

  useEffect(() => {
      console.log("更新後のデータ:", updateData);
  }, [updateData]);

    // ページングリンク
    const page1 = activePage > 3 && Math.ceil(displayLength/20) > 6 ? activePage - 2 : 1;

    let page2;
    if ( activePage > 3 && Math.ceil(displayLength/20) > 6 ){
      page2 = activePage - 1;
    } else if( Math.ceil(displayLength/20) < 2 ){
      page2 = null;
    } else{
      page2 = 2
    }

    let page3;
    if ( activePage > 3 && Math.ceil(displayLength/20) > 6 ){
      page3 = activePage;
    } else if( Math.ceil(displayLength/20) < 3 ){
      page3 = null;
    } else{
      page3 = 3;
    }

    let page4;
    if ( activePage > 3 && Math.ceil(displayLength/20) > 6 ){
      page4 = activePage + 1;
    } else if( Math.ceil(displayLength/20) < 4 ){
      page4 = null;
    } else{
      page4 = 4;
    }

    let page5;
    if ( activePage > 3 && Math.ceil(displayLength/20) > 6 ){
      page5 = activePage + 2;
    } else if( Math.ceil(displayLength/20) < 5 ){
      page5 = null;
    } else{
      page5 = 5;
    }

  const handlePageClick = async ( page:number ) => {
    setActivePage(page);
    setSliceStart((page - 1) * 20);
  };


  // モーダル画面
  useEffect(() =>{
    const fetchData = async()=>{
      await setUpdateData({
        id: customerDetail[0]['id'],
        shop: customerDetail[0]['shop'],
        name: customerDetail[0]['name'],
        staff: customerDetail[0]['staff'],
        register: customerDetail[0]['register'],
        reserve: customerDetail[0]['reserve'],
        rank: customerDetail[0]['rank'],
        medium: customerDetail[0]['medium'],
        appointment: customerDetail[0]['appointment'],
        line_group: customerDetail[0]['line_group'],
        screening: customerDetail[0]['screening'],
        period: customerDetail[0]['period'],
        rival: customerDetail[0]['rival'],
        estate: customerDetail[0]['estate'],
        budget: customerDetail[0]['budget'],
        importance: customerDetail[0]['importance'],
        survey: customerDetail[0]['survey'],
        note: customerDetail[0]['note']
      });
    };

    fetchData();
  },[customerDetail]);


  const modalOfModalClose = () =>{
    setModalShow(false);
  };

  const showDetail = async(id: string) =>{
      try {
        const response = await axios.post("/dashboard/api/rankedCustomerDetail.php", {
          id: id,
          demand: "database"
        });
        await setCustomerDetail(response.data); 
      } catch (error) {
        await console.error("Error fetching user data:", error);
        await setCustomerDetail([]);
      }

    await setModalShow(true);
  };

  const handleChange = async(event:React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    const today = new Date();
    const formattedDate = today.toLocaleString("ja-jp", { timeZone: "Asia/Tokyo" });

    await setUpdateData(prevData => ({
      ...prevData,
      [name]: value,
      demand: 'changeByDashboard'
    }));
    await console.log(updateData);
  };

  const handleSubmit = async () => {
    const formElements = document.querySelectorAll(".form-control, .form-select, textarea, input[type='hidden']");

    const data: Record<string, string> = {};
      formElements.forEach((element) => {
        const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        data[input.name] = input.value;
    });

    console.log("送信データ:", data);
    let message;

    try {
      const response = await fetch("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/update",{
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      message = result.message;
      console.log(message);
    } catch (error) {
        console.error("エラー発生:", error);
        alert("同期に失敗しました...");
    }

    try {
        const response = await axios.post("/dashboard/api/updateDatabase.php",
          updateData,
          {headers: {
          "Content-Type": "application/json"}
          },
        );
        const result = await response.data;
        message = result.message;
        console.log(message);
    } catch (error) {
        console.error("エラー発生:", error);
        alert("送信に失敗しました...");
    }
    setModalShow(false);
};

  return (
    <div>
      <Menu brand={brand} />
      <div className='container bg-white py-3 mt-2'>
        <div className='pb-3 row'>
          <div className="d-flex col">
            <select className="form-select campaign position-relative me-2" style={{fontSize: '13px'}} onChange={(e)=>setSelectedShop(e.target.value)}>
              <option value="">店舗を選択</option>
              {shopArray.map((item, index) => <option key={index} value={item.shop}>{item.shop}</option>)}
            </select>
          </div>
          <div className="d-flex col">
            <select className="form-select campaign position-relative me-2" style={{fontSize: '13px'}} onChange={(e)=>setSelectedRegister(e.target.value)}>
              <option value="">反響月を選択</option>
              {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="d-flex col">
            <select className="form-select campaign position-relative me-2" style={{fontSize: '13px'}} onChange={(e)=>setSelectedReserve(e.target.value)}>
              <option value="">初回来場月を選択</option>
              {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="d-flex col">
            <select className="form-select campaign position-relative me-2" style={{fontSize: '13px'}} onChange={(e)=>setSelectedRank(e.target.value)}>
              <option value="">ランクを選択</option>
              <option value="Aランク">Aランク</option>
              <option value="Bランク">Bランク</option>
              <option value="Cランク">Cランク</option>
              <option value="Dランク">Dランク</option>
              <option value="Eランク">Eランク</option>
            </select>
          </div>
          <div className="d-flex col">
            <select className="form-select campaign position-relative me-2" style={{fontSize: '13px'}} onChange={(e)=>setSelectedMedium(e.target.value)}>
              <option value="">販促媒体を選択</option>
              {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="d-flex col">
            <select className="form-select campaign position-relative me-2" style={{fontSize: '13px'}} onChange={(e)=>setSelectedStatus(e.target.value)}>
              <option value="">ステータスを選択</option>
              <option value="見込み">見込み</option>
              <option value="契約済み">契約済み</option>
              <option value="失注">失注</option>
              <option value="会社管理">会社管理</option>
            </select>
          </div>
        </div>
        <div className='pb-3 row'>
          <div className="d-flex col-4">
            <input className="form-control campaign position-relative me-2" placeholder='顧客名で検索' style={{fontSize: '13px'}} onChange={(e)=>setSearchedName(e.target.value)}/>
          </div>
          <div className="d-flex col-4">
            <input className="form-control campaign position-relative me-2" placeholder='営業名で検索' style={{fontSize: '13px'}} onChange={(e)=>setSearchedStaff(e.target.value)}/>
          </div>
        </div>
      <Table striped>
        <thead style={{ fontSize: "13px"}}>
          <tr>
            <th>店舗</th>
            <th>顧客名</th>
            <th>担当営業</th>
            <th>ステータス</th>
            <th>反響日</th>
            <th>初回来場日</th>
            <th>ランク</th>
            <th>販促媒体</th>
            <th></th>
          </tr>
        </thead>
        <tbody style={{ fontSize: "13px"}}>
          {filteredDatabase.slice( sliceStart, sliceStart + 20 ).map((item, index) =>
          <tr key={index}>
            <td>{item.shop}</td>
            <td>{item.name}</td>
            <td>{item.staff}</td>
            <td>{item.status}</td>
            <td>{item.register}</td>
            <td>{item.reserve}</td>
            <td>{item.rank}</td>
            <td>{item.medium}</td>
            <td><div className='btn bg-primary text-white' style={{ fontSize: "13px"}} onClick={()=>showDetail(item.id)}>詳細</div></td>
              <Modal show={modalShow} onHide={modalOfModalClose} size="xl" aria-labelledby="ranked-modal">
                <Modal.Header closeButton>
                  <Modal.Title id="ranked-modal">顧客情報詳細</Modal.Title>
                    </Modal.Header>
                      <Modal.Body>
                      <div>
                        <div className="row customer-info bg-light pb-3">
                          <div className="col">
                            <p><span>お客様名</span></p>
                            <div style={{ fontSize: "14px", paddingTop: "6px"}}>{updateData.name}</div>
                            <input type="hidden" name="id" value={updateData.id}/>
                            <input type="hidden" name="shop" value={updateData.shop}/>
                          </div>
                          <div className="col">
                            <p><span>担当店舗</span></p>
                            <div style={{ fontSize: "14px", paddingTop: "6px"}}>{updateData.shop}</div>
                          </div>
                          <div className="col">
                            <p><span>担当営業</span></p>
                            <select className='form-select' name='staff' onChange={handleChange} style={{ fontSize: "12px"}}>
                              <option value="">担当営業を選択</option>
                              {staffArray?.filter(item=>item.shop === updateData.shop && item.category === 1).map((item, index) =>
                              <option value={item.pg_id} key={index} selected={item.name===updateData.staff}>{item.name}</option>
                              )}
                            </select>
                          </div>
                          <div className="col">
                            <p><span>名簿取得日</span></p>
                            <input type="date" className="form-control" name="register" value={updateData.register?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                          <div className="col">
                            <p><span>販促媒体名</span></p>
                            <select className='form-select' name='medium' onChange={handleChange} style={{ fontSize: "12px", marginTop: "3px"}}>
                              <option value="">販促媒体を選択</option>
                              {mediumArray?.map((item, index) =>
                              <option value={item} key={index} selected={item===updateData.medium}>{item}</option>
                              )}
                            </select>
                        </div>
                        </div>
                        <div className="row customer-info bg-light pb-3">
                          <div className="col">
                            <p><span>ランク</span></p>
                            <select className='form-select' name='rank' onChange={handleChange} style={{ fontSize: "12px"}}>
                              <option value="">ランクを選択</option>
                              <option value="Aランク" selected={updateData.rank === "Aランク"}>Aランク</option>
                              <option value="Bランク" selected={updateData.rank === "Bランク"}>Bランク</option>
                              <option value="Cランク" selected={updateData.rank === "Cランク"}>Cランク</option>
                              <option value="Dランク" selected={updateData.rank === "Dランク"}>Dランク</option>
                              <option value="Eランク" selected={updateData.rank === "Eランク"}>Eランク</option>
                            </select>
                          </div>
                          <div className="col">
                            <p><span>初回来場日</span></p>
                            <input type="date" className="form-control" name="reserve" value={updateData.reserve?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                          <div className="col">
                            <p><span>次回アポ</span></p>
                            <input type="date" className="form-control" name="appointment" value={updateData.appointment?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                          <div className="col">
                            <p><span>LINEグループ作成</span></p>
                            <input type="date" className="form-control" name="line_group" value={updateData.line_group?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                          <div className="col">
                            <p><span>事前審査</span></p>
                            <input type="date" className="form-control" name="screening" value={updateData.screening?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                        </div>
                        <div className="row customer-info bg-light pb-3">
                          <div className="col">
                            <p><span>競合会社</span></p>
                            <input className='form-control' name='rival' value={updateData.rival} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                          <div className="col">
                            <p><span>土地</span></p>
                            <select className='form-select' name='estate' onChange={handleChange} style={{ fontSize: "12px"}}>
                              <option value="有" selected={updateData.estate === "有"}>有</option>
                              <option value="無" selected={updateData.estate === "無"}>無</option>
                            </select>
                          </div>
                          <div className="col">
                            <p><span>希望予算</span></p>
                            <input type="text" className='form-control' name='budget' value={updateData.budget} onChange={handleChange} style={{ fontSize: "12px"}}/>
                          </div>
                          <div className="col">
                            <p><span>契約スケジュール</span></p>
                            <select className='form-select' name='period' onChange={handleChange} style={{ fontSize: "12px"}}>
                              <option value="">スケジュールを選択</option>
                              <option value="1か月後" selected={updateData.period === "1か月後"}>1か月後</option>
                              <option value="3か月後" selected={updateData.period === "3か月後"}>3か月後</option>
                              <option value="半年後" selected={updateData.period === "半年後"}>半年後</option>
                              <option value="9か月後" selected={updateData.period === "9か月後"}>9か月後</option>
                              <option value="1年以上後" selected={updateData.period === "1年以上後"}>1年以上後</option>
                              <option value="月内" selected={updateData.period === "月内"}>月内</option>
                              <option value="半月内" selected={updateData.period === "半月内"}>半月内</option>
                            </select>
                          </div>
                          <div className="col">
                            <p><span>重視項目</span></p>
                            <select className='form-select' name='importance' onChange={handleChange} style={{ fontSize: "12px"}}>
                              <option value="">重視項目を選択</option>
                              <option value="性能" selected={updateData.importance === "性能"}>性能</option>
                              <option value="デザイン" selected={updateData.importance === "デザイン"}>デザイン</option>
                              <option value="価格" selected={updateData.importance === "価格"}>価格</option>
                            </select>
                          </div>
                        </div>
                        <div className="row customer-info bg-light pb-3">
                          <div className="col">
                            <p style={{ whiteSpace: 'pre-line'}}><span>商談後アンケートorユーザー感想</span></p>
                            <textarea className="form-control" value={updateData.survey} name='survey' rows={updateData.survey.split('\n').length + 1} onChange={handleChange} style={{ fontSize: "12px"}}></textarea>
                          </div>
                        </div>
                        <div className="row customer-info bg-light pb-3">
                          <div className="col">
                          <p style={{ whiteSpace: 'pre-line'}}><span>次回アポまでの対応内容・担当者の感覚</span></p>
                            <textarea className="form-control" value={updateData.note} name='note' rows={updateData.note.split('\n').length + 1} onChange={handleChange} style={{ fontSize: "12px"}}></textarea>
                          </div>
                        </div>
                        <div className="row mt-3 mb-2">
                          <div className='col btn bg-primary me-2 text-white' onClick={handleSubmit}>
                            変更内容を保存      
                          </div>
                          <div className='col btn bg-danger text-white'>
                            <a href={`https://pg-cloud.jp/customers/${updateData.id}/summary`} target="_blank" className='text-white' style={{textDecoration: 'none'}}>PG CLOUDへ移動</a>      
                          </div>
                          <div className='col-6'></div>
                        </div>
                      </div>
                      </Modal.Body>
                    </Modal>  
          </tr>)}
        </tbody>
      </Table>
      <div className="pagination container p-2">
        <Pagination size="lg">
          <Pagination.First onClick={() => handlePageClick(1)} />
          <Pagination.Prev onClick={() => handlePageClick(Math.max(activePage - 1, 1))} />
          <Pagination.Item active={activePage === page1} onClick={() => handlePageClick(page1)}>{page1}</Pagination.Item>
          { page2 ===null ? null : <Pagination.Item active={activePage === page2} onClick={() => handlePageClick(page2)}>{page2}</Pagination.Item> }
          { page3 ===null ? null : <Pagination.Item active={activePage === page3} onClick={() => handlePageClick(page3)}>{page3}</Pagination.Item> }
          { page4 ===null ? null : <Pagination.Item active={activePage === page4} onClick={() => handlePageClick(page4)}>{page4}</Pagination.Item> }
          { page5 ===null ? null : <Pagination.Item active={activePage === page5} onClick={() => handlePageClick(page5)}>{page5}</Pagination.Item> }
          <Pagination.Next onClick={() => handlePageClick( activePage + 1 < Math.ceil(displayLength/20) ? activePage + 1 : Math.ceil(displayLength/20))} />
          <Pagination.Last onClick={() => handlePageClick( Math.ceil(displayLength/20))} />
        </Pagination>
      </div>
      </div>
    </div>
  )
}

export default Database
