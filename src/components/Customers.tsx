import React, { useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from "react-router-dom";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import axios from "axios";
import AuthContext from '../context/AuthContext';
import { Pie } from 'react-chartjs-2';
import './chartConfig';
import { colorCodes } from './ColorCodes.js';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { ChartOptions } from 'chart.js';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import MenuDev from "./MenuDev";

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
type Shop = { id: number; brand: string; shop: string; section: string; area: string; }
type Medium = { id: number; medium: string }
type PieDataType = {
    labels: string[];
    datasets: {
        data: number[];
        backgroundColor: string[];
        borderColor: string[];
        borderWidth: number;
    }[];
};
type Section = { no: number, name: string }


const CustomersDev = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [originalList, setOriginalList] = useState<Customer[]>([]);
    const [budgetList, setBudgetList] = useState<Budget[]>([]);
    const [originalBudgetList, setOriginalBudgetList] = useState<Budget[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [selectedShop, setSelectedShop] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [sortKey, setSortKey] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<string>('');
    const [sectionList, setSectionList] = useState<Section[]>([]);
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
    const [open, setOpen] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        if( !brand || brand.trim() === "") navigate("/");
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
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [customerResponse, shopResponse, mediumResponse, budgetResponse, sectionResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_budget" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "section_list" }, { headers }),
                ]);
                await setCustomerList(customerResponse.data);
                await setOriginalList(customerResponse.data);
                await setShopArray(shopResponse.data);
                await setMediumArray(mediumResponse.data);
                await setBudgetList(budgetResponse.data);
                await setOriginalBudgetList(budgetResponse.data);
                await setSectionList(sectionResponse.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [])


    useEffect(() => {
        if (!originalList.length) return;
        const areaValue = shopArray.find(item => item.area === selectedArea);

        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
        }

        const filtered = originalList.filter(item => {
            const targetDate = new Date(item.register);
            return (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!selectedShop || item.shop?.includes(selectedShop)) &&
                (!selectedSection || item.section?.includes(selectedSection)) &&
                (!selectedArea || item.shop === areaValue?.shop)
            );
        });

        setCustomerList(filtered);

        const filteredBudget = originalBudgetList.filter(item => {
            const targetDate = new Date(item.budget_period);
            return (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!selectedShop || item.shop.includes(selectedShop)) &&
                (!selectedSection || item.order_section.includes(selectedSection)) &&
                (!selectedArea || item.shop === areaValue?.shop)
            );
        });

        setBudgetList(filteredBudget);

        // グラフ↓

        const registerLengthArray = mediumArray.map(mediumItem => {
            return filtered.filter(filteredItem => filteredItem.medium === mediumItem.medium).length
        });
        const reserveLengthArray = mediumArray.map(mediumItem => {
            return filtered.filter(filteredItem => filteredItem.medium === mediumItem.medium && filteredItem.reserve !== '').length
        });
        const contractLengthArray = mediumArray.map(mediumItem => {
            return filtered.filter(filteredItem => filteredItem.medium === mediumItem.medium && filteredItem.contract !== '').length
        });
        setDataRegisterPie(prev => ({
            ...prev,
            labels: mediumArray.map(item => item.medium),
            datasets: [
                {
                    ...prev.datasets[0],
                    data: registerLengthArray,
                    backgroundColor: mediumArray.map((_, index) => colorCodes[index]),
                    borderColor: mediumArray.map((_, index) => colorCodes[index])
                },
            ],
        }));

        setDataReservePie(prev => ({
            ...prev,
            labels: mediumArray.map(item => item.medium),
            datasets: [
                {
                    ...prev.datasets[0],
                    data: reserveLengthArray,
                    backgroundColor: mediumArray.map((_, index) => colorCodes[index]),
                    borderColor: mediumArray.map((_, index) => colorCodes[index])
                },
            ],
        }));

        setDataContractPie(prev => ({
            ...prev,
            labels: mediumArray.map(item => item.medium),
            datasets: [
                {
                    ...prev.datasets[0],
                    data: contractLengthArray,
                    backgroundColor: mediumArray.map((_, index) => colorCodes[index]),
                    borderColor: mediumArray.map((_, index) => colorCodes[index])
                },
            ],
        }));
    }, [originalList, startMonth, endMonth, selectedShop, selectedSection, selectedArea]);


    const handleSort = async (start: string, end: string, shop: string, section: string, area: string) => {
        await setStartMonth(start);
        await setEndMonth(end);
        await setSelectedShop(shop);
        await setSelectedSection(section);
        await setSelectedArea(area);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
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



    return (
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
                <div className='content customer bg-white p-2'>
                    <div style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                    <div className="d-flex flex-wrap mb-3">
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(event.target.value, endMonth, selectedShop, selectedSection, selectedArea)}>
                                <option value="" selected>開始月</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <span className='d-flex align-items-center mx-1'>～</span>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, event.target.value, selectedShop, selectedSection, selectedArea)}>
                                <option value="" selected>終了月</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, event.target.value, '', '')}>
                                <option value="">グループ全体</option>
                                <option value="KH" selected={selectedShop.includes('KH')}>国分ハウジング全体</option>
                                <option value="DJH" selected={selectedShop.includes('DJH')}>デイジャストハウス全体</option>
                                <option value="なごみ" selected={selectedShop.includes('なごみ')}>なごみ工務店全体</option>
                                {shopArray.map((item, index) => (
                                    <option key={index} value={item.shop} selected={item.shop === selectedShop}>{item.shop}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, '', event.target.value, '')}>
                                <option value="" selected={selectedSection === ''}>注文営業全体</option>
                                {sectionList.map((section, index) =>
                                    <option value={section.name} key={index}>{section.name}</option>
                                )}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, '', '', event.target.value)}>
                                <option value="" selected={selectedArea === ''}>全エリア</option>
                                <option value="鹿児島県" selected={selectedArea === '鹿児島県'}>鹿児島県</option>
                                <option value="宮崎県" selected={selectedArea === '宮崎県'}>宮崎県</option>
                                <option value="大分県" selected={selectedArea === '大分県'}>大分県</option>
                                <option value="熊本県" selected={selectedArea === '熊本県'}>熊本県</option>
                                <option value="佐賀県" selected={selectedArea === '佐賀県'}>佐賀県</option>
                            </select>
                        </div>
                    </div>
                    <div className="m-1">
                        {show === true ? <input type="button" className='target bg-danger text-white' value='グラフを非表示' onClick={() => setShow(false)} /> :
                            <input type="button" className='target bg-primary text-white' value='グラフを表示' onClick={() => setShow(true)} />}
                    </div>
                    <div className={`mt-3 graph_pc ${show === true ? 'show' : ''}`}>
                        <Tabs defaultActiveKey="home" id="justify-tab-example" className="mb-3 bg-white" justify style={{ fontSize: '12px', letterSpacing: '1px', width: '80vw' }}>
                            <Tab eventKey="home" title="総反響詳細">
                                <Pie data={dataRegisterPie} options={options} className='pie' />
                            </Tab>
                            <Tab eventKey="profile" title="来場者詳細">
                                <Pie data={dataReservePie} options={options} className='pie' />
                            </Tab>
                            <Tab eventKey="longer-tab" title="契約者詳細">
                                <Pie data={dataContractPie} options={options} className='pie' />
                            </Tab>
                        </Tabs>
                    </div>
                    <div className="table-wrapper mt-3">
                        <div className="list_table">

                            <Table striped style={{ fontSize: '12px' }}>
                                <tbody>
                                    <tr className='sticky-header'>
                                        <td className='sticky-column' style={{ position: 'relative', textAlign: 'center' }}>販促媒体名</td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の総反響数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>総反響</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'total')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'total')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>来場者数/総反響数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>来場率</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'perReserve')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'perReserve')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうち来場した方の数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>来場数</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'reserve')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'reserve')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>契約者数/来場者数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>契約率</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'perContract')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'perContract')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうち契約した方の数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>契約数</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'contract')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'contract')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうちAランクの数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Aランク</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'A')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'A')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうちBランクの数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Bランク</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'B')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'B')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうちCランクの数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Cランク</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'C')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'C')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうちDランクの数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Dランク</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'D')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'D')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうちEランクの数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>Eランク</span>
                                            </OverlayTrigger>
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'E')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'E')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>総予算
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'totalBudget')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'totalBudget')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>反響単価
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'registerBudget')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'registerBudget')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>来場単価
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'reserveBudget')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'reserveBudget')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>契約単価
                                            <span style={{ position: 'absolute', top: '4px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'contractBudget')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', right: '4px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'contractBudget')}>▼</span>
                                        </td>
                                    </tr>
                                    {[...mediumArray, { id: 0, medium: '総反響' }]
                                        .sort((a, b) => {
                                            const getKey = (value: typeof a) => {
                                                const totalValue = customerList.filter(item => value.medium === '総反響' || item.medium === value.medium).length;
                                                const reserveValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.reserve !== '').length;
                                                const contractValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.contract !== '').length;
                                                const perReserve = isNaN(reserveValue / totalValue) ? 0 : Math.round((reserveValue / totalValue) * 100);
                                                const perContract = isNaN(contractValue / reserveValue) ? 0 : Math.round((contractValue / reserveValue) * 100);
                                                const rankAValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Aランク' && item.contract === '').length;
                                                const rankBValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Bランク' && item.contract === '').length;
                                                const rankCValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Cランク' && item.contract === '').length;
                                                const rankDValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Dランク' && item.contract === '').length;
                                                const rankEValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Eランク' && item.contract === '').length;
                                                const totalBudget = budgetList.filter(item => (value.medium === '総反響' || item.medium === value.medium)).reduce((acc, cur) => acc + cur.budget_value, 0);
                                                switch (sortKey) {
                                                    case 'total':
                                                    default:
                                                        return totalValue;
                                                    case 'perReserve':
                                                        return perReserve;
                                                    case 'reserve':
                                                        return reserveValue;
                                                    case 'perContract':
                                                        return perContract;
                                                    case 'contract':
                                                        return contractValue;
                                                    case 'A':
                                                        return rankAValue;
                                                    case 'B':
                                                        return rankBValue;
                                                    case 'C':
                                                        return rankCValue;
                                                    case 'D':
                                                        return rankDValue;
                                                    case 'E':
                                                        return rankEValue;
                                                    case 'totalBudget':
                                                        return totalBudget;
                                                    case 'registerBudget':
                                                        return isFinite(totalBudget / totalValue) ? Math.round(totalBudget / totalValue) : 0;
                                                    case 'reserveBudget':
                                                        return isFinite(totalBudget / reserveValue) ? Math.round(totalBudget / reserveValue) : 0;
                                                    case 'contractBudget':
                                                        return isFinite(totalBudget / contractValue) ? Math.round(totalBudget / contractValue) : 0;
                                                }
                                            };

                                            const aVal = getKey(a);
                                            const bVal = getKey(b);
                                            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
                                        })
                                        .map((value, index) => {
                                            const totalValue = customerList.filter(item => value.medium === '総反響' || item.medium === value.medium).length;
                                            const reserveValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.reserve !== '').length;
                                            const contractValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.contract !== '').length;
                                            const perReserve = isNaN(reserveValue / totalValue) ? 0 : Math.round((reserveValue / totalValue) * 100);
                                            const perContract = isNaN(contractValue / reserveValue) ? 0 : Math.round((contractValue / reserveValue) * 100);
                                            const rankAValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Aランク' && item.contract === '').length;
                                            const rankBValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Bランク' && item.contract === '').length;
                                            const rankCValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Cランク' && item.contract === '').length;
                                            const rankDValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Dランク' && item.contract === '').length;
                                            const rankEValue = customerList.filter(item => (value.medium === '総反響' || item.medium === value.medium) && item.rank === 'Eランク' && item.contract === '').length;
                                            const totalBudget = budgetList.filter(item => (value.medium === '総反響' || item.medium === value.medium)).reduce((acc, cur) => acc + cur.budget_value, 0);
                                            return (
                                                <tr key={index}>
                                                    <td className='sticky-column' style={{ textAlign: 'center' }}>{value.medium}</td>
                                                    <td style={{ textAlign: 'center' }}>{totalValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{perReserve}%</td>
                                                    <td style={{ textAlign: 'center' }}>{reserveValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{perContract}%</td>
                                                    <td style={{ textAlign: 'center' }}>{contractValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{rankAValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{rankBValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{rankCValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{rankDValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{rankEValue.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'center' }}>{`¥${totalBudget.toLocaleString()}`}</td>
                                                    <td style={{ textAlign: 'center' }}>{isFinite(totalBudget / totalValue) ? `¥${Math.round(totalBudget / totalValue).toLocaleString()}` : '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>{isFinite(totalBudget / reserveValue) ? `¥${Math.round(totalBudget / reserveValue).toLocaleString()}` : '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>{isFinite(totalBudget / contractValue) ? `¥${Math.round(totalBudget / contractValue).toLocaleString()}` : '-'}</td>
                                                </tr>
                                            )
                                        })}
                                </tbody>
                            </Table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default CustomersDev;
