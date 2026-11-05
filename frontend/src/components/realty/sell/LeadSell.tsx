import React, { useCallback, useEffect, useState, useMemo, useContext } from 'react';
import apiClient from '../../../utils/apiClient';
import { thisYear } from '../../../utils/thisYear';
import LeadFunnelPanel from '../common/LeadFunnelPanel';
import { callCountOf, defaultPeriod, periodGroups, periodHas, recvMonthKey } from '../common/leadFunnel';
import type { Period } from '../common/leadFunnel';
import type { Row, Settings } from '../summary/kpi';
import LeadHeader from '../common/LeadHeader';
import AuthContext from '../../../context/AuthContext';
import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted, findDuplicateLead } from '../common/leadUtiles';
import { leadToResale, linkLedger } from '../common/leadLinks';
import type { LedgerForm, LedgerLinkResult } from '../common/leadLinks';
import LedgerLinkModal from '../common/LedgerLinkModal';
import LeadEdit from '../common/LeadEdit';
import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
import type { LeadFilter } from '../common/LeadFilterBar';
import LeadCall, { CallLog } from '../common/LeadCall';
import DocumentViewer from '../documents/DocumentViewer';
import { openNavi } from '../navi/naviHost';
import { sameName } from '../callq/callqLogic';

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
  /** 媒介契約日（媒介受託にしたとき。v2.2.244 から一覧でも入れる） */
  baikaiDate?: string | null;
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

/** 一覧の「架電」の数。⚠️ v2.2.225: 以前のアプリと同じく type の無い記録も架電に数える（leadFunnel.ts の callCountOf） */
const parseCallCounts = (callDatesJson: string | null) => ({ call: callCountOf({ callDates: callDatesJson }), sms: 0, mail: 0 });

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

