import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AuthContext from '../context/AuthContext';
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import './chartConfig';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

// import { beforeSurveyDev, shopListDev, afterSurveyDev, inquiryUserDev } from './contractUser'

type Survey = {
    id: number;
    sync: number;
    brand: string;
    dateStr: string;
    name: string;
    considerationStart: string;
    desiredMoveIn: string;
    visitedCompanies: string;
    reasonForConsidering: string;
    reasonOther: string;
    futurePlan: string;
    futureOther: string;
    desiredSize: string;
    desiredLayout: string;
    priorityItem: string;
    expectedResidents: string;
    totalBudget: string;
    monthlyRepayment: string;
    annualIncome: string;
    yearsOfService: string;
    otherIncomePerson: string;
    otherAnnualIncome: string;
    ownFunds: string;
    otherLoans: string;
    thingsToDo: string;
    thingsToDoOther: string;
    housingType: string;
    housingTypeOther: string;
    landArea: string;
    referrerName: string;
    emailAddress: string;
};

type AfterSurvey = {
    id: number;
    dateStr: string; // e.g. "2025/06/07 17:46:41"
    shop: string;
    name: string;
    phone: string;
    InterviewFeedback: string; // comma-separated feedback topics
    confirmedAllItems: string;
    desireOwnership: string;
    priorityCondition: string;
    ourCompanyFirstChoice: string;
    otherCompaniesInterested: string;
    staffName: string;
    staffHospitality: string;
    proposalFeedback: string;
    moreInfoOrImprovements: string;
    nextConsultationRequests: string;
    changeStaffRequested: string;
};

type Shop = { brand: string; shop: string; section: string; area: string; };

type InquiryUser = {
    id: number;
    inquiry_id: string;
    pg_id: string;
    mhl_id: string;
    inquiry_date: string;
    medium: string;
    response_medium: string;
    first_name: string;
    last_name: string;
    first_name_kana: string;
    last_name_kana: string;
    mobile: string;
    landline: string;
    mail: string;
    zip: string;
    pref: string;
    city: string;
    town: string;
    street: string;
    building: string;
    brand: string;
    shop: string;
    sync: number;
    staff: string;
    area: string;
    reserved_date: string;
    reserved_time: string;
    black_list: string;
    hp_campaign: string;
    delete_flag: number;
    duplicate: string;
    note: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_term: string;
    utm_content: string;
    referrer: string;
    first_visit: string;
    hotlead_url: string;
};

