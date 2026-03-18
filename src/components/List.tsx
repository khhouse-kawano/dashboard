import { useNavigate } from 'react-router-dom';
import React, { useEffect, useRef, useState, useContext, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Modal from 'react-bootstrap/Modal';
import MenuDev from "./MenuDev";
import PreviewImg from '../assets/images/preview.png';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { headTag } from '../utils/headTag';
import { htmlValue } from '../utils/htmlValue';
import { headers } from '../utils/headers';
import { baseURL } from '../utils/baseURL';
import { shopFormate } from '../utils/shopFormate';
import { setStyleClass } from '../utils/setStyleClass';
import { mediumFormate } from '../utils/mediumFormate';

type Shop = { brand: string, shop: string, section: string, area: string };

type Medium = { id: number, medium: string, category: string, sort_key: number, response_medium: number, list_medium: number };

type InquiryCustomer = {
    id: number, inquiry_id: string, pg_id: string, mhl_id: string, mhl_url: string, mhl_mail: string, inquiry_date: string, medium: string, response_medium: string, first_name: string, last_name: string,
    first_name_kana: string, last_name_kana: string, mobile: string, landline: string, mail: string, zip: string, pref: string, city: string, town: string, street: string,
    building: string, brand: string, shop: string, sync: number, staff: string, area: string, reserved_date: string, black_list: string, hp_campaign: string,
    duplicate: string, hotlead_url: string,
};

type Customer = {
    id: string, name: string, status: string, medium: string, rank: string, register: string, reserve: string, shop: string, estate: string, meeting: string,
    appointment: string, line_group: string, screening: string, rival: string, period: string, survey: string, budget: string, importance: string, note: string, staff: string, section: string, contract: string, sales_meeting: string, latest_date: string, last_meeting: string,
};

type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, robo_id: string };

