import React, { useEffect, useRef, useState, useContext } from 'react';
import MenuDev from "./MenuDev";
import AuthContext from '../context/AuthContext';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import Table from 'react-bootstrap/esm/Table';
import Modal from 'react-bootstrap/Modal';
import { ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
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

type Staff = { id: number, name: string, pg_id: string, shop: string, status: string, sort: number };
type Customer = { id_related: string, estate_name_1: string, name: string, staff: string; status: string; action: string; registered: string; medium: string; case: string; reserved: string; contract: string; rank: string, flag: string, budget: string, total: number, property: number, broker: number, renovation: number, profit: number, other: number };
type Medium = { id: number; medium: string };
type ResponseData = { period: string, registered: number, reserved: number, contract: number };
type Action = { date: string, method: string, subject: string, staff: string, note: string, status: string };
type Achievement = { category: string, name: string, period: string, value: string }
type Performance = { id: string, total: number | null, property: number | null, broker: number | null, renovation: number | null, profit: number | null, other: number | null };

const ResalePerformance = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
    const [open, setOpen] = useState(false);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [modalShow, setModalShow] = useState(false);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [originalCustomers, setOriginalCustomers] = useState<Customer[]>([]);
    const [lowerCustomers, setLowerCustomers] = useState<Customer[]>([]);
    const [upperCustomers, setUpperCustomers] = useState<Customer[]>([]);
    const [contractCustomers, setContractCustomers] = useState<Customer[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [sortKey, setSortKey] = useState('');
    const [targetMedium, setTargetMedium] = useState('');
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [responseLineData, setResponseLineData] = useState<ResponseData[]>([]);
    const [showGraph, setShowGraph] = useState(false);
    const [action, setAction] = useState<Action[]>([]);
    const [achievementData, setAchievementData] = useState<Achievement>({
        category: '中古リノベ',
        name: '',
        period: '',
        value: ''
    });
    const [performanceData, setPerformanceData] = useState<Performance>({
        id: '',
        total: null,
        property: null,
        broker: null,
        renovation: null,
        profit: null,
        other: null
    });

    const [display, setDisplay] = useState({
        registered: {
            label: '予算',
            show: true
        },
        reserved: {
            label: '実績(目標差異)',
            show: true
        },
        contract: {
            label: '媒介取得',
            show: true
        }
    });

    const formate = (value: string) => {
        return value.replace(/\//g, '-');
    };

    const displayFormate = (value: string) => {
        return value.replace(/-/g, '/');
    };

    useEffect(() => {
        if (!brand || !token || !category) navigate("/login");
        setOriginalMonthArray(getYearMonthArray(2025, 6));
        setSortKey('registered');
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_report" }, { headers });
                const staffResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_staff" }, { headers });
                const achievementResponse = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "company_achievement" }, { headers })
                const mediumResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "medium_list" }, { headers });
                setOriginalCustomers(customerResponse.data.filter(c => c.name));
                setStaff(staffResponse.data);
                setAchievement(achievementResponse.data);
                setMediumArray(mediumResponse.data.filter(m => m.sell_portal_medium === 1)); //初期フィルター
            } catch (error) {
                console.error('データ取得エラー:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const filteredContract = originalCustomers.filter(o => {
            return o.flag === 'exist' && monthArray.includes(o.contract.replace(/-/g, '/').slice(0, 7))
        });
        setContractCustomers(filteredContract);

        const filteredLower = originalCustomers.filter(o => o.rank === 'A');
        setLowerCustomers(filteredLower);

        const filteredUpper = originalCustomers.filter(o => ['A', 'B', 'C'].includes(o.rank));
        setUpperCustomers(filteredUpper);
    }, [originalCustomers, monthArray, targetMedium, mediumArray]);

    useEffect(() => {
        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length;
        const filtered = originalMonthArray.slice(startIndex, endIndex);
        setMonthArray(filtered);
    }, [originalCustomers, startMonth, endMonth]);

    useEffect(() => {
        if (customerList.length === 0) return;;
        setOpenIndex(null);
        setModalShow(true);
    }, [customerList]);

    const checkedChange = (e) => {
        const { name } = e.target;
        setDisplay(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                show: !prev[name].show
            }
        }));
    };

    const modalClose = async () => {
        setModalShow(false);
        setCustomerList([]);
        setOpenIndex(null);
    };

    const changeAchievement = async () => {
        const data = {
            demand: 'change_company_achievement',
            category: achievementData.category,
            name: achievementData.name,
            period: achievementData.period,
            value: achievementData.value
        };

        try {
            const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", data, { headers });
            await setAchievement(response.data);
        } catch (error) {
            console.error('Error updating achievement:', error);

        }
    };

    const changePerformance = async () => {
        if (!performanceData.id) return;
        const updated = Object.fromEntries(Object.entries(performanceData).filter(([_, value]) => value !== null));
        console.log(updated)
        const data = {
            ...updated,
            demand: 'change_resale_performance'
        };
        console.log(data)
        try {
            const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", data, { headers });
            await setOriginalCustomers(response.data.filter(c => c.name));
        } catch (error) {
            console.error('Error updating achievement:', error);
        }

        setPerformanceData({
            id: '',
            total: null,
            property: null,
            broker: null,
            renovation: null,
            profit: null,
            other: null
        });
    };

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
                        <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                        <div className="d-flex flex-wrap mb-3 align-items-center">
                            <div className="m-1">
                                <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                                    <option value="" selected>開始月を選択</option>
                                    {originalMonthArray.sort((a, b) => {
                                        const monthA = new Date(a + '/01').getTime();
                                        const monthB = new Date(b + '/01').getTime();
                                        return monthA - monthB;
                                    }).map((month, index) => (<option key={index} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                                    <option value="" selected>終了月を選択</option>
                                    {originalMonthArray.sort((a, b) => {
                                        const monthA = new Date(a + '/01').getTime();
                                        const monthB = new Date(b + '/01').getTime();
                                        return monthA - monthB;
                                    }).map((month, index) => (<option key={index} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="m-1">
                                <label className="target checkbox d-flex align-items-center">
                                    <input type="checkbox" checked={showGraph} className='me-1' onChange={() => setShowGraph(prev => !prev)} />グラフを表示
                                </label>
                            </div>
                        </div>
                        <div className="d-flex flex-wrap mb-3 align-items-center">
                            {Object.entries(display).map(([key, value]) => {
                                return <div className="m-1">
                                    <label className="target checkbox d-flex align-items-center">
                                        <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.label}を表示
                                    </label>
                                </div>
                            })}
                        </div>
                        {isLoading ? (<p className="ms-3"><i className="fa-solid fa-spinner me-2 spinning"></i>Now Loading</p>) :
                            <>
                                <div className="table-wrapper mt-3">
                                    {showGraph && <div className="mt-3"
                                        style={{ width: '80%', height: '300px' }}>
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
                                                            {["registered", "reserved", "contract"].map(key => {
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
                                                <Line type="monotone" dataKey="registered" stroke="#0d6efd" name="総反響" />
                                                <Line type="monotone" dataKey="reserved" stroke="#fd7e14" name="面談案内" />
                                                <Line type="monotone" dataKey="contract" stroke="#dc3545" name="契約" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>}
                                    {/* 以下店舗 */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <div style={{ minWidth: `${(monthArray.length + 1) * 80 + 260}px`, fontSize: '12px' }}>
                                            <Table bordered style={{ tableLayout: 'fixed', width: 'auto' }}>
                                                <tbody className='align-middle'>
                                                    {['中専鹿児島店'].map(shop =>
                                                        <><tr>
                                                            <td style={{ width: "200px" }} colSpan={2}>店舗</td>
                                                            {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) =>
                                                                <td className={`text-center ${mIndex === 0 ? 'fw-bold' : ''}`} key={mIndex} style={{ width: '80px' }}>{month}</td>
                                                            )}
                                                        </tr>
                                                            <tr>
                                                                <td rowSpan={3}>{shop}</td>
                                                                <td className='text-dark table-light'>予算</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) => {
                                                                    const base = achievement.filter(a => a.name === shop);
                                                                    return <td key={mIndex} className={`text-center table-light ${mIndex === 0 ? 'fw-bold' : ''}`}>
                                                                        {monthArray.includes(month)
                                                                            ? <input type="text" className='resale_company_input text-secondary text-dark'
                                                                                defaultValue={base.find(a => a.period === month)?.value}
                                                                                onChange={(e) => setAchievementData(prev => ({
                                                                                    ...prev,
                                                                                    name: shop,
                                                                                    value: e.target.value,
                                                                                    period: month
                                                                                }))}
                                                                                onBlur={changeAchievement} />
                                                                            : mIndex === 0
                                                                            && <div className='text-dark'>
                                                                                {base.filter(a => monthArray.includes(a.period.slice(0, 7))).reduce((acc, cur) => acc + Number(cur.value), 0)}
                                                                            </div>}
                                                                        {mIndex > monthArray.length && '-'}
                                                                    </td>
                                                                }
                                                                )}
                                                            </tr>
                                                            <tr>
                                                                <td>実績(差異)</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) => {
                                                                    const contractList = contractCustomers.filter(c => (mIndex > 0 ? c.contract.includes(formate(month)) : true));
                                                                    const performanceValue = contractList.reduce((acc, cur) => acc + Number(cur.broker) + Number(cur.profit) + Number(cur.other), 0);
                                                                    const achievementValue = achievement.filter(a => mIndex === 0 ? monthArray.includes(a.period.slice(0, 7)) : a.period === month).reduce((acc, cur) => acc + Number(cur.value), 0);
                                                                    const upperValue = upperCustomers.reduce((acc, cur) => acc + Number(cur.broker) + Number(cur.profit) + Number(cur.other), 0);
                                                                    const lowerValue = lowerCustomers.reduce((acc, cur) => acc + Number(cur.broker) + Number(cur.profit) + Number(cur.other), 0);
                                                                    return <td key={mIndex} className={`text-center ${mIndex === 0 ? 'fw-bold' : ''}`}>
                                                                        {mIndex <= monthArray.length && <>{performanceValue.toFixed(1)}<span className={`${performanceValue - achievementValue >= 0 ? 'text-primary' : 'text-danger'}`}>({performanceValue - achievementValue >= 0 && '+'}{(performanceValue - achievementValue).toFixed(1)})</span></>}
                                                                        {mIndex === monthArray.length + 1 && upperValue}{mIndex === monthArray.length + 2 && lowerValue}
                                                                    </td>
                                                                }
                                                                )}
                                                            </tr>
                                                            <tr>
                                                                <td>件数</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) => {
                                                                    let targetList: Customer[] = [];
                                                                    if (mIndex === 0) {
                                                                        targetList = contractCustomers;
                                                                    } else if (mIndex > 0 && mIndex <= monthArray.length) {
                                                                        targetList = contractCustomers.filter(c => c.contract.includes(formate(month)));
                                                                    } else if (mIndex === monthArray.length + 1) {
                                                                        targetList = upperCustomers;
                                                                    } else if (mIndex === monthArray.length + 2) {
                                                                        targetList = lowerCustomers;
                                                                    }
                                                                    return <td key={mIndex} className={`text-center ${mIndex === 0 ? 'fw-bold' : ''}`}>
                                                                        <div style={{
                                                                            cursor: targetList.length > 0 ? 'pointer' : '',
                                                                            textDecoration: targetList.length > 0 ? 'underline' : '',
                                                                            color: targetList.length > 0 ? '#007bff' : '',
                                                                        }}
                                                                            onClick={() => targetList.length > 0 ? setCustomerList(targetList) : undefined}>
                                                                            {targetList.length}
                                                                        </div>
                                                                    </td>
                                                                }
                                                                )}
                                                            </tr>
                                                        </>)}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>
                                    {/* 以下スタッフ */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <div style={{ minWidth: `${(monthArray.length + 1) * 80 + 260}px`, fontSize: '12px' }}>
                                            <Table bordered style={{ tableLayout: 'fixed', width: 'auto' }}>
                                                <tbody className='align-middle'>
                                                    {staff.map((staff, staffIndex) =>
                                                        <>
                                                            {staffIndex === 0 && <tr>
                                                                <td style={{ width: "200px" }} colSpan={2}>スタッフ</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) =>
                                                                    <td className={`text-center ${mIndex === 0 ? 'fw-bold' : ''}`} key={mIndex} style={{ width: '80px' }}>{month}</td>
                                                                )}
                                                            </tr>}
                                                            <tr>
                                                                <td rowSpan={3}>{staff.name}</td>
                                                                <td className='table-light text-dark'>予算</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) => {
                                                                    const achievementValue = achievement.filter(a => a.name === staff.name && monthArray.includes(a.period.slice(0, 7))).reduce((acc, cur) => acc + Number(cur.value), 0);
                                                                    return <td key={mIndex} className={`text-center table-light ${mIndex === 0 ? 'fw-bold' : ''}`}>{monthArray.includes(month) ? <input type="text" className='resale_company_input text-secondary text-dark'
                                                                        defaultValue={achievement.find(a => a.name === staff.name && a.period === month)?.value}
                                                                        onChange={(e) => setAchievementData(prev => ({
                                                                            ...prev,
                                                                            name: staff.name,
                                                                            value: e.target.value,
                                                                            period: month
                                                                        }))}
                                                                        onBlur={changeAchievement} />
                                                                        : mIndex === 0
                                                                        && <div className='table-light text-dark'>
                                                                            {achievementValue}
                                                                        </div>}
                                                                        {mIndex > monthArray.length && '-'}
                                                                    </td>
                                                                }
                                                                )}
                                                            </tr>
                                                            <tr>
                                                                <td>実績(差異)</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) => {
                                                                    const contractList = contractCustomers.filter(c => c.staff === staff.name && (mIndex > 0 ? c.contract.includes(formate(month)) : true));
                                                                    const performanceValue = contractList.reduce((acc, cur) => acc + Number(cur.broker) + Number(cur.profit) + Number(cur.other), 0);
                                                                    const achievementValue = achievement.filter(a => a.name === staff.name && (mIndex === 0 ? monthArray.includes(a.period.slice(0, 7)) : a.period === month)).reduce((acc, cur) => acc + Number(cur.value), 0);
                                                                    const upperValue = upperCustomers.filter(c => c.staff === staff.name).reduce((acc, cur) => Number(cur.broker) + Number(cur.profit) + Number(cur.other), 0);
                                                                    const lowerValue = lowerCustomers.filter(c => c.staff === staff.name).reduce((acc, cur) => Number(cur.broker) + Number(cur.profit) + Number(cur.other), 0);
                                                                    return <td key={mIndex} className={`text-center ${mIndex === 0 ? 'fw-bold' : ''}`}>
                                                                        {mIndex <= monthArray.length && <>{performanceValue.toFixed(1)}<span className={`${performanceValue - achievementValue >= 0 ? 'text-primary' : 'text-danger'}`}>({performanceValue - achievementValue >= 0 && '+'}{(performanceValue - achievementValue).toFixed(1)})</span></>}
                                                                        {mIndex === monthArray.length + 1 && upperValue}{mIndex === monthArray.length + 2 && lowerValue}
                                                                    </td>
                                                                }
                                                                )}
                                                            </tr>
                                                            <tr>
                                                                <td>件数</td>
                                                                {['期間計', ...monthArray, '上限', '下限'].map((month, mIndex) => {
                                                                    let targetList: Customer[] = []
                                                                    const base = contractCustomers.filter(c => c.staff === staff.name);
                                                                    if (mIndex === 0) {
                                                                        targetList = base;
                                                                    } else if (mIndex > 0 && mIndex <= monthArray.length) {
                                                                        targetList = base.filter(c => c.contract.includes(formate(month)));
                                                                    } else if (mIndex === monthArray.length + 1) {
                                                                        targetList = upperCustomers.filter(c => c.staff === staff.name);
                                                                    } else if (mIndex === monthArray.length + 2) {
                                                                        targetList = lowerCustomers.filter(c => c.staff === staff.name);
                                                                    }
                                                                    return <td key={mIndex} className={`text-center ${mIndex === 0 ? 'fw-bold' : ''}`}>
                                                                        <div style={{
                                                                            cursor: targetList.length > 0 ? 'pointer' : '',
                                                                            textDecoration: targetList.length > 0 ? 'underline' : '',
                                                                            color: targetList.length > 0 ? '#007bff' : '',
                                                                        }}
                                                                            onClick={() => targetList.length > 0 ? setCustomerList(targetList) : undefined}>
                                                                            {targetList.length}
                                                                        </div>
                                                                    </td>
                                                                }
                                                                )}
                                                            </tr>
                                                        </>)}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </>}
                    </div>
                </div>
            </div>
            <Modal show={modalShow} onHide={modalClose} size='xl'>
                <ModalHeader closeButton></ModalHeader>
                <ModalBody>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '11px' }} className='align-middle'>
                            <tr>
                                <td>No</td>
                                <td>顧客名</td>
                                <td>担当</td>
                                <td>契約日</td>
                                <td style={{ width: '120px' }}>売上</td>
                                <td style={{ width: '60px' }}>物件</td>
                                <td style={{ width: '60px' }}>仲介手数料</td>
                                <td style={{ width: '60px' }}>リフォーム請負</td>
                                <td style={{ width: '60px' }}>リフォーム粗利</td>
                                <td style={{ width: '60px' }}>その他</td>
                            </tr>
                            {customerList.map((c, cIndex) => {
                                const totalValue = Number(c.property) + Number(c.renovation);
                                return (
                                    <>
                                        <tr>
                                            <td>{cIndex + 1}</td>
                                            <td>{c.name}</td>
                                            <td>{c.staff}</td>
                                            <td>{c.contract}</td>
                                            <td className='table-primary text-primary' style={{ textAlign: 'right' }}>{totalValue}</td>
                                            <td className='table-primary'>
                                                <input step="any" type="number" style={{ MozAppearance: "textfield", textAlign: 'right' }}
                                                    className="no-spin target budget text-primary" defaultValue={c.property}
                                                    onChange={(e) => setPerformanceData(prev => ({
                                                        ...prev,
                                                        id: c.id_related,
                                                        property: Number(e.target.value)
                                                    }))}
                                                    onBlur={changePerformance}
                                                /></td>
                                            <td className='table-primary'>
                                                <input step="any" type="number" style={{ MozAppearance: "textfield", textAlign: 'right' }}
                                                    className="no-spin target budget text-primary" defaultValue={c.broker}
                                                    onChange={(e) => setPerformanceData(prev => ({
                                                        ...prev,
                                                        id: c.id_related,
                                                        broker: Number(e.target.value)
                                                    }))}
                                                    onBlur={changePerformance}
                                                /></td>
                                            <td className='table-primary'>
                                                <input step="any" type="number" style={{ MozAppearance: "textfield", textAlign: 'right' }}
                                                    className="no-spin target budget text-primary" defaultValue={c.renovation}
                                                    onChange={(e) => setPerformanceData(prev => ({
                                                        ...prev,
                                                        id: c.id_related,
                                                        renovation: Number(e.target.value)
                                                    }))}
                                                    onBlur={changePerformance}
                                                /></td>
                                            <td className='table-primary'>
                                                <input step="any" type="number" style={{ MozAppearance: "textfield", textAlign: 'right' }}
                                                    className="no-spin target budget text-primary" defaultValue={c.profit}
                                                    onChange={(e) => setPerformanceData(prev => ({
                                                        ...prev,
                                                        id: c.id_related,
                                                        profit: Number(e.target.value)
                                                    }))}
                                                    onBlur={changePerformance}
                                                /></td>
                                            <td className='table-primary'>
                                                <input step="any" type="number" style={{ MozAppearance: "textfield", textAlign: 'right' }}
                                                    className="no-spin target budget text-primary" defaultValue={c.other}
                                                    onChange={(e) => setPerformanceData(prev => ({
                                                        ...prev,
                                                        id: c.id_related,
                                                        other: Number(e.target.value)
                                                    }))}
                                                    onBlur={changePerformance}
                                                /></td>
                                        </tr>
                                    </>
                                )
                            }
                            )}
                        </tbody>
                    </Table>
                </ModalBody>
                <ModalFooter></ModalFooter>
            </Modal>
        </>
    )
}

export default ResalePerformance