import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import Table from 'react-bootstrap/esm/Table';
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext.js";
import { useNavigate } from "react-router-dom";
import Modal from 'react-bootstrap/Modal';

type Customer = { id_related: string, name: string, staff: string; status: string; action: string; registered: string; medium: string; case: string; reserved: string; contract: string; rank: string };
type Action = { date: string, method: string, subject: string, staff: string, note: string, status : string };
type Staff = { id: number, name: string, pg_id: string, shop: string, status: string };
type Achievement = { name: string, shop: string, period: string, total: string, appointment: string };
const Dev = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [originalCustomers, setOriginalCustomers] = useState<Customer[]>([]);
    const [registeredCustomer, setRegisteredCustomer] = useState<Customer[]>([]);
    const [reservedCustomer, setReservedCustomer] = useState<Customer[]>([]);
    const [contractCustomer, setContractCustomer] = useState<Customer[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [yearArray, setYearArray] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [mediumList, setMediumList] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<string>('registered');
    const [sortOrder, setSortOrder] = useState<string>('desc');
    const [staff, setStaff] = useState<Staff[]>([]);
    const tables = ['table-primary', 'table-danger', 'table-success', 'table-secondary'];
    const [callStatus, setCallStatus] = useState<Customer[]>([]);
    const [callDetail, setCallDetail] = useState<Action[]>([]);
    const [modalShow, setModalShow] = useState(false);
    const [achievementYear, setAchievementYear] = useState<string>('');
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    useEffect(() => {
        if (!brand || brand.trim() === "") navigate("/");
        const getYearMonthArray = (startYear: number, startMonth: number) => {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const yearMonthArray: string[] = [];
            let year = startYear;
            let month = startMonth;

            while (
                year < currentYear ||
                (year === currentYear && month <= currentMonth)) {
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
        setMonthArray(getYearMonthArray(2025, 1));
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_report" }, { headers });
                const staffResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_staff" }, { headers });
                const achievementResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_call_show" }, { headers });
                setOriginalCustomers(customerResponse.data);
                console.log(staffResponse.data)
                setStaff(staffResponse.data);
                setAchievement(achievementResponse.data);
            } catch (error) {
                console.error('データ取得エラー:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        let startDate: Date | undefined;
        if (startMonth !== '') {
            const [year, month] = startMonth.split('/').map(Number);
            startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        } else {
            startDate = new Date(2025, 0, 1, 0, 0, 0, 0);
        }


        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        const filteredRegister = originalCustomers.filter(item => {
            const registered = new Date(item.registered);
            return (
                (startDate ? registered >= startDate : true) &&
                (endDate ? registered <= endDate : true)
            )
        });
        setRegisteredCustomer(filteredRegister);

        const filteredReserve = originalCustomers.filter(item => {
            const reserved = new Date(item.reserved);
            return (
                (startDate ? reserved >= startDate : true) &&
                (endDate ? reserved <= endDate : true)
            )
        });
        setReservedCustomer(filteredReserve);

        const filteredContract = originalCustomers.filter(item => {
            const contract = new Date(item.contract);
            return (
                (startDate ? contract >= startDate : true) &&
                (endDate ? contract <= endDate : true)
            )
        });
        setContractCustomer(filteredContract);

        const callMonth: string[] = [];
        if (startMonth !== '' && endMonth !== '') {
            for (let i = monthArray.indexOf(startMonth); i <= monthArray.indexOf(endMonth); i++) {
                callMonth.push(monthArray[i]);
            }
        } else if (startMonth !== '' && endMonth === '') {
            for (let i = monthArray.indexOf(startMonth); i <= monthArray.length - 1; i++) {
                callMonth.push(monthArray[i]);
            }
        } else if (startMonth === '' && endMonth !== '') {
            for (let i = monthArray.indexOf(monthArray[0]); i <= monthArray.indexOf(endMonth); i++) {
                callMonth.push(monthArray[i]);
            }
        } else if (startMonth === '' && endMonth === '') {
            for (let i = monthArray.indexOf(monthArray[0]); i <= monthArray.length - 1; i++) {
                callMonth.push(monthArray[i]);
            }
        }


        const filteredActionArray: Action[] = originalCustomers.flatMap(item => {
            try {
                if (!item.action) return [];
                const actionArray: Action[] = JSON.parse(item.action);
                return actionArray.filter(a => callMonth?.includes(a.date.slice(0, 7)));
            } catch (e) {
                console.error("Invalid JSON:", item.action, e);
                return [];
            }
        });
        console.log(filteredActionArray)
        setCallDetail(filteredActionArray);
    }, [originalCustomers, startMonth, endMonth]);

    useEffect(() => {
        const filtered: string[] = monthArray.map(month => month.split('/')[0]);
        setYearArray([...new Set(filtered)]);
        setAchievementYear(filtered[filtered.length - 1]);
    }, [monthArray]);

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
    };

    const modalClose = async () => {
        await setModalShow(false);
    };

    const achievementGoal = async (totalValue: string, appointmentValue: string, nameValue: string, monthValue: string, shopValue: string) => {
        type Postdata = { name: string, shop: string, period: string, demand: string, total: number, appointment: number };
        const postData: Postdata = {
            name: nameValue,
            shop: shopValue,
            period: monthValue,
            demand: 'resale_call_achievement',
            total: Number(totalValue ? totalValue : "0"),
            appointment: Number(appointmentValue ? appointmentValue : "0")
        };
        console.log(postData)

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post('https://khg-marketing.info/dashboard/api/khf/', postData, { headers });
                console.log(response.data);
                setAchievement(prev =>
                    prev.map(item =>
                        item.name === nameValue && item.period === monthValue && item.shop === shopValue
                            ? {
                                ...item,
                                total: totalValue,
                                appointment: appointmentValue
                            }
                            : item
                    )
                );


            } catch (error) {
                alert('目標値の更新に失敗');
                console.log(error);
            }
        };
        await fetchData();
    };

    return (
        <>
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
                </div>
                <div className='content calendar bg-white p-2'>
                    <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                    <div className="d-flex flex-wrap mb-3 align-items-center">
                        <div className="m-1">
                            <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                                <option value="" selected>開始月を選択</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                                <option value="" selected>終了月を選択</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <div className="resale_customer_button" onClick={() => setModalShow(true)}>行動量目標設定</div>
                        </div>
                    </div>
                    {isLoading ? (<p className="ms-3"><i className="fa-solid fa-spinner me-2 spinning"></i>Now Loading</p>) :
                        <div className="table-wrapper mt-3">
                            <div className="list_table kaeru">
                                <div className="mb-3">
                                    <Table bordered style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr className='table-light'>
                                                <td style={{ width: '15%' }}>リフォーム反響</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>総反響</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>通電数</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>アポイント数</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>来店数</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>物件案内数</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>契約数</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>通電率</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>通電アポ率</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>来店率</td>
                                                <td style={{ width: 'calc( 85% / 10)' }}>契約率</td>
                                            </tr>
                                            {staff.filter(s => !s.shop?.includes('(買)')).map((item, index) => {
                                                const registeredLength = registeredCustomer.filter(r => r.staff === item.name && r.case?.includes('買')).length;
                                                const callLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('通電') && r.case?.includes('買')).length;
                                                const appointmentLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('アポイント') && r.case?.includes('買')).length;
                                                const reservedLength = reservedCustomer.filter(r => r.staff === item.name && r.case?.includes('買')).length;
                                                const introduceLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('物件案内') && r.case?.includes('買')).length;
                                                const contractLength = contractCustomer.filter(r => r.staff === item.name && r.case?.includes('買')).length;
                                                const callPer = isNaN(callLength / registeredLength) ? '0' : Math.floor(callLength / registeredLength * 1000) / 10;
                                                const appointmentPer = isNaN(appointmentLength / callLength) ? '0' : Math.floor(appointmentLength / callLength * 1000) / 10;
                                                const reservePer = isNaN(reservedLength / registeredLength) ? '0' : Math.floor(reservedLength / registeredLength * 1000) / 10;
                                                const contractPer = isNaN(contractLength / reservedLength) ? '0' : Math.floor(contractLength / reservedLength * 1000) / 10;
                                                return (
                                                    <tr key={index} style={{ textAlign: 'right' }}>
                                                        <td className='table-light' style={{ textAlign: 'left' }}>{item.name}</td>
                                                        <td>{registeredLength}</td>
                                                        <td>{callLength}</td>
                                                        <td>{appointmentLength}</td>
                                                        <td>{reservedLength}</td>
                                                        <td>{introduceLength}</td>
                                                        <td>{contractLength}</td>
                                                        <td>{callPer}%</td>
                                                        <td>{appointmentPer}%</td>
                                                        <td>{reservePer}%</td>
                                                        <td>{contractPer}%</td>
                                                    </tr>
                                                )
                                            }
                                            )}
                                            <tr className='table-primary fw-bold' style={{ textAlign: 'right' }}>
                                                <td style={{ textAlign: 'left' }}>中古住宅専門店合計</td>
                                                {(() => {
                                                    const registeredLength = registeredCustomer.filter(r => r.case?.includes('買')).length;
                                                    const callLength = registeredCustomer.filter(r => r.case?.includes('買') && r.action?.includes('通電')).length;
                                                    const appointmentLength = registeredCustomer.filter(r => r.case?.includes('買') && r.action?.includes('アポイント')).length;
                                                    const reservedLength = reservedCustomer.filter(r => r.case?.includes('買')).length;
                                                    const introduceLength = registeredCustomer.filter(r => r.case?.includes('買') && r.action?.includes('物件案内')).length;
                                                    const contractLength = contractCustomer.filter(r => r.case?.includes('買')).length;
                                                    const callPer = isNaN(callLength / registeredLength) ? '0' : Math.floor(callLength / registeredLength * 1000) / 10;
                                                    const appointmentPer = isNaN(appointmentLength / callLength) ? '0' : Math.floor(appointmentLength / callLength * 1000) / 10;
                                                    const reservePer = isNaN(reservedLength / registeredLength) ? '0' : Math.floor(reservedLength / registeredLength * 1000) / 10;
                                                    const contractPer = isNaN(contractLength / reservedLength) ? '0' : Math.floor(contractLength / reservedLength * 1000) / 10;
                                                    return (<>
                                                        <td>{registeredLength}</td>
                                                        <td>{callLength}</td>
                                                        <td>{appointmentLength}</td>
                                                        <td>{reservedLength}</td>
                                                        <td>{introduceLength}</td>
                                                        <td>{contractLength}</td>
                                                        <td>{callPer}%</td>
                                                        <td>{appointmentPer}%</td>
                                                        <td>{reservePer}%</td>
                                                        <td>{contractPer}%</td>
                                                    </>);
                                                })()}
                                            </tr>
                                        </tbody>
                                    </Table>
                                </div>
                                <div className="mb-3">
                                    <Table bordered style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr className='table-light' >
                                                <td style={{ width: '15%' }}>買取反響</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>総反響</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>通電数</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>アポイント数</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>訪問査定数</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>媒介取得数</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>契約数</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>通電率</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>通電アポ率</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>査定率</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>媒介取得率</td>
                                                <td style={{ width: 'calc( 85% / 11)' }}>契約率</td>
                                            </tr>
                                            {staff.filter(s => s.shop?.includes('(買)')).map((item, index) => {
                                                const registeredLength = registeredCustomer.filter(r => r.staff === item.name && r.case?.includes('売')).length;
                                                const callLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('通電') && r.case?.includes('売')).length;
                                                const appointmentLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('アポイント') && r.case?.includes('売')).length;
                                                const introduceLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('訪問査定') && r.case?.includes('売')).length;
                                                const brokerLength = registeredCustomer.filter(r => r.staff === item.name && r.action?.includes('媒介契約') && r.case?.includes('売')).length;
                                                const contractLength = contractCustomer.filter(r => r.staff === item.name && r.case?.includes('売')).length;
                                                const callPer = isNaN(callLength / registeredLength) ? '0' : Math.floor(callLength / registeredLength * 1000) / 10;
                                                const appointmentPer = isNaN(appointmentLength / callLength) ? '0' : Math.floor(appointmentLength / callLength * 1000) / 10;
                                                const reservePer = isNaN(introduceLength / registeredLength) ? '0' : Math.floor(introduceLength / registeredLength * 1000) / 10;
                                                const brokerPer = isNaN(brokerLength / introduceLength) ? '0' : Math.floor(brokerLength / introduceLength * 1000) / 10;
                                                const contractPer = isNaN(contractLength / brokerLength) ? '0' : Math.floor(contractLength / brokerLength * 1000) / 10;
                                                return (
                                                    <tr key={index} style={{ textAlign: 'right' }}>
                                                        <td className='table-light' style={{ textAlign: 'left' }}>{item.name}</td>
                                                        <td>{registeredLength}</td>
                                                        <td>{callLength}</td>
                                                        <td>{appointmentLength}</td>
                                                        <td>{introduceLength}</td>
                                                        <td>{brokerLength}</td>
                                                        <td>{contractLength}</td>
                                                        <td>{callPer}%</td>
                                                        <td>{appointmentPer}%</td>
                                                        <td>{reservePer}%</td>
                                                        <td>{brokerPer}%</td>
                                                        <td>{contractPer}%</td>
                                                    </tr>
                                                )
                                            }
                                            )}
                                            <tr className='table-primary fw-bold' style={{ textAlign: 'right' }}>
                                                <td style={{ textAlign: 'left' }}>中古住宅専門店合計</td>
                                                {(() => {
                                                    const registeredLength = registeredCustomer.filter(r => r.case?.includes('売')).length;
                                                    const callLength = registeredCustomer.filter(r => r.case?.includes('売') && r.action?.includes('通電')).length;
                                                    const appointmentLength = registeredCustomer.filter(r => r.case?.includes('売') && r.action?.includes('アポイント')).length;
                                                    const introduceLength = registeredCustomer.filter(r => r.case?.includes('売') && r.action?.includes('訪問査定')).length;
                                                    const brokerLength = registeredCustomer.filter(r => r.case?.includes('売') && r.action?.includes('媒介契約')).length;
                                                    const contractLength = contractCustomer.filter(r => r.case?.includes('売')).length;
                                                    const callPer = isNaN(callLength / registeredLength) ? '0' : Math.floor(callLength / registeredLength * 1000) / 10;
                                                    const appointmentPer = isNaN(appointmentLength / callLength) ? '0' : Math.floor(appointmentLength / callLength * 1000) / 10;
                                                    const reservePer = isNaN(introduceLength / registeredLength) ? '0' : Math.floor(introduceLength / registeredLength * 1000) / 10;
                                                    const brokerPer = isNaN(brokerLength / introduceLength) ? '0' : Math.floor(brokerLength / introduceLength * 1000) / 10;
                                                    const contractPer = isNaN(contractLength / brokerLength) ? '0' : Math.floor(contractLength / brokerLength * 1000) / 10;
                                                    return (<>
                                                        <td>{registeredLength}</td>
                                                        <td>{callLength}</td>
                                                        <td>{appointmentLength}</td>
                                                        <td>{introduceLength}</td>
                                                        <td>{brokerLength}</td>
                                                        <td>{contractLength}</td>
                                                        <td>{callPer}%</td>
                                                        <td>{appointmentPer}%</td>
                                                        <td>{reservePer}%</td>
                                                        <td>{brokerPer}%</td>
                                                        <td>{contractPer}%</td>
                                                    </>);
                                                })()}
                                            </tr>
                                        </tbody>
                                    </Table>
                                </div>
                                <div className="mb-3">
                                    <Table bordered style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr className='table-light'>
                                                <td style={{ width: '15%' }}>チーム行動量</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>架電目標</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>架電合計</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>通電合計</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>通電アポ合計</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>アポ目標</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>架電達成率</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>通電率</td>
                                                <td style={{ width: 'calc( 85% / 8)' }}>アポ達成率</td>
                                            </tr>
                                            {staff.map((item, index) => {
                                                const filteredAchievement: Achievement[] = achievement.filter(item => {
                                                    const period = new Date(item.period);
                                                    return (
                                                        (startMonth ? period >= new Date(startMonth) : true) &&
                                                        (endMonth ? period <= new Date(endMonth) : true)
                                                    )
                                                });
                                                const totalValue = filteredAchievement.filter(f => f.name === item.name).reduce((acc, cur) => acc + Number(cur.total), 0);
                                                const appointmentValue = filteredAchievement.filter(f => f.name === item.name).reduce((acc, cur) => acc + Number(cur.appointment), 0);
                                                const callTotal = callDetail.filter(c => c.method === "電話(掛)" && c.staff === item.name).length;
                                                const talkTotal = callDetail.filter(c => c.method === "電話(掛)" && c.staff === item.name && c.status?.includes('通電')).length;
                                                const appointmentTotal = callDetail.filter(c => c.method === "電話(掛)" && c.staff === item.name && c.status?.includes('アポイント')).length;
                                                const totalAchievement = isNaN(callTotal / totalValue) ? '0' : Math.floor(callTotal / totalValue * 1000) / 10;
                                                const talkTotalAchievement = isNaN(talkTotal / callTotal) ? '0' : Math.floor(talkTotal / callTotal * 1000) / 10;
                                                const appointmentTotalAchievement = isNaN(appointmentTotal / callTotal) ? '0' : Math.floor(appointmentTotal / callTotal * 1000) / 10;
                                                return (
                                                    <tr key={index}>
                                                        <td className='table-light'>{item.name}</td>
                                                        <td style={{ textAlign: 'right' }}>{totalValue}</td>
                                                        <td style={{ textAlign: 'right' }}>{callTotal}</td>
                                                        <td style={{ textAlign: 'right' }}>{talkTotal}</td>
                                                        <td style={{ textAlign: 'right' }}>{appointmentTotal}</td>
                                                        <td style={{ textAlign: 'right' }}>{appointmentValue}</td>
                                                        <td style={{ textAlign: 'right' }}>{totalAchievement}%</td>
                                                        <td style={{ textAlign: 'right' }}>{talkTotalAchievement}%</td>
                                                        <td style={{ textAlign: 'right' }}>{appointmentTotalAchievement}%</td>
                                                    </tr>
                                                )
                                            }
                                            )}
                                            <tr className='table-primary fw-bold'>
                                                <td>中古住宅専門店合計</td>
                                                {(() => {
                                                    const filteredAchievement: Achievement[] = achievement.filter(item => {
                                                        const period = new Date(item.period);
                                                        return (
                                                            (startMonth ? period >= new Date(startMonth) : true) &&
                                                            (endMonth ? period <= new Date(endMonth) : true)
                                                        )
                                                    });
                                                    const totalValue = filteredAchievement.reduce((acc, cur) => acc + Number(cur.total), 0);
                                                    const appointmentValue = filteredAchievement.reduce((acc, cur) => acc + Number(cur.appointment), 0);
                                                    const callTotal = callDetail.filter(c => c.method === "電話(掛)").length;
                                                    const talkTotal = callDetail.filter(c => c.method === "電話(掛)" && c.status?.includes('通電')).length;
                                                    const appointmentTotal = callDetail.filter(c => c.method === "電話(掛)" && c.status?.includes('アポイント')).length;
                                                    const totalAchievement = isNaN(callTotal / totalValue) ? '0' : Math.floor(callTotal / totalValue * 1000) / 10;
                                                    const talkTotalAchievement = isNaN(talkTotal / callTotal) ? '0' : Math.floor(talkTotal / callTotal * 1000) / 10;
                                                    const appointmentTotalAchievement = isNaN(appointmentTotal / callTotal) ? '0' : Math.floor(appointmentTotal / callTotal * 1000) / 10;
                                                    return (<>
                                                        <td style={{ textAlign: 'right' }}>{totalValue}</td>
                                                        <td style={{ textAlign: 'right' }}>{callTotal}</td>
                                                        <td style={{ textAlign: 'right' }}>{talkTotal}</td>
                                                        <td style={{ textAlign: 'right' }}>{appointmentTotal}</td>
                                                        <td style={{ textAlign: 'right' }}>{appointmentValue}</td>
                                                        <td style={{ textAlign: 'right' }}>{totalAchievement}%</td>
                                                        <td style={{ textAlign: 'right' }}>{talkTotalAchievement}%</td>
                                                        <td style={{ textAlign: 'right' }}>{appointmentTotalAchievement}%</td>
                                                    </>);
                                                })()}
                                            </tr>
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        </div>}
                </div>
            </div>
            <Modal show={modalShow} onHide={modalClose} size='lg'>
                <div className="modal-header-sticky">
                    <Modal.Header closeButton>
                        <Modal.Title style={{ fontSize: '13px' }}>行動量目標設定</Modal.Title>
                    </Modal.Header></div>
                <Modal.Body style={{ height: '70vh', overflowY: 'auto' }} className='modal_body'>
                    <>
                        <div className="my-3">
                            <select className='target' onChange={(e) => setAchievementYear(e.target.value)}>
                                <option value="">対象年を選択</option>
                                {yearArray.map((year) =>
                                    <option value={year} selected={achievementYear === year}>{year}年</option>)}
                            </select>
                        </div>
                        <Table bordered striped>
                            <tbody style={{ fontSize: '12px' }}>
                                <tr>
                                    <td>期間</td>
                                    <td>氏名</td>
                                    <td>架電目標数</td>
                                    <td>アポ目標数</td>
                                </tr>
                                {monthArray.filter(month => month?.includes(achievementYear)).flatMap((month) =>
                                    staff.map((item, index) => {
                                        const totalValue = achievement.find(a => a.name === item.name && a.period === month)?.total;
                                        const appointmentValue = achievement.find(a => a.name === item.name && a.period === month)?.appointment;
                                        return (
                                            <tr key={`${month}-${index}`}>
                                                <td>{month}</td>
                                                <td>{item.name}</td>
                                                <td><input type="number" className='target resale_call' onChange={(e) => achievementGoal(e.target.value, String(appointmentValue ? appointmentValue : 0), item.name, month, '中専鹿児島店')} value={totalValue} /></td>
                                                <td><input type="number" className='target resale_call' onChange={(e) => achievementGoal(String(totalValue ? totalValue : 0), e.target.value, item.name, month, '中専鹿児島店')} value={appointmentValue} /></td>
                                            </tr>
                                        )
                                    })
                                )}


                            </tbody>
                        </Table>
                    </>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default Dev