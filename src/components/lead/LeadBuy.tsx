import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
import apiClient from '../../utils/apiClient';
import { thisYear } from '../../utils/thisYear';
import Table from 'react-bootstrap/Table';
import LeadHeader from './LeadHeader';
import AuthContext from '../../context/AuthContext';
import { removeSpaces, safeParse, BUY_END_REASONS } from './leadUtiles';
import LeadEdit from './LeadEdit';
import LeadCall, { CallLog } from './LeadCall';
import DocumentViewer from './DocumentViewer';

// ==========================================
// 💡 型定義
// ==========================================
type BuyLead = {
    id: string;
    receivedDate: string | null;
    portal: string;
    name: string;
    staff: string | null;
    phase: string;
    callDates: string | null;
    contactDate: string | null;
    phone: string;
    mail: string;
    targetProperty: string;
    budget: string | number;
    viewDate: string | null;
    reinsDate: string | null;
    priceRevDate: string | null;
    lastReportDate: string | null;
    followDate: string | null;
    connectDate: string | null;
    applicationDate: string | null;
    contractDate: string | null;
    nextDate: string | null;
    nextNote: string | null;
    addr: string | null;
    note: string | null;
};

type PeriodSummary = {
    count: number;
    contact: number;
    view: number;
    apply: number;
    contract: number;
    call: number;
    today: number;
    thisWeek: number;
    mail: number;
};

type initialData = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null; // 追加: 区分
    phone?: string | null;    // 追加: 連絡先(電話)
    mail?: string | null;     // 追加: 連絡先(メール)
    addr: string | null;
    price: number | null;
    fee: number | null;
};

// ==========================================
// 💡 ヘルパー関数
// ==========================================
const parseCallCounts = (callDatesJson: string | null) => {
    try {
        // 💡 修正: safeParse を用いて安全にパース
        const parsed = safeParse(callDatesJson) || [];
        const calls = parsed.filter((c: CallLog) => c.type === 'call');
        return { call: calls.length, sms: 0, mail: 0 };
    } catch (e) {
        return { call: 0, sms: 0, mail: 0 };
    }
};

const formatYen = (num: string | number | null) => {
    if (!num) return '―';
    return `¥${Number(num).toLocaleString()}`;
};

const formatDate = (dateStr: string | null | Date) => {
    if (!dateStr || String(dateStr).startsWith('0000')) return '―';
    if (dateStr instanceof Date) {
        const y = dateStr.getFullYear();
        const m = String(dateStr.getMonth() + 1).padStart(2, '0');
        const d = String(dateStr.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    }
    return dateStr.replace(/-/g, '/');
};

const calcRate = (part: number, total: number) => {
    if (total === 0) return '0.0%';
    return ((part / total) * 100).toFixed(1) + '%';
};

const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const getThisWeekDates = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));

    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dt = String(d.getDate()).padStart(2, '0');
        days.push(`${y}-${m}-${dt}`);
    }
    return days;
};

// 💡 仲介手数料の自動計算（800万円以下: 30万円、800万円超: 3% + 6万円）
const calcBrokerageFee = (priceVal: string | number | null | undefined): number | null => {
    if (!priceVal) return null;
    const price = Number(String(priceVal).replace(/[^\d.-]/g, ''));
    if (isNaN(price) || price === 0) return null;
    const actualPrice = price < 1000000 ? price * 10000 : price;
    if (actualPrice <= 8000000) {
        return 300000;
    } else {
        return actualPrice * 0.03 + 60000;
    }
};

// 💡 追加: 最終アクションを算出する関数
const getLastAction = (callDatesJson: string | null) => {
    if (!callDatesJson) return '―';
    try {
        const logs: CallLog[] = safeParse(callDatesJson) || [];
        if (logs.length === 0) return '―';

        // 日付の降順（新しい順）にソートして最初の要素を取得
        logs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const latest = logs[0];

        if (!latest.date) return '―';
        const formattedDate = latest.date.replace(/-/g, '/').slice(0, 16); // YYYY/MM/DD HH:mm 形式

        if (latest.type === 'call') {
            return `📞${formattedDate}`;
        } else if (latest.type === 'mail' || latest.type === 'sms') {
            return `✉️${formattedDate}`;
        }
        return formattedDate;
    } catch (e) {
        return '―';
    }
};

