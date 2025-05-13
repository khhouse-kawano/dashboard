import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import { Bar } from 'react-chartjs-2';
import './chartConfig';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

const CustomerTrend = () => {
    const location = useLocation();
    const { brand } = location.state || {};
    const [userData, setUserData] = useState([]);

    const getYearMonthArray = (startYear, startMonth) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
    
        const yearMonthArray = [];
        let year = startYear;
        let month = startMonth;
    
        while ( year < currentYear || (year === currentYear && month <= currentMonth)) {
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

    useEffect(() =>{
            const fetchData = async() =>{
                try {
                    const response = await axios.post("/dashboard/fetchCustomerTrendData.php");
                    setUserData(response.data);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            };

            fetchData();
    },[])

    const colorCodes = [
  "#708090", // Slate Gray
  "#778899", // Light Slate Gray
  "#B0C4DE", // Light Steel Blue
  "#A9A9A9", // Dark Gray
  "#D3D3D3", // Light Gray
  "#B4A7D6", // muted lavender purple
  "#A2C4C9", // muted teal
  "#B6D7A8", // muted sage green
  "#F6B26B", // muted orange
  "#E06666", // muted red
  "#93C47D", // soft green
  "#6AA84F", // subdued green
  "#FFD966", // pale yellow
  "#F1C232", // muted gold
  "#6D9EEB", // soft blue
  "#6FA8DC", // cloudy blue
  "#E69138", // warm muted orange
  "#B8860B", // dark goldenrod（控えめな金色）
  "#A4C2F4", // light pastel blue
  "#C9DAF8", // very light pastel blue
  "#8E7CC3", // muted purple-blue
  "#C27BA0", // muted rose
  "#999999", // medium gray
  "#E1E1E1", // very light gray
  "#D5A6BD", // muted mauve
  "#A69888", // warm muted brown
  "#CFE2F3", // powder blue
  "#FCE5CD", // light peach
  "#D9D2E9", // lavender gray
  "#EAD1DC"  // light pink
];


const dataSets = userData.slice(1).map((value, index) => {
  const dataArray = [];

  for (let i = 0; i < startMonthArray.length; i++) {
    const key = `param_${startMonthArray[i].replace('/','_')}register_count`;
    dataArray.push(key in value ? value[key] : 0);
  }

  return {
    label: value.medium,
    data: dataArray,
    backgroundColor: colorCodes[index],
    stack: 'Stack 0'
  };

});

const dataSetsReserve = userData.slice(1).map((value, index) => {
  const dataArray = [];

  for (let i = 0; i < startMonthArray.length; i++) {
    const key = `param_${startMonthArray[i].replace('/','_')}reserve_count`;
    dataArray.push(key in value ? value[key] : 0);
  }

  return {
    label: value.medium,
    data: dataArray,
    backgroundColor: colorCodes[index],
    stack: 'Stack 0'
  };

});

const dataSetsContract = userData.slice(1).map((value, index) => {
  const dataArray = [];

  for (let i = 0; i < startMonthArray.length; i++) {
    const key = `param_${startMonthArray[i].replace('/','_')}contract_count`;
    dataArray.push(key in value ? value[key] : 0);
  }

  return {
    label: value.medium,
    data: dataArray,
    backgroundColor: colorCodes[index],
    stack: 'Stack 0'
  };

});

const data = {
  labels:startMonthArray, // X軸のラベル
  datasets: dataSets
};

const dataReserve = {
  labels:startMonthArray, // X軸のラベル
  datasets: dataSetsReserve
};

const dataContract = {
  labels:startMonthArray, // X軸のラベル
  datasets: dataSetsContract
};

const options = {
  responsive: true,
  scales: {
    x: {
      stacked: true, // X軸で積み上げを有効に
    },
    y: {
      stacked: true, // Y軸で積み上げを有効に
      beginAtZero: true, // Y軸は0からスタート
    }
  },
  plugins: {
    legend: {
      position: 'top'
    },
    title: {
      display: true,
      text: '総反響推移'
    }
  }
};

const optionsReserve = {
  responsive: true,
  scales: {
    x: {
      stacked: true, // X軸で積み上げを有効に
    },
    y: {
      stacked: true, // Y軸で積み上げを有効に
      beginAtZero: true, // Y軸は0からスタート
    }
  },
  plugins: {
    legend: {
      position: 'top'
    },
    title: {
      display: true,
      text: '来場者数推移'
    }
  }
};

  return (
    <div>
        <Menu brand= {brand} />
        <div className="container bg-white py-2">
        <Tabs defaultActiveKey="home" id="justify-tab-example" className="mt-5 mb-3 bg-white" justify>
          <Tab eventKey="home" title="総反響推移">
            <Bar data={data} options={options} />
          </Tab>
          <Tab eventKey="profile" title="来場者推移">
            <Bar data={dataReserve} options={optionsReserve} />
          </Tab>
          <Tab eventKey="longer-tab" title="契約者推移">
            <Bar data={dataContract} options={optionsReserve} />
          </Tab>
        </Tabs>
            <table className="table table-striped mt-3">
                <thead>
                    <tr>
                        <th scope="col">販促媒体名</th>
                        <th scope="col">合計</th>
                        {startMonthArray.map((startMonth, index) => (
                            <th scope="col" key={index}>
                            {startMonth}
                            </th>))}
                    </tr>
                </thead>
                <tbody>
                    {userData.map((customer, index) => (
                    <tr key={index}>
                        <td>{customer.medium}</td>
                        <td><span>総反響:{customer.register_count}</span><br></br><span className="text-danger">来場数:{customer.reserve_count}</span><br></br><span className="text-primary">契約数:{customer.contract_count}</span></td>
                        {startMonthArray.map((month, index) => (
                        <td scope="col" key={index}><span>総反響:{customer["param_" + month.replace("/", "_") + "register_count"]}</span><br></br>
                        <span className="text-danger">来場数:{customer["param_" + month.replace("/", "_") + "reserve_count"]}</span><br></br>
                        <span className="text-primary">契約数:{customer["param_" + month.replace("/", "_") + "contract_count"]}</span></td>))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default CustomerTrend;
