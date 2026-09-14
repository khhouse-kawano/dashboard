import React, { useEffect, useMemo, useState, useContext } from 'react';
import Table from "react-bootstrap/Table";
import '../chartConfig';
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import Category from '../Category';
import apiClient from '../../utils/apiClient';
// ⚠️ グラフとその系列は shop/ と共有する。X軸が店舗名か販促媒体名かだけが違う。
//   ⚠️ 同じものを2つ書くと、片方だけ直されて色や並びが食い違う
import UnitPriceGraphModal from '../shop/UnitPriceGraphModal';
import { UNIT_PRICE_SERIES } from '../shop/unitPriceSeries';

/**
 * 販促媒体別ランキング（注文事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **shop/ShopOrder.tsx を踏襲している**（2026-09-14 の指示）。
 *   違いは**行が店舗か販促媒体か**だけで、KPI も列の並びも同じにしてある。
 *   ⚠️ 判定が食い違うと、同じ期間なのに店舗別と媒体別で合計が合わなくなる。
 *   ⚠️ **片方を直したら必ず両方直すこと。**
 *
 * ⚠️ 2026-09-14 の変更点
 *   ・axios の本番URL直書きを `apiClient` へ（Express化）
 *   ・**次アポ**（数・率・単価）を追加
 *   ・列を「率 → 数」から**「数 → 率」**へ（shop と同じ）
 *   ・**「総反響」行を末尾から先頭へ**（shop の「グループ全体」と同じ）
 *   ・単価グラフ（モーダル）を追加。X軸は販促媒体名
 * ─────────────────────────────────────────────
 */

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
type Shop = { id: number; brand: string; shop: string; section: string; area: string; }
type Medium = { id: number; medium: string }
type Section = { no: number, name: string }

