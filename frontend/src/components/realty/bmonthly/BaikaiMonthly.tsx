import React, { useEffect, useMemo, useState } from 'react';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import { fiscalMonths, fmtYen, monthLabel, pct, sumRow, todayStr } from '../summary/kpi';
import type { Row, Settings } from '../summary/kpi';

/**
 * 月次媒介管理（不動産企画係。v2.2.225）。
 *
 * ⚠️ 移植元は本番アプリ（V18）の「📉 月次媒介管理」（renderBMonthly）。表・列・注記・セルを押したときの内訳（drillBaikai）を同じにしている。
 *   括弧の中は移植元の関数名。見た目だけ Dashboard に寄せた。
 * 集計: 媒介台帳の媒介契約日（初回獲得日）の月で数える。期間は今期の12か月（期首月は設定）。
 * ⚠️ 内訳の「書類」ボタン（docBtn）は移していない（書類の画面を移すときに足す）。
 */

type BmSettings = Settings & { sources?: string[]; baikaiTypes?: string[] };
type CountMap = Record<string, Record<string, number>>;
type DrillKind = 'staff' | 'type' | 'source';

const STYLE = `
.rlt-bm .clk { cursor: pointer; text-decoration: underline dotted; }
.rlt-bm td.auto { background: #f3faf5; }
.rlt-bm td.warn { background: #fff8e1; }
.rlt-bm .tbl th, .rlt-bm .tbl td { white-space: nowrap; }
.rlt-bm .small { font-size: 11px; color: #6c757d; }
.rlt-bm .chartwrap { overflow-x: auto; }
.rlt-bm-badge { display: inline-block; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: bold; }
.rlt-bm-badge.navy { background: #e7f1ff; color: #0a58ca; }
.rlt-bm-badge.green { background: #d1e7dd; color: #0f5132; }
.rlt-bm-badge.gray { background: #efeeeb; color: #495057; }
.rlt-bm-modal { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.rlt-bm-modal .box { background: #fff; border-radius: 8px; max-width: 1100px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; }
.rlt-bm-modal .head { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #dee2e6; font-weight: bold; font-size: 13px; }
.rlt-bm-modal .body { padding: 12px 16px; overflow: auto; }
.rlt-bm-modal .foot { padding: 10px 16px; border-top: 1px solid #dee2e6; text-align: right; }
`;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 'M月'（mLabel） */
const mLabel = (mk: string): string => `${Number(mk.split('-')[1])}月`;

/** 'YYYY/M/D'（fmtD） */
const fmtD = (ds: unknown): string => {
    if (!ds) return '―';
    const [y, m, d] = str(ds).slice(0, 10).split('-');
    if (!d) return str(ds);
    return `${y}/${Number(m)}/${Number(d)}`;
};

/** 台帳を契約月で数える（ledgerCountBy）。keyFn が null なら数えない */
const ledgerCountBy = (ledger: Row[], keyFn: (l: Row) => string | null): CountMap => {
    const out: CountMap = {};
    for (const led of ledger) {
        const cd = str(led.contractDate);
        if (!cd) continue;
        const mk = cd.slice(0, 7);
        const k = keyFn(led);
        if (k == null) continue;
        const row = (out[k] = out[k] ?? {});
        row[mk] = (row[mk] ?? 0) + 1;
    }
    return out;
};

