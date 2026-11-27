import React, { useMemo, useState } from 'react';
import { useListUrlSync } from '../database/listUrl';
import { fmtNum, landGet, monthLabel, selLabel, useAsync, useLandMaster, type KpiDef, type LandApproach, type LandDeal } from './landApi';
import { DueBadge, LoadState, MapLink, SelSelect } from './LandParts';
import LandDealModal, { type DealPreset } from './LandDealModal';
import { LAND_CSS, rateClass, STATUS_CLASS } from './landStyle';
import { fyMonths, rate } from './landLogic';

/**
 * 仕入ダッシュボード（建売営業 → 土地仕入 → 仕入ダッシュボード。/landDashboard。v2.2.311。移行元の「ダッシュボード」タブ）。
 *
 * ⚠️ 数字は ② の land_summary（GET）。式は logic.ts（移行元の actualCompute と同じ）。
 *   業者AP ＝ アプローチ1件ずつ＋まとめ入力 ／ 情報取得 ＝ 案件の情報取得日＋アプローチ・まとめ入力の情報取得数（案件にした分は引く）
 *   社長提案・買付・契約 ＝ 案件のその日付 ／ 仕入区画 ＝ 契約日が入った案件の区画数。⚠️ 最後に手入力の実績を足す
 * ⚠️ 条件は URL にも出す（sel・scope・month）。
 * ⚠️ 分析（転換率・ボトルネック・ヒートマップ・失注の要因）は v2.2.312 の「仕入分析」へ。
 */

type KpiRow = KpiDef & { actual: number; target: number; rate: number | null };
type Per = { actual: Record<string, number>; target: Record<string, number> };
interface Summary {
    fy: number; months: string[]; scope: string; month: string; today: string; progress: { pct: number; day: number; days: number };
    kpis: KpiRow[]; avgRate: number | null; breakdown: Record<string, number>; apRec: number;
    alert: { counts: Record<string, number>; rows: LandDeal[] }; candidates: LandApproach[];
    members: (Per & { id: number; name: string; areaName: string; avgRate: number | null })[];
    trend: (Per & { month: string })[]; areas: (Per & { id: number; name: string; memberCount: number; avgRate: number | null })[];
    openCounts: Record<string, number>; openTotal: number;
}

const pctText = (p: number | null) => (p === null ? '—' : `${p}%`);
const RateCell = ({ a, t }: { a: number; t: number }) => {
    const p = rate(a, t);
    return (
        <td className="ld_td ld_num">
            <b>{fmtNum(a)}</b><span className="ld_sub"> / {fmtNum(t)}</span>
            <div className="ld_sub" style={{ color: p === null ? undefined : p >= 100 ? '#15803d' : p >= 70 ? '#b45309' : '#b91c1c' }}>{pctText(p)}</div>
        </td>
    );
};

