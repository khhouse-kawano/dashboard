import { useNavigate } from 'react-router-dom';
import React ,{ useEffect, useRef, useState, useContext,  useMemo  } from 'react';
import Menu from './Menu.js';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import AuthContext from '../context/AuthContext.js';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Modal from 'react-bootstrap/Modal';

// import {inquiryListDev, shopList, inquiryShopList, mediumList, staffListDev, customerArray, achievementDev} from './contractUser.js'

type Shop = {brand: string; shop: string; section: string; area: string;}
type Medium = {id: number; medium: string; category: string; sort_key: number; response_medium: number; list_medium: number}
type InquiryCustomer = {id: number; inquiry_id: string; pg_id: string; mhl_id: string; inquiry_date: string; medium: string; response_medium: string; first_name: string; last_name: string;
    first_name_kana: string; last_name_kana: string; mobile: string; landline: string; mail: string; zip: string; pref: string; city: string; town: string; street: string;
    building: string; brand: string; shop: string; sync: number; staff: string; area: string; reserved_date: string; reserved_time: string; black_list: string; hp_campaign: string;
    delete_flag: number; duplicate: string; note: string; utm_source: string; utm_medium: string; utm_campaign: string; utm_term: string; utm_content: string; referrer: string; first_visit: string; hotlead_url: string;}
type Customer = { id: string; name: string; status: string; medium: string; rank: string; register: string; reserve: string; shop: string; estate: string; meeting: string;
    appointment: string; line_group: string; screening: string; rival: string; period: string; survey: string; budget: string; importance: string; note: string; staff: string; section: string; contract: string; sales_meeting: string; latest_date: string; last_meeting: string; }
type Staff = {id: number; name: string; pg_id: string; shop: string; mail: string; status: string; category: number;}
type Achievement = { id: number; date: string; shop: string; category: string; goal: number;}
type RegisterData = { id: string; staff: string; firstName: string; lastName: string; firstKana: string; lastKana: string; shop: string; date: string; mobile: string; landline: string; mail: string; zip: string; pref: string; city: string; town: string; street: string; building: string; medium: string; }
type Survey = { id: number; sync: number; brand: string; dateStr: string; name: string; considerationStart: string; desiredMoveIn: string; visitedCompanies: string; reasonForConsidering: string; reasonOther: string; futurePlan: string; futureOther: string; desiredSize: string; desiredLayout: string; priorityItem: string; expectedResidents: string; totalBudget: string; monthlyRepayment: string; annualIncome: string; yearsOfService: string; otherIncomePerson: string; otherAnnualIncome: string; ownFunds: string; otherLoans: string; thingsToDo: string; thingsToDoOther: string; housingType: string; housingTypeOther: string; landArea: string; referrerName: string; emailAddress: string; campaign: string};
type AfterSurvey = {  id: number;  dateStr: string;  name: string;  phone: string;  InterviewFeedback: string;  confirmedAllItems: string;  desireOwnership: string;  priorityCondition: string;  ourCompanyFirstChoice: string;  otherCompaniesInterested: string;  staffName: string;  staffHospitality: string;  proposalFeedback: string;  moreInfoOrImprovements: string;  nextConsultationRequests: string;  changeStaffRequested: string; };


