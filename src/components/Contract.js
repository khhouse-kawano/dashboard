import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./chartConfig";
import Accordion from "react-bootstrap/Accordion";
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Table from 'react-bootstrap/Table';
import { Line } from "react-chartjs-2";
import Menu from "./Menu";


export const Contract = ( ) => {
  const location = useLocation();
  const { brand } = location.state || {};
  const [contractUser, setUserData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffArray, setStaffArray] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/contractCustomer.php");
        setUserData(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.post("/dashboard/api/staffArray.php");
        setStaffArray(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchData();
  }, []);

  const thisYear = new Date().getFullYear();
  const startYear = 2021;
  const yearArray = [];
  yearArray.push(startYear);
  for ( let i = 1; i <= thisYear - startYear; i++){
    yearArray.push( startYear + i );
  }
  const monthArray = [ "06", "07", "08", "09", "10", "11", "12", "01", "02", "03", "04", "05"];
  const sectionArray = [ "1課", "2課", "3課", "4課"];
  const dataArray = [];
  for ( let i = 0; i < yearArray.length; i++){
    for ( let e = 0; e < monthArray.length; e ++){
      dataArray.push(`${yearArray[i]}/${monthArray[e]}`);
    }
  }
  const bgArray = [ "bg-primary bg-opacity-25 ", "bg-success bg-opacity-25", "bg-warning bg-opacity-25 ", "bg-danger bg-opacity-25 "];
  let yearTotal = 0;
  const reverseYearArray = [...yearArray].reverse(); //タブの表示用に
  const groupedMonth = dataArray.reduce((acc, monthStr) => {
    const [year, month] = monthStr.split("/");
    const monthNum = Number(month);
    const fiscalYear = monthNum >= 6 ? year : String(Number(year) - 1);  
    if (!acc[fiscalYear]) {
      acc[fiscalYear] = [];
    }
    acc[fiscalYear].push(monthStr);
    return acc;
  }, {});


  // グラフ
  const section1Array = [];
  yearArray.forEach(year => {
    let total = 0;
    groupedMonth[Number(year) - 1].forEach(month =>{
      total += contractUser.filter( item => item.contractDate.includes(month) && item.section.includes(sectionArray[0])).length
   })
    section1Array.push(total);
  });

  const section2Array = [];
  yearArray.forEach(year => {
    let total = 0;
    groupedMonth[Number(year) - 1].forEach(month =>{
      total += contractUser.filter( item => item.contractDate.includes(month) && item.section.includes(sectionArray[1])).length
   })
    section2Array.push(total);
  });

  const section3Array = [];
  yearArray.forEach(year => {
    let total = 0;
    groupedMonth[Number(year) - 1].forEach(month =>{
      total += contractUser.filter( item => item.contractDate.includes(month) && item.section.includes(sectionArray[2])).length
   })
    section3Array.push(total);
  });

  const section4Array = [];
  yearArray.forEach(year => {
    let total = 0;
    groupedMonth[Number(year) - 1].forEach(month =>{
      total += contractUser.filter( item => item.contractDate.includes(month) && item.section.includes(sectionArray[3])).length
   })
    section4Array.push(total);
  });

  const sectionTotalArray = [];
  yearArray.forEach(year => {
    let total = 0;
    groupedMonth[Number(year) - 1].forEach(month =>{
      total += contractUser.filter( item => item.contractDate.includes(month) ).length
   })
   sectionTotalArray.push(total);
  });
  const data = {
    labels: yearArray.slice(1),
    datasets: [
      {
        label: sectionArray[0],
        data: section1Array.slice(1),
        fill: false,
        borderColor: "rgb(8, 47, 174)",
        backgroundColor: "rgb(8, 47, 174)",
        tension: 0.1,
      },
      {
        label: sectionArray[1],
        data: section2Array.slice(1),
        fill: false,
        borderColor: "rgb(12, 158, 77)",
        backgroundColor: "rgb(12, 158, 77)",
        tension: 0.1,
      },
      {
        label: sectionArray[2],
        data: section3Array.slice(1),
        fill: false,
        borderColor: "rgb(243, 186, 0)",
        backgroundColor: "rgb(243, 186, 0)",
        tension: 0.1,
      },
      {
        label: sectionArray[3],
        data: section4Array.slice(1),
        fill: false,
        borderColor: "rgb(201, 17, 17)",
        backgroundColor: "rgb(201, 17, 17)",
        tension: 0.1,
      },
      {
        label: "注文営業全体",
        data: sectionTotalArray.slice(1),
        fill: false,
        borderColor: "rgb(0, 0, 0)",
        backgroundColor: "rgb(0, 0, 0)",
        tension: 0.1,
      },
    ],
  };
  
  // グラフのオプション設定
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "契約数推移",
      },
    },
  };
  
  return (
    <div>
      <Menu  brand={brand}/>
      <div className="container">
      <div className="bg-light">
      { loading === true ? (<p className="ms-3"><i className="fa-solid fa-spinner me-2 spinning"></i>Now Loading</p>) : null }
        <Line data={data} options={options} className="lineGraph"/>
        <Tabs defaultActiveKey={thisYear} id="justify-tab-example" className="mt-5 mb-3 bg-white" justify>
          {reverseYearArray.map((year, index) => (
          <Tab eventKey={year} title={`${year}`} key={index}>
            <div>
            <Table bordered hover className="mx-4 p-0 text-center totalTable">
              <tbody>
                <tr>
                  <th rowSpan={2} className="px-5"><div className="tableTtl total">{year}年度</div></th>
                    { monthArray.map(((month, index)=><th className="thread">{index < 7 ? year -1: year}/{month}</th>))}
                    <th className="thread">{year}年度合計</th>
                  </tr>
                  <tr>
                    {monthArray.map((month, monthIndex) => {
                    const monthCondition = monthIndex < 7 ? `${year - 1}/${month}` : `${year}/${month}`;
                    const monthCount = contractUser.filter(item => item.contractDate.includes(monthCondition) ).length;
                    yearTotal += monthCount; 
                    return (
                    <th key={month} className="text-center">{ contractUser.filter(item => item.contractDate.includes(monthCondition)).length }</th>);
                    })}
                    <th className="text-center">{yearTotal }</th>
                  </tr>
                  <tr className="d-none">{yearTotal=0}</tr>
                </tbody>
              </Table>
              <Accordion alwaysOpen>
                { sectionArray.map((section, indexSection) => (
                  <Accordion.Item className={bgArray[indexSection]} eventKey={indexSection}>
                    <Accordion.Header>
                      <Table striped bordered hover className="me-2 my-0 text-center">
                        <tbody>
                          <tr>
                            <th rowSpan={2} className="px-5"><div className="tableTtl">注文営業{section}</div></th>
                            { monthArray.map(((month, indexSection)=><th className="thread">{indexSection < 7 ? year -1: year}/{month}</th>))}
                            <th className="thread">{year}年度合計</th>
                          </tr>
                          <tr>
                             {monthArray.map((month, monthIndex) => {
                              const monthCondition = monthIndex < 7 ? `${year - 1}/${month}` : `${year}/${month}`;
                              const monthCount = contractUser.filter(item => item.contractDate.includes(monthCondition) && item.section.includes(section)).length;
                              yearTotal += monthCount; 
                              return (
                                <th key={month} className="text-center">{ contractUser.filter(item => item.contractDate.includes(monthCondition) && item.section.includes(section)).length }</th>);
                              })}
                            <th className="text-center">{yearTotal }</th>
                        </tr>
                        <tr className="d-none">{yearTotal=0}</tr>
                        </tbody>
                      </Table>
                    </Accordion.Header>
                      <Accordion.Body className="p-0 m-0">
                        <Accordion alwaysOpen>
                          { [...new Set(contractUser.filter(item => item.contractDate.includes(year) && item.section.includes(section)).map((value)=>value.shop))].map((shop, index) => (
                          <Accordion.Item className={bgArray[indexSection]} eventKey={index}>
                            <Accordion.Header>
                            <Table striped bordered hover className="me-2 my-0 text-center">
                              <tbody>
                                <tr>
                                  <th rowSpan={2} className="px-5"><div className="tableTtl">{shop}</div></th>
                                    { monthArray.map(((month, index)=><th className="thread">{index < 7 ? year -1: year}/{month}</th>))}
                                  <th className="thread">{year}年度合計</th>
                                </tr>
                                <tr>
                             {monthArray.map((month, monthIndex) => {
                              const monthCondition = monthIndex < 7 ? `${year - 1}/${month}` : `${year}/${month}`;
                              const monthCount = contractUser.filter(item => item.contractDate.includes(monthCondition) && item.shop.includes(shop)).length;
                              yearTotal += monthCount; 
                              return (
                                <th key={month} className="text-center">{ contractUser.filter(item => item.contractDate.includes(monthCondition) && item.shop.includes(shop)).length }</th>);
                              })}
                            <th className="text-center">{yearTotal }</th>
                        </tr>
                        <tr className="d-none">{yearTotal=0}</tr>
                        </tbody>
                      </Table>
                            </Accordion.Header>
                              <Accordion.Body className="ps-5 pe-4 ms-2">
                              <Table striped bordered hover>
                                <thead>
                                  <tr>
                                    <th className="staffName px-5">営業</th>
                                    { monthArray.map(((month, index)=><th className="thread">{index < 7 ? year -1: year}/{month}</th>))}
                                    <th className="thread">{year}年度合計</th>
                                  </tr>
                                </thead>
                                <tbody>
                                {[...new Map(staffArray.filter(item => item.year.includes(year) && item.shop.includes(shop)).map(item => [item.id, item])).values()].map((value, index) => (
                                  <tr key={index}>
                                    <th className="staffName px-5">{value.staff}</th>
                                    {monthArray.map((month, monthIndex) => {
                                      const monthCondition = monthIndex < 7 ? `${year - 1}/${month}` : `${year}/${month}`;
                                      const monthCount = contractUser.filter(item => item.contractDate.includes(monthCondition) && item.staff.includes(value.staff) && item.shop.includes(shop)).length;
                                      yearTotal += monthCount; 
                                      return (
                                      <th key={month} className="text-center">{ contractUser.filter(item => item.contractDate.includes(monthCondition) && item.staff.includes(value.staff) && item.shop.includes(shop)).length }</th>);
                                    })}
                                    <th className="text-center">{yearTotal}</th><tr className="d-none">{yearTotal=0}</tr>
                                  </tr>
                                ))}</tbody>
                              </Table>
                            </Accordion.Body>
                          </Accordion.Item>
                          ))}
                      </Accordion>
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </div>
          </Tab>
          ))}
        </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Contract;
