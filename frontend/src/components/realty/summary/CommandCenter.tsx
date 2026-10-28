import React, { useMemo, useState } from 'react';
import { callsOf, fmtYen, todayStr } from './kpi';
import type { Row } from './kpi';

/**
 * 営業司令塔（v2.2.225。チームサマリーの最下段）。
 *
 * ⚠️ 移植元は本番アプリ（V18）の V12 モジュール（renderDash の最後の V12.card()）。
 *   以前のアプリはふだん Supabase の RPC（khf_command_center）で集計し、失敗したときだけ端末で計算していた。
 *   端末の計算（local）は「SQL と同じ配点」なので、ここではそれを写している（関数名の後ろの括弧は移植元の名前）。
 *   点数・抽出・並び・件数は以前のアプリと同じ。見た目だけ Dashboard に寄せた（接頭辞 rlt-cc-）。
 *
 * props
 *   leads / buyLeads / deals … brokerage_listings の行（削除済みは除いたもの）。⚠️ callDates は JSON 文字列のままでよい（callsOf で読む）
 *   me     … ログインしている人の名前（「自分の担当のみ」）。⚠️ 空白は除いて比べる（Dashboard のログイン名と案件の担当の表記の揺れ対策）
 *   onOpen … 「開く」を押したとき（kind = 'leads' | 'buyLeads' | 'deals'）。Summary.tsx が編集画面につなぐ
 *   today  … 'YYYY-MM-DD'（省略時は今日。検証用）
 *
 * ⚠️ 作っていないもの: 「完了→次回設定」「次回設定」（V12.done → askNext → commitNext。次回アクションの保存＝書き込み）。
 *   次回アクションは「開く」から各画面の編集で直す。
 */

type Kind = 'leads' | 'buyLeads' | 'deals';

type Props = {
    leads: Row[];
    buyLeads: Row[];
    deals: Row[];
    me?: string;
    onOpen?: (kind: Kind, id: string) => void;
    today?: string;
};

// ---------------------------------------------------------------------------
// 配点（V12 の P・REASON・CLOSED。Supabase の khf_scoring_params と同じ既定値）
// ---------------------------------------------------------------------------

const P = {
    phase: {
        'リード受信': 2, '架電中': 8, '通電済': 18, '訪問査定予定': 28, '訪問査定済': 33, '査定書提出': 35,
        '反響受信': 2, '追客中': 8, '内見予約': 26, '内見済': 32, '購入申込': 35,
    } as Record<string, number>,
    capRecency: 15, capActivity: 20, capReason: 20, capPrice: 10,
    recency: [[7, 15], [14, 11], [30, 7], [60, 3]] as [number, number][],
    connected: 10, perAct: 2, recent7: 6,
    price: [[50000000, 10], [30000000, 7], [15000000, 4]] as [number, number][],
    overduePerDay: 1, overdueMax: 15, noNext: 8,
    stale: { leads: [7, 14, 21], buyLeads: [5, 10, 14], deals: [5, 10, 14] } as Record<Kind, number[]>,
    hot: 70, warm: 45,
};
const REASON: [string, number][] = [['相続', 12], ['遺産', 12], ['空き家', 8], ['空家', 8], ['転勤', 12], ['転居', 8], ['住替', 10], ['住み替', 10],
    ['買替', 10], ['離婚', 12], ['財産分与', 12], ['資金', 8], ['現金化', 12], ['ローン返済', 10], ['任意売却', 14],
    ['施設', 8], ['介護', 8], ['急ぎ', 14], ['至急', 14], ['早期', 12], ['今すぐ', 14], ['年内', 10], ['3か月', 10], ['半年', 6],
    ['査定書', 6], ['価格更新', 6], ['価格改定', 6], ['買取', 8], ['他社', -6], ['検討中', -4], ['未定', -6], ['様子見', -8]];
const CLOSED = ['追客終了', '媒介受託', '成約', '失注', '決済完了'];
const KINDLBL: Record<Kind, { icon: string; label: string }> = {
    leads: { icon: 'fa-envelope', label: '売り反響' },
    buyLeads: { icon: 'fa-house', label: '買い反響' },
    deals: { icon: 'fa-tag', label: '商談案件' },
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 日数の差 a − b（diffDays） */
const diffDays = (a: string, b: string): number =>
    Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000);

