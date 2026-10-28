import React, { useState, useEffect, useMemo, useContext } from 'react';
import apiClient from '../../../utils/apiClient';
import LeadHeader from '../common/LeadHeader'; // パスは環境に合わせて調整してください
import { thisYear } from '../../../utils/thisYear';
import { removeSpaces, formatDate } from './summaryUtiles'; // パスは環境に合わせて調整してください
import AuthContext from '../../../context/AuthContext';
// 💡 追加: タスク一覧の「開く」から顧客情報を編集する
import LeadEdit, { LeadCategory } from '../common/LeadEdit';
import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
// ⚠️ v2.2.222: 年間予算進捗・月次KPI・架電実績・朝礼用アラートは本番アプリの集計をそのまま写した kpi.ts で出す
import {
    ALERT_DAYS, CONFIRMED, alertWindow, callStats, daysAgoLabel, dealCountByStaffMonth, dealRegDate,
    emptyCallCell, feeByStaffMonth, fiscalMonths, fmtCnt, fmtYen, fmtYen0, inWindow, ledgerCountByStaffMonth,
    monthLabel, pct, reformByStaffMonth, reformGpByStaffMonth, salesByStaffMonth, sumRow, todayStr,
} from './kpi';
import type { Row, Settings } from './kpi';

// ==========================================
// 💡 型定義 (推論ベース)
// ==========================================
type SummaryLead = {
    id: string;
    kind: string;
    receivedDate: string | null;
    // 反響元。売りリードは source、買いリードは portal に入る（DB上の規約）
    portal: string;
    source: string | null;
    name: string;
    seller: string | null;
    staff: string | null;
    phase: string | null;
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
    visitDate: string | null;
    addr: string | null;
    addr1: string | null;
    note: string | null;
    nextNote: string | null;
    // ... その他必要なプロパティ
};

// ==========================================
// 💡 ヘルパー関数・定数
// ==========================================
const formatYen = (num: number | string | null | undefined) => {
    if (num == null || isNaN(Number(num))) return '―';
    return `¥${Number(num).toLocaleString()}`;
};

const formatMan = (num: number | string | null | undefined) => {
    if (num == null || isNaN(Number(num))) return '―';
    return `${Math.round(Number(num) / 10000).toLocaleString()}万`;
};

const calcRate = (part: number, total: number) => {
    if (!total || total === 0) return '―';
    return ((part / total) * 100).toFixed(1) + '%';
};

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

const isOver = (nextDate: string | null) => {
    if (!nextDate) return false;
    return new Date(nextDate).getTime() < today;
};
const isToday = (nextDate: string | null) => {
    if (!nextDate) return false;
    const t = new Date(nextDate).getTime();
    return t >= today && t < today + 86400000;
};
const isNotNext = (nextDate: string | null) => !nextDate || nextDate.startsWith('0000');

// 💡 アプリ全体設定（planner_summary が app_state.settings をそのまま返す）。⚠️ v2.2.222 から kpi.ts の Settings
type AppSettings = Settings;

// 架電履歴。DBには JSON 文字列で入っているので配列に戻してから数える
type CallEntry = { date?: string | null; type?: string | null; staff?: string | null };

