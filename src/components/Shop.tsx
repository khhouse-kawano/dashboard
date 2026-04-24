import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import Table from "react-bootstrap/Table";
import axios from "axios";
import AuthContext from '../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
type Shop = { id: number; brand: string; shop: string; section: string; area: string; }
type Medium = { id: number; medium: string }
type Section = { no: number, name: string };
type Staff = { name: string; shop: string; rank: number };

const CustomersDev = () => {
    const navigate = useNavigate();
    const { brand } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<Customer[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [originalBudgetList, setOriginalBudgetList] = useState<Budget[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [selectedShop, setSelectedShop] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [selectedMedium, setSelectedMedium] = useState<string>('');
    const [sortKey, setSortKey] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);

    useEffect(() => {
        if (!brand || !token || !category) navigate("/login");
        setMonthArray(getYearMonthArray(2025, 1));

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'shop' }, { headers });
                await setOriginalList(response.data.customer);
                await setOriginalShopArray(response.data.shop.filter(s => !s.shop.includes('未設定') && !s.shop.includes('全店舗')));
                await setMediumArray(response.data.medium.filter(m => m.list_medium === 1));
                await setOriginalBudgetList(response.data.budget);
                await setSectionList(response.data.section);
                await setStaff(response.data.staff.filter(s => s.rank === 1));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!originalList.length) return [];
        const areaValue = shopArray.filter(s => s.area === selectedArea).map(s => s.shop);

        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
        }

        return originalList.filter(item => {
            const targetDate = new Date(item.register.replace(/\//g, '-'));
            const sectionShops = shopArray.filter(s => s.section === selectedSection).map(s => s.shop);
            return (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!selectedShop || item.shop?.includes(selectedShop)) &&
                (!selectedSection || sectionShops.includes(item.shop)) &&
                (!selectedArea || areaValue.includes(item.shop)) &&
                (!selectedMedium || item.medium === selectedMedium)
            );
        });
    }, [originalList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedArea, selectedMedium]);

    const filteredBudgets = useMemo(() => {
        if (!originalBudgetList.length) return [];
        const areaValue = shopArray.filter(s => s.area === selectedArea).map(s => s.shop);

        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [year, month] = endMonth.split('/').map(Number);
            endDate = new Date(year, month, 0);
        }

        return originalBudgetList.filter(item => {
            const targetDate = new Date(item.budget_period);
            return (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!selectedShop || item.shop.includes(selectedShop)) &&
                (!selectedSection || item.order_section.includes(selectedSection)) &&
                (!selectedArea || areaValue.includes(item.shop))
            );
        });
    }, [originalBudgetList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedArea]);

    useEffect(() => {
        const fetchData = () => {
            const filteredShop = [...(!selectedShop && !selectedSection && !selectedArea
                ? [...originalShopArray, { id: 0, brand: '', shop: 'グループ全体', section: '', area: '' }]
                : originalShopArray
            )]
                .filter(item =>
                    (!selectedShop || item.shop.includes(selectedShop)) &&
                    (!selectedSection || item.section === selectedSection) &&
                    (!selectedArea || item.area === selectedArea)
                );

            setShopArray(filteredShop);
        };

        fetchData();
    }, [originalList, startMonth, endMonth, selectedMedium, selectedShop, selectedSection, selectedArea]);

    const filteredValue = (shopValue: string, category: string, rankValue: string) => {
        const base = filteredCustomers.filter(c => shopValue !== 'グループ全体' ? c.shop === shopValue : true);
        if (category === 'reserve') {
            return base.filter(b => b.interview || b.appointment || b.screening || b.contract).length;
        }
        if (category === 'contract') {
            return base.filter(b => b.contract && b.status === '契約済み').length;
        }
        if (rankValue) {
            return base.filter(b => b.rank === rankValue && b.status === '見込み').length;
        }
        return filteredCustomers.filter(c => (
            shopValue !== 'グループ全体' ? c.shop === shopValue : true)
            && (category ? c[category] !== '' : true)
            && (rankValue ? (c.rank === rankValue && c.contract === '') : true)).length
    };

    const aggregated = useMemo(() => {
        return shopArray.map(value => {
            const totalValue = filteredValue(value.shop, '', '');
            const reserveValue = filteredValue(value.shop, 'reserve', '');
            const contractValue = filteredValue(value.shop, 'contract', '');
            const perReserve = isNaN(reserveValue / totalValue) ? 0 : Math.round((reserveValue / totalValue) * 100);
            const perContract = isNaN(contractValue / reserveValue) ? 0 : Math.round((contractValue / reserveValue) * 100);
            const totalBudget = filteredBudgets.filter(item => (value.shop === 'グループ全体' || item.shop === value.shop)).reduce((acc, cur) => acc + cur.budget_value, 0);
            const staffValue = staff.filter(s => (value.shop !== 'グループ全体' ? s.shop === value.shop : true)).length;
            const rankAValue = filteredValue(value.shop, '', 'Aランク').toLocaleString();
            const rankBValue = filteredValue(value.shop, '', 'Bランク').toLocaleString();
            const rankCValue = filteredValue(value.shop, '', 'Cランク').toLocaleString();
            const rankDValue = filteredValue(value.shop, '', 'Dランク').toLocaleString();
            const rankEValue = filteredValue(value.shop, '', 'Eランク').toLocaleString();

            return {
                value,
                totalValue,
                reserveValue,
                contractValue,
                perReserve,
                perContract,
                staffValue,
                rankAValue,
                rankBValue,
                rankCValue,
                rankDValue,
                rankEValue,
                totalBudget,
            };
        });
    }, [shopArray, filteredCustomers, filteredBudgets]);


    const sorted = useMemo(() => {
        const arr = [...aggregated];
        arr.sort((a, b) => {
            const getKey = (x) => {
                switch (sortKey) {
                    case 'total': default: return x.totalValue;
                    case 'perReserve': return x.perReserve;
                    case 'reserve': return x.reserveValue;
                    case 'perContract': return x.perContract;
                    case 'contract': return x.contractValue;
                    case 'A': return x.rankAValue;
                    case 'B': return x.rankBValue;
                    case 'C': return x.rankCValue;
                    case 'D': return x.rankDValue;
                    case 'E': return x.rankEValue;
                    case 'totalBudget': return x.totalBudget;
                    case 'registerBudget':
                        return isFinite(x.totalBudget / x.totalValue) ? Math.round(x.totalBudget / x.totalValue) : 0;
                    case 'reserveBudget':
                        return isFinite(x.totalBudget / x.reserveValue) ? Math.round(x.totalBudget / x.reserveValue) : 0;
                    case 'contractBudget':
                        return isFinite(x.totalBudget / x.contractValue) ? Math.round(x.totalBudget / x.contractValue) : 0;
                }
            };
            const aVal = getKey(a);
            const bVal = getKey(b);
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return arr;
    }, [aggregated, sortKey, sortOrder]);

    const handleSort = async (start: string, end: string, medium: string, shop: string, section: string, area: string) => {
        await setStartMonth(start);
        await setEndMonth(end);
        await setSelectedMedium(medium);
        await setSelectedShop(shop);
        await setSelectedSection(section);
        await setSelectedArea(area);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order);
    };



    return (
        <div className='outer-container' style={{ width: '100vw' }}>
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
                    <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                    <div className="d-flex flex-wrap mb-3">
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(event.target.value, endMonth, selectedMedium, selectedShop, selectedSection, selectedArea)}>
                                <option value="" selected>開始月</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <span className='d-flex align-items-center mx-1'>～</span>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, event.target.value, selectedMedium, selectedShop, selectedSection, selectedArea)}>
                                <option value="" selected>終了月</option>
                                {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, event.target.value, selectedShop, selectedSection, selectedArea)}>
                                <option value="" selected={selectedSection === ''}>全販促媒体</option>
                                {mediumArray.map((item, index) =>
                                    <option key={index} selected={selectedMedium === item.medium}>{item.medium}</option>
                                )}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, event.target.value, '', '')}>
                                <option value="">グループ全体</option>
                                <option value="KH" selected={selectedShop.includes('KH')}>国分ハウジング全体</option>
                                <option value="DJH" selected={selectedShop.includes('DJH')}>デイジャストハウス全体</option>
                                <option value="なごみ" selected={selectedShop.includes('なごみ')}>なごみ工務店全体</option>
                                {originalShopArray.map((item, index) => (
                                    <option key={index} value={item.shop} selected={item.shop === selectedShop}>{item.shop}</option>
                                ))}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, '', event.target.value, '')}>
                                <option value="" selected={selectedSection === ''}>注文営業全体</option>
                                {sectionList.map((section, index) =>
                                    <option value={section.name} key={index}>{section.name}</option>
                                )}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, '', '', event.target.value)}>
                                <option value="" selected={selectedArea === ''}>全エリア</option>
                                <option value="鹿児島県" selected={selectedArea === '鹿児島県'}>鹿児島県</option>
                                <option value="宮崎県" selected={selectedArea === '宮崎県'}>宮崎県</option>
                                <option value="大分県" selected={selectedArea === '大分県'}>大分県</option>
                                <option value="熊本県" selected={selectedArea === '熊本県'}>熊本県</option>
                                <option value="佐賀県" selected={selectedArea === '佐賀県'}>佐賀県</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <div className="list_table">
                            <Table striped style={{ fontSize: '12px' }} bordered>
                                <tbody>
                                    <tr className='sticky-header'>
                                        <td className='sticky-column' style={{ position: 'relative', textAlign: 'center' }}>店舗名</td>
                                        <td className='text-center'>営業人数</td>
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
                                    {sorted.map((item, index) => {
                                        const {
                                            value,
                                            totalValue,
                                            reserveValue,
                                            contractValue,
                                            perReserve,
                                            perContract,
                                            staffValue,
                                            rankAValue,
                                            rankBValue,
                                            rankCValue,
                                            rankDValue,
                                            rankEValue,
                                            totalBudget,
                                        } = item;

                                        return (
                                            <tr key={value.id ?? `medium-${index}`}>
                                                <td className='sticky-column' style={{ textAlign: 'center' }}>{value.shop}</td>
                                                <td style={{ textAlign: 'center' }}>{staffValue}</td>
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
                                                <td style={{ textAlign: 'center' }}>
                                                    {isFinite(totalBudget / totalValue) ? `¥${Math.round(totalBudget / totalValue).toLocaleString()}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {isFinite(totalBudget / reserveValue) ? `¥${Math.round(totalBudget / reserveValue).toLocaleString()}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {isFinite(totalBudget / contractValue) ? `¥${Math.round(totalBudget / contractValue).toLocaleString()}` : '-'}
                                                </td>
                                            </tr>
                                        );
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

export default CustomersDev
