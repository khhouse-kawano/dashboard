import React, { useState, useEffect, useContext, useMemo } from 'react';
import AuthContext from "../../context/AuthContext";
import Table from "react-bootstrap/Table";
import { getPeriod } from '../../utils/getPeriod';
import Modal from 'react-bootstrap/Modal';
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

    // 共通変数
    const dateFormate = (date: string) => {
        return date ? date.replace(/-/g, '/') : ''
    };
    const monthFormate = (date: string) => {
        return date ? date.replace(/\//g, '-').slice(0, 7) : ''
    };
    const lastYearMonthFormate = (date: string, type: string) => {
        if (!date) return '';
        if (type === '-') {
            const [year, month] = date.slice(0, 7).replace('/', '-').split('-');
            return `${Number(year) - 1}-${month}`;
        }
        if (type === '/') {
            const [year, month] = date.slice(0, 7).replace('/', '-').split('-');
            return `${Number(year) - 1}/${month}`;
        }
    };

    const today = new Date();
    const monthArray: string[] = useMemo(() => {
        return getPeriod(Number(targetYear) - 1, 6);
    }, [targetYear]);

    const lastYearMonthArray: string[] = useMemo(() => {
        return getPeriod(Number(targetYear) - 2, 6);
    }, [targetYear]);

    const formattedThisMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;

    const cancelStyle = { background: 'red', color: 'white', padding: '0px 3px', fontSize: '8px', borderRadius: '50%', marginLeft: '3px' };
    const lastYearStyle = { top: '10px', fontSize: '8px', backgroundColor: '#f3f3f3', width: '15px', height: '15px', borderRadius: '50%', color: '#555555' };

    const usedList = customerList.filter(c => c.category === '中専');
    const usedContractList = usedList.filter(c => c.status === '契約済み' && (c.contract_reform || c.contract_buy || c.contract_sell));
    const usedBudgetTotal = usedContractList
        .filter(u =>
            monthArray.includes(monthFormate(u.contract_reform)) ||
            monthArray.includes(monthFormate(u.contract_sell)) ||
            monthArray.includes(monthFormate(u.contract_buy))
        )
        .reduce((acc, cur) => acc + Number(cur.contraction_contract_price ?? 0), 0);

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

    const showCustomer = (list: Customer[]) => {
        if (list.length === 0) return;
        setShow(true);
        setContract(list);
        console.log(list)
    };
    // 共通変数

    const contractMemo = useMemo(() => {
        return calculateContractList(customerList, 'group') ?? [];
    }, [customerList, targetYear, monthArray]);

    const contractMemoThisMonth = useMemo(() => {
        const monthContract = Object.fromEntries(
            monthArray.map(month => [month, calculateContractList(contractMemo, 'group', month) ?? []])
        )
        return monthContract ?? [];
    }, [contractMemo, targetYear, monthArray]);

    const contractMemoLastYear = useMemo(() => {
        return calculateContractList(customerList, 'group_lastYear') ?? [];
    }, [customerList, targetYear, monthArray]);

    const contractMemoThisMonthLastYear = useMemo(() => {
        const monthContract = Object.fromEntries(
            monthArray.map(month => [month, calculateContractList(contractMemoLastYear, 'group_lastYear', month) ?? []])
        );
        return monthContract ?? [];
    }, [contractMemoLastYear, targetYear, monthArray]);

    const contractDivisionMemo = useMemo(() => {
        const divisionContract = Object.fromEntries(
            divisionArray.map(key => [key, calculateContractList(contractMemo, 'division', '', key) ?? []])
        );
        return divisionContract ?? {};
    }, [contractMemo, divisionArray]);

    const contractDivisionMemoLastYear = useMemo(() => {
        const divisionContract = Object.fromEntries(
            divisionArray.map(key => [key, calculateContractList(contractMemoLastYear, 'division_lastYear', '', key) ?? []])
        );
        return divisionContract ?? {};
    }, [contractMemoLastYear, divisionArray]);

    const contractDivisionMemoThisMonth = useMemo(() => {
        const monthContract = Object.fromEntries(
            divisionArray.map(key => [key,
                Object.fromEntries(monthArray.map(month => [month, calculateContractList(contractDivisionMemo[key], 'division', month, key) ?? []])
                )]
            ));
        return monthContract ?? {};
    }, [contractDivisionMemo]);

    const contractDivisionMemoThisMonthLastYear = useMemo(() => {
        const monthContract = Object.fromEntries(
            divisionArray.map(key => [key,
                Object.fromEntries(monthArray.map(month => [month, calculateContractList(contractDivisionMemoLastYear[key], 'division_lastYear', month, key) ?? []])
                )]
            ));
        return monthContract ?? {};
    }, [contractDivisionMemoLastYear]);

    const contractSectionMemo = useMemo(() => {
        const sectionContract = Object.fromEntries(
            sectionList.map(key => [key.name, calculateContractList(contractDivisionMemo[key.division], 'section', '', '', key.name) ?? []])
        );
        return sectionContract ?? {};
    }, [contractDivisionMemo, sectionList]);

    const contractSectionMemoLastYear = useMemo(() => {
        const sectionContract = Object.fromEntries(
            sectionList.map(key => [key.name, calculateContractList(contractDivisionMemoLastYear[key.division], 'section_lastYear', '', '', key.name) ?? []])
        );
        return sectionContract ?? {};
    }, [contractDivisionMemoLastYear, sectionList]);

    const contractSectionMemoThisMonth = useMemo(() => {
        const monthContract = Object.fromEntries(
            sectionList.map(key => [key.name,
            Object.fromEntries(monthArray.map(month => [month, calculateContractList(contractSectionMemo[key.name], 'section', month, '', key.name) ?? []])
            )]
            ));
        return monthContract ?? {};
    }, [contractSectionMemo, sectionList]);

    const contractSectionMemoThisMonthLastYear = useMemo(() => {
        const monthContract = Object.fromEntries(
            sectionList.map(key => [key.name,
            Object.fromEntries(monthArray.map(month => [month, calculateContractList(contractSectionMemoLastYear[key.name], 'section_lastYear', month, '', key.name) ?? []])
            )]
            ));
        return monthContract ?? {};
    }, [contractSectionMemoLastYear, sectionList]);

    const contractShopMemo = useMemo(() => {
        const shopContract = Object.fromEntries(
            shopList.map(key => [key.shop, calculateContractList(contractSectionMemo[key.section], 'shop', '', '', '', key.shop) ?? []])
        );
        return shopContract ?? {};
    }, [contractSectionMemo, shopList]);

    const contractShopMemoLastYear = useMemo(() => {
        const shopContract = Object.fromEntries(
            shopList.map(key => [key.shop, calculateContractList(contractSectionMemoLastYear[key.section], 'shop_lastYear', '', '', '', key.shop) ?? []])
        );
        return shopContract ?? {};
    }, [contractSectionMemoLastYear, shopList]);


    const sortStyle = { position: 'fixed' as const, zIndex: '1000', backgroundColor: '#fff', width: '100%', height: '60px' };

    const tableStyle = { fontSize: isSp ? '9px' : '12px' };

    const tdStyle = { width: isSp ? '40px' : '70px', minWidth: isSp ? '40px' : '70px', maxWidth: isSp ? '40px' : '70px', letterSpacing: '1px' };

    const contractTable = (section: Section, division: string, sectionColor: string, sectionProspectList: Customer[]) => {
        return <>{shopList
            .filter(shop => shop.section === section.name && !shop.shop.includes('FH'))
            .map(shop => {
                return [...staffList, { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 }, { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                    .sort(staffSorter()).filter(staff => staff.shop === shop.shop && staff.report === 1)
                    .map((staff, staffIndex) => {
                        const staffLength = staffList.filter(s => s.shop === shop.shop && s.report === 1).length + 2;
                        const isShop = staffIndex === staffLength - 1;
                        const shopContract = isShop ? contractShopMemo[shop.shop] : contractShopMemo[shop.shop].filter(o => {
                            return (o.staff === staff.name && o.shop === staff.shop)
                        });
                        const shopContractLastYear = isShop ? contractShopMemoLastYear[shop.shop] : calculateContractList(contractShopMemoLastYear[shop.shop], 'staff_lastYear', '', '', '', shop.shop, staff.name)
                        const multiContract = contractDivisionMemo[division].filter(o => {
                            return isShop ? o.shop.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name
                        });
                        const isStaff = staffIndex < staffLength - 2;
                        const isAchievement = staffIndex === staffLength - 2;
                        const isShopMulti = shop.multi === 1;
                        const isStaffMulti = staff.multi === 1;
                        const cancelList = shopContract.filter(o => o.status === '解約');
                        return (
                            <>
                                <tr key={`${shop.shop}-${staff.name}`} className={staffIndex === 0 ? 'target-top' : staffIndex === staffLength - 1 ? 'target-bottom' : ''}
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
                                            <>{isAchievement &&
                                                <td key={monthIndex} className='text-center text-danger table-danger' colSpan={isTotal ? 2 : 1}>
                                                    {isTotal ?
                                                        achievementLength
                                                        : <input
                                                            type="text"
                                                            className="company_input text-danger"
                                                            value={targetShop}
                                                            onChange={(e) => changeAchievement(month, 'shop', shop.shop, e.target.value)}
                                                        />}</td>}
                                                {(isStaff || isShop) &&
                                                    <td key={monthIndex} className={((isTotal && shopContract.length > 0) || shopPeriodContract.length > 0) ? 'text-primary company_contract text-center table-primary' : 'text-center'}
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
                                            </>
                                        )
                                    }
                                    )}
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
                                            staffIndex !== staffLength - 1 && <TableContract list={target} row={staffIndex === staffLength - 2 ? 2 : 1} col={1} lastYear={null} />
                                        )
                                    }
                                    )}
                                </tr>
                            </>
                        )
                    })
            })}</>
    };

    const contractTable_used = () => {
        const targetShops = shopList.filter(s => s.section === '中古住宅専門店');
        const bgColor = ['table-primary', 'table-success'];

        return <>
            {targetShops.map((s, sIndex) => {
                const targetStaffs = staffList.filter(st => st.shop === s.shop);
                return <React.Fragment key={s.shop}>
                    {targetStaffs.sort(staffSorter()).map((staff, staffIndex) => {
                        // 対象スタッフの全契約リスト
                        const staffContracts = usedContractList.filter(u => u.staff === staff.name);

                        // Total対象のリスト（配列）を抽出
                        const totalContracts = staffContracts.filter(u =>
                            monthArray.includes(monthFormate(u.contract_reform)) ||
                            monthArray.includes(monthFormate(u.contract_sell)) ||
                            monthArray.includes(monthFormate(u.contract_buy))
                        );

                        // 抽出したリストから合計金額を計算（※前回の小数点の計算誤差対策済み）
                        const budgetTotal = totalContracts.reduce((acc, cur) =>
                            acc + Math.round(Number(cur.contraction_contract_price ?? 0) * 10), 0
                        ) / 10;

                        return (
                            <tr key={`${s.shop}-${staff.name}`}>
                                {staffIndex === 0 && <td className={`${bgColor[sIndex]} sticky-column`} rowSpan={targetStaffs.length}>{s.shop}</td>}
                                <td className='sticky-column next'>{staff.name}</td>
                                {[...monthArray, 'total'].map((month, monthIndex) => {
                                    const isTotal = monthIndex === monthArray.length;

                                    if (isTotal) {
                                        return (
                                            <td
                                                key="total"
                                                className={totalContracts.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                onClick={totalContracts.length > 0 ? () => {
                                                    setShow(true);
                                                    setContract(totalContracts);
                                                } : undefined}
                                            >
                                                {budgetTotal > 0 ? budgetTotal : 0}
                                            </td>
                                        );
                                    }

                                    // 月ごとの対象リスト（配列）を抽出
                                    const monthlyContracts = staffContracts.filter(u =>
                                        dateFormate(u.contract_reform).includes(dateFormate(month)) ||
                                        dateFormate(u.contract_buy).includes(dateFormate(month)) ||
                                        dateFormate(u.contract_sell).includes(dateFormate(month))
                                    );

                                    // 抽出したリストから月の合計金額を計算（※前回の小数点の計算誤差対策済み）
                                    const monthTotal = monthlyContracts.reduce((acc, cur) =>
                                        acc + Math.round(Number(cur.contraction_contract_price ?? 0) * 10), 0
                                    ) / 10;

                                    return (
                                        <td
                                            key={month}
                                            className={monthlyContracts.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                            onClick={monthlyContracts.length > 0 ? () => {
                                                setShow(true);
                                                setContract(monthlyContracts);
                                            } : undefined}
                                        >
                                            {monthTotal > 0 ? monthTotal : 0}
                                        </td>
                                    );
                                })}
                                {(() => {
                                    const target = achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value ? achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value : '';
                                    return <td className='text-danger company_contract text-center'
                                    ><input
                                            type="text"
                                            className="company_input text-danger"
                                            value={target}
                                            onChange={(e) => changeAchievement(monthArray[0].slice(0, 7), 'staff', staff.name, e.target.value)}
                                        /></td>;
                                })()}
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
                                {getYears().map((year => <option value={year}>{year}年5月期</option>))}
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
                    <Table bordered style={tableStyle} >
                        <tbody className='align-middle'>
                            {/* 以下グループ */}
                            <tr className='text-center target-bottom sticky-header'>
                                <td colSpan={2} style={tdStyle} className='sticky-column'>{Number(targetYear) - 1}/06~{Number(targetYear)}/05</td>
                                {monthArray.map(month =>
                                    <td className='text-center' style={tdStyle}>{dateFormate(month)}</td>
                                )}
                                <td style={tdStyle}>合計</td>
                                <td style={tdStyle}>個人目標</td>
                                <td className='table-none-border'></td>
                                {rankArray.map(r =>
                                    <td className='text-center' style={tdStyle}>{r}</td>
                                )}
                            </tr>
                            <tr className='target-top sticky-header next_top'>
                                <td colSpan={2} className='text-center table-danger text-danger sticky-column' style={{ letterSpacing: '1px' }}>グループ予算</td>
                                {monthArray.map(month => {
                                    return <TableAchievement list={achievementLength('group', month) ?? null} row={1} col={1} lastYear={achievementLength('group_lastYear', month) ?? null} />;
                                }
                                )}
                                <TableAchievement list={achievementLength('group') ?? null} row={1} col={2} lastYear={achievementLength('group_lastYear') ?? 0} />
                                <td className='table-none-border'></td>
                                {rankArray.map((r, index) => {
                                    const orderProspectList = customerList.filter(o => o.status === '見込み' && (o.rank_period <= formattedThisMonth || !o.rank_period));
                                    const target = r === '契約済み' ?
                                        contractMemoThisMonth[monthFormate(formattedThisMonth)] :
                                        orderProspectList.filter(o => safeFormate(o.rank)?.includes(r));
                                    return <TableContract key={index} list={target} row={2} col={1} lastYear={null} />
                                })}
                            </tr>
                            <tr className='sticky-header third_top'>
                                <td colSpan={2} className='text-center text-primary table-primary sticky-column' style={{ letterSpacing: '1px' }}>グループ実績</td>
                                {monthArray.map(month => {
                                    return <TableContract list={contractMemoThisMonth[month]} row={1} col={1} lastYear={contractMemoThisMonthLastYear[month]} />
                                }
                                )}
                                <TableContract list={contractMemo} row={1} col={2} lastYear={contractMemoLastYear} />
                                <td className='table-none-border'></td>
                            </tr>
                            {/* 以下部門別 */}
                            {divisionArray.map((division, divisionIndex) => {
                                const prospectList = customerList.filter(o => o.status === '見込み' && (o.rank_period <= formattedThisMonth || !o.rank_period) && o.category === divisionMapping[division]);
                                const targetTotalList = usedContractList.filter(u =>
                                    monthArray.includes(monthFormate(u.contract_reform)) ||
                                    monthArray.includes(monthFormate(u.contract_buy)) ||
                                    monthArray.includes(monthFormate(u.contract_sell))
                                );
                                return <React.Fragment key={divisionIndex}>
                                    <tr className='target-top' id={division}>
                                        <td rowSpan={2} style={{ backgroundColor: '#272727ff', color: '#f7f7f7' }} className='text-center align-middle sticky-column'>{division}</td>
                                        <td className='table-danger text-danger sticky-column next'>予算</td>
                                        {monthArray.map(month => {
                                            return <TableAchievement list={achievementLength('division', month, division) ?? null} row={1} col={1} lastYear={achievementLength('division_lastYear', month, division) ?? 0} />;
                                        }
                                        )}
                                        <TableAchievement list={achievementLength('division', '', division) ?? null} row={1} col={2} lastYear={achievementLength('division_lastYear', '', division) ?? 0} />
                                        <td className='table-none-border'></td>
                                        {rankArray.map(r => {
                                            const targetList = r === '契約済み' ?
                                                contractDivisionMemoThisMonth[division][monthFormate(formattedThisMonth)] :
                                                prospectList.filter(o => safeFormate(o.rank)?.includes(r));
                                            const targetUsedList = r === '契約済み' ? usedList.filter(u => u.status === '契約済み'
                                                && (monthFormate(u.contract_reform).includes(monthFormate(formattedThisMonth))
                                                    || monthFormate(u.contract_buy).includes(monthFormate(formattedThisMonth)) || monthFormate(u.contract_sell).includes(monthFormate(formattedThisMonth)))) :
                                                usedList.filter(u => u.status !== '契約済み' && safeFormate(u.rank)?.includes(r));
                                            return <TableContract list={division === '中古リノベ' ? targetUsedList : targetList} row={2} col={1} lastYear={null} />
                                        }
                                        )}
                                    </tr>
                                    <tr className='target-bottom'>
                                        <td className='table-primary text-primary sticky-column next'>実績</td>
                                        {monthArray.map((month, monthIndex) => {
                                            const targetList = usedContractList.filter(u => u.status === '契約済み' &&
                                                (dateFormate(u.contract_reform).includes(dateFormate(month)) ||
                                                    dateFormate(u.contract_buy).includes(dateFormate(month)) ||
                                                    dateFormate(u.contract_sell).includes(dateFormate(month)))
                                            );
                                            return <TableContract list={division === '中古リノベ' ? targetList : contractDivisionMemoThisMonth[division][month]} row={1} col={1} key={monthIndex} lastYear={contractDivisionMemoThisMonthLastYear[division][month]} division={division} />
                                        }
                                        )}
                                        <TableContract list={division === '中古リノベ' ? targetTotalList : contractDivisionMemo[division]} row={1} col={2} lastYear={contractDivisionMemoLastYear[division]} division={division} />                                         <td className='table-none-border'></td>
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
                                                                return <TableAchievement list={achievementLength('section', month, '', section.name) ?? null} row={1} col={1} lastYear={achievementLength('section_lastYear', month, '', section.name) ?? 0} />;
                                                            })}
                                                            <TableAchievement list={achievementLength('section', '', '', section.name) ?? null} row={1} col={2} lastYear={achievementLength('section_lastYear', '', '', section.name) ?? 0} />
                                                            <td className='table-none-border'></td>
                                                            {rankArray.map(r => {
                                                                const target = r === '契約済み' ?
                                                                    contractSectionMemoThisMonth[section.name][monthFormate(formattedThisMonth)] :
                                                                    sectionProspectList.filter(o => safeFormate(o.rank).includes(r));
                                                                return <TableContract list={target} row={2} col={1} lastYear={null} />
                                                            })}
                                                        </tr>
                                                        <tr className='target-bottom'>
                                                            <td className='table-primary text-primary sticky-column next'>実績</td>
                                                            {monthArray.map((month, monthIndex) => {
                                                                return <TableContract list={contractSectionMemoThisMonth[section.name][month]} row={1} col={1} key={monthIndex} lastYear={contractSectionMemoThisMonthLastYear[section.name][month]} />;
                                                            })}
                                                            <TableContract list={contractSectionMemo[section.name]} row={1} col={2} lastYear={contractSectionMemoLastYear[section.name]} />
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
        </>
    )
}

export default Company