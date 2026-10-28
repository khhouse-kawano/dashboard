import React, { useMemo } from 'react';
import {
    buyKpi, buyPortalFunnel, buyStaffFunnel, periodLabel, periodShort, rate, sellKpi, sellSourceFunnel, sellStaffFunnel, teamCalls,
} from './leadFunnel';
import type { Period } from './leadFunnel';
import { fmtYen, fmtYen0 } from '../summary/kpi';
import type { Row, Settings } from '../summary/kpi';

/**
 * 売り反響・買い反響の画面の上の部分（v2.2.225）: タイル5つ・反響元別（ポータル別）ファネル・担当者別ファネル。
 *
 * ⚠️ 移植元は本番アプリ（V18）の renderLeads / renderBuyLeads の上半分。列・率の分母・見出しを同じにしている。
 *   計算は leadFunnel.ts（以前のアプリの関数のまま）。
 */

type Props = {
    kind: 'sell' | 'buy';
    /** その画面の反響（削除済みは除いたもの） */
    rows: Row[];
    period: Period;
    settings: Settings & { srcCosts?: Record<string, number>; portalCosts?: Record<string, number> };
};

const STYLE = `
.rlt-fn-tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.rlt-fn-tile { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 4px rgba(0,0,0,.05); }
.rlt-fn-tile .lbl { font-size: 11px; color: #6c757d; font-weight: bold; }
.rlt-fn-tile .val { font-size: 24px; font-weight: bold; color: #212529; font-variant-numeric: tabular-nums; }
.rlt-fn-tile .val.green { color: #198754; }
.rlt-fn-tile .sub { font-size: 10px; color: #6c757d; margin-top: 2px; line-height: 1.5; }
.rlt-fn-card { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.rlt-fn-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; padding: 10px 14px 6px; }
.rlt-fn-head h3 { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; }
.rlt-fn-head .note { font-size: 10px; color: #6c757d; }
.rlt-fn-wrap { overflow-x: auto; }
.rlt-fn-tbl { width: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
.rlt-fn-tbl th { background: #f8f9fa; color: #495057; font-weight: bold; padding: 6px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; }
.rlt-fn-tbl td { padding: 4px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; }
.rlt-fn-tbl .r { text-align: right; }
.rlt-fn-tbl td.auto { background: #f3faf5; }
.rlt-fn-tbl tr.total td { font-weight: bold; background: #f1f3f5; }
.rlt-fn-tbl td.empty { text-align: center; color: #6c757d; padding: 12px; }
`;

