import React, { useEffect, useState, useContext, useMemo } from 'react';
import Table from 'react-bootstrap/Table';
import Card from 'react-bootstrap/Card';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';

// ==========================================
// 💡 型定義
// ==========================================
type ResponseInfo = {
    authority: string | null;
    shop: string | null;
    staff: string | null;
    medium: string | null;
    register: string | null;
    interview: string | null;
    appointment: string | null;
    contract: string | null;
};

type CallLog = {
    day: string | null;
    time: string | null;
    action: string | null;
    note: string | null;
    staff: string | null;
    status: string | null;
};

type CallInfo = {
    no: number;
    id: string;
    shop: string | null;
    staff: string | null;
    name: string | null;
    status: string | null;
    reserved_status: string | null;
    call_log: string | null;
};

type InterviewLog = {
    day: string | null;
    action: string | null;
    note: string | null;
    staff?: string | null;
};

type InterviewInfo = {
    no: number;
    name: string | null;
    id: string;
    shop: string | null;
    interview_log: string | null;
    staff?: string | null;
};

type ShopInfo = {
    id: number;
    brand: string;
    shop: string;
    division: string;
    section: string;
    area: string;
    report_flag: number;
};

type StaffInfo = {
    id: number;
    name: string;
    shop: string;
    section: string;
    period: string;
    status: string;
    report: number;
    position: string;
};

type DailyMetrics = {
    registers: number;
    interviews: number;
    contracts: number;
    totalCalls: number;
    connected: number;
    unconnected: number;
    sms: number;
    email: number;
    postalMail: number;
    firstInterview: number;
    subsequentInterview: number;
    propertyTour: number;
    assessmentApo: number;
    assessmentSubmit: number;
    visitAssessment: number;
    materialSend: number;
    zeroCustomer: number;
    lineGroup: number;
    preExam: number;
    interviewContract: number;
    contact: number;
    application: number;
    ownContract: number;
    brokerageContract: number;
    reformContract: number;
    buySellContract: number;
    brokerageAcquisition: number;
};

// 💡 PHPからのデータ揺れ（スペースの有無）を吸収する関数
const removeSpaces = (str: string | null | undefined) => (str || '').replace(/[\s\u3000]+/g, '');

const shopMapping: Record<string, string> = {
    '買い:中古リノベ': '中古住宅専門店',
    '買い:ポータル': '不動産企画係',
    '売り:ポータル': '不動産企画係'
};

const authorityMapping: Record<string, string> = {
    'order': '注文事業',
    'spec': '建売分譲事業',
    'used': '中古リノベ'
};

const positions = ['常務', '部長', '課長', '課長代理', '店長', '店長代理', '一般'];

