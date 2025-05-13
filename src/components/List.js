import { useLocation } from 'react-router-dom';
import React ,{ useEffect, useRef, useState } from 'react';
import Menu from './Menu.js';
import Table from "react-bootstrap/Table";
import axios from 'axios';


const ListTest = () => {
    const location = useLocation();
    const { brand } = location.state || {};
    const [originalData, setOriginalData] = useState([]);
    const [inquiryUsers, setInquiryUsers] = useState([]);
    const [syncUsers, setSyncUsers] = useState([]);
    const [shop, setShop] = useState([]);
    const [listShop, setListShop] = useState([]);
    const [medium, setMedium] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [order, setOrder] = useState("ASC");
    const [customerLength, setCustomerLength] = useState(20);
    const [totalLength, setTotalLength ] = useState(0);

    useEffect(() =>{
        const fetchData = async() =>{
            try {
                const response = await axios.post("/dashboard/api/inquiryList.php");
                setInquiryUsers(response.data);
                setOriginalData(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchData();
    },[]);

    useEffect(() =>{
        const fetchData = async() =>{
            try {
                const response = await axios.post("/dashboard/api/customerList.php");
                setSyncUsers(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchData();
    },[]);

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
                const response = await axios.post("/dashboard/api/inquiryShopList.php");
                setListShop(response.data);
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
                const response = await axios.post("/dashboard/api/staffList.php");
                setStaffList(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchData();
    },[]);

    useEffect(() => {
        setTotalLength(inquiryUsers.filter(item=>item.inquiry_date.includes(targetMonth)).length);
    }, [inquiryUsers]);

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
        setTotalLength(inquiryUsers.length);
        setCustomerLength(20);
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
    const staffRef = useRef(null);
    const [selectedShop, setSelectedShop] = useState({});
    const [synchronize, setSynchronize] = useState(false);

    const shopChange = async (event, id) => {
        const shop = event.target.value;
        const postData = {
            shop: shop,
            inquiry_id: id
        };
    
        setSelectedShop(postData);
    
        try {
            const response = await fetch("/dashboard/api/changeShop.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData)
            });
            const data = await response.json();
            setInquiryUsers(data);
            setOriginalData(data);
        } catch (error) {
            console.error("エラー:", error);
        }
    };


    const staffChange = async (event, selectedInquiryUser) => {
        const staff = event.target.value;
        const postData = {
            inquiry_date: selectedInquiryUser.inquiry_date,
            first_name: selectedInquiryUser.first_name,
            mail: selectedInquiryUser.mail,
            medium: selectedInquiryUser.medium,
            staff: staff,
        };
    
        setSelectedShop(postData);
    
        try {
            const response = await fetch("/dashboard/api/changeStaff.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData)
            });
            const data = await response.json();
            setInquiryUsers(data);
            setOriginalData(data);
        } catch (error) {
            console.error("エラー:", error);
        }
    };

    const sync =async ( first_name, last_name, shop)=>{
    
        if (window.confirm(`${shop} ${first_name} ${last_name}様 PG CLOUDと同期しますか?`)) {
            console.log("削除しました！");
        } else {
            console.log("キャンセルされました。");
        }
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
                            const count =  inquiryUsers.filter(item=>item.shop?.includes(value.shop) && item.inquiry_date?.includes(targetMonth)).length;
                            const goal = value.resister_goal;
                            return(
                        <th key={index} className={`text-center ${count > goal ? 'text-primary' : 'text-danger'}`}>{count}</th>)})}
                    </tr>
                    { medium.map((element, index)=>(
                    <tr className='mediumList d-none' key={index}>
                        <th className="sticky-column bg-warning text-white">{element.medium}</th>
                        { shop.map((value, index)=>( <th key={index} className='text-center'>{ inquiryUsers.filter(item=>item.shop?.includes(value.shop) && item.inquiry_date?.includes(targetMonth) && item.response_medium?.includes(element.medium)).length}</th>))}
                    </tr>
                    ))}
                    <tr>
                        <th className="sticky-column bg-warning text-white">反響目標</th>
                        { shop.map((value, index)=>( <th key={index} className='text-center'>{ value.resister_goal}</th>))}
                    </tr>
                    <tr>
                        <th className="sticky-column bg-warning text-white">来場計</th>
                        { shop.map((value, index)=>{
                            const count =  syncUsers.filter(item=>item.shop?.includes(value.shop) && item.register?.includes(targetMonth) && item.reserve!=="").length;
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
                    <th className="sticky-column bg-success text-white">同期</th>
                    <th className="sticky-column bg-success text-white">店舗名
                        <i className="fa-regular fa-square-plus ps-2 pointer" onClick={shopSort}></i>
                        <div className='position-absolute shop_list d-none bg-white py-2 text-primary'>
                            <ul>
                                <p className='mb-2 text-dark'>店舗を選択</p>
                                <li onClick={() => handleShopReset()} className='mb-2'><span className="text-white bg-danger rounded-pill duplicate">全店舗表示</span></li>
                                { shop.map((value, index)=>{
                                    const kh = "text-white kh rounded-pill duplicate";
                                    const djh = "text-white djh rounded-pill duplicate";
                                    const nagomi = "text-white nagomi rounded-pill duplicate";
                                    const fh = "text-white fh rounded-pill duplicate";
                                    const pgh = "text-white pgh rounded-pill duplicate";
                                    const nieru = "text-white nieru rounded-pill duplicate";
                                    let duplicateClass;
                                    if ( value.shop.includes('KH')){
                                        duplicateClass = kh;
                                    } else if ( value.shop.includes('DJH')){
                                        duplicateClass = djh;
                                    } else if ( value.shop.includes('なごみ')){
                                        duplicateClass = nagomi;
                                    } else if ( value.shop.includes('FH')){
                                        duplicateClass =fh;
                                    } else if ( value.shop.includes('2L')){
                                        duplicateClass = nieru;
                                    } else if ( value.shop.includes('PG HOUSE')){
                                        duplicateClass =pgh;
                                    }
                                    return(
                                <li key={index} onClick={() => handleShopSort(value.shop)} className='mb-2'><span className={duplicateClass}>{value.shop}</span></li>)})}
                            </ul>
                        </div>
                    </th>
                    <th className='bg-success text-white'>営業担当</th>
                    <th className='bg-success text-white'>反響日</th>
                    <th className='bg-success text-white'>反響<br></br>ブランド</th>
                    <th className='bg-success text-white'>反響媒体</th>
                    <th className='bg-success text-white'>氏名</th>
                    <th className='bg-success text-white'>住所</th>
                    <th className='bg-success text-white'>詳細</th>
                    <th className='bg-success text-white'>予定地</th>
                    <th className='bg-success text-white'>追客状況</th>
                    <th className='bg-success text-white'>資料送付</th>
                    <th className='bg-success text-white'>営業備考</th>
                    <th className='bg-success text-white'>管理客</th>
                    <th className='bg-success text-white'>マーケ備考</th>
                    <th className='bg-success text-white'>ギフト送信</th>
                    </tr>
                </thead>
                <tbody>
                {inquiryUsers.filter(item=>item.inquiry_date.includes(targetMonth)).slice(0, customerLength).map((value, index)=>{
                    let shopColorCode;
                    let shopColorCodeEvent;
                    if (value.shop?.includes("KH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white kh";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white kh px-3";
                    } else if(value.shop?.includes("DJH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white djh";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white djh px-3";
                    } else if(value.shop?.includes("なごみ")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white nagomi";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white nagomi px-3";
                    } else if(value.shop?.includes("2L")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white nieru";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white nieru px-3";
                    } else if(value.shop?.includes("FH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white fh";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white fh px-3";
                    } else if(value.shop?.includes("PG")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white pgh";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white pgh px-3";
                    }
                    
                    return(
                    <tr>
                        <th><i className="fa-solid fa-arrows-rotate sticky-column pointer" onClick={()=>sync(value.first_name, value.first_name, value.shop)}></i></th>
                        <th className='sticky-column' key={index}><select className={shopColorCode} ref={shopRef} onChange={(event) => shopChange(event, value.inquiry_id)} >{ listShop.map((shop, shopIndex) =>(
                            <option key={shopIndex} selected={ shop.shop === value.shop}>{shop.shop}</option>))}</select></th>
                        <th key={index}><select className={shopColorCode} ref={staffRef}  ><option vallue ="">担当営業を選択</option>{ staffList.filter(item =>item.shop?.includes(value.shop)).map((staff, staffIndex) =>(
                            <option key={staffIndex} selected={ staff.name === value.staff}>{staff.name}</option>))}</select></th>
                        <th key={index}>{value.inquiry_date}</th>
                        <th key={index}>{value.brand}</th>
                        <th key={index}>{value.inquiry_id.includes("homepage") ? 'ホームページ' : `${value.medium}`}</th>
                        <th key={index}>{value.first_name} {value.last_name}</th>
                        <th key={index}>{value.pref}{value.city}{value.town}{value.street}{value.building}</th>
                        <th key={index}>{value.inquiry_id.includes("homepage") ? <span className={shopColorCodeEvent} style={{ whiteSpace: "nowrap"}}>{value.hp_campaign}
                            {value?.duplicate ? <br></br> : "" }
                        </span> : ""}
                        { value?.duplicate ? value.duplicate.split(',').map( (value)=>{
                            const kh = "text-white kh rounded-pill duplicate";
                            const djh = "text-white djh rounded-pill duplicate";
                            const nagomi = "text-white nagomi rounded-pill duplicate";
                            const fh = "text-white fh rounded-pill duplicate";
                            const pgh = "text-white pgh rounded-pill duplicate";
                            const nieru = "text-white nieru rounded-pill duplicate";
                            let duplicateClass;
                            if ( value.includes('KH')){
                                duplicateClass = kh;
                            } else if ( value.includes('DJH')){
                                duplicateClass = djh;
                            } else if ( value.includes('なごみ')){
                                duplicateClass = nagomi;
                            } else if ( value.includes('FH')){
                                duplicateClass =fh;
                            } else if ( value.includes('PG HOUSE')){
                                duplicateClass =pgh;
                            } else if ( value.includes('2L')){
                                duplicateClass = nieru;
                            } 
                            return(
                            <><span className={duplicateClass}>{value}</span><br></br></>)
                        }) 
                        : ""  }
                        </th>
                        <th key={index}>{value.area}</th>
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
            <div className='d-flex justify-content-center'>
                { totalLength !== 0 && totalLength >= customerLength ? 
                <div className='btn bg-primary text-white px-5 rounded-pill' 
                onClick={() => setCustomerLength(customerLength + 20 )}>続きを表示</div> : "" }
            </div>
            
            </div>
            
        </div>
    </div>
  )
}


export default ListTest

