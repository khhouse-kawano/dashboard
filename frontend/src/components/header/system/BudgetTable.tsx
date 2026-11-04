import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { csvToObjects, decodeCsv, parseCsv } from '../../../utils/csv';

/**
 * 予算テーブル（v2.2.243 新規）。ヘッダーの「システム管理 → 予算テーブル」（⚠️ Master / BrandAdmin。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   一覧 … ② budget_table_list（backend-express/src/features/budgetTable.ts）
 *   登録 … ② budget_table_upload（CSV の行を budget へ INSERT。⚠️ まず mode = 'check' で確かめ、「登録」で mode = 'save'）
 *   ⚠️ ② も Master / BrandAdmin に絞っている。
 *
 * ⚠️ 上の操作部分（絞り込み・登録・KPI）は固定し、表だけをスクロールさせる（指示書の「上部を fixed」）。
 * ⚠️ 表の中での修正・削除は無い（2026-11-04 決定）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせている（接頭辞 bt_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

interface BudgetRow {
    id: number;
    period: string;
    shop: string;
    medium: string;
    value: number;
    note: string;
    company: string;
    remarks: string;
    responseMedium: number;
    category: string;
    section: string;
    orderSection: string;
}

interface Total { rows: number; total: number }

interface ListResponse {
    status: string;
    from: string;
    to: string;
    totals: { all: Total; mkt: Total; pr: Total };
    rows: BudgetRow[];
    truncated: boolean;
    maxRows: number;
    options: { media: string[]; shops: string[] };
}

interface Filter { from: string; to: string; section: string; category: string; medium: string; shop: string; q: string }

interface CheckResult {
    rows: number;
    total: number;
    from: string;
    to: string;
    splitCount: number;
    duplicates: number;
    duplicateLines: number[];
}

type RowError = { line: number; message: string };

/** CSV に必要な見出し（⚠️ budget の列名。⚠️ remarks は無くてもよい・id は無視する。② の checkRow と揃える） */
const REQUIRED_COLUMNS = ['budget_period', 'shop', 'medium', 'budget_value', 'note', 'company', 'response_medium', 'category', 'section', 'order_section'];
const TEMPLATE_COLUMNS = ['budget_period', 'shop', 'medium', 'budget_value', 'note', 'company', 'remarks', 'response_medium', 'category', 'section', 'order_section'];

const SECTION_LABEL: Record<string, string> = { order: '注文', spec: '建売', use: '中古' };

type SortKey = 'period' | 'section' | 'orderSection' | 'shop' | 'medium' | 'category' | 'value' | 'note' | 'company' | 'remarks' | 'id';

const yen = (n: number): string => `¥${n.toLocaleString('ja-JP')}`;

