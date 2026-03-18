import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AuthContext from '../context/AuthContext';
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import MenuDev from "./MenuDev";
import Modal from 'react-bootstrap/Modal';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { setSection } from '../utils/setSection';
import { setStaffLength } from '../utils/setStaffLength';
import { budgetFilter } from '../utils/budgetFilter';
import { get11MonthsAgoString } from '../utils/get11MonthsAgoString';
import { isLastYear } from '../utils/isLastYear';

type Shop = { brand: string; shop: string; section: string; area: string; }
type Customer = { id: string; shop: string; name: string; staff: string; status: string; contract: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, appointment: string, second_reserve: string, section: string };
type Medium = { id: number; medium: string, list_medium: number };
type Staff = { name: string; shop: string; rank: number, section: string };
type ResponseData = { period: string, register: number, reserve: number, interview: number, appointment: number, cancel: number, contract: number };
type CheckItem = {
    name: string;
    show: boolean;
};
type CheckedState = {
    [key: string]: CheckItem;
};
type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };

const ShopTrendDev = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [originalCustomerList, setOriginalCustomerList] = useState<Customer[]>([]);
    const [open, setOpen] = useState(false);
    const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
    const [startMonth, setStartMonth] = useState(startMonthValue);
    const [endMonth, setEndMonth] = useState('');
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [targetMedium, setTargetMedium] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetBrand, setTargetBrand] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [sectionArray, setSectionArray] = useState<string[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [show, setShow] = useState(false);
    const [gemini, setGemini] = useState('');
    const [responseLineData, setResponseLineData] = useState<ResponseData[]>([]);
    const [modalTitle, setModalTitle] = useState<string>('');
    const [geminiApi, setGeminiApi] = useState(false);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
    const [budgetList, setBudget] = useState<Budget[]>([]);
    const [checked, setChecked] = useState<CheckedState>({
        register: { name: '総反響数', show: true },
        reserve: { name: '来場予約数', show: true },
        interview: { name: '実来場数', show: true },
        appointment: { name: '次アポ数', show: true },
        contract: { name: '契約数', show: true },
        cancel: { name: 'キャンセル数', show: true },
        budget: { name: '広告費', show: false },
        comparison: { name: '昨年実績', show: false }
    });
    const [mediumChecked, setMediumChecked] = useState({});

    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerRes, shopRes, mediumResponse, staffResponse, budgetResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "trend_customer" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "budget_accounting" }, { headers }),

                ]);
                await setOriginalCustomerList(customerRes.data);
                await setOriginalShopArray(shopRes.data);
                await setMediumArray(mediumResponse.data);
                await setShopArray(shopRes.data);
                await setMediumArray(mediumResponse.data.filter(m => m.list_medium === 1));
                await setOriginalMonthArray(getYearMonthArray(2025, 1));
                await setStaff(staffResponse.data.filter(s => s.rank === 1));
                await setBudget(budgetResponse.data);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
        setMonthArray(getYearMonthArray(2025, 1));
    }, []);

    useEffect(() => {
        const filtered = originalCustomerList.filter(item => {
            const brand = item.shop.slice(0, 2);
            const mediumList = Object.entries(mediumChecked).filter(([_, value]) => value).map(([key, _]) => key);
            return ((targetMedium && targetMedium !== 'all') ? item.medium === targetMedium : true) &&
                ((targetMedium === 'all' && !Object.values(mediumChecked).every(v => v))
                    ? (mediumChecked[item.medium] !== false)
                    : true)
                && (targetSection && targetSection !== 'all' ? item.section === targetSection : true)
                && (targetBrand ? brand === targetBrand.slice(0, 2) : true)
        });
        setCustomerList(filtered);

        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length
        const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
        setMonthArray(filteredMonthArray);

        const filteredShopArray = originalShopArray.filter(item => {
            const brand = item.shop.slice(0, 2);
            return (targetSection ? item.section === targetSection : true) &&
                (targetBrand ? brand === targetBrand.slice(0, 2) : true)
        });
        setShopArray(filteredShopArray);

        const uniqueSectionArray = [...new Set(originalShopArray.filter(o => o.section).map(o => o.section))];
        const filteredSectionArray = uniqueSectionArray.sort((a, b) => {
            const numA = parseInt(a?.match(/\d+/)?.[0] ?? "9999", 10);
            const numB = parseInt(b?.match(/\d+/)?.[0] ?? "9999", 10);
            return numA - numB
        });
        setSectionArray(filteredSectionArray);
    }, [originalCustomerList, originalMonthArray, originalShopArray, startMonth, endMonth, targetMedium, targetSection, targetBrand, mediumChecked]);

    useEffect(() => {
        if (!geminiApi) return;
        setGemini('');
        const data = monthArray.map(month => {
            const formattedMedium = mediumArray.filter(m => m.list_medium === 1 && (targetMedium ? m.medium === targetMedium : true)).map(m => m.medium);
            formattedMedium.push('合計');
            const periodSummary = formattedMedium.map(medium => {
                const totalValue = customerList.filter(item => (targetSection ? item.section === modalTitle : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && item.register.includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                const interviewValue = customerList.filter(item => (targetSection ? item.section === modalTitle : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && item.reserve?.includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                const cancelValue = customerList.filter(item => (targetSection ? item.section === modalTitle : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && !item.reserve && item.reserved_status?.includes(month.replace(/\//g, '-')) && (medium !== '合計' ? item.medium === medium : true)).length;
                const reserveValue = cancelValue + interviewValue;
                const appointmentValue = customerList.filter(item => (targetSection ? item.section === modalTitle : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && item.second_reserve && item.reserve?.includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                const contractValue = customerList.filter(item => (targetSection ? item.section === modalTitle : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && item.contract?.includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                return {
                    medium: medium,
                    total: totalValue,
                    interview: interviewValue,
                    cancel: cancelValue,
                    reserve: reserveValue,
                    appointment: appointmentValue,
                    contract: contractValue,
                }
            });
            const areaValue = originalShopArray.filter(s => modalTitle ? s.shop === modalTitle : true).map(s => s.area).join();
            let shopValue;
            if (shopArray.map(s => s.shop).includes(modalTitle)) {
                shopValue = modalTitle;
            } else if (targetBrand) {
                shopValue = shopArray.filter(s => s.brand === targetBrand).map(s => s.shop).join();
            } else if (targetSection) {
                shopValue = targetSection;
            } else {
                shopValue = 'グループ全体';
            }
            return {
                period: month,
                shop: shopValue,
                area: modalTitle ? areaValue : '',
                medium: targetMedium ? `${targetMedium}のみ` : mediumArray.map(m => m.medium).join(),
                amount: periodSummary
            }
        });

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/summary", { data }, { headers });

                setGemini(response.data);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };
        fetchData();
    }, [geminiApi]);

    useEffect(() => {
        if (targetMedium !== 'all') return;
        const checkedObject = {};
        mediumArray.forEach(m =>
            checkedObject[m.medium] = true
        );
        checkedObject['その他'] = true;
        setMediumChecked(checkedObject);
    }, [targetMedium]);

    const modalShow = (title: string) => {
        setShow(true);
        const filtered: ResponseData[] = monthArray.map(m => {
            const matchTarget = (c: Customer) =>
                title === 'グループ全体'
                    ? true
                    : targetSection === 'all'
                        ? c.section === title
                        : sectionArray.includes(title)
                            ? c.section === title
                            : c.shop === title;

            const registerValue = customerList.filter(c => c.register.includes(m) && matchTarget(c)).length;
            const reserveValue = customerList.filter(c => (c.reserve.includes(m) || c.reserved_status?.replace(/-/g, '/').includes(m)) && matchTarget(c)).length;
            const interviewValue = customerList.filter(c => c.reserve.includes(m) && matchTarget(c)).length;
            const appointmentValue = customerList.filter(c => c.reserve.includes(m) && c.second_reserve && matchTarget(c)).length;
            const cancelValue = customerList.filter(c => c.reserved_status?.replace(/-/g, '/').includes(m) && matchTarget(c)).length;
            const contractValue = customerList.filter(c => c.contract.includes(m) && matchTarget(c)).length;
            return {
                period: m,
                register: registerValue,
                reserve: reserveValue,
                interview: interviewValue,
                appointment: appointmentValue,
                cancel: cancelValue,
                contract: contractValue
            }
        });
        setResponseLineData(filtered);
        let formattedTitle;
        if (title) {
            formattedTitle = title;
        } else if (!title && targetSection) {
            formattedTitle = targetSection;
        } else if (!title && targetBrand) {
            formattedTitle = targetBrand;
        } else {
            formattedTitle = '注文営業全体'
        }
        setModalTitle(formattedTitle);
    };

    const modalClose = () => {
        setResponseLineData([]);
        setGemini('');
        setShow(false);
        setGeminiApi(false);
    };

    const checkedChange = (e) => {
        const { name } = e.target;

        setChecked(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                show: !prev[name].show
            }
        }));
    };

    const sections: Shop[] = sectionArray.map(item => {
        return { brand: '', shop: item, section: item, area: '' }
    }
    );


    return (
        <>
            <div className='outer-container'>
                <div className="d-flex">
                    <div className="modal_menu">
                        <MenuDev brand={brand} />
                    </div>
                    <div className="header_sp">
                        <i
                            className="fa-solid fa-bars hamburger"
                            onClick={() => setOpen(true)}
                        />
                    </div>
                    <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                        <i
                            className="fa-solid fa-xmark hamburger position-absolute"
                            onClick={() => setOpen(false)}
                        />
                        <MenuDev brand={brand} />
                    </div>
                    <div className='content bg-white p-2'>
                        <div className="d-flex flex-wrap mb-1 search_condition">
                            <div className="m-1">
                                <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                                    <option value="" selected>開始月</option>
                                    {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <span className='d-flex align-items-center mx-1'>～</span>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                                    <option value="" selected>終了月</option>
                                    {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetShop('')
                                    setTargetMedium(e.target.value);
                                }}>
                                    <option value="">販促媒体を選択</option>
                                    {mediumArray.map((item, index) =>
                                        <option key={index} value={item.medium} selected={targetMedium === item.medium}>{item.medium}</option>
                                    )}
                                    <option value='all'>詳細設定</option>
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetShop('');
                                    setTargetBrand('');
                                    setTargetSection(e.target.value);
                                }}><option value="">課を選択</option>
                                    <option value="all">全課表示</option>
                                    {sectionArray.map((item, index) =>
                                        <option value={item} selected={item === targetSection} key={index}>{item}</option>
                                    )}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetShop('');
                                    setTargetSection('');
                                    setTargetBrand(e.target.value);
                                }}>
                                    <option value="">ブランドを選択</option>
                                    <option value="KH" selected={targetBrand.slice(0, 2) === 'KH'}>国分ハウジング</option>
                                    <option value="DJH" selected={targetBrand.slice(0, 2) === 'DJ'}>デイジャストハウス</option>
                                    <option value="なごみ" selected={targetBrand.slice(0, 2) === 'なご'}>なごみ工務店</option>
                                    <option value="2L" selected={targetBrand.slice(0, 2) === '2L'}>ニーエルホーム</option>
                                    <option value="PG" selected={targetBrand.slice(0, 2) === 'PG'}>PGハウス</option>
                                    <option value="JH" selected={targetBrand.slice(0, 2) === 'JH'}>ジャスフィーホーム</option>
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetBrand('');
                                    setTargetMedium('');
                                    setTargetSection('');
                                    setTargetShop(e.target.value);
                                }}>
                                    <option value="">店舗を選択</option>
                                    {originalShopArray.filter(shop => !shop.shop?.includes('店舗未設定')).map(shop =>
                                        <option value={shop.shop} selected={shop.shop === targetShop}>{shop.shop}</option>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="d-flex flex-wrap mb-1 search_condition">
                            {Object.entries(checked).map(([key, value], index) => {
                                return <div className="m-1" key={index}>
                                    <label className="target checkbox d-flex align-items-center">
                                        <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.name}を表示
                                    </label>
                                </div>
                            })}
                        </div>
                        {targetMedium === 'all' && <>
                            <div style={{ fontSize: '12px' }}>表示する販促媒体を選択</div>
                            <div className="d-flex flex-wrap my-1 search_condition rounded" style={{ backgroundColor: '#d4d4d4' }}>
                                {[...mediumArray, { id: 0, medium: 'その他', list_number: 0 }].map((m, mIndex) =>
                                    <div className="mx-1" key={mIndex}>
                                        <label className="target checkbox d-flex align-items-center">
                                            <input type="checkbox" checked={mediumChecked[m.medium]} name={m.medium} className='me-1' onChange={() => setMediumChecked(prev => ({
                                                ...prev,
                                                [m.medium]: !prev[m.medium]
                                            }))} />{m.medium}
                                        </label>
                                    </div>
                                )}
                            </div></>}
                        <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                        <div className="table-wrapper">
                            <div className="list_table">
                                <div style={{ width: `${(monthArray.length + 1) * 170 + 120}px` }}>
                                    {targetShop ?
                                        <Table striped bordered>
                                            <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                                <tr className='sticky-header text-center'>
                                                    <td className='sticky-column text-center' style={{ width: '120px' }}>店舗名</td>
                                                    {['全期間', ...monthArray].map(month => <td>{month}</td>)}
                                                </tr>
                                                {[{ name: targetShop, shop: targetShop, rank: 1 }, ...staff].filter(s => s.rank === 1 && s.shop === targetShop).map((item, staffIndex) =>
                                                    <tr>
                                                        <td className='align-middle  sticky-column text-center'>{item.name}</td>
                                                        {['全期間', ...monthArray].map((month, monthIndex) => {
                                                            const total = customerList.filter(c => (monthIndex >= 1 ? c.register.includes(month) : monthArray.includes(c.register.slice(0, 7))) && (staffIndex >= 1 ? c.staff === item.name : c.shop === targetShop)).length;
                                                            const interview = customerList.filter(c => (monthIndex >= 1 ? c.reserve?.includes(month) : monthArray.includes(c.reserve.slice(0, 7))) && (staffIndex >= 1 ? c.staff === item.name : c.shop === targetShop)).length;
                                                            const cancel = customerList.filter(c => (!c.reserve && (monthIndex >= 1 ? c.reserved_status?.includes(month.replace(/\//g, '-')) : monthArray.includes(c.reserved_status.replace(/-/g, '/').slice(0, 7)))) && (staffIndex >= 1 ? c.staff === item.name : c.shop === targetShop)).length;
                                                            const appointment = customerList.filter(c => (c.second_reserve && (monthIndex >= 1 ? c.reserve?.includes(month) : monthArray.includes(c.reserve.slice(0, 7)))) && (staffIndex >= 1 ? c.staff === item.name : c.shop === targetShop)).length;
                                                            const contract = customerList.filter(c => (monthIndex >= 1 ? c.contract?.includes(month) : monthArray.includes(c.contract.slice(0, 7))) && (staffIndex >= 1 ? c.staff === item.name : c.shop === targetShop)).length;
                                                            const reserve = cancel + interview;
                                                            return (
                                                                <td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                                    <div className="text-white p-2 rounded" style={{ backgroundColor: '#6baed6' }}>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                                        <div className="rounded p-1 my-1" style={{ backgroundColor: '#4292c6' }}>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                                            <div className="rounded p-1 my-1" style={{ backgroundColor: '#2171b5' }}>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                                <div className="p-1 text-white rounded my-1" style={{ backgroundColor: '#08519c' }}>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)</div>
                                                                                <div className="rounded py-1 px-2 my-1 text-white" style={{ backgroundColor: '#08306b' }}>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span>({isNaN(contract / interview) ? 0 : Math.floor(contract / interview * 100)}%)</div>
                                                                            </div>
                                                                            <div className="p-1 text-dark rounded my-1" style={{ backgroundColor: '#9ecae1' }}>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                )}
                                                {mediumArray.filter(item => item.list_medium === 1).map(item => <tr>
                                                    <td className='align-middle  sticky-column text-center'>{item.medium}</td>
                                                    {['全期間', ...monthArray].map((month, monthIndex) => {
                                                        const total = customerList.filter(c => (monthIndex >= 1 ? c.register.includes(month) : monthArray.includes(c.register.slice(0, 7))) && c.shop === targetShop && c.medium === item.medium).length;
                                                        const interview = customerList.filter(c => (monthIndex >= 1 ? c.reserve?.includes(month) : monthArray.includes(c.reserve.slice(0, 7))) && c.shop === targetShop && c.medium === item.medium).length;
                                                        const cancel = customerList.filter(c => (!c.reserve && (monthIndex >= 1 ? c.reserved_status?.includes(month.replace(/\//g, '-')) : monthArray.includes(c.reserved_status.replace(/-/g, '/').slice(0, 7)))) && c.shop === targetShop && c.medium === item.medium).length;
                                                        const appointment = customerList.filter(c => (c.second_reserve && (monthIndex >= 1 ? c.reserve?.includes(month) : monthArray.includes(c.reserve.slice(0, 7)))) && c.shop === targetShop && c.medium === item.medium).length;
                                                        const contract = customerList.filter(c => (monthIndex >= 1 ? c.contract?.includes(month) : monthArray.includes(c.contract.slice(0, 7))) && c.shop === targetShop && c.medium === item.medium).length;
                                                        const reserve = interview + cancel;
                                                        return (
                                                            <td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                                <div className="text-white p-2 rounded" style={{ backgroundColor: '#6baed6' }}>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                                    <div className="rounded p-1 my-1" style={{ backgroundColor: '#4292c6' }}>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                                        <div className="rounded p-1 my-1" style={{ backgroundColor: '#2171b5' }}>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                            <div className="p-1 text-white rounded my-1" style={{ backgroundColor: '#08519c' }}>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)</div>
                                                                            <div className="rounded py-1 px-2 my-1 text-white" style={{ backgroundColor: '#08306b' }}>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span>({isNaN(contract / interview) ? 0 : Math.floor(contract / interview * 100)}%)</div>
                                                                        </div>
                                                                        <div className="p-1 text-dark rounded my-1" style={{ backgroundColor: '#9ecae1' }}>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                                )}
                                            </tbody>
                                        </Table> : <Table striped bordered>
                                            <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                                <tr className='sticky-header text-center'>
                                                    <td className='sticky-column text-center' style={{ width: '120px' }}>店舗名</td>
                                                    {['全期間', ...monthArray].map((month, monthIndex) => {
                                                        const isDisplayLastYear = isLastYear(month) && monthIndex >= 1 && checked.comparison.show;
                                                        return <td>{month}{isDisplayLastYear && <span className='bg-white rounded text-dark px-2 ms-1'>昨年実績</span>}</td>
                                                    })}
                                                </tr>
                                                {[
                                                    {
                                                        brand: '',
                                                        shop: (targetSection && targetSection !== 'all')
                                                            ? targetSection
                                                            : targetBrand
                                                                ? `${targetBrand}全体`
                                                                : 'グループ全体', section: '', area: ''
                                                    },
                                                    ...(targetSection !== 'all' ? shopArray : sections)
                                                ].filter(shop => !shop.shop.includes('店舗未設定') && !shop.shop.includes('FH')).map((target, targetIndex) => {
                                                    const staffLength = setStaffLength(staff, targetSection, target.section, target.shop, targetIndex).length;
                                                    return <>
                                                        <tr>
                                                            <td className='align-middle  sticky-column text-center' rowSpan={checked.budget.show ? 2 : 1}>
                                                                {(targetMedium && targetMedium !== 'all') && <div>{targetMedium}</div>}
                                                                <div>{target.shop}</div>
                                                                <div className='text-primary fw-bold'>({staffLength}名)</div>
                                                                <div className="bg-primary btn text-white rounded-pill py-0 mt-2" style={{ fontSize: '11px', cursor: 'pointer' }}
                                                                    onClick={() => modalShow(target.shop)}>サマリ</div>
                                                            </td>
                                                            {['全期間', ...monthArray].map((month, monthIndex) => {
                                                                const base = setSection(customerList, targetSection, target.section, target.shop, targetIndex);
                                                                const total = base.filter(item => (monthIndex >= 1 ? item.register.includes(month) : monthArray.includes(item.register.slice(0, 7)))).length;
                                                                const interview = base.filter(item => (monthIndex >= 1 ? item.reserve.includes(month) : monthArray.includes(item.reserve.slice(0, 7)))).length;
                                                                const cancel = base.filter(item => !item.reserve && (monthIndex >= 1 ? item.reserved_status?.includes(month.replace(/\//g, '-')) : monthArray.includes(item.reserved_status.replace(/-/g, '/').slice(0, 7)))).length;
                                                                const reserve = cancel + interview;
                                                                const appointment = base.filter(item => item.second_reserve && (monthIndex >= 1 ? item.reserve?.includes(month) : monthArray.includes(item.reserve.slice(0, 7)) && item.second_reserve)).length;
                                                                const contract = base.filter(item => (monthIndex >= 1 ? item.contract?.includes(month) : monthArray.includes(item.contract.slice(0, 7)))).length;
                                                                const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                                                const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                                                let lastYearValue;
                                                                if (monthIndex === 0 || isLastYear(month)) {
                                                                    lastYearValue = {
                                                                        total: base.filter(item => (monthIndex >= 1 ? item.register.includes(lastYear) : lastYearMonthArray.includes(item.register.slice(0, 7)))).length,
                                                                        interview: base.filter(item => (monthIndex >= 1 ? item.reserve.includes(lastYear) : lastYearMonthArray.includes(item.reserve.slice(0, 7)))).length,
                                                                        cancel: base.filter(item => !item.reserve && (monthIndex >= 1 ? item.reserved_status?.includes(lastYear.replace(/\//g, '-')) : lastYearMonthArray.includes(item.reserved_status.replace(/-/g, '/').slice(0, 7)))).length,
                                                                        reserve: base.filter(item => (monthIndex >= 1 ? item.reserve.includes(lastYear) : lastYearMonthArray.includes(item.reserve.slice(0, 7)))).length + base.filter(item => !item.reserve && (monthIndex >= 1 ? item.reserved_status?.includes(lastYear.replace(/\//g, '-')) : lastYearMonthArray.includes(item.reserved_status.replace(/-/g, '/').slice(0, 7)))).length,
                                                                        appointment: base.filter(item => item.second_reserve && (monthIndex >= 1 ? item.reserve?.includes(lastYear) : lastYearMonthArray.includes(item.reserve.slice(0, 7)))).length,
                                                                        contract: base.filter(item => (monthIndex >= 1 ? item.contract?.includes(lastYear) : lastYearMonthArray.includes(item.contract.slice(0, 7)))).length,
                                                                    };
                                                                }
                                                                const isDisplayLastYear =
                                                                    checked.comparison.show &&
                                                                    (monthIndex === 0 || isLastYear(month));
                                                                return (
                                                                    <td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                                        <div className={checked.register.show ? "text-white p-2 rounded" : 'text-white rounded'} style={{ backgroundColor: '#6baed6' }}>
                                                                            {checked.register.show && <div>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                                                {isDisplayLastYear && <span className='bg-white text-primary rounded px-2 ms-1 fw-bold'>{lastYearValue.total.toLocaleString()}</span>}</div>}
                                                                            <div className={checked.reserve.show ? "rounded p-1 my-1" : "my-1 rounded"} style={{ backgroundColor: '#4292c6' }}>
                                                                                {checked.reserve.show && <div>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                                                    {isDisplayLastYear && <span className='bg-white text-primary rounded px-2 ms-1 fw-bold'>{lastYearValue.reserve.toLocaleString()}</span>}</div>}
                                                                                <div className={checked.interview.show ? "rounded p-1 my-1" : "my-1 rounded"} style={{ backgroundColor: '#2171b5' }}>
                                                                                    {checked.interview.show && <div>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                                        {isDisplayLastYear && <span className='bg-white text-primary rounded px-2 ms-1 fw-bold'>{lastYearValue.interview.toLocaleString()}</span>}</div>}
                                                                                    <div className={checked.appointment.show ? "rounded p-1 my-1" : "my-1 rounded"} style={{ backgroundColor: '#08519c' }}>
                                                                                        {checked.appointment.show && <div>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)
                                                                                            {isDisplayLastYear && <span className='bg-white text-primary rounded px-2 ms-1 fw-bold'>{lastYearValue.appointment.toLocaleString()}</span>}</div>}
                                                                                    </div>
                                                                                    <div className={checked.contract.show ? "rounded p-1 my-1" : "my-1 rounded"} style={{ backgroundColor: '#08306b' }}>
                                                                                        {checked.contract.show && <div>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span>({isNaN(contract / interview) ? 0 : Math.floor(contract / interview * 100)}%)
                                                                                            {isDisplayLastYear && <span className='bg-white text-primary rounded px-2 ms-1 fw-bold'>{lastYearValue.contract.toLocaleString()}</span>}</div>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className={checked.cancel.show ? "rounded p-1 my-1 text-dark" : "my-1 rounded text-dark"} style={{ backgroundColor: '#9ecae1' }}>
                                                                                    {checked.cancel.show && <div>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)
                                                                                        {isDisplayLastYear && <span className='bg-white text-primary rounded px-2 ms-1 fw-bold'>{lastYearValue.cancel.toLocaleString()}</span>}</div>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                )
                                                            })}
                                                        </tr>
                                                        {checked.budget.show && <tr>
                                                            {['全期間', ...monthArray].map((month, monthIndex) => {
                                                                const baseBudget = budgetList.filter(b =>
                                                                    b.section === 'order'
                                                                    && (monthIndex > 0 ? b.budget_period.includes(month) : monthArray.includes(b.budget_period.slice(0, 7)))
                                                                    && (targetBrand ? b.shop.slice(0, 2) === targetBrand.slice(0, 2) : true)
                                                                    && (targetMedium ? b.medium === targetMedium : true));
                                                                const filteredBudget = budgetFilter(baseBudget, targetSection, target.shop, targetIndex);
                                                                const formattedValue = filteredBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                                                const base = customerList.filter(item => (monthIndex >= 1 ? item.register.includes(month) : monthArray.includes(item.register.slice(0, 7))));
                                                                const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                                                const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                                                const total = setSection(base, targetSection, target.section, target.shop, targetIndex);
                                                                const baseLastYear = customerList.filter(item => (monthIndex >= 1 ? item.register.includes(lastYear) : monthArray.includes(item.register.slice(0, 7))));
                                                                const totalLastYear = setSection(baseLastYear, targetSection, target.section, target.shop, targetIndex);
                                                                let formattedLastYearValue;
                                                                const isDisplayLastYear = (isLastYear(month) || monthIndex === 0) && checked.comparison.show;
                                                                const lastYearBudget = budgetList.filter(b =>
                                                                    b.section === 'order'
                                                                    && (monthIndex > 0 ? b.budget_period.includes(lastYear) : lastYearMonthArray.includes(b.budget_period.slice(0, 7)))
                                                                    && (targetBrand ? b.shop.slice(0, 2) === targetBrand.slice(0, 2) : true)
                                                                    && (targetMedium ? b.medium === targetMedium : true));
                                                                const filteredLastYearBudget = budgetFilter(lastYearBudget, targetSection, target.shop, targetIndex);
                                                                formattedLastYearValue = filteredLastYearBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                                                return <td key={monthIndex} style={{ fontSize: '11px' }}>
                                                                    {[{ label: '総額', color: '#c03442' }, { label: '反響単価', color: '#b02a37' }, { label: '来場単価', color: '#8a1e28' }, { label: '契約単価', color: '#64151c' }]
                                                                        .map((item, index) => {
                                                                            const filteredLength = total.filter(t => index === 1 ? true : index === 2 ? t.reserve : t.contract).length;
                                                                            const formattedBudget = Number.isFinite(Math.ceil(formattedValue / filteredLength)) ? Math.ceil(formattedValue / filteredLength) : 0;
                                                                            const lastYearFilteredLength = totalLastYear.filter(t => index === 1 ? true : index === 2 ? t.reserve : t.contract).length;
                                                                            const lastYearFormattedBudget = Number.isFinite(Math.ceil(formattedLastYearValue / lastYearFilteredLength)) ? Math.ceil(formattedLastYearValue / lastYearFilteredLength) : 0;
                                                                            return <div className="text-white rounded pe-2 py-1 mb-1" style={{ backgroundColor: item.color, textAlign: 'right' }} key={index}>{item.label}:￥{index === 0 ? formattedValue.toLocaleString() : formattedBudget.toLocaleString()}
                                                                                {isDisplayLastYear && <span className='bg-white text-danger rounded px-1 ms-1 fw-bold'>￥{index === 0 ? formattedLastYearValue.toLocaleString() : lastYearFormattedBudget.toLocaleString()}</span>}</div>
                                                                        })}
                                                                </td>
                                                            })}
                                                        </tr>}
                                                    </>
                                                }
                                                )}
                                            </tbody>
                                        </Table>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Modal show={show} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {geminiApi ? <div>{gemini ?
                        <>
                            <div className="text-center my-3">
                                <div className="rounded-pill mt-2 aiButton" style={{ fontSize: '11px', cursor: 'pointer' }}
                                    onClick={() => {
                                        setGeminiApi(false);
                                        setGeminiApi(true);
                                    }}>AIによる分析開始</div>
                            </div>
                            <div className='mt-1 mb-2 text-center'>AIによる市場分析結果
                                <div className="comment mt-4" dangerouslySetInnerHTML={{ __html: gemini }}></div>
                            </div>
                        </> :
                        <div className="text-center mt-1 mb-5" style={{ fontSize: '12px' }}>
                            <div className='rounded-pill mt-2 aiButton'><i className="fa-solid fa-rotate spinning me-2"></i>AIがデータの分析中...</div>
                            <div className='mt-3' style={{ fontSize: '12px' }}>データ分析には最大30秒ほど必要です</div>
                        </div>}</div>
                        : <div className="text-center mt-1 mb-5"><div className="rounded-pill mt-2 aiButton" style={{ fontSize: '11px', cursor: 'pointer' }}
                            onClick={() => setGeminiApi(true)}>AIによる分析開始</div></div>}
                    <div className="mb-5">
                        <div className="text-center mb-3" style={{ fontSize: '12px' }}>{modalTitle} 反響推移</div>
                        <div style={{ width: "95%", height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={responseLineData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <Tooltip />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: "12px",
                                            fontFamily: "Arial, sans-serif",
                                            color: "#333",
                                        }}
                                        content={({ payload }) => (
                                            <div className='d-flex justify-content-center mt-3'>
                                                {["register", "reserve", "interview", "appointment", "contract", "cancel"].map(key => {
                                                    const entry = payload?.find(p => p.dataKey === key);
                                                    return (
                                                        <div className='m-1 px-2 py-1 rounded' key={key} style={{ backgroundColor: entry?.color, color: '#fff' }}>
                                                            {entry?.value}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    <Line type="monotone" dataKey="cancel" stroke="#6c757d" name="来場キャンセル" />
                                    <Line type="monotone" dataKey="contract" stroke="#4b0082" strokeWidth={3} name="契約" />
                                    <Line type="monotone" dataKey="appointment" stroke="#198754" name="次アポ" />
                                    <Line type="monotone" dataKey="interview" stroke="#0d6efd" name="実来場" />
                                    <Line type="monotone" dataKey="reserve" stroke="#fd7e14" name="来場予約" />
                                    <Line type="monotone" dataKey="register" stroke="#dc3545" name="総反響" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="px-5 mt-5" style={{ fontSize: '11px' }}>
                            <Table bordered>
                                <tbody>
                                    <tr style={{ textAlign: 'center' }}>
                                        <td colSpan={2}>名称</td>
                                        {['期間計', ...monthArray].map(month =>
                                            <td>{month}</td>
                                        )}
                                    </tr>
                                    {['総反響', '来場予約', '実来場', '次アポ', '契約', 'キャンセル'].map((label, labelIndex) => {
                                        const keyMap = ['register', 'reserve', 'interview', 'appointment', 'contract', 'cancel'];
                                        return <tr>
                                            {labelIndex === 0 && <td rowSpan={6} className='align-middle text-center'>{modalTitle}</td>}
                                            <td>{label}</td>
                                            {[{}, ...responseLineData].map((item, index) => {
                                                const value = index === 0 ? responseLineData.reduce((acc, cur) => acc + cur[keyMap[labelIndex]], 0) : item[keyMap[labelIndex]];
                                                return <td style={{ textAlign: 'right' }}>{value}</td>
                                            })}
                                        </tr>
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default ShopTrendDev;