const CustomerOrder = () => {
    const { category } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<Customer[]>([]);
    const [originalBudgetList, setOriginalBudgetList] = useState<Budget[]>([]);
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [selectedShop, setSelectedShop] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [sortKey, setSortKey] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<string>('');
    const [sectionList, setSectionList] = useState<Section[]>([]);
    /** 単価グラフ（モーダル）。⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す */
    const [showGraph, setShowGraph] = useState<boolean>(false);

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));

        const fetchData = async () => {
            try {
                // ⚠️ 本番URLの直書きをやめた。apiClient が環境ごとの向き先を持つ
                const response = await apiClient.post("", { request: "customer", category });
                await setOriginalList(response.data.customer);
                await setShopArray(response.data.shop.filter(s => !s.shop.includes('未設定') && !s.shop.includes('全店舗')));
                await setMediumArray(response.data.medium.filter(m => m.list_medium === 1));
                await setOriginalBudgetList(response.data.budget);
                await setSectionList(response.data.section);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!originalList.length) return [];
        const areaValue = shopArray.find(item => item.area === selectedArea);

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
                (!selectedArea || item.shop === areaValue?.shop)
            );
        });
    }, [originalList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedArea]);

    const filteredBudgets = useMemo(() => {
        if (!originalBudgetList.length) return [];
        const areaValue = shopArray.find(item => item.area === selectedArea);

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
                (!selectedArea || item.shop === areaValue?.shop)
            );
        });
    }, [originalBudgetList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedArea]);

    /** 単価。⚠️ 分母が0や未定義なら null（表では '-'、グラフでは 0） */
    const unitPrice = (budget: number, count: number): number | null =>
        isFinite(budget / count) ? Math.round(budget / count) : null;

    const aggregated = useMemo(() => {
        /**
         * ⚠️⚠️ **「総反響」は先頭に置く。**
         *   2026-09-14 まで末尾だった。shop/ShopOrder.tsx の「グループ全体」に
         *   揃えてある。⚠️ グラフのX軸も同じ並びになるので、表と突き合わせられる。
         */
        return [{ id: 0, medium: '総反響' }, ...mediumArray].map(value => {
            const base = filteredCustomers.filter(
                c => value.medium === '総反響' || c.medium === value.medium
            );

            const totalValue = base.length;
            const reserveValue = base.filter(item =>
                item.interview || item.appointment || item.screening || item.contract
            ).length;
            /**
             * 次アポ数。
             * ⚠️ 判定は shop/ShopOrder.tsx と同じ `(appointment || screening || contract)`。
             *   ⚠️ shopTrend にある「どの月に数えるか」の分岐はここでは不要
             *     （月で切らず期間合計のため、分岐しても結果は同じ）。
             */
            const appointmentValue = base.filter(
                item => item.appointment || item.screening || item.contract
            ).length;
            const contractValue = base.filter(
                item => item.contract && (item.status === '契約済み' || item.status === '解約')
            ).length;

            const perReserve = isNaN(reserveValue / totalValue) ? 0 : Math.round((reserveValue / totalValue) * 100);
            // ⚠️ 次アポ率の分母は**来場数**。総反響ではない（歩留まりを1段ずつ見るため）
            const perAppointment = isNaN(appointmentValue / reserveValue) ? 0 : Math.round((appointmentValue / reserveValue) * 100);
            const perContract = isNaN(contractValue / reserveValue) ? 0 : Math.round((contractValue / reserveValue) * 100);
            const rankSValue = base.filter(item => item.rank === 'Sランク' && item.status === '見込み').length;
            const rankAValue = base.filter(item => item.rank === 'Aランク' && item.status === '見込み').length;
            const rankBValue = base.filter(item => item.rank === 'Bランク' && item.status === '見込み').length;
            const rankCValue = base.filter(item => item.rank === 'Cランク' && item.status === '見込み').length;
            const rankDValue = base.filter(item => item.rank === 'Dランク' && item.status === '見込み').length;

            const totalBudget = filteredBudgets
                .filter(item => value.medium === '総反響' || item.medium === value.medium)
                .reduce((acc, cur) => acc + cur.budget_value, 0);

            return {
                value,
                totalValue,
                reserveValue,
                appointmentValue,
                contractValue,
                perReserve,
                perAppointment,
                perContract,
                rankSValue,
                rankAValue,
                rankBValue,
                rankCValue,
                rankDValue,
                totalBudget,
                // ⚠️ キー名は shop/unitPriceSeries.ts の key と一致させること
                registerUnit: unitPrice(totalBudget, totalValue),
                reserveUnit: unitPrice(totalBudget, reserveValue),
                appointmentUnit: unitPrice(totalBudget, appointmentValue),
                contractUnit: unitPrice(totalBudget, contractValue),
            };
        });
    }, [mediumArray, filteredCustomers, filteredBudgets]);

    /**
     * 単価グラフのデータ。
     * ⚠️ X軸は**販促媒体**。先頭が「総反響」になるよう aggregated の並びをそのまま使う。
     * ⚠️ 非表示のときは作らない（媒体数×4系列で無駄になるため）。
     */
    const graphData = useMemo(() => {
        if (!showGraph) return [];
        return aggregated.map(item => ({
            medium: item.value.medium,
            // ⚠️ null のままだと recharts が棒を描かないので 0 に落とす
            registerUnit: item.registerUnit ?? 0,
            reserveUnit: item.reserveUnit ?? 0,
            appointmentUnit: item.appointmentUnit ?? 0,
            contractUnit: item.contractUnit ?? 0,
        }));
    }, [aggregated, showGraph]);


    const sorted = useMemo(() => {
        const arr = [...aggregated];
        arr.sort((a, b) => {
            const getKey = (x) => {
                switch (sortKey) {
                    case 'total': default: return x.totalValue;
                    case 'perReserve': return x.perReserve;
                    case 'reserve': return x.reserveValue;
                    case 'perAppointment': return x.perAppointment;
                    case 'appointment': return x.appointmentValue;
                    case 'perContract': return x.perContract;
                    case 'contract': return x.contractValue;
                    case 'S': return x.rankSValue;
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
                    case 'appointmentBudget':
                        return isFinite(x.totalBudget / x.appointmentValue) ? Math.round(x.totalBudget / x.appointmentValue) : 0;
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

    const arrowStyle = { position: 'absolute' as const, right: '4px', cursor: 'pointer' as const, fontSize: '10px' };

    return (
        <>
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
                <div className="d-flex flex-wrap mb-3">
                    <div className="m-1">
                        {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す。
                               媒体数で全画面/xl が切り替わる（UnitPriceGraphModal.tsx） */}
                        <div className="bg-primary btn text-white rounded-pill px-3 py-1"
                            style={{ fontSize: '12px', letterSpacing: '1px' }}
                            onClick={() => setShowGraph(true)}>グラフを表示</div>
                    </div>
                </div>
                {/* ⚠️ X軸は販促媒体。`itemKey` を渡さないと店舗名を探して空になる */}
                <UnitPriceGraphModal
                    show={showGraph}
                    onHide={() => setShowGraph(false)}
                    data={graphData}
                    series={UNIT_PRICE_SERIES}
                    title='注文事業'
                    itemKey='medium'
                    itemLabel='販促媒体'
                />
                <div className="table-wrapper mt-3">
                    <div className="list_table">
                        <Table striped style={{ fontSize: '12px' }} bordered>
                            <tbody>
                                <tr className='sticky-header'>
                                    <td className='sticky-column budget' style={{ position: 'relative', textAlign: 'center' }}>販促媒体名</td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の総反響数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>総反響</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'total')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'total')}>▼</span>
                                    </td>
                                    {/* ⚠️⚠️ **列は「数 → 率」の順。** shop/ShopOrder.tsx と揃えてある
                                           （2026-09-14 に「率 → 数」から入れ替えた）。
                                           ⚠️ 片方だけ直すと画面ごとに並びが違って読み違える */}
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうち来場した方の数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>来場数</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'reserve')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'reserve')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>来場者数/総反響数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>来場率</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'perReserve')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'perReserve')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうち次回アポイントまで進んだ方の数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>次アポ数</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'appointment')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'appointment')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>次アポ数/来場者数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>次アポ率</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'perAppointment')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'perAppointment')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうち契約した方の数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>契約数</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'contract')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'contract')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>契約者数/来場者数</Tooltip>
                                            }>
                                            <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>契約率</span>
                                        </OverlayTrigger>
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'perContract')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'perContract')}>▼</span>
                                    </td>
                                    {['S', 'A', 'B', 'C'].map(item =>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{startMonth === '' || `${startMonth}から`}{endMonth === '' || `${endMonth}まで`}{startMonth !== '' && endMonth !== '' || '全期間'}の反響のうち{item}ランクの数</Tooltip>
                                                }>
                                                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>{item}ランク</span>
                                            </OverlayTrigger>
                                            <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', item)}>▲</span>
                                            <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', item)}>▼</span>
                                        </td>
                                    )}
                                    <td style={{ position: 'relative', textAlign: 'center' }}>総予算
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'totalBudget')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'totalBudget')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>反響単価
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'registerBudget')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'registerBudget')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>来場単価
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'reserveBudget')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'reserveBudget')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>次アポ単価
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'appointmentBudget')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'appointmentBudget')}>▼</span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>契約単価
                                        <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', 'contractBudget')}>▲</span>
                                        <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', 'contractBudget')}>▼</span>
                                    </td>
                                </tr>
                                {sorted.map((item, index) => {
                                    const {
                                        value,
                                        totalValue,
                                        reserveValue,
                                        appointmentValue,
                                        contractValue,
                                        perReserve,
                                        perAppointment,
                                        perContract,
                                        rankSValue,
                                        rankAValue,
                                        rankBValue,
                                        rankCValue,
                                        rankDValue,
                                        totalBudget,
                                    } = item;

                                    return (
                                        <tr key={value.id ?? `medium-${index}`}>
                                            <td className='sticky-column' style={{ textAlign: 'center' }}>{value.medium}</td>
                                            <td style={{ textAlign: 'center' }}>{totalValue.toLocaleString()}</td>
                                            {/* ⚠️ 見出しと同じく「数 → 率」の順。入れ替えないこと */}
                                            <td style={{ textAlign: 'center' }}>{reserveValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perReserve}%</td>
                                            <td style={{ textAlign: 'center' }}>{appointmentValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perAppointment}%</td>
                                            <td style={{ textAlign: 'center' }}>{contractValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perContract}%</td>
                                            <td style={{ textAlign: 'center' }}>{rankSValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankAValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankBValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankCValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{`¥${totalBudget.toLocaleString()}`}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {isFinite(totalBudget / totalValue) ? `¥${Math.round(totalBudget / totalValue).toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {isFinite(totalBudget / reserveValue) ? `¥${Math.round(totalBudget / reserveValue).toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {isFinite(totalBudget / appointmentValue) ? `¥${Math.round(totalBudget / appointmentValue).toLocaleString()}` : '-'}
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
        </>
    )
}

export default CustomerOrder;