/** 'YYYY/M/D'（fmtD） */
const fmtD = (ds: string): string => {
    if (!ds) return '―';
    const [y, m, d] = ds.slice(0, 10).split('-');
    if (!d) return ds;
    return `${y}/${Number(m)}/${Number(d)}`;
};

// ---------------------------------------------------------------------------
// 計算（V12 の local と、その下の pick / lastTouch / score / staleOf / taskState / todayRows）
// ---------------------------------------------------------------------------

export type CcRow = {
    id: string; kind: Kind; staff: string; phase: string;
    counterpart: string; subject: string;
    next_date: string; next_note: string; received_date: string; connect_date: string; last_touch: string;
    visit_date: string; view_date: string; act_total: number; amount: number | null; reason_src: string; is_closed: boolean;
    hot_score: number; hot_label: string; hot_breakdown: Record<string, number>;
    stale_rank: number; stale_label: string; days_stale: number; task_state: string; days_overdue: number; due_date?: string;
};

/** 最後に架電（LINE・メールを含む）した日（lastTouch） */
const lastTouch = (r: Row): string => {
    const a = callsOf(r)
        .map(c => str(c !== null && typeof c === 'object' ? (c.date || c) : c).slice(0, 10))
        .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
    return a.length ? a.sort()[a.length - 1] : '';
};

/** 1行を共通の形にする（pick） */
const pick = (kind: Kind, r: Row) => {
    const isBuy = kind === 'buyLeads';
    const isDeal = kind === 'deals';
    return {
        id: str(r.id), kind, staff: str(r.staff), phase: str(r.phase),
        counterpart: str(isDeal ? r.customer : r.name) || '（顧客名なし）',
        subject: str(isDeal ? r.property : isBuy ? r.targetProperty : r.addr),
        next_date: str(r.nextDate), next_note: str(r.nextNote),
        received_date: str(r.receivedDate) || str(r.contactDate),
        connect_date: str(r.connectDate), last_touch: lastTouch(r),
        visit_date: str(r.visitDate), view_date: str(r.viewDate),
        act_total: callsOf(r).length,
        amount: Number(isBuy ? r.budget : r.price) || null,
        reason_src: [r.reason, r.timing, r.note, r.nextNote, r.targetProperty].filter(Boolean).map(str).join(' '),
        is_closed: CLOSED.includes(str(r.phase)),
    };
};
type Picked = ReturnType<typeof pick>;

/** ホット度（score） */
const score = (o: Picked, t: string) => {
    if (o.is_closed) return { hot: 0, label: '対象外', bd: {} as Record<string, number> };
    const ptPhase = P.phase[o.phase] || 0;
    let ptRec = 0;
    if (o.received_date) {
        const dl = diffDays(t, o.received_date);
        for (const p of P.recency) { if (dl <= p[0]) { ptRec = p[1]; break; } }
    }
    let ptAct = (o.connect_date ? P.connected : 0) + o.act_total * P.perAct
        + ((o.last_touch && diffDays(t, o.last_touch) <= 7) ? P.recent7 : 0);
    ptAct = Math.min(P.capActivity, ptAct);
    let ptRea = 0;
    for (const p of REASON) if (o.reason_src.indexOf(p[0]) >= 0) ptRea += p[1];
    ptRea = Math.max(0, Math.min(P.capReason, ptRea));
    let ptPri = 0;
    if (o.amount) { ptPri = 1; for (const p of P.price) { if (o.amount >= p[0]) { ptPri = p[1]; break; } } }
    const od = o.next_date ? Math.max(0, diffDays(t, o.next_date)) : 0;
    const pen = (o.next_date ? 0 : P.noNext) + Math.min(P.overdueMax, od * P.overduePerDay);
    const raw = ptPhase + ptRec + ptAct + ptRea + ptPri - pen;
    return {
        hot: Math.max(0, Math.min(100, Math.round(raw))),
        label: raw >= P.hot ? 'ホット' : raw >= P.warm ? 'ウォーム' : 'コールド',
        bd: { phase: ptPhase, recency: ptRec, activity: ptAct, reason: ptRea, price: ptPri, penalty: pen },
    };
};

