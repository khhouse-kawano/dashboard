import React, { useEffect, useMemo, useState } from 'react';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import ComboChart from '../common/ComboChart';
import {
    CONFIRMED, dealCountByStaffMonth, dealFee, dealReform, dealReformGp, dealSales, fiscalMonths, fmtCnt, fmtMan, fmtYen, fmtYen0,
    monthLabel, pct, shareOf, sumByStaffMonth, sumRow, todayStr,
} from '../summary/kpi';
import type { Row, Settings, StaffMonth } from '../summary/kpi';

/**
 * 月次売上管理（不動産企画係。v2.2.225）。
 *
 * ⚠️ 移植元は以前のアプリの「📈 月次売上管理」（renderSales・salesChart・drillSales）。表・グラフ・内訳の中身は同じ。見た目だけ Dashboard に寄せた。
 *   ・契約日＝計上月。失注は除く。売上計上額＝仲介手数料＋リフォーム粗利（受注額は参考）
 *   ・共同担当は売上を割合で按分、件数は0.5件ずつ（kpi.ts の dealShares）
 * ⚠️ 内訳の「書類」の列（以前のアプリの書類添付）は、書類の移植の段で足す。
 */

const STYLE = `
.rlt-sl-tbl td.clk { cursor: pointer; }
.rlt-sl-tbl td.clk:hover { background: #e7f1ff !important; }
.rlt-sl-tbl td.auto { background: #f3faf5; }
.rlt-sl-tbl td.warn { background: #fff8e1; }
.rlt-sl-chips { display: flex; gap: 6px; margin-left: auto; }
.rlt-sl-chip { font-size: 11px; border: 1px solid #ced4da; border-radius: 12px; padding: 2px 10px; background: #fff; cursor: pointer; }
.rlt-sl-chip.on { background: #0d6efd; border-color: #0d6efd; color: #fff; }
.rlt-sl-modal { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1050; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; }
.rlt-sl-modal .box { background: #fff; border-radius: 8px; max-width: 1200px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
.rlt-sl-modal .head { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: bold; font-size: 14px; }
.rlt-sl-badge { display: inline-block; font-size: 10px; font-weight: bold; border-radius: 4px; padding: 1px 6px; }
`;

