import React, { useEffect, useMemo, useState, useContext } from 'react';
import Table from "react-bootstrap/Table";
import '../chartConfig';
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import Category from '../Category';
import apiClient from '../../utils/apiClient';
// ⚠️ グラフとその系列は shop/ と共有する。X軸が店舗名か販促媒体名かだけが違う
import UnitPriceGraphModal from '../shop/UnitPriceGraphModal';
import { UNIT_PRICE_SERIES_SPEC } from '../shop/unitPriceSeries';

/**
 * 販促媒体別ランキング（建売分譲事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **shop/ShopKaeru.tsx を踏襲している**（2026-09-14 の指示）。
 *   違いは**行が店舗か販促媒体か**だけで、KPI も列の並びも同じにしてある。
 *   ⚠️ **片方を直したら必ず両方直すこと。**
 *
 * ⚠️⚠️ **2026-09-14 に KPI を建売のものへ直した。以前とは数字が変わる。**
 *   それまで中身は CustomerOrder.tsx とほぼ同じで、**注文事業の判定**
 *   （総反響 → 来場 → 契約／契約に「解約」を含む）を使っていた。
 *   ⚠️ 建売は 総反響 → 接触 → 来場・案内 → 申込み → 契約 で、
 *     契約は `status === '契約済み'` のみである。
 *
 *   ⚠️⚠️ **旧版は「申込み」の列を契約として数えていた。**
 *     建売の 01J82Z5F1RR18Z792C7KZS88QG は `application`（申込み）であり、
 *     契約は 01JP74NGRTT95X4Z8AQZ2QK2PW（＋仲介 01JV6AVXQMJY6XR4STWCHNKVE0）。
 *     ⚠️ 実測（2026-09-14 / show_dashboard = 1 の 8,321 件）で
 *       旧 435 件 → 新 **473 件**。**増える**。
 *       申込み日が空でも契約日が入っている顧客がいるためで、
 *       解約を除いた効果より、契約列を正しく見た効果のほうが大きい。
 *     ⚠️ ShopKaeru や CustomerTrendKaeru とはこれで一致する。
 *
 * ⚠️⚠️ **販促媒体が1つも表示されていなかった問題も直した。**
 *   `response.data.medium.filter(m => m.list_medium === 1)` としていたが、
 *   建売が受け取るのは `medium_kaeru` で、**`list_medium` 列が存在しない。**
 *   `undefined === 1` は常に false になり、表は「総反響」1行だけだった。
 *   ⚠️ エラーは出ないので気づきにくい壊れ方である。
 * ─────────────────────────────────────────────
 */

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
type Shop = { id: number; brand: string; shop: string; section: string; area: string; }
type Medium = { id: number; medium: string }
type Section = { no: number, name: string }