/** 停滞（staleOf）。起点は最後の架電、無ければ受信日 */
const staleOf = (o: Picked, t: string) => {
    if (o.is_closed) return { rank: 0, label: '対象外', days: 0 };
    const base = o.last_touch || o.received_date;
    if (!base) return { rank: 0, label: '判定不可', days: 0 };
    const d = diffDays(t, base);
    const th = P.stale[o.kind] || P.stale.leads;
    return {
        rank: d >= th[2] ? 3 : d >= th[1] ? 2 : d >= th[0] ? 1 : 0,
        label: d >= th[2] ? '危険' : d >= th[1] ? '警告' : d >= th[0] ? '注意' : '正常', days: d,
    };
};

/** 次回アクションの状態（taskState） */
const taskState = (o: Picked, t: string): string => {
    if (o.is_closed) return '対象外';
    if (!o.next_date) return '未設定';
    return o.next_date < t ? '期日超過' : o.next_date === t ? '本日' : (diffDays(o.next_date, t) <= 7 ? '今週' : '予定');
};

/** 今日やること（todayRows）。次回アクション期日＋訪問査定日／内見日 */
const todayRows = (en: CcRow[], t: string): CcRow[] => {
    const rows: CcRow[] = en.filter(x => !x.is_closed && x.next_date && x.next_date <= t).map(x => ({ ...x, due_date: x.next_date }));
    const seen = new Set(rows.map(x => `${x.kind}:${x.id}`));
    for (const x of en) {
        if (x.is_closed || seen.has(`${x.kind}:${x.id}`)) continue;
        const d = x.kind === 'leads' ? x.visit_date : x.kind === 'buyLeads' ? x.view_date : '';
        if (!d || d > t) continue;
        rows.push({ ...x, due_date: d, next_note: x.next_note || (x.kind === 'leads' ? '訪問査定日' : '内見日'), days_overdue: Math.max(0, diffDays(t, d)) });
    }
    return rows.sort((a, b) => b.days_overdue - a.days_overdue || b.hot_score - a.hot_score).slice(0, 40);
};

const norm = (s: string) => s.replace(/[\s　]/g, '');

/** 全体の集計（local） */
export const buildCommandCenter = (src: Record<Kind, Row[]>, me: string, mine: boolean, t: string = todayStr()) => {
    const rows: Picked[] = [];
    for (const kind of ['leads', 'buyLeads', 'deals'] as Kind[]) for (const r of src[kind] || []) rows.push(pick(kind, r));
    const target = (mine && me) ? rows.filter(x => norm(x.staff) === norm(me)) : rows;
    const en: CcRow[] = target.map(o => {
        const s = score(o, t);
        const st = staleOf(o, t);
        return {
            ...o, hot_score: s.hot, hot_label: s.label, hot_breakdown: s.bd,
            stale_rank: st.rank, stale_label: st.label, days_stale: st.days, task_state: taskState(o, t),
            days_overdue: o.next_date ? Math.max(0, diffDays(t, o.next_date)) : 0,
        };
    });
    const open = en.filter(x => !x.is_closed);
    return {
        summary: {
            active: open.length,
            today: en.filter(x => x.task_state === '本日').length,
            overdue: en.filter(x => x.task_state === '期日超過').length,
            no_next: en.filter(x => x.task_state === '未設定').length,
            stale: open.filter(x => x.stale_rank >= 2).length,
            hot: open.filter(x => x.hot_label === 'ホット').length,
            warm: open.filter(x => x.hot_label === 'ウォーム').length,
        },
        today: todayRows(en, t),
        hot: open.filter(x => x.hot_score >= P.warm).sort((a, b) => b.hot_score - a.hot_score).slice(0, 40),
        stale: open.filter(x => x.stale_rank >= 2).sort((a, b) => b.days_stale - a.days_stale).slice(0, 40),
    };
};

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

