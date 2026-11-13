import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import {
    MAX_HTML_BYTES, SharedReportItem, copyText, createSharedReport, errorMessageOf, sharedReportUrl,
} from '../../report/sharedReport';

/**
 * 共有レポート（v2.2.268 新規）。ヘッダーの「システム管理 → 共有レポート」（⚠️ Master・BrandAdmin・Manager。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   上: HTML の登録（⚠️ Master だけ。② の shared_report_create も source = upload は Master だけ）
 *   下: 共有したレポートの一覧（⚠️ Master は全員分、ほかの人は自分が共有した分。② の shared_report_list が絞る）
 *       URLをコピー・開く・共有を止める（⚠️ 止められるのは共有した本人か Master。② も確かめる）
 *
 * ⚠️ 共有URL は Dashboard にログインしている人なら誰でも開ける（SharedReportView.tsx）。
 * ⚠️ Claudeによる分析のレポートは、ClaudeAnalysis.tsx の「共有」ボタンから共有する（ここには出てくる）。
 * ⚠️ 見た目は GoogleReview.tsx・AccessLog.tsx に合わせている（接頭辞 sr_）。⚠️ 閉じるボタンは無い（ページ）。
 * ─────────────────────────────────────────────
 */

interface ListResponse {
    status: string;
    items: SharedReportItem[];
    isMaster: boolean;
    myStaffId: number;
}

type SortState = { key: keyof SharedReportItem; order: 'asc' | 'desc' };

const SOURCE: Record<string, string> = { ai_analysis: 'Claudeによる分析', upload: 'HTMLの登録' };

const sizeText = (bytes: number): string =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

