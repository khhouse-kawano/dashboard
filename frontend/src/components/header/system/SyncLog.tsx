import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';

/**
 * ポータル連携ログ（v2.2.259 新規。v2.2.266 で「同期の実行結果」から改名）。ヘッダーの「システム管理 → ポータル連携ログ」（⚠️ Master だけ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② sync_log_list（backend-express/src/features/syncLog.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   書くのは sync（Heroku。projects/sync の utils/syncLog.ts）。以前は失敗だけをメールで送っていた（やめた）。
 *
 * ⚠️ 「タスクごとの最新」と「最後の成功」は期間に関係なく、残っている180日分から出す（止まっているタスクに気づくため）。
 * ⚠️ KPI と履歴は期間・タスク・状態の絞り込みで出す（新しい順に ② の上限まで）。
 * ⚠️ 見た目は GoogleReview.tsx・SecurityLog.tsx に合わせている（接頭辞 sy_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

type SyncStatus = 'success' | 'partial' | 'failure';

interface LogRow {
    id: number;
    run_id: string;
    route: string;
    task: string;
    status: SyncStatus;
    message: string | null;
    errors: string | null;
    started_at: string;
    finished_at: string;
    duration_ms: number;
}

interface LatestRow {
    task: string;
    status: SyncStatus;
    message: string | null;
    errors: string | null;
    route: string;
    started_at: string;
    duration_ms: number;
    last_success: string | null;
    failures_7d: number;
}

interface ListResponse {
    status: string;
    from: string;
    to: string;
    rows: LogRow[];
    latest: LatestRow[];
    tasks: string[];
    limit: number;
}

const STATUS: Record<SyncStatus, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
    success: { label: '成功', tone: 'ok' },
    partial: { label: '一部失敗', tone: 'warn' },
    failure: { label: '失敗', tone: 'bad' },
};

/** タスクの説明（⚠️ 名前は sync の portalService.ts の actionMap・入口のパス。無いものは名前のまま） */
const TASK_LABEL: Record<string, string> = {
    property: 'いえらぶの物件（中古）',
    suumo_kaeru: 'SUUMO 反響（建売）',
    suumo_resale: 'SUUMO 反響（中古）',
    suumo_order: 'SUUMO 反響（注文）',
    homes_kaeru: "HOME'S 反響（建売）",
    homes_resale: "HOME'S 反響（中古）",
    homes_order: "HOME'S 反響（注文）",
    athome: 'アットホーム 反響',
    member_kaeru: '会員登録（建売）',
    member_resale: '会員登録（中古）',
    reserve_kaeru: '来場予約（建売）',
    reserve_resale: '来場予約（中古）',
    catalog_kaeru: '資料請求（建売）',
    catalog_resale: '資料請求（中古）',
    pre_kaeru: '事前登録（建売）',
    sumai_step_resale: 'すまいステップ（中古）',
    iei_resale: 'イエイ（中古）',
    ieuru_resale: 'イエウール（中古）',
    townlife_order: 'タウンライフ（注文）',
    suumo_summary: 'SUUMO 集計（建売）',
    suumo_summary_2: 'SUUMO 集計（中古）',
    athome_summary: 'アットホーム 集計（建売）',
    athome_summary_2: 'アットホーム 集計（中古）',
    homes_summary: "HOME'S 集計（建売）",
    homes_summary_2: "HOME'S 集計（中古）",
    hotlead: 'Hotlead（KH）',
    hotlead_2: 'Hotlead（DJH）',
    allgrit: 'ALLGRIT（LINE）',
    pg_mail: 'PG メール',
    kaeeru: 'かえーる',
    geoCode: '住所の緯度経度',
    google_review: 'Google クチコミ',
};
const labelOf = (task: string): string => TASK_LABEL[task] ?? task;

/** 最後の成功からこれ以上たつと「止まっている」とみなす */
const STALE_HOURS = 24;

