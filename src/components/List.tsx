import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState, useContext, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Modal from 'react-bootstrap/Modal';
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { headers } from '../utils/headers';
import { baseURL } from '../utils/baseURL';
import { shopFormate } from '../utils/shopFormate';
import { setStyleClass } from '../utils/setStyleClass';
import { mediumFormate } from '../utils/mediumFormate';
import InformationEdit from './InformationEdit';
import { generateULID } from '../utils/createULID';

type Shop = { brand: string, shop: string, section: string, area: string };

type Medium = { id: number, medium: string, category: string, sort_key: number, response_medium: number, list_medium: number };

type InquiryCustomer = {
    id: number, inquiry_id: string, pg_id: string, inquiry_date: string, medium: string, response_medium: string, first_name: string, last_name: string,
    first_name_kana: string, last_name_kana: string, mobile: string, landline: string, mail: string, zip: string, pref: string, city: string, town: string, street: string,
    building: string, brand: string, shop: string, sync: number, staff: string, area: string, reserved_date: string, black_list: string, hp_campaign: string,
    duplicate: string, hotlead_url: string,
};

type Customer = {
    id: string, name: string, status: string, medium: string, rank: string, register: string, reserve: string, shop: string, estate: string, meeting: string,
    appointment: string, line_group: string, screening: string, rival: string, period: string, survey: string, budget: string, importance: string, note: string, staff: string, section: string, contract: string, sales_meeting: string, latest_date: string, last_meeting: string,
};

type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, robo_id: string };

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };


