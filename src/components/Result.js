import React, { useEffect, useState} from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import TableSearchBox from './TableSearchBox';
import TableBoxNull from './TableBoxNull';

const Result = () => {
    const location = useLocation();
    const { brand, shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort, staff, step, page, register, section } = location.state || {};
    const [userData, setUserData] = useState([]);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post("/dashboard/customerSearch.php", {
                brand,
                shop,
                startMonth,
                endMonth,
                rank,
                medium,
                registerSort,
                reserveSort,
                contractSort,
                staff,
                step,
                page,
                register,
                section
            });
            setUserData(Array.isArray(response.data.customers) ? response.data.customers : []);
            setTotalCount(response.data.totalCount);
          } catch (error) {
            console.error("Error fetching user data:", error);
            setUserData([]);
          }
        };
    
        if (shop || startMonth || endMonth || rank || medium || registerSort || reserveSort || contractSort || staff || step || page || register || section) {
          fetchData();
        }
      }, [shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort, staff, step, page, register, section, brand]);
    return (
        <div>
            {userData.length > 0 ? <TableSearchBox userData={userData} totalCount={totalCount} brand={brand}/> : <TableBoxNull brand={brand}/>}
        </div>
    )
}

export default Result