const STYLE = `
.rlt-cc { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.rlt-cc-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; }
.rlt-cc-title { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; cursor: pointer; user-select: none; }
.rlt-cc-title i { color: #0d6efd; }
.rlt-cc-caret { display: inline-block; width: 14px; color: #6c757d; }
.rlt-cc-mini { font-size: 11px; color: #495057; }
.rlt-cc-mini b.r { color: #dc3545; }
.rlt-cc-note { font-size: 10px; color: #6c757d; }
.rlt-cc-sp { flex: 1; }
.rlt-cc-body { padding: 0 14px 14px; }
.rlt-cc-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
.rlt-cc-kpi { border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; border: 1px solid; }
.rlt-cc-kpi b { font-size: 20px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.rlt-cc-kpi span { font-size: 10px; }
.rlt-cc-kpi.red { background: #fdf2f2; border-color: #f5c2c7; color: #b02a37; }
.rlt-cc-kpi.amber { background: #fff8e6; border-color: #ffe08a; color: #8a6100; }
.rlt-cc-kpi.navy { background: #eef3fb; border-color: #c5d5ee; color: #22405c; }
.rlt-cc-kpi.gray { background: #f8f9fa; border-color: #dee2e6; color: #495057; }
.rlt-cc-tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.rlt-cc-tab { font-size: 11px; font-weight: bold; border: 1px solid #ced4da; background: #fff; color: #495057; border-radius: 16px; padding: 3px 12px; cursor: pointer; }
.rlt-cc-tab.on { background: #0d6efd; border-color: #0d6efd; color: #fff; }
.rlt-cc-badge { display: inline-block; border-radius: 10px; padding: 0 6px; font-size: 10px; font-weight: bold; color: #fff; }
.rlt-cc-badge.red { background: #dc3545; }
.rlt-cc-badge.amber { background: #e0a800; }
.rlt-cc-badge.navy { background: #22405c; }
.rlt-cc-badge.green { background: #198754; }
.rlt-cc-badge.gray { background: #adb5bd; }
.rlt-cc-wrap { overflow-x: auto; }
.rlt-cc-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.rlt-cc-tbl th { background: #f8f9fa; color: #495057; font-weight: bold; padding: 6px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; text-align: left; }
.rlt-cc-tbl td { padding: 4px 8px; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
.rlt-cc-tbl .c { text-align: center; }
.rlt-cc-tbl .r { text-align: right; font-variant-numeric: tabular-nums; }
.rlt-cc-tbl tr.late td { background: #fff5f5; }
.rlt-cc-tbl .sub { font-size: 10px; color: #6c757d; }
.rlt-cc-tbl .trunc { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rlt-cc-tbl td.empty { text-align: center; color: #6c757d; padding: 12px; }
.rlt-cc-btn { font-size: 11px; border: 1px solid #0d6efd; color: #0d6efd; background: #fff; border-radius: 4px; padding: 1px 10px; cursor: pointer; }
.rlt-cc-btn:hover { background: #0d6efd; color: #fff; }
`;

const OPEN_KEY = 'kh_v12_open';

