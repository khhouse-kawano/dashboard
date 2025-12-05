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
type Customer = { id: string; name: string; status: string; medium: string; rank: string; register: string; reserve: string; shop: string; estate: string; meeting: string; appointment: string; line_group: string; screening: string; rival: string; period: string; survey: string; budget: string; importance: string; note: string; staff: string; section: string; contract: string; sales_meeting: string; latest_date: string; last_meeting: string; }
type Goal = { id: number; period: string; section: string; goal: number; }
type ReserveGoal = { id: number; date: string; shop: string; category: string; goal: number; }

const CalendarCampaign: React.FC<CalendarListProps> = ({ activeTab }) => {
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
        const yearMonthArray: string[] = [];
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
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "all_customer" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_goal" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "reserve_goal" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "reserve_calendar" }, { headers }),
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
        const uniqueList = [...new Map(filtered.map(item => [`${item.event}_${item.shop}`, item])).values()]
        setTargetList(uniqueList);
    }, [originalCustomer, selectedMonth]);

    const totalFilter = useMemo(() => {
        return originalCalendar.filter(item => item.date.replace(/-/g, '/').includes(selectedMonth));
    }, [originalCustomer, selectedMonth]);

    return (
        <div className="table-wrapper">
            <div className="list_table">
                <div className="custom-calendar">
                    <div className="row mt-3 mb-4" >
                        <div className="col d-flex">
                            <select className="target" name="startMonth" onChange={(e) => setSelectedMonth(e.target.value)}>
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
                                <td style={{ width: '160px' }}></td>
                                <td style={{ width: '160px' }}></td>
                                <td className='table-danger' style={{ width: '80px', textAlign: 'center' }}>総新規</td>
                                <td className='table-primary' style={{ width: '80px', textAlign: 'center' }}>有効新規</td>
                                <td className='table-success' style={{ width: '80px', textAlign: 'center' }}>次アポ数</td>
                                <td className='table-secondary' style={{ width: '80px', textAlign: 'center' }}>管理客</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                                <td>全キャンペーン</td>
                                <td>全店舗</td>
                                <td className='table-danger'>{totalFilter.filter(value => value.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                <td className='table-primary'>{totalFilter.filter(value => value.category === 'new').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                <td className='table-success'>{totalFilter.filter(value => value.category === 'next').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                <td className='table-secondary'>{totalFilter.filter(value => value.category === 'registered').reduce((acc, cur) => acc + cur.count, 0)}</td>
                            </tr>
                            {targetList.sort((a, b) =>{
                                const CountA = totalFilter.filter(value => value.event === a.event && value.shop === a.shop && value.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0);
                                const CountB = totalFilter.filter(value => value.event === b.event && value.shop === b.shop && value.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0);
                                return CountB - CountA}).map(item =>
                                <tr style={{ textAlign: 'center', fontSize: '12px' }}>
                                    <td>{item.event}</td>
                                    <td>{item.shop}</td>
                                    <td className='table-danger'>{totalFilter.filter(value => value.event === item.event && value.shop === item.shop && value.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                    <td className='table-primary'>{totalFilter.filter(value => value.event === item.event && value.shop === item.shop && value.category === 'new').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                    <td className='table-success'>{totalFilter.filter(value => value.event === item.event && value.shop === item.shop  && value.category === 'next').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                    <td className='table-secondary'>{totalFilter.filter(value => value.event === item.event && value.shop === item.shop  && value.category === 'registered').reduce((acc, cur) => acc + cur.count, 0)}</td>
                                </tr>)}

                        </tbody>
                    </Table>
                </div></div></div>
    );
};

export default CalendarCampaign