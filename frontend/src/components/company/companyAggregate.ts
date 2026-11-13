import { safeFormate } from '../../utils/informationUtils';
import { staffSorter } from '../../utils/staffSorter';
import { dealSales, sumByStaffMonth } from '../realty/summary/kpi';
import { dateFormate, monthFormate, lastYearMonthFormate } from './companyUtils';
import type { Achievement, Customer, Head, InputCell, NumCell, RealtyDeal, RowModel, Section, Shop, Staff, Td } from './companyTypes';

/**
 * 全社報告用フォーマット（会社実績）の集計（v2.2.264 で Company.tsx から分けた）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **数え方は、分ける前の Company.tsx と1つも変えていない。**
 *   以前は画面を描くたびに、セルごとに顧客・予算の配列を端から探していた（店舗 × 担当 × 月 × ランク）。
 *   いまは次の2段で先に数えておき、表（CompanyTable.tsx）は並べるだけにしている。
 *     1. aggregateContracts … 契約をグループ → 事業部 → 課 → 店舗に分ける（顧客・期・店舗が変わったときだけ）
 *     2. buildRows          … 行とセルの文字まで作る（予算・併売店のまとめ方が変わったときも）
 *   ⚠️ 改修の前後で、全セルの文字が同じことを確かめている（docs/oldDocument/task-2026-11-11-02）。
 *     数え方を直すときは、同じやり方で前後を比べること。
 *
 * ⚠️ 以前からの決まり（⚠️ どれも理由があるので、そろえ直さないこと）
 *   ・建売は status を見ない（isProspect）。建売の Sランクは当月の契約だけ（matchesRank）
 *   ・日付は `2026-09-05` と `2026/09` の2つの形がある（dateFormate・monthFormate でそろえて比べる）
 *   ・併売店の子は「multi = 1 かつ parent_shop あり」。まとめ表示では子の行を隠し、親が子の分も数える
 *   ・まとめ表示の担当は氏名でまとめ、**親店舗の行を残す**（先に入ったものを残す。Map の上書きにしない）
 *   ・店舗の予算の行のランク「契約済み」は 0 になる（担当名「予算」で絞るため。以前からの表示）
 *   ・⚠️ v2.2.264 で変えた数字は1つだけ：中古リノベの事業部の予算から、不動産企画係の予算を除いた
 *   ・中古リノベの店舗は、課に関係なく「中古住宅専門店」の店舗を並べる。合計と個人目標の列の順が注文・建売と逆
 *     （⚠️ v2.2.264 から「不動産企画係」の店舗だけは出さない。不動産企画係の事業部として別に出す）
 * ─────────────────────────────────────────────
 */

export const RANKS = ['契約済み', 'Sランク', 'Aランク', 'Bランク', 'Cランク'];

const DIVISION_MAPPING: Record<string, string> = {
    '注文事業': '注文',
    '建売分譲事業': '建売',
    '中古リノベ': '中専',
};

/** 事業（ログイン中の category）ごとの、事業部の並び。⚠️ realty は v2.2.264 で追加 */
export const DIVISION_ORDER: Record<string, string[]> = {
    order: ['注文事業', '建売分譲事業', '中古リノベ'],
    spec: ['建売分譲事業', '中古リノベ', '注文事業'],
    used: ['中古リノベ', '注文事業', '建売分譲事業'],
    realty: ['中古リノベ', '注文事業', '建売分譲事業'],
};

/** 顧客の事業（注文・建売・中専）→ ログイン中の category */
export const CUSTOMER_CATEGORY: Record<string, string> = { '注文': 'order', '建売': 'spec', '中専': 'used' };

export const REALTY_NAME = '不動産企画係';
const USED_DIVISION = '中古リノベ';
const USED_SECTION = '中古住宅専門店';
const CONTRACT_DIVISIONS = ['注文事業', '建売分譲事業'];

type Ctx = { monthArray: string[]; lastYearMonthArray: string[]; shopList: Shop[] };

const isContracted = (c: Customer): boolean => c.status === '契約済み' || c.status === '解約';

/** 契約（contract）で絞る。⚠️ 分ける前の calculateContractList と同じ */
const calculateContractList = (ctx: Ctx, list: Customer[], category: string, month?: string, division?: string, section?: string, shop?: string, staff?: string): Customer[] => {
    if (!list || !Array.isArray(list)) return [];
    const { monthArray, lastYearMonthArray, shopList } = ctx;
    const lastYear = category.endsWith('_lastYear');
    // ⚠️ 以前は今期と昨年の両方を毎回絞っていた。使うほうだけを絞る（結果は同じ）
    const base = lastYear
        ? list.filter(c => c.contract && isContracted(c) && (month ? dateFormate(c.contract).includes(lastYearMonthFormate(month, '/') ?? '') : lastYearMonthArray.includes(monthFormate(c.contract))))
        : list.filter(c => c.contract && isContracted(c) && (month ? dateFormate(c.contract).includes(dateFormate(month)) : monthArray.includes(monthFormate(c.contract))));
    if (category === 'group' || category === 'group_lastYear') return base;
    if ((category === 'division' || category === 'division_lastYear') && division) return base.filter(b => b.category === DIVISION_MAPPING[division]);
    if (category === 'section' || category === 'section_lastYear') {
        const targetShops = new Set(shopList.filter(s => s.section === section).map(s => s.shop));
        return base.filter(b => targetShops.has(b.shop));
    }
    if (category === 'staff') return base.filter(b => b.staff === staff && b.shop === shop);
    if (category === 'staff_lastYear') return base.filter(b => b.staff === staff);
    if (category === 'shop' || category === 'shop_lastYear') return base.filter(b => b.shop === shop);
    return [];
};

