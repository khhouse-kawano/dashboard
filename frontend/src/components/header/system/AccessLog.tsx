import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { GUIDE_SCREENS } from '../../guide/guideScreens';
import { HEADER_SCREENS } from '../headerScreens';
import { REALTY_MENU } from '../../realty/RealtyMenu';

/**
 * アクセス記録（v2.2.266 新規）。ヘッダーの「システム管理 → アクセス記録」（⚠️ Master だけ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② access_log_list（backend-express/src/features/accessLog.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   書くのは ActiveUser.tsx（画面を移ったとき access_log:open、20秒ごとに heartbeat）。
 *
 * ⚠️ 滞在時間は「開いてから最後の heartbeat まで」（20秒ごと）。⚠️ タブを開いたままにしていれば、見ていなくても伸びる。
 * ⚠️ 集計（KPI・画面ごと・担当者ごと）は絞り込み後の全件。明細は新しい順に上限まで。
 * ⚠️ 画面の名前は、左のメニュー（guideScreens.ts）・ヘッダー（headerScreens.tsx）・不動産企画係（RealtyMenu.tsx）から URL で引く。
 *   ⚠️ 名前が無い URL はそのまま出す。
 *   ⚠️ headerScreens.tsx はこの画面を読み込むので、HEADER_SCREENS は描くときに読む（モジュールの最初では読まない）。
 * ⚠️ 見た目は GoogleReview.tsx・SecurityLog.tsx に合わせている（接頭辞 al_）。⚠️ 閉じるボタンは無い（ページ）。
 * ─────────────────────────────────────────────
 */

interface LogRow {
    id: number;
    staffId: number;
    staffName: string;
    authority: string;
    division: string;
    path: string;
    openedAt: string;
    lastSeenAt: string | null;
    seconds: number | null;
    ip: string;
    userAgent: string;
}
interface PathRow { path: string; views: number; staffCount: number; avgSeconds: number | null; lastAt: string }
interface StaffRow { staffId: number; staffName: string; views: number; screens: number; lastAt: string }

interface ListResponse {
    status: string;
    from: string;
    to: string;
    totals: { views: number; staffCount: number; screens: number };
    byPath: PathRow[];
    byStaff: StaffRow[];
    staffNames: string[];
    rows: LogRow[];
    truncated: boolean;
    maxRows: number;
    keepMonths: number;
}

type Tab = 'path' | 'staff' | 'rows';
type Filter = { from: string; to: string; staff: string; path: string; q: string };

const DIVISION: Record<string, string> = { order: '注文', spec: '建売', used: '中古', all: '全事業', realty: '不動産企画係' };

/** URL → 画面の名前（⚠️ 描くときに作る。上の注記） */
const buildScreenNames = (): Map<string, string> => {
    const names = new Map<string, string>();
    const add = (path: string | undefined, name: string) => {
        const p = (path ?? '').split('?')[0];
        if (p !== '' && !names.has(p)) names.set(p, name);
    };
    Object.entries(GUIDE_SCREENS).forEach(([name, s]) => {
        if (typeof s.route === 'string') add(s.route, name);
        else if (s.route) Object.values(s.route).forEach((r) => add(r, name));
    });
    HEADER_SCREENS.forEach((s) => add(s.path, s.menu ? `${s.menu} › ${s.item}` : s.item));
    REALTY_MENU.forEach((g) => g.items.forEach((i) => add(i.path, `不動産企画係 › ${i.label}`)));
    return names;
};