const LeadFunnelPanel: React.FC<Props> = ({ kind, rows, period, settings }) => {
    const fs = settings.fiscalStart;
    const staffNames = useMemo(() => (settings.staff ?? []).map(s => String(s.name ?? '').trim()).filter(Boolean), [settings.staff]);
    const tc = useMemo(() => (kind === 'sell' ? teamCalls(rows, []) : teamCalls([], rows)), [kind, rows]);
    const ps = periodShort(period);
    const pl = periodLabel(period);

    if (kind === 'sell') {
        const k = sellKpi(rows, period, fs);
        const src = sellSourceFunnel(rows, period, fs, settings.srcCosts);
        const st = sellStaffFunnel(rows, period, fs, staffNames);
        const TT = src.reduce((t, o) => ({ leads: t.leads + o.leads, connects: t.connects + o.connects, visits: t.visits + o.visits, wins: t.wins + o.wins, cost: t.cost + o.cost }), { leads: 0, connects: 0, visits: 0, wins: 0, cost: 0 });
        const T = st.reduce((t, o) => ({ leads: t.leads + o.leads, calls: t.calls + o.calls, connects: t.connects + o.connects, visits: t.visits + o.visits, props: t.props + o.props, wins: t.wins + o.wins }), { leads: 0, calls: 0, connects: 0, visits: 0, props: 0, wins: 0 });
        return (
            <>
                <style>{STYLE}</style>
                <div className="rlt-fn-tiles">
                    <div className="rlt-fn-tile"><div className="lbl">{ps}受信リード</div><div className="val">{k.leads}</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">架電数(延べ・{ps})</div><div className="val">{k.calls}</div>
                        <div className="sub">本日 {tc.day.s}件／今週 {tc.week.s}件（チーム）<br />💬LINE {k.acts.line}件／✉️メール {k.acts.mail}件</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">通電</div><div className="val">{k.connects}</div><div className="sub">通電率 {rate(k.connects, k.leads)}</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">訪問査定</div><div className="val">{k.visits}</div><div className="sub">獲得率 {rate(k.visits, k.leads)}／査定書提出 {k.props}件</div></div>
                    <div className="rlt-fn-tile"><div className="lbl">媒介受託</div><div className="val green">{k.wins}</div><div className="sub">受託率 {rate(k.wins, k.leads)}（査定比 {rate(k.wins, k.visits)}）</div></div>
                </div>

                <div className="rlt-fn-card">
                    <div className="rlt-fn-head"><h3>反響元別ファネル（受信分・自動集計／{pl}）</h3><span className="note">上部の「対象期間」で切り替わります（単月・通期・全期間）</span></div>
                    <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                        <th>反響元</th><th className="r">リード</th><th className="r">通電</th><th className="r">通電率</th><th className="r">訪問査定</th><th className="r">査定率</th>
                        <th className="r">媒介受託</th><th className="r">受託率(リード比)</th><th className="r">受託率(査定比)</th><th className="r">反響単価</th><th className="r">反響費用</th><th className="r">媒介獲得単価</th>
                    </tr></thead><tbody>
                        {src.length === 0 && <tr><td colSpan={12} className="empty">{pl}に受信したリードはまだありません</td></tr>}
                        {src.map(o => (
                            <tr key={o.name}>
                                <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                                <td className="r auto">{o.visits}</td><td className="r auto">{rate(o.visits, o.leads)}</td><td className="r auto">{o.wins}</td>
                                <td className="r auto">{rate(o.wins, o.leads)}</td><td className="r auto">{rate(o.wins, o.visits)}</td>
                                <td className="r">{o.unit ? fmtYen(o.unit) : '―'}</td><td className="r auto">{fmtYen0(o.cost)}</td>
                                <td className="r auto">{o.wins && o.cost ? fmtYen(Math.round(o.cost / o.wins)) : '―'}</td>
                            </tr>
                        ))}
                        {src.length > 0 && (
                            <tr className="total">
                                <td>合計</td><td className="r">{TT.leads}</td><td className="r">{TT.connects}</td><td className="r">{rate(TT.connects, TT.leads)}</td>
                                <td className="r">{TT.visits}</td><td className="r">{rate(TT.visits, TT.leads)}</td><td className="r">{TT.wins}</td>
                                <td className="r">{rate(TT.wins, TT.leads)}</td><td className="r">{rate(TT.wins, TT.visits)}</td><td className="r"></td>
                                <td className="r">{fmtYen0(TT.cost)}</td><td className="r">{TT.wins && TT.cost ? fmtYen(Math.round(TT.cost / TT.wins)) : '―'}</td>
                            </tr>
                        )}
                    </tbody></table></div>
                </div>

                <div className="rlt-fn-card">
                    <div className="rlt-fn-head"><h3>担当者別ファネル（受信分・自動集計／{pl}）</h3><span className="note">受信月コホート基準。架電数のみ対象期間の実施日ベース（📞のみ・リード担当者基準）</span></div>
                    <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                        <th>担当者</th><th className="r">リード</th><th className="r">架電</th><th className="r">通電</th><th className="r">通電率</th><th className="r">訪問査定</th><th className="r">査定率</th>
                        <th className="r">査定書提出</th><th className="r">媒介受託</th><th className="r">受託率(リード比)</th><th className="r">受託率(査定比)</th>
                    </tr></thead><tbody>
                        {st.length === 0 && <tr><td colSpan={11} className="empty">担当者が登録されていません</td></tr>}
                        {st.map(o => (
                            <tr key={o.name}>
                                <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.calls}</td>
                                <td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                                <td className="r auto">{o.visits}</td><td className="r auto">{rate(o.visits, o.leads)}</td>
                                <td className="r auto">{o.props}</td><td className="r auto">{o.wins}</td>
                                <td className="r auto">{rate(o.wins, o.leads)}</td><td className="r auto">{rate(o.wins, o.visits)}</td>
                            </tr>
                        ))}
                        {st.length > 0 && (
                            <tr className="total">
                                <td>チーム合計</td><td className="r">{T.leads}</td><td className="r">{T.calls}</td><td className="r">{T.connects}</td><td className="r">{rate(T.connects, T.leads)}</td>
                                <td className="r">{T.visits}</td><td className="r">{rate(T.visits, T.leads)}</td><td className="r">{T.props}</td><td className="r">{T.wins}</td>
                                <td className="r">{rate(T.wins, T.leads)}</td><td className="r">{rate(T.wins, T.visits)}</td>
                            </tr>
                        )}
                    </tbody></table></div>
                </div>
            </>
        );
    }

    const k = buyKpi(rows, period, fs);
    const pf = buyPortalFunnel(rows, period, fs, settings.portalCosts);
    const st = buyStaffFunnel(rows, period, fs, staffNames);
    const TT = pf.reduce((t, o) => ({ leads: t.leads + o.leads, connects: t.connects + o.connects, views: t.views + o.views, offers: t.offers + o.offers, cost: t.cost + o.cost }), { leads: 0, connects: 0, views: 0, offers: 0, cost: 0 });
    const T = st.reduce((t, o) => ({ leads: t.leads + o.leads, calls: t.calls + o.calls, connects: t.connects + o.connects, views: t.views + o.views, offers: t.offers + o.offers, wins: t.wins + o.wins }), { leads: 0, calls: 0, connects: 0, views: 0, offers: 0, wins: 0 });
    return (
        <>
            <style>{STYLE}</style>
            <div className="rlt-fn-tiles">
                <div className="rlt-fn-tile"><div className="lbl">{ps}反響受信</div><div className="val">{k.leads}</div></div>
                <div className="rlt-fn-tile"><div className="lbl">架電数(延べ・{ps})</div><div className="val">{k.calls}</div>
                    <div className="sub">本日 {tc.day.b}件／今週 {tc.week.b}件（チーム）<br />💬LINE {k.acts.line}件／✉️メール {k.acts.mail}件</div></div>
                <div className="rlt-fn-tile"><div className="lbl">通電</div><div className="val">{k.connects}</div><div className="sub">通電率 {rate(k.connects, k.leads)}</div></div>
                <div className="rlt-fn-tile"><div className="lbl">内見</div><div className="val">{k.views}</div><div className="sub">内見率 {rate(k.views, k.leads)}</div></div>
                <div className="rlt-fn-tile"><div className="lbl">購入申込</div><div className="val green">{k.offers}</div><div className="sub">申込率 {rate(k.offers, k.leads)}／成約 {k.wins}</div></div>
            </div>

            <div className="rlt-fn-card">
                <div className="rlt-fn-head"><h3>ポータル別ファネル（受信分・自動集計／{pl}）</h3><span className="note">上部の「対象期間」で切り替わります（単月・通期・全期間）</span></div>
                <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                    <th>ポータル</th><th className="r">反響</th><th className="r">通電</th><th className="r">通電率</th><th className="r">内見</th><th className="r">内見率</th>
                    <th className="r">購入申込</th><th className="r">申込率(反響比)</th><th className="r">申込率(内見比)</th><th className="r">反響単価</th><th className="r">反響費用</th><th className="r">申込単価</th>
                </tr></thead><tbody>
                    {pf.length === 0 && <tr><td colSpan={12} className="empty">{pl}に受信した買い反響はまだありません</td></tr>}
                    {pf.map(o => (
                        <tr key={o.name}>
                            <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                            <td className="r auto">{o.views}</td><td className="r auto">{rate(o.views, o.leads)}</td><td className="r auto">{o.offers}</td>
                            <td className="r auto">{rate(o.offers, o.leads)}</td><td className="r auto">{rate(o.offers, o.views)}</td>
                            <td className="r">{o.unit ? fmtYen(o.unit) : '―'}</td><td className="r auto">{fmtYen0(o.cost)}</td>
                            <td className="r auto">{o.offers && o.cost ? fmtYen(Math.round(o.cost / o.offers)) : '―'}</td>
                        </tr>
                    ))}
                    {pf.length > 0 && (
                        <tr className="total">
                            <td>合計</td><td className="r">{TT.leads}</td><td className="r">{TT.connects}</td><td className="r">{rate(TT.connects, TT.leads)}</td>
                            <td className="r">{TT.views}</td><td className="r">{rate(TT.views, TT.leads)}</td><td className="r">{TT.offers}</td>
                            <td className="r">{rate(TT.offers, TT.leads)}</td><td className="r">{rate(TT.offers, TT.views)}</td><td className="r"></td>
                            <td className="r">{fmtYen0(TT.cost)}</td><td className="r">{TT.offers && TT.cost ? fmtYen(Math.round(TT.cost / TT.offers)) : '―'}</td>
                        </tr>
                    )}
                </tbody></table></div>
            </div>

            <div className="rlt-fn-card">
                <div className="rlt-fn-head"><h3>担当者別ファネル（受信分・自動集計／{pl}）</h3><span className="note">受信月コホート基準。架電数のみ対象期間の実施日ベース（📞のみ・反響担当者基準）</span></div>
                <div className="rlt-fn-wrap"><table className="rlt-fn-tbl"><thead><tr>
                    <th>担当者</th><th className="r">反響</th><th className="r">架電</th><th className="r">通電</th><th className="r">通電率</th><th className="r">内見</th><th className="r">内見率</th>
                    <th className="r">購入申込</th><th className="r">申込率(反響比)</th><th className="r">申込率(内見比)</th><th className="r">成約</th>
                </tr></thead><tbody>
                    {st.length === 0 && <tr><td colSpan={11} className="empty">担当者が登録されていません</td></tr>}
                    {st.map(o => (
                        <tr key={o.name}>
                            <td>{o.name}</td><td className="r auto">{o.leads}</td><td className="r auto">{o.calls}</td>
                            <td className="r auto">{o.connects}</td><td className="r auto">{rate(o.connects, o.leads)}</td>
                            <td className="r auto">{o.views}</td><td className="r auto">{rate(o.views, o.leads)}</td>
                            <td className="r auto">{o.offers}</td><td className="r auto">{rate(o.offers, o.leads)}</td>
                            <td className="r auto">{rate(o.offers, o.views)}</td><td className="r auto">{o.wins}</td>
                        </tr>
                    ))}
                    {st.length > 0 && (
                        <tr className="total">
                            <td>チーム合計</td><td className="r">{T.leads}</td><td className="r">{T.calls}</td><td className="r">{T.connects}</td><td className="r">{rate(T.connects, T.leads)}</td>
                            <td className="r">{T.views}</td><td className="r">{rate(T.views, T.leads)}</td><td className="r">{T.offers}</td>
                            <td className="r">{rate(T.offers, T.leads)}</td><td className="r">{rate(T.offers, T.views)}</td><td className="r">{T.wins}</td>
                        </tr>
                    )}
                </tbody></table></div>
            </div>
        </>
    );
};

export default LeadFunnelPanel;
