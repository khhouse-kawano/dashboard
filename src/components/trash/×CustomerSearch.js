import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import SearchBox from "../SearchBox";
import SearchBoxNull from "../SearchBoxNull";

const CustomerSearch = () => {
  const location = useLocation();
  const { shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort } = location.state || {};
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/mediumSearch.php", {
          shop,
          startMonth,
          endMonth,
          rank,
          medium,
          registerSort,
          reserveSort,
          contractSort
        });
        setUserData(response.data);  // 取得したユーザーデータをステートに設定
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData([]);
      }
    };

    if (shop || startMonth || endMonth || rank || medium || registerSort || reserveSort || contractSort) {
      fetchData();
    }
  }, [shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort]);

  return (
    <div>
      {userData.length > 0 ? <SearchBox userData={userData} /> : <SearchBoxNull />}
    </div>
  );
};

export default CustomerSearch;
