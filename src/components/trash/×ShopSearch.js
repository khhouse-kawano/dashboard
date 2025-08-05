import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import SearchBoxShop from "./×SearchBoxShop";
import SearchBoxNullShop from "./×SearchBoxNullShop";

const ShopSearch = () => {
  const location = useLocation();
  const { shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort } = location.state || {};
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/shopSearch.php", {
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
      {userData.length > 0 ? <SearchBoxShop userData={userData} /> : <SearchBoxNullShop />}
    </div>
  );
};

export default ShopSearch;
