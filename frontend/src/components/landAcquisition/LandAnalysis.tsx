import React, { useMemo, useState } from 'react';
import { useListUrlSync } from '../database/listUrl';
import { fmtNum, landGet, monthLabel, selLabel, useAsync, useLandMaster } from './landApi';
import { LoadState, SelSelect } from './LandParts';
import { LAND_CSS } from './landStyle';
import { BN_DROP_PT, BN_DROP_RATE, BN_MIN_BASE, FUNNEL_STAGES, fyMonths, type BnRow, type Conv } from './landLogic';

/**
 * 仕入分析（建売営業 → 土地仕入 → 仕入分析。/landAnalysis。v2.2.311。移行元の「ダッシュボード」の分析の部分）。
 *
 * ⚠️ 数字は ② の land_analysis（GET）。式は logic.ts（移行元の convOf・bottleneckScoped・heatmapHTML と同じ）。
 * ⚠️ ボトルネック：相対で15%以上かつ3ポイント以上下がり、母数が3件以上の工程だけを「低下」にする。
 *   毎月＝先月比とチーム比（チーム全体のときは年度平均比）／通期＝年間目標から逆算した転換率と比べる。
 * ⚠️ 条件は URL にも出す（sel・scope・month・heat）。
 */

interface Analysis {
    fy: number; months: string[]; scope: string; month: string;
    bottleneck: { rows: BnRow[]; worst: BnRow | null };
    convRows: { label: string; kind: string; conv: Conv }[];
    heatmap: { months: string[]; metric: string; rows: { label: string; kind: string; cells: (number | null)[]; fy: number | null }[] };
    lost: { total: number; lots: number; byReason: Record<string, number> };
    settled: { count: number; lots: number }; contract: { count: number; lots: number };
    info: { total: number; deal: number; ap: number; log: number }; apManual: number;
    stock: { id: number; memberName: string; areaName: string; proper: number; stock: number; sales: number; group: string }[];
}

/** 達成率の色（移行元の heatStyle と同じ考え方） */
const heatStyle = (p: number | null): React.CSSProperties => {
    if (p === null) return { background: '#f3f4f6', color: '#9ca3af' };
    if (p >= 100) return { background: `rgba(22,163,74,${Math.min(0.55, 0.15 + p / 300).toFixed(2)})` };
    if (p >= 70) return { background: `rgba(245,158,11,${(0.14 + (p / 100) * 0.3).toFixed(2)})` };
    return { background: `rgba(239,68,68,${(0.1 + ((100 - p) / 100) * 0.32).toFixed(2)})` };
};
const gapText = (g: number) => <span style={{ color: g < 0 ? '#b91c1c' : g > 0 ? '#15803d' : undefined, fontWeight: 700 }}>{g > 0 ? '+' : ''}{g}</span>;
const fillOf = (proper: number, stock: number) => (proper > 0 ? Math.round((stock / proper) * 100) : null);

