import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Menu from "./Menu";

const TableBoxNull = ({ brand }) => {
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
    "PG HOUSE宮崎店"
  ];

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

  return (
    <div>
      <Menu  brand={brand}/>
      <div className="null container bg-white py-2">No Data...</div>
    </div>
  );
};

export default TableBoxNull;
