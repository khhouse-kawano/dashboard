import React, { useEffect, useState, useContext, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import apiClient from '../../utils/apiClient';
import { sortShops } from '../header/useAmbassadorMaster';
import { UNIT_PRICE_SERIES_SPEC } from './unitPriceSeries';

/**
 * 店舗ランキング（建売分譲事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ShopOrder.tsx をもとにしているが「似ているだけの別物」である。**
 *   共通化しないこと。KPI の段階が違う。
 *
 *     注文 … 総反響 → 来場 → 次アポ → 契約
 *     建売 … 総反響 → 接触 → 来場・物件案内 → 申込み → 契約
 *
 *   ⚠️ フェーズ列も事業ごとに意味が違う。列名から推測しないこと。
 *     step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *       注文 → contract（契約）
 *       建売 → application（申し込み）
 *
 * ⚠️⚠️ **「併売店をまとめる」は入れていない。**
 *   **建売に併売店の概念は無い**（2026-09-11 に利用者が明言）。
 *   ShopOrder.tsx にはあるので足したくなるが、足さないこと。
 *
 * ⚠️⚠️ **① にフォールバック先が無い。**
 *   `backend/src/handlers/shopAction/shop_spec.php` は**存在しない**。
 *   ② が落ちるとこの画面は動かない。利用者と相談のうえ ① には作らない
 *   方針にした（SQL を2箇所に書くと片方だけ直して鼠算になるため）。
 * ─────────────────────────────────────────────
 */

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
/** 店舗。⚠️ `id` / `division` は並び替え（sortShops）に使う */
type Shop = { id: number; brand: string; shop: string; section: string; area: string; division?: string; }
type Medium = { id: number; medium: string }
type Section = { no: number, name: string };
type Staff = { name: string; shop: string; rank: number };

const ShopKaeru = () => {
    const { category } = useContext(AuthContext);
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
    const [sectionList, setSectionList] = useState<Section[]>([]);
    /** 単価の棒グラフを出すか */
    const [showGraph, setShowGraph] = useState<boolean>(false);
    const now = new Date();
    const year = now.getFullYear();

    const thisYear = now.getMonth() <= 4 ? year : year + 1;

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));

        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'shop', category });
                setOriginalList(response.data.customer);
                setOriginalShopArray(response.data.shop.filter(s => !s.shop.includes('未設定') && !s.shop.includes('全店舗')));
                // ⚠️ 建売の媒体は medium_kaeru。list_medium で絞らない（列が無い）
                setMediumArray(response.data.medium);
                setOriginalBudgetList(response.data.budget);
                setSectionList(response.data.section);
                setStaff(response.data.staff.filter(s => s.rank === 1 && s.period === String(thisYear)));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!originalList.length) return [];
        const areaValue = shopArray.filter(s => s.area === selectedArea).map(s => s.shop);

        let startDate: Date | undefined;
        if (startMonth !== '') startDate = new Date(`${startMonth}/01`);

        let endDate: Date | undefined;
        if (endMonth !== '') {
            const [y, m] = endMonth.split('/').map(Number);
            endDate = new Date(y, m, 0);
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
            const [y, m] = endMonth.split('/').map(Number);
            endDate = new Date(y, m, 0);
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
        /**
         * ⚠️ 店舗を 事業区分 → ブランド → id の順に並べる（sortShops）。
         *   ⚠️ 「グループ全体」は sortShops に混ぜない。division が空で
         *     末尾に回されるため、先に並べてから先頭に付ける。
         */
        const sortedShops = sortShops(originalShopArray as never) as unknown as Shop[];

        const filteredShop = sortedShops.filter(item =>
            (!selectedShop || item.shop.includes(selectedShop)) &&
            (!selectedSection || item.section === selectedSection) &&
            (!selectedArea || item.area === selectedArea)
        );

        // ⚠️ 絞り込み中は「グループ全体」を出さない。一部だけの合計を
        //   そう呼ぶと誤読される
        const withTotal = (!selectedShop && !selectedSection && !selectedArea)
            ? [{ id: 0, brand: '', shop: 'グループ全体', section: '', area: '' }, ...filteredShop]
            : filteredShop;

        setShopArray(withTotal);
    }, [originalShopArray, selectedShop, selectedSection, selectedArea]);

    /**
     * KPI ごとの件数。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **上位の工程に進んだ人は、下位の工程も達成したものとして数える。**
     *   接触日が空でも契約済みなら「接触した」はずである。
     *   日付の入力漏れで歩留まりが逆転する（契約数 > 申込数 など）のを防ぐ。
     *   ⚠️ ShopOrder.tsx の `reserve` が同じ考え方で OR を並べている。
     *
     * ⚠️ 段階は 総反響 → 接触 → 来場・物件案内 → 申込み → 契約。
     *   ⚠️ `tour`（物件案内）は来場と同じ段階として扱う
     *     （ShopTrendKaeru / CustomerTrendKaeru の interviewKeys と同じ）。
     *   ⚠️ `contract_broker`（仲介契約）も契約に含める。
     *
     * ⚠️ 契約は `status === '契約済み'` のみ。**解約を含めない。**
     *   ⚠️ 注文（ShopOrder.tsx）は解約も数えるが、建売は
     *     CustomerTrendKaeru.tsx に合わせている。事業で運用が違う。
     * ─────────────────────────────────────────────
     */
    const filteredValue = (shopValue: string, kpi: string, rankValue: string) => {
        const matchShop = (c: Customer) => shopValue !== 'グループ全体' ? c.shop === shopValue : true;
        const base = filteredCustomers.filter(matchShop);

        const isContract = (b: Customer) => (b.contract || b.contract_broker) && b.status === '契約済み';
        const isApplication = (b: Customer) => b.application || isContract(b);
        const isInterview = (b: Customer) => b.interview || b.tour || isApplication(b);
        const isContact = (b: Customer) => b.contact || isInterview(b);

        if (kpi === 'contact') return base.filter(isContact).length;
        if (kpi === 'interview') return base.filter(isInterview).length;
        if (kpi === 'application') return base.filter(isApplication).length;
        if (kpi === 'contract') return base.filter(isContract).length;

        /**
         * ランク別。
         * ⚠️⚠️ **status で絞らない。** 注文は `status === '見込み'` で絞るが、
         *   建売は `show_dashboard = 1` のものを**すべて見込みとして扱う**
         *   運用である（2026-09-10 に利用者が明言。company/Company.tsx も同じ）。
         *
         * ⚠️ 建売の S ランクは「契約済み」を意味する。
         *   ⚠️ company/Company.tsx では**当月契約分だけ**を拾うようにしているが、
         *     この画面は月で切らず期間合計なので、その絞り込みは入れていない。
         *     S ランクの数は「期間内の反響のうち S になった人」である。
         */
        if (rankValue) return base.filter(b => b.rank === rankValue).length;

        return base.length;
    };

    /** 単価。⚠️ 分母が0や未定義なら null（表では '-'、グラフでは 0） */
    const unitPrice = (budget: number, count: number): number | null =>
        isFinite(budget / count) ? Math.round(budget / count) : null;

    const aggregated = useMemo(() => {
        return shopArray.map(value => {
            const isTotalRow = value.shop === 'グループ全体';

            const totalValue = filteredValue(value.shop, '', '');
            const contactValue = filteredValue(value.shop, 'contact', '');
            const interviewValue = filteredValue(value.shop, 'interview', '');
            const applicationValue = filteredValue(value.shop, 'application', '');
            const contractValue = filteredValue(value.shop, 'contract', '');

            const perContact = isNaN(contactValue / totalValue) ? 0 : Math.round((contactValue / totalValue) * 100);
            const perContract = isNaN(contractValue / contactValue) ? 0 : Math.round((contractValue / contactValue) * 100);

            const totalBudget = filteredBudgets
                .filter(item => isTotalRow || item.shop === value.shop)
                .reduce((acc, cur) => acc + cur.budget_value, 0);
            const staffValue = staff.filter(s => isTotalRow || s.shop === value.shop).length;

            const rankSValue = filteredValue(value.shop, '', 'Sランク');
            const rankAValue = filteredValue(value.shop, '', 'Aランク');
            const rankBValue = filteredValue(value.shop, '', 'Bランク');
            const rankCValue = filteredValue(value.shop, '', 'Cランク');

            return {
                value,
                totalValue,
                contactValue,
                interviewValue,
                applicationValue,
                contractValue,
                perContact,
                perContract,
                staffValue,
                rankSValue,
                rankAValue,
                rankBValue,
                rankCValue,
                totalBudget,
                // ⚠️ キー名は unitPriceSeries.ts の UNIT_PRICE_SERIES_SPEC と一致させること
                registerUnit: unitPrice(totalBudget, totalValue),
                contactUnit: unitPrice(totalBudget, contactValue),
                applicationUnit: unitPrice(totalBudget, applicationValue),
                contractUnit: unitPrice(totalBudget, contractValue),
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopArray, filteredCustomers, filteredBudgets, staff]);

    /**
     * 単価グラフのデータ。
     * ⚠️ X軸は店舗。**先頭が「グループ全体」**になるよう shopArray の並びをそのまま使う。
     */
    const graphData = useMemo(() => {
        if (!showGraph) return [];
        return aggregated.map(item => ({
            shop: item.value.shop,
            // ⚠️ null のままだと recharts が棒を描かないので 0 に落とす
            registerUnit: item.registerUnit ?? 0,
            contactUnit: item.contactUnit ?? 0,
            applicationUnit: item.applicationUnit ?? 0,
            contractUnit: item.contractUnit ?? 0,
        }));
    }, [aggregated, showGraph]);

    const sorted = useMemo(() => {
        const arr = [...aggregated];
        arr.sort((a, b) => {
            const getKey = (x: typeof arr[number]) => {
                switch (sortKey) {
                    case 'total': default: return x.totalValue;
                    case 'perContact': return x.perContact;
                    case 'contact': return x.contactValue;
                    case 'interview': return x.interviewValue;
                    case 'application': return x.applicationValue;
                    case 'perContract': return x.perContract;
                    case 'contract': return x.contractValue;
                    case 'S': return x.rankSValue;
                    case 'A': return x.rankAValue;
                    case 'B': return x.rankBValue;
                    case 'C': return x.rankCValue;
                    case 'totalBudget': return x.totalBudget;
                    // ⚠️ 単価は aggregated で計算済み。null（分母0）は 0 として並べる
                    case 'registerBudget': return x.registerUnit ?? 0;
                    case 'contactBudget': return x.contactUnit ?? 0;
                    case 'applicationBudget': return x.applicationUnit ?? 0;
                    case 'contractBudget': return x.contractUnit ?? 0;
                }
            };
            const aVal = getKey(a);
            const bVal = getKey(b);
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return arr;
    }, [aggregated, sortKey, sortOrder]);

    const handleSort = (start: string, end: string, medium: string, shop: string, section: string, area: string) => {
        setStartMonth(start);
        setEndMonth(end);
        setSelectedMedium(medium);
        setSelectedShop(shop);
        setSelectedSection(section);
        setSelectedArea(area);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order);
    };

    const arrowStyle = { position: 'absolute' as const, right: '4px', cursor: 'pointer' as const, fontSize: '10px' };

    /** 期間の説明。ツールチップで使い回す */
    const periodLabel = `${startMonth === '' ? '' : `${startMonth}から`}${endMonth === '' ? '' : `${endMonth}まで`}${startMonth !== '' || endMonth !== '' ? '' : '全期間'}`;

    /** 並べ替えの矢印。列ごとに同じものを出す */
    const sortArrows = (key: string) => (
        <>
            <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', key)}>▲</span>
            <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', key)}>▼</span>
        </>
    );

    /** 見出しのセル。説明が要るものはツールチップを付ける */
    const headCell = (label: string, key: string, tip?: string) => (
        <td style={{ position: 'relative', textAlign: 'center' }}>
            {tip ? (
                <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip id={`tooltip-${key}`} style={{ fontSize: "12px" }}>{tip}</Tooltip>}>
                    <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>{label}</span>
                </OverlayTrigger>
            ) : label}
            {sortArrows(key)}
        </td>
    );

    return (
        <>
            <div className='content customer bg-white p-2'>
                <div className='ps-2' style={{ fontSize: '13px' }}>※接触数・契約数は"反響日"起算となります。</div>
                <div className="d-flex flex-wrap mb-3">
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(event.target.value, endMonth, selectedMedium, selectedShop, selectedSection, selectedArea)}>
                            <option value="" selected>開始月</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <span className='d-flex align-items-center mx-1'>～</span>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, event.target.value, selectedMedium, selectedShop, selectedSection, selectedArea)}>
                            <option value="" selected>終了月</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, endMonth, event.target.value, selectedShop, selectedSection, selectedArea)}>
                            <option value="" selected={selectedMedium === ''}>全販促媒体</option>
                            {mediumArray.map((item, index) =>
                                <option key={index} selected={selectedMedium === item.medium}>{item.medium}</option>
                            )}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, event.target.value, '', '')}>
                            <option value="">グループ全体</option>
                            {originalShopArray.map((item, index) => (
                                <option key={index} value={item.shop} selected={item.shop === selectedShop}>{item.shop}</option>
                            ))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, '', event.target.value, '')}>
                            <option value="" selected={selectedSection === ''}>建売営業全体</option>
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
                <div className="d-flex flex-wrap mb-3">
                    <div className="m-1">
                        <label className="target checkbox d-flex align-items-center">
                            <input type="checkbox" checked={showGraph} className='me-1'
                                onChange={() => setShowGraph(!showGraph)} />グラフを表示
                        </label>
                    </div>
                    {/* ⚠️ 「併売店をまとめる」は置かない。建売に併売店の概念は無い */}
                </div>
                {showGraph && (
                    <div className="mb-4">
                        <div className="text-center mb-2" style={{ fontSize: '12px' }}>店舗別 単価比較</div>
                        <ResponsiveContainer width="100%" height={420}>
                            <BarChart data={graphData} margin={{ top: 8, right: 16, left: 24, bottom: 80 }}>
                                <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                                <XAxis dataKey="shop" fontSize={10} interval={0} angle={-45} textAnchor="end" height={80} />
                                {/* ⚠️ Y軸は円。3桁区切りにしないと桁が読めない */}
                                <YAxis fontSize={11} tickFormatter={(v: number) => `¥${v.toLocaleString()}`} width={80} />
                                <ChartTooltip
                                    formatter={(v: number, name: string) => [`¥${Number(v).toLocaleString()}`, name]}
                                    contentStyle={{ fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                {/* ⚠️ stackId は付けない。単価は足し合わせても意味がない */}
                                {UNIT_PRICE_SERIES_SPEC.map(s => (
                                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="table-wrapper">
                    <div className="list_table">
                        <Table striped style={{ fontSize: '12px' }} bordered>
                            <tbody>
                                <tr className='sticky-header'>
                                    <td className='sticky-column budget' style={{ position: 'relative', textAlign: 'center' }}>店舗名</td>
                                    <td className='text-center'>営業人数</td>
                                    {headCell('総反響', 'total', `${periodLabel}の総反響数`)}
                                    {headCell('接触率', 'perContact', '接触数/総反響数')}
                                    {headCell('接触数', 'contact', `${periodLabel}の反響のうち接触した方の数（以降の工程に進んだ方を含む）`)}
                                    {headCell('来場・案内', 'interview', '来場または物件案内があった方の数（以降の工程に進んだ方を含む）')}
                                    {headCell('申込数', 'application', '申し込みに至った方の数（契約者を含む）')}
                                    {headCell('契約率', 'perContract', '契約者数/接触者数')}
                                    {headCell('契約数', 'contract', '契約済みの方の数（仲介契約を含む。解約は含まない）')}
                                    {['S', 'A', 'B', 'C'].map(item =>
                                        <React.Fragment key={item}>
                                            {headCell(`${item}ランク`, item, `${periodLabel}の反響のうち${item}ランクの数`)}
                                        </React.Fragment>
                                    )}
                                    {headCell('総予算', 'totalBudget')}
                                    {headCell('反響単価', 'registerBudget')}
                                    {headCell('接触単価', 'contactBudget')}
                                    {headCell('申込単価', 'applicationBudget')}
                                    {headCell('契約単価', 'contractBudget')}
                                </tr>
                                {sorted.map((item, index) => {
                                    const {
                                        value, totalValue, contactValue, interviewValue, applicationValue,
                                        contractValue, perContact, perContract, staffValue,
                                        rankSValue, rankAValue, rankBValue, rankCValue, totalBudget,
                                        registerUnit, contactUnit, applicationUnit, contractUnit,
                                    } = item;

                                    /** ⚠️ 分母が0のときは '-'。0円と書くと「無料で取れた」と読める */
                                    const yen = (v: number | null) => v === null ? '-' : `¥${v.toLocaleString()}`;

                                    return (
                                        <tr key={value.id ?? `shop-${index}`}>
                                            <td className='sticky-column' style={{ textAlign: 'center' }}>{value.shop}</td>
                                            <td style={{ textAlign: 'center' }}>{staffValue}</td>
                                            <td style={{ textAlign: 'center' }}>{totalValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perContact}%</td>
                                            <td style={{ textAlign: 'center' }}>{contactValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{interviewValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{applicationValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{perContract}%</td>
                                            <td style={{ textAlign: 'center' }}>{contractValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankSValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankAValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankBValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{rankCValue.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>{`¥${totalBudget.toLocaleString()}`}</td>
                                            <td style={{ textAlign: 'center' }}>{yen(registerUnit)}</td>
                                            <td style={{ textAlign: 'center' }}>{yen(contactUnit)}</td>
                                            <td style={{ textAlign: 'center' }}>{yen(applicationUnit)}</td>
                                            <td style={{ textAlign: 'center' }}>{yen(contractUnit)}</td>
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

export default ShopKaeru
