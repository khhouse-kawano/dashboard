import React, { useEffect, useState, useContext, useMemo } from 'react';
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
// ⚠️ グラフは UnitPriceGraphModal.tsx に移した。ここでは recharts を使わない
import UnitPriceGraphModal from './UnitPriceGraphModal';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import apiClient from '../../utils/apiClient';
import { sortShops } from '../header/useAmbassadorMaster';
import { UNIT_PRICE_SERIES_SPEC } from './unitPriceSeries';
// ⚠️ 見た目は customer/ と shop/ の4画面で共通（components/rankingUi.tsx）
import { RankingStyle, SortIcon } from '../rankingUi';
// ⚠️ 表記ゆれの対応表は customer/CustomerKaeru.tsx と共有する。**別に作らないこと**
import { normalizeMedium } from '../customer/customerKaeruUtils';

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

/**
 * 統計値（全店舗の合計）の行の名前。
 *
 * ⚠️⚠️ **2026-09-18 に「グループ全体」から変えた**（指示）。
 *   ⚠️ この画面は建売だけなので「グループ」では広すぎた。
 * ⚠️⚠️ **`filteredValue()` と `aggregated` がこの文字列で合計行を見分けている。**
 *   ⚠️ 直書きに戻すと、片方だけ直したときに**合計行が店舗名として扱われて0件になる。**
 * ⚠️ 店舗を選ぶセレクトの「全店舗」とは**別物**。あちらは絞り込みの解除である。
 */
