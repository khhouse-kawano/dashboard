import React, { useEffect, useMemo, useState, useContext } from 'react';
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
// ⚠️ 見た目は customer/ と shop/ の4画面で共通（components/rankingUi.tsx）
import { RankingStyle, SortIcon } from '../rankingUi';

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

    /** 見出しの期間表示。⚠️ ツールチップの文言に使う */
    const periodLabel = `${startMonth === '' ? '' : `${startMonth}から`}${endMonth === '' ? '' : `${endMonth}まで`}${startMonth !== '' && endMonth !== '' ? '' : '全期間'}`;

    /**
     * 見出しのセル。
     *
     * ⚠️⚠️ **2026-09-22 に SaaS 風の見た目へ作り替えた**（指示）。
     *   ⚠️ 並べ替えは ⚠️ **見出しそのものを押す**形にした（▲▼の小さな矢印をやめた）。
     *   ⚠️ ⚠️ **押すたびに 降順 → 昇順 → 降順 … と入れ替わる。**
     *   ⚠️ 並べ替えのキーと計算は ⚠️ **1行も変えていない**（`sorted` を参照）。
     *
     * ⚠️ `plain` のときは並べ替えない（販促媒体名の列）。
     */
    const headCell = (label: string, key: string, tip?: string, plain?: boolean) => {
        const active = sortKey === key && !plain;
        return (
            <th
                key={key || label}
                className={`rk_th${plain ? ' rk_th_name' : ' rk_th_sort'}`}
                onClick={plain ? undefined : () => changeSort(active && sortOrder === 'desc' ? 'asc' : 'desc', key)}
            >
                {tip ? (
                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip id={`tooltip-${key}`} style={{ fontSize: '12px' }}>{tip}</Tooltip>}
                    >
                        <span style={{ textDecoration: 'underline dotted' }}>{label}</span>
                    </OverlayTrigger>
                ) : label}
                {!plain && <SortIcon active={active} order={sortOrder} />}
            </th>
        );
    };

    /** 単価の表示。⚠️ 分母が0なら '-'（0円と書くと「無料で取れた」と読める） */
    const unitText = (budget: number, count: number) =>
        isFinite(budget / count) ? `¥${Math.round(budget / count).toLocaleString()}` : '-';

    /**
     * 画面上部のまとめ。
     * ⚠️ 媒体ごとの行を足すのではなく、⚠️ **「総反響」の行をそのまま出す。**
     *   ⚠️ ⚠️ **足し算だと、どの行にも乗らない顧客が抜ける。**
     */
    const summary = useMemo(() => {
        const total = aggregated.find(a => a.value.medium === '総反響');
        return {
            total: total?.totalValue ?? 0,
            reserve: total?.reserveValue ?? 0,
            appointment: total?.appointmentValue ?? 0,
            contract: total?.contractValue ?? 0,
            budget: total?.totalBudget ?? 0,
        };
    }, [aggregated]);

    return (
        <div className='content customer bg-white'>
            <RankingStyle />
            <div className="rk_wrap">
                <div className="rk_head">
                    <span className="rk_title">販促媒体別 反響・歩留まり（注文事業）</span>
                    <span className="rk_note">※来場数・契約数は"反響日"起算となります。</span>
                </div>

                <div className="rk_kpi">
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">総反響</div>
                        <div className="rk_kpi_value">{summary.total.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">来場</div>
                        <div className="rk_kpi_value">{summary.reserve.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">次アポ</div>
                        <div className="rk_kpi_value">{summary.appointment.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">契約</div>
                        <div className="rk_kpi_value">{summary.contract.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">広告費</div>
                        <div className="rk_kpi_value">¥{summary.budget.toLocaleString()}</div>
                        {/* ⚠️ 反響単価。⚠️ 分母が0なら '-'（0円と書くと「無料で取れた」と読める） */}
                        <div className="rk_kpi_sub">反響単価 {unitText(summary.budget, summary.total)}</div>
                    </div>
                </div>

                <div className="rk_bar">
                    <div className="rk_field">
                        <span className="rk_label">開始月</span>
                        <select className="rk_select" value={startMonth}
                            onChange={(event) => handleSort(event.target.value, endMonth, selectedShop, selectedSection, selectedArea)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <span className="rk_tilde">～</span>
                    <div className="rk_field">
                        <span className="rk_label">終了月</span>
                        <select className="rk_select" value={endMonth}
                            onChange={(event) => handleSort(startMonth, event.target.value, selectedShop, selectedSection, selectedArea)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    {/* ⚠️ 店舗・課・エリアは**どれか1つだけ**が効く（他は空にする）。
                           ⚠️ 2つ同時に絞ると必ず0件になる */}
                    <div className="rk_field">
                        <span className="rk_label">店舗</span>
                        <select className="rk_select" value={selectedShop}
                            onChange={(event) => handleSort(startMonth, endMonth, event.target.value, '', '')}>
                            <option value="">グループ全体</option>
                            {shopArray.map((item, index) => (
                                <option key={index} value={item.shop}>{item.shop}</option>
                            ))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">営業課</span>
                        <select className="rk_select" value={selectedSection}
                            onChange={(event) => handleSort(startMonth, endMonth, '', event.target.value, '')}>
                            <option value="">注文営業全体</option>
                            {sectionList.map((section, index) =>
                                <option value={section.name} key={index}>{section.name}</option>
                            )}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">エリア</span>
                        <select className="rk_select" value={selectedArea}
                            onChange={(event) => handleSort(startMonth, endMonth, '', '', event.target.value)}>
                            <option value="">全エリア</option>
                            <option value="鹿児島県">鹿児島県</option>
                            <option value="宮崎県">宮崎県</option>
                            <option value="大分県">大分県</option>
                            <option value="熊本県">熊本県</option>
                            <option value="佐賀県">佐賀県</option>
                        </select>
                    </div>
                    <div className="rk_spacer" />
                    {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す。
                           媒体数で全画面/xl が切り替わる（UnitPriceGraphModal.tsx） */}
                    <button className="rk_btn" onClick={() => setShowGraph(true)}>グラフを表示</button>
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

                <div className="rk_table_wrap">
                    <table className="rk_table">
                        <thead>
                            <tr>
                                {headCell('販促媒体名', '', '', true)}
                                {headCell('総反響', 'total', `${periodLabel}の総反響数`)}
                                {/* ⚠️⚠️ **列は「数 → 率」の順。** shop/ShopOrder.tsx と揃えてある
                                       （2026-09-14 に「率 → 数」から入れ替えた）。
                                       ⚠️ 片方だけ直すと画面ごとに並びが違って読み違える */}
                                {headCell('来場数', 'reserve', `${periodLabel}の反響のうち来場した方の数`)}
                                {headCell('来場率', 'perReserve', '来場者数/総反響数')}
                                {headCell('次アポ数', 'appointment', `${periodLabel}の反響のうち次回アポイントまで進んだ方の数`)}
                                {headCell('次アポ率', 'perAppointment', '次アポ数/来場者数')}
                                {headCell('契約数', 'contract', `${periodLabel}の反響のうち契約した方の数`)}
                                {headCell('契約率', 'perContract', '契約者数/来場者数')}
                                {['S', 'A', 'B', 'C'].map(item =>
                                    <React.Fragment key={item}>
                                        {headCell(`${item}ランク`, item, `${periodLabel}の反響のうち${item}ランクの数`)}
                                    </React.Fragment>
                                )}
                                {headCell('総予算', 'totalBudget')}
                                {/* ⚠️ 単価はどれも「総予算 ÷ その工程の件数」。⚠️ **分母だけが変わる** */}
                                {headCell('反響単価', 'registerBudget', '総予算/総反響')}
                                {headCell('来場単価', 'reserveBudget', '総予算/来場数')}
                                {headCell('次アポ単価', 'appointmentBudget', '総予算/次アポ数')}
                                {headCell('契約単価', 'contractBudget', '総予算/契約数')}
                            </tr>
                        </thead>
                        <tbody>
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
                                    totalBudget,
                                } = item;

                                return (
                                    <tr className="rk_row" key={value.id ?? `medium-${index}`}>
                                        <td className="rk_td rk_td_name">{value.medium}</td>
                                        <td className="rk_td">{totalValue.toLocaleString()}</td>
                                        {/* ⚠️ 見出しと同じく「数 → 率」の順。入れ替えないこと */}
                                        <td className="rk_td">{reserveValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perReserve}%</td>
                                        <td className="rk_td">{appointmentValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perAppointment}%</td>
                                        <td className="rk_td">{contractValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perContract}%</td>
                                        <td className="rk_td">{rankSValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankAValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankBValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankCValue.toLocaleString()}</td>
                                        <td className="rk_td">{`¥${totalBudget.toLocaleString()}`}</td>
                                        <td className="rk_td">{unitText(totalBudget, totalValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, reserveValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, appointmentValue)}</td>
                                        <td className="rk_td">{unitText(totalBudget, contractValue)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default CustomerOrder;
