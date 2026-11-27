import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useListUrlSync } from '../database/listUrl';
import { errorText, fmtNum, landGet, landPost, monthLabel, useAsync, useLandMaster, type KpiDef, type LandApproach, type LandDeal } from './landApi';
import { DueBadge, Field, LoadState, MemberSelect } from './LandParts';
import { LAND_CSS, rateClass, STATUS_CLASS } from './landStyle';
import { fyMonths, type BnRow } from './landLogic';

/**
 * 個人別実績（建売営業 → 土地仕入 → 個人別実績。/landMember。v2.2.311。移行元の「個人別実績」タブ）。
 *
 * ⚠️ 読み込みはすべて GET（land_summary・land_analysis・land_review・land_approach_list・land_deal_list）。
 * ⚠️ 開いたときの担当者は、ログインした人に結び付いた担当者。⚠️ 条件は URL にも出す（memberId・scope・month）。
 * ⚠️ 月次レビュー（育成フェーズ・ボトルネック・良かった事・重点課題・上長コメント）は担当者×月に1件（land:review_save）。
 */

type KpiRow = KpiDef & { actual: number; target: number; rate: number | null };
interface Summary {
    month: string; fy: number; progress: { pct: number; day: number; days: number }; kpis: KpiRow[]; avgRate: number | null;
    alert: { counts: Record<string, number>; rows: LandDeal[] };
    members: { id: number; name: string; avgRate: number | null; actual: Record<string, number>; target: Record<string, number> }[];
}
interface Review { ym: string; phase: string; bottleneck: string; good: string; theme: string; comment: string; updatedBy: string }

const pct = (p: number | null) => (p === null ? '—' : `${p}%`);

