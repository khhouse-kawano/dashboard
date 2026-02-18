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
type Customer = { id_related: string, estate_name_1: string, name: string, staff: string; status: string; action: string; registered: string; medium: string; case: string; reserved: string; contract: string; rank: string, flag: string };
type Achievement = { name: string, shop: string, period: string, total: string, appointment: string };
type Medium = { id: number; medium: string };
type ResponseData = { period: string, registered: number, reserved: number, contract: number };
type Action = { date: string, method: string, subject: string, staff: string, note: string, status: string };

const PortalSell = () => {
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
    const [registeredCustomers, setRegisteredCustomers] = useState<Customer[]>([]);
    const [reservedCustomers, setReservedCustomers] = useState<Customer[]>([]);
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

    const [display, setDisplay] = useState({
        registered: {
            label: '総反響',
            show: true
        },
        reserved: {
            label: '査定更新',
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
        setOriginalMonthArray(getYearMonthArray(2025, 1));
        if (!brand || !token || !category) navigate("/login");
        setSortKey('registered');
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_report" }, { headers });
                const staffResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_staff" }, { headers });
                const achievementResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "resale_call_show" }, { headers });
                const mediumResponse = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "medium_list" }, { headers });
                setOriginalCustomers(customerResponse.data); //初期フィルター
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
        const filteredRegistered = originalCustomers.filter(o => {
            return o.flag === 'exist' && (targetMedium ? o.medium === targetMedium : mediumArray.map(m => m.medium).includes(o.medium)) && monthArray.includes(o.registered.slice(0, 7))
        });
        setRegisteredCustomers(filteredRegistered);

        const filteredReserved = originalCustomers.filter(o => {
            const action = o.action ? JSON.parse(o.action) : [];
            const filteredAction = action.filter(a => a.method === '査定更新' && monthArray.includes(a.date.slice(0, 7).replace('-', '/')));
            return o.flag === 'exist' && (targetMedium ? o.medium === targetMedium : mediumArray.map(m => m.medium).includes(o.medium)) && filteredAction.length > 0
        });
        setReservedCustomers(filteredReserved);

        const filteredContract = originalCustomers.filter(o => {
            const action = o.action ? JSON.parse(o.action) : [];
            const filteredAction = action.filter(a => a.method === '媒介取得' && monthArray.includes(a.date.slice(0, 7).replace('-', '/')));
            return o.flag === 'exist' && (targetMedium ? o.medium === targetMedium : mediumArray.map(m => m.medium).includes(o.medium)) && filteredAction.length > 0
        });
        setContractCustomers(filteredContract);

        const filteredLineData: ResponseData[] = monthArray.map(month => {
            const registeredLength = filteredRegistered.filter(c => c.registered.includes(month) && (targetMedium ? c.medium === targetMedium : true)).length;
            const reservedLength = filteredReserved.filter(c => c.reserved.includes(formate(month)) && (targetMedium ? c.medium === targetMedium : true)).length;
            const contractLength = filteredContract.filter(c => c.contract.includes(formate(month)) && (targetMedium ? c.medium === targetMedium : true)).length;
            return {
                period: month,
                registered: registeredLength,
                reserved: reservedLength,
                contract: contractLength
            }
        });
        setResponseLineData(filteredLineData);
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
                                <select className="target" onChange={(e) => setTargetMedium(e.target.value)}>
                                    <option value="" selected>販促媒体を選択</option>
                                    {mediumArray.map((m, index) => (<option key={index} value={m.medium}>{m.medium}</option>
                                    ))}
                                    <option></option>
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setSortKey(e.target.value)}>
                                    <option value="" selected>項目で並び替え</option>
                                    {Object.entries(display).map(([key, value]) =>
                                        <option value={key}>{value.label}数</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="d-flex flex-wrap mb-3 align-items-center">
                            <div className="m-1">
                                <label className="target checkbox d-flex align-items-center">
                                    <input type="checkbox" checked={showGraph} className='me-1' onChange={() => setShowGraph(prev => !prev)} />グラフを表示
                                </label>
                            </div>
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
                                        <div style={{ minWidth: `${(monthArray.length + 1) * 60 + 200}px`, fontSize: '12px' }}>
                                            <Table bordered striped style={{ tableLayout: 'fixed', width: 'auto' }}>
                                                <tbody className='align-middle'>
                                                    <tr>
                                                        <td colSpan={2} style={{ width: '200px' }}>スタッフ</td>
                                                        {['全期間', ...monthArray, 'A', 'B', 'C'].map(month =>
                                                            <td key={month} style={{ width: '60px', textAlign: 'center' }}>{month}</td>
                                                        )}
                                                    </tr>
                                                    {[{ id: 0, medium: '全媒体', resale_medium: 1 }, ...mediumArray, { id: null, medium: '不明', resale_medium: null }]
                                                        .sort((a, b) => {
                                                            const targetList =
                                                                sortKey === 'registered'
                                                                    ? registeredCustomers
                                                                    : sortKey === 'reserved'
                                                                        ? reservedCustomers
                                                                        : contractCustomers;
                                                            const countA = targetList.filter(r => a.id === 0 ? true : a.id === null ? r.medium === '' : r.medium === a.medium).length;
                                                            const countB = targetList.filter(r => b.id === 0 ? true : b.id === null ? r.medium === '' : r.medium === b.medium).length;
                                                            return countB - countA;
                                                        })
                                                        .map((m, mIndex) => Object.entries(display).map(([key, value], rIndex) => {
                                                            const filtered =
                                                                rIndex === 0 ? registeredCustomers.filter(r => (mIndex > 0 ? r.medium === m.medium : true)) :
                                                                    rIndex === 1 ? reservedCustomers.filter(r => (mIndex > 0 ? r.medium === m.medium : true)) :
                                                                        contractCustomers.filter(r => (mIndex > 0 ? r.medium === m.medium : true));
                                                            const visibleKeys = Object.keys(display).filter(k => display[k].show);
                                                            const isFirstVisible = visibleKeys[0] === key;
                                                            return (
                                                                (display[key].show && (targetMedium ? targetMedium === m.medium : true)) && (
                                                                    <tr key={key}>
                                                                        {isFirstVisible && (
                                                                            <td rowSpan={visibleKeys.length}>{m.medium}</td>
                                                                        )}
                                                                        <td style={{ width: '80px' }}>{value.label}</td>
                                                                        {['期間計', ...monthArray, 'A', 'B', 'C'].map((month, monthIndex) => {
                                                                            let targetList: Customer[] = [];
                                                                            if (monthIndex <= monthArray.length) {
                                                                                targetList = filtered.filter(f => {
                                                                                    let targetDate = "";
                                                                                    if (rIndex === 0) {
                                                                                        targetDate = formate(f.registered);
                                                                                    } else if (rIndex >= 1) {
                                                                                        const action: Action[] = f.action ? JSON.parse(f.action) : [];
                                                                                        const actionDate = action.find(a => a.method === value.label)?.date ?? '';
                                                                                        targetDate = formate(actionDate);
                                                                                    }
                                                                                    return monthIndex > 0 ? targetDate.includes(formate(month)) : true;
                                                                                });
                                                                            } else {
                                                                                targetList = registeredCustomers.filter(r => r.rank === month && (mIndex > 0 ? r.medium === m.medium : true));
                                                                            }
                                                                            return (
                                                                                <>{!(rIndex > 0 && monthIndex > monthArray.length) && (
                                                                                    <td key={month} style={{ textAlign: 'right' }} rowSpan={monthIndex > monthArray.length ? 3 : 1}>
                                                                                        <div
                                                                                            style={{
                                                                                                cursor: targetList.length > 0 ? 'pointer' : '',
                                                                                                textDecoration: targetList.length > 0 ? 'underline' : '',
                                                                                                color: targetList.length > 0 ? '#007bff' : '',
                                                                                            }}
                                                                                            onClick={() => targetList.length > 0 && setCustomerList(targetList)}
                                                                                        >
                                                                                            {targetList.length}
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                                </>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                )
                                                            );
                                                        }))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>
                                    {/* 以下スタッフ */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <div style={{ minWidth: `${(monthArray.length + 1) * 60 + 200}px`, fontSize: '12px' }}>
                                            <Table bordered striped style={{ tableLayout: 'fixed', width: 'auto' }}>
                                                <tbody className='align-middle'>
                                                    <tr>
                                                        <td colSpan={2} style={{ width: '200px' }}>スタッフ</td>
                                                        {['全期間', ...monthArray, 'A', 'B', 'C'].map(month =>
                                                            <td key={month} style={{ width: '60px', textAlign: 'center' }}>{month}</td>
                                                        )}
                                                    </tr>
                                                    {staff
                                                        .sort((a, b) => {
                                                            const countA =
                                                                sortKey === 'registered'
                                                                    ? registeredCustomers.filter(r => r.staff === a.name).length
                                                                    : sortKey === 'reserved'
                                                                        ? reservedCustomers.filter(r => r.staff === a.name).length
                                                                        : contractCustomers.filter(r => r.staff === a.name).length;
                                                            const countB =
                                                                sortKey === 'registered'
                                                                    ? registeredCustomers.filter(r => r.staff === b.name).length
                                                                    : sortKey === 'reserved'
                                                                        ? reservedCustomers.filter(r => r.staff === b.name).length
                                                                        : contractCustomers.filter(r => r.staff === b.name).length;
                                                            return countB - countA;
                                                        })
                                                        .map(s => {
                                                            const visibleKeys = Object.keys(display).filter(k => display[k].show);
                                                            return visibleKeys.map((key, rIndex) => {
                                                                const value = display[key];
                                                                const filtered =
                                                                    key === 'registered'
                                                                        ? registeredCustomers.filter(r => r.staff === s.name)
                                                                        : key === 'reserved'
                                                                            ? reservedCustomers.filter(r => r.staff === s.name && r.reserved)
                                                                            : contractCustomers.filter(r => r.staff === s.name && r.contract);
                                                                const isFirstVisible = rIndex === 0;
                                                                return (
                                                                    <tr key={`${s.name}-${key}`}>
                                                                        {isFirstVisible && (
                                                                            <td rowSpan={visibleKeys.length}>{s.name}</td>
                                                                        )}
                                                                        <td style={{ width: '80px' }}>{value.label}</td>
                                                                        {['期間計', ...monthArray, 'A', 'B', 'C'].map((month, monthIndex) => {
                                                                            let targetList: Customer[] = [];
                                                                            if (monthIndex <= monthArray.length) {
                                                                                targetList = filtered.filter(f => {
                                                                                    let targetDate = "";
                                                                                    if (rIndex === 0) {
                                                                                        targetDate = formate(f.registered);
                                                                                    } else if (rIndex >= 1) {
                                                                                        const action: Action[] = f.action ? JSON.parse(f.action) : [];
                                                                                        const actionDate = action.find(a => a.method === value.label)?.date ?? '';
                                                                                        targetDate = formate(actionDate);
                                                                                    }
                                                                                    return monthIndex > 0 ? targetDate.includes(formate(month)) : true;
                                                                                });
                                                                            } else {
                                                                                targetList = registeredCustomers.filter(r => r.staff === s.name && r.rank === month);
                                                                            }
                                                                            return (
                                                                                <>{!(rIndex > 0 && monthIndex > monthArray.length) && (
                                                                                    <td key={month} style={{ textAlign: 'right' }} rowSpan={monthIndex > monthArray.length ? 3 : 1}>
                                                                                        <div
                                                                                            style={{
                                                                                                cursor: targetList.length > 0 ? 'pointer' : '',
                                                                                                textDecoration: targetList.length > 0 ? 'underline' : '',
                                                                                                color: targetList.length > 0 ? '#007bff' : '',
                                                                                            }}
                                                                                            onClick={() => targetList.length > 0 && setCustomerList(targetList)}
                                                                                        >
                                                                                            {targetList.length}
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                                </>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                );
                                                            });
                                                        })}
                                                </tbody>
                                            </Table>

                                        </div>
                                    </div>
                                </div>
                            </>}
                    </div>
                </div>
            </div>
            <Modal show={modalShow} onHide={modalClose} size='lg'>
                <ModalHeader closeButton></ModalHeader>
                <ModalBody>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '11px' }}>
                            <tr>
                                <td>No</td>
                                <td>顧客名</td>
                                <td>担当</td>
                                <td>ランク</td>
                                <td>物件名</td>
                                <td>販促媒体</td>
                                <td>反響日</td>
                                <td>初回面談日</td>
                                <td>契約日</td>
                                <td>応対履歴</td>
                            </tr>
                            {customerList.map((c, cIndex) => {
                                const action = c.action ? JSON.parse(c.action) : [];
                                return (
                                    <>
                                        <tr>
                                            <td>{cIndex + 1}</td>
                                            <td>{c.name}</td>
                                            <td>{c.staff}</td>
                                            <td>{c.rank}</td>
                                            <td>{c.estate_name_1}</td>
                                            <td>{c.medium}</td>
                                            <td>{c.registered.split(' ')[0]}</td>
                                            <td>{displayFormate(c.reserved)}</td>
                                            <td>{displayFormate(c.contract)}</td>
                                            <td>
                                                <div className='bg-primary text-white rounded-pill text-center py-1'
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setOpenIndex(cIndex)}
                                                >表示</div>
                                            </td>
                                        </tr>
                                        <div className={`action_display ${openIndex === cIndex ? '' : 'd-none'}`}>
                                            <div className="action_close bg-white" onClick={() => setOpenIndex(null)}>×</div>
                                            <div>{action
                                                .sort((a, b) => {
                                                    const keyA = new Date(a.date).getTime();
                                                    const keyB = new Date(b.date).getTime();
                                                    return keyB - keyA
                                                })
                                                .map(a =>
                                                    <div className='mb-3 pt-4'>
                                                        {a.date}<br />{a.method}<br />{a.subject}
                                                    </div>)}
                                            </div>
                                        </div>
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

export default PortalSell