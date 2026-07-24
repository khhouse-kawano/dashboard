import React, { useState, useMemo, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { thisYear } from '../../utils/thisYear';
import { getFiscalYearMonthsFromJune } from '../../utils/getFiscalYearMonthsFromJune';

// --- モックデータと型定義 ---
type Member = {
    id: string;
    name: string;
    shop: string;
    personalIndex: number;
};

type Shop = Record<string, string>;
type Staff = Record<string, string>;
type Section = Record<string, string>;
type OrderContract = Record<string, string>;
type Achievement = Record<string, string>;
type Budget = {
    category: string;
    shop: string;
    budget_period: string;
    budget_value: number;
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
    // --- 状態管理 ---
    const [calcMode, setCalcMode] = useState<'calc_budget' | 'calc_contracts'>('calc_budget');
    // 🌟 追加: 起算日のトグル管理用State
    const [dateBase, setDateBase] = useState<'inquiry' | 'achievement'>('inquiry'); 
    
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
    const [newMemberName, setNewMemberName] = useState('');
    const [shops, setShops] = useState<Shop[]>([]);
    const [staffs, setStaffs] = useState<Staff[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [orderContract, setOrderContract] = useState<OrderContract[]>([]);

    // --- データフェッチ ---
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

    // --- ユーティリティ ---
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

    const getLastYear = (value: string) => {
        const year = value.split('/')[0] ?? 0;
        const lastYear = Number(year) - 1;
        const month = value.split('/')[1] ?? 0;
        return `${lastYear}/${month}`;
    };

    // --- 絞り込みロジック (useMemo) ---
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
                && (targetPeriod?.includes(monthFormate(dateBase === 'inquiry' ? o.register : o.contract)));
        });
    }, [newShops, targetShop, orderContract, filteredNewShops, targetPeriod, dateBase]);

    const newBudget = useMemo(() => {
        return budgetList.filter(b => {
            return (targetShop ? b.shop === targetShop : newShops.length > 0 ? filteredNewShops.includes(b.shop) : true)
                && (targetPeriod?.includes(monthFormate(b.budget_period)));
        });
    }, [budgetList, targetShop, newShops, filteredNewShops, targetPeriod]);

    const contractSummary = useMemo(() => {
        const contractLength = newContractOrder.filter(n => n.status === '契約済み' && n.contract).length;
        const total = newBudget.reduce((acc, cur) => acc + (cur.budget_value ?? 0), 0);
        const CPA = contractLength > 0 ? Math.round(total / contractLength) : 0;
        return { 
            contract: contractLength,
            CPA 
        };
    }, [newContractOrder, newBudget]);

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

        return { teamSalesIndex, totalIndex, actualCpa, requiredBudget, predictedContracts };
    }, [members, shopIndex, baseCpa, calcMode, targetContracts, inputBudget]);

    // --- 計算・更新ロジック (useEffect) ---
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

                    const staffTotalAverage = (staffTotal.reduce((acc, cur) => acc + (Number(cur?.value ?? 0)), 0))
                        * achievementPeriod.length / 12;

                    return {
                        id: idString,
                        name: displayName,
                        shop: shopString,
                        personalIndex: calculatePersonalIndex(staffTotalAverage, shopTotal, newStaffs.length)
                    };
                });
        });
    }, [newStaffs, targetShop, targetSection, achievement, targetPeriod, shopTotal]);

    useEffect(() => {
        const filteredAchievement = achievement.filter(a =>
            achievementPeriod.includes(a.period.replace(/-/g, '/') ?? '')
            && a.category === 'shop'
            && (isSection || isGroup ? newShops.map(n => n.shop).includes(a.name) : targetShop === a.name)
        ).reduce((acc, cur) => acc + Number(cur.value ?? 0), 0);
        setTargetContracts(filteredAchievement);
    }, [achievement, achievementPeriod, targetShop, targetSection, newShops]);

    // --- ハンドラー ---
    const handleAddMember = () => {
        if (!newMemberName.trim()) return;
        const foundStaff = staffs.find(s => s.name === newMemberName);
        const newShop = foundStaff ? foundStaff.shop : '';
        const newMember: Member = { id: `manual_${Date.now()}`, name: newMemberName, shop: newShop, personalIndex: 1.0 };
        setMembers([...members, newMember]);
        setNewMemberName('');
    };

    // --- レンダリング定義 ---
    const inputStyle = { fontSize: '12px', width: '120px' };
    const isGroup = !targetShop && !targetSection;
    const isSection = targetSection && !targetShop;

    return (
        <div className="bg-white p-4 rounded shadow-sm border">
            {/* ヘッダー＆フィルター */}
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
                    
                    {/* 🌟 追加：起算日トグルボタン */}
                    <div className="btn-group ms-2" role="group">
                        <input type="radio" className="btn-check" name="dateBase" id="dateBaseInquiry" 
                            checked={dateBase === 'inquiry'} onChange={() => setDateBase('inquiry')} />
                        <label className="btn btn-outline-secondary btn-sm" htmlFor="dateBaseInquiry" style={{ fontSize: '12px', padding: '0.25rem 0.5rem' }}>反響日起算</label>

                        <input type="radio" className="btn-check" name="dateBase" id="dateBaseAchievement" 
                            checked={dateBase === 'achievement'} onChange={() => setDateBase('achievement')} />
                        <label className="btn btn-outline-secondary btn-sm" htmlFor="dateBaseAchievement" style={{ fontSize: '12px', padding: '0.25rem 0.5rem' }}>実績日起算</label>
                    </div>
                </div>
            </div>

            {/* モード切替タブ */}
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
                    
                    {/* 2カラム構成：左（シミュレーション入力）/ 右（前年度実績） */}
                    <div className="bg-light p-4 rounded border mb-4">
                        <div className="row">
                            {/* 左カラム: 目標・入力エリア */}
                            <div className="col-md-6 mb-4 mb-md-0 border-end">
                                {/* 1. 目標契約単価 */}
                                <div className="mb-3">
                                    <label className="text-muted mb-1 fw-bold" style={{ fontSize: '13px' }}>目標契約単価 (CPA)</label>
                                    <div className="d-flex align-items-center">
                                        <BsForm.Control
                                            size="sm" type="text"
                                            value={baseCpa === 0 ? '' : baseCpa}
                                            onChange={(e) => handleNumberOnlyChange(e.target.value, setBaseCpa)}
                                            style={{ fontSize: '15px', maxWidth: '160px' }}
                                        />
                                        <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>円</span>
                                    </div>
                                </div>

                                {/* 2. 目標契約数 or 投入予算 */}
                                <div className="mb-3">
                                    {calcMode === 'calc_budget' ? (
                                        <>
                                            <label className="text-primary mb-1 fw-bold" style={{ fontSize: '13px' }}>目標契約数</label>
                                            <div className="d-flex align-items-center">
                                                <BsForm.Control
                                                    size="sm" type="text"
                                                    value={targetContracts === 0 ? '' : targetContracts}
                                                    onChange={(e) => handleNumberOnlyChange(e.target.value, setTargetContracts)}
                                                    style={{ fontSize: '15px', maxWidth: '160px', borderColor: '#0d6efd' }}
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
                                                    style={{ fontSize: '15px', maxWidth: '160px', borderColor: '#198754' }}
                                                />
                                                <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>円</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* 3. グループ/店舗指数 */}
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
                                            style={{ fontSize: '15px', maxWidth: '160px' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 右カラム: 前年度実績エリア (表示専用) */}
                            <div className="col-md-6 ps-md-4">
                                {/* 1. 前年度契約単価 */}
                                <div className="mb-3">
                                    <label className="text-muted mb-1 fw-bold" style={{ fontSize: '13px' }}>前年度契約単価 (CPA)</label>
                                    <div className="d-flex align-items-center">
                                        <BsForm.Control
                                            size="sm" type="text"
                                            value={contractSummary.CPA ? contractSummary.CPA.toLocaleString() : ''}
                                            readOnly
                                            style={{ fontSize: '15px', maxWidth: '160px', backgroundColor: '#e9ecef', color: '#6c757d' }}
                                        />
                                        <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>円</span>
                                    </div>
                                </div>

                                {/* 2. 前年度契約数 */}
                                <div className="mb-3">
                                    <label className="text-muted mb-1 fw-bold" style={{ fontSize: '13px' }}>前年度契約数</label>
                                    <div className="d-flex align-items-center">
                                        <BsForm.Control
                                            size="sm" type="text"
                                            value={contractSummary.contract ? contractSummary.contract.toLocaleString() : ''}
                                            readOnly
                                            style={{ fontSize: '15px', maxWidth: '160px', backgroundColor: '#e9ecef', color: '#6c757d' }}
                                        />
                                        <span className="ms-2 text-muted" style={{ fontSize: '13px' }}>件</span>
                                    </div>
                                </div>

                                {/* 3. ブランク（左の指数入力欄と高さを揃える） */}
                                <div className="d-none d-md-block" style={{ height: '62px' }}></div>
                            </div>
                        </div>
                    </div>

                    {/* メンバーリスト */}
                    <div>
                        <div className="d-flex justify-content-between align-items-end mb-2">
                            <span className="fw-bold" style={{ fontSize: '13px' }}>所属営業メンバー ({members.length}名)</span>
                            <div className="d-flex gap-1">
                                <BsForm.Control size="sm" placeholder="新規メンバー名" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} style={inputStyle} />
                                <button className="btn btn-secondary btn-sm" style={{ fontSize: '12px' }} onClick={handleAddMember}>追加</button>
                            </div>
                        </div>
                        <div className="table-responsive border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <Table hover size="sm" className="align-middle mb-0">
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8f9fa' }}>
                                    <tr className="text-secondary" style={{ fontSize: '12px' }}>
                                        <th className="py-2 px-3 border-bottom-0">氏名</th>
                                        <th className="py-2 border-bottom-0" style={{ width: '120px' }}>個人指数</th>
                                        <th className="py-2 text-center border-bottom-0" style={{ width: '60px' }}>操作</th>
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
                                            <td className="text-center">
                                                <button className="btn btn-link text-danger p-0" onClick={() => setMembers(members.filter(m => !(m.id === member.id && m.shop === member.shop)))}>
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
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
                                <span className="d-block text-white-50 mb-1" style={{ fontSize: '13px' }}>チーム営業指数</span>
                                <span className="fs-3 fw-bold">{simulationResult.teamSalesIndex.toFixed(2)}</span>
                            </div>

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