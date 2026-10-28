import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
import apiClient from '../../../utils/apiClient';
import { thisYear } from '../../../utils/thisYear';
import LeadFunnelPanel from '../common/LeadFunnelPanel';
import { callCountOf, defaultPeriod, periodGroups, periodHas, recvMonthKey } from '../common/leadFunnel';
import type { Period } from '../common/leadFunnel';
import type { Row, Settings } from '../summary/kpi';
import LeadHeader from '../common/LeadHeader';
import AuthContext from '../../../context/AuthContext';
import { removeSpaces, safeParse, BUY_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
import LeadEdit from '../common/LeadEdit';
import LeadCall, { CallLog } from '../common/LeadCall';
import DocumentViewer from '../documents/DocumentViewer';

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
    /** 一覧の絞り込みに使う表示フラグ（0 = 論理削除済み） */
    show_dashboard?: number | string | null;
    deleted_at?: string | null;
    deleted_by?: string | null;
    /** 契約書フォームの下書き JSON */
    docDraft?: string | null;
};

/** 設定のうち歩留まりの表で使うもの（担当者・期首月・反響単価） */
type LeadSettings = Settings & { srcCosts?: Record<string, number>; portalCosts?: Record<string, number> };

type initialData = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null; // 追加: 区分
    phone?: string | null;    // 追加: 連絡先(電話)
    mail?: string | null;     // 追加: 連絡先(メール)
    addr: string | null;
    price: number | null;
    fee: number | null;
    recordId?: string | null;   // 下書きの保存先 brokerage_listings.id
    docDraft?: string | null;   // 保存済みの下書き JSON
};

// ==========================================
// 💡 ヘルパー関数
// ==========================================
/** 一覧の「架電」の数。⚠️ v2.2.225: 以前のアプリと同じく type の無い記録も架電に数える（leadFunnel.ts の callCountOf） */
const parseCallCounts = (callDatesJson: string | null) => ({ call: callCountOf({ callDates: callDatesJson }), sms: 0, mail: 0 });

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

