import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import Table from 'react-bootstrap/esm/Table';
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Modal from 'react-bootstrap/Modal';
import { getYearMonthArray } from '../utils/getYearMonthArray';

type Customer = { id_related: string, name: string, staff: string; status: string; action: string; registered: string; medium: string; case: string; reserved: string; contract: string; rank: string };
type Action = { date: string, method: string, subject: string, staff: string, note: string, status: string };
type Staff = { id: number, name: string, pg_id: string, shop: string, status: string };
type Achievement = { name: string, shop: string, period: string, total: string, appointment: string };
const Dev = () => {
    const [originalCustomers, setOriginalCustomers] = useState<Customer[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [yearArray, setYearArray] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [open, setOpen] = useState(false);
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [sortKey, setSortKey] = useState<string>('registered');
    const [sortOrder, setSortOrder] = useState<string>('desc');
    const [staff, setStaff] = useState<Staff[]>([]);
    const tables = ['table-primary', 'table-danger', 'table-success', 'table-secondary'];
    const [callStatus, setCallStatus] = useState<Customer[]>([]);
    const [callDetail, setCallDetail] = useState<Action[]>([]);
    const [modalShow, setModalShow] = useState(false);
    const [achievementYear, setAchievementYear] = useState<string>('');
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);

    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");

        setOriginalMonthArray(getYearMonthArray(2025, 1));
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
        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) : originalMonthArray.length;
        const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
        setMonthArray(filteredMonthArray);

        const callMonth: string[] = [];
        if (startMonth !== '' && endMonth !== '') {
            for (let i = originalMonthArray.indexOf(startMonth); i <= originalMonthArray.indexOf(endMonth); i++) {
                callMonth.push(originalMonthArray[i]);
            }
        } else if (startMonth !== '' && endMonth === '') {
            for (let i = originalMonthArray.indexOf(startMonth); i <= originalMonthArray.length - 1; i++) {
                callMonth.push(originalMonthArray[i]);
            }
        } else if (startMonth === '' && endMonth !== '') {
            for (let i = originalMonthArray.indexOf(originalMonthArray[0]); i <= originalMonthArray.indexOf(endMonth); i++) {
                callMonth.push(originalMonthArray[i]);
            }
        } else if (startMonth === '' && endMonth === '') {
            for (let i = originalMonthArray.indexOf(originalMonthArray[0]); i <= originalMonthArray.length - 1; i++) {
                callMonth.push(originalMonthArray[i]);
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
        setCallDetail(filteredActionArray);
    }, [originalCustomers, startMonth, endMonth, originalMonthArray]);

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
                                {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                                <option value="" selected>終了月を選択</option>
                                {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
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
                                        <tbody className='align-middle'>
                                            <tr className='table-light'>
                                                <td style={{ width: '15%' }} colSpan={3}>チーム行動量</td>
                                                {['合計', ...monthArray].map(m => <td>{m}</td>)}
                                            </tr>
                                            {staff.map((item, iIndex) => {
                                                const total = callDetail.filter(c => c.staff === item.name && c.method === '電話(掛)');
                                                const totalGoal = achievement.filter(a => a.name === item.name && monthArray.includes(a.period));
                                                console.log(achievement)
                                                console.log(totalGoal)
                                                return (<React.Fragment key={iIndex}>
                                                    {['架電', '', '通電', '', 'アポ', ''].map((action, index) =>
                                                        <tr key={index}>
                                                            {index === 0 && <td className='table-light' rowSpan={6}>{item.name}</td>}
                                                            {index % 2 === 0 && <td rowSpan={2}>{action}</td>}
                                                            <td>{index % 2 === 0 ? '目標' : '実績'}</td>
                                                            {['', ...monthArray].map((m, mIndex) => {
                                                                const filtered = total.filter(t =>
                                                                    (mIndex === 0 ? true : t.date.includes(m)) &&
                                                                    (index === 3 ? t.status?.includes('通電') : true) &&
                                                                    (index === 5 ? t.status?.includes('アポイント') : true)
                                                                );
                                                                let goalValue;
                                                                if (mIndex > 0) {
                                                                    const filteredGoal = totalGoal.find(t =>
                                                                        (mIndex === 0 ? true : t.period.includes(m))
                                                                    );
                                                                    if (index === 0) {
                                                                        goalValue = filteredGoal?.total ?? ''
                                                                    } else if (index === 4) {
                                                                        goalValue = filteredGoal?.appointment ?? '';
                                                                    } else {
                                                                        goalValue = Number(filteredGoal?.total) / 2;
                                                                    }
                                                                } else {
                                                                    if (index === 0) {
                                                                        goalValue = totalGoal.reduce((acc, cur) => acc + Number(cur.total), 0);
                                                                    } else if (index === 4) {
                                                                        goalValue = totalGoal.reduce((acc, cur) => acc + Number(cur.appointment), 0);
                                                                    } else {
                                                                        goalValue = totalGoal.reduce((acc, cur) => acc + Number(cur.total), 0) /2;
                                                                    }
                                                                }

                                                                return <td key={mIndex}>{index % 2 === 0 ? goalValue : filtered.length}</td>
                                                            }
                                                            )}
                                                        </tr>)}
                                                </React.Fragment>
                                                )
                                            }
                                            )}
                                            {/* <tr className='table-primary fw-bold'>
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
                                            </tr> */}
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