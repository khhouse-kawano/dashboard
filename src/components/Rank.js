import React ,{ useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Modal from 'react-bootstrap/Modal';
import Pagination from 'react-bootstrap/Pagination';
import AuthContext from '../context/AuthContext';

const Rank = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [shopList, setShop] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [customerList, setUserData] = useState([]);

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1 ).padStart(2, '0');
    const day = today.getDate();
    const now = `${year}/${month}/${String(day).padStart(2, '0')}`;

    const [selectedMonth, setSelectedStartMonth] = useState(`${year}/${month}`);

    useEffect(() => {
      if( !brand || brand.trim() === "") navigate("/");
        const formattedDate = `${year}-${month}`
        const fetchData = async () => {
        try {
            const [customerResponse, shopResponse, staffResponse] = await Promise.all([
                axios.post("/dashboard/api/customerList.php"),
                axios.post("/dashboard/api/shopList.php"),
                axios.post("/dashboard/api/staffList.php"),
            ]);
    
            setUserData(customerResponse.data);
            setShop(shopResponse.data.filter( item => !item.shop.includes('店舗未設定')));
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
        const currentDay = now.getDate();
        const today = `${currentYear}/${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        
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
    
        
    const startMonthArray = getYearMonthArray(2025, 1);
    const startMonthRef = useRef();
        
    const userFilter = () =>{
        const monthValue = startMonthRef.current.value;
        setSelectedStartMonth(monthValue);
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
    const contractedCustomers = customerList.filter(item => item.status.includes('契約済み') && item.contract.includes(selectedMonth)).length;
    const rankCounts = {
        A: customerList.filter(item => item.rank.includes("Aランク") && !item.status.includes("契約")).length,
        prevA: customerList.filter(item => item.sales_meeting.split(',').pop().includes("Aランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
        B: customerList.filter(item => item.rank.includes("Bランク") && !item.status.includes("契約")).length,
        prevB: customerList.filter(item => item.sales_meeting.split(',').pop().includes("Bランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
        C: customerList.filter(item => item.rank.includes("Cランク") && !item.status.includes("契約")).length,
        prevC: customerList.filter(item => item.sales_meeting.split(',').pop().includes("Cランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
        D: customerList.filter(item => item.rank.includes("Dランク") && !item.status.includes("契約")).length,
        E: customerList.filter(item => item.rank.includes("Eランク") && !item.status.includes("契約")).length,
        failure: customerList.filter(item => ( item.rank.includes("Eランク") || item.rank.includes("Dランク") ) && ["Aランク", "Bランク", "Cランク"].some(rank => item.sales_meeting.split(',').pop().includes(rank))).length
    };

    const bgArray = [ "table-primary ", "table-success ", "table-warning  ", "table-danger "];
    const tableBgArray =["table-primary shops", "table-success shops", "table-warning  shops", "table-danger shops"];
    const tableBgNoneArray =["table-primary d-none shops ", "table-success d-none shops", "table-warning d-none shops", "table-danger d-none shops"];

    const [rankedList, setRankedList] = useState([]);
    const [prevRankedList, setPrevRankedList] = useState([]);
    const [reservedList, setReservedList] = useState([]);
    const [show, setShow] = useState(false);
    const [listShow, setListShow] = useState(false);
    const [modalShow, setModalShow] = useState(false);
    const [rankedDetail, setRankedDetail] = useState([]);
    const [activePage, setActivePage] = useState(1);
    const [prevActivePage, setPrevActivePage] = useState(1);
    const [sliceStart, setSliceStart] = useState(0);
    const [prevSliceStart, setPrevSliceStart] = useState(0);
    const [modalStaffName, setModalStaffName] = useState("");
    const [selectedRank, setSelectedRank] = useState("");
    const [isHovered, setIsHovered] = useState(false);

    let hoverTimeout;

    const rankData = async (rank, section, shop, staff) =>{
        await setShow(true);
        const sectionValue = section || "";
        const shopValue = shop || "";
        const staffValue = staff || "";
        if ( rank ==='ランクダウン'){
            await setSelectedRank(rank);
            const processedList = customerList.map(item => ({
                ...item,
                lastMeeting: item.sales_meeting?.split(',').pop() || ""
                }));
        
            await Promise.all([
            setRankedList(processedList.filter(item => ( item.rank.includes('Dランク') ||  item.rank.includes('Eランク') ) &&
                                                item.section.includes(sectionValue) &&
                                                item.shop.includes(shopValue) &&
                                                item.staff.includes(staffValue) &&
                                                (item.lastMeeting.includes('Aランク') || item.lastMeeting.includes('Bランク') || item.lastMeeting.includes('Cランク')) &&
                                                item.status !== "契約済み"))
            ]);
        } else if ( rank ==='契約'){
            await setSelectedRank(rank);
            const processedList = customerList.map(item => ({
                ...item,
                lastMeeting: item.sales_meeting?.split(',').pop() || ""
                }));
        
            await Promise.all([
            setRankedList(processedList.filter(item =>item.section.includes(sectionValue) &&
                                                item.shop.includes(shopValue) &&
                                                item.staff.includes(staffValue) &&
                                                item.contract.includes(selectedMonth) &&
                                                item.status === "契約済み"))
            ]);
        } else {
            await setSelectedRank(rank);
            const rankValue = rank || "";
            const processedList = customerList.map(item => ({
                ...item,
                lastMeeting: item.sales_meeting?.split(',').pop() || ""
                }));
        
            await Promise.all([
            setRankedList(processedList.filter(item => item.rank.includes(rankValue) &&
                                                item.section.includes(sectionValue) &&
                                                item.shop.includes(shopValue) &&
                                                item.staff.includes(staffValue) &&
                                                item.status !== "契約済み")),
            setPrevRankedList(processedList.filter(item => item.lastMeeting.includes(rankValue) &&
                                                item.section.includes(sectionValue) &&
                                                item.shop.includes(shopValue) &&
                                                item.staff.includes(staffValue) &&                                            
                                                item.lastMeeting.includes("見込み")))
            ]);
        }
    };

    const modalClose = () =>{
      setShow(false);
      setActivePage(1);
      setPrevActivePage(1);
      setSliceStart(0);
      setPrevSliceStart(0);
    };

    const modalOfModal = async(id) =>{
        setIsHovered(true);
        let hoverTimeout;

        hoverTimeout = setTimeout(() => {
          setModalShow(true); 
        }, 100);

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
      setPrevActivePage(1);
      setSliceStart(0);
      setPrevSliceStart(0);
    };

    const modalOfListModalClose = () =>{
      setListShow(false);
    };

  useEffect(() => {
    const modalElement = document.getElementById("ranked-modal");

    const handleMouseLeave = (event) => {
      if (!modalElement?.contains(event.relatedTarget)) {
        setModalShow(false);
      }
    };

    if (modalShow) {
      modalElement?.addEventListener("mouseleave", handleMouseLeave);
    } else {
      modalElement?.removeEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      modalElement?.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [modalShow]);




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


    const prevPage1 = prevActivePage > 3 && Math.ceil(prevRankedList.length/10) > 6 ? prevActivePage - 2 : 1;

    let prevPage2;
    if ( prevActivePage > 3 && Math.ceil(prevRankedList.length/10) > 6 ){
      prevPage2 = prevActivePage - 1;
    } else if( Math.ceil(prevRankedList.length/10) < 2 ){
      prevPage2 = "";
    } else{
      prevPage2 = 2
    }

    let prevPage3;
    if ( prevActivePage > 3 && Math.ceil(prevRankedList.length/10) > 6 ){
      prevPage3 = prevActivePage;
    } else if( Math.ceil(prevRankedList.length/10) < 3 ){
      prevPage3 = "";
    } else{
      prevPage3 = 3;
    }

    let prevPage4;
    if ( prevActivePage > 3 && Math.ceil(prevRankedList.length/10) > 6 ){
      prevPage4 = prevActivePage + 1;
    } else if( Math.ceil(prevRankedList.length/10) < 4 ){
      prevPage4 = "";
    } else{
      prevPage4 = 4;
    }

    let prevPage5;
    if ( prevActivePage > 3 && Math.ceil(prevRankedList.length/10) > 6 ){
      prevPage5 = prevActivePage + 2;
    } else if( Math.ceil(prevRankedList.length/10) < 5 ){
      prevPage5 = "";
    } else{
      prevPage5 = 5;
    }


    const handlePageClick = async ( page, demand ) => {
        if ( demand === 'current'){
            setActivePage(page);
            setSliceStart((page - 1) * 10);
        } else if( demand === 'prev'){
            setPrevActivePage(page);
            setPrevSliceStart((page - 1) * 10);
        }
    };

  return (
    <div>
      <Menu brand={brand} />
      <div className="container py-3  bg-white">
      <div className="row mt-3 mb-4" >
                <div className="col d-flex">
                    <select className="form-select campaign" name="startMonth" ref={startMonthRef} onChange={userFilter}>
                        <option value="20">全期間</option>
                        {startMonthArray.map((startMonth, index) => (
                            <option key={index} value={startMonth} selected={selectedMonth === startMonth}>{startMonth}</option>
                        ))}
                    </select>
                </div>
                <div className="col d-flex align-items-center">
                  {customerList.length > 0 ? `最終更新 ${customerList[0]['latest_date']}` : null} 
                </div>
                <div className="col-4"></div>
            </div>
        <Table hover bordered>
          <thead>
            <tr style={{ fontSize: '14px'}}>
                <th className='align-middle'>店舗</th>
                <th className='align-middle text-center'>総反響</th>
                <th className='align-middle text-center'>来場率</th>
                <th className='align-middle text-center'>来場数</th>
                <th className='align-middle text-center'>契約率</th>
                <th className='align-middle text-center'>契約数</th>
                <th className='text-center'><div className='mb-1'>Aランク<br></br><span style={{ fontSize: '11px'}}>今月契約予定(契約日確定)</span></div><div className='d-flex justify-content-center'><div className='col'>{now}</div><div className='col'>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(',').pop().split(" ")[0] : "前回営業会議"}</div></div></th>
                <th className='text-center'><div className='mb-1'>Bランク<br></br><span style={{ fontSize: '11px'}}>今月見込み(確度高い)</span></div><div className='d-flex justify-content-center'><div className='col'>{now}</div><div className='col'>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(',').pop().split(" ")[0] : "前回営業会議"}</div></div></th>
                <th className='text-center'><div className='mb-1'>Cランク<br></br><span style={{ fontSize: '11px'}}>今月見込み(勝負案件)</span></div><div className='d-flex justify-content-center'><div className='col'>{now}</div><div className='col'>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(',').pop().split(" ")[0] : "前回営業会議"}</div></div></th>
                <th className='align-middle text-center'>Dランク<br></br><span style={{ fontSize: '11px'}}>継続顧客</span></th>
                <th className='align-middle text-center'>Eランク<br></br><span style={{ fontSize: '11px'}}>中長期管理客</span></th>
                <th className='align-middle text-center'>ランクダウン</th>
            </tr>
            <tr className='table-light' style={{ fontSize: '14px'}}>
                <td>全店舗</td>
                <td className='text-center'>{totalCustomers}</td>
                <td className='text-center'>{Math.ceil((reservedCustomers / totalCustomers)*100)}%</td>
                <td className='text-center'>{reservedCustomers}</td>
                <td className='text-center'>{Math.ceil((contractedCustomers / reservedCustomers)*100)}%</td>
                <td className='text-center' onClick={() => rankData("契約", "", "", "")} style={{ cursor: 'pointer'}}><div className="col detail text-primary">{contractedCustomers}</div></td>
                <td className='text-center' onClick={(event) => rankData("Aランク", "", "", "")} style={{ cursor: 'pointer'}}>
                    <div className='d-flex justify-content-center'>
                        {rankCounts.A === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.A}</div> }
                        {rankCounts.prevA === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.prevA}</div> }
                    </div>
                </td>
                <td className='text-center' onClick={(event) => rankData("Bランク", "", "", "")} style={{ cursor: 'pointer'}}>
                    <div className='d-flex justify-content-center'>
                        {rankCounts.B === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.B}</div> }
                        {rankCounts.prevB=== 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.prevB}</div> }
                    </div>
                </td>
                <td className='text-center' onClick={(event) => rankData("Cランク", "", "", "")} style={{ cursor: 'pointer'}}>
                    <div className='d-flex justify-content-center'>
                        {rankCounts.C === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.C}</div> }
                        {rankCounts.prevC=== 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.prevC}</div> }
                    </div>
                </td>
                <td className='text-center'>{rankCounts.D}</td>
                <td className='text-center'>{rankCounts.E}</td>
                <td className='text-center' onClick={(event) => rankData("ランクダウン", "", "", "")}>
                    {rankCounts.failure === 0 ? <div className='text-center'>0</div> : 
                    <div className="detail text-primary text-center">{rankCounts.failure}</div>}
                </td>
            </tr>
          </thead>
          {sortedSection.map((section, sectionIndex) => {
            const sectionCustomers = customerList.filter(item=> item.section.includes(section) && item.register.includes(selectedMonth)).length;
            const reservedSectionCustomers = customerList.filter(item=> item.section.includes(section) && item.reserve.includes(selectedMonth)).length;
            const contractedSectionCustomers = customerList.filter(item=> item.section.includes(section) && item.contract.includes(selectedMonth)).length;
            const rankCounts = {
                A: customerList.filter(item => item.section.includes(section) && item.rank.includes("Aランク") && !item.status.includes("契約")).length,
                prevA: customerList.filter(item => item.section.includes(section) && item.sales_meeting.split(',').pop().includes("Aランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                B: customerList.filter(item => item.section.includes(section) && item.rank.includes("Bランク") && !item.status.includes("契約")).length,
                prevB: customerList.filter(item => item.section.includes(section) && item.sales_meeting.split(',').pop().includes("Bランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                C: customerList.filter(item => item.section.includes(section) && item.rank.includes("Cランク") && !item.status.includes("契約")).length,
                prevC: customerList.filter(item => item.section.includes(section) && item.sales_meeting.split(',').pop().includes("Cランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                D: customerList.filter(item => item.section.includes(section) && item.rank.includes("Dランク") && !item.status.includes("契約")).length,
                E: customerList.filter(item => item.section.includes(section) && item.rank.includes("Eランク") && !item.status.includes("契約")).length,
                failure: customerList.filter(item =>  item.section.includes(section) && ( item.rank.includes("Eランク") || item.rank.includes("Dランク")) &&  ["Aランク", "Bランク", "Cランク"].some(rank => item.sales_meeting.split(',').pop().includes(rank))).length
            };
            return (
            <tbody key={sectionIndex} className={`section-${section}`}>
              <tr className={bgArray[sectionIndex]} style={{ fontSize: '13px'}}>
                <td>注文営業{section}<i className={expandSections[section] ? "d-none fa-solid fa-plus ms-1 p-1 rounded pointer-icon":"fa-solid fa-plus ms-1 p-1 rounded pointer-icon"} onClick={() => expandSection(section)}></i><i className={expandSections[section] ? "fa-solid fa-minus ms-1 p-1 rounded pointer-icon":"d-none fa-solid fa-minus ms-1 p-1 rounded pointer-icon"} onClick={() => expandSection(section)}></i></td>
                <td className='text-center'>{sectionCustomers}</td>
                <td className='text-center'>{Math.ceil((reservedSectionCustomers / sectionCustomers)*100)}%</td>
                <td className='text-center'>{reservedSectionCustomers}</td>
                <td className='text-center'>{Math.ceil((contractedSectionCustomers / reservedSectionCustomers)*100)}%</td>
                <td className='text-center' onClick={() => rankData("契約", section, "", "")} style={{ cursor: 'pointer'}}><div className="col detail text-primary">{contractedSectionCustomers}</div></td>
                <td className='text-center' onClick={() => rankData("Aランク", section, "", "")} style={{ cursor: 'pointer'}}>
                    <div className='d-flex justify-content-center'>
                        {rankCounts.A === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.A}</div> }
                        {rankCounts.prevA === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.prevA}</div> }
                    </div>
                </td>
                <td className='text-center' onClick={() => rankData("Bランク", section, "", "")} style={{ cursor: 'pointer'}}>
                    <div className='d-flex justify-content-center'>
                        {rankCounts.B === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.B}</div> }
                        {rankCounts.prevB=== 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.prevB}</div> }
                    </div>
                </td>
                <td className='text-center' onClick={() => rankData("Cランク", section, "", "")} style={{ cursor: 'pointer'}}>
                    <div className='d-flex justify-content-center'>
                        {rankCounts.C === 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.C}</div> }
                        {rankCounts.prevC=== 0 ?
                        <div className='col'>0</div> :
                        <div className="col detail text-primary">{rankCounts.prevC}</div> }
                    </div>
                </td>
                <td className='text-center'>{rankCounts.D}</td>
                <td className='text-center'>{rankCounts.E}</td>
                <td className='text-center' onClick={(event) => rankData("ランクダウン", section, "", "")}>
                    {rankCounts.failure === 0 ? <div className='text-center'>0</div> : 
                    <div className="detail text-primary text-center">{rankCounts.failure}</div>}
                </td>
            </tr>
              {shopList
                .filter((item) => item.section.includes(section))
                .map((shop, shopIndex) => {
                  const shopCustomers = customerList.filter(item => item.shop.includes(shop.shop) && item.register.includes(selectedMonth)).length;
                  const reservedShopCustomers = customerList.filter(item => item.shop.includes(shop.shop) && item.reserve.includes(selectedMonth)).length;
                  const contractedShopCustomers = customerList.filter(item => item.shop.includes(shop.shop) && item.contract.includes(selectedMonth)).length;
                  const rankCounts = {
                    A: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Aランク") && !item.status.includes("契約")).length,
                    prevA: customerList.filter(item => item.shop.includes(shop.shop) && item.sales_meeting.split(',').pop().includes("Aランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                    B: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Bランク") && !item.status.includes("契約")).length,
                    prevB: customerList.filter(item => item.shop.includes(shop.shop) && item.sales_meeting.split(',').pop().includes("Bランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                    C: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Cランク") && !item.status.includes("契約")).length,
                    prevC: customerList.filter(item => item.shop.includes(shop.shop) && item.sales_meeting.split(',').pop().includes("Cランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                    D: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Dランク") && !item.status.includes("契約")).length,
                    E: customerList.filter(item => item.shop.includes(shop.shop) && item.rank.includes("Eランク") && !item.status.includes("契約")).length,
                    failure: customerList.filter(item =>  item.shop.includes(shop.shop) &&  ( item.rank.includes("Eランク") || item.rank.includes("Dランク")) &&  ["Aランク", "Bランク", "Cランク"].some(rank => item.sales_meeting.split(',').pop().includes(rank))).length
                  };
                  return(
                  <><tr key={`${sectionIndex}-${shopIndex}`} className={expandSections[section] ? tableBgArray[sectionIndex] : tableBgNoneArray[sectionIndex]} style={{ fontSize: '13px'}}>
                    <td>{shop.shop}<i className={expandShops[shop.shop] ? "d-none fa-solid fa-plus ms-1 p-1 rounded pointer-icon":"fa-solid fa-plus ms-1 p-1 rounded pointer-icon"} onClick={() => expandShop(shop.shop)}></i><i className={expandShops[shop.shop] ? "fa-solid fa-minus ms-1 p-1 rounded pointer-icon":"d-none fa-solid fa-minus ms-1 p-1 rounded pointer-icon"} onClick={() => expandShop(shop.shop)}></i></td>
                    <td className='text-center'>{shopCustomers}</td>
                    <td className='text-center'>{Math.ceil( reservedShopCustomers / shopCustomers) * 100}%</td>
                    <td className='text-center'>{reservedShopCustomers}</td>
                    <td className='text-center'>{Math.ceil( contractedShopCustomers / reservedShopCustomers* 100)}%</td>
                    <td className='text-center' onClick={() => rankData("契約", section, shop.shop, "")} style={{ cursor: 'pointer'}}><div className="col detail text-primary">{contractedShopCustomers}</div></td>
                    <td className='text-center' onClick={() => rankData("Aランク", section, shop.shop, "")} style={{ cursor: 'pointer'}}>
                        <div className='d-flex justify-content-center'>
                            {rankCounts.A === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.A}</div> }
                            {rankCounts.prevA === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.prevA}</div> }
                        </div>
                    </td>
                    <td className='text-center' onClick={() => rankData("Bランク", section, shop.shop, "")} style={{ cursor: 'pointer'}}>
                        <div className='d-flex justify-content-center'>
                            {rankCounts.B === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.B}</div> }
                            {rankCounts.prevB=== 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.prevB}</div> }
                        </div>
                    </td>
                    <td className='text-center' onClick={() => rankData("Cランク", section, shop.shop, "")} style={{ cursor: 'pointer'}}>
                        <div className='d-flex justify-content-center'>
                            {rankCounts.C === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.C}</div> }
                            {rankCounts.prevC=== 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.prevC}</div> }
                        </div>
                    </td>
                    <td className='text-center'>{rankCounts.D}</td>
                    <td className='text-center'>{rankCounts.E}</td>
                    <td className='text-center' onClick={(event) => rankData("ランクダウン", section, shop.shop, "")}>
                        {rankCounts.failure === 0 ? <div className='text-center'>0</div> : 
                        <div className="detail text-primary text-center">{rankCounts.failure}</div>}
                    </td>
                </tr>
                  {staffList.filter(item=>item.shop.includes(shop.shop) && item.category === 1).map((staff,staffIndex)=>{
                  const staffCustomers = customerList.filter(item => item.staff.includes(staff.name) && item.shop.includes(shop.shop) && item.register.includes(selectedMonth)).length;
                  const reservedStaffCustomers = customerList.filter(item => item.staff.includes(staff.name) && item.shop.includes(shop.shop) && item.reserve.includes(selectedMonth)).length;
                  const contractedStaffCustomers = customerList.filter(item => item.staff.includes(staff.name) &&  item.shop.includes(shop.shop) && item.contract.includes(selectedMonth)).length;
                  const rankCounts = {
                    A: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && !item.status.includes("契約") && item.rank.includes("Aランク")).length,
                    prevA: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.sales_meeting.split(',').pop().includes("Aランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                    B: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && !item.status.includes("契約") && item.rank.includes("Bランク")).length,
                    prevB: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.sales_meeting.split(',').pop().includes("Bランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                    C: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && !item.status.includes("契約") && item.rank.includes("Cランク")).length,
                    prevC: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && item.sales_meeting.split(',').pop().includes("Cランク") && item.sales_meeting.split(',').pop().includes("見込み")).length,
                    D: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && !item.status.includes("契約") && item.rank.includes("Dランク")).length,
                    E: customerList.filter(item => item.shop.includes(shop.shop) && item.staff.includes(staff.name) && !item.status.includes("契約") && item.rank.includes("Eランク")).length,
                    failure: customerList.filter(item =>  item.shop.includes(shop.shop) && item.staff.includes(staff.name) &&  ( item.rank.includes("Eランク") || item.rank.includes("Dランク")) &&  ["Aランク", "Bランク", "Cランク"].some(rank => item.sales_meeting.split(',').pop().includes(rank))).length
                };
                  return(
                    <tr key={staffIndex} className={expandShops[shop.shop] ? "table-white shops" : tableBgNoneArray[sectionIndex]} style={{ fontSize: '12px'}}>
                    <td>{staff.name}</td>
                    <td className='text-center'>{staffCustomers}</td>
                    <td className='text-center'>{Math.ceil(reservedStaffCustomers / staffCustomers * 100)}%</td>
                    <td className='text-center'>{reservedStaffCustomers}</td>
                    <td className='text-center'>{Math.ceil(contractedStaffCustomers / reservedStaffCustomers * 100)}%</td>
                    <td className='text-center' onClick={() => rankData("契約", section, shop.shop, staff.name)} style={{ cursor: 'pointer'}}><div className="col detail text-primary">{contractedStaffCustomers}</div></td>
                    <td className='text-center' onClick={() => rankData("Aランク", section, shop.shop, staff.name)} style={{ cursor: 'pointer'}}>
                        <div className='d-flex justify-content-center'>
                            {rankCounts.A === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.A}</div> }
                            {rankCounts.prevA === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.prevA}</div> }
                        </div>
                    </td>
                    <td className='text-center' onClick={() => rankData("Bランク", section, shop.shop, staff.name)} style={{ cursor: 'pointer'}}>
                        <div className='d-flex justify-content-center'>
                            {rankCounts.B === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.B}</div> }
                            {rankCounts.prevB=== 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.prevB}</div> }
                        </div>
                    </td>
                    <td className='text-center' onClick={() => rankData("Cランク", section, shop.shop, staff.name)} style={{ cursor: 'pointer'}}>
                        <div className='d-flex justify-content-center'>
                            {rankCounts.C === 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.C}</div> }
                            {rankCounts.prevC=== 0 ?
                            <div className='col'>0</div> :
                            <div className="col detail text-primary">{rankCounts.prevC}</div> }
                        </div>
                    </td>
                    <td className='text-center'>{rankCounts.D}</td>
                    <td className='text-center'>{rankCounts.E}</td>
                    <td className='text-center' onClick={(event) => rankData("ランクダウン", section, shop.shop, staff.name)}>
                        {rankCounts.failure === 0 ? <div className='text-center'>0</div> : 
                        <div className="detail text-primary text-center">{rankCounts.failure}</div>}
                    </td>
                </tr>)})}
                </>
                )})}

            </tbody>
          )})}
        </Table>

        <Modal show={show} onHide={modalClose} size={selectedRank === 'ランクダウン' || selectedRank === '契約' ? 'lg': 'xl'} >
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '15px'}}>顧客情報詳細</Modal.Title>
          </Modal.Header>
            <Modal.Body>
                    <div className='row'>
                        <div className='col p-2'>
                            <div className='text-center' style={{ fontSize: '12px'}}>{now}_{selectedRank}</div>
                            <Table striped style={{ fontSize: '12px'}} hover>
                                <thead>
                                    <tr>
                                        <th>店舗</th>
                                        <th>担当営業</th>
                                        <th>お客様名</th>
                                        <th>反響日</th>
                                        <th>来場日</th>
                                        <th>前回ランク</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankedList.slice( sliceStart, sliceStart + 10 ).map((value, index) =>{
                                        const prevRank = value.sales_meeting.split(',').pop().split(' ')[1];
                                        const rankArray = ['Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
                                        const prevRankIndex = rankArray.findIndex( item => item === prevRank);
                                        const currentRankIndex = rankArray.findIndex( item => item === value.rank);
                                        let shift;
                                        if( value.status === '契約済み' ) {
                                            shift = <i className="fa-solid fa-crown ps-1"></i>;                                      
                                        } else if( !value.sales_meeting.includes('ランク') ) {
                                            shift = <>新規<i className="fa-solid fa-star ps-1"></i></>                                      
                                        } else if ( currentRankIndex > prevRankIndex){
                                            shift = <i className="fa-solid fa-arrow-down ps-1"></i>;
                                        }  else if( currentRankIndex < prevRankIndex ) {
                                            shift = <i className="fa-solid fa-arrow-up ps-1"></i>;                                           
                                        } else if( currentRankIndex === prevRankIndex ) {
                                            shift = <i className="fa-solid fa-arrow-right ps-1"></i>;                                            
                                        }     
                                        return(
                                    <tr key={index}>
                                        <td>{value.shop}</td>
                                        <td>{value.staff}</td>
                                        <td onMouseEnter={() => modalOfModal(value.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted'}}>{value.name}</td>
                                        <td>{value.register}</td>
                                        <td>{value.reserve}</td>
                                        <td>{prevRank}{shift}</td>
                                    </tr>
                                    )})}
                                </tbody>
                            </Table>
                            {rankedList.length < 11 ? null : 
                            <div className="pagination container p-2 text-center">
                                <Pagination size="sm">
                                    <Pagination.First onClick={() => handlePageClick(1, 'current')} />
                                    <Pagination.Prev onClick={() => handlePageClick( Math.max(activePage - 1, 1), 'current')} />
                                    <Pagination.Item active={activePage === page1} onClick={() => handlePageClick( page1, 'current')}>{page1}</Pagination.Item>
                                    { page2 ==="" ? null : <Pagination.Item active={activePage === page2} onClick={() => handlePageClick( page2, 'current')}>{page2}</Pagination.Item> }
                                    { page3 ==="" ? null : <Pagination.Item active={activePage === page3} onClick={() => handlePageClick( page3, 'current')}>{page3}</Pagination.Item> }
                                    { page4 ==="" ? null : <Pagination.Item active={activePage === page4} onClick={() => handlePageClick( page4, 'current')}>{page4}</Pagination.Item> }
                                    { page5 ==="" ? null : <Pagination.Item active={activePage === page5} onClick={() => handlePageClick( page5, 'current')}>{page5}</Pagination.Item> }
                                    <Pagination.Next onClick={() => handlePageClick( activePage + 1 < Math.ceil(rankedList.length/10) ? activePage + 1 : Math.ceil(rankedList.length/10), 'current')} />
                                    <Pagination.Last onClick={() => handlePageClick( Math.ceil(rankedList.length/10), 'current')} />
                                </Pagination>
                            </div>}
                        </div>
                        {selectedRank === 'ランクダウン' || selectedRank === '契約' ? null : <div className='col p-2'>
                            <div className='text-center' style={{ fontSize: '12px'}}>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(",").pop().split(" ")[0] : "前回営業会議"}_{selectedRank}</div>
                            <Table striped style={{ fontSize: '12px'}} hover>
                                <thead>
                                    <tr>
                                        <th>店舗</th>
                                        <th>担当営業</th>
                                        <th>お客様名</th>
                                        <th>反響日</th>
                                        <th>来場日</th>
                                        <th>現在ランク</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prevRankedList.slice( prevSliceStart, prevSliceStart + 10 ).map((value, index) =>{
                                        const prevRank = value.sales_meeting.split(' ')[1];
                                        const rankArray = ['Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'];
                                        const prevRankIndex = rankArray.findIndex( item => item === prevRank);
                                        const currentRankIndex = rankArray.findIndex( item => item === value.rank);
                                        let shift;
                                        if( value.status === '契約済み' ) {
                                            shift = <i className="fa-solid fa-crown ps-1"></i>;                                      
                                        } else if( !value.sales_meeting.includes('ランク') ) {
                                            shift = <>新規<i className="fa-solid fa-star ps-1"></i></>;
                                        } else if( value.rank ==='' ) {
                                            shift = "";                                      
                                        } else if ( currentRankIndex > prevRankIndex){
                                            shift = <i className="fa-solid fa-arrow-down ps-1"></i>;
                                        }  else if( currentRankIndex < prevRankIndex ) {
                                            shift = <i className="fa-solid fa-arrow-up ps-1"></i>;                                           
                                        } else if( currentRankIndex === prevRankIndex ) {
                                            shift = <i className="fa-solid fa-arrow-right ps-1"></i>;                                            
                                        }                                       
                                        return(
                                    <tr key={index} style={{ backgroundColor : isHovered ? "lightblue !important" : "transparent !important"}}>
                                        <td>{value.shop}</td>
                                        <td>{value.staff}</td>
                                        <td onMouseEnter={() => modalOfModal(value.id)} onMouseLeave={() => setIsHovered(false)} style={{ cursor: 'pointer', textDecoration: 'underline dotted'}}>{value.name}</td>
                                        <td>{value.register}</td>
                                        <td>{value.reserve}</td>
                                        <td>{value.status === '契約済み' ? '契約済み' : value.rank}{shift}</td>
                                    </tr>
                                    )})}
                                </tbody>
                            </Table>
                            { prevRankedList.length < 11 ? null :
                            <div className="pagination container p-2 text-center">
                                <Pagination size="sm">
                                    <Pagination.First onClick={() => handlePageClick( 1, 'prev')} />
                                    <Pagination.Prev onClick={() => handlePageClick( Math.max(prevActivePage - 1, 1), 'prev')} />
                                    <Pagination.Item active={prevActivePage === prevPage1} onClick={() => handlePageClick(prevPage1, 'prev')}>{page1}</Pagination.Item>
                                    { page2 ==="" ? null : <Pagination.Item active={prevActivePage === prevPage2} onClick={() => handlePageClick( prevPage2, 'prev')}>{prevPage2}</Pagination.Item> }
                                    { page3 ==="" ? null : <Pagination.Item active={prevActivePage === prevPage3} onClick={() => handlePageClick( prevPage3, 'prev')}>{prevPage3}</Pagination.Item> }
                                    { page4 ==="" ? null : <Pagination.Item active={prevActivePage === prevPage4} onClick={() => handlePageClick( prevPage4, 'prev')}>{prevPage4}</Pagination.Item> }
                                    { page5 ==="" ? null : <Pagination.Item active={prevActivePage === prevPage5} onClick={() => handlePageClick( prevPage5, 'prev')}>{prevPage5}</Pagination.Item> }
                                    <Pagination.Next onClick={() => handlePageClick( prevActivePage + 1 < Math.ceil(prevRankedList.length/10) ? prevActivePage + 1 : Math.ceil(prevRankedList.length/10), 'prev')} />
                                    <Pagination.Last onClick={() => handlePageClick( Math.ceil(prevRankedList.length/10), 'prev')} />
                                </Pagination>
                            </div>}
                        </div>}
                    </div>

                    <Modal show={modalShow} onHide={modalOfModalClose} size="lg" id="ranked-modal" style={{ zIndex: 1200 }}>
                      <Modal.Header closeButton>
                        <Modal.Title id="ranked-modal">顧客情報詳細</Modal.Title>
                      </Modal.Header>
                      <Modal.Body>
                        {rankedDetail.map((value, index) =>(
                          <div key={index}>
                        <div className="row customer-info bg-light mb-2" style={{ fontSize: '13px'}}>
                          <div className="col border mx-1">
                            <p><span>お客様名</span><br></br>{value.name}</p>
                          </div>
                          <div className="col border mx-1">
                            <p><span>担当店舗</span><br></br>{value.shop}</p>
                          </div>
                          <div className="col border mx-1">
                            <p><span>担当営業</span><br></br>{value.staff}</p>
                          </div>
                          <div className="col border mx-1">
                            <p><span>名簿取得日</span><br></br>{value.register}</p>
                          </div>
                          <div className="col border mx-1">
                            <p><span>販促媒体名</span><br></br>{value.medium}</p>
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2" style={{ fontSize: '13px'}}>
                          <div className="col border mx-1">
                            <p><span>次回アポ</span><br></br>{value.appointment}</p>
                          </div>
                          <div className="col border mx-1">
                            <p><span>LINEグループ作成</span><br></br>{value.line_group}</p>
                          </div>
                          <div className="col border mx-1">
                            <p><span>事前審査</span><br></br>{value.screening}</p>
                          </div>
                          <div className="col border mx-1">
                          <p><span>競合会社</span><br></br>{value.rival}</p>
                          </div>
                          <div className="col border mx-1">
                          <p><span>土地</span><br></br>{value.estate}</p>
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2" style={{ fontSize: '13px'}}>
                          <div className="col border mx-1">
                          <p><span>希望予算</span><br></br>{value.budget}</p>
                          </div>
                          <div className="col border mx-1">
                          <p><span>契約スケジュール</span><br></br>{value.period}</p>
                          </div>
                          <div className="col border mx-1">
                          <p><span>重視項目</span><br></br>{value.importance}</p>
                          </div>
                          <div className="col mx-1">
                          </div>
                          <div className="col mx-1">
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2" style={{ fontSize: '13px'}}>
                          <div className="col border">
                            <p style={{ whiteSpace: 'pre-line'}}><span>商談後アンケートorユーザー感想</span><br></br>{value.survey.split('\\n').map((line, index)=>(
                              <React.Fragment key={index}>
                                {line}<br />
                              </React.Fragment>
                            ))}</p>
                          </div>
                        </div>
                        <div className="row customer-info bg-light mb-2" style={{ fontSize: '13px'}}>
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
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default Rank;
