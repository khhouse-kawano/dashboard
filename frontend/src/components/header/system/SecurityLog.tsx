import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';

/**
 * セキュリティログ（v2.2.242 新規）。ヘッダーの「システム管理 → セキュリティログ」（⚠️ Master だけ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② security_log_list（backend-express/src/features/securityLog.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   書くのは ①（backend/src/core/security_log.php）と ②（recordSecurityEvent）。
 *
 * ⚠️ 記録しているのは、ログイン・ログアウトと、失敗・エラーだけ（⚠️ 正常なアクセスは残していない）。
 * ⚠️ 失敗の連打は「同じ種類・IP・処理・人・1分」で1行にまとめ、件数（×N）で出す。
 * ⚠️ KPI と「要注意の IP」は期間だけで数える（⚠️ 種類・IP・キーワードの絞り込みに左右されない）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせている（接頭辞 sl_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

type EventKey = 'login' | 'login_failed' | 'logout' | 'auth_failed' | 'forbidden' | 'bad_request' | 'unknown_request' | 'server_error' | 'proxy_error';

interface LogRow {
    id: number;
    occurredAt: string;
    lastAt: string;
    count: number;
    server: string;
    event: EventKey;
    status: number | null;
    request: string;
    roll: string;
    staffId: number | null;
    staffName: string;
    ip: string;
    viaIp: string;
    userAgent: string;
    path: string;
    message: string;
}

interface Thresholds { failuresPerMinute: number; loginFailuresPer5Min: number; probesPerHour: number }

interface ListResponse {
    status: string;
    from: string;
    to: string;
    totals: Partial<Record<EventKey, number>>;
    ipCount: number;
    flags: Record<string, string[]>;
    thresholds: Thresholds;
    rows: LogRow[];
    truncated: boolean;
    maxRows: number;
}

/** 種類の名前と色（⚠️ 赤＝要確認・黄＝失敗・紫＝探り・緑＝成功・灰＝ログアウト） */
const EVENTS: Record<EventKey, { label: string; tone: 'ok' | 'muted' | 'warn' | 'probe' | 'bad' }> = {
    login: { label: 'ログイン', tone: 'ok' },
    logout: { label: 'ログアウト', tone: 'muted' },
    login_failed: { label: 'ログイン失敗', tone: 'bad' },
    auth_failed: { label: '認証の失敗', tone: 'warn' },
    forbidden: { label: '権限で拒否', tone: 'warn' },
    bad_request: { label: '不正な要求', tone: 'probe' },
    unknown_request: { label: '存在しない処理', tone: 'probe' },
    server_error: { label: 'サーバーエラー', tone: 'bad' },
    proxy_error: { label: '② に届かない', tone: 'bad' },
};
const EVENT_KEYS = Object.keys(EVENTS) as EventKey[];

type SortKey = 'occurredAt' | 'event' | 'count' | 'staffName' | 'ip' | 'request';

const sum = (totals: ListResponse['totals'], keys: EventKey[]): number => keys.reduce((n, k) => n + (totals[k] ?? 0), 0);

