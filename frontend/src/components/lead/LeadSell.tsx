import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
import apiClient from '../../utils/apiClient';
import { thisYear } from '../../utils/thisYear';
import Table from 'react-bootstrap/Table';
import LeadHeader from './LeadHeader';
import AuthContext from '../../context/AuthContext';
import { removeSpaces, safeParse, LEAD_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from './leadUtiles';
import LeadEdit from './LeadEdit';
import LeadCall, { CallLog } from './LeadCall';
import DocumentViewer from './DocumentViewer';

export type SellLead = {
  internal_id: string;
  kind: string;
  id: string;
  no: string;
  freq: string;
  note: string | null;
  addr1: string | null;
  addr2: string | null;
  addr: string | null;
  price: string | number | null;
  budget: string | number | null;
  fee: string | number | null;
  feeManual: string;
  staff: string | null;
  portal: string | null;
  seller: string | null;     // 売主候補（氏名）
  customer: string | null;
  name: string | null;
  source: string | null;     // 反響元
  contact: string | null;
  keyInfo: string | null;
  category: string | null;   // 物件区分（戸建、マンション等）
  keyStatus: string | null;
  baikaiType: string | null; // 専任媒介、一般媒介など
  propStatus: string | null; // アクティブ、媒介終了など
  currentStatus: string | null;
  type: string | null;
  phase: string | null;
  priority: string | null;
  property: string | null;
  targetProperty: string | null;
  endReason: string | null;
  ledgerNo: string | null;
  extId: string | null;
  dealId: string | null;
  reinsDate: string | null;
  contractDate: string | null; // 契約日（媒介受託）
  priceRevDate: string | null;
  lastReportDate: string | null;
  followDate: string | null;
  settleDate: string | null;
  contactDate: string | null;  // 通電日
  visitDate: string | null;    // 訪問査定日
  connectDate: string | null;
  receivedDate: string | null; // 受信日
  viewDate: string | null;
  inputDate: string | null;
  renewDate: string | null;
  callDates: string | null;    // 架電履歴(JSON)
  nextDate: string | null;     // 次回連絡日
  nextNote: string | null;     // 次回アクション内容
  created_at: string;
  updated_at: string;
  master_data_id: string | null;
  property_db_id: string | null;
  property_db_name: string | null;
  show_dashboard: string;
  phone: string | null;
  mail: string | null;
  applicationDate: string | null;
  /** 売却理由・希望時期（ホット度スコアの加点対象） */
  reason?: string | null;
  timing?: string | null;
  /** 契約書フォームの下書き JSON */
  docDraft?: string | null;
  /** 論理削除の記録。show_dashboard = 0 のときに埋まる */
  deleted_at?: string | null;
  deleted_by?: string | null;
};

type PeriodSummary = {
  count: number;     // リード数
  contact: number;   // 通電数
  visit: number;     // 訪問査定数
  propose: number;   // 査定書提出数
  contract: number;  // 媒介受託数
  call: number;      // 架電総数
  today: number;     // 本日架電数
  thisWeek: number;  // 今週架電数
  mail: number;      // メール数
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
    recordId?: string | null;   // 下書きの保存先 brokerage_listings.id
    docDraft?: string | null;   // 保存済みの下書き JSON
};

const parseCallCounts = (callDatesJson: string | null) => {
  try {
    const parsed = safeParse(callDatesJson) || [];
    const calls = parsed.filter((c: CallLog) => c.type === 'call');
    return { call: calls.length, sms: 0, mail: 0 };
  } catch (e) {
    return { call: 0, sms: 0, mail: 0 };
  }
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

const getLastAction = (callDatesJson: string | null) => {
  if (!callDatesJson) return '―';
  try {
    const logs: CallLog[] = safeParse(callDatesJson) || [];
    if (logs.length === 0) return '―';
    logs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = logs[0];

    if (!latest.date) return '―';
    const formattedDate = latest.date.replace(/-/g, '/').slice(0, 16);

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

const getTdStyle = (isUnassigned: boolean, baseStyle: React.CSSProperties = {}): React.CSSProperties => ({
  ...compactTdStyle,
  ...baseStyle,
  backgroundColor: isUnassigned ? '#fff5f5' : 'inherit',
});

const SELL_SOURCES = ['イエウール', 'すまいステップ', 'イエイ', "HOME'S", 'カエール'];

const LeadSell = () => {
  const { userName } = useContext(AuthContext);

  const [leads, setLeads] = useState<SellLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [staffList, setStaffList] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const [displayLimit, setDisplayLimit] = useState<number>(15);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callTargetLead, setCallTargetLead] = useState<SellLead | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<Partial<SellLead>>({});

  const [documentShow, setDocumentShow] = useState(false);
  const [currentInitialData, setCurrentInitialData] = useState<initialData | undefined>(undefined);

  const newReceivedDateRef = useRef<HTMLInputElement>(null);
  const newSourceRef = useRef<HTMLSelectElement>(null);
  const newSellerRef = useRef<HTMLInputElement>(null);
  const newStaffRef = useRef<HTMLSelectElement>(null);
  const newPhaseRef = useRef<HTMLSelectElement>(null);

  const formattedMonth = selectedMonth.replace('年', '-').replace('月', '-');

  const isReceived = (receivedDate: string | null) => {
    return !!receivedDate && receivedDate.includes(formattedMonth);
  };
  const isContacted = (phase: string | null, contactDate: string | null) => {
    return ['訪問査定', '査定書提出', '媒介受託', '売却済'].includes(phase || '') || (!!contactDate && contactDate.includes(formattedMonth));
  };
  const isVisited = (phase: string | null, visitDate: string | null) => {
    return ['訪問査定', '査定書提出', '媒介受託', '売却済'].includes(phase || '') || (!!visitDate && visitDate.includes(formattedMonth));
  };
  const isProposed = (phase: string | null) => {
    return ['査定書提出', '媒介受託', '売却済'].includes(phase || '');
  };
  const isContracted = (phase: string | null, contractDate: string | null) => {
    return ['媒介受託', '売却済'].includes(phase || '') || (!!contractDate && contractDate.includes(formattedMonth));
  };

  const dateFormate = (date: string | null) => {
    return (date === '0000-00-00' || !date) ? '' : date;
  };

  const now = new Date();
  const today = `${String(now.getFullYear()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.post('', { request: 'planner', roll: 'lead' });
        if (response.data && response.data.lead) {
          // 論理削除済み（show_dashboard = 0）は一覧に出さない
          const responseLead = response.data.lead.filter((l: any) => l.kind === 'leads' && !isSoftDeleted(l)).map((l: any) => ({
            ...l,
            contactDate: dateFormate(l.contactDate),
            receivedDate: dateFormate(l.receivedDate),
            visitDate: dateFormate(l.visitDate),
            contractDate: dateFormate(l.contractDate),
            connectDate: dateFormate(l.connectDate),
            nextDate: dateFormate(l.nextDate),
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

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (selectedMonth) {
      result = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
    }
    return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
  }, [leads, selectedMonth]);

  useEffect(() => {
    setDisplayLimit(15);
  }, [selectedMonth]);

  const periodSummary = useMemo<PeriodSummary>(() => {
    let total = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0, call: 0, today: 0, thisWeek: 0, mail: 0 };

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
      if (isVisited(lead.phase, lead.visitDate)) { total.visit++; }
      if (isProposed(lead.phase)) { total.propose++; }
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

  const sourceSummary = useMemo(() => {
    const summary: Record<string, any> = {};
    let total = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };

    filteredLeads.forEach(lead => {
      const source = lead.source || lead.portal || 'その他';
      if (!summary[source]) summary[source] = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };

      summary[source].count++;
      total.count++;

      if (isContacted(lead.phase, lead.contactDate)) { summary[source].contact++; total.contact++; }
      if (isVisited(lead.phase, lead.visitDate)) { summary[source].visit++; total.visit++; }
      if (isProposed(lead.phase)) { summary[source].propose++; total.propose++; }
      if (isContracted(lead.phase, lead.contractDate)) { summary[source].contract++; total.contract++; }
    });

    const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
    return { sorted, total };
  }, [filteredLeads]);

  const staffSummary = useMemo(() => {
    const summary: Record<string, any> = {};
    let total = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };

    filteredLeads.forEach(lead => {
      const rawStaff = lead.staff || '未割当';
      const staffKey = rawStaff !== '未割当' ? removeSpaces(rawStaff) : rawStaff;

      if (!summary[staffKey]) {
        summary[staffKey] = { count: 0, contact: 0, visit: 0, propose: 0, contract: 0 };
      }

      summary[staffKey].count++;
      total.count++;

      if (isContacted(lead.phase, lead.contactDate)) { summary[staffKey].contact++; total.contact++; }
      if (isVisited(lead.phase, lead.visitDate)) { summary[staffKey].visit++; total.visit++; }
      if (isProposed(lead.phase)) { summary[staffKey].propose++; total.propose++; }
      if (isContracted(lead.phase, lead.contractDate)) { summary[staffKey].contract++; total.contract++; }
    });

    const sorted = Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
    return { sorted, total };
  }, [filteredLeads]);


  /**
   * brokerage_listings の1行を部分更新する。
   * 画面を先に更新し（楽観的更新）、保存に失敗したら元の値へ戻す。
   * 戻さないと「画面には反映されたのに DB には入っていない」状態になり、
   * 次のリロードで消えた理由が分からなくなるため。
   */
  const handleApiPatch = async (id: string, fields: Record<string, unknown>) => {
    // 失敗時に戻すための退避と、履歴の差分を取るための変更前の値。
    // setState の更新関数の中で拾うと React 18 では次のレンダリングまで
    // 実行されず、この直後の行では空のままになるためクロージャから取る。
    const snapshot = leads;
    const before = snapshot.find(l => l.id === id);

    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...fields } as SellLead : l)));
    try {
      await saveBrokerageRecord(id, fields);
      // 保存が成功してから履歴を残す（失敗した変更を履歴に残さないため）
      if (before) {
        await recordFieldChanges({
          entity: 'lead',
          entityId: id,
          entityNo: before.ledgerNo ? Number(before.ledgerNo) : null,
          label: before.seller || before.name || before.addr || id,
          before,
          after: fields,
          by: userName || '不明',
        });
      }
    } catch (e) {
      console.error('[LeadSell] 保存に失敗しました', { id, fields }, e);
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
    const seller = newSellerRef.current?.value;
    if (!seller) {
      alert('売主名を入力してください');
      return;
    }

    const newRecord: SellLead = {
      internal_id: '',
      // 'sellLeads' ではなく 'leads'。brokerage_listings.kind および
      // 一覧の絞り込み条件（kind === 'leads'）と一致させる必要がある。
      kind: 'leads',
      id: newRecordId(),
      no: '',
      freq: '',
      note: null,
      addr1: null,
      addr2: null,
      addr: null,
      price: null,
      budget: null,
      fee: null,
      feeManual: '',
      staff: newStaffRef.current?.value || '',
      portal: null,
      seller: seller,
      customer: seller,
      name: seller,
      source: newSourceRef.current?.value || '',
      contact: null,
      keyInfo: null,
      category: null,
      keyStatus: null,
      baikaiType: null,
      propStatus: null,
      currentStatus: null,
      type: null,
      phase: newPhaseRef.current?.value || '反響受信',
      priority: null,
      property: null,
      targetProperty: null,
      endReason: null,
      ledgerNo: null,
      extId: null,
      dealId: null,
      reinsDate: null,
      contractDate: null,
      priceRevDate: null,
      lastReportDate: null,
      followDate: null,
      settleDate: null,
      contactDate: null,
      visitDate: null,
      connectDate: null,
      receivedDate: newReceivedDateRef.current?.value || formatDate(new Date()),
      viewDate: null,
      inputDate: null,
      renewDate: null,
      callDates: '[]',
      nextDate: null,
      nextNote: null,
      created_at: '',
      updated_at: '',
      master_data_id: null,
      property_db_id: null,
      property_db_name: null,
      show_dashboard: '1',
      phone: '',
      mail: '',
      applicationDate: null
    };

    setLeads(prev => [newRecord, ...prev]);
    setIsAdding(false);

    try {
      await saveBrokerageRecord(newRecord.id, {
        kind: 'leads',
        seller: newRecord.seller,
        customer: newRecord.customer,
        name: newRecord.name,
        staff: newRecord.staff,
        source: newRecord.source,
        phase: newRecord.phase,
        receivedDate: newRecord.receivedDate,
        callDates: '[]',
        show_dashboard: 1,
      });
    } catch (e) {
      console.error('[LeadSell] 新規リードの登録に失敗しました', newRecord, e);
      setLeads(prev => prev.filter(l => l.id !== newRecord.id));
      alert('新規リードの登録に失敗しました。もう一度お試しください。');
    }
  };

  const handleQuickCall = (lead: SellLead) => {
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
  const handleStaffBlur = (lead: SellLead, e: React.FocusEvent<HTMLSelectElement>) => {
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
  const handlePhaseBlur = (lead: SellLead, e: React.FocusEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '追客終了') {
      const reason = window.prompt(`追客終了の理由を入力してください（${LEAD_END_REASONS.join('／')}）`, LEAD_END_REASONS[0]);
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

  const handleNameClick = (lead: SellLead) => {
    setCustomerInfo(lead);
    setIsEditModalOpen(true);
  };

  const handleSaveCustomerInfo = () => {
    if (customerInfo.id) {
      // id / internal_id / created_at / updated_at は DB 側が管理するので送らない。
      // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
      const { id, internal_id, created_at, updated_at, ...fields } = customerInfo as SellLead;
      void handleApiPatch(id, fields);
    }
    setIsEditModalOpen(false);
  };

  const handleOpenDocument = (lead: SellLead) => {
    const bt = lead.baikaiType;
    const validBaikaiTypes = ['専任媒介', '専属専任媒介', '一般媒介'];
    const safeBaikaiType = validBaikaiTypes.includes(bt as string) ? bt : '専任媒介';

    const parsedPrice = lead.price ? Number(String(lead.price).replace(/[^\d.-]/g, '')) : null;
    const actualPrice = parsedPrice ? (parsedPrice < 1000000 ? parsedPrice * 10000 : parsedPrice) : null;
    
    const parsedFee = lead.fee ? Number(String(lead.fee).replace(/[^\d.-]/g, '')) : null;

    const data: initialData = {
        name: lead.seller || lead.name || null,
        baikaiType: safeBaikaiType as '専任媒介' | '専属専任媒介' | '一般媒介',
        category: lead.category || null,
        phone: lead.phone || null,
        mail: lead.mail || null,
        addr: lead.addr1 || lead.addr || null,
        price: actualPrice,
        fee: parsedFee,
        // 下書きの保存先と、保存済みの下書き
        recordId: lead.id,
        docDraft: lead.docDraft ?? null
    };

    setCurrentInitialData(data);
    setDocumentShow(true);
  };

  const headerLabel = {
    title: '売り反響（売却・媒介）管理',
    describe: '一括査定・自社HP等からの売却反響を受信→追客→通電→訪問査定→媒介受託で追跡集計します。'
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
              { label: '訪問査定', value: periodSummary.visit, color: '#9f7aea', sub: `獲得率 ${calcRate(periodSummary.visit, periodSummary.contact)}／査定書提出 ${periodSummary.propose}件` },
              { label: '媒介受託', value: periodSummary.contract, color: '#48bb78', sub: `受託率(リード比) ${calcRate(periodSummary.contract, periodSummary.count)}\n受託率(査定比) ${calcRate(periodSummary.contract, periodSummary.visit)}` },
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
            {/* 💡 反響元（Source）別ファネル */}
            <div style={{ flex: 1, minWidth: '500px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#343a40', marginBottom: '12px' }}>
                反響元別ファネル <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>(対象月受信分・自動集計)</span>
              </h6>
              <Table bordered hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
                <thead className="bg-light">
                  <tr>
                    <th style={compactThStyle} className="text-start ps-2">反響元</th>
                    <th style={compactThStyle} className="text-end">反響</th>
                    <th style={compactThStyle} className="text-end">通電</th>
                    <th style={compactThStyle} className="text-end">通電率</th>
                    <th style={compactThStyle} className="text-end">訪問査定</th>
                    <th style={compactThStyle} className="text-end">獲得率(通電比)</th>
                    <th style={compactThStyle} className="text-end">査定書提出</th>
                    <th style={compactThStyle} className="text-end">媒介受託</th>
                    <th style={compactThStyle} className="text-end">受託率(反響比)</th>
                    <th style={compactThStyle} className="text-end">受託率(査定比)</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceSummary.sorted.map(([source, stats]) => (
                    <tr key={source}>
                      <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{source}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.visit}</td>
                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.visit, stats.contact)}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.propose}</td>
                      <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.contract}</td>
                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.count)}</td>
                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.visit)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">合計</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.count}</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.contact}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(sourceSummary.total.contact, sourceSummary.total.count)}</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.visit}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(sourceSummary.total.visit, sourceSummary.total.contact)}</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{sourceSummary.total.propose}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{sourceSummary.total.contract}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(sourceSummary.total.contract, sourceSummary.total.count)}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(sourceSummary.total.contract, sourceSummary.total.visit)}</td>
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
                    <th style={compactThStyle} className="text-end">訪問査定</th>
                    <th style={compactThStyle} className="text-end">獲得率(通電比)</th>
                    <th style={compactThStyle} className="text-end">査定書提出</th>
                    <th style={compactThStyle} className="text-end">媒介受託</th>
                    <th style={compactThStyle} className="text-end">受託率(反響比)</th>
                    <th style={compactThStyle} className="text-end">受託率(査定比)</th>
                  </tr>
                </thead>
                <tbody>
                  {staffSummary.sorted.map(([staff, stats]) => (
                    <tr key={staff}>
                      <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark">{staff}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.count}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.contact}</td>
                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.contact, stats.count)}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.visit}</td>
                      <td style={compactTdStyle} className="text-end text-primary">{calcRate(stats.visit, stats.contact)}</td>
                      <td style={compactTdStyle} className="text-end fw-bold">{stats.propose}</td>
                      <td style={compactTdStyle} className="text-end fw-bold text-success">{stats.contract}</td>
                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.count)}</td>
                      <td style={compactTdStyle} className="text-end text-success">{calcRate(stats.contract, stats.visit)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <td style={compactTdStyle} className="text-start ps-2 fw-bold text-dark border-top border-2">チーム合計</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.count}</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.contact}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.contact, staffSummary.total.count)}</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.visit}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-primary border-top border-2">{calcRate(staffSummary.total.visit, staffSummary.total.contact)}</td>
                    <td style={compactTdStyle} className="text-end fw-bold border-top border-2">{staffSummary.total.propose}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{staffSummary.total.contract}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(staffSummary.total.contract, staffSummary.total.count)}</td>
                    <td style={compactTdStyle} className="text-end fw-bold text-success border-top border-2">{calcRate(staffSummary.total.contract, staffSummary.total.visit)}</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* ==========================================
                💡 メインリストセクション (売却仕様カラム)
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
                <th style={compactThStyle}>反響元</th>
                <th style={compactThStyle}>売主候補</th>
                <th style={compactThStyle}>担当</th>
                <th style={compactThStyle}>フェーズ</th>
                <th style={compactThStyle}>架電</th>
                <th style={compactThStyle}>架電メモ</th>
                <th style={compactThStyle}>最終アクション</th>
                <th style={compactThStyle}>次回連絡</th>
                <th style={{ ...compactThStyle, minWidth: '120px' }}>連絡先</th>
                <th style={{ ...compactThStyle, minWidth: '180px', textAlign: 'left' }}>物件所在地</th>
                <th style={compactThStyle}>区分</th>
                <th style={compactThStyle}>通電日</th>
                <th style={compactThStyle}>訪問査定日</th>
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
                    <select style={compactInputStyle} defaultValue="" ref={newSourceRef}>
                      <option value="">反響元</option>
                      {SELL_SOURCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={getTdStyle(false)}>
                    <input type="text" style={{ ...compactInputStyle, border: '1px solid #dee2e6' }} placeholder="売主名" defaultValue="" ref={newSellerRef} />
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
                      {['反響受信', '追客中', '通電済み', '机上査定', '訪問査定', '査定書提出', '媒介受託', '売却済', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
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
                          defaultValue={lead.source || lead.portal || ''}
                          onBlur={(e) => handleApiUpdate(lead.id, 'source', e.target.value)}
                        >
                          <option value="">反響元</option>
                          {SELL_SOURCES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td style={getTdStyle(isUnassigned)} className="fw-bold">
                        <span
                          style={{ color: '#3182ce', textDecoration: 'underline dotted', cursor: 'pointer', fontSize: '12px' }}
                          onClick={() => handleNameClick(lead)}
                        >
                          {lead.seller || lead.name}
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
                          <option value="">リード受信</option>
                          {['架電中', '通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託', '追客終了'].map(p => <option key={p} value={p}>{p}</option>)}
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
                      {/* 💡 次回連絡日（期限超過・本日を色分け表示） */}
                      <td style={getTdStyle(isUnassigned)}>{renderNextCell(lead.nextDate)}</td>

                      <td style={{ ...getTdStyle(isUnassigned), whiteSpace: 'normal', lineHeight: '1.4', textAlign: 'left' }}>
                        {lead.phone} <br /> <span style={{ fontSize: '9px', color: '#8898aa' }}>{lead.mail}</span>
                      </td>
                      <td style={{ ...getTdStyle(isUnassigned), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }} title={`${lead.addr1 || ''}${lead.addr2 || ''}`}>
                        {lead.addr1 || lead.addr || lead.addr2}
                      </td>
                      <td style={getTdStyle(isUnassigned)}>
                        <select
                          style={{ ...compactInputStyle, textAlign: 'center' }}
                          defaultValue={lead.category || ''}
                          onBlur={(e) => handleApiUpdate(lead.id, 'category', e.target.value)}
                        >
                          <option value="">区分</option>
                          {['戸建', 'マンション', '土地', 'その他'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      {/* 💡 売り特有の日付 */}
                      <td style={{ ...getTdStyle(isUnassigned), color: '#8898aa' }}>{formatDate(lead.connectDate)}</td>
                      <td style={{ ...getTdStyle(isUnassigned), color: '#8898aa' }}>{formatDate(lead.visitDate)}</td>
                      <td style={getTdStyle(isUnassigned)}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', color: '#6c757d' }}>
                            🔗 媒介紐付
                          </button>
                          <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px', backgroundColor: '#fff', color: '#6c757d' }}
                              onClick={() => handleOpenDocument(lead)}>
                              <i className="fa-solid fa-file-contract me-1 text-secondary"></i>契約書
                          </button>
                        </div>
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

      {/* ==========================================
                💡 顧客情報編集モーダル (売却仕様)
            ========================================== */}
      <LeadEdit
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveCustomerInfo}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        leadCategory="sell"
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

export default LeadSell;