const SharedReports: React.FC = () => {
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<{ text: string; url?: string } | null>(null);
    const [showRevoked, setShowRevoked] = useState(false);
    const [sort, setSort] = useState<SortState>({ key: 'createdAt', order: 'desc' });

    // 登録（Master）
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'shared_report_list' });
            if (res.data?.status !== 'ok') throw new Error('unexpected response');
            setData(res.data as ListResponse);
        } catch (e) {
            console.error('共有レポートの一覧の取得に失敗しました:', e);
            setError(errorMessageOf(e, '一覧を読み込めませんでした。時間をおいて開き直してください。'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const showUrl = async (key: string, lead: string) => {
        const url = sharedReportUrl(key);
        const copied = await copyText(url);
        setNotice({ text: copied ? `${lead}URLをコピーしました。` : `${lead}下のURLをコピーして渡してください。`, url });
    };

    const pickFile = (f: File | null) => {
        setFile(f);
        if (f !== null && title.trim() === '') setTitle(f.name.replace(/\.html?$/i, ''));
    };

    const upload = async () => {
        if (file === null) { setError('HTML ファイルを選んでください。'); return; }
        if (title.trim() === '') { setError('題を入れてください。'); return; }
        if (file.size > MAX_HTML_BYTES) { setError('HTML が大きすぎます（5MBまで）。'); return; }
        setUploading(true);
        setError('');
        try {
            const html = await file.text();
            const { item } = await createSharedReport({ source: 'upload', title: title.trim(), html });
            setTitle('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            await showUrl(item.key, `「${item.title}」を登録しました。`);
            await load();
        } catch (e) {
            setError(errorMessageOf(e, '登録できませんでした。'));
        } finally {
            setUploading(false);
        }
    };

    const revoke = async (item: SharedReportItem) => {
        if (!window.confirm(`「${item.title}」の共有を止めますか？\n止めると、このURLでは誰も見られなくなります（元に戻せません）。`)) return;
        setError('');
        try {
            const res = await apiClient.post('', { request: 'shared_report_revoke', id: item.id });
            if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '');
            setNotice({ text: `「${item.title}」の共有を止めました。` });
            await load();
        } catch (e) {
            setError(errorMessageOf(e, '共有を止められませんでした。'));
        }
    };

    const items = useMemo(() => {
        const list = (data?.items ?? []).filter((r) => showRevoked || r.revokedAt === null);
        const dir = sort.order === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sort.key] ?? '';
            const bv = b[sort.key] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, showRevoked, sort]);

    const active = (data?.items ?? []).filter((r) => r.revokedAt === null);
    const views = active.reduce((t, r) => t + r.viewCount, 0);
    const revokedCount = (data?.items.length ?? 0) - active.length;

    const th = (label: string, key: keyof SharedReportItem, width?: number, numeric = false) => {
        const on = sort.key === key;
        return (
            <th className={`sr_th sr_th_sort${numeric ? ' sr_num' : ''}`} style={{ width }} title="クリックで並べ替え"
                onClick={() => setSort((p) => (on ? { key, order: p.order === 'asc' ? 'desc' : 'asc' } : { key, order: numeric || String(key).endsWith('At') ? 'desc' : 'asc' }))}>
                {label}<span className={`sr_sort_icon${on ? ' is_active' : ''}`}>{on ? (sort.order === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, value: string) => (
        <div className="sr_kpi_card"><div className="sr_kpi_label">{label}</div><div className="sr_kpi_value">{value}</div></div>
    );

    return (
        <div className="sr_wrap">
            <style>{`
                .sr_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .sr_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .sr_note { font-size: 11px; color: #6b7280; }
                .sr_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .sr_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sr_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .sr_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sr_kpi_label { font-size: 11px; color: #6b7280; }
                .sr_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sr_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .sr_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .sr_ok { font-size: 12px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
                         padding: 8px 12px; flex-shrink: 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .sr_url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; width: min(100%, 560px); }
                .sr_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .sr_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sr_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .sr_th_sort { cursor: pointer; user-select: none; }
                .sr_th_sort:hover { background: #eef2f7; }
                .sr_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sr_sort_icon.is_active { color: #2563eb; }
                .sr_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
                .sr_row:hover > .sr_td { background: #f8fafc; }
                .sr_row.is_revoked > .sr_td { color: #9ca3af; }
                .sr_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .sr_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .sr_pill { display: inline-block; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .sr_pill.is_on { background: #dcfce7; color: #166534; }
                .sr_pill.is_off { background: #f3f4f6; color: #6b7280; }
                .sr_pill.is_ai { background: #fdf2ec; color: #b4532a; }
                .sr_pill.is_up { background: #eff6ff; color: #1e40af; }
                .sr_btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 6px; font-size: 11px;
                          font-weight: 700; padding: 2px 8px; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-block; }
                .sr_btn:hover { background: #f1f5f9; }
                .sr_btn.is_danger { color: #b91c1c; border-color: #fecaca; }
                .sr_btn.is_danger:hover { background: #fef2f2; }
                .sr_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .sr_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sr_inner">
                <div className="sr_note">
                    共有したレポートの一覧です。共有URLは、Dashboard にログインしている人なら誰でも開けます（ログインしていなければログイン画面のあとに開きます）。
                    {data && !data.isMaster && ' あなたが共有したレポートだけを出しています。'}
                </div>

                {data?.isMaster && (
                    <div className="sr_bar">
                        <div>
                            <div className="sr_label">HTML ファイル（5MBまで）</div>
                            <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="form-control form-control-sm"
                                style={{ width: 300 }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} aria-label="HTML ファイル" />
                        </div>
                        <div>
                            <div className="sr_label">題</div>
                            <input className="form-control form-control-sm" style={{ width: 320 }} value={title} maxLength={200}
                                placeholder="例：新春CP期 注文反響の歩留まり" onChange={(e) => setTitle(e.target.value)} aria-label="題" />
                        </div>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => void upload()} disabled={uploading}>
                            {uploading ? '登録中…' : '登録して共有URLを作る'}
                        </button>
                    </div>
                )}

                {error !== '' && <div className="sr_error" role="alert">{error}</div>}
                {notice && (
                    <div className="sr_ok" role="status">
                        <span>{notice.text}</span>
                        {notice.url && (
                            <>
                                <input className="form-control form-control-sm sr_url" readOnly value={notice.url}
                                    onFocus={(e) => e.target.select()} aria-label="共有URL" />
                                <a className="sr_btn" href={notice.url} target="_blank" rel="noopener noreferrer">開く</a>
                            </>
                        )}
                    </div>
                )}

                {data && (
                    <>
                        <div className="sr_kpi">
                            {kpi('共有中', `${active.length.toLocaleString()}件`)}
                            {kpi('共有中のレポートが開かれた回数', views.toLocaleString())}
                            {kpi('止めた共有', `${revokedCount.toLocaleString()}件`)}
                        </div>

                        <div className="sr_caution">
                            レポートには個人名や成績が入ることがあります。URL は社内の人だけに渡してください。必要がなくなった共有は「止める」を押してください（止めると、そのURLでは誰も見られなくなります）。
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <div className="form-check form-switch m-0">
                                <input id="sr_revoked" className="form-check-input" type="checkbox" checked={showRevoked}
                                    onChange={(e) => setShowRevoked(e.target.checked)} />
                                <label htmlFor="sr_revoked" className="form-check-label sr_note">止めた共有も出す</label>
                            </div>
                            <button type="button" className="sr_btn ms-auto" onClick={() => void load()} disabled={loading}>
                                {loading ? '読み込み中…' : '読み直す'}
                            </button>
                        </div>

                        <div className="sr_table_wrap">
                            <table className="sr_table">
                                <thead>
                                    <tr>
                                        {th('題', 'title')}
                                        {th('元', 'source', 130)}
                                        {th('共有した人', 'staffName', 130)}
                                        {th('共有した日時', 'createdAt', 140)}
                                        {th('開かれた回数', 'viewCount', 100, true)}
                                        {th('最後に開かれた', 'lastViewedAt', 140)}
                                        {th('大きさ', 'htmlBytes', 70, true)}
                                        {th('状態', 'revokedAt', 80)}
                                        <th className="sr_th" style={{ width: 210 }}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 && (
                                        <tr><td className="sr_td sr_empty" colSpan={9}>{loading ? '読み込み中…' : '共有したレポートはありません'}</td></tr>
                                    )}
                                    {items.map((r) => {
                                        const on = r.revokedAt === null;
                                        const mine = data.isMaster || r.staffId === data.myStaffId;
                                        return (
                                            <tr key={r.id} className={`sr_row${on ? '' : ' is_revoked'}`}>
                                                <td className="sr_td">{r.title}</td>
                                                <td className="sr_td">
                                                    <span className={`sr_pill ${r.source === 'ai_analysis' ? 'is_ai' : 'is_up'}`}>{SOURCE[r.source] ?? r.source}</span>
                                                </td>
                                                <td className="sr_td">{r.staffName}</td>
                                                <td className="sr_td sr_time">{r.createdAt.slice(0, 16)}</td>
                                                <td className="sr_td sr_num">{r.viewCount.toLocaleString()}</td>
                                                <td className="sr_td sr_time">{r.lastViewedAt?.slice(0, 16) ?? '—'}</td>
                                                <td className="sr_td sr_num">{sizeText(r.htmlBytes)}</td>
                                                <td className="sr_td">
                                                    <span className={`sr_pill ${on ? 'is_on' : 'is_off'}`} title={on ? '' : `${r.revokedAt} に停止`}>{on ? '共有中' : '停止'}</span>
                                                </td>
                                                <td className="sr_td">
                                                    {on && (
                                                        <span className="d-inline-flex gap-1">
                                                            <button type="button" className="sr_btn" onClick={() => void showUrl(r.key, '')}>URLをコピー</button>
                                                            <a className="sr_btn" href={sharedReportUrl(r.key)} target="_blank" rel="noopener noreferrer">開く</a>
                                                            {mine && <button type="button" className="sr_btn is_danger" onClick={() => void revoke(r)}>止める</button>}
                                                        </span>
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

export default SharedReports;
