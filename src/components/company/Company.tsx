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
type Shop = { brand: string, shop: string, section: string, area: string, division: string, multi: number };
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
    const divisionArray: string[] = divisionListMapping[category];

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

    const monthArray: string[] = useMemo(() => {
        return getPeriod(Number(targetYear) - 1, 6);
    }, [targetYear]);

    const lastYearMonthArray: string[] = useMemo(() => {
        return getPeriod(Number(targetYear) - 2, 6);
    }, [targetYear]);

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
        row: number,
        col: number,
        lastYear: any,
        division?: string
    };

    const TableAchievement = ({ list, row, col, lastYear }: AchievementProps) => {
        return <td rowSpan={row} colSpan={col} className={list && list > 0 ? 'text-danger text-center table-danger' : 'text-center'}>
            <div className='position-relative'>{list}
                {(showLastYear && lastYear !== null) && <div className='position-absolute'
                    style={{ ...lastYearStyle, right: col === 2 ? '23px' : '-5px' }}>{lastYear}</div>}
            </div></td>
    };

    const TableContract = ({ list = [], row, col, lastYear, division }: ContractProps) => {
        const cancelList = list.filter(o => o.status === '解約');
        return <td rowSpan={row} colSpan={col} className={list.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
            onClick={() => showCustomer(list)}>
            <div className='position-relative'>
                {division === '中古リノベ' ? list.reduce((acc, cur) => acc + Number(cur?.contraction_contract_price ?? 0) * 100, 0) / 100 : <>
                    {list.length}{(showCancel && cancelList.length > 0) && <span style={cancelStyle}>{cancelList.length}</span>}
                    {(showLastYear && lastYear !== null) && <div className='position-absolute'
                        style={{ ...lastYearStyle, right: col === 2 ? '23px' : '-5px' }}>{lastYear.length}</div>}
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
            return base.filter(b => b.category === divisionMapping[division]) ?? [];
        }
        if (category === 'division_lastYear' && division) {
            return baseLastYear.filter(b => b.category === divisionMapping[division]) ?? [];
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
        if (!division || division !== '建売分譲事業') return [];
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

        const group = {
            total: groupTotal,
            lastYear: groupLastYear,
            monthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(groupTotal, 'group', m)])),
            lastYearMonthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(groupLastYear, 'group_lastYear', m)]))
        };

        // --- 2. 事業部 (Division) ---
        const divisions = Object.fromEntries(divisionArray.map(div => {
            const total = calculateContractList(groupTotal, 'division', '', div) ?? [];
            const lastYear = calculateContractList(groupLastYear, 'division_lastYear', '', div) ?? [];
            return [div, {
                total,
                lastYear,
                monthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(total, 'division', m, div)])),
                lastYearMonthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(lastYear, 'division_lastYear', m, div)]))
            }];
        }));

        // --- 3. 課 (Section) ---
        const sections = Object.fromEntries(sectionList.map(sec => {
            const total = calculateContractList(divisions[sec.division]?.total || [], 'section', '', '', sec.name) ?? [];
            const lastYear = calculateContractList(divisions[sec.division]?.lastYear || [], 'section_lastYear', '', '', sec.name) ?? [];
            return [sec.name, {
                total,
                lastYear,
                monthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(total, 'section', m, '', sec.name)])),
                lastYearMonthly: Object.fromEntries(monthArray.map(m => [m, calculateContractList(lastYear, 'section_lastYear', m, '', sec.name)]))
            }];
        }));

        // --- 4. 店舗 (Shop) ---
        const shops = Object.fromEntries(shopList.map(shp => {
            const total = calculateContractList(sections[shp.section]?.total || [], 'shop', '', '', '', shp.shop) ?? [];
            const lastYear = calculateContractList(sections[shp.section]?.lastYear || [], 'shop_lastYear', '', '', '', shp.shop) ?? [];
            return [shp.shop, {
                total,
                lastYear
                // ※店舗ごとの月次データが必要な場合はここに追加します
            }];
        }));

        return { group, divisions, sections, shops };

    }, [customerList, targetYear, monthArray, lastYearMonthArray, divisionArray, sectionList, shopList]);


    const contractTable = (section: Section, division: string, sectionColor: string, sectionProspectList: Customer[]) => {
        return <>{shopList
            .filter(shop => shop.section === section.name && !shop.shop.includes('FH'))
            .map(shop => {
                return [...staffList, { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 }, { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                    .sort(staffSorter()).filter(staff => staff.shop === shop.shop && staff.report === 1)
                    .map((staff, staffIndex) => {
                        const staffLength = staffList.filter(s => s.shop === shop.shop && s.report === 1).length + 2;
                        const isShop = staffIndex === staffLength - 1;

                        const baseShopTotal = aggregatedContracts.shops[shop.shop]?.total || [];
                        const shopContract = isShop ? baseShopTotal : baseShopTotal.filter(o => {
                            return (o.staff === staff.name && o.shop === staff.shop)
                        });

                        const baseShopLastYear = aggregatedContracts.shops[shop.shop]?.lastYear || [];
                        const shopContractLastYear = isShop ? baseShopLastYear : calculateContractList(baseShopLastYear, 'staff_lastYear', '', '', '', shop.shop, staff.name)

                        const baseDivTotal = aggregatedContracts.divisions[division]?.total || [];
                        const multiContract = baseDivTotal.filter(o => {
                            return isShop ? o.shop.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name
                        });

                        const isStaff = staffIndex < staffLength - 2;
                        const isAchievement = staffIndex === staffLength - 2;
                        const isShopMulti = shop.multi === 1;
                        const isStaffMulti = staff.multi === 1;
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
                                        const shopPeriodContractLastYear = isShop ? calculateContractList(shopContractLastYear, 'shop_lastYear', month, '', '', shop.shop) : calculateContractList(shopContractLastYear, 'staff_lastYear', month, '', '', shop.shop, staff.name)
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
                                                    <td className={((isTotal && shopContract.length > 0) || shopPeriodContract.length > 0) ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                        onClick={((isTotal && shopContract.length > 0) || shopPeriodContract.length > 0) ? () => {
                                                            setShow(true);
                                                            setContract(isTotal ? shopContract : shopPeriodContract);
                                                        } : undefined}
                                                        colSpan={(isTotal && isShop) ? 2 : 1}>
                                                        <div className='position-relative'>
                                                            {isShop ?
                                                                (isTotal ? `${shopContract.length}${isShopMulti ? `(${multiContract.length})` : ''}` : `${shopPeriodContract.length}${isShopMulti ? `(${multiPeriodContract.length})` : ''}`)
                                                                : (isTotal ? `${shopContract.length}${isStaffMulti ? `(${multiContract.length})` : ''}` : shopPeriodContract.length)
                                                            }
                                                            {isTotal ?
                                                                ((showCancel && cancelList.length > 0) ? <span style={cancelStyle}>{cancelList.length}</span> : '') :
                                                                ((showCancel && periodCancelList.length > 0) ? <span style={cancelStyle}>{periodCancelList.length}</span> : '')}
                                                            {(showLastYear && shopContractLastYear !== null) && <div className='position-absolute'
                                                                style={{ ...lastYearStyle, right: isTotal && isShop ? '23px' : '-5px' }}>
                                                                {isTotal ? (shopContractLastYear ?? []).length : (shopPeriodContractLastYear ?? []).length
                                                                }</div>}
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
                                            sectionProspectList.filter(o => safeFormate(o.rank).includes(r) && (isStaff ? o.staff === staff.name : o.shop === shop.shop));
                                        return (
                                            staffIndex !== staffLength - 1 && <TableContract key={r} list={target} row={staffIndex === staffLength - 2 ? 2 : 1} col={1} lastYear={null} />
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
                                                <React.Fragment>
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
                                                        key={month}
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
                                        const target = r === '契約済み' ?
                                            usedList.filter(o => o.staff === staff.name && (dateFormate(o.contract_reform).includes(formattedThisMonth) || dateFormate(o.contract_sell).includes(formattedThisMonth) || dateFormate(o.contract_buy).includes(formattedThisMonth))) :
                                            usedList.filter(o => safeFormate(o.rank).includes(r) && (o.staff === staff.name));
                                        return (
                                            <TableContract list={target} row={1} col={1} lastYear={null} />
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
                                {shopList.filter(s => s.section).map((shop, index) =>
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
                                    const orderProspectList = customerList.filter(o => o.status === '見込み' && (o.rank_period <= formattedThisMonth || !o.rank_period));
                                    // 💡 修正: aggregatedContracts.group を使用
                                    const target = r === '契約済み' ?
                                        (aggregatedContracts.group.monthly?.[monthFormate(formattedThisMonth)] || []) :
                                        orderProspectList.filter(o => safeFormate(o.rank)?.includes(r));
                                    return <TableContract key={index} list={target} row={2} col={1} lastYear={null} />
                                })}
                            </tr>
                            <tr className='sticky-header third_top'>
                                <td colSpan={2} className='text-center text-primary table-primary sticky-column' style={{ letterSpacing: '1px' }}>グループ実績</td>
                                {monthArray.map(month => {
                                    // 💡 修正: aggregatedContracts.group を使用
                                    return <TableContract key={month} list={aggregatedContracts.group.monthly?.[month] || []} row={1} col={1} lastYear={aggregatedContracts.group.lastYearMonthly?.[month] || []} />
                                })}
                                {/* 💡 修正: aggregatedContracts.group を使用 */}
                                <TableContract list={aggregatedContracts.group.total || []} row={1} col={2} lastYear={aggregatedContracts.group.lastYear || []} />
                                <td className='table-none-border'></td>
                            </tr>
                            {/* 以下部門別 */}
                            {divisionArray.map((division, divisionIndex) => {
                                const prospectList = customerList.filter(o => o.status === '見込み' && (o.rank_period <= formattedThisMonth || !o.rank_period) && o.category === divisionMapping[division as keyof typeof divisionMapping]);
                                const targetTotalList = usedContractList.filter(u =>
                                    monthArray.includes(monthFormate(u.contract_reform)) ||
                                    monthArray.includes(monthFormate(u.contract_buy)) ||
                                    monthArray.includes(monthFormate(u.contract_sell))
                                );
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
                                            // 💡 修正: aggregatedContracts.divisions を使用
                                            const targetList = r === '契約済み' ?
                                                (aggregatedContracts.divisions[division]?.monthly?.[monthFormate(formattedThisMonth)] || []) :
                                                prospectList.filter(o => safeFormate(o.rank)?.includes(r));
                                            const targetUsedList = r === '契約済み' ? usedList.filter(u => u.status === '契約済み'
                                                && (monthFormate(u.contract_reform).includes(monthFormate(formattedThisMonth))
                                                    || monthFormate(u.contract_buy).includes(monthFormate(formattedThisMonth)) || monthFormate(u.contract_sell).includes(monthFormate(formattedThisMonth)))) :
                                                usedList.filter(u => u.status !== '契約済み' && safeFormate(u.rank)?.includes(r));
                                            return <TableContract key={r} list={division === '中古リノベ' ? targetUsedList : targetList} row={2} col={1} lastYear={null} />
                                        })}
                                    </tr>
                                    <tr className='target-bottom'>
                                        <td className='table-primary text-primary sticky-column next'>実績</td>
                                        {monthArray.map((month, monthIndex) => {
                                            const targetList = usedContractList.filter(u => u.status === '契約済み' &&
                                                (dateFormate(u.contract_reform).includes(dateFormate(month)) ||
                                                    dateFormate(u.contract_buy).includes(dateFormate(month)) ||
                                                    dateFormate(u.contract_sell).includes(dateFormate(month)))
                                            );
                                            // 💡 修正: aggregatedContracts.divisions を使用
                                            return <TableContract list={division === '中古リノベ' ? targetList : (aggregatedContracts.divisions[division]?.monthly?.[month] || [])} row={1} col={1} key={monthIndex} lastYear={aggregatedContracts.divisions[division]?.lastYearMonthly?.[month] || []} division={division} />
                                        })}
                                        {/* 💡 修正: aggregatedContracts.divisions を使用 */}
                                        <TableContract list={division === '中古リノベ' ? targetTotalList : (aggregatedContracts.divisions[division]?.total || [])} row={1} col={2} lastYear={aggregatedContracts.divisions[division]?.lastYear || []} division={division} />
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
                                                                    sectionProspectList.filter(o => safeFormate(o.rank).includes(r));
                                                                return <TableContract key={r} list={target} row={2} col={1} lastYear={null} />
                                                            })}
                                                        </tr>
                                                        <tr className='target-bottom'>
                                                            <td className='table-primary text-primary sticky-column next'>実績</td>
                                                            {monthArray.map((month, monthIndex) => {
                                                                return <TableContract list={aggregatedContracts.sections[section.name]?.monthly?.[month] || []} row={1} col={1} key={monthIndex} lastYear={aggregatedContracts.sections[section.name]?.lastYearMonthly?.[month] || []} />;
                                                            })}
                                                            <TableContract list={aggregatedContracts.sections[section.name]?.total || []} row={1} col={2} lastYear={aggregatedContracts.sections[section.name]?.lastYear || []} />
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
            <Ranking showRanking={showRanking} setShowRanking={setShowRanking} customerList={customerList} monthArray={monthArray} />
        </>
    )
}

export default Company