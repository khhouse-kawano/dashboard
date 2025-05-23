import React ,{ useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Modal from 'react-bootstrap/Modal';
import Pagination from 'react-bootstrap/Pagination';


const Rank = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { brand } = location.state || {};
    const [shopList, setShop] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [customerList, setUserData] = useState([]);
    
    useEffect(() => {
      const fetchData = async () => {
        try {
          const [customerResponse, shopResponse, staffResponse] = await Promise.all([
            axios.post("/dashboard/api/customerList.php"),
            axios.post("/dashboard/api/shopList.php"),
            axios.post("/dashboard/api/staffList.php"),
          ]);
    
          setUserData(customerResponse.data);
          setShop(shopResponse.data);
          setStaffList(staffResponse.data);
    
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      };
    
      fetchData();
    }, []);

        const getYearMonthArray = (startYear, startMonth) => {
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
        
              // 次の月に移動
            month++;
            if (month > 12) {
                month = 1;
                year++;
                }
            }
        
            return yearMonthArray;
        };
        
    const [selectedMonth, setSelectedStartMonth] = useState("20");
    const [formattedSelectedMonth, setFormattedSelectedMonth] = useState("20");
    const startMonthArray = getYearMonthArray(2025, 1);
    const startMonthRef = useRef();
        
    const userFilter = () =>{
          const monthValue = startMonthRef.current.value;
          setSelectedStartMonth(monthValue);
          setFormattedSelectedMonth(monthValue.replace('/', '年'));
    };

    const sectionArray = [];
    shopList.map((item) => sectionArray.push(item.section));
    const section = [...new Set(sectionArray)];
    const sortedSection = section.sort((a, b) => {
    return parseInt(a) - parseInt(b);
    });


    const [expandSections, setExpandSections] = useState({});
    const [expandShops, setExpandShops] = useState({});

    const expandSection = (section) =>{
      setExpandSections((prevSection) =>({...prevSection,[section]: !prevSection[section]}));
      setExpandShops({});
    };


    const expandShop = (shop) =>{
      setExpandShops((prevShop) =>({...prevShop,[shop]: !prevShop[shop]}));
    }




    const totalCustomers = customerList.filter(item=>item.register.includes(selectedMonth)).length;
    const reservedCustomers = customerList.filter(item => item.reserve.includes(selectedMonth)).length;
    const contractedCustomers = customerList.filter(item => item.status.includes('契約済み') && item.contract.includes(formattedSelectedMonth)).length;
    const rankCounts = {
      A: customerList.filter(item => item.rank.includes("Aランク")  && !item.status.includes("契約")).length,
      B: customerList.filter(item => item.rank.includes("Bランク")).length,
      C: customerList.filter(item => item.rank.includes("Cランク")).length,
      D: customerList.filter(item => item.rank.includes("Dランク")).length,
      E: customerList.filter(item => item.rank.includes("Eランク")).length
    };

    const bgArray = [ "table-primary ", "table-success ", "table-warning  ", "table-danger "];
    const tableBgArray =["table-primary shops", "table-success shops", "table-warning  shops", "table-danger shops"];
    const tableBgNoneArray =["table-primary d-none shops ", "table-success d-none shops", "table-warning d-none shops", "table-danger d-none shops"];

  const [rankedList, setRankedList] = useState([]);
  const [reservedList, setReservedList] = useState([]);
  const [show, setShow] = useState(false);
  const [listShow, setListShow] = useState(false);
  const [modalShow, setModalShow] = useState(false);
  const [rankedDetail, setRankedDetail] = useState([]);
  const [activePage, setActivePage] = useState(1);
  const [sliceStart, setSliceStart] = useState(0);
  const [modalStaffName, setModalStaffName] = useState("");

    const rankData = async (event, rank, section, shop, staff) =>{
      event.preventDefault();
      setShow(true);

      const sectionValue = section || "";
      const shopValue = shop || "";
      const staffValue = staff || "";
      try {
          const response = await axios.post("/dashboard/api/rankedCustomerList.php", {
            shop: shopValue,
            section: sectionValue,
            rank: rank,
            staff: staffValue, 
            register: selectedMonth
          });
          setRankedList(response.data); 
        } catch (error) {
          console.error("Error fetching user data:", error);
          setRankedList([]);
        }
    };

    const modalClose = () =>{
      setShow(false);
      setActivePage(1);
      setSliceStart(0);
    };

    const modalOfModal = async( event, id) =>{
      event.preventDefault();
      setModalShow(true);

      try {
        const response = await axios.post("/dashboard/api/rankedCustomerDetail.php", {
          id: id
        });
        setRankedDetail(response.data); 
      } catch (error) {
        console.error("Error fetching user data:", error);
        setRankedDetail([]);
      }
    };

    const modalOfModalClose = () =>{
      setModalShow(false);
      setActivePage(1);
      setSliceStart(0);
    };

    const modalOfListModalClose = () =>{
      setListShow(false);
    };

    const showReservedCustomer = async(staffValue, shopValue, monthValue) =>{
      setModalStaffName(staffValue);

      try {
          const response = await axios.post("/dashboard/api/reservedList.php", {
            staff: staffValue, 
            shop: shopValue, 
            reserve: selectedMonth, 
          });
          setReservedList(response.data); 
        } catch (error) {
          console.error("Error fetching user data:", error);
          setReservedList([]);
        }
      setListShow(true);
    };


  // ページングリンク
    const page1 = activePage > 3 && Math.ceil(rankedList.length/10) > 6 ? activePage - 2 : 1;

    let page2;
    if ( activePage > 3 && Math.ceil(rankedList.length/10) > 6 ){
      page2 = activePage - 1;
    } else if( Math.ceil(rankedList.length/10) < 2 ){
      page2 = "";
    } else{
      page2 = 2
    }

    let page3;
    if ( activePage > 3 && Math.ceil(rankedList.length/10) > 6 ){
      page3 = activePage;
    } else if( Math.ceil(rankedList.length/10) < 3 ){
      page3 = "";
    } else{
      page3 = 3;
    }

    let page4;
    if ( activePage > 3 && Math.ceil(rankedList.length/10) > 6 ){
      page4 = activePage + 1;
    } else if( Math.ceil(rankedList.length/10) < 4 ){
      page4 = "";
    } else{
      page4 = 4;
    }

    let page5;
    if ( activePage > 3 && Math.ceil(rankedList.length/10) > 6 ){
      page5 = activePage + 2;
    } else if( Math.ceil(rankedList.length/10) < 5 ){
      page5 = "";
    } else{
      page5 = 5;
    }


    const handlePageClick = async ( event, page ) => {
      event.preventDefault();
      setActivePage(page);
      setSliceStart((page - 1) * 10);
    };

  return (
    <div>
      <Menu brand={brand} />
      <div className="container py-3  bg-white">
      <div className="row mt-3 mb-4" >
                <div className="col d-flex">
                    <select className="form-select campaign" ref={startMonthRef} name="startMonth" onChange={userFilter}>
                        <option value="20">全期間</option>
                        {startMonthArray.map((startMonth, index) => (
                            <option key={index} value={startMonth}>{startMonth}</option>
                        ))}
                    </select>
                </div>
                <div className="col">
                </div>
                <div className="col-4"></div>
            </div>
        <Table bordered hover>
          <thead>
            <tr>
              <th>店舗</th>
              <th>総反響</th>
              <th>来場率</th>
              <th>来場数</th>
              <th>契約率</th>
              <th>契約数</th>
              <th>Aランク</th>
              <th>Bランク</th>
              <th>Cランク</th>
              <th>Dランク</th>
              <th>Eランク</th>
            </tr>
            <tr className='table-light'>
              <th>全店舗</th>
              <th>{totalCustomers}</th>
              <th>{Math.ceil((reservedCustomers / totalCustomers)*100)}%</th>
              <th>{reservedCustomers}</th>
              <th>{Math.ceil((contractedCustomers / totalCustomers)*100)}%</th>
              <th>{contractedCustomers}</th>
              <th className="detail text-primary" onClick={(event) => rankData(event, "Aランク")}>{rankCounts.A}</th>
              <th className="detail text-primary" onClick={(event) => rankData(event, "Bランク")}>{rankCounts.B}</th>
              <th>{rankCounts.C}</th>
              <th>{rankCounts.D}</th>
              <th>{rankCounts.E}</th>
            </tr>
          </thead>
          {sortedSection.map((section, sectionIndex) => {
            const sectionCustomers = customerList.filter(item=> item.section.includes(section) && item.register.includes(selectedMonth)).length;
            const reservedCustomers = customerList.filter(item=> item.section.includes(section) && item.reserve.includes(selectedMonth)).length;
            const contractedCustomers = customerList.filter(item=> item.section.includes(section) && item.contract.includes(formattedSelectedMonth)).length;
            const rankCounts = {
              A: customerList.filter(item => item.section.includes(section) && item.rank.includes("Aランク") && !item.status.includes("契約")).length,
              B: customerList.filter(item => item.section.includes(section) && item.rank.includes("Bランク")).length,
              C: customerList.filter(item => item.section.includes(section) && item.rank.includes("Cランク")).length,
              D: customerList.filter(item => item.section.includes(section) && item.rank.includes("Dランク")).length,
              E: customerList.filter(item => item.section.includes(section) && item.rank.includes("Eランク")).length
            };
            return (
            <tbody key={sectionIndex} className={`section-${section}`}>
              <tr className={bgArray[sectionIndex]}>
                <th>注文営業{section}<i className={expandSections[section] ? "d-none fa-solid fa-plus ms-1 p-1 rounded pointer-icon":"fa-solid fa-plus ms-1 p-1 rounded pointer-icon"} onClick={() => expandSection(section)}></i><i className={expandSections[section] ? "fa-solid fa-minus ms-1 p-1 rounded pointer-icon":"d-none fa-solid fa-minus ms-1 p-1 rounded pointer-icon"} onClick={() => expandSection(section)}></i></th>
                <th>{sectionCustomers}</th>
                <th>{Math.ceil((reservedCustomers / sectionCustomers)*100)}%</th>
                <th>{reservedCustomers}</th>
                <th>{Math.ceil((contractedCustomers / sectionCustomers)*100)}%</th>
                <th>{contractedCustomers}</th>
                <th className="detail text-primary" onClick={(event) => rankData(event, "Aランク", section)}>{rankCounts.A}</th>
                <th className="detail text-primary" onClick={(event) => rankData(event, "Bランク", section)}>{rankCounts.B}</th>
                <th>{rankCounts.C}</th>
                <th>{rankCounts.D}</th>
                <th>{rankCounts.E}</th>
              </tr>
              {shopList
                .filter((item) => item.section.includes(section))
                .map((shop, shopIndex) => {
                  const shopCustomers = customerList.filter(item => item.shop.includes(shop.shop) && item.register.includes(selectedMonth)).length;
                  const reservedCustomers = customerList.filter(item => item.shop.includes(shop.shop) && item.reserve.includes(selectedMonth)).length;
                  const contractedCustomers = customerList.filter(item => item.shop.includes(shop.shop) && item.contract.includes(formattedSelectedMonth)).length;
                  const rankCounts = {
                    A: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Aランク") && !item.status.includes("契約")).length,
                    B: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Bランク")).length,
                    C: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Cランク")).length,
                    D: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Dランク")).length,
                    E: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Eランク")).length
                  };
                  return(
                  <><tr key={`${sectionIndex}-${shopIndex}`} className={expandSections[section] ? tableBgArray[sectionIndex] : tableBgNoneArray[sectionIndex]}>
                    <th>{shop.shop}<i className={expandShops[shop.shop] ? "d-none fa-solid fa-plus ms-1 p-1 rounded pointer-icon":"fa-solid fa-plus ms-1 p-1 rounded pointer-icon"} onClick={() => expandShop(shop.shop)}></i><i className={expandShops[shop.shop] ? "fa-solid fa-minus ms-1 p-1 rounded pointer-icon":"d-none fa-solid fa-minus ms-1 p-1 rounded pointer-icon"} onClick={() => expandShop(shop.shop)}></i></th>
                    <th>{shopCustomers}</th>
                    <th>{Math.ceil( reservedCustomers / shopCustomers * 100)}%</th>
                    <th>{reservedCustomers}</th>
                    <th>{Math.ceil( contractedCustomers / shopCustomers * 100)}%</th>
                    <th>{contractedCustomers}</th>
                    <th className="detail text-primary" onClick={(event) => rankData(event, "Aランク", "" ,shop.shop)}>{rankCounts.A}</th>
                    <th className="detail text-primary" onClick={(event) => rankData(event, "Bランク", "" ,shop.shop)}>{rankCounts.B}</th>
                    <th>{rankCounts.C}</th>
                    <th>{rankCounts.D}</th>
                    <th>{rankCounts.E}</th>
                  </tr>
                  {staffList.filter(item=>item.shop.includes(shop.shop) && item.category === 1).map((staff,staffIndex)=>{
                  const staffCustomers = customerList.filter(item => item.staff.includes(staff.name) && item.shop.includes(shop.shop) && item.register.includes(selectedMonth)).length;
                  const reservedCustomers = customerList.filter(item => item.staff.includes(staff.name) && item.shop.includes(shop.shop) && item.reserve.includes(selectedMonth)).length;
                  const contractedCustomers = customerList.filter(item => item.staff.includes(staff.name) &&  item.shop.includes(shop.shop) && item.contract.includes(formattedSelectedMonth)).length;
                  const rankCounts = {
                    A: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && !item.status.includes("契約") && item.rank.includes("Aランク")).length,
                    B: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.rank.includes("Bランク")).length,
                    C: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.rank.includes("Cランク")).length,
                    D: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.rank.includes("Dランク")).length,
                    E: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.rank.includes("Eランク")).length
                  };
                  return(
                    <tr key={staffIndex} className={expandShops[shop.shop] ? "table-white shops" : tableBgNoneArray[sectionIndex]}>
                    <th>{staff.name}</th>
                    <th>{staffCustomers}</th>
                    <th>{Math.ceil(reservedCustomers / staffCustomers * 100)}%</th>
                    <th><div className="detail text-primary" onClick={()=>showReservedCustomer(staff.name, shop.shop, selectedMonth)}>{reservedCustomers}</div></th>
                    <th>{Math.ceil(contractedCustomers / staffCustomers * 100)}%</th>
                    <th>{contractedCustomers}</th>
                    <th className="detail text-primary" onClick={(event) => rankData(event, "Aランク", "" ,staff.shop, staff.name)}>{rankCounts.A}</th>
                    <th className="detail text-primary" onClick={(event) => rankData(event, "Bランク", "" ,staff.shop, staff.name)}>{rankCounts.B}</th>
                    <th>{rankCounts.C}</th>
                    <th>{rankCounts.D}</th>
                    <th>{rankCounts.E}</th>
                  </tr>)})}
                  </>
                )})}

            </tbody>
          )})}
        </Table>
        <Modal show={listShow} onHide={modalOfListModalClose} size="lg">
          <Modal.Header closeButton>
            <Modal.Title id="ranked-modal">{modalStaffName} {selectedMonth === "20" ? "" : selectedMonth } 面談済顧客一覧</Modal.Title>
              </Modal.Header>
                <Modal.Body>
                  <Table striped>
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>お客様名</th>
                        <th>反響日</th>
                        <th>来場日</th>
                        <th>販促媒体名</th>
                        <th>ランク</th>
                      </tr>
                    </thead>
                    <tbody>
                    {reservedList.filter( item => item.reserve.includes(selectedMonth)).map((value, index) =>(
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{value.name}</td>
                        <td>{value.register}</td>
                        <td>{value.reserve}</td>
                        <td>{value.medium}</td>
                        <td>{value.rank}</td>
                      </tr>
                    ))}
                    </tbody>
                  </Table>
                </Modal.Body>
        </Modal>

        <Modal show={show} onHide={modalClose} size="xl" aria-labelledby="ranked-modal">
          <Modal.Header closeButton>
            <Modal.Title id="ranked-modal">顧客情報詳細</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Table striped>
              <thead>
                <tr>
                  <th>No</th>
                  <th>課</th>
                  <th>店舗</th>
                  <th>担当営業</th>
                  <th>お客様名</th>
                  <th>反響日</th>
                  <th>来場日</th>
                  <th>販促媒体名</th>
                  <th>ランク</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
              {rankedList.slice( sliceStart, sliceStart + 10 ).map((value, index) =>(
                <tr key={index}>
                  <td>{sliceStart + index + 1}</td>
                  <td>{value.section}</td>
                  <td>{value.shop}</td>
                  <td>{value.staff}</td>
                  <td>{value.name}</td>
                  <td>{value.register}</td>
                  <td>{value.reserve}</td>
                  <td>{value.medium}</td>
                  <td>{value.rank}</td>
                  <td><button className="btn btn-primary" onClick={(event) => modalOfModal(event, value.id)}>詳細</button>
                    <Modal show={modalShow} onHide={modalOfModalClose} size="lg" aria-labelledby="ranked-modal">
                      <Modal.Header closeButton>
                        <Modal.Title id="ranked-modal">顧客情報詳細</Modal.Title>
                      </Modal.Header>
                      <Modal.Body>
                        {rankedDetail.map((value, index) =>(
                          <div key={index}>
                        <div className="row customer-info bg-light mb-2">
                          <div className="col border">
                            <p><span>お客様名</span><br></br>{value.name}</p>
                          </div>
                          <div className="col border">
                            <p><span>担当店舗</span><br></br>{value.shop}</p>
                          </div>
                          <div className="col border">
                            <p><span>担当営業</span><br></br>{value.staff}</p>
                          </div>
                          <div className="col border">
                            <p><span>名簿取得日</span><br></br>{value.register}</p>
                          </div>
                          <div className="col border">
                            <p><span>販促媒体名</span><br></br>{value.medium}</p>
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2">
                          <div className="col border">
                            <p><span>次回アポ</span><br></br>{value.appointment}</p>
                          </div>
                          <div className="col border">
                            <p><span>LINEグループ作成</span><br></br>{value.line_group}</p>
                          </div>
                          <div className="col border">
                            <p><span>事前審査</span><br></br>{value.screening}</p>
                          </div>
                          <div className="col border">
                          <p><span>競合会社</span><br></br>{value.rival}</p>
                          </div>
                          <div className="col border">
                          <p><span>土地</span><br></br>{value.estate}</p>
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2">
                          <div className="col border">
                          <p><span>希望予算</span><br></br>{value.budget}</p>
                          </div>
                          <div className="col border">
                          <p><span>契約スケジュール</span><br></br>{value.period}</p>
                          </div>
                          <div className="col border">
                          <p><span>重視項目</span><br></br>{value.importance}</p>
                          </div>
                          <div className="col">
                          </div>
                          <div className="col">
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2">
                          <div className="col border">
                            <p style={{ whiteSpace: 'pre-line'}}><span>商談後アンケートorユーザー感想</span><br></br>{value.survey.split('\\n').map((line, index)=>(
                              <React.Fragment key={index}>
                                {line}<br />
                              </React.Fragment>
                            ))}</p>
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2">
                          <div className="col border">
                          <p style={{ whiteSpace: 'pre-line'}}><span>次回アポまでの対応内容・担当者の感覚</span><br></br>{value.note.split('\\n').map((line, index)=>(
                              <React.Fragment key={index}>
                                {line}<br />
                              </React.Fragment>
                            ))}</p>
                          </div>
                        </div>
                        </div>
                      ))}
                      </Modal.Body>
                    </Modal>  
                  </td>
                </tr>
              ))}
              </tbody>
            </Table>
            <div className="pagination container p-2">
              <Pagination size="lg">
                <Pagination.First onClick={(event) => handlePageClick(event, 1)} />
                <Pagination.Prev onClick={(event) => handlePageClick(event, Math.max(activePage - 1, 1))} />
                <Pagination.Item active={activePage === page1} onClick={(event) => handlePageClick(event, page1)}>{page1}</Pagination.Item>
                { page2 ==="" ? null : <Pagination.Item active={activePage === page2} onClick={(event) => handlePageClick(event, page2)}>{page2}</Pagination.Item> }
                { page3 ==="" ? null : <Pagination.Item active={activePage === page3} onClick={(event) => handlePageClick(event, page3)}>{page3}</Pagination.Item> }
                { page4 ==="" ? null : <Pagination.Item active={activePage === page4} onClick={(event) => handlePageClick(event, page4)}>{page4}</Pagination.Item> }
                { page5 ==="" ? null : <Pagination.Item active={activePage === page5} onClick={(event) => handlePageClick(event, page5)}>{page5}</Pagination.Item> }
                <Pagination.Next onClick={(event) => handlePageClick(event, activePage + 1 < Math.ceil(rankedList.length/10) ? activePage + 1 : Math.ceil(rankedList.length/10))} />
                <Pagination.Last onClick={(event) => handlePageClick(event, Math.ceil(rankedList.length/10))} />
              </Pagination>
            </div>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default Rank;
