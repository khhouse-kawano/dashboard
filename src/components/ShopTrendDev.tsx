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


type Shop = { brand: string; shop: string; section: string; area: string; }
type Customer = {
    id: string; name: string; status: string; medium: string; rank: string; register: string; reserve: string; shop: string; estate: string; meeting: string;
    appointment: string; line_group: string; screening: string; rival: string; period: string; survey: string; budget: string; importance: string; note: string;
    staff: string; section: string; contract: string; sales_meeting: string; latest_date: string; last_meeting: string;[key: string]: any;
}

const ShopTrendDev = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);

    const getYearMonthArray = (startYear: number, startMonth: number) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const array = [];
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
                    axios.post("/dashboard/api/", { demand: "trend_customer" }, { headers }),
                    axios.post("/dashboard/api/", { demand: "shop_list" }, { headers })
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
        <div>
            <Menu brand={brand} />
            <div className="container bg-white py-2 mt-2">
                <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                <Tabs defaultActiveKey="home" id="justify-tab-example" className="mt-5 mb-3 bg-white" justify>
                    <Tab eventKey="home" title="総反響推移">
                        <Bar data={data} options={options} />
                    </Tab>
                    <Tab eventKey="profile" title="来場者推移">
                        <Bar data={dataReserve} options={optionsReserve} />
                    </Tab>
                    <Tab eventKey="longer-tab" title="契約者推移">
                        <Bar data={dataContract} options={optionsContract} />
                    </Tab>
                </Tabs>
                <Table striped className='mt-3'>
                    <thead style={{ fontSize: '13px' }}>
                        <tr>
                            <td>店舗名</td>
                            <td>全期間</td>
                            {monthArray.map(month => <td>{month}</td>)}
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '13px' }}>
                        <tr>
                            <td>グループ全体</td>
                            <td>
                                <span>総反響:{customerList.length}</span><br />
                                <span className="text-danger">来場数:{customerList.filter(item => item.reserve?.includes('20')).length}</span><br />
                                <span className="text-primary">契約数:{customerList.filter(item => item.contract?.includes('20')).length}</span><br />
                            </td>
                            {monthArray.map(month =>
                                <td>
                                    <span>総反響:{customerList.filter(item => item.register.includes(month)).length}</span><br />
                                    <span className="text-danger">来場数:{customerList.filter(item => item.reserve?.includes(month)).length}</span><br />
                                    <span className="text-primary">契約数:{customerList.filter(item => item.contract?.includes(month)).length}</span><br />
                                </td>)}
                        </tr>
                        {shopArray.filter(shop => !shop.shop.includes('店舗未設定') && !shop.shop.includes('FH')).map(shop =>
                            <tr>
                                <td>{shop.shop}</td>
                                <td>
                                    <span>総反響:{customerList.filter(item => item.shop === shop.shop).length}</span><br />
                                    <span className="text-danger">来場数:{customerList.filter(item => item.shop === shop.shop && item.reserve?.includes('20')).length}</span><br />
                                    <span className="text-primary">契約数:{customerList.filter(item => item.shop === shop.shop && item.contract?.includes('20')).length}</span><br />
                                </td>
                                {monthArray.map(month =>
                                    <td>
                                        <span>総反響:{customerList.filter(item => item.shop === shop.shop && item.register?.includes(month)).length}</span><br />
                                        <span className="text-danger">来場数:{customerList.filter(item => item.shop === shop.shop && item.reserve?.includes(month)).length}</span><br />
                                        <span className="text-primary">契約数:{customerList.filter(item => item.shop === shop.shop && item.contract?.includes(month)).length}</span><br />
                                    </td>)}
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </div>
    )
}

export default ShopTrendDev;