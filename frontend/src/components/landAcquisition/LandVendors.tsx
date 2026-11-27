import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useListUrlSync } from '../database/listUrl';
import { useDebounce } from '../database/useDebounce';
import { errorText, fmtNum, landGet, useLandMaster, type LandVendor } from './landApi';
import { LoadState, SelSelect, SortTh } from './LandParts';
import LandVendorModal from './LandVendorModal';
import { downloadCsv, fetchAllRows, stamp } from './landCsv';
import { LAND_CSS } from './landStyle';

/**
 * 業者マスタ（建売営業 → 土地仕入 → 業者マスタ。/landVendors。v2.2.311。移行元の「業者マスタ」タブ）。
 *
 * ⚠️ ② の land_vendor_list（GET）で、絞り込み・並べ替えをした30件ずつ。表の下の端に近づいたら次の30件。
 * ⚠️ 条件は URL にも出す（q・vkind・rank・temp・sel・sort・dir）。sel は社内担当（エリアの合算も選べる）。
 * ⚠️ 最終接触 ＝ アプローチの記録の最後の日と最終訪問日の、新しいほう。60日以上空くと赤くする（移行元と同じ）。
 */

const PAGE_SIZE = 30;
const LOAD_MORE_MARGIN = 200;
interface ListResponse { rows: LandVendor[]; total: number; rankCounts: Record<string, number>; stale60: number; apMonthTotal: number; buyTotal: number }

