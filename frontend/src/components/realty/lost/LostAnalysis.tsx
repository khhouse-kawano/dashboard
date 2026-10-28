import React, { useEffect, useMemo, useState } from 'react';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import { fyStartOf, periodGroups, periodHas, periodShort, recvMonthKey } from '../common/leadFunnel';
import type { Period } from '../common/leadFunnel';
import { fiscalMonths, pct } from '../summary/kpi';
import type { Row } from '../summary/kpi';

/**
 * 失注・他決の分析（不動産企画係。v2.2.225）。
 *
 * ⚠️ 移植元は本番アプリ（V18）の「🧩 失注・他決の分析」（renderLost）。計算・表・見出し・注記は同じ（括弧の中は移植元の名前）。
 *   売り反響・買い反響は受信月、商談案件は失注日（未入力は登録日）で数える。
 * ⚠️ 他決の詳細（lostWhy・lostTo・lostPrice・lostNote）や商談の失注理由（lostReason・lostDate）は DB の列に無いので、
 *   以前のアプリの原本（raw_data）から読む（rowOf）。
 * ⚠️ 以前のアプリでは表の行を押すと編集画面が開いた。編集は売り反響・商談案件の画面で行う（この画面からは開かない）。
 */

/** 終了理由（LEAD_ENDS） */
const LEAD_ENDS = ['他決', '辞退・売却中止', '連絡不能', '対象外', 'その他'];
/** 商談の失注理由（DEAL_LOST_REASONS） */
const DEAL_LOST_REASONS = ['価格・条件が合わない', '他社で成約（他決）', 'ローン否決・資金計画', '物件の問題（調査・瑕疵など）', 'お客様都合で見送り', '売主都合（売止・価格変更）', '連絡不能', 'その他'];
/** 他決の決め手（LEAD_LOST_WHY） */
const LEAD_LOST_WHY = ['査定額が高かった', '大手の安心感', '知人・紹介・付き合い', '対応が早かった', '手数料・条件', '買取を選んだ', '地元での実績', '不明', 'その他'];
/** 買い反響の終了理由（BUY_ENDS） */
const BUY_ENDS = ['他決', '購入見送り', '連絡不能', '対象外', 'その他'];