const errorMessage = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** 見本の CSV（見出しと1行の例）を保存させる */
const downloadTemplate = () => {
    const example = ['2026/11/01', 'KH宮崎店', 'イベント', '33000', '2026/11_住まいづくりフェア出展料', 'フルキャスト', '派遣スタッフ', '0', 'MKT', 'order', '宮崎営業課'];
    const body = `${TEMPLATE_COLUMNS.join(',')}\n${example.map((v) => `"${v}"`).join(',')}\n`;
    const url = URL.createObjectURL(new Blob(['﻿', body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_template.csv';
    a.click();
    URL.revokeObjectURL(url);
};

const BudgetTable = () => {
    const [filter, setFilter] = useState<Filter>({ from: '', to: '', section: '', category: '', medium: '', shop: '', q: '' });
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('period');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // 登録
    const [showUpload, setShowUpload] = useState(false);
    const [fileName, setFileName] = useState('');
    const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
    const [check, setCheck] = useState<CheckResult | null>(null);
    const [rowErrors, setRowErrors] = useState<RowError[]>([]);
    const [uploadError, setUploadError] = useState('');
    const [uploadDone, setUploadDone] = useState('');
    const [busy, setBusy] = useState(false);

    /** ⚠️ 絞り込みは ② で行う（⚠️ 返す行に上限があるため、画面で絞ると漏れる） */
    const load = useCallback(async (next: Filter) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'budget_table_list', ...next });
            const body = res.data as ListResponse;
            if (body?.status !== 'ok') throw new Error('unexpected response');
            setData(body);
            // ⚠️ 期間を空で送ったときは ② の既定（直近3か月）が返るので、欄に反映する
            setFilter((prev) => ({ ...prev, from: body.from, to: body.to }));
        } catch (e) {
            console.error('予算テーブルの取得に失敗しました:', e);
            setError(errorMessage(e, '予算テーブルを読み込めませんでした。時間をおいて「表示」を押してください。'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load({ from: '', to: '', section: '', category: '', medium: '', shop: '', q: '' }); }, [load]);

    const patch = (next: Partial<Filter>) => setFilter((prev) => ({ ...prev, ...next }));
    /** 選ぶだけで絞る項目（期間・キーワードは「表示」で） */
    const applyWith = (next: Partial<Filter>) => {
        const merged = { ...filter, ...next };
        setFilter(merged);
        void load(merged);
    };

    const rows = useMemo(() => {
        const list = data?.rows ?? [];
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, sortKey, sortOrder]);

    // -----------------------------------------------------------------------
    // CSV の登録
    // -----------------------------------------------------------------------

    const resetUpload = () => {
        setFileName('');
        setCsvRows([]);
        setCheck(null);
        setRowErrors([]);
        setUploadError('');
    };

    /** ② に送る（⚠️ mode = 'check' は確かめるだけで何も書かない） */
    const send = async (mode: 'check' | 'save', records: Record<string, string>[]) =>
        (await apiClient.post('', { request: 'budget_table_upload', mode, rows: records })).data ?? {};

    const pickCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        resetUpload();
        setUploadDone('');
        setFileName(file.name);
        setBusy(true);
        try {
            const { header, records } = csvToObjects(parseCsv(decodeCsv(await file.arrayBuffer())));
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) { setUploadError(`CSV の見出しに ${missing.join('・')} がありません。見本の CSV と同じ見出しにしてください。`); return; }
            // ⚠️ 末尾の空行などは除く
            const filled = records.filter((r) => Object.values(r).some((v) => v !== ''));
            if (filled.length === 0) { setUploadError('CSV に行がありません。'); return; }
            const result = await send('check', filled);
            if (result.status !== 'ok') {
                setUploadError(result.message ?? 'CSV を確かめられませんでした。');
                setRowErrors(Array.isArray(result.errors) ? result.errors : []);
                return;
            }
            setCsvRows(filled);
            setCheck(result as CheckResult);
        } catch (error) {
            console.error('CSV の確認に失敗しました:', error);
            setUploadError(errorMessage(error, 'CSV を読み込めませんでした。ファイルの形式をご確認ください。'));
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (check === null || csvRows.length === 0 || busy) return;
        const warn = check.duplicates > 0 ? `\n\n⚠️ 同じ内容がすでにある行が ${check.duplicates} 行あります。登録すると2重になります。` : '';
        if (!window.confirm(`${check.rows.toLocaleString()} 行（合計 ${yen(check.total)}）を予算テーブルに追加します。よろしいですか？${warn}`)) return;
        setBusy(true);
        setUploadError('');
        try {
            const result = await send('save', csvRows);
            if (result.status !== 'ok') {
                setUploadError(result.message ?? '登録できませんでした。');
                setRowErrors(Array.isArray(result.errors) ? result.errors : []);
                return;
            }
            const done = `${fileName} の ${Number(result.inserted).toLocaleString()} 行を登録しました。`;
            resetUpload();
            setUploadDone(done);
            void load(filter);
        } catch (error) {
            console.error('予算テーブルの登録に失敗しました:', error);
            setUploadError(errorMessage(error, '登録できませんでした。時間をおいてもう一度お試しください。'));
        } finally {
            setBusy(false);
        }
    };

    // -----------------------------------------------------------------------

    const th = (label: string, key: SortKey, align?: 'right') => {
        const active = sortKey === key;
        return (
            <th className={`bt_th bt_th_sort${align === 'right' ? ' is_right' : ''}`} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'period' || key === 'value' || key === 'id' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`bt_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, total: Total | undefined) => (
        <div className="bt_kpi_card">
            <div className="bt_kpi_label">{label}</div>
            <div className="bt_kpi_value">{yen(total?.total ?? 0)}</div>
            <div className="bt_kpi_sub">{(total?.rows ?? 0).toLocaleString()} 行</div>
        </div>
    );

    return (
        <div className="bt_wrap">
            <style>{`
                .bt_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .bt_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .bt_fixed { display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
                .bt_note { font-size: 11px; color: #6b7280; }
                .bt_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .bt_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .bt_spacer { flex: 1 1 auto; }
                .bt_upload_btn { border: 1px solid #2563eb; color: #2563eb; background: #fff; border-radius: 6px; font-size: 12px;
                                 font-weight: 700; padding: 4px 12px; }
                .bt_upload_btn.is_open, .bt_upload_btn:hover { background: #eff6ff; }
                .bt_upload { border: 1px solid #bfdbfe; background: #f8fbff; border-radius: 10px; padding: 10px 12px;
                             display: flex; flex-direction: column; gap: 8px; }
                .bt_upload_row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .bt_link { border: none; background: none; padding: 0; color: #1d4ed8; font-size: 11px; cursor: pointer; }
                .bt_link:hover { text-decoration: underline; }
                .bt_check { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; }
                .bt_check b { font-variant-numeric: tabular-nums; }
                .bt_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .bt_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .bt_kpi_label { font-size: 11px; color: #6b7280; }
                .bt_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .bt_kpi_sub { font-size: 11px; color: #9ca3af; font-variant-numeric: tabular-nums; }
                .bt_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .bt_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; white-space: pre-wrap; }
                .bt_ok { font-size: 12px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; }
                .bt_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .bt_table { width: 100%; min-width: 1300px; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .bt_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .bt_th.is_right { text-align: right; }
                .bt_th_sort { cursor: pointer; user-select: none; }
                .bt_th_sort:hover { background: #eef2f7; }
                .bt_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .bt_sort_icon.is_active { color: #2563eb; }
                .bt_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .bt_row:hover > .bt_td { background: #f8fafc; }
                .bt_nowrap { white-space: nowrap; }
                .bt_num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
                .bt_num.is_minus { color: #b91c1c; }
                .bt_sub { font-size: 11px; color: #9ca3af; }
                .bt_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .bt_pill.is_mkt { background: #dbeafe; color: #1e40af; }
                .bt_pill.is_pr { background: #fce7f3; color: #9d174d; }
                .bt_pill.is_section { background: #f3f4f6; color: #4b5563; }
                .bt_text { min-width: 180px; overflow-wrap: anywhere; }
                .bt_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .bt_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="bt_inner">
                {/* ⚠️ ここから下の .bt_fixed は動かない（表だけがスクロールする） */}
                <div className="bt_fixed">
                    <div className="bt_note">
                        広告費（予算テーブル）の一覧です。CSV で行を追加できます。管理者・ブランド管理者だけが使えます。
                    </div>

                    <div className="bt_bar">
                        <div>
                            <div className="bt_label">期間</div>
                            <div className="d-flex align-items-center gap-1">
                                <input type="month" className="form-control form-control-sm" style={{ width: 140 }} value={filter.from}
                                    onChange={(e) => patch({ from: e.target.value })} aria-label="期間の始め" />
                                <span className="bt_note">〜</span>
                                <input type="month" className="form-control form-control-sm" style={{ width: 140 }} value={filter.to}
                                    onChange={(e) => patch({ to: e.target.value })} aria-label="期間の終わり" />
                            </div>
                        </div>
                        <div>
                            <div className="bt_label">事業</div>
                            <select className="form-select form-select-sm" style={{ width: 100 }} value={filter.section}
                                onChange={(e) => applyWith({ section: e.target.value })} aria-label="事業">
                                <option value="">すべて</option>
                                {Object.entries(SECTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">区分</div>
                            <select className="form-select form-select-sm" style={{ width: 90 }} value={filter.category}
                                onChange={(e) => applyWith({ category: e.target.value })} aria-label="区分">
                                <option value="">すべて</option>
                                <option value="MKT">MKT</option>
                                <option value="PR">PR</option>
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">媒体</div>
                            <select className="form-select form-select-sm" style={{ width: 170 }} value={filter.medium}
                                onChange={(e) => applyWith({ medium: e.target.value })} aria-label="媒体">
                                <option value="">すべて</option>
                                {(data?.options.media ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">店舗</div>
                            <select className="form-select form-select-sm" style={{ width: 170 }} value={filter.shop}
                                onChange={(e) => applyWith({ shop: e.target.value })} aria-label="店舗">
                                <option value="">すべて</option>
                                {(data?.options.shops ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">キーワード</div>
                            <input className="form-control form-control-sm" style={{ width: 200 }} value={filter.q} placeholder="内容・請求先・詳細・営業課"
                                onChange={(e) => patch({ q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void load(filter); }}
                                aria-label="キーワード" />
                        </div>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => void load(filter)} disabled={loading}>
                            {loading ? '読み込み中…' : '表示'}
                        </button>
                        <span className="bt_spacer" />
                        <button type="button" className={`bt_upload_btn${showUpload ? ' is_open' : ''}`} onClick={() => setShowUpload((v) => !v)}>
                            <i className="fa-solid fa-upload me-1" aria-hidden="true" />広告費の登録
                        </button>
                    </div>

                    {showUpload && (
                        <div className="bt_upload">
                            <div className="bt_upload_row">
                                <input type="file" accept=".csv,text/csv" className="form-control form-control-sm" style={{ width: 320 }}
                                    onChange={(e) => void pickCsv(e)} disabled={busy} aria-label="登録する CSV" />
                                <button type="button" className="btn btn-sm btn-primary" disabled={check === null || busy} onClick={() => void save()}>
                                    {busy ? '処理しています…' : '登録'}
                                </button>
                                <button type="button" className="bt_link" onClick={downloadTemplate}>見本の CSV を保存</button>
                            </div>
                            <div className="bt_note">
                                見出し：{TEMPLATE_COLUMNS.join(', ')}（remarks は無くても可・id の列は無視します）。
                                CSV を選ぶと、まず中身を確かめます（この時点ではまだ登録しません）。
                            </div>
                            {fileName !== '' && check !== null && (
                                <div className="bt_check" role="status">
                                    <span>{fileName}</span>
                                    <span>行数 <b>{check.rows.toLocaleString()}</b></span>
                                    <span>合計 <b>{yen(check.total)}</b></span>
                                    <span>期間 <b>{check.from}</b> 〜 <b>{check.to}</b></span>
                                    {check.splitCount > 0 && <span>請求先の括弧書きを詳細へ分ける行 <b>{check.splitCount}</b></span>}
                                    <span style={{ color: check.duplicates > 0 ? '#b91c1c' : undefined }}>
                                        同じ内容がすでにある行 <b>{check.duplicates}</b>
                                        {check.duplicates > 0 && `（${check.duplicateLines.join('・')}行目${check.duplicates > check.duplicateLines.length ? ' ほか' : ''}）`}
                                    </span>
                                </div>
                            )}
                            {uploadError !== '' && (
                                <div className="bt_error" role="alert">
                                    {uploadError}
                                    {rowErrors.length > 0 && `\n${rowErrors.slice(0, 10).map((x) => `${x.line}行目: ${x.message}`).join('\n')}${rowErrors.length > 10 ? `\nほか ${rowErrors.length - 10} 行` : ''}`}
                                </div>
                            )}
                            {uploadDone !== '' && <div className="bt_ok" role="status">{uploadDone}</div>}
                        </div>
                    )}

                    {error !== '' && <div className="bt_error" role="alert">{error}</div>}

                    {data && (
                        <div className="bt_kpi">
                            {kpi('広告費の合計', data.totals.all)}
                            {kpi('MKT', data.totals.mkt)}
                            {kpi('PR', data.totals.pr)}
                        </div>
                    )}

                    {data?.truncated && (
                        <div className="bt_caution">
                            ⚠️ 新しい順に {data.maxRows.toLocaleString()} 行までを出しています（上の合計は絞り込み全体の数字です）。期間を短くするか、事業・媒体・店舗で絞ってください。
                        </div>
                    )}
                </div>

                <div className="bt_table_wrap">
                    <table className="bt_table">
                        <thead>
                            <tr>
                                {th('期間', 'period')}
                                {th('事業', 'section')}
                                {th('営業課', 'orderSection')}
                                {th('店舗', 'shop')}
                                {th('媒体', 'medium')}
                                {th('区分', 'category')}
                                {th('金額', 'value', 'right')}
                                {th('内容', 'note')}
                                {th('請求先', 'company')}
                                {th('詳細', 'remarks')}
                                {th('ID', 'id', 'right')}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr><td className="bt_td bt_empty" colSpan={11}>{loading ? '読み込み中…' : '該当する行はありません'}</td></tr>
                            )}
                            {rows.map((r) => (
                                <tr key={r.id} className="bt_row">
                                    <td className="bt_td bt_nowrap">{r.period}</td>
                                    <td className="bt_td"><span className="bt_pill is_section">{SECTION_LABEL[r.section] ?? (r.section || '－')}</span></td>
                                    <td className="bt_td bt_nowrap">{r.orderSection}</td>
                                    <td className="bt_td bt_nowrap">{r.shop}</td>
                                    <td className="bt_td bt_nowrap">{r.medium}</td>
                                    <td className="bt_td bt_nowrap">
                                        <span className={`bt_pill ${r.category === 'PR' ? 'is_pr' : 'is_mkt'}`}>{r.category}</span>
                                        {r.responseMedium === 1 && <div className="bt_sub">反響媒体</div>}
                                    </td>
                                    <td className={`bt_td bt_num${r.value < 0 ? ' is_minus' : ''}`}>{yen(r.value)}</td>
                                    <td className="bt_td bt_text">{r.note}</td>
                                    <td className="bt_td">{r.company}</td>
                                    <td className="bt_td bt_text">{r.remarks}</td>
                                    <td className="bt_td bt_num bt_sub">{r.id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BudgetTable;