const DailyReports = () => {
    const { category, shopName } = useContext(AuthContext);

    // ==========================================
    // 💡 月選択リストの生成 (2025年6月〜当月)
    // ==========================================
    const monthOptions = useMemo(() => {
        const options: string[] = [];
        const startDate = new Date(2025, 5, 1); // 2025年6月
        const endDate = new Date();
        let curr = new Date(startDate);
        while (curr <= endDate || (curr.getFullYear() === endDate.getFullYear() && curr.getMonth() === endDate.getMonth())) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            options.push(`${y}-${m}`);
            curr.setMonth(curr.getMonth() + 1);
        }
        return options.reverse();
    }, []);

    const [targetMonth, setTargetMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    const [targetDivision, setTargetDivision] = useState('');
    const [targetShop, setTargetShop] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [responseList, setResponseList] = useState<ResponseInfo[]>([]);
    const [callList, setCallList] = useState<CallInfo[]>([]);
    const [interviewList, setInterviewList] = useState<InterviewInfo[]>([]);
    const [shopList, setShopList] = useState<ShopInfo[]>([]);
    const [staffList, setStaffList] = useState<StaffInfo[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'daily_report' });
                if (response.data) {
                    const filteredResponse = (response.data.response || [])
                        .filter((r: ResponseInfo) => (!shopName || shopName === 'all') ? true : r.authority === shopName)
                        .map((r: ResponseInfo) => {
                            if (r.shop && shopMapping[r.shop]) {
                                return { ...r, shop: shopMapping[r.shop] };
                            }
                            return r;
                        });
                    setResponseList(filteredResponse);
                    setCallList(response.data.call || []);
                    setInterviewList(response.data.interview || []);
                    
                    setShopList((response.data.shop || []).filter((s: ShopInfo) => Number(s.report_flag) === 1));
                    const responseStaff = response.data.staff.filter((s: StaffInfo) => Number(s.report) === 1)
                        .sort((a: StaffInfo, b: StaffInfo) => {
                            const positionA = positions.indexOf(a.position) !== -1 ? positions.indexOf(a.position) : 6;
                            const positionB = positions.indexOf(b.position) !== -1 ? positions.indexOf(b.position) : 6;
                            return positionA - positionB;
                        });
                    setStaffList(responseStaff || []);
                }
            } catch (error) {
                console.error("日報データの取得に失敗しました:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        const filteredDivision = authorityMapping[shopName || ''] ?? '';
        if (filteredDivision) setTargetDivision(filteredDivision);

    }, [category, shopName]);

    // ==========================================
    // 💡 フィルタリング用データ生成
    // ==========================================
    const divisions = useMemo(() => {
        return Array.from(new Set(shopList.filter(s => s.division !== '不動産企画室').map(s => s.division).filter(Boolean)));
    }, [shopList]);

    const filteredShops = useMemo(() => {
        let shops = shopList;
        if (targetDivision) shops = shops.filter(s => s.division === targetDivision);
        return Array.from(new Set(shops.map(s => s.shop).filter(Boolean)));
    }, [shopList, targetDivision]);

    // ==========================================
    // 💡 日付配列の生成 (当月の1日〜末日)
    // ==========================================
    const datesInMonth = useMemo(() => {
        if (!targetMonth) return [];
        const [y, m] = targetMonth.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const dates: string[] = [];
        for (let i = 1; i <= lastDay; i++) {
            const d = String(i).padStart(2, '0');
            dates.push(`${y}-${String(m).padStart(2, '0')}-${d}`);
        }
        return dates;
    }, [targetMonth]);

    // ==========================================
    // 💡 階層別データの一括集計
    // ==========================================
    const aggregatedData = useMemo(() => {
        const divData: Record<string, Record<string, DailyMetrics>> = {};
        const shopData: Record<string, Record<string, DailyMetrics>> = {};
        const staffData: Record<string, Record<string, DailyMetrics>> = {};

        const emptyMetric = (): DailyMetrics => ({
            registers: 0, interviews: 0, contracts: 0,
            totalCalls: 0, connected: 0, unconnected: 0, sms: 0, email: 0, postalMail: 0,
            firstInterview: 0, subsequentInterview: 0, propertyTour: 0, assessmentApo: 0, assessmentSubmit: 0, visitAssessment: 0,
            materialSend: 0, zeroCustomer: 0, lineGroup: 0, preExam: 0, interviewContract: 0,
            contact: 0, application: 0, ownContract: 0, brokerageContract: 0, reformContract: 0, buySellContract: 0, brokerageAcquisition: 0
        });

        divisions.forEach(div => {
            divData[div] = {};
            datesInMonth.forEach(d => divData[div][d] = emptyMetric());
        });

        filteredShops.forEach(shop => {
            shopData[shop] = {};
            datesInMonth.forEach(d => shopData[shop][d] = emptyMetric());
        });

        const activeStaffs = staffList.filter(s => String(s.period) === '2027');
        activeStaffs.forEach(staff => {
            const sKey = removeSpaces(staff.name);
            staffData[sKey] = {};
            datesInMonth.forEach(d => staffData[sKey][d] = emptyMetric());
        });

        const getStaffKey = (logStaffName: string | null | undefined) => {
            if (!logStaffName) return '';
            const cleanLogName = removeSpaces(logStaffName);
            
            if (staffData[cleanLogName]) return cleanLogName;
            
            const matched = activeStaffs.find(s => {
                const fullClean = removeSpaces(s.name);
                const lastName = s.name.split(/[\s\u3000]+/)[0];
                return fullClean.includes(cleanLogName) || 
                       cleanLogName.includes(fullClean) || 
                       lastName === cleanLogName || 
                       cleanLogName.includes(lastName);
            });
            
            return matched ? removeSpaces(matched.name) : '';
        };

        // 1. ResponseInfo (反響・契約)
        responseList.forEach(r => {
            const sName = r.shop || '';
            if (!shopData[sName]) return;
            const divName = shopList.find(s => s.shop === sName)?.division;
            const staffNameKey = getStaffKey(r.staff);

            const regDate = String(r.register || '').replace(/\//g, '-');
            const intDate = String(r.interview || '').replace(/\//g, '-');
            const appDate = String(r.appointment || '').replace(/\//g, '-');
            const conDate = String(r.contract || '').replace(/\//g, '-');

            const addMetric = (date: string, key: keyof DailyMetrics) => {
                if (datesInMonth.includes(date)) {
                    shopData[sName][date][key]++;
                    if (divName && divData[divName]) divData[divName][date][key]++;
                    if (staffNameKey && staffData[staffNameKey] && staffData[staffNameKey][date]) {
                        staffData[staffNameKey][date][key]++;
                    }
                }
            };

            addMetric(regDate, 'registers');
            addMetric(intDate, 'interviews');
            if (appDate !== intDate) addMetric(appDate, 'interviews'); 
            addMetric(conDate, 'contracts');
        });

        // 2. CallInfo (追客ログ)
        callList.forEach(c => {
            const shopValue = shopMapping[c.shop || ''] ?? c.shop;
            if (!shopData[shopValue]) return;
            const divName = shopList.find(s => s.shop === shopValue)?.division;

            try {
                const logs: CallLog[] = JSON.parse(c.call_log || '[]');
                logs.forEach(log => {
                    const logDay = String(log.day || '').replace(/\//g, '-');
                    if (datesInMonth.includes(logDay)) {
                        const act = log.action;
                        const isCall = act === '通電' || act === '未通電';
                        const staffNameKey = getStaffKey(log.staff);

                        const updateObj = (obj: DailyMetrics) => {
                            if (isCall) {
                                obj.totalCalls++;
                                if (act === '通電') obj.connected++;
                                else obj.unconnected++;
                            }
                            if (act === 'SMS送信') obj.sms++;
                            if (act === 'メール送信') obj.email++;
                            if (act === '資料郵送') obj.postalMail++;
                        };

                        if (isCall || act === 'SMS送信' || act === 'メール送信' || act === '資料郵送') {
                            updateObj(shopData[shopValue][logDay]);
                            if (divName && divData[divName]) updateObj(divData[divName][logDay]);
                            if (staffNameKey && staffData[staffNameKey]) updateObj(staffData[staffNameKey][logDay]);
                        }
                    }
                });
            } catch (e) { }
        });

        // 3. InterviewInfo (商談詳細アクションログ)
        interviewList.forEach(i => {
            const shopValue = shopMapping[i.shop || ''] ?? i.shop;
            if (!shopData[shopValue]) return;
            const divName = shopList.find(s => s.shop === shopValue)?.division;

            try {
                const logs: InterviewLog[] = JSON.parse(i.interview_log || '[]');
                logs.forEach(log => {
                    const logDay = String(log.day || '').replace(/\//g, '-');
                    if (datesInMonth.includes(logDay)) {
                        const act = log.action;
                        const staffNameKey = getStaffKey(log.staff || i.staff);

                        const isFirst = act === '初回来場' || act === '初回面談';
                        const isSub = act === '2回目以降面談';
                        const isTour = act === '物件案内';
                        const isApo = act === '査定アポ';
                        const isSubm = act === '査定書提出';
                        const isVis = act === '訪問査定';
                        const isMat = act === '資料送付';
                        const isZero = act === '0次接客';
                        const isLine = act === 'LINEグループ作成';
                        const isPreEx = act === '事前審査';
                        const isIntCon = act === '契約';
                        const isContact = act === '接触（通話・返信）';
                        const isApp = act === '申し込み';
                        const isOwn = act === '自社契約';
                        const isBrok = act === '仲介契約';
                        const isRef = act === 'リフォーム契約';
                        const isBuySell = act === '売買契約';
                        const isAcq = act === '媒介取得';

                        const updateObj = (obj: DailyMetrics) => {
                            if (isFirst) obj.firstInterview++;
                            if (isSub) obj.subsequentInterview++;
                            if (isTour) obj.propertyTour++;
                            if (isApo) obj.assessmentApo++;
                            if (isSubm) obj.assessmentSubmit++;
                            if (isVis) obj.visitAssessment++;
                            if (isMat) obj.materialSend++;
                            if (isZero) obj.zeroCustomer++;
                            if (isLine) obj.lineGroup++;
                            if (isPreEx) obj.preExam++;
                            if (isIntCon) obj.interviewContract++;
                            if (isContact) obj.contact++;
                            if (isApp) obj.application++;
                            if (isOwn) obj.ownContract++;
                            if (isBrok) obj.brokerageContract++;
                            if (isRef) obj.reformContract++;
                            if (isBuySell) obj.buySellContract++;
                            if (isAcq) obj.brokerageAcquisition++;
                        };

                        updateObj(shopData[shopValue][logDay]);
                        if (divName && divData[divName]) updateObj(divData[divName][logDay]);
                        if (staffNameKey && staffData[staffNameKey]) updateObj(staffData[staffNameKey][logDay]);
                    }
                });
            } catch (e) { }
        });

        return { divData, shopData, staffData };
    }, [datesInMonth, responseList, callList, interviewList, shopList, staffList, divisions, filteredShops]);

    // ==========================================
    // 💡 UI / レンダリング関数
    // ==========================================
    const formatDateHeader = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const isWeekend = d.getDay() === 0 ? 'text-danger' : d.getDay() === 6 ? 'text-info' : '';
        return (
            <div className={isWeekend}>
                <div style={{ fontSize: '14px' }}>{d.getDate()}</div>
                <div style={{ fontSize: '10px', fontWeight: 'normal' }}>({days[d.getDay()]})</div>
            </div>
        );
    };

    // 💡 セル描画用コンポーネント (条件分岐を修正)
    const EntityCell = ({ data, division, rowShop }: { data: DailyMetrics, division: string, rowShop: string }) => {
        const hasKpi = data.registers > 0 || data.contracts > 0;
        
        const showOrder = division === '注文事業';
        const showSpec = division === '建売分譲事業';
        
        // 💡 修正：マスタの不備を考慮し、様々な条件で「中古リノベ」扱いにする
        const showRenove = division === '中古リノベ' || 
                           rowShop === '中古住宅専門店' || 
                           rowShop === '不動産企画係' || 
                           targetShop === '中古住宅専門店' || 
                           targetShop === '不動産企画係';

        const isUnknown = !showOrder && !showSpec && !showRenove;

        return (
            <td className="text-center align-top text-nowrap" style={{ padding: '8px 6px', minWidth: '160px', fontSize: '11px', lineHeight: '1.5' }}>
                <div 
                    className={`p-2 mb-2 rounded border ${hasKpi ? 'border-primary' : 'border-light'}`}
                    style={{ backgroundColor: hasKpi ? '#e7f1ff' : '#f8f9fa' }}
                >
                    <div className={data.registers > 0 ? "text-primary fw-bold" : "text-muted"}>反響数: {data.registers}</div>
                    <div className={data.contracts > 0 ? "text-success fw-bold" : "text-muted"}>契約数: {data.contracts}</div>
                </div>

                <div className="text-start mb-2 px-1">
                    <div className="fw-bold text-secondary mb-1 border-bottom border-secondary-subtle" style={{ fontSize: '10px' }}>
                        <i className="fa-solid fa-phone me-1"></i>追客
                    </div>
                    <div className={data.totalCalls > 0 ? "text-dark fw-bold" : "text-muted"}>架電: {data.totalCalls}</div>
                    <div className={data.connected > 0 ? "text-success fw-bold" : "text-muted"}>通電数: {data.connected}</div>
                    <div className={data.sms > 0 ? "text-dark fw-bold" : "text-muted"}>SMS送信: {data.sms}</div>
                    <div className={data.email > 0 ? "text-dark fw-bold" : "text-muted"}>メール送信: {data.email}</div>
                    <div className={data.postalMail > 0 ? "text-dark fw-bold" : "text-muted"}>資料郵送: {data.postalMail}</div>
                </div>

                <div className="text-start px-1">
                    <div className="fw-bold text-secondary mb-1 border-bottom border-secondary-subtle" style={{ fontSize: '10px' }}>
                        <i className="fa-solid fa-handshake me-1"></i>商談
                    </div>
                    
                    {showOrder && (
                        <>
                            <div className={data.materialSend > 0 ? "text-info fw-bold" : "text-muted"}>資料送付: {data.materialSend}</div>
                            <div className={data.zeroCustomer > 0 ? "text-info fw-bold" : "text-muted"}>0次接客: {data.zeroCustomer}</div>
                            <div className={data.firstInterview > 0 ? "text-info fw-bold" : "text-muted"}>初回面談: {data.firstInterview}</div>
                            <div className={data.subsequentInterview > 0 ? "text-info fw-bold" : "text-muted"}>2回目以降面談: {data.subsequentInterview}</div>
                            <div className={data.preExam > 0 ? "text-info fw-bold" : "text-muted"}>事前審査: {data.preExam}</div>
                            <div className={data.lineGroup > 0 ? "text-info fw-bold" : "text-muted"}>LINE作成: {data.lineGroup}</div>
                            <div className={data.interviewContract > 0 ? "text-info fw-bold" : "text-muted"}>契約: {data.interviewContract}</div>
                        </>
                    )}

                    {showSpec && (
                        <>
                            <div className={data.contact > 0 ? "text-info fw-bold" : "text-muted"}>接触(通話・返信): {data.contact}</div>
                            <div className={data.firstInterview > 0 ? "text-info fw-bold" : "text-muted"}>初回面談: {data.firstInterview}</div>
                            <div className={data.subsequentInterview > 0 ? "text-info fw-bold" : "text-muted"}>2回目以降面談: {data.subsequentInterview}</div>
                            <div className={data.application > 0 ? "text-info fw-bold" : "text-muted"}>申し込み: {data.application}</div>
                            <div className={data.ownContract > 0 ? "text-info fw-bold" : "text-muted"}>自社契約: {data.ownContract}</div>
                            <div className={data.brokerageContract > 0 ? "text-info fw-bold" : "text-muted"}>仲介契約: {data.brokerageContract}</div>
                        </>
                    )}

                    {showRenove && (
                        <>
                            <div className={data.firstInterview > 0 ? "text-info fw-bold" : "text-muted"}>初回面談: {data.firstInterview}</div>
                            <div className={data.propertyTour > 0 ? "text-info fw-bold" : "text-muted"}>物件案内: {data.propertyTour}</div>
                            <div className={data.subsequentInterview > 0 ? "text-info fw-bold" : "text-muted"}>2回目以降面談: {data.subsequentInterview}</div>
                            <div className={data.preExam > 0 ? "text-info fw-bold" : "text-muted"}>事前審査: {data.preExam}</div>
                            <div className={data.reformContract > 0 ? "text-info fw-bold" : "text-muted"}>リフォーム契約: {data.reformContract}</div>
                            <div className={data.buySellContract > 0 ? "text-info fw-bold" : "text-muted"}>売買契約: {data.buySellContract}</div>
                            <div className={data.assessmentApo > 0 ? "text-info fw-bold" : "text-muted"}>査定アポ: {data.assessmentApo}</div>
                            <div className={data.assessmentSubmit > 0 ? "text-info fw-bold" : "text-muted"}>査定書提出: {data.assessmentSubmit}</div>
                            <div className={data.visitAssessment > 0 ? "text-info fw-bold" : "text-muted"}>訪問査定: {data.visitAssessment}</div>
                            <div className={data.brokerageAcquisition > 0 ? "text-info fw-bold" : "text-muted"}>媒介取得: {data.brokerageAcquisition}</div>
                        </>
                    )}

                    {isUnknown && (
                        <div className="text-muted" style={{ fontSize: '9px' }}>設定外の事業部です({division || rowShop || '未設定'})</div>
                    )}
                </div>
            </td>
        );
    };

    const renderRow = (name: string, data: Record<string, DailyMetrics>, type: 'division' | 'shop' | 'staff') => {
        if (!data) return null;

        let rowDivision = '';
        let rowShop = '';
        if (type === 'division') {
            rowDivision = name;
        } else if (type === 'shop') {
            rowDivision = shopList.find(s => s.shop === name)?.division || '';
            rowShop = name;
        } else if (type === 'staff') {
            const staffShop = staffList.find(s => s.name === name)?.shop;
            rowDivision = shopList.find(s => s.shop === staffShop)?.division || '';
            rowShop = staffShop || '';
        }

        return (
            <tr key={name}>
                <th style={{ position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 2, boxShadow: 'inset -1px 0 0 #dee2e6', verticalAlign: 'middle' }} className="text-start text-dark fw-bold">
                    {type === 'division' && <i className="fa-solid fa-building text-primary me-2"></i>}
                    {type === 'shop' && <i className="fa-solid fa-shop text-warning me-2" style={{ marginLeft: '10px' }}></i>}
                    {type === 'staff' && <i className="fa-solid fa-user-tie text-muted me-2" style={{ marginLeft: '20px' }}></i>}
                    {name}
                </th>
                {datesInMonth.map(d => (
                    <EntityCell key={d} data={data[d]} division={rowDivision} rowShop={rowShop} />
                ))}
            </tr>
        );
    };

    const displayTitle = targetShop ? `${targetShop} 月次日報` : targetDivision ? `${targetDivision} 月次日報` : '全社 月次日報';

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#fafbfe', minHeight: '100vh' }}>
            <div className="d-flex flex-wrap justify-content-between align-items-end mb-3 border-bottom pb-3 gap-3">
                <h4 className="fw-bold text-secondary mb-0" style={{ letterSpacing: '1px' }}>
                    <i className="fa-solid fa-calendar-days me-2 text-primary"></i>{displayTitle}
                </h4>

                <div className="d-flex flex-wrap gap-2 align-items-center">
                    <select
                        className="form-select form-select-sm shadow-sm border-primary text-primary fw-bold"
                        style={{ width: 'auto', cursor: 'pointer', minWidth: '120px' }}
                        value={targetMonth}
                        onChange={e => setTargetMonth(e.target.value)}
                    >
                        {monthOptions.map(month => <option key={month} value={month}>{month.replace('-', '年')}月</option>)}
                    </select>

                    <select
                        className="form-select form-select-sm shadow-sm"
                        style={{ width: 'auto', cursor: 'pointer', minWidth: '130px' }}
                        value={targetDivision}
                        onChange={e => {
                            setTargetDivision(e.target.value);
                            setTargetShop('');
                        }}
                    >
                        <option value="">全事業部</option>
                        {divisions.map(div => <option key={div} value={div}>{div}</option>)}
                    </select>

                    <select
                        className="form-select form-select-sm shadow-sm"
                        style={{ width: 'auto', cursor: 'pointer', minWidth: '130px' }}
                        value={targetShop}
                        onChange={e => setTargetShop(e.target.value)}
                    >
                        <option value="">全店舗</option>
                        {filteredShops.map(shop => <option key={shop} value={shop}>{shop}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center mt-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="mt-2 text-muted">データを集計中...</div>
                </div>
            ) : (
                <Card className="shadow-sm border-0 rounded-3">
                    <Card.Body className="p-0">
                        <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                            <Table bordered hover className="mb-0 text-center text-nowrap" style={{ fontSize: '12px' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                                    <tr>
                                        <th style={{ position: 'sticky', left: 0, top: 0, backgroundColor: '#0f3675', color: '#fff', zIndex: 4, minWidth: '180px', verticalAlign: 'middle' }}>
                                            項目 / 日付
                                        </th>
                                        {datesInMonth.map(date => (
                                            <th key={date} style={{ backgroundColor: '#0f3675', color: '#fff', minWidth: '120px', verticalAlign: 'middle' }}>
                                                {formatDateHeader(date)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {!targetDivision && !targetShop && divisions.map(div => renderRow(div, aggregatedData.divData[div], 'division'))}

                                    {targetDivision && !targetShop && (
                                        <>
                                            <tr>
                                                <th colSpan={datesInMonth.length + 1} className="bg-light text-secondary text-start px-3 py-2 border-bottom-0">
                                                    <i className="fa-solid fa-folder-open me-2"></i>【{targetDivision}】店舗サマリ
                                                </th>
                                            </tr>
                                            {filteredShops.map(shop => renderRow(shop, aggregatedData.shopData[shop], 'shop'))}
                                        </>
                                    )}

                                    {targetShop && (
                                        <>
                                            <tr>
                                                <th colSpan={datesInMonth.length + 1} className="bg-light text-secondary text-start px-3 py-2 border-bottom-0">
                                                    <i className="fa-solid fa-store me-2"></i>【{targetShop}】全体サマリ
                                                </th>
                                            </tr>
                                            {renderRow(targetShop, aggregatedData.shopData[targetShop], 'shop')}

                                            <tr>
                                                <th colSpan={datesInMonth.length + 1} className="bg-light text-secondary text-start px-3 py-2 mt-2 border-bottom-0" style={{ borderTop: '2px solid #dee2e6' }}>
                                                    <i className="fa-solid fa-users me-2"></i>スタッフ別 行動アクション
                                                </th>
                                            </tr>
                                            {staffList
                                                .filter(s => String(s.period) === '2027' && s.shop === targetShop)
                                                .map(staff => renderRow(staff.name, aggregatedData.staffData[removeSpaces(staff.name)], 'staff'))
                                            }
                                        </>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            )}
        </div>
    );
};

export default DailyReports;