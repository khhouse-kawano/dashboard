import React, { useState, useEffect, useContext, useMemo } from 'react';
import AuthContext from "../../context/AuthContext";
import Table from "react-bootstrap/Table";
import { getPeriod } from '../../utils/getPeriod';
import InformationEdit from '../information/InformationEdit';
import InformationEditKaeru from '../information/InformationEditKaeru';
import InformationEditResale from '../information/InformationEditResale';
import { getYears } from '../../utils/getYears';
import { staffSorter } from '../../utils/staffSorter';
import { thisYear } from '../../utils/thisYear';
import { safeFormate } from '../../utils/informationUtils';
import { useIsSp } from '../../utils/isSp';
import apiClient from '../../utils/apiClient';
import CustomerDetail from './CustomerDetail';
import Ranking from './Ranking';
import { sortStyle, tableStyle, tdStyle, dateFormate, monthFormate, lastYearMonthFormate, formattedThisMonth, cancelStyle, lastYearStyle } from './companyUtils';

type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };
/**
 * 店舗。
 * ⚠️ `parent_shop` は併売店（multi = 1）の親店舗名。運用側が手作業で設定する。
 *   ⚠️ 未設定なら null。**親店舗自身も null** である（自分を指さない）。
 *   列の追加: backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql
 */
type Shop = { brand: string, shop: string, section: string, area: string, division: string, multi: number, parent_shop: string | null };
type Section = { name: string, division: string };
type Customer = Record<string, string>;
type Achievement = { category: string, name: string, period: string, value: string };