const STYLE = `
.rlt-lost-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.rlt-lost-tile { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 4px rgba(0,0,0,.05); }
.rlt-lost-tile .lbl { font-size: 11px; color: #6c757d; font-weight: bold; }
.rlt-lost-tile .val { font-size: 24px; font-weight: bold; color: #212529; font-variant-numeric: tabular-nums; }
.rlt-lost-tile .sub { font-size: 10px; color: #6c757d; margin-top: 2px; }
.rlt-lost-bar { display: inline-block; width: 120px; height: 8px; background: #f1f3f5; border-radius: 4px; overflow: hidden; vertical-align: middle; }
.rlt-lost-bar i { display: block; height: 100%; background: #0d6efd; }
.rlt-lost .rlt-tbl td.num { font-variant-numeric: tabular-nums; }
@media (max-width: 900px) { .rlt-lost-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;

/** 行に原本（raw_data）の項目を足す。⚠️ DB の列にある項目は列の値を優先する */
const rowOf = (r: Row): Row => {
    let raw: Row = {};
    if (typeof r.raw_data === 'string' && r.raw_data !== '') {
        try {
            const p: unknown = JSON.parse(r.raw_data);
            if (p !== null && typeof p === 'object' && !Array.isArray(p)) raw = p as Row;
        } catch { /* 原本が読めなければ列だけ */ }
    }
    return { ...raw, ...r };
};

/** 'YYYY/M/D'（fmtD） */
const fmtD = (ds: unknown): string => {
    if (!ds) return '―';
    const [y, m, d] = str(ds).slice(0, 10).split('-');
    if (!d) return str(ds);
    return `${y}/${Number(m)}/${Number(d)}`;
};

/** 商談の失注月（dealLostMonth）: 失注日、無ければ登録日・接触日 */
const dealLostMonth = (d: Row): string => {
    const v = str(d.lostDate || d.createdAt || d.contactDate).slice(0, 7);
    return /^\d{4}-\d{2}$/.test(v) ? v : '';
};

type Cross = { m: Map<string, Record<string, number>>; keys: string[]; cols: string[] };

/** 行（keyF）× 列（colF）で数える（lostCross）。order は行の並び（無い値は末尾、同じなら件数の多い順） */
const lostCross = (rows: Row[], keyF: (r: Row) => unknown, cols: string[], colF: (r: Row) => unknown, order: string[]): Cross => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
        const k = str(keyF(r)) || '（未入力）';
        const c = str(colF(r)) || '（未割当）';
        if (!m.has(k)) m.set(k, {});
        const o = m.get(k)!;
        o[c] = (o[c] || 0) + 1;
        o.__t = (o.__t || 0) + 1;
    }
    const idx = (k: string) => { const i = order.indexOf(k); return i < 0 ? 99 : i; };
    const keys = [...m.keys()].sort((a, b) => idx(a) - idx(b) || m.get(b)!.__t - m.get(a)!.__t);
    return { m, keys, cols };
};

/** 横棒（lostBar） */
const LostBar: React.FC<{ n: number; max: number }> = ({ n, max }) => (
    <span className="rlt-lost-bar"><i style={{ width: `${max ? Math.round((n / max) * 100) : 0}%` }}></i></span>
);

/** 理由 × 担当などの表（lostTable） */
const LostTable: React.FC<{ title: string; x: Cross; total: number; note?: string }> = ({ title, x, total, note }) => {
    if (!x.keys.length) {
        return (
            <div className="rlt-card">
                <div className="rlt-card-head"><h3>{title}</h3></div>
                <div className="rlt-body"><p className="rlt-sub">該当するデータはありません。</p></div>
            </div>
        );
    }
    const max = Math.max(...x.keys.map(k => x.m.get(k)!.__t));
    const cols = x.cols.filter(c => x.keys.some(k => x.m.get(k)![c]));
    return (
        <div className="rlt-card">
            <div className="rlt-card-head"><h3>{title}</h3>{note && <span className="rlt-note">{note}</span>}</div>
            <div className="rlt-tblwrap">
                <table className="rlt-tbl">
                    <thead><tr>
                        <th>理由</th><th className="r">件数</th><th className="r">割合</th><th style={{ minWidth: 120 }}></th>
                        {cols.map(c => <th key={c} className="r">{c}</th>)}
                    </tr></thead>
                    <tbody>
                        {x.keys.map(k => {
                            const o = x.m.get(k)!;
                            return (
                                <tr key={k}>
                                    <td>{k}</td><td className="r num"><b>{o.__t}</b></td>
                                    <td className="r num">{pct(total ? o.__t / total : null)}</td>
                                    <td><LostBar n={o.__t} max={max} /></td>
                                    {cols.map(c => <td key={c} className="r num">{o[c] || ''}</td>)}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const LostAnalysis: React.FC = () => {
    const [leads, setLeads] = useState<Row[]>([]);
    const [buyLeads, setBuyLeads] = useState<Row[]>([]);
    const [deals, setDeals] = useState<Row[]>([]);
    const [fiscalStart, setFiscalStart] = useState<string | undefined>(undefined);
    const [sources, setSources] = useState<string[]>([]);
    const [staff, setStaff] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    /** 対象期間（S.lostPeriod）。既定は今期の通期（lostPeriod） */
    const [period, setPeriod] = useState<Period>('');

    useEffect(() => {
        loadRecords(['leads', 'buyLeads', 'deals'])
            .then(({ records, settings }) => {
                setLeads(records.leads.map(rowOf));
                setBuyLeads(records.buyLeads.map(rowOf));
                setDeals(records.deals.map(rowOf));
                setFiscalStart(settings.fiscalStart);
                setSources(Array.isArray(settings.sources) ? settings.sources.map(String) : []);
                setStaff((settings.staff ?? []).map(s => str(s.name)).filter(Boolean));
                setPeriod(`fy:${fyStartOf(fiscalMonths(settings.fiscalStart)[0], settings.fiscalStart)}`);
            })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const options = useMemo(() => periodGroups(fiscalStart, leads), [fiscalStart, leads]);

    const v = useMemo(() => {
        const P = period;
        const staffCols = staff.concat(['（未割当）']);
        const leadsP = leads.filter(l => periodHas(P, recvMonthKey(l), fiscalStart));
        const ended = leadsP.filter(l => l.phase === '追客終了');
        const takako = ended.filter(l => l.endReason === '他決');
        const noWhy = takako.filter(l => !l.lostWhy);
        const dealsLost = deals.filter(d => d.phase === '失注' && periodHas(P, dealLostMonth(d), fiscalStart));
        const buyP = buyLeads.filter(b => periodHas(P, recvMonthKey(b), fiscalStart));
        const buyEnded = buyP.filter(b => b.phase === '追客終了');
        const srcCols = [...new Set(sources.concat(ended.map(l => str(l.source) || '（未設定）')))];
        const lp = takako.filter(l => l.lostPrice && l.price);
        const gap = lp.length ? lp.reduce((s, l) => s + (num(l.lostPrice) - num(l.price)), 0) / lp.length : null;
        const co = new Map<string, number>();
        for (const l of takako) if (l.lostTo) co.set(str(l.lostTo), (co.get(str(l.lostTo)) || 0) + 1);
        const coRows = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        return { staffCols, leadsP, ended, takako, noWhy, dealsLost, buyEnded, srcCols, lp, gap, coRows };
    }, [period, leads, buyLeads, deals, sources, staff, fiscalStart]);

    /** 他決・失注の明細 CSV（lostCsv） */
    const downloadCsv = () => {
        const q = (x: unknown) => `"${str(x).replace(/"/g, '""')}"`;
        const rows: unknown[][] = [['区分', '受信日・失注日', '反響元・種別', '氏名・物件', '所在地', '担当', '理由', '決め手', '他決先', '他社価格(万円)', '自社査定額(万円)', 'メモ']];
        for (const l of leads) {
            if (l.phase === '追客終了' && periodHas(period, recvMonthKey(l), fiscalStart)) {
                rows.push(['売り反響', l.receivedDate, l.source, l.name, l.addr, l.staff, l.endReason, l.lostWhy, l.lostTo,
                    l.lostPrice ? Math.round(num(l.lostPrice) / 10000) : '', l.price ? Math.round(num(l.price) / 10000) : '', l.lostNote || l.note]);
            }
        }
        for (const d of deals) {
            if (d.phase === '失注' && periodHas(period, dealLostMonth(d), fiscalStart)) {
                rows.push(['商談案件', d.lostDate || d.createdAt || '', d.type, d.property, '', d.staff, d.lostReason, '', '', '',
                    d.price ? Math.round(num(d.price) / 10000) : '', d.lostNote]);
            }
        }
        const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `失注他決_${periodShort(period)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    if (loading || !period) return <div className="rlt-page"><style>{REALTY_CSS}</style><p className="rlt-sub">読み込み中…</p></div>;

    const { staffCols, leadsP, ended, takako, noWhy, dealsLost, buyEnded, srcCols, lp, gap, coRows } = v;

    return (
        <div className="rlt-page rlt-lost">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-puzzle-piece me-2" style={{ color: '#0d6efd' }}></i>失注・他決の分析</h1>
                <span className="rlt-sub">対象期間：</span>
                <select className="rlt-input" value={period} onChange={e => setPeriod(e.target.value)}>
                    {options.map(g => (
                        <optgroup key={g.label} label={g.label}>
                            {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </optgroup>
                    ))}
                </select>
                <button className="rlt-btn sec" onClick={downloadCsv}>⬇ 他決・失注の明細CSV</button>
            </div>
            <p className="rlt-sub" style={{ marginBottom: 12 }}>
                売り反響・買い反響は受信月、商談案件は失注日（未入力は登録日）で数えます。理由は編集画面の「終了理由」「他決の詳細」「失注理由」から集計。
            </p>

            <div className="rlt-lost-tiles">
                <div className="rlt-lost-tile"><div className="lbl">売り反響（{periodShort(period)}受信）</div><div className="val">{leadsP.length}</div>
                    <div className="sub">うち追客終了 {ended.length}件（{pct(leadsP.length ? ended.length / leadsP.length : null)}）</div></div>
                <div className="rlt-lost-tile"><div className="lbl">他決</div><div className="val">{takako.length}</div>
                    <div className="sub">決め手の入力 {takako.length - noWhy.length}／{takako.length}件</div></div>
                <div className="rlt-lost-tile"><div className="lbl">他社価格 − 自社査定額（平均）</div>
                    <div className="val">{gap === null ? '―' : `${gap >= 0 ? '+' : ''}${Math.round(gap / 10000).toLocaleString()}万円`}</div>
                    <div className="sub">両方が入っている他決 {lp.length}件</div></div>
                <div className="rlt-lost-tile"><div className="lbl">商談案件の失注</div><div className="val">{dealsLost.length}</div>
                    <div className="sub">理由の入力 {dealsLost.filter(d => d.lostReason).length}／{dealsLost.length}件</div></div>
            </div>

            <LostTable title="📨 売り反響：終了理由 × 担当" x={lostCross(ended, l => l.endReason, staffCols, l => l.staff, LEAD_ENDS)} total={ended.length} />
            <LostTable title="📨 売り反響：終了理由 × 反響元" x={lostCross(ended, l => l.endReason, srcCols, l => str(l.source) || '（未設定）', LEAD_ENDS)} total={ended.length} />
            <LostTable title="🏳 他決の決め手 × 担当" x={lostCross(takako, l => l.lostWhy, staffCols, l => l.staff, LEAD_LOST_WHY)} total={takako.length}
                note="「査定額が高かった」が多い場合は、査定の根拠説明・価格の出し方をロープレで重点的に練習する材料になります。" />

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>🏢 他決先（上位10社）</h3></div>
                {coRows.length ? (
                    <div className="rlt-tblwrap">
                        <table className="rlt-tbl">
                            <thead><tr><th>会社</th><th className="r">件数</th><th style={{ minWidth: 120 }}></th></tr></thead>
                            <tbody>
                                {coRows.map(([k, n]) => (
                                    <tr key={k}><td>{k}</td><td className="r num">{n}</td><td><LostBar n={n} max={coRows[0][1]} /></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <div className="rlt-body"><p className="rlt-sub">他決先の入力がまだありません。</p></div>}
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>✏️ 決め手が未入力の他決（{noWhy.length}件）</h3></div>
                {noWhy.length ? (
                    <>
                        <div className="rlt-body" style={{ paddingBottom: 4 }}>
                            <p className="rlt-sub">決め手は「売り反響(一括査定)」の画面で、その反響の編集から入力します。架電キュー・架電ナビで「終了」にした反響は、決め手が空欄のままです。</p>
                        </div>
                        <div className="rlt-tblwrap">
                            <table className="rlt-tbl">
                                <thead><tr><th>受信日</th><th>反響元</th><th>売主候補</th><th>物件所在地</th><th>担当</th></tr></thead>
                                <tbody>
                                    {noWhy.slice(0, 50).map(l => (
                                        <tr key={str(l.id)}><td>{fmtD(l.receivedDate)}</td><td>{str(l.source)}</td><td>{str(l.name)}</td><td>{str(l.addr)}</td><td>{str(l.staff)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : <div className="rlt-body"><p className="rlt-sub">未入力はありません。</p></div>}
            </div>

            <LostTable title="🏷 商談案件：失注理由 × 担当" x={lostCross(dealsLost, d => d.lostReason, staffCols, d => d.staff, DEAL_LOST_REASONS)} total={dealsLost.length} />
            {dealsLost.length > 0 && (
                <div className="rlt-card">
                    <div className="rlt-card-head"><h3>🏷 失注した商談案件</h3><span className="rlt-note">編集は「商談案件」の画面から行います</span></div>
                    <div className="rlt-tblwrap">
                        <table className="rlt-tbl">
                            <thead><tr><th>No.</th><th>物件</th><th>種別</th><th>担当</th><th>失注理由</th><th>詳細</th></tr></thead>
                            <tbody>
                                {dealsLost.map(d => (
                                    <tr key={str(d.id)}>
                                        <td>{str(d.no)}</td><td>{str(d.property)}</td><td>{str(d.type)}</td><td>{str(d.staff)}</td>
                                        <td>{str(d.lostReason) || '（未入力）'}</td><td className="rlt-sub">{str(d.lostNote)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <LostTable title="🏠 買い反響：終了理由 × 担当" x={lostCross(buyEnded, b => b.endReason, staffCols, b => b.staff, BUY_ENDS)} total={buyEnded.length} />
        </div>
    );
};

export default LostAnalysis;