const TOTAL_ROW = '建売営業全体';

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
                /**
                 * ⚠️⚠️ **必ず `normalizeMedium()` を通してから比べる**（2026-09-18 の指示）。
                 *   ⚠️ 顧客側は `ネット` / `athome` / `ALLGRIT` のように**別名で入っている。**
                 *   ⚠️ 素の比較だと「Web検索」を選んでも ⚠️ **214件しか拾えなかった**
                 *     （⚠️ 寄せると **5,129件**。`ネット` の 4,892件が漏れていた）。
                 *   ⚠️ 対応表は customer/customerKaeruUtils.ts。**片方だけ直さないこと。**
                 */
                (!selectedMedium || normalizeMedium(item.medium) === normalizeMedium(selectedMedium))
            );
        });
    }, [originalList, shopArray, startMonth, endMonth, selectedShop, selectedSection, selectedMedium]);

    const filteredBudgets = useMemo(() => {
        if (!originalBudgetList.length) return [];

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
                /**
                 * ⚠️⚠️ **販促費も販促媒体で絞る**（2026-09-18 の指示）。
                 *   ⚠️ 2026-09-18 まで**ここだけ絞っていなかった。**
                 *     ⚠️ 顧客は「Web検索」だけになるのに販促費は**全額**乗っていたため、
                 *       ⚠️ **単価が実態よりはるかに高く出ていた**
                 *       （実測: ¥281,556,856 → **¥99,576,458**）。
                 *   ⚠️ 顧客側と**同じ `normalizeMedium()`** を通すこと。
                 *     ⚠️ 揃えないと分子と分母が別の媒体になる。
                 */
                (!selectedMedium || normalizeMedium(item.medium) === normalizeMedium(selectedMedium))
            );
        });
    }, [originalBudgetList, startMonth, endMonth, selectedShop, selectedSection, selectedMedium]);

    useEffect(() => {
        /**
         * ⚠️ 店舗を 事業区分 → ブランド → id の順に並べる（sortShops）。
         *   ⚠️ 合計行（TOTAL_ROW）は sortShops に混ぜない。division が空で
         *     末尾に回されるため、先に並べてから先頭に付ける。
         */
        const sortedShops = sortShops(originalShopArray as never) as unknown as Shop[];

        const filteredShop = sortedShops.filter(item =>
            (!selectedShop || item.shop.includes(selectedShop)) &&
            (!selectedSection || item.section === selectedSection)
        );

        // ⚠️ 絞り込み中は合計行を出さない。一部だけの合計をそう呼ぶと誤読される
        const withTotal = (!selectedShop && !selectedSection)
            ? [{ id: 0, brand: '', shop: TOTAL_ROW, section: '', area: '' }, ...filteredShop]
            : filteredShop;

        setShopArray(withTotal);
    }, [originalShopArray, selectedShop, selectedSection]);

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
        const matchShop = (c: Customer) => shopValue !== TOTAL_ROW ? c.shop === shopValue : true;
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
            const isTotalRow = value.shop === TOTAL_ROW;

            const totalValue = filteredValue(value.shop, '', '');
            const contactValue = filteredValue(value.shop, 'contact', '');
            const interviewValue = filteredValue(value.shop, 'interview', '');
            const applicationValue = filteredValue(value.shop, 'application', '');
            const contractValue = filteredValue(value.shop, 'contract', '');

            /**
             * 歩留まり。
             *
             * ─────────────────────────────────────────────
             * ⚠️⚠️ **分母は「ひとつ左の工程」**（2026-09-18 の指示）。
             *   ⚠️ customer/CustomerKaeru.tsx と**同じ考え方に揃えた。**
             *
             * ⚠️⚠️ **契約率の分母が変わった。** 2026-09-18 まで**接触数**だった。
             *   ⚠️ 実測（グループ全体）で **10% → 57%** になる。⚠️ **不具合ではない。**
             *   ⚠️ 同じ「契約率」が画面によって違う数字を指していたのを解消したもの。
             *
             * ⚠️ 分母が0なら0%。⚠️ `Infinity` や `NaN` を画面に出さない。
             * ⚠️ ⚠️ **来場率・申込率の列はこの画面には足していない**（指示は契約率のみ）。
             *   ⚠️ 足すときは CustomerKaeru.tsx の並びに合わせること。
             * ─────────────────────────────────────────────
             */
            const rate = (numerator: number, denominator: number): number =>
                denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

            const perContact = rate(contactValue, totalValue);
            const perContract = rate(contractValue, applicationValue);

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
     * ⚠️ X軸は店舗。**先頭が合計行（TOTAL_ROW）**になるよう shopArray の並びをそのまま使う。
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

    /**
     * 絞り込みをまとめて差し替える。
     * ⚠️ エリアは 2026-09-18 に廃止した（`selectedArea` ごと削除）。
     *   ⚠️ 引数を減らしてあるので、呼び出し側の第6引数を消し忘れないこと。
     */
    const handleSort = (start: string, end: string, medium: string, shop: string, section: string) => {
        setStartMonth(start);
        setEndMonth(end);
        setSelectedMedium(medium);
        setSelectedShop(shop);
        setSelectedSection(section);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order);
    };

    /** 期間の説明。ツールチップで使い回す */
    const periodLabel = `${startMonth === '' ? '' : `${startMonth}から`}${endMonth === '' ? '' : `${endMonth}まで`}${startMonth !== '' || endMonth !== '' ? '' : '全期間'}`;

    /**
     * 見出しのセル。
     *
     * ⚠️⚠️ **2026-09-22 に SaaS 風の見た目へ作り替えた**（指示）。
     *   ⚠️ 並べ替えは ⚠️ **見出しそのものを押す**形にした（▲▼の小さな矢印をやめた）。
     *   ⚠️ ⚠️ **押すたびに 降順 → 昇順 → 降順 … と入れ替わる。**
     *   ⚠️ 並べ替えのキーと計算は ⚠️ **1行も変えていない**（`sorted` を参照）。
     *
     * ⚠️ `plain` のときは並べ替えない（店舗名・営業人数の列）。
     */
    const headCell = (label: string, key: string, tip?: string, plain?: boolean) => {
        const active = sortKey === key && !plain;
        return (
            <th
                key={key || label}
                className={`rk_th${key === '' ? ' rk_th_name' : plain ? '' : ' rk_th_sort'}`}
                onClick={plain ? undefined : () => changeSort(active && sortOrder === 'desc' ? 'asc' : 'desc', key)}
            >
                {tip ? (
                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip id={`tooltip-${key}`} style={{ fontSize: "12px" }}>{tip}</Tooltip>}>
                        <span style={{ textDecoration: 'underline dotted' }}>{label}</span>
                    </OverlayTrigger>
                ) : label}
                {!plain && <SortIcon active={active} order={sortOrder} />}
            </th>
        );
    };

    /**
     * 画面上部のまとめ。
     * ⚠️ 店舗ごとの行を足すのではなく、⚠️ **合計行（TOTAL_ROW）をそのまま出す。**
     *   ⚠️ ⚠️ **足し算だと、どの店舗にも紐づかない顧客が抜ける。**
     *   ⚠️⚠️ **`sorted[0]` で取らないこと。** ⚠️ 並べ替えると合計行も動く。
     */
    const summary = useMemo(() => {
        const head = aggregated.find(a => a.value.shop === TOTAL_ROW);
        return {
            total: head?.totalValue ?? 0,
            contact: head?.contactValue ?? 0,
            interview: head?.interviewValue ?? 0,
            application: head?.applicationValue ?? 0,
            contract: head?.contractValue ?? 0,
            budget: head?.totalBudget ?? 0,
            registerUnit: head?.registerUnit ?? null,
        };
    }, [aggregated]);

    return (
        <div className='content customer bg-white'>
            <RankingStyle />
            <div className="rk_wrap">
                <div className="rk_head">
                    <span className="rk_title">店舗別 反響・歩留まり（建売分譲事業）</span>
                    <span className="rk_note">※接触数・契約数は"反響日"起算となります。</span>
                </div>

                <div className="rk_kpi">
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">総反響</div>
                        <div className="rk_kpi_value">{summary.total.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">接触</div>
                        <div className="rk_kpi_value">{summary.contact.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">来場・案内</div>
                        <div className="rk_kpi_value">{summary.interview.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">申込</div>
                        <div className="rk_kpi_value">{summary.application.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">契約</div>
                        <div className="rk_kpi_value">{summary.contract.toLocaleString()}</div>
                    </div>
                    <div className="rk_kpi_card">
                        <div className="rk_kpi_label">広告費</div>
                        <div className="rk_kpi_value">¥{summary.budget.toLocaleString()}</div>
                        {/* ⚠️ 分母が0のときは '-'。0円と書くと「無料で取れた」と読める */}
                        <div className="rk_kpi_sub">
                            反響単価 {summary.registerUnit === null ? '-' : `¥${summary.registerUnit.toLocaleString()}`}
                        </div>
                    </div>
                </div>

                <div className="rk_bar">
                    <div className="rk_field">
                        <span className="rk_label">開始月</span>
                        <select className="rk_select" value={startMonth}
                            onChange={(event) => handleSort(event.target.value, endMonth, selectedMedium, selectedShop, selectedSection)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <span className="rk_tilde">～</span>
                    <div className="rk_field">
                        <span className="rk_label">終了月</span>
                        <select className="rk_select" value={endMonth}
                            onChange={(event) => handleSort(startMonth, event.target.value, selectedMedium, selectedShop, selectedSection)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">販促媒体</span>
                        <select className="rk_select" value={selectedMedium}
                            onChange={(event) => handleSort(startMonth, endMonth, event.target.value, selectedShop, selectedSection)}>
                            <option value="">全販促媒体</option>
                            {/**
                              * ⚠️⚠️ **選択肢も表記を寄せて重複を落とす**（2026-09-18）。
                              *   ⚠️ `medium_kaeru` には `Facebook`（→ Instagram）や
                              *     `ネット広告`（→ Web検索）が別の行として入っている。
                              *   ⚠️ 寄せないと ⚠️ **同じ中身の選択肢が2つ並ぶ。**
                              */}
                            {[...new Set(mediumArray.map(item => normalizeMedium(item.medium)))].map((medium, index) =>
                                <option key={index} value={medium}>{medium}</option>
                            )}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">店舗</span>
                        <select className="rk_select" value={selectedShop}
                            onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, event.target.value, '')}>
                            <option value="">全店舗</option>
                            {originalShopArray.map((item, index) => (
                                <option key={index} value={item.shop}>{item.shop}</option>
                            ))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">営業課</span>
                        <select className="rk_select" value={selectedSection}
                            onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, '', event.target.value)}>
                            <option value="">全課</option>
                            {sectionList.map((section, index) =>
                                <option value={section.name} key={index}>{section.name}</option>
                            )}
                        </select>
                    </div>
                    <div className="rk_spacer" />
                    {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す。
                           店舗数で全画面/xl が切り替わる（UnitPriceGraphModal.tsx） */}
                    {/* ⚠️ 「併売店をまとめる」は置かない。建売に併売店の概念は無い */}
                    <button className="rk_btn" onClick={() => setShowGraph(true)}>グラフを表示</button>
                </div>

                <UnitPriceGraphModal
                    show={showGraph}
                    onHide={() => setShowGraph(false)}
                    data={graphData}
                    series={UNIT_PRICE_SERIES_SPEC}
                    title='建売分譲事業'
                />

                <div className="rk_table_wrap">
                    <table className="rk_table">
                        <thead>
                            <tr>
                                {headCell('店舗名', '', '', true)}
                                {headCell('営業人数', 'staffCount', '', true)}
                                {headCell('総反響', 'total', `${periodLabel}の総反響数`)}
                                {headCell('接触率', 'perContact', '接触数/総反響数')}
                                {headCell('接触数', 'contact', `${periodLabel}の反響のうち接触した方の数（以降の工程に進んだ方を含む）`)}
                                {headCell('来場・案内', 'interview', '来場または物件案内があった方の数（以降の工程に進んだ方を含む）')}
                                {headCell('申込数', 'application', '申し込みに至った方の数（契約者を含む）')}
                                {/* ⚠️⚠️ **分母が「申込」に変わった**（2026-09-18）。
                                       ⚠️ customer/CustomerKaeru.tsx と揃えてある */}
                                {headCell('契約率', 'perContract', '契約/申込')}
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
                        </thead>
                        <tbody>
                            {sorted.map((item, index) => {
                                const {
                                    value, totalValue, contactValue, interviewValue, applicationValue,
                                    contractValue, perContact, perContract, staffValue,
                                    rankSValue, rankAValue, rankBValue, rankCValue, totalBudget,
                                    registerUnit, contactUnit, applicationUnit, contractUnit,
                                } = item;

                                /** ⚠️ 分母が0のときは '-'。0円と書くと「無料で取れた」と読める */
                                const yen = (v: number | null) => v === null ? '-' : `¥${v.toLocaleString()}`;

                                /**
                                 * ⚠️ 合計行は背景を変えて店舗と見分ける。
                                 *   ⚠️⚠️ **`index === 0` で判定しないこと。**
                                 *     ⚠️ ⚠️ **並べ替えると合計行も動く**（`sorted` は全行を並べ替える）。
                                 */
                                const isTotalRow = value.shop === TOTAL_ROW;

                                return (
                                    <tr className={`rk_row${isTotalRow ? ' rk_row_total' : ''}`} key={value.id ?? `shop-${index}`}>
                                        <td className="rk_td rk_td_name">{value.shop}</td>
                                        <td className="rk_td">{staffValue}</td>
                                        <td className="rk_td">{totalValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perContact}%</td>
                                        <td className="rk_td">{contactValue.toLocaleString()}</td>
                                        <td className="rk_td">{interviewValue.toLocaleString()}</td>
                                        <td className="rk_td">{applicationValue.toLocaleString()}</td>
                                        <td className="rk_td rk_rate">{perContract}%</td>
                                        <td className="rk_td">{contractValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankSValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankAValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankBValue.toLocaleString()}</td>
                                        <td className="rk_td">{rankCValue.toLocaleString()}</td>
                                        <td className="rk_td">{`¥${totalBudget.toLocaleString()}`}</td>
                                        <td className="rk_td">{yen(registerUnit)}</td>
                                        <td className="rk_td">{yen(contactUnit)}</td>
                                        <td className="rk_td">{yen(applicationUnit)}</td>
                                        <td className="rk_td">{yen(contractUnit)}</td>
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

export default ShopKaeru
