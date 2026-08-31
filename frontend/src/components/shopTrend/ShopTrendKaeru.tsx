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
import { setStaffLength } from '../../utils/setStaffLength';
import { budgetFilter } from '../../utils/budgetFilter';
import { get11MonthsAgoString } from '../../utils/get11MonthsAgoString';
import { isLastYear } from '../../utils/isLastYear';
import { ModalBody } from 'react-bootstrap';
import InformationEditKaeru from '../information/InformationEditKaeru';
import { thisYear } from '../../utils/thisYear';
import apiClient from '../../utils/apiClient';

type Shop = { brand: string; shop: string; section: string; area: string; }
type Customer = Record<string, string>;
type Medium = { id: number; medium: string, list_medium: number };
type Staff = { name: string; shop: string; rank: number, section: string };
type ResponseData = { period: string, register: number, contact: number, interview: number, application: number, contract: number };
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

const ShopTrendKaeru = () => {
    const { authority, category } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [originalCustomerList, setOriginalCustomerList] = useState<Customer[]>([]);
    const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
    const [startMonth, setStartMonth] = useState(startMonthValue);
    const [endMonth, setEndMonth] = useState('');
    const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
    const [monthArray, setMonthArray] = useState<string[]>([]);
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
        contact: { name: '接触数', show: true },
        interview: { name: '来場・物件案内', show: true },
        application: { name: '申込み', show: true },
        contract: { name: '契約数', show: true },
        budget: { name: '広告費', show: false },
        comparison: { name: '昨年実績', show: false }
    });
    const [mediumChecked, setMediumChecked] = useState({});
    const [listShow, setListShow] = useState({ show: false, label: '' });
    const [modalList, setModalList] = useState<Customer[]>([]);
    const [listPage, setListPage] = useState(1);

    const [editId, setEditId] = useState('');
    const [isReverse, setIsReverse] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", { request: 'shopTrend', category });
                await setOriginalCustomerList(response.data.customer);
                await setOriginalShopArray(response.data.shop.filter(s => !s.shop.includes('全店舗')));
                await setShopArray(response.data.shop);
                await setMediumArray(response.data.medium);
                await setOriginalMonthArray(getYearMonthArray(2025, 1));
                await setStaff(response.data.staff.filter(s => s.rank === 1 && s.period === String(thisYear)));
                await setBudget(response.data.budget);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
        setMonthArray(getYearMonthArray(2025, 1));
    }, []);

    useEffect(() => {
        const filtered = originalCustomerList.filter(item => {
            const sectionShops = originalShopArray.filter(s => s.section === targetSection).map(s => s.shop);
            return ((targetMedium && targetMedium !== 'all') ? item.medium === targetMedium : true) &&
                ((targetMedium === 'all' && !Object.values(mediumChecked).every(v => v))
                    ? (mediumChecked[item.medium] !== false)
                    : true)
                && (targetSection && targetSection !== 'all' ? sectionShops.includes(item.shop) : true)
        });
        setCustomerList(filtered);

        const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length
        const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
        setMonthArray(filteredMonthArray);

        const filteredShopArray = originalShopArray.filter(item => {
            return (targetSection ? item.section === targetSection : true)
        });
        setShopArray(filteredShopArray);

        const uniqueSectionArray = [...new Set(originalShopArray.filter(o => o.section).map(o => o.section))];
        const filteredSectionArray = uniqueSectionArray.sort((a, b) => {
            const numA = parseInt(a?.match(/\d+/)?.[0] ?? "9999", 10);
            const numB = parseInt(b?.match(/\d+/)?.[0] ?? "9999", 10);
            return numA - numB
        });
        setSectionArray(filteredSectionArray);
    }, [originalCustomerList, originalMonthArray, originalShopArray, startMonth, endMonth, targetMedium, targetSection, targetBrand, mediumChecked]);

    useEffect(() => {
        if (targetMedium !== 'all') return;
        const checkedObject = {};
        mediumArray.forEach(m =>
            checkedObject[m.medium] = true
        );
        checkedObject['その他'] = true;
        setMediumChecked(checkedObject);
    }, [targetMedium]);

    const formattedMonthArray = useMemo(() => {
        return isReverse ? [...monthArray].reverse() : [...monthArray];
    }, [monthArray, isReverse]);

    const showSummary = (title: string) => {
        setShow(true);
        const allShops = originalShopArray.map(o => o.shop);
        const sectionShops = originalShopArray.filter(o => sectionArray.includes(o.section)).map(o => o.shop);
        const target = originalCustomerList.filter(o => title === '建売営業全体' ? true :
            allShops.includes(title) ? o.shop === title : sectionArray.includes(title) ? sectionShops.includes(o.shop) : o.staff === title);
        const filtered: ResponseData[] = ['total', ...monthArray].map((m, mIndex) => {
            return {
                period: m,
                register: getValue(target, mIndex, m, 'register').length,
                contact: getValue(target, mIndex, m, 'contact').length,
                interview: getValue(target, mIndex, m, 'interview').length,
                application: getValue(target, mIndex, m, 'application').length,
                contract: getValue(target, mIndex, m, 'contract').length
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
        const registerKeys = ['register'] as const;
        const contactKeys = ['contact'] as const;
        const interviewKeys = ['interview', 'tour'] as const;
        const appointmentKeys = ['appointment'] as const;
        const screeningKeys = ['screening', 'obtain'] as const;
        const applicationKeys = ['application'] as const;
        const contractKeys = ['contract', 'contract_broker'] as const;

        // 2. 複数のキーの中で「最も古い日付（初回）」を取得する関数
        const getOldestDate = (b: Customer, keys: readonly string[]) => {
            const dates = keys
                .map(key => formate(b[key as keyof Customer] as string) || '')
                .filter(val => val !== '');

            if (dates.length === 0) return '';

            // 日付文字列をソートして一番古いものを返す
            return dates.sort()[0];
        };

        // 3. 取得した最古の日付が、対象月(または期間)に含まれるか判定する関数
        const isMatch = (dateStr: string) => {
            if (!dateStr) return false;
            return isPeriodMode
                ? formattedPeriod.includes(dateStr.slice(0, 7))
                : dateStr.includes(formattedMonth);
        };

        // 4. KPI判定の共通ロジック（自身の最古日付、なければ上位KPIの最古日付で判定）
        const evaluateKPI = (b: Customer, targetKeys: readonly string[], higherKeys: readonly string[] = []) => {
            const oldestTargetDate = getOldestDate(b, targetKeys);

            // 自身のステップに日付があれば、その一番古い日付で判定
            if (oldestTargetDate) {
                return isMatch(oldestTargetDate);
            }

            // 未入力の場合は上位KPIへフォールバック（上位KPIの中で一番古い日付を「到達日」とみなす）
            if (higherKeys.length > 0) {
                const oldestHigherDate = getOldestDate(b, higherKeys);
                return isMatch(oldestHigherDate);
            }

            return false;
        };

        // --- メインロジック ---

        if (target === 'contact') {
            const higherKeys = [...interviewKeys, ...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
            return base.filter(b => evaluateKPI(b, contactKeys, higherKeys));
        }

        if (target === 'interview' || target === 'tour') {
            const higherKeys = [...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
            return base.filter(b => evaluateKPI(b, interviewKeys, higherKeys));
        }

        if (target === 'appointment') {
            const higherKeys = [...screeningKeys, ...applicationKeys, ...contractKeys];
            return base.filter(b => evaluateKPI(b, appointmentKeys, higherKeys));
        }

        if (target === 'screening' || target === 'obtain') {
            const higherKeys = [...applicationKeys, ...contractKeys];
            return base.filter(b => evaluateKPI(b, screeningKeys, higherKeys));
        }

        if (target === 'application') {
            const higherKeys = [...contractKeys];
            return base.filter(b => evaluateKPI(b, applicationKeys, higherKeys));
        }

        if (target === 'contract') {
            return base.filter(b => b.status === '契約済み' && evaluateKPI(b, contractKeys));
        }

        // target === 'register' など単独キーへのフォールバック
        return base.filter(b => evaluateKPI(b, [target]));
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

    const searchParts = () => {
        return <> <div className="d-flex flex-wrap mb-1 search_condition">
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
                    setTargetShop('');
                    setTargetBrand('');
                    setTargetSection(e.target.value);
                }}><option value="">課を選択</option>
                    <option value="all">全課表示</option>
                    {sectionArray.map((item, index) =>
                        <option value={item} selected={item === targetSection} key={index}>{item}</option>
                    )}
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
                <div className="m-1">
                    <label className="target checkbox d-flex align-items-center">
                        <input type="checkbox" checked={isReverse === false} className='me-1' onChange={() => setIsReverse(!isReverse)} />期間を反転
                    </label>
                </div>
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

    const formateSummary = (
        label: string,
        num: Customer[],
        den: Customer[],
        isDisplayLastYear?: boolean,
        lastYearValue?: number,
        colorCode: string = '#94a3b8' // デフォルト色
    ) => {
        const percentage = den.length === 0 ? 0 : Math.floor((num.length / den.length) * 100);
        const hasData = num.length > 0; // クリック可能なデータがあるかどうかのフラグ

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
                    transition: 'all 0.2s ease-in-out', // 拡大・透明度の変化を滑らかにするアニメーション
                }}
                onClick={() => hasData ? handleShow(num, label) : null}
                onMouseEnter={(e) => {
                    if (hasData) {
                        e.currentTarget.style.transform = 'scale(1.02)'; // 少し拡大
                        e.currentTarget.style.opacity = '0.8'; // 少し透明に
                    }
                }}
                onMouseLeave={(e) => {
                    if (hasData) {
                        e.currentTarget.style.transform = 'scale(1)'; // 元に戻す
                        e.currentTarget.style.opacity = '1';
                    }
                }}
            >
                {/* 左側：ラベル */}
                <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>
                    {label}
                </div>

                {/* 右側：数値とパーセンテージ */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                        <span
                            style={{
                                // データ有: 青系（リンク色） / データ無: 薄いグレー（非活性感）
                                color: hasData ? '#0284c7' : '#94a3b8',
                                fontWeight: 700,
                                fontSize: '13px',
                                textDecoration: 'none', // 下線を廃止
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

                    {/* 昨年対比 */}
                    {isDisplayLastYear && (
                        <span style={{
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            padding: '2px 5px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 600,
                            border: '1px solid #e2e8f0'
                        }}>
                            昨: {lastYearValue?.toLocaleString() ?? 0}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const theme: Record<string, React.CSSProperties> = {
        table: {
            borderCollapse: 'separate',
            borderSpacing: 0,
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            width: '100%',
            backgroundColor: '#ffffff'
        },
        th: {
            backgroundColor: '#f8fafc',
            color: '#475569',
            fontWeight: '600',
            padding: '8px 6px',
            borderBottom: '1px solid #e2e8f0',
            whiteSpace: 'nowrap',
            fontSize: '11px'
        },
        tdName: {
            backgroundColor: '#f8fafc',
            color: '#334155',
            fontWeight: '700',
            padding: '8px 6px',
            borderBottom: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
            fontSize: '11px'
        },
        tdContent: {
            padding: '6px',
            verticalAlign: 'top',
            borderBottom: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc' // セル全体を薄いグレーにして白カードを浮き立たせる
        },
        cellContainer: {
            display: 'flex',
            flexDirection: 'column', // 完全に縦並びに
            gap: '4px', // 各カード間の隙間
        },
        budgetDivider: {
            borderTop: '1px dashed #cbd5e1',
            margin: '4px 0',
        }
    };

    const kpiColors = {
        register: '#38bdf8',    // ライトブルー
        contact: '#0ea5e9',     // スカイブルー
        interview: '#0284c7',   // ブルー
        application: '#0369a1', // ダークブルー
        contract: '#075985',    // ディープブルー
    };

    const staffSummary = () => {
        return (
            <Table style={theme.table} >
                <tbody style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
                    <tr className='sticky-header text-center'>
                        <td className='sticky-column' style={{ ...theme.th, width: '120px' }}>店舗名</td>
                        {['全期間',...formattedMonthArray].map((month, idx) => (
                            <td key={`th-${idx}`} style={theme.th}>{month}</td>
                        ))}
                    </tr>
                    {[{ name: targetShop, shop: targetShop, rank: 1 }, ...staff]
                        .filter(s => s.rank === 1 && s.shop === targetShop)
                        .map((item, staffIndex) => (
                            <tr key={`staff-${staffIndex}`}>
                                <td className='align-middle sticky-column text-center' style={theme.tdName}>
                                    {item.name}
                                    <div
                                        className="bg-primary btn text-white rounded-pill py-0 mt-2"
                                        style={{ fontSize: '10px', cursor: 'pointer', padding: '2px 10px' }}
                                        onClick={() => showSummary(item.name)}
                                    >
                                        サマリ
                                    </div>
                                </td>
                                {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                                    const base = customerList.filter(c => (staffIndex >= 1 ? c.staff === item.name : c.shop === targetShop));
                                    const total = getValue(base, monthIndex, month, 'register');
                                    const interview = getValue(base, monthIndex, month, 'interview');
                                    const application = getValue(base, monthIndex, month, 'application');
                                    const contact = getValue(base, monthIndex, month, 'contact');
                                    const contract = getValue(base, monthIndex, month, 'contract');

                                    const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`;
                                    const lastYearMonthArray = monthArray.map(m => `${String(Number(m.split('/')[0]) - 1)}/${m.split('/')[1]}`);

                                    let lastYearValue;
                                    if (monthIndex === 0 || isLastYear(month)) {
                                        lastYearValue = {
                                            total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                            contact: getValue(base, monthIndex, lastYear, 'contact', lastYearMonthArray).length,
                                            interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                            application: getValue(base, monthIndex, lastYear, 'application', lastYearMonthArray).length,
                                            contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).length,
                                        };
                                    }
                                    const isDisplayLastYear = checked.comparison.show && (monthIndex === 0 || isLastYear(month));

                                    return (
                                        <td key={`cell-${monthIndex}`} style={theme.tdContent}>
                                            {/* マトリョーシカをやめ、縦一列のフラットな構造に変更 */}
                                            <div style={theme.cellContainer}>
                                                {checked.register.show && formateSummary('総反響', total, [], isDisplayLastYear, lastYearValue?.total, kpiColors.register)}

                                                {checked.contact.show && formateSummary('接触', contact, total, isDisplayLastYear, lastYearValue?.contact, kpiColors.contact)}

                                                {(checked.interview.show || checked.tour?.show) && formateSummary('来場・物件案内', interview, contact, isDisplayLastYear, lastYearValue?.interview, kpiColors.interview)}

                                                {checked.application.show && formateSummary('申込み', application, interview, isDisplayLastYear, lastYearValue?.application, kpiColors.application)}

                                                {checked.contract.show && formateSummary('契約', contract, application, isDisplayLastYear, lastYearValue?.contract, kpiColors.contract)}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                </tbody>
            </Table>
        );
    };

    const shopSummary = () => {
        return (
            <Table style={theme.table}>
                <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                    <tr className='sticky-header text-center'>
                        <td className='sticky-column text-center' style={{ ...theme.th, width: '120px' }}>店舗名</td>
                        {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                            const isDisplayLastYear = isLastYear(month) && monthIndex >= 1 && checked.comparison.show;
                            return (
                                <td key={`th-${monthIndex}`} style={theme.th}>
                                    {month}
                                    {isDisplayLastYear && <span className='bg-white rounded text-dark px-2 ms-1' style={{ border: '1px solid #e2e8f0', fontSize: '9px' }}>昨年</span>}
                                </td>
                            );
                        })}
                    </tr>
                    {[
                        {
                            brand: '',
                            shop: (targetSection && targetSection !== 'all')
                                ? targetSection
                                : targetBrand
                                    ? `${targetBrand}全体`
                                    : '建売営業全体',
                            section: '',
                            area: ''
                        },
                        ...(targetSection !== 'all' ? shopArray : sections)
                    ]
                        .filter(shop => !shop.shop.includes('店舗未設定') && !shop.shop.includes('FH'))
                        .map((target, targetIndex) => {
                            const staffLength = setStaffLength(staff, targetSection, target.section, target.shop, targetIndex, category).length;

                            return (
                                <React.Fragment key={`shop-${targetIndex}`}>
                                    <tr>
                                        <td className='align-middle sticky-column text-center' style={theme.tdName}>
                                            {(targetMedium && targetMedium !== 'all') && <div style={{ fontSize: '10px', color: '#64748b' }}>{targetMedium}</div>}
                                            <div>{target.shop}</div>
                                            <div className='text-primary fw-bold' style={{ fontSize: '10px' }}>({staffLength}名)</div>
                                            <div
                                                className="bg-primary btn text-white rounded-pill py-0 mt-2"
                                                style={{ fontSize: '10px', cursor: 'pointer', padding: '2px 10px' }}
                                                onClick={() => showSummary(target.shop)}
                                            >
                                                サマリ
                                            </div>
                                        </td>
                                        {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                                            const sectionShops = originalShopArray.filter(o => o.section === target.shop).map(o => o.shop);
                                            const base = setSection(customerList, targetSection, target.section, target.shop, targetIndex, sectionShops);

                                            const total = getValue(base, monthIndex, month, 'register');
                                            const interview = getValue(base, monthIndex, month, 'interview');
                                            const application = getValue(base, monthIndex, month, 'application');
                                            const contact = getValue(base, monthIndex, month, 'contact');
                                            const contract = getValue(base, monthIndex, month, 'contract');

                                            const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`;
                                            const lastYearMonthArray = monthArray.map(m => `${String(Number(m.split('/')[0]) - 1)}/${m.split('/')[1]}`);

                                            let lastYearValue;
                                            if (monthIndex === 0 || isLastYear(month)) {
                                                lastYearValue = {
                                                    total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                                                    contact: getValue(base, monthIndex, lastYear, 'contact', lastYearMonthArray).length,
                                                    interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                                                    application: getValue(base, monthIndex, lastYear, 'application', lastYearMonthArray).length,
                                                    contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).length,
                                                };
                                            }

                                            const isDisplayLastYear = checked.comparison.show && (monthIndex === 0 || isLastYear(month));

                                            // --- 予算関連の処理 ---
                                            const baseBudget = budgetList.filter(b =>
                                                (monthIndex > 0 ? formate(b.budget_period).includes(formate(month)) : monthArray.map(m => formate(m)).includes(formate(b.budget_period).slice(0, 7)))
                                                && (targetMedium ? b.medium === targetMedium : true)
                                            );
                                            const filteredBudget = budgetFilter(baseBudget, targetSection, target.shop, targetIndex);
                                            const formattedValue = filteredBudget.reduce((acc, cur) => acc + cur.budget_value, 0);

                                            let formattedLastYearValue = 0;
                                            const lastYearBudget = budgetList.filter(b =>
                                                b.section === 'order'
                                                && (monthIndex > 0 ? b.budget_period.includes(lastYear) : lastYearMonthArray.includes(b.budget_period.slice(0, 7)))
                                                && (targetBrand ? b.shop.slice(0, 2) === targetBrand.slice(0, 2) : true)
                                                && (targetMedium ? b.medium === targetMedium : true)
                                            );
                                            const filteredLastYearBudget = budgetFilter(lastYearBudget, targetSection, target.shop, targetIndex);
                                            formattedLastYearValue = filteredLastYearBudget.reduce((acc, cur) => acc + cur.budget_value, 0);

                                            return (
                                                <td key={`cell-${monthIndex}`} style={theme.tdContent}>
                                                    {/* マトリョーシカ構造を廃止し、フラットに並べる */}
                                                    <div style={theme.cellContainer}>

                                                        {checked.register.show && formateSummary('総反響', total, [], isDisplayLastYear, lastYearValue?.total, kpiColors.register)}

                                                        {checked.contact.show && formateSummary('接触', contact, total, isDisplayLastYear, lastYearValue?.contact, kpiColors.contact)}

                                                        {(checked.interview.show || checked.tour?.show) && formateSummary('来場・物件案内', interview, contact, isDisplayLastYear, lastYearValue?.interview, kpiColors.interview)}

                                                        {checked.application.show && formateSummary('申込み', application, interview, isDisplayLastYear, lastYearValue?.application, kpiColors.application)}

                                                        {checked.contract.show && formateSummary('契約', contract, application, isDisplayLastYear, lastYearValue?.contract, kpiColors.contract)}

                                                        {/* --- 予算の表示ブロック --- */}
                                                        {checked.budget.show && (
                                                            <>
                                                                {/* KPIと予算の境界線（必要に応じて表示） */}
                                                                <div style={theme.budgetDivider}></div>
                                                                {[{ label: '総額', color: '#c03442' }, { label: '反響単価', color: '#b02a37' }, { label: '来場単価', color: '#8a1e28' }, { label: '契約単価', color: '#64151c' }]
                                                                    .map((item, index) => {
                                                                        // 計算の分母マッピング（indexに合わせる）
                                                                        const budgetMapping: Record<number, number> = {
                                                                            1: total.length,
                                                                            2: interview.length,
                                                                            3: contract.length
                                                                        };
                                                                        const lastYearBudgetMapping: Record<number, number> = {
                                                                            1: lastYearValue?.total ?? 0,
                                                                            2: lastYearValue?.interview ?? 0,
                                                                            3: lastYearValue?.contract ?? 0
                                                                        };

                                                                        // 計算処理
                                                                        const calcBudget = Math.ceil(formattedValue / budgetMapping[index]);
                                                                        const formattedBudget = Number.isFinite(calcBudget) ? calcBudget : 0;

                                                                        const calcLastYearBudget = Math.ceil(formattedLastYearValue / lastYearBudgetMapping[index]);
                                                                        const lastYearFormattedBudget = Number.isFinite(calcLastYearBudget) ? calcLastYearBudget : 0;

                                                                        return (
                                                                            <div
                                                                                key={`budget-${index}`}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    justifyContent: 'space-between',
                                                                                    alignItems: 'center',
                                                                                    padding: '4px 6px',
                                                                                    backgroundColor: '#ffffff',
                                                                                    border: '1px solid #e2e8f0',
                                                                                    borderLeft: `3px solid ${item.color}`, // 予算のアクセントカラー
                                                                                    borderRadius: '4px',
                                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                                                }}
                                                                            >
                                                                                <span style={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>{item.label}</span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '11px' }}>
                                                                                        ￥{index === 0 ? formattedValue.toLocaleString() : formattedBudget.toLocaleString()}
                                                                                    </span>
                                                                                    {isDisplayLastYear && (
                                                                                        <span style={{
                                                                                            backgroundColor: '#fef2f2',
                                                                                            color: '#b91c1c',
                                                                                            padding: '1px 4px',
                                                                                            borderRadius: '3px',
                                                                                            fontSize: '9px',
                                                                                            fontWeight: 600,
                                                                                            border: '1px solid #fca5a5'
                                                                                        }}>
                                                                                            昨: ￥{index === 0 ? formattedLastYearValue.toLocaleString() : lastYearFormattedBudget.toLocaleString()}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                }
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                </tbody>
            </Table>
        );
    };

    return (
        <>
            <div className='content bg-white p-2'>
                {searchParts()}
                <div className="table-wrapper">
                    <div className="list_table">
                        <div style={{ width: `${(monthArray.length + 1) * 175 + 120}px` }}>
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
                    <div className="mb-5">
                        <div className="text-center mb-3" style={{ fontSize: '12px' }}>{modalTitle} 反響推移</div>
                        <div style={{ width: "95%", height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={responseLineData.slice(1)}
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
                                                {["register", "contact", "interview", "tour", "contract"].map(key => {
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
                                    <Line type="monotone" dataKey="tour" stroke="#198754" name="申し込み" />
                                    <Line type="monotone" dataKey="interview" stroke="#0d6efd" name="来場・物件案内" />
                                    <Line type="monotone" dataKey="contact" stroke="#b1980b" name="接触" />
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
                                    {['総反響', '接触', '来場・物件案内', '申し込み', '契約'].map((label, labelIndex) => {
                                        const keyMap = ['register', 'contact', 'interview', 'application', 'contract'];
                                        return <tr>
                                            {labelIndex === 0 && <td rowSpan={6} className='align-middle text-center'>{modalTitle}</td>}
                                            <td>{label}</td>
                                            {[...responseLineData].map((item, index) => {
                                                return <td style={{ textAlign: 'right' }} key={index}>{item[keyMap[labelIndex]]}</td>
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
            <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </>
    )
}

export default ShopTrendKaeru;