/** フェーズのバッジ（phaseBadge） */
const PHASE_COLORS: Record<string, [string, string]> = {
    決済完了: ['#e9ecef', '#495057'], 契約済: ['#d1e7dd', '#0f5132'], 契約予定: ['#cfe2ff', '#084298'], 失注: ['#f8d7da', '#842029'],
};
const PhaseBadge: React.FC<{ phase: string }> = ({ phase }) => {
    const [bg, fg] = PHASE_COLORS[phase] ?? ['#fff3cd', '#664d03'];
    return <span className="rlt-sl-badge" style={{ background: bg, color: fg }}>{phase}</span>;
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const mShort = (mk: string) => `${Number(mk.slice(5, 7))}月`;

type RfMode = 'price' | 'gp' | 'fee';
type Drill = { staff: string; mk: string; mode: 'all' | 'conf' };

/** 累計の線を引く最後の月（cumEnd）: 実績のある最後の月と今月の遅いほう */
const cumEnd = (mks: string[], vals: number[]): number => {
    let last = -1;
    vals.forEach((v, i) => { if (v) last = i; });
    return Math.max(last, mks.indexOf(todayStr().slice(0, 7)));
};

const MonthlySales: React.FC = () => {
    const [deals, setDeals] = useState<Row[]>([]);
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const [rfMode, setRfMode] = useState<RfMode>('price'); // 以前のアプリの S.salesRfMode の既定
    const [drill, setDrill] = useState<Drill | null>(null);

    useEffect(() => {
        loadRecords(['deals'])
            .then(r => { setDeals(r.records.deals); setSettings(r.settings); })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const mks = useMemo(() => fiscalMonths(settings.fiscalStart), [settings.fiscalStart]);
    const rows = useMemo(() => (settings.staff ?? []).filter(s => s.name), [settings.staff]);
    const agg = useMemo(() => ({
        all: sumByStaffMonth(deals, dealSales),
        conf: sumByStaffMonth(deals, dealSales, d => CONFIRMED.includes(str(d.phase))),
        cnt: dealCountByStaffMonth(deals),
        fee: sumByStaffMonth(deals, dealFee),
        rfP: sumByStaffMonth(deals, dealReform),
        rfG: sumByStaffMonth(deals, dealReformGp),
    }), [deals]);

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const { all, conf, cnt, fee: feeOnly, rfP, rfG } = agg;
    const cell = (m: StaffMonth, name: string, mk: string) => m[name]?.[mk] ?? 0;
    const teamMonth = (m: StaffMonth, mk: string) => rows.reduce((a, s) => a + cell(m, String(s.name), mk), 0);
    const teamYear = (m: StaffMonth) => rows.reduce((a, s) => a + sumRow(m[String(s.name)], mks), 0);

    // ① 担当者別 月次売上
    const annuals = rows.map(s => ({ s, tot: sumRow(all[String(s.name)], mks) }));
    const rank = [...annuals].sort((a, b) => b.tot - a.tot);
    const teamTot = annuals.reduce((a, x) => a + x.tot, 0);
    const teamBud = rows.reduce((a, s) => a + (Number(s.budget) || 0), 0);

    // グラフ（salesChart）
    const vals = mks.map(mk => teamMonth(all, mk));
    const cvals = mks.map(mk => teamMonth(conf, mk));
    const mGoal = rows.reduce((a, s) => a + (Number(s.monthlyGoal) || 0), 0);
    const tgt = mks.map(() => (mGoal > 0 ? mGoal : teamBud ? Math.round(teamBud / 12) : 0));
    const end = cumEnd(mks, vals);
    let cum = 0;
    const line = vals.map((v, i) => { cum += v; return teamBud > 0 && i <= end ? (cum / teamBud) * 100 : null; });

    // ③ リフォーム
    const RSET = {
        price: { d: rfP, ttl: 'リフォーム受注額（売上には計上しません）' },
        gp: { d: rfG, ttl: 'リフォーム粗利（売上に計上）' },
        fee: { d: feeOnly, ttl: '仲介手数料のみ（リフォーム粗利を除く）' },
    }[rfMode];
    const yFee = teamYear(feeOnly), ySales = teamYear(all), yRf = teamYear(rfP), yRg = teamYear(rfG);

    const clk = (v: number, d: Drill) => (v ? { className: 'r auto clk', onClick: () => setDrill(d), title: 'クリックで内訳表示' } : { className: 'r auto' });

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-chart-line me-2" style={{ color: '#0d6efd' }}></i>月次売上管理</h1>
                <p className="rlt-sub">契約日＝計上月・単位:円。商談案件管理から自動集計（緑）。失注は除外。<b>リフォームは受注額ではなく粗利を売上に計上</b>し、仲介手数料と合算しています。内訳は③で確認できます。</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>担当者別 月次売上（仲介手数料＋リフォーム粗利）</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}
                    <th className="r">年間実績</th><th className="r">年間目標</th><th className="r">達成率</th><th className="r">順位</th>
                </tr></thead><tbody>
                    {annuals.map(({ s, tot }) => {
                        const n = String(s.name);
                        const r = rank.findIndex(x => x.s === s) + 1;
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(all, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'all' })}>{v ? fmtMan(v) : '0'}</td>; })}
                                <td className="r"><b>{fmtYen(tot)}</b></td><td className="r warn">{fmtYen(Number(s.budget) || 0)}</td>
                                <td className="r">{s.budget ? pct(tot / Number(s.budget)) : '―'}</td><td className="r">{tot > 0 ? r : '-'}</td>
                            </tr>
                        );
                    })}
                    <tr className="total">
                        <td>チーム合計</td>
                        {mks.map(mk => { const v = teamMonth(all, mk); return <td key={mk} {...clk(v, { staff: '', mk, mode: 'all' })} className={`r ${v ? 'clk' : ''}`}>{fmtMan(v)}</td>; })}
                        <td className="r">{fmtYen(teamTot)}</td><td className="r">{fmtYen(teamBud)}</td><td className="r">{teamBud ? pct(teamTot / teamBud) : '―'}</td><td></td>
                    </tr>
                </tbody></table></div>
                <div className="rlt-body rlt-sub" style={{ paddingTop: 8 }}>月別セルは万円表示・年間は円表示です。数字の入ったセルをクリックすると、その月の内訳（物件・顧客・手数料・リフォーム）が表示されます。この表は<b>売上計上額（仲介手数料＋リフォーム粗利）</b>の集計です。リフォーム受注額は売上に含めません。</div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>月次売上グラフ（2軸複合：棒＝実績・目標／折線＝累計達成進捗率）</h3>
                    <span className="rlt-note">左軸＝月次の売上目標と実績（濃紺＝確定／淡色＝見込含む全体）。右軸＝年間予算に対する、その月までの累計達成進捗率</span></div>
                <div className="rlt-body" style={{ overflowX: 'auto' }}>
                    <ComboChart
                        mks={mks} W={880} H={300} minMax={1000000}
                        aria="月次売上（実績・目標）と年間予算に対する累計達成進捗率の2軸複合グラフ"
                        axisL="金額（万円）" axisR="累計達成率（％）"
                        fmtL={v => `${(v / 10000).toFixed(0)}万`} fmtB={v => (v / 10000).toFixed(0)} fmtT={v => fmtYen(v)}
                        bars={[
                            { name: '月次目標', vals: tgt, fill: '#efece7', stroke: '#c9c3ba' },
                            { name: '実績（見込含む）', vals, fill: '#b9c8d4', overlay: { name: 'うち確定', vals: cvals, fill: '#22405c' } },
                        ]}
                        line={{ name: '累計達成進捗率（年間予算比）', vals: line, color: '#1a6b3c' }}
                    />
                </div>
                <div className="rlt-body rlt-sub">月次目標は設定の「今月目標売上」の合計（未設定なら年間予算÷12）。累計達成進捗率＝（当月までの実績累計 ÷ 年間予算合計）で、上の表の「達成率」と同じ基準（見込を含む）です。グラフは売上計上額（仲介手数料＋リフォーム粗利）ベースです。</div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>内訳①：確定売上（契約済＋契約予定＋決済完了）</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}<th className="r">年間確定計</th><th className="r">見込み残</th>
                </tr></thead><tbody>
                    {rows.map(s => {
                        const n = String(s.name);
                        const cTot = sumRow(conf[n], mks), aTot = sumRow(all[n], mks);
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(conf, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'conf' })}>{fmtMan(v)}</td>; })}
                                <td className="r"><b>{fmtYen(cTot)}</b></td><td className="r">{fmtYen(aTot - cTot)}</td>
                            </tr>
                        );
                    })}
                </tbody></table></div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>内訳②：月次契約件数（契約日ベース）</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}<th className="r">年間件数</th><th className="r">1件平均売上</th>
                </tr></thead><tbody>
                    {rows.map(s => {
                        const n = String(s.name);
                        const c = sumRow(cnt[n], mks), tot = sumRow(all[n], mks);
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(cnt, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'all' })}>{fmtCnt(v)}</td>; })}
                                <td className="r"><b>{fmtCnt(c)}</b></td><td className="r">{c ? fmtYen(tot / c) : '―'}</td>
                            </tr>
                        );
                    })}
                </tbody></table></div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head">
                    <h3>内訳③：仲介手数料／リフォーム粗利・受注額</h3>
                    <span className="rlt-note">商談案件管理で入力したリフォーム受注額・粗利を契約日の月に計上（失注は除外・共同担当は売上割合で按分）。<b>売上に計上されるのは粗利のみ</b>です</span>
                    <div className="rlt-sl-chips">
                        {([['fee', '仲介手数料のみ'], ['gp', 'リフォーム粗利'], ['price', 'リフォーム受注額（参考）']] as const).map(([k, l]) => (
                            <button key={k} className={`rlt-sl-chip ${rfMode === k ? 'on' : ''}`} onClick={() => setRfMode(k)}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="rlt-body rlt-sub">年間累計　仲介手数料 <b>{fmtYen(yFee)}</b>　＋　リフォーム粗利 <b>{fmtYen(yRg)}</b>　＝　売上計上額 <b>{fmtYen(ySales)}</b>　／　参考：リフォーム受注額 <b>{fmtYen0(yRf)}</b>（粗利率 {yRf ? pct(yRg / yRf) : '―'}）</div>
                <div className="rlt-tblwrap"><table className="rlt-tbl rlt-sl-tbl"><thead><tr>
                    <th>担当者<br /><span className="rlt-note">{RSET.ttl}</span></th>{mks.map(mk => <th key={mk} className="r">{mShort(mk)}</th>)}<th className="r">年間計</th>
                    {rfMode === 'fee' ? <><th className="r">年間リフォーム<br />粗利</th><th className="r">売上計上額</th></>
                        : rfMode === 'gp' ? <><th className="r">年間受注額</th><th className="r">粗利率</th></>
                            : <><th className="r">年間粗利</th><th className="r">粗利率</th></>}
                </tr></thead><tbody>
                    {rows.map(s => {
                        const n = String(s.name);
                        const yv = sumRow(RSET.d[n], mks), sp = sumRow(rfP[n], mks), sg = sumRow(rfG[n], mks);
                        return (
                            <tr key={n}>
                                <td>{n}</td>
                                {mks.map(mk => { const v = cell(RSET.d, n, mk); return <td key={mk} {...clk(v, { staff: n, mk, mode: 'all' })}>{v ? fmtMan(v) : '0'}</td>; })}
                                <td className="r"><b>{fmtYen(yv)}</b></td>
                                {rfMode === 'fee' ? <><td className="r">{fmtYen0(sg)}</td><td className="r"><b>{fmtYen(yv + sg)}</b></td></>
                                    : <><td className="r">{fmtYen0(rfMode === 'gp' ? sp : sg)}</td><td className="r">{sp ? pct(sg / sp) : '―'}</td></>}
                            </tr>
                        );
                    })}
                    {(() => {
                        const tv = mks.map(mk => teamMonth(RSET.d, mk));
                        const yv = tv.reduce((a, x) => a + x, 0);
                        return (
                            <tr className="total">
                                <td>チーム合計</td>
                                {mks.map((mk, i) => <td key={mk} className={`r ${tv[i] ? 'clk' : ''}`} onClick={tv[i] ? () => setDrill({ staff: '', mk, mode: 'all' }) : undefined}>{fmtMan(tv[i])}</td>)}
                                <td className="r">{fmtYen(yv)}</td>
                                {rfMode === 'fee' ? <><td className="r">{fmtYen0(yRg)}</td><td className="r"><b>{fmtYen(yv + yRg)}</b></td></>
                                    : <><td className="r">{fmtYen0(rfMode === 'gp' ? yRf : yRg)}</td><td className="r">{yRf ? pct(yRg / yRf) : '―'}</td></>}
                            </tr>
                        );
                    })()}
                </tbody></table></div>
                <div className="rlt-body rlt-sub" style={{ paddingTop: 8 }}>月別セルは万円表示・年間計は円表示です。「リフォーム受注額」は売上には計上せず、粗利率を確認するための参考値として表示しています。上部の月次売上表・グラフ・年間予算進捗は、いずれも<b>仲介手数料＋リフォーム粗利</b>で集計しています。</div>
            </div>

            {drill && <SalesDrill deals={deals} drill={drill} onClose={() => setDrill(null)} />}
        </div>
    );
};

/** セルを押したときの内訳（drillSales）。⚠️ 担当者を指定して開いたときは按分後の金額 */
const SalesDrill: React.FC<{ deals: Row[]; drill: Drill; onClose: () => void }> = ({ deals, drill, onClose }) => {
    const { staff, mk, mode } = drill;
    const list = deals.filter(d => {
        const cd = str(d.contractDate);
        if (!cd || cd.slice(0, 7) !== mk) return false;
        if (str(d.phase) === '失注') return false;
        if (staff && d.staff !== staff && d.subStaff !== staff) return false;
        if (mode === 'conf' && !CONFIRMED.includes(str(d.phase))) return false;
        return true;
    }).sort((a, b) => (str(a.contractDate) < str(b.contractDate) ? -1 : 1));
    const title = `${staff || 'チーム全体'}　${monthLabel(mk)}${mode === 'conf' ? '　確定売上の内訳' : '　売上内訳'}`;
    let tot = 0, rTot = 0, gTot = 0;
    const lines = list.map(d => {
        const fee = staff ? shareOf(d, staff, dealFee) : dealFee(d);
        const rf = staff ? shareOf(d, staff, dealReform) : dealReform(d);
        const rg = staff ? shareOf(d, staff, dealReformGp) : dealReformGp(d);
        tot += fee; rTot += rf; gTot += rg;
        return { d, fee, rf, rg };
    });
    return (
        <div className="rlt-sl-modal" onClick={onClose}>
            <div className="box" onClick={e => e.stopPropagation()}>
                <div className="head">📈 {title}<button className="rlt-btn sec" style={{ marginLeft: 'auto' }} onClick={onClose}>閉じる</button></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl"><thead><tr>
                    <th>物件名</th><th>種別</th><th>顧客名</th>{!staff && <th>担当</th>}
                    <th className="r">成約価格(円)</th><th className="r">仲介手数料(円)</th><th className="r">リフォーム<br />受注額(円)<br /><span className="rlt-note">※参考</span></th>
                    <th className="r">リフォーム<br />粗利(円)</th><th className="r">売上計上額(円)<br /><span className="rlt-note">手数料＋粗利</span></th><th>フェーズ</th><th>契約日</th>
                </tr></thead><tbody>
                    {lines.map(({ d, fee, rf, rg }) => (
                        <tr key={str(d.id)}>
                            <td>{str(d.property)}{d.reformNote ? <div className="rlt-note">🔧{str(d.reformNote)}</div> : null}</td>
                            <td>{str(d.type)}</td><td>{str(d.customer)}</td>
                            {!staff && <td>{str(d.staff)}{d.subStaff ? <><br /><span className="rlt-note">+{str(d.subStaff)}({Number(d.subRatio) || 0}%)</span></> : null}</td>}
                            <td className="r">{fmtYen(Number(d.price) || 0)}</td>
                            <td className="r" style={Number(d.feeManual) ? { background: '#fff8e1' } : undefined}>
                                {fmtYen(fee)}
                                {d.subStaff && d.subRatio ? <><br /><span className="rlt-note">按分 {str(d.staff)}{100 - (Number(d.subRatio) || 0)}% / {str(d.subStaff)}{Number(d.subRatio) || 0}%</span></> : null}
                            </td>
                            <td className="r">{fmtYen0(rf)}</td><td className="r">{fmtYen0(rg)}</td><td className="r"><b>{fmtYen(fee + rg)}</b></td>
                            <td><PhaseBadge phase={str(d.phase)} /></td><td>{str(d.contractDate).replace(/-/g, '/')}</td>
                        </tr>
                    ))}
                    {lines.length === 0 && <tr><td colSpan={staff ? 10 : 11} className="rlt-sub" style={{ textAlign: 'center' }}>該当なし</td></tr>}
                    <tr className="total">
                        <td colSpan={staff ? 3 : 4}>合計 {lines.length}件</td><td></td><td className="r">{fmtYen(tot)}</td>
                        <td className="r">{fmtYen0(rTot)}</td><td className="r">{fmtYen0(gTot)}</td><td className="r"><b>{fmtYen(tot + gTot)}</b></td><td colSpan={2}></td>
                    </tr>
                </tbody></table></div>
                <p className="rlt-sub" style={{ padding: '8px 16px' }}>手数料が黄色の行は手入力額（規定計算式と異なる金額）です。リフォーム受注額・粗利は商談案件管理で入力した金額（担当者を指定して開いた場合は按分後）。<b>売上計上額＝仲介手数料＋リフォーム粗利</b>で、受注額は売上に含めません。</p>
            </div>
        </div>
    );
};

export default MonthlySales;
