import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Menu from "../Menu";
import { Pie } from 'react-chartjs-2';
import '../chartConfig';
import { colorCodes } from '../ColorCodes.js';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

const SearchBox = ({ userData, brand }) => {
  const shopRef = useRef(null);
  const startMonthRef = useRef(null);
  const endMonthRef = useRef(null);
  const rankRef = useRef(null);
  const mediumRef = useRef(null);

  // セレクトタグの値をローカルに保持

  const [ formValues, setFormValues] = useState({
    shopSelect: localStorage.getItem("shopSelect") || "",
    startMonthSelect: localStorage.getItem("startMonthSelect") || "",
    endMonthSelect: localStorage.getItem("endMonthSelect") || "",
    rankSelect: localStorage.getItem("rankSelect") || "",
    mediumSelect: localStorage.getItem("mediumSelect") || "",
  });

  const navigate = useNavigate();

  const shops = [
    "グループ全体",
    "KH",
    "KH鹿児島",
    "KH姶良",
    "KH霧島",
    "KH鹿屋",
    "KH薩摩川内",
    "KH出水阿久根",
    "KH加世田",
    "KH都城",
    "KH宮崎",
    "KH延岡",
    "KH大分",
    "KH八代",
    "DJH",
    "DJH鹿児島北",
    "DJH霧島",
    "DJH薩摩川内",
    "DJH鹿屋",
    "DJH都城",
    "DJH宮崎",
    "なごみ",
    "なごみ鹿児島",
    "なごみ姶良霧島",
    "2L",
    "FH",
    "FH鹿児島",
    "FH霧島",
    "PG HOUSE宮崎店"
  ];

  const [selectedStartMonth, setSelectedStartMonth] = useState("");

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

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return yearMonthArray;
  };

  const startMonthArray = getYearMonthArray(2025, 1);

  const endMonthArray = selectedStartMonth
    ? startMonthArray.filter((month) => month >= selectedStartMonth)
    : startMonthArray;

  useEffect(() => {
    if (endMonthRef.current) {
      endMonthRef.current.value = selectedStartMonth;
    }
  }, [selectedStartMonth]);

  const mediums = [
    "チラシ",
    "フリーペーパー",
    "ハガキDM",
    "SUUMO",
    "HOME'S",
    "athome",
    "カゴスマ",
    "イエタッタ",
    "持ち家計画",
    "インターネット検索",
    "SNS広告",
    "バス広告",
    "看板",
    "CM/ラジオ",
    "紹介",
    "建築現場を見て",
    "ヒーローショーを見て",
    "タウンライフ",
    "公式LINE",
    "メタ住宅展示場",
  ];


  const mediumSearch = async (event) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    const values = {
      shopSelect: shopValue,
      startMonthSelect: startMonthValue,
      endMonthSelect: endMonthValue,
      rankSelect: rankValue,
      mediumSelect: mediumValue
    };

    Object.keys(values).forEach((key) =>{
      localStorage.setItem(key, values[key]);
    });

    setFormValues(values);

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "",
          reserveSort: "",
          contractSort: "",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const registerDesc = async (event) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "DESC",
          reserveSort: "",
          contractSort: "",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const registerAsc = async (event) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "ASC",
          reserveSort: "",
          contractSort: "",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const reserveDesc = async (event) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "",
          reserveSort: "DESC",
          contractSort: "",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const reserveAsc = async ( event ) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "",
          reserveSort: "ASC",
          contractSort: "",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const contractDesc = async ( event ) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "",
          reserveSort: "",
          contractSort: "DESC",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const contractAsc = async ( event ) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const rankValue = rankRef.current.value;
    const mediumValue = mediumRef.current.value;

    try {
      navigate("/customer", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: rankValue,
          medium: mediumValue,
          registerSort: "",
          reserveSort: "",
          contractSort: "ASC",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const rankAData = async ( event, medium ) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const mediumValue = medium === "全媒体合計" ? "" : medium;
  
    try {
      navigate("/result", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: "Aランク",
          medium: mediumValue,
          registerSort: "",
          reserveSort: "",
          contractSort: "",
          staff: "",
          step: "register",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const rankBData = async ( event, medium ) => {
    event.preventDefault();

    const shopValue = shopRef.current.value;
    const startMonthValue = startMonthRef.current.value;
    const endMonthValue = endMonthRef.current.value;
    const mediumValue = medium === "全媒体合計" ? "" : medium;
  
    try {
      navigate("/result", {
        state: {
          shop: shopValue,
          startMonth: startMonthValue,
          endMonth: endMonthValue,
          rank: "Bランク",
          medium: mediumValue,
          registerSort: "",
          reserveSort: "",
          contractSort: "",
          staff: "",
          step: "register",
          brand: brand,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // 円グラフを描写
  const mediumArray =[ ];
  const datasetsRegisterArray = [];
  const datasetsReserveArray = [];
  const datasetsContractArray = [];
  const colorArray =[];

  for (let i = 1; i < userData.length; i++){
    i = i === 0 && userData === 1 ? 0 : i;
    mediumArray.push(userData[i].medium);
    datasetsRegisterArray.push(userData[i].register_count);
    datasetsReserveArray.push(userData[i].reserve_count);
    datasetsContractArray.push(userData[i].contract_count);
    colorArray.push(colorCodes[i]);
  }

  const dataRegisterPie = {
    labels: mediumArray,
    datasets: [
      {
        data: datasetsRegisterArray,
        backgroundColor: colorArray,
        borderColor:colorArray,
        borderWidth: 1,
      },
    ],
  };
  
  const dataReservePie = {
    labels: mediumArray,
    datasets: [
      {
        data: datasetsReserveArray,
        backgroundColor: colorArray,
        borderColor:colorArray,
        borderWidth: 1,
      },
    ],
  };
  
  const dataContractPie = {
    labels: mediumArray,
    datasets: [
      {
        data: datasetsContractArray,
        backgroundColor: colorArray,
        borderColor:colorArray,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        position: 'right', 
      },
      title: {
        display: true,
        text: '媒体別人数'
      }
    },
  };

  return (
    <div>
      <Menu  brand={brand}/>
      <div className="container bg-white">
        <div className="row mb-3 pt-3">
          <div className="col">
            <select
              className="form-select"
              ref={shopRef}
              name="shop"
              defaultValue={formValues.shopSelect}
            >
              {shops.map((shop, index) => (
                <option key={index} value={shop}>
                  {shop}
                </option>
              ))}
            </select>
          </div>
          <div className="col d-flex">
            <select
              className="form-select"
              ref={startMonthRef}
              name="startMonth"
              defaultValue={formValues.startMonthSelect}
              onChange={(e) => setSelectedStartMonth(e.target.value)}
            >
              <option value="">期間</option>
              {startMonthArray.map((startMonth, index) => (
                <option key={index} value={startMonth}>
                  {startMonth}
                </option>
              ))}
            </select>
            <div className="pt-1 px-1">~</div>
            <select
              className="form-select"
              ref={endMonthRef}
              name="endMonth"
              defaultValue={formValues.endMonthSelect}
            >
              <option value="">期間</option>
              {endMonthArray.map((endMonth, index) => (
                <option key={index} value={endMonth}>
                  {endMonth}
                </option>
              ))}
            </select>
          </div>
          <div className="col">
            <select
              className="form-select"
              ref={rankRef}
              name="rank"
              defaultValue={formValues.rankSelect}            >
              <option value="">ランクを選択</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
            </select>
          </div>
          <div className="col">
            <select
              className="form-select"
              ref={mediumRef}
              name="medium"
              defaultValue={formValues.mediumSelect}
            >
              <option value="">全媒体を表示</option>
              {mediums.map((medium, index) => (
                <option key={index} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn bg-primary text-white px-5 rounded-pill mb-3"
          onClick={mediumSearch}
        >
          検索
        </button>
      </div>
      <div className="container bg-white py-2">
        <div className="bg-light">
          <Tabs defaultActiveKey="home" id="justify-tab-example" className="mb-3 bg-white" justify>
            <Tab eventKey="home" title="総反響詳細">
              <Pie data={dataRegisterPie} options={options} className='pie'/>
            </Tab>
            <Tab eventKey="profile" title="来場者詳細">
              <Pie data={dataReservePie} options={options} className='pie' />
            </Tab>
            <Tab eventKey="longer-tab" title="契約者詳細">
              <Pie data={dataContractPie} options={options} className='pie'/>
            </Tab>
          </Tabs>
        </div>
        <table className="table table-striped mt-3">
          <thead>
            <tr>
              <th scope="col">販促媒体名</th>
              <th scope="col">
                総反響
                <span className="sort">
                  <div className="desc" onClick={registerDesc}></div>
                  <div className="asc" onClick={registerAsc}></div>
                </span>
              </th>
              <th scope="col">来場率</th>
              <th scope="col">
                来場数
                <span className="sort">
                  <div className="desc" onClick={reserveDesc}></div>
                  <div className="asc" onClick={reserveAsc}></div>
                </span>
              </th>
              <th scope="col">契約率</th>
              <th scope="col">
                契約数
                <span className="sort">
                  <div className="desc" onClick={contractDesc}></div>
                  <div className="asc" onClick={contractAsc}></div>
                </span>
              </th>
              <th scope="col">Aランク</th>
              <th scope="col">Bランク</th>
              <th scope="col">Cランク</th>
              <th scope="col">Dランク</th>
              <th scope="col">Eランク</th>
              <th scope="col">総予算</th>
              <th scope="col">反響単価</th>
              <th scope="col">来場単価</th>
              <th scope="col">契約単価</th>
            </tr>
          </thead>
          <tbody>
            {userData.map((customer, index) => (
              <tr key={index}>
                <td>{customer.medium}</td>
                <td><div>{customer.register_count}</div></td>
                <td>{customer.reserve_per}%</td>
                <td><div>{customer.reserve_count}</div></td>
                <td>{customer.contract_per}%</td>
                <td><div>{customer.contract_count}</div></td>
                <td><div>{customer.rankA_count}</div></td>
                <td><div>{customer.rankB_count}</div></td>
                {/* <td><div className="detail text-primary" onClick={(event)=>rankAData(event, customer.medium)}>{customer.rankA_count}</div></td>
                <td><div className="detail text-primary" onClick={(event)=>rankBData(event, customer.medium)}>{customer.rankB_count}</div></td> */}
                <td><div>{customer.rankC_count}</div></td>
                {/* <td><div className="detail text-primary" onClick={(event)=>rankCData(event, customer.medium)}>{customer.rankC_count}</div></td> */}
                <td><div>{customer.rankD_count}</div></td>
                <td><div>{customer.rankE_count}</div></td>
                <td><div>￥{customer.total_budget}</div></td>
                <td><div>￥{customer.register_cost}</div></td>
                <td><div>￥{customer.reserve_cost}</div></td>
                <td><div>￥{customer.contract_cost}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SearchBox;
