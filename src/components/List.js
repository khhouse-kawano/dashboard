import { useNavigate } from 'react-router-dom';
import React ,{ useEffect, useRef, useState, useContext,  useMemo  } from 'react';
import Menu from './Menu.js';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const ListTest = () => {
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
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
    const [targetShop, setTargetShop] = useState('');
    const [targetMedium, setTargetMedium] = useState('');
    const [targetName, setTargetName] = useState('');
    const [targetSync, setTargetSync] = useState(3);
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


    const fetchData = async (url, setter, params = {}) => {
        try {
            const response = await axios.post(url, params, {
                headers: { "Content-Type": "application/json" }
            });
            setter(response.data);
        } catch (error) {
            console.error(`Error fetching data from ${url}:`, error);
        }
    };

    useEffect(() => {
        // if (!brand || brand.trim() === "") {
        //     navigate("/");
        //     return;
        // }

        const fetchInquiryList = async () => {
            const response = await axios.post("/dashboard/api/inquiryList.php", { month: targetMonth });
            setInquiryUsers(response.data);
            setOriginalData(response.data);
        };

        fetchInquiryList();
        const interval = setInterval(fetchInquiryList, 60000);
        return () => clearInterval(interval);
    }, [brand, targetMonth]);

    useEffect(() => {
        const apiEndpoints = [
            { url: "/dashboard/api/customerList.php", setter: setSyncUsers },
            { url: "/dashboard/api/shopList.php", setter: setShop },
            { url: "/dashboard/api/inquiryShopList.php", setter: setListShop },
            { url: "/dashboard/api/mediumList.php", setter: setMedium },
            { url: "/dashboard/api/staffList.php", setter: setStaffList }
        ];

        Promise.all(apiEndpoints.map(({ url }) => axios.post(url)))
            .then(responses => responses.forEach((response, index) => apiEndpoints[index].setter(response.data)))
            .catch(error => console.error("Error fetching data:", error));
    }, []);

    const filteredUsers = useMemo(() => 
        originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return(
            item.inquiry_date.includes(targetMonth) && item.shop.includes(targetShop) && item.response_medium.includes(targetMedium) && ( targetSync === 3 || item.sync == targetSync ) && fullName.includes(targetName)
        )}), [originalData, targetMonth, targetShop, targetMedium, targetSync, targetName]);

    useEffect(() => {
        setInquiryUsers(filteredUsers);
    }, [filteredUsers]);

    useEffect(() => {
        setTotalLength(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return(
            item.inquiry_date.includes(targetMonth) && item.shop.includes(targetShop) && item.response_medium.includes(targetMedium) && ( targetSync === 3 || item.sync == targetSync ) && fullName.includes(targetName)
        )}).length);
    }, [originalData, targetMonth]);

    const changeMonth = (month) => {
        setTargetMonth(month);
        setInquiryUsers(originalData.filter(item => item.inquiry_date.includes(month)));
        setTotalLength(inquiryUsers.length);
        setTargetName('');
        setCustomerLength(20);
    };

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
        };

    const [selectedShop, setSelectedShop] = useState({});

    const [synchronize, setSynchronize] = useState(false);

    const handleShopSort = async(shop) => {
        const shopValue = shop === 'PG HOUSE宮崎店' ? 'PG' : shop;
        await setTargetShop(shopValue);
        await setInquiryUsers(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return(item.inquiry_date.includes(targetMonth) &&
            item.response_medium.includes(targetMedium) &&
            (shopValue === "" || item.shop.includes(shopValue)) &&
            (targetSync === 3 || item.sync === targetSync) &&
            fullName.includes(targetName)
        )}));
        await setCustomerLength(20);
        await setTotalLength(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return(item.inquiry_date.includes(targetMonth) &&
            item.response_medium.includes(targetMedium) &&
            (shopValue === "" || item.shop.includes(shopValue)) &&
            (targetSync === 3 || item.sync === targetSync) &&
            fullName.includes(targetName)
        )}).length);
    };

    const handleMediumSort = async(medium) => {
        const formattedMedium = medium === '公式LINE' ? 'ALLGRIT' : medium;
        await setTargetMedium(formattedMedium);
        await setInquiryUsers(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return(
            item.inquiry_date.includes(targetMonth) &&
            item.shop.includes(targetShop) &&
            (medium === "" || item.response_medium.includes(formattedMedium)) &&
            (targetSync === 3 || item.sync === targetSync) &&
            fullName.includes(targetName)
        )}
        ));
        await setCustomerLength(20);
        await setTotalLength(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return (item.inquiry_date.includes(targetMonth) &&
            item.shop.includes(targetShop) &&
            (medium === "" || item.response_medium.includes(formattedMedium)) &&
            (targetSync === 3 || item.sync === targetSync) &&
            fullName.includes(targetName)
        )}).length);
    };

    const handleSyncSort = async(syncValue) => {
        const sync = parseInt(syncValue, 10);
        await setTargetSync(sync);
        await setInquiryUsers(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return( item.inquiry_date.includes(targetMonth) &&
            item.shop.includes(targetShop) &&
            item.response_medium.includes(targetMedium) &&
            (sync === 3 || item.sync === sync) &&
            fullName.includes(targetName)
        )}
        ));
        await setCustomerLength(20);
        await setTotalLength(originalData.filter(item =>{
            const fullName = `${item.first_name || ""}${item.last_name || ""}`;
            return(item.inquiry_date.includes(targetMonth) &&
            item.shop.includes(targetShop) &&
            item.response_medium.includes(targetMedium) &&
            (sync === 3 || item.sync === sync) &&
            fullName.includes(targetName)
        )}).length);
        };

    const handleNameSort = (nameValue) => {
        setTargetName(nameValue);

        const filtered = originalData.filter(item => {
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        return (
            item.inquiry_date.includes(targetMonth) &&
            item.shop.includes(targetShop) &&
            item.response_medium.includes(targetMedium) &&
            (sync === 3 || item.sync === sync) &&
            fullName.includes(nameValue)
            );
        });

        setInquiryUsers(filtered);
        setCustomerLength(20);
        setTotalLength(filtered.length);
    };

    const shopChange = async (event, id) => {
        const shopValue = event.target.value;
        if (shopValue === 'duplicate') {
            const userConfirmed = window.confirm('重複名簿でお間違いないでしょうか？');
            if (!userConfirmed) {
                return;
            }
        }
        const postData = {
            shop: shopValue,
            demand: 'shop',
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

    const staffChange = async (event, id) => {
        const staffValue = event.target.value;
        const postData = {
            staff: staffValue,
            demand: 'staff',
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

    const [isRotating, setIsRotating] = useState('');

    const sync =async ( id, firstNameValue, lastNameValue, shopValue, dateValue, mediumValue, firstNameKanaValue, lastNameKanaValue, mobileValue, landlineValue, mailValue, zipValue, prefValue, cityValue, townValue, streetValue, buildingValue, staffValue)=>{
        const formattedShopValue = shopValue.includes('2L') ? '2L鹿児島店' : shopValue;
        if ( !formattedShopValue.includes('店') || formattedShopValue.includes('店舗未設定') ) {
            alert('店舗が未選択です');
            return;
        };
        if (window.confirm(`${formattedShopValue} ${firstNameValue} ${lastNameValue}様 PG CLOUDと同期しますか?`)) {
            console.log("登録処理スタート");
            setIsRotating(id);
            const registerData = {
                id, id,
                staff: staffValue,
                firstName: firstNameValue,
                lastName: lastNameValue,
                firstKana: firstNameKanaValue,
                lastKana: lastNameKanaValue,
                shop: formattedShopValue,
                date: dateValue,
                mobile: mobileValue,
                landline: landlineValue,
                mail: mailValue,
                zip: zipValue,
                pref: prefValue,
                city: cityValue,
                town: townValue,
                street: streetValue,
                building: buildingValue,
                medium: mediumValue
            };

            console.log(registerData.id);

            let message;
            let pg_id;
            try {
                const response = await fetch("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/",{
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                        },
                    body: JSON.stringify(registerData)
                    });
                const result = await response.json();
                message = result.message;
                console.log(message);
            } catch (error) {
                console.error('リクエストエラー:', error)
            }
            } else {
                console.log("キャンセルされました。");
            }
    };

    const blackList = async(id, value) =>{
        const postData = {
            inquiry_id: id,
            demand: 'tag',
            black_list: value
        }

        try {
            const response = await fetch("/dashboard/api/changeShop.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData)
            });
            const data = await response.json();
            setInquiryUsers(data.filter( item => item.response_medium.includes(targetMedium) && item.inquiry_date.includes(targetMonth) && item.shop.includes(targetShop)));
            setOriginalData(data);
                } catch (error) {
            console.error("エラー:", error);
        }
    };

    const noteChange = async(e, id) =>{
        const noteValue = e.target.value;
        const postData = {
            inquiry_id: id,
            demand: 'note',
            note: noteValue
        }

        try {
            const response = await fetch("/dashboard/api/changeShop.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData)
            });
            const data = await response.json();
            setInquiryUsers(data.filter( item => item.response_medium.includes(targetMedium) && item.inquiry_date.includes(targetMonth) && item.shop.includes(targetShop)));
            setOriginalData(data);
                } catch (error) {
            console.error("エラー:", error);
        }
    };

  return (
    <div>

        
        <Menu brand={brand} />
        <div className="container bg-white pt-3 inquiry_ui position-relative">
            {/* <div className='position-absolute white-object'></div>
            <div className='position-absolute white-object side'></div> */}
            <div className='pb-3 row'>
                <div className="d-flex">
                    <select className="form-select campaign position-relative me-2" onChange={(event) =>changeMonth(event.target.value)}>
                        {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                            ))}
                    </select>
                    <select className="form-select campaign position-relative me-2" onChange={(event) =>handleShopSort(event.target.value)}>
                        <option value="" selected={ targetShop === ""}>全店舗表示</option>
                        {shop.map((value, index) => (<option key={index} value={value.shop} selected={value.shop === targetShop}>{value.shop}</option>
                            ))}
                    </select>
                    <select className="form-select campaign position-relative me-2" onChange={(event) =>handleMediumSort(event.target.value)}>
                        <option value="" selected={ targetMedium === ""}>全媒体</option>
                        {medium.filter( item => item.list_medium === 1).map((value, index) => (
                            <option key={index} value={value.medium} selected={value.medium === targetMedium}>{value.medium}</option>
                            ))}
                    </select>
                    <select className="form-select campaign position-relative me-2" onChange={(event) =>handleSyncSort(event.target.value)}>
                        <option value="3" selected={ targetSync === 3 }>全て</option>
                        <option value="0" selected={ targetSync === 0 }>未同期</option>
                        <option value="1" selected={ targetSync === 1 }>同期済み</option>
                    </select>
                    <input type="text" className='form-control' value={targetName} placeholder='氏名で検索' onChange={(event) =>handleNameSort(event.target.value)}/>
                </div>
            </div>
            <div className='p-0 inquiry'>
            <Table striped bordered hover className='inquiry_table'>
                <thead className='sticky-header' style={{ fontSize: "12px"}}> 
                    {/* className='sticky-header' でヘッダー固定*/}
                    <tr className='sticky-header'>
                        <th className="sticky-column bg-success text-white">店舗名</th>
                        { shop.filter(item => !item.shop.includes('未設定')).map((value, index)=>( <th key={index} className='text-center bg-success text-white'>{value.shop}</th>))}
                    </tr>
                </thead>
                <tbody style={{ fontSize: "12px"}}>
                    <tr>
                        <th className="sticky-column bg-warning text-white">                            
                            反響計<i className="fa-regular fa-square-plus plus-icon ps-2" onClick={mediumShow}></i><i className="fa-regular fa-square-minus minus-icon d-none ps-2" onClick={mediumHide}></i></th>
                         { shop.filter(item => !item.shop.includes('未設定')).map((value, index)=>{
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
                        { shop.filter(item => !item.shop.includes('未設定')).map((value, index)=>( <th key={index} className='text-center'>{ value.resister_goal}</th>))}
                    </tr>
                    <tr>
                        <th className="sticky-column bg-warning text-white">来場計</th>
                        { shop.filter(item => !item.shop.includes('未設定')).map((value, index)=>{
                            const count =  syncUsers.filter(item=>item.shop?.includes(value.shop) && item.register?.includes(targetMonth) && item.reserve!=="").length;
                            const goal = value.reserve_goal;
                            return(
                            <th key={index} className={`text-center ${count > goal ? 'text-primary' : 'text-danger'}`}>{count}</th>)})}
                    </tr>
                    <tr>
                        <td className="sticky-column bg-warning text-white">来場目標</td>
                        { shop.filter(item => !item.shop.includes('未設定')).map((value, index)=>( <td key={index} className='text-center'>{ value.reserve_goal}</td>))}
                    </tr>
                </tbody>
            </Table>
            <Table striped bordered hover className='inquiry_table bottom'>
                <thead style={{ fontSize: "12px"}}> 
                <tr className='sticky-header'>
                    <th className="sticky-column bg-success text-white">同期</th>
                    <th className="sticky-column bg-success text-white">店舗名</th>
                    <th className='bg-success text-white'>営業担当</th>
                    <th className='bg-success text-white'>反響日</th>
                    <th className='bg-success text-white'>反響<br></br>ブランド</th>
                    <th className='bg-success text-white'>反響経路</th>
                    <th className='bg-success text-white'>反響媒体</th>
                    <th className='bg-success text-white'>氏名</th>
                    <th className='bg-success text-white'>住所</th>
                    <th className='bg-success text-white'>詳細</th>
                    <th className='bg-success text-white'>予定地</th>
                    <th className='bg-success text-white'>顧客タグ</th>
                    <th className='bg-success text-white'>備考</th>
                </tr>
                </thead>
                <tbody style={{ fontSize: "12px"}}>
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
                    } else if(value.shop?.includes("JH")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white djh";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white djh px-3";
                    } else if(value.brand?.includes("KHG")){
                        shopColorCode = "shopSelect rounded-pill text-center text-white khg";
                        shopColorCodeEvent = "shopSelect rounded-pill text-center text-white khg px-3";
                    }
                    
                    return(
                    <tr className={value.sync === 1 ? 'table-primary' : null}>
                        <td className='sticky-column text-center' >{value.sync === 1 ?
                            <i className ="fa-solid fa-user-check sticky-column"></i> :
                            <i className={`fa-solid fa-arrows-rotate sticky-column pointer ${ isRotating === value.inquiry_id ? 'spinning' : '' }`}
                            onClick={()=>sync(
                                value.inquiry_id,
                                value.first_name,
                                value.last_name,
                                value.shop,
                                value.inquiry_date,
                                value.response_medium,
                                value.first_name_kana,
                                value.last_name_kana,
                                value.mobile,
                                value.landline,
                                value.mail,
                                value.zip,
                                value.pref,
                                value.city,
                                value.town,
                                value.street,
                                value.building,
                                value.staff)}></i>}</td>
                        <td className='sticky-column' key={index}>
                            { value.sync !== 1 ?  
                            <select className={shopColorCode} onChange={(event) => shopChange(event, value.inquiry_id)} >
                            { listShop.filter( item => item.brand === value.brand === "Nagomi" ? "なごみ" : value.brand ).map((shop, shopIndex) => {
                                let brand;
                                let formattedShopValue;
                                if ( value.brand === 'Nagomi' ){
                                    brand = 'なごみ';
                                } else{
                                    brand = value.brand;
                                }
                                const shopValue = !listShop.some( item => item.shop === value.shop ) ? `${brand}店舗未設定` : value.shop ;
                                if ( brand === '2L' ){
                                    formattedShopValue = '2L鹿児島店';
                                } else if ( brand === 'PGH' ){
                                    formattedShopValue = 'PG HOUSE宮崎店';
                                } else if ( brand === 'KHG' ){
                                    formattedShopValue = 'ブランド・店舗未設定';
                                } else {
                                    formattedShopValue = shopValue;
                                }
                                return(
                            <option key={shopIndex} selected={ shop.shop === formattedShopValue}>{ shop.shop }</option>)})}
                            <option value="duplicate">重複名簿</option>
                            </select>
                            : value.shop
                            }
                        </td>
                        <td key={index}>
                            { value.sync !== 1 ?
                            <select className={shopColorCode} onChange={(event) => staffChange(event, value.inquiry_id)}><option value ="">担当営業を選択</option>{
                             staffList.filter(item => item.category === 1 && item.shop?.includes(value.shop.includes('PGH') ? 'PG HOUSE宮崎店' : value.shop)).map((staff, staffIndex) =>(
                            <option key={staffIndex} selected={ staff.name === value.staff}>{staff.name}</option>))}</select>
                            : value.staff }
                            </td>
                        <td key={index}>{value.inquiry_date}</td>
                        <td key={index}>{value.brand}</td>
                        <td key={index}>{value.inquiry_id.includes("homepage") ? 'ホームページ' : `${value.medium}`}</td>
                        <td key={index}>{value.response_medium}</td>
                        <td key={index}>{value.pg_id ? <a href={value.pg_id} target='_blank'>{value.first_name} {value.last_name}</a> : `${value.first_name} ${value.last_name}`}</td>
                        <td key={index}>{value.pref}{value.city}{value.town}{value.street}{value.building}</td>
                        <td key={index}>{value.inquiry_id.includes("homepage") ? <span className={shopColorCodeEvent} style={{ whiteSpace: "nowrap"}}>{value.hp_campaign}
                            {value?.duplicate ? <br></br> : "" }
                        </span> : ""}
                        { value?.duplicate ? value.duplicate.split(',').map((item)=>{
                            const kh = "text-white kh rounded-pill duplicate";
                            const djh = "text-white djh rounded-pill duplicate";
                            const nagomi = "text-white nagomi rounded-pill duplicate";
                            const fh = "text-white fh rounded-pill duplicate";
                            const pgh = "text-white pgh rounded-pill duplicate";
                            const jh = "text-white djh rounded-pill duplicate";
                            const nieru = "text-white nieru rounded-pill duplicate";
                            const hotlead = "text-white kh hotlead rounded-pill duplicate";
                            let duplicateClass;
                            if ( item.includes('KH')){
                                duplicateClass = kh;
                            } else if ( item.includes('DJH')){
                                duplicateClass = djh;
                            } else if ( item.includes('なごみ')){
                                duplicateClass = nagomi;
                            } else if ( item.includes('FH')){
                                duplicateClass =fh;
                            } else if ( item.includes('PG')){
                                duplicateClass =pgh;
                            } else if ( item.includes('JH')){
                                duplicateClass =jh;
                            } else if ( item.includes('2L')){
                                duplicateClass = nieru;
                            } else if ( item.includes('ホットリード')){
                                duplicateClass = hotlead;
                            }
                            return(
                            <><span className={duplicateClass}>{item.includes('ホットリード') ? <a href={value.hotlead_url} target='_blank'>{item}</a> : item}</span><br></br></>)
                        }) 
                        : ""  }
                        </td>
                        <td key={index}>{value.area}</td>
                        <td key={index}>
                            <div className='d-flex'>
                                <div className={`bg-danger text-white rounded-pill px-2 me-2 tag ${value.black_list.split('gift').length % 2 === 0 ? 'checked' : ''}`} onClick={()=>blackList(value.inquiry_id, 'gift')}>ギフト券進呈済み</div>
                                <div className={`bg-warning text-white rounded-pill px-2 me-2 tag ${value.black_list.split('support').length % 2 === 0 ? 'checked' : ''}`} onClick={()=>blackList(value.inquiry_id, 'support')}>業者</div>
                                <div className={`bg-dark text-white rounded-pill px-2 me-2 tag ${value.black_list.split('black').length  % 2 === 0 ? 'checked' : ''}`} onClick={()=>blackList(value.inquiry_id, 'black')}>ブラックリスト</div>
                            </div>
                        </td>
                        <td key={index}><input type="text" className="form-control" style={{border: 'none', background: 'none'}} placeholder = {value.note} onBlur={(e)=>noteChange(e, value.inquiry_id)}/></td>
                    </tr>)})}
                    
                </tbody>

            </Table>
            <div className='d-flex justify-content-center'>
                { totalLength !== 0 && totalLength >= customerLength ? 
                <div className='btn bg-primary text-white px-5 rounded-pill' 
                onClick={() => setCustomerLength(customerLength + 20 )}>続きを表示</div> : null }
            </div>
            
            </div>
            
        </div>
    </div>
  )
}


export default ListTest