const Survey = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [surveyBeforeList, setSurveyBeforeList] = useState<Survey[]>([]);
    const [originalAfterList, setOriginalAfterList] = useState<AfterSurvey[]>([]);
    const [surveyAfterList, setAfterSurveyList] = useState<AfterSurvey[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [totalLength, setTotalLength] = useState<number>(0);
    const [targetLength, setTargetLength] = useState<number>(20);
    const [show, setShow] = useState(false);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [modalAfterContent, setModalAfterContent] = useState<AfterSurvey>();
    const [modalCategory, setModalCategory] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [targetBrand, setTargetBrand] = useState<string>('');
    const [targetBeforeName, setTargetBeforeName] = useState<string>('');
    const [syncTargetShop, setSyncTargetShop] = useState<string>('');
    const [inquiryUser, setInquiryUser] = useState<InquiryUser[]>([]);

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
    getYearMonthArray(2025, 1);
    const monthArray = getYearMonthArray(2025, 1);

    useEffect(() => {
        // if (!brand || brand.trim() === "") {
        //     navigate("/");
        //     return;
        // }
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [beforeSurveyRes, afterSurveyRes, shopRes, inquiryRes] = await Promise.all([
                    axios.post("/dashboard/api/", { demand: "before_survey" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "after_survey" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "shop_list" }, { headers }),
                axios.post("/dashboard/api/", { demand: "inquiry_list" }, { headers }),
                ]);

                await setOriginalBeforeList(beforeSurveyRes.data);
                await setShopArray(shopRes.data);
                await setAfterSurveyList(afterSurveyRes.data);
                await setInquiryUser(inquiryRes.data);

                // await setOriginalBeforeList(beforeSurveyDev);
                // await setAfterSurveyList(afterSurveyDev);
                // await setShopArray(shopListDev);
                // await setInquiryUser(inquiryUserDev);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${year}/${month}`);
        fetchData();
    }, [])

    useEffect(() => {
        setSurveyBeforeList(filteredBeforeList);
        setTotalLength(filteredBeforeList.length);
        setTargetLength(20);
        const filtered = inquiryUser.filter(item => item.hp_campaign);
        setInquiryUser(filtered);
    }, [originalBeforeList, selectedMonth, targetBrand, targetBeforeName])

    useEffect(() => {
        setAfterSurveyList(filteredAfterList);
    }, [originalAfterList])

    const filteredBeforeList = useMemo(() => {
        const filtered = originalBeforeList.filter(item => item.dateStr.includes(selectedMonth) &&
            (targetBrand === '' ? true : item.brand.slice(0, 2) === targetBrand) &&
            item.name.replace(/ /g, '').replace(/　/g, '').includes(targetBeforeName)
        );
        return filtered;
    }, [originalBeforeList, selectedMonth, targetBrand, targetBeforeName])

    const filteredAfterList = useMemo(() => {
        const filtered = originalAfterList.filter(item => item.dateStr.includes(selectedMonth));
        return filtered;
    }, [originalAfterList, selectedMonth])

    const modalShow = async (idValue: number, category: string) => {
        if (category === 'before') {
            await setModalCategory('before');
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
                    emailAddress: modalFilter.emailAddress
                });
                await setShow(true);
            }
        } else if (category === 'after') {
            await setModalCategory('after');
            const modalFilter = surveyAfterList.find(item => item.id === idValue);
            if (modalFilter) {
                await setModalAfterContent({
                    id: modalFilter.id,
                    dateStr: modalFilter.dateStr,
                    shop: modalFilter.shop,
                    name: modalFilter.name,
                    phone: modalFilter.phone,
                    InterviewFeedback: modalFilter.InterviewFeedback,
                    confirmedAllItems: modalFilter.confirmedAllItems,
                    desireOwnership: modalFilter.desireOwnership,
                    priorityCondition: modalFilter.priorityCondition,
                    ourCompanyFirstChoice: modalFilter.ourCompanyFirstChoice,
                    otherCompaniesInterested: modalFilter.otherCompaniesInterested,
                    staffName: modalFilter.staffName,
                    staffHospitality: modalFilter.staffHospitality,
                    proposalFeedback: modalFilter.proposalFeedback,
                    moreInfoOrImprovements: modalFilter.moreInfoOrImprovements,
                    nextConsultationRequests: modalFilter.nextConsultationRequests,
                    changeStaffRequested: modalFilter.changeStaffRequested,
                });
                await setShow(true);
            }

        }
    }

    const modalClose = async () => {
        await setShow(false);
    };

    const syncSurvey = async (idValue: number, pgidValue: string, campaignValue: string, shopValue: string) => {
        const targetData = surveyBeforeList.find(item => item.id == idValue);
        const data = {
            id: pgidValue,
            sbid: idValue,
            shop: shopValue,
            note: `反響経路:${campaignValue}／検討時期:${targetData?.considerationStart}\n入居希望時期:${targetData?.desiredMoveIn}／新築検討理由:${targetData?.reasonForConsidering} ${targetData?.reasonOther}\n今後の予定:${targetData?.futurePlan} ${targetData?.futureOther}／希望の広さ:${targetData?.desiredSize}／希望の間取り:${targetData?.desiredLayout}\n重視項目:${targetData?.priorityItem}／入居予定人数:${targetData?.expectedResidents}\n総予算:${targetData?.totalBudget}／返済額:${targetData?.monthlyRepayment}\n前年度の年収:${targetData?.annualIncome}／勤続年数:${targetData?.yearsOfService}\n年収がある方：${targetData?.otherIncomePerson}／年収がある方の年収:${targetData?.otherAnnualIncome}\n自己資金:${targetData?.ownFunds}／その他ローン:${targetData?.otherLoans}\n当日したいこと:${targetData?.thingsToDo} ${targetData?.thingsToDoOther}／新居の希望:${targetData?.housingType} ${targetData?.housingTypeOther}\n希望の土地エリア:${targetData?.landArea}／紹介者:${targetData?.referrerName}`
        };
        await console.log(data);
        let message;
        try {
            const response = await fetch("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/before_survey", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            message = result.message;
            await console.log(message);
        } catch (error) {
            await console.error("エラー発生:", error);
            alert("同期に失敗しました...");
        }
        await setSyncTargetShop('');
    };
    return (
        <div>
            <Menu brand='Master' />
            <div className="container bg-white py-4 mt-2">
                <Tabs defaultActiveKey="before_survey" id="justify-tab-example" className="mt-5 mb-3 bg-white" justify onSelect={() => setTargetLength(20)}>
                    <Tab eventKey="before_survey" title="事前アンケート" style={{ fontSize: '13px' }}>
                        <div className='pb-3 row' style={{ width: '960px', margin: '50px auto 0' }}>
                            <div className="d-flex">
                                <select className="form-select campaign position-relative me-2" onChange={(e) => setSelectedMonth(e.target.value)}>
                                    {monthArray.map((month, index) => (<option key={index} value={month} selected={index === monthArray.length - 1}>{month}</option>
                                    ))}
                                </select>
                                <select className="form-select campaign position-relative me-2" onChange={(e) => setTargetBrand(e.target.value)}>
                                    <option value=''>全ブランド表示</option>
                                    <option value="KH">KH</option>
                                    <option value="DJ">DJH</option>
                                    <option value="なご">なごみ</option>
                                    <option value="2L">2L</option>
                                    <option value="FH">FH</option>
                                    <option value="PG">PGH</option>
                                    <option value="JH">JH</option>
                                </select>

                                <input type="text" className='form-control' placeholder='氏名で検索' value={targetBeforeName} onChange={(e) => setTargetBeforeName(e.target.value)} />
                            </div>
                        </div>
                        <Table bordered striped style={{ width: '1160px', margin: '20px auto 0' }}>
                            <thead style={{ fontSize: '12px' }}>
                                <tr className='sticky-header'>
                                    <td className='text-center'>PG CLOUD同期</td>
                                    <td>受信日</td>
                                    <td>ブランド</td>
                                    <td>店舗</td>
                                    <td>顧客名</td>
                                    <td>反響経路</td>
                                    <td className='text-center'>詳細表示</td>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '12px' }}>
                                {surveyBeforeList.slice(0, targetLength).map((item, index) => {
                                    let brandClass;
                                    if (item.brand === 'KH') {
                                        brandClass = { backgroundColor: '#0f3675' };
                                    } else if (item.brand === 'DJH') {
                                        brandClass = { backgroundColor: '#28aeba' };
                                    } else if (item.brand === 'なごみ') {
                                        brandClass = { backgroundColor: '#956134' };
                                    } else if (item.brand === '2L') {
                                        brandClass = { backgroundColor: '#0d9f6d' };
                                    } else if (item.brand === 'PGH') {
                                        brandClass = { backgroundColor: '#000' };
                                    } else if (item.brand === 'JH') {
                                        brandClass = { backgroundColor: '#dc4235' };
                                    } else if (item.brand === 'FH') {
                                        brandClass = { backgroundColor: '#cd3c33' };
                                    }

                                    const pgid = inquiryUser.find(value => value.brand === item.brand && value.mail === item.emailAddress) ? inquiryUser.find(value => value.brand === item.brand && value.mail === item.emailAddress)?.pg_id : '';
                                    const tableClass = pgid !== '' ? "" : "table-danger";
                                    const targetShop = inquiryUser.find(value => value.brand === item.brand && value.mail === item.emailAddress) ? inquiryUser.find(value => value.brand === item.brand && value.mail === item.emailAddress)?.shop : `${item.brand}店舗未設定`;
                                    const campaign = inquiryUser.find(value => value.brand.replace('Nagomi', 'なごみ') === item.brand && value.mail === item.emailAddress) ?
                                        inquiryUser.find(value => value.brand.replace('Nagomi', 'なごみ') === item.brand && value.mail === item.emailAddress)?.hp_campaign : 'キャンペーン不明';
                                    return (
                                        <tr key={index} className={tableClass}>
                                            <td className='text-center'>
                                                {pgid ? 
                                                item.sync === 1 ? <span style={brandClass}  className='text-white py-1 px-2 rounded-pill'>連携済み</span> :
                                                <i className='fa-solid fa-arrows-rotate sticky-column pointer' onClick={() => syncSurvey(item.id, pgid, campaign as string, targetShop as string)}></i> :
                                                    <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>PG CLOUDに未同期の顧客です</Tooltip>}>
                                                        <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>同期不可</span>
                                                    </OverlayTrigger>
                                                }</td>
                                            <td>{item.dateStr}</td>
                                            <td>{item.brand}</td>
                                            <td>{targetShop}
                                            </td>
                                            <td>{item.name}</td>
                                            <td><span className='text-white py-1 px-2 rounded-pill' style={brandClass}>{campaign}</span></td>
                                            <td className='text-center'><div className="btn text-white bg-primary" style={{ fontSize: '12px', width: '100px' }} onClick={() => modalShow(item.id, 'before')}>詳細表示</div></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </Table>
                        {targetLength > totalLength ? null : <div className="text-white bg-primary text-center pointer rounded-pill py-1 mt-4" style={{ width: '130px', margin: '0 auto', fontSize: '12px' }} onClick={() => setTargetLength(targetLength + 20)}>{totalLength > targetLength + 20 ? targetLength + 20 : totalLength - targetLength + targetLength}件を表示/{totalLength}件中</div>}
                    </Tab>
                    <Tab eventKey="after_survey" title="事後アンケート">
                        <Table bordered striped style={{ width: '960px', margin: '50px auto 0' }}>
                            <thead style={{ fontSize: '12px' }}>
                                <tr className='sticky-header'>
                                    <td className='text-center'>PG CLOUD同期</td>
                                    <td>受信日</td>
                                    <td>店舗</td>
                                    <td>担当名</td>
                                    <td>顧客名</td>
                                    <td className='text-center'>詳細表示</td>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '12px' }}>
                                {surveyAfterList.slice(0, targetLength).map((item, index) =>
                                    <tr key={index}>
                                        <td className='text-center'><i className='fa-solid fa-arrows-rotate sticky-column pointer'></i></td>
                                        <td>{item.dateStr}</td>
                                        <td>{item.shop}</td>
                                        <td>{item.staffName}</td>
                                        <td>{item.name}</td>
                                        <td className='text-center'><div className="btn text-white bg-primary" style={{ fontSize: '12px', width: '100px' }} onClick={() => modalShow(item.id, 'after')}>詳細表示</div></td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                        <div className="text-white bg-primary text-center pointer rounded-pill py-1 mt-4 position-relative" style={{ width: '130px', margin: '0 auto', fontSize: '12px' }} onClick={() => setTargetLength(targetLength + 20)}>
                            次の20件
                            <div className="position-absolute"></div>
                        </div>
                    </Tab>
                </Tabs>

            </div>
            <Modal show={show} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>アンケート詳細</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table striped>
                        {modalCategory === 'before' ?
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

                                    <th></th>
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
                            </tbody> :
                            <tbody>
                                <tr style={{ fontSize: '13px' }}>
                                    <td style={{ width: '25%' }}>受信日</td>
                                    <td style={{ width: '25%' }}>顧客名</td>
                                    <td style={{ width: '25%' }}>店舗</td>
                                    <td style={{ width: '25%' }}>担当</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalAfterContent?.dateStr ? modalAfterContent.dateStr : '-'}</th>
                                    <th>{modalAfterContent?.name ? modalAfterContent.name : '-'}</th>
                                    <th>{modalAfterContent?.shop ? modalAfterContent.shop : '-'}</th>
                                    <th>{modalAfterContent?.staffName ? modalAfterContent.staffName : '-'}</th>
                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>面談で伝えた内容</td>
                                    <td>持ち家が欲しいと思えたか？</td>
                                    <td>条件さえ整えば、今すぐ建てようと思えたか？</td>
                                    <td>最も重視したい項目</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalAfterContent?.InterviewFeedback ? modalAfterContent.InterviewFeedback : '-'}</th>
                                    <th>{modalAfterContent?.confirmedAllItems ? modalAfterContent.confirmedAllItems : '-'}</th>
                                    <th>{modalAfterContent?.desireOwnership ? modalAfterContent.desireOwnership : '-'}</th>
                                    <th>{modalAfterContent?.priorityCondition ? modalAfterContent.priorityCondition : '-'}</th>

                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>弊社が第一候補か？</td>
                                    <td>気になる他社</td>
                                    <td>接客の満足度</td>
                                    <td>提案内容の満足度</td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalAfterContent?.ourCompanyFirstChoice ? modalAfterContent.ourCompanyFirstChoice : '-'}</th>
                                    <th>{modalAfterContent?.otherCompaniesInterested ? modalAfterContent.otherCompaniesInterested : '-'}</th>
                                    <th>{modalAfterContent?.staffHospitality ? modalAfterContent.staffHospitality : '-'}</th>
                                    <th>{modalAfterContent?.proposalFeedback ? modalAfterContent.proposalFeedback : '-'}</th>

                                </tr>
                                <tr style={{ fontSize: '13px' }}>
                                    <td>もっと知りたかったポイントや改善点</td>
                                    <td>担当変更の希望</td>
                                    <td>次回相談したい内容や要望</td>
                                    <td></td>
                                </tr>
                                <tr style={{ fontSize: '12px' }}>
                                    <th>{modalAfterContent?.moreInfoOrImprovements ? modalAfterContent.moreInfoOrImprovements : '-'}</th>
                                    <th>{modalAfterContent?.nextConsultationRequests ? modalAfterContent.nextConsultationRequests : '-'}</th>
                                    <th>{modalAfterContent?.changeStaffRequested ? modalAfterContent.changeStaffRequested : '-'}</th>
                                    <th></th>
                                </tr>
                            </tbody>
                        }

                    </Table>
                </Modal.Body>
            </Modal>
        </div>
    )
}

export default Survey