/** 'YYYY-MM-DD HH:MM:SS'（日本時間）からの経過時間（時間）。⚠️ 画面を開いている PC の時計と比べる */
const hoursSince = (at: string | null): number | null => {
    if (!at) return null;
    const ms = Date.parse(at.replace(' ', 'T'));
    return Number.isFinite(ms) ? (Date.now() - ms) / 3600_000 : null;
};
const agoText = (at: string | null): string => {
    const h = hoursSince(at);
    if (h === null) return '';
    if (h < 1) return `${Math.max(0, Math.round(h * 60))}分前`;
    if (h < 48) return `${Math.floor(h)}時間前`;
    return `${Math.floor(h / 24)}日前`;
};
const durationText = (ms: number): string => (ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}秒` : `${Math.floor(ms / 60_000)}分${Math.round((ms % 60_000) / 1000)}秒`);
const errorsOf = (raw: string | null): string[] => {
    if (!raw) return [];
    try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : [String(raw)]; } catch { return [raw]; }
};

/** 止まっているタスク（最後の成功が無い・STALE_HOURS 以上前） */
const isStale = (l: LatestRow): boolean => {
    const h = hoursSince(l.last_success);
    return h === null || h >= STALE_HOURS;
};

type SortKey = 'started_at' | 'task' | 'status' | 'duration_ms' | 'route';

const SyncLog = () => {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [task, setTask] = useState('');
    const [status, setStatus] = useState('');
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('started_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [open, setOpen] = useState<number | null>(null);

    /** ⚠️ 期間・タスク・状態は ② で絞る（新しい順に上限まで返るため、画面で絞ると古い行が抜ける） */
    const load = useCallback(async (filter: { from: string; to: string; task: string; status: string }) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'sync_log_list', ...filter });
            const body = res.data as ListResponse;
            if (body?.status !== 'success') throw new Error('unexpected response');
            setData(body);
            setFrom(body.from);
            setTo(body.to);
        } catch (e) {
            console.error('ポータル連携ログの取得に失敗しました:', e);
            setError('ポータル連携ログを読み込めませんでした。時間をおいて「表示」を押してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    // ⚠️ 開いたときは期間を ② に任せる（直近7日）
    useEffect(() => { void load({ from: '', to: '', task: '', status: '' }); }, [load]);

    const apply = (next: Partial<{ task: string; status: string }> = {}) =>
        void load({ from, to, task: next.task ?? task, status: next.status ?? status });

    const rows = useMemo(() => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...(data?.rows ?? [])].sort((a, b) => {
            const av = a[sortKey] ?? '';
            const bv = b[sortKey] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, sortKey, sortOrder]);

    const counts = useMemo(() => {
        const c: Record<SyncStatus, number> = { success: 0, partial: 0, failure: 0 };
        for (const r of data?.rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
        return c;
    }, [data]);

    const latest = useMemo(() => [...(data?.latest ?? [])].sort((a, b) =>
        Number(isStale(b)) - Number(isStale(a)) || labelOf(a.task).localeCompare(labelOf(b.task), 'ja')), [data]);
    const staleCount = latest.filter(isStale).length;

    const th = (label: string, key: SortKey, width?: number) => {
        const active = sortKey === key;
        return (
            <th className="sy_th sy_th_sort" style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'started_at' || key === 'duration_ms' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`sy_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, value: number, tone?: 'bad' | 'warn') => (
        <div className="sy_kpi_card">
            <div className="sy_kpi_label">{label}</div>
            <div className={`sy_kpi_value${tone && value > 0 ? ` is_${tone}` : ''}`}>{value.toLocaleString()}</div>
        </div>
    );

    const pill = (s: SyncStatus) => {
        const st = STATUS[s] ?? { label: s, tone: 'warn' as const };
        return <span className={`sy_pill is_${st.tone}`}>{st.label}</span>;
    };

    const pickTask = (t: string) => { setTask(t); apply({ task: t }); };

    return (
        <div className="sy_wrap">
            <style>{`
                .sy_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; overflow: auto; }
                .sy_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
                .sy_note { font-size: 11px; color: #6b7280; }
                .sy_h { font-size: 13px; font-weight: 700; color: #374151; margin: 4px 0 0; }
                .sy_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .sy_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sy_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .sy_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sy_kpi_label { font-size: 11px; color: #6b7280; }
                .sy_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sy_kpi_value.is_bad { color: #b91c1c; }
                .sy_kpi_value.is_warn { color: #b45309; }
                .sy_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .sy_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; }
                .sy_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
                .sy_table_wrap.is_history { max-height: calc(100vh - 260px); min-height: 240px; }
                .sy_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sy_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .sy_th_sort { cursor: pointer; user-select: none; }
                .sy_th_sort:hover { background: #eef2f7; }
                .sy_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sy_sort_icon.is_active { color: #2563eb; }
                .sy_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .sy_row:hover > .sy_td { background: #f8fafc; }
                .sy_row.is_stale > .sy_td:first-child { box-shadow: inset 3px 0 0 #dc2626; }
                .sy_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .sy_num { white-space: nowrap; font-variant-numeric: tabular-nums; text-align: right; }
                .sy_sub { font-size: 11px; color: #9ca3af; }
                .sy_stale { color: #b91c1c; font-weight: 700; }
                .sy_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .sy_pill.is_ok { background: #dcfce7; color: #166534; }
                .sy_pill.is_warn { background: #fef3c7; color: #92400e; }
                .sy_pill.is_bad { background: #fee2e2; color: #991b1b; }
                .sy_link { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font: inherit; text-align: left; }
                .sy_link:hover { text-decoration: underline; }
                .sy_msg { min-width: 200px; overflow-wrap: anywhere; }
                .sy_errs { margin: 6px 0 0; padding: 8px 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
                           font-size: 11.5px; color: #7f1d1d; white-space: pre-wrap; overflow-wrap: anywhere; list-style: none; }
                .sy_errs li + li { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #fecaca; }
                .sy_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .sy_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sy_inner">
                <div className="sy_note">
                    ポータルの反響・集計などの自動取り込み（Heroku の sync）の実行結果です。成功も失敗も1回ずつ残り、失敗は理由まで出します（180日分）。管理者だけが見られます。
                </div>

                <div className="sy_bar">
                    <div>
                        <div className="sy_label">期間（履歴）</div>
                        <div className="d-flex align-items-center gap-1">
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={from}
                                onChange={(e) => setFrom(e.target.value)} aria-label="期間の始め" />
                            <span className="sy_note">〜</span>
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={to}
                                onChange={(e) => setTo(e.target.value)} aria-label="期間の終わり" />
                        </div>
                    </div>
                    <div>
                        <div className="sy_label">タスク</div>
                        <select className="form-select form-select-sm" style={{ width: 220 }} value={task}
                            onChange={(e) => pickTask(e.target.value)} aria-label="タスク">
                            <option value="">すべて</option>
                            {(data?.tasks ?? []).map((t) => <option key={t} value={t}>{labelOf(t)}{TASK_LABEL[t] ? `（${t}）` : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="sy_label">状態</div>
                        <select className="form-select form-select-sm" style={{ width: 120 }} value={status}
                            onChange={(e) => { setStatus(e.target.value); apply({ status: e.target.value }); }} aria-label="状態">
                            <option value="">すべて</option>
                            {(Object.keys(STATUS) as SyncStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                        </select>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply()} disabled={loading}>
                        {loading ? '読み込み中…' : '表示'}
                    </button>
                </div>

                {error !== '' && <div className="sy_error" role="alert">{error}</div>}

                {data && (
                    <>
                        <div className="sy_kpi">
                            {kpi('実行（期間）', data.rows.length)}
                            {kpi('成功', counts.success)}
                            {kpi('一部失敗', counts.partial, 'warn')}
                            {kpi('失敗', counts.failure, 'bad')}
                            {kpi(`${STALE_HOURS}時間以上成功していないタスク`, staleCount, 'bad')}
                        </div>

                        <div className="sy_h">タスクごとの最新</div>
                        <div className="sy_table_wrap">
                            <table className="sy_table">
                                <thead>
                                    <tr>
                                        <th className="sy_th" style={{ width: 220 }}>タスク</th>
                                        <th className="sy_th" style={{ width: 90 }}>最新</th>
                                        <th className="sy_th" style={{ width: 170 }}>最後の実行</th>
                                        <th className="sy_th" style={{ width: 170 }}>最後の成功</th>
                                        <th className="sy_th" style={{ width: 90 }}>7日の失敗</th>
                                        <th className="sy_th">内容</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {latest.length === 0 && (
                                        <tr><td className="sy_td sy_empty" colSpan={6}>まだ実行結果がありません</td></tr>
                                    )}
                                    {latest.map((l) => {
                                        const stale = isStale(l);
                                        return (
                                            <tr key={l.task} className={`sy_row${stale ? ' is_stale' : ''}`}>
                                                <td className="sy_td">
                                                    <button type="button" className="sy_link" title="このタスクの履歴だけを出す" onClick={() => pickTask(l.task)}>{labelOf(l.task)}</button>
                                                    {TASK_LABEL[l.task] && <div className="sy_sub">{l.task}</div>}
                                                </td>
                                                <td className="sy_td">{pill(l.status)}</td>
                                                <td className="sy_td sy_time">{l.started_at}<div className="sy_sub">{agoText(l.started_at)}</div></td>
                                                <td className={`sy_td sy_time${stale ? ' sy_stale' : ''}`}>
                                                    {l.last_success ?? '記録なし'}
                                                    {l.last_success && <div className={stale ? '' : 'sy_sub'}>{agoText(l.last_success)}</div>}
                                                </td>
                                                <td className="sy_td sy_num">{l.failures_7d > 0 ? <span className="sy_stale">{l.failures_7d}</span> : 0}</td>
                                                <td className="sy_td sy_msg">
                                                    {l.message}
                                                    {errorsOf(l.errors).length > 0 && <div className="sy_sub">理由 {errorsOf(l.errors).length}件（下の履歴で開けます）</div>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="sy_caution">
                            「最後の成功」が{STALE_HOURS}時間以上前・記録なしのタスクは赤で出し、上に並べます。一部失敗は、最後まで動いたが途中で失敗があったもの（例：3店舗のうち1店舗が取れない）です。
                            {data.rows.length >= data.limit && <><br />⚠️ 新しい順に {data.limit.toLocaleString()} 行までを出しています。期間を短くするか、タスク・状態で絞ってください。</>}
                        </div>

                        <div className="sy_h">履歴</div>
                        <div className="sy_table_wrap is_history">
                            <table className="sy_table">
                                <thead>
                                    <tr>
                                        {th('開始', 'started_at', 160)}
                                        {th('タスク', 'task', 220)}
                                        {th('状態', 'status', 90)}
                                        {th('時間', 'duration_ms', 80)}
                                        {th('入口', 'route', 140)}
                                        <th className="sy_th">内容・理由</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr><td className="sy_td sy_empty" colSpan={6}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
                                    )}
                                    {rows.map((r) => {
                                        const errs = errorsOf(r.errors);
                                        return (
                                            <tr key={r.id} className="sy_row">
                                                <td className="sy_td sy_time">{r.started_at}</td>
                                                <td className="sy_td">{labelOf(r.task)}{TASK_LABEL[r.task] && <div className="sy_sub">{r.task}</div>}</td>
                                                <td className="sy_td">{pill(r.status)}</td>
                                                <td className="sy_td sy_num">{durationText(r.duration_ms)}</td>
                                                <td className="sy_td sy_sub">{r.route}</td>
                                                <td className="sy_td sy_msg">
                                                    {r.message}
                                                    {errs.length > 0 && (
                                                        <div>
                                                            <button type="button" className="sy_link" onClick={() => setOpen(open === r.id ? null : r.id)}>
                                                                {open === r.id ? '理由を閉じる' : `理由を見る（${errs.length}件）`}
                                                            </button>
                                                            {open === r.id && <ul className="sy_errs">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SyncLog;