const CommandCenter: React.FC<Props> = ({ leads, buyLeads, deals, me = '', onOpen, today }) => {
    // ⚠️ 以前のアプリと同じく既定は折りたたみ。開いたかどうかはこの端末に覚える（kh_v12_open）
    const [open, setOpen] = useState<boolean>(() => {
        try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
    });
    const [mine, setMine] = useState(true);
    const [tab, setTab] = useState<'today' | 'hot' | 'stale'>('today');
    const [generatedAt, setGeneratedAt] = useState(() => new Date());

    const data = useMemo(
        () => buildCommandCenter({ leads, buyLeads, deals }, me, mine, today ?? todayStr()),
        // ⚠️ generatedAt は「↻ 再集計」で計算し直すため
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [leads, buyLeads, deals, me, mine, today, generatedAt]
    );
    const s = data.summary;

    const fold = () => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* 保存できなくても表示は切り替える */ }
    };
    const stamp = `${String(generatedAt.getHours()).padStart(2, '0')}:${String(generatedAt.getMinutes()).padStart(2, '0')}`;

    const hotBadge = (v: number, bd?: Record<string, number>) => (
        <span className={`rlt-cc-badge ${v >= P.hot ? 'red' : v >= P.warm ? 'amber' : 'gray'}`}
            title={bd ? `フェーズ${bd.phase || 0}／鮮度${bd.recency || 0}／接触${bd.activity || 0}／動機${bd.reason || 0}／価格${bd.price || 0}／減点-${bd.penalty || 0}` : undefined}>
            {v}
        </span>
    );
    const who = (x: CcRow) => (
        <>
            <td className="sub" style={{ whiteSpace: 'nowrap' }}><i className={`fa-solid ${KINDLBL[x.kind].icon} me-1`}></i>{KINDLBL[x.kind].label}</td>
            <td className="trunc" title={x.counterpart}><b>{x.counterpart}</b><div className="sub">{x.subject}</div></td>
            <td>{x.staff ? x.staff : <span className="rlt-cc-badge red">未割当</span>}</td>
        </>
    );
    const openBtn = (x: CcRow) => <button type="button" className="rlt-cc-btn" onClick={() => onOpen?.(x.kind, x.id)}>開く</button>;

    if (!open) {
        return (
            <div className="rlt-cc">
                <style>{STYLE}</style>
                <div className="rlt-cc-head">
                    <h3 className="rlt-cc-title" onClick={fold}><span className="rlt-cc-caret">▶</span><i className="fa-solid fa-bullseye me-1"></i>営業司令塔</h3>
                    <span className="rlt-cc-mini">
                        期日超過 <b className={s.overdue ? 'r' : ''}>{s.overdue}</b>／本日 <b>{s.today}</b>／次回未設定 <b className={s.no_next ? 'r' : ''}>{s.no_next}</b>／停滞 <b>{s.stale}</b>／ホット <b>{s.hot}</b>／追客中 <b>{s.active}</b>
                    </span>
                    <span className="rlt-cc-sp"></span>
                    <span className="rlt-cc-note" style={{ cursor: 'pointer' }} onClick={fold}>クリックで展開</span>
                </div>
            </div>
        );
    }

    const kpi = (n: number, lbl: string, cls: string) => <div className={`rlt-cc-kpi ${cls}`}><b>{n || 0}</b><span>{lbl}</span></div>;

    return (
        <div className="rlt-cc">
            <style>{STYLE}</style>
            <div className="rlt-cc-head">
                <h3 className="rlt-cc-title" onClick={fold}><span className="rlt-cc-caret">▼</span><i className="fa-solid fa-bullseye me-1"></i>営業司令塔</h3>
                <span className="rlt-cc-note">次回アクション・停滞・ホット度を一括算出（{stamp} 時点）</span>
                <span className="rlt-cc-sp"></span>
                <label className="rlt-cc-note" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> 自分の担当のみ{me ? `（${me}）` : ''}
                </label>
                <button type="button" className="rlt-cc-btn" onClick={() => setGeneratedAt(new Date())}>↻ 再集計</button>
            </div>
            <div className="rlt-cc-body">
                <div className="rlt-cc-kpis">
                    {kpi(s.overdue, '期日超過', 'red')}{kpi(s.today, '本日', 'amber')}
                    {kpi(s.no_next, '次回未設定', 'red')}{kpi(s.stale, '停滞', 'amber')}
                    {kpi(s.hot, 'ホット', 'navy')}{kpi(s.active, '追客中 合計', 'gray')}
                </div>
                <div className="rlt-cc-tabs">
                    <button type="button" className={`rlt-cc-tab ${tab === 'today' ? 'on' : ''}`} onClick={() => setTab('today')}>
                        ⏰ 今日やること <span className={`rlt-cc-badge ${data.today.length ? 'red' : 'green'}`}>{data.today.length}</span>
                    </button>
                    <button type="button" className={`rlt-cc-tab ${tab === 'hot' ? 'on' : ''}`} onClick={() => setTab('hot')}>
                        🔥 ホットな反響 <span className="rlt-cc-badge navy">{data.hot.length}</span>
                    </button>
                    <button type="button" className={`rlt-cc-tab ${tab === 'stale' ? 'on' : ''}`} onClick={() => setTab('stale')}>
                        🚨 停滞アラート <span className={`rlt-cc-badge ${data.stale.length ? 'amber' : 'green'}`}>{data.stale.length}</span>
                    </button>
                </div>

                <div className="rlt-cc-wrap">
                    {tab === 'today' && (
                        <table className="rlt-cc-tbl">
                            <thead><tr><th>区分</th><th>相手先</th><th>担当</th><th>予定日</th><th>次回アクション</th><th className="c">状態</th><th className="c">熱</th><th></th></tr></thead>
                            <tbody>
                                {data.today.map(x => {
                                    const od = x.days_overdue || 0;
                                    return (
                                        <tr key={`${x.kind}:${x.id}`} className={od > 0 ? 'late' : ''}>
                                            {who(x)}
                                            <td>{fmtD(x.due_date || x.next_date)}</td>
                                            <td className="trunc" title={x.next_note}>{x.next_note ? x.next_note : <span className="rlt-cc-badge red">内容未記入</span>}</td>
                                            <td className="c">{od > 0 ? <span className="rlt-cc-badge red">{od}日超過</span> : <span className="rlt-cc-badge navy">本日</span>}</td>
                                            <td className="c">{hotBadge(x.hot_score || 0, x.hot_breakdown)}</td>
                                            <td>{openBtn(x)}</td>
                                        </tr>
                                    );
                                })}
                                {data.today.length === 0 && <tr><td colSpan={8} className="empty">本日ぶん・期日超過ぶんの次回アクションはありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                    {tab === 'hot' && (
                        <table className="rlt-cc-tbl">
                            <thead><tr><th>区分</th><th>相手先</th><th>担当</th><th>フェーズ</th><th className="r">想定額</th><th className="c">ホット度</th><th>次回</th><th className="c">停滞</th><th></th></tr></thead>
                            <tbody>
                                {data.hot.map(x => (
                                    <tr key={`${x.kind}:${x.id}`}>
                                        {who(x)}
                                        <td className="sub">{x.phase}</td>
                                        <td className="r">{x.amount ? fmtYen(x.amount) : '―'}</td>
                                        <td className="c">{hotBadge(x.hot_score || 0, x.hot_breakdown)} <span className="sub">{x.hot_label}</span></td>
                                        <td className="sub">{x.next_date ? fmtD(x.next_date) : <span className="rlt-cc-badge red">未設定</span>}</td>
                                        <td className="c">{(x.days_stale || 0) > 0 ? `${x.days_stale}日` : '―'}</td>
                                        <td>{openBtn(x)}</td>
                                    </tr>
                                ))}
                                {data.hot.length === 0 && <tr><td colSpan={9} className="empty">{P.warm}点以上の反響はありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                    {tab === 'stale' && (
                        <table className="rlt-cc-tbl">
                            <thead><tr><th>区分</th><th>相手先</th><th>担当</th><th>フェーズ</th><th>最終対応</th><th className="c">経過</th><th className="c">判定</th><th className="c">熱</th><th></th></tr></thead>
                            <tbody>
                                {data.stale.map(x => (
                                    <tr key={`${x.kind}:${x.id}`} className={x.stale_rank >= 3 ? 'late' : ''}>
                                        {who(x)}
                                        <td className="sub">{x.phase}</td>
                                        <td>{x.last_touch ? fmtD(x.last_touch) : <span className="rlt-cc-badge red">記録なし</span>}</td>
                                        <td className="c">{x.days_stale}日</td>
                                        <td className="c"><span className={`rlt-cc-badge ${x.stale_rank >= 3 ? 'red' : 'amber'}`}>{x.stale_label}</span></td>
                                        <td className="c">{hotBadge(x.hot_score || 0)}</td>
                                        <td>{openBtn(x)}</td>
                                    </tr>
                                ))}
                                {data.stale.length === 0 && <tr><td colSpan={9} className="empty">停滞している案件はありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandCenter;
