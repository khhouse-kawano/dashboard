import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import SearchBox from "./×SearchBox";
import SearchBoxNull from "./×SearchBoxNull";

const Customer = () => {
  const location = useLocation();
  const { brand, shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort } = location.state || {};
  const [userData, setUserData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/fetchUserData.php", { brand }); 
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
        const response = await axios.post("/dashboard/mediumSearch.php", {
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
        setUserData(response.data); 
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData([]);
      }
    };
    if (shop || startMonth || endMonth || rank || medium || registerSort || reserveSort || contractSort) {
      fetchData();
    }
  }, [ shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort]);

  return (
    <div>
      {userData.length > 0 ? <SearchBox userData={userData} brand={brand} /> : <SearchBoxNull brand={brand} />}
    </div>
  );
};

export default Customer;
