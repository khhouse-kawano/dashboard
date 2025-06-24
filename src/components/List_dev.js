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
    const [mediumArray, setMediumArray] = useState([]);

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1 ).padStart(2, '0');
    const day = today.getDate();
    const now = `${year}/${month}/${String(day).padStart(2, '0')}`;

    useEffect(() => {
      if( !brand || brand.trim() === "") navigate("/");
        const formattedDate = `${year}-${month}`
        const fetchData = async () => {
        try {
            const [customerResponse, shopResponse, staffResponse, mediumResponse] = await Promise.all([
                await axios.post("/dashboard/api/customerList.php"),
                await axios.post("/dashboard/api/shopList.php"),
                await axios.post("/dashboard/api/staffList.php"),
                await axios.post("/dashboard/api/mediumList.php")
            ]);
    
            await setUserData(customerResponse.data);
            await setShop(shopResponse.data.filter( item => !item.shop.includes('店舗未設定')));
            await setStaffList(staffResponse.data);    
            await setMediumArray(mediumResponse.data.map( item => item.medium));
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
        }, 200);

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

    useEffect(() =>{
      const fetchData = async()=>{
        await setUpdateData({
          id: rankedDetail[0]['id'],
          shop: rankedDetail[0]['shop'],
          name: rankedDetail[0]['name'],
          staff: rankedDetail[0]['staff'],
          register: rankedDetail[0]['register'],
          reserve: rankedDetail[0]['reserve'],
          rank: rankedDetail[0]['rank'],
          medium: rankedDetail[0]['medium'],
          appointment: rankedDetail[0]['appointment'],
          line_group: rankedDetail[0]['line_group'],
          screening: rankedDetail[0]['screening'],
          period: rankedDetail[0]['period'],
          rival: rankedDetail[0]['rival'],
          estate: rankedDetail[0]['estate'],
          budget: rankedDetail[0]['budget'],
          importance: rankedDetail[0]['importance'],
          survey: rankedDetail[0]['survey'],
          note: rankedDetail[0]['note']
        });
      };

      fetchData();
    },[rankedDetail]);

    const handleChange = async(event) => {
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

    const data = {};
      formElements.forEach((element) => {
        const input = element;
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
        alert("送信に失敗しました...");
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
                    <select className="form-select campaign" ref={startMonthRef} name="startMonth" onChange={userFilter}>
                        <option value="20">全期間</option>
                        {startMonthArray.map((startMonth, index) => (
                            <option key={index} value={startMonth}>{startMonth}</option>
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
                <th className='text-center'><div className='mb-1'>Aランク</div><div className='d-flex justify-content-center'><div className='col'>{now}</div><div className='col'>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(" ")[0] : "前回営業会議"}</div></div></th>
                <th className='text-center'><div className='mb-1'>Bランク</div><div className='d-flex justify-content-center'><div className='col'>{now}</div><div className='col'>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(" ")[0] : "前回営業会議"}</div></div></th>
                <th className='text-center'><div className='mb-1'>Cランク</div><div className='d-flex justify-content-center'><div className='col'>{now}</div><div className='col'>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(" ")[0] : "前回営業会議"}</div></div></th>
                <th className='align-middle text-center'>Dランク</th>
                <th className='align-middle text-center'>Eランク</th>
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
                    <td className='text-center'>{Math.ceil( contractedShopCustomers / reservedShopCustomers) * 100}%</td>
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
                                        const prevRank = value.sales_meeting.split(' ')[1];
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
                            <div className='text-center' style={{ fontSize: '12px'}}>{customerList[0]?.last_meeting ? customerList[0].last_meeting.split(" ")[0] : "前回営業会議"}_{selectedRank}</div>
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
                        <div>
                        <div className="row customer-info bg-light">
                          <div className="col border">
                            <p style={{ fontSize: '13px'}}><span>お客様名</span><br></br><br></br>{updateData.name}</p>
                            <input type="hidden" name="id" value={updateData.id}/>
                            <input type="hidden" name="shop" value={updateData.shop}/>
                          </div>
                          <div className="col border">
                            <p style={{ fontSize: '13px'}}><span>担当店舗</span><br></br><br></br>{updateData.shop}</p>
                          </div>
                          <div className="col border">
                            <p><span>担当営業</span></p>
                            <select className='form-select' name='staff' onChange={handleChange} style={{ fontSize: '13px'}}>
                              <option value="">担当営業を選択</option>
                              {staffList?.filter(item=>item.shop === updateData.shop).map((item, index) =>
                              <option value={item.name} key={index} selected={item.name===updateData.staff}>{item.name}</option>
                              )}
                            </select>
                          </div>
                          <div className="col border">
                            <p><span>名簿取得日</span></p>
                            <input type="date" className="form-control" name="register" value={updateData.register?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>
                          <div className="col border">
                            <p><span>販促媒体名</span></p>
                            <select className='form-select' name='medium' onChange={handleChange} style={{ fontSize: '13px'}}>
                              <option value="">販促媒体を選択</option>
                              {mediumArray?.map((item, index) =>
                              <option value={item} key={index} selected={item===updateData.medium}>{item}</option>
                              )}
                            </select>
                        </div>
                        </div>
                        <div className="row customer-info bg-light">
                          <div className="col border">
                            <p><span>ランク</span></p>
                            <select className='form-select' name='rank' onChange={handleChange} style={{ fontSize: '13px'}}>
                              <option value="">ランクを選択</option>
                              <option value="Aランク" selected={updateData.rank === "Aランク"}>Aランク</option>
                              <option value="Bランク" selected={updateData.rank === "Bランク"}>Bランク</option>
                              <option value="Cランク" selected={updateData.rank === "Cランク"}>Cランク</option>
                              <option value="Dランク" selected={updateData.rank === "Dランク"}>Dランク</option>
                              <option value="Eランク" selected={updateData.rank === "Eランク"}>Eランク</option>
                            </select>
                          </div>
                          <div className="col border">
                            <p><span>初回来場日</span></p>
                            <input type="date" className="form-control" name="reserve" value={updateData.reserve?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>                          <div className="col border">
                            <p><span>次回アポ</span></p>
                            <input type="date" className="form-control" name="appointment" value={updateData.appointment?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>
                          <div className="col border">
                            <p><span>LINEグループ作成</span></p>
                            <input type="date" className="form-control" name="line_group" value={updateData.line_group?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>
                          <div className="col border">
                            <p><span>事前審査</span></p>
                            <input type="date" className="form-control" name="screening" value={updateData.screening?.replace(/\//g, '-').replace(/年|月/g, "-").replace(/日/g, "")} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>
                        </div>
                        <div className="row customer-info bg-light">
                          <div className="col border">
                            <p><span>競合会社</span></p>
                            <input className='form-control' name='rival' value={updateData.rival} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>
                          <div className="col border">
                            <p><span>土地</span></p>
                            <select className='form-select' name='estate' onChange={handleChange} style={{ fontSize: '13px'}}>
                              <option value="有" selected={updateData.estate === "有"}>有</option>
                              <option value="無" selected={updateData.estate === "無"}>無</option>
                            </select>
                          </div>
                          <div className="col border">
                            <p><span>希望予算</span></p>
                            <input type="text" className='form-control' name='budget' value={updateData.budget} onChange={handleChange} style={{ fontSize: '13px'}}/>
                          </div>
                          <div className="col border">
                            <p><span>契約スケジュール</span></p>
                            <select className='form-select' name='period' onChange={handleChange} style={{ fontSize: '13px'}}>
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
                          <div className="col border">
                            <p><span>重視項目</span></p>
                            <select className='form-select' name='importance' onChange={handleChange} style={{ fontSize: '13px'}}>
                              <option value="">重視項目を選択</option>
                              <option value="性能" selected={updateData.importance === "性能"}>性能</option>
                              <option value="デザイン" selected={updateData.importance === "デザイン"}>デザイン</option>
                              <option value="価格" selected={updateData.importance === "価格"}>価格</option>
                            </select>
                          </div>
                        </div>
                        <div className="row customer-info bg-light">
                          <div className="col border">
                            <p style={{ whiteSpace: 'pre-line'}}><span>商談後アンケートorユーザー感想</span></p>
                            <textarea className="form-control" value={updateData.survey} name='survey' rows={updateData.survey.split('\n').length + 1} onChange={handleChange} style={{ fontSize: '13px'}}></textarea>
                          </div>
                        </div>
                        <div className="row customer-info bg-light">
                          <div className="col border">
                          <p style={{ whiteSpace: 'pre-line'}}><span>次回アポまでの対応内容・担当者の感覚</span></p>
                            <textarea className="form-control" value={updateData.note} name='note' rows={updateData.note.split('\n').length + 1} onChange={handleChange} style={{ fontSize: '13px'}}></textarea>
                          </div>
                        </div>
                        <div className="row mt-2">
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
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default Rank;