/** 滞在時間（⚠️ heartbeat が1回も届かなければ 20秒未満） */
const duration = (seconds: number | null): string => {
    if (seconds === null) return '20秒未満';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分`;
    return `${Math.floor(seconds / 3600)}時間${Math.floor((seconds % 3600) / 60)}分`;
};

/** 端末（User-Agent を短く） */
const device = (ua: string): string => {
    const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : '';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
    return [os, browser].filter(Boolean).join(' ・ ') || (ua === '' ? '不明' : 'その他');
};

type SortState = { key: string; order: 'asc' | 'desc' };

const sortRows = <T,>(list: T[], { key, order }: SortState): T[] => {
    const dir = order === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        const av = (a as Record<string, unknown>)[key] ?? '';
        const bv = (b as Record<string, unknown>)[key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), 'ja') * dir;
    });
};

const AccessLog = () => {
    const [filter, setFilter] = useState<Filter>({ from: '', to: '', staff: '', path: '', q: '' });
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('path');
    const [sort, setSort] = useState<Record<Tab, SortState>>({
        path: { key: 'views', order: 'desc' },
        staff: { key: 'views', order: 'desc' },
        rows: { key: 'openedAt', order: 'desc' },
    });

    const screenNames = useMemo(buildScreenNames, []);
    const screenName = useCallback((path: string) => screenNames.get(path) ?? '', [screenNames]);

    /** ⚠️ 期間・担当者・画面・キーワードは ② で絞る（明細は新しい順に上限まで返るため） */
    const load = useCallback(async (next: Filter) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'access_log_list', ...next });
            const body = res.data as ListResponse;
            if (body?.status !== 'ok') throw new Error('unexpected response');
            setData(body);
            setFilter({ ...next, from: body.from, to: body.to });
        } catch (e) {
            console.error('アクセス記録の取得に失敗しました:', e);
            setError('アクセス記録を読み込めませんでした。時間をおいて「表示」を押してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    // ⚠️ 開いたときは期間を ② に任せる（直近7日）
    useEffect(() => { void load({ from: '', to: '', staff: '', path: '', q: '' }); }, [load]);

    const apply = (patch: Partial<Filter> = {}) => void load({ ...filter, ...patch });

    const th = (t: Tab, label: string, key: string, width?: number, numeric = false) => {
        const active = sort[t].key === key;
        return (
            <th className={`al_th al_th_sort${numeric ? ' al_num' : ''}`} style={{ width }} title="クリックで並べ替え"
                onClick={() => setSort((p) => ({
                    ...p,
                    [t]: active ? { key, order: p[t].order === 'asc' ? 'desc' : 'asc' } : { key, order: numeric || key.endsWith('At') ? 'desc' : 'asc' },
                }))}>
                {label}<span className={`al_sort_icon${active ? ' is_active' : ''}`}>{active ? (sort[t].order === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const byPath = useMemo(() => sortRows(data?.byPath ?? [], sort.path), [data, sort.path]);
    const byStaff = useMemo(() => sortRows(data?.byStaff ?? [], sort.staff), [data, sort.staff]);
    const rows = useMemo(() => sortRows(data?.rows ?? [], sort.rows), [data, sort.rows]);

    const kpi = (label: string, value: string) => (
        <div className="al_kpi_card">
            <div className="al_kpi_label">{label}</div>
            <div className="al_kpi_value">{value}</div>
        </div>
    );

    const pathCell = (path: string) => (
        <button type="button" className="al_link" title="この画面だけを出す" onClick={() => { setTab('rows'); apply({ path }); }}>
            {screenName(path) !== '' ? screenName(path) : path}
            {screenName(path) !== '' && <span className="al_sub"> {path}</span>}
        </button>
    );
    const staffCell = (name: string) => (
        <button type="button" className="al_link" title="この人だけを出す" onClick={() => { setTab('rows'); apply({ staff: name }); }}>{name}</button>
    );

    const t = data?.totals;
    const empty = (cols: number) => (
        <tr><td className="al_td al_empty" colSpan={cols}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
    );

    return (
        <div className="al_wrap">
            <style>{`
                .al_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .al_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .al_note { font-size: 11px; color: #6b7280; }
                .al_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .al_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .al_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .al_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .al_kpi_label { font-size: 11px; color: #6b7280; }
                .al_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .al_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .al_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .al_chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
                .al_chip { border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; border-radius: 999px; font-size: 11px;
                           padding: 2px 10px; cursor: pointer; }
                .al_chip:hover { background: #dbeafe; }
                .al_tabs { display: flex; gap: 4px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
                .al_tab { border: none; background: none; padding: 6px 14px; font-size: 12px; font-weight: 700; color: #6b7280;
                          border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; }
                .al_tab.is_active { color: #1d4ed8; border-bottom-color: #2563eb; }
                .al_tab_count { margin-left: 4px; font-weight: 400; color: #9ca3af; }
                .al_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .al_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .al_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .al_th_sort { cursor: pointer; user-select: none; }
                .al_th_sort:hover { background: #eef2f7; }
                .al_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .al_sort_icon.is_active { color: #2563eb; }
                .al_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .al_row:hover > .al_td { background: #f8fafc; }
                .al_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .al_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .al_sub { font-size: 11px; color: #9ca3af; }
                .al_link { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font: inherit; text-align: left; }
                .al_link:hover { text-decoration: underline; }
                .al_pill { display: inline-block; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 0 7px;
                           background: #f3f4f6; color: #4b5563; margin-left: 4px; white-space: nowrap; }
                .al_ip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; white-space: nowrap; }
                .al_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .al_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="al_inner">
                <div className="al_note">
                    誰が・いつ・どの画面を開いたかの記録です（v2.2.266 から）。管理者だけが見られます。
                </div>

                <div className="al_bar">
                    <div>
                        <div className="al_label">期間</div>
                        <div className="d-flex align-items-center gap-1">
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={filter.from}
                                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} aria-label="期間の始め" />
                            <span className="al_note">〜</span>
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={filter.to}
                                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} aria-label="期間の終わり" />
                        </div>
                    </div>
                    <div>
                        <div className="al_label">担当者</div>
                        <select className="form-select form-select-sm" style={{ width: 160 }} value={filter.staff}
                            onChange={(e) => apply({ staff: e.target.value })} aria-label="担当者">
                            <option value="">すべて</option>
                            {(data?.staffNames ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
                            {filter.staff !== '' && !(data?.staffNames ?? []).includes(filter.staff) && <option value={filter.staff}>{filter.staff}</option>}
                        </select>
                    </div>
                    <div>
                        <div className="al_label">キーワード</div>
                        <input className="form-control form-control-sm" style={{ width: 200 }} value={filter.q} placeholder="名前・URL・IP の一部"
                            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} aria-label="キーワード" />
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply()} disabled={loading}>
                        {loading ? '読み込み中…' : '表示'}
                    </button>
                </div>

                {(filter.path !== '' || filter.staff !== '') && (
                    <div className="al_chips">
                        <span className="al_note">絞り込み（押すと外す）:</span>
                        {filter.staff !== '' && <button type="button" className="al_chip" onClick={() => apply({ staff: '' })}>担当者：{filter.staff} ✕</button>}
                        {filter.path !== '' && (
                            <button type="button" className="al_chip" onClick={() => apply({ path: '' })}>
                                画面：{screenName(filter.path) || filter.path} ✕
                            </button>
                        )}
                    </div>
                )}

                {error !== '' && <div className="al_error" role="alert">{error}</div>}

                {data && t && (
                    <>
                        <div className="al_kpi">
                            {kpi('開いた回数', t.views.toLocaleString())}
                            {kpi('担当者', `${t.staffCount.toLocaleString()}人`)}
                            {kpi('画面の種類', t.screens.toLocaleString())}
                            {kpi('1人あたりの回数', t.staffCount > 0 ? (Math.round((t.views / t.staffCount) * 10) / 10).toLocaleString() : '0')}
                        </div>

                        <div className="al_caution">
                            滞在時間は、画面を開いてから最後に在席の合図（20秒ごと）が届くまでのおおよその時間です。画面を開いたまま席を離れても伸びます。
                            記録は {data.keepMonths}か月で消えます。
                            {data.truncated && <><br />⚠️ 明細は新しい順に {data.maxRows.toLocaleString()} 行までを出しています（集計はすべての行で数えています）。期間を短くするか、担当者・画面で絞ってください。</>}
                        </div>

                        <div className="al_tabs" role="tablist">
                            {([['path', '画面ごと', byPath.length], ['staff', '担当者ごと', byStaff.length], ['rows', '明細', rows.length]] as [Tab, string, number][]).map(([k, label, n]) => (
                                <button key={k} type="button" role="tab" aria-selected={tab === k} className={`al_tab${tab === k ? ' is_active' : ''}`}
                                    onClick={() => setTab(k)}>
                                    {label}<span className="al_tab_count">{n.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>

                        <div className="al_table_wrap">
                            <table className="al_table">
                                {tab === 'path' && (
                                    <>
                                        <thead>
                                            <tr>
                                                {th('path', '画面', 'path')}
                                                {th('path', '開いた回数', 'views', 110, true)}
                                                {th('path', '人数', 'staffCount', 80, true)}
                                                {th('path', '平均の滞在', 'avgSeconds', 110, true)}
                                                {th('path', '最後に開いた', 'lastAt', 140)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {byPath.length === 0 && empty(5)}
                                            {byPath.map((r) => (
                                                <tr key={r.path} className="al_row">
                                                    <td className="al_td">{pathCell(r.path)}</td>
                                                    <td className="al_td al_num">{r.views.toLocaleString()}</td>
                                                    <td className="al_td al_num">{r.staffCount.toLocaleString()}</td>
                                                    <td className="al_td al_num">{duration(r.avgSeconds)}</td>
                                                    <td className="al_td al_time">{r.lastAt}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                                {tab === 'staff' && (
                                    <>
                                        <thead>
                                            <tr>
                                                {th('staff', '担当者', 'staffName')}
                                                {th('staff', '開いた回数', 'views', 110, true)}
                                                {th('staff', '画面の種類', 'screens', 110, true)}
                                                {th('staff', '最後に開いた', 'lastAt', 140)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {byStaff.length === 0 && empty(4)}
                                            {byStaff.map((r) => (
                                                <tr key={r.staffId} className="al_row">
                                                    <td className="al_td">{staffCell(r.staffName)}</td>
                                                    <td className="al_td al_num">{r.views.toLocaleString()}</td>
                                                    <td className="al_td al_num">{r.screens.toLocaleString()}</td>
                                                    <td className="al_td al_time">{r.lastAt}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                                {tab === 'rows' && (
                                    <>
                                        <thead>
                                            <tr>
                                                {th('rows', '開いた日時', 'openedAt', 150)}
                                                {th('rows', '担当者', 'staffName', 160)}
                                                {th('rows', '画面', 'path')}
                                                {th('rows', '滞在', 'seconds', 90, true)}
                                                {th('rows', 'IP', 'ip', 130)}
                                                <th className="al_th">端末</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.length === 0 && empty(6)}
                                            {rows.map((r) => (
                                                <tr key={r.id} className="al_row">
                                                    <td className="al_td al_time">{r.openedAt}</td>
                                                    <td className="al_td">
                                                        {staffCell(r.staffName)}
                                                        <div className="al_sub">{r.authority}{r.division !== '' ? ` ・ ${DIVISION[r.division] ?? r.division}` : ''}</div>
                                                    </td>
                                                    <td className="al_td">{pathCell(r.path)}</td>
                                                    <td className="al_td al_num">{duration(r.seconds)}</td>
                                                    <td className="al_td al_ip">{r.ip}</td>
                                                    <td className="al_td" title={r.userAgent}>{device(r.userAgent)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AccessLog;