const LandVendors = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const u = (k: string) => initUrl.get(k) ?? '';
    const qSearch = useDebounce(u('q'), 300);
    const [vkind, setVkind] = useState(u('vkind'));
    const [rank, setRank] = useState(u('rank'));
    const [temp, setTemp] = useState(u('temp'));
    const [sel, setSel] = useState(u('sel'));
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: u('sort') || 'lastContact', dir: u('dir') === 'asc' ? 'asc' : 'desc' });
    const [rows, setRows] = useState<LandVendor[]>([]);
    const [meta, setMeta] = useState<Omit<ListResponse, 'rows'> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState<{ id: number | null } | null>(null);
    const seq = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        const add = (k: string, v: string) => { if (v !== '') p[k] = v; };
        add('q', qSearch.debouncedValue.trim()); add('vkind', vkind); add('rank', rank); add('temp', temp); add('sel', sel);
        if (sort.key !== 'lastContact' || sort.dir !== 'desc') { p.sort = sort.key; p.dir = sort.dir; }
        return p;
    }, [qSearch.debouncedValue, vkind, rank, temp, sel, sort]);
    useListUrlSync(listParams, 1, 20, []);

    const fetchPage = async (offset: number, limit: number, replace: boolean) => {
        const n = ++seq.current;
        setLoading(true);
        try {
            const r = await landGet<ListResponse>('land_vendor_list', { ...listParams, offset, limit });
            if (n !== seq.current) return;
            setRows((prev) => (replace ? r.rows : [...prev.slice(0, offset), ...r.rows]));
            setMeta({ total: r.total, rankCounts: r.rankCounts, stale60: r.stale60, apMonthTotal: r.apMonthTotal, buyTotal: r.buyTotal });
            setError('');
        } catch (e) {
            if (n !== seq.current) return;
            setError(errorText(e, '業者マスタを読み込めませんでした。'));
        } finally { if (n === seq.current) setLoading(false); }
    };
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        const t = window.setTimeout(() => { void fetchPage(0, PAGE_SIZE, true); }, 0);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listParams]);
    const total = meta?.total ?? 0;
    const hasMore = rows.length < total;
    const loadMoreIfNearBottom = () => {
        const el = scrollRef.current;
        if (!el || loading || !hasMore || el.scrollHeight - el.scrollTop - el.clientHeight >= LOAD_MORE_MARGIN) return;
        void fetchPage(rows.length, PAGE_SIZE, false);
    };
    useEffect(() => {
        loadMoreIfNearBottom();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, rows.length, total]);
    /** 今の条件で全件を CSV に（移行元の業者マスタの書き出しと同じ列） */
    const [exporting, setExporting] = useState(false);
    const exportCsv = async () => {
        setExporting(true);
        try {
            const all = await fetchAllRows<LandVendor>('land_vendor_list', listParams);
            downloadCsv(`業者マスタ_${stamp()}.csv`, [
                ['担当', (v) => v.ownerName], ['業者名', (v) => v.name], ['住所', (v) => v.addr], ['ランク', (v) => v.rank], ['担当者名', (v) => v.contact],
                ['最終訪問日', (v) => v.lastVisit], ['経過日数', (v) => v.daysSince ?? ''], ['温度感', (v) => v.temp], ['買取数', (v) => v.buyCount], ['備考', (v) => v.memo],
                ['決済完了区画', (v) => v.settledLots ?? 0], ['買取実績合計', (v) => v.buyTotal ?? 0], ['区分', (v) => v.vkind], ['電話番号', (v) => v.tel], ['メール', (v) => v.email],
                ['エリア', (v) => v.area], ['ホームページ', (v) => v.url], ['AP回数', (v) => v.ap ?? 0], ['AP(当月)', (v) => v.apMonth ?? 0], ['AP(期別)', (v) => v.apFy ?? 0],
                ['案件数', (v) => v.deals ?? 0], ['最終接触', (v) => v.lastContact ?? ''],
            ], all);
        } catch (e) { setError(errorText(e, '書き出せませんでした。')); } finally { setExporting(false); }
    };

    const onSort = (k: string) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' }));

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head">
                    <span className="ld_title"><i className="fa-solid fa-building me-2 text-primary" aria-hidden="true" />業者マスタ</span>
                    <button className="ld_btn is_primary" onClick={() => setModal({ id: null })}><i className="fa-solid fa-plus me-1" aria-hidden="true" />業者を追加</button>
                    <button className="ld_btn" disabled={exporting} onClick={() => void exportCsv()}><i className="fa-solid fa-file-csv me-1" aria-hidden="true" />{exporting ? '書き出し中…' : 'CSV で書き出す'}</button>
                </div>
                <div className="ld_bar">
                    <div><div className="ld_label">検索</div><input className="ld_input is_wide" placeholder="業者名・担当者名・住所・電話・メモ" value={qSearch.inputValue} onChange={qSearch.onChange} /></div>
                    <div><div className="ld_label">区分</div>
                        <select className="ld_select" value={vkind} onChange={(e) => setVkind(e.target.value)}><option value="">すべて</option>{(master.options.vendor_kind ?? []).map((v) => <option key={v}>{v}</option>)}</select></div>
                    <div><div className="ld_label">ランク</div>
                        <select className="ld_select" value={rank} onChange={(e) => setRank(e.target.value)}><option value="">すべて</option>{['A', 'B', 'C', 'D', 'E'].map((v) => <option key={v}>{v}</option>)}<option value="-">未設定</option></select></div>
                    <div><div className="ld_label">温度感</div>
                        <select className="ld_select" value={temp} onChange={(e) => setTemp(e.target.value)}><option value="">すべて</option>{['◎', '〇', '△', '✕'].map((v) => <option key={v}>{v}</option>)}<option value="-">未設定</option></select></div>
                    <div><div className="ld_label">社内担当</div><SelSelect master={master} value={sel} onChange={setSel} allLabel="すべて" /></div>
                    <span className="ld_note">{fmtNum(total)} 社中 {fmtNum(rows.length)} 社を表示{hasMore && '（下へスクロールすると続きを読みます）'}</span>
                </div>
                <div className="ld_kpi">
                    <div className="ld_kpi_card"><div className="ld_kpi_label">該当の業者</div><div className="ld_kpi_value">{fmtNum(total)}<small>社</small></div><div className="ld_kpi_sub">絞り込んだ業者</div></div>
                    {['A', 'B', 'C'].map((r) => (
                        <div key={r} className={`ld_kpi_card is_click${rank === r ? ' is_warn' : ''}`} onClick={() => setRank(rank === r ? '' : r)}>
                            <div className="ld_kpi_label">ランク {r}</div><div className="ld_kpi_value">{fmtNum(meta?.rankCounts?.[r] ?? 0)}<small>社</small></div>
                        </div>
                    ))}
                    <div className={`ld_kpi_card${(meta?.stale60 ?? 0) > 0 ? ' is_warn' : ''}`}><div className="ld_kpi_label">60日以上 接触なし</div><div className="ld_kpi_value">{fmtNum(meta?.stale60)}<small>社</small></div><div className="ld_kpi_sub">最終接触から</div></div>
                    <div className="ld_kpi_card"><div className="ld_kpi_label">当月のアプローチ</div><div className="ld_kpi_value">{fmtNum(meta?.apMonthTotal)}<small>件</small></div><div className="ld_kpi_sub">1件ずつの記録</div></div>
                    <div className="ld_kpi_card"><div className="ld_kpi_label">買取実績の合計</div><div className="ld_kpi_value">{fmtNum(meta?.buyTotal)}<small>区画</small></div><div className="ld_kpi_sub">手入力＋決済完了</div></div>
                </div>
                <LoadState loading={false} error={error} />
                <div className="ld_table_wrap is_fill" ref={scrollRef} onScroll={loadMoreIfNearBottom}>
                    <table className="ld_table">
                        <thead><tr>
                            <SortTh label="業者名" k="name" sort={sort} onSort={onSort} />
                            <th className="ld_th">区分</th>
                            <SortTh label="ランク" k="rank" sort={sort} onSort={onSort} />
                            <SortTh label="温度感" k="temp" sort={sort} onSort={onSort} />
                            <SortTh label="社内担当" k="ownerName" sort={sort} onSort={onSort} />
                            <th className="ld_th">先方の担当者・連絡先</th>
                            <SortTh label="最終接触" k="lastContact" sort={sort} onSort={onSort} />
                            <SortTh label="AP（当月）" k="apMonth" sort={sort} onSort={onSort} num />
                            <SortTh label="AP（累計）" k="ap" sort={sort} onSort={onSort} num />
                            <SortTh label="案件" k="deals" sort={sort} onSort={onSort} num />
                            <SortTh label="買取実績" k="buyTotal" sort={sort} onSort={onSort} num />
                        </tr></thead>
                        <tbody>
                            {rows.map((v) => (
                                <tr key={v.id} className="ld_row is_click" onClick={() => setModal({ id: v.id })}>
                                    <td className="ld_td"><b>{v.name}</b>{v.addr && <div className="ld_sub">{v.addr}</div>}</td>
                                    <td className="ld_td ld_nowrap">{v.vkind}</td>
                                    <td className="ld_td">{v.rank ? <span className={`ld_pill${v.rank === 'A' ? ' s-offer' : v.rank === 'B' ? ' s-info' : ''}`}>{v.rank}</span> : <span className="ld_sub">—</span>}</td>
                                    <td className="ld_td">{v.temp || <span className="ld_sub">—</span>}</td>
                                    <td className="ld_td ld_nowrap">{v.ownerName || '—'}</td>
                                    <td className="ld_td">{v.contact || ''}{(v.tel || v.email) && <div className="ld_sub">{[v.tel, v.email].filter(Boolean).join('／')}</div>}</td>
                                    <td className="ld_td ld_nowrap">{v.lastContact ?? '—'}
                                        {v.daysSince !== null && v.daysSince !== undefined && <div className="ld_sub" style={v.daysSince >= 60 ? { color: '#b91c1c' } : v.daysSince >= 30 ? { color: '#b45309' } : undefined}>{v.daysSince}日前</div>}</td>
                                    <td className="ld_td ld_num">{v.apMonth}</td>
                                    <td className="ld_td ld_num">{v.ap}</td>
                                    <td className="ld_td ld_num">{v.deals}</td>
                                    <td className="ld_td ld_num">{v.buyTotal}{(v.settledLots ?? 0) > 0 && <div className="ld_sub">決済 {v.settledLots}</div>}</td>
                                </tr>
                            ))}
                            {rows.length === 0 && <tr><td className="ld_td ld_empty" colSpan={11}>{loading ? '読み込み中…' : '条件に合う業者がありません。'}</td></tr>}
                            {rows.length > 0 && (hasMore || loading) && <tr><td className="ld_more" colSpan={11}>{loading ? '読み込み中…' : '下へスクロールすると続きを読みます'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
            {modal && <LandVendorModal show master={master} vendorId={modal.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); void fetchPage(0, Math.max(PAGE_SIZE, rows.length), true); }} />}
        </div>
    );
};

export default LandVendors;
