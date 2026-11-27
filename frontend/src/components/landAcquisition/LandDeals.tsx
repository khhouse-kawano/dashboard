import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useListUrlSync } from '../database/listUrl';
import { useDebounce } from '../database/useDebounce';
import { errorText, fmtNum, landGet, landPost, mapUrlOf, monthLabel, useLandMaster, type LandDeal } from './landApi';
import { DueBadge, LoadState, MapLink, SelSelect, SortTh } from './LandParts';
import LandDealModal from './LandDealModal';
import { LAND_CSS, REPLY_CLASS, STATUS_CLASS } from './landStyle';
import { fyMonths, m2ToTsubo } from './landLogic';

/**
 * 仕入案件一覧（建売営業 → 土地仕入 → 仕入案件一覧。/landDeals。v2.2.311。移行元の「案件一覧」タブ）。
 *
 * ⚠️ ② の land_deal_list（GET）で、絞り込み・並べ替えをした30件ずつを読む。表の下の端に近づいたら次の30件。
 * ⚠️ 条件は URL にも出す（キーは ② と同じ：sel・status・kind・month・due・q・settled・sort・dir）。
 * ⚠️ 一覧のまま、ステータス・買付の返答を直せる（移行元と同じ。② がステータスに合わせて日付を埋める）。
 * ⚠️ 「決済完了の実績」タブ（settled=1）は、決済まで進んだ案件を過去の実績として探す（決済日の新しい順）。
 */

const PAGE_SIZE = 30;
const LOAD_MORE_MARGIN = 200;
const CLOSED = ['契約', '決済完了', '見送り'];

interface ListResponse { rows: LandDeal[]; total: number; sumLots: number; statusCounts: Record<string, number>; replyAct: number }

