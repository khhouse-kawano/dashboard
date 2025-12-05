import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AuthContext from '../context/AuthContext';
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Bar } from 'react-chartjs-2';
import './chartConfig';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { colorCodes } from "./ColorCodes";
import { ChartOptions } from 'chart.js';
import MenuDev from "./MenuDev";


type Shop = { brand: string; shop: string; section: string; area: string; }
type Customer = { id: string; shop: string; name: string; staff: string; status: string; contract: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, appointment: string, second_reserve: string };

const ShopTrendDev = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);

    const getYearMonthArray = (startYear: number, startMonth: number) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const array: string[] = [];
        let year = startYear;
        let month = startMonth;
        while (year < currentYear || (year === currentYear && month <= currentMonth)) {
            array.push(`${year}/${String(month).padStart(2, '0')}`);
            month++;
            if (month > 12) { month = 1; year++; }
        }
        return array;
    };
    getYearMonthArray(2025, 1);
    const monthArray = getYearMonthArray(2025, 1);

    useEffect(() => {
        if (!brand || brand.trim() === "") {
            navigate("/");
            return;
        }
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerRes, shopRes] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "trend_customer" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers })
                ]);

                setCustomerList(customerRes.data);
                setShopArray(shopRes.data);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    }, [])


    const dataSets = shopArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return customerList.filter(item =>
                item.register.includes(month) && item.shop === value.shop
            ).length;
        });

        return {
            label: value.shop,
            data: dataArray,
            backgroundColor: colorCodes[index],
            stack: 'Stack 0',
        };
    });


    const dataSetsReserve = shopArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return customerList.filter(item =>
                item.reserve.includes(month) && item.shop === value.shop
            ).length;
        });

        return {
            label: value.shop,
            data: dataArray,
            backgroundColor: colorCodes[index],
            stack: 'Stack 0',
        };
    });



    const dataSetsContract = shopArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return customerList.filter(item =>
                item.contract.includes(month) && item.shop === value.shop
            ).length;
        });

        return {
            label: value.shop,
            data: dataArray,
            backgroundColor: colorCodes[index],
            stack: 'Stack 0',
        };
    });

    const data = {
        labels: monthArray, // X軸のラベル
        datasets: dataSets
    };

    const dataReserve = {
        labels: monthArray, // X軸のラベル
        datasets: dataSetsReserve
    };

    const dataContract = {
        labels: monthArray, // X軸のラベル
        datasets: dataSetsContract
    };


    const options: ChartOptions<'bar'> = {
        responsive: true,
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: '総反響推移',
            },
        },
    };

    const optionsReserve: ChartOptions<'bar'> = {
        responsive: true,
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: '来場者数推移',
            },
        },
    };

    const optionsContract: ChartOptions<'bar'> = {
        responsive: true,
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: '契約者数推移',
            },
        },
    };

    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} /></div>
                <div className='content bg-white p-2'>
                    <div className="table-wrapper">
                        <div className="list_table">
                            <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                            <Tabs defaultActiveKey="home" id="justify-tab-example" className="mt-5 mb-3 bg-white" justify
                                style={{ fontSize: '13px', width: '80vw' }}
                            >
                                <Tab eventKey="home" title="総反響推移">
                                    <div style={{ width: `${monthArray.length * 157}px`, marginLeft: '85px'}}><Bar data={data} options={options} /></div>
                                </Tab>
                                <Tab eventKey="profile" title="来場者推移">
                                    <div style={{ width: `${monthArray.length * 157}px`, marginLeft: '85px'}}><Bar data={dataReserve} options={optionsReserve} /></div>
                                </Tab>
                                <Tab eventKey="longer-tab" title="契約者推移">
                                    <div style={{ width: `${monthArray.length * 157}px`, marginLeft: '85px'}}><Bar data={dataContract} options={optionsContract} /></div>
                                </Tab>
                            </Tabs>
                            {/* <div className='mt-3' style={{ fontSize: '13px', fontWeight: '800' }}>※来場者数記載の()は来場キャンセル・未来場者数</div> */}
                            <div style={{ width: `${monthArray.length*180}px`}}>
                                <Table striped bordered>
                                    <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                        <tr className='sticky-header text-center'>
                                            <td className='sticky-column text-center'>店舗名</td>
                                            <td>全期間</td>
                                            {monthArray.map(month => <td>{month}</td>)}
                                        </tr>
                                        <tr>
                                            <td className='align-middle sticky-column text-center'>グループ全体</td>
                                            {(() => {
                                                const total = customerList.length;
                                                const interview = customerList.filter(item => item.reserve).length;
                                                const cancel = customerList.filter(item => !item.reserve && item.reserved_status).length;
                                                const reserve = interview + cancel;
                                                const appointment = customerList.filter(item => item.second_reserve).length;
                                                const contract = customerList.filter(item => item.contract).length;
                                                return (<td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                    <div className="text-white p-2 rounded" style={{ backgroundColor: '#6baed6' }}>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                        <div className="rounded p-1 my-1" style={{ backgroundColor: '#4292c6' }}>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                            <div className="rounded p-1 my-1" style={{ backgroundColor: '#2171b5' }}>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                <div className="p-1 text-white rounded my-1" style={{ backgroundColor: '#08519c' }}>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)</div>
                                                            </div>
                                                            <div className="p-1 text-dark rounded my-1" style={{ backgroundColor: '#9ecae1' }}>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)</div>
                                                        </div>
                                                    </div>
                                                    <div className="rounded py-1 px-2 my-1 text-white" style={{ backgroundColor: '#08306b' }}>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span></div>
                                                </td>)
                                            })()}
                                            {monthArray.map(month => {
                                                const total = customerList.filter(item => item.register.includes(month)).length;
                                                const reserve = customerList.filter(item => item.reserve?.includes(month)).length + customerList.filter(item => !item.reserve && item.reserved_status?.includes(month.replace(/\//g, '-'))).length;
                                                const interview = customerList.filter(item => item.reserve?.includes(month)).length;
                                                const cancel = customerList.filter(item => !item.reserve && item.reserved_status?.includes(month.replace(/\//g, '-'))).length;
                                                const appointment = customerList.filter(item => item.second_reserve && item.reserve?.includes(month)).length;
                                                const contract = customerList.filter(item => item.contract?.includes(month)).length;
                                                return (
                                                    <td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                        <div className="text-white p-2 rounded" style={{ backgroundColor: '#6baed6' }}>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                            <div className="rounded p-1 my-1" style={{ backgroundColor: '#4292c6' }}>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                                <div className="rounded p-1 my-1" style={{ backgroundColor: '#2171b5' }}>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                    <div className="p-1 text-white rounded my-1" style={{ backgroundColor: '#08519c' }}>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)</div>
                                                                </div>
                                                                <div className="p-1 text-dark rounded my-1" style={{ backgroundColor: '#9ecae1' }}>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)</div>
                                                            </div>
                                                        </div>
                                                        <div className="rounded py-1 px-2 my-1 text-white" style={{ backgroundColor: '#08306b' }}>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span></div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                        {shopArray.filter(shop => !shop.shop.includes('店舗未設定') && !shop.shop.includes('FH')).map(shop =>
                                            <tr>
                                                {(() => {
                                                    const total = customerList.filter(item => item.shop === shop.shop).length;
                                                    const cancel = customerList.filter(item => item.shop === shop.shop && !item.reserve && item.reserved_status).length;
                                                    const interview = customerList.filter(item => item.shop === shop.shop && item.reserve).length;
                                                    const reserve = interview + cancel;
                                                    const appointment = customerList.filter(item => item.shop === shop.shop && item.second_reserve).length;
                                                    const contract = customerList.filter(item => item.shop === shop.shop && item.contract).length;
                                                    return (<>
                                                        <td className='align-middle  sticky-column text-center'>{shop.shop}</td>
                                                        <td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                            <div className="text-white p-2 rounded" style={{ backgroundColor: '#6baed6' }}>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                                <div className="rounded p-1 my-1" style={{ backgroundColor: '#4292c6' }}>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                                    <div className="rounded p-1 my-1" style={{ backgroundColor: '#2171b5' }}>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                        <div className="p-1 text-white rounded my-1" style={{ backgroundColor: '#08519c' }}>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)</div>
                                                                    </div>
                                                                    <div className="p-1 text-dark rounded my-1" style={{ backgroundColor: '#9ecae1' }}>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)</div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded py-1 px-2 my-1 text-white" style={{ backgroundColor: '#08306b' }}>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span></div>
                                                        </td></>)
                                                })()}
                                                {monthArray.map(month => {
                                                    const total = customerList.filter(item => item.shop === shop.shop && item.register.includes(month)).length;
                                                    const interview = customerList.filter(item => item.shop === shop.shop && item.reserve?.includes(month)).length;
                                                    const cancel = customerList.filter(item => item.shop === shop.shop && !item.reserve && item.reserved_status?.includes(month.replace(/\//g, '-'))).length;
                                                    const reserve = cancel + interview;
                                                    const appointment = customerList.filter(item => item.shop === shop.shop && item.second_reserve && item.reserve?.includes(month)).length;
                                                    const contract = customerList.filter(item => item.shop === shop.shop && item.contract?.includes(month)).length;
                                                    return (
                                                        <td style={{ fontSize: '10px' }} className='pointerZoom'>
                                                            <div className="text-white p-2 rounded" style={{ backgroundColor: '#6baed6' }}>総反響:<span style={{ fontSize: '12px', fontWeight: '700' }}>{total.toLocaleString()}</span>
                                                                <div className="rounded p-1 my-1" style={{ backgroundColor: '#4292c6' }}>来場予約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{reserve}</span>({isNaN(reserve / total) ? 0 : Math.floor(reserve / total * 100)}%)
                                                                    <div className="rounded p-1 my-1" style={{ backgroundColor: '#2171b5' }}>実来場:<span style={{ fontSize: '12px', fontWeight: '700' }}>{interview.toLocaleString()}</span>({isNaN(interview / reserve) ? 0 : Math.floor(interview / reserve * 100)}%)
                                                                        <div className="p-1 text-white rounded my-1" style={{ backgroundColor: '#08519c' }}>次アポ:<span style={{ fontSize: '12px', fontWeight: '700' }}>{appointment.toLocaleString()}</span>({isNaN(appointment / interview) ? 0 : Math.floor(appointment / interview * 100)}%)</div>
                                                                    </div>
                                                                    <div className="p-1 text-dark rounded my-1" style={{ backgroundColor: '#9ecae1' }}>キャンセル:<span style={{ fontSize: '12px', fontWeight: '700' }}>{cancel.toLocaleString()}</span>({isNaN(cancel / reserve) ? 0 : Math.floor(cancel / reserve * 100)}%)</div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded py-1 px-2 my-1 text-white" style={{ backgroundColor: '#08306b' }}>契約:<span style={{ fontSize: '12px', fontWeight: '700' }}>{contract.toLocaleString()}</span></div>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ShopTrendDev;