/** グラフの上限をきりの良い値に（niceMax） */
const niceMax = (v: number): number => {
    if (!(v > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / e;
    const st = m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return st * e;
};

/** 凡例の文字幅の目安（svgTextW） */
const svgTextW = (t: string): number => {
    let w = 0;
    for (const ch of t) w += ch.charCodeAt(0) < 128 ? 5.6 : 10;
    return w;
};

/** 累計の線を引く最後の月（cumEnd）: 実績がある最後の月と今月の遅い方 */
const cumEnd = (mks: string[], vals: number[]): number => {
    let last = -1;
    vals.forEach((v, i) => { if (v) last = i; });
    return Math.max(last, mks.indexOf(todayStr().slice(0, 7)));
};

/** 月次媒介獲得グラフ（baikaiChart → comboChart）。棒＝目標・実績／折線＝累計達成進捗率 */
const BaikaiChart: React.FC<{ mks: string[]; actual: number[]; annualTarget: number }> = ({ mks, actual, annualTarget }) => {
    const mt = annualTarget > 0 ? annualTarget / 12 : 0;
    const tgt = mks.map(() => mt);
    let cum = 0;
    const end = cumEnd(mks, actual);
    const line = actual.map((v, i) => { cum += v; return annualTarget > 0 && i <= end ? (cum / annualTarget) * 100 : null; });
    const bars = [
        { name: '月次目標（年間÷12）', vals: tgt, fill: '#efece7', stroke: '#c9c3ba' },
        { name: '媒介獲得実績', vals: actual, fill: '#1a6b3c', stroke: '' },
    ];
    const lineName = '累計達成進捗率（年間目標比）';
    const lc = '#22405c';
    const n = mks.length || 1;
    const W = 880, H = 300, pad = { l: 66, r: 62, t: 36, b: 34 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / n;
    let maxL = 5;
    for (const g of bars) for (const v of g.vals) if (v > maxL) maxL = v;
    maxL = niceMax(maxL);
    let maxR = 100;
    for (const v of line) if (v != null && v > maxR) maxR = v;
    maxR = Math.ceil(maxR / 25) * 25;
    const T = 4;
    const yL = (v: number) => pad.t + ih - (ih * Math.min(v, maxL)) / maxL;
    const yR = (v: number) => pad.t + ih - (ih * Math.min(v, maxR)) / maxR;
    const fmtL = (v: number) => `${Math.round(v * 10) / 10}件`;
    const gn = bars.length, slot = (bw * 0.78) / gn, off = bw * 0.11;
    const pts = line.map((v, i) => (v == null ? null : `${(pad.l + bw * i + bw / 2).toFixed(1)},${yR(v).toFixed(1)}`)).filter((p): p is string => p !== null);
    let lx = pad.l;
    const legend: React.ReactNode[] = [];
    for (const g of bars) {
        legend.push(<g key={g.name}><rect x={lx} y={7} width={10} height={10} fill={g.fill} stroke={g.stroke || undefined} /><text x={lx + 14} y={16} fontSize={10} fill="#57534e">{g.name}</text></g>);
        lx += 18 + svgTextW(g.name);
    }
    const hasLine = line.some(v => v != null);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="月次媒介獲得件数（実績・目標）と年間獲得目標に対する累計達成進捗率の2軸複合グラフ">
            {Array.from({ length: T + 1 }, (_, i) => {
                const y = pad.t + (ih * i) / T, a = (maxL * (T - i)) / T, b = (maxR * (T - i)) / T;
                return (
                    <g key={i}>
                        <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#e6e4e0" />
                        <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#78716c">{fmtL(a)}</text>
                        <text x={W - pad.r + 6} y={y + 4} textAnchor="start" fontSize={10} fill={lc}>{Math.round(b)}%</text>
                    </g>
                );
            })}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke="#c9c3ba" />
            <line x1={W - pad.r} y1={pad.t} x2={W - pad.r} y2={pad.t + ih} stroke={lc} opacity={0.55} />
            {mks.map((mk, i) => {
                const lv = bars[gn - 1].vals[i] || 0;
                const lcx = pad.l + bw * i + off + slot * (gn - 1) + slot * 0.45;
                return (
                    <g key={mk}>
                        {bars.map((g, gi) => {
                            const x = pad.l + bw * i + off + slot * gi, w = slot * 0.9, v = g.vals[i] || 0;
                            return v > 0 ? (
                                <rect key={g.name} x={x} y={yL(v)} width={w} height={pad.t + ih - yL(v)} fill={g.fill} stroke={g.stroke || undefined}>
                                    <title>{`${mLabel(mk)} ${g.name}：${v}件`}</title>
                                </rect>
                            ) : null;
                        })}
                        {lv > 0 && <text x={lcx} y={yL(lv) - 4} textAnchor="middle" fontSize={9} fill="#44403c">{String(lv)}</text>}
                        <text x={pad.l + bw * i + bw / 2} y={pad.t + ih + 15} textAnchor="middle" fontSize={10} fill="#57534e">{mLabel(mk)}</text>
                    </g>
                );
            })}
            {hasLine && (
                <>
                    {maxR >= 100 && <line x1={pad.l} y1={yR(100)} x2={W - pad.r} y2={yR(100)} stroke={lc} strokeDasharray="4 3" opacity={0.45}><title>年間目標 100%</title></line>}
                    {pts.length > 1 && <polyline fill="none" stroke={lc} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} />}
                    {line.map((v, i) => {
                        if (v == null) return null;
                        const x = pad.l + bw * i + bw / 2, y = yR(v);
                        return (
                            <g key={i}>
                                <circle cx={x} cy={y} r={3.4} fill="#fff" stroke={lc} strokeWidth={1.8}><title>{`${mLabel(mks[i])} 累計達成進捗率：${v.toFixed(1)}%`}</title></circle>
                                <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={lc} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{v.toFixed(0)}%</text>
                            </g>
                        );
                    })}
                </>
            )}
            {legend}
            {hasLine && (
                <g>
                    <line x1={lx} y1={12} x2={lx + 16} y2={12} stroke={lc} strokeWidth={2} />
                    <circle cx={lx + 8} cy={12} r={3.2} fill="#fff" stroke={lc} strokeWidth={1.6} />
                    <text x={lx + 21} y={16} fontSize={10} fill={lc}>{lineName}</text>
                </g>
            )}
            <text x={pad.l - 6} y={pad.t - 9} textAnchor="end" fontSize={9} fill="#78716c">件数（件）</text>
            <text x={W - pad.r + 6} y={pad.t - 9} textAnchor="start" fontSize={9} fill={lc}>累計達成率（％）</text>
        </svg>
    );
};

/** 物件状態（propBadge） */
const PropBadge: React.FC<{ s: string }> = ({ s }) =>
    s === 'アクティブ' ? <span className="rlt-bm-badge navy">アクティブ</span>
        : s === '成約完了' ? <span className="rlt-bm-badge green">成約完了</span>
            : <span className="rlt-bm-badge gray">{s || '―'}</span>;

const BaikaiMonthly: React.FC = () => {
    const [ledger, setLedger] = useState<Row[]>([]);
    const [deals, setDeals] = useState<Row[]>([]);
    const [settings, setSettings] = useState<BmSettings>({});
    const [loading, setLoading] = useState(true);
    const [drill, setDrill] = useState<{ kind: DrillKind; key: string; mk: string } | null>(null);

    useEffect(() => {
        loadRecords(['ledger', 'deals'])
            .then(({ records, settings: st }) => { setLedger(records.ledger); setDeals(records.deals); setSettings(st as BmSettings); })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const data = useMemo(() => {
        const mks = fiscalMonths(settings.fiscalStart);
        const staff = (settings.staff ?? []).filter(s => s.name);
        const baikaiTypes = settings.baikaiTypes ?? [];
        const sources = settings.sources ?? [];
        /** 略称 → 名前（abbrToName） */
        const abbrToName = (ab: string) => (settings.staff ?? []).find(x => x.abbr === ab)?.name ?? ab;
        const byStaff = ledgerCountBy(ledger, l => abbrToName(str(l.staff)) || '（担当未設定）');
        const byType = ledgerCountBy(ledger, l => (baikaiTypes.includes(str(l.baikaiType)) ? str(l.baikaiType) : '未分類'));
        const bySrc = ledgerCountBy(ledger, l => (sources.includes(str(l.source)) ? str(l.source) : '未分類'));
        const byStaffKaitori = ledgerCountBy(ledger, l => (str(l.baikaiType) === '買取' ? abbrToName(str(l.staff)) || '（担当未設定）' : null));
        const dealKaitori: CountMap = {};
        for (const d of deals) {
            if (str(d.type) !== '買取' || !str(d.contractDate) || str(d.phase) === '失注') continue;
            const nm = str(d.staff) || '（担当未設定）', mk = str(d.contractDate).slice(0, 7);
            const row = (dealKaitori[nm] = dealKaitori[nm] ?? {});
            row[mk] = (row[mk] ?? 0) + 1;
        }
        const teamRow = mks.map(mk => staff.reduce((a, s) => a + (byStaff[String(s.name)]?.[mk] ?? 0), 0));
        const teamTot = teamRow.reduce((a, b) => a + b, 0);
        const teamTgt = staff.reduce((a, s) => a + (Number(s.baikaiTarget) || 0), 0);
        const unset = ledger.filter(l => str(l.contractDate) && mks.includes(str(l.contractDate).slice(0, 7)) && !(settings.staff ?? []).some(s => s.abbr === str(l.staff))).length;
        return { mks, staff, baikaiTypes, sources, abbrToName, byStaff, byType, bySrc, byStaffKaitori, dealKaitori, teamRow, teamTot, teamTgt, unset };
    }, [ledger, deals, settings]);

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const { mks, staff, byStaff, byType, bySrc, byStaffKaitori, dealKaitori, teamRow, teamTot, teamTgt, unset, abbrToName } = data;

    /** 数字のセル。0 でなければ押すと内訳 */
    const cell = (v: number, kind: DrillKind | null, key: string, mk: string, cls = 'auto', blankZero = false) => (
        <td key={mk} className={`r ${cls} ${v && kind ? 'clk' : ''}`}
            onClick={v && kind ? () => setDrill({ kind, key, mk }) : undefined}
            title={v && kind ? 'クリックで内訳表示' : undefined}>
            {blankZero && !v ? '' : v}
        </td>
    );

    /** 媒介種別別・反響元別（matrix） */
    const matrix = (title: string, keys: string[], by: CountMap, kind: DrillKind) => {
        const tots = keys.map(k => sumRow(by[k], mks));
        const grand = tots.reduce((a, b) => a + b, 0);
        const unc = sumRow(by['未分類'], mks);
        return (
            <div className="rlt-card">
                <div className="rlt-card-head"><h3>{title}</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl tbl"><thead><tr>
                    <th></th>{mks.map(mk => <th key={mk} className="r">{mLabel(mk)}</th>)}<th className="r">年間合計</th><th className="r">構成比</th>
                </tr></thead><tbody>
                    {keys.map((k, i) => (
                        <tr key={k}>
                            <td>{k}</td>{mks.map(mk => cell(by[k]?.[mk] ?? 0, kind, k, mk))}
                            <td className="r"><b>{tots[i]}</b></td><td className="r">{grand ? pct(tots[i] / grand) : '―'}</td>
                        </tr>
                    ))}
                    <tr className="total">
                        <td>合計</td>{mks.map(mk => <td key={mk} className="r">{keys.reduce((a, k) => a + (by[k]?.[mk] ?? 0), 0)}</td>)}
                        <td className="r">{grand}</td><td></td>
                    </tr>
                    {unc > 0 && (
                        <tr>
                            <td>未分類 ⚠</td>{mks.map(mk => <td key={mk} className="r warn">{by['未分類']?.[mk] ?? 0}</td>)}
                            <td className="r warn">{unc}</td><td className="small">マスタと不一致</td>
                        </tr>
                    )}
                </tbody></table></div>
            </div>
        );
    };

    /** 担当者別 月次 買取（kaitoriTable） */
    const kaitoriTable = (title: string, note: string, by: CountMap, drillable: boolean) => {
        const names = staff.map(s => String(s.name));
        for (const k of Object.keys(by)) if (!names.includes(k)) names.push(k);
        const tots = names.map(n => sumRow(by[n], mks));
        const grand = tots.reduce((a, b) => a + b, 0);
        return (
            <div className="rlt-card">
                <div className="rlt-card-head"><h3>{title}</h3><span className="rlt-note">{note}</span></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mLabel(mk)}</th>)}<th className="r">年間合計</th><th className="r">構成比</th>
                </tr></thead><tbody>
                    {names.length === 0 && <tr><td colSpan={mks.length + 3} className="rlt-sub">担当者が登録されていません</td></tr>}
                    {names.map((n, i) => (
                        <tr key={n}>
                            <td>{n}</td>{mks.map(mk => cell(by[n]?.[mk] ?? 0, drillable ? 'staff' : null, n, mk, 'auto', true))}
                            <td className="r"><b>{tots[i]}</b></td><td className="r">{grand ? pct(tots[i] / grand) : '―'}</td>
                        </tr>
                    ))}
                    <tr className="total">
                        <td>チーム合計</td>{mks.map(mk => <td key={mk} className="r">{names.reduce((a, n) => a + (by[n]?.[mk] ?? 0), 0)}</td>)}
                        <td className="r">{grand}</td><td></td>
                    </tr>
                </tbody></table></div>
            </div>
        );
    };

    /** 内訳（drillBaikai） */
    const drillView = () => {
        if (!drill) return null;
        const { kind, key, mk } = drill;
        const baikaiTypes = data.baikaiTypes, sources = data.sources;
        const list = ledger.filter(l => {
            const cd = str(l.contractDate);
            if (!cd || cd.slice(0, 7) !== mk) return false;
            if (kind === 'staff' && key && abbrToName(str(l.staff)) !== key) return false;
            if (kind === 'type' && (baikaiTypes.includes(str(l.baikaiType)) ? str(l.baikaiType) : '未分類') !== key) return false;
            if (kind === 'source' && (sources.includes(str(l.source)) ? str(l.source) : '未分類') !== key) return false;
            return true;
        }).sort((a, b) => (str(a.contractDate) < str(b.contractDate) ? -1 : 1));
        const kindLbl = { staff: '担当', type: '媒介種別', source: '反響元' }[kind];
        const title = `${key || 'チーム全体'}　${monthLabel(mk)}　媒介獲得の内訳（${kindLbl}別）`;
        return (
            <div className="rlt-bm-modal" onClick={() => setDrill(null)}>
                <div className="box" onClick={e => e.stopPropagation()}>
                    <div className="head">📉 {title}</div>
                    <div className="body rlt-tblwrap">
                        <table className="rlt-tbl tbl"><thead><tr>
                            <th className="r">台帳No.</th><th>担当</th><th>売主名</th><th>所在地</th><th>媒介種別</th><th>反響元</th>
                            <th className="r">販売価格(円)</th><th>媒介契約日</th><th>物件状態</th>
                        </tr></thead><tbody>
                            {list.map(l => (
                                <tr key={str(l.id)}>
                                    <td className="r">{str(l.no) || '―'}</td><td>{str(l.staff)}</td><td><b>{str(l.seller)}</b></td>
                                    <td className="small">{str(l.addr1)}{l.addr2 ? ` ${str(l.addr2).split('http')[0].trim().slice(0, 20)}` : ''}</td>
                                    <td>{str(l.baikaiType) || '―'}</td><td>{str(l.source)}</td>
                                    <td className="r">{l.price ? fmtYen(Number(l.price)) : '―'}</td><td>{fmtD(l.contractDate)}</td>
                                    <td><PropBadge s={str(l.propStatus)} /></td>
                                </tr>
                            ))}
                            {list.length === 0 && <tr><td colSpan={9} className="rlt-sub">該当なし</td></tr>}
                            <tr className="total"><td colSpan={9}>合計 {list.length}件</td></tr>
                        </tbody></table>
                        <p className="small" style={{ marginTop: 8 }}>編集は媒介獲得台帳から行えます。</p>
                    </div>
                    <div className="foot"><button className="rlt-btn sec" onClick={() => setDrill(null)}>閉じる</button></div>
                </div>
            </div>
        );
    };

    return (
        <div className="rlt-page rlt-bm">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-chart-column me-2" style={{ color: '#0d6efd' }}></i>月次媒介管理</h1>
                <p className="rlt-sub">媒介契約日（初回獲得日）＝計上月。更新しても獲得月は動きません。媒介台帳から自動集計。</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>担当者別 月次獲得件数</h3></div>
                <div className="rlt-tblwrap"><table className="rlt-tbl tbl"><thead><tr>
                    <th>担当者</th>{mks.map(mk => <th key={mk} className="r">{mLabel(mk)}</th>)}
                    <th className="r">年間合計</th><th className="r">年間目標</th><th className="r">達成率</th><th className="r">うち買取<br />(年間)</th><th className="r">台帳全期間</th>
                </tr></thead><tbody>
                    {staff.map(s => {
                        const name = String(s.name);
                        const tot = sumRow(byStaff[name], mks);
                        const tgt = Number(s.baikaiTarget) || 0;
                        const allCnt = ledger.filter(l => abbrToName(str(l.staff)) === name).length;
                        return (
                            <tr key={name}>
                                <td>{name}</td>{mks.map(mk => cell(byStaff[name]?.[mk] ?? 0, 'staff', name, mk))}
                                <td className="r"><b>{tot}</b></td><td className="r warn">{tgt}</td><td className="r">{tgt ? pct(tot / tgt) : '―'}</td>
                                <td className="r auto">{sumRow(byStaffKaitori[name], mks)}</td><td className="r">{allCnt}</td>
                            </tr>
                        );
                    })}
                    <tr className="total">
                        <td>チーム合計</td>{teamRow.map((v, i) => cell(v, 'staff', '', mks[i], ''))}
                        <td className="r">{teamTot}</td><td className="r">{teamTgt}</td><td className="r">{teamTgt ? pct(teamTot / teamTgt) : '―'}</td>
                        <td className="r">{staff.reduce((a, s) => a + sumRow(byStaffKaitori[String(s.name)], mks), 0)}</td><td className="r">{ledger.length}</td>
                    </tr>
                </tbody></table></div>
                <div className="rlt-body small" style={{ paddingTop: 8 }}>
                    {unset ? `⚠ 期間内で担当略称が設定と一致しない件数：${unset}件（担当未設定・枠外担当）。設定の略称を見直してください。` : '✅ 期間内の全件が設定済み担当に紐づいています。'}
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head">
                    <h3>月次媒介獲得グラフ（2軸複合：棒＝実績・目標／折線＝累計達成進捗率）</h3>
                    <span className="rlt-note">左軸＝月次の媒介獲得件数と目標。右軸＝年間獲得目標に対する、その月までの累計達成進捗率</span>
                </div>
                <div className="rlt-body chartwrap"><BaikaiChart mks={mks} actual={teamRow} annualTarget={teamTgt} /></div>
                <div className="rlt-body small">年間獲得目標はチーム合計 {teamTgt}件（設定の「年間媒介目標(件)」の合計）。月次目標はこれを12等分した参考値です。累計達成進捗率＝（当月までの獲得累計 ÷ 年間獲得目標）。</div>
            </div>

            {kaitoriTable('担当者別 月次 買取獲得件数（媒介獲得台帳）', '媒介種別＝「買取」の媒介契約日で計上。自社買取として仕入れた案件の獲得実績です', byStaffKaitori, true)}
            {kaitoriTable('担当者別 月次 買取契約件数（商談案件管理）', '商談案件管理の種別＝「買取」を契約日で計上（失注は除外）。台帳側と重複計上ではなく、契約ベースの参考値です', dealKaitori, false)}
            {matrix('媒介種別別 月次獲得件数', data.baikaiTypes, byType, 'type')}
            {matrix('反響元別 月次獲得件数', data.sources, bySrc, 'source')}

            {drillView()}
        </div>
    );
};

export default BaikaiMonthly;