type Achievement = { id: number, date: string, shop: string, category: string, goal: number };

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };


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
    const [myHomeSync, setMyHomeSync] = useState<number | null>(null);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
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

    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setMonthArray(getYearMonthArray(2025, 1));
        setSelectedMonth(`${year}/${month}`);

        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const [customerRes, shopRes, staffRes, mediumRes, inquiryRes, achieveRes, beforeSurveyRes] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_summary" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "inquiry_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "achievement_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "before_survey" }, { headers }),
                ]);
                await setCustomerList(customerRes.data);
                await setShopArray(shopRes.data);
                await setStaffList(staffRes.data);
                await setMediumArray(mediumRes.data.filter(m => m.list_medium === 1));
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

    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        return (
            item.inquiry_date.includes(selectedMonth) &&
            (targetShop === '' || item.shop.includes(formattedShop)) &&
            (mediumValue === '' || item.response_medium === mediumValue) &&
            (targetSync === null || (targetSync === 0 ?
                (item.sync === targetSync && (item.black_list.split('duplicate').length % 2 !== 0 && item.black_list.split('support').length % 2 !== 0 && item.black_list.split('black').length % 2 !== 0))
                : item.sync === targetSync || item.black_list.split('duplicate').length % 2 === 0 || item.black_list.split('support').length % 2 === 0 || item.black_list.split('black').length % 2 === 0)) &&
            (myHomeSync === null ? true : myHomeSync === 1 ? !!item.mhl_id : !item.mhl_id) &&
            (targetName === '' || fullName.includes(targetName)))
    }), [originalList, selectedMonth, targetShop, mediumValue, targetSync, myHomeSync, targetName]);

    useEffect(() => {
        setInquiryList(filteredInquiryList);
        setTotalLength(filteredInquiryList.length);
        setDisplayLength(20);
    }, [filteredInquiryList]);

    useEffect(() => {
        setSurveyBeforeList(filteredBeforeList);
    }, [originalBeforeList, selectedMonth]);

    const filteredBeforeList = useMemo(() => {
        const filtered = originalBeforeList.filter(item => item.dateStr.includes(selectedMonth));
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
            response_status: filteredCustomer.medium,
            campaign: filteredCustomer.hp_campaign,
            staffId: staffIdValue
        };

        if (window.confirm(`${filteredShop} ${filteredCustomer.first_name} ${filteredCustomer.last_name}様 PG CLOUDと同期しますか?`)) {
            console.log(registerData);

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

    const syncRobo = async (idValue: string, staffValue: string, firstNameValue: string, lastNameValue: string, firstKanaValue: string, lastKanaValue: string, mobileValue: string, mailValue: string) => {
        if (staffValue === '' || staffValue.includes('管理')) {
            await alert('スタッフが未選択です');
            return;
        }

        if (window.confirm(`${firstNameValue} ${lastNameValue}様 マイホームロボと同期しますか?`)) {
            const roboIdValue = staffList.find(s => s.name === staffValue)?.robo_id ?? '';
            if (roboIdValue) {
                const postData = {
                    id: idValue,
                    staff: staffValue,
                    firstName: firstNameValue,
                    lastName: lastNameValue,
                    firstKana: firstKanaValue,
                    lastKana: lastKanaValue,
                    mobile: mobileValue,
                    mail: mailValue,
                    robo_id: String(roboIdValue)
                };

                const fetchData = async () => {
                    const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "inquiry_list" }, { headers });
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
                try {
                    const response = await axios.post(`${baseURL}/api/robo`, postData, { headers });
                    console.log(response.data);
                } catch (error) {
                    console.error('リクエストエラー:', error);
                    clearInterval(timer);
                }
            }
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
    const [mailContent, setMailContent] = useState({
        information: '',
        from: '',
        to: '',
        html: '',
        brand: '',
        title: '',
        nameValue: '',
        staffValue: '',
        receive: ''
    });
    const [previewVisible, setPreviewVisible] = useState<boolean>(false);

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
        } else if (request === 'myHomeRobo') {
            const filtered = await inquiryList.find(item => item.id === idValue);
            const staff = await staffList.find(item => item.name === filtered?.staff);
            let mainImg;
            let brandValue;
            let urlValue;
            if (filtered?.brand === 'KH') {
                mainImg = 'https://khg-marketing.info/myhomerobo/myhomerobo_kh.png';
                brandValue = '国分ハウジング';
                urlValue = 'https://kh-house.jp/reservation_2025';
            } else if (filtered?.brand === 'DJH') {
                mainImg = 'https://khg-marketing.info/myhomerobo/myhomerobo_djh.png';
                brandValue = 'デイジャストハウス';
                urlValue = 'https://day-just-house.com/event/reserve_202403/';
            } else if (filtered?.brand === 'Nagomi') {
                mainImg = 'https://khg-marketing.info/myhomerobo/myhomerobo_nagomi.png';
                brandValue = 'なごみ工務店';
                urlValue = 'https://www.nagomi-koumuten.jp/reservation/';
            } else if (filtered?.brand === '2L') {
                mainImg = 'https://khg-marketing.info/myhomerobo/myhomerobo_2l.png';
                brandValue = 'ニーエルホーム';
                urlValue = 'https://2lhome.net/reserve/';
            } else if (filtered?.brand === 'JH') {
                mainImg = 'https://khg-marketing.info/myhomerobo/myhomerobo_jh.png';
                brandValue = 'ジャスフィーホーム';
                urlValue = 'https://jusfy-home.com/lp/';
            } else if (filtered?.brand === 'PGH') {
                mainImg = 'https://khg-marketing.info/myhomerobo/myhomerobo_pg.png';
                brandValue = 'PG HOUSE'
                urlValue = 'https://miyazaki.pg-house.jp/reservation/';
            }

            const htmlText = htmlValue(filtered, mainImg, urlValue, brandValue, staff);
            await setMailContent({
                information: filtered?.inquiry_id ?? '',
                brand: brandValue ?? '',
                from: staff?.mail ?? '',
                to: filtered?.mail ?? '',
                title: `【${brandValue}】無料間取り提案＆先着10名様にギフトカード`,
                html: `${headTag}${htmlText}</body></html>`,
                nameValue: `${filtered?.first_name ?? ''} ${filtered?.last_name ?? ''}`,
                staffValue: staff?.name ?? '',
                receive: filtered?.mhl_mail ?? ''
            });
            await setPreview(`${headTag}${htmlText}</body></html>`);
            await setShow(true);
        }
    };

    const modalClose = async () => {
        await setShow(false);
    };

    const editorRef2 = useRef<HTMLDivElement>(null);
    const editorRef3 = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<string>('');

    // 装飾コマンド
    const applyCommand = (cmd: string, value?: string) => {
        document.execCommand(cmd, false, value);
    };

    const setColor = (color: string) => {
        document.execCommand('foreColor', false, color);
    };

    const setBackgroundColor = (color: string) => {
        document.execCommand('backColor', false, color);
    };

    const mailMyhomeRobo = async (request: string) => {
        if (request === 'test') {
            if (window.confirm(`テストメールを${mailContent.from}に送りますか?`)) {
                const postData = {
                    ...mailContent,
                    html: `${mailContent.html}</body></html>`,
                    title: `【テスト】${mailContent.title}`,
                    demand: 'myhomerobo_test_mail'
                }
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const testMail = await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
                testMail.data.status === 'success' ? alert('テストメールの送信完了') : alert('テストメールの送信失敗');
            } else {
                return;
            }
        } else if (request === 'customer') {
            if (window.confirm(`以下の内容でアンケートメールを送りますか?\n差出人:${mailContent.staffValue}<${mailContent.from}>\n宛先:${mailContent.nameValue}様<${mailContent.to}>`)) {
                const postData = {
                    ...mailContent,
                    html: `${mailContent.html}<div><img src="${baseURL}/open?id=${mailContent.information}"  alt="" width="1" height="1" style="display:none;" /></div></body></html>`,
                    demand: 'myhomerobo_customer_mail'
                }
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const testMail = await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
                testMail.data.status === 'success' ? alert('アンケートメールの送信完了') : alert('アンケートメールの送信失敗')
            } else {
                return;
            }
        }
    };

    const inquiryFilter = (shopValue: string) => {
        return inquiryList.filter(c => (shopValue ? c.shop === shopValue : true) && c.inquiry_date.replace(/-/, '/').includes(selectedMonth)).length;
    };

    const achievementFilter = (shopValue: string, value: number) => {
        return staffList.filter(s => s.category === 1 && (shopValue ? s.shop === shopValue : true)).length * value;
    };

    const reserveFilter = (shopValue: string) => {
        return customerList.filter(c => (shopValue ? c.shop == shopValue : true) && c.reserve.includes(selectedMonth)).length;
    };

    return (
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
                    <div className="d-flex flex-wrap mb-3">
                        <div className="m-1">
                            <select className="target" onChange={(e) => setSelectedMonth(e.target.value)} style={{ fontSize: '13px' }}>
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
                                <option value="">PG CLOUD同期状況</option>
                                <option value="1">同期済み</option>
                                <option value="0">未同期</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => {
                                const value = e.target.value;
                                setMyHomeSync(value === '' ? null : Number(value));
                            }} style={{ fontSize: '13px' }}>
                                <option value="">マイホームロボ同期状況</option>
                                <option value="1">同期済み</option>
                                <option value="0">未同期</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='氏名で検索' onChange={(e) => setTargetName(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
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
                                    <td style={{ width: '70px', textAlign: 'center' }}>PG CLOUD同期</td>
                                    <td style={{ width: '80px', textAlign: 'center' }}>マイホームロボ同期</td>
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
                                                    item.sync === 1 ? <a href={item.pg_id} target='_blank' style={{ textDecoration: 'none', backgroundColor: 'blue', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}><i className="fa-solid fa-up-right-from-square"></i></a> :
                                                        <i className='fa-solid fa-arrows-rotate sticky-column pointer'
                                                            onClick={() => handleSync(item.inquiry_id)}
                                                        ></i>
                                                }
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{item.mhl_id !== "" ?
                                                <>
                                                    <a href={item.mhl_id} target='_blank' style={{ textDecoration: 'none', backgroundColor: 'red', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}><i className="fa-solid fa-up-right-from-square"></i></a>
                                                    {item.mhl_url && <><a style={{ textDecoration: 'none', backgroundColor: 'red', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}
                                                        onClick={() => {
                                                            setModalContent('myHomeRobo');
                                                            modalShow('myHomeRobo', item.id, item.mhl_url);
                                                        }}>{item.mhl_mail ? <i className="fa-solid fa-envelope-open"><span style={{ fontSize: '9px', fontWeight: '600' }}> 開封済み</span></i> : <i className="fa-solid fa-envelope"></i>}</a>
                                                        <a style={{ textDecoration: 'none', backgroundColor: 'red', padding: '3px 7px', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
                                                            onClick={() => {
                                                                try {
                                                                    navigator.clipboard.writeText(item.mhl_url);
                                                                    alert('クリップボードにアンケートのURLをコピーしました！');
                                                                } catch (err) {
                                                                    console.error('コピーに失敗しました');
                                                                }
                                                            }}><i className="fa-solid fa-copy"></i></a></>}
                                                </>
                                                : <i className='fa-solid fa-arrows-rotate sticky-column pointer'
                                                    onClick={() => syncRobo(
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
                <Modal show={show} onHide={modalClose} size='xl'>
                    <Modal.Header closeButton>
                        <Modal.Title style={{ fontSize: '15px' }}>{modalContent === 'beforeSurvey' ? 'アンケート詳細' : 'マイホームロボアンケート送信'}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>{modalContent === 'beforeSurvey' &&
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
                        </Table>}
                        {modalContent === 'myHomeRobo' && <>
                            <div className="d-flex">
                                <div className="w-50">
                                    <Table borderless>
                                        <tbody style={{ fontSize: '12px' }}>
                                            <tr className='align-middle'>
                                                <td>お施主様情報</td>
                                                <td><a href={mailContent?.information} target='_blank'>{mailContent?.information}</a></td>
                                            </tr>
                                            <tr className='align-middle'>
                                                <td style={{}}>差出人</td>
                                                <td><input type='text' value={mailContent?.from} style={{ border: '1px solid #D3D3D3', width: '400px', height: '40px', borderRadius: '5px' }}
                                                    onChange={(e) => setMailContent(prev => ({ ...prev, from: e.target.value }))} /></td>
                                            </tr>
                                            <tr className='align-middle'>
                                                <td>宛先</td>
                                                <td><input type='text' value={mailContent?.to} style={{ border: '1px solid #D3D3D3', width: '400px', height: '40px', borderRadius: '5px' }}
                                                    onChange={(e) => setMailContent(prev => ({ ...prev, to: e.target.value }))} /></td>
                                            </tr>
                                            <tr className='align-middle'>
                                                <td>件名</td>
                                                <td><input type='text' value={mailContent?.title} style={{ border: '1px solid #D3D3D3', width: '400px', height: '40px', borderRadius: '5px' }}
                                                    onChange={(e) => setMailContent(prev => ({ ...prev, title: e.target.title }))} /></td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                    <div className="d-flex justify-content-center align-items-center">
                                        <button type="button" className='decoBtn px-2' onClick={() => setPreviewVisible(true)} >プレビュー</button>
                                        <button type="button" className='decoBtn mx-3 px-2' onClick={() => mailMyhomeRobo('test')}>テストメール</button>
                                        <button type="button" className='decoBtn px-2' onClick={() => mailMyhomeRobo('customer')}>送信</button>
                                        {mailContent.receive && <div style={{ fontSize: '11px' }} className='ms-2 text-primary'>{mailContent.receive.split(',')[0]} 開封済み</div>}
                                    </div>
                                    {previewVisible && <div className="preview" onClick={() => setPreviewVisible(false)}>
                                        <div className="position-relative phone" onClick={(e) => e.stopPropagation()}>
                                            <img src={PreviewImg} className="w-100" />
                                            <div className='position-absolute content'
                                                ref={editorRef3}
                                                contentEditable={false}
                                                suppressContentEditableWarning
                                                dangerouslySetInnerHTML={{ __html: mailContent.html }}
                                            />
                                            <div className="d-flex justify-content-center mt-2">
                                                <button type="button" className='decoBtn px-2'
                                                    onClick={() => {
                                                        setPreviewVisible(false);
                                                        setPreview(editorRef3.current?.innerHTML || mailContent.html)
                                                    }}>閉じる</button>
                                                <button type="button" className='decoBtn mx-3 px-2' onClick={() => mailMyhomeRobo('test')}>テストメール</button>
                                                <button type="button" className='decoBtn px-2' onClick={() => mailMyhomeRobo('customer')}>送信</button>
                                            </div>
                                        </div>
                                    </div>}
                                </div>
                                <div className="w-50">
                                    <div>
                                        <div className="text-center">文面編集</div>
                                        <table>
                                            <td style={{ padding: '24px', fontFamily: "Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif", color: '#222', lineHeight: '1.7', fontSize: '15px' }}>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '10px' }}>
                                                    <button type="button" className='decoBtn' onClick={() => applyCommand('bold')} style={{ fontWeight: 'bold' }}>太字</button>
                                                    <button type="button" className='decoBtn' onClick={() => applyCommand('insertLineBreak')}>改行</button>
                                                    <button type="button" className='decoBtn' onClick={() => setColor('#c15d00')} style={{ backgroundColor: '#fff', color: '#c15d00' }}>文字色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setColor('#000')} style={{ backgroundColor: '#fff', color: '#000' }}>文字色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setColor('#E60023')} style={{ backgroundColor: '#fff', color: '#E60023' }}>文字色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setColor('#0b6cff')} style={{ backgroundColor: '#fff', color: '#0b6cff' }}>文字色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setBackgroundColor('#0b6cff')} style={{ backgroundColor: '#0b6cff', color: '#fff' }}>背景色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setBackgroundColor('#fff')} style={{ backgroundColor: '#fff', color: '#383838' }}>背景色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setBackgroundColor('#E60023')} style={{ backgroundColor: '#E60023', color: '#fff' }}>背景色</button>
                                                    <button type="button" className='decoBtn' onClick={() => setBackgroundColor('#fff7e6')} style={{ backgroundColor: '#fff7e6', color: '#000' }}>背景色</button>
                                                </div>
                                                <div
                                                    ref={editorRef2}
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    style={{
                                                        flex: 1,
                                                        minHeight: 140,
                                                        padding: 12,
                                                        border: '1px solid #ddd',
                                                        borderRadius: 6,
                                                        lineHeight: 1.7,
                                                        fontSize: 15,
                                                        fontFamily: "Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif",
                                                        background: '#fff',
                                                    }}
                                                    // onInput={() => {
                                                    //     const html = `${headTag}${editorRef2.current?.innerHTML}${bottomTag}`;
                                                    //     if (html !== undefined) {
                                                    //         setPreview(html);
                                                    //     }
                                                    // }}
                                                    onBlur={() => setMailContent(prev => ({ ...prev, html: `${headTag}${editorRef2.current?.innerHTML}` || mailContent.html }))}
                                                    dangerouslySetInnerHTML={{ __html: preview }}
                                                />
                                            </td>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>}
                    </Modal.Body>
                </Modal>
            </div ></div>
    )
}
export default ListDev;
