import React, { useState, useEffect, useContext, useCallback } from 'react'
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import Table from "react-bootstrap/Table";
import axios from "axios";
import { colorCodes } from "../utils/colors";
import Modal from 'react-bootstrap/Modal';
import IceWorld from './IceWorld';

type Calendar = { id: number, shop: string, startDate: string, endDate: string, category: string, title: string, flag: number, color: string, note: string, url: string };
type ResponseChange = {
    id: number | null,
    shop: string,
    startDate: string,
    endDate: string,
    category: string,
    title: string,
    flag: number,
    color: string,
    date: string,
    reserved: number | null,
    new: number | null,
    next: number | null,
    registered: number | null,
    note: string,
    url: string
};
type Shop = { brand: string, shop: string };
type ColoredEvent = Calendar & {
    color: string;
};
type CalendarListItem = {
    date: number;
    shop: string;
    event: ColoredEvent[];
};
type CalendarList = CalendarListItem[][];
type Response = { id: number, shop: string, event: string, date: string, count: number, category: string, url: string, note: string };
type ModalList = { id: number, startDate: string, endDate: string, category: string, title: string, flag: number, shop: string, reserved: number, url: string, note: string };
type Customer = { register: string, reserve: string, shop: string, contract: string, section: string, second_reserve: string };

