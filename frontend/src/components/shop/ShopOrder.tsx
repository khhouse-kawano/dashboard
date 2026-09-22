import React, { useEffect, useState, useContext, useMemo } from 'react';
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
// ⚠️ グラフは UnitPriceGraphModal.tsx に移した。ここでは recharts を使わない
import UnitPriceGraphModal from './UnitPriceGraphModal';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import apiClient from '../../utils/apiClient';
import { sortShops } from '../header/useAmbassadorMaster';
import { UNIT_PRICE_SERIES } from './unitPriceSeries';
// ⚠️ 見た目は customer/ と shop/ の4画面で共通（components/rankingUi.tsx）
import { RankingStyle, SortIcon } from '../rankingUi';

type Customer = Record<string, string>;
type Budget = { id: number; medium: string; budget_period: string; shop: string; budget_value: number; note: string; company: string; response_medium: number; category: string; section: string; order_section: string }
/**
 * 店舗。
 * ⚠️ `id` / `division` は並び替え（sortShops）に使う。2026-09-11 に SQL へ追加した。
 * ⚠️ `multi` / `parent_shop` は「併売店をまとめる」にだけ使う。
 *   ⚠️ DB から文字列で来ることがあるため Number() で比べること。
 */
type Shop = { id: number; brand: string; shop: string; section: string; area: string; division?: string; multi?: number | string; parent_shop?: string | null; }
type Medium = { id: number; medium: string }
type Section = { no: number, name: string };
type Staff = { name: string; shop: string; rank: number };