const LandMember = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const [memberId, setMemberId] = useState<number | null>(initUrl.get('memberId') ? Number(initUrl.get('memberId')) : null);
    const [scope, setScope] = useState(initUrl.get('scope') === 'fy' ? 'fy' : 'month');
    const [month, setMonth] = useState(initUrl.get('month') ?? '');
    const [review, setReview] = useState<Omit<Review, 'ym' | 'updatedBy'>>({ phase: '', bottleneck: '', good: '', theme: '', comment: '' });
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => { if (master && memberId === null && master.meMemberId !== null) setMemberId(master.meMemberId); }, [master, memberId]);
    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        if (memberId !== null) p.memberId = String(memberId);
        if (scope === 'fy') p.scope = 'fy';
        if (month) p.month = month;
        return p;
    }, [memberId, scope, month]);
    useListUrlSync(listParams, 1, 20, []);

    const member = master?.members.find((m) => m.id === memberId) ?? null;
    const sel = memberId !== null ? `m:${memberId}` : '';
    const ready = memberId !== null;
    const q = { sel, scope, ...(month ? { month } : {}) };
    const summary = useAsync(() => (ready ? landGet<Summary>('land_summary', q) : Promise.resolve(null)), [sel, scope, month]);
    const fySummary = useAsync(() => (ready ? landGet<Summary>('land_summary', { sel, scope: 'fy' }) : Promise.resolve(null)), [sel]);
    const analysis = useAsync(() => (ready ? landGet<{ bottleneck: { rows: BnRow[]; worst: BnRow | null } }>('land_analysis', q) : Promise.resolve(null)), [sel, scope, month]);
    const areaSel = member ? `a:${member.areaId ?? 0}` : '';
    const area = useAsync(() => (ready && areaSel ? landGet<Summary>('land_summary', { sel: areaSel, scope, ...(month ? { month } : {}) }) : Promise.resolve(null)), [areaSel, scope, month]);
    const reviews = useAsync(() => (ready ? landGet<{ reviews: Review[] }>('land_review', { memberId: memberId! }) : Promise.resolve(null)), [memberId]);
    const aps = useAsync(() => (ready ? landGet<{ rows: LandApproach[]; total: number }>('land_approach_list', { sel, limit: 20 }) : Promise.resolve(null)), [sel]);
    const deals = useAsync(() => (ready ? landGet<{ rows: LandDeal[]; total: number }>('land_deal_list', { sel, limit: 30 }) : Promise.resolve(null)), [sel]);

    const ym = summary.data?.month ?? '';
    useEffect(() => {
        const r = reviews.data?.reviews.find((x) => x.ym === ym);
        setReview({ phase: r?.phase ?? '', bottleneck: r?.bottleneck ?? '', good: r?.good ?? '', theme: r?.theme ?? '', comment: r?.comment ?? '' });
    }, [reviews.data, ym]);
    const saveReview = async () => {
        if (memberId === null || !ym) return;
        setMsg(null);
        try { await landPost('review_save', { memberId, ym, ...review }); setMsg({ ok: true, text: `${monthLabel(ym)}の月次レビューを保存しました。` }); void reviews.reload(); } catch (e) { setMsg({ ok: false, text: errorText(e, '保存できませんでした。') }); }
    };

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const months = fyMonths(master.settings.fyStart);
    const s = summary.data;
    const period = s ? (scope === 'fy' ? `${s.fy}年度の累計` : monthLabel(s.month)) : '';

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head"><span className="ld_title"><i className="fa-solid fa-user me-2 text-primary" aria-hidden="true" />個人別実績</span></div>
                <div className="ld_bar">
                    <div><div className="ld_label">担当者</div><MemberSelect master={master} value={memberId} onChange={setMemberId} includeStopped /></div>
                    <div><div className="ld_label">集計期間</div>
                        <div className="ld_seg">
                            <button className={scope === 'month' ? 'is_on' : ''} onClick={() => setScope('month')}>毎月</button>
                            <button className={scope === 'fy' ? 'is_on' : ''} onClick={() => setScope('fy')}>通期</button>
                        </div></div>
                    {scope === 'month' && (
                        <div><div className="ld_label">対象月</div>
                            <select className="ld_select" value={month || s?.month || ''} onChange={(e) => setMonth(e.target.value)}>
                                {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                            </select></div>
                    )}
                    {member && <span className="ld_note">{member.name}（{member.areaName}）　{period}</span>}
                </div>
                {msg && <div className={msg.ok ? 'ld_ok' : 'ld_error'}>{msg.text}</div>}
                {memberId === null ? <div className="ld_caution">担当者を選んでください。</div> : (
                    <>
                        <LoadState loading={summary.loading && !s} error={summary.error} />
                        {s && (
                            <div className="ld_kpi">
                                {s.kpis.map((k) => (
                                    <div key={k.key} className="ld_kpi_card"><div className="ld_kpi_label">{k.label}</div>
                                        <div className="ld_kpi_value">{fmtNum(k.actual)}<small>{k.unit}</small></div>
                                        <div className="ld_kpi_sub"><span>目標 {fmtNum(k.target)}</span><b>{pct(k.rate)}</b></div>
                                        <div className="ld_meter"><i className={rateClass(k.rate)} style={{ width: `${Math.min(100, k.rate ?? 0)}%` }} /><u style={{ left: `${s.progress.pct}%` }} /></div>
                                    </div>
                                ))}
                                <div className="ld_kpi_card"><div className="ld_kpi_label">平均達成率</div><div className="ld_kpi_value">{pct(s.avgRate)}</div>
                                    <div className="ld_kpi_sub"><span>経過 {s.progress.pct}%</span><b style={{ color: s.avgRate !== null && s.avgRate >= s.progress.pct ? '#15803d' : '#b91c1c' }}>{s.avgRate === null ? '' : s.avgRate >= s.progress.pct ? 'ペース内' : 'ペース遅れ'}</b></div></div>
                            </div>
                        )}

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">ボトルネック診断（{period}・チーム比）</span></div>
                                {analysis.data && (analysis.data.bottleneck.worst
                                    ? <div className="ld_error mb-2"><b>{analysis.data.bottleneck.worst.label}の転換率が下がっています</b></div>
                                    : <div className="ld_ok mb-2">目立った転換率の低下はありません</div>)}
                                {(analysis.data?.bottleneck.rows ?? []).map((r) => (
                                    <div key={r.key} className="d-flex justify-content-between" style={{ color: r.bad ? '#b91c1c' : undefined, padding: '3px 0' }}>
                                        <span>{r.bad && '▲ '}{r.label}</span>
                                        <span className="ld_num"><b>{r.cur === null ? '—' : `${r.cur}%`}</b> <span className="ld_sub">{r.num}/{r.den}件　{r.cmps.map((c) => `${c.label} ${c.v ? `${c.v.rel > 0 ? '+' : ''}${c.v.rel}%` : '—'}`).join('・')}</span></span>
                                    </div>
                                ))}
                            </div>
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">{fySummary.data?.fy}年度 累計 vs 年間目標</span></div>
                                {(fySummary.data?.kpis ?? []).map((k) => (
                                    <div key={k.key} style={{ padding: '3px 0' }}>
                                        <div className="d-flex justify-content-between"><span>{k.label}</span><span className="ld_num"><b>{fmtNum(k.actual)}</b> / {fmtNum(k.target)}{k.unit}　<b>{pct(k.rate)}</b></span></div>
                                        <div className="ld_meter"><i className={rateClass(k.rate)} style={{ width: `${Math.min(100, k.rate ?? 0)}%` }} /><u style={{ left: `${fySummary.data!.progress.pct}%` }} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">買付 返答期日アラート（{member?.name}）</span><span className="ld_badge">返答待ち {s?.alert.counts.total ?? 0}件</span></div>
                                {(s?.alert.rows.length ?? 0) === 0 ? <div className="ld_note">返答待ちの買付はありません。</div> : (
                                    <div className="ld_table_wrap" style={{ maxHeight: 260 }}><table className="ld_table"><tbody>{s!.alert.rows.map((d) => (
                                        <tr key={d.id} className="ld_row"><td className="ld_td ld_nowrap">{d.replyDue ?? '未設定'}</td><td className="ld_td"><DueBadge level={d.replyLevel} days={d.replyDays} /></td><td className="ld_td"><b>{d.vendorName}</b><div className="ld_sub">{d.address}</div></td></tr>
                                    ))}</tbody></table></div>
                                )}
                            </div>
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">{member?.areaName} 内での比較（{period}）</span></div>
                                <div className="ld_table_wrap"><table className="ld_table"><thead><tr><th className="ld_th">担当</th>{(area.data?.kpis ?? []).map((k) => <th key={k.key} className="ld_th ld_num">{k.label}</th>)}<th className="ld_th ld_num">平均</th></tr></thead>
                                    <tbody>{(area.data?.members ?? []).map((m) => (
                                        <tr key={m.id} className="ld_row" style={m.id === memberId ? { background: '#eff6ff' } : undefined}>
                                            <td className="ld_td ld_nowrap">{m.id === memberId ? <b>{m.name}</b> : m.name}</td>
                                            {(area.data?.kpis ?? []).map((k) => <td key={k.key} className="ld_td ld_num">{fmtNum(m.actual[k.key])}<span className="ld_sub"> / {fmtNum(m.target[k.key])}</span></td>)}
                                            <td className="ld_td ld_num"><b>{pct(m.avgRate)}</b></td>
                                        </tr>))}</tbody></table></div>
                            </div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">{ym ? monthLabel(ym) : ''} 月次レビュー</span><button className="ld_btn is_primary" onClick={() => void saveReview()}>保存</button></div>
                            <div className="ld_grid">
                                <Field label="育成フェーズ"><select className="ld_select" value={review.phase} onChange={(e) => setReview((r) => ({ ...r, phase: e.target.value }))}><option value="">（未選択）</option>{(master.options.phase ?? []).map((v) => <option key={v}>{v}</option>)}</select></Field>
                                <Field label="ボトルネック"><select className="ld_select" value={review.bottleneck} onChange={(e) => setReview((r) => ({ ...r, bottleneck: e.target.value }))}><option value="">（未選択）</option>{(master.options.bottleneck ?? []).map((v) => <option key={v}>{v}</option>)}</select></Field>
                                <Field label="良かった事（本人）" full><textarea className="ld_textarea" value={review.good} onChange={(e) => setReview((r) => ({ ...r, good: e.target.value }))} /></Field>
                                <Field label="重点課題（翌月のテーマ）" full><textarea className="ld_textarea" value={review.theme} onChange={(e) => setReview((r) => ({ ...r, theme: e.target.value }))} /></Field>
                                <Field label="上長コメント" full><textarea className="ld_textarea" value={review.comment} onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))} /></Field>
                            </div>
                            {(reviews.data?.reviews.length ?? 0) > 0 && (
                                <div className="ld_table_wrap mt-2" style={{ maxHeight: 260 }}><table className="ld_table"><thead><tr><th className="ld_th">月</th><th className="ld_th">育成フェーズ</th><th className="ld_th">ボトルネック</th><th className="ld_th">重点課題</th><th className="ld_th">上長コメント</th></tr></thead>
                                    <tbody>{reviews.data!.reviews.map((r) => (
                                        <tr key={r.ym} className="ld_row is_click" onClick={() => { setScope('month'); setMonth(r.ym); }}><td className="ld_td ld_nowrap">{monthLabel(r.ym)}</td><td className="ld_td">{r.phase}</td><td className="ld_td">{r.bottleneck}</td><td className="ld_td">{r.theme}</td><td className="ld_td">{r.comment}</td></tr>
                                    ))}</tbody></table></div>
                            )}
                        </div>

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">最近のアプローチ（新しい20件）</span><Link className="ld_btn is_sm" to={`/landDaily?memberId=${memberId}`}>日次・アプローチへ</Link></div>
                                <div className="ld_table_wrap" style={{ maxHeight: 360 }}><table className="ld_table"><tbody>{(aps.data?.rows ?? []).map((a) => (
                                    <tr key={a.id} className="ld_row"><td className="ld_td ld_nowrap">{a.date}</td><td className="ld_td"><b>{a.vendorName || '—'}</b><div className="ld_sub">{a.type}・{a.reaction}</div></td><td className="ld_td">{a.memo}</td></tr>
                                ))}{(aps.data?.rows.length ?? 0) === 0 && <tr><td className="ld_td ld_empty">まだありません。</td></tr>}</tbody></table></div>
                            </div>
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">担当案件（{deals.data?.total ?? 0}件）</span><Link className="ld_btn is_sm" to={`/landDeals?sel=m%3A${memberId}`}>仕入案件一覧で見る</Link></div>
                                <div className="ld_table_wrap" style={{ maxHeight: 360 }}><table className="ld_table"><tbody>{(deals.data?.rows ?? []).map((d) => (
                                    <tr key={d.id} className="ld_row"><td className="ld_td ld_nowrap">{d.infoDate}</td><td className="ld_td"><b>{d.vendorName || '—'}</b><div className="ld_sub">{d.address}</div></td><td className="ld_td ld_num">{d.lots}区画</td><td className="ld_td"><span className={`ld_pill ${STATUS_CLASS[d.status] ?? ''}`}>{d.status}</span></td></tr>
                                ))}</tbody></table></div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LandMember;
