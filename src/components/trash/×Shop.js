import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import SearchBoxShop from "./×SearchBoxShop";
import SearchBoxNullShop from "./×SearchBoxNullShop";

const Shop = () => {
  const location = useLocation();
  const { brand, shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort  } = location.state || {}; 
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/fetchShopData.php", { brand });
        setUserData(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    
    if (brand && !shop) {
      fetchData();
    }
  }, [brand, shop]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/shopSearch.php", {
          brand,
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
      {userData.length > 0 ? <SearchBoxShop userData={userData} brand={brand} /> : <SearchBoxNullShop brand={brand} />}
      </div>
  );
};

export default Shop;