const LandDeals = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const u = (k: string) => initUrl.get(k) ?? '';
    const qSearch = useDebounce(u('q'), 300);
    const [sel, setSel] = useState(u('sel'));
    const [status, setStatus] = useState(u('status'));
    const [kind, setKind] = useState(u('kind'));
    const [month, setMonth] = useState(u('month'));
    const [due, setDue] = useState(u('due'));
    const [settled, setSettled] = useState(u('settled') === '1');
    const defaultSort = settled ? 'settleDate' : 'infoDate';
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: u('sort') || defaultSort, dir: u('dir') === 'asc' ? 'asc' : 'desc' });

    const [rows, setRows] = useState<LandDeal[]>([]);
    const [meta, setMeta] = useState<Omit<ListResponse, 'rows'> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState<{ id: number | null } | null>(null);
    const seq = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        const add = (k: string, v: string) => { if (v !== '') p[k] = v; };
        add('sel', sel); add('q', qSearch.debouncedValue.trim()); add('month', month);
        if (settled) p.settled = '1';
        else { add('status', status); add('kind', kind); add('due', due); }
        if (sort.key !== (settled ? 'settleDate' : 'infoDate') || sort.dir !== 'desc') { p.sort = sort.key; p.dir = sort.dir; }
        return p;
    }, [sel, qSearch.debouncedValue, month, settled, status, kind, due, sort]);
    useListUrlSync(listParams, 1, 20, []);

    const fetchPage = async (offset: number, limit: number, replace: boolean) => {
        const n = ++seq.current;
        setLoading(true);
        try {
            const r = await landGet<ListResponse>('land_deal_list', { ...listParams, offset, limit });
            if (n !== seq.current) return;
            setRows((prev) => (replace ? r.rows : [...prev.slice(0, offset), ...r.rows]));
            setMeta({ total: r.total, sumLots: r.sumLots, statusCounts: r.statusCounts, replyAct: r.replyAct });
            setError('');
        } catch (e) {
            if (n !== seq.current) return;
            setError(errorText(e, '案件を読み込めませんでした。時間をおいて、もう一度お試しください。'));
        } finally { if (n === seq.current) setLoading(false); }
    };
    const reload = () => void fetchPage(0, Math.max(PAGE_SIZE, rows.length), true);

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

    const onSort = (k: string) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' }));
    const switchTab = (v: boolean) => { setSettled(v); setSort({ key: v ? 'settleDate' : 'infoDate', dir: 'desc' }); };

    /** 一覧のまま直す（ステータス・買付の返答）。⚠️ 戻すときだけ確かめる（移行元と同じ） */
    const patch = async (d: LandDeal, body: Record<string, unknown>) => {
        if (body.status && master && master.statuses.indexOf(String(body.status)) < master.statuses.indexOf(d.status) && d.status !== '見送り'
            && !window.confirm(`${d.vendorName || 'この案件'} のステータスを「${d.status}」から「${body.status}」へ戻します。よろしいですか？`)) return;
        try {
            const r = await landPost<{ deal: LandDeal }>('deal_save', { id: d.id, ...body });
            setRows((list) => list.map((x) => (x.id === d.id ? r.deal : x)));
            setError('');
            if (body.status === '見送り' && !r.deal.lostReason) setModal({ id: d.id }); // ⚠️ 見送りは理由を入れてもらう
        } catch (e) { setError(errorText(e, '保存できませんでした。')); }
    };

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const months = fyMonths(master.settings.fyStart);
    const openCount = Object.entries(meta?.statusCounts ?? {}).filter(([s]) => !CLOSED.includes(s)).reduce((s, [, n]) => s + n, 0);
    const colCount = settled ? 10 : 11;

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                {/* ⚠️ ボタンは左に並べる（右下の Active users の表示に隠れるため） */}
                <div className="ld_head">
                    <span className="ld_title"><i className="fa-solid fa-map-location-dot me-2 text-primary" aria-hidden="true" />仕入案件一覧</span>
                    <button className="ld_btn is_primary" onClick={() => setModal({ id: null })}><i className="fa-solid fa-plus me-1" aria-hidden="true" />案件を登録</button>
                    <div className="ld_tabs">
                        <button className={`ld_btn${!settled ? ' is_on' : ''}`} onClick={() => switchTab(false)}>案件一覧</button>
                        <button className={`ld_btn${settled ? ' is_on' : ''}`} onClick={() => switchTab(true)}>決済完了の実績</button>
                    </div>
                </div>

                <div className="ld_bar">
                    <div><div className="ld_label">担当</div><SelSelect master={master} value={sel} onChange={setSel} /></div>
                    {!settled && (
                        <>
                            <div><div className="ld_label">ステータス</div>
                                <select className="ld_select" value={status} onChange={(e) => setStatus(e.target.value)}>
                                    <option value="">すべて</option>{master.statuses.map((s) => <option key={s}>{s}</option>)}
                                </select></div>
                            <div><div className="ld_label">種別</div>
                                <select className="ld_select" value={kind} onChange={(e) => setKind(e.target.value)}>
                                    <option value="">すべて</option>{(master.options.deal_kind ?? []).map((s) => <option key={s}>{s}</option>)}
                                </select></div>
                            <div><div className="ld_label">買付の返答</div>
                                <select className="ld_select" value={due} onChange={(e) => setDue(e.target.value)}>
                                    <option value="">すべて</option>
                                    <option value="act">要対応（期限超過・本日）</option>
                                    <option value="soon">{master.settings.warnDays}日以内まで</option>
                                    <option value="pending">返答待ちすべて</option>
                                    <option value="unset">返答期日が未設定</option>
                                    <option value="done">返答済み</option>
                                </select></div>
                        </>
                    )}
                    <div><div className="ld_label">{settled ? '決済時期' : '対象期間（5つの日付のどれか）'}</div>
                        <select className="ld_select" value={month} onChange={(e) => setMonth(e.target.value)}>
                            <option value="">すべて</option>
                            <option value="fy">{master.settings.fyStart}年度（6月〜5月）</option>
                            {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select></div>
                    <div><div className="ld_label">検索</div>
                        <input className="ld_input is_wide" placeholder="業者名・所在地・メモ・担当" value={qSearch.inputValue} onChange={qSearch.onChange} /></div>
                    <span className="ld_note">{fmtNum(total)} 件中 {fmtNum(rows.length)} 件を表示{hasMore && '（下へスクロールすると続きを読みます）'}</span>
                </div>

                <div className="ld_kpi">
                    <div className="ld_kpi_card"><div className="ld_kpi_label">該当件数</div><div className="ld_kpi_value">{fmtNum(total)}<small>件</small></div><div className="ld_kpi_sub">絞り込んだ案件</div></div>
                    {!settled && <div className="ld_kpi_card"><div className="ld_kpi_label">進行中</div><div className="ld_kpi_value">{fmtNum(openCount)}<small>件</small></div><div className="ld_kpi_sub">契約・決済完了・見送り以外</div></div>}
                    {!settled && (
                        <div className={`ld_kpi_card is_click${(meta?.replyAct ?? 0) > 0 ? ' is_warn' : ''}`} onClick={() => setDue('act')} title="押すと要対応の案件に絞ります">
                            <div className="ld_kpi_label">買付 返答の要対応</div><div className="ld_kpi_value">{fmtNum(meta?.replyAct)}<small>件</small></div><div className="ld_kpi_sub">期限超過・本日が期日</div>
                        </div>
                    )}
                    <div className="ld_kpi_card"><div className="ld_kpi_label">契約済の区画</div><div className="ld_kpi_value">{fmtNum(meta?.sumLots)}<small>区画</small></div><div className="ld_kpi_sub">契約・決済完了の区画数</div></div>
                    {!settled && master.statuses.map((s) => (
                        <div key={s} className={`ld_kpi_card is_click${status === s ? ' is_warn' : ''}`} onClick={() => setStatus(status === s ? '' : s)}>
                            <div className="ld_kpi_label"><span className={`ld_pill ${STATUS_CLASS[s]}`}>{s}</span></div>
                            <div className="ld_kpi_value">{fmtNum(meta?.statusCounts?.[s] ?? 0)}<small>件</small></div>
                        </div>
                    ))}
                </div>

                <LoadState loading={false} error={error} />

                <div className="ld_table_wrap is_fill" ref={scrollRef} onScroll={loadMoreIfNearBottom}>
                    <table className="ld_table">
                        <thead>
                            {settled ? (
                                <tr>
                                    <SortTh label="決済日" k="settleDate" sort={sort} onSort={onSort} />
                                    <SortTh label="担当" k="memberName" sort={sort} onSort={onSort} />
                                    <SortTh label="情報提供業者 / 売主・媒介" k="vendorName" sort={sort} onSort={onSort} />
                                    <th className="ld_th">所在地</th>
                                    <th className="ld_th ld_num">地積</th>
                                    <SortTh label="区画" k="lots" sort={sort} onSort={onSort} num />
                                    <SortTh label="購入金額" k="price" sort={sort} onSort={onSort} num />
                                    <SortTh label="坪単価" k="tsuboUnit" sort={sort} onSort={onSort} num />
                                    <th className="ld_th">契約条件</th>
                                    <th className="ld_th" />
                                </tr>
                            ) : (
                                <tr>
                                    <SortTh label="取得日" k="infoDate" sort={sort} onSort={onSort} />
                                    <SortTh label="担当" k="memberName" sort={sort} onSort={onSort} />
                                    <SortTh label="業者名" k="vendorName" sort={sort} onSort={onSort} />
                                    <th className="ld_th">所在地</th>
                                    <th className="ld_th">種別</th>
                                    <SortTh label="区画" k="lots" sort={sort} onSort={onSort} num />
                                    <SortTh label="ステータス" k="status" sort={sort} onSort={onSort} />
                                    <SortTh label="買付の返答" k="replyDue" sort={sort} onSort={onSort} />
                                    <SortTh label="最終更新" k="updatedAt" sort={sort} onSort={onSort} />
                                    <th className="ld_th" />
                                    <th className="ld_th" />
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {rows.map((d) => {
                                const map = mapUrlOf(d.address, d.mapUrl);
                                const tsubo = m2ToTsubo(d.landM2);
                                if (settled) {
                                    const price = d.buyPrice ?? d.price;
                                    return (
                                        <tr key={d.id} className="ld_row">
                                            <td className="ld_td ld_nowrap"><b>{d.settleDate || d.contractDate || '—'}</b>{d.contractDate && <div className="ld_sub">契約 {d.contractDate}</div>}</td>
                                            <td className="ld_td ld_nowrap">{d.memberName || '—'}</td>
                                            <td className="ld_td"><b>{d.vendorName || '—'}</b>{d.sellerName && <div className="ld_sub">売主：{d.sellerName}</div>}{d.agentName && <div className="ld_sub">媒介：{d.agentName}</div>}</td>
                                            <td className="ld_td">{d.address || '—'}<MapLink url={map} /></td>
                                            <td className="ld_td ld_num">{d.landM2 === null ? '—' : <>{fmtNum(d.landM2, 2)}<div className="ld_sub">{tsubo}坪</div></>}</td>
                                            <td className="ld_td ld_num"><b>{d.lots}</b></td>
                                            <td className="ld_td ld_num">{price === null ? '—' : <>{fmtNum(price, 1)}<div className="ld_sub">万円{d.buyPrice === null ? '（想定）' : ''}</div></>}</td>
                                            <td className="ld_td ld_num">{d.tsuboUnit === null ? '—' : <><b>{d.tsuboUnit}</b><div className="ld_sub">万円/坪</div></>}</td>
                                            <td className="ld_td">{d.terms && <span className="ld_pill">{d.terms}</span>}{d.termsMemo && <div className="ld_sub">{d.termsMemo}</div>}</td>
                                            <td className="ld_td"><button className="ld_btn is_sm" onClick={() => setModal({ id: d.id })}>開く</button></td>
                                        </tr>
                                    );
                                }
                                const showReply = d.status === '買付' || d.replyDue || d.replyResult;
                                return (
                                    <tr key={d.id} className={`ld_row${d.replyLevel === 'over' || d.replyLevel === 'today' ? ' is_due' : ''}`}>
                                        <td className="ld_td ld_nowrap">{d.infoDate || '—'}</td>
                                        <td className="ld_td ld_nowrap">{d.memberName || '—'}</td>
                                        <td className="ld_td"><b>{d.vendorName || '—'}</b>{(d.sellerName || d.agentName) && <div className="ld_sub">{[d.sellerName && `売主：${d.sellerName}`, d.agentName && `媒介：${d.agentName}`].filter(Boolean).join('／')}</div>}</td>
                                        <td className="ld_td">{d.address || '—'}<MapLink url={map} />{tsubo !== null && <div className="ld_sub">{fmtNum(d.landM2, 2)}㎡（{tsubo}坪）</div>}</td>
                                        <td className="ld_td ld_nowrap">{d.kind}</td>
                                        <td className="ld_td ld_num">{d.lots}{d.tsuboUnit !== null && <div className="ld_sub">{d.tsuboUnit} 万/坪</div>}</td>
                                        <td className="ld_td">
                                            <select className={`ld_pill ${STATUS_CLASS[d.status] ?? ''}`} value={d.status} onChange={(e) => void patch(d, { status: e.target.value })} aria-label="ステータスを変える">
                                                {master.statuses.map((s) => <option key={s}>{s}</option>)}
                                            </select>
                                            {(d.status === '見送り' || d.replyResult === '否決') && <div className="ld_sub">理由：{d.lostReason || '未登録'}</div>}
                                        </td>
                                        <td className="ld_td ld_nowrap">
                                            {showReply ? (
                                                <>
                                                    {d.replyDue && <div className="ld_sub">{d.replyDue}</div>}
                                                    <select className={`ld_pill ${d.replyResult ? REPLY_CLASS[d.replyResult] ?? '' : 's-wait'}`} value={d.replyResult}
                                                        onChange={(e) => void patch(d, { replyResult: e.target.value, ...(e.target.value && !d.replyDate ? { replyDate: master.today } : {}) })} aria-label="買付の返答を変える">
                                                        <option value="">返答待ち</option>{(master.options.reply_result ?? []).map((s) => <option key={s}>{s}</option>)}
                                                    </select>
                                                    {!d.replyResult && <div><DueBadge level={d.replyLevel} days={d.replyDays} /></div>}
                                                </>
                                            ) : <span className="ld_sub">—</span>}
                                        </td>
                                        <td className="ld_td ld_nowrap"><span className="ld_sub">{d.updatedAt.slice(0, 10)}{d.updatedBy && ` ${d.updatedBy}`}</span></td>
                                        <td className="ld_td">{d.nextStatus && <button className="ld_btn is_sm" onClick={() => void patch(d, { status: d.nextStatus })}>{d.nextStatus}へ</button>}</td>
                                        <td className="ld_td"><button className="ld_btn is_sm" onClick={() => setModal({ id: d.id })}>開く</button></td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && <tr><td className="ld_td ld_empty" colSpan={colCount}>{loading ? '読み込み中…' : '条件に合う案件がありません。'}</td></tr>}
                            {rows.length > 0 && (hasMore || loading) && (
                                <tr><td className="ld_more" colSpan={colCount}>{loading ? '読み込み中…' : '下へスクロールすると続きを読みます'}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {modal && (
                <LandDealModal show master={master} dealId={modal.id} onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); reload(); }} />
            )}
        </div>
    );
};

export default LandDeals;
