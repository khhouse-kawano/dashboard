import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';

/**
 * テーブル定義書（v2.2.301 新規）。ヘッダーの「システム管理 → テーブル定義書」（⚠️ Master だけ・閲覧のみ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② table_definition（GET。backend-express/src/features/tableDefinition.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   ⚠️ ① に PHP ハンドラは無い（② に届かなければ「読み込めません」）。
 *   説明は table_definition / column_definition（原稿は backend/scripts/tabledef/tables/*.md）。⚠️ 型・NULL・既定値は ② が実物から読む。
 * ⚠️ 選んだテーブル・絞り込みは URL に出す（table・q・business・source。既定値と空は出さない。ほかのパラメータは残す）。
 * ⚠️ 見た目は GoogleReview.tsx・SecurityLog.tsx に合わせている（接頭辞 td_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

interface TableRow {
    table_name: string;
    exists: boolean;
    rows: number;
    title: string;
    business: string;
    description: string;
    source: string;
    columns: number;
}

interface ColumnText { table_name: string; column_name: string; description: string }

interface ListResponse { status: string; tables: TableRow[]; columns: ColumnText[] }

interface ColumnRow {
    column_name: string;
    exists: boolean;
    type: string;
    nullable: boolean;
    key: string;
    default_value: string | null;
    extra: string;
    comment: string;
    description: string;
    source: string;
}

interface DetailResponse {
    status: string;
    table: Omit<TableRow, 'columns'> & { comment: string; updated_version: string };
    columns: ColumnRow[];
}

/** 事業の名前（⚠️ '' は定義書に無いテーブル＝未記載） */
const BUSINESS: Record<string, string> = { order: '注文住宅', spec: '建売', used: '中古リノベ', realty: '不動産企画', common: '共通' };
const UNDOCUMENTED = 'none';

type SortKey = 'table_name' | 'title' | 'business' | 'source' | 'rows' | 'columns';

const isListBody = (v: unknown): v is ListResponse =>
    typeof v === 'object' && v !== null && (v as ListResponse).status === 'success' && Array.isArray((v as ListResponse).tables);
const isDetailBody = (v: unknown): v is DetailResponse =>
    typeof v === 'object' && v !== null && (v as DetailResponse).status === 'success' && Array.isArray((v as DetailResponse).columns);

const sourcePill = (source: string) => {
    if (source === '改修') return <span className="td_pill is_ok">改修</span>;
    if (source === '推論') return <span className="td_pill is_guess">推論</span>;
    return <span className="td_pill is_none">未記載</span>;
};

