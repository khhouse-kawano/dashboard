import React, { useState, useEffect, useMemo, useContext } from 'react';
import apiClient from '../../../utils/apiClient';
import LeadHeader from '../common/LeadHeader'; // パスは環境に合わせて調整してください
import { thisYear } from '../../../utils/thisYear';
import { formatDate } from './summaryUtiles';
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
// ⚠️ v2.2.225: 以前のダッシュボードと同じ並び（営業司令塔は最下段）・買取再販の期限アラート
import { useNavigate } from 'react-router-dom';
import CommandCenter from './CommandCenter';
import { resaleDashAlerts } from './resaleAlerts';
import { loadRecords } from '../common/realtyState';

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
const formatMan = (num: number | string | null | undefined) => {
    if (num == null || isNaN(Number(num))) return '―';
    return `${Math.round(Number(num) / 10000).toLocaleString()}万`;
};

const calcRate = (part: number, total: number) => {
    if (!total || total === 0) return '―';
    return ((part / total) * 100).toFixed(1) + '%';
};

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
                    // ⚠️ v2.2.225: 買取再販の期限アラート（以前のアプリの朝礼用アラートの最後）
                    loadRecords(['resales']).then(r => setResales(r.records.resales)).catch(e => console.error('[Summary] 買取再販を読めませんでした', e));
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
    const navigate = useNavigate();
    const [resales, setResales] = useState<Row[]>([]);
    /** 買取再販の期限・要対応（RSA.dashAlerts）。⚠️ 期首月は買取再販の消費税の設定（rsVat.fyStart。既定6月） */
    const resaleAlerts = useMemo(() => {
        const rsVat = (settings as { rsVat?: { fyStart?: number } }).rsVat;
        return resaleDashAlerts(resales, Number(rsVat?.fyStart) || 6);
    }, [resales, settings]);

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
                        📊 6. 一括査定KPI・買い反響KPI
                        ⚠️ v2.2.225: 以前のアプリ（renderDash）と同じ列・同じ表示にした（前月比はマイナスもそのまま出す）
                    ========================================== */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>
                            一括査定KPIサマリー（{monthLabel(selectedMonth)}受信リード・チーム合計）
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>売り反響から自動集計</span>
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead>
                                    <tr>
                                        {['リード受信数', '架電数(延べ)', '通電数', '通電率', '訪問査定獲得数', '査定獲得率', '媒介受託数', '受託率(リード比)', '受託率(査定比)', '目標受託数', '目標達成率', '前月比受託数', '反響費用', '媒介獲得単価']
                                            .map(h => <th key={h} style={{ ...s.th, textAlign: 'right' }}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sellKpiSummary.leads === 0 && sellKpiSummary.calls === 0 ? (
                                        <tr><td colSpan={14} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{monthLabel(selectedMonth)}受信のリードはまだ登録されていません</td></tr>
                                    ) : (
                                        <tr>
                                            <td style={s.td}>{sellKpiSummary.leads}</td>
                                            <td style={s.td}>{sellKpiSummary.calls}</td>
                                            <td style={s.td}>{sellKpiSummary.connects}</td>
                                            <td style={s.td}>{calcRate(sellKpiSummary.connects, sellKpiSummary.leads)}</td>
                                            <td style={s.td}>{sellKpiSummary.visits}</td>
                                            <td style={s.td}>{calcRate(sellKpiSummary.visits, sellKpiSummary.leads)}</td>
                                            <td style={s.td}>{sellKpiSummary.wins}</td>
                                            <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.leads)}</td>
                                            <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.visits)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#fff8e1' }}>{sellKpiSummary.target}</td>
                                            <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.target)}</td>
                                            <td style={s.td}>{sellKpiSummary.lastMonthDiff >= 0 ? '+' : ''}{sellKpiSummary.lastMonthDiff}</td>
                                            <td style={s.td}>{fmtYen0(sellKpiSummary.cost)}</td>
                                            <td style={s.td}>{sellKpiSummary.wins && sellKpiSummary.cost ? fmtYen(Math.round(sellKpiSummary.cost / sellKpiSummary.wins)) : '―'}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={s.card}>
                        <div style={s.cardTitle}>
                            買い反響KPIサマリー（{monthLabel(selectedMonth)}受信・チーム合計）
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>買い反響から自動集計</span>
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead>
                                    <tr>
                                        {['反響受信数', '架電数(延べ)', '通電数', '通電率', '内見数', '内見率', '購入申込', '申込率(反響比)', '成約数', '前月比申込', '反響費用', '申込単価']
                                            .map(h => <th key={h} style={{ ...s.th, textAlign: 'right' }}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {buyKpiSummary.leads === 0 && buyKpiSummary.calls === 0 ? (
                                        <tr><td colSpan={12} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{monthLabel(selectedMonth)}受信の買い反響はまだ登録されていません</td></tr>
                                    ) : (
                                        <tr>
                                            <td style={s.td}>{buyKpiSummary.leads}</td>
                                            <td style={s.td}>{buyKpiSummary.calls}</td>
                                            <td style={s.td}>{buyKpiSummary.connects}</td>
                                            <td style={s.td}>{calcRate(buyKpiSummary.connects, buyKpiSummary.leads)}</td>
                                            <td style={s.td}>{buyKpiSummary.views}</td>
                                            <td style={s.td}>{calcRate(buyKpiSummary.views, buyKpiSummary.leads)}</td>
                                            <td style={s.td}>{buyKpiSummary.offers}</td>
                                            <td style={s.td}>{calcRate(buyKpiSummary.offers, buyKpiSummary.leads)}</td>
                                            <td style={s.td}>{buyKpiSummary.wins}</td>
                                            <td style={s.td}>{buyKpiSummary.lastMonthDiff >= 0 ? '+' : ''}{buyKpiSummary.lastMonthDiff}</td>
                                            <td style={s.td}>{fmtYen0(buyKpiSummary.cost)}</td>
                                            <td style={s.td}>{buyKpiSummary.offers && buyKpiSummary.cost ? fmtYen(Math.round(buyKpiSummary.cost / buyKpiSummary.offers)) : '―'}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
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
                        {/* ⚠️ v2.2.225: 買取再販の期限・要対応（以前のアプリの RSA.dashAlerts。summary/resaleAlerts.ts） */}
                        {showAlerts && resaleAlerts.length > 0 && (
                            <>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '12px 0 6px' }}>
                                    🏗 買取再販の期限・要対応 <span style={s.badge('#fd7e14')}>{resaleAlerts.length}件</span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr>{['物件', '仕入担当', 'ステータス', '内容', ''].map(h => <th key={h} style={{ ...s.th, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {resaleAlerts.map(({ r, a }) => (
                                            <tr key={String(r.id)}>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(r.property || '（名称未設定）')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(r.staff ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(r.status ?? '')}</td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>
                                                    {a.map(x => <span key={x.t} style={{ ...s.badge(x.lv >= 2 ? '#dc3545' : '#ffc107', x.lv >= 2 ? '#fff' : '#212529'), marginRight: 4 }}>{x.t}</span>)}
                                                </td>
                                                <td style={{ ...s.td, textAlign: 'left' }}>
                                                    <button type="button" onClick={() => navigate('/leadResale')} style={{ fontSize: '10px', padding: '1px 8px', border: '1px solid #ced4da', background: '#fff', borderRadius: 4 }}>開く</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>

                    {/* ==========================================
                        🧭 8. 営業司令塔（v2.2.225。以前のアプリと同じく最下段・折りたたみ式。summary/CommandCenter.tsx）
                    ========================================== */}
                    <CommandCenter
                        leads={leads as unknown as Row[]}
                        buyLeads={buyLeads as unknown as Row[]}
                        deals={deals}
                        me={userName}
                        onOpen={(kind, id) => (kind === 'deals' ? navigate('/leadOpportunity') : handleOpenLead(id))}
                    />

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