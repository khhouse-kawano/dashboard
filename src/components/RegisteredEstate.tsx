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

type Staff = { id: number, name: string, shop: string, section: string, sort: number, report: number };
type Estate = { id: number, name: string, period: string, url: string, value: 1 };
type Shop = { brand; string, shop: string, section: string };
const RegisteredEstate = () => {
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
    const [shop, setShop] = useState<Shop[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [originalEstate, setOriginalEstate] = useState<Estate[]>([]);
    const [estate, setEstate] = useState<Estate[]>([]);
    const [sortKey, setSortKey] = useState('');
    const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
    const targetSection = ['鹿児島営業1課', '鹿児島営業2課', '鹿児島営業3課', '宮崎営業課', '熊本営業課', '大分・佐賀営業課'];
    const excludedShop = ['FH鹿児島店', 'FH霧島店', 'DJH加世田店', 'DJH鹿屋店', 'JH八代店'];
    const normalize = (name: string) =>
        name.replace(/\s+/g, '').trim();

    useEffect(() => {
        setOriginalMonthArray(getYearMonthArray(2025, 1));
        setSortKey('registered');
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [estateRes, shopRes, staffResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "estate_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers })
                ]);
                setShop(shopRes.data.filter(s => !excludedShop.includes(s.shop)));
                setOriginalEstate(estateRes.data);
                setStaff(staffResponse.data.filter(s => !excludedShop.includes(s.shop)));
            } catch (error) {
                console.error('データ取得エラー:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const start = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const end = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length;
        const filteredMonth = originalMonthArray.slice(start, end);
        setMonthArray(filteredMonth);
    }, [originalEstate, startMonth, endMonth]);

    useEffect(() => {
        const filteredEstate = originalEstate.filter(o => monthArray.includes(o.period));
        setEstate(filteredEstate);
    }, [monthArray]);

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
                        <div className='ps-2' style={{ fontSize: '13px' }}>※登録期間でソート</div>
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
                        </div>
                        <div style={{ overflowY: 'scroll' }}>
                            <div className="d-flex">
                                <div className="me-4">
                                    <Table bordered striped>
                                        <tbody style={{ fontSize: '12px' }}>
                                            <tr>
                                                <td>No</td>
                                                <td>課</td>
                                                <td>登録数</td>
                                            </tr>
                                            {targetSection
                                                .sort((a, b) => {
                                                    const targetStaffA = staff.filter(s => a === s.section).map(s => normalize(s.name));
                                                    const estateValueA = estate.filter(e => targetStaffA.includes(e.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    const targetStaffB = staff.filter(s => b === s.section).map(s => normalize(s.name));
                                                    const estateValueB = estate.filter(e => targetStaffB.includes(e.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    return estateValueB - estateValueA;
                                                })
                                                .map((section, sIndex) => {
                                                    const targetStaff = staff.filter(s => section === s.section).map(s => normalize(s.name));
                                                    const estateValue = estate.filter(e => targetStaff.includes(e.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    return <tr style={{
                                                        fontSize: sIndex === 0 ? '20px' : sIndex === 1 ? '16px' : '12px',
                                                        letterSpacing: sIndex <= 1 ? '1px' : '.5px'
                                                    }}>
                                                        <td>{sIndex + 1}</td>
                                                        <td>{section}</td>
                                                        <td style={{ textAlign: 'right' }}>{estateValue}</td>
                                                    </tr>
                                                }
                                                )}
                                        </tbody>
                                    </Table>
                                </div>
                                <div className="me-4">
                                    <Table bordered striped>
                                        <tbody style={{ fontSize: '12px' }}>
                                            <tr>
                                                <td>No</td>
                                                <td>課</td>
                                                <td>店舗</td>
                                                <td>登録数</td>
                                            </tr>
                                            {shop.filter(s => targetSection.includes(s.section))
                                                .sort((a, b) => {
                                                    const targetShopA = staff.filter(item => item.shop === a.shop).map(s => normalize(s.name));
                                                    const estateValueA = estate.filter(e => targetShopA.includes(e.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    const targetShopB = staff.filter(item => item.shop === b.shop).map(s => normalize(s.name));
                                                    const estateValueB = estate.filter(e => targetShopB.includes(e.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    return estateValueB - estateValueA;
                                                })
                                                .map((s, sIndex) => {
                                                    const targetShop = staff.filter(item => item.shop === s.shop).map(s => normalize(s.name));
                                                    const estateValue = estate.filter(e => targetShop.includes(e.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    const fontSize = 20 - sIndex * 1;
                                                    return <tr style={{
                                                        fontSize: sIndex <= 5 ? `${fontSize}px` : '12px',
                                                        letterSpacing: sIndex <= 5 ? '1px' : '.5px'
                                                    }}>
                                                        <td>{sIndex + 1}</td>
                                                        <td>{s.section}</td>
                                                        <td>{s.shop}</td>
                                                        <td>{estateValue}</td>
                                                    </tr>
                                                }
                                                )}
                                        </tbody>
                                    </Table>
                                </div>

                                <div className="me-4">
                                    <Table bordered striped>
                                        <tbody style={{ fontSize: '12px' }}>
                                            <tr>
                                                <td>No</td>
                                                <td>課</td>
                                                <td>店舗</td>
                                                <td>営業名</td>
                                                <td>登録数</td>
                                            </tr>
                                            {staff.filter(s => !s.name.includes('管理') && targetSection.includes(s.section) && s.report === 1)
                                                .sort((a, b) => {
                                                    const estateValueA = estate.filter(e => e.name.trim() === normalize(a.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    const estateValueB = estate.filter(e => e.name.trim() === normalize(b.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    return estateValueB - estateValueA;
                                                }).map((s, sIndex) => {
                                                    const estateValue = estate.filter(e => e.name.trim() === normalize(s.name)).reduce((acc, cur) => acc + cur.value, 0);
                                                    const fontSize = 20 - sIndex * .5;
                                                    return <tr style={{
                                                        fontSize: sIndex <= 10 ? `${fontSize}px` : '12px',
                                                        letterSpacing: sIndex <= 10 ? '1px' : '.5px'
                                                    }}>
                                                        <td>{sIndex + 1}</td>
                                                        <td>{s.section}</td>
                                                        <td>{s.shop}</td>
                                                        <td>{s.name}</td>
                                                        <td>{estateValue}</td>
                                                    </tr>
                                                }
                                                )}
                                        </tbody>
                                    </Table>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default RegisteredEstate