const SecurityLog = () => {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [event, setEvent] = useState('');
    const [ip, setIp] = useState('');
    const [q, setQ] = useState('');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('occurredAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    /** ⚠️ 期間・種類・IP・キーワードは ② で絞る（⚠️ 新しい順に上限まで返るため、画面で絞ると古い行が抜ける） */
    const load = useCallback(async (filter: { from: string; to: string; event: string; ip: string; q: string }) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'security_log_list', ...filter });
            const body = res.data as ListResponse;
            if (body?.status !== 'ok') throw new Error('unexpected response');
            setData(body);
            setFrom(body.from);
            setTo(body.to);
        } catch (e) {
            console.error('セキュリティログの取得に失敗しました:', e);
            setError('セキュリティログを読み込めませんでした。時間をおいて「表示」を押してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    // ⚠️ 開いたときは期間を ② に任せる（直近7日。DB の日付）
    useEffect(() => { void load({ from: '', to: '', event: '', ip: '', q: '' }); }, [load]);

    const apply = (next: Partial<{ event: string; ip: string }> = {}) =>
        void load({ from, to, event: next.event ?? event, ip: next.ip ?? ip, q });

    const flags = useMemo(() => data?.flags ?? {}, [data]);

    const rows = useMemo(() => {
        const list = (data?.rows ?? []).filter((r) => !flaggedOnly || flags[r.ip] !== undefined);
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sortKey] ?? '';
            const bv = b[sortKey] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, flaggedOnly, flags, sortKey, sortOrder]);

    const totals = data?.totals ?? {};
    const flaggedIps = Object.keys(flags);

    const th = (label: string, key: SortKey, width?: number) => {
        const active = sortKey === key;
        return (
            <th className="sl_th sl_th_sort" style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'occurredAt' || key === 'count' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`sl_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, value: number, tone?: 'bad' | 'warn') => (
        <div className="sl_kpi_card">
            <div className="sl_kpi_label">{label}</div>
            <div className={`sl_kpi_value${tone && value > 0 ? ` is_${tone}` : ''}`}>{value.toLocaleString()}</div>
        </div>
    );

    return (
        <div className="sl_wrap">
            <style>{`
                .sl_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .sl_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .sl_note { font-size: 11px; color: #6b7280; }
                .sl_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .sl_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sl_check { display: flex; align-items: center; gap: 6px; font-size: 12px; padding-bottom: 6px; cursor: pointer; }
                .sl_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .sl_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sl_kpi_label { font-size: 11px; color: #6b7280; }
                .sl_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sl_kpi_value.is_bad { color: #b91c1c; }
                .sl_kpi_value.is_warn { color: #b45309; }
                .sl_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .sl_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .sl_alerts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
                .sl_alert { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 999px; font-size: 11px;
                            padding: 2px 10px; cursor: pointer; }
                .sl_alert:hover { background: #fee2e2; }
                .sl_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .sl_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sl_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .sl_th_sort { cursor: pointer; user-select: none; }
                .sl_th_sort:hover { background: #eef2f7; }
                .sl_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sl_sort_icon.is_active { color: #2563eb; }
                .sl_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .sl_row:hover > .sl_td { background: #f8fafc; }
                .sl_row.is_flagged > .sl_td:first-child { box-shadow: inset 3px 0 0 #dc2626; }
                .sl_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .sl_sub { font-size: 11px; color: #9ca3af; }
                .sl_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .sl_pill.is_ok { background: #dcfce7; color: #166534; }
                .sl_pill.is_muted { background: #f3f4f6; color: #4b5563; }
                .sl_pill.is_warn { background: #fef3c7; color: #92400e; }
                .sl_pill.is_probe { background: #ede9fe; color: #5b21b6; }
                .sl_pill.is_bad { background: #fee2e2; color: #991b1b; }
                .sl_count { font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; white-space: nowrap; }
                .sl_ip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; white-space: nowrap; }
                .sl_ip_btn { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font: inherit; }
                .sl_ip_btn:hover { text-decoration: underline; }
                .sl_flag { display: inline-block; margin-left: 4px; font-size: 10px; font-weight: 700; color: #fff; background: #dc2626;
                           border-radius: 4px; padding: 0 5px; }
                .sl_ua { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4b5563; }
                .sl_msg { min-width: 160px; overflow-wrap: anywhere; }
                .sl_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .sl_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sl_inner">
                <div className="sl_note">
                    ログイン・ログアウトと、失敗・エラーの記録です（正常な操作は記録していません）。管理者だけが見られます。
                </div>

                <div className="sl_bar">
                    <div>
                        <div className="sl_label">期間</div>
                        <div className="d-flex align-items-center gap-1">
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={from}
                                onChange={(e) => setFrom(e.target.value)} aria-label="期間の始め" />
                            <span className="sl_note">〜</span>
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={to}
                                onChange={(e) => setTo(e.target.value)} aria-label="期間の終わり" />
                        </div>
                    </div>
                    <div>
                        <div className="sl_label">種類</div>
                        <select className="form-select form-select-sm" style={{ width: 150 }} value={event}
                            onChange={(e) => { setEvent(e.target.value); apply({ event: e.target.value }); }} aria-label="種類">
                            <option value="">すべて</option>
                            {EVENT_KEYS.map((k) => <option key={k} value={k}>{EVENTS[k].label}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="sl_label">IP</div>
                        <input className="form-control form-control-sm" style={{ width: 150 }} value={ip} placeholder="例: 203.0.113.5"
                            onChange={(e) => setIp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} aria-label="IP" />
                    </div>
                    <div>
                        <div className="sl_label">キーワード</div>
                        <input className="form-control form-control-sm" style={{ width: 200 }} value={q} placeholder="人・処理・画面・内容"
                            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} aria-label="キーワード" />
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply()} disabled={loading}>
                        {loading ? '読み込み中…' : '表示'}
                    </button>
                    <label className="sl_check">
                        <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
                        要注意の IP だけ
                    </label>
                </div>

                {error !== '' && <div className="sl_error" role="alert">{error}</div>}

                {data && (
                    <>
                        <div className="sl_kpi">
                            {kpi('ログイン', totals.login ?? 0)}
                            {kpi('ログイン失敗', totals.login_failed ?? 0, 'bad')}
                            {kpi('認証の失敗・権限で拒否', sum(totals, ['auth_failed', 'forbidden']), 'warn')}
                            {kpi('不正な要求・存在しない処理', sum(totals, ['bad_request', 'unknown_request']), 'warn')}
                            {kpi('サーバーエラー', sum(totals, ['server_error', 'proxy_error']), 'bad')}
                            {kpi('接続元の IP', data.ipCount)}
                            {kpi('要注意の IP', flaggedIps.length, 'bad')}
                        </div>

                        {flaggedIps.length > 0 && (
                            <div className="sl_alerts">
                                <span className="sl_note">要注意の IP（押すとその IP だけ）:</span>
                                {flaggedIps.map((k) => (
                                    <button type="button" key={k} className="sl_alert" title={flags[k].join(' / ')}
                                        onClick={() => { setIp(k); apply({ ip: k }); }}>
                                        {k}（{flags[k].join('・')}）
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="sl_caution">
                            要注意の目安：同じ IP から 1分に失敗 {data.thresholds.failuresPerMinute} 回以上／5分にログイン失敗 {data.thresholds.loginFailuresPer5Min} 回以上／
                            1時間に存在しない処理 {data.thresholds.probesPerHour} 回以上／User-Agent が空かツールの名前。
                            会社の回線から入ると、社員が同じ IP に見えることがあります。IP の右の小さな文字は、中継したサーバーの IP です。
                            {data.truncated && <><br />⚠️ 新しい順に {data.maxRows.toLocaleString()} 行までを出しています。期間を短くするか、種類・IP で絞ってください。</>}
                        </div>

                        <div className="sl_table_wrap">
                            <table className="sl_table">
                                <thead>
                                    <tr>
                                        {th('日時', 'occurredAt', 150)}
                                        {th('種類', 'event', 120)}
                                        {th('件数', 'count', 60)}
                                        {th('処理', 'request', 160)}
                                        {th('人', 'staffName', 110)}
                                        {th('IP', 'ip', 170)}
                                        <th className="sl_th">画面</th>
                                        <th className="sl_th">User-Agent</th>
                                        <th className="sl_th">内容</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr><td className="sl_td sl_empty" colSpan={9}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
                                    )}
                                    {rows.map((r) => {
                                        const ev = EVENTS[r.event] ?? { label: r.event, tone: 'muted' as const };
                                        const flagged = flags[r.ip] !== undefined;
                                        return (
                                            <tr key={r.id} className={`sl_row${flagged ? ' is_flagged' : ''}`}>
                                                <td className="sl_td sl_time">
                                                    {r.occurredAt}
                                                    {r.count > 1 && r.lastAt !== r.occurredAt && <div className="sl_sub">〜 {r.lastAt.slice(11)}</div>}
                                                </td>
                                                <td className="sl_td">
                                                    <span className={`sl_pill is_${ev.tone}`}>{ev.label}</span>
                                                    <div className="sl_sub">{r.server === 'php' ? '①' : '②'}{r.status !== null ? ` ・ ${r.status}` : ''}</div>
                                                </td>
                                                <td className="sl_td sl_count">{r.count > 1 ? `×${r.count}` : '1'}</td>
                                                <td className="sl_td">{r.request}{r.roll !== '' && <span className="sl_sub"> : {r.roll}</span>}</td>
                                                <td className="sl_td">{r.staffName}</td>
                                                <td className="sl_td sl_ip">
                                                    <button type="button" className="sl_ip_btn" title="この IP だけを出す"
                                                        onClick={() => { setIp(r.ip); apply({ ip: r.ip }); }}>{r.ip}</button>
                                                    {flagged && <span className="sl_flag" title={flags[r.ip].join(' / ')}>要注意</span>}
                                                    {r.viaIp !== '' && <div className="sl_sub">経由 {r.viaIp}</div>}
                                                </td>
                                                <td className="sl_td sl_sub">{r.path}</td>
                                                <td className="sl_td"><div className="sl_ua" title={r.userAgent}>{r.userAgent}</div></td>
                                                <td className="sl_td sl_msg">{r.message}</td>
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

export default SecurityLog;