/** 仲介の契約（contract_broker。建売だけ）で絞る。⚠️ 分ける前の calculateContractListBroker と同じ */
const calculateContractListBroker = (ctx: Ctx, list: Customer[], category: string, month?: string, division?: string, section?: string, shop?: string, staff?: string): Customer[] => {
    if (division && division !== '建売分譲事業') return [];
    if (!list || !Array.isArray(list)) return [];
    const { monthArray, lastYearMonthArray, shopList } = ctx;
    const lastYear = category.endsWith('_lastYear');
    const base = lastYear
        ? list.filter(c => c.contract_broker && c.category === '建売' && isContracted(c) && (month ? dateFormate(c.contract_broker).includes(lastYearMonthFormate(month, '/') ?? '') : lastYearMonthArray.includes(monthFormate(c.contract_broker))))
        : list.filter(c => c.contract_broker && c.category === '建売' && isContracted(c) && (month ? dateFormate(c.contract_broker).includes(dateFormate(month)) : monthArray.includes(monthFormate(c.contract_broker))));
    if (category === 'group' || category === 'division' || category === 'group_lastYear' || category === 'division_lastYear') return base;
    if (category === 'section' || category === 'section_lastYear') {
        const targetShops = new Set(shopList.filter(s => s.section === section).map(s => s.shop));
        return base.filter(b => targetShops.has(b.shop));
    }
    if (category === 'staff') return base.filter(b => b.staff === staff && b.shop === shop);
    if (category === 'staff_lastYear') return base.filter(b => b.staff === staff);
    if (category === 'shop' || category === 'shop_lastYear') return base.filter(b => b.shop === shop);
    return [];
};

type Monthly = Record<string, Customer[]>;
type Level = {
    total: Customer[]; lastYear: Customer[]; monthly: Monthly; lastYearMonthly: Monthly;
    total_broker: Customer[]; lastYear_broker: Customer[]; monthly_broker: Monthly; lastYearMonthly_broker: Monthly;
};
type ShopLevel = { total: Customer[]; lastYear: Customer[]; total_broker: Customer[]; lastYear_broker: Customer[] };
export type Aggregated = { group: Level; divisions: Record<string, Level>; sections: Record<string, Level>; shops: Record<string, ShopLevel> };

/** 契約を グループ → 事業部 → 課 → 店舗 に分ける（上の段で絞った結果を、下の段がさらに絞る） */
export const aggregateContracts = (customerList: Customer[], monthArray: string[], lastYearMonthArray: string[], divisionArray: string[], sectionList: Section[], shopList: Shop[]): Aggregated => {
    const ctx: Ctx = { monthArray, lastYearMonthArray, shopList };
    const byMonth = (fn: (m: string) => Customer[]): Monthly => Object.fromEntries(monthArray.map(m => [m, fn(m)]));
    const level = (total: Customer[], lastYear: Customer[], totalBroker: Customer[], lastYearBroker: Customer[], kind: string, division?: string, section?: string): Level => ({
        total,
        lastYear,
        monthly: byMonth(m => calculateContractList(ctx, total, kind, m, division, section)),
        lastYearMonthly: byMonth(m => calculateContractList(ctx, lastYear, `${kind}_lastYear`, m, division, section)),
        total_broker: totalBroker,
        lastYear_broker: lastYearBroker,
        monthly_broker: byMonth(m => calculateContractListBroker(ctx, totalBroker, kind, m, division, section)),
        lastYearMonthly_broker: byMonth(m => calculateContractListBroker(ctx, lastYearBroker, `${kind}_lastYear`, m, division, section)),
    });

    const group = level(
        calculateContractList(ctx, customerList, 'group'),
        calculateContractList(ctx, customerList, 'group_lastYear'),
        calculateContractListBroker(ctx, customerList, 'group'),
        calculateContractListBroker(ctx, customerList, 'group_lastYear'),
        'group');

    const divisions = Object.fromEntries(divisionArray.map(div => [div, level(
        calculateContractList(ctx, group.total, 'division', '', div),
        calculateContractList(ctx, group.lastYear, 'division_lastYear', '', div),
        calculateContractListBroker(ctx, group.total_broker, 'division', '', div),
        calculateContractListBroker(ctx, group.lastYear_broker, 'division_lastYear', '', div),
        'division', div)]));

    const sections = Object.fromEntries(sectionList.map(sec => [sec.name, level(
        calculateContractList(ctx, divisions[sec.division]?.total || [], 'section', '', '', sec.name),
        calculateContractList(ctx, divisions[sec.division]?.lastYear || [], 'section_lastYear', '', '', sec.name),
        calculateContractListBroker(ctx, divisions[sec.division]?.total_broker || [], 'section', '', '', sec.name),
        calculateContractListBroker(ctx, divisions[sec.division]?.lastYear_broker || [], 'section_lastYear', '', '', sec.name),
        'section', '', sec.name)]));

    const shops = Object.fromEntries(shopList.map(shp => [shp.shop, {
        total: calculateContractList(ctx, sections[shp.section]?.total || [], 'shop', '', '', '', shp.shop),
        lastYear: calculateContractList(ctx, sections[shp.section]?.lastYear || [], 'shop_lastYear', '', '', '', shp.shop),
        total_broker: calculateContractListBroker(ctx, sections[shp.section]?.total_broker || [], 'shop', '', '', '', shp.shop),
        lastYear_broker: calculateContractListBroker(ctx, sections[shp.section]?.lastYear_broker || [], 'shop_lastYear', '', '', '', shp.shop),
    }]));

    return { group, divisions, sections, shops };
};

