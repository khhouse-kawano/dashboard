import React, { useState, useEffect, useContext, useMemo } from 'react';
import 'react-calendar/dist/Calendar.css';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import NavItem from 'react-bootstrap/esm/NavItem.js';

interface CalendarListProps {
    activeTab: string | null;
}
type Shop = { brand: string; shop: string; section: string; area: string; }
type Calendar = { id: number; startDate: string; endDate: string; category: string; title: string; shop: string; flag: number; }
type Event = { shop: string; event: string; date: string; count: number; category: string; }
type Customer = { id: string; name: string; status: string; medium: string; rank: string; register: string; reserve: string; shop: string; estate: string; meeting: string; appointment: string; line_group: string; screening: string; rival: string; period: string; survey: string; budget: string; importance: string; note: string; staff: string; section: string; contract: string; sales_meeting: string; latest_date: string; last_meeting: string;}
type Goal = { id: number; period: string; section: string; goal: number;}
type ReserveGoal = { id: number; date: string; shop: string; category: string; goal: number;}

const CalendarTable: React.FC<CalendarListProps> = ({ activeTab }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [calendarArray, setCalendarArray] = useState<Calendar[]>([]);
    const [originalCalendar, setOriginalCalendar] = useState<Event[]>([]);
    const [targetList, setTargetList] = useState<Event[]>([]);
    const [originalCustomer, setOriginalCustomer] = useState<Customer[]>([]);
    const [contractedCustomer, setContractedCustomer] = useState<Customer[]>([]);
    const [registeredCustomer, setRegisteredCustomer] = useState<Customer[]>([]);
    const [rankACustomer, setRankACustomer] = useState<Customer[]>([]);
    const [goal, setGoal] = useState<Goal[]>([]);
    const [originalGoal, setOriginalGoal] = useState<Goal[]>([]);
    const [originalReserveGoal, setOriginalReserveGoal] = useState<ReserveGoal[]>([]);
    const [reserveGoal, setReserveGoal] = useState<ReserveGoal[]>([]);

    const getYearMonthArray = (startYear: number, startMonth: number) => {
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
            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
        }

        return yearMonthArray;
    };
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}/${month}/${day}`;

    useEffect(() => {
        const monthArray = getYearMonthArray(2025, 1);
        setMonthArray(monthArray);
        setSelectedMonth(`${String(year)}/${month}`)

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerRes, shopRes, goalRes, reserveGoalRes, calendarRes] = await Promise.all([
                    axios.post("/dashboard/api/", { demand: "all_customer" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "contract_goal" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "reserve_goal" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "reserve_calendar" }, { headers }),
                ]);
                
                await setOriginalCustomer(customerRes.data);
                await setShopArray(shopRes.data);
                await setOriginalGoal(goalRes.data);
                await setOriginalReserveGoal(reserveGoalRes.data);
                await setOriginalCalendar(calendarRes.data);    
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [])

    useEffect(() => {
        const filtered = originalCalendar.filter(item => item.date.replace(/-/g, '/').includes(selectedMonth));
        setTargetList(filtered);
        setContractedCustomer(totalContractedFilter);
        setRegisteredCustomer(totalRegisteredFilter);
        setGoal(goalFilter);
        setReserveGoal(reserveGoalFilter);
        setRankACustomer(rankAFilter);
    }, [originalCalendar, originalCustomer, selectedMonth])

    const totalContractedFilter = useMemo(() => {
        return originalCustomer.filter(item => item.contract?.includes(selectedMonth));
    }, [originalCustomer, selectedMonth]);

    const totalRegisteredFilter = useMemo(() => {
        return originalCustomer.filter(item => item.reserve?.includes(selectedMonth));
    }, [originalCustomer, selectedMonth]);

    const goalFilter= useMemo(()=>{
        return originalGoal.filter(item => item.period?.includes(selectedMonth));
    }, [originalGoal, selectedMonth])

    const rankAFilter= useMemo(()=>{
        return originalCustomer.filter(item => item.rank === 'Aランク' && item.status !== '契約済み');
    }, [originalCustomer, selectedMonth])

    const reserveGoalFilter = useMemo(()=>{
        return originalReserveGoal.filter(item => item.date === selectedMonth && item.category === 'reserve');
    }, [originalReserveGoal, selectedMonth])

    return (
        <div className="custom-calendar">
            <div className="row mt-3 mb-4" >
                <div className="col d-flex">
                    <select className="form-select campaign" name="startMonth" onChange={(e)=>setSelectedMonth(e.target.value)}>
                        <option value="20">全期間</option>
                        {monthArray.map((startMonth, index) => (
                            <option key={index} value={startMonth} selected={selectedMonth === startMonth}>{startMonth}</option>
                        ))}
                    </select>
                </div>
                <div className="col-8"></div>
            </div>
            <Table bordered striped>
                <thead style={{ fontSize: '12px', textAlign: 'center' }}>
                    <tr>
                        <td style={{width: '160px'}}></td>
                        <td className='table-danger' style={{width: '170px', textAlign: 'center'}}>総新規</td>
                        <td className='table-primary' style={{width: '170px', textAlign: 'center'}}>有効新規</td>
                        <td className='table-success' style={{width: '170px', textAlign: 'center'}}>次アポ数</td>
                        <td className='table-secondary' style={{width: '170px', textAlign: 'center'}}>管理客</td>
                        <td style={{ fontSize: '14px'}}>契約者数<span style={{ fontSize: '12px'}} className='text-primary'> (契約見込み数)</span></td>
                        <td>契約目標</td>
                        <td style={{ fontSize: '14px'}}>契約者目標達成率<span style={{ fontSize: '12px'}} className='text-primary'> (見込み達成率)</span></td>
                        <td>
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{fontSize: "12px"}}>PG CLOUDに登録済みの初回来場者数</Tooltip>}>
                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>初回来場者数</span>
                            </OverlayTrigger>
                        </td>
                        <td>来場目標</td>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{textAlign: 'center', fontSize: '13px', fontWeight: 'bold'}}>
                        <td>グループ全体</td>
                        <td className='table-danger'>{targetList.filter(value => value.category === 'reserved' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0)}</td>
                        <td className='table-primary'>{targetList.filter(value => value.category === 'new' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0)}</td>
                        <td className='table-success'>{targetList.filter(value => value.category === 'next' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0)}</td>
                        <td className='table-secondary'>{targetList.filter(value => value.category === 'registered' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0)}</td>
                        <td style={{fontSize: '14px'}}>{contractedCustomer.length}{selectedMonth === `${String(year)}/${month}` ? <span style={{fontSize: '12px'}} className='text-primary'> ({ contractedCustomer.length + rankACustomer.length})</span> : null }</td>
                        <td>{goal.filter(item=> item.section === '注文営業全体').reduce(( acc, cur) => acc + cur.goal, 0)}</td>
                        <td style={{ fontSize: '14px' }}>{ Number.isFinite(contractedCustomer.length / goal.filter(item=> item.section === '注文営業全体').reduce(( acc, cur) => acc + cur.goal, 0)) ? <>{Math.ceil(contractedCustomer.length / goal.filter(item=> item.section === '注文営業全体').reduce(( acc, cur) => acc + cur.goal, 0) * 100)}%
                        {selectedMonth === `${String(year)}/${month}` ? <span style={{ fontSize: '12px' }} className='text-primary'> ({Math.ceil( (contractedCustomer.length + rankACustomer.length) / goal.filter(item=> item.section === '注文営業全体').reduce(( acc, cur) => acc + cur.goal, 0) * 100)}%)</span> : null }</> : 0}</td>
                        <td>{registeredCustomer.length}</td>
                        <td>{reserveGoal.reduce(( acc, cur) => acc + cur.goal, 0)}</td>
                    </tr>
                    {(() =>{
                        const brandArray = [ ...new Set(shopArray.filter(item=>item.brand !== 'FH' && item.brand !== 'KHG').map( item => item.brand))];
                        return(<>{brandArray.map( (item, index)=>{
                            let formattedBrand: string;
                            if (item === 'DJH'){
                                formattedBrand = 'DJ';
                            } else if (item === 'PGH'){
                                formattedBrand = 'PG';
                            } else if (item === 'なごみ'){
                                formattedBrand = 'なご';
                            } else {
                                formattedBrand = item;
                            }
                            const reservedCustomerLength = targetList.filter(value => value.shop.slice(0, 2) === formattedBrand && value.category === 'reserved' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                            const newCustomerLength = targetList.filter(value =>value.shop.slice(0, 2) === formattedBrand && value.category === 'new' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                            const nextCustomerLength = targetList.filter(value => value.shop.slice(0, 2) === formattedBrand && value.category === 'next' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                            const registeredCustomerLength = targetList.filter(value => value.shop.slice(0, 2) === formattedBrand && value.category === 'registered' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                            const contractCustomerLength = contractedCustomer.filter(value => value.shop.slice(0, 2) === formattedBrand).length;
                            const registeredPGCustomerLength = registeredCustomer.filter(value => value.shop.slice(0, 2) === formattedBrand).length;
                            const rankACustomerLength = rankACustomer.filter(value => value.shop.slice(0, 2) === formattedBrand).length;
                            const shopContractGoal = goal.filter(value => value.section.slice(0, 2) === formattedBrand).reduce((acc, cur) => acc + cur.goal, 0);
                            const shopContractGoalLength = shopContractGoal ? shopContractGoal : 0;
                            const shopReserveGoal = reserveGoal.filter(value => value.shop.slice(0, 2) === formattedBrand).reduce((acc, cur) => acc + cur.goal, 0);
                            return(
                                <tr key={index} style={{textAlign: 'center', fontSize: '13px', fontWeight: 'bold'}}>
                                    <td>{item}全体</td>
                                    <td className='table-danger'>{reservedCustomerLength}</td>
                                    <td className='table-primary'>{newCustomerLength}</td>
                                    <td className='table-success'>{nextCustomerLength}</td>
                                    <td className='table-secondary'>{registeredCustomerLength}</td>
                                    <td style={{fontSize: '14px'}}>{contractCustomerLength}{selectedMonth === `${String(year)}/${month}` ? <span style={{fontSize: '12px'}} className='text-primary'> ({ contractCustomerLength + rankACustomerLength})</span> : null }</td>
                                    <td>{shopContractGoalLength ? shopContractGoalLength : '-'}</td>
                                    <td style={{fontSize: '14px'}}>{ Number.isFinite(contractCustomerLength / shopContractGoalLength) ? <>{Math.ceil(contractCustomerLength / shopContractGoalLength * 100)}%
                                        {selectedMonth === `${String(year)}/${month}` ? <span style={{fontSize: '12px'}} className='text-primary'> ({Math.ceil((contractCustomerLength + rankACustomerLength) / shopContractGoalLength * 100)}%)</span> : null}</> : '-'}</td>
                                    <td>{registeredPGCustomerLength}</td>
                                    <td>{shopReserveGoal ? shopReserveGoal : '-'}</td>
                                </tr>
                        )})}</>
                                                    )
                    })()}
                    {shopArray.filter(item=>!item.shop.includes('未設定') && !item.shop.includes('FH')).map((item, index) => {
                        const reservedCustomerLength = targetList.filter(value => value.shop === item.shop && value.category === 'reserved' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                        const newCustomerLength = targetList.filter(value => value.shop === item.shop && value.category === 'new' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                        const nextCustomerLength = targetList.filter(value => value.shop === item.shop && value.category === 'next' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                        const registeredCustomerLength = targetList.filter(value => value.shop === item.shop && value.category === 'registered' && value.date.replace(/-/g, '/').includes(selectedMonth)).reduce((acc, cur) => acc + cur.count, 0);
                        const contractCustomerLength = contractedCustomer.filter(value => value.shop === item.shop).length;
                        const registeredPGCustomerLength = registeredCustomer.filter(value => value.shop === item.shop).length;
                        const rankACustomerLength = rankACustomer.filter(value => value.shop === item.shop).length;
                        const shopContractGoal = goal.find(value => value.section === item.shop);
                        const shopContractGoalLength = shopContractGoal ? shopContractGoal.goal : 0;
                        const shopReserveGoal = reserveGoal.find(value => value.shop === item.shop);
                        return (
                            <tr key={index} style={{textAlign: 'center', fontSize: '12px'}}>
                                <td>{item.shop}</td>
                                <td className='table-danger'>{reservedCustomerLength}</td>
                                <td className='table-primary'>{newCustomerLength}</td>
                                <td className='table-success'>{nextCustomerLength}</td>
                                <td className='table-secondary'>{registeredCustomerLength}</td>
                                <td style={{fontSize: '14px'}}>{contractCustomerLength}{selectedMonth === `${String(year)}/${month}` ? <span style={{fontSize: '12px'}} className='text-primary'> ({rankACustomerLength})</span> : null }</td>
                                <td>{shopContractGoalLength ? shopContractGoalLength : '-'}</td>
                                <td style={{fontSize: '14px'}}>{ Number.isFinite(contractCustomerLength / shopContractGoalLength) ? <>{Math.ceil(contractCustomerLength / shopContractGoalLength * 100)}%
                                {selectedMonth === `${String(year)}/${month}` ? <span style={{fontSize: '12px'}} className='text-primary'> ({Math.ceil((contractCustomerLength + rankACustomerLength) / shopContractGoalLength * 100)}%)</span> : null}</> : '-'}</td>
                                <td>{registeredPGCustomerLength}</td>
                                <td>{shopReserveGoal?.goal ? shopReserveGoal.goal : '-'}</td>
                            </tr>)
                    })}
                </tbody>
            </Table>
        </div>
    );
};

export default CalendarTable