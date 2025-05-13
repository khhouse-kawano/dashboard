import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./chartConfig";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import Table from "react-bootstrap/Table";
import Pagination from 'react-bootstrap/Pagination';
import Menu from "./Menu";
import axios from "axios";
import { Bar } from 'react-chartjs-2';
import { colorCodes } from "./ColorCodes";

export const Campaign = () => {
  const location = useLocation();
  const [ activePage, setActivePage ] = useState(1);
  const { brand } = location.state || {};
  const brandsArray = ["KH", "DJH", "なごみ", "2L", "FH", "PGH"];
  const [activeBrand, setActiveBrand] = useState("KH");
  const [ campaignLength, setCampaignLength] = useState(0);
  const [campaignUsers, setCampaignUsers] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [selectedStartMonth, setSelectedStartMonth] = useState("");
  const startMonthRef = useRef(null);
  const endMonthRef = useRef(null);
  const [formValues, setFormValues] = useState({
    shopSelect: localStorage.getItem("shopSelect") || "",
    startMonthSelect: localStorage.getItem("startMonthSelect") || "",
    endMonthSelect: localStorage.getItem("endMonthSelect") || "",
    rankSelect: localStorage.getItem("rankSelect") || "",
    mediumSelect: localStorage.getItem("mediumSelect") || "",
  });
  const navigate = useNavigate();

  useEffect(() =>{
    const fetchData = async() =>{
        try {
            const response = await axios.post("/dashboard/campaignTotal.php");
            setCampaignUsers(response.data);
            setOriginalData(response.data);
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };
    fetchData();
},[])
  
useEffect(() => {
  setCampaignLength(campaignUsers.filter(item => item.ブランド.includes('KH')).length);
}, [campaignUsers]);

  const getYearMonthArray = (startYear, startMonth) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScriptの月は0から始まるため、1を加算

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

  const startMonthArray = getYearMonthArray(2025, 1);

    // ページングリンク

    const setBrand = async(brand) =>{
      setCampaignLength(originalData.filter( item => item.ブランド.includes(brand)).length);
      setActiveBrand(brand);
    }

    const pageCount = Math.ceil(campaignLength / 20 );
    const startID = ( activePage - 1 ) * 20;
    const endID = activePage * 20;

    const page1 = activePage > 3 && Math.ceil(pageCount) > 6 ? activePage - 2 : 1;

    let page2;
    if ( activePage > 3 && Math.ceil(pageCount) > 6 ){
      page2 = activePage - 1;
    } else if( Math.ceil(pageCount) < 2 ){
      page2 = "";
    } else{
      page2 = 2
    }
  
    let page3;
    if ( activePage > 3 && Math.ceil(pageCount) > 6 ){
      page3 = activePage;
    } else if( Math.ceil(pageCount) < 3 ){
      page3 = "";
    } else{
      page3 = 3;
    }
  
    let page4;
    if ( activePage > 3 && Math.ceil(pageCount) > 6 ){
      page4 = activePage + 1;
    } else if( Math.ceil(pageCount) < 4 ){
      page4 = "";
    } else{
      page4 = 4;
    }
  
    let page5;
    if ( activePage > 3 && Math.ceil(pageCount) > 6 ){
      page5 = activePage + 2;
    } else if( Math.ceil(pageCount) < 5 ){
      page5 = "";
    } else{
      page5 = 5;
    }

    const handlePageClick = async ( event, page ) => {
      event.preventDefault();
      setActivePage(page);
    };

    // グラフ
    const dataLabels =[];
    const dataTotal =[];
    campaignUsers.filter(item=>item.ブランド.includes(activeBrand)).slice(0, 20).forEach((value) => {
      dataLabels.push(value.キャンペーン名);
      dataTotal.push(value.total);
    });
        const data = {
      labels:dataLabels,
      datasets:[
        {
          data:dataTotal,
          backgroundColor: colorCodes.slice(0,20),
          borderColor: colorCodes.slice(0,20),
          borderWidth: 1,
        },
      ],
    };

    const options ={
      indexAxis: "y",//ここで横向き
      maintainAspectRatio: false, 
      responsive: true,
      plugins:{
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: ""
        },
      },
      scales: {   
        y:{
          beginAtZero: true,
        },
      },
    };

    const userFilter = () => {
      setSelectedStartMonth(startMonthRef.current.value);
        };
  

    useEffect(()=>{
      const fetchData = async() =>{
        try {
            const response = await axios.post("/dashboard/campaignTotal.php", {selectedStartMonth});
            setCampaignUsers(response.data);
            setOriginalData(response.data);
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };
    fetchData();
    },[selectedStartMonth]);

  return (
    <div>
      <Menu brand={brand} />
      <div className="container bg-white pt-3">
        <div className="bg-light row">
        <div className="row mt-3 mb-2" >
                    <div className="col d-flex">
                      <select
                        className="form-select campaign"
                        ref={startMonthRef}
                        name="startMonth"
                      >
                        <option value="">期間</option>
                        {startMonthArray.map((startMonth, index) => (
                          <option key={index} value={startMonth}>
                            {startMonth}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col">
                      <button className="btn bg-primary text-white px-5 rounded-pill mb-3" onClick={userFilter}>検索</button>
                  </div>
                  <div className="col-4"></div>
                  </div>
          <Tabs
            defaultActiveKey={brandsArray[0]}
            id="justify-tab-example"
            className="mt-0 pt-3 mb-3 bg-white"
            justify
            onSelect={(brand) => { setBrand(brand);}} >
            {brandsArray.map((brand, index) => (
              <Tab eventKey={brand} title={brand} key={index} >
                <div className="container bg-white pb-2">
                  <div className="row">
                  <div className="col-5">
                  <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>営業</th>
                      <th>反響合計</th>
                    </tr>
                  </thead>
                    <tbody>
                  {campaignUsers.filter( item => item.ブランド.includes(activeBrand)).slice(startID,endID).map((customer, index) => (
                    <tr key={index}>
                      <th>{ startID + index + 1}</th>
                      <th>{ customer.キャンペーン名}</th>
                      <th>{ customer.total}</th>
                    </tr>
                  ))}
                    </tbody>
                  </Table>
                  </div>
                  <div className="col-7">
                    <div style={{ height: "600px", width: "100%" }}>
                      <Bar data={data} options={options} />
                    </div>
                  </div>
                  </div>
                  <div className="pagination container p-2">
                    <Pagination size="lg">
                      <Pagination.First onClick={(event) => handlePageClick(event, 1)} />
                        <Pagination.Prev onClick={(event) => handlePageClick(event, Math.max(activePage - 1, 1))} />
                        <Pagination.Item active={activePage === page1} onClick={(event) => handlePageClick(event, page1)}>{page1}</Pagination.Item>
                        { page2 ==="" ? null : <Pagination.Item active={activePage === page2} onClick={(event) => handlePageClick(event, page2)}>{page2}</Pagination.Item> }
                        { page3 ==="" ? null : <Pagination.Item active={activePage === page3} onClick={(event) => handlePageClick(event, page3)}>{page3}</Pagination.Item> }
                        { page4 ==="" ? null : <Pagination.Item active={activePage === page4} onClick={(event) => handlePageClick(event, page4)}>{page4}</Pagination.Item> }
                        { page5 ==="" ? null : <Pagination.Item active={activePage === page5} onClick={(event) => handlePageClick(event, page5)}>{page5}</Pagination.Item> }
                        <Pagination.Next onClick={(event) => handlePageClick(event, activePage + 1 < Math.ceil(pageCount) ? activePage + 1 : Math.ceil(pageCount))} />
                        <Pagination.Last onClick={(event) => handlePageClick(event, Math.ceil(pageCount))} />
                    </Pagination>
                  </div>
                </div>
              </Tab>
            ))}
          </Tabs>
          

        </div>
      </div>
    </div>
  );
};

export default Campaign;