/**
 * 併売店の親子関係。親店舗名 → 子店舗名の配列。
 * ⚠️ 子の判定は「multi = 1 かつ parent_shop が入っている」（multi だけでは決まらない。親にも multi = 1 がある）
 */
export const multiChildrenOf = (shopList: Shop[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    shopList.forEach(sh => {
        const parent = (sh.parent_shop ?? '').trim();
        if (sh.multi !== 1 || !parent) return;
        map.set(parent, [...(map.get(parent) ?? []), sh.shop]);
    });
    return map;
};

// ---------------------------------------------------------------------------
// セル
// ---------------------------------------------------------------------------

const LY_TOTAL = 23;
const LY_MONTH = -5;

const numCell = (over: Partial<NumCell> & Pick<NumCell, 'tone' | 'main'>): NumCell => ({
    t: 'num', broker: 0, cancel: 0, ly: null, lyBroker: 0, lyRight: LY_MONTH, list: [], active: false, colSpan: 1, rowSpan: 1, ...over,
});

/** 契約のセル（⚠️ 分ける前の TableContract と同じ） */
const contractCell = (list: Customer[], brokerList: Customer[], opt: { row?: number; col?: number; lastYear?: Customer[] | null; lastYearBroker?: Customer[]; division?: string } = {}): NumCell => {
    const { row = 1, col = 1, lastYear = null, lastYearBroker = [], division } = opt;
    const showBroker = brokerList.length > 0;
    const click = showBroker ? [...list, ...brokerList] : list;
    const common = { tone: 'contract' as const, active: list.length > 0 || showBroker, list: click, colSpan: col, rowSpan: row, lyRight: col === 2 ? LY_TOTAL : LY_MONTH };
    if (division === USED_DIVISION) {
        // ⚠️ 中古リノベは粗利の合計（万円）。件数・仲介・解約・昨年実績は出さない
        const total = list.reduce((acc, cur) => acc + Number(cur?.price ?? 0) * 100, 0) / 100;
        return numCell({ ...common, main: total > 0 ? total.toLocaleString() : '0' });
    }
    return numCell({
        ...common,
        main: String(list.length),
        broker: brokerList.length,
        cancel: list.filter(o => o.status === '解約').length,
        ly: lastYear !== null ? String(lastYear.length) : null,
        lyBroker: lastYearBroker.length,
    });
};

/** 予算の合計のセル（⚠️ 分ける前の TableAchievement と同じ） */
const budgetCell = (value: number, lastYear: number, col: number): NumCell =>
    numCell({ tone: 'budget', main: String(value), active: !!value && value > 0, ly: String(lastYear), colSpan: col, lyRight: col === 2 ? LY_TOTAL : LY_MONTH });

const inputCell = (tone: InputCell['tone'], category: InputCell['category'], name: string, period: string, value: string): InputCell =>
    ({ t: 'input', tone, category, name, period, value, colSpan: 1 });

const head = (text: string, variant: Head['variant'], over: Partial<Head> = {}): Head => ({ text, variant, rowSpan: 1, colSpan: 1, ...over });

/** 並びを保ったまま、キーごとに分ける */
const groupBy = (list: Customer[], key: (o: Customer) => string | undefined): Map<string | undefined, Customer[]> => {
    const map = new Map<string | undefined, Customer[]>();
    for (const o of list) {
        const k = key(o);
        const arr = map.get(k);
        if (arr) arr.push(o);
        else map.set(k, [o]);
    }
    return map;
};

// ---------------------------------------------------------------------------
// 行
// ---------------------------------------------------------------------------

export type BuildInput = {
    customerList: Customer[];
    achievement: Achievement[];
    staffList: Staff[];
    shopList: Shop[];
    sectionList: Section[];
    monthArray: string[];
    lastYearMonthArray: string[];
    divisionArray: string[];
    showMulti: boolean;
    agg: Aggregated;
    realtyDeals: RealtyDeal[];
    /** 今月（`YYYY/MM`。companyUtils の formattedThisMonth） */
    thisMonth: string;
    /**
     * 不動産企画係の事業部を出す場所。
     *   first … 先頭（ログイン中の事業が不動産企画係）／ afterUsed … 中古リノベのすぐ次（中古リノベ）／ last … 最後（注文・建売）
     */
    realtyPlace: 'first' | 'afterUsed' | 'last';
};

export const buildRows = (input: BuildInput): RowModel[] => {
    const { customerList, achievement, staffList, shopList, sectionList, monthArray, lastYearMonthArray, divisionArray, showMulti, agg, realtyDeals, thisMonth, realtyPlace } = input;
    const ctx: Ctx = { monthArray, lastYearMonthArray, shopList };
    const thisMonthKey = monthFormate(thisMonth);
    const firstPeriod = (monthArray[0] ?? '').slice(0, 7);
    const sorter = staffSorter();

    // ── 予算（company_achievement）
    //   ⚠️ 足し算は元の並びのまま行う（小数の予算があっても、以前と同じ結果になるように）
    const ach = achievement.map(a => {
        const mk = monthFormate(a.period);
        return { a, mk, inYear: monthArray.includes(mk), inLastYear: lastYearMonthArray.includes(mk) };
    });
    const sumAch = (pick: (x: typeof ach[number]) => boolean): number => ach.reduce((cur, x) => (pick(x) ? cur + Number(x.a.value) : cur), 0);
    /** month があればその月、無ければ今期（lastYear なら昨年の同じ月・昨年の期） */
    const inPeriod = (x: typeof ach[number], month: string, lastYear: boolean): boolean =>
        month
            ? x.mk === (lastYear ? lastYearMonthFormate(month, '-') : monthFormate(month))
            : (lastYear ? x.inLastYear : x.inYear);
    const groupBudget = (month: string, lastYear: boolean): number => sumAch(x => inPeriod(x, month, lastYear) && x.a.category === 'shop'
        // ⚠️ 今期だけ、中古住宅専門店・不動産企画係を除く（昨年は除いていない。以前からの数え方）
        && (lastYear || (x.a.name !== USED_SECTION && x.a.name !== REALTY_NAME)));
    const shopsBudget = (shops: Set<string>, month: string, lastYear: boolean): number => sumAch(x => inPeriod(x, month, lastYear) && shops.has(safeFormate(x.a.name)));
    /** 最初に見つかった予算の値（⚠️ 空・0 のときは ''）。キーは category・name・period */
    const achValue = new Map<string, string>();
    for (const { a } of ach) {
        const k = `${a.category}\t${a.name}\t${a.period}`;
        if (!achValue.has(k)) achValue.set(k, a.value);
    }
    const valueOf = (category: string, name: string, period: string): string => achValue.get(`${category}\t${name}\t${period}`) || '';
    /** 店舗の今期の予算の合計 */
    const shopYearBudget = (shop: string): number => sumAch(x => x.a.category === 'shop' && x.a.name === shop && x.inYear);

    // ── 見込み客とランク
    const isProspect = (o: Customer): boolean => (o.category === '建売' ? true : o.status === '見込み');
    const includesThisMonth = (value: string | undefined | null): boolean => !!value && (value.includes(thisMonth) || value.includes(thisMonthKey));
    const matchesRank = (o: Customer, r: string): boolean => {
        if (!safeFormate(o.rank).includes(r)) return false;
        if (o.category === '建売' && r === 'Sランク') return includesThisMonth(o.contract) || includesThisMonth(o.contract_broker);
        return true;
    };
    const prospects = customerList.filter(o => isProspect(o) && (o.rank_period <= thisMonth || !o.rank_period));

    // ── 中古リノベ
    const usedList = customerList.filter(c => c.category === '中専');
    const usedContractList = usedList.filter(c => c.status === '契約済み' && (c.contract_reform || c.contract_buy || c.contract_sell));
    const withPrice = (u: Customer): Customer => ({ ...u, price: String(Number(u.contraction_contract_price ?? 0)) });
    const withProspectPrice = (u: Customer): Customer => ({ ...u, price: String(Number(u.contract_land_application_date ?? 0) + Number(u.contract_building_application_date ?? 0)) });
    const usedInMonths = (u: Customer, months: string[]): boolean =>
        months.includes(monthFormate(u.contract_reform)) || months.includes(monthFormate(u.contract_sell)) || months.includes(monthFormate(u.contract_buy));
    const usedInMonth = (u: Customer, month: string): boolean => {
        const m = dateFormate(month);
        return dateFormate(u.contract_reform).includes(m) || dateFormate(u.contract_sell).includes(m) || dateFormate(u.contract_buy).includes(m);
    };
    const budgetTotal = (list: Customer[]): number => list.reduce((acc, cur) => acc + Math.round(Number(cur.contraction_contract_price ?? 0) * 10), 0) / 10;

    // ── 併売店
    const multiChildren = multiChildrenOf(shopList);
    const mergedChildShops = new Set<string>();
    multiChildren.forEach(children => children.forEach(c => mergedChildShops.add(c)));
    const shopNamesOf = (shopName: string): string[] => (showMulti ? [shopName, ...(multiChildren.get(shopName) ?? [])] : [shopName]);
    const isVisibleShop = (shopName: string): boolean => !(showMulti && mergedChildShops.has(shopName));

    const rows: RowModel[] = [];

    // ── グループ
    {
        const ranks = RANKS.map(r => contractCell(
            r === '契約済み' ? (agg.group.monthly?.[thisMonthKey] || []) : prospects.filter(o => matchesRank(o, r)),
            r === '契約済み' ? (agg.group.monthly_broker?.[thisMonthKey] || []) : [],
            { row: 2 }));
        rows.push({
            key: 'group-budget', level: 'group', first: true, sticky: 1, kind: 'budget',
            heads: [head('グループ予算', 'budget', { colSpan: 2 })],
            tds: [...monthArray.map(m => budgetCell(groupBudget(m, false), groupBudget(m, true), 1)), budgetCell(groupBudget('', false), groupBudget('', true), 2)],
            ranks,
        });
        rows.push({
            key: 'group-result', level: 'group', first: false, sticky: 2, kind: 'result',
            heads: [head('グループ実績', 'result', { colSpan: 2 })],
            tds: [
                ...monthArray.map(m => contractCell(agg.group.monthly?.[m] || [], agg.group.monthly_broker?.[m] || [], { lastYear: agg.group.lastYearMonthly?.[m] || [], lastYearBroker: agg.group.lastYearMonthly_broker?.[m] || [] })),
                contractCell(agg.group.total || [], agg.group.total_broker || [], { col: 2, lastYear: agg.group.lastYear || [], lastYearBroker: agg.group.lastYear_broker || [] }),
            ],
            ranks: null,
        });
    }

    /** 注文・建売の店舗（⚠️ 分ける前の contractTable と同じ） */
    const contractShopRows = (section: Section, division: string, color: number, sectionProspects: Customer[]): void => {
        // ランクごとに、担当・店舗で分けておく（⚠️ 以前は行ごとに課の見込み客を端から探していた）
        const rankIndex = RANKS.slice(1).map(r => {
            const matched = sectionProspects.filter(o => matchesRank(o, r));
            return { byStaff: groupBy(matched, o => o.staff), byShop: groupBy(matched, o => o.shop) };
        });
        const divisionTotal = agg.divisions[division]?.total || [];

        shopList
            .filter(shop => shop.section === section.name && !shop.shop.includes('FH') && isVisibleShop(shop.shop))
            .forEach(shop => {
                const shopNames = shopNamesOf(shop.shop);
                // ⚠️ まとめ表示では氏名でまとめる。shopNames は [親, ...子] の順なので、先に入る＝親が残る
                let shopStaffList: Staff[];
                if (showMulti) {
                    const seen = new Map<string, Staff>();
                    shopNames.forEach(name => {
                        staffList.filter(st => st.shop === name && st.report === 1).forEach(st => {
                            if (!seen.has(st.name)) seen.set(st.name, st);
                        });
                    });
                    shopStaffList = Array.from(seen.values());
                } else {
                    shopStaffList = staffList.filter(st => st.shop === shop.shop && st.report === 1);
                }
                const lines = [...shopStaffList,
                    { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 },
                    { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                    .sort(sorter).filter(staff => staff.report === 1);
                const staffLength = shopStaffList.length + 2;

                const baseShopTotal = shopNames.flatMap(n => agg.shops[n]?.total ?? []);
                const baseShopTotalBroker = shopNames.flatMap(n => agg.shops[n]?.total_broker ?? []);
                const baseShopLastYear = shopNames.flatMap(n => agg.shops[n]?.lastYear ?? []);
                const baseShopLastYearBroker = shopNames.flatMap(n => agg.shops[n]?.lastYear_broker ?? []);
                // ⚠️ まとめ表示のときは括弧の併売数を出さない（本数そのものが子店舗を含むため）
                const isShopMulti = shop.multi === 1 && !showMulti;
                const shopBudgetTotal = shopYearBudget(shop.shop);

                lines.forEach((staff, staffIndex) => {
                    const isShop = staffIndex === staffLength - 1;
                    const isAchievement = staffIndex === staffLength - 2;
                    const isStaff = staffIndex < staffLength - 2;
                    const isStaffMulti = staff.multi === 1 && !showMulti;
                    const mine = (o: Customer): boolean => o.staff === staff.name && shopNames.includes(o.shop ?? '');

                    const shopContract = isShop ? baseShopTotal : baseShopTotal.filter(mine);
                    const shopContractBroker = isShop ? baseShopTotalBroker : baseShopTotalBroker.filter(mine);
                    const shopContractLastYear = isShop ? baseShopLastYear : calculateContractList(ctx, baseShopLastYear, 'staff_lastYear', '', '', '', shop.shop, staff.name);
                    const shopContractLastYearBroker = isShop ? baseShopLastYearBroker : calculateContractListBroker(ctx, baseShopLastYearBroker, 'staff_lastYear', '', '', '', shop.shop, staff.name);
                    // ⚠️ 括弧の併売数（店舗名からブランド名を除いた部分一致の推測値）。使う行だけ数える
                    const needMulti = isShop ? isShopMulti : isStaffMulti;
                    const multiContract = !needMulti ? [] : divisionTotal.filter(o => (isShop ? o.shop?.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name));
                    const lastYearKind = isShop ? 'shop_lastYear' : 'staff_lastYear';

                    const tds: Td[] = [];
                    if (isAchievement) {
                        monthArray.forEach(month => tds.push(inputCell('shop', 'shop', shop.shop, month, valueOf('shop', shop.shop, month))));
                        tds.push(numCell({ tone: 'budgetFixed', main: String(shopBudgetTotal), active: true, colSpan: 2 }));
                    } else {
                        monthArray.forEach(month => {
                            const m = dateFormate(month);
                            const period = shopContract.filter(o => dateFormate(o.contract).includes(m));
                            const periodBroker = shopContractBroker.filter(o => dateFormate(o.contract_broker).includes(m));
                            const periodLastYear = calculateContractList(ctx, shopContractLastYear, lastYearKind, month, '', '', shop.shop, staff.name);
                            const periodLastYearBroker = calculateContractListBroker(ctx, shopContractLastYearBroker, lastYearKind, month, '', '', shop.shop, staff.name);
                            const multiPeriod = isShop && isShopMulti ? multiContract.filter(o => dateFormate(o.contract).includes(m)) : [];
                            tds.push(numCell({
                                tone: 'contract',
                                main: `${period.length}${isShop && isShopMulti ? `(${multiPeriod.length})` : ''}`,
                                broker: periodBroker.length,
                                cancel: period.filter(o => o.status === '解約').length,
                                ly: String(periodLastYear.length),
                                lyBroker: periodLastYearBroker.length,
                                list: [...period, ...periodBroker],
                                active: period.length > 0 || periodBroker.length > 0,
                            }));
                        });
                        tds.push(numCell({
                            tone: 'contract',
                            main: `${shopContract.length}${needMulti ? `(${multiContract.length})` : ''}`,
                            broker: shopContractBroker.length,
                            cancel: shopContract.filter(o => o.status === '解約').length,
                            ly: String(shopContractLastYear.length),
                            lyBroker: shopContractLastYearBroker.length,
                            lyRight: isShop ? LY_TOTAL : LY_MONTH,
                            list: [...shopContract, ...shopContractBroker],
                            active: shopContract.length > 0 || shopContractBroker.length > 0,
                            colSpan: isShop ? 2 : 1,
                        }));
                        if (isStaff) tds.push(inputCell('staff', 'staff', staff.name, firstPeriod, valueOf('staff', staff.name, firstPeriod)));
                    }

                    const ranks = isShop ? null : RANKS.map((r, rankIndexNo) => {
                        const target = r === '契約済み'
                            ? shopContract.filter(o => dateFormate(o.contract).includes(thisMonth))
                            : ((isStaff ? rankIndex[rankIndexNo - 1].byStaff.get(staff.name) : rankIndex[rankIndexNo - 1].byShop.get(shop.shop)) ?? []);
                        const targetBroker = r === '契約済み' ? shopContractBroker.filter(o => dateFormate(o.contract_broker).includes(thisMonth)) : [];
                        return contractCell(target, targetBroker, { row: isAchievement ? 2 : 1 });
                    });

                    rows.push({
                        key: `${division}/${section.name}/${shop.shop}/${staffIndex}:${staff.name}`,
                        id: staffIndex === 0 ? shop.shop : undefined,
                        level: 'shop', first: staffIndex === 0, gapBefore: staffIndex === 0 ? 1 : undefined,
                        kind: isAchievement ? 'budget' : isShop ? 'result' : 'staff',
                        heads: [
                            ...(staffIndex === 0 ? [head(shop.shop, 'shop', { rowSpan: staffLength, color })] : []),
                            head(staff.name, isAchievement ? 'budget' : isShop ? 'result' : 'name', { second: true }),
                        ],
                        tds, ranks,
                    });
                });
            });
    };

    /** 中古リノベの店舗（⚠️ 分ける前の contractTable_used と同じ。課に関係なく「中古住宅専門店」の店舗を並べる） */
    const usedShopRows = (keyPrefix: string): void => {
        // ⚠️ v2.2.264: 「不動産企画係」の店舗は出さない（1つの事業部として別に出すため。2026-11-11 の指示）。
        //   ⚠️ 中古リノベの事業部の合計は顧客データ（中専）から数えているので、行を隠しても変わらない
        shopList.filter(s => s.section === USED_SECTION && s.shop !== REALTY_NAME).forEach((s, sIndex) => {
            const targetStaffs = staffList.filter(st => st.shop === s.shop);
            const staffNames = new Set(targetStaffs.map(t => t.name));
            const baseLength = targetStaffs.length;
            // ⚠️ ランクの列だけ、報告対象（report = 1）の人数で数える（以前からの数え方）
            const staffLength = staffList.filter(st => st.shop === s.shop && st.report === 1).length + 2;
            const lines = [...targetStaffs,
                { name: '予算', shop: s.shop, section: USED_SECTION, report: 1, sort: 0, multi: 0 },
                { name: '実績', shop: s.shop, section: USED_SECTION, report: 1, sort: -1, multi: s.multi }]
                .sort(sorter);

            lines.forEach((staff, staffIndex) => {
                const isShop = staffIndex === baseLength + 1;
                const isStaff = staffIndex <= baseLength - 1;
                const isAchievement = staffIndex === baseLength;
                const mine = (u: Customer): boolean => (isShop ? staffNames.has(u.staff) : u.staff === staff.name);
                const usedStaffs = usedContractList.filter(mine);
                const totalContracts = usedStaffs.filter(u => usedInMonths(u, monthArray));
                const totalBudget = budgetTotal(totalContracts);
                const lastYearBudget = budgetTotal(usedStaffs.filter(u => usedInMonths(u, lastYearMonthArray)));

                const tds: Td[] = [];
                monthArray.forEach(month => {
                    if (isAchievement) {
                        const v = sumAch(x => x.a.category === 'shop' && x.a.name === s.shop && dateFormate(x.a.period) === dateFormate(month));
                        tds.push(numCell({ tone: 'budgetFixed', main: (v || 0).toLocaleString(), active: true }));
                        return;
                    }
                    const periodContracts = usedStaffs.filter(u => usedInMonth(u, month));
                    const periodBudget = budgetTotal(periodContracts);
                    if (isShop) {
                        const lastMonth = `${Number(month.split('-')[0] ?? 0) - 1}-${month.split('-')[1]}`;
                        tds.push(numCell({ tone: 'contract', main: periodBudget.toLocaleString(), ly: String(budgetTotal(usedStaffs.filter(u => usedInMonth(u, lastMonth)))), lyRight: LY_TOTAL, list: periodBudget > 0 ? periodContracts : [], active: periodBudget > 0 }));
                    } else if (isStaff) {
                        tds.push(numCell({ tone: 'contract', main: periodBudget > 0 ? periodBudget.toLocaleString() : '0', list: periodBudget > 0 ? periodContracts : [], active: periodBudget > 0 }));
                    }
                });
                const totalCell = (col: number): NumCell => numCell({ tone: 'contract', main: totalBudget.toLocaleString(), ly: String(lastYearBudget), lyRight: LY_TOTAL, list: totalBudget > 0 ? totalContracts : [], active: totalBudget > 0, colSpan: col });
                if (isAchievement) tds.push(numCell({ tone: 'budgetFixed', main: shopYearBudget(s.shop).toLocaleString(), active: true, colSpan: 2 }));
                if (isShop) tds.push(totalCell(2));
                // ⚠️ 担当の行は「個人目標 → 合計」の順（注文・建売と逆。以前からの並び）
                if (isStaff) tds.push(inputCell('staff', 'staff', staff.name, firstPeriod, valueOf('staff', staff.name, firstPeriod)), totalCell(1));

                const ranks = staffIndex === staffLength - 1 ? null : RANKS.map(r => {
                    const useShop = staffIndex === staffLength - 2;
                    const who = (o: Customer): boolean => (useShop ? staffNames.has(o.staff) : o.staff === staff.name);
                    const list = r === '契約済み'
                        ? usedList.filter(o => o.status === '契約済み' && who(o) && (dateFormate(o.contract_reform).includes(thisMonth) || dateFormate(o.contract_sell).includes(thisMonth) || dateFormate(o.contract_buy).includes(thisMonth))).map(withPrice)
                        : usedList.filter(o => o.status === '見込み' && safeFormate(o.rank).includes(r) && who(o)).map(withProspectPrice);
                    return contractCell(list, [], { row: useShop ? 2 : 1, division: USED_DIVISION });
                });

                rows.push({
                    key: `${keyPrefix}${s.shop}/${staffIndex}:${staff.name}`,
                    level: 'shop', first: staffIndex === 0, gapBefore: staffIndex === 0 ? 1 : undefined,
                    kind: isAchievement ? 'budget' : isShop ? 'result' : 'staff',
                    heads: [
                        ...(staffIndex === 0 ? [head(s.shop, 'shop', { rowSpan: targetStaffs.length + 2, color: sIndex })] : []),
                        head(staff.name, isAchievement ? 'budget' : isShop ? 'result' : 'name', { second: true }),
                    ],
                    tds, ranks,
                });
            });
        });
    };

    /**
     * 不動産企画係（1つの事業部として出す。v2.2.264）。
     * ⚠️ 担当 × 月の金額は、月次売上管理（realty/sales/MonthlySales.tsx）と同じ（同じ sumByStaffMonth・dealSales）。
     *   違うのは次の3つ。
     *     ・合計に入れる人 … こちらは売上のある全員（担当の一覧に居ない人は「その他」）。月次売上管理は設定の担当者だけ
     *     ・期 … こちらは 6月〜5月。月次売上管理は設定の期首月から12か月（⚠️ 2026-11 時点の期首は 6月で同じ）
     *     ・丸め … こちらは万円・小数1桁。⚠️ 合計の列は「円の合計を丸めた値」なので、月のセルを足した値と 0.数万円ずれることがある
     * ⚠️ 昨年実績は、昨年の同じ月（合計は昨年の期）の売上。
     */
    const realtyRows = (): void => {
        const sales = sumByStaffMonth(realtyDeals, dealSales);
        const nameKey = (v: string): string => v.replace(/[\s　]/g, '');
        /** 円 → 万円（小数1桁） */
        const man = (yen: number): string => (Math.round(yen / 1000) / 10).toLocaleString();
        const salesCell = (yen: number, lastYearYen: number, col = 1): NumCell =>
            numCell({ tone: 'sales', main: man(yen), ly: man(lastYearYen), lyRight: col === 2 ? LY_TOTAL : LY_MONTH, active: yen > 0, colSpan: col });
        /** 12か月（昨年の同じ月つき）＋ 合計（昨年の期つき） */
        const salesCells = (names: string[]): NumCell[] => [
            ...monthArray.map(m => salesCell(sumOf(names, [m]), sumOf(names, [lastYearMonthFormate(m, '-') ?? '']))),
            salesCell(sumOf(names, monthArray), sumOf(names, lastYearMonthArray), 2),
        ];
        const sumOf = (names: string[], months: string[]): number => names.reduce((acc, n) => acc + months.reduce((a, m) => a + (sales[n]?.[m] ?? 0), 0), 0);

        const allNames = Object.keys(sales);
        const members = staffList.filter(st => st.shop === REALTY_NAME).sort(sorter);
        const memberKeys = new Set(members.map(m => nameKey(m.name)));
        // ⚠️ 担当の一覧に居ない人（退職・表記ちがい）の売上は「その他」にまとめる（事業部の合計と合うように）
        const others = allNames.filter(n => !memberKeys.has(nameKey(n)));
        const lines = [
            ...members.map(m => ({ label: m.name, names: allNames.filter(n => nameKey(n) === nameKey(m.name)) })),
            ...(sumOf(others, monthArray) !== 0 ? [{ label: 'その他', names: others }] : []),
        ];
        const budget = (month: string): number => sumAch(x => x.a.category === 'shop' && x.a.name === REALTY_NAME && (month ? x.mk === monthFormate(month) : x.inYear));

        rows.push({
            key: 'realty-budget', id: `${REALTY_NAME}（事業部）`, level: 'division', first: true, gapBefore: 3, gapLabel: REALTY_NAME, kind: 'budget', isNew: true,
            heads: [head(REALTY_NAME, 'division', { rowSpan: 2 }), head('予算', 'budget', { second: true })],
            tds: [...monthArray.map(m => numCell({ tone: 'budget', main: budget(m).toLocaleString(), active: budget(m) > 0 })), numCell({ tone: 'budget', main: budget('').toLocaleString(), active: budget('') > 0, colSpan: 2 })],
            ranks: null,
        });
        rows.push({
            key: 'realty-result', level: 'division', first: false, kind: 'result', isNew: true,
            heads: [head('売上', 'result', { second: true })],
            tds: salesCells(allNames),
            ranks: null,
        });
        lines.forEach((line, index) => {
            rows.push({
                key: `realty-staff-${index}`, level: 'shop', first: index === 0, gapBefore: index === 0 ? 1 : undefined, kind: 'staff', isNew: true,
                heads: [
                    ...(index === 0 ? [head('担当別', 'shop', { rowSpan: lines.length, color: 0 })] : []),
                    head(line.label, 'name', { second: true }),
                ],
                tds: salesCells(line.names),
                ranks: null,
            });
        });
    };

    if (realtyPlace === 'first') realtyRows();

    // ── 事業部 → 課 → 店舗
    divisionArray.forEach(division => {
        const isUsed = division === USED_DIVISION;
        const level = agg.divisions[division];
        // ⚠️ v2.2.264: 中古リノベの事業部の予算には、不動産企画係の予算を入れない（不動産企画係は別の事業部として出すため）。
        //   shop_list では「不動産企画係」が中古リノベの店舗なので、除かないと両方の事業部に出る（実績は以前から入っていない）
        const divisionShops = new Set(shopList.filter(s => s.division === division && !(isUsed && s.shop === REALTY_NAME)).map(s => s.shop));
        const prospectList = prospects.filter(o => o.category === DIVISION_MAPPING[division]);

        const ranks = RANKS.map(r => {
            if (isUsed) {
                const list = r === '契約済み'
                    ? usedList.filter(u => u.status === '契約済み' && (monthFormate(u.contract_reform).includes(thisMonthKey) || monthFormate(u.contract_buy).includes(thisMonthKey) || monthFormate(u.contract_sell).includes(thisMonthKey))).map(withPrice)
                    : usedList.filter(u => u.status !== '契約済み' && safeFormate(u.rank)?.includes(r)).map(withProspectPrice);
                return contractCell(list, [], { row: 2, division });
            }
            return contractCell(
                r === '契約済み' ? (level?.monthly?.[thisMonthKey] || []) : prospectList.filter(o => matchesRank(o, r)),
                r === '契約済み' ? (level?.monthly_broker?.[thisMonthKey] || []) : [],
                { row: 2, division });
        });
        rows.push({
            key: `div-${division}-budget`, id: division, level: 'division', first: true, gapBefore: 3, gapLabel: division, kind: 'budget',
            heads: [head(division, 'division', { rowSpan: 2 }), head('予算', 'budget', { second: true })],
            tds: [...monthArray.map(m => budgetCell(shopsBudget(divisionShops, m, false), shopsBudget(divisionShops, m, true), 1)), budgetCell(shopsBudget(divisionShops, '', false), shopsBudget(divisionShops, '', true), 2)],
            ranks,
        });
        rows.push({
            key: `div-${division}-result`, level: 'division', first: false, kind: 'result',
            heads: [head('実績', 'result', { second: true })],
            tds: [
                ...monthArray.map(m => contractCell(
                    isUsed ? usedContractList.filter(u => u.status === '契約済み' && usedInMonth(u, m)).map(withPrice) : (level?.monthly?.[m] || []),
                    level?.monthly_broker?.[m] || [],
                    { lastYear: level?.lastYearMonthly?.[m] || [], lastYearBroker: level?.lastYearMonthly_broker?.[m] || [], division })),
                contractCell(
                    isUsed ? usedContractList.filter(u => usedInMonths(u, monthArray)).map(withPrice) : (level?.total || []),
                    level?.total_broker || [],
                    { col: 2, lastYear: level?.lastYear || [], lastYearBroker: level?.lastYear_broker || [], division }),
            ],
            ranks: null,
        });

        sectionList.filter(s => s.division === division).forEach((section, sectionIndex) => {
            const sec = agg.sections[section.name];
            const sectionShops = new Set(shopList.filter(s => s.section === section.name).map(s => s.shop));
            const sectionProspects = prospectList.filter(o => sectionShops.has(o.shop));

            // ⚠️ 中古住宅専門店は、課の予算・実績の2行を出さない
            if (section.name !== USED_SECTION) {
                rows.push({
                    key: `sec-${section.name}-budget`, id: section.name, level: 'section', first: true, gapBefore: 2, kind: 'budget',
                    heads: [head(section.name, 'section', { rowSpan: 2, color: sectionIndex }), head('予算', 'budget', { second: true })],
                    tds: [...monthArray.map(m => budgetCell(shopsBudget(sectionShops, m, false), shopsBudget(sectionShops, m, true), 1)), budgetCell(shopsBudget(sectionShops, '', false), shopsBudget(sectionShops, '', true), 2)],
                    ranks: RANKS.map(r => contractCell(
                        r === '契約済み' ? (sec?.monthly?.[thisMonthKey] || []) : sectionProspects.filter(o => matchesRank(o, r)),
                        r === '契約済み' ? (sec?.monthly_broker?.[thisMonthKey] || []) : [],
                        { row: 2 })),
                });
                rows.push({
                    key: `sec-${section.name}-result`, level: 'section', first: false, kind: 'result',
                    heads: [head('実績', 'result', { second: true })],
                    tds: [
                        ...monthArray.map(m => contractCell(sec?.monthly?.[m] || [], sec?.monthly_broker?.[m] || [], { lastYear: sec?.lastYearMonthly?.[m] || [], lastYearBroker: sec?.lastYearMonthly_broker?.[m] || [] })),
                        contractCell(sec?.total || [], sec?.total_broker || [], { col: 2, lastYear: sec?.lastYear || [], lastYearBroker: sec?.lastYear_broker || [] }),
                    ],
                    ranks: null,
                });
            }

            if (CONTRACT_DIVISIONS.includes(division)) contractShopRows(section, division, sectionIndex, sectionProspects);
            else usedShopRows(`${section.name}-`);
        });

        if (isUsed && realtyPlace === 'afterUsed') realtyRows();
    });

    if (realtyPlace === 'last') realtyRows();

    return rows;
};