// ==========================================
// 💡 スタイル定義 (Bootstrapクラスから脱却しコンパクト化)
// ==========================================
const compactThStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: '11px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    backgroundColor: '#f8f9fa',
    color: '#495057',
    borderBottom: '1px solid #dee2e6'
};

const compactTdStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '11px',
    verticalAlign: 'middle',
    borderBottom: '1px solid #dee2e6'
};

const compactInputStyle: React.CSSProperties = {
    fontSize: '11px',
    padding: '2px 4px',
    height: '24px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
};

// 未担当行のハイライト用スタイル生成
const getTdStyle = (isUnassigned: boolean, baseStyle: React.CSSProperties = {}): React.CSSProperties => ({
    ...compactTdStyle,
    ...baseStyle,
    backgroundColor: isUnassigned ? '#fff5f5' : 'inherit',
});

const LeadBuy = () => {
    const { userName } = useContext(AuthContext);

    const [leads, setLeads] = useState<BuyLead[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [staffList, setStaffList] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    const [displayLimit, setDisplayLimit] = useState<number>(15);
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    const [isCallModalOpen, setIsCallModalOpen] = useState(false);
    const [callTargetLead, setCallTargetLead] = useState<BuyLead | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [customerInfo, setCustomerInfo] = useState<Partial<BuyLead>>({});

    const [documentShow, setDocumentShow] = useState(false);
    const [currentInitialData, setCurrentInitialData] = useState<initialData | undefined>(undefined);

    const newReceivedDateRef = useRef<HTMLInputElement>(null);
    const newPortalRef = useRef<HTMLSelectElement>(null);
    const newNameRef = useRef<HTMLInputElement>(null);
    const newStaffRef = useRef<HTMLSelectElement>(null);
    const newPhaseRef = useRef<HTMLSelectElement>(null);

    const formattedMonth = selectedMonth.replace('年', '-').replace('月', '-');

    const isReceived = (receivedDate: string | null) => {
        return !!receivedDate && receivedDate.includes(formattedMonth)
    };
    const isContacted = (phase: string, contactDate: string | null) => {
        return ['内見予約', '内見済み', '購入申込', '成約'].includes(phase) || (!!contactDate && contactDate.includes(formattedMonth));
    };
    const isViewed = (phase: string, viewDate: string | null) => {
        return ['内見済み', '購入申込', '成約'].includes(phase) || (!!viewDate && viewDate.includes(formattedMonth));
    };
    const isApplied = (phase: string, appliCationDate: string | null) => {
        return ['購入申込', '成約'].includes(phase) || (!!appliCationDate && appliCationDate.includes(formattedMonth));
    };
    const isContracted = (phase: string, contractDate: string | null) => {
        return phase === '成約' || (!!contractDate && contractDate.includes(formattedMonth));
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const today = `${String(year).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'planner', roll: 'lead' });
                if (response.data && response.data.lead) {
                    const responseLead = response.data.lead.filter((l: any) => l.kind === 'buyLeads').map((l: any) => ({
                        ...l,
                        connectDate: l.connectDate || null,
                        receivedDate: l.receivedDate || null,
                        viewDate: l.viewDate || null,
                        nextDate: l.nextDate || null,
                        nextNote: l.nextNote || null
                    }));
                    setLeads(responseLead);
                    setStaffList(response.data.staff.filter((s: any) => s.period === String(thisYear)).map((s: any) => s.name));
                }
            } catch (e) {
                alert('通信エラーが発生しました');
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100) {
                setDisplayLimit(prev => prev + 15);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const availableMonths = useMemo(() => {
        const months = leads.map(l => {
            if (!l.receivedDate || l.receivedDate.startsWith('0000')) return '';
            const [y, m] = l.receivedDate.split('-');
            return `${y}-${m}`;
        }).filter(Boolean);
        return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
    }, [leads]);

    // 💡 修正: フィルタリングと同時に降順ソートを実行
    const filteredLeads = useMemo(() => {
        let result = leads;
        if (selectedMonth) {
            result = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
        }
        // receivedDate の降順ソート
        return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
    }, [leads, selectedMonth]);

    useEffect(() => {
        setDisplayLimit(15);
    }, [selectedMonth]);


    const periodSummary = useMemo<PeriodSummary>(() => {
        let total = { count: 0, contact: 0, view: 0, apply: 0, contract: 0, call: 0, today: 0, thisWeek: 0, mail: 0 };

        const callLogArray = filteredLeads.map(f => safeParse(f.callDates));
        const flatLogs = callLogArray.flat();

        total.call = flatLogs.filter((f: CallLog) => f?.type === 'call').length;

        const thisWeekDates = getThisWeekDates();

        const todayLength = flatLogs.filter((c: CallLog) => c?.date && c.date.startsWith(today)).length;
        const thisWeekLength = flatLogs.filter((c: CallLog) => c?.date && thisWeekDates.some(d => c.date?.startsWith(d))).length;
        const mailLength = flatLogs.filter((c: CallLog) => c?.type === 'mail').length;

        total.today = todayLength;
        total.thisWeek = thisWeekLength;
        total.mail = mailLength;

        filteredLeads.forEach(lead => {
            if (isReceived(lead.receivedDate)) { total.count++; }
            if (isContacted(lead.phase, lead.contactDate)) { total.contact++; }
            if (isViewed(lead.phase, lead.viewDate)) { total.view++; }
            if (isApplied(lead.phase, lead.applicationDate)) { total.apply++; }
            if (isContracted(lead.phase, lead.contractDate)) { total.contract++; }
        });

        return total;
    }, [filteredLeads, selectedMonth, today]);

    // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）
    const nextActionAlert = useMemo(() => {
        let overdue = 0, missing = 0;
        for (const l of filteredLeads) {
            if (l.phase === '追客終了') continue;
            if (!l.nextDate) { missing++; continue; }
            if (l.nextDate.replace(/\//g, '-') < today) overdue++;
        }
        return { overdue, missing };
    }, [filteredLeads, today]);

    const portalSummary = useMemo(() => {
        const summary: Record<string, any> = {};
        let total = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };

        filteredLeads.forEach(lead => {
            const portal = lead.portal || 'その他';
            if (!summary[portal]) summary[portal] = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };

            summary[portal].count++;
            total.count++;

            if (isContacted(lead.phase, lead.contactDate)) { summary[portal].contact++; total.contact++; }
            if (isViewed(lead.phase, lead.viewDate)) { summary[portal].view++; total.view++; }
            if (isApplied(lead.phase, lead.applicationDate)) { summary[portal].apply++; total.apply++; }
            if (isContracted(lead.phase, lead.contractDate)) { summary[portal].contract++; total.contract++; }
        });

        const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
        return { sorted, total };
    }, [filteredLeads]);

    const staffSummary = useMemo(() => {
        const summary: Record<string, any> = {};
        let total = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };

        filteredLeads.forEach(lead => {
            const rawStaff = lead.staff || '未割当';
            const staffKey = rawStaff !== '未割当' ? removeSpaces(rawStaff) : rawStaff;

            if (!summary[staffKey]) {
                summary[staffKey] = { count: 0, contact: 0, view: 0, apply: 0, contract: 0 };
            }

            summary[staffKey].count++;
            total.count++;

            if (isContacted(lead.phase, lead.contactDate)) { summary[staffKey].contact++; total.contact++; }
            if (isViewed(lead.phase, lead.viewDate)) { summary[staffKey].view++; total.view++; }
            if (isApplied(lead.phase, lead.applicationDate)) { summary[staffKey].apply++; total.apply++; }
            if (isContracted(lead.phase, lead.contractDate)) { summary[staffKey].contract++; total.contract++; }
        });

        const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
        return { sorted, total };
    }, [filteredLeads]);

    const handleApiUpdate = (id: string, field: string, value: string | number) => {
        console.log(`[API UPDATE] ID: ${id} | Field: ${field} | Value: ${value}`);
    };

    const handleAddClick = () => {
        setIsAdding(true);
    };

    const handleSaveNewLead = () => {
        const name = newNameRef.current?.value;
        if (!name) {
            alert('顧客名を入力してください');
            return;
        }

        const newRecord: BuyLead = {
            id: `new_${Date.now()}`,
            receivedDate: newReceivedDateRef.current?.value || formatDate(new Date()),
            portal: newPortalRef.current?.value || '',
            name: name,
            staff: newStaffRef.current?.value || '',
            phase: newPhaseRef.current?.value || '反響受信',
            callDates: '[]',
            contactDate: null,
            phone: '',
            mail: '',
            targetProperty: '',
            budget: 0,
            viewDate: null,
            reinsDate: null,
            priceRevDate: null,
            lastReportDate: null,
            followDate: null,
            connectDate: null,
            applicationDate: null,
            contractDate: null,
            nextDate: null,
            nextNote: null,
            addr: null,
            note: null
        };

        setLeads(prev => [newRecord, ...prev]);
        setIsAdding(false);
    };

    const handleQuickCall = (lead: BuyLead) => {
        const now = getCurrentDateTime();
        const newLog: CallLog = { date: now, type: 'call', staff: userName || '不明', note: '' };

        let logs: CallLog[] = [];
        try {
            logs = JSON.parse(lead.callDates || '[]');
        } catch (e) { }

        logs.push(newLog);
        const updatedCallDates = JSON.stringify(logs);

        handleApiUpdate(lead.id, 'callDates', updatedCallDates);
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, callDates: updatedCallDates } : l));

        // 💡 追加: 架電記録の直後に次回連絡日の設定を促す（source.html の V12.askNext 相当）
        setCallTargetLead({ ...lead, callDates: updatedCallDates });
        setIsCallModalOpen(true);
    };

    const handleSaveCallLog = (leadId: string, updatedCallDatesJson: string, nextDate?: string, nextNote?: string) => {
        handleApiUpdate(leadId, 'callDates', updatedCallDatesJson);
        if (nextDate !== undefined) handleApiUpdate(leadId, 'nextDate', nextDate);
        if (nextNote !== undefined) handleApiUpdate(leadId, 'nextNote', nextNote);
        setLeads(prev => prev.map(l => l.id === leadId ? {
            ...l,
            callDates: updatedCallDatesJson,
            ...(nextDate !== undefined ? { nextDate } : {}),
            ...(nextNote !== undefined ? { nextNote } : {}),
        } : l));
    };

    // 💡 追加: 担当変更の確認ダイアログ（source.html の担当変更確認と同等）
    const handleStaffBlur = (lead: BuyLead, e: React.FocusEvent<HTMLSelectElement>) => {
        const prev = removeSpaces(lead.staff);
        const next = removeSpaces(e.target.value);
        if (prev && next && prev !== next) {
            if (!window.confirm(`担当を「${lead.staff}」から「${e.target.value}」に変更します。よろしいですか？`)) {
                e.target.value = prev;
                return;
            }
        }
        handleApiUpdate(lead.id, 'staff', e.target.value);
    };

    // 💡 追加: フェーズを「追客終了」にした際の理由入力（source.html の ieGuard 相当）
    const handlePhaseBlur = (lead: BuyLead, e: React.FocusEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '追客終了') {
            const reason = window.prompt(`追客終了の理由を入力してください（${BUY_END_REASONS.join('／')}）`, BUY_END_REASONS[0]);
            if (reason == null) {
                e.target.value = lead.phase || '';
                return;
            }
        }
        handleApiUpdate(lead.id, 'phase', val);
    };

    // 💡 追加: 次回連絡日セルの視覚強化（source.html の nextCell() 相当）
    const renderNextCell = (nextDate: string | null) => {
        if (!nextDate) return <span className="badge bg-secondary bg-opacity-10 text-secondary border" style={{ fontSize: '10px' }}>未設定</span>;
        const d = new Date(`${nextDate.replace(/\//g, '-')}T00:00:00`);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
        if (diffDays < 0) return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger" style={{ fontSize: '10px' }}>{formatDate(nextDate)}（{-diffDays}日超過）</span>;
        if (diffDays === 0) return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning" style={{ fontSize: '10px' }}>{formatDate(nextDate)}（本日）</span>;
        return <span className="text-muted">{formatDate(nextDate)}</span>;
    };

    const handleNameClick = (lead: BuyLead) => {
        setCustomerInfo(lead);
        setIsEditModalOpen(true);
    };

    const handleSaveCustomerInfo = () => {
        if (customerInfo.id) {
            setLeads(prev => prev.map(l => l.id === customerInfo.id ? { ...l, ...customerInfo } as BuyLead : l));
        }
        setIsEditModalOpen(false);
    };

    const handleOpenDocument = (lead: BuyLead) => {
        const priceVal = lead.budget;
        const parsedPrice = priceVal ? Number(String(priceVal).replace(/[^\d.-]/g, '')) : null;
        const actualPrice = parsedPrice ? (parsedPrice < 1000000 ? parsedPrice * 10000 : parsedPrice) : null;
        const fee = calcBrokerageFee(priceVal);

        const data: initialData = {
            name: lead.name || null,
            baikaiType: '専任媒介',
            category: null,
            phone: lead.phone || null,
            mail: lead.mail || null,
            addr: lead.addr || null,
            price: actualPrice,
            fee: fee
        };

        setCurrentInitialData(data);
        setDocumentShow(true);
    };

    const headerLabel = {
        title: '買い反響（ポータル）管理',
        describe: 'SUUMO・アットホーム等の購入反響を受信→追客→通電→内見→購入申込→成約で追跡。売り反響（一括査定）とは別枠で集計します。'
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
            <LeadHeader
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                availableMonths={availableMonths}
                handleAddClick={handleAddClick}
                isAdding={isAdding}
                headerLabel={headerLabel}
                nextActionAlert={nextActionAlert}
            />

            {!isLoading && (
                <>
                    {/* サマリーエリア */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', minWidth: '1200px' }}>
                        {[
                            { label: `${selectedMonth || '全期間'}受信リード`, value: periodSummary.count, color: '#3182ce', sub: '' },
                            { label: `架電数(${selectedMonth || '全期間'})`, value: periodSummary.call, color: '#38b2ac', sub: `本日 ${periodSummary.today}件／今週 ${periodSummary.thisWeek}件（チーム）\n✉️メール ${periodSummary.mail}件` },
                            { label: '通電', value: periodSummary.contact, color: '#ed8936', sub: `通電率 ${calcRate(periodSummary.contact, periodSummary.count)}` },
                            { label: '内見', value: periodSummary.view, color: '#9f7aea', sub: `内見率 ${calcRate(periodSummary.view, periodSummary.contact)}` },
                            { label: '購入申込', value: periodSummary.apply, color: '#48bb78', sub: `申込率 ${calcRate(periodSummary.apply, periodSummary.count)}／成約 ${periodSummary.contract}` },
                        ].map((item, idx) => (
                            <div key={idx} style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${item.color}` }}>
                                <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold', marginBottom: '4px' }}>{item.label}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.color === '#48bb78' ? '#198754' : '#212529' }}>{item.value}</div>
                                {item.sub && <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{item.sub}</div>}
                            </div>
                        ))}
                    </div>

                    {/* ファネルエリア */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', minWidth: '1200px', flexWrap: 'wrap' }}>
                        {/* ポータル別ファネル */}
                        <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
                                ポータル別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
                            </h6>
                            <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="bg-light">
                                    <tr>
                                        <th style={compactThStyle} className="text-start ps-2">ポータル</th>
                                        <th style={compactThStyle} className="text-end">反響</th>
                                        <th style={compactThStyle} className="text-end">通電</th>
                                        <th style={compactThStyle} className="text-end">通電率</th>
                                        <th style={compactThStyle} className="text-end">内見</th>
                                        <th style={compactThStyle} className="text-end">内見率</th>
                                        <th style={compactThStyle} className="text-end">購入申込</th>
                                        <th style={compactThStyle} className="text-end">申込率(反響比)</th>
                                        <th style={compactThStyle} className="text-end">成約</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {portalSummary.sorted.map(([portal, stats]) => (
                                        <tr key={portal}>
                                            <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{portal}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.view}</td>
                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.view, stats.contact)}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.apply}</td>
                                            <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.apply, stats.count)}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contract}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                                        <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">合計</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.count}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.contact}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(portalSummary.total.contact, portalSummary.total.count)}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.view}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(portalSummary.total.view, portalSummary.total.contact)}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{portalSummary.total.apply}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(portalSummary.total.apply, portalSummary.total.count)}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{portalSummary.total.contract}</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>

                        {/* 担当者別ファネル */}
                        <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
                                担当者別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
                            </h6>
                            <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
                                <thead className="bg-light">
                                    <tr>
                                        <th style={compactThStyle} className="text-start ps-2">担当者</th>
                                        <th style={compactThStyle} className="text-end">反響</th>
                                        <th style={compactThStyle} className="text-end">通電</th>
                                        <th style={compactThStyle} className="text-end">通電率</th>
                                        <th style={compactThStyle} className="text-end">内見</th>
                                        <th style={compactThStyle} className="text-end">内見率</th>
                                        <th style={compactThStyle} className="text-end">購入申込</th>
                                        <th style={compactThStyle} className="text-end">申込率(反響比)</th>
                                        <th style={compactThStyle} className="text-end">成約</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffSummary.sorted.map(([staff, stats]) => (
                                        <tr key={staff}>
                                            <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{staff}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.view}</td>
                                            <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.view, stats.contact)}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.apply}</td>
                                            <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.apply, stats.count)}</td>
                                            <td style={compactTdStyle} className="text-end fw-bold">{stats.contract}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                                        <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">チーム合計</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.count}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.contact}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.contact, staffSummary.total.count)}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.view}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.view, staffSummary.total.contact)}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{staffSummary.total.apply}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(staffSummary.total.apply, staffSummary.total.count)}</td>
                                        <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.contract}</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </>
            )}

            {/* ==========================================
                💡 メインリストセクション
            ========================================== */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minWidth: '1600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h6 style={{ fontSize: '14px', fontWeight: 'bold', color: '#343a40', margin: 0 }}>反響一覧</h6>
                    <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#e9ecef', borderRadius: '12px', color: '#6c757d' }}>{filteredLeads.length} 件</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th style={compactThStyle}>受信日</th>
                                <th style={compactThStyle}>ポータル</th>
                                <th style={compactThStyle}>顧客名</th>
                                <th style={compactThStyle}>担当</th>
                                <th style={compactThStyle}>フェーズ</th>
                                <th style={compactThStyle}>架電</th>
                                <th style={compactThStyle}>架電メモ</th>
                                <th style={compactThStyle}>最終アクション</th>
                                <th style={compactThStyle}>次回連絡</th>
                                <th style={{ ...compactThStyle, minWidth: '120px' }}>連絡先</th>
                                <th style={{ ...compactThStyle, minWidth: '180px', textAlign: 'left' }}>問合せ物件</th>
                                <th style={{ ...compactThStyle, textAlign: 'right' }}>予算・希望</th>
                                <th style={compactThStyle}>通電日</th>
                                <th style={compactThStyle}>内見日</th>
                                <th style={compactThStyle}>書類</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* 新規追加用インプット行 */}
                            {isAdding && (
                                <tr>
                                    <td style={getTdStyle(false, { borderLeft: '4px solid #3182ce' })}>
                                        <input type="date" style={compactInputStyle} defaultValue={formatDate(new Date()).replace(/\//g, '-')} ref={newReceivedDateRef} />
                                    </td>
                                    <td style={getTdStyle(false)}>
                                        <select style={compactInputStyle} defaultValue="" ref={newPortalRef}>
                                            <option value="">ポータル</option>
                                            {['SUUMO', 'アットホーム', "HOME'S", '自社HP', 'その他', '楽待'].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </td>
                                    <td style={getTdStyle(false)}>
                                        <input type="text" style={{ ...compactInputStyle, border: '1px solid #dee2e6' }} placeholder="顧客名" defaultValue="" ref={newNameRef} />
                                    </td>
                                    <td style={getTdStyle(false)}>
                                        <select style={compactInputStyle} defaultValue="" ref={newStaffRef}>
                                            <option value="">担当を選択</option>
                                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td style={getTdStyle(false)}>
                                        <select style={compactInputStyle} defaultValue="反響受信" ref={newPhaseRef}>
                                            <option value="">フェーズ</option>
                                            {['反響受信', '追客中', '通電済み', '内見予約', '内見済み', '購入申込', '成約', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </td>
                                    <td colSpan={9} style={{ ...getTdStyle(false), color: '#6c757d', textAlign: 'left', fontSize: '10px' }}>
                                        ※その他の詳細は追加後に設定できます。
                                    </td>
                                    <td style={getTdStyle(false)}>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }} onClick={handleSaveNewLead}>追加</button>
                                            <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', color: '#6c757d', border: '1px solid #ced4da', borderRadius: '4px' }} onClick={() => setIsAdding(false)}>取消</button>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {isLoading ? (
                                <tr>
                                    <td colSpan={15} style={{ padding: '40px', textAlign: 'center' }}>
                                        <div className="spinner-border text-primary" role="status"></div>
                                    </td>
                                </tr>
                            ) : filteredLeads.length > 0 ? (
                                filteredLeads.slice(0, displayLimit).map((lead) => {
                                    const counts = parseCallCounts(lead.callDates);
                                    // 💡 ハイライト判定: 担当者が未設定の場合
                                    const isUnassigned = !lead.staff || lead.staff.trim() === '';

                                    return (
                                        <tr key={lead.id}>
                                            <td style={getTdStyle(isUnassigned)}>{formatDate(lead.receivedDate)}</td>
                                            <td style={getTdStyle(isUnassigned)}>
                                                <select
                                                    style={{ ...compactInputStyle, fontWeight: 'bold' }}
                                                    defaultValue={lead.portal || ''}
                                                    onBlur={(e) => handleApiUpdate(lead.id, 'portal', e.target.value)}
                                                >
                                                    <option value="">ポータル</option>
                                                    {['SUUMO', 'アットホーム', "HOME'S", '自社HP', 'その他', '楽待'].map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </td>
                                            <td style={getTdStyle(isUnassigned)} className="fw-bold">
                                                <span
                                                    style={{ color: '#3182ce', textDecoration: 'underline dotted', cursor: 'pointer', fontSize: '12px' }}
                                                    onClick={() => handleNameClick(lead)}
                                                >
                                                    {lead.name}
                                                </span>
                                            </td>
                                            <td style={getTdStyle(isUnassigned)}>
                                                <select
                                                    style={{ ...compactInputStyle, color: isUnassigned ? '#dc3545' : 'inherit', fontWeight: isUnassigned ? 'bold' : 'normal' }}
                                                    defaultValue={removeSpaces(lead.staff)}
                                                    onBlur={(e) => handleStaffBlur(lead, e)}
                                                >
                                                    <option value="">未割当</option>
                                                    {staffList.map(s => (
                                                        <option key={s} value={removeSpaces(s)}>{s}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={getTdStyle(isUnassigned)}>
                                                <select
                                                    style={{ ...compactInputStyle, backgroundColor: isUnassigned ? '#fff' : '#f8f9fa', borderRadius: '4px', fontWeight: 'bold' }}
                                                    defaultValue={lead.phase || ''}
                                                    onBlur={(e) => handlePhaseBlur(lead, e)}
                                                >
                                                    <option value="">フェーズ</option>
                                                    {['反響受信', '追客中', '通電済み', '内見予約', '内見済み', '購入申込', '成約', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </td>
                                            <td style={getTdStyle(isUnassigned)}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: counts.call > 0 ? '#3182ce' : '#a0aec0', minWidth: '15px' }}>
                                                        {counts.call}
                                                    </span>
                                                    <button
                                                        style={{ fontSize: '9px', padding: '0 6px', height: '20px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '10px', cursor: 'pointer' }}
                                                        onClick={() => handleQuickCall(lead)}
                                                        title="架電を追加"
                                                    >
                                                        📞 架電
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={getTdStyle(isUnassigned)}>
                                                <button
                                                    style={{ fontSize: '10px', padding: '2px 8px', height: '24px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', color: '#6c757d' }}
                                                    onClick={() => {
                                                        setCallTargetLead(lead);
                                                        setIsCallModalOpen(true);
                                                    }}
                                                    title="架電履歴・メモを追加"
                                                >
                                                    <i className="fa-solid fa-pen"></i>メモ
                                                </button>
                                            </td>
                                            {/* 💡 最終アクションの表示 */}
                                            <td style={{ ...getTdStyle(isUnassigned), fontSize: '10px', fontWeight: 'bold', color: '#6c757d' }}>
                                                {getLastAction(lead.callDates)}
                                            </td>
                                            {/* 💡 次回連絡日のバインディング変更（期限超過・本日を色分け表示） */}
                                            <td style={getTdStyle(isUnassigned)}>{renderNextCell(lead.nextDate)}</td>

                                            <td style={{ ...getTdStyle(isUnassigned), whiteSpace: 'normal', lineHeight: '1.4', textAlign: 'left' }}>
                                                {lead.phone} <br /> <span style={{ fontSize: '9px', color: '#8898aa' }}>{lead.mail}</span>
                                            </td>
                                            <td style={{ ...getTdStyle(isUnassigned), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={lead.targetProperty || ''}>
                                                {lead.targetProperty}
                                            </td>
                                            <td style={{ ...getTdStyle(isUnassigned), fontWeight: 'bold', textAlign: 'right' }}>{formatYen(lead.budget)}</td>
                                            {/* 💡 日付のバインディング変更 */}
                                            <td style={{ ...getTdStyle(isUnassigned), color: '#8898aa' }}>{formatDate(lead.connectDate)}</td>
                                            <td style={{ ...getTdStyle(isUnassigned), color: '#8898aa' }}>{formatDate(lead.viewDate)}</td>
                                            <td style={getTdStyle(isUnassigned)}>
                                                <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }}
                                                    onClick={() => handleOpenDocument(lead)}>
                                                    <i className="fa-solid fa-file-contract me-1 text-secondary"></i>契約書
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={15} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                                        データが見つかりません。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ==========================================
                💡 架電履歴・メモ追加用モーダル
            ========================================== */}
            <LeadCall
                isOpen={isCallModalOpen}
                onClose={() => setIsCallModalOpen(false)}
                targetLead={callTargetLead}
                userName={userName || '不明'}
                onSaveLog={handleSaveCallLog}
            />

            <LeadEdit
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveCustomerInfo}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                leadCategory="buy"
                staffList={staffList}
            />

            <DocumentViewer
                documentShow={documentShow}
                setDocumentShow={setDocumentShow}
                initialData={currentInitialData}
            />
        </div>
    );
};

export default LeadBuy;