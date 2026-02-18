import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import './chartConfig';
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import AuthContext from "../context/AuthContext";
import Table from "react-bootstrap/Table";
import { colorCodes } from "./ColorCodes";
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Scale } from "chart.js";

type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number };
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; contract: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; response_status: string };
type GraphData = { month: string, [key: string]: number | string };

const CustomerTrend: React.FC = () => {
    const { brand } = useContext(AuthContext);
    const [userData, setUserData] = useState<customerList[]>([]);
    const navigate = useNavigate();
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
    const [graphCategory, setGraphCategory] = useState('register');
    const [graphData, setGraphData] = useState<GraphData[]>([]);

    const monthArray: string[] = getYearMonthArray(2025, 1);

    const chartColors = [
        "#0d6efd", // Blue
        "#198754", // Green
        "#dc3545", // Red
        "#fd7e14", // Orange
        "#ffc107", // Yellow
        "#20c997", // Teal
        "#0dcaf0", // Cyan
        "#6f42c1", // Purple
        "#6610f2", // Indigo
        "#d63384", // Pink
        "#6c757d", // Gray
        "#343a40", // Dark Gray
        "#adb5bd", // Light Gray
        "#17a2b8", // Info Blue
        "#28a745", // Success Green
        "#ff6384"  // Soft Red (Chart.js 系の見やすい色)
    ];


    useEffect(() => {
        if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");

        const fetchData = async () => {
            try {
                const headers = {
                    Authorization: "4081Kokubu",
                    "Content-Type": "application/json",
                };
                const [customerResponse, mediumResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                ]);
                await setUserData(customerResponse.data);
                await setMediumArray(mediumResponse.data.filter(item => item.list_medium === 1).map((item: MediumType) => item.medium));

            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const filteredData = monthArray.map(monthValue => ({
            month: monthValue,
            ...Object.fromEntries(
                mediumArray.map(mediumValue => [mediumValue,
                    userData.filter(u => u.medium === mediumValue && u[graphCategory].includes(monthValue)).length
                ])
            )
        }));
        setGraphData(filteredData);
    }, [userData, graphCategory]);

    const dataSets = mediumArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return userData.filter(item =>
                item.register.includes(month) && item.medium === value
            ).length;
        });

        return {
            label: value,
            data: dataArray,
            backgroundColor: colorCodes[index % colorCodes.length],
            stack: "Stack 0",
        };
    });

    const dataSetsReserve = mediumArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return userData.filter(item =>
                item.reserve.includes(month) && item.medium === value
            ).length;
        });

        return {
            label: value,
            data: dataArray,
            backgroundColor: colorCodes[index % colorCodes.length],
            stack: "Stack 0",
        };
    });

    const dataSetsContract = mediumArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return userData.filter(item =>
                item.contract.includes(month) && item.medium === value
            ).length;
        });

        return {
            label: value,
            data: dataArray,
            backgroundColor: colorCodes[index % colorCodes.length],
            stack: "Stack 0",
        };
    });

    const data = {
        labels: monthArray,
        datasets: dataSets,
    };

    const dataReserve = {
        labels: monthArray,
        datasets: dataSetsReserve,
    };

    const dataContract = {
        labels: monthArray,
        datasets: dataSetsContract,
    };

    const options = {
        responsive: true,
        scales: {
            x: {
                stacked: true as const,
            },
            y: {
                stacked: true as const,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "総反響推移",
            },
        },
    };

    const optionsReserve = {
        responsive: true,
        scales: {
            x: {
                stacked: true as const,
            },
            y: {
                stacked: true as const,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "来場者数推移",
            },
        },
    };

    const CustomLegend = ({ payload }: { payload?: any[] }) => {
        if (!payload) return null;
        return (
            <div style={{ fontSize: "12px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {payload.map((entry, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center" }}>
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                backgroundColor: entry.color,
                                marginRight: 6,
                                borderRadius: 2
                            }}
                        />
                        <span>{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;

        return (
            <div
                style={{
                    background: "white",
                    border: "1px solid #ccc",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",        // ← フォントサイズ変更
                    lineHeight: "1.4",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                }}
            >
                <div style={{ marginBottom: 4, fontWeight: "bold" }}>{label}</div>

                {payload.map((entry: any, index: number) => (
                    <div key={index} style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                    </div>
                ))}
            </div>
        );
    };


    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} /></div>
                <div className='content customer bg-white p-2'>
                    <div className="table-wrapper">
                        <div className="list_table">
                            <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                            {/* <Tabs
                                defaultActiveKey="home"
                                id="justify-tab-example"
                                className="mt-5 mb-3 bg-white"
                                style={{ fontSize: '13px', width: '80vw' }}
                                justify
                            >
                                <Tab eventKey="home" title="総反響推移">
                                    <Bar data={data} options={options} />
                                </Tab>
                                <Tab eventKey="profile" title="来場者推移">
                                    <Bar data={dataReserve} options={optionsReserve} />
                                </Tab>
                                <Tab eventKey="longer-tab" title="契約者推移">
                                    <Bar data={dataContract} options={optionsReserve} />
                                </Tab>
                            </Tabs> */}
                            <div className="d-flex justify-content-center">
                                <div className="btn bg-primary text-white px-4 rounded-pill" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'register' ? 'scale(1.2)' : '' }}
                                    onClick={() => setGraphCategory('register')}>反響数推移</div>
                                <div className="btn bg-success text-white px-4 rounded-pill mx-5" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'reserve' ? 'scale(1.2)' : '' }}
                                    onClick={() => setGraphCategory('reserve')}>来場数推移</div>
                                <div className="btn bg-danger text-white px-4 rounded-pill" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'contract' ? 'scale(1.2)' : '' }}
                                    onClick={() => setGraphCategory('contract')}>契約数推移</div>
                            </div>
                            {graphData.length > 0 ?<div className="my-5">
                                <ResponsiveContainer width="100%" height={500}>
                                    <BarChart data={graphData}>
                                        <XAxis dataKey="month" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip content={CustomTooltip} />
                                        <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                                        <Legend content={<CustomLegend />} />
                                        {mediumArray.map((medium, index) =>
                                            <Bar dataKey={medium} stackId="a" fill={chartColors[index]} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div> : 'a'}
                            <Table striped bordered>
                                <thead style={{ fontSize: "12px" }}>
                                    <tr className="sticky-header">
                                        <td colSpan={2} className="text-center">販促媒体名</td>
                                        {['全期間', ...monthArray].map((month, index) => (
                                            <td key={index}>
                                                {month}
                                            </td>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: "12px" }}>
                                    {['全販促媒体', 'ホームページ反響計', ...mediumArray]
                                        .map((medium, mediumIndex) => {
                                            const countBy = (field) =>
                                                userData.filter(item =>
                                                    (mediumIndex === 1
                                                        ? item.response_status === 'ホームページ反響'
                                                        : mediumIndex === 0
                                                            ? true
                                                            : item.medium === medium
                                                    ) && monthArray.includes(item[field].slice(0, 7))
                                                ).length;
                                            const rows = [
                                                { label: '総反響', field: 'register', class: 'text-primary' },
                                                { label: '来場数', field: 'reserve', class: 'text-success' },
                                                { label: '契約数', field: 'contract', class: 'text-danger' }
                                            ];
                                            return (
                                                <React.Fragment key={medium}>
                                                    {rows.map((row, rowIndex) => (
                                                        <tr key={rowIndex}>
                                                            {rowIndex === 0 && (
                                                                <td rowSpan={3} className="align-middle text-center">{medium}</td>
                                                            )}
                                                            <td className={row.class}>{row.label}</td>
                                                            <td className={row.class} style={{ textAlign: 'right' }}>{countBy(row.field)}</td>
                                                            {monthArray.map((month, index) => (
                                                                <td key={index} className={row.class} style={{ textAlign: 'right' }}>
                                                                    {userData.filter(item =>
                                                                        (mediumIndex === 1
                                                                            ? item.response_status === 'ホームページ反響'
                                                                            : mediumIndex === 0
                                                                                ? true
                                                                                : item.medium === medium
                                                                        ) && item[row.field]?.includes(month)
                                                                    ).length}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}

                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerTrend;
