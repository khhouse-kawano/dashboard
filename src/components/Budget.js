import { useLocation } from 'react-router-dom';
import React ,{ useEffect, useRef, useState } from 'react';
import Menu from './Menu.js';
import Table from "react-bootstrap/Table";
import axios from 'axios';

// 開発用

const Budget = () => {
    const location = useLocation();
    const { brand } = location.state || {};
    const [shopList, setShop] = useState([]);
    const [mediumList, setMedium] = useState([]);
    const [budgetList, setBudget] = useState([]);

    useEffect(() =>{
        const fetchData = async() =>{
            try {
                const response = await axios.post("/dashboard/api/shopList.php");
                setShop(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchData();
    },[]);

    useEffect(() =>{
        const fetchData = async() =>{
            try {
                const response = await axios.post("/dashboard/api/mediumList.php");
                setMedium(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchData();
    },[]);

    useEffect(() =>{
        const fetchData = async() =>{
            try {
                const response = await axios.post("/dashboard/api/budget.php");
                setBudget(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchData();
    },[]);

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
    
          // 次の月に移動
        month++;
        if (month > 12) {
            month = 1;
            year++;
            }
        }
    
        return yearMonthArray;
    };
    
    const [selectedMonth, setSelectedStartMonth] = useState("");
    const startMonthArray = getYearMonthArray(2025, 1);
    const startMonthRef = useRef("2025/04");

    const userFilter = () =>{
        setSelectedStartMonth(startMonthRef.current.value);
    }

    const brandArray =[ "KH", "DJH", "なごみ", "2L", "FH", "PG HOUSE"];

    const alertTest = (event) => {
        const budgetNote = event.currentTarget.querySelector('.budget_note');
        if (budgetNote) {
            budgetNote.classList.toggle('d-none');
        }
    };

    const closeBudgetNote = (event) => {
        event.stopPropagation(); 
        const budgetNote = event.currentTarget.closest('.budget_note'); 
        if (budgetNote) {
            budgetNote.classList.add('d-none');
        }
    };
    return (
        <div>
            <Menu brand={brand} />
            <div className="container bg-white pt-3 inquiry_ui position-relative">
            <div className="row mt-3 mb-4" >
                <div className="col d-flex">
                    <select className="form-select campaign" ref={startMonthRef} name="startMonth" onChange={userFilter}>
                        <option value="">全期間</option>
                        {startMonthArray.map((startMonth, index) => (
                            <option key={index} value={startMonth}>{startMonth}</option>
                        ))}
                    </select>
                </div>
                <div className="col">
                </div>
                <div className="col-4"></div>
            </div>
                <div className='p-0 inquiry'>
                <Table striped bordered hover className='budget_table'>
                    <thead className='sticky-header'> 
                        <tr className='sticky-header'>
                            <th className="sticky-column text-white bg-secondary">販促媒体</th>
                            <th className="text-white bg-secondary">合計</th>
                            {mediumList.map((medium, index) =>{
                                const medium_bg = medium.response_medium === 0 ? "bg-success text-white" : "bg-primary text-white";
                                return <th key={index} className={medium_bg}>{medium.medium}</th>
                            })}
                        </tr>
                        <tr className='sticky-header'>
                            <th className="sticky-column">グループ全体</th>
                            <th>￥{budgetList.filter(item=>item.budget_period.includes(selectedMonth)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}</th>
                            {mediumList.map((medium, index) =><th key={index} className="fw-normal">￥{budgetList.filter(item=>item.budget_period.includes(selectedMonth) && item.medium.includes(medium.medium)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}</th>)}
                        </tr>
                        { brandArray.map((brand, index) =>
                            <tr key={index} className='sticky-header'>
                                <th className="sticky-column">{brand}合計</th>
                                <th>￥{budgetList.filter(item=>item.budget_period.includes(selectedMonth) && item.shop.includes(brand)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}</th>
                                {mediumList.map((medium, index) =><th key={index} className="fw-normal">￥{budgetList.filter(item=>item.budget_period.includes(selectedMonth) && item.medium.includes(medium.medium) && item.shop.includes(brand)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}</th>)}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {shopList.map((shop, index) =>
                            <tr key={index} className="bg-success text-white">
                                <th className="sticky-column">{shop.shop}</th>
                                <th>￥{budgetList.filter(item=>item.budget_period.includes(selectedMonth) && item.shop.includes(shop.shop)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}</th>
                                {mediumList.map((medium, index) =>
                                <th key={index} className="text-primary fw-normal budget_show" onClick={(event) =>alertTest(event)}>￥{budgetList.filter(item=>item.budget_period.includes(selectedMonth) && item.medium.includes(medium.medium) && item.shop.includes(shop.shop)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}
                                <div className='budget_note d-none position-absolute bg-white'>
                                    <button className="btn position-absolute top-0 end-0" onClick={(event) => closeBudgetNote(event)}><i class="fa-solid fa-square-xmark"></i></button>
                                    <div className='ps-3 py-2'>{selectedMonth} {shop.shop}_{medium.medium}詳細</div><ul className='list-group'>{budgetList.filter(item=>item.budget_period.includes(selectedMonth) && item.shop.includes(shop.shop) && item.medium.includes(medium.medium)).map((value)=><li className='list-group-item'>￥{value.budget_value.toLocaleString()}（{value.note}_{value.company}）</li>)}</ul></div>
                                </th>
                            )}
                            </tr>)}
                    </tbody>
                </Table>
                </div>
                
            </div>
        </div>
      )
}


export default Budget

