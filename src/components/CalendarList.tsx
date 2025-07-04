import React, { useState, useEffect, useContext } from 'react';
import 'react-calendar/dist/Calendar.css';
import Table from "react-bootstrap/Table";
import axios from 'axios';
import Modal from 'react-bootstrap/Modal';
import Button from "react-bootstrap/Table";

type ValueRange = { id: number, startDate: string, endDate: string, category: string, title: string, shop: string, flag: number };
type shopList = { brand: string, shop: string };
type ReservedCounter = { shop: string, event: string, date: string, count: number, category: string };
interface CalendarListProps {
    activeTab: string | null;
}

const CalendarList: React.FC<CalendarListProps> = ({ activeTab }) => {
    const [standardDate, setStandardDate] = useState<string>('');
    const [dateArray, setDateArray] = useState<string[]>([]);
    const [weekdayArray, setWeekdayArray] = useState<string[]>([]);
    const [selectedRanges, setSelectedRanges] = useState<ValueRange[]>([]);
    const [selectedShop, setSelectedShop] = useState<shopList[]>([]);
    const [modalShopList, setModalShopList] = useState<shopList[]>([]);
    const [eventTitle, setEventTitle] = useState<ValueRange[]>([]);
    const [listShow, setListShow] = useState(false);
    const [modalShow, setModalShow] = useState(false);
    const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const [reservedNumber, setReservedNumber] = useState<ReservedCounter[]>([]);


    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const formattedMonth = String(month).padStart(2, '0');
        const formattedDate = `${year}-${formattedMonth}`;
        setStandardDate(formattedDate);

        const fetchEventData = async () => {
            try {
                const response = await axios.post("/dashboard/api/eventCalendar.php");
                setSelectedRanges(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchEventData();

        const fetchShopData = async () => {
            try {
                const response = await axios.post("/dashboard/api/shopCalendarList.php");
                setSelectedShop(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchShopData();

        const fetchModalShopData = async () => {
            try {
                const response = await axios.post("/dashboard/api/shopCalendarModalList.php");
                setModalShopList(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchModalShopData();

        const pastDays = Array.from({ length: 15 }, (_, i) => {
            const pastDate = new Date(today);
            pastDate.setDate(today.getDate() - i);
            return {
                date: pastDate.toISOString().split('T')[0],
                weekday: weekdayLabels[pastDate.getDay()],
            };
        });

        const futureDays = Array.from({ length: 15 }, (_, i) => {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + (i + 1));
            return {
                date: futureDate.toISOString().split('T')[0],
                weekday: weekdayLabels[futureDate.getDay()],
            };
        });

        setDateArray([...pastDays.reverse(), ...futureDays].map(item => item.date));
        setWeekdayArray([...pastDays, ...futureDays].map(item => item.weekday));

        const fetchReservedData = async () => {
            try {
                const response = await axios.post("/dashboard/api/changeCalendar.php");
                setReservedNumber(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchReservedData();

    }, []);

    useEffect(() => {
        const today = new Date();

        const fetchEventData = async () => {
            try {
                const response = await axios.post("/dashboard/api/eventCalendar.php");
                setSelectedRanges(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchEventData();

        const fetchShopData = async () => {
            try {
                const response = await axios.post("/dashboard/api/shopCalendarList.php");
                setSelectedShop(response.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchShopData();


        const pastDays = Array.from({ length: 15 }, (_, i) => {
            const pastDate = new Date(today);
            pastDate.setDate(today.getDate() - i);
            return {
                date: pastDate.toISOString().split('T')[0],
                weekday: weekdayLabels[pastDate.getDay()],
            };
        });

        const futureDays = Array.from({ length: 15 }, (_, i) => {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + (i + 1));
            return {
                date: futureDate.toISOString().split('T')[0],
                weekday: weekdayLabels[futureDate.getDay()],
            };
        });

        setDateArray([...pastDays.reverse(), ...futureDays].map(item => item.date));
        setWeekdayArray([...pastDays, ...futureDays].map(item => item.weekday));
    }, [activeTab]);

    useEffect(() => {
        const start = new Date();
        start.setDate(start.getDate() - 14);
        const formattedStartDate: string = start.toISOString().split('T')[0];
        const end = new Date();
        end.setDate(end.getDate() + 15);
        const formattedEndDate: string = end.toISOString().split('T')[0];
        (async () => {
            const formattedList = selectedRanges.filter(item =>
                (item.endDate >= formattedStartDate && item.endDate <= formattedEndDate) ||
                (item.startDate <= formattedEndDate && item.startDate >= formattedStartDate)
            );

            setEventTitle(formattedList);
        })();
    }, [selectedRanges]);

    const [khgArray, setKhgArray] = useState<number[]>([]);
    const [khArray, setKhArray] = useState<number[]>([]);
    const [djhArray, setDjhArray] = useState<number[]>([]);
    const [nagomiArray, setNagomiArray] = useState<number[]>([]);
    const [nieruArray, setNieruArray] = useState<number[]>([]);
    const [pgArray, setPgArray] = useState<number[]>([]);

    useEffect(() => {
        let khgNumberArray = [];
        let khNumberArray = [];
        let djhNumberArray = [];
        let nagomiNumberArray = [];
        let nieruNumberArray = [];
        let pgNumberArray = [];

        const fetchReservedNumber = async () => {
            khgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'reserved').length);
            khgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'new').length);
            khgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'next').length);
            khgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'registered').length);
            setKhgArray(khgNumberArray);

            khNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'reserved' && item.shop.includes('KH')).length);
            khNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'new' && item.shop.includes('KH')).length);
            khNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'next' && item.shop.includes('KH')).length);
            khNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'registered' && item.shop.includes('KH')).length);
            setKhArray(khNumberArray);

            djhNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'reserved' && item.shop.includes('DJH')).length);
            djhNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'new' && item.shop.includes('DJH')).length);
            djhNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'next' && item.shop.includes('DJH')).length);
            djhNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'registered' && item.shop.includes('DJH')).length);
            setDjhArray(djhNumberArray);

            nagomiNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'reserved' && item.shop.includes('なごみ')).length);
            nagomiNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'new' && item.shop.includes('なごみ')).length);
            nagomiNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'next' && item.shop.includes('なごみ')).length);
            nagomiNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'registered' && item.shop.includes('なごみ')).length);
            setNagomiArray(nagomiNumberArray);

            nieruNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'reserved' && item.shop.includes('2L')).length);
            nieruNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'new' && item.shop.includes('2L')).length);
            nieruNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'next' && item.shop.includes('2L')).length);
            nieruNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'registered' && item.shop.includes('2L')).length);
            setNieruArray(nieruNumberArray);

            pgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'reserved' && item.shop.includes('PG')).length);
            pgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'new' && item.shop.includes('PG')).length);
            pgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'next' && item.shop.includes('PG')).length);
            pgNumberArray.push(await reservedNumber.filter(item => item.date.includes(standardDate) && item.category === 'registered' && item.shop.includes('PG')).length);
            setPgArray(pgNumberArray);
        };

        fetchReservedNumber();
    }, [reservedNumber, standardDate]);

    const [eventDate, setEventDate] = useState<string>('');
    const [eventShop, setEventShop] = useState<string>('');
    const [modalEventShop, setModalEventShop] = useState<string>('');
    const [modalEventId, setModalEventId] = useState<string>();
    const [modalEventTitle, setModalEventTitle] = useState<string>('');
    const [modalEventCategory, setModalEventCategory] = useState<string>('');
    const [modalEventStartDate, setModalEventStartDate] = useState<string>('');
    const [modalEventEndDate, setModalEventEndDate] = useState<string>('');
    const [modalEventDemand, setModalEventDemand] = useState<string>('');
    const [modalEvent, setModalEvent] = useState<ValueRange[]>([]);
    const [titleValidation, setTitleValidation] = useState<boolean>(false);
    const [categoryValidation, setCategoryValidation] = useState<boolean>(false);
    const [startValidation, setStartValidation] = useState<boolean>(false);
    const [endValidation, setEndValidation] = useState<boolean>(false);

    const modalClose = async () => {
        await setModalEvent([]);
        await setModalEventTitle('');
        await setEventDate('');
        await setEventShop('');
        await setModalEventCategory('');
        await setModalEventStartDate('');
        await setModalEventEndDate('');
        setModalShow(false);
    }

    const registerEvent = async (dateValue: string, shopValue: string) => {
        await setEventDate(dateValue);
        await setEventShop(shopValue);
        await setModalEventShop(shopValue);
        await setModalEventDemand('add');
        await setListShow(true);
    };

    const listClose = async () => {

        await setListShow(false);
    };

    const addEvent = async (dateValue: string, shopValue: string) => {
        const formattedList = await eventTitle.filter(item => item.shop === shopValue);
        await setModalEvent(formattedList);
        await setEventShop(shopValue);
        await setModalEventStartDate(dateValue);
        await setModalShow(true);
    };

    const confirmEvent = async () => {
        if (modalEventTitle === "") {
            setTitleValidation(true);
            return;
        } else { setTitleValidation(false); }
        if (modalEventCategory === "") {
            setCategoryValidation(true);
            return;
        } else { setCategoryValidation(false); }
        if (modalEventStartDate === "") {
            setStartValidation(true);
            return;
        } else { setStartValidation(false); }
        if (modalEventEndDate === "") {
            setEndValidation(true);
            return;
        } else { setEndValidation(false); }

        if (modalEventShop.includes('全店舗')) {
            const brand: string = modalEventShop.replace('全店舗', '');
            const shopArray: string[] = modalShopList.filter(shop => shop.shop.includes(brand) && !shop.shop.includes('全店舗')).map(shop => shop.shop);
            shopArray.map(shop => {
                const postData = {
                    id: modalEventId,
                    shop: shop,
                    category: modalEventCategory,
                    startDate: modalEventStartDate,
                    endDate: modalEventEndDate,
                    title: modalEventTitle,
                    demand: modalEventDemand
                };

                try {
                    (async () => {
                        await fetch("/dashboard/api/changeEvent.php", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(postData)
                        });
                    })();
                } catch (error) {
                    console.error("エラー:", error);
                }
            });
            (async () => {
                try {
                    const response = await axios.post("/dashboard/api/eventCalendar.php");
                    setSelectedRanges(response.data);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            })();
        }

        const postData = {
            id: modalEventId,
            shop: modalEventShop,
            category: modalEventCategory,
            startDate: modalEventStartDate,
            endDate: modalEventEndDate,
            title: modalEventTitle,
            demand: modalEventDemand
        };

        try {
            const response = await fetch("/dashboard/api/changeEvent.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData)
            });
            const data = await response.json();
            setSelectedRanges(data);
        } catch (error) {
            console.error("エラー:", error);
        }

        await setModalEventId('');
        await setModalEvent([]);
        await setModalEventTitle('');
        await setEventDate('');
        await setEventShop('');
        await setModalEventCategory('');
        await setModalEventStartDate('');
        await setModalEventEndDate('');
        setListShow(false);
        setModalShow(false);
    };

    const changeEvent = async (idValue: string, titleValue: string, shopValue: string, categoryValue: string, startValue: string, endValue: string) => {
        await setModalEventId(idValue);
        await setModalEventShop(shopValue);
        await setModalEventTitle(titleValue);
        await setModalEventShop(shopValue);
        await setModalEventCategory(categoryValue);
        await setModalEventStartDate(startValue);
        await setModalEventEndDate(endValue);
        await setModalEventDemand('change');
        await setListShow(true);
    };

    const deleteEvent = async (idValue: number, titleValue: string, shopValue: string) => {
        if (window.confirm(`${shopValue}_${titleValue}を削除しますか？`)) {
            const postData = {
                id: idValue,
                shop: shopValue,
                title: titleValue,
                demand: 'delete'
            };
            try {
                const response = await fetch("/dashboard/api/changeEvent.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(postData)
                });
                const data = await response.json();
                setSelectedRanges(data);
            } catch (error) {
                console.error("エラー:", error);
            }
        }
        setModalShow(false);
    };

    const [monthOffset, setMonthOffset] = useState(0);


    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + monthOffset + 1;
        const formattedMonth = String(month).padStart(2, '0');
        const formattedDate = `${year}-${formattedMonth}`;
        setStandardDate(formattedDate);

        const start = new Date();
        start.setMonth(start.getMonth() + monthOffset);
        start.setDate(start.getDate() - 14);

        const end = new Date();
        end.setMonth(end.getMonth() + monthOffset);
        end.setDate(end.getDate() + 15);

        const formattedStartDate = start.toISOString().split("T")[0];
        const formattedEndDate = end.toISOString().split("T")[0];


        (async () => {
            const formattedList = selectedRanges.filter(item =>
                (item.endDate >= formattedStartDate && item.endDate <= formattedEndDate) ||
                (item.startDate <= formattedEndDate && item.startDate >= formattedStartDate)
            );

            setEventTitle(formattedList);
        })();
    }, [monthOffset]);



    const updateMonth = () => {
        const today = new Date();
        const baseDate = new Date(today);
        baseDate.setMonth(today.getMonth() + monthOffset);

        const pastDays = Array.from({ length: 15 }, (_, i) => {
            const pastDate = new Date(baseDate);
            pastDate.setDate(baseDate.getDate() - i);
            return {
                date: pastDate.toISOString().split("T")[0],
                weekday: weekdayLabels[pastDate.getDay()],
            };
        });

        const futureDays = Array.from({ length: 15 }, (_, i) => {
            const futureDate = new Date(baseDate);
            futureDate.setDate(baseDate.getDate() + (i + 1));
            return {
                date: futureDate.toISOString().split("T")[0],
                weekday: weekdayLabels[futureDate.getDay()],
            };
        });

        setDateArray([...pastDays.reverse(), ...futureDays].map(item => item.date));
        setWeekdayArray([...pastDays, ...futureDays].map(item => item.weekday));
    };

    useEffect(() => {
        updateMonth();
    }, [monthOffset]);

    return (
        <div className="custom-calendar">
            <div className='text-center'>{standardDate.replace('-', '/')}_来場者数総計</div>
            <Table className='text-center no-border-table' style={{ width: '100%', margin: '0 auto 40px' }}>
                <thead>
                    <tr>
                        <th>グループ全体</th>
                        <th>国分ハウジング</th>
                        <th>Day Just House</th>
                        <th>なごみ工務店</th>
                        <th>ニーエルホーム</th>
                        <th>PG HOUSE</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th>
                            <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2 position-relative'>新規<div className='position-absolute text-danger fw-bold inquiry-number'>{khgArray[0]}名</div></span>
                            <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2 position-relative'>有効<div className='position-absolute text-primary fw-bold inquiry-number'>{khgArray[1]}名</div></span>
                            <span className='p bg-success text-white px-2 py-1 rounded-pill me-2 position-relative'>次アポ<div className='position-absolute text-success fw-bold inquiry-number'>{khgArray[2]}名</div></span>
                            <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2 position-relative'>管理客<div className='position-absolute text-secondary fw-bold inquiry-number'>{khgArray[3]}名</div></span>
                        </th>
                        <th>
                            <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2 position-relative'>新規<div className='position-absolute text-danger fw-bold inquiry-number'>{khArray[0]}名</div></span>
                            <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2 position-relative'>有効<div className='position-absolute text-primary fw-bold inquiry-number'>{khArray[1]}名</div></span>
                            <span className='p bg-success text-white px-2 py-1 rounded-pill me-2 position-relative'>次アポ<div className='position-absolute text-success fw-bold inquiry-number'>{khArray[2]}名</div></span>
                            <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2 position-relative'>管理客<div className='position-absolute text-secondary fw-bold inquiry-number'>{khArray[3]}名</div></span>
                        </th>
                        <th>
                            <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2 position-relative'>新規<div className='position-absolute text-danger fw-bold inquiry-number'>{djhArray[0]}名</div></span>
                            <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2 position-relative'>有効<div className='position-absolute text-primary fw-bold inquiry-number'>{djhArray[1]}名</div></span>
                            <span className='p bg-success text-white px-2 py-1 rounded-pill me-2 position-relative'>次アポ<div className='position-absolute text-success fw-bold inquiry-number'>{djhArray[2]}名</div></span>
                            <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2 position-relative'>管理客<div className='position-absolute text-secondary fw-bold inquiry-number'>{djhArray[3]}名</div></span>
                        </th>
                        <th>
                            <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2 position-relative'>新規<div className='position-absolute text-danger fw-bold inquiry-number'>{nagomiArray[0]}名</div></span>
                            <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2 position-relative'>有効<div className='position-absolute text-primary fw-bold inquiry-number'>{nagomiArray[1]}名</div></span>
                            <span className='p bg-success text-white px-2 py-1 rounded-pill me-2 position-relative'>次アポ<div className='position-absolute text-success fw-bold inquiry-number'>{nagomiArray[2]}名</div></span>
                            <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2 position-relative'>管理客<div className='position-absolute text-secondary fw-bold inquiry-number'>{nagomiArray[3]}名</div></span>
                        </th>
                        <th>
                            <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2 position-relative'>新規<div className='position-absolute text-danger fw-bold inquiry-number'>{nieruArray[0]}名</div></span>
                            <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2 position-relative'>有効<div className='position-absolute text-primary fw-bold inquiry-number'>{nieruArray[1]}名</div></span>
                            <span className='p bg-success text-white px-2 py-1 rounded-pill me-2 position-relative'>次アポ<div className='position-absolute text-success fw-bold inquiry-number'>{nieruArray[2]}名</div></span>
                            <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2 position-relative'>管理客<div className='position-absolute text-secondary fw-bold inquiry-number'>{nieruArray[3]}名</div></span>
                        </th>
                        <th>
                            <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2 position-relative'>新規<div className='position-absolute text-danger fw-bold inquiry-number'>{pgArray[0]}名</div></span>
                            <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2 position-relative'>有効<div className='position-absolute text-primary fw-bold inquiry-number'>{pgArray[1]}名</div></span>
                            <span className='p bg-success text-white px-2 py-1 rounded-pill me-2 position-relative'>次アポ<div className='position-absolute text-success fw-bold inquiry-number'>{pgArray[2]}名</div></span>
                            <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2 position-relative'>管理客<div className='position-absolute text-secondary fw-bold inquiry-number'>{pgArray[3]}名</div></span>
                        </th>
                    </tr>
                </tbody>
            </Table>
            <div className='d-flex justify-content-between month_guide'>
                <div className='btn bg-primary text-white rounded-pill' onClick={() => {
                    setMonthOffset(prev => prev - 1);
                    updateMonth();
                }}>前の月へ</div>
                <div className='btn bg-primary text-white rounded-pill' onClick={() => {
                    setMonthOffset(prev => prev + 1);
                    updateMonth();
                }}>次の月へ</div>
            </div>
            <Table>
                <thead className='sticky-header'>
                    <tr className='sticky-header'>
                        <th className='sticky-column'></th>
                        {weekdayArray.map((value, index) => {
                            let weekdayClass;
                            if (value === '土') { weekdayClass = 'text-primary'; }
                            else if (value === '日') { weekdayClass = 'text-danger' }
                            return (
                                <th key={index} className='text-center'><span className={weekdayClass}>{value}</span></th>
                            )
                        })}
                    </tr>
                    <tr className='sticky-header'>
                        <th className='sticky-column'>店舗名</th>
                        {dateArray.map((value, index) => {
                            let weekdayClass;
                            if (weekdayArray[index] === '土') { weekdayClass = 'text-primary'; }
                            else if (weekdayArray[index] === '日') { weekdayClass = 'text-danger' }
                            return (
                                <th key={index} className='text-center'><span className={weekdayClass}>{value.split('-')[1]}/{value.split('-')[2]}</span></th>
                            )
                        })}
                    </tr>
                </thead>
                <tbody>
                    {selectedShop.map((shop, index) => (
                        <tr key={index}>
                            <th className='align-middle'>{shop.shop}</th>
                            {dateArray.map((value, index) => {
                                const eventClass = ['list position-relative'];
                                if (eventTitle.filter(event => event.shop === shop.shop && event.startDate <= value && event.endDate >= value && event.category.includes('open')).length > 0) {
                                    eventClass.push('openhouse_list');
                                }
                                if (eventTitle.filter(event => event.shop === shop.shop && event.startDate <= value && event.endDate >= value && event.category === 'event').length > 0) {
                                    eventClass.push('event_list');
                                }
                                if (eventTitle.filter(event => event.shop === shop.shop && event.startDate <= value && event.endDate >= value && event.category === 'event_even').length > 0) {
                                    eventClass.push('event_even_list');
                                }
                                if (eventTitle.filter(event => event.shop === shop.shop && event.startDate <= value && event.endDate >= value && event.category.includes('medium')).length > 0) {
                                    eventClass.push('medium_list');
                                }
                                const eventClassArray = eventClass.join(' ');
                                return (
                                    <th style={{ height: '80px' }} onClick={() => addEvent(value, shop.shop)}><div className={eventClassArray}>{eventTitle.filter(event => event.shop === shop.shop && event.startDate === value).map((value => <div className={value.category}>{value.title}</div>))}</div></th>
                                )
                            })}
                        </tr>))}
                </tbody>
            </Table>

            <Modal show={modalShow} onHide={modalClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title id="ranked-modal"></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table striped>
                        <thead>
                            <tr className='modal_event_list text-center'>
                                <th>タイトル・媒体名</th>
                                <th>カテゴリー</th>
                                <th>開始日</th>
                                <th>終了日</th>
                                <th>編集</th>
                            </tr>
                        </thead>
                        <tbody>
                            {modalEvent.map((item, index) =>
                                <tr className='modal_event_list text-center' key={index}>
                                    <th className='align-middle'>{item.title}</th>
                                    <th className='align-middle'>{item.category}</th>
                                    <th className='align-middle'>{item.startDate}</th>
                                    <th className='align-middle'>{item.endDate}</th>
                                    <th><th className='align-middle'><div className='btn me-2 bg-primary text-white' onClick={() => changeEvent(String(item.id), item.title, item.shop, item.category, item.startDate, item.endDate)}><i className="fa-solid fa-file-pen"></i></div><div className='btn bg-danger text-white' onClick={() => deleteEvent(item.id, item.title, item.shop)}><i className="fa-solid fa-trash"></i></div></th></th>
                                </tr>)}
                        </tbody>
                    </Table>
                </Modal.Body>
                <Modal.Footer>
                    <Button className='bg-secondary rounded text-white btn calendar_modal_close' variant="secondary" onClick={modalClose}>
                        閉じる
                    </Button>
                    <Button className='bg-primary rounded text-white btn calendar_modal_close' variant="secondary" onClick={() => registerEvent(eventDate, eventShop)}>
                        イベント新規登録
                    </Button>
                </Modal.Footer>
            </Modal>


            <Modal show={listShow} onHide={listClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title id="ranked-modal"></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='mb-3'>
                        <label className='form-label mb-0'>店舗選択</label>
                        <select className='form-select' value={modalEventShop} onChange={(e) => setModalEventShop(e.target.value)}>
                            {modalShopList.map((shop, index) =>
                                <option key={index} selected={shop.shop === eventShop}>{shop.shop}</option>
                            )}
                        </select>
                    </div>
                    <div className='mb-3'>
                        <label className='form-label mb-0'>タイトル</label>
                        <input type='text' className='form-control' value={modalEventTitle} onChange={(e) => setModalEventTitle(e.target.value)} />
                        {titleValidation ? <div className='text-danger'>イベント名・媒体名が未入力です</div> : null}
                    </div>
                    <div className='mb-3'>
                        <label className='form-label mb-0'>カテゴリー</label>
                        <select className='form-control' value={modalEventCategory} onChange={(e) => setModalEventCategory(e.target.value)}>
                            <option value=''>カテゴリーを選択</option>
                            <option value='event' >イベント(上段)</option>
                            <option value='event_even'>イベント(下段)</option>
                            <option value='openhouse'>完成見学会</option>
                            <option value='medium' >販促媒体</option>
                        </select>
                        {categoryValidation ? <div className='text-danger'>カテゴリーが未入力です</div> : null}
                    </div>
                    <div className='mb-3'>
                        <label className='form-label mb-0'>開始日</label>
                        <input type='date' className='form-control mb-3 date-wrapper' value={modalEventStartDate} onChange={(e) => setModalEventStartDate(e.target.value)} />
                        {startValidation ? <div className='text-danger'>開始日が未入力です</div> : null}
                    </div>
                    <div className='mb-3'>
                        <label className='form-label mb-0'>終了日</label>
                        <input type='date' className='form-control mb-3 date-wrapper' value={modalEventEndDate} onChange={(e) => setModalEventEndDate(e.target.value)} />
                        {endValidation ? <div className='text-danger'>終了日が未入力です</div> : null}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button className='bg-secondary rounded text-white btn calendar_modal_close' variant="secondary" onClick={listClose}>
                        閉じる
                    </Button>
                    <Button className='bg-primary rounded text-white btn calendar_modal_close' variant="secondary" onClick={() => confirmEvent()}>
                        入力内容で登録
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default CalendarList