const TableDefinition = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selected, setSelected] = useState(() => searchParams.get('table') ?? '');
    const [q, setQ] = useState(() => searchParams.get('q') ?? '');
    const [business, setBusiness] = useState(() => searchParams.get('business') ?? '');
    const [source, setSource] = useState(() => searchParams.get('source') ?? '');
    const [list, setList] = useState<ListResponse | null>(null);
    const [detail, setDetail] = useState<DetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('table_name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const detailSeq = useRef(0);

    // URL に出す（⚠️ 既定値と空は出さない。⚠️ ほかのパラメータは残す）
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        const put = (key: string, value: string) => { if (value === '') next.delete(key); else next.set(key, value); };
        put('table', selected);
        put('q', q.trim());
        put('business', business);
        put('source', source);
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [selected, q, business, source, searchParams, setSearchParams]);

    // 一覧（⚠️ StrictMode の二度呼びで2回読まないよう、次の番に回してから読む）
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const res = await apiClient.get('', { params: { request: 'table_definition' } });
                if (!isListBody(res?.data)) throw new Error('invalid table_definition response');
                if (!cancelled) setList(res.data);
            } catch (e) {
                console.error('テーブル定義書の取得に失敗しました:', e);
                if (!cancelled) setError('テーブル定義書を読み込めませんでした。時間をおいて開き直してください。');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, []);

    // 選んだテーブルの列（⚠️ 速く選び直したときは最後の応答だけ使う）
    useEffect(() => {
        if (selected === '') { setDetail(null); return; }
        const seq = ++detailSeq.current;
        setDetailLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await apiClient.get('', { params: { request: 'table_definition', table: selected } });
                if (!isDetailBody(res?.data)) throw new Error('invalid table_definition detail response');
                if (seq === detailSeq.current) setDetail(res.data);
            } catch (e) {
                console.error('テーブルの列の取得に失敗しました:', e);
                if (seq === detailSeq.current) setDetail(null);
            } finally {
                if (seq === detailSeq.current) setDetailLoading(false);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [selected]);

    /** 検索の文字に当たる列（テーブル名 → 列名の一覧） */
    const keyword = q.trim().toLowerCase();
    const columnHits = useMemo(() => {
        const hits = new Map<string, string[]>();
        if (keyword === '' || !list) return hits;
        for (const c of list.columns) {
            if (!c.column_name.toLowerCase().includes(keyword) && !c.description.toLowerCase().includes(keyword)) continue;
            hits.set(c.table_name, [...(hits.get(c.table_name) ?? []), c.column_name]);
        }
        return hits;
    }, [keyword, list]);

    const rows = useMemo(() => {
        const filtered = (list?.tables ?? []).filter((t) => {
            if (business === UNDOCUMENTED ? t.title !== '' : business !== '' && t.business !== business) return false;
            if (source === UNDOCUMENTED ? t.source !== '' : source !== '' && t.source !== source) return false;
            if (keyword === '') return true;
            return [t.table_name, t.title, t.description].some((s) => s.toLowerCase().includes(keyword)) || columnHits.has(t.table_name);
        });
        const dir = sortOrder === 'asc' ? 1 : -1;
        return filtered.sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [list, business, source, keyword, columnHits, sortKey, sortOrder]);

    const kpi = useMemo(() => {
        const tables = list?.tables ?? [];
        const real = tables.filter((t) => t.exists);
        return {
            tables: real.length,
            documented: real.filter((t) => t.title !== '').length,
            guessed: real.filter((t) => t.source === '推論').length,
            undocumented: real.filter((t) => t.title === '').length,
            missing: tables.filter((t) => !t.exists).length,
        };
    }, [list]);

    const th = (label: string, key: SortKey, width?: number) => {
        const active = sortKey === key;
        return (
            <th className="td_th td_th_sort" style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'rows' || key === 'columns' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`td_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpiCard = (label: string, value: number, tone?: 'warn' | 'bad') => (
        <div className="td_kpi_card">
            <div className="td_kpi_label">{label}</div>
            <div className={`td_kpi_value${tone && value > 0 ? ` is_${tone}` : ''}`}>{value.toLocaleString()}</div>
        </div>
    );

    const hitColumns = new Set(columnHits.get(selected) ?? []);

    return (
        <div className="td_wrap">
            <style>{`
                .td_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .td_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .td_note { font-size: 11px; color: #6b7280; }
                .td_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .td_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .td_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .td_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .td_kpi_label { font-size: 11px; color: #6b7280; }
                .td_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .td_kpi_value.is_warn { color: #b45309; }
                .td_kpi_value.is_bad { color: #b91c1c; }
                .td_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .td_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .td_body { display: flex; gap: 10px; flex: 1 1 auto; min-height: 0; }
                .td_list { flex: 0 0 46%; min-width: 0; }
                .td_detail { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
                .td_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 height: 100%; min-height: 240px; }
                .td_detail .td_table_wrap { height: auto; flex: 1 1 auto; }
                .td_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .td_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .td_th_sort { cursor: pointer; user-select: none; }
                .td_th_sort:hover { background: #eef2f7; }
                .td_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .td_sort_icon.is_active { color: #2563eb; }
                .td_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .td_row { cursor: pointer; }
                .td_row:hover > .td_td { background: #f8fafc; }
                .td_row.is_selected > .td_td { background: #eff6ff; }
                .td_row.is_selected > .td_td:first-child { box-shadow: inset 3px 0 0 #2563eb; }
                .td_row.is_missing > .td_td { color: #9ca3af; }
                .td_col_row.is_hit > .td_td { background: #fefce8; }
                .td_col_row.is_missing > .td_td { color: #9ca3af; text-decoration: line-through; }
                .td_mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; overflow-wrap: anywhere; }
                .td_nowrap { white-space: nowrap; overflow-wrap: normal; }
                .td_num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
                .td_sub { font-size: 11px; color: #9ca3af; }
                .td_hit { font-size: 11px; color: #a16207; overflow-wrap: anywhere; }
                .td_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .td_pill.is_ok { background: #dcfce7; color: #166534; }
                .td_pill.is_guess { background: #fef3c7; color: #92400e; }
                .td_pill.is_none { background: #f3f4f6; color: #6b7280; }
                .td_pill.is_key { background: #e0e7ff; color: #3730a3; }
                .td_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; flex-shrink: 0; }
                .td_card_title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .td_desc { white-space: pre-wrap; line-height: 1.7; margin-top: 6px; overflow-wrap: anywhere; }
                .td_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                .td_placeholder { border: 1px dashed #d1d5db; border-radius: 10px; color: #9ca3af; display: flex; align-items: center;
                                  justify-content: center; height: 100%; min-height: 240px; }
                @media (max-width: 1100px) {
                    .td_body { flex-direction: column; }
                    .td_list { flex: 0 0 auto; height: 420px; }
                }
                @media (max-width: 900px) { .td_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="td_inner">
                <div className="td_note">
                    Dashboard のデータベースのテーブルと列の説明です（閲覧のみ）。型・NULL・既定値はデータベースの今の状態を読んでいます。管理者だけが見られます。
                </div>

                <div className="td_bar">
                    <div>
                        <div className="td_label">検索</div>
                        <input className="form-control form-control-sm" style={{ width: 260 }} value={q}
                            placeholder="テーブル名・列名・説明" onChange={(e) => setQ(e.target.value)} aria-label="検索" />
                    </div>
                    <div>
                        <div className="td_label">事業</div>
                        <select className="form-select form-select-sm" style={{ width: 140 }} value={business}
                            onChange={(e) => setBusiness(e.target.value)} aria-label="事業">
                            <option value="">すべて</option>
                            {Object.entries(BUSINESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            <option value={UNDOCUMENTED}>未記載</option>
                        </select>
                    </div>
                    <div>
                        <div className="td_label">出典</div>
                        <select className="form-select form-select-sm" style={{ width: 130 }} value={source}
                            onChange={(e) => setSource(e.target.value)} aria-label="出典">
                            <option value="">すべて</option>
                            <option value="改修">改修</option>
                            <option value="推論">推論</option>
                            <option value={UNDOCUMENTED}>未記載</option>
                        </select>
                    </div>
                    <div className="td_note" style={{ paddingBottom: 6 }}>{loading ? '読み込み中…' : `${rows.length.toLocaleString()} 件`}</div>
                </div>

                {error !== '' && <div className="td_error" role="alert">{error}</div>}

                {list && (
                    <>
                        <div className="td_kpi">
                            {kpiCard('テーブル', kpi.tables)}
                            {kpiCard('説明あり', kpi.documented)}
                            {kpiCard('推論で書いた', kpi.guessed, 'warn')}
                            {kpiCard('未記載', kpi.undocumented, 'bad')}
                            {kpi.missing > 0 && kpiCard('定義書だけにある', kpi.missing, 'bad')}
                        </div>

                        <div className="td_caution">
                            「改修」はこれまでの改修で扱ったテーブル・列、「推論」は登録されている値から推した説明です（「（推定）」と付いた説明は特に確かめてから使ってください）。
                            行数はデータベースの概算です。説明を直すときは原稿（backend/scripts/tabledef/tables/）を直して、版の SQL で入れます（この画面からは直せません）。
                        </div>

                        <div className="td_body">
                            <div className="td_list">
                                <div className="td_table_wrap">
                                    <table className="td_table">
                                        <thead>
                                            <tr>
                                                {th('テーブル名', 'table_name')}
                                                {th('名前', 'title')}
                                                {th('事業', 'business', 80)}
                                                {th('出典', 'source', 70)}
                                                {th('行数', 'rows', 70)}
                                                {th('列', 'columns', 50)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.length === 0 && (
                                                <tr><td className="td_td td_empty" colSpan={6}>該当するテーブルはありません</td></tr>
                                            )}
                                            {rows.map((t) => {
                                                const hits = columnHits.get(t.table_name);
                                                return (
                                                    <tr key={t.table_name}
                                                        className={`td_row${t.table_name === selected ? ' is_selected' : ''}${t.exists ? '' : ' is_missing'}`}
                                                        onClick={() => setSelected(t.table_name)}>
                                                        <td className="td_td td_mono">
                                                            {t.table_name}
                                                            {hits && <div className="td_hit">列：{hits.slice(0, 5).join('、')}{hits.length > 5 ? ` ほか${hits.length - 5}` : ''}</div>}
                                                        </td>
                                                        <td className="td_td">{t.title || <span className="td_sub">（未記載）</span>}</td>
                                                        <td className="td_td">{BUSINESS[t.business] ?? ''}</td>
                                                        <td className="td_td">{sourcePill(t.source)}</td>
                                                        <td className="td_td td_num">{t.exists ? t.rows.toLocaleString() : '—'}</td>
                                                        <td className="td_td td_num">{t.columns}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="td_detail">
                                {selected === '' && <div className="td_placeholder">左の表でテーブルを選ぶと、列の説明が出ます</div>}
                                {selected !== '' && detailLoading && !detail && <div className="td_placeholder">読み込み中…</div>}
                                {selected !== '' && !detailLoading && !detail && (
                                    <div className="td_error" role="alert">{selected} の列を読み込めませんでした。</div>
                                )}
                                {detail && (
                                    <>
                                        <div className="td_card">
                                            <div className="td_card_title">
                                                <span className="td_mono" style={{ fontSize: 15 }}>{detail.table.table_name}</span>
                                                <span>{detail.table.title}</span>
                                                {sourcePill(detail.table.source)}
                                                {detail.table.business !== '' && <span className="td_pill is_key">{BUSINESS[detail.table.business] ?? detail.table.business}</span>}
                                                {!detail.table.exists && <span className="td_pill is_none">データベースにありません</span>}
                                            </div>
                                            <div className="td_sub">
                                                行数（概算）{detail.table.rows.toLocaleString()}・列 {detail.columns.filter((c) => c.exists).length}
                                                {detail.table.updated_version !== '' && `・説明の更新 v${detail.table.updated_version}`}
                                                {detailLoading && '・読み込み中…'}
                                            </div>
                                            <div className="td_desc">{detail.table.description || detail.table.comment || '（説明はまだありません）'}</div>
                                        </div>
                                        <div className="td_table_wrap">
                                            <table className="td_table">
                                                <thead>
                                                    <tr>
                                                        <th className="td_th" style={{ width: 36 }}>#</th>
                                                        <th className="td_th">列名</th>
                                                        <th className="td_th">型</th>
                                                        <th className="td_th" style={{ width: 48 }}>NULL</th>
                                                        <th className="td_th" style={{ width: 52 }}>キー</th>
                                                        <th className="td_th">既定値</th>
                                                        <th className="td_th">説明</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detail.columns.map((c, i) => (
                                                        <tr key={c.column_name}
                                                            className={`td_col_row${hitColumns.has(c.column_name) ? ' is_hit' : ''}${c.exists ? '' : ' is_missing'}`}>
                                                            <td className="td_td td_num td_sub">{c.exists ? i + 1 : ''}</td>
                                                            <td className="td_td td_mono td_nowrap">{c.column_name}</td>
                                                            <td className="td_td td_mono td_nowrap">
                                                                {c.type}
                                                                {c.extra !== '' && <div className="td_sub">{c.extra}</div>}
                                                            </td>
                                                            <td className="td_td">{c.nullable ? '○' : ''}</td>
                                                            <td className="td_td">{c.key !== '' && <span className="td_pill is_key">{c.key}</span>}</td>
                                                            {/* ⚠️ 既定値が無いとき：NULL を許す列は NULL、許さない列は空 */}
                                                            <td className="td_td td_mono">{c.default_value ?? (c.nullable ? <span className="td_sub">NULL</span> : '')}</td>
                                                            <td className="td_td">
                                                                {c.source === '推論' && <span className="td_pill is_guess" style={{ marginRight: 6 }}>推論</span>}
                                                                {c.description || c.comment || <span className="td_sub">（説明はまだありません）</span>}
                                                                {!c.exists && <div className="td_sub">データベースにこの列はありません</div>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TableDefinition;
