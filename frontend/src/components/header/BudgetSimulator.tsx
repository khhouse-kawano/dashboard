import React, { useState, useMemo, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { thisYear } from '../../utils/thisYear';
import { getFiscalYearMonthsFromJune } from '../../utils/getFiscalYearMonthsFromJune';

type Member = {
    id: string;
    name: string;
    shop: string,
    personalIndex: number;
};

type Shop = Record<string, string>;
type Staff = Record<string, string>;
type Section = Record<string, string>;
type OrderContract = Record<string, string>;
type Achievement = Record<string, string>;
type Budget = {
    category: string,
    shop: string,
    budget_period: string,
    budget_value: number
};

const monthArray = getYearMonthArray(2025, 1);
const now = new Date();
const year = String(now.getFullYear());
const month = String(now.getMonth() + 1).padStart(2, '0');
const monthFormate = (month: string) => {
    return (month ?? '').replace(/-/g, '/').slice(0, 7);
};
const duplicate = ['DJH加世田店', 'なごみ加世田店', '2L出水店', ' DJH鹿屋店', 'DJH延岡店'];

const BudgetSimulator = () => {
    const [calcMode, setCalcMode] = useState<'calc_budget' | 'calc_contracts'>('calc_budget');
    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [startPeriod, setStartPeriod] = useState('');
    const [endPeriod, setEndPeriod] = useState('');
    const [budgetList, setBudgetList] = useState<Budget[]>([]);
    const [baseCpa, setBaseCpa] = useState<number>(0);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetContracts, setTargetContracts] = useState<number>(0);
    const [inputBudget, setInputBudget] = useState<number>(500000);
    const [shopIndex, setShopIndex] = useState<number>(1.0);
    const [members, setMembers] = useState<Member[]>([]);
    const [shops, setShops] = useState<Shop[]>([]);
    const [staffs, setStaffs] = useState<Staff[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [orderContract, setOrderContract] = useState<OrderContract[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post('', { request: 'budget_simulator' });
            const filteredShop = response.data.shop.filter((s: Shop) => s.division === '注文事業' && !duplicate.includes(s.shop));
            setShops(filteredShop);
            const filteredSection = response.data.section.filter((s: Section) => s.division === '注文事業').map((s: Section) => s.name);
            setSections(filteredSection);
            const filteredStaff = response.data.staff.filter((s: Staff) => s.period === String(thisYear) && !duplicate.includes(s.shop));
            setStaffs(filteredStaff);
            setOrderContract(response.data.order_contract);
            setBudgetList(response.data.budget);
            setAchievement(response.data.achievement);
        };
        fetchData();
        setStartPeriod(`${year}/06`);
        setEndPeriod(`${year}/${month}`);
    }, []);

    const handleNumberOnlyChange = (value: string, setter: React.Dispatch<React.SetStateAction<number>>) => {
        const halfWidth = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const numbersOnly = halfWidth.replace(/[^0-9]/g, '');
        setter(numbersOnly === '' ? 0 : Number(numbersOnly));
    };

    const disableTextInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Tab') {
            e.preventDefault();
        }
    };

    const newShops = useMemo(() => {
        return shops.filter(s => targetSection ? s.section === targetSection : true);
    }, [shops, targetSection]);

    const newStaffs = useMemo(() => {
        const base = staffs.filter(s => sections?.includes(s.section ?? ''));
        const uniqueStaffs = Array.from(
            new Map(base.map(staff => [staff.name, staff])).values()
        );
        return uniqueStaffs.filter(s => (targetShop ? s.shop === targetShop
            : targetSection ? s.section === targetSection
                : true
        ));
    }, [staffs, targetShop, targetSection, sections]);

    const getLastYear = (value: string) => {
        const year = value.split('/')[0] ?? 0;
        const lastYear = Number(year) - 1;
        const month = value.split('/')[1] ?? 0;
        return `${lastYear}/${month}`;
    };

    const targetPeriod = useMemo(() => {
        const start = monthArray.indexOf(getLastYear(startPeriod));
        const end = monthArray.indexOf(getLastYear(endPeriod));
        return monthArray.slice(start, end + 1);
    }, [startPeriod, endPeriod]);

    const achievementPeriod = useMemo(() => {
        const start = getFiscalYearMonthsFromJune(thisYear).indexOf(startPeriod);
        const end = getFiscalYearMonthsFromJune(thisYear).indexOf(endPeriod);
        return getFiscalYearMonthsFromJune(thisYear).slice(start, end + 1);
    }, [startPeriod, endPeriod]);

    const filteredNewShops = useMemo(() => newShops.map(s => s.shop), [newShops]);

    const shopTotal = useMemo(() => {
        return achievement.filter(a => achievementPeriod.includes(a.period.replace(/-/g, '/') ?? '')
            && a.category === 'shop'
            && (targetShop ? targetShop === a.name : filteredNewShops.includes(a.name))
        ).reduce((acc, cur) => acc + (Number(cur?.value ?? 0)), 0);
    }, [achievement, targetPeriod, targetShop, filteredNewShops]);

    const newContractOrder = useMemo(() => {
        return orderContract.filter(o => {
            return (targetShop ? o.shop === targetShop : newShops.length > 0 ? filteredNewShops.includes(o.shop) : true)
                && (targetPeriod?.includes(monthFormate(o.register)))
        });
    }, [newShops, targetShop, orderContract, filteredNewShops, targetPeriod]);

    const newBudget = useMemo(() => {
        return budgetList.filter(b => {
            return (targetShop ? b.shop === targetShop : newShops.length > 0 ? filteredNewShops.includes(b.shop) : true)
                && (targetPeriod?.includes(monthFormate(b.budget_period)))
        });
    }, [budgetList, targetShop, newShops, filteredNewShops, targetPeriod]);

    const contractSummary = useMemo(() => {
        const contractLength = newContractOrder.filter(n => n.status === '契約済み' && n.contract).length;
        const total = newBudget.reduce((acc, cur) => acc + (cur.budget_value ?? 0), 0);
        const CPA = contractLength > 0 ? Math.round(total / contractLength) : 0;
        return { CPA };
    }, [newContractOrder, newBudget]);

    useEffect(() => {
        if (contractSummary.CPA > 0) {
            setBaseCpa(contractSummary.CPA);
        }
        setShopIndex(1.0); // チームベース指数は必ず1.0にリセット
    }, [contractSummary.CPA, targetShop, targetSection]);

    const calculatePersonalIndex = (personalContracts: number, shopTotalContracts: number, memberCount: number): number => {
        if (memberCount === 0 || shopTotalContracts === 0) return 0.5;
        const averageContracts = shopTotalContracts / memberCount;
        const index = personalContracts / averageContracts;
        return Math.round(index * 1000) / 1000;
    };

    useEffect(() => {
        setMembers(() => {
            const positionIndex: Record<string, number> = { '店長': 0, '店長代理': 1, '一般': 2 };

            return [...newStaffs]
                .sort((a, b) => {
                    if (!targetSection) return 0;
                    return Number(a.khg_id ?? 0) - Number(b.khg_id ?? 0);
                })
                .sort((a, b) => Number(positionIndex[a.position] ?? 0) - Number(positionIndex[b.position] ?? 0))
                .map((staff, index) => {
                    const actualId = staff.khg_id ?? staff.id;
                    const idString = actualId ? String(actualId) : `fallback_${targetShop}_${index}`;
                    const shopString = staff.shop ?? '';
                    const displayName = (!targetShop && staff.shop) ? `${staff.name} (${staff.shop})` : staff.name;

                    const staffTotal = achievement.filter(a =>
                        a.period.includes(String(thisYear - 1)) &&
                        a.category === 'staff' &&
                        a.name === staff.name
                    );

                    console.log(staffTotal)

                    const staffTotalAverage = (staffTotal.reduce((acc, cur) => acc + (Number(cur?.value ?? 0)), 0))
                        * achievementPeriod.length / 12 ;

                    return {
                        id: idString,
                        name: displayName,
                        shop: shopString,
                        personalIndex: calculatePersonalIndex(staffTotalAverage, shopTotal, newStaffs.length)
                    };
                });
        });
    }, [newStaffs, targetShop, targetSection, achievement, targetPeriod, shopTotal]);

    const simulationResult = useMemo(() => {
        const teamSalesIndex = members.length > 0
            ? members.reduce((sum, m) => sum + m.personalIndex, 0) / members.length
            : 1.0;

        const totalIndex = shopIndex * teamSalesIndex;
        const actualCpa = totalIndex > 0 ? baseCpa / totalIndex : baseCpa;

        let requiredBudget = 0;
        let predictedContracts = 0;

        if (calcMode === 'calc_budget') {
            requiredBudget = Math.round(targetContracts * actualCpa);
            predictedContracts = targetContracts;
        } else {
            predictedContracts = Math.floor(inputBudget / actualCpa);
            requiredBudget = inputBudget;
        }

        return { totalIndex, actualCpa, requiredBudget, predictedContracts };
    }, [members, shopIndex, baseCpa, calcMode, targetContracts, inputBudget]);

    useEffect(() => {
        const filteredAchievement = achievement.filter(a =>
            achievementPeriod.includes(a.period.replace(/-/g, '/') ?? '')
            && a.category === 'shop'
            && (isSection || isGroup ? newShops.map(n => n.shop).includes(a.name) : targetShop === a.name)
        ).reduce((acc, cur) => acc + Number(cur.value ?? 0), 0);
        console.log(filteredAchievement)
        setTargetContracts(filteredAchievement);
    }, [achievement, achievementPeriod, targetShop, targetSection, newShops]);

    const inputStyle = { fontSize: '12px', width: '150px' };
    const isGroup = !targetShop && !targetSection;
    const isSection = targetSection && !targetShop;

    return (
        <div className="bg-white p-4 rounded shadow-sm border">
            <div className="d-flex align-items-center mb-4 border-bottom pb-3">
                <h5 className="mb-0 fw-bold me-4"><i className="fa-solid fa-calculator me-2"></i>広告費シミュレーター</h5>
                <div className="d-flex gap-2 ms-auto align-items-center">
                    <div className="text-secondary" style={{ ...inputStyle, width: 'fit-content' }}>参考値を選択</div>
                    <BsForm.Select size="sm" className="text-muted" style={inputStyle}
                        value={targetSection} onChange={(e) => {
                            setTargetSection(e.target.value);
                            setTargetShop('');
                        }}>
                        <option value=''>注文事業全体</option>
                        {sections.map(section => <option key={section} value={section}>{section}</option>)}
                    </BsForm.Select>
                    <BsForm.Select size="sm" className="text-muted" style={inputStyle}
                        value={targetShop} onChange={(e) => setTargetShop(e.target.value)}>
                        {targetSection ? <option value=''>{targetSection}全体</option> : <option value=''>注文事業全体</option>}
                        {newShops.map(shop => <option key={shop.shop} value={shop.shop}>{shop.shop}</option>)}
                    </BsForm.Select>
                    <BsForm.Select size="sm" className="text-muted" style={inputStyle}
                        value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)}>
                        {getFiscalYearMonthsFromJune(2027).map(period => <option key={period} value={period}>{period} </option>)}
                    </BsForm.Select>
                    <BsForm.Select size="sm" className="text-muted" style={inputStyle}
                        value={endPeriod} onChange={(e) => setEndPeriod(e.target.value)}>
                        {getFiscalYearMonthsFromJune(2027).map(period => <option key={period} value={period}>{period} </option>)}
                    </BsForm.Select>
                </div>
            </div>

            <ul className="nav nav-pills nav-fill mb-4 p-1 bg-light rounded border">
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold border-0 ${calcMode === 'calc_budget' ? 'active bg-primary text-white shadow-sm' : 'text-secondary'}`}
                        onClick={() => setCalcMode('calc_budget')}
                        style={{ fontSize: '14px', borderRadius: '0.375rem' }}
                    >
                        <i className="fa-solid fa-bullseye me-2"></i>目標契約数から広告費を算出
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold border-0 ${calcMode === 'calc_contracts' ? 'active bg-success text-white shadow-sm' : 'text-secondary'}`}
                        onClick={() => setCalcMode('calc_contracts')}
                        style={{ fontSize: '14px', borderRadius: '0.375rem' }}
                    >
                        <i className="fa-solid fa-coins me-2"></i>予算から予測契約数を算出
                    </button>
                </li>
            </ul>

            <div className="row mb-4">
                <div className="col-md-7">
                    {/* 縦並びの3要素パネル */}
                    <div className="bg-light p-4 rounded border mb-4">
                        <div className="mb-4">
                            <label className="text-muted mb-1 fw-bold" style={{ fontSize: '13px' }}>基準契約単価 (CPA)</label>
                            <div className="d-flex align-items-center">
                                <BsForm.Control
                                    size="sm" type="text"
                                    value={baseCpa === 0 ? '' : baseCpa}
                                    onChange={(e) => handleNumberOnlyChange(e.target.value, setBaseCpa)}
                                    style={{ fontSize: '15px', maxWidth: '200px' }}
                                />
                                <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>円</span>
                            </div>
                        </div>

                        <div className="mb-4">
                            {calcMode === 'calc_budget' ? (
                                <>
                                    <label className="text-primary mb-1 fw-bold" style={{ fontSize: '13px' }}>目標契約数</label>
                                    <div className="d-flex align-items-center">
                                        <BsForm.Control
                                            size="sm" type="text"
                                            value={targetContracts === 0 ? '' : targetContracts}
                                            onChange={(e) => handleNumberOnlyChange(e.target.value, setTargetContracts)}
                                            style={{ fontSize: '15px', maxWidth: '200px', borderColor: '#0d6efd' }}
                                        />
                                        <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>件</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <label className="text-success mb-1 fw-bold" style={{ fontSize: '13px' }}>投入予算</label>
                                    <div className="d-flex align-items-center">
                                        <BsForm.Control
                                            size="sm" type="text"
                                            value={inputBudget === 0 ? '' : inputBudget}
                                            onChange={(e) => handleNumberOnlyChange(e.target.value, setInputBudget)}
                                            style={{ fontSize: '15px', maxWidth: '200px', borderColor: '#198754' }}
                                        />
                                        <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>円</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div>
                            <label className="text-muted mb-1 fw-bold" style={{ fontSize: '13px' }}>
                                {isGroup ? 'グループ指数' : isSection ? `${targetSection}指数` : `${targetShop}指数`}
                            </label>
                            <div className="d-flex align-items-center">
                                <BsForm.Control
                                    size="sm" type="number" step="0.1"
                                    value={shopIndex}
                                    onChange={(e) => setShopIndex(Number(e.target.value))}
                                    onKeyDown={disableTextInput}
                                    style={{ fontSize: '15px', maxWidth: '200px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* メンバーリスト */}
                    <div>
                        <div className="d-flex justify-content-between align-items-end mb-2">
                            <span className="fw-bold" style={{ fontSize: '13px' }}>所属営業メンバー ({members.length}名)</span>
                        </div>
                        <div className="table-responsive border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <Table hover size="sm" className="align-middle mb-0">
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8f9fa' }}>
                                    <tr className="text-secondary" style={{ fontSize: '12px' }}>
                                        <th className="py-2 px-3 border-bottom-0">氏名</th>
                                        <th className="py-2 border-bottom-0" style={{ width: '120px' }}>個人指数</th>
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: '13px' }}>
                                    {members.map((member, index) => (
                                        <tr key={`${member.id}_${member.shop}_${index}`}>
                                            <td className="px-3 fw-bold">{member.name}</td>
                                            <td>
                                                <BsForm.Control
                                                    size="sm" type="number" step="0.1"
                                                    value={member.personalIndex}
                                                    onChange={(e) => setMembers(members.map(m =>
                                                        (m.id === member.id && m.shop === member.shop)
                                                            ? { ...m, personalIndex: Number(e.target.value) }
                                                            : m
                                                    ))}
                                                    onKeyDown={disableTextInput}
                                                    style={{ fontSize: '12px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {members.length === 0 && (
                                        <tr><td colSpan={2} className="text-center text-muted py-3">メンバーがいません</td></tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* 右側: 結果表示パネル */}
                <div className="col-md-5">
                    <div className="card border-0 shadow-sm rounded-4 h-100" style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <div className="card-body p-4 d-flex flex-column">
                            <h6 className="text-white-50 mb-4 fw-bold">シミュレーション結果</h6>

                            <div className="mb-4">
                                <span className="d-block text-white-50 mb-1" style={{ fontSize: '13px' }}>総合パフォーマンス指数</span>
                                <span className="fs-3 fw-bold">{simulationResult.totalIndex.toFixed(2)}</span>
                                <span className="ms-2" style={{ fontSize: '12px' }}>(実質CPA: {Math.round(simulationResult.actualCpa).toLocaleString()}円)</span>
                            </div>

                            <div className="mt-auto p-3 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                {calcMode === 'calc_budget' ? (
                                    <>
                                        <span className="d-block text-info fw-bold mb-2" style={{ fontSize: '14px' }}>目標 {targetContracts.toLocaleString()} 件を達成するための必要予算</span>
                                        <div className="text-end">
                                            <span className="fs-1 fw-bold text-white">{simulationResult.requiredBudget.toLocaleString()}</span>
                                            <span className="ms-2 text-white-50">円</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="d-block text-success fw-bold mb-2" style={{ fontSize: '14px' }}>予算 {inputBudget.toLocaleString()} 円から予測される獲得数</span>
                                        <div className="text-end">
                                            <span className="fs-1 fw-bold text-white">{simulationResult.predictedContracts.toLocaleString()}</span>
                                            <span className="ms-2 text-white-50">件</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetSimulator;