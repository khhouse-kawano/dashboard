import React, { useEffect, useState, useContext, useMemo } from 'react';
import axios from "axios";
import AuthContext from '../../context/AuthContext';
import Table from "react-bootstrap/Table";
import "../SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Modal from 'react-bootstrap/Modal';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { setSection } from '../../utils/setSection';
import { budgetFilter } from '../../utils/budgetFilter';
import { get11MonthsAgoString } from '../../utils/get11MonthsAgoString';
import { isLastYear } from '../../utils/isLastYear';
import { ModalBody } from 'react-bootstrap';
import InformationEditResale from '../information/InformationEditResale';
import InterviewLog from '../InterviewLog';
import apiClient from '../../utils/apiClient';

type Shop = Record<string, string>;
type Customer = Record<string, string>;
type Medium = { id: number; medium: string, list_medium: number };
type Staff = { name: string; shop: string; rank: number, section: string };
type ResponseData = { period: string, register: number, reserve: number, interview: number, appointment: number, cancel: number, contract: number };
type CheckItem = {
    name: string;
    show: boolean;
};
type CheckedState = {
    [key: string]: CheckItem;
};
type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };
type InterviewAction = {
    day: string;
    action: string;
    note: string;
};
type InterviewLog = {
    id: string,
    shop: string,
    name: string,
    interview_log: InterviewAction[],
    add: boolean
};

const originalShopArray = [{
    shop: '買い:中古リノベ', section: '中古住宅専門店'
}, {
    shop: '買い:ポータル', section: '中古住宅専門店'
}, {
    shop: '売り:ポータル', section: '中古住宅専門店'
}];

const KPIMapping = {
    '中古リノベ全体': ['総反響', '接触', '対面接触', '契約', '粗利総額'],
    '買い:中古リノベ': ['総反響', '接触(通話・返信)', '来場面談', '売買契約', 'リフォーム契約', '粗利総額'],
    '買い:ポータル': ['総反響', '接触(通話・返信)', '物件案内', '売買契約', '粗利総額'],
    '売り:ポータル': ['総反響', '査定アポ・査定書提出', '訪問査定', '媒介取得', '粗利総額']
};

const ShopTrendResale = () => {
    const { authority, category } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<Shop[]>(originalShopArray);
    const [originalCustomerList, setOriginalCustomerList] = useState<Customer[]>([]);
    const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
    const [startMonth, setStartMonth] = useState('2026/06');
    const [endMonth, setEndMonth] = useState('');
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [targetMedium, setTargetMedium] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetBrand, setTargetBrand] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [sectionArray, setSectionArray] = useState<string[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [show, setShow] = useState(false);
    const [gemini, setGemini] = useState('');
    const [responseLineData, setResponseLineData] = useState<ResponseData[]>([]);
    const [modalTitle, setModalTitle] = useState<string>('');
    const [geminiApi, setGeminiApi] = useState(false);
    const { token } = useContext(AuthContext);
    const [budgetList, setBudget] = useState<Budget[]>([]);
    const [checked, setChecked] = useState<CheckedState>({
        register: { name: '総反響数', show: true },
        interview: { name: '実来場数', show: true },
        appointment: { name: '次アポ数', show: true },
        contract: { name: '契約数', show: true },
        profit: { name: '粗利総額', show: true },
        budget: { name: '広告費', show: false },
        comparison: { name: '昨年実績', show: false },
    });
    const [mediumChecked, setMediumChecked] = useState({});
    const [listShow, setListShow] = useState({ show: false, label: '' });
    const [modalList, setModalList] = useState<Customer[]>([]);
    const [listPage, setListPage] = useState(1);
    const [interviewId, setInterviewId] = useState('');

    const [editId, setEditId] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'shopTrend', category });
                await setOriginalCustomerList(response.data.customer);
                await setMediumArray(response.data.medium);
                await setOriginalMonthArray(getYearMonthArray(2025, 1));
                await setStaff(response.data.staff.filter(s => s.rank === 1));
                await setBudget(response.data.budget);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    }, []);

    const customerList = useMemo(() => {
        const filtered = originalCustomerList.filter(item => {
            const sectionShops = shopArray.filter(s => s.section === targetSection).map(s => s.shop);
            return ((targetMedium && targetMedium !== 'all') ? item.medium === targetMedium : true) &&
                ((targetMedium === 'all' && !Object.values(mediumChecked).every(v => v))
                    ? (mediumChecked[item.medium] !== false)
                    : true)
                && (targetSection && targetSection !== 'all' ? sectionShops.includes(item.shop) : true)
        });
        return filtered;
    }, [originalCustomerList, shopArray, targetSection, targetMedium, mediumChecked]);

    const monthArray = useMemo(() => {
        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length
        const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
        return filteredMonthArray;
    }, [startMonth, endMonth, originalMonthArray]);

    useEffect(() => {
        if (!geminiApi) return;
        setGemini('');
        const sectionShops = shopArray.filter(s => s.section === targetSection).map(s => s.shop);
        const data = monthArray.map(month => {
            const formattedMedium = mediumArray.filter(m => m.list_medium === 1 && (targetMedium ? m.medium === targetMedium : true)).map(m => m.medium);
            formattedMedium.push('合計');
            const periodSummary = formattedMedium.map(medium => {
                const totalValue = customerList.filter(item => (targetSection ? sectionShops.includes(item.shop) : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && formate(item.register).includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                const interviewValue = customerList.filter(item => (targetSection ? sectionShops.includes(item.shop) : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && formate(item.interview).includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                const appointmentValue = customerList.filter(item => (targetSection ? sectionShops.includes(item.shop) : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && (item.appointment || item.screening || item.contract) && formate(item.interview).includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                const contractValue = customerList.filter(item => (targetSection ? sectionShops.includes(item.shop) : true) && (targetBrand ? item.shop.includes(modalTitle) : true) && ((targetBrand === '' && targetSection === '' && shopArray.map(s => s.shop).includes(modalTitle)) ? item.shop === modalTitle : true) && formate(item.contract).includes(month) && (medium !== '合計' ? item.medium === medium : true)).length;
                return {
                    medium: medium,
                    total: totalValue,
                    interview: interviewValue,
                    appointment: appointmentValue,
                    contract: contractValue,
                }
            });
            let shopValue;
            if (shopArray.map(s => s.shop).includes(modalTitle)) {
                shopValue = modalTitle;
            } else if (targetBrand) {
                shopValue = shopArray.filter(s => s.brand === targetBrand).map(s => s.shop).join();
            } else if (targetSection) {
                shopValue = targetSection;
            } else {
                shopValue = '建売営業全体';
            }
            return {
                period: month,
                shop: shopValue,
                medium: targetMedium ? `${targetMedium}のみ` : mediumArray.map(m => m.medium).join(),
                amount: periodSummary
            }
        });

        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/summary", { data }, { headers });

                setGemini(response.data);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };
        fetchData();
    }, [geminiApi]);

    useEffect(() => {
        if (targetMedium !== 'all') return;
        const checkedObject = {};
        mediumArray.forEach(m =>
            checkedObject[m.medium] = true
        );
        checkedObject['その他'] = true;
        setMediumChecked(checkedObject);
    }, [targetMedium]);

    const showSummary = (title: string) => {
        setShow(true);
        const sectionShops = originalShopArray.filter(o => o.section === title).map(o => o.shop);
        const filtered: ResponseData[] = monthArray.map(m => {
            const matchTarget = (c: Customer) =>
                title === '建売営業全体'
                    ? true
                    : targetSection === 'all'
                        ? sectionShops.includes(c.shop)
                        : sectionArray.includes(title)
                            ? sectionShops.includes(c.shop)
                            : c.shop === title;

            const registerValue = originalCustomerList.filter(c => formate(c.register).includes(m) && matchTarget(c)).length;
            const reserveValue = originalCustomerList.filter(c => (c.interview.includes(m) || c.reserved_interview?.replace(/-/g, '/').includes(m)) && matchTarget(c)).length;
            const interviewValue = originalCustomerList.filter(c => (formate(c.interview).includes(m) || formate(c.appointment).includes(m) || formate(c.screening).includes(m) || formate(c.contract).includes(m)) && matchTarget(c)).length;
            const appointmentValue = originalCustomerList.filter(c => (formate(c.appointment).includes(m) || formate(c.screening).includes(m) || formate(c.contract).includes(m)) && matchTarget(c)).length;
            const cancelValue = originalCustomerList.filter(c => c.reserved_interview?.replace(/-/g, '/').includes(m) && matchTarget(c)).length;
            const contractValue = originalCustomerList.filter(c => formate(c.contract).includes(m) && c.status === '契約済み' && matchTarget(c)).length;
            return {
                period: m,
                register: registerValue,
                reserve: reserveValue,
                interview: interviewValue,
                appointment: appointmentValue,
                cancel: cancelValue,
                contract: contractValue
            }
        });
        setResponseLineData(filtered);
        let formattedTitle;
        if (title) {
            formattedTitle = title;
        } else if (!title && targetSection) {
            formattedTitle = targetSection;
        } else if (!title && targetBrand) {
            formattedTitle = targetBrand;
        } else {
            formattedTitle = '建売営業全体'
        }
        setModalTitle(formattedTitle);
    };

    const modalClose = () => {
        setResponseLineData([]);
        setGemini('');
        setShow(false);
        setGeminiApi(false);
        setListShow({ show: false, label: '' });
        setListPage(1);
    };

    const checkedChange = (e) => {
        const { name } = e.target;

        setChecked(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                show: !prev[name].show
            }
        }));
    };

    const sections: Shop[] = sectionArray.map(item => {
        return { brand: '', shop: item, section: item, area: '' }
    }
    );

    const formate = (value: string) => {
        return value ? value.replace(/-/g, '/') : '';
    };

    const getValue = (base: Customer[], monthIndex: number, month: string, target: string, period: string[] = monthArray) => {
        const formattedPeriod = period.map(p => formate(p));
        const formattedMonth = formate(month);
        const isPeriodMode = monthIndex < 1;

        // 1. 各階層のKPIキーを配列として定義
        const contactKeys = ['contact', 'appraisal', 'negotiation_apo'] as const;
        const interviewKeys = ['interview', 'valuation', 'tour'] as const;
        const screeningKeys = ['screening'] as const;
        const contractKeys = ['contract_reform', 'contract_buy', 'contract_sell'] as const;

        // 2. 共通の判定関数を用意（対象月 or 対象期間 に含まれているか）
        const hasMatchInMonth = (b: Customer, keys: readonly string[]) => {
            return keys.some(key => {
                const val = formate(b[key as keyof Customer] as string) || '';
                if (!val) return false;

                return isPeriodMode
                    ? formattedPeriod.includes(val.slice(0, 7))
                    : val.includes(formattedMonth);
            });
        };

        // 3. 対象階層のキーが「すべて未入力か」を判定する関数
        const isAllEmpty = (b: Customer, keys: readonly string[]) => {
            return keys.every(key => !b[key as keyof Customer]);
        };

        // --- メインロジック ---

        if (target === 'contact') {
            const higherKeys = [...interviewKeys, ...screeningKeys, ...contractKeys];
            return base.filter(b =>
                hasMatchInMonth(b, contactKeys) ||
                (isAllEmpty(b, contactKeys) && hasMatchInMonth(b, higherKeys))
            );
        }

        if (target === 'interview' || target === 'tour') {
            const higherKeys = [...screeningKeys, ...contractKeys];
            return base.filter(b =>
                hasMatchInMonth(b, interviewKeys) ||
                (isAllEmpty(b, interviewKeys) && hasMatchInMonth(b, higherKeys))
            );
        }

        if (target === '') {
            const higherKeys = [...screeningKeys, ...contractKeys];
            return base.filter(b =>
                hasMatchInMonth(b, interviewKeys) ||
                (isAllEmpty(b, interviewKeys) && hasMatchInMonth(b, higherKeys))
            );
        }

        if (target === 'contract') {
            return base.filter(b =>
                b.status === '契約済み' &&
                hasMatchInMonth(b, contractKeys) // ← b.contractのバグもこれで解消されます
            );
        }

        return base.filter(b => hasMatchInMonth(b, [target]));
    };

    const clickable = (value: number) => {
        return value ? {
            fontSize: '12px', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer', letterSpacing: '1px'
        } : { fontSize: '12px', fontWeight: '700' }
    };

    const handleShow = (list: Customer[], labelValue: string) => {
        if (list.length === 0) return;
        setModalList(list);
        setListShow({ show: true, label: labelValue });
    };

    const closeInformationEdit = () => {
        setEditId('');
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'shopTrend', category });
                await setOriginalCustomerList(response.data.customer);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    };

const formateSummary = (
        label: string,
        num: Customer[],
        den: Customer[],
        isDisplayLastYear?: boolean,
        lastYearValue?: number,
        colorCode: string = '#94a3b8' // デフォルト色を追加
    ) => {
        // 分母が0の場合はInfinityやNaNを防ぐために強制的に0にする
        const percentage = den.length === 0
            ? 0
            : Math.floor((num.length / den.length) * 100);
        
        const hasData = num.length > 0;

        return (
            <div 
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${colorCode}`,
                    borderRadius: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    cursor: hasData ? 'pointer' : 'default',
                    transition: 'all 0.2s ease-in-out',
                }}
                onClick={() => hasData ? handleShow(num, label) : null}
                onMouseEnter={(e) => {
                    if (hasData) {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.opacity = '0.8';
                    }
                }}
                onMouseLeave={(e) => {
                    if (hasData) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.opacity = '1';
                    }
                }}
            >
                <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>
                    {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                        <span
                            style={{
                                color: hasData ? '#0284c7' : '#94a3b8',
                                fontWeight: 700,
                                fontSize: '13px',
                                textDecoration: 'none',
                                transition: 'color 0.2s ease'
                            }}
                        >
                            {num.length.toLocaleString()}
                        </span>
                        {label !== '総反響' && (
                            <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 500 }}>
                                ({percentage}%)
                            </span>
                        )}
                    </div>
                    {isDisplayLastYear && (
                        <span style={{
                            backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 5px',
                            borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #e2e8f0'
                        }}>
                            昨: {(lastYearValue ?? 0).toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const calculateProfit = (list: Customer[]) => {
        return (list.reduce((acc, cur) => acc + Number(cur.profit || 0) * 100, 0) / 100).toLocaleString();
    };

    const staffSummary = () => {
        const theme: Record<string, React.CSSProperties> = {
            table: { borderCollapse: 'separate', borderSpacing: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', width: '100%', backgroundColor: '#ffffff' },
            th: { backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', padding: '8px 6px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '11px' },
            tdName: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: '700', padding: '8px 6px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '11px' },
            tdContent: { padding: '6px', verticalAlign: 'top', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
        };
        const nestWrapperStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
        const getCardStyle = (colorCode: string): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${colorCode}`, borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.2s ease-in-out' });

        return <Table style={theme.table} responsive>
            <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                <tr className='sticky-header text-center'>
                    <td className='sticky-column text-center' style={{ ...theme.th, width: '120px' }}>店舗名</td>
                    {['全期間', ...monthArray].map((month, idx) => <td key={idx} style={theme.th}>{month}</td>)}
                </tr>
                {[{ name: targetShop, shop: targetShop, rank: 1 }, ...staff].filter(s => s.rank === 1).map((item, staffIndex) =>
                    <tr key={staffIndex}>
                        <td className='align-middle sticky-column text-center' style={theme.tdName}>{item.name}</td>
                        {['全期間', ...monthArray].map((month, monthIndex) => {
                            const base = customerList.filter(c => (staffIndex >= 1 ? c.staff === item.name && c.shop === targetShop : c.shop === targetShop));
                            const total = getValue(base, monthIndex, month, 'register');
                            const contact = getValue(base, monthIndex, month, 'contact');
                            const interview = getValue(base, monthIndex, month, 'interview');
                            const contractBase = getValue(base, monthIndex, month, 'contract');
                            const contract_buy = contractBase.filter(c => c.contract_buy);
                            const contract_reform = contractBase.filter(c => c.contract_reform);
                            const cancel = base.filter(c => (!c.interview && (monthIndex >= 1 ? formate(c.reserved_interview).includes(month) : monthArray.includes(formate(c.reserved_interview).slice(0, 7)))));
                            
                            return (
                                <td key={monthIndex} style={theme.tdContent}>
                                    <div style={nestWrapperStyle}>
                                        {checked.register.show && (
                                            <div 
                                                style={{ ...getCardStyle('#38bdf8'), cursor: total.length ? 'pointer' : 'default' }}
                                                onClick={() => total.length ? handleShow(total, '総反響') : null}
                                                onMouseEnter={(e) => { if (total.length) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.opacity = '0.8'; } }}
                                                onMouseLeave={(e) => { if (total.length) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; } }}
                                            >
                                                <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>総反響</div>
                                                <span style={{ color: total.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px' }}>{total.length.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div style={nestWrapperStyle}>
                                            {checked.interview.show && formateSummary(KPIMapping[targetShop]?.[1] ?? '', contact, total, false, 0, '#0ea5e9')}
                                            <div style={nestWrapperStyle}>
                                                {checked.appointment.show && formateSummary(KPIMapping[targetShop]?.[2] ?? '', interview, contact, false, 0, '#0284c7')}
                                                {item.name === '買い:中古リノベ' ? <>
                                                    <div style={nestWrapperStyle}>
                                                        {checked.contract.show && formateSummary(KPIMapping[targetShop]?.[3] ?? '', contract_reform, interview, false, 0, '#075985')}
                                                    </div>
                                                    <div style={nestWrapperStyle}>
                                                        {checked.contract.show && formateSummary(KPIMapping[targetShop]?.[4] ?? '', contract_buy, interview, false, 0, '#075985')}
                                                    </div>
                                                </> :
                                                    <div style={nestWrapperStyle}>
                                                        {checked.contract.show && formateSummary(KPIMapping[targetShop]?.[4] ?? '', contractBase, interview, false, 0, '#075985')}
                                                    </div>}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            )
                        })}
                    </tr>
                )}
            </tbody>
        </Table>
    };

    const shopSummary = () => {
        const theme: Record<string, React.CSSProperties> = {
            table: { borderCollapse: 'separate', borderSpacing: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', width: '100%', backgroundColor: '#ffffff' },
            th: { backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', padding: '8px 6px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '11px' },
            tdName: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: '700', padding: '8px 6px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '11px' },
            tdContent: { padding: '6px', verticalAlign: 'top', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
        };
        const nestWrapperStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
        const getCardStyle = (colorCode: string): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${colorCode}`, borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.2s ease-in-out' });
        const lastYearBadgeStyle: React.CSSProperties = { backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #e2e8f0' };
        const profitBadgeStyle: React.CSSProperties = { backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #fca5a5' };

        return <Table style={theme.table} responsive>
            <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                <tr className='sticky-header text-center'>
                    <td className='sticky-column text-center' style={{ ...theme.th, width: '120px' }}>店舗名</td>
                    {['全期間', ...monthArray].map((month, monthIndex) => {
                        const isDisplayLastYear = isLastYear(month) && monthIndex >= 1 && checked.comparison.show;
                        return <td key={monthIndex} style={theme.th}>{month}{isDisplayLastYear && <span style={{ ...lastYearBadgeStyle, marginLeft: '4px' }}>昨年</span>}</td>
                    })}
                </tr>
                {[
                    {
                        brand: '',
                        shop: (targetSection && targetSection !== 'all')
                            ? targetSection
                            : targetBrand
                                ? `${targetBrand}全体`
                                : '中古リノベ全体',
                        section: '',
                        area: ''
                    },
                    ...(targetSection !== 'all' ? shopArray : sections)
                ].map((target, targetIndex) => {
                    return <React.Fragment key={targetIndex}>
                        <tr>
                            <td className='align-middle sticky-column text-center' style={theme.tdName}>
                                {(targetMedium && targetMedium !== 'all') && <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>{targetMedium}</div>}
                                <div>{target.shop}</div>
                                <div className="bg-primary btn text-white rounded-pill py-0 mt-2" style={{ fontSize: '11px', cursor: 'pointer' }}
                                    onClick={() => showSummary(target.shop)}
                                >サマリ</div>
                            </td>
                            {['全期間', ...monthArray].map((month, monthIndex) => {
                                const sectionShops = originalShopArray.filter(o => o.section === target.shop).map(o => o.shop);
                                const base = setSection(customerList, targetSection, target.section, target.shop, targetIndex, sectionShops);
                                const total = getValue(base, monthIndex, month, 'register');
                                const contact = getValue(base, monthIndex, month, 'contact');
                                const interview = getValue(base, monthIndex, month, 'interview');
                                const contractBase = getValue(base, monthIndex, month, 'contract');
                                const contract_buy = contractBase.filter(c => c.contract_buy);
                                const contract_reform = contractBase.filter(c => c.contract_reform);
                                const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                                const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                                let lastYearValue;
                                if (monthIndex === 0 || isLastYear(month)) {
                                    lastYearValue = {
                                        total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                        contact: getValue(base, monthIndex, lastYear, 'contact', lastYearMonthArray).length,
                                        interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                        contractBase: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).length,
                                        contract_buy: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).filter(c => c.contract_buy).length,
                                        contract_reform: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).filter(c => c.contract_reform).length,
                                    };
                                }

                                // 以下予算
                                const isDisplayLastYear =
                                    checked.comparison.show &&
                                    (monthIndex === 0 || isLastYear(month));
                                const baseBudget = budgetList.filter(b =>
                                    (monthIndex > 0 ? formate(b.budget_period).includes(formate(month)) : monthArray.map(m => formate(m)).includes(formate(b.budget_period).slice(0, 7)))
                                    && (targetMedium ? b.medium === targetMedium : true));
                                const filteredBudget = budgetFilter(baseBudget, targetSection, target.shop, targetIndex);
                                const formattedValue = filteredBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                let formattedLastYearValue;
                                const lastYearBudget = budgetList.filter(b =>
                                    b.section === 'order'
                                    && (monthIndex > 0 ? b.budget_period.includes(lastYear) : lastYearMonthArray.includes(b.budget_period.slice(0, 7)))
                                    && (targetBrand ? b.shop.slice(0, 2) === targetBrand.slice(0, 2) : true)
                                    && (targetMedium ? b.medium === targetMedium : true));
                                const filteredLastYearBudget = budgetFilter(lastYearBudget, targetSection, target.shop, targetIndex);
                                formattedLastYearValue = filteredLastYearBudget.reduce((acc, cur) => acc + cur.budget_value, 0);
                                
                                return (
                                    <td key={monthIndex} style={theme.tdContent}>
                                        <div style={nestWrapperStyle}>
                                            {checked.register.show && (
                                                <div 
                                                    style={{ ...getCardStyle('#38bdf8'), cursor: total.length ? 'pointer' : 'default' }}
                                                    onClick={() => total.length ? handleShow(total, '総反響') : null}
                                                    onMouseEnter={(e) => { if (total.length) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.opacity = '0.8'; } }}
                                                    onMouseLeave={(e) => { if (total.length) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; } }}
                                                >
                                                    <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>{KPIMapping[target.shop]?.[0] ?? ''}</div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        <span style={{ color: total.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px' }}>{total.length.toLocaleString()}</span>
                                                        {isDisplayLastYear && <span style={lastYearBadgeStyle}>昨: {lastYearValue?.total?.toLocaleString() ?? 0}</span>}
                                                    </div>
                                                </div>
                                            )}
                                            <div style={nestWrapperStyle}>
                                                {checked.interview.show && formateSummary(KPIMapping[target.shop]?.[1] ?? '', contact, total, isDisplayLastYear, lastYearValue?.contact, '#0ea5e9')}
                                                <div style={nestWrapperStyle}>
                                                    {checked.appointment.show && formateSummary(KPIMapping[target.shop]?.[2] ?? '', interview, contact, isDisplayLastYear, lastYearValue?.interview, '#0284c7')}
                                                    {target.shop === '買い:中古リノベ' ? <>
                                                        <div style={nestWrapperStyle}>
                                                            {checked.contract.show && formateSummary(KPIMapping[target.shop]?.[3] ?? '', contract_buy, interview, isDisplayLastYear, lastYearValue?.contract_buy, '#075985')}
                                                            {checked.profit.show && (
                                                                <div style={getCardStyle('#10b981')}>
                                                                    <span style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>{KPIMapping[target.shop]?.[5] ?? ''}</span>
                                                                    <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>{calculateProfit(contract_buy)}万円</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={nestWrapperStyle}>
                                                            {checked.contract.show && formateSummary(KPIMapping[target.shop]?.[4] ?? '', contract_reform, interview, isDisplayLastYear, lastYearValue?.contract_reform, '#075985')}
                                                            {checked.profit.show && (
                                                                <div style={getCardStyle('#10b981')}>
                                                                    <span style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>{KPIMapping[target.shop]?.[5] ?? ''}</span>
                                                                    <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>{calculateProfit(contract_reform)}万円</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </> :
                                                        <div style={nestWrapperStyle}>
                                                            {checked.contract.show && formateSummary(KPIMapping[target.shop]?.[3] ?? '', contractBase, interview, isDisplayLastYear, lastYearValue?.contractBase, '#075985')}
                                                            {checked.profit.show && (
                                                                <div style={getCardStyle('#10b981')}>
                                                                    <span style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>{KPIMapping[target.shop]?.[4] ?? ''}</span>
                                                                    <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>{calculateProfit(contractBase)}万円</span>
                                                                </div>
                                                            )}
                                                        </div>}
                                                </div>
                                            </div>
                                        </div>
                                        {checked.budget.show && <>
                                            <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0' }}></div>
                                            {[{ label: '総額', color: '#c03442' }, { label: '反響単価', color: '#b02a37' }, { label: '来場単価', color: '#8a1e28' }, { label: '契約単価', color: '#64151c' }]
                                                .map((item, index) => {
                                                    const budgetMapping: Record<number, number> = {
                                                        1: total.length,
                                                        2: interview.length,
                                                        3: contractBase.length
                                                    };
                                                    const lastYearBudgetMapping: Record<number, number> = {
                                                        1: lastYearValue?.total ?? 0,
                                                        2: lastYearValue?.interview ?? 0,
                                                        3: lastYearValue?.contractBase ?? 0
                                                    };

                                                    // 計算結果を一度変数に入れる
                                                    const calcBudget = Math.ceil(formattedValue / budgetMapping[index]);
                                                    const formattedBudget = Number.isFinite(calcBudget) ? calcBudget : 0;

                                                    // 昨年実績も同様にスッキリさせる
                                                    const calcLastYearBudget = Math.ceil(formattedLastYearValue / lastYearBudgetMapping[index]);
                                                    const lastYearFormattedBudget = Number.isFinite(calcLastYearBudget) ? calcLastYearBudget : 0;

                                                    return (
                                                        <div key={index} style={getCardStyle(item.color)}>
                                                            <span style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>{item.label}</span>
                                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                                <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>￥{index === 0 ? formattedValue.toLocaleString() : formattedBudget.toLocaleString()}</span>
                                                                {isDisplayLastYear && (
                                                                    <span style={profitBadgeStyle}>
                                                                        昨: ￥{index === 0 ? formattedLastYearValue.toLocaleString() : lastYearFormattedBudget.toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </>}
                                    </td>
                                )
                            })}
                        </tr>
                    </React.Fragment>
                })}
            </tbody>
        </Table>
    };

    const searchPart = () => {
        return <>                <div className="d-flex flex-wrap mb-1 search_condition">
            <div className="m-1">
                <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                    <option value="" selected>開始月</option>
                    {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                    ))}
                </select>
            </div>
            <span className='d-flex align-items-center mx-1'>～</span>
            <div className="m-1">
                <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                    <option value="" selected>終了月</option>
                    {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
                    ))}
                </select>
            </div>
            <div className="m-1">
                <select className="target" onChange={(e) => {
                    setTargetShop('')
                    setTargetMedium(e.target.value);
                }}>
                    <option value="">販促媒体を選択</option>
                    {mediumArray.map((item, index) =>
                        <option key={index} value={item.medium} selected={targetMedium === item.medium}>{item.medium}</option>
                    )}
                    <option value='all'>詳細設定</option>
                </select>
            </div>
            <div className="m-1">
                <select className="target" onChange={(e) => {
                    setTargetBrand('');
                    setTargetMedium('');
                    setTargetSection('');
                    setTargetShop(e.target.value);
                }}>
                    <option value="">店舗を選択</option>
                    {originalShopArray.filter(shop => !shop.shop?.includes('店舗未設定')).map(shop =>
                        <option value={shop.shop} selected={shop.shop === targetShop}>{shop.shop}</option>
                    )}
                </select>
            </div>
        </div>
            <div className="d-flex flex-wrap mb-1 search_condition">
                {Object.entries(checked).map(([key, value], index) => {
                    if ((value.name === '広告費' || value.name === '昨年実績') && targetShop) return;
                    return <div className="m-1" key={index}>
                        <label className="target checkbox d-flex align-items-center">
                            <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.name}を表示
                        </label>
                    </div>
                })}
            </div>
            {targetMedium === 'all' && <>
                <div style={{ fontSize: '12px' }}>表示する販促媒体を選択</div>
                <div className="d-flex flex-wrap my-1 search_condition rounded" style={{ backgroundColor: '#d4d4d4' }}>
                    {[...mediumArray, { id: 0, medium: 'その他', list_number: 0 }].map((m, mIndex) =>
                        <div className="mx-1" key={mIndex}>
                            <label className="target checkbox d-flex align-items-center">
                                <input type="checkbox" checked={mediumChecked[m.medium]} name={m.medium} className='me-1' onChange={() => setMediumChecked(prev => ({
                                    ...prev,
                                    [m.medium]: !prev[m.medium]
                                }))} />{m.medium}
                            </label>
                        </div>
                    )}
                </div></>}
            <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
        </>
    };

    return (
        <>
            <div className='content bg-white p-2'>
                {searchPart()}
                <div className="table-wrapper">
                    <div className="list_table">
                        <div style={{ width: `${(monthArray.length + 1) * 210 + 120}px` }}>
                            {targetShop ? staffSummary() : shopSummary()}
                        </div>
                    </div>
                </div>
            </div>
            <Modal show={show} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {geminiApi ? <div>{gemini ?
                        <>
                            <div className="text-center my-3">
                                <div className="rounded-pill mt-2 aiButton" style={{ fontSize: '11px', cursor: 'pointer' }}
                                    onClick={() => {
                                        setGeminiApi(false);
                                        setGeminiApi(true);
                                    }}>AIによる分析開始</div>
                            </div>
                            <div className='mt-1 mb-2 text-center'>AIによる市場分析結果
                                <div className="comment mt-4" dangerouslySetInnerHTML={{ __html: gemini }}></div>
                            </div>
                        </> :
                        <div className="text-center mt-1 mb-5" style={{ fontSize: '12px' }}>
                            <div className='rounded-pill mt-2 aiButton'><i className="fa-solid fa-rotate spinning me-2"></i>AIがデータの分析中...</div>
                            <div className='mt-3' style={{ fontSize: '12px' }}>データ分析には最大30秒ほど必要です</div>
                        </div>}</div>
                        : <div className="text-center mt-1 mb-5"><div className="rounded-pill mt-2 aiButton" style={{ fontSize: '11px', cursor: 'pointer' }}
                            onClick={() => setGeminiApi(true)}>AIによる分析開始</div></div>}
                    <div className="mb-5">
                        <div className="text-center mb-3" style={{ fontSize: '12px' }}>{modalTitle} 反響推移</div>
                        <div style={{ width: "95%", height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={responseLineData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontFamily: "Verdana", fill: "#555" }}
                                    />
                                    <Tooltip />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: "12px",
                                            fontFamily: "Arial, sans-serif",
                                            color: "#333",
                                        }}
                                        content={({ payload }) => (
                                            <div className='d-flex justify-content-center mt-3'>
                                                {["register", "reserve", "interview", "appointment", "contract", "cancel"].map(key => {
                                                    const entry = payload?.find(p => p.dataKey === key);
                                                    return (
                                                        <div className='m-1 px-2 py-1 rounded' key={key} style={{ backgroundColor: entry?.color, color: '#fff' }}>
                                                            {entry?.value}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    <Line type="monotone" dataKey="contract" stroke="#4b0082" strokeWidth={3} name="契約" />
                                    <Line type="monotone" dataKey="appointment" stroke="#198754" name="次アポ" />
                                    <Line type="monotone" dataKey="interview" stroke="#0d6efd" name="実来場" />
                                    <Line type="monotone" dataKey="register" stroke="#dc3545" name="総反響" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="px-5 mt-5" style={{ fontSize: '11px' }}>
                            <Table bordered>
                                <tbody>
                                    <tr style={{ textAlign: 'center' }}>
                                        <td colSpan={2}>名称</td>
                                        {['期間計', ...monthArray].map(month =>
                                            <td>{month}</td>
                                        )}
                                    </tr>
                                    {['総反響', '実来場', '次アポ', '契約'].map((label, labelIndex) => {
                                        const keyMap = ['register', 'reserve', 'interview', 'appointment', 'contract', 'cancel'];
                                        return <tr>
                                            {labelIndex === 0 && <td rowSpan={6} className='align-middle text-center'>{modalTitle}</td>}
                                            <td>{label}</td>
                                            {[{}, ...responseLineData].map((item, index) => {
                                                const value = index === 0 ? responseLineData.reduce((acc, cur) => acc + cur[keyMap[labelIndex]], 0) : item[keyMap[labelIndex]];
                                                return <td style={{ textAlign: 'right' }}>{value}</td>
                                            })}
                                        </tr>
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
            <Modal show={listShow.show} onHide={modalClose} size='lg'>
                <Modal.Header closeButton>{listShow.label}一覧</Modal.Header>
                <ModalBody>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
                            <tr>
                                <td>No</td>
                                <td>顧客名</td>
                                <td>店舗</td>
                                <td>担当営業</td>
                                <td>ステータス</td>
                                <td>ランク</td>
                                <td>販促媒体</td>
                            </tr>
                            {modalList.slice(listPage * 10 - 10, listPage * 10).map((item, index) =>
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td><span onClick={() => setEditId(item.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{item.customer}</span></td>
                                    <td>{item.shop}</td>
                                    <td>{item.staff}</td>
                                    <td>{item.status}</td>
                                    <td>{item.rank}</td>
                                    <td>{item.medium}</td>
                                </tr>)}
                        </tbody>
                    </Table>
                    <div className="d-flex px-3 justify-content-around" style={{ fontSize: '12px' }}>
                        <div className={`${listPage > 1 ? 'text-primary' : ''}`}
                            style={{ cursor: listPage > 1 ? 'pointer' : 'text' }}
                            onClick={() => {
                                if (listPage > 1) {
                                    setListPage(listPage - 1);
                                }
                            }}>前の10件</div>
                        <div className={`${modalList.length - listPage * 10 > 0 ? 'text-primary' : ''}`}
                            style={{ cursor: modalList.length - listPage * 10 > 0 ? 'pointer' : 'text' }}
                            onClick={() => {
                                if (modalList.length - listPage * 10 > 0) {
                                    setListPage(listPage + 1);
                                }
                            }}
                        >次の10件</div>
                    </div>
                </ModalBody>
            </Modal>
            <InterviewLog idValue={interviewId} setInterviewId={setInterviewId} />
            <InformationEditResale id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </>
    )
}

export default ShopTrendResale;