/** 今日（'YYYY-MM-DD'）。登録のモーダルの受信日の初期値 */
const todayIso = () => formatDate(new Date()).replace(/\//g, '-');

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

/**
 * 架電の記録の日時（'YYYY-MM-DDTHH:mm'。端末の時刻）。LeadBuy.tsx と同じ。
 * ⚠️ v2.2.244: 定義が無く、一覧の「📞 架電」を押すとエラーで止まっていた
 */
const getCurrentDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
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

  const [displayLimit, setDisplayLimit] = useState<number>(15);
  // ⚠️ v2.2.225: 期間（'m:YYYY-MM'・'fy:YYYY-MM'・'all'）と設定。歩留まりは以前のアプリと同じ計算（common/leadFunnel.ts）
  const [period, setPeriod] = useState<Period>('');
  const [settings, setSettings] = useState<LeadSettings>({});

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callTargetLead, setCallTargetLead] = useState<SellLead | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<Partial<SellLead>>({});
  /** ⚠️ v2.2.247: 媒介紐付の画面で開いている売り反響（null は閉じている） */
  const [ledgerTarget, setLedgerTarget] = useState<SellLead | null>(null);
  const ledgerStaffNames = useMemo(() => (settings.staff ?? []).map(s => s.name ?? '').filter(Boolean), [settings.staff]);
  const closeLedgerModal = useCallback(() => setLedgerTarget(null), []);

  const [documentShow, setDocumentShow] = useState(false);
  const [currentInitialData, setCurrentInitialData] = useState<initialData | undefined>(undefined);


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

  /** 選んだ期間に受信した反響（受信日の新しい順） */
  const periodLeads = useMemo(() => {
    const result = period ? leads.filter(l => periodHas(period, recvMonthKey(l as unknown as Row), settings.fiscalStart)) : leads;
    return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
  }, [leads, period, settings.fiscalStart]);

  /** ⚠️ v2.2.245: 一覧の絞り込み（担当者・反響元・フェーズ・売主名か所在地）。common/LeadFilterBar.tsx */
  const [filter, setFilter] = useState<LeadFilter>(EMPTY_FILTER);
  const filteredLeads = useMemo(() => periodLeads.filter(l => matchesFilter(filter, {
    staff: l.staff, source: l.source || l.portal || '', phase: l.phase,
    text: [l.seller, l.name, l.addr, l.addr1, l.addr2],
  }, 'リード受信')), [periodLeads, filter]);

  /** 反響元の選択肢（決まった5つ＋実データにある値） */
  const sourceOptions = useMemo(() => {
    const extra = Array.from(new Set(leads.map(l => l.source || l.portal || '').filter(s => s !== '' && !SELL_SOURCES.includes(s)))).sort();
    return [...SELL_SOURCES, ...extra];
  }, [leads]);

  useEffect(() => {
    setDisplayLimit(15);
  }, [period, filter]);

  // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）
  const nextActionAlert = useMemo(() => {
    let overdue = 0, missing = 0;
    for (const l of periodLeads) {
      if (l.phase === '追客終了') continue;
      if (!l.nextDate) { missing++; continue; }
      if (l.nextDate.replace(/\//g, '-') < today) overdue++;
    }
    return { overdue, missing };
  }, [periodLeads, today]);


  /**
   * brokerage_listings の1行を部分更新する。
   * 画面を先に更新し（楽観的更新）、保存に失敗したら元の値へ戻す。
   * 戻さないと「画面には反映されたのに DB には入っていない」状態になり、
   * 次のリロードで消えた理由が分からなくなるため。
   */
  const handleApiPatch = async (id: string, fields: Record<string, unknown>): Promise<boolean> => {
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
      return true;
    } catch (e) {
      console.error('[LeadSell] 保存に失敗しました', { id, fields }, e);
      setLeads(snapshot);
      alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
      return false;
    }
  };

  /**
   * 媒介紐付の画面（common/LedgerLinkModal.tsx）の「登録」。売り反響 → 媒介獲得台帳。
   * ⚠️ v2.2.248: 連動トリガー仕様書の ①。台帳の作成・反響の媒介受託・変更履歴は、② の planner:ledger_link が
   *   1つのトランザクションで行う（common/leadLinks.ts の linkLedger）。v2.2.247 は画面から段階 → 台帳 → 台帳 No. と別々に保存していた。
   * ⚠️ 台帳に紐づいている反響では、② が作らずに既存の台帳 No. を返す（二重作成の防止）。
   * @returns 作れた（すでにあった）ら結果。作れなければ null（画面は開いたまま）
   */
  const submitLedger = async (row: Row, form: LedgerForm): Promise<LedgerLinkResult | null> => {
    const id = String(row.id);
    try {
      const r = await linkLedger(id, form);
      const no = String(r.no);
      const fields = { phase: '媒介受託', baikaiDate: form.baikaiDate, ledgerNo: no, ledgerId: r.ledgerId, endReason: null };
      setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...(r.status === 'exists' ? { ledgerNo: no } : fields) } as SellLead : l)));
      return r;
    } catch (e) {
      console.error('[LeadSell] 媒介紐付に失敗しました', id, e);
      alert(`媒介獲得台帳を作れませんでした。\n${e instanceof Error ? e.message : ''}`);
      return null;
    }
  };

  /**
   * ⚠️ v2.2.246: 自社買取 → 買取案件へ（制作者の流れ「①売り反響と物件が紐づく ②自社買取の場合に買取案件へ移行」）。
   *   台帳（媒介受託で作ったもの）の媒介種別を「買取」にし、買取再販案件を1件作って台帳 No. でつなぐ（common/leadLinks.ts の leadToResale）。
   */
  const moveToResale = async (lead: SellLead) => {
    if (!window.confirm(`「${lead.seller || lead.name || ''}」を自社で買い取る案件として、買取再販案件を作ります。\n台帳 No.${lead.ledgerNo} の媒介種別は「買取」になります。よろしいですか？`)) return;
    try {
      const r = await leadToResale(lead as unknown as Record<string, unknown>, userName || '不明');
      if (r === null) alert(`台帳 No.${lead.ledgerNo} が見つかりません。媒介獲得台帳を確かめてください。`);
      else if ('exists' in r) alert(`台帳 No.${lead.ledgerNo} には、既に買取再販案件 No.${r.exists} がつながっています。`);
      else alert(`買取再販案件 No.${r.no} を作りました（台帳 No.${r.ledgerNo}）。\n買取再販案件の画面で、買取価格・建物価格・費目を入れてください。`);
    } catch (e) {
      console.error('[LeadSell] 買取案件の作成に失敗しました', lead.id, e);
      alert('買取案件を作れませんでした。時間をおいて、もう一度お試しください。');
    }
  };

  const handleApiUpdate = (id: string, field: string, value: string | number) => {
    void handleApiPatch(id, { [field]: value });
  };

  /**
   * ⚠️ v2.2.247: 「反響を追加」は登録のモーダル（LeadEdit。id が空なら登録）で入れる（以前のアプリの editLead()）。
   *   v2.2.246 までは一覧に入力の行を足し、受信日・反響元・売主名・担当・段階だけを入れていた
   */
  const handleAddClick = () => {
    setCustomerInfo({ kind: 'leads', id: '', receivedDate: todayIso(), phase: 'リード受信', callDates: '[]' });
    setIsEditModalOpen(true);
  };

  /** 登録のモーダルの「登録する」。必須は LeadEdit が確かめる。⚠️ 同じ人の反響が既にあれば、確かめてから登録する */
  const createLead = async (info: Partial<SellLead>) => {
    const dup = findDuplicateLead(leads, info);
    if (dup && !window.confirm(`同じ連絡先、または同名・同日の反響が既に登録されています（${dup.seller || dup.name || '名称なし'}／${formatDate(dup.receivedDate)}）。\nそれでも登録しますか？`)) return;
    const { id: _id, internal_id: _i, created_at: _c, updated_at: _u, ...rest } = info;
    const seller = String(info.seller || info.name || '').trim();
    const id = newRecordId();
    // 'sellLeads' ではなく 'leads'。brokerage_listings.kind と一覧の絞り込み条件（kind === 'leads'）に合わせる
    const fields: Record<string, unknown> = {
      ...rest, kind: 'leads', seller, customer: seller, name: seller,
      receivedDate: String(info.receivedDate || '').replace(/\//g, '-'), callDates: info.callDates || '[]', show_dashboard: 1,
    };
    setIsEditModalOpen(false);
    try {
      const row = await saveBrokerageRecord(id, fields);
      setLeads(prev => [{ ...fields, ...(row ?? {}), id } as SellLead, ...prev]);
    } catch (e) {
      console.error('[LeadSell] 反響の登録に失敗しました', id, e);
      alert('反響を登録できませんでした。通信状況を確認して、もう一度お試しください。');
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

  /**
   * ⚠️ v2.2.226: 架電ナビ（以前のアプリの「🧭」）。記録は ② が反響を書き換えるので、返ってきた行で置き換える。
   * 「自分」は設定の担当者名（ログイン名と空白の入り方が違うことがある）
   */
  const openNaviFor = (lead: SellLead) => {
    const me = (settings.staff ?? []).find(s => s.name && sameName(s.name, userName || ''))?.name ?? (userName || '');
    openNavi({
      lead: lead as unknown as Row, settings: settings as Record<string, unknown>, me,
      onSaved: row => {
        if (!row) return;
        setLeads(prev => prev.map(l => (l.id === row.id ? {
          ...l,
          callDates: row.callDates as string | null,
          phase: row.phase as string,
          nextDate: dateFormate(row.nextDate as string | null),
          nextNote: (row.nextNote as string) || null,
          connectDate: dateFormate(row.connectDate as string | null),
          endReason: row.endReason as string,
          reason: row.reason as string,
          timing: row.timing as string,
        } : l)));
      },
    });
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

  /**
   * フェーズの変更（以前のアプリの ieGuard と同じ）。
   * ⚠️ v2.2.244: 値が変わったときだけ動く（以前は onBlur で、触れるたびに保存し・追客終了の理由を聞き直していた）。
   *   追客終了 … 理由を聞いて endReason も保存する（⚠️ 以前は聞いた理由を捨てていた）。追客終了から戻すと理由を消す
   *   媒介受託 … ⚠️ v2.2.247: 台帳が無ければ、ここでは保存せずに媒介紐付の画面を開く（登録したときに段階も媒介受託になる）
   */
  const handlePhaseChange = async (lead: SellLead, e: React.ChangeEvent<HTMLSelectElement>) => {
    const select = e.target;
    const prev = lead.phase || 'リード受信';
    const next = select.value;
    if (next === prev) return;
    if (next === '媒介受託' && !lead.ledgerNo) {
      select.value = prev;
      setLedgerTarget(lead);
      return;
    }
    const fields: Record<string, unknown> = { phase: next };
    if (next === '追客終了') {
      const reason = askEndReason(LEAD_END_REASONS, lead.endReason);
      if (reason == null) { select.value = prev; return; }
      fields.endReason = reason;
    } else if (lead.endReason) {
      fields.endReason = '';
    }
    if (!(await handleApiPatch(lead.id, fields))) select.value = prev;
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
    // ⚠️ v2.2.247: id が無ければ登録（「反響を追加」）
    if (!customerInfo.id) { void createLead(customerInfo); return; }
    // id / internal_id / created_at / updated_at は DB 側が管理するので送らない。
    // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
    const { id, internal_id, created_at, updated_at, ...fields } = customerInfo as SellLead;
    const saved = customerInfo as SellLead;
    // ⚠️ v2.2.248: 媒介受託にして保存したとき、台帳がまだ無ければ、段階は変えずに（ほかの項目だけ保存して）媒介紐付の画面を開く。
    //   段階は「登録」で台帳と一緒に媒介受託になる（仕様書 共通ルール 2: 段階だけが先に変わって台帳が無い状態を作らない）
    const before = leads.find(l => l.id === id);
    const toLedger = saved.phase === '媒介受託' && !saved.ledgerNo;
    if (toLedger && before && before.phase !== '媒介受託') fields.phase = before.phase;
    void handleApiPatch(id, fields).then(ok => {
      if (ok && toLedger) setLedgerTarget(saved);
    });
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
        selectedMonth={period}
        setSelectedMonth={setPeriod}
        availableMonths={[]}
        periodGroups={periodOptions}
        handleAddClick={handleAddClick}
        isAdding={isEditModalOpen && !customerInfo.id}
        headerLabel={headerLabel}
        nextActionAlert={nextActionAlert}
      />

      {!isLoading && (
        <>
          {/* ⚠️ v2.2.225: タイル・反響元別・担当者別ファネルは以前のアプリ（renderLeads）と同じ計算（common/LeadFunnelPanel.tsx） */}
          <LeadFunnelPanel kind="sell" rows={leads as unknown as Row[]} period={period} settings={settings} />
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

        <LeadFilterBar
          value={filter}
          onChange={setFilter}
          staffOptions={staffList}
          sourceOptions={sourceOptions}
          phaseOptions={LEAD_PHASES}
          sourceLabel="反響元"
          searchPlaceholder="売主名・物件所在地"
          shown={filteredLeads.length}
          total={periodLeads.length}
        />

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
                <th style={compactThStyle}>媒介紐付</th>
                <th style={compactThStyle}>書類</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={16} style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : filteredLeads.length > 0 ? (
                filteredLeads.slice(0, displayLimit).map((lead) => {
                  const counts = parseCallCounts(lead.callDates);
                  // 💡 ハイライト判定: 担当者が未設定の場合
                  const isUnassigned = !lead.staff || lead.staff.trim() === '';
                  const currentSource = lead.source || lead.portal || '';

                  return (
                    <tr key={lead.id}>
                      <td style={getTdStyle(isUnassigned)}>{formatDate(lead.receivedDate)}</td>
                      <td style={getTdStyle(isUnassigned)}>
                        {/*
                          ⚠️ v2.2.237: 値が変わったときだけ保存する。選択肢に無い反響元（営業案件・問合せなど）もその値を選択肢に出す。
                            以前は選択肢に無い値だと「反響元」（空）と表示され、触っただけで source が NULL で上書きされていた
                        */}
                        <select
                          style={{ ...compactInputStyle, fontWeight: 'bold' }}
                          defaultValue={currentSource}
                          onBlur={(e) => {
                            if (e.target.value !== currentSource) handleApiUpdate(lead.id, 'source', e.target.value);
                          }}
                        >
                          <option value="">反響元</option>
                          {[...SELL_SOURCES, ...(currentSource && !SELL_SOURCES.includes(currentSource) ? [currentSource] : [])].map(p => <option key={p} value={p}>{p}</option>)}
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
                        {/* ⚠️ v2.2.247: key に段階を入れる（「媒介紐付」のボタンで段階が変わったときに、表示を描き直す） */}
                        <select
                          key={`${lead.id}:${lead.phase || ''}`}
                          style={{ ...compactInputStyle, backgroundColor: isUnassigned ? '#fff' : '#f8f9fa', borderRadius: '4px', fontWeight: 'bold' }}
                          defaultValue={lead.phase || 'リード受信'}
                          onChange={(e) => void handlePhaseChange(lead, e)}
                        >
                          {LEAD_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                          {/* ⚠️ 選択肢に無い値（以前のアプリで手入力されたもの）も消さずに出す */}
                          {lead.phase && !LEAD_PHASES.includes(lead.phase) && <option value={lead.phase}>{lead.phase}</option>}
                        </select>
                        {/* ⚠️ v2.2.246: 台帳ができた反響（媒介受託）だけ。自社買取なら買取再販案件へ */}
                        {lead.ledgerNo && (
                          <button
                            type="button"
                            style={{ fontSize: '9px', padding: '0 6px', height: '18px', marginTop: '2px', backgroundColor: '#fff', border: '1px solid #fd7e14', color: '#fd7e14', borderRadius: '10px', cursor: 'pointer' }}
                            onClick={() => void moveToResale(lead)}
                            title="自社で買い取るときに、買取再販案件を作る"
                          >
                            買取案件へ
                          </button>
                        )}
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
                          <button
                            style={{ fontSize: '9px', padding: '0 6px', height: '20px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '10px', cursor: 'pointer' }}
                            onClick={() => openNaviFor(lead)}
                            title="架電ナビ（トーク伴走・自動聞き取り）で架電"
                          >
                            🧭
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
                      {/*
                        ⚠️ v2.2.247: 媒介紐付（以前のアプリの一覧と同じ）。台帳へつなぐのは、この画面だけ（架電キュー・チームサマリーでは作らない）
                          台帳あり → 台帳No. ／ 追客終了 → ― ／ 媒介受託で台帳なし → 未転記→台帳へ ／ それ以外 → 媒介紐付。押すと LedgerLinkModal
                      */}
                      <td style={getTdStyle(isUnassigned)}>
                        {lead.ledgerNo ? (
                          <span className="badge bg-success bg-opacity-10 text-success border border-success" style={{ fontSize: '10px' }}>台帳No.{lead.ledgerNo}</span>
                        ) : lead.phase === '追客終了' ? (
                          <span style={{ color: '#adb5bd' }}>―</span>
                        ) : (
                          <button
                            type="button"
                            style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', ...(lead.phase === '媒介受託' ? { border: '1px solid #fd7e14', color: '#fd7e14', fontWeight: 'bold' } : { border: '1px solid #ced4da', color: '#6c757d' }) }}
                            onClick={() => setLedgerTarget(lead)}
                            title="媒介獲得台帳へ登録する画面を開く（登録すると段階は媒介受託になる）"
                          >
                            {lead.phase === '媒介受託' ? '未転記→台帳へ' : '🔗 媒介紐付'}
                          </button>
                        )}
                      </td>
                      <td style={getTdStyle(isUnassigned)}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
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
                  <td colSpan={16} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
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
      {/* ⚠️ v2.2.247: 媒介紐付（売り反響 → 媒介獲得台帳。台帳へつなぐのは、この画面だけ） */}
      <LedgerLinkModal
        lead={ledgerTarget as unknown as Row | null}
        staffNames={ledgerStaffNames}
        onClose={closeLedgerModal}
        onSubmit={submitLedger}
      />

      <LeadEdit
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveCustomerInfo}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        leadCategory="sell"
        sourceOptions={SELL_SOURCES}
        staffList={staffList}
        onNavi={() => {
          const lead = leads.find(l => l.id === customerInfo.id);
          setIsEditModalOpen(false);
          if (lead) openNaviFor(lead);
        }}
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