const Company = () => {
    const { token, authority, category } = useContext(AuthContext);
    const [originalStaffList, setOriginalStaffList] = useState<Staff[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [show, setShow] = useState(false);
    const [contract, setContract] = useState<Customer[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetDivision, setTargetDivision] = useState('');
    const [targetYear, setTargetYear] = useState<number | null>(null);
    const [editId, setEditId] = useState<Record<string, string>>({
        order: '',
        kaeru: '',
        resale: ''
    });
    const [showLastYear, setShowLastYear] = useState(false);
    const [showCancel, setShowCancel] = useState(true);
    /**
     * 併売店をまとめるか。
     *
     * ⚠️⚠️ **既定は false。false のときは従来の表示と1つも変わらない。**
     *   true にすると
     *     ・子店舗（multi = 1 かつ parent_shop あり）の行を隠す
     *     ・親店舗の行が「自店＋子店」の契約を数える
     *     ・重複登録されている担当営業の行を1本にまとめる
     */
    const [showMulti, setShowMulti] = useState<boolean>(false);
    const [showRanking, setShowRanking] = useState(false);

    const isSp = useIsSp();

    const rankArray = ['契約済み', 'Sランク', 'Aランク', 'Bランク', 'Cランク'];
    const divisionMapping = {
        '注文事業': '注文',
        '建売分譲事業': '建売',
        '中古リノベ': '中専'
    };
    const divisionListMapping = {
        'order': ['注文事業', '建売分譲事業', '中古リノベ'],
        'spec': ['建売分譲事業', '中古リノベ', '注文事業'],
        'used': ['中古リノベ', '注文事業', '建売分譲事業'],
    };
    const divisionArray: string[] = divisionListMapping[category as keyof typeof divisionListMapping];

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post('', { request: 'company' });
            setOriginalStaffList(response.data.staff);
            setShopList(response.data.shop);
            setSectionList(response.data.section);
            setCustomerList([...response.data.contract, ...response.data.contract_kaeru, ...response.data.contract_resale]);
            setAchievement(response.data.achievement);
        };
        fetchData();
        setTargetYear(thisYear);
    }, []);

    useEffect(() => {
        const target = document.getElementById(targetDivision);
        if (!target) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }, [targetDivision]);

    useEffect(() => {
        if (!targetYear) return;
        const filtered = originalStaffList.filter(o =>
            o.period === String(targetYear)
        );
        setStaffList(filtered);
    }, [originalStaffList, targetYear, customerList]);


    const moveToTarget = async (targetValue: string) => {
        const target = document.getElementById(targetValue);

        if (!target) {
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
            return;
        }

        target.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    const informationEditClose = () => setEditId({
        order: '',
        kaeru: '',
        resale: ''
    });

    const changeAchievement = async (
        periodValue: string,
        categoryValue: string,
        nameValue: string,
        achievementValue: string
    ) => {
        const data = {
            request: 'change_company_achievement',
            category: categoryValue,
            name: nameValue,
            period: periodValue,
            value: achievementValue
        };

        setAchievement(prev => {
            const index = prev.findIndex(
                a => a.category === categoryValue && a.period === periodValue && a.name === nameValue
            );

            if (index !== -1) {
                return prev.map(a =>
                    a.period === periodValue && a.category === categoryValue && a.name === nameValue
                        ? { ...a, value: achievementValue }
                        : a
                );
            }

            const newItem: Achievement = {
                category: categoryValue,
                period: periodValue,
                name: nameValue,
                value: achievementValue
            };
            return [...prev, newItem];
        });

        try {
            const response = await apiClient.post("", data);
            console.log(response.data.status)
        } catch (error) {
            console.error('Error updating achievement:', error);
        }
    };

    /**
     * 併売店の親子関係。親店舗名 → 子店舗名の配列。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **子の判定は「multi = 1 かつ parent_shop が入っている」。**
     *   `multi = 1` だけでは判定できない。2026-09-10 時点の実データでは
     *   親である KH加世田店 / KH鹿屋店 も multi = 1 だが、
     *   KH延岡店 は multi = 0 である（付け方が一貫していない）。
     *   parent_shop の有無だけが親子を決める。
     *
     * ⚠️ parent_shop は `shop_list.shop` と完全一致する文字列である前提。
     *   既存コードには店舗名からブランド名を除いた**部分一致**での推測が
     *   あるが（下の multiContract）、この列はそれを置き換えるためのもの。
     * ─────────────────────────────────────────────
     */
    const multiChildren = useMemo(() => {
        const map = new Map<string, string[]>();
        shopList.forEach(sh => {
            const parent = (sh.parent_shop ?? '').trim();
            if (sh.multi !== 1 || !parent) return;
            map.set(parent, [...(map.get(parent) ?? []), sh.shop]);
        });
        return map;
    }, [shopList]);

    /** まとめ表示で隠す店舗（＝子店舗）の名前 */
    const mergedChildShops = useMemo(() => {
        const set = new Set<string>();
        multiChildren.forEach(children => children.forEach(c => set.add(c)));
        return set;
    }, [multiChildren]);

    /**
     * その店舗の行が受け持つ店舗名。
     * ⚠️ まとめ表示なら [親, ...子]。そうでなければ自分だけ。
     */
    const shopNamesOf = (shopName: string): string[] =>
        showMulti ? [shopName, ...(multiChildren.get(shopName) ?? [])] : [shopName];

    /**
     * 表示する店舗か。
     * ⚠️ 集計には使わないこと。`shopList` を絞ると課・事業部の合計が減る
     *   （calculateContractList の 'section' などが shopList から
     *     対象店舗を作っているため）。**表示の絞り込みだけに使う。**
     */
    const isVisibleShop = (shopName: string): boolean =>
        !(showMulti && mergedChildShops.has(shopName));

    const monthArray: string[] = useMemo(() => {
        return getPeriod(Number(targetYear) - 1, 6);
    }, [targetYear]);

    const lastYearMonthArray: string[] = useMemo(() => {
        return getPeriod(Number(targetYear) - 2, 6);
    }, [targetYear]);

    /**
     * 見込み客か。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **建売は `status` を見ない。**
     *
     *   `status` の語彙が事業ごとに違う（2026-09-10 の実データ）。
     *
     *     注文       … 契約済み / 見込み / 失注 / 解約 / 会社管理 / 重複
     *     中古リノベ … 契約済み / 見込み            ← 2値だけ
     *     建売       … 契約済み / 来店あり / 接触（通話・返信） / 追客中 /
     *                  未設定 / 追客終了 / 申込み済み / アポイント確定 /
     *                  事前取得 / 各種査定 …（**進捗ステータス18種**）
     *
     *   ⚠️ 建売で `status === '見込み'` に一致するのは**1,003件中1件だけ**。
     *     そのため会社実績の建売のランク数がほぼ空欄になっていた。
     *
     *   ⚠️ 建売は SQL の時点で
     *       show_dashboard = 1 AND ランクあり
     *     に絞られている（company.php / features/company/queries.ts）。
     *     届いた行はすべて集計対象なので、ここでは status を見ない。
     *
     * ⚠️⚠️ **建売は契約済みもランク列に含まれる。**
     *   注文・中古では `status === '見込み'` が契約済みを除くため、
     *   「契約済み」列とランク列は排他になっている。建売だけ排他ではない。
     *   ⚠️ 排他にしたい場合は、ここで `o.status !== '契約済み'` を足す。
     * ─────────────────────────────────────────────
     */
    const isProspect = (o: Customer): boolean =>
        o.category === '建売' ? true : o.status === '見込み';

    /**
     * 日付文字列が当月を含むか。
     *
     * ⚠️⚠️ **区切り文字が2種類ある。** 両方を見ないと一致しない。
     *   `formattedThisMonth` は `2026/09`（スラッシュ）だが、
     *   DBの契約日は `2026-09-05`（ハイフン）で入っている。
     *   スラッシュだけで includes すると**常に false** になる。
     */
    const includesThisMonth = (value: string | undefined | null): boolean => {
        if (!value) return false;
        return value.includes(formattedThisMonth)
            || value.includes(monthFormate(formattedThisMonth));
    };

    /**
     * ランク列（S / A / B / C）に数えるか。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **建売の「Sランク」は契約済みの顧客を意味する。**
     *
     *   建売ではランクが商談の見込み度ではなく契約状態を表しており、
     *   Sランクだけで872件ある（2026-09-10 の実データ）。
     *   そのまま数えると過去の契約客まで全部拾って**数が意味を持たない**。
     *
     *   そのため建売のSランクだけ、**当月に契約した顧客に限る**。
     *   ⚠️ 契約日（contract）と仲介契約日（contract_broker）の
     *     どちらかが当月なら数える。建売は契約の列が2本ある。
     *
     * ⚠️ A / B / Cランクは絞らない。建売でも見込み度として使われている。
     * ⚠️ 注文・中古リノベは一切絞らない（ランクの意味が違う）。
     * ─────────────────────────────────────────────
     */
    const matchesRank = (o: Customer, r: string): boolean => {
        if (!safeFormate(o.rank).includes(r)) return false;
        if (o.category === '建売' && r === 'Sランク') {
            return includesThisMonth(o.contract) || includesThisMonth(o.contract_broker);
        }
        return true;
    };

    const usedList = useMemo(() => {
        return customerList.filter(c => c.category === '中専');
    }, [customerList]);

    const usedContractList = useMemo(() => {
        return usedList.filter(c => c.status === '契約済み' && (c.contract_reform || c.contract_buy || c.contract_sell));
    }, [usedList]);

    type AchievementProps = {
        list: number | null,
        row: number,
        col: number,
        lastYear: number | null
    };

    type ContractProps = {
        list: any,
        brokerList?: any,
        row: number,
        col: number,
        lastYear: any,
        lastYearBroker?: any,
        division?: string
    };

    const TableAchievement = ({ list, row, col, lastYear }: AchievementProps) => {
        return <td rowSpan={row} colSpan={col} className={list && list > 0 ? 'text-danger text-center table-danger' : 'text-center'}>
            <div className='position-relative'>{list}
                {(showLastYear && lastYear !== null) && <div className='position-absolute'
                    style={{ ...lastYearStyle, right: col === 2 ? '23px' : '-5px' }}>{lastYear}</div>}
            </div></td>
    };

    const TableContract = ({ list = [], brokerList = [], row, col, lastYear, lastYearBroker = [], division }: ContractProps) => {
        const cancelList = list.filter((o: any) => o.status === '解約');
        const showBroker = brokerList && brokerList.length > 0;
        const total = division === '中古リノベ' ? list.reduce((acc: any, cur: any) => acc + Number(cur?.price ?? 0) * 100, 0) / 100 : 0;
        const totalFormate = total > 0 ? total.toLocaleString() : 0;
        return <td rowSpan={row} colSpan={col} className={(list.length > 0 || showBroker) ? 'text-primary company_contract text-center table-primary' : 'text-center'}
            onClick={() => showCustomer(showBroker ? [...list, ...brokerList] : list)}>
            <div className='position-relative'>
                {division === '中古リノベ' ? totalFormate : <>
                    {list.length}
                    {showBroker && <span className="text-success ms-1">({brokerList.length})</span>}
                    {(showCancel && cancelList.length > 0) && <span style={cancelStyle}>{cancelList.length}</span>}
                    {(showLastYear && lastYear !== null) && <div className='position-absolute'
                        style={{ ...lastYearStyle, right: col === 2 ? '23px' : '-5px' }}>
                        {lastYear.length}
                        {lastYearBroker?.length > 0 && <span className="text-success ms-1">({lastYearBroker.length})</span>}
                    </div>}
                </>}
            </div></td>
    };

    const achievementLength = (category: string, month?: string, division?: string, section?: string) => {
        const base = achievement.filter(a => (month ? monthFormate(a.period) === monthFormate(month) : monthArray.includes(monthFormate(a.period))));
        const baseLastYear = achievement.filter(a => (month ? monthFormate(a.period) === lastYearMonthFormate(month, '-') : lastYearMonthArray.includes(monthFormate(a.period))));
        if (category === 'group') {
            return base.filter(a => a.category === 'shop' && (a.name !== '中古住宅専門店' && a.name !== '不動産企画係')).reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'group_lastYear') {
            return baseLastYear.filter(a => a.category === 'shop').reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'division') {
            const targetShopArray = shopList.filter(s => s.division === division).map(s => s.shop);
            return base.filter(a => targetShopArray.includes(safeFormate(a.name))).reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'division_lastYear') {
            const targetShopArray = shopList.filter(s => s.division === division).map(s => s.shop);
            return baseLastYear.filter(a => targetShopArray.includes(safeFormate(a.name))).reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'section') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return base.filter(a => targetShopArray.includes(safeFormate(a.name))).reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'section_lastYear') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return baseLastYear.filter(a => targetShopArray.includes(safeFormate(a.name))).reduce((cur, acc) => cur + Number(acc.value), 0);
        }

        return 0;
    };

    const calculateContractList = (list: Customer[], category: string, month?: string, division?: string, section?: string, shop?: string, staff?: string) => {
        if (!list || !Array.isArray(list)) return [];
        const base = list.filter(c => c.contract && (c.status === '契約済み' || c.status === '解約') && (month ? dateFormate(c.contract).includes(dateFormate(month)) : monthArray.includes(monthFormate(c.contract))));
        const baseLastYear = list.filter(c => c.contract && (c.status === '契約済み' || c.status === '解約') && (month ? dateFormate(c.contract).includes(lastYearMonthFormate(month, '/') ?? '') : lastYearMonthArray.includes(monthFormate(c.contract))));
        if (category === 'group') {
            return base ?? [];
        }
        if (category === 'group_lastYear') {
            return baseLastYear ?? [];
        }
        if (category === 'division' && division) {
            return base.filter(b => b.category === divisionMapping[division as keyof typeof divisionMapping]) ?? [];
        }
        if (category === 'division_lastYear' && division) {
            return baseLastYear.filter(b => b.category === divisionMapping[division as keyof typeof divisionMapping]) ?? [];
        }
        if (category === 'section') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return base.filter(b => targetShopArray.includes(b.shop)) ?? [];
        }
        if (category === 'section_lastYear') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return baseLastYear.filter(b => targetShopArray.includes(b.shop)) ?? [];
        }
        if (category === 'staff') {
            return base.filter(b => b.staff == staff && b.shop === shop) ?? [];
        }
        if (category === 'staff_lastYear') {
            return baseLastYear.filter(b => b.staff == staff) ?? [];
        }
        if (category === 'shop') {
            return base.filter(b => b.shop === shop) ?? [];
        }
        if (category === 'shop_lastYear') {
            return baseLastYear.filter(b => b.shop === shop) ?? [];
        }
        return [];
    };

    const calculateContractListBroker = (list: Customer[], category: string, month?: string, division?: string, section?: string, shop?: string, staff?: string) => {
        if (division && division !== '建売分譲事業') return [];
        if (!list || !Array.isArray(list)) return [];
        const base = list.filter(c => c.contract_broker && c.category === '建売' && (c.status === '契約済み' || c.status === '解約') && (month ? dateFormate(c.contract_broker).includes(dateFormate(month)) : monthArray.includes(monthFormate(c.contract_broker))));
        const baseLastYear = list.filter(c => c.contract_broker && c.category === '建売' && (c.status === '契約済み' || c.status === '解約') && (month ? dateFormate(c.contract_broker).includes(lastYearMonthFormate(month, '/') ?? '') : lastYearMonthArray.includes(monthFormate(c.contract_broker))));

        if (category === 'group' || category === 'division') {
            return base ?? [];
        }
        if (category === 'group_lastYear' || category === 'division_lastYear') {
            return baseLastYear ?? [];
        }
        if (category === 'section') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return base.filter(b => targetShopArray.includes(b.shop)) ?? [];
        }
        if (category === 'section_lastYear') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return baseLastYear.filter(b => targetShopArray.includes(b.shop)) ?? [];
        }
        if (category === 'staff') {
            return base.filter(b => b.staff == staff && b.shop === shop) ?? [];
        }
        if (category === 'staff_lastYear') {
            return baseLastYear.filter(b => b.staff == staff) ?? [];
        }
        if (category === 'shop') {
            return base.filter(b => b.shop === shop) ?? [];
        }
        if (category === 'shop_lastYear') {
            return baseLastYear.filter(b => b.shop === shop) ?? [];
        }
        return [];
    };

    const showCustomer = (list: Customer[]) => {
        if (list.length === 0) return;
        setShow(true);
        setContract(list);
        console.log(list)
    };


    const aggregatedContracts = useMemo(() => {
        // --- 1. 全体 (Group) ---
        const groupTotal = calculateContractList(customerList, 'group') ?? [];
        const groupLastYear = calculateContractList(customerList, 'group_lastYear') ?? [];

        const groupTotal_broker = calculateContractListBroker(customerList, 'group') ?? [];
        const groupLastYear_broker = calculateContractListBroker(customerList, 'group_lastYear') ?? [];

        const group = {
            total: groupTotal,
            lastYear: groupLastYear,
            monthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(groupTotal, 'group', m)])),
            lastYearMonthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(groupLastYear, 'group_lastYear', m)])),
            total_broker: groupTotal_broker,
            lastYear_broker: groupLastYear_broker,
            monthly_broker: Object.fromEntries(monthArray.map(m => [m, calculateContractListBroker(groupTotal_broker, 'group', m)])),
            lastYearMonthly_broker: Object.fromEntries(monthArray.map(m => [m, calculateContractListBroker(groupLastYear_broker, 'group_lastYear', m)]))
        };

        // --- 2. 事業部 (Division) ---
        const divisions = Object.fromEntries(divisionArray.map(div => {
            const total = calculateContractList(groupTotal, 'division', '', div) ?? [];
            const lastYear = calculateContractList(groupLastYear, 'division_lastYear', '', div) ?? [];

            const total_broker = calculateContractListBroker(groupTotal_broker, 'division', '', div) ?? [];
            const lastYear_broker = calculateContractListBroker(groupLastYear_broker, 'division_lastYear', '', div) ?? [];

            return [div, {
                total,
                lastYear,
                monthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(total, 'division', m, div)])),
                lastYearMonthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(lastYear, 'division_lastYear', m, div)])),
                total_broker,
                lastYear_broker,
                monthly_broker: Object.fromEntries(monthArray.map(m => [m, calculateContractListBroker(total_broker, 'division', m, div)])),
                lastYearMonthly_broker: Object.fromEntries(monthArray.map(m => [m, calculateContractListBroker(lastYear_broker, 'division_lastYear', m, div)]))
            }];
        }));

        // --- 3. 課 (Section) ---
        const sections = Object.fromEntries(sectionList.map(sec => {
            const total = calculateContractList(divisions[sec.division]?.total || [], 'section', '', '', sec.name) ?? [];
            const lastYear = calculateContractList(divisions[sec.division]?.lastYear || [], 'section_lastYear', '', '', sec.name) ?? [];

            const total_broker = calculateContractListBroker(divisions[sec.division]?.total_broker || [], 'section', '', '', sec.name) ?? [];
            const lastYear_broker = calculateContractListBroker(divisions[sec.division]?.lastYear_broker || [], 'section_lastYear', '', '', sec.name) ?? [];

            return [sec.name, {
                total,
                lastYear,
                monthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(total, 'section', m, '', sec.name)])),
                lastYearMonthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(lastYear, 'section_lastYear', m, '', sec.name)])),
                total_broker,
                lastYear_broker,
                monthly_broker: Object.fromEntries(monthArray.map(m => [m, calculateContractListBroker(total_broker, 'section', m, '', sec.name)])),
                lastYearMonthly_broker: Object.fromEntries(monthArray.map(m => [m, calculateContractListBroker(lastYear_broker, 'section_lastYear', m, '', sec.name)]))
            }];
        }));

        // --- 4. 店舗 (Shop) ---
        const shops = Object.fromEntries(shopList.map(shp => {
            const total = calculateContractList(sections[shp.section]?.total || [], 'shop', '', '', '', shp.shop) ?? [];
            const lastYear = calculateContractList(sections[shp.section]?.lastYear || [], 'shop_lastYear', '', '', '', shp.shop) ?? [];

            const total_broker = calculateContractListBroker(sections[shp.section]?.total_broker || [], 'shop', '', '', '', shp.shop) ?? [];
            const lastYear_broker = calculateContractListBroker(sections[shp.section]?.lastYear_broker || [], 'shop_lastYear', '', '', '', shp.shop) ?? [];

            return [shp.shop, {
                total,
                lastYear,
                total_broker,
                lastYear_broker
            }];
        }));

        return { group, divisions, sections, shops };

    }, [customerList, targetYear, monthArray, lastYearMonthArray, divisionArray, sectionList, shopList]);


    const contractTable = (section: Section, division: string, sectionColor: string, sectionProspectList: Customer[]) => {
        return <>{shopList
            // ⚠️ まとめ表示のとき、子店舗の行を隠す（isVisibleShop の宣言箇所参照）
            .filter(shop => shop.section === section.name && !shop.shop.includes('FH') && isVisibleShop(shop.shop))
            .map(shop => {
                /** この行が受け持つ店舗名。まとめ表示なら親＋子 */
                const shopNames = shopNamesOf(shop.shop);

                /**
                 * 担当営業の行。
                 *
                 * ⚠️⚠️ **まとめ表示では氏名で重複排除する。**
                 *   併売店の担当営業は**同じ人が各ブランド店舗に登録されている**
                 *   （2026-09-10 実データ: 中野 健太 は KH加世田店 /
                 *     DJH加世田店 / なごみ加世田店 の3行、
                 *     迫 隆広 は KH鹿屋店 / DJH鹿屋店 の2行）。
                 *   排除しないと同じ人が3行並ぶ。
                 *
                 * ⚠️ 残すのは**親店舗の行**を優先する。`sort` の値が
                 *   店舗ごとに違うため（迫 隆広: DJH鹿屋店=0 / KH鹿屋店=5）、
                 *   どちらを残すかで並び順が変わる。親の意図を採る。
                 *
                 * ⚠️⚠️ **`new Map(entries)` で重複排除してはいけない。**
                 *   同じキーが複数あると**後の値で上書きされる**ため、
                 *   親を先に並べても子の行が勝ってしまう
                 *   （2026-09-10 に実データの検証で発覚）。
                 *   `has()` で「先に入ったものを残す」ことを明示する。
                 */
                const shopStaffList = showMulti
                    ? (() => {
                        const seen = new Map<string, Staff>();
                        // shopNames は [親, ...子] の順。先に入る＝親が残る
                        shopNames.forEach(name => {
                            staffList
                                .filter(st => st.shop === name && st.report === 1)
                                .forEach(st => {
                                    if (!seen.has(st.name)) seen.set(st.name, st);
                                });
                        });
                        return Array.from(seen.values());
                    })()
                    : staffList.filter(st => st.shop === shop.shop && st.report === 1);

                return [...shopStaffList, { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 }, { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                    .sort(staffSorter()).filter(staff => staff.report === 1)
                    .map((staff, staffIndex) => {
                        const staffLength = shopStaffList.length + 2;
                        const isShop = staffIndex === staffLength - 1;

                        /**
                         * ⚠️⚠️ まとめ表示では親＋子の集計を足し合わせる。
                         *   `aggregatedContracts.shops` は店舗名で引ける形になっているので、
                         *   子の分をそのまま連結すればよい。
                         *   ⚠️ 集計そのもの（shops の作り方）は変えていない。
                         *     変えると課・事業部の合計に影響する。
                         */
                        const baseShopTotal = shopNames.flatMap(n => aggregatedContracts.shops[n]?.total ?? []);
                        const baseShopTotalBroker = shopNames.flatMap(n => aggregatedContracts.shops[n]?.total_broker ?? []);

                        const shopContract = isShop ? baseShopTotal : baseShopTotal.filter(o => {
                            // ⚠️ 店舗の条件も親＋子に広げる。広げないと子の契約が拾えない
                            return (o.staff === staff.name && shopNames.includes(o.shop ?? ''))
                        });
                        const shopContractBroker = isShop ? baseShopTotalBroker : baseShopTotalBroker.filter(o => {
                            return (o.staff === staff.name && shopNames.includes(o.shop ?? ''))
                        });

                        const baseShopLastYear = shopNames.flatMap(n => aggregatedContracts.shops[n]?.lastYear ?? []);
                        const baseShopLastYearBroker = shopNames.flatMap(n => aggregatedContracts.shops[n]?.lastYear_broker ?? []);

                        const shopContractLastYear = isShop ? baseShopLastYear : calculateContractList(baseShopLastYear, 'staff_lastYear', '', '', '', shop.shop, staff.name)
                        const shopContractLastYearBroker = isShop ? baseShopLastYearBroker : calculateContractListBroker(baseShopLastYearBroker, 'staff_lastYear', '', '', '', shop.shop, staff.name)

                        const baseDivTotal = aggregatedContracts.divisions[division]?.total || [];
                        const multiContract = baseDivTotal.filter(o => {
                            return isShop ? o.shop?.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name
                        });

                        const isStaff = staffIndex < staffLength - 2;
                        const isAchievement = staffIndex === staffLength - 2;
                        /**
                         * ⚠️⚠️ まとめ表示のときは括弧の併売数を出さない。
                         *   本数そのものが既に子店舗を含んでいるため、
                         *   `27(27)` のように同じ数を二度見せることになる。
                         *
                         * ⚠️ 括弧の中身（multiContract）は店舗名からブランド名を
                         *   除いた**部分一致**で数えている推測値である。
                         *   parent_shop による明示指定に置き換わるのは
                         *   まとめ表示のときだけで、従来表示はそのまま残す。
                         */
                        const isShopMulti = shop.multi === 1 && !showMulti;
                        const isStaffMulti = staff.multi === 1 && !showMulti;
                        const cancelList = shopContract.filter(o => o.status === '解約');

                        return (
                            <React.Fragment key={`${shop.shop}-${staff.name}`}>
                                <tr className={staffIndex === 0 ? 'target-top' : staffIndex === staffLength - 1 ? 'target-bottom' : ''}
                                    id={staffIndex === 0 ? shop.shop : ''}>
                                    {staffIndex === 0 && <td rowSpan={staffLength} className={`${sectionColor} text-center align-middle sticky-column`}>{shop.shop}</td>}
                                    <td className={staffIndex === staffLength - 2 ? 'table-danger text-danger sticky-column next' :
                                        staffIndex === staffLength - 1 ? 'table-primary text-primary sticky-column next' : 'sticky-column next'}>{staff.name}</td>
                                    {[...monthArray, 'total'].map((month, monthIndex) => {
                                        const isTotal = monthIndex === monthArray.length;
                                        const shopPeriodContract = shopContract.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                        const shopPeriodContractBroker = shopContractBroker.filter(o => dateFormate(o.contract_broker).includes(dateFormate(month)));

                                        const shopPeriodContractLastYear = isShop ? calculateContractList(shopContractLastYear, 'shop_lastYear', month, '', '', shop.shop) : calculateContractList(shopContractLastYear, 'staff_lastYear', month, '', '', shop.shop, staff.name)
                                        const shopPeriodContractLastYearBroker = isShop ? calculateContractListBroker(shopContractLastYearBroker, 'shop_lastYear', month, '', '', shop.shop) : calculateContractListBroker(shopContractLastYearBroker, 'staff_lastYear', month, '', '', shop.shop, staff.name)

                                        const multiPeriodContract = multiContract.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                        const targetShop = achievement.find(a => a.category === 'shop' && a.name === shop.shop && a.period === month)?.value ?
                                            achievement.find(a => a.category === 'shop' && a.name === shop.shop && a.period === month)?.value : '';
                                        const achievementLength = achievement.filter(a =>
                                            a.category === 'shop' &&
                                            a.name === shop.shop &&
                                            monthArray.includes(monthFormate(a.period))
                                        ).reduce((cur, acc) => cur + Number(acc.value), 0);
                                        const periodCancelList = shopPeriodContract.filter(o => o.status === '解約');
                                        return (
                                            <React.Fragment key={monthIndex}>
                                                {isAchievement &&
                                                    <td className='text-center text-danger table-danger' colSpan={isTotal ? 2 : 1}>
                                                        {isTotal ?
                                                            achievementLength
                                                            : <input
                                                                type="text"
                                                                className="company_input text-danger"
                                                                value={targetShop}
                                                                onChange={(e) => changeAchievement(month, 'shop', shop.shop, e.target.value)}
                                                            />}</td>}
                                                {(isStaff || isShop) &&
                                                    <td className={((isTotal && (shopContract.length > 0 || shopContractBroker.length > 0)) || (shopPeriodContract.length > 0 || shopPeriodContractBroker.length > 0)) ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                        onClick={((isTotal && (shopContract.length > 0 || shopContractBroker.length > 0)) || (shopPeriodContract.length > 0 || shopPeriodContractBroker.length > 0)) ? () => {
                                                            setShow(true);
                                                            setContract(isTotal ? [...shopContract, ...shopContractBroker] : [...shopPeriodContract, ...shopPeriodContractBroker]);
                                                        } : undefined}
                                                        colSpan={(isTotal && isShop) ? 2 : 1}>
                                                        <div className='position-relative'>
                                                            {isShop ?
                                                                (isTotal ? `${shopContract.length}${isShopMulti ? `(${multiContract.length})` : ''}` : `${shopPeriodContract.length}${isShopMulti ? `(${multiPeriodContract.length})` : ''}`)
                                                                : (isTotal ? `${shopContract.length}${isStaffMulti ? `(${multiContract.length})` : ''}` : shopPeriodContract.length)
                                                            }
                                                            {isTotal ?
                                                                (shopContractBroker.length > 0 && <span className="text-success ms-1">({shopContractBroker.length})</span>) :
                                                                (shopPeriodContractBroker.length > 0 && <span className="text-success ms-1">({shopPeriodContractBroker.length})</span>)
                                                            }
                                                            {isTotal ?
                                                                ((showCancel && cancelList.length > 0) ? <span style={cancelStyle}>{cancelList.length}</span> : '') :
                                                                ((showCancel && periodCancelList.length > 0) ? <span style={cancelStyle}>{periodCancelList.length}</span> : '')}
                                                            {(showLastYear && shopContractLastYear !== null) && <div className='position-absolute'
                                                                style={{ ...lastYearStyle, right: isTotal && isShop ? '23px' : '-5px' }}>
                                                                {isTotal ? (shopContractLastYear ?? []).length : (shopPeriodContractLastYear ?? []).length}
                                                                {isTotal ?
                                                                    ((shopContractLastYearBroker ?? []).length > 0 && <span className="text-success ms-1">({(shopContractLastYearBroker ?? []).length})</span>) :
                                                                    ((shopPeriodContractLastYearBroker ?? []).length > 0 && <span className="text-success ms-1">({(shopPeriodContractLastYearBroker ?? []).length})</span>)
                                                                }
                                                            </div>}
                                                        </div>
                                                    </td>
                                                }
                                            </React.Fragment>
                                        )
                                    })}
                                    {(() => {
                                        const target = achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value ? achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value : '';
                                        return (staffIndex !== staffLength - 2 && staffIndex !== staffLength - 1) &&
                                            <td className='text-danger company_contract text-center'
                                            ><input
                                                    type="text"
                                                    className="company_input text-danger"
                                                    value={target}
                                                    onChange={(e) => changeAchievement(monthArray[0].slice(0, 7), 'staff', staff.name, e.target.value)}
                                                /></td>;
                                    })()}
                                    <td className='table-none-border'></td>
                                    {rankArray.map(r => {
                                        const isStaff = staffIndex !== staffLength - 2 && staffIndex !== staffLength - 1;
                                        const target = r === '契約済み' ?
                                            shopContract.filter(o => dateFormate(o.contract).includes(formattedThisMonth)) :
                                            // ⚠️ matchesRank を使う。建売のSランクは当月契約のみ（宣言箇所参照）
                                            sectionProspectList.filter(o => matchesRank(o, r) && (isStaff ? o.staff === staff.name : o.shop === shop.shop));

                                        const targetBroker = r === '契約済み' ?
                                            shopContractBroker.filter(o => dateFormate(o.contract_broker).includes(formattedThisMonth)) : [];

                                        return (
                                            staffIndex !== staffLength - 1 && <TableContract key={r} list={target} brokerList={targetBroker} row={staffIndex === staffLength - 2 ? 2 : 1} col={1} lastYear={null} />
                                        )
                                    })}
                                </tr>
                            </React.Fragment>
                        )
                    })
            })}</>
    };

    const budgetTotal = (list: Customer[]) => {
        return list.reduce((acc, cur) =>
            acc + Math.round(Number(cur.contraction_contract_price ?? 0) * 10), 0
        ) / 10;
    };

    const contractTable_used = () => {
        const targetShops = shopList.filter(s => s.section === '中古住宅専門店');
        const bgColor = ['table-primary', 'table-success'];

        return <>
            {targetShops.map((s, sIndex) => {
                const targetStaffs = staffList.filter(st => st.shop === s.shop);
                return <React.Fragment key={s.shop}>
                    {[...targetStaffs,
                    { name: '予算', shop: s.shop, section: '中古住宅専門店', report: 1, sort: 0, multi: 0 },
                    { name: '実績', shop: s.shop, section: '中古住宅専門店', report: 1, sort: -1, multi: s.multi }]
                        .sort(staffSorter())
                        .map((staff, staffIndex) => {
                            const baseLength = targetStaffs.filter(t => t.shop === s.shop).length;
                            const isShop = staffIndex === baseLength + 1;
                            const isStaff = staffIndex <= baseLength - 1;
                            const isAchievement = staffIndex === baseLength;
                            const usedStaffs = usedContractList.filter(u => isShop ? targetStaffs.map(t => t.name).includes(u.staff) : u.staff === staff.name);
                            const totalContracts = usedStaffs.filter(u =>
                                monthArray.includes(monthFormate(u.contract_reform)) ||
                                monthArray.includes(monthFormate(u.contract_sell)) ||
                                monthArray.includes(monthFormate(u.contract_buy))
                            );
                            const totalBudget = budgetTotal(totalContracts);
                            const shopContractLastYear = budgetTotal(usedStaffs.filter(u =>
                                lastYearMonthArray.includes(monthFormate(u.contract_reform)) ||
                                lastYearMonthArray.includes(monthFormate(u.contract_sell)) ||
                                lastYearMonthArray.includes(monthFormate(u.contract_buy))
                            ));
                            const staffLength = staffList.filter(staff => staff.shop === s.shop && staff.report === 1).length + 2;
                            return (
                                <tr key={`${s.shop}-${staff.name}`}>
                                    {staffIndex === 0 && <td className={`${bgColor[sIndex]} sticky-column`} rowSpan={targetStaffs.length + 2}>{s.shop}</td>}
                                    <td className={`sticky-column next ${isShop ? 'text-primary table-primary' : ''} ${isAchievement ? 'text-danger table-danger' : ''}`}>{staff.name}</td>
                                    {[...monthArray, 'total'].map((month, monthIndex) => {
                                        const isTotal = monthIndex === monthArray.length;
                                        const periodContracts = usedStaffs.filter(u =>
                                            dateFormate(u.contract_reform).includes(dateFormate(month)) ||
                                            dateFormate(u.contract_sell).includes(dateFormate(month)) ||
                                            dateFormate(u.contract_buy).includes(dateFormate(month))
                                        );
                                        const periodBudget = budgetTotal(periodContracts);
                                        const lastMonth = `${Number(month.split('-')[0] ?? 0) - 1}-${month.split('-')[1]}`
                                        const shopPeriodContractLastYear = budgetTotal(usedStaffs.filter(u =>
                                            dateFormate(u.contract_reform).includes(dateFormate(lastMonth)) ||
                                            dateFormate(u.contract_sell).includes(dateFormate(lastMonth)) ||
                                            dateFormate(u.contract_buy).includes(dateFormate(lastMonth))
                                        ));
                                        const shopAchievement = achievement.filter(a =>
                                            a.category === 'shop' &&
                                            a.name === s.shop &&
                                            (isTotal ? monthArray.includes(monthFormate(a.period)) : dateFormate(a.period) === dateFormate(month))
                                        ).reduce((cur, acc) => cur + Number(acc.value), 0);
                                        const staffAchievement = achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value ? achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value : '';
                                        if (isTotal) {
                                            return (
                                                <React.Fragment key={monthIndex}>
                                                    {isAchievement &&
                                                        <td className='text-center text-danger table-danger' colSpan={2}>
                                                            {shopAchievement.toLocaleString()}
                                                        </td>}
                                                    {isShop &&
                                                        <td className={totalBudget > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                            onClick={totalBudget > 0 ? () => {
                                                                setShow(true);
                                                                setContract(isTotal ? totalContracts : periodContracts);
                                                            } : undefined}
                                                            colSpan={2}>
                                                            <div className='position-relative'>
                                                                {totalBudget.toLocaleString()}
                                                                {(showLastYear && shopContractLastYear !== null) && <div className='position-absolute'
                                                                    style={{ ...lastYearStyle, right: '23px' }}>
                                                                    {isTotal ? (shopContractLastYear ?? 0) : (shopPeriodContractLastYear ?? 0)
                                                                    }</div>}
                                                            </div>
                                                        </td>
                                                    }
                                                    {isStaff &&
                                                        <>
                                                            <td className='text-danger company_contract text-center'
                                                            ><input
                                                                    type="text"
                                                                    className="company_input text-danger"
                                                                    value={staffAchievement}
                                                                    onChange={(e) => changeAchievement(monthArray[0].slice(0, 7), 'staff', staff.name, e.target.value)}
                                                                />
                                                            </td>
                                                            <td className={totalBudget > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                                onClick={totalBudget > 0 ? () => {
                                                                    setShow(true);
                                                                    setContract(isTotal ? totalContracts : periodContracts);
                                                                } : undefined}
                                                                colSpan={1}>
                                                                <div className='position-relative'>
                                                                    {totalBudget.toLocaleString()}
                                                                    {(showLastYear && shopContractLastYear !== null) && <div className='position-absolute'
                                                                        style={{ ...lastYearStyle, right: '23px' }}>
                                                                        {isTotal ? (shopContractLastYear ?? 0) : (shopPeriodContractLastYear ?? 0)
                                                                        }</div>}
                                                                </div>
                                                            </td>
                                                        </>
                                                    }
                                                </React.Fragment>
                                            );
                                        } else {
                                            return (
                                                <React.Fragment key={monthIndex}>
                                                    {isAchievement &&
                                                        <td className='text-center text-danger table-danger' colSpan={1}>
                                                            {(shopAchievement || 0).toLocaleString()}
                                                        </td>}
                                                    {isShop &&
                                                        <td className={periodBudget > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                            onClick={periodBudget > 0 ? () => {
                                                                setShow(true);
                                                                setContract(periodContracts);
                                                            } : undefined}
                                                            colSpan={1}>
                                                            <div className='position-relative'>
                                                                {periodBudget.toLocaleString()}
                                                                {(showLastYear && shopContractLastYear !== null) && <div className='position-absolute'
                                                                    style={{ ...lastYearStyle, right: '23px' }}>
                                                                    {isTotal ? (shopContractLastYear ?? 0) : (shopPeriodContractLastYear ?? 0)
                                                                    }</div>}
                                                            </div>
                                                        </td>
                                                    }
                                                    {isStaff && <td
                                                        className={periodBudget > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                        onClick={periodBudget > 0 ? () => {
                                                            setShow(true);
                                                            setContract(periodContracts);
                                                        } : undefined}
                                                    >
                                                        {periodBudget > 0 ? periodBudget.toLocaleString() : 0}
                                                    </td>}
                                                </React.Fragment>
                                            );
                                        }
                                    })}

                                    <td className='table-none-border'></td>
                                    {rankArray.map(r => {
                                        const total = r === '契約済み' ?
                                            usedList.filter(o => o.status === '契約済み' && o.staff === staff.name && (dateFormate(o.contract_reform).includes(formattedThisMonth) || dateFormate(o.contract_sell).includes(formattedThisMonth) || dateFormate(o.contract_buy).includes(formattedThisMonth)))
                                                .map(u => ({
                                                    ...u,
                                                    price: String(Number(u.contraction_contract_price ?? 0))
                                                })) :
                                            usedList.filter(o => o.status === '見込み' && safeFormate(o.rank).includes(r) && (o.staff === staff.name))
                                                .map(u => ({
                                                    ...u,
                                                    price: String(Number(u.contract_land_application_date ?? 0) + Number(u.contract_building_application_date ?? 0))
                                                }));
                                        const shopTotal = r === '契約済み' ?
                                            usedList.filter(o => o.status === '契約済み' && targetStaffs.map(t => t.name).includes(o.staff) && (dateFormate(o.contract_reform).includes(formattedThisMonth) || dateFormate(o.contract_sell).includes(formattedThisMonth) || dateFormate(o.contract_buy).includes(formattedThisMonth)))
                                                .map(u => ({
                                                    ...u,
                                                    price: String(Number(u.contraction_contract_price ?? 0))
                                                })) :
                                            usedList.filter(o => o.status === '見込み' && safeFormate(o.rank).includes(r) && (targetStaffs.map(t => t.name).includes(o.staff)))
                                                .map(u => ({
                                                    ...u,
                                                    price: String(Number(u.contract_land_application_date ?? 0) + Number(u.contract_building_application_date ?? 0))
                                                }));
                                        return (
                                            staffIndex !== staffLength - 1 && <TableContract key={r} list={staffIndex === staffLength - 2 ? shopTotal : total} row={staffIndex === staffLength - 2 ? 2 : 1} col={1} lastYear={null} division='中古リノベ' />
                                        )
                                    }
                                    )}
                                </tr>
                            );
                        })}
                </React.Fragment>
            })}
        </>
    };

    return (
        <>
            <div className='content company bg-white p-0'>
                {!isSp &&
                    <div className="d-flex align-items-center" style={sortStyle}>
                        <div className="bg-white m-1">
                            <select className='target' onChange={(e) => setTargetYear(Number(e.target.value))}
                                value={String(targetYear)}>
                                {getYears().map((year => <option key={year} value={year}>{year}年5月期</option>))}
                            </select>
                        </div>
                        <div className="bg-white m-1">
                            <select className='target' onChange={(e) => moveToTarget(e.target.value)}>
                                <option value={divisionArray[0]}>事業部を選択</option>
                                {divisionArray.map((division, index) =>
                                    <option key={index} value={division}>{division}</option>
                                )}
                            </select>
                        </div>
                        <div className="bg-white m-1">
                            <select className='target' onChange={(e) => moveToTarget(e.target.value)}>
                                <option value={divisionArray[0]}>課を選択</option>
                                {sectionList.map((section, index) =>
                                    <option key={index} value={section.name}>{section.name}</option>
                                )}
                            </select>
                        </div>
                        <div className="bg-white m-1">
                            <select className='target' onChange={(e) => moveToTarget(e.target.value)}>
                                <option value={divisionArray[0]}>店舗を選択</option>
                                {/* ⚠️ まとめ表示中は隠れている店舗を選ばせない（スクロール先が無い） */}
                                {shopList.filter(s => s.section && isVisibleShop(s.shop)).map((shop, index) =>
                                    <option key={index} value={shop.shop}>{shop.brand === 'KHF' && `${shop.division}_`}{shop.shop}</option>
                                )}
                            </select>
                        </div>
                        {(category === 'order' || category === 'spec') &&
                            <div className={`text-white bg-${category === 'order' ? 'primary' : 'success'} rounded-pill px-2 py-1 mx-1 shadow-sm`} style={{ fontSize: '10px', cursor: 'pointer' }}
                                onClick={() => setShowRanking(true)}>契約棟数ランキング</div>}
                        <div className="bg-white m-1">
                            <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'><input type='checkbox' className='me-1'
                                onChange={() => setShowLastYear(!showLastYear)} />昨年実績を表示</label>
                        </div>
                        <div className="bg-white m-1">
                            <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'><input type='checkbox' className='me-1'
                                checked={showCancel}
                                onChange={() => setShowCancel(!showCancel)} />キャンセル数を表示</label>
                        </div>
                        {/* ⚠️ 親店舗が1つも設定されていないときは出さない。
                            押しても何も起きないチェックボックスになるため。
                            設定は shop_list.parent_shop（運用側が手作業で入れる）。 */}
                        {mergedChildShops.size > 0 &&
                            <div className="bg-white m-1">
                                <label style={{ fontSize: '12px', cursor: 'pointer' }} className='d-flex align-items-center'><input type='checkbox' className='me-1'
                                    checked={showMulti}
                                    onChange={() => setShowMulti(!showMulti)} />併売店をまとめる</label>
                            </div>}
                    </div>}
                <div style={{ transform: isSp ? '' : 'translateY(60.5px)' }}>
                    <Table bordered style={tableStyle(isSp)} >
                        <tbody className='align-middle'>
                            {/* 以下グループ */}
                            <tr className='text-center target-bottom sticky-header'>
                                <td colSpan={2} style={tdStyle(isSp)} className='sticky-column'>{Number(targetYear) - 1}/06~{Number(targetYear)}/05</td>
                                {monthArray.map(month =>
                                    <td className='text-center' style={tdStyle(isSp)} key={month}>{dateFormate(month)}</td>
                                )}
                                <td style={tdStyle(isSp)}>合計</td>
                                <td style={tdStyle(isSp)}>個人目標</td>
                                <td className='table-none-border'></td>
                                {rankArray.map(r =>
                                    <td className='text-center' style={tdStyle(isSp)} key={r}>{r}</td>
                                )}
                            </tr>
                            <tr className='target-top sticky-header next_top'>
                                <td colSpan={2} className='text-center table-danger text-danger sticky-column' style={{ letterSpacing: '1px' }}>グループ予算</td>
                                {monthArray.map(month => {
                                    return <TableAchievement key={month} list={achievementLength('group', month) ?? null} row={1} col={1} lastYear={achievementLength('group_lastYear', month) ?? null} />;
                                })}
                                <TableAchievement list={achievementLength('group') ?? null} row={1} col={2} lastYear={achievementLength('group_lastYear') ?? 0} />
                                <td className='table-none-border'></td>
                                {rankArray.map((r, index) => {
                                    // ⚠️ isProspect を使う。建売は status を見ない（宣言箇所のコメント参照）
                                    const orderProspectList = customerList.filter(o => isProspect(o) && (o.rank_period <= formattedThisMonth || !o.rank_period));
                                    const target = r === '契約済み' ?
                                        (aggregatedContracts.group.monthly?.[monthFormate(formattedThisMonth)] || []) :
                                        // ⚠️ matchesRank を使う。建売のSランクは当月契約のみ（宣言箇所参照）
                                        orderProspectList.filter(o => matchesRank(o, r));
                                    const targetBroker = r === '契約済み' ?
                                        (aggregatedContracts.group.monthly_broker?.[monthFormate(formattedThisMonth)] || []) : [];
                                    return <TableContract key={index} list={target} brokerList={targetBroker} row={2} col={1} lastYear={null} />
                                })}
                            </tr>
                            <tr className='sticky-header third_top'>
                                <td colSpan={2} className='text-center text-primary table-primary sticky-column' style={{ letterSpacing: '1px' }}>グループ実績</td>
                                {monthArray.map(month => {
                                    return <TableContract key={month} list={aggregatedContracts.group.monthly?.[month] || []} brokerList={aggregatedContracts.group.monthly_broker?.[month] || []} row={1} col={1} lastYear={aggregatedContracts.group.lastYearMonthly?.[month] || []} lastYearBroker={aggregatedContracts.group.lastYearMonthly_broker?.[month] || []} />
                                })}
                                <TableContract list={aggregatedContracts.group.total || []} brokerList={aggregatedContracts.group.total_broker || []} row={1} col={2} lastYear={aggregatedContracts.group.lastYear || []} lastYearBroker={aggregatedContracts.group.lastYear_broker || []} />
                                <td className='table-none-border'></td>
                            </tr>
                            {/* 以下部門別 */}
                            {divisionArray.map((division, divisionIndex) => {
                                /**
                                 * この事業部の見込み客。
                                 * ⚠️ ここから課（sectionProspectList）→ 店舗・担当営業へ
                                 *   受け渡されるので、**ここを直せば下まで直る。**
                                 * ⚠️ isProspect を使う。建売は status を見ない（宣言箇所のコメント参照）
                                 */
                                const prospectList = customerList.filter(o => isProspect(o) && (o.rank_period <= formattedThisMonth || !o.rank_period) && o.category === divisionMapping[division as keyof typeof divisionMapping]);
                                const targetTotalList = usedContractList.filter(u =>
                                    monthArray.includes(monthFormate(u.contract_reform)) ||
                                    monthArray.includes(monthFormate(u.contract_buy)) ||
                                    monthArray.includes(monthFormate(u.contract_sell))
                                ).map(u => ({
                                    ...u,
                                    price: String(Number(u.contraction_contract_price ?? 0))
                                }));
                                return <React.Fragment key={divisionIndex}>
                                    <tr className='target-top' id={division} key={division}>
                                        <td rowSpan={2} style={{ backgroundColor: '#272727ff', color: '#f7f7f7' }} className='text-center align-middle sticky-column'>{division}</td>
                                        <td className='table-danger text-danger sticky-column next'>予算</td>
                                        {monthArray.map(month => {
                                            return <TableAchievement key={month} list={achievementLength('division', month, division) ?? null} row={1} col={1} lastYear={achievementLength('division_lastYear', month, division) ?? 0} />;
                                        })}
                                        <TableAchievement list={achievementLength('division', '', division) ?? null} row={1} col={2} lastYear={achievementLength('division_lastYear', '', division) ?? 0} />
                                        <td className='table-none-border'></td>
                                        {rankArray.map(r => {
                                            const targetList = r === '契約済み' ?
                                                (aggregatedContracts.divisions[division]?.monthly?.[monthFormate(formattedThisMonth)] || []) :
                                                // ⚠️ matchesRank を使う。建売のSランクは当月契約のみ（宣言箇所参照）
                                                prospectList.filter(o => matchesRank(o, r));
                                            const targetUsedList = r === '契約済み' ? usedList.filter(u => u.status === '契約済み'
                                                && (monthFormate(u.contract_reform).includes(monthFormate(formattedThisMonth))
                                                    || monthFormate(u.contract_buy).includes(monthFormate(formattedThisMonth)) || monthFormate(u.contract_sell).includes(monthFormate(formattedThisMonth))))
                                                .map(u => ({
                                                    ...u,
                                                    price: String(Number(u.contraction_contract_price ?? 0))
                                                })) :
                                                usedList.filter(u => u.status !== '契約済み' && safeFormate(u.rank)?.includes(r))
                                                    .map(u => ({
                                                        ...u,
                                                        price: String(Number(u.contract_land_application_date ?? 0) + Number(u.contract_building_application_date ?? 0))
                                                    }));;

                                            const targetBrokerList = r === '契約済み' ?
                                                (aggregatedContracts.divisions[division]?.monthly_broker?.[monthFormate(formattedThisMonth)] || []) : [];

                                            return <TableContract key={r} list={division === '中古リノベ' ? targetUsedList : targetList} brokerList={targetBrokerList} row={2} col={1} lastYear={null} division={division} />
                                        })}
                                    </tr>
                                    <tr className='target-bottom'>
                                        <td className='table-primary text-primary sticky-column next'>実績</td>
                                        {monthArray.map((month, monthIndex) => {
                                            const targetList = usedContractList.filter(u => u.status === '契約済み' &&
                                                (dateFormate(u.contract_reform).includes(dateFormate(month)) ||
                                                    dateFormate(u.contract_buy).includes(dateFormate(month)) ||
                                                    dateFormate(u.contract_sell).includes(dateFormate(month)))
                                            ).map(u => ({
                                                ...u,
                                                price: String(Number(u.contraction_contract_price ?? 0))
                                            }));
                                            return <TableContract list={division === '中古リノベ' ? targetList : (aggregatedContracts.divisions[division]?.monthly?.[month] || [])} brokerList={aggregatedContracts.divisions[division]?.monthly_broker?.[month] || []} row={1} col={1} key={monthIndex} lastYear={aggregatedContracts.divisions[division]?.lastYearMonthly?.[month] || []} lastYearBroker={aggregatedContracts.divisions[division]?.lastYearMonthly_broker?.[month] || []} division={division} />
                                        })}
                                        <TableContract list={division === '中古リノベ' ? targetTotalList : (aggregatedContracts.divisions[division]?.total || [])} brokerList={aggregatedContracts.divisions[division]?.total_broker || []} row={1} col={2} lastYear={aggregatedContracts.divisions[division]?.lastYear || []} lastYearBroker={aggregatedContracts.divisions[division]?.lastYear_broker || []} division={division} />
                                        <td className='table-none-border'></td>
                                    </tr>
                                    {/* 以下営業課別 */}
                                    {sectionList.filter(s => s.division === division).map((section, sectionIndex) => {
                                        const sectionColors = ['table-primary', 'table-success', 'table-warning', 'table-danger', 'table-secondary', 'table-info'];
                                        const sectionColor = sectionColors[sectionIndex] || '#CCCCCC';
                                        const targetShop = shopList.filter(s => s.section === section.name).map(s => s.shop);
                                        const sectionProspectList = prospectList.filter(o => targetShop.includes(o.shop));

                                        const isHiddenSectionSummary = section.name === '中古住宅専門店';

                                        return (
                                            <React.Fragment key={section.name}>
                                                {!isHiddenSectionSummary && (
                                                    <>
                                                        <tr className='target-top' key={`top-${sectionIndex}`} id={section.name}>
                                                            <td rowSpan={2} className={`${sectionColor} text-center align-middle sticky-column`}>{section.name}</td>
                                                            <td className='table-danger text-danger sticky-column next'>予算</td>
                                                            {monthArray.map(month => {
                                                                return <TableAchievement key={month} list={achievementLength('section', month, '', section.name) ?? null} row={1} col={1} lastYear={achievementLength('section_lastYear', month, '', section.name) ?? 0} />;
                                                            })}
                                                            <TableAchievement list={achievementLength('section', '', '', section.name) ?? null} row={1} col={2} lastYear={achievementLength('section_lastYear', '', '', section.name) ?? 0} />
                                                            <td className='table-none-border'></td>
                                                            {rankArray.map(r => {
                                                                const target = r === '契約済み' ?
                                                                    (aggregatedContracts.sections[section.name]?.monthly?.[monthFormate(formattedThisMonth)] || []) :
                                                                    // ⚠️ matchesRank を使う。建売のSランクは当月契約のみ（宣言箇所参照）
                                                                    sectionProspectList.filter(o => matchesRank(o, r));
                                                                const targetBroker = r === '契約済み' ?
                                                                    (aggregatedContracts.sections[section.name]?.monthly_broker?.[monthFormate(formattedThisMonth)] || []) : [];
                                                                return <TableContract key={r} list={target} brokerList={targetBroker} row={2} col={1} lastYear={null} />
                                                            })}
                                                        </tr>
                                                        <tr className='target-bottom'>
                                                            <td className='table-primary text-primary sticky-column next'>実績</td>
                                                            {monthArray.map((month, monthIndex) => {
                                                                return <TableContract list={aggregatedContracts.sections[section.name]?.monthly?.[month] || []} brokerList={aggregatedContracts.sections[section.name]?.monthly_broker?.[month] || []} row={1} col={1} key={monthIndex} lastYear={aggregatedContracts.sections[section.name]?.lastYearMonthly?.[month] || []} lastYearBroker={aggregatedContracts.sections[section.name]?.lastYearMonthly_broker?.[month] || []} />;
                                                            })}
                                                            <TableContract list={aggregatedContracts.sections[section.name]?.total || []} brokerList={aggregatedContracts.sections[section.name]?.total_broker || []} row={1} col={2} lastYear={aggregatedContracts.sections[section.name]?.lastYear || []} lastYearBroker={aggregatedContracts.sections[section.name]?.lastYear_broker || []} />
                                                            <td className='table-none-border'></td>
                                                        </tr>
                                                    </>
                                                )}

                                                {['注文事業', '建売分譲事業'].includes(division)
                                                    ? contractTable(section, division, sectionColor, sectionProspectList)
                                                    : contractTable_used()}
                                            </React.Fragment>
                                        )
                                    })}
                                    <tr>
                                        <td></td>
                                    </tr>
                                </React.Fragment>
                            }
                            )}
                        </tbody>
                    </Table>
                </div>
            </div>
            <CustomerDetail show={show} setShow={setShow} contract={contract} setEditId={setEditId} />
            <InformationEdit id={editId.order} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} authority={authority} />
            <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} authority={authority} />
            <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} staffList={staffList} achievement={achievement}/>
        </>
    )
}

export default Company;