const LandDashboard = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const [sel, setSel] = useState(initUrl.get('sel') ?? '');
    const [scope, setScope] = useState(initUrl.get('scope') === 'fy' ? 'fy' : 'month');
    const [month, setMonth] = useState(initUrl.get('month') ?? '');
    const [modal, setModal] = useState<{ id: number | null; preset?: DealPreset } | null>(null);

    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        if (sel) p.sel = sel;
        if (scope === 'fy') p.scope = 'fy';
        if (month) p.month = month;
        return p;
    }, [sel, scope, month]);
    useListUrlSync(listParams, 1, 20, []);
    const { data, loading, error, reload } = useAsync(() => landGet<Summary>('land_summary', listParams), [listParams]);

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const months = fyMonths(master.settings.fyStart);
    const keys = master.kpiDefs.map((k) => k.key);
    const period = data ? (data.scope === 'fy' ? `${data.fy}年度の累計（6月〜）` : monthLabel(data.month)) : '';
    const targetLabel = scope === 'fy' ? '年間目標' : '月間目標';
    const c = data?.alert.counts ?? {};

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head">
                    <span className="ld_title"><i className="fa-solid fa-chart-line me-2 text-primary" aria-hidden="true" />仕入ダッシュボード</span>
                    <button className="ld_btn is_primary" onClick={() => setModal({ id: null })}><i className="fa-solid fa-plus me-1" aria-hidden="true" />案件を登録</button>
                    <button className="ld_btn" onClick={() => void reload()}><i className="fa-solid fa-rotate me-1" aria-hidden="true" />再読み込み</button>
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
                    {data && <span className="ld_note">{period}　{selLabel(master, sel)}　{scope === 'fy' ? '年度' : '月'}の経過 {data.progress.day}/{data.progress.days}{scope === 'fy' ? 'か月' : '日'}（{data.progress.pct}%）　目標＝{targetLabel}</span>}
                </div>

                <LoadState loading={loading && !data} error={error} />

                {data && (
                    <>
                        <div className="ld_kpi">
                            {data.kpis.map((k) => (
                                <div key={k.key} className="ld_kpi_card" title={k.description}>
                                    <div className="ld_kpi_label">{k.label}{k.calc !== 'auto' && <span className="ld_badge ms-1">手入力</span>}</div>
                                    <div className="ld_kpi_value">{fmtNum(k.actual)}<small>{k.unit}</small></div>
                                    <div className="ld_kpi_sub"><span>目標 {fmtNum(k.target)}</span><b>{pctText(k.rate)}</b></div>
                                    <div className="ld_meter"><i className={rateClass(k.rate)} style={{ width: `${Math.min(100, k.rate ?? 0)}%` }} /><u style={{ left: `${data.progress.pct}%` }} /></div>
                                </div>
                            ))}
                            <div className="ld_kpi_card">
                                <div className="ld_kpi_label">平均達成率（{targetLabel}比）</div>
                                <div className="ld_kpi_value">{pctText(data.avgRate)}</div>
                                <div className="ld_kpi_sub"><span>経過 {data.progress.pct}%</span><span>{data.avgRate !== null && data.avgRate >= data.progress.pct ? 'ペースに乗っています' : ''}</span></div>
                                <div className="ld_meter"><i className={rateClass(data.avgRate)} style={{ width: `${Math.min(100, data.avgRate ?? 0)}%` }} /><u style={{ left: `${data.progress.pct}%` }} /></div>
                            </div>
                        </div>
                        <div className="ld_caution">
                            縦の線＝{scope === 'fy' ? '年度' : '月'}の経過率です。バーが線より右にあれば、目標のペースに乗っています。目標が0の指標は達成率を「—」にします（平均達成率にも入れません）。
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head">
                                <span className="ld_card_title">買付 返答期日アラート</span>
                                {(c.act ?? 0) > 0 && <span className="ld_badge is_warn">要対応 {c.act}件</span>}
                                <span className="ld_badge">返答待ち {c.total ?? 0}件</span>
                                <span className="ld_badge">本日 {data.today}（期間に関係なく、いまの返答待ち）</span>
                            </div>
                            <div className="ld_kpi mb-2">
                                {([['over', '期限超過'], ['today', '本日が期日'], ['soon', `${master.settings.warnDays}日以内`], ['ok', '期日に余裕'], ['unset', '返答期日 未設定']] as [string, string][]).map(([k, l]) => (
                                    <div key={k} className={`ld_kpi_card${(k === 'over' || k === 'today') && (c[k] ?? 0) > 0 ? ' is_warn' : ''}`}><div className="ld_kpi_label">{l}</div><div className="ld_kpi_value">{c[k] ?? 0}<small>件</small></div></div>
                                ))}
                            </div>
                            {data.alert.rows.length > 0 && (
                                <div className="ld_table_wrap" style={{ maxHeight: 320 }}>
                                    <table className="ld_table"><thead><tr>
                                        <th className="ld_th">返答期日</th><th className="ld_th">残り</th><th className="ld_th">担当</th><th className="ld_th">業者名 / 所在地</th>
                                        <th className="ld_th">買付提出先</th><th className="ld_th ld_num">区画</th><th className="ld_th">買付日</th><th className="ld_th" />
                                    </tr></thead><tbody>
                                        {data.alert.rows.map((d) => (
                                            <tr key={d.id} className={`ld_row${d.replyLevel === 'over' || d.replyLevel === 'today' ? ' is_due' : ''}`}>
                                                <td className="ld_td ld_nowrap">{d.replyDue ?? <span className="ld_sub">未設定</span>}</td>
                                                <td className="ld_td"><DueBadge level={d.replyLevel} days={d.replyDays} /></td>
                                                <td className="ld_td ld_nowrap">{d.memberName}</td>
                                                <td className="ld_td"><b>{d.vendorName || '—'}</b><div className="ld_sub">{d.address}</div></td>
                                                <td className="ld_td">{d.offerTo || d.vendorName || '—'}</td>
                                                <td className="ld_td ld_num">{d.lots}</td>
                                                <td className="ld_td ld_nowrap">{d.offerDate ?? '—'}</td>
                                                <td className="ld_td"><button className="ld_btn is_sm" onClick={() => setModal({ id: d.id })}>返答・期日</button></td>
                                            </tr>
                                        ))}
                                    </tbody></table>
                                </div>
                            )}
                        </div>

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">案件化待ちリスト</span><span className="ld_badge">{data.candidates.length}件（新しい順に20件まで）</span></div>
                                {data.candidates.length === 0 ? <div className="ld_empty">案件候補のアプローチはありません。</div> : (
                                    <div className="ld_table_wrap" style={{ maxHeight: 300 }}>
                                        <table className="ld_table"><thead><tr><th className="ld_th">日付</th><th className="ld_th">担当</th><th className="ld_th">業者 / 種別</th><th className="ld_th">取得情報</th><th className="ld_th" /></tr></thead>
                                            <tbody>{data.candidates.map((a) => (
                                                <tr key={a.id} className="ld_row">
                                                    <td className="ld_td ld_nowrap">{a.date}</td><td className="ld_td ld_nowrap">{a.memberName}</td>
                                                    <td className="ld_td"><b>{a.vendorName || '—'}</b><div className="ld_sub">{a.type}・{a.reaction}</div></td>
                                                    <td className="ld_td">{a.memo}{a.address && <div className="ld_sub">{a.address}<MapLink url={a.mapUrl} /></div>}</td>
                                                    <td className="ld_td"><button className="ld_btn is_sm" onClick={() => setModal({ id: null, preset: { memberId: a.memberId, vendorId: a.vendorId, vendorName: a.vendorName, address: a.address, mapUrl: a.mapUrl, landM2: a.landM2, apId: a.id, memo: a.memo } })}>案件にする</button></td>
                                                </tr>))}</tbody></table>
                                    </div>
                                )}
                            </div>
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">アプローチ内訳（{period}）・進行中の案件</span></div>
                                <div className="ld_kpi">
                                    {master.apBreakdown.map((b) => (
                                        <div key={b.k} className="ld_kpi_card"><div className="ld_kpi_label">{b.label}</div><div className="ld_kpi_value">{fmtNum(data.breakdown[b.k])}<small>件</small></div></div>
                                    ))}
                                </div>
                                <div className="ld_section_title mt-3">進行中の案件（{data.openTotal}件）</div>
                                <div className="d-flex gap-2 flex-wrap">
                                    {['情報取得', '社長提案', '買付'].map((s) => <span key={s} className={`ld_pill ${STATUS_CLASS[s]}`}>{s} {data.openCounts[s] ?? 0}件</span>)}
                                </div>
                            </div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">担当者別 進捗（{period} vs {targetLabel}）</span><span className="ld_badge">実績 / 目標・達成率</span></div>
                            <div className="ld_table_wrap">
                                <table className="ld_table"><thead><tr>
                                    <th className="ld_th">担当</th>{data.kpis.map((k) => <th key={k.key} className="ld_th ld_num">{k.label}</th>)}<th className="ld_th ld_num">平均達成率</th>
                                </tr></thead><tbody>
                                    {data.members.map((m) => (
                                        <tr key={m.id} className="ld_row is_click" onClick={() => setSel(`m:${m.id}`)} title="押すとこの人に絞ります">
                                            <td className="ld_td ld_nowrap"><b>{m.name}</b><div className="ld_sub">{m.areaName}</div></td>
                                            {keys.map((k) => <RateCell key={k} a={m.actual[k] ?? 0} t={m.target[k] ?? 0} />)}
                                            <td className="ld_td ld_num"><b>{pctText(m.avgRate)}</b></td>
                                        </tr>
                                    ))}
                                    {data.members.length === 0 && <tr><td className="ld_td ld_empty" colSpan={keys.length + 2}>担当者がいません。</td></tr>}
                                </tbody></table>
                            </div>
                        </div>

                        {data.areas.length > 0 && (
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">エリア別 集計（{period}）</span></div>
                                <div className="ld_table_wrap">
                                    <table className="ld_table"><thead><tr>
                                        <th className="ld_th">エリア</th>{data.kpis.map((k) => <th key={k.key} className="ld_th ld_num">{k.label}</th>)}<th className="ld_th ld_num">平均達成率</th>
                                    </tr></thead><tbody>
                                        {data.areas.map((a) => (
                                            <tr key={a.id} className="ld_row is_click" onClick={() => setSel(`a:${a.id}`)} title="押すとこのエリアに絞ります">
                                                <td className="ld_td ld_nowrap"><b>{a.name}</b><div className="ld_sub">{a.memberCount}名</div></td>
                                                {keys.map((k) => <RateCell key={k} a={a.actual[k] ?? 0} t={a.target[k] ?? 0} />)}
                                                <td className="ld_td ld_num"><b>{pctText(a.avgRate)}</b></td>
                                            </tr>
                                        ))}
                                    </tbody></table>
                                </div>
                            </div>
                        )}

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">月次推移（{data.fy}年度・{selLabel(master, sel)}）</span><span className="ld_badge">実績 / 月間目標</span></div>
                            <div className="ld_table_wrap">
                                <table className="ld_table"><thead><tr>
                                    <th className="ld_th">月</th>{data.kpis.map((k) => <th key={k.key} className="ld_th ld_num">{k.label}</th>)}
                                </tr></thead><tbody>
                                    {data.trend.map((t) => (
                                        <tr key={t.month} className={`ld_row is_click${scope === 'month' && t.month === data.month ? ' is_due' : ''}`} onClick={() => { setScope('month'); setMonth(t.month); }}>
                                            <td className="ld_td ld_nowrap"><b>{monthLabel(t.month)}</b></td>
                                            {keys.map((k) => <RateCell key={k} a={t.actual[k] ?? 0} t={t.target[k] ?? 0} />)}
                                        </tr>
                                    ))}
                                </tbody></table>
                            </div>
                        </div>
                    </>
                )}
            </div>
            {modal && <LandDealModal show master={master} dealId={modal.id} preset={modal.preset} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); }} />}
        </div>
    );
};

export default LandDashboard;
