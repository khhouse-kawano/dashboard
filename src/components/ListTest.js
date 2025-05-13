import { useLocation } from 'react-router-dom';
import React ,{ useEffect, useRef, useState } from 'react';
import Menu from './Menu.js';
import Table from "react-bootstrap/Table";

// 開発用
import { campaignUsers } from './campaignUser.js';
import { shopList } from './shopList.js';
import { mediumList } from './shopList.js';
import { contractUser } from './contractUser.js'

const ListTest = () => {
    const location = useLocation();
    const { brand } = location.state || {};
    const [originalData, setOriginalData] = useState([]);
    const [inquiryUsers, setInquiryUsers] = useState([]);
    const [syncUsers, setSyncUsers] = useState([]);
    const [shop, setShop] = useState([]);
    const [medium, setMedium] = useState([]);
    useEffect(() =>{
        setInquiryUsers(campaignUsers);
        setOriginalData(campaignUsers);
    },[])

    useEffect(() =>{
        setSyncUsers(contractUser);
    },[])

    useEffect(() =>{
        setShop(shopList);
    },[])

    useEffect(() =>{
        setMedium(mediumList);
    },[])
    const startYear = 2025;
    const startMonth = 1;
    const monthArray = ["2025/01"];
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const monthLength = ( thisYear * 12 + thisMonth ) - ( startYear * 12 + startMonth );
    for (let i = 0; i < monthLength; i++) {
        const totalMonth = startMonth + (i + 1);
        const nextYear = startYear + Math.floor((totalMonth - 1) / 12);
        const nextMonth = ((totalMonth - 1) % 12) + 1;        
        monthArray.push(`${nextYear}/${nextMonth.toString().padStart(2, "0")}`);
      }
    const monthRef = useRef(null);
    const [ targetMonth, setTargetMonth] = useState(monthArray[monthArray.length-1]);

    const changeMonth = (month) => {
        setTargetMonth(month);
        setInquiryUsers(originalData.filter(item => item.inquiry_date.includes(month)));
    }

    const mediumShow = async () =>{
        document.querySelectorAll('.mediumList').forEach(element=>{
            element.classList.toggle("d-none");
        })
        document.querySelector('.plus-icon').classList.toggle('d-none');
        document.querySelector('.minus-icon').classList.toggle('d-none');
        }

    const mediumHide = async () =>{
        document.querySelectorAll('.mediumList').forEach(element=>{
            element.classList.toggle("d-none");
        })
        document.querySelector('.plus-icon').classList.toggle('d-none');
        document.querySelector('.minus-icon').classList.toggle('d-none');
        }
    
    const shopSort = async () =>{
        document.querySelector('.shop_list').classList.toggle('d-none');
    }

    const handleShopReset = () =>{
        setInquiryUsers(originalData.filter(item => item.inquiry_date.includes(targetMonth)));
        document.querySelector('.shop_list').classList.toggle('d-none');
    }

    const handleShopSort =  (shop) =>{
        setInquiryUsers(originalData.filter(item => item.shop.includes(shop) && item.inquiry_date.includes(targetMonth)));
        document.querySelector('.shop_list').classList.toggle('d-none');
    }

    const shopRef = useRef(null);
    const [selectedShop, setSelectedShop] = useState({});

    useEffect(() => {
        if (selectedShop) {
        fetch("https://example.com/api/updateShop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(selectedShop)
        })
            .then(response => response.json())
            .then(data => console.log("成功:", data))
            .catch(error => console.error("エラー:", error));
        }
    }, [selectedShop]); 

    const shopChange = async (event, selectedInquiryUser) => {
        const selectedShop = event.target.value;
        const postData = {
            shop: selectedShop,
            inquiry_date: selectedInquiryUser.inquiry_date,
            first_name: selectedInquiryUser.first_name,
            mail: selectedInquiryUser.mail,
            medium: selectedInquiryUser.medium,
        };
        
        setSelectedShop(postData);
    };


    return (
    <div>
        <Menu brand={brand} />
        <div className="container bg-white pt-3 inquiry_ui position-relative">
            <div className='position-absolute white-object'></div>
            <div className='position-absolute white-object side'></div>
            <div className='pb-3 row'>
                <div className="col-3 d-flex">
                    <select className="form-select campaign position-relative" ref={monthRef} name="startMonth" onChange={(event) =>changeMonth(event.target.value)}>
                        {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                            ))}
                    </select>
                </div>
            </div>
            <div className='p-0 inquiry'>
            <Table striped bordered hover className='inquiry_table'>
                <thead className='sticky-header'> 
                    {/* className='sticky-header' でヘッダー固定*/}
                    <tr className='sticky-header'>
                        <th className="sticky-column bg-success text-white">店舗名</th>
                        { shop.map((value, index)=>( <th key={index} className='text-center bg-success text-white'>{value.shop}</th>))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th className="sticky-column bg-warning text-white">                            
                            反響計<i className="fa-regular fa-square-plus plus-icon ps-2" onClick={mediumShow}></i><i className="fa-regular fa-square-minus minus-icon d-none ps-2" onClick={mediumHide}></i></th>
                         { shop.map((value, index)=>{
                            const count =  inquiryUsers.filter(item=>item.shop.includes(value.shop) && item.inquiry_date.includes(targetMonth)).length;
                            const goal = value.resister_goal;
                            return(
                        <th key={index} className={`text-center ${count > goal ? 'text-primary' : 'text-danger'}`}>{count}</th>)})}
                    </tr>
                    { medium.map((element, index)=>(
                    <tr className='mediumList d-none' key={index}>
                        <th className="sticky-column bg-warning text-white">{element.medium}</th>
                        { shop.map((value, index)=>( <th key={index} className='text-center'>{ inquiryUsers.filter(item=>item.shop.includes(value.shop) && item.inquiry_date.includes(targetMonth) && item.medium.includes(element.medium)).length}</th>))}
                    </tr>
                    ))}
                    <tr>
                        <th className="sticky-column bg-warning text-white">反響目標</th>
                        { shop.map((value, index)=>( <th key={index} className='text-center'>{ value.resister_goal}</th>))}
                    </tr>
                    <tr>
                        <th className="sticky-column bg-warning text-white">来場計</th>
                        { shop.map((value, index)=>{
                            const count =  syncUsers.filter(item=>item.shop.includes(value.shop) && item.register.includes(targetMonth) && item.reserve!=="").length;
                            const goal = value.reserve_goal;
                            return(
                            <th key={index} className={`text-center ${count > goal ? 'text-primary' : 'text-danger'}`}>{count}</th>)})}
                    </tr>
                    <tr>
                        <th className="sticky-column bg-warning text-white">来場目標</th>
                        { shop.map((value, index)=>( <th key={index} className='text-center'>{ value.reserve_goal}</th>))}
                    </tr>
                </tbody>
            </Table>
            <Table striped bordered hover className='inquiry_table bottom'>
                <thead> 
                <tr className='sticky-header'>
                <th className="sticky-column bg-success text-white">店舗名
                    <i className="fa-regular fa-square-plus ps-2 pointer" onClick={shopSort}></i>
                    <div className='position-absolute shop_list d-none bg-white py-2 text-primary'>
                        <ul>
                            <p className='m-0 text-dark'>店舗を選択</p>
                            <li onClick={() => handleShopReset()}>全店舗表示</li>
                            { shop.map((value, index)=>(
                            <li key={index} onClick={() => handleShopSort(value.shop)}>{value.shop}</li>))}
                        </ul>
                    </div>
                </th>
                        <th className='bg-success text-white'>反響媒体</th>
                        <th className='bg-success text-white'>反響日</th>
                        <th className='bg-success text-white'>氏名</th>
                        <th className='bg-success text-white'>住所</th>
                        <th className='bg-success text-white'>イベント</th>
                        <th className='bg-success text-white'>アンケート</th>
                        <th className='bg-success text-white'>予定地</th>
                        <th className='bg-success text-white'>営業担当</th>
                        <th className='bg-success text-white'>追客状況</th>
                        <th className='bg-success text-white'>資料送付</th>
                        <th className='bg-success text-white'>営業備考</th>
                        <th className='bg-success text-white'>管理客</th>
                        <th className='bg-success text-white'>マーケ備考</th>
                        <th className='bg-success text-white'>ギフト送信</th>
                    </tr>
                </thead>
                <tbody>
                {inquiryUsers.filter(item=>item.inquiry_date.includes(targetMonth)).map((value, index)=>{
                    let shopColorCode;
                    if (value.shop.includes("KH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white kh";
                    } else if(value.shop.includes("DJH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white djh";
                    } else if(value.shop.includes("なごみ")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white nagomi";
                    } else if(value.shop.includes("2L")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white nieru";
                    } else if(value.shop.includes("FH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white fh";
                    } else if(value.shop.includes("PGH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white pgh";
                    }
                    
                    return(
                    <tr>
                        <th className='sticky-column' key={index}><select className={shopColorCode} ref={shopRef} onChange={(event) => shopChange(event, value)} >{ shop.map((shop, shopIndex) =>(
                            <option key={shopIndex} selected={ shop.shop === value.shop}>{shop.shop}</option>))}</select></th>
                        <th key={index}>{value.medium}</th>
                        <th key={index}>{value.inquiry_date}</th>
                        <th key={index}>{value.first_name} {value.last_name}</th>
                        <th key={index}>{value.pref}{value.city}{value.town}{value.street}{value.building}</th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                        <th key={index}></th>
                    </tr>)})}
                    
                </tbody>
            </Table>
            </div>
            
        </div>
    </div>
  )
}


export default ListTest