const CustomerKaeru = () => {
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
                // ⚠️⚠️ **絞らないこと。** medium_kaeru に `list_medium` 列は無く、
                //   以前の `filter(m => m.list_medium === 1)` は**常に空**になっていた。
                //   ⚠️ ShopTrendKaeru.tsx と同じく全件をそのまま行にする（指示）
                await setMediumArray(response.data.medium);
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
         *   2026-09-14 まで末尾だった。shop/ShopKaeru.tsx の「グループ全体」に
         *   揃えてある。⚠️ グラフのX軸も同じ並びになるので、表と突き合わせられる。
         */
        return [{ id: 0, medium: '総反響' }, ...mediumArray].map(value => {
            const base = filteredCustomers.filter(
                c => value.medium === '総反響' || c.medium === value.medium
            );

            /**
             * ⚠️⚠️ **判定は shop/ShopKaeru.tsx の `filteredValue()` と同じもの。**
             *
             * ⚠️ **上位の工程に進んだ人は、下位の工程も達成したものとして数える。**
             *   接触日が空でも契約済みなら「接触した」はずである。
             *   日付の入力漏れで歩留まりが逆転する（契約数 > 申込数 など）のを防ぐ。
             *
             * ⚠️ `tour`（物件案内）は来場と同じ段階として扱う。
             * ⚠️ `contract_broker`（仲介契約）も契約に含める。
             * ⚠️ 契約は `status === '契約済み'` のみ。**解約を含めない**
             *   （注文事業とはここが違う）。
             */
            const isContract = (b: Customer) => (b.contract || b.contract_broker) && b.status === '契約済み';
            const isApplication = (b: Customer) => b.application || isContract(b);
            const isInterview = (b: Customer) => b.interview || b.tour || isApplication(b);
            const isContact = (b: Customer) => b.contact || isInterview(b);

            const totalValue = base.length;
            const contactValue = base.filter(isContact).length;
            const interviewValue = base.filter(isInterview).length;
            const applicationValue = base.filter(isApplication).length;
            const contractValue = base.filter(isContract).length;

            const perContact = isNaN(contactValue / totalValue) ? 0 : Math.round((contactValue / totalValue) * 100);
            // ⚠️ 契約率の分母は**接触数**（ShopKaeru.tsx と同じ）
            const perContract = isNaN(contractValue / contactValue) ? 0 : Math.round((contractValue / contactValue) * 100);

            /**
             * ランク別。
             * ⚠️⚠️ **status で絞らない。** 注文は `status === '見込み'` で絞るが、
             *   建売は `show_dashboard = 1` のものを**すべて見込みとして扱う**
             *   運用である（ShopKaeru.tsx / Company.tsx と同じ）。
             */
            const rankSValue = base.filter(item => item.rank === 'Sランク').length;
            const rankAValue = base.filter(item => item.rank === 'Aランク').length;
            const rankBValue = base.filter(item => item.rank === 'Bランク').length;
            const rankCValue = base.filter(item => item.rank === 'Cランク').length;

            const totalBudget = filteredBudgets
                .filter(item => value.medium === '総反響' || item.medium === value.medium)
                .reduce((acc, cur) => acc + cur.budget_value, 0);

            return {
                value,
                totalValue,
                contactValue,
                interviewValue,
                applicationValue,
                contractValue,
                perContact,
                perContract,
                rankSValue,
                rankAValue,
                rankBValue,
                rankCValue,
                totalBudget,
                // ⚠️ キー名は shop/unitPriceSeries.ts の UNIT_PRICE_SERIES_SPEC と一致させること
                registerUnit: unitPrice(totalBudget, totalValue),
                contactUnit: unitPrice(totalBudget, contactValue),
                applicationUnit: unitPrice(totalBudget, applicationValue),
                contractUnit: unitPrice(totalBudget, contractValue),
            };
        });
    }, [mediumArray, filteredCustomers, filteredBudgets]);

    /**
     * 単価グラフのデータ。
     * ⚠️ X軸は**販促媒体**。先頭が「総反響」になるよう aggregated の並びをそのまま使う。
     * ⚠️ 非表示のときは作らない。
     */
    const graphData = useMemo(() => {
        if (!showGraph) return [];
        return aggregated.map(item => ({
            medium: item.value.medium,
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
            const getKey = (x) => {
                switch (sortKey) {
                    // ⚠️ キーは shop/ShopKaeru.tsx と揃えてある（建売のKPI）
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
                    case 'registerBudget':
                        return isFinite(x.totalBudget / x.totalValue) ? Math.round(x.totalBudget / x.totalValue) : 0;
                    case 'contactBudget':
                        return isFinite(x.totalBudget / x.contactValue) ? Math.round(x.totalBudget / x.contactValue) : 0;
                    case 'applicationBudget':
                        return isFinite(x.totalBudget / x.applicationValue) ? Math.round(x.totalBudget / x.applicationValue) : 0;
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

    /** 見出しの期間表示。⚠️ ツールチップの文言に使う */
    const periodLabel = `${startMonth === '' ? '' : `${startMonth}から`}${endMonth === '' ? '' : `${endMonth}まで`}${startMonth !== '' && endMonth !== '' ? '' : '全期間'}`;

    /**
     * 見出しのセル。
     * ⚠️ shop/ShopKaeru.tsx の headCell と同じ形にしてある。
     * ⚠️ `plain` のときは並べ替えの矢印を出さない（販促媒体名の列）。
     */
    const headCell = (label: string, key: string, tip?: string, plain?: boolean) => (
        <td
            className={plain ? 'sticky-column budget' : undefined}
            style={{ position: 'relative', textAlign: 'center' }}
        >
            {tip ? (
                <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip id={`tooltip-${key}`} style={{ fontSize: '12px' }}>{tip}</Tooltip>}
                >
                    <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>{label}</span>
                </OverlayTrigger>
            ) : label}
            {!plain && <>
                <span style={{ ...arrowStyle, top: '4px' }} onClick={() => changeSort('desc', key)}>▲</span>
                <span style={{ ...arrowStyle, top: '14px' }} onClick={() => changeSort('asc', key)}>▼</span>
            </>}
        </td>
    );

    /** 単価の表示。⚠️ 分母が0なら '-'（0円と書くと「無料で取れた」と読める） */
    const unitText = (budget: number, count: number) =>
        isFinite(budget / count) ? `¥${Math.round(budget / count).toLocaleString()}` : '-';

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
                        {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す */}
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
                    series={UNIT_PRICE_SERIES_SPEC}
                    title='建売分譲事業'
                    itemKey='medium'
                    itemLabel='販促媒体'
                />
                <div className="table-wrapper mt-3">
                    <div className="list_table">
                        <Table striped style={{ fontSize: '12px' }} bordered>
                            <tbody>
                                <tr className='sticky-header'>
                                    {/* ⚠️⚠️ 列の並びは shop/ShopKaeru.tsx と揃えてある。
                                           建売は「率 → 数」の順（注文の ShopOrder だけ「数 → 率」）。
                                           ⚠️ 片方だけ直すと画面ごとに並びが違って読み違える */}
                                    {headCell('販促媒体名', '', '', true)}
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
                                        value,
                                        totalValue,
                                        contactValue,
                                        interviewValue,
                                        applicationValue,
                                        contractValue,
                                        perContact,
                                        perContract,
                                        rankSValue,
                                        rankAValue,
                                        rankBValue,
                                        rankCValue,
                                        totalBudget,
                                    } = item;

                                    return (
                                        <tr key={value.id ?? `medium-${index}`}>
                                            <td className='sticky-column' style={{ textAlign: 'center' }}>{value.medium}</td>
                                            {/* ⚠️ 見出しと同じ並び。入れ替えないこと */}
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
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, totalValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, contactValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, applicationValue)}</td>
                                            <td style={{ textAlign: 'center' }}>{unitText(totalBudget, contractValue)}</td>
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

export default CustomerKaeru;
