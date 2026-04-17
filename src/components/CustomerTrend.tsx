import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import './chartConfig';
import AuthContext from "../context/AuthContext";
import Table from "react-bootstrap/Table";
import { colorCodes } from "./ColorCodes";
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
type Shop = { brand: string; shop: string; section: string; area: string; }
type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number };
type customerList = { id: string, shop: string, string; status: string, medium: string, reserve: string, register: string, contract: string, response_status: string, section: string };
type GraphData = { month: string, [key: string]: number | string };

const CustomerTrend: React.FC = () => {
    const { brand } = useContext(AuthContext);
    const [userData, setUserData] = useState<customerList[]>([]);
    const [originalUserData, setOriginalUserData] = useState<customerList[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [graphCategory, setGraphCategory] = useState('register');
    const [graphData, setGraphData] = useState<GraphData[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetBrand, setTargetBrand] = useState('');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [sectionArray, setSectionArray] = useState<string[]>([]);
    const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [graphShow, setGraphShow] = useState(false);

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
        "#ff6384",  // Soft Red (Chart.js 系の見やすい色)
        "#ff9f40",
        "#4bc0c0"
    ];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = {
                    Authorization: "4081Kokubu",
                    "Content-Type": "application/json",
                };
                const [customerResponse, mediumResponse, shopResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                ]);
                await setOriginalUserData(customerResponse.data);
                await setMediumArray(mediumResponse.data.filter(item => item.list_medium === 1).map((item: MediumType) => item.medium));
                await setOriginalShopArray(shopResponse.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        setOriginalMonthArray(getYearMonthArray(2025, 1));
        fetchData();
        setEndMonth(`${String(year).padStart(2, '0')}/${String(month).padStart(2, '0')}`);
    }, []);

    useEffect(() => {
        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length
        const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
        setMonthArray(filteredMonthArray);

        const filteredShopArray = originalShopArray.filter(item => {
            const brand = item.shop.slice(0, 2);
            return (targetSection ? item.section === targetSection : true) &&
                (targetBrand ? brand === targetBrand.slice(0, 2) : true)
        });
        setShopArray(filteredShopArray);

        const uniqueSectionArray = [...new Set(originalShopArray.filter(o => o.section).map(o => o.section))];
        const filteredSectionArray = uniqueSectionArray.sort((a, b) => {
            const numA = parseInt(a?.match(/\d+/)?.[0] ?? "9999", 10);
            const numB = parseInt(b?.match(/\d+/)?.[0] ?? "9999", 10);
            return numA - numB
        });
        setSectionArray(filteredSectionArray);

        const filteredCustomer = originalUserData.filter(o =>
            (targetSection ? o.section === targetSection : true) &&
            (targetShop ? o.shop === targetShop : true) &&
            (targetBrand ? o.shop.slice(0, 2) === targetBrand : true)
        );
        setUserData(filteredCustomer);

        const filteredData = filteredMonthArray.map(monthValue => ({
            month: monthValue,
            ...Object.fromEntries(
                mediumArray.map(mediumValue => [mediumValue,
                    filteredCustomer.filter(u => u.medium === mediumValue && u[graphCategory].includes(monthValue)).length
                ])
            )
        }));
        setGraphData(filteredData);
    }, [originalUserData, graphCategory, targetSection, targetShop, targetBrand, startMonth, endMonth]);

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

    const formate = (medium: string) =>{
        return medium === '公式LINE' ? 'ALLGRIT' : medium;
    }

    const customerFilter = (data: customerList[], mediumIndex: number, medium: string, field: string, month: string) => {
        return data.filter(item =>
            (mediumIndex === 1
                ? item.response_status === 'ホームページ反響'
                : mediumIndex === 0
                    ? true
                    : item.medium === formate(medium)
            ) && item[field].replace(/-/g, '/')?.includes(month)
        ).length
    };

    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} /></div>
                <div className='content customer bg-white p-2'>
                    <div className="table-wrapper">
                        <div className="d-flex flex-wrap mb-1 search_condition align-items-center">
                            <div className="m-1">
                                <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                                    <option value="" selected>開始月</option>
                                    {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <span className='d-flex align-items-center mx-1'>～</span>
                            <div className="m-1">
                                <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                                    <option value="" selected>終了月</option>
                                    {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetShop('');
                                    setTargetBrand('');
                                    setTargetSection(e.target.value);
                                }}><option value="">課を選択</option>
                                    {sectionArray.map((item, index) =>
                                        <option value={item} selected={item === targetSection} key={index}>{item}</option>
                                    )}
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetShop('');
                                    setTargetSection('');
                                    setTargetBrand(e.target.value);
                                }}>
                                    <option value="">ブランドを選択</option>
                                    <option value="KH" selected={targetBrand.slice(0, 2) === 'KH'}>国分ハウジング</option>
                                    <option value="DJ" selected={targetBrand.slice(0, 2) === 'DJ'}>デイジャストハウス</option>
                                    <option value="なご" selected={targetBrand.slice(0, 2) === 'なご'}>なごみ工務店</option>
                                    <option value="2L" selected={targetBrand.slice(0, 2) === '2L'}>ニーエルホーム</option>
                                    <option value="PG" selected={targetBrand.slice(0, 2) === 'PG'}>PGハウス</option>
                                    <option value="JH" selected={targetBrand.slice(0, 2) === 'JH'}>ジャスフィーホーム</option>
                                </select>
                            </div>
                            <div className="m-1">
                                <select className="target" onChange={(e) => {
                                    setTargetBrand('');
                                    setTargetSection('');
                                    setTargetShop(e.target.value);
                                }}>
                                    <option value="">店舗を選択</option>
                                    {originalShopArray.filter(shop => !shop.shop?.includes('店舗未設定')).map(shop =>
                                        <option value={shop.shop} selected={shop.shop === targetShop}>{shop.shop}</option>
                                    )}
                                </select>
                            </div>
                            <div className="m-1">
                                <div className="bg-info text-white px-3 rounded py-1" style={{ fontSize: '12px', cursor: 'pointer' }}
                                    onClick={() => setGraphShow(!graphShow)}>{graphShow ? 'グラフを非表示にする' : 'グラフを表示する'}</div>
                            </div>
                        </div>
                        <div className="list_table">
                            <div className='ps-2 mb-3' style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                            {graphShow && <><div className="d-flex justify-content-center">
                                <div className="btn bg-primary text-white px-4 rounded-pill" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'register' ? 'scale(1.2)' : '', opacity: graphCategory === 'register' ? '1' : '.5' }}
                                    onClick={() => setGraphCategory('register')}>反響数推移</div>
                                <div className="btn bg-success text-white px-4 rounded-pill mx-5" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'reserve' ? 'scale(1.2)' : '', opacity: graphCategory === 'reserve' ? '1' : '.5' }}
                                    onClick={() => setGraphCategory('reserve')}>来場数推移</div>
                                <div className="btn bg-danger text-white px-4 rounded-pill" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'contract' ? 'scale(1.2)' : '', opacity: graphCategory === 'contract' ? '1' : '.5' }}
                                    onClick={() => setGraphCategory('contract')}>契約数推移</div>
                            </div>
                                {graphData.length > 0 && <div className="my-5">
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
                                </div>}</>}
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
                                                            : item.medium === formate(medium)
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
                                                                    {customerFilter(userData, mediumIndex, medium, row.field, month)}
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
