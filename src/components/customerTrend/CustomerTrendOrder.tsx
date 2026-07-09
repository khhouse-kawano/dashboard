import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import '../chartConfig';
import AuthContext from '../../context/AuthContext';
import Table from "react-bootstrap/Table";
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { isLastYear } from '../../utils/isLastYear';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { get11MonthsAgoString } from "../../utils/get11MonthsAgoString";
import Category from "../Category";

type Shop = { brand: string; shop: string; section: string; area: string; }
type MediumType = { medium: string, category: string, sort_key: number, response_medium: number };
type CustomerList = { id: string, shop: string, string; status: string, medium: string, interview: string, register: string, contract: string, hp_campaign: string, section: string, appointment: string, screening: string };
type GraphData = { month: string, [key: string]: number | string };
type CheckItem = {
    name: string;
    show: boolean;
};
type CheckedState = {
    [key: string]: CheckItem;
};
type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };

const CustomerTrendOrder: React.FC = () => {
    const { category } = useContext(AuthContext);
    const [userData, setUserData] = useState<CustomerList[]>([]);
    const [originalUserData, setOriginalUserData] = useState<CustomerList[]>([]);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [mediumList, setMediumList] = useState<MediumType[]>([]);
    const [graphCategory, setGraphCategory] = useState('register');
    const [graphData, setGraphData] = useState<GraphData[]>([]);
    const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
    const [startMonth, setStartMonth] = useState(startMonthValue);
    const [endMonth, setEndMonth] = useState('');
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetBrand, setTargetBrand] = useState('');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [sectionArray, setSectionArray] = useState<string[]>([]);
    const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [checked, setChecked] = useState<CheckedState>({
        graph: { name: 'グラフ', show: false },
        register: { name: '総反響数', show: true },
        interview: { name: '実来場数', show: true },
        appointment: { name: '次アポ数', show: true },
        contract: { name: '契約数', show: true },
        budget: { name: '広告費', show: false },
        comparison: { name: '昨年実績', show: false }
    });
    const thisYear = now.getMonth() <= 4 ? year : year + 1;
    const [budgetList, setBudget] = useState<Budget[]>([]);
    const [portalChecked, setPortalChecked] = useState(false);


    const formate = (medium: string) => {
        return medium === '公式LINE' ? 'ALLGRIT' : medium;
    };

    const dateFormate = (date: string) => {
        return date ? date.replace(/-/g, '/') : '';
    };

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
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'customerTrend', category }, { headers });
                console.log(response.data)
                setOriginalUserData(response.data.customer);
                const filteredMedium = response.data.medium.filter(item => item.list_medium === 1);
                setMediumList(filteredMedium);
                setOriginalShopArray(response.data.shop);
                setBudget(response.data.budget);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        setOriginalMonthArray(getYearMonthArray(2025, 1));
        fetchData();
    }, []);

    useEffect(() => {
        const filtered = mediumList.filter(m =>
            portalChecked ? m.category === 'ポータル' : true
        );
        setMediumArray(filtered.map(f => f.medium));
    }, [mediumList, portalChecked]);

    useEffect(() => {
        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length
        const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
        setMonthArray(filteredMonthArray);

        const uniqueSectionArray = [...new Set(originalShopArray.filter(o => o.section).map(o => o.section))];
        const filteredSectionArray = uniqueSectionArray.sort((a, b) => {
            const numA = parseInt(a?.match(/\d+/)?.[0] ?? "9999", 10);
            const numB = parseInt(b?.match(/\d+/)?.[0] ?? "9999", 10);
            return numA - numB
        });
        setSectionArray(filteredSectionArray);

        const sectionShops = originalShopArray.filter(o => o.section === targetSection).map(o => o.shop);

        const filteredCustomer = originalUserData.filter(o =>
            (targetSection ? sectionShops.includes(o.shop) : true) &&
            (targetShop ? o.shop === targetShop : true) &&
            (targetBrand ? o.shop.slice(0, 2) === targetBrand : true) &&
            (portalChecked ? !o.hp_campaign : true)
        );
        setUserData(filteredCustomer);

        // const total = getValue(filteredCustomer, 0, '', 'register');
        // const interview = getValue(filteredCustomer, 0, '', 'interview');
        // const contract = getValue(filteredCustomer, 0, '', 'contract');

        const filteredData = filteredMonthArray.map(monthValue => ({
            month: monthValue,
            ...Object.fromEntries(
                mediumArray.map(mediumValue => [mediumValue,
                    getValue(filteredCustomer, filteredMonthArray.indexOf(monthValue) + 1, monthValue, graphCategory).filter(item => formate(item.medium) === formate(mediumValue)).length
                ])
            )
        }));
        setGraphData(filteredData);
    }, [originalUserData, graphCategory, targetSection, targetShop, targetBrand, startMonth, endMonth, portalChecked]);

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

    const getValue = (base: CustomerList[], monthIndex: number, month: string, target: string, period: string[] = monthArray) => {
        if (target === 'appointment') {
            return base.filter(b => {
                if (b.interview) {
                    return monthIndex >= 1 ? dateFormate(b.interview).includes(month) && (b.appointment || b.screening || b.contract)
                        : period.includes(dateFormate(b.interview).slice(0, 7)) && (b.appointment || b.screening || b.contract);
                }
                return (monthIndex >= 1 ? (dateFormate(b.appointment).includes(month) || dateFormate(b.screening).includes(month) || dateFormate(b.contract).includes(month))
                    : (period.includes(dateFormate(b.appointment).slice(0, 7)) || period.includes(dateFormate(b.screening).slice(0, 7)) || period.includes(dateFormate(b.contract).slice(0, 7))))
            })
        }
        if (target === 'interview') {
            if (monthIndex >= 1) {
                const interviewBase = base.filter(b =>
                    dateFormate(b.interview).includes(month)
                );
                const appointmentBase = base.filter(b =>
                    !b.interview &&
                    (
                        dateFormate(b.appointment).includes(month) ||
                        dateFormate(b.screening).includes(month) ||
                        dateFormate(b.contract).includes(month)
                    )
                );
                return [...interviewBase, ...appointmentBase];
            } else {
                const interviewBase = base.filter(b =>
                    period.includes(dateFormate(b.interview).slice(0, 7))
                );
                const appointmentBase = base.filter(b =>
                    !b.interview &&
                    (
                        period.includes(dateFormate(b.appointment).slice(0, 7)) ||
                        period.includes(dateFormate(b.screening).slice(0, 7)) ||
                        period.includes(dateFormate(b.contract).slice(0, 7))
                    )
                );
                return [...interviewBase, ...appointmentBase];
            }
        }

        if (target === 'contract') {
            return base.filter(b => (monthIndex >= 1 ? dateFormate(b.contract).includes(month) && (b.status === '契約済み' || b.status === '解約') : period.includes(dateFormate(b.contract).slice(0, 7)) && (b.status === '契約済み' || b.status === '解約')))
        }
        return base.filter(b => (monthIndex >= 1 ? dateFormate(b[target]).includes(month) : period.includes(dateFormate(b[target]).slice(0, 7))))
    };

    const checkedChange = (e) => {
        const { name } = e.target;

        setChecked(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                show: !prev[name].show
            }
        }));
    };

    return (
        <>
            <div className='content bg-white p-2'>
                <div className="d-flex flex-wrap mb-1 search_condition">
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
                </div>
                <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                <div className="d-flex flex-wrap mb-1 search_condition">
                    {Object.entries(checked).map(([key, value], index) => {
                        if ((value.name === '広告費' || value.name === '昨年実績') && targetShop) return;
                        return <div className="m-1" key={index}>
                            <label className="target checkbox d-flex align-items-center">
                                <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.name}を表示
                            </label>
                        </div>
                    })}
                    <div className="m-1">
                        <label className="target checkbox d-flex align-items-center">
                            <input type="checkbox" checked={portalChecked} className='me-1' onChange={() =>
                                setPortalChecked(!portalChecked)
                            } />ポータル反響のみ表示
                        </label>
                    </div>
                </div>
                <div className="table-wrapper">
                    <div className="list_table">
                        <div className="mt-3">
                            {checked.graph.show && <><div className="d-flex justify-content-center">
                                <div className="btn bg-primary text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'register' ? 'scale(1.1)' : '', opacity: graphCategory === 'register' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('register')}>反響数推移</div>
                                <div className="btn bg-success text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'interview' ? 'scale(1.1)' : '', opacity: graphCategory === 'interview' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('interview')}>来場数推移</div>
                                <div className="btn bg-info text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'appointment' ? 'scale(1.1)' : '', opacity: graphCategory === 'appointment' ? '1' : '.3' }}
                                    onClick={() => setGraphCategory('appointment')}>次アポ数推移</div>
                                <div className="btn bg-danger text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'contract' ? 'scale(1.1)' : '', opacity: graphCategory === 'contract' ? '1' : '.3' }}
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
                        </div>
                        <div style={{ width: `${(monthArray.length + 1) * 190}px` }}>
                            <Table striped bordered>
                                <tbody style={{ fontSize: "12px" }}>
                                    <tr className="sticky-header">
                                        <td className="text-center sticky-column" style={{ width: '300px' }}>販促媒体名</td>
                                        {['全期間', ...monthArray].map((month, index) => (
                                            <td key={index} className="">
                                                {month}
                                            </td>
                                        ))}
                                    </tr>
                                    {['全販促媒体', 'ホームページ反響計', ...mediumArray]
                                        .map((medium, mediumIndex) => {
                                            const sectionShops = originalShopArray.filter(o => o.section === targetSection).map(o => o.shop);
                                            const base = userData.filter(o =>
                                                mediumIndex === 0 ? true :
                                                    mediumIndex === 1 ? o.hp_campaign : formate(o.medium) === formate(medium));
                                            const baseBudget = budgetList.filter(b =>
                                                b.section === 'order'
                                                && (mediumIndex === 0 ? true : formate(b.medium) === formate(medium))
                                                && (targetBrand ? b.shop.slice(0, 2) === targetBrand.slice(0, 2) : true)
                                                && (targetSection ? sectionShops.includes(b.shop) : true)
                                                && (targetShop ? b.shop === targetShop : true));
                                            const isBudget = checked.budget.show && mediumIndex !== 1;
                                            return (
                                                <>{(portalChecked ? mediumIndex !== 1 : true) && (<tr key={mediumIndex}>
                                                    <td className='align-middle sticky-column text-center'
                                                        rowSpan={isBudget ? 2 : 1}>
                                                        {medium}
                                                    </td>
                                                    {['全期間', ...monthArray].map((month, monthIndex) => {
                                                        const total = getValue(base, monthIndex, month, 'register');
                                                        const interview = getValue(base, monthIndex, month, 'interview');
                                                        const contract = getValue(base, monthIndex, month, 'contract');
                                                        const appointment = getValue(base, monthIndex, month, 'appointment');
                                                        const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                                        const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                                        let lastYearValue;
                                                        if (monthIndex === 0 || isLastYear(month)) {
                                                            lastYearValue = {
                                                                total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                                                interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                                                appointment: getValue(base, monthIndex, lastYear, 'appointment', lastYearMonthArray).length,
                                                                contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray),
                                                            };
                                                        }
                                                        const isDisplayLastYear =
                                                            checked.comparison.show &&
                                                            (monthIndex === 0 || isLastYear(month));
                                                        return (
                                                            <td style={{ fontSize: '11px', letterSpacing: '.5px' }}>
                                                                <div className={checked.register.show ? "text-white p-2 rounded" : 'text-white rounded'} style={{ backgroundColor: '#6baed6' }}>
                                                                    {checked.register.show && <div>総反響:<span className="fw-bold">{total.length.toLocaleString()}</span>
                                                                        {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.total.toLocaleString()}</span>}</div>}
                                                                    <div className={checked.interview.show ? "rounded p-2 my-2" : "my-2 rounded p-2"} style={{ backgroundColor: '#2171b5' }}>
                                                                        {checked.interview.show && <div>実来場:<span className="fw-bold">{interview.length.toLocaleString()}</span>({isNaN(interview.length / total.length) ? 0 : Math.floor(interview.length / total.length * 100)}%)
                                                                            {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.interview.toLocaleString()}</span>}</div>}
                                                                        <div className={checked.appointment.show ? "rounded p-2 my-2" : "my-2 rounded"} style={{ backgroundColor: '#08519c' }}>
                                                                            {checked.appointment.show && <div>次アポ:<span className="fw-bold">{appointment.length.toLocaleString()}</span>({isNaN(appointment.length / interview.length) ? 0 : Math.floor(appointment.length / interview.length * 100)}%)
                                                                                {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.appointment.toLocaleString()}</span>}</div>}
                                                                        </div>
                                                                        <div className={checked.contract.show ? "rounded p-2 my-2" : "my-2 rounded"} style={{ backgroundColor: '#08306b' }}>
                                                                            {checked.contract.show && <div>契約:<span className="fw-bold">{contract.length.toLocaleString()}</span>({isNaN(contract.length / interview.length) ? 0 : Math.floor(contract.length / interview.length * 100)}%)
                                                                                {isDisplayLastYear && <span className='bg-white text-primary rounded px-1 ms-1 fw-bold'>{lastYearValue.contract.length.toLocaleString()}</span>}</div>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                </tr>)}
                                                    {isBudget && <tr>
                                                        {['全期間', ...monthArray].map((month, monthIndex) => {
                                                            const filteredBudget = baseBudget.filter(b =>
                                                                monthIndex > 0 ? b.budget_period.includes(month) : monthArray.includes(b.budget_period.slice(0, 7)));
                                                            const formattedValue = filteredBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                                            const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                                            const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                                            const isDisplayLastYear = (isLastYear(month) || monthIndex === 0) && checked.comparison.show;
                                                            const lastYearBudget = baseBudget.filter(b =>
                                                                b.section === 'order'
                                                                && (monthIndex > 0 ? b.budget_period.includes(lastYear) : lastYearMonthArray.includes(b.budget_period.slice(0, 7)))
                                                            );
                                                            const formattedLastYearValue = lastYearBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                                            const total = getValue(base, monthIndex, month, 'register');
                                                            const interview = getValue(base, monthIndex, month, 'interview');
                                                            const contract = getValue(base, monthIndex, month, 'contract');
                                                            let lastYearValue = {
                                                                total: 0,
                                                                interview: 0,
                                                                contract: 0,
                                                            };

                                                            if (monthIndex === 0 || isLastYear(month)) {
                                                                lastYearValue = {
                                                                    total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                                                    interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                                                    contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).length,
                                                                };
                                                            }

                                                            return <td key={monthIndex} style={{ fontSize: '11px' }}>
                                                                {[{ label: '総額', color: '#c03442' }, { label: '反響単価', color: '#b02a37' }, { label: '来場単価', color: '#8a1e28' }, { label: '契約単価', color: '#64151c' }]
                                                                    .map((item, index) => {
                                                                        const deno = index === 1 ? total.length : index === 2 ? interview.length : index === 3 ? contract.length : 1;
                                                                        const prevDeno = index === 1 ? lastYearValue.total : index === 2 ? lastYearValue.interview : index === 3 ? lastYearValue.contract : 1;
                                                                        return <div className="text-white rounded pe-2 py-1 mb-1" style={{ backgroundColor: item.color, textAlign: 'right' }} key={index}>{item.label}:￥{Math.ceil(formattedValue / deno || 1).toLocaleString()}
                                                                            {isDisplayLastYear && <span className='bg-white text-danger rounded px-1 ms-1 fw-bold'>￥{Math.ceil(formattedLastYearValue / prevDeno || 1).toLocaleString()}</span>}</div>
                                                                    })}
                                                            </td>
                                                        })}
                                                    </tr>}
                                                </>
                                            );
                                        })}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CustomerTrendOrder;