const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
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
    // ⚠️ v2.2.225: 期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）と設定。歩留まりは以前のアプリと同じ計算（common/leadFunnel.ts）
    const [period, setPeriod] = useState<Period>('');
    const [settings, setSettings] = useState<LeadSettings>({});

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
                    // 論理削除済み（show_dashboard = 0）は一覧に出さない
                    const responseLead = response.data.lead.filter((l: any) => l.kind === 'buyLeads' && !isSoftDeleted(l)).map((l: any) => ({
                        ...l,
                        connectDate: l.connectDate || null,
                        receivedDate: l.receivedDate || null,
                        viewDate: l.viewDate || null,
                        nextDate: l.nextDate || null,
                        nextNote: l.nextNote || null
                    }));
                    setLeads(responseLead);
                    // ⚠️ v2.2.225: 担当者・反響単価・期首月（歩留まりの表）。期間の既定は今月（今期に無ければ期首月）
                    const st: LeadSettings = response.data.settings ?? {};
                    setSettings(st);
                    setPeriod(prev => prev || defaultPeriod(st.fiscalStart));
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

    /** ⚠️ v2.2.225: 期間の選択肢（以前のアプリと同じ: 月別（今期）／通期／全期間） */
    const periodOptions = useMemo(() => periodGroups(settings.fiscalStart, leads as unknown as Row[]), [settings.fiscalStart, leads]);

    /** 一覧は選んだ期間に受信した反響（受信日の新しい順） */
    const filteredLeads = useMemo(() => {
        const result = period ? leads.filter(l => periodHas(period, recvMonthKey(l as unknown as Row), settings.fiscalStart)) : leads;
        return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
    }, [leads, period, settings.fiscalStart]);

    useEffect(() => {
        setDisplayLimit(15);
    }, [period]);

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

    /**
     * brokerage_listings の1行を部分更新する。
     * 画面を先に更新し（楽観的更新）、保存に失敗したら元の値へ戻す。
     */
    const handleApiPatch = async (id: string, fields: Record<string, unknown>) => {
        // 失敗時に戻すための退避と、履歴の差分を取るための変更前の値。
        // setState の更新関数の中で拾うと React 18 では次のレンダリングまで
        // 実行されず、この直後の行では空のままになるためクロージャから取る。
        const snapshot = leads;
        const before = snapshot.find(l => l.id === id);

        setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...fields } as BuyLead : l)));
        try {
            await saveBrokerageRecord(id, fields);
            // 保存が成功してから履歴を残す（失敗した変更を履歴に残さないため）
            if (before) {
                await recordFieldChanges({
                    entity: 'buy',
                    entityId: id,
                    entityNo: null,
                    label: before.name || before.targetProperty || id,
                    before,
                    after: fields,
                    by: userName || '不明',
                });
            }
        } catch (e) {
            console.error('[LeadBuy] 保存に失敗しました', { id, fields }, e);
            setLeads(snapshot);
            alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
        }
    };

    const handleApiUpdate = (id: string, field: string, value: string | number) => {
        void handleApiPatch(id, { [field]: value });
    };

    const handleAddClick = () => {
        setIsAdding(true);
    };

    const handleSaveNewLead = async () => {
        const name = newNameRef.current?.value;
        if (!name) {
            alert('顧客名を入力してください');
            return;
        }

        const newRecord: BuyLead = {
            id: newRecordId(),
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

        try {
            await saveBrokerageRecord(newRecord.id, {
                kind: 'buyLeads',
                name: newRecord.name,
                staff: newRecord.staff,
                portal: newRecord.portal,
                phase: newRecord.phase,
                receivedDate: newRecord.receivedDate,
                callDates: '[]',
                show_dashboard: 1,
            });
        } catch (e) {
            console.error('[LeadBuy] 新規リードの登録に失敗しました', newRecord, e);
            setLeads(prev => prev.filter(l => l.id !== newRecord.id));
            alert('新規リードの登録に失敗しました。もう一度お試しください。');
        }
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

        // 💡 追加: 架電記録の直後に次回連絡日の設定を促す（source.html の V12.askNext 相当）
        setCallTargetLead({ ...lead, callDates: updatedCallDates });
        setIsCallModalOpen(true);
    };

    const handleSaveCallLog = (leadId: string, updatedCallDatesJson: string, nextDate?: string, nextNote?: string) => {
        // 3項目を1リクエストにまとめる（別々に送ると途中で失敗したとき中途半端に保存される）
        void handleApiPatch(leadId, {
            callDates: updatedCallDatesJson,
            ...(nextDate !== undefined ? { nextDate } : {}),
            ...(nextNote !== undefined ? { nextNote } : {}),
        });
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
            // id は DB 側の突合キーなので更新値としては送らない。
            // 許可カラムに無いキーは broker_update.php 側で捨てられる。
            const { id, ...fields } = customerInfo as BuyLead;
            void handleApiPatch(id, fields);
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
            fee: fee,
            // 下書きの保存先と、保存済みの下書き
            recordId: lead.id,
            docDraft: lead.docDraft ?? null
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
                selectedMonth={period}
                setSelectedMonth={setPeriod}
                availableMonths={[]}
                periodGroups={periodOptions}
                handleAddClick={handleAddClick}
                isAdding={isAdding}
                headerLabel={headerLabel}
                nextActionAlert={nextActionAlert}
            />

            {!isLoading && (
                <>
                    {/* ⚠️ v2.2.225: タイル・ポータル別・担当者別ファネルは以前のアプリ（renderBuyLeads）と同じ計算（common/LeadFunnelPanel.tsx） */}
                    <LeadFunnelPanel kind="buy" rows={leads as unknown as Row[]} period={period} settings={settings} />
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