const ListDev = () => {
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<InquiryCustomer[]>([]);
    const [inquiryList, setInquiryList] = useState<InquiryCustomer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [targetSync, setTargetSync] = useState<number | null>(null);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetShop, setTargetShop] = useState<string>('');
    const [totalLength, setTotalLength] = useState<number>(0);
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [surveyBeforeList, setSurveyBeforeList] = useState<Survey[]>([]);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [show, setShow] = useState(false);
    const [open, setOpen] = useState(false);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
    const [editId, setEditId] = useState('');

    const formate = (date: string) => {
        return date.replace(/-/g, '/').slice(0, 7);
    }

    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setMonthArray(getYearMonthArray(2025, 1));
        setStartMonth(`${year}/${month}`);
        setEndMonth(`${year}/${month}`);
        setSelectedMonth([`${year}/${month}`]);

        const fetchData = async () => {
            try {
                const [customerRes, shopRes, staffRes, mediumRes, inquiryRes, beforeSurveyRes] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_summary" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "inquiry_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "before_survey" }, { headers }),
                ]);
                await setCustomerList(customerRes.data);
                await setShopArray(shopRes.data);
                await setStaffList(staffRes.data);
                await setMediumArray(mediumRes.data.filter(m => m.list_medium === 1));
                await setOriginalList(inquiryRes.data);
                await setInquiryList(inquiryRes.data);
                await setOriginalBeforeList(beforeSurveyRes.data);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? monthArray.indexOf(endMonth) : monthArray.length - 1;
        const filteredMonth = monthArray.slice(startIndex, endIndex + 1);
        setSelectedMonth(filteredMonth);
    }, [startMonth, endMonth]);

    const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;
    const formattedShop = targetShop.includes('2L') ? '2L' : targetShop;

    const isSync = (list: InquiryCustomer, value: string) => {
        return list.black_list.split(value).length % 2 !== 0
    };

    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        const fullAddress = `${item.pref || ""}${item.city || ""}${item.town || ""}${item.street || ""}${item.building || ""}`;
        return (
            selectedMonth.includes(formate(item.inquiry_date)) &&
            (targetShop === '' || item.shop.includes(formattedShop)) &&
            (mediumValue === '' || item.response_medium === mediumValue) &&
            (targetSync === null || (targetSync === 0 ?
                (item.sync === targetSync && (isSync(item, 'duplicate') && isSync(item, 'support') && isSync(item, 'black')))
                : item.sync === targetSync || !isSync(item, 'duplicate') || !isSync(item, 'support') || !isSync(item, 'black'))) &&
            (targetName === '' || fullName.includes(targetName)) &&
            (targetAddress === '' || fullAddress.includes(targetAddress)))
    }), [originalList, selectedMonth, targetShop, mediumValue, targetSync, targetName, targetAddress]);

    useEffect(() => {
        setInquiryList(filteredInquiryList);
        setTotalLength(filteredInquiryList.length);
        setDisplayLength(20);
    }, [filteredInquiryList]);

    useEffect(() => {
        setSurveyBeforeList(filteredBeforeList);
    }, [originalBeforeList, selectedMonth]);

    const filteredBeforeList = useMemo(() => {
        const filtered = originalBeforeList.filter(item => selectedMonth.includes(formate(item.dateStr)));
        return filtered;
    }, [originalBeforeList, selectedMonth]);

    const [progress, setProgress] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async (idValue: string) => {
        const filteredCustomer = inquiryList.find(i => i.inquiry_id === idValue);
        const filteredShop = shopFormate(filteredCustomer?.shop ?? '', filteredCustomer?.brand ?? '', shopArray);
        const filteredMedium = filteredCustomer ? mediumFormate(filteredCustomer?.medium) : '';
        const brandValue = filteredCustomer?.brand ?? '';
        const mailValue = filteredCustomer?.mail ?? '';
        const surveyID = surveyBeforeList.find(s => s.brand === brandValue && s.emailAddress === mailValue)?.id ?? '0';
        const targetData = surveyBeforeList.find(item => item.id === surveyID);

        if (!idValue || !filteredCustomer || filteredShop.includes('店舗未設定')) {
            alert(`同期に失敗しました。${filteredShop.includes('店舗未設定') ? ' ※店舗が未選択' : ''}`);
            return;
        }

        const staffIdValue = staffList.find(s => s.name === filteredCustomer.staff && s.shop === filteredShop)?.pg_id ?? '';

        const registerData = {
            id: idValue,
            staff: filteredCustomer.staff ?? '',
            firstName: filteredCustomer.first_name,
            lastName: filteredCustomer.last_name,
            firstKana: filteredCustomer.first_name_kana,
            lastKana: filteredCustomer.last_name_kana,
            shop: filteredShop,
            date: filteredCustomer.inquiry_date,
            mobile: filteredCustomer.mobile,
            landline: filteredCustomer.landline,
            mail: mailValue,
            zip: filteredCustomer.zip,
            pref: filteredCustomer.pref,
            city: filteredCustomer.city,
            town: filteredCustomer.town,
            street: filteredCustomer.street,
            building: filteredCustomer.building,
            medium: filteredMedium,
            note: targetData ? `反響経路:${filteredCustomer.hp_campaign}／検討時期:${targetData?.considerationStart}\n入居希望時期:${targetData?.desiredMoveIn}／新築検討理由:${targetData?.reasonForConsidering} ${targetData?.reasonOther}\n今後の予定:${targetData?.futurePlan} ${targetData?.futureOther}／希望の広さ:${targetData?.desiredSize}／希望の間取り:${targetData?.desiredLayout}\n重視項目:${targetData?.priorityItem}／入居予定人数:${targetData?.expectedResidents}\n総予算:${targetData?.totalBudget}／返済額:${targetData?.monthlyRepayment}\n前年度の年収:${targetData?.annualIncome}／勤続年数:${targetData?.yearsOfService}\n年収がある方：${targetData?.otherIncomePerson}／年収がある方の年収:${targetData?.otherAnnualIncome}\n自己資金:${targetData?.ownFunds}／その他ローン:${targetData?.otherLoans}\n当日したいこと:${targetData?.thingsToDo} ${targetData?.thingsToDoOther}／新居の希望:${targetData?.housingType} ${targetData?.housingTypeOther}\n希望の土地エリア:${targetData?.landArea}／紹介者:${targetData?.referrerName}`
                : '',
            reserved_status: filteredCustomer.reserved_date,
            response_status: filteredCustomer.response_medium,
            campaign: filteredCustomer.hp_campaign,
            staffId: staffIdValue
        };

        if (window.confirm(`${filteredShop} ${filteredCustomer.first_name} ${filteredCustomer.last_name}様 顧客情報を取り込みますか?`)) {
            const brands = {
                'KH': '国分ハウジング',
                'DJ': 'デイジャストハウス',
                'なご': 'なごみ工務店',
                '2L': 'ニーエルホーム',
                'JH': 'ジャスフィーホーム',
                'FH': 'フルコミホーム',
                'PG': 'PG HOUSE'
            };

            const brandValue = brands[filteredShop.slice(0, 2)];
            const postData = {
                id: generateULID(),
                inquiry_id: filteredCustomer.inquiry_id,
                in_charge_user: filteredCustomer.staff ? filteredCustomer.staff : `${filteredShop} 管理`,
                customer_contacts_name: `${filteredCustomer.first_name} ${filteredCustomer.last_name}`,
                customer_contacts_name_kana: `${filteredCustomer.first_name_kana} ${filteredCustomer.last_name_kana}`,
                in_charge_store: filteredShop,
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: filteredCustomer.inquiry_date,
                customer_contacts_mobile_phone_number: filteredCustomer.mobile,
                customer_contacts_phone_number: filteredCustomer.landline,
                customer_contacts_email: mailValue,
                postal_code: filteredCustomer.zip,
                full_address: `${filteredCustomer.pref} ${filteredCustomer.city} ${filteredCustomer.town} ${filteredCustomer.street} ${filteredCustomer.building}`,
                sales_promotion_name: filteredCustomer.response_medium,
                remarks: targetData ? `反響経路:${filteredCustomer.hp_campaign}／検討時期:${targetData?.considerationStart}\n入居希望時期:${targetData?.desiredMoveIn}／新築検討理由:${targetData?.reasonForConsidering} ${targetData?.reasonOther}\n今後の予定:${targetData?.futurePlan} ${targetData?.futureOther}／希望の広さ:${targetData?.desiredSize}／希望の間取り:${targetData?.desiredLayout}\n重視項目:${targetData?.priorityItem}／入居予定人数:${targetData?.expectedResidents}\n総予算:${targetData?.totalBudget}／返済額:${targetData?.monthlyRepayment}\n前年度の年収:${targetData?.annualIncome}／勤続年数:${targetData?.yearsOfService}\n年収がある方：${targetData?.otherIncomePerson}／年収がある方の年収:${targetData?.otherAnnualIncome}\n自己資金:${targetData?.ownFunds}／その他ローン:${targetData?.otherLoans}\n当日したいこと:${targetData?.thingsToDo} ${targetData?.thingsToDoOther}／新居の希望:${targetData?.housingType} ${targetData?.housingTypeOther}\n希望の土地エリア:${targetData?.landArea}／紹介者:${targetData?.referrerName}`
                    : '',
                reserved_interview: filteredCustomer.reserved_date,
                response_status: filteredMedium,
                hp_campaign: filteredCustomer.hp_campaign,
                status: '見込み',
                planned_construction_site: filteredCustomer.area,
                request: 'insert_customer',
                section: shopArray.find(s => s.shop === filteredShop)?.section ?? '',
                brand: brandValue,

            };

            console.log(postData);

            try {
                await axios.post("https://khg-marketing.info/survey/api/", postData, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }


            const fetchData = async () => {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "inquiry_list" }, { headers });
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

                if (targetID) {
                    clearInterval(timer);

                    setOriginalList(updatedList);
                    setProgress(100);
                    alert('同期が完了しました。');
                    setIsSyncing(false);
                } else if (elapsed >= maxTime) {
                    clearInterval(timer);
                    setProgress(100);
                    alert('同期に失敗しました。');
                    setIsSyncing(false);
                } else {
                    elapsed += checkInterval;
                    const ratio = elapsed / maxTime;
                    setProgress(ratio * 100);
                }
            }, checkInterval);
            try {
                const response = await axios.post(`${baseURL}/api/`, registerData, { headers });
                console.log(response.data);
            } catch (error) {
                console.error('リクエストエラー:', error);
                clearInterval(timer);
            }
        } else {
            console.log("キャンセルされました。");
        }
    };

    const listChange = async (id: string, listValue: string, demandValue: string) => {
        const postData = {
            list: listValue,
            demand: demandValue,
            inquiry_id: id
        };

        const keyMap = {
            shop_change: 'shop',
            staff_change: 'staff',
            tag: 'black_list',
        } as const;

        const updated = inquiryList.map(item => {
            if (item.inquiry_id !== id) return item;
            const key = keyMap[demandValue];
            if (demandValue === 'tag') {
                return {
                    ...item,
                    [key]: `${item[key]} ${listValue}`.trim(),
                };
            }
            return {
                ...item,
                [key]: listValue,
            };
        });

        setInquiryList(updated);

        try {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, {
                headers: {
                    Authorization: '4081Kokubu',
                    'Content-Type': 'application/json'
                }
            });
            if (response.data.length === 0) {
                alert('処理に失敗しました。');
                return;
            }
            // setInquiryList(response.data);
        } catch (error) {
            console.error('エラー:', error);
        }
    };

    const [modalContent, setModalContent] = useState<string>('');

    const modalShow = async (request: string, idValue: number, campaignValue: string) => {
        if (request === 'beforeSurvey') {
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
    };

    const modalClose = async () => {
        await setShow(false);
    };

    const inquiryFilter = (shopValue: string) => {
        return inquiryList.filter(c => (shopValue ? c.shop === shopValue : true) && selectedMonth.includes(formate(c.inquiry_date))).length;
    };

    const achievementFilter = (shopValue: string, value: number) => {
        return staffList.filter(s => s.category === 1 && (shopValue ? s.shop === shopValue : true)).length * value;
    };

    const reserveFilter = (shopValue: string) => {
        return customerList.filter(c => (shopValue ? c.shop == shopValue : true) && selectedMonth.includes(formate(c.reserve))).length;
    };

    const closeInformationEdit = () => setEditId('');
    return (
        <>
            <div>
                {isSyncing && <div style={{ position: 'absolute', top: '30vh', width: '60vw', left: 'calc( 50% - 30vw)', zIndex: '2000', height: '220px', backgroundColor: 'white', boxShadow: '0px 5px 15px 0px rgba(0, 0, 0, 0.35)', padding: '80px 100px 100px' }}>
                    <span>同期処理中</span>
                    <ProgressBar now={progress} label={`${Math.round(progress)}%`} />
                </div>}
                <div className="d-flex">
                    <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} />
                    </div>
                    <div className="header_sp">
                        <i className="fa-solid fa-bars hamburger"
                            onClick={() => setOpen(true)} />
                    </div>
                    <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                        <i className="fa-solid fa-xmark hamburger position-absolute"
                            onClick={() => setOpen(false)} />
                        <MenuDev brand={brand} />
                    </div>                <div className='content database bg-white p-2'>
                        <div className="d-flex flex-wrap mb-3 align-items-center">
                            <div className="m-1">
                                <select className="target" onChange={(e) => setStartMonth(e.target.value)} style={{ fontSize: '13px' }}>
                                    {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div>~</div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setEndMonth(e.target.value)} style={{ fontSize: '13px' }}>
                                    {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setTargetShop(e.target.value)} style={{ fontSize: '13px' }}>
                                    <option value=''>全店舗表示</option>
                                    {shopArray.map((item, index) =>
                                        <option key={index} value={item.shop}>{item.shop}</option>
                                    )}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setTargetMedium(e.target.value)} style={{ fontSize: '13px' }}>
                                    <option value=''>全媒体表示</option>
                                    {mediumArray.map((item, index) =>
                                        <option key={index} value={item.medium}>{item.medium}</option>
                                    )}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    const value = e.target.value;
                                    setTargetSync(value === '' ? null : Number(value));
                                }} style={{ fontSize: '13px' }}>
                                    <option value="">顧客取込状況</option>
                                    <option value="1">同期済み</option>
                                    <option value="0">未同期</option>
                                </select>
                            </div>
                            <div className="m-1">
                                <input type="text" className='target' placeholder='氏名で検索' onChange={(e) => setTargetName(e.target.value)} style={{ fontSize: '13px' }} />
                            </div>
                            <div className="m-1">
                                <input type="text" className='target' placeholder='住所で検索' onChange={(e) => setTargetAddress(e.target.value)} style={{ fontSize: '13px' }} />
                            </div>
                            <div className="bg-primary text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                                onClick={() => setEditId('new')}>新規登録</div>
                        </div>
                        <div className='p-0 inquiry'>
                            <Table striped bordered hover className='inquiry_table'>
                                <thead className='sticky-header' style={{ fontSize: "10px" }}>
                                    <tr className='sticky-header' style={{ textAlign: 'center' }}>
                                        <td className="sticky-column" style={{ width: '100px' }}>店舗名</td>
                                        <td style={{ width: '100px' }}>グループ全体</td>
                                        {shopArray.filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店')).map((value, index) => (<td key={index} className='text-center' style={{ width: '90px' }}>{value.shop.replace('店', '')}</td>))}
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: "12px" }}>
                                    {['反響合計', '反響目標', '来場合計', '来場目標'].map((category, cIndex) => <tr key={cIndex} className='text-center'>
                                        <td className="sticky-column">{category}</td>
                                        {[{ brand: '', shop: 'グループ全体', section: '', area: '' }, ...shopArray].filter(item => !item.shop.includes('未設定') && !item.shop.includes('FH') && !item.shop.includes('JH八代店'))
                                            .map((value, sIndex) => {
                                                let totalValue;
                                                if (cIndex === 0) {
                                                    totalValue = inquiryFilter(sIndex === 0 ? '' : value.shop);
                                                } else if (cIndex === 1 || cIndex === 3) {
                                                    totalValue = achievementFilter(sIndex === 0 ? '' : value.shop, cIndex === 1 ? 8 : 4);
                                                } else {
                                                    totalValue = reserveFilter(sIndex === 0 ? '' : value.shop);
                                                }
                                                return <td key={sIndex} className='text-center' style={{ width: '90px' }}>{totalValue}</td>
                                            })}
                                    </tr>
                                    )}
                                </tbody>
                            </Table>
                            <Table striped bordered hover className='inquiry_table'>
                                <thead className='sticky-header' style={{ fontSize: "12px" }}>
                                    <tr className='sticky-header'>
                                        <td style={{ width: '50px', textAlign: 'center' }}>顧客取込</td>
                                        <td style={{ width: '60px', textAlign: 'center' }}>事前アンケート</td>
                                        <td style={{ width: '80px', textAlign: 'center' }}>店舗名</td>
                                        <td style={{ width: '80px', textAlign: 'center' }}>担当営業</td>
                                        <td style={{ width: '40px' }}>反響日</td>
                                        <td style={{ width: '90px' }}>反響媒体</td>
                                        <td style={{ width: '80px' }}>お客様名</td>
                                        <td style={{ width: '200px' }}>住所</td>
                                        <td style={{ width: '130px' }}>詳細</td>
                                        <td style={{ width: '120px' }}>予定地</td>
                                        <td style={{ width: '200px' }}>顧客タグ</td>
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: "12px" }}>
                                    {inquiryList.slice(0, displayLength).map((item, index) => {
                                        const formattedValue = shopFormate(item.shop, item.brand, shopArray) ?? '';
                                        const styleClass = setStyleClass(item.shop);
                                        return (
                                            <tr key={index} style={{ textAlign: 'left' }} className={item.sync === 1 || item.black_list.split('duplicate').length % 2 === 0 || item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 ? 'table-primary align-middle' : 'align-middle'}>
                                                <td style={{ textAlign: 'center' }}>
                                                    {item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0 || item.shop.includes('重複') ? <i className="fa-solid fa-xmark"></i> :
                                                        item.sync === 1 ? <span style={{ textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                            onClick={() => item.pg_id.length === 26 ? setEditId(item.pg_id): null}><i className="fa-solid fa-up-right-from-square"></i></span> :
                                                            <i className='fa-solid fa-arrows-rotate sticky-column pointer'
                                                                onClick={() => handleSync(item.inquiry_id)}
                                                            ></i>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{surveyBeforeList.find(value => value.brand === item.brand && value.emailAddress === item.mail)?.id ? (
                                                    <span style={{ textDecoration: 'none', backgroundColor: 'green', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            setModalContent('beforeSurvey');
                                                            modalShow('beforeSurvey', surveyBeforeList.find(value => value.brand === item.brand && value.emailAddress === item.mail)!.id, item.hp_campaign);
                                                        }}><i className="fa-solid fa-magnifying-glass-plus"></i></span>)
                                                    : ('-')}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{(() => {
                                                    const formattedShops = shopArray.map(item => ({
                                                        ...item,
                                                        shop: shopFormate(item.shop, item.brand, shopArray) ?? ''
                                                    }))
                                                    return (
                                                        <>{item.sync === 1 ? item.shop :
                                                            <select style={styleClass} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'shop_change')}>
                                                                {formattedShops.map((shopValue, shopIndex) => {
                                                                    return (
                                                                        <option key={shopIndex} selected={shopValue.shop === formattedValue} style={{ backgroundColor: '#fff', color: '#000' }}>{shopValue.shop}</option>
                                                                    )
                                                                }
                                                                )}
                                                            </select>}</>
                                                    );
                                                })()}</td>
                                                <td style={{ textAlign: 'center' }}>{(() => {
                                                    return (
                                                        <select style={styleClass} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'staff_change')}>
                                                            <option value=''>担当営業を選択</option>
                                                            {staffList.filter(staffValue => staffValue.shop === formattedValue && staffValue.category === 1).map((staffValue, shopIndex) =>
                                                                <option key={shopIndex} selected={staffValue.name === item.staff} style={{ backgroundColor: '#fff', color: '#000' }}>{staffValue.name}</option>
                                                            )}
                                                        </select>
                                                    );
                                                })()}</td>
                                                <td>{item.inquiry_date}</td>
                                                <td>{item.response_medium}{item.medium !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign}）</span></>}</td>
                                                <td>{item.first_name}{item.last_name}</td>
                                                <td>{item.pref}{item.city}{item.town}{item.street}{item.building}</td>
                                                <td>{item.duplicate && item.duplicate.split(',').map(value => {
                                                    return (
                                                        <div style={styleClass} className='mb-1'>{(formattedValue.includes('ホットリード') ? <a href={item.hotlead_url} target='_blank' style={{ color: '#fff' }}>#{value}</a> : value)}</div>
                                                    )
                                                })}</td>
                                                <td>{item.area}</td>
                                                <td>
                                                    <div className='d-flex'>
                                                        <div className={`bg-primary text-white rounded-pill px-2 me-2 tag ${item.black_list.split('duplicate').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'duplicate', 'tag')}>重複</div>
                                                        <div className={`bg-danger text-white rounded-pill px-2 me-2 tag ${item.black_list.split('gift').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'gift', 'tag')}>ギフト券進呈済み</div>
                                                        <div className={`bg-warning text-white rounded-pill px-2 me-2 tag ${item.black_list.split('support').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'support', 'tag')}>業者</div>
                                                        <div className={`bg-dark text-white rounded-pill px-2 me-2 tag ${item.black_list.split('black').length % 2 === 0 ? 'checked' : ''}`} onClick={() => listChange(item.inquiry_id, 'black', 'tag')}>ブラックリスト</div>
                                                    </div>
                                                </td>
                                            </tr>);
                                    })}
                                </tbody>
                            </Table>
                            {totalLength <= displayLength ? null :
                                <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                    <span style={{ backgroundColor: '#0f3675', color: '#fff', fontSize: '12px', padding: '5px 12px', borderRadius: '10px', cursor: 'pointer' }}
                                        onClick={() => setDisplayLength(displayLength + 20)}>
                                        {totalLength - displayLength > 19 ? `${displayLength + 20}件を表示/${totalLength}件中` : `${totalLength - displayLength + (20 * (displayLength / 20))}件を表示/${totalLength}件中`}
                                    </span>
                                </div>}
                        </div>
                    </div>
                    <Modal show={show} onHide={modalClose} size='lg'>
                        <Modal.Header closeButton>
                            <Modal.Title style={{ fontSize: '15px' }}>{modalContent === 'beforeSurvey' ? 'アンケート詳細' : ''}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>{modalContent === 'beforeSurvey' &&
                            <Table striped bordered>
                                <tbody style={{ fontSize: '12px' }}>
                                    <tr>
                                        <td>受信日</td>
                                        <td>{modalBeforeContent?.dateStr ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>顧客名</td>
                                        <td>{modalBeforeContent?.name ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>ブランド</td>
                                        <td>{modalBeforeContent?.brand ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>反響経路</td>
                                        <td>{modalBeforeContent?.campaign ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>検討時期</td>
                                        <td>{modalBeforeContent?.considerationStart ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>入居希望時期</td>
                                        <td>{modalBeforeContent?.desiredMoveIn ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>住宅会社訪問数</td>
                                        <td>{modalBeforeContent?.visitedCompanies ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>新築検討理由</td>
                                        <td>{modalBeforeContent?.reasonForConsidering ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>その他の検討理由</td>
                                        <td>{modalBeforeContent?.reasonOther ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>今後の行動予定</td>
                                        <td>{modalBeforeContent?.futurePlan ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>その他の行動予定</td>
                                        <td>{modalBeforeContent?.futureOther ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>希望の広さ</td>
                                        <td>{modalBeforeContent?.desiredSize ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>希望の間取り</td>
                                        <td>{modalBeforeContent?.desiredLayout ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>重視項目</td>
                                        <td>{modalBeforeContent?.priorityItem ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>入居予定人数</td>
                                        <td>{modalBeforeContent?.expectedResidents ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>総予算</td>
                                        <td>{modalBeforeContent?.totalBudget ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>返済額</td>
                                        <td>{modalBeforeContent?.monthlyRepayment ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>前年度の年収</td>
                                        <td>{modalBeforeContent?.annualIncome ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>勤続年数</td>
                                        <td>{modalBeforeContent?.yearsOfService ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>年収がある方</td>
                                        <td>{modalBeforeContent?.otherIncomePerson ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>年収がある方の年収</td>
                                        <td>{modalBeforeContent?.otherAnnualIncome ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>自己資金の支払予定</td>
                                        <td>{modalBeforeContent?.ownFunds ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>その他ローン</td>
                                        <td>{modalBeforeContent?.otherLoans ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>当日したいこと</td>
                                        <td>{modalBeforeContent?.thingsToDo ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>その他当日したいこと</td>
                                        <td>{modalBeforeContent?.thingsToDoOther ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>新居の希望</td>
                                        <td>{modalBeforeContent?.housingType ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>その他の希望</td>
                                        <td>{modalBeforeContent?.housingTypeOther ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>希望の土地エリア</td>
                                        <td>{modalBeforeContent?.landArea ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>紹介者様</td>
                                        <td>{modalBeforeContent?.referrerName ?? '-'}</td>
                                    </tr>
                                    <tr>
                                        <td>メールアドレス</td>
                                        <td>{modalBeforeContent?.emailAddress ?? '-'}</td>
                                    </tr>
                                </tbody>
                            </Table>}
                        </Modal.Body>
                    </Modal>
                </div >
            </div>
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} brand={brand} />
        </>

    )
}
export default ListDev;
