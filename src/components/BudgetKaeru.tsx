import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import Table from 'react-bootstrap/esm/Table';
import MenuDev from "./MenuDev";
import { Pie } from 'react-chartjs-2';
import './chartConfig.js';
import { colorCodes } from './ColorCodes.js';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { ChartOptions } from 'chart.js';
import AuthContext from "../context/AuthContext.js";
import { useNavigate } from "react-router-dom";

type PieDataType = {
    labels: string[];
    datasets: {
        data: number[];
        backgroundColor: string[];
        borderColor: string[];
        borderWidth: number;
    }[];
};

type Customer = { id_related: string, name: string, staff: string; status: string; action: string; registered: string; medium: string; case: string; reserved: string; contract: string; };
type Budget = { budget_period: string; budget_value: number; medium: string; shop: string }
const Dev = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [originalCustomers, setOriginalCustomers] = useState<Customer[]>([]);
    const [originalBudget, setOriginalBudget] = useState<Budget[]>([]);
    const [budget, setBudget] = useState<Budget[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [show, setShow] = useState(false);
    const [mediumArray, setMediumArray] = useState<string[]>([]);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [expandShop, setExpandShop] = useState<{ [key: number]: boolean }>({});
    const [areaArray, setAreaArray] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<string>('registered');
    const [sortOrder, setSortOrder] = useState<string>('desc');
    const [dataRegisterPie, setDataRegisterPie] = useState<PieDataType>({
        labels: [],
        datasets: [
            {
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 1,
            },
        ],
    });
    const [dataReservePie, setDataReservePie] = useState<PieDataType>({
        labels: [],
        datasets: [
            {
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 1,
            },
        ],
    });
    const [dataContractPie, setDataContractPie] = useState<PieDataType>({
        labels: [],
        datasets: [
            {
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 1,
            },
        ],
    });
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const staffMapping = [{ name: '桑田 哲朗', area: '' },
    { name: '愛甲 博之', area: '鹿児島店' },
    { name: '濵田 春菜', area: '業務担当' },
    { name: '福﨑 研志', area: '' },
    { name: '野口 将希', area: '熊本店' },
    { name: '永田 千恵', area: '業務担当' },
    { name: '小園 裕樹', area: '鹿児島店' },
    { name: '柿内 智徳', area: '鹿児島店' },
    { name: '的場 雄大', area: '鹿児島店' },
    { name: '松窪 麻世', area: '' },
    { name: '義富 麻美', area: '' },
    { name: '西村 陽奈', area: '' },
    { name: '吉田 優貴', area: '鹿児島店' },
    { name: '馬場﨑 香里', area: '業務担当' },
    { name: '亀高 秀行', area: '鹿児島店' },
    { name: '鎌田 将暉', area: '' },
    { name: '川口 創楽', area: '宮崎店' },
    { name: '緒方 啓太', area: '' },
    { name: '上山 力', area: '鹿児島店' },
    { name: '東中川 洸', area: '鹿児島店' },
    { name: '増田 美智', area: '' },
    { name: '岡元 弘樹', area: '宮崎店' },
    { name: '永田 倫也', area: '' },
    { name: '難波 亨成', area: '宮崎店' },
    { name: '坂下 裕樹', area: '' },
    { name: '石川 健太', area: '鹿児島店' },
    { name: '池山 和希', area: '鹿児島店' },
    { name: '山之口 美沙輝', area: '宮崎店' },
    { name: '岡崎 真夕', area: '' },
    { name: '森 賀都征', area: '宮崎店' },
    { name: '上村 康一郎', area: '' },
    { name: '時任 聡一朗', area: '' },
    { name: '大澤 雄一郎', area: '宮崎店' },
    { name: '古田 昌之', area: '大分店' },
    { name: '井立 了仁', area: '' },
    { name: '高村 和宏', area: '熊本店' },
    { name: '宇都宮 尊', area: '宮崎店' },
    { name: '丸尾 歩実', area: '' },
    { name: '武田 秀士', area: '大分店' }];

    const mediumMapping = [
        { key: "かえる-会員登録", value: "SNS広告・インターネット検索" },
        { key: "かえるHP(会員登録）", value: "SNS広告・インターネット検索" },
        { key: "かえる-来場予約", value: "SNS広告・インターネット検索" },
        { key: "SUUMO", value: "SUUMO" },
        { key: "HOME'S", value: "HOME'S" },
        { key: "かえる-資料請求", value: "SNS広告・インターネット検索" },
        { key: "ALLGRIT-アンケート", value: "公式LINE" },
        { key: "かえるHP(先取り物件)", value: "SNS広告・インターネット検索" },
        { key: "かえる-先取り物件", value: "SNS広告・インターネット検索" },
        { key: "アットホーム", value: "athome" },
        { key: "カゴスマ(一括資料請求)", value: "カゴスマ" },
        { key: "タウンライフ(一括資料請求)", value: "タウンライフ" },
        { key: "不動産HP(会員登録）", value: "SNS広告・インターネット検索" },
        { key: "不動産HP(資料請求)", value: "SNS広告・インターネット検索" },
        { key: "カエール査定(一戸建て)", value: "SNS広告・インターネット検索" },
        { key: "SUUMO見学予約", value: "SUUMO" },
        { key: "かえる-物件の資料請求", value: "SNS広告・インターネット検索" },
        { key: "カエール査定(土地)", value: "SNS広告・インターネット検索" },
        { key: "かえるHP(来場予約)", value: "SNS広告・インターネット検索" },
        { key: "かえるHP(資料請求)", value: "SNS広告・インターネット検索" },
        { key: "不動産HP(希望条件マッチング）", value: "SNS広告・インターネット検索" },
        { key: "カエール査定(マンション)", value: "SNS広告・インターネット検索" },
        { key: "不動産HP(お問い合わせ)", value: "SNS広告・インターネット検索" },
        { key: "不動産HP(来場予約)", value: "SNS広告・インターネット検索" },
        { key: "かえるHP(会員退会）", value: "SNS広告・インターネット検索" },
        { key: "不動産HP(お気軽相談)", value: "SNS広告・インターネット検索" },
        { key: "不明", value: "" },
    ];

    const areas = ['鹿児島店', '宮崎店', '大分店', '熊本店'];

    const tables = ['table-primary', 'table-danger', 'table-success', 'table-secondary'];

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
        setAreaArray(areas);
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerResponse, budgetResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "kaeru_report" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_budget_kaeru" }, { headers })
                ]);
                setOriginalCustomers(customerResponse.data);
                console.log(customerResponse.data)
                setOriginalBudget(budgetResponse.data);
                console.log(budgetResponse.data)

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

        let mediumValue = mediumMapping.filter(item => item.value === targetMedium).map(item => item.key);
        const filtered = originalCustomers.filter(item => {
            const registeredDate = new Date(item.registered);
            return (
                (startDate ? registeredDate >= startDate : true) &&
                (endDate ? registeredDate <= endDate : true) &&
                (targetMedium ? mediumValue.includes(item.medium) : true)
            );
        });

        console.log(filtered)
        setCustomers(filtered);

        const filteredBudget = originalBudget.filter(item => {
            const registeredDate = new Date(item.budget_period);
            return (
                (startDate ? registeredDate >= startDate : true) &&
                (endDate ? registeredDate <= endDate : true) &&
                (targetMedium ? targetMedium.includes(item.medium) : true)
            )
        });
        setBudget(filteredBudget);

        const mediums = new Set([...mediumMapping.map(item => item.value)]);
        setMediumArray([...mediums]);

        const registerLengthArray = mediumMapping.map(medium => {
            return filtered.filter(item => item.medium === medium.key).length
        });

        const reserveLengthArray = mediumMapping.map(medium => {
            return filtered.filter(item => item.medium === medium.key && (item.status.includes('来店') || item.status.includes('契約'))).length
        });

        console.log(registerLengthArray)

        const contractLengthArray = mediumMapping.map(medium => {
            return filtered.filter(item => item.medium === medium.key && item.status.includes('来店')).length
        });

        setDataRegisterPie(prev => ({
            ...prev,
            labels: mediumMapping.map(item => item.key),
            datasets: [
                {
                    ...prev.datasets[0],
                    data: registerLengthArray,
                    backgroundColor: mediumMapping.map((_, index) => colorCodes[index]),
                    borderColor: mediumMapping.map((_, index) => colorCodes[index])
                },
            ],
        }));

        setDataReservePie(prev => ({
            ...prev,
            labels: mediumMapping.map(item => item.key),
            datasets: [
                {
                    ...prev.datasets[0],
                    data: reserveLengthArray,
                    backgroundColor: mediumMapping.map((_, index) => colorCodes[index]),
                    borderColor: mediumMapping.map((_, index) => colorCodes[index])
                },
            ],
        }));

        setDataContractPie(prev => ({
            ...prev,
            labels: mediumMapping.map(item => item.key),
            datasets: [
                {
                    ...prev.datasets[0],
                    data: contractLengthArray,
                    backgroundColor: mediumMapping.map((_, index) => colorCodes[index]),
                    borderColor: mediumMapping.map((_, index) => colorCodes[index])
                },
            ],
        }));
    }, [originalCustomers, startMonth, endMonth, targetMedium]);

    const expand = (area: string) => {
        const index = areas.indexOf(area);
        setExpandShop(prev => ({
            ...prev,
            [index]: !prev[index]
        }));

        const newArea = areas[index];
        const newStaffs = staffMapping.filter(item => item.area === newArea).map(item => item.name);
        if (newStaffs.every(item => areaArray.includes(item))) {
            const newArray = areaArray.filter(item => !newStaffs.includes(item));
            setAreaArray(newArray);
        } else {
            setAreaArray(prev => {
                const newArray = [...prev];
                const start = newArray.indexOf(area);
                newArray.splice(start + 1, 0, ...newStaffs);
                return newArray;
            });
        }
    };

    // 円グラフの設定
    const options: ChartOptions<'pie'> = {
        plugins: {
            legend: {
                position: 'right',
            },
            title: {
                display: true,
                text: '媒体別人数'
            }
        },
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
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
                    <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                    <div className="d-flex flex-wrap mb-3">
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
                            <select className="target" onChange={(e) => setTargetMedium(e.target.value)}>
                                <option value="" selected>販促媒体を選択</option>
                                {mediumArray.filter(item => item !== '').map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            {show === true ? <input type="button" className='target bg-danger text-white' value='グラフを非表示' onClick={() => setShow(false)} /> :
                                <input type="button" className='target bg-primary text-white' value='グラフを表示' onClick={() => setShow(true)} />}
                        </div>
                    </div>
                    {isLoading ? (<p className="ms-3"><i className="fa-solid fa-spinner me-2 spinning"></i>Now Loading</p>) :
                        <div className="table-wrapper mt-3">
                            <div className="list_table kaeru">
                                <div className={`mt-3 graph_pc kaeru ${show === true ? 'show' : ''}`}>
                                    <Tabs defaultActiveKey="home" id="justify-tab-example" className="mb-3 bg-white" justify style={{ fontSize: '12px', letterSpacing: '1px', width: '80vw' }}>
                                        <Tab eventKey="home" title="総反響詳細">
                                            <Pie data={dataRegisterPie} options={options} className='pie kaeru' />
                                        </Tab>
                                        <Tab eventKey="profile" title="来場者詳細">
                                            <Pie data={dataReservePie} options={options} className='pie kaeru' />
                                        </Tab>
                                        <Tab eventKey="longer-tab" title="契約者詳細">
                                            <Pie data={dataContractPie} options={options} className='pie kaeru' />
                                        </Tab>
                                    </Tabs>
                                </div>
                                <div className="mb-3">
                                    <Table bordered style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '20%' }}>チーム</td>
                                                <td>総反響</td>
                                                <td>来場数</td>
                                                <td>来場率</td>
                                                <td>契約数</td>
                                                <td>契約率</td>
                                                <td>総予算</td>
                                                <td>反響単価</td>
                                                <td>来場単価</td>
                                                <td>契約単価</td>
                                            </tr>
                                            <tr>
                                                <td>かえるホーム合計</td>
                                                <td>{customers.length}</td>
                                                <td>{customers.filter(item => item.reserved != '').length ?? false}</td>
                                                <td>{Math.round(customers.filter(item => item.reserved != '').length / customers.length * 100)}%</td>
                                                <td>{customers.filter(item => item.contract !== '').length ?? false}</td>
                                                <td>{Math.round(customers.filter(item => item.contract !== '').length / customers.filter(item => item.reserved !== '').length * 100)}%</td>
                                                <td>¥{budget.reduce((acc, cur) => acc + cur.budget_value, 0).toLocaleString()}</td>
                                                <td>¥{Math.round(budget.reduce((acc, cur) => acc + cur.budget_value, 0) / customers.length).toLocaleString()}</td>
                                                <td>
                                                    {(() => {
                                                        const filtered = customers.filter(c => ((c.status?.includes("来店") || c.status?.includes("契約")) ?? false));
                                                        return `¥${Math.round(budget.reduce((acc, cur) => acc + cur.budget_value, 0) / filtered.length).toLocaleString()}`;
                                                    })()}
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const filtered = customers.filter(c => ((c.status?.includes("契約")) ?? false));
                                                        return `¥${Math.round(budget.reduce((acc, cur) => acc + cur.budget_value, 0) / filtered.length).toLocaleString()}`;
                                                    })()}
                                                </td>
                                            </tr>
                                            {areaArray.filter(area => area !== '').map((area, index) => {
                                                const staffArray = staffMapping.filter(staff => staff.area === area).map(staff => staff.name);

                                                let customersInArea;
                                                if (areas.includes(area)) {
                                                    customersInArea = customers.filter(c => staffArray.includes(c.staff));
                                                } else {
                                                    customersInArea = customers.filter(c => c.staff === area);
                                                }

                                                const customersVisitOrContract = customersInArea.filter(
                                                    c => c.reserved.includes('-')
                                                );
                                                const customersContract = customersInArea.filter(
                                                    c => c.contract.includes('-')
                                                );

                                                const totalBudget = budget
                                                    .filter(b => b.shop.includes(area))
                                                    .reduce((acc, cur) => acc + cur.budget_value, 0);

                                                const avg = (arr) =>
                                                    arr.length > 0
                                                        ? `¥${Math.round(totalBudget / arr.length).toLocaleString()}`
                                                        : "¥0";

                                                let tableClass;
                                                if (areas.includes(area)) {
                                                    tableClass = tables[areas.indexOf(area)];
                                                }
                                                return (
                                                    <tr key={index} onClick={() => expand(area)} className={tableClass} style={{ cursor: 'pointer' }}>
                                                        <td><div className={`${areas.includes(area) ? 'kaeru_icon' : ''} ${expandShop[areas.indexOf(area)] ? ' minus' : ''}`}>{area}</div></td>
                                                        <td>{customersInArea.length}</td>
                                                        <td>{customersVisitOrContract.length}</td>
                                                        <td>{isNaN(Math.round(customersVisitOrContract.length / customersInArea.length * 100)) ? '0' : Math.round(customersVisitOrContract.length / customersInArea.length * 100)}%</td>
                                                        <td>{customersContract.length}</td>
                                                        <td>{isNaN(Math.round(customersContract.length / customersVisitOrContract.length * 100)) ? '0' : Math.round(customersContract.length / customersVisitOrContract.length * 100)}%</td>
                                                        <td>{totalBudget.toLocaleString() !== '0' ? `¥${totalBudget.toLocaleString()}` : '-'}</td>
                                                        <td>{avg(customersInArea) !== "¥0" ? avg(customersInArea) : '-'}</td>
                                                        <td>{avg(customersVisitOrContract) !== "¥0" ? avg(customersVisitOrContract) : '-'}</td>
                                                        <td>{avg(customersContract) !== "¥0" ? avg(customersContract) : '-'}</td>
                                                    </tr>
                                                );
                                            })}

                                        </tbody>
                                    </Table>
                                </div>
                                <div className="">
                                    <Table striped bordered style={{ fontSize: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '20%' }}>反響経路</td>
                                                <td style={{ position: 'relative' }}>総反響
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'registered')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'registered')}>▼</span>
                                                </td>
                                                <td style={{ position: 'relative' }}>来場数
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'reserve')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'reserve')}>▼</span>
                                                </td>
                                                <td style={{ position: 'relative' }}>来場率
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'reserveAverage')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'reserveAverage')}>▼</span>
                                                </td>
                                                <td style={{ position: 'relative' }}>契約数
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'contract')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'contract')}>▼</span>
                                                </td>
                                                <td style={{ position: 'relative' }}>契約率
                                                    <span style={{ position: 'absolute', top: '4px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'contractAverage')}>▲</span>
                                                    <span style={{ position: 'absolute', top: '14px', left: '55px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'contractAverage')}>▼</span>
                                                </td>
                                                <td>総予算</td>
                                                <td>反響単価</td>
                                                <td>来場単価</td>
                                                <td>契約単価</td>
                                            </tr>
                                            {mediumMapping.sort((a, b) => {
                                                let countA = 0;
                                                let countB = 0;

                                                if (sortKey === 'registered') {
                                                    countA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '').length
                                                        : customers.filter(v => v.medium === a.key).length;

                                                    countB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '').length
                                                        : customers.filter(v => v.medium === b.key).length;

                                                } else if (sortKey === 'reserve') {
                                                    countA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.reserved !== '').length
                                                        : customers.filter(v => v.medium === a.key && v.reserved !== '').length;

                                                    countB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.reserved !== '').length
                                                        : customers.filter(v => v.medium === b.key && v.reserved !== '').length;

                                                } else if (sortKey === 'contract') {
                                                    countA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.contract !== '').length
                                                        : customers.filter(v => v.medium === a.key && v.contract !== '').length;

                                                    countB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.contract !== '').length
                                                        : customers.filter(v => v.medium === b.key && v.contract !== '').length;

                                                } else if (sortKey === 'reserveAverage') {
                                                    const totalA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '').length
                                                        : customers.filter(v => v.medium === a.key).length;

                                                    const reservedA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.reserved !== '').length
                                                        : customers.filter(v => v.medium === a.key && v.reserved !== '').length;

                                                    countA = totalA > 0 ? reservedA / totalA : 0;

                                                    const totalB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '').length
                                                        : customers.filter(v => v.medium === b.key).length;

                                                    const reservedB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.reserved !== '').length
                                                        : customers.filter(v => v.medium === b.key && v.reserved !== '').length;

                                                    countB = totalB > 0 ? reservedB / totalB : 0;

                                                } else if (sortKey === 'contractAverage') {
                                                    const reservedA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.reserved !== '').length
                                                        : customers.filter(v => v.medium === a.key && v.reserved !== '').length;

                                                    const contractA = a.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.contract !== '').length
                                                        : customers.filter(v => v.medium === a.key && v.contract !== '').length;

                                                    countA = reservedA > 0 ? contractA / reservedA : 0;

                                                    const reservedB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.reserved !== '').length
                                                        : customers.filter(v => v.medium === b.key && v.reserved !== '').length;

                                                    const contractB = b.key === '不明'
                                                        ? customers.filter(v => v.medium === '' && v.contract !== '').length
                                                        : customers.filter(v => v.medium === b.key && v.contract !== '').length;

                                                    countB = reservedB > 0 ? contractB / reservedB : 0;
                                                }

                                                return sortOrder === 'desc' ? countB - countA : countA - countB;

                                            }).map(item => {
                                                const filteredRegister = item.key === '不明' ? customers.filter(value => value.medium === '') : customers.filter(value => value.medium === item.key);
                                                const filteredReserve = item.key === '不明' ? customers.filter(value => value.medium === '' && value.reserved !== '') : customers.filter(value => value.medium === item.key && value.reserved !== '');
                                                const filteredContract = item.key === '不明' ? customers.filter(value => value.medium === '' && value.contract !== '') : customers.filter(value => value.medium === item.key && value.contract !== '');
                                                const unit = budget.filter(b => item.value.includes(b.medium)).reduce((acc, cur) => acc + cur.budget_value, 0) / customers.filter(c => {
                                                    let mediumValue = mediumMapping.filter(m => m.value === item.value).map(m => m.key);
                                                    return (
                                                        mediumValue.includes(c.medium)
                                                    )
                                                }).length;
                                                const total = unit * filteredRegister.length;
                                                return (
                                                    <tr className={filteredRegister.length === 0 ? 'd-none' : ''}>
                                                        <td>{item.key}</td>
                                                        <td>{filteredRegister.length}</td>
                                                        <td>{filteredReserve.length}</td>
                                                        <td>{isNaN(filteredReserve.length / filteredRegister.length) ? 0 : Math.round(filteredReserve.length / filteredRegister.length * 100)}%</td>
                                                        <td>{filteredContract.length}</td>
                                                        <td>{isNaN(filteredContract.length / filteredReserve.length) ? 0 : Math.round(filteredContract.length / filteredReserve.length * 100)}%</td>
                                                        <td>¥{isNaN(Math.round(total)) ? 0 : Math.round(total).toLocaleString()}</td>
                                                        <td>¥{isNaN(Math.round(total / filteredRegister.length)) || !isFinite(Math.round(total / filteredRegister.length)) ? 0 : Math.round(total / filteredRegister.length).toLocaleString()}</td>
                                                        <td>¥{isNaN(Math.round(total / filteredReserve.length)) || !isFinite(Math.round(total / filteredReserve.length)) ? 0 : Math.round(total / filteredReserve.length).toLocaleString()}</td>
                                                        <td>¥{isNaN(Math.round(total / filteredContract.length)) || !isFinite(Math.round(total / filteredContract.length)) ? 0 : Math.round(total / filteredContract.length).toLocaleString()}</td>
                                                    </tr>
                                                )
                                            }
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        </div>}
                </div>
            </div>

        </>
    )
}

export default Dev