const ShopOrder = () => {
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
    /**
     * 併売店をまとめるか。
     * ⚠️ 親店舗（shop_list.parent_shop）は**利用者が手作業で設定する**。
     *   1件も設定されていなければ、ONにしても表示・集計は一切変わらない。
     */
    const [showMulti, setShowMulti] = useState<boolean>(false);
    const now = new Date();
    const year = now.getFullYear();

    const thisYear = now.getMonth() <= 4 ? year : year + 1;

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));

        const fetchData = async () => {
            try {
                // ⚠️⚠️ 2026-09-11 まで axios で**本番URLを直書き**していた。
                //   ローカル開発からでも本番DBを読んでいた。apiClient を通すこと。
                const response = await apiClient.post("", { request: 'shop', category });
                await setOriginalList(response.data.customer);
                await setOriginalShopArray(response.data.shop.filter(s => !s.shop.includes('未設定') && !s.shop.includes('全店舗')));
                await setMediumArray(response.data.medium.filter(m => m.list_medium === 1));
                await setOriginalBudgetList(response.data.budget);
                await setSectionList(response.data.section);
                await setStaff(response.data.staff.filter(s => s.rank === 1 && s.period === String(thisYear)));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    /**
     * 親店舗名 → まとめ先に吸収する子店舗名の一覧。
     *
     * ⚠️⚠️ **親が注文事業の店舗一覧に居ない場合は対象外にする。**
     *   `shop_list` は事業をまたいで1つのテーブルなので、`parent_shop` に
     *   他事業の店舗名が入り得る。そのまま子を隠すと、**どの行にも合算されず
     *   数字が消える**（グループ全体だけ合わなくなり、気づきにくい）。
     */
    const multiChildren = useMemo(() => {
        const shopNames = new Set(originalShopArray.map(s => s.shop));
        const map = new Map<string, string[]>();
        originalShopArray.forEach(s => {
            const parent = s.parent_shop;
            if (Number(s.multi) !== 1 || !parent || !shopNames.has(parent) || parent === s.shop) return;
            const children = map.get(parent) ?? [];
            children.push(s.shop);
            map.set(parent, children);
        });
        return map;
    }, [originalShopArray]);

    /** まとめON時に行・選択肢から消える側（子店舗）の集合 */
    const mergedChildShops = useMemo(() => {
        const set = new Set<string>();
        multiChildren.forEach(children => children.forEach(child => set.add(child)));
        return set;
    }, [multiChildren]);

    /**
     * その店舗行が集計対象とする店舗名の一覧。
     * まとめOFF、または子を持たない店舗では `[shopName]` のままなので、
     * 既存のロジックは変わらない。
     */
    const shopNamesOf = (shopName: string): string[] =>
        showMulti ? [shopName, ...(multiChildren.get(shopName) ?? [])] : [shopName];

    /** その店舗を行・選択肢として表示してよいか */
    const isVisibleShop = (shopName: string): boolean => !(showMulti && mergedChildShops.has(shopName));

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
            /**
             * ⚠️ 店舗を**事業区分 → ブランド → id** の順に並べる（sortShops）。
             *   2026-09-11 まで SQL の返り順のままだった。
             *   ⚠️ 他の画面（担当店舗の select など）と並びを揃えるため。
             *   ⚠️ sortShops は division と id を見る。SQL に両方追加してある。
             *
             * ⚠️ 「グループ全体」は sortShops に混ぜない。division が空で
             *   末尾に回されるため、**先に並べてから先頭に付ける。**
             */
            const sortedShops = sortShops(originalShopArray as never) as unknown as Shop[];

            const filteredShop = sortedShops
                .filter(item =>
                    (!selectedShop || item.shop.includes(selectedShop)) &&
                    (!selectedSection || item.section === selectedSection) &&
                    (!selectedArea || item.area === selectedArea) &&
                    // ⚠️ まとめON時は子店舗の行を消す（親に合算されるため）
                    isVisibleShop(item.shop)
                );

            /**
             * ⚠️⚠️ **「グループ全体」は先頭に置く。**
             *   2026-09-11 まで末尾だった。グラフのX軸の先頭に置く指示があり、
             *   表とグラフで並びが違うと突き合わせられないため表も先頭にする。
             *   ⚠️ 絞り込み中は出さない（従来どおり）。一部だけの合計を
             *     「グループ全体」と呼ぶと誤読される。
             */
            const withTotal = (!selectedShop && !selectedSection && !selectedArea)
                ? [{ id: 0, brand: '', shop: 'グループ全体', section: '', area: '' }, ...filteredShop]
                : filteredShop;

            setShopArray(withTotal);
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [originalShopArray, originalList, startMonth, endMonth, selectedMedium, selectedShop, selectedSection, selectedArea, showMulti, multiChildren]);

    const filteredValue = (shopValue: string, category: string, rankValue: string) => {
        // ⚠️ まとめON かつ親店舗のときだけ2要素以上になる。それ以外は従来と同じ
        const targetShops = shopNamesOf(shopValue);
        const matchShop = (c: Customer) => shopValue !== 'グループ全体' ? targetShops.includes(c.shop) : true;

        const base = filteredCustomers.filter(matchShop);
        if (category === 'reserve') {
            return base.filter(b => b.interview || b.appointment || b.screening || b.contract).length;
        }
        /**
         * 次アポ数。
         *
         * ─────────────────────────────────────────────
         * ⚠️⚠️ **shopTrend/ShopTrendOrder.tsx の分岐はここでは不要である。**
         *   あちらは
         *     b.interview ? （interview の月で数える）
         *                 : （appointment/screening/contract の月で数える）
         *   という**「どの月に数えるか」**の分岐であり、
         *   条件の中身はどちらも `(appointment || screening || contract)` である。
         *
         *   ⚠️ この画面は月で切らず**期間合計**なので、分岐しても結果は同じ。
         *     そのまま移すと読み手に「月判定がある」と誤解させるため、
         *     期間合計の形に落としてある。
         * ─────────────────────────────────────────────
         */
        if (category === 'appointment') {
            return base.filter(b => b.appointment || b.screening || b.contract).length;
        }
        if (category === 'contract') {
            return base.filter(b => b.contract && (b.status === '契約済み' || b.status === '解約')).length;
        }
        if (rankValue) {
            return base.filter(b => b.rank === rankValue && b.status === '見込み').length;
        }
        return filteredCustomers.filter(c => matchShop(c)
            && (category ? c[category] !== '' : true)
            && (rankValue ? (c.rank === rankValue && c.contract === '') : true)).length
    };

    /** 単価。⚠️ 分母が0や未定義なら null（表では '-'、グラフでは 0） */
    const unitPrice = (budget: number, count: number): number | null =>
        isFinite(budget / count) ? Math.round(budget / count) : null;

    const aggregated = useMemo(() => {
        return shopArray.map(value => {
            // ⚠️ まとめON かつ親店舗のときだけ2要素以上になる
            const targetShops = shopNamesOf(value.shop);
            const isTotalRow = value.shop === 'グループ全体';

            const totalValue = filteredValue(value.shop, '', '');
            const reserveValue = filteredValue(value.shop, 'reserve', '');
            const appointmentValue = filteredValue(value.shop, 'appointment', '');
            const contractValue = filteredValue(value.shop, 'contract', '');
            const perReserve = isNaN(reserveValue / totalValue) ? 0 : Math.round((reserveValue / totalValue) * 100);
            // ⚠️ 次アポ率の分母は**来場数**。総反響ではない（歩留まりを1段ずつ見るため）
            const perAppointment = isNaN(appointmentValue / reserveValue) ? 0 : Math.round((appointmentValue / reserveValue) * 100);
            const perContract = isNaN(contractValue / reserveValue) ? 0 : Math.round((contractValue / reserveValue) * 100);
            /**
             * ⚠️⚠️ **広告費も子店舗の分を足す。**
             *   顧客だけ親に寄せて販促費を親の分だけにすると、
             *   各単価が**実際より安く**出る。
             */
            const totalBudget = filteredBudgets
                .filter(item => isTotalRow || targetShops.includes(item.shop))
                .reduce((acc, cur) => acc + cur.budget_value, 0);
            const staffValue = staff.filter(s => isTotalRow || targetShops.includes(s.shop)).length;
            const rankSValue = filteredValue(value.shop, '', 'Sランク').toLocaleString();
            const rankAValue = filteredValue(value.shop, '', 'Aランク').toLocaleString();
            const rankBValue = filteredValue(value.shop, '', 'Bランク').toLocaleString();
            const rankCValue = filteredValue(value.shop, '', 'Cランク').toLocaleString();

            return {
                value,
                totalValue,
                reserveValue,
                appointmentValue,
                contractValue,
                perReserve,
                perAppointment,
                perContract,
                staffValue,
                rankSValue,
                rankAValue,
                rankBValue,
                rankCValue,
                totalBudget,
                // ⚠️ キー名は unitPriceSeries.ts の key と一致させること
                registerUnit: unitPrice(totalBudget, totalValue),
                reserveUnit: unitPrice(totalBudget, reserveValue),
                appointmentUnit: unitPrice(totalBudget, appointmentValue),
                contractUnit: unitPrice(totalBudget, contractValue),
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopArray, filteredCustomers, filteredBudgets, staff, showMulti, multiChildren]);

    /**
     * 単価グラフのデータ。
     * ⚠️ X軸は店舗。**先頭が「グループ全体」**になるよう shopArray の並びをそのまま使う。
     * ⚠️ 非表示のときは作らない（店舗数×4系列で無駄になるため）。
     */
    const graphData = useMemo(() => {
        if (!showGraph) return [];
        return aggregated.map(item => ({
            shop: item.value.shop,
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
                    case 'perContract': return x.perContract;
                    case 'contract': return x.contractValue;
                    case 'S': return x.rankAValue;
                    case 'A': return x.rankAValue;
                    case 'B': return x.rankBValue;
                    case 'C': return x.rankCValue;
                    case 'appointment': return x.appointmentValue;
                    case 'totalBudget': return x.totalBudget;
                    // ⚠️ 単価は aggregated で計算済み。null（分母0）は 0 として並べる
                    case 'registerBudget': return x.registerUnit ?? 0;
                    case 'reserveBudget': return x.reserveUnit ?? 0;
                    case 'appointmentBudget': return x.appointmentUnit ?? 0;
                    case 'contractBudget': return x.contractUnit ?? 0;
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
     * ⚠️ 店舗ごとの行を足すのではなく、⚠️ **合計行（グループ全体）をそのまま出す。**
     *   ⚠️ ⚠️ **足し算だと、どの店舗にも紐づかない顧客が抜ける。**
     *   ⚠️⚠️ **`sorted[0]` で取らないこと。** ⚠️ 並べ替えると合計行も動く。
     */
    const summary = useMemo(() => {
        const head = aggregated.find(a => a.value.shop === 'グループ全体');
        return {
            total: head?.totalValue ?? 0,
            reserve: head?.reserveValue ?? 0,
            appointment: head?.appointmentValue ?? 0,
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
                    <span className="rk_title">店舗別 反響・歩留まり（注文事業）</span>
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
                            onChange={(event) => handleSort(event.target.value, endMonth, selectedMedium, selectedShop, selectedSection, selectedArea)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <span className="rk_tilde">～</span>
                    <div className="rk_field">
                        <span className="rk_label">終了月</span>
                        <select className="rk_select" value={endMonth}
                            onChange={(event) => handleSort(startMonth, event.target.value, selectedMedium, selectedShop, selectedSection, selectedArea)}>
                            <option value="">指定なし</option>
                            {monthArray.map((month, index) => (<option key={index} value={month}>{month}</option>))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">販促媒体</span>
                        <select className="rk_select" value={selectedMedium}
                            onChange={(event) => handleSort(startMonth, endMonth, event.target.value, selectedShop, selectedSection, selectedArea)}>
                            <option value="">全販促媒体</option>
                            {mediumArray.map((item, index) =>
                                <option key={index} value={item.medium}>{item.medium}</option>
                            )}
                        </select>
                    </div>
                    {/* ⚠️ 店舗・課・エリアは**どれか1つだけ**が効く（他は空にする）。
                           ⚠️ 2つ同時に絞ると必ず0件になる */}
                    <div className="rk_field">
                        <span className="rk_label">店舗</span>
                        <select className="rk_select" value={selectedShop}
                            onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, event.target.value, '', '')}>
                            <option value="">グループ全体</option>
                            <option value="KH">国分ハウジング全体</option>
                            <option value="DJH">デイジャストハウス全体</option>
                            <option value="なごみ">なごみ工務店全体</option>
                            {originalShopArray.filter(item => isVisibleShop(item.shop)).map((item, index) => (
                                <option key={index} value={item.shop}>{item.shop}</option>
                            ))}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">営業課</span>
                        <select className="rk_select" value={selectedSection}
                            onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, '', event.target.value, '')}>
                            <option value="">注文営業全体</option>
                            {sectionList.map((section, index) =>
                                <option value={section.name} key={index}>{section.name}</option>
                            )}
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">エリア</span>
                        <select className="rk_select" value={selectedArea}
                            onChange={(event) => handleSort(startMonth, endMonth, selectedMedium, '', '', event.target.value)}>
                            <option value="">全エリア</option>
                            <option value="鹿児島県">鹿児島県</option>
                            <option value="宮崎県">宮崎県</option>
                            <option value="大分県">大分県</option>
                            <option value="熊本県">熊本県</option>
                            <option value="佐賀県">佐賀県</option>
                        </select>
                    </div>
                    <div className="rk_field">
                        <span className="rk_label">表示</span>
                        <label className="rk_select" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showMulti} onChange={() => {
                                // ⚠️ 子店舗を選んだままONにすると選択肢から消えて戻せなくなる。先に解除する
                                if (!showMulti && selectedShop && mergedChildShops.has(selectedShop)) {
                                    handleSort(startMonth, endMonth, selectedMedium, '', selectedSection, selectedArea);
                                }
                                setShowMulti(!showMulti);
                            }} />併売店をまとめる
                        </label>
                    </div>
                    <div className="rk_spacer" />
                    {/* ⚠️ 表と同時に見ると視認性が悪いのでモーダルで出す。
                           店舗数で全画面/xl が切り替わる（UnitPriceGraphModal.tsx） */}
                    <button className="rk_btn" onClick={() => setShowGraph(true)}>グラフを表示</button>
                </div>

                <UnitPriceGraphModal
                    show={showGraph}
                    onHide={() => setShowGraph(false)}
                    data={graphData}
                    series={UNIT_PRICE_SERIES}
                    title='注文事業'
                />

                <div className="rk_table_wrap">
                    <table className="rk_table">
                        <thead>
                            <tr>
                                {headCell('店舗名', '', '', true)}
                                {headCell('営業人数', 'staffCount', '', true)}
                                {headCell('総反響', 'total', `${periodLabel}の総反響数`)}
                                {/* ⚠️⚠️ **列は「数 → 率」の順。** customer/CustomerOrder.tsx と揃えてある。
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
                                {headCell('反響単価', 'registerBudget', '総予算/総反響数')}
                                {headCell('来場単価', 'reserveBudget', '総予算/来場数')}
                                {/* ⚠️ 契約単価の左隣。表の並びをグラフの系列と揃えている */}
                                {headCell('次アポ単価', 'appointmentBudget', '総予算/次アポ数（次アポ＝次回アポイント・資金審査・契約のいずれかがある方）')}
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
                                    staffValue,
                                    rankSValue,
                                    rankAValue,
                                    rankBValue,
                                    rankCValue,
                                    totalBudget,
                                    registerUnit,
                                    reserveUnit,
                                    appointmentUnit,
                                    contractUnit,
                                } = item;

                                /** ⚠️ 分母が0のときは '-'。0円と書くと「無料で取れた」と読める */
                                const yen = (v: number | null) => v === null ? '-' : `¥${v.toLocaleString()}`;

                                /**
                                 * ⚠️ 合計行は背景を変えて店舗と見分ける。
                                 *   ⚠️⚠️ **`index === 0` で判定しないこと。**
                                 *     ⚠️ ⚠️ **並べ替えると合計行も動く**（`sorted` は全行を並べ替える）。
                                 */
                                const isTotalRow = value.shop === 'グループ全体';

                                return (
                                    <tr className={`rk_row${isTotalRow ? ' rk_row_total' : ''}`} key={value.id ?? `medium-${index}`}>
                                        <td className="rk_td rk_td_name">{value.shop}</td>
                                        <td className="rk_td">{staffValue}</td>
                                        <td className="rk_td">{totalValue.toLocaleString()}</td>
                                        {/* ⚠️ 見出しと同じ「数 → 率」の順。片方だけ直すと列がずれる */}
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
                                        <td className="rk_td">{yen(registerUnit)}</td>
                                        <td className="rk_td">{yen(reserveUnit)}</td>
                                        <td className="rk_td">{yen(appointmentUnit)}</td>
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

export default ShopOrder