const LandAnalysis = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const [sel, setSel] = useState(initUrl.get('sel') ?? '');
    const [scope, setScope] = useState(initUrl.get('scope') === 'fy' ? 'fy' : 'month');
    const [month, setMonth] = useState(initUrl.get('month') ?? '');
    const [heat, setHeat] = useState(initUrl.get('heat') ?? '');
    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        if (sel) p.sel = sel;
        if (scope === 'fy') p.scope = 'fy';
        if (month) p.month = month;
        if (heat) p.heat = heat;
        return p;
    }, [sel, scope, month, heat]);
    useListUrlSync(listParams, 1, 20, []);
    const { data, loading, error } = useAsync(() => landGet<Analysis>('land_analysis', listParams), [listParams]);

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const months = fyMonths(master.settings.fyStart);
    const who = selLabel(master, sel);
    const period = data ? (data.scope === 'fy' ? `${data.fy}年度の累計` : monthLabel(data.month)) : '';
    const lostRows = data ? Object.entries(data.lost.byReason).sort((a, b) => b[1] - a[1]) : [];
    const lostMax = lostRows.reduce((m, [, n]) => Math.max(m, n), 0);
    const stockGroups = data ? Array.from(new Set(data.stock.map((s) => s.group))) : [];
    const stockSum = (rows: Analysis['stock']) => rows.reduce((a, r) => ({ proper: a.proper + r.proper, stock: a.stock + r.stock, sales: a.sales + r.sales }), { proper: 0, stock: 0, sales: 0 });

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}{`
                .la_bn { display: grid; grid-template-columns: 170px 90px 1fr auto; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
                .la_bn.is_bad { color: #b91c1c; }
                .la_bar { height: 8px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
                .la_bar > i { display: block; height: 100%; background: #2563eb; }
                .la_bn.is_bad .la_bar > i { background: #ef4444; }
                .la_chip { font-size: 10px; border-radius: 999px; padding: 1px 8px; background: #f3f4f6; color: #4b5563; margin-left: 4px; white-space: nowrap; }
                .la_chip.is_bad { background: #fee2e2; color: #b91c1c; }
                .la_chip.is_ok { background: #dcfce7; color: #15803d; }
                .la_heat td.la_cell { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; min-width: 44px; }
                .la_heat tr.is_area td, .la_heat tr.is_team td { border-top: 1px solid #e5e7eb; }
                .la_lost { display: grid; grid-template-columns: 140px 1fr 50px; gap: 8px; align-items: center; margin: 4px 0; }
                @media print { .ld_bar, .ld_head button { display: none !important; } }
            `}</style>
            <div className="ld_inner">
                <div className="ld_head">
                    <span className="ld_title"><i className="fa-solid fa-magnifying-glass-chart me-2 text-primary" aria-hidden="true" />仕入分析</span>
                    <button className="ld_btn" onClick={() => window.print()}><i className="fa-solid fa-print me-1" aria-hidden="true" />印刷 / PDF</button>
                </div>
                <div className="ld_bar">
                    <div><div className="ld_label">担当</div><SelSelect master={master} value={sel} onChange={setSel} /></div>
                    <div><div className="ld_label">集計期間</div>
                        <div className="ld_seg">
                            <button className={scope === 'month' ? 'is_on' : ''} onClick={() => setScope('month')}>毎月</button>
                            <button className={scope === 'fy' ? 'is_on' : ''} onClick={() => setScope('fy')}>通期</button>
                        </div></div>
                    {scope === 'month' && (
                        <div><div className="ld_label">対象月</div>
                            <select className="ld_select" value={month || data?.month || ''} onChange={(e) => setMonth(e.target.value)}>
                                {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                            </select></div>
                    )}
                    <span className="ld_note">{period}　{who}</span>
                </div>
                <LoadState loading={loading && !data} error={error} />
                {data && (
                    <>
                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">ボトルネック診断（{period}の転換率）</span></div>
                            {data.bottleneck.worst ? (
                                <div className="ld_error mb-2">
                                    <b>{who}：{data.bottleneck.worst.label}の転換率が下がっています</b>（{data.bottleneck.worst.cmps.filter((x) => x.v?.bad).map((x) => `${x.label} ${x.v!.rel}%`).join(' / ')}）。
                                    {period} {data.bottleneck.worst.cur}%（{data.bottleneck.worst.num}/{data.bottleneck.worst.den}件）。この工程に手を打つのが近道です。
                                </div>
                            ) : (
                                <div className="ld_ok mb-2"><b>{who}：目立った転換率の低下はありません</b></div>
                            )}
                            {data.bottleneck.rows.map((r) => (
                                <div key={r.key} className={`la_bn${r.bad ? ' is_bad' : ''}`}>
                                    <div>{r.bad && '▲ '}{r.label}</div>
                                    <div className="ld_num"><b>{r.cur === null ? '—' : `${r.cur}%`}</b><div className="ld_sub">{r.num}/{r.den}件</div></div>
                                    <div className="la_bar"><i style={{ width: `${Math.min(100, r.cur ?? 0)}%` }} /></div>
                                    <div>{r.cmps.map((c) => (
                                        <span key={c.label} className={`la_chip${c.v?.bad ? ' is_bad' : c.judged && c.v && c.v.rel >= 0 ? ' is_ok' : ''}`} title={c.v ? `基準 ${c.v.base}%` : '比べられません'}>
                                            {c.label} {c.v ? `${c.v.rel > 0 ? '+' : ''}${c.v.rel}%` : '—'}
                                        </span>))}</div>
                                </div>
                            ))}
                            <div className="ld_note mt-2">母数が{BN_MIN_BASE}件未満の工程は「—」にして判定から外します。相対{BN_DROP_RATE}%以上かつ{BN_DROP_PT}ポイント以上下がった工程を「低下」にします。{data.scope === 'fy' && '通期は、年間目標から逆算した転換率と比べます。'}</div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">担当者別 工程別転換率（{period}）</span></div>
                            <div className="ld_table_wrap">
                                <table className="ld_table"><thead><tr><th className="ld_th">担当</th>{FUNNEL_STAGES.map((s) => <th key={s.k} className="ld_th ld_num">{s.label}</th>)}</tr></thead>
                                    <tbody>{data.convRows.map((r) => (
                                        <tr key={r.label} className="ld_row">
                                            <td className="ld_td ld_nowrap">{r.kind === 'member' ? r.label : <b>{r.label}</b>}</td>
                                            {FUNNEL_STAGES.map((s) => <td key={s.k} className="ld_td ld_num">{r.conv[s.k].pct === null ? '—' : `${r.conv[s.k].pct}%`}<div className="ld_sub">{r.conv[s.k].num}/{r.conv[s.k].den}</div></td>)}
                                        </tr>))}</tbody></table>
                            </div>
                            <div className="ld_note mt-1">いちばん下は目標から逆算した転換率です。これを下回っている工程が、その担当者の詰まりどころです。</div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head">
                                <span className="ld_card_title">達成率ヒートマップ（{data.fy}年度）</span>
                                <select className="ld_select" value={heat} onChange={(e) => setHeat(e.target.value)}>
                                    <option value="">平均達成率（全指標）</option>
                                    {master.kpiDefs.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                                </select>
                            </div>
                            <div className="ld_table_wrap">
                                <table className="ld_table la_heat"><thead><tr>
                                    <th className="ld_th">担当</th>{data.heatmap.months.map((m) => <th key={m} className="ld_th ld_num">{Number(m.slice(5))}月</th>)}<th className="ld_th ld_num">通期</th>
                                </tr></thead>
                                    <tbody>{data.heatmap.rows.map((r) => (
                                        <tr key={`${r.kind}-${r.label}`} className={`is_${r.kind}`}>
                                            <td className="ld_td ld_nowrap">{r.kind === 'member' ? r.label : <b>{r.label}</b>}</td>
                                            {r.cells.map((p, i) => <td key={i} className="ld_td la_cell" style={heatStyle(p)}>{p === null ? '—' : p}</td>)}
                                            <td className="ld_td la_cell" style={heatStyle(r.fy)}>{r.fy === null ? '—' : r.fy}</td>
                                        </tr>))}</tbody></table>
                            </div>
                            <div className="ld_note mt-1">数字は達成率（%）です。緑＝100%以上、黄＝70%以上、赤＝70%未満。目標が無い月は「—」です。</div>
                        </div>

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">失注・見送りの要因（{period}）</span><span className={`ld_badge${data.lost.total ? ' is_warn' : ''}`}>{data.lost.total}件 / {data.lost.lots}区画</span></div>
                                {lostRows.length === 0 ? <div className="ld_note">対象期間に見送り・否決になった案件はありません。</div> : lostRows.map(([k, n]) => (
                                    <div key={k} className="la_lost"><span>{k}</span><div className="la_bar"><i style={{ width: `${lostMax ? Math.round((n / lostMax) * 100) : 0}%`, background: k === '未登録' ? '#9ca3af' : '#ef4444' }} /></div><span className="ld_num">{n}件</span></div>
                                ))}
                                <div className="ld_note mt-1">対象は、期間中に5つの日付のどれかが入った案件のうち、ステータスが見送り、または買付の返答が否決のものです。</div>
                            </div>
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">情報取得の内訳・契約（{period}）</span></div>
                                <div className="ld_kpi">
                                    <div className="ld_kpi_card"><div className="ld_kpi_label">情報取得 合計</div><div className="ld_kpi_value">{fmtNum(data.info.total)}<small>件</small></div></div>
                                    <div className="ld_kpi_card"><div className="ld_kpi_label">案件として登録</div><div className="ld_kpi_value">{fmtNum(data.info.deal)}<small>件</small></div></div>
                                    <div className="ld_kpi_card"><div className="ld_kpi_label">アプローチで数えた分</div><div className="ld_kpi_value">{fmtNum(data.info.ap)}<small>件</small></div></div>
                                    <div className="ld_kpi_card"><div className="ld_kpi_label">まとめ入力の分</div><div className="ld_kpi_value">{fmtNum(data.info.log)}<small>件</small></div></div>
                                    <div className="ld_kpi_card"><div className="ld_kpi_label">契約</div><div className="ld_kpi_value">{fmtNum(data.contract.count)}<small>件</small></div><div className="ld_kpi_sub">{data.contract.lots}区画</div></div>
                                    <div className="ld_kpi_card"><div className="ld_kpi_label">決済完了</div><div className="ld_kpi_value">{fmtNum(data.settled.count)}<small>件</small></div><div className="ld_kpi_sub">{data.settled.lots}区画</div></div>
                                </div>
                            </div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">適正在庫（{data.fy}年度）</span><span className="ld_badge">{who}</span></div>
                            {data.stock.length === 0 ? <div className="ld_note">適正在庫が登録されていません。「仕入設定」で入れてください。</div> : (
                                <div className="ld_table_wrap">
                                    <table className="ld_table"><thead><tr>
                                        <th className="ld_th">担当</th><th className="ld_th">エリア</th><th className="ld_th ld_num">適正在庫</th><th className="ld_th ld_num">在庫</th>
                                        <th className="ld_th ld_num">過不足</th><th className="ld_th ld_num">販売</th><th className="ld_th ld_num">充足率</th>
                                    </tr></thead><tbody>
                                        {stockGroups.map((g) => {
                                            const rows = data.stock.filter((s) => s.group === g); const s = stockSum(rows); const f = fillOf(s.proper, s.stock);
                                            return (
                                                <React.Fragment key={g}>
                                                    {rows.map((r) => { const rf = fillOf(r.proper, r.stock); return (
                                                        <tr key={r.id} className="ld_row"><td className="ld_td">{r.memberName || '—'}</td><td className="ld_td">{r.areaName}</td>
                                                            <td className="ld_td ld_num">{r.proper}</td><td className="ld_td ld_num">{r.stock}</td><td className="ld_td ld_num">{gapText(r.stock - r.proper)}</td>
                                                            <td className="ld_td ld_num">{r.sales}</td><td className="ld_td ld_num">{rf === null ? '—' : `${rf}%`}</td></tr>); })}
                                                    <tr className="ld_row"><td className="ld_td" colSpan={2}><b>{g} 小計</b></td><td className="ld_td ld_num"><b>{s.proper}</b></td><td className="ld_td ld_num"><b>{s.stock}</b></td>
                                                        <td className="ld_td ld_num">{gapText(s.stock - s.proper)}</td><td className="ld_td ld_num"><b>{s.sales}</b></td><td className="ld_td ld_num"><b>{f === null ? '—' : `${f}%`}</b></td></tr>
                                                </React.Fragment>
                                            );
                                        })}
                                        {(() => { const s = stockSum(data.stock); const f = fillOf(s.proper, s.stock); return (
                                            <tr className="ld_row"><td className="ld_td" colSpan={2}><b>合計</b></td><td className="ld_td ld_num"><b>{s.proper}</b></td><td className="ld_td ld_num"><b>{s.stock}</b></td>
                                                <td className="ld_td ld_num">{gapText(s.stock - s.proper)}</td><td className="ld_td ld_num"><b>{s.sales}</b></td><td className="ld_td ld_num"><b>{f === null ? '—' : `${f}%`}</b></td></tr>); })()}
                                    </tbody></table>
                                </div>
                            )}
                            <div className="ld_note mt-1">過不足＝在庫−適正在庫（マイナスは赤）、充足率＝在庫÷適正在庫。在庫・販売は自動では動きません（仕入設定で入れます）。</div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LandAnalysis;
