import React, { useState, useEffect, useMemo, useContext } from 'react';
import apiClient from '../../utils/apiClient';
import LeadHeader from '../lead/LeadHeader'; // パスは環境に合わせて調整してください
import { thisYear } from '../../utils/thisYear';
import { removeSpaces, formatDate } from './summaryUtiles'; // パスは環境に合わせて調整してください
import AuthContext from '../../context/AuthContext';
// 💡 追加: タスク一覧の「開く」から顧客情報を編集する
import LeadEdit, { LeadCategory } from '../lead/LeadEdit';
import { saveBrokerageRecord, recordFieldChanges } from '../lead/leadUtiles';

// ==========================================
// 💡 型定義 (推論ベース)
// ==========================================
type SummaryLead = {
    id: string;
    kind: string;
    receivedDate: string | null;
    portal: string;
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
    const [deals, setDeals] = useState<any[]>([]); // 商談案件 (今回はanyで仮置き)

    const [staffList, setStaffList] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');

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
                        const allLeads: SummaryLead[] = response.data.lead;
                        setLeads(allLeads.filter(l => l.kind !== 'buyLeads'));
                        setBuyLeads(allLeads.filter(l => l.kind === 'buyLeads'));
                    }
                    // 将来 API が分けて返すようになった場合はそちらを優先する
                    if (response.data.buyLeads) setBuyLeads(response.data.buyLeads);
                    if (response.data.deals) setDeals(response.data.deals);
                    if (response.data.staff) {
                        setStaffList(response.data.staff.filter((st: any) => st.period === String(thisYear)).map((st: any) => st.name));
                    }
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
    // 全てのリードから受信月のリストを抽出
    const availableMonths = useMemo(() => {
        const allLeads = [...leads, ...buyLeads];
        const months = allLeads.map(l => {
            if (!l.receivedDate || l.receivedDate.startsWith('0000')) return '';
            return l.receivedDate.slice(0, 7); // "YYYY-MM"
        }).filter(Boolean);
        return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
    }, [leads, buyLeads]);

    const headerLabel = { title: 'チームサマリー', describe: '本日のタスク、追客予定、月次KPI、架電実績' };

    // 📊 月次KPIサマリーデータ
    const kpiSummaryData = useMemo(() => [
        { staff: '時任聡一朗', target: 3000000, expected: 3240000, achieve: 108.0, dealsTotal: 13, contractMonth: 6, contractRate: 84.6, baikaiMonth: 6, pending: 2, annualProg: 20.8 },
        { staff: '宮城智一', target: 2500000, expected: 393000, achieve: 15.7, dealsTotal: 5, contractMonth: 1, contractRate: 80.0, baikaiMonth: 1, pending: 1, annualProg: 11.0 },
        { staff: '永田倫也', target: 2500000, expected: 0, achieve: 0.0, dealsTotal: 7, contractMonth: 0, contractRate: 57.1, baikaiMonth: 1, pending: 3, annualProg: 5.0 },
        { staff: '岡崎真夕', target: 1500000, expected: 1980000, achieve: 132.0, dealsTotal: 7, contractMonth: 3, contractRate: 85.7, baikaiMonth: 1, pending: 1, annualProg: 11.0 },
    ], []);

    // 📞 架電実績データ
    const callStatsData = useMemo(() => [
        { staff: '時任聡一朗', todayS: 2, todayB: 0, weekS: 4, weekB: 0, monthS: 9, monthB: 6 },
        { staff: '宮城智一', todayS: 0, todayB: 0, weekS: 0, weekB: 0, monthS: 7, monthB: 0 },
        { staff: '永田倫也', todayS: 0, todayB: 0, weekS: 0, weekB: 0, monthS: 5, monthB: 6 },
        { staff: '岡崎真夕', todayS: 0, todayB: 0, weekS: 0, weekB: 0, monthS: 4, monthB: 5 },
        { staff: '（未割当）', todayS: 7, todayB: 0, weekS: 7, weekB: 0, monthS: 26, monthB: 0 },
    ], []);