const parseCallDates = (raw: string | null | undefined): CallEntry[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as CallEntry[];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * 対象月の架電数（延べ）。
 * 元HTML版(V12)と同じく **📞架電のみ** を数える（LINE・メールは含めない）。
 * また「対象月に受信したリード」ではなく「対象月に行われた架電」を数えるため、
 * 全リードを走査して架電日の年月で絞り込む。
 */
const countCalls = (leads: { callDates: string | null }[], month: string) =>
    leads.reduce((total, lead) => total + parseCallDates(lead.callDates).filter(c => {
        const type = c?.type ? String(c.type) : 'call';
        return type === 'call' && String(c?.date ?? '').slice(0, 7) === month;
    }).length, 0);

/** '2026-08' → '2026-07' */
const prevMonth = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const isFollow = (phase: string | null) => ['追客中', '通電済み', '内見予約', '内見済み'].includes(phase || '');
const diffDays = (base: string | null) => {
    if (!base || base.startsWith('0000')) return null;
    return Math.floor((today - new Date(base).getTime()) / (1000 * 60 * 60 * 24));
};

// ==========================================
// 💡 コンパクトな共通スタイル
// ==========================================
const s = {
    card: {
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        border: '1px solid #e9ecef',
        marginBottom: '16px',
        minWidth: '1200px'
    } as React.CSSProperties,
    cardTitle: {
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    } as React.CSSProperties,
    th: {
        padding: '6px 8px',
        fontSize: '11px',
        backgroundColor: '#f8f9fa',
        color: '#495057',
        borderBottom: '1px solid #dee2e6',
        whiteSpace: 'nowrap' as const,
        verticalAlign: 'middle',
        fontWeight: 'bold'
    } as React.CSSProperties,
    td: {
        padding: '6px 8px',
        fontSize: '11px',
        borderBottom: '1px solid #dee2e6',
        verticalAlign: 'middle',
    } as React.CSSProperties,
    badge: (bgColor: string, color: string = '#fff') => ({
        backgroundColor: bgColor,
        color: color,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
        display: 'inline-block'
    } as React.CSSProperties)
};


const Summary = () => {
    const { userName } = useContext(AuthContext);

    // State
    const [myself, setMyself] = useState(false);
    const [activeTab, setActiveTab] = useState('today');
    const [isLoading, setIsLoading] = useState(false);

    const [leads, setLeads] = useState<SummaryLead[]>([]); // 売り反響
    const [buyLeads, setBuyLeads] = useState<SummaryLead[]>([]); // 買い反響
    // ⚠️ v2.2.222: 商談案件と媒介台帳（planner:summary が返すようにした）。⚠️ 削除済み（show_dashboard=0）は除いて持つ
    const [deals, setDeals] = useState<Row[]>([]);
    const [ledger, setLedger] = useState<Row[]>([]);

    const [staffList, setStaffList] = useState<string[]>([]);
    const [settings, setSettings] = useState<AppSettings>({});
    // ⚠️ v2.2.222: 既定は今月（以前は 2026-07 で固定だった）
    const [selectedMonth, setSelectedMonth] = useState<string>(() => todayStr().slice(0, 7));

    // 💡 顧客情報編集モーダル（LeadSell / LeadBuy と同じ LeadEdit を共用する）
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [customerInfo, setCustomerInfo] = useState<Partial<SummaryLead>>({});
    const [editCategory, setEditCategory] = useState<LeadCategory>('sell');

    const realTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    // 💡 データの取得 (モックの代わりにAPI呼び出しを想定)
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // ※ ここは現状のPHPバックエンドのレスポンス構造に合わせて調整が必要です
                const response = await apiClient.post('', { request: 'planner', roll: 'summary' });
                if (response.data) {
                    // planner_summary.php が返すのは lead / staff の2キーだけで、
                    // lead には売り(leads)と買い(buyLeads)が kind 混在で入っている。
                    // 以前はこれをそのまま setLeads していたため buyLeads が常に空になり、
                    // 歩留まりファネルの「買い」が全て0・「売り」が買いを混ぜて数えていた。
                    // ここで kind で振り分ける。
                    if (response.data.lead) {
                        // ⚠️ v2.2.222: 削除済み（show_dashboard=0）は数えない（売り反響・買い反響の画面と同じ）
                        const allLeads: SummaryLead[] = (response.data.lead as SummaryLead[]).filter(l => !isSoftDeleted(l as unknown as Row));
                        setLeads(allLeads.filter(l => l.kind !== 'buyLeads'));
                        setBuyLeads(allLeads.filter(l => l.kind === 'buyLeads'));
                    }
                    setDeals(((response.data.deals ?? []) as Row[]).filter(d => !isSoftDeleted(d)));
                    setLedger(((response.data.ledger ?? []) as Row[]).filter(l => !isSoftDeleted(l)));
                    if (response.data.staff) {
                        setStaffList(response.data.staff.filter((st: any) => st.period === String(thisYear)).map((st: any) => st.name));
                    }
                    // 反響単価・媒介受託目標。KPIサマリーの分母になる
                    if (response.data.settings) setSettings(response.data.settings);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // ==========================================
    // 💡 1. 営業司令塔 KPIサマリー (売・買リードを合算)
    // ==========================================
    const dashboardSummary = useMemo(() => {
        const summary = { over: 0, today: 0, next: 0, slowdown: 0, hot: 0, follow: 0 };

        // 売りと買いのリードを統合して処理
        const allLeads = [...leads, ...buyLeads];
        const staffLeads = allLeads.filter(l => myself ? removeSpaces(l.staff) === removeSpaces(userName) : true);

        staffLeads.forEach(lead => {
            if (isOver(lead.nextDate)) summary.over++;
            if (isToday(lead.nextDate)) summary.today++;
            if (isNotNext(lead.nextDate) && isFollow(lead.phase)) summary.next++;
            if (isFollow(lead.phase)) summary.follow++;

            const elapsed = diffDays(lead.contactDate || lead.receivedDate);
            if (elapsed && elapsed >= 14 && isFollow(lead.phase)) summary.slowdown++;

            if (['内見済み', '訪問査定', '査定書提出', '購入申込'].includes(lead.phase || '')) {
                summary.hot++;
            }
        });
        return summary;
    }, [leads, buyLeads, myself, userName]);

    // ==========================================
    // 💡 2. タスク・アラート抽出（司令塔下部のテーブル用）
    // ==========================================
    const toDoSummary = useMemo(() => {
        // 売りと買いのリードを統合
        const allLeads = [...leads, ...buyLeads];
        let targetLeads = allLeads.filter(l => myself ? removeSpaces(l.staff) === removeSpaces(userName) : true);

        if (activeTab === 'today') {
            targetLeads = targetLeads.filter(l => isOver(l.nextDate) || isToday(l.nextDate));
        } else if (activeTab === 'hot') {
            targetLeads = targetLeads.filter(l => ['内見済み', '訪問査定', '査定書提出', '購入申込'].includes(l.phase || ''));
        } else if (activeTab === 'stale') {
            targetLeads = targetLeads.filter(l => {
                const elapsed = diffDays(l.contactDate || l.receivedDate);
                return isFollow(l.phase) && ((elapsed && elapsed >= 14) || isNotNext(l.nextDate));
            });
        }

        return targetLeads.map(t => {
            // kindプロパティがない場合などのフォールバック
            const isBuy = t.kind === 'buyLeads' || t.targetProperty != null;
            return {
                id: t.id,
                kindLabel: isBuy ? '買' : '売',
                kindColor: isBuy ? '#0d6efd' : '#dc3545',
                name: t.name || t.seller || '不明',
                staff: t.staff || '未割当',
                next: t.nextDate ? t.nextDate.split(' ')[0] : '未設定',
                note: t.nextNote || t.note || '-',
                diff: diffDays(t.nextDate) || 0,
                addr: t.addr1 || t.addr || t.targetProperty || '住所不明',
                contact: `${t.phone || ''} ${t.mail || ''}`.trim(),
                phase: t.phase || '不明'
            }
        }).sort((a, b) => b.diff - a.diff);
    }, [leads, buyLeads, myself, userName, activeTab]);

    // ==========================================
    // 💡 タスク一覧「開く」→ 顧客情報編集
    // ==========================================

    /** 一覧の行から元レコードを引き当ててモーダルを開く */
    const handleOpenLead = (id: string) => {
        const lead = [...leads, ...buyLeads].find(l => l.id === id);
        if (!lead) return;

        setCustomerInfo(lead);
        setEditCategory(lead.kind === 'buyLeads' ? 'buy' : 'sell');
        setIsEditModalOpen(true);
    };

    /**
     * 保存。LeadSell / LeadBuy と同じく楽観的更新にする。
     * 画面を先に書き換え、保存に失敗したら元に戻して知らせる。
     */
    const handleSaveCustomerInfo = async () => {
        setIsEditModalOpen(false);

        const id = customerInfo.id;
        if (!id) return;

        // id / internal_id / created_at / updated_at は DB 側が管理するので送らない。
        // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
        const {
            id: _id, internal_id: _internalId, created_at: _createdAt, updated_at: _updatedAt,
            ...fields
        } = customerInfo as Record<string, unknown>;

        const isBuy = customerInfo.kind === 'buyLeads';
        const setTarget = isBuy ? setBuyLeads : setLeads;

        // 失敗時に戻すための退避と、履歴の差分を取るための変更前の値。
        // setState の更新関数の中で拾うと React 18 では次のレンダリングまで
        // 実行されず、この直後の行では空のままになるためクロージャから取る。
        const snapshot = isBuy ? buyLeads : leads;
        const before = snapshot.find(l => l.id === id);

        setTarget(prev => prev.map(l => (l.id === id ? { ...l, ...fields } as SummaryLead : l)));

        try {
            await saveBrokerageRecord(id, fields);
            // 保存が成功してから履歴を残す（失敗した変更を履歴に残さないため）
            if (before) {
                await recordFieldChanges({
                    entity: isBuy ? 'buy' : 'lead',
                    entityId: id,
                    label: before.seller || before.name || before.addr || id,
                    before,
                    after: fields,
                    by: userName || '不明',
                });
            }
        } catch (e) {
            console.error('[Summary] 保存に失敗しました', { id, fields }, e);
            setTarget(snapshot);
            alert('保存に失敗しました。通信状況を確認して、もう一度お試しください。');
        }
    };

    // ==========================================
    // 💡 3. 歩留まりファネル集計
    // ==========================================
    const funnelData = useMemo(() => {
        const result = {
            sell: { leads: 0, connects: 0, visits: 0, proposes: 0, wins: 0 },
            buy: { leads: 0, connects: 0, views: 0, offers: 0, wins: 0 }
        };

        // 売りファネル
        const targetSell = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
        result.sell.leads = targetSell.length;
        targetSell.forEach(l => {
            if (l.connectDate || ['通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'].includes(l.phase || '')) result.sell.connects++;
            if (l.visitDate || ['訪問査定済', '査定書提出', '媒介受託'].includes(l.phase || '')) result.sell.visits++;
            if (['査定書提出', '媒介受託'].includes(l.phase || '')) result.sell.proposes++;
            if (l.phase === '媒介受託') result.sell.wins++;
        });

        // 買いファネル
        const targetBuy = buyLeads.filter(l => l.receivedDate?.startsWith(selectedMonth));
        result.buy.leads = targetBuy.length;
        targetBuy.forEach(l => {
            if (l.connectDate || ['通電済', '内見予約', '内見済', '購入申込', '成約'].includes(l.phase || '')) result.buy.connects++;
            if (l.viewDate || ['内見済', '購入申込', '成約'].includes(l.phase || '')) result.buy.views++;
            if (['購入申込', '成約'].includes(l.phase || '')) result.buy.offers++;
            if (l.phase === '成約') result.buy.wins++;
        });

        return result;
    }, [leads, buyLeads, selectedMonth]);


    // ==========================================
    // 💡 4. ヘッダー用データ
    // ==========================================
    /**
     * 対象月の選択肢。⚠️ v2.2.222: 本番アプリと同じく「今期の12か月」（設定の期首月から）。
     *   年間予算の進捗は期首から対象月までの累計なので、期をまたぐ月は選ばせない。
     */
    const fyMonths = useMemo(() => fiscalMonths(settings.fiscalStart), [settings.fiscalStart]);
    const availableMonths = useMemo(() => [...fyMonths].reverse(), [fyMonths]);
    // 期首月が届いたら、今期に無い月（初期値の今月が期外のときなど）を期首月へ寄せる
    useEffect(() => {
        if (settings.fiscalStart && !fyMonths.includes(selectedMonth)) setSelectedMonth(fyMonths[0]);
    }, [fyMonths, settings.fiscalStart, selectedMonth]);

    const headerLabel = { title: 'チームサマリー', describe: '本日のタスク、追客予定、月次KPI、架電実績' };

    /**
     * 📊 年間予算進捗・月次KPIサマリー（v2.2.222。本番アプリの renderDash と同じ集計）。
     *   売上計上額＝仲介手数料＋リフォーム粗利。商談案件の契約日ベース・共同担当は按分。
     *   担当者と目標・予算は設定（app_state.settings.staff）。
     */
    const kpi = useMemo(() => {
        const tm = selectedMonth;
        const staffSettings = (settings.staff ?? []).filter(st => st.name);
        const names = staffSettings.map(st => String(st.name));
        const cumMks = fyMonths.includes(tm) ? fyMonths.slice(0, fyMonths.indexOf(tm) + 1) : [tm];

        const salesAll = salesByStaffMonth(deals);
        const feeAll = feeByStaffMonth(deals);
        const rfAll = reformByStaffMonth(deals);
        const rgAll = reformGpByStaffMonth(deals);
        const cntAll = dealCountByStaffMonth(deals);
        // ⚠️ 媒介台帳の担当は略称で入っている
        const abbrToName = (ab: string) => staffSettings.find(st => st.abbr === ab)?.name ?? ab;
        const bCnt = ledgerCountByStaffMonth(ledger, abbrToName);

        const totalBudget = staffSettings.reduce((a, st) => a + (Number(st.budget) || 0), 0);
        const sumCum = (all: Record<string, Record<string, number>>) => names.reduce((a, n) => a + sumRow(all[n], cumMks), 0);
        const cum = sumCum(salesAll);
        const prog = totalBudget ? cum / totalBudget : 0;
        const elapsed = cumMks.length;

        const rows = staffSettings.map(st => {
            const n = String(st.name);
            const dAll = deals.filter(d => (d.staff === n || d.subStaff === n) && d.phase !== '失注');
            const dCon = dAll.filter(d => CONFIRMED.includes(String(d.phase ?? '')));
            return {
                name: n,
                goal: Number(st.monthlyGoal) || 0,
                budget: Number(st.budget) || 0,
                sales: salesAll[n]?.[tm] ?? 0,
                fee: feeAll[n]?.[tm] ?? 0,
                reformGp: rgAll[n]?.[tm] ?? 0,
                reform: rfAll[n]?.[tm] ?? 0,
                deals: dAll.length,
                confirmed: dCon.length,
                contracts: cntAll[n]?.[tm] ?? 0,
                baikai: bCnt[n]?.[tm] ?? 0,
                pending: dAll.length - dCon.length,
                cumSales: sumRow(salesAll[n], cumMks),
            };
        });
        const total = rows.reduce((t, r) => ({
            goal: t.goal + r.goal, sales: t.sales + r.sales, fee: t.fee + r.fee, reformGp: t.reformGp + r.reformGp,
            reform: t.reform + r.reform, deals: t.deals + r.deals, contracts: t.contracts + r.contracts,
            baikai: t.baikai + r.baikai, pending: t.pending + r.pending,
        }), { goal: 0, sales: 0, fee: 0, reformGp: 0, reform: 0, deals: 0, contracts: 0, baikai: 0, pending: 0 });

        return {
            rows, total, totalBudget, cum, prog, elapsed, paceGap: prog - elapsed / 12,
            cumFee: sumCum(feeAll), cumRf: sumCum(rfAll), cumRg: sumCum(rgAll),
            fromMonth: cumMks[0], hasStaff: staffSettings.length > 0,
        };
    }, [deals, ledger, settings.staff, selectedMonth, fyMonths]);

    /** 📞 架電実績（v2.2.222。本番アプリの callStats と同じ。実日付で本日・今週・今月） */
    const calls = useMemo(() => {
        const cs = callStats(leads as unknown as Row[], buyLeads as unknown as Row[]);
        const names = (settings.staff ?? []).map(st => st.name).filter((n): n is string => !!n);
        const all = [...names, ...Object.keys(cs.out).filter(n => !names.includes(n))];
        const team = { day: emptyCallCell(), week: emptyCallCell(), month: emptyCallCell() };
        const rows = all.map(n => {
            const o = cs.out[n] ?? { day: emptyCallCell(), week: emptyCallCell(), month: emptyCallCell() };
            (['day', 'week', 'month'] as const).forEach(b => {
                team[b].s += o[b].s; team[b].b += o[b].b; team[b].line += o[b].line; team[b].mail += o[b].mail;
            });
            return { name: n, ...o };
        });
        return { rows, team, today: cs.today, wFrom: cs.wFrom };
    }, [leads, buyLeads, settings.staff]);

    /** 🆕 朝礼用アラート（v2.2.222）。直近14日に商談リストへ登録した案件・新規の媒介獲得 */
    const alerts = useMemo(() => {
        const w = alertWindow();
        const staffSettings = settings.staff ?? [];
        const abbrToName = (ab: string) => staffSettings.find(st => st.abbr === ab)?.name ?? ab;
        const newDeals = deals.filter(d => inWindow(dealRegDate(d), w))
            .sort((a, b) => dealRegDate(b).localeCompare(dealRegDate(a)));
        const newLedger = ledger.filter(l => inWindow(String(l.contractDate ?? ''), w))
            .sort((a, b) => String(b.contractDate).localeCompare(String(a.contractDate)));
        return { w, newDeals, newLedger, abbrToName };
    }, [deals, ledger, settings.staff]);
    const [showAlerts, setShowAlerts] = useState(true);

    // ==========================================
    // 💡 6. 反響KPIサマリー（元HTML版 V12 の leadKpi / buyKpi と同じ定義）
    //    受信月コホート基準。架電数だけは「その月に行われた架電」を数える。
    // ==========================================
    const sellKpiSummary = useMemo(() => {
        const target = funnelData.sell;                       // リード数・通電・査定・受託は歩留まりファネルと同じ集計
        const monthLeads = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));

        // 反響費用 = 対象月に受信したリードの反響単価の合計
        const srcCosts = settings.srcCosts || {};
        const cost = monthLeads.reduce((sum, l) => sum + (Number(srcCosts[l.source ?? '']) || 0), 0);

        // 月次の媒介受託目標 = 担当者ごとの年間目標の合計 ÷ 12
        const annualTarget = (settings.staff || []).reduce((sum, st) => sum + (Number(st.baikaiTarget) || 0), 0);

        // 前月比受託数
        const prev = prevMonth(selectedMonth);
        const prevWins = leads.filter(l => l.receivedDate?.startsWith(prev) && l.phase === '媒介受託').length;

        return {
            leads: target.leads,
            calls: countCalls(leads, selectedMonth),
            connects: target.connects,
            visits: target.visits,
            wins: target.wins,
            target: Math.round(annualTarget / 12),
            lastMonthDiff: target.wins - prevWins,
            cost,
        };
    }, [leads, funnelData, selectedMonth, settings]);

    const buyKpiSummary = useMemo(() => {
        const target = funnelData.buy;
        const monthLeads = buyLeads.filter(l => l.receivedDate?.startsWith(selectedMonth));

        // 買いリードの反響元は source ではなく portal に入っている
        const portalCosts = settings.portalCosts || {};
        const cost = monthLeads.reduce((sum, l) => sum + (Number(portalCosts[l.portal]) || 0), 0);

        // 前月比申込数
        const prev = prevMonth(selectedMonth);
        const prevOffers = buyLeads.filter(l =>
            l.receivedDate?.startsWith(prev) && ['購入申込', '成約'].includes(l.phase || '')
        ).length;

        return {
            leads: target.leads,
            calls: countCalls(buyLeads, selectedMonth),
            connects: target.connects,
            views: target.views,
            offers: target.offers,
            wins: target.wins,
            lastMonthDiff: target.offers - prevOffers,
            cost,
        };
    }, [buyLeads, funnelData, selectedMonth, settings]);

    return (
        <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
            <LeadHeader
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                availableMonths={availableMonths}
                handleAddClick={() => { }}
                isAdding={false}
                headerLabel={headerLabel}
                allowAllPeriod={false}
                monthSuffix=""
            />

            {!isLoading && (
                <div>
                    {/* ==========================================
                        🎯 1. 営業司令塔 (KPI & タスク)
                    ========================================== */}
                    <div style={s.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={s.cardTitle}>
                                🎯 営業司令塔
                                <span style={s.badge('#22405c')}>Dashboard集計</span>
                                <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                    次回アクション・停滞・ホット度をサーバ側で一括算出（{realTime} 時点）
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ fontSize: '11px', color: '#495057', cursor: 'pointer', margin: 0 }}>
                                    <input type="checkbox" checked={myself} onChange={(e) => setMyself(e.target.checked)} style={{ marginRight: '6px' }} />
                                    自分の担当のみ（{userName}）
                                </label>
                                <button style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                                    ↻ 再集計
                                </button>
                            </div>
                        </div>

                        {/* KPI チップス */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ flex: 1, border: '1px solid #ffcdd2', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff5f5' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc3545' }}>{dashboardSummary.over}</div>
                                <div style={{ fontSize: '10px', color: '#dc3545' }}>期日超過</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #ffecb3', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff8f1' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fd7e14' }}>{dashboardSummary.today}</div>
                                <div style={{ fontSize: '10px', color: '#fd7e14' }}>本日</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #ffcdd2', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff5f5' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc3545' }}>{dashboardSummary.next}</div>
                                <div style={{ fontSize: '10px', color: '#dc3545' }}>次回未設定</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #ffecb3', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#fff8f1' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fd7e14' }}>{dashboardSummary.slowdown}</div>
                                <div style={{ fontSize: '10px', color: '#fd7e14' }}>停滞</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #bbdefb', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f0f7ff' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d6efd' }}>{dashboardSummary.hot}</div>
                                <div style={{ fontSize: '10px', color: '#0d6efd' }}>ホット</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #e9ecef', borderRadius: '6px', padding: '8px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6c757d' }}>{dashboardSummary.follow}</div>
                                <div style={{ fontSize: '10px', color: '#6c757d' }}>追客中 合計</div>
                            </div>
                        </div>

                        {/* タブ */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => setActiveTab('today')} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ced4da', backgroundColor: activeTab === 'today' ? '#343a40' : '#fff', color: activeTab === 'today' ? '#fff' : '#495057', fontWeight: 'bold' }}>
                                ⏰ 今日やること <span style={s.badge('#dc3545')}>{dashboardSummary.over + dashboardSummary.today}</span>
                            </button>
                            <button onClick={() => setActiveTab('hot')} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ced4da', backgroundColor: activeTab === 'hot' ? '#343a40' : '#fff', color: activeTab === 'hot' ? '#fff' : '#495057', fontWeight: 'bold' }}>
                                🔥 ホットな反響 <span style={s.badge('#0d6efd')}>{dashboardSummary.hot}</span>
                            </button>
                            <button onClick={() => setActiveTab('stale')} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ced4da', backgroundColor: activeTab === 'stale' ? '#343a40' : '#fff', color: activeTab === 'stale' ? '#fff' : '#495057', fontWeight: 'bold' }}>
                                🚨 停滞アラート <span style={s.badge('#ffc107', '#212529')}>{dashboardSummary.slowdown + dashboardSummary.next}</span>
                            </button>
                        </div>

                        {/* リスト表示部 */}
                        <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th style={{ ...s.th, width: '40px', textAlign: 'center' }}>区分</th>
                                        <th style={{ ...s.th, width: '180px' }}>相手先 / 連絡先</th>
                                        <th style={{ ...s.th, width: '80px' }}>担当</th>
                                        <th style={{ ...s.th, width: '80px' }}>状態</th>
                                        <th style={{ ...s.th, width: '90px' }}>予定日</th>
                                        <th style={s.th}>次回アクション</th>
                                        <th style={{ ...s.th, width: '60px', textAlign: 'center' }}>超過</th>
                                        <th style={{ ...s.th, width: '80px', textAlign: 'center' }}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {toDoSummary.length > 0 ? (
                                        toDoSummary.map((t) => (
                                            <tr key={t.id} style={{ backgroundColor: t.diff > 0 ? '#fff5f5' : '#fff' }}>
                                                <td style={{ ...s.td, textAlign: 'center' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: t.kindColor, border: `1px solid ${t.kindColor}`, padding: '1px 4px', borderRadius: '3px', backgroundColor: `${t.kindColor}15` }}>
                                                        {t.kindLabel}
                                                    </span>
                                                </td>
                                                <td style={s.td}>
                                                    <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '12px' }}>{t.name}</div>
                                                    <div style={{ fontSize: '10px', color: '#6c757d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                                        {t.contact} / {t.addr}
                                                    </div>
                                                </td>
                                                <td style={s.td}>{t.staff}</td>
                                                <td style={s.td}>
                                                    <span style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{t.phase}</span>
                                                </td>
                                                <td style={{ ...s.td, color: t.diff > 0 ? '#dc3545' : '#495057', fontWeight: t.diff > 0 ? 'bold' : 'normal' }}>
                                                    {t.next}
                                                </td>
                                                <td style={s.td}>{t.note}</td>
                                                <td style={{ ...s.td, textAlign: 'center' }}>
                                                    {t.diff > 0 ? (
                                                        <span style={s.badge('#dc3545')}>{t.diff}日</span>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ ...s.td, textAlign: 'center' }}>
                                                    <button
                                                        style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#0d6efd' }}
                                                        onClick={() => handleOpenLead(t.id)}
                                                    >開く</button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6c757d', fontSize: '11px' }}>該当するタスクはありません</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ==========================================
                        🔻 2. 歩留まりファネル
                    ========================================== */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>
                            🔻 歩留まりファネル（{selectedMonth.replace('-', '年')}月受信分）
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                カッコ内は直前の段からの移行率
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                            {/* 売り反響ファネル */}
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>📨 売り反響（一括査定）</div>
                                <div style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', minWidth: '400px' }}>
                                    {/* ※本来はSVGで描画されていましたが、今回はReactのdiv要素で疑似的にプログレスバーを表現します */}
                                    {[
                                        { label: 'リード受信', val: funnelData.sell.leads, color: '#22405c' },
                                        { label: '通電', val: funnelData.sell.connects, color: '#22405c', opacity: 0.86, prev: funnelData.sell.leads },
                                        { label: '訪問査定', val: funnelData.sell.visits, color: '#22405c', opacity: 0.72, prev: funnelData.sell.connects },
                                        { label: '査定書提出', val: funnelData.sell.proposes, color: '#22405c', opacity: 0.58, prev: funnelData.sell.visits },
                                        { label: '媒介受託', val: funnelData.sell.wins, color: '#22405c', opacity: 0.44, prev: funnelData.sell.proposes }
                                    ].map((step, idx) => {
                                        const widthPct = funnelData.sell.leads ? (step.val / funnelData.sell.leads) * 100 : 0;
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', fontSize: '11px' }}>
                                                <div style={{ width: '80px', textAlign: 'right', marginRight: '8px', color: '#57534e' }}>{step.label}</div>
                                                <div style={{ flex: 1, backgroundColor: '#e9ecef', height: '16px', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.max(widthPct, 1)}%`, backgroundColor: step.color, opacity: step.opacity, height: '100%' }}></div>
                                                </div>
                                                <div style={{ width: '80px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                    {step.val} <span style={{ color: '#6c757d', fontWeight: 'normal', fontSize: '10px' }}>({idx === 0 ? '100%' : calcRate(step.val, step.prev || 1)})</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px' }}>
                                    リード→媒介受託 {calcRate(funnelData.sell.wins, funnelData.sell.leads)}
                                </div>
                            </div>

                            {/* 買い反響ファネル */}
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>🏠 買い反響（ポータル）</div>
                                <div style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', minWidth: '400px' }}>
                                    {[
                                        { label: '反響受信', val: funnelData.buy.leads, color: '#1a6b3c' },
                                        { label: '通電', val: funnelData.buy.connects, color: '#1a6b3c', opacity: 0.86, prev: funnelData.buy.leads },
                                        { label: '内見', val: funnelData.buy.views, color: '#1a6b3c', opacity: 0.72, prev: funnelData.buy.connects },
                                        { label: '購入申込', val: funnelData.buy.offers, color: '#1a6b3c', opacity: 0.58, prev: funnelData.buy.views },
                                        { label: '成約', val: funnelData.buy.wins, color: '#1a6b3c', opacity: 0.44, prev: funnelData.buy.offers }
                                    ].map((step, idx) => {
                                        const widthPct = funnelData.buy.leads ? (step.val / funnelData.buy.leads) * 100 : 0;
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', fontSize: '11px' }}>
                                                <div style={{ width: '80px', textAlign: 'right', marginRight: '8px', color: '#57534e' }}>{step.label}</div>
                                                <div style={{ flex: 1, backgroundColor: '#e9ecef', height: '16px', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.max(widthPct, 1)}%`, backgroundColor: step.color, opacity: step.opacity, height: '100%' }}></div>
                                                </div>
                                                <div style={{ width: '80px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                    {step.val} <span style={{ color: '#6c757d', fontWeight: 'normal', fontSize: '10px' }}>({idx === 0 ? '100%' : calcRate(step.val, step.prev || 1)})</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px' }}>
                                    反響→成約 {calcRate(funnelData.buy.wins, funnelData.buy.leads)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ==========================================
                        🎯 3. 年間予算進捗（v2.2.222 から実データ。期首〜対象月の売上計上額の累計 ÷ 担当者の年間予算の合計）
                    ========================================== */}
                    <div style={s.card}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '16px', color: '#343a40' }}>🎯 年間予算進捗 {pct(kpi.totalBudget ? kpi.prog : null)}</strong>
                            <span style={{ fontSize: '11px', color: '#6c757d' }}>累計 {fmtYen(kpi.cum)} ／ 予算 {fmtYen(kpi.totalBudget)}</span>
                            {kpi.totalBudget > 0 && (
                                <span style={s.badge(kpi.paceGap < 0 ? '#dc3545' : '#198754')}>
                                    {kpi.paceGap < 0
                                        ? `⚠ ▼${(Math.abs(kpi.paceGap) * 100).toFixed(1)}% 遅れ`
                                        : `▲${(kpi.paceGap * 100).toFixed(1)}% 先行`}（経過 {kpi.elapsed}/12ヶ月）
                                </span>
                            )}
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, kpi.prog * 100)}%`, height: '100%', backgroundColor: kpi.paceGap < 0 ? '#dc3545' : '#198754' }}></div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#495057', marginTop: '8px' }}>
                            内訳（{monthLabel(kpi.fromMonth)}〜{monthLabel(selectedMonth)}累計）：仲介手数料 <b>{fmtYen(kpi.cumFee)}</b> ＋ リフォーム粗利 <b>{fmtYen(kpi.cumRg)}</b> ＝ 売上計上額 <b>{fmtYen(kpi.cum)}</b>
                            <span style={{ color: '#6c757d', marginLeft: '6px' }}>
                                ※リフォームは受注額ではなく粗利を売上に計上します（受注額 {fmtYen0(kpi.cumRf)}・粗利率 {kpi.cumRf ? pct(kpi.cumRg / kpi.cumRf) : '―'} は参考値）
                            </span>
                        </div>
                        {!kpi.hasStaff && (
                            <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '6px' }}>担当者と予算が設定されていません（設定画面は次の版で追加します）。</div>
                        )}
                    </div>

                    {/* ==========================================
                        📊 4. 月次KPIサマリー（v2.2.222 から実データ。本番アプリと同じ列）
                    ========================================== */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>
                            月次KPIサマリー（{monthLabel(selectedMonth)}）
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                灰色＝自動集計。<b>売上計上額＝仲介手数料＋リフォーム粗利</b>（リフォーム受注額は参考値）。商談案件の契約日ベース・共同担当は按分。
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th style={{ ...s.th, textAlign: 'left' }}>担当者</th>
                                        <th style={s.th}>今月目標<br/>売上(円)</th>
                                        <th style={s.th}>今月見込<br/>売上(円)</th>
                                        <th style={s.th}>達成率</th>
                                        <th style={s.th}>うち仲介<br/>手数料(円)</th>
                                        <th style={s.th}>うちリフォーム<br/>粗利(円)</th>
                                        <th style={s.th}>リフォーム<br/>受注額(円)<br/><span style={{ fontWeight: 'normal' }}>※参考</span></th>
                                        <th style={s.th}>案件数<br/>(累計)</th>
                                        <th style={s.th}>今月<br/>契約件数</th>
                                        <th style={s.th}>契約率</th>
                                        <th style={s.th}>今月<br/>媒介獲得</th>
                                        <th style={s.th}>未決<br/>案件数</th>
                                        <th style={s.th}>年間予算<br/>進捗率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kpi.rows.length === 0 && (
                                        <tr><td colSpan={13} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>担当者が設定されていません</td></tr>
                                    )}
                                    {kpi.rows.map(r => (
                                        <tr key={r.name} style={{ backgroundColor: '#fff' }}>
                                            <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold', color: '#343a40' }}>{r.name}</td>
                                            {/* 目標は設定で入れる値（薄いオレンジ）。それ以外は自動集計（薄い灰色） */}
                                            <td style={{ ...s.td, backgroundColor: '#fff8f1', color: '#fd7e14', fontWeight: 'bold' }}>{fmtYen(r.goal)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>{fmtYen(r.sales)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.goal ? pct(r.sales / r.goal) : '―'}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtYen(r.fee)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtYen0(r.reformGp)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtYen0(r.reform)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.deals}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtCnt(r.contracts)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.deals ? pct(r.confirmed / r.deals) : '―'}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.baikai}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.pending}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.budget ? pct(r.cumSales / r.budget) : '―'}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>チーム合計</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen(kpi.total.goal)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen(kpi.total.sales)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.goal ? pct(kpi.total.sales / kpi.total.goal) : '―'}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen(kpi.total.fee)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen0(kpi.total.reformGp)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen0(kpi.total.reform)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.deals}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtCnt(kpi.total.contracts)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>―</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.baikai}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.pending}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.totalBudget ? pct(kpi.cum / kpi.totalBudget) : '―'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ==========================================
                        📞 5. 架電実績
                    ========================================== */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>
                            架電実績（担当者別・日次／週次／月次）
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                📨売り反響・🏠買い反響の記録から自動集計。数値は📞架電のみ（💬LINE・✉️メールは表の下）。本日={formatDate(calls.today)}／今週={formatDate(calls.wFrom)}〜
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th style={{ ...s.th, textAlign: 'left' }}>担当者</th>
                                        <th style={s.th}>本日<br/>売</th><th style={s.th}>本日<br/>買</th><th style={{...s.th, color:'#0d6efd'}}>本日<br/>計</th>
                                        <th style={s.th}>今週<br/>売</th><th style={s.th}>今週<br/>買</th><th style={{...s.th, color:'#0d6efd'}}>今週<br/>計</th>
                                        <th style={s.th}>今月<br/>売</th><th style={s.th}>今月<br/>買</th><th style={{...s.th, color:'#0d6efd'}}>今月<br/>計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calls.rows.length === 0 && (
                                        <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>架電の記録がありません</td></tr>
                                    )}
                                    {calls.rows.map(c => (
                                        <tr key={c.name} style={{ backgroundColor: '#fff' }}>
                                            <td style={{ ...s.td, textAlign: 'left' }}>{c.name}</td>
                                            {(['day', 'week', 'month'] as const).map(b => (
                                                <React.Fragment key={b}>
                                                    <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c[b].s}</td>
                                                    <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c[b].b}</td>
                                                    <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c[b].s + c[b].b}</td>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>チーム合計</td>
                                        {(['day', 'week', 'month'] as const).map(b => (
                                            <React.Fragment key={b}>
                                                <td style={s.td}>{calls.team[b].s}</td>
                                                <td style={s.td}>{calls.team[b].b}</td>
                                                <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{calls.team[b].s + calls.team[b].b}</td>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '8px' }}>
                            チーム内訳（架電以外）：本日 💬{calls.team.day.line}件・✉️{calls.team.day.mail}件 ／ 今週 💬{calls.team.week.line}件・✉️{calls.team.week.mail}件 ／ 今月 💬{calls.team.month.line}件・✉️{calls.team.month.mail}件
                        </div>
                    </div>

                    {/* ==========================================
                        📊 6. 反響KPI (売り/買い 横並び)
                    ========================================== */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {/* 売り反響KPI */}
                        <div style={{ ...s.card, flex: 1, minWidth: '550px' }}>
                            <div style={s.cardTitle}>
                                一括査定KPIサマリー（{selectedMonth.replace('-', '年')}月）
                            </div>
                            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th style={s.th}>リード数</th>
                                            <th style={s.th}>架電数</th>
                                            <th style={s.th}>通電率</th>
                                            <th style={s.th}>査定率</th>
                                            <th style={s.th}>受託率(リード比)</th>
                                            <th style={s.th}>目標達成率</th>
                                            <th style={s.th}>獲得単価</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ backgroundColor: '#fff' }}>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{sellKpiSummary.leads}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{sellKpiSummary.calls}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(sellKpiSummary.connects, sellKpiSummary.leads)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(sellKpiSummary.visits, sellKpiSummary.leads)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#198754', fontWeight: 'bold' }}>{calcRate(sellKpiSummary.wins, sellKpiSummary.leads)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#fff8f1', color: '#fd7e14' }}>{calcRate(sellKpiSummary.wins, sellKpiSummary.target)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{sellKpiSummary.wins ? formatYen(sellKpiSummary.cost / sellKpiSummary.wins) : '―'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 買い反響KPI */}
                        <div style={{ ...s.card, flex: 1, minWidth: '550px' }}>
                            <div style={s.cardTitle}>
                                買い反響KPIサマリー（{selectedMonth.replace('-', '年')}月）
                            </div>
                            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th style={s.th}>反響数</th>
                                            <th style={s.th}>通電率</th>
                                            <th style={s.th}>内見率</th>
                                            <th style={s.th}>申込率(反響比)</th>
                                            <th style={s.th}>成約数</th>
                                            <th style={s.th}>前月比申込</th>
                                            <th style={s.th}>申込単価</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ backgroundColor: '#fff' }}>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{buyKpiSummary.leads}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(buyKpiSummary.connects, buyKpiSummary.leads)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#0d6efd', fontWeight: 'bold' }}>{calcRate(buyKpiSummary.views, buyKpiSummary.leads)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', color: '#198754', fontWeight: 'bold' }}>{calcRate(buyKpiSummary.offers, buyKpiSummary.leads)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{buyKpiSummary.wins}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>+{buyKpiSummary.lastMonthDiff}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{buyKpiSummary.offers ? formatYen(buyKpiSummary.cost / buyKpiSummary.offers) : '―'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* ==========================================
                        🆕 7. 朝礼用アラート（v2.2.222。本番アプリと同じく直近14日の新規だけ。14日を過ぎると自動で外れる）
                    ========================================== */}
                    <div style={s.card}>
                        <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center' }}>
                            朝礼用アラート
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                直近{ALERT_DAYS}日間（{formatDate(alerts.w.from)}〜{formatDate(alerts.w.to)}）の新規のみ表示
                            </span>
                            <button type="button" onClick={() => setShowAlerts(v => !v)}
                                style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                                {showAlerts ? '▲ 非表示にする' : '▼ 表示する'}
                            </button>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>
                            🆕 直近{ALERT_DAYS}日の新規商談案件 <span style={s.badge(alerts.newDeals.length ? '#22405c' : '#adb5bd')}>{alerts.newDeals.length}件</span>
                        </div>
                        {showAlerts && (alerts.newDeals.length === 0
                            ? <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '8px' }}>該当なし（直近{ALERT_DAYS}日に登録された商談案件はありません）</div>
                            : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                                    <thead><tr>{['登録日', '担当', '種別', '物件名', '顧客名', '価格', '進捗'].map(h => <th key={h} style={{ ...s.th, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {alerts.newDeals.map(d => (
                                            <tr key={String(d.id)}>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{formatDate(dealRegDate(d))}<span style={{ fontSize: '10px', color: '#6c757d' }}>（{daysAgoLabel(dealRegDate(d), alerts.w.to)}）</span></td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{d.staff ? String(d.staff) : <span style={s.badge('#dc3545')}>未割当</span>}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.type ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.property ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.customer ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{d.price ? fmtYen(Number(d.price)) : '―'}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.phase ?? '')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ))}
                        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>
                            📝 直近{ALERT_DAYS}日の新規媒介獲得 <span style={s.badge(alerts.newLedger.length ? '#22405c' : '#adb5bd')}>{alerts.newLedger.length}件</span>
                        </div>
                        {showAlerts && (alerts.newLedger.length === 0
                            ? <div style={{ fontSize: '11px', color: '#6c757d' }}>該当なし（直近{ALERT_DAYS}日に獲得した媒介はありません）</div>
                            : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr>{['契約日', '担当', '反響元', '売主名', '所在地', '媒介種別', '売出価格'].map(h => <th key={h} style={{ ...s.th, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {alerts.newLedger.map(l => (
                                            <tr key={String(l.id)}>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{formatDate(String(l.contractDate ?? ''))}<span style={{ fontSize: '10px', color: '#6c757d' }}>（{daysAgoLabel(String(l.contractDate ?? ''), alerts.w.to)}）</span></td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{alerts.abbrToName(String(l.staff ?? ''))}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(l.source ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(l.seller ?? '')}</td>
                                                {/* ⚠️ 本番アプリと同じく addr2 の URL は表示しない */}
                                                <td style={{ ...s.td, textAlign: 'left' }}>{`${String(l.addr1 ?? '')}${l.addr2 ? ' ' + String(l.addr2).replace(/https?:\/\/\S*/g, '').trim() : ''}`}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(l.baikaiType ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{l.price ? fmtYen(Number(l.price)) : '―'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ))}
                        <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '8px' }}>
                            ※ 買取再販の期限アラートと営業司令塔の詳細は、買取再販・商談案件の移植のときに足します。
                        </div>
                    </div>

                </div>
            )}

            {/* ==========================================
                💡 顧客情報編集モーダル（タスク一覧の「開く」から）
                売り／買いは元レコードの kind で切り替える
            ========================================== */}
            <LeadEdit
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveCustomerInfo}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                leadCategory={editCategory}
                staffList={staffList}
            />
        </div>
    );
};

export default Summary;