import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Menu from "./Menu";

const SearchBoxNull = ({brand}) => {
  const shopRef = useRef(null);
  const startMonthRef = useRef(null);
  const endMonthRef = useRef(null);
  const rankRef = useRef(null);
  const mediumRef = useRef(null);

  // セレクトタグの値をローカルに保持

  const [formValues, setFormValues] = useState({
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
    "DJH都城",
    "DJH宮崎",
    "なごみ",
    "なごみ鹿児島",
    "なごみ姶良霧島",
    "2L",
    "FH",
    "FH鹿児島",
    "FH霧島",
    "PG HOUSE宮崎店"];

  const [selectedStartMonth, setSelectedStartMonth] = useState("");

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

  const endMonthArray = selectedStartMonth
    ? startMonthArray.filter((month) => month >= selectedStartMonth)
    : startMonthArray;

  // selectedStartMonthが変更されたときにendMonthRefの値を更新
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

  
  const shopSearch = async (event) => {
    event.preventDefault();
    try {
      navigate("/shop/", {
        state: {
          brand: brand
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  }

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
    mediumSelect: mediumValue,
    };

    Object.keys(values).forEach((key) => {
      localStorage.setItem(key, values[key]);
    });

    setFormValues(values);

    try {
    navigate("/customer/", {
        state: {
        shop: shopValue,
        startMonth: startMonthValue,
        endMonth: endMonthValue,
        rank: rankValue,
        medium: mediumValue,
        registerSort: "",
        reserveSort: "",
        contractSort: "",
        brand: brand
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const customerTrend = async() =>{
    navigate('/customer/trend/', {state: { brand: brand}});
  }

  const shopTrend = async() =>{
    navigate('/shop/trend/', {state: { brand: brand}});
  }

  return (
    <div>
      <Menu brand = {brand}/>
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
              defaultValue={formValues.rankSelect}
            >
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
      <div className="null container bg-white py-2">No Data...</div>
    </div>
  );
};

export default SearchBoxNull;