const Company = () => {
    const { brand, token, category } = useContext(AuthContext);
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [targetMonth, setTargetMonth] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [display, setDisplay] = useState('shop');

    const [weeks, setWeeks] = useState<any[][]>([]);
    const [calendar, setCalendar] = useState<Calendar[]>([]);
    const [shopList, setShopList] = useState<Shop[]>([]);

    const [eventShopList, setEventShopList] = useState<Calendar[][][]>([]); //店舗別用
    const [eventList, setEventList] = useState<CalendarList>([]); //一覧表示用
    const [firstDay, setFirstDay] = useState<number>(0);
    const [lastDay, setLastDay] = useState<number>(0);

    const [originalResponse, setOriginalResponse] = useState<Response[]>([]);
    const [response, setResponse] = useState<Response[]>([]);

    const [show, setShow] = useState(false);
    const [modalList, setModalList] = useState<ModalList[][]>([]);
    const [modalOriginalList, setModalOriginalList] = useState<ModalList[]>([]);
    const [modalDay, setModalDay] = useState<number>(0);
    const [allShop, setAllShop] = useState(false);

    const [eventData, setEventData] = useState<ResponseChange>({
        id: null,
        shop: '',
        startDate: '',
        endDate: '',
        category: '',
        title: '',
        flag: 1,
        color: '',
        date: '',
        reserved: null,
        new: null,
        next: null,
        registered: null,
        note: '',
        url: ''
    });
    const [newEventData, setNewEventData] = useState<ResponseChange>({
        id: null,
        shop: '',
        startDate: '',
        endDate: '',
        category: '',
        title: '',
        flag: 1,
        color: '',
        date: '',
        reserved: null,
        new: null,
        next: null,
        registered: null,
        note: '',
        url: ''
    });
    const [showNote, setShowNote] = useState(false);
    const [modalNote, setModalNote] = useState('');
    const [modalUrl, setModalUrl] = useState('');
    const [listShop, setListShop] = useState('');

    const [summary, setSummary] = useState(false);
    const [customer, setCustomer] = useState<Customer[]>([]);
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const editId = params.get('id');

    // 共通
    const youbi = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    const todayDate = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
    const url = 'https://khg-marketing.info/dashboard/api/';
    const numberKey = ['reserved', 'new', 'next', 'registered'];
    const eventKey = ['title', 'startDate', 'endDate', 'note', 'url'];

    useEffect(() => {
        if (!brand || !token || !category) {
            navigate("/login");
            return;
        }

        setTargetMonth(`${year}/${String(month).padStart(2, '0')}`);


        const fetchData = async () => {
            const [calendarRes, shopRes, calenderRegisterRes] = await Promise.all([
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "event_calendar" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                axios.post("https://khg-marketing.info/dashboard/api/", { demand: "calendar_list" }, { headers }),
            ]);
            setCalendar(calendarRes.data);
            setModalOriginalList(calendarRes.data);
            setShopList(shopRes.data);
            setOriginalResponse(calenderRegisterRes.data);
        };

        fetchData();

        if (editId) {
            setTargetShop('iceWorld');
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_list" }, { headers });
            setCustomer(response.data);
        };

        fetchData();
    }, [summary]);


    useEffect(() => {
        if (!targetMonth) return;

        const [year, month] = targetMonth.split('/').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);

        if (display === 'shop') {
            const firstDayOfWeek = start.getDay();
            const daysInMonth = end.getDate();
            const cells = Array.from({ length: 42 }, (_, i) => {
                const date = i - firstDayOfWeek + 1;
                return {
                    date,
                    isCurrentMonth: date >= 1 && date <= daysInMonth
                };
            });

            const weekRows = Array.from({ length: 6 }, (_, i) =>
                cells.slice(i * 7, i * 7 + 7)
            );
            setWeeks(weekRows);
        } else {
            setFirstDay(start.getDay());
            setLastDay(end.getDate());
        }
    }, [targetMonth, display]);

    const getColoredEvents = useCallback(() => {
        const [year, month] = targetMonth.split('/').map(Number);
        const monthStart = new Date(year, month - 1, 1).getTime();
        const monthEnd = new Date(year, month, 0).getTime();

        return calendar
            .filter(c => {
                const start = new Date(c.startDate + "T00:00:00").getTime();
                const end = new Date(c.endDate + "T23:59:59").getTime();
                return !(end < monthStart || start > monthEnd) && (targetShop ? c.shop === targetShop : true);
            })
            .sort((a, b) =>
                new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            )
            .map((c, i) => ({
                ...c,
                color: colorCodes[i]
            }));
    }, [calendar, targetMonth, targetShop, display, modalOriginalList]);

    const getColoredShopEvents = useCallback(() => {
        const [year, month] = targetMonth.split('/').map(Number);
        const monthStart = new Date(year, month - 1, 1).getTime();
        const monthEnd = new Date(year, month, 0).getTime();

        return calendar
            .filter(c => {
                const start = new Date(c.startDate + "T00:00:00").getTime();
                const end = new Date(c.endDate + "T23:59:59").getTime();
                return !(end < monthStart || start > monthEnd);
            })
            .sort((a, b) =>
                new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            )
            .map((c, i) => ({
                ...c,
                color: colorCodes[i % colorCodes.length]
            }));
    }, [calendar, targetMonth]);


    useEffect(() => {
        const [year, month] = targetMonth.split('/').map(Number);
        const end = new Date(year, month, 0);

        if (display === 'shop') {
            const coloredEvents = getColoredEvents();
            if (!weeks.length || !calendar.length) return;

            const newEventShopList = weeks.map(week =>
                week.map(cell => {
                    if (!cell.isCurrentMonth) return [];

                    const thisDate = new Date(year, month - 1, cell.date).getTime();

                    return coloredEvents.filter(c => {
                        const start = new Date(c.startDate + "T00:00:00").getTime();
                        const end = new Date(c.endDate + "T23:59:59").getTime();
                        return thisDate >= start && thisDate <= end && c.flag === 1;
                    });
                })
            );
            setEventShopList(newEventShopList);
            const filteredModalList = [...Array(end.getDate())].map((_, index) => {
                const thisDate = new Date(year, month - 1, index + 1).getTime();

                const list = modalOriginalList.filter(m => {
                    const start = new Date(m.startDate + "T00:00:00").getTime();
                    const end = new Date(m.endDate + "T23:59:59").getTime();
                    return thisDate >= start && thisDate <= end && m.flag === 1 && (targetShop ? targetShop === m.shop : true);
                });

                return list;
            });
            setModalList(filteredModalList);
        } else {
            if (!calendar.length || !lastDay) return;
            const coloredEvents = getColoredShopEvents();
            const monthDays = Array.from({ length: lastDay }, (_, i) => i);
            const newEventList = shopList
                .filter(s => !s.shop.includes("未設定"))
                .map(s => {
                    const shopEvents = coloredEvents.filter(e => e.shop === s.shop);
                    return monthDays.map(day => {
                        const date = day + 1;
                        const thisDate = new Date(year, month - 1, date).getTime();
                        const filteredEvents = shopEvents.filter(e => {
                            const start = new Date(e.startDate + "T00:00:00").getTime();
                            const end = new Date(e.endDate + "T23:59:59").getTime();
                            return thisDate >= start && thisDate <= end && e.flag === 1;
                        });
                        return {
                            shop: s.shop,
                            date,
                            event: filteredEvents
                        };
                    });
                });
            setEventList(newEventList);
            const filteredModalList = [...Array(end.getDate())].map((_, index) => {
                const thisDate = new Date(year, month - 1, index + 1).getTime();

                const list = modalOriginalList.filter(m => {
                    const start = new Date(m.startDate + "T00:00:00").getTime();
                    const end = new Date(m.endDate + "T23:59:59").getTime();
                    return thisDate >= start && thisDate <= end && m.flag === 1;
                });
                return list;
            });
            setModalList(filteredModalList);
        }

        const filteredResponse = originalResponse.filter(r => (targetShop ? r.shop === targetShop : true) && r.date.includes(targetMonth.replace('/', '-')));
        setResponse(filteredResponse);
    }, [weeks, calendar, targetMonth, targetShop, display, lastDay, modalOriginalList, getColoredEvents]);

    const nextMonth = () => {
        const [year, month] = targetMonth.split('/').map(Number);
        const next = new Date(year, month, 1);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, '0');
        setTargetMonth(`${y}/${m}`);
    };

    const beforeMonth = () => {
        const [year, month] = targetMonth.split('/').map(Number);
        const prev = new Date(year, month - 2, 1);
        const y = prev.getFullYear();
        const m = String(prev.getMonth() + 1).padStart(2, '0');
        setTargetMonth(`${y}/${m}`);
    };

    const modalOpen = async (date: number) => {
        setModalDay(date);
        setShowNote(false);
        setShow(true);
    };

    const modalClose = async () => {
        const hasInput =
            newEventData.title ||
            newEventData.startDate ||
            newEventData.endDate;

        if (hasInput) {
            const ok = window.confirm("登録途中のイベントがありますが閉じますか？");
            if (!ok) return; // キャンセルなら終了
        }

        if (targetShop === 'iceWorld') {
            setTargetShop('');
        }
        setShow(false);
        setSummary(false);
    };

    const addEvent = async () => {
        if (!newEventData.title || !newEventData.startDate || !newEventData.endDate) {
            alert('未入力項目があります');
            return;
        }

        if (allShop) {
            if (window.confirm("全店舗にイベントを登録しますか？")) {
                const brandValue = targetShop.slice(0, 2);
                const targets = shopList.filter(
                    s => s.brand.slice(0, 2) === brandValue && !s.shop.includes('未設定')
                );

                for (const s of targets) {
                    try {
                        const response = await axios.post(url, {
                            ...newEventData,
                            shop: s.shop,
                            demand: 'calendar_add'
                        }, { headers });

                        setCalendar(response.data);
                        setModalOriginalList(response.data);

                    } catch (error) {
                        console.error("エラー:", error);
                    }
                }
            }

        } else {
            if (window.confirm("イベントを登録しますか？")) {
                const postData = {
                    ...newEventData,
                    shop: targetShop,
                    demand: 'calendar_add'
                };
                const fetchData = async () => {
                    const response = await axios.post(url, postData, { headers });
                    setCalendar(response.data);
                    setModalOriginalList(response.data);
                };
                await fetchData();
            }
        }


        setNewEventData({
            id: null,
            shop: '',
            startDate: '',
            endDate: '',
            category: '',
            title: '',
            flag: 1,
            color: '',
            date: '',
            reserved: null,
            new: null,
            next: null,
            registered: null,
            note: '',
            url: ''
        });
    };

    const changeEvent = async () => {
        console.log(eventData);
        const requestArray: string[] = [];
        if (eventData.title !== '') requestArray.push('title');
        if (eventData.startDate !== '') requestArray.push('startDate');
        if (eventData.endDate !== '') requestArray.push('endDate');
        if (eventData.reserved !== null) requestArray.push('reserved');
        if (eventData.new !== null) requestArray.push('new');
        if (eventData.next !== null) requestArray.push('next');
        if (eventData.registered !== null) requestArray.push('registered');
        if (eventData.note !== '') requestArray.push('note');
        if (eventData.url !== '') requestArray.push('url');

        if (numberKey.some(n => requestArray.includes(n))) {
            const postData = {
                ...eventData,
                id: eventData.id ?? 0,
                demand: 'calendar_change',
                request: 'response_change',
                requestArray: requestArray
            };
            const fetchData = async () => {
                const response = await axios.post(url, postData, { headers });
                setOriginalResponse(response.data);
            };
            await fetchData();
        }

        if (eventKey.some(n => requestArray.includes(n))) {
            const postData = {
                ...eventData,
                demand: 'calendar_change',
                request: 'calendar_change',
                requestArray: requestArray
            };
            console.log(postData)
            const fetchData = async () => {
                const response = await axios.post(url, postData, { headers });
                setCalendar(response.data);
                setModalOriginalList(response.data);
            };
            await fetchData();
        }

        setEventData({
            id: null,
            shop: '',
            startDate: '',
            endDate: '',
            category: '',
            title: '',
            flag: 1,
            color: '',
            date: '',
            reserved: null,
            new: null,
            next: null,
            registered: null,
            note: '',
            url: ''
        });

    };

    const deleteEvent = async (idValue: number) => {
        const url = 'https://khg-marketing.info/dashboard/api/';
        const postData = {
            id: idValue,
            demand: 'calendar_change',
            request: 'delete_calendar'
        }

        const fetchData = async () => {
            const response = await axios.post(url, postData, { headers });
            console.log(postData)
            console.log(response.data)

            setCalendar(response.data);
            setModalOriginalList(response.data);
        };
        if (window.confirm("削除してもよろしいですか？")) {
            await fetchData();
        } else {
            return;
        }

        setEventData({
            id: null,
            shop: '',
            startDate: '',
            endDate: '',
            category: '',
            title: '',
            flag: 1,
            color: '',
            date: '',
            reserved: null,
            new: null,
            next: null,
            registered: null,
            note: '',
            url: ''
        });
    };


    return (
        <>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}>
                    <MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i className="fa-solid fa-bars hamburger" onClick={() => setOpen(true)} />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i className="fa-solid fa-xmark hamburger position-absolute" onClick={() => setOpen(false)} />
                    <MenuDev brand={brand} />
                </div>
                <div className='bg-white p-0 w-100'>
                    <div className="event_calender">
                        <div className="d-flex justify-content-between global_bar my-3 align-items-center calendar_menu">
                            <div onClick={beforeMonth} className='bg-primary text-white py-2 px-3 rounded-pill' style={{ cursor: 'pointer' }}>前の月</div>
                            <div className="d-flex align-items-center position-relative">
                                <div className="me-2">{targetMonth.replace('/', '年')}月</div>
                                <div className="me-2">
                                    <div onClick={() => {
                                        setShow(true);
                                        setSummary(true);
                                    }} className='bg-light text-dark border py-2 px-4 rounded-pill' style={{ cursor: 'pointer' }}>
                                        反響集計
                                    </div>
                                </div>
                                <div className="me-2">
                                    <div onClick={() => setTargetMonth(`${year}/${String(month).padStart(2, '0')}`)}
                                        className='bg-light text-dark border py-2 px-4 rounded-pill'
                                        style={{ cursor: 'pointer' }}>
                                        今月
                                    </div>
                                </div>
                                <div className="me-2">
                                    <div onClick={() => {
                                        setListShop('');
                                        setDisplay(display === 'list' ? 'shop' : 'list');
                                    }} className='bg-light text-dark border py-2 px-4 rounded-pill' style={{ cursor: 'pointer' }}>
                                        {display === 'list' && '店舗表示'}{display === 'shop' && '全体表示'}
                                    </div>
                                </div>
                                <div className='me-2'>
                                    <select className='target' onChange={(e) => setTargetShop(e.target.value)} disabled={display === 'list'}>
                                        <option value="" selected={targetShop === ''}>店舗を選択</option>
                                        <option value="iceWorld">アイスワールド</option>
                                        {shopList.map((shop, index) => <option value={shop.shop} key={index} selected={targetShop === shop.shop}>{shop.shop}</option>)}
                                    </select>
                                </div>
                                {display === 'shop' && <div className="calendarResponse menu">
                                    <div className="d-flex">
                                        <div className="response sample register px-2">新規来場者:{response.filter(r => r.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                        <div className="response sample new px-2">有効新規数:{response.filter(r => r.category === 'new').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                        <div className="response sample appointment px-2">次アポ数:{response.filter(r => r.category === 'next').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                        <div className="response sample listed px-2">管理客:{response.filter(r => r.category === 'registered').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                    </div>
                                </div>}
                            </div>
                            <div onClick={nextMonth} className='bg-primary text-white py-2 px-3 rounded-pill' style={{ cursor: 'pointer' }}>次の月</div>
                        </div>
                        <div className="calendar_area">
                            {display === 'shop' ? <Table striped>
                                <tbody className='shop_calendar'>
                                    <tr>
                                        {youbi.map((item, i) => (
                                            <td key={i}>{item}曜日</td>
                                        ))}
                                    </tr>
                                    {weeks.map((week, weekIndex) => (
                                        <tr key={weekIndex}>
                                            {week.map((cell, youbiIndex) => {
                                                const dateValue = `${targetMonth.replace('/', '-')}-${String(cell.date).padStart(2, '0')}`;
                                                const base = response.filter(r => r.date === dateValue);
                                                const reservedLength = base.filter(b => b.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0);
                                                const newLength = base.filter(b => b.category === 'new').reduce((acc, cur) => acc + cur.count, 0);
                                                const nextLength = base.filter(b => b.category === 'next').reduce((acc, cur) => acc + cur.count, 0);
                                                const registeredLength = base.filter(b => b.category === 'registered').reduce((acc, cur) => acc + cur.count, 0);
                                                return (
                                                    <td key={youbiIndex} className="shop_calendar_cell" onClick={() => modalOpen(cell.date - 1)}>
                                                        <div className={`dateArea ${cell.date === todayDate ? "bg-secondary text-white rounded-pill px-1 py-1" : ""}`}>
                                                            {cell.isCurrentMonth ? String(cell.date) : ""}
                                                        </div>
                                                        <div className="eventArea">
                                                            {eventShopList[weekIndex]?.[youbiIndex]?.slice(0, 5).map((e, idx, dayEvents) => {
                                                                const lane = dayEvents.findIndex(ev => ev.id === e.id);
                                                                const top = 10 + lane * 20;
                                                                return (
                                                                    <div
                                                                        key={e.id}
                                                                        className="eventBar"
                                                                        style={{
                                                                            backgroundColor: idx < 4 ? e.color : '',
                                                                            top: `${top}px`,
                                                                            width: "100%",
                                                                            color: idx === 4 ? e.color : '',
                                                                        }}
                                                                    >
                                                                        {idx < 4 ? `${e.title.slice(0, 7)}${e.title.length > 7 ? '...' : ''}` : ':'}

                                                                    </div>
                                                                );
                                                            })}
                                                            {cell.isCurrentMonth &&
                                                                <div className="calendarResponse">
                                                                    <div className="d-flex">
                                                                        <div className="response register">{reservedLength}</div>
                                                                        <div className="response new">{newLength}</div>
                                                                        <div className="response appointment">{nextLength}</div>
                                                                        <div className="response listed">{registeredLength}</div>
                                                                    </div>
                                                                </div>}
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}

                                </tbody>
                            </Table>
                                : <Table striped bordered>
                                    <tbody className='monthCalender'>
                                        <tr className='sticky-header eventCalendar'>
                                            <td rowSpan={2} className="align-middle">店舗名</td>
                                            {[...Array(lastDay)].map((_, i) => (
                                                <td key={i}>{i + 1}</td>
                                            ))}
                                        </tr>
                                        <tr className='sticky-header eventCalendar bottom bg-white'>
                                            {[...Array(lastDay)].map((_, i) => (
                                                <td key={i}>{youbi[(firstDay + i) % 7]}</td>
                                            ))}
                                        </tr>
                                        {shopList.filter(s => !s.shop.includes('未設定')).map((s, sIndex) => {
                                            const list = eventList[sIndex];
                                            const targetEvent = Array.isArray(list) ? list.filter(e => e.shop === s.shop) : [];

                                            const firstAppear: Record<number, number> = {};
                                            const thisMonthEvent: number[] = [];

                                            for (let i = 0; i < lastDay; i++) {
                                                const ev = targetEvent.find(t => t.date === i + 1);
                                                if (!ev) continue;
                                                for (const e of ev.event) {
                                                    if (firstAppear[e.id] === undefined) {
                                                        firstAppear[e.id] = i;
                                                    }
                                                    if (!thisMonthEvent.includes(e.id)) {
                                                        thisMonthEvent.push(e.id);
                                                    }
                                                }
                                            }

                                            return (
                                                <tr key={sIndex}>
                                                    <td>{s.shop}</td>
                                                    {[...Array(lastDay)].map((_, i) => {
                                                        const ev = targetEvent.find(t => t.date === i + 1);
                                                        const eventsForDay = ev ? ev.event : [];
                                                        return (
                                                            <td key={i} style={{ padding: '0', height: (thisMonthEvent.length + 1) * 30 }}
                                                                className="position-relative shop_calendar_cell" onClick={() => {
                                                                    setListShop(s.shop);
                                                                    setTargetShop(s.shop);
                                                                    modalOpen(i);
                                                                }}>
                                                                {eventsForDay.map((e, eIndex) => {
                                                                    const top = thisMonthEvent.indexOf(e.id) * 30 + 20;
                                                                    const showTitle = firstAppear[e.id] === i;
                                                                    return (
                                                                        <div key={e.id} style={{
                                                                            backgroundColor: '#b3d6f4',
                                                                            top,
                                                                            height: '22px',
                                                                            width: '105%',
                                                                            whiteSpace: 'nowrap',
                                                                            position: 'absolute',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            paddingLeft: '0.25rem',
                                                                            cursor: 'pointer',
                                                                            color: '#222222',
                                                                            zIndex: showTitle ? 10 : 1
                                                                        }}>{showTitle ? e.title : ''}</div>
                                                                    );
                                                                })}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            }
                        </div>

                    </div>
                </div>
            </div>
            <Modal show={show} onHide={modalClose} size={summary ? 'lg' : 'xl'}>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '12px', letterSpacing: '1px' }}>{summary ? `${targetMonth.replace('/', '年')}月_反響集計` : `${targetMonth}/${String(modalDay + 1).padStart(2, '0')}イベント`}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {summary ? <>
                        <div style={{ fontSize: '12px' }}>※カレンダーに登録した人数を表示<br />※()内はPGクラウドに入力された数値</div>
                        <Table striped bordered>
                            <tbody style={{ fontSize: '12px' }}>
                                <tr>
                                    <td>店舗</td>
                                    <td>新規来場</td>
                                    <td>有効新規</td>
                                    <td>次アポ</td>
                                    <td>管理客</td>
                                    <td>契約者数</td>
                                </tr>
                                {shopList.filter(s => !s.shop.includes('未設定') && s.brand !== 'FH').map(s => {
                                    const base = originalResponse.filter(o => o.shop === s.shop && o.date.includes(targetMonth.replace('/', '-')));
                                    const registerLength = base.filter(b => b.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0);
                                    const newLength = base.filter(b => b.category === 'new').reduce((acc, cur) => acc + cur.count, 0);
                                    const nextLength = base.filter(b => b.category === 'next').reduce((acc, cur) => acc + cur.count, 0);
                                    const registeredLength = base.filter(b => b.category === 'registered').reduce((acc, cur) => acc + cur.count, 0);
                                    const contractLength = customer.filter(c => c.shop === s.shop && c.contract.includes(targetMonth)).length;
                                    const pgReservedLength = customer.filter(c => c.shop === s.shop && c.reserve.includes(targetMonth)).length;
                                    const pgNextLength = customer.filter(c => c.shop === s.shop && c.reserve.includes(targetMonth) && c.second_reserve).length;
                                    return <tr>
                                        <td>{s.shop}</td>
                                        <td style={{ textAlign: 'right' }}>{registerLength}</td>
                                        <td style={{ textAlign: 'right' }}>{newLength}({pgReservedLength})</td>
                                        <td style={{ textAlign: 'right' }}>{nextLength}({pgNextLength})</td>
                                        <td style={{ textAlign: 'right' }}>{registeredLength}</td>
                                        <td style={{ textAlign: 'right' }}>{contractLength}</td>
                                    </tr>
                                }
                                )}
                            </tbody>
                        </Table></>
                        : <Table bordered striped>
                            <tbody style={{ fontSize: '12px' }}>
                                <tr>
                                    <td>No</td>
                                    <td>店舗</td>
                                    <td>タイトル</td>
                                    <td>開始日</td>
                                    <td>終了日</td>
                                    <td>総新規</td>
                                    <td>有効新規</td>
                                    <td>次アポ</td>
                                    <td>管理客</td>
                                    <td className='position-relative'>詳細
                                        <div className={`event_note ${showNote ? '' : 'd-none'}`}>
                                            <div className="text-center mt-3 text-dark">イベント詳細</div>
                                            <textarea className='target event_textarea' defaultValue={modalNote} placeholder='イベント詳細'
                                                onChange={(e) => {
                                                    newEventData.id === 0 ?
                                                        setNewEventData(prev => ({
                                                            ...prev,
                                                            note: e.target.value
                                                        }))
                                                        : setEventData(prev => ({
                                                            ...prev,
                                                            note: e.target.value
                                                        }));
                                                }}
                                                onBlur={changeEvent}></textarea>
                                            <input type="text" className='target event_url' defaultValue={modalUrl} placeholder='URL'
                                                onChange={(e) => {
                                                    newEventData.id === 0 ?
                                                        setNewEventData(prev => ({
                                                            ...prev,
                                                            url: e.target.value
                                                        }))
                                                        : setEventData(prev => ({
                                                            ...prev,
                                                            url: e.target.value
                                                        }));
                                                }}
                                                onBlur={changeEvent} />
                                            {modalUrl && <div className="w-100 d-flex align-items-center justify-content-center mt-3">
                                                <div style={{ fontSize: '12px' }} className="bg-primary btn text-center text-white rounded-pill px-3"
                                                    onClick={() => {
                                                        const url = calendar.find(c => c.id === eventData.id)?.url ?? '';
                                                        window.open(url, '_blank');
                                                    }}>リンクへ移動</div>
                                            </div>}
                                            <div className="w-100 d-flex align-items-center justify-content-center mt-3">
                                                <div style={{ fontSize: '12px' }} className="bg-danger btn text-center text-white rounded-pill px-3"
                                                    onClick={() => {
                                                        setModalNote('');
                                                        setModalUrl('');
                                                        setShowNote(false);
                                                    }}
                                                >閉じる</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>変更</td>
                                </tr>
                                {[...(targetShop ? [{ id: 0, startDate: '', endDate: '', category: '', title: '常設EV・モデル見学', flag: 1, shop: targetShop, reserved: 0, url: '', note: '' }] : []), ...(modalList[modalDay] ?? [])]?.
                                    filter(m => (listShop ? m.shop === listShop : true)).
                                    map((m, index) => {
                                        const date = `${targetMonth.replace('/', '-')}-${String(modalDay + 1).padStart(2, '0')}`;
                                        const base = response.filter(r => (index > 0 ? r.shop === m.shop : true) && r.date === date && r.event === m.title);
                                        const reservedLength = base.find(r => r.category === 'reserved') ? base.find(r => r.category === 'reserved')?.count : 0;
                                        const newLength = base.find(r => r.category === 'new') ? base.find(r => r.category === 'new')?.count : 0;
                                        const nextLength = base.find(r => r.category === 'next') ? base.find(r => r.category === 'next')?.count : 0;
                                        const registeredLength = base.find(r => r.category === 'registered') ? base.find(r => r.category === 'registered')?.count : 0;
                                        return (
                                            <tr key={m.id} className='align-middle'>
                                                <td>{index + 1}</td>
                                                <td>{m.shop}</td>
                                                <td>{m.title !== '常設EV・モデル見学' ? <input type="text" className='target calendar_title' defaultValue={m.title}
                                                    onChange={(e) => setEventData(prev => ({
                                                        ...prev,
                                                        id: m.id,
                                                        title: e.target.value
                                                    }))}
                                                    onBlur={changeEvent} /> : m.title}</td>
                                                <td>{m.title !== '常設EV・モデル見学' ? <input type="date" className='target calendar_date' defaultValue={m.startDate}
                                                    onChange={(e) => setEventData(prev => ({
                                                        ...prev,
                                                        id: m.id,
                                                        startDate: e.target.value
                                                    }))} /> : ''}</td>
                                                <td>{m.title !== '常設EV・モデル見学' ? <input type="date" className='target calendar_date' defaultValue={m.endDate}
                                                    onChange={(e) => setEventData(prev => ({
                                                        ...prev,
                                                        id: m.id,
                                                        endDate: e.target.value
                                                    }))}
                                                    onBlur={changeEvent} /> : ''}</td>
                                                <td style={{ textAlign: targetShop ? 'center' : 'right' }}>
                                                    <input type="number" min="0" className='target calendar_count' defaultValue={reservedLength}
                                                        onChange={(e) => setEventData(prev => ({
                                                            ...prev,
                                                            id: m.id,
                                                            title: m.title,
                                                            reserved: Number(e.target.value),
                                                            date: date,
                                                            shop: m.shop
                                                        }))}
                                                        onBlur={changeEvent} /></td>
                                                <td style={{ textAlign: targetShop ? 'center' : 'right' }}>
                                                    <input type="number" min="0" className='target calendar_count' defaultValue={newLength}
                                                        onChange={(e) => setEventData(prev => ({
                                                            ...prev,
                                                            id: m.id,
                                                            title: m.title,
                                                            new: Number(e.target.value),
                                                            date: date,
                                                            shop: m.shop
                                                        }))}
                                                        onBlur={changeEvent} /></td>
                                                <td style={{ textAlign: targetShop ? 'center' : 'right' }}>
                                                    <input type="number" min="0" className='target calendar_count' defaultValue={nextLength}
                                                        onChange={(e) => setEventData(prev => ({
                                                            ...prev,
                                                            id: m.id,
                                                            title: m.title,
                                                            next: Number(e.target.value),
                                                            date: date,
                                                            shop: m.shop
                                                        }))}
                                                        onBlur={changeEvent} /></td>
                                                <td style={{ textAlign: targetShop ? 'center' : 'right' }}>
                                                    <input type="number" min="0" className='target calendar_count' defaultValue={registeredLength}
                                                        onChange={(e) => setEventData(prev => ({
                                                            ...prev,
                                                            id: m.id,
                                                            title: m.title,
                                                            registered: Number(e.target.value),
                                                            date: date,
                                                            shop: m.shop
                                                        }))}
                                                        onBlur={changeEvent} /></td>
                                                <td className='text-center text-primary' style={{ cursor: 'pointer' }} onClick={() => {
                                                    setEventData(prev => ({
                                                        ...prev,
                                                        id: m.id,
                                                    }));
                                                    setModalNote(m.note);
                                                    setModalUrl(m.url);
                                                    setShowNote(true);
                                                }}><i className="fa-solid fa-magnifying-glass"></i>
                                                </td>
                                                <td className='text-center text-danger' style={{ cursor: 'pointer' }} onClick={() => deleteEvent(m.id)} >{m.title !== '常設EV・モデル見学' && <i className="fa-solid fa-trash">削除</i>}</td>
                                            </tr>
                                        )
                                    }
                                    )}
                                {targetShop && <tr className='align-middle'>
                                    <td>追加</td>
                                    <td>{allShop ? '全店舗' : targetShop}</td>
                                    <td><input type="text" className='target calendar_title' value={newEventData.title}
                                        onChange={(e) => setNewEventData(prev => ({
                                            ...prev,
                                            title: e.target.value
                                        }))} /></td>
                                    <td><input type="date" className='target calendar_date' value={newEventData.startDate}
                                        onChange={(e) => setNewEventData(prev => ({
                                            ...prev,
                                            startDate: e.target.value
                                        }))} /></td>
                                    <td><input type="date" className='target calendar_date' value={newEventData.endDate}
                                        onChange={(e) => setNewEventData(prev => ({
                                            ...prev,
                                            endDate: e.target.value
                                        }))} /></td>
                                    <td style={{ textAlign: targetShop ? 'center' : 'right' }} colSpan={4}>
                                        <div className="d-flex align-items-center justify-content-center">
                                            <input type="checkbox" value='' id='allShop' onClick={() => setAllShop(prev => !prev)} checked={allShop} />
                                            <label htmlFor="allShop" className='ms-2'>全店舗へ展開</label>
                                        </div>
                                    </td>
                                    <td className='text-center text-primary' style={{ cursor: 'pointer' }} onClick={() => {
                                        setNewEventData(prev => ({
                                            ...prev,
                                            id: 0,
                                        }));
                                        setModalNote('');
                                        setModalUrl('');
                                        setShowNote(true);
                                    }}><i className="fa-solid fa-magnifying-glass"></i></td>
                                    <td className='text-center text-primary' style={{ cursor: 'pointer' }} onClick={addEvent} ><i className="fa-solid fa-file-pen">保存</i></td>
                                </tr>}
                            </tbody>
                        </Table>}
                    <div className="d-flex justify-content-end">
                        <div className="bg-danger btn text-center text-white rounded-pill px-3" style={{ fontSize: '12px' }}
                            onClick={() => modalClose()}>
                            閉じる
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
            <Modal show={targetShop === 'iceWorld'} size='xl' onHide={modalClose}>
                <Modal.Header closeButton>ぶるぶるアイスワールド利用予約</Modal.Header>
                <Modal.Body>
                    <IceWorld shopList={shopList} editId={editId} />
                </Modal.Body>
            </Modal>
        </>
    );
};

export default Company;