const ListDev = () => {
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<InquiryCustomer[]>([]);
    const [inquiryList, setInquiryList] = useState<InquiryCustomer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetSync, setTargetSync] = useState<number | null>(null);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [targetShop, setTargetShop] = useState<string>('');
    const [totalLength, setTotalLength] = useState<number>(0);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [surveyBeforeList, setSurveyBeforeList] = useState<Survey[]>([]);
    const [originalAfterList, setOriginalAfterList] = useState<AfterSurvey[]>([]);
    const [surveyAfterList, setAfterSurveyList] = useState<AfterSurvey[]>([]);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [show, setShow] = useState(false);


    const getYearMonthArray = (startYear: number, startMonth: number) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const array: string[] = [];
        let year = startYear;
        let month = startMonth;
        while (year < currentYear || (year === currentYear && month <= currentMonth)) {
            array.push(`${year}/${String(month).padStart(2, '0')}`);
            month++;
        if (month > 12) { month = 1; year++; }
        }
        return array;
    };

    useEffect(() => {
        if (!brand || brand.trim() === "") {
            navigate("/");
            return;
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setMonthArray(getYearMonthArray(2025, 1));
        setSelectedMonth(`${year}/${month}`);

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerRes, shopRes, staffRes, mediumRes, inquiryRes, achieveRes, beforeSurveyRes] = await Promise.all([
                    axios.post("/dashboard/api/", { demand: "customer_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "inquiry_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "achievement_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "before_survey" }, { headers }),
                    ]);
                await setCustomerList(customerRes.data);
                await setShopArray(shopRes.data);
                await setStaffList(staffRes.data);
                await setMediumArray(mediumRes.data);
                await setOriginalList(inquiryRes.data);
                await setInquiryList(inquiryRes.data);
                await setAchievement(achieveRes.data);
                await setOriginalBeforeList(beforeSurveyRes.data);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    }, []);

    const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;
    const formattedShop = targetShop.includes('2L') ? '2L' : targetShop;

    const validShops = useMemo(() => shopArray.filter(shop =>
        !shop.shop.includes('未設定') &&
        !shop.shop.includes('FH') &&
        !shop.shop.includes('JH八代店')
    ), [shopArray]);

    const filteredInquiryList = useMemo(() => originalList.filter(item =>{
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        return(
            item.inquiry_date.includes(selectedMonth) &&
            (targetShop === '' || item.shop.includes(formattedShop)) &&
            (mediumValue === '' || item.response_medium === mediumValue) &&
            (targetSync === null || ( targetSync === 0 ? 
                ( item.sync === targetSync && (item.black_list.split('duplicate').length % 2 !== 0 && item.black_list.split('support').length % 2 !== 0 && item.black_list.split('black').length % 2 !== 0)) 
                : item.sync === targetSync || item.black_list.split('duplicate').length % 2 === 0 || item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 )) &&
            (targetName === '' || fullName.includes(targetName)))
    }), [originalList, selectedMonth, targetShop, mediumValue, targetSync, targetName]);

    const inquiryTotalArray = useMemo(() =>
        validShops.map(shop =>
            filteredInquiryList.filter(item => item.shop === shop.shop).length
    ), [filteredInquiryList, validShops]);

    const achievementArray = useMemo(() =>
        validShops.map(shop => {
            const record = achievement.find(item =>
            item.date.includes(selectedMonth) &&
            item.category === 'register' &&
            item.shop === shop.shop
        );
        return record?.goal ?? 0;
    }), [achievement, selectedMonth, validShops]);

    const reservedTotalArray = useMemo(() =>
        validShops.map(shop =>
            customerList.filter(item =>
                item.shop === shop.shop &&
                item.reserve.includes(selectedMonth) &&
                (formattedShop === '' || item.shop === formattedShop) &&
                (mediumValue === '' || item.medium === mediumValue)).length
    ), [customerList, selectedMonth, formattedShop, mediumValue, validShops]);

    const achievementReservedArray = useMemo(() =>
        validShops.map(shop => {
            const record = achievement.find(item =>item.date.includes(selectedMonth) && item.category === 'reserve' && item.shop === shop.shop);
        return record?.goal ?? 0;
    }), [achievement, selectedMonth, validShops]);

    useEffect(() => {
        setInquiryList(filteredInquiryList);
        setTotalLength(filteredInquiryList.length);
        setDisplayLength(20);
    }, [filteredInquiryList]);

    useEffect(() => {
        setSurveyBeforeList(filteredBeforeList);
    }, [originalBeforeList, selectedMonth])

    const filteredBeforeList = useMemo(() => {
        const filtered = originalBeforeList.filter(item => item.dateStr.includes(selectedMonth));
        return filtered;
    }, [originalBeforeList, selectedMonth])

    const [progress, setProgress] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const sync = async(idValue: string, firstNameValue: string, lastNameValue: string, shopValue: string, inquiryDateValue: string, mediumValue: string, firstNameKanaValue: string, lastNameKanaValue: string, 
        mobileValue: string, landlineValue: string, mailValue: string, zipValue: string, prefValue: string, cityValue: string, townValue: string, streetValue: string, buildingValue: string, staffValue: string
        ,surveyID: number, campaignValue: string) =>{
        const formattedShopValue = shopValue.includes('2L') ? '2L鹿児島店' : shopValue;
        const formattedMediumValue = mediumValue.includes('、') ? mediumValue.split('、')[0] : mediumValue;
        
        if ( !formattedShopValue.includes('店') || formattedShopValue.includes('店舗未設定') ) {
            alert('店舗が未選択です');
            return;
        };
        const targetData = surveyBeforeList.find(item => item.id == surveyID);

        const registerData = {
            id: idValue,
            staff: staffValue,
            firstName: firstNameValue,
            lastName: lastNameValue,
            firstKana: firstNameKanaValue,
            lastKana: lastNameKanaValue,
            shop: shopValue,
            date: inquiryDateValue,
            mobile: mobileValue,
            landline: landlineValue,
            mail: mailValue,
            zip: zipValue,
            pref: prefValue,
            city: cityValue,
            town: townValue,
            street: streetValue,
            building: buildingValue,
            medium: formattedMediumValue,
            note: surveyID !== 0 ? `反響経路:${campaignValue}／検討時期:${targetData?.considerationStart}\n入居希望時期:${targetData?.desiredMoveIn}／新築検討理由:${targetData?.reasonForConsidering} ${targetData?.reasonOther}\n今後の予定:${targetData?.futurePlan} ${targetData?.futureOther}／希望の広さ:${targetData?.desiredSize}／希望の間取り:${targetData?.desiredLayout}\n重視項目:${targetData?.priorityItem}／入居予定人数:${targetData?.expectedResidents}\n総予算:${targetData?.totalBudget}／返済額:${targetData?.monthlyRepayment}\n前年度の年収:${targetData?.annualIncome}／勤続年数:${targetData?.yearsOfService}\n年収がある方：${targetData?.otherIncomePerson}／年収がある方の年収:${targetData?.otherAnnualIncome}\n自己資金:${targetData?.ownFunds}／その他ローン:${targetData?.otherLoans}\n当日したいこと:${targetData?.thingsToDo} ${targetData?.thingsToDoOther}／新居の希望:${targetData?.housingType} ${targetData?.housingTypeOther}\n希望の土地エリア:${targetData?.landArea}／紹介者:${targetData?.referrerName}`
            :''
        };
        
        if (window.confirm(`${formattedShopValue} ${firstNameValue} ${lastNameValue}様 PG CLOUDと同期しますか?`)) {
            const fetchData = async (): Promise<InquiryCustomer[]> => {
            const response = await axios.post("/dashboard/api/", { demand: "inquiry_list" }, {
                headers: { Authorization: "4081Kokubu", "Content-Type": "application/json" }
            });
            setInquiryList(response.data);
            setOriginalList(response.data);
            return response.data;
            };

            await setIsSyncing(true);
            await setProgress(0);
            const duration = 40000;
            const interval = 200;
            const step = 100 / (duration / interval);

            let elapsed = 0;
            const maxTime = 40000;
            const checkInterval = 2000; // 2秒ごとに

            const timer = setInterval(async () => {
            const updatedList = await fetchData();
            const targetID = updatedList.find(item => item.inquiry_id === idValue)?.pg_id;

            if (targetID || elapsed >= maxTime) {
                clearInterval(timer);
                setProgress(100);
                alert('同期が完了しました。');
                setIsSyncing(false);
            } else {
                elapsed += checkInterval;
                const ratio = elapsed / maxTime;
                setProgress(ratio * 100);
            }
        }, checkInterval);
            console.log(registerData);
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
                console.error('リクエストエラー:', error);
                clearInterval(timer);
            }
            } else {
                console.log("キャンセルされました。");
            }
        };

    const syncRobo = async(idValue: string, staffValue: string, firstNameValue: string, lastNameValue: string, firstKanaValue: string, lastKanaValue: string, mobileValue: string , mailValue: string) =>{
        if ( staffValue === '' || staffValue.includes('管理') ){
            await alert ('スタッフが未選択です');
            return;
        }

        if (window.confirm(`${firstNameValue} ${lastNameValue}様 マイホームロボと同期しますか?`)) {
        const postData = {
            id: idValue,
            staff: staffValue,
            firstName: firstNameValue,
            lastName: lastNameValue,
            firstKana: firstKanaValue,
            lastKana: lastKanaValue,
            mobile: mobileValue,
            mail: mailValue
        }

        const fetchData = async (): Promise<InquiryCustomer[]> => {
            const response = await axios.post("/dashboard/api/", { demand: "inquiry_list" }, {
                headers: { Authorization: "4081Kokubu", "Content-Type": "application/json" }
            });
            setInquiryList(response.data);
            setOriginalList(response.data);
            return response.data;
            };

            await setIsSyncing(true);
            await setProgress(0);
            const duration = 40000;
            const interval = 200;
            const step = 100 / (duration / interval);

            let elapsed = 0;
            const maxTime = 40000;
            const checkInterval = 2000; // 2秒ごとに

            const timer = setInterval(async () => {
            const updatedList = await fetchData();
            const targetID = updatedList.find(item => item.inquiry_id === idValue)?.mhl_id;

            if (targetID || elapsed >= maxTime) {
                clearInterval(timer);
                setProgress(100);
                alert('同期が完了しました。');
                setIsSyncing(false);
            } else {
                elapsed += checkInterval;
                const ratio = elapsed / maxTime;
                setProgress(ratio * 100);
            }
        }, checkInterval);
            console.log(postData);
            let message;
            let pg_id;
            try {
                const response = await fetch("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/robo",{
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                        },
                        body: JSON.stringify(postData)
                    });
                const result = await response.json();
                message = result.message;
                console.log(message);
            } catch (error) {
                console.error('リクエストエラー:', error);
                clearInterval(timer);
            }
        };
    };

    const listChange = async (id: string, listValue: string, demandValue: string) => {
        const postData = {
            list: listValue,
            demand: demandValue,
            inquiry_id: id
        };

        try {
            const response = await axios.post('/dashboard/api/', postData, {
            headers: {
                Authorization: '4081Kokubu',
                'Content-Type': 'application/json'
                }
            });
            const data = response.data;
            setInquiryList(data);
            setOriginalList(data);
        } catch (error) {
            console.error('エラー:', error);
        }
    };

        const modalShow = async (idValue: number, campaignValue: string) => {
            const modalFilter = surveyBeforeList.find(item => item.id === idValue);
            if (modalFilter) {
                await setModalBeforeContent({
                    id: modalFilter.id,
                    sync: 0,
                    brand: modalFilter.brand,
                    dateStr: modalFilter.dateStr,
                    name: modalFilter.name,
                    considerationStart: modalFilter.considerationStart,
                    desiredMoveIn: modalFilter.desiredMoveIn,
                    visitedCompanies: modalFilter.visitedCompanies,
                    reasonForConsidering: modalFilter.reasonForConsidering,
                    reasonOther: modalFilter.reasonOther,
                    futurePlan: modalFilter.futurePlan,
                    futureOther: modalFilter.futureOther,
                    desiredSize: modalFilter.desiredSize,
                    desiredLayout: modalFilter.desiredLayout,
                    priorityItem: modalFilter.priorityItem,
                    expectedResidents: modalFilter.expectedResidents,
                    totalBudget: modalFilter.totalBudget,
                    monthlyRepayment: modalFilter.monthlyRepayment,
                    annualIncome: modalFilter.annualIncome,
                    yearsOfService: modalFilter.yearsOfService,
                    otherIncomePerson: modalFilter.otherIncomePerson,
                    otherAnnualIncome: modalFilter.otherAnnualIncome,
                    ownFunds: modalFilter.ownFunds,
                    otherLoans: modalFilter.otherLoans,
                    thingsToDo: modalFilter.thingsToDo,
                    thingsToDoOther: modalFilter.thingsToDoOther,
                    housingType: modalFilter.housingType,
                    housingTypeOther: modalFilter.housingTypeOther,
                    landArea: modalFilter.landArea,
                    referrerName: modalFilter.referrerName,
                    emailAddress: modalFilter.emailAddress,
                    campaign: campaignValue
                });
                await setShow(true);
            }
    }

    const modalClose = async () => {
        await setShow(false);
    };

    return(
        <div>
        {isSyncing && <div style={{ position: 'absolute', top: '30vh', width: '60vw', left: 'calc( 50% - 30vw)',zIndex: '2000', height: '220px', backgroundColor: 'white', boxShadow: '0px 5px 15px 0px rgba(0, 0, 0, 0.35)', padding: '80px 100px 100px'}}>
            <span>同期処理中</span>
            <ProgressBar now={progress} label={`${Math.round(progress)}%`} />
        </div>}
        <Menu brand='Master' />
            <div className='container bg-white py-3 mt-2'>
            <div className='pb-3 row'>
                <div className="d-flex">
                    <select className="form-select campaign position-relative me-2" onChange={(e)=> setSelectedMonth(e.target.value)}>
                        {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                            ))}
                    </select>
                    <select className="form-select campaign position-relative me-2" onChange={(e) => setTargetShop(e.target.value)}>
                        <option value =''>全店舗表示</option>
                            {shopArray.map( ( item, index) =>
                                <option key={index} value={item.shop}>{item.shop}</option>
                            )}
                    </select>
                    <select className="form-select campaign position-relative me-2" onChange={(e)=> setTargetMedium(e.target.value)}>
                        <option value =''>全媒体表示</option>
                            {mediumArray.map( ( item, index) =>
                                <option key={index} value={item.medium}>{item.medium}</option>
                            )}
                    </select>
                    <select className="form-select campaign position-relative me-2" onChange={(e) => {
                        const value = e.target.value;
                        setTargetSync(value === '' ? null : Number(value));
                        }}>
                        <option value="">全て</option>
                        <option value="1">同期済み</option>
                        <option value="0">未同期</option>
                    </select>
                    <input type="text" className='form-control' placeholder='氏名で検索' onChange={(e) => setTargetName(e.target.value)}/>
                </div>
            </div>
            <div className='p-0 inquiry'>
                <Table striped bordered hover className='inquiry_table'>
                    <thead className='sticky-header' style={{ fontSize: "12px"}}> 
                        <tr className='sticky-header' style={{textAlign: 'center'}}>
                            <th className="sticky-column">店舗名</th>
                            <th>グループ全体</th>
                            { shopArray.filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店')).map((value, index)=>( <th key={index} className='text-center'>{value.shop}</th>))}
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: "12px"}}>
                        <tr style={{textAlign: 'center'}}>
                            <td className="sticky-column">反響合計</td>
                            <td>{inquiryList.length}</td>
                            {inquiryTotalArray.map( value => <td>{value}</td>)}
                        </tr>
                        <tr style={{textAlign: 'center'}}>
                            <td className="sticky-column">反響目標</td>
                            <td>{achievementArray.reduce(( cur, acc) => cur + acc, 0)}</td>
                            {achievementArray.map( value => <td>{value}</td>)}
                        </tr>
                        <tr style={{textAlign: 'center'}}>
                            <td className="sticky-column">来場合計</td>
                            <td>{reservedTotalArray.reduce(( cur, acc) => cur + acc, 0)}</td>
                            {reservedTotalArray.map( value => <td>{value}</td>)}
                        </tr>
                        <tr style={{textAlign: 'center'}}>
                            <td className="sticky-column">来場目標</td>
                            <td>{achievementReservedArray.reduce(( cur, acc) => cur + acc, 0)}</td>
                            {achievementReservedArray.map( value => <td>{value}</td>)}
                        </tr>
                    </tbody>
                </Table>
                <Table striped bordered hover className='inquiry_table'>
                    <thead className='sticky-header' style={{ fontSize: "12px"}}> 
                        <tr className='sticky-header'>
                            <th style={{ width: '80px', textAlign: 'center'}}>PG CLOUD同期</th>
                            <th style={{ width: '90px', textAlign: 'center'}}>マイホームロボ同期</th>
                            <th style={{ width: '100px', textAlign: 'center'}}>事前アンケート</th>
                            <th style={{ width: '100px', textAlign: 'center'}}>店舗名</th>
                            <th style={{ width: '100px', textAlign: 'center'}}>担当営業</th>
                            <th style={{ width: '60px'}}>反響日</th>
                            <th style={{ width: '90px'}}>反響媒体</th>
                            <th style={{ width: '100px'}}>お客様名</th>
                            <th style={{ width: '300px'}}>住所</th>
                            <th style={{ width: '130px'}}>詳細</th>
                            <th style={{ width: '120px'}}>予定地</th>
                            <th style={{ width: '180px'}}>顧客タグ</th>
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: "12px"}}>
                        {inquiryList.slice(0, displayLength).map((item, index)=>{return(
                        <tr key={index} style={{ textAlign: 'left'}} className = {item.sync === 1 || item.black_list.split('duplicate').length % 2 === 0 || item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 ? 'table-primary' : ''}>
                            <td style={{textAlign: 'center'}}>
                                {item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 || item.shop.includes('重複') ? <i className="fa-solid fa-xmark"></i> :
                                item.sync === 1 ? <a href={item.pg_id} target='_blank' style={{textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '10px', cursor: 'pointer'}}>PG CLOUDへ移動</a> :
                                <i className='fa-solid fa-arrows-rotate sticky-column pointer'
                                onClick={()=>sync(
                                item.inquiry_id,
                                item.first_name,
                                item.last_name,
                                item.shop,
                                item.inquiry_date,
                                item.response_medium,
                                item.first_name_kana,
                                item.last_name_kana,
                                item.mobile,
                                item.landline,
                                item.mail,
                                item.zip,
                                item.pref,
                                item.city,
                                item.town,
                                item.street,
                                item.building,
                                item.staff,
                                surveyBeforeList.find(value => value.brand === item.brand && value.emailAddress === item.mail)?.id ?? 0,
                                item.hp_campaign
                            )}
                                ></i>
                                }
                            </td>
                            <td style={{textAlign: 'center'}}>{item.mhl_id !== "" ? <a href={item.mhl_id} target='_blank' style={{textDecoration: 'none', backgroundColor: 'red', padding: '3px 7px', color: '#fff', borderRadius: '10px', cursor: 'pointer'}}>マイホームロボへ移動</a> :
                            <i className='fa-solid fa-arrows-rotate sticky-column pointer'
                            onClick={()=>syncRobo(
                                item.inquiry_id,
                                item.staff,
                                item.first_name,
                                item.last_name,
                                item.first_name_kana,
                                item.last_name_kana,
                                item.mobile,
                                item.mail
                                )}
                                ></i>}</td>
                            <td style={{ textAlign: 'center' }}>{surveyBeforeList.find(value => value.brand === item.brand && value.emailAddress === item.mail)?.id ? (
                                <span style={{ textDecoration: 'none', backgroundColor: 'green', padding: '3px 12px', color: '#fff', borderRadius: '10px', cursor: 'pointer'}}
                                onClick={() =>modalShow( surveyBeforeList.find( value => value.brand === item.brand && value.emailAddress === item.mail)!.id, item.hp_campaign)}>回答内容を表示</span>) 
                                : ('-')}
                            </td>
                            <td style={{textAlign: 'center'}}>{(()=> {
                                let formattedValue: string;
                                if (item.shop.includes('PGH')){
                                    formattedValue = item.shop.replace('PGH', 'PG HOUSE');
                                } else if (item.shop.includes('2L')){
                                    formattedValue = '2L鹿児島店';
                                } else if (item.brand === 'KHG'){
                                    formattedValue = 'ブランド・店舗未設定';
                                } else if (!shopArray.some( value => value.shop === item.shop)){
                                    const formattedBrand = item.brand === 'Nagomi' ? 'なごみ' : item.brand;
                                    formattedValue = `${formattedBrand}店舗未設定`
                                } else {
                                    formattedValue = item.shop;
                                }
                                let styleClass: React.CSSProperties = {};
                                if (formattedValue.slice(0, 2) === 'KH'){
                                    styleClass = { backgroundColor: '#0f3675', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (formattedValue.slice(0, 3) === 'DJH'){
                                    styleClass = { backgroundColor: '#28aeba', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (formattedValue.slice(0, 3) === 'なごみ'){
                                    styleClass = { backgroundColor: '#956134', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (formattedValue.slice(0, 2) === '2L'){
                                    styleClass = { backgroundColor: '#0d9f6d', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (formattedValue.slice(0, 2) === 'JH'){
                                    styleClass = { backgroundColor: '#dc4235', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (formattedValue.slice(0, 2) === 'FH'){
                                    styleClass = { backgroundColor: '#cd3c33', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (formattedValue.slice(0, 2) === 'PG'){
                                    styleClass = { backgroundColor: '#000', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else{
                                    styleClass = { backgroundColor: 'grey', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                }
                                return(
                                    <>{item.sync === 1 ? item.shop : 
                                    <select style={styleClass} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'shop_change')}>
                                        { shopArray.map(( shopValue, shopIndex) =>
                                        <option key={shopIndex} selected={shopValue.shop === formattedValue} style={{backgroundColor: '#fff', color: '#000'}}>{shopValue.shop}</option>
                                        )}
                                    </select>}</>
                                );})()}</td>
                            <td style={{textAlign: 'center'}}>{(()=> {
                                let formattedValue: string;
                                if (item.shop.includes('PGH')){
                                    formattedValue = item.shop.replace('PGH', 'PG HOUSE');
                                } else if (item.shop.includes('2L')){
                                    formattedValue = '2L鹿児島店';
                                } else if (item.brand === 'KHG'){
                                    formattedValue = 'ブランド・店舗未設定';
                                } else if (!shopArray.some( value => value.shop === item.shop)){
                                    formattedValue = `${item.brand}店舗未設定`
                                } else {
                                    formattedValue = item.shop;
                                }
                                let styleClass: React.CSSProperties = {};
                                if (item.shop.slice(0, 2) === 'KH'){
                                    styleClass = { backgroundColor: '#0f3675', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (item.shop.slice(0, 3) === 'DJH'){
                                    styleClass = { backgroundColor: '#28aeba', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (item.shop.slice(0, 3) === 'なごみ'){
                                    styleClass = { backgroundColor: '#956134', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (item.shop.slice(0, 2) === '2L'){
                                    styleClass = { backgroundColor: '#0d9f6d', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (item.shop.slice(0, 2) === 'JH'){
                                    styleClass = { backgroundColor: '#dc4235', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (item.shop.slice(0, 2) === 'FH'){
                                    styleClass = { backgroundColor: '#cd3c33', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else if (item.shop.slice(0, 2) === 'PG'){
                                    styleClass = { backgroundColor: '#000', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                } else{
                                    styleClass = { backgroundColor: 'grey', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px', border: 'none', textAlign: 'center'}
                                }
                                return(
                                    <select style={styleClass} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'staff_change')}>
                                        <option value=''>担当営業を選択</option>
                                        { staffList.filter( staffValue => staffValue.shop === formattedValue).map(( staffValue, shopIndex) =>
                                        <option key={shopIndex} selected={staffValue.name === item.staff} style={{backgroundColor: '#fff', color: '#000'}}>{staffValue.name}</option>
                                        )}
                                    </select>
                                );})()}</td>
                            <td>{item.inquiry_date}</td>
                            <td>{item.response_medium}{ item.medium !== 'ホームページ反響' || <><br/><span style={{fontSize: '10px', fontWeight: 'bold'}}>（{item.hp_campaign}）</span></>}</td>
                            <td>{item.first_name}{item.last_name}</td>
                            <td>{item.pref}{item.city}{item.town}{item.street}{item.building}</td>                            
                            <td>{item.duplicate.split(',').map( value => {
                                let formattedValue: string;
                                if (value.includes('PGH')){
                                    formattedValue = value.replace('PGH', 'PG HOUSE');
                                } else{
                                    formattedValue = value;
                                }
                                let styleClass: React.CSSProperties = {};
                                if (formattedValue.slice(0, 2) === 'KH' || formattedValue.includes('ホットリード')){
                                    styleClass = { backgroundColor: '#0f3675', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                } else if (formattedValue.slice(0, 3) === 'DJH'){
                                    styleClass = { backgroundColor: '#28aeba', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                } else if (formattedValue.slice(0, 3) === 'なごみ'){
                                    styleClass = { backgroundColor: '#956134', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                } else if (formattedValue.slice(0, 2) === '2L'){
                                    styleClass = { backgroundColor: '#0d9f6d', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                } else if (formattedValue.slice(0, 2) === 'JH'){
                                    styleClass = { backgroundColor: '#dc4235', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                } else if (formattedValue.slice(0, 2) === 'FH'){
                                    styleClass = { backgroundColor: '#cd3c33', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                } else if (formattedValue.slice(0, 2) === 'PG'){
                                    styleClass = { backgroundColor: '#000', color: '#fff', padding: '2px 7px', fontSize: '11px', borderRadius: '10px'}
                                }
                                return(
                                    <><span style={styleClass}>{( formattedValue.includes('ホットリード') ? <a href={item.hotlead_url} target='_blank' style={{ color: '#fff'}}>#{formattedValue}</a> : formattedValue)}</span><br/>
                                    </>)})}</td>
                            <td>{item.area}</td>
                            <td>
                                <div className='d-flex'>
                                <div className={`bg-primary text-white rounded-pill px-2 me-2 tag ${item.black_list.split('duplicate').length % 2 === 0 ? 'checked' : ''}`} onClick={()=>listChange(item.inquiry_id, 'duplicate', 'tag')}>重複</div>
                                <div className={`bg-danger text-white rounded-pill px-2 me-2 tag ${item.black_list.split('gift').length % 2 === 0 ? 'checked' : ''}`} onClick={()=>listChange(item.inquiry_id, 'gift', 'tag')}>ギフト券進呈済み</div>
                                <div className={`bg-warning text-white rounded-pill px-2 me-2 tag ${item.black_list.split('support').length % 2 === 0 ? 'checked' : ''}`} onClick={()=>listChange(item.inquiry_id, 'support', 'tag')}>業者</div>
                                <div className={`bg-dark text-white rounded-pill px-2 me-2 tag ${item.black_list.split('black').length  % 2 === 0 ? 'checked' : ''}`} onClick={()=>listChange(item.inquiry_id, 'black', 'tag')}>ブラックリスト</div>
                            </div>
                            </td>
                        </tr>);})}
                    </tbody>
                </Table>
                {totalLength <= displayLength ? null :
                <div style={{textAlign: 'center', paddingBottom: '10px'}}>
                    <span style={{backgroundColor: '#0f3675', color: '#fff', fontSize: '12px', padding: '5px 12px', borderRadius: '10px', cursor: 'pointer'}}
                        onClick={() => setDisplayLength(displayLength + 20)}>
                            {totalLength - displayLength > 19 ? `${displayLength + 20}件を表示/${totalLength}件中` : `${ totalLength - displayLength + ( 20 * ( displayLength / 20 ) )}件を表示/${totalLength}件中`}
                    </span>
                </div>}
            </div>
            </div>
            <Modal show={show} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>アンケート詳細</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table striped>
                            <tbody>
                                <tr style={{ fontSize: '13px' }}>
                                    <td style={{ width: '25%' }}>受信日</td>
                                    <td style={{ width: '25%' }}>顧客名</td>
                                    <td style={{ width: '25%' }}>ブランド</td>
                                    <td style={{ width: '25%' }}>反響経路</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.dateStr ? modalBeforeContent.dateStr : '-'}</th>
                                    <th>{modalBeforeContent?.name ? modalBeforeContent.name : '-'}</th>
                                    <th>{modalBeforeContent?.brand ? modalBeforeContent.brand : '-'}</th>
                                    <th>{modalBeforeContent?.campaign ? modalBeforeContent.campaign : '-'}</th>
                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>検討時期</td>
                                    <td>入居希望時期</td>
                                    <td>住宅会社訪問数</td>
                                    <td>新築検討理由</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.considerationStart ? modalBeforeContent.considerationStart : '-'}</th>
                                    <th>{modalBeforeContent?.desiredMoveIn ? modalBeforeContent.desiredMoveIn : '-'}</th>
                                    <th>{modalBeforeContent?.visitedCompanies ? modalBeforeContent.visitedCompanies : '-'}</th>
                                    <th>{modalBeforeContent?.reasonForConsidering ? modalBeforeContent.reasonForConsidering : '-'}</th>

                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>その他の検討理由</td>
                                    <td>今後の行動予定</td>
                                    <td>その他の行動予定</td>
                                    <td>希望の広さ</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.reasonOther ? modalBeforeContent.reasonOther : '-'}</th>
                                    <th>{modalBeforeContent?.futurePlan ? modalBeforeContent.futurePlan : '-'}</th>
                                    <th>{modalBeforeContent?.futureOther ? modalBeforeContent.futureOther : '-'}</th>
                                    <th>{modalBeforeContent?.desiredSize ? modalBeforeContent.desiredSize : '-'}</th>

                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>希望の間取り</td>
                                    <td>重視項目</td>
                                    <td>入居予定人数</td>
                                    <td>総予算</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.desiredLayout ? modalBeforeContent.desiredLayout : '-'}</th>
                                    <th>{modalBeforeContent?.priorityItem ? modalBeforeContent.priorityItem : '-'}</th>
                                    <th>{modalBeforeContent?.expectedResidents ? modalBeforeContent.expectedResidents : '-'}</th>
                                    <th>{modalBeforeContent?.totalBudget ? modalBeforeContent.totalBudget : '-'}</th>
                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>返済額</td>
                                    <td>前年度の年収</td>
                                    <td>勤続年数</td>
                                    <td>年収がある方</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.monthlyRepayment ? modalBeforeContent.monthlyRepayment : '-'}</th>
                                    <th>{modalBeforeContent?.annualIncome ? modalBeforeContent.annualIncome : '-'}</th>
                                    <th>{modalBeforeContent?.yearsOfService ? modalBeforeContent.yearsOfService : '-'}</th>
                                    <th>{modalBeforeContent?.otherIncomePerson ? modalBeforeContent.otherIncomePerson : '-'}</th>
                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>年収がある方の年収</td>
                                    <td>自己資金の支払予定</td>
                                    <td>その他ローン</td>
                                    <td>当日したいこと</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.otherAnnualIncome ? modalBeforeContent.otherAnnualIncome : '-'}</th>
                                    <th>{modalBeforeContent?.ownFunds ? modalBeforeContent.ownFunds : '-'}</th>
                                    <th>{modalBeforeContent?.otherLoans ? modalBeforeContent.otherLoans : '-'}</th>
                                    <th>{modalBeforeContent?.thingsToDo ? modalBeforeContent.thingsToDo : '-'}</th>
                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>その他当日したいこと</td>
                                    <td>新居の希望</td>
                                    <td>その他の希望</td>
                                    <td>希望の土地エリア</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.thingsToDoOther ? modalBeforeContent.thingsToDoOther : '-'}</th>
                                    <th>{modalBeforeContent?.housingType ? modalBeforeContent.housingType : '-'}</th>
                                    <th>{modalBeforeContent?.housingTypeOther ? modalBeforeContent.housingTypeOther : '-'}</th>
                                    <th>{modalBeforeContent?.landArea ? modalBeforeContent.landArea : '-'}</th>
                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>紹介者様</td>
                                    <td>メールアドレス</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalBeforeContent?.referrerName ? modalBeforeContent.referrerName : '-'}</th>
                                    <th>{modalBeforeContent?.emailAddress ? modalBeforeContent.emailAddress : '-'}</th>
                                    <th></th>
                                    <th></th>
                                </tr>
                            </tbody> 

                    </Table>
                </Modal.Body>
            </Modal>
        </div>
    )
}
export default ListDev;