const sellKpiSummary = { leads: 66, calls: 83, connects: 20, visits: 6, wins: 0, target: 16, lastMonthDiff: -4, cost: 872300 };
    const buyKpiSummary = { leads: 15, calls: 0, connects: 7, views: 3, offers: 2, wins: 0, lastMonthDiff: 1, cost: 28473 };

    return (
        <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
            <LeadHeader
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                availableMonths={availableMonths}
                handleAddClick={() => { }}
                isAdding={false}
                headerLabel={headerLabel}
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
                        🎯 3. 年間予算進捗 (今回はモック値)
                    ========================================== */}
                    <div style={s.card}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '16px', color: '#343a40' }}>🎯 年間予算進捗 12.5%</strong>
                            <span style={{ fontSize: '11px', color: '#6c757d' }}>累計 ¥14,262,000 ／ 予算 ¥114,000,000</span>
                            <span style={s.badge('#dc3545')}>⚠ ▼4.2% 遅れ（経過 2/12ヶ月）</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                            <div style={{ width: '12.5%', height: '100%', backgroundColor: '#198754' }}></div>
                        </div>
                    </div>

                    {/* ==========================================
                        📊 4. 月次KPIサマリー
                    ========================================== */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>
                            月次KPIサマリー（{selectedMonth.replace('-', '年')}月）
                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>緑背景＝自動集計。今月目標は設定で編集できます。</span>
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th style={{ ...s.th, textAlign: 'left' }}>担当者</th>
                                        <th style={s.th}>今月目標<br/>売上(円)</th>
                                        <th style={s.th}>今月見込<br/>売上(円)</th>
                                        <th style={s.th}>達成率</th>
                                        <th style={s.th}>案件数<br/>(累計)</th>
                                        <th style={s.th}>今月<br/>契約件数</th>
                                        <th style={s.th}>契約率</th>
                                        <th style={s.th}>今月<br/>媒介獲得</th>
                                        <th style={s.th}>未決<br/>案件数</th>
                                        <th style={s.th}>年間予算<br/>進捗率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kpiSummaryData.map((k, idx) => (
                                        <tr key={idx} style={{ backgroundColor: '#fff' }}>
                                            <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold', color: '#343a40' }}>{k.staff}</td>
                                            {/* warn-cell に相当する部分を薄いオレンジ背景で表現 */}
                                            <td style={{ ...s.td, backgroundColor: '#fff8f1', color: '#fd7e14', fontWeight: 'bold' }}>{formatYen(k.target)}</td>
                                            {/* auto に相当する部分を薄いグレー背景で表現 */}
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>{formatYen(k.expected)}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.achieve.toFixed(1)}%</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.dealsTotal}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.contractMonth}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.contractRate.toFixed(1)}%</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.baikaiMonth}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.pending}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.annualProg.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>チーム合計</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{formatYen(kpiSummaryData.reduce((acc, cur) => acc + cur.target, 0))}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{formatYen(kpiSummaryData.reduce((acc, cur) => acc + cur.expected, 0))}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>
                                            {calcRate(kpiSummaryData.reduce((acc, cur) => acc + cur.expected, 0), kpiSummaryData.reduce((acc, cur) => acc + cur.target, 0))}
                                        </td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.dealsTotal, 0)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.contractMonth, 0)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>―</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.baikaiMonth, 0)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.pending, 0)}</td>
                                        <td style={{ ...s.td, fontWeight: 'bold' }}>12.5%</td>
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
                                数値は📞架電のみ。本日={formatDate(new Date())}
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
                                    {callStatsData.map((c, idx) => (
                                        <tr key={idx} style={{ backgroundColor: '#fff' }}>
                                            <td style={{ ...s.td, textAlign: 'left' }}>{c.staff}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.todayS}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.todayB}</td>
                                            <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c.todayS + c.todayB}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.weekS}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.weekB}</td>
                                            <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c.weekS + c.weekB}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.monthS}</td>
                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.monthB}</td>
                                            <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c.monthS + c.monthB}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>チーム合計</td>
                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.todayS, 0)}</td>
                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.todayB, 0)}</td>
                                        <td style={{...s.td, fontWeight: 'bold', color: '#0d6efd'}}>{callStatsData.reduce((a, c) => a + c.todayS + c.todayB, 0)}</td>
                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.weekS, 0)}</td>
                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.weekB, 0)}</td>
                                        <td style={{...s.td, fontWeight: 'bold', color: '#0d6efd'}}>{callStatsData.reduce((a, c) => a + c.weekS + c.weekB, 0)}</td>
                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.monthS, 0)}</td>
                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.monthB, 0)}</td>
                                        <td style={{...s.td, fontWeight: 'bold', color: '#0d6efd'}}>{callStatsData.reduce((a, c) => a + c.monthS + c.monthB, 0)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '8px' }}>
                            チーム内訳（架電以外）：本日 💬1件・✉️0件 ／ 今週 💬1件・✉️0件 ／ 今月 💬2件・✉️6件
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