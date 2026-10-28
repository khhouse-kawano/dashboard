import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    GOAL_KEYS, LOCK_GRACE_DAY, REALTY_CSS, WCOLS, isOpenMonth, loadRealtyState, rateAverage, rateClass, rateTitle,
    saveWeeklyCells, weeklyRowsOf, weeklySellCalls,
} from '../common/realtyState';
import type { RealtyState, WeeklyCell, WeeklyKey, WeeklyRow } from '../common/realtyState';
import { fiscalMonths, monthLabel, pct, prevMonth } from '../summary/kpi';
import ContactQualityPanel from '../callq/ContactQualityPanel';

/**
 * 週次行動計画・実績（不動産企画係。v2.2.223）。
 *
 * ⚠️ 移植元は本番アプリの「📅 週次行動計画・実績」（renderWeekly）。
 *   ・黄色＝目標（手入力）／白＝実績（手入力）。⚠️ 架電実績だけは売り反響の📞架電の記録から数える（手入力不可）
 *   ・週：1〜7日／8〜14日／15〜21日／22日〜月末
 *   ・前月より前の月は、翌月5日を過ぎると目標を直せない（マスター・マネージャーは直せる）。実績はいつでも直せる
 * ⚠️ v2.2.226: 本番アプリ V16 の「接触の質」の表を、以前のアプリと同じく表の上に出す（callq/ContactQualityPanel.tsx）。
 */

const STYLE = `
.rlt-wk td.goal { background: #fff8e1; }
.rlt-wk td.auto { background: #f1f3f5; }
.rlt-wk input.cell { width: 56px; text-align: right; border: none; background: transparent; font-size: 11px; }
.rlt-wk input.cell:focus { outline: 2px solid #0d6efd55; background: #fff; }
.rlt-wk input.cell[readonly] { cursor: not-allowed; opacity: .75; }
.rlt-wk td.week { font-weight: bold; vertical-align: top; white-space: nowrap; }
.rlt-lock { font-size: 11px; border-radius: 4px; padding: 2px 8px; background: #f8d7da; color: #842029; }
.rlt-lock.ok { background: #d1e7dd; color: #0f5132; }
`;

const cellKey = (w: number, staff: string, key: WeeklyKey) => `${w}\u0000${staff}\u0000${key}`;
const MAX = 99999;

const WeeklyPlan: React.FC = () => {
    const [state, setState] = useState<RealtyState | null>(null);
    const [month, setMonth] = useState('');
    // ⚠️ 打っている途中の値（離れたときに確かめて保存する）
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const st = await loadRealtyState();
            setState(st);
            return st;
        } catch (e) {
            alert(`読み込めませんでした: ${(e as Error).message}`);
            return null;
        }
    }, []);

    useEffect(() => {
        void load().then(st => {
            if (!st) return;
            const mks = fiscalMonths(st.settings.fiscalStart);
            const cur = st.today.slice(0, 7);
            setMonth(mks.includes(cur) ? cur : mks[0]);
        });
    }, [load]);

    const months = useMemo(() => fiscalMonths(state?.settings.fiscalStart), [state?.settings.fiscalStart]);
    const names = useMemo(
        () => (state?.settings.staff ?? []).map(s => (s.name ?? '').trim()).filter(Boolean),
        [state?.settings.staff]
    );
    const rows = useMemo(() => {
        if (!state || !month) return [];
        return weeklyRowsOf(state.weekly[month], names, weeklySellCalls(state.sellLeads, month));
    }, [state, month, names]);

    if (!state || !month) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const open = isOpenMonth(month, state.today);
    const locked = !open && !state.isWeeklyAdmin;
    const rowOf = (w: number, s: string) => rows.find(r => r.week === w && r.staff === s);

    /** 保存して、返ってきたその月の行で置き換える */
    const save = async (cells: WeeklyCell[]) => {
        setBusy(true);
        try {
            const saved = await saveWeeklyCells(month, cells);
            setState(prev => (prev ? { ...prev, weekly: { ...prev.weekly, [month]: saved } } : prev));
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    /** 入力欄を離れたとき（本番アプリの wSet）。⚠️ 半角の整数 0〜99999 だけ */
    const commit = (r: WeeklyRow, key: WeeklyKey) => {
        const k = cellKey(r.week, r.staff, key);
        if (!(k in drafts)) return;
        const t = drafts[k].trim();
        const clear = () => setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
        let n = 0;
        if (t !== '') {
            if (!/^\d+$/.test(t)) { alert('半角の整数（0以上）で入力してください'); clear(); return; }
            n = Number(t);
            if (n > MAX) { alert(`入力できるのは 0〜${MAX} です`); clear(); return; }
        }
        clear();
        if (Number(r[key]) === n) return;
        void save([{ week: r.week, staff: r.staff, key, value: n }]);
    };

    /** 前週（第1週は前月の第4週）の目標をこの週へ写す（wCopyPrev） */
    const copyPrev = (w: number) => {
        const srcMonth = w === 1 ? prevMonth(month) : month;
        const srcWeek = w === 1 ? 4 : w - 1;
        const label = w === 1 ? `${monthLabel(srcMonth)} 第4週` : `第${srcWeek}週`;
        const src = state.weekly[srcMonth] ?? [];
        if (!src.length) { alert(`${label}のデータがありません`); return; }
        const cells: WeeklyCell[] = [];
        for (const s of names) {
            const so = src.find(x => x.week === srcWeek && x.staff === s);
            if (!so) continue;
            for (const key of GOAL_KEYS) cells.push({ week: w, staff: s, key, value: Number(so[key]) || 0 });
        }
        if (!cells.length) { alert(`${label}に同じ担当者の行がありません`); return; }
        const filled = rows.some(r => r.week === w && GOAL_KEYS.some(key => Number(r[key]) > 0));
        if (filled && !window.confirm(`第${w}週の目標を ${label} の値で上書きします。よろしいですか？`)) return;
        void save(cells);
    };

    const recount = async () => {
        await load();
        alert('架電実績を再集計しました（売り反響の📞架電のみ）');
    };

    const input = (r: WeeklyRow, key: WeeklyKey, readOnly: boolean, title?: string) => {
        const k = cellKey(r.week, r.staff, key);
        return (
            <input
                className="cell" type="text" inputMode="numeric" placeholder="0"
                value={k in drafts ? drafts[k] : (Number(r[key]) || '')}
                readOnly={readOnly} tabIndex={readOnly ? -1 : undefined} title={title}
                onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                onBlur={() => commit(r, key)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
        );
    };

    const total = (key: WeeklyKey, list: WeeklyRow[] = rows) => list.reduce((a, r) => a + (Number(r[key]) || 0), 0);
    const lockTitle = '確定済みの月のため編集できません（管理者のみ変更可）';

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-calendar-week me-2" style={{ color: '#0d6efd' }}></i>週次行動計画・実績</h1>
                <select className="rlt-input" value={month} onChange={e => setMonth(e.target.value)} disabled={busy}>
                    {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <button className="rlt-btn sec" onClick={recount} disabled={busy} title="売り反響の架電記録を読み直して架電実績を再集計">🔄 架電実績を再集計</button>
                {!open && (
                    state.isWeeklyAdmin
                        ? <span className="rlt-lock ok">🔓 確定済みの月（管理者のため編集可）</span>
                        : <span className="rlt-lock">🔒 確定済みの月のため目標は編集できません（管理者のみ変更可）</span>
                )}
            </div>
            <p className="rlt-sub" style={{ marginBottom: 12 }}>
                黄色＝目標（手入力・半角整数）／白＝実績入力。<b>架電実績は売り反響の「📞架電」の記録から自動集計（手入力不可）</b>。買い反響・LINE・メールは含みません。
                週：1〜7日／8〜14日／15〜21日／22日〜月末。達成率＝<span className="rlt-ok">100%以上</span>／<span className="rlt-mid">80%以上</span>／<span className="rlt-bad">80%未満</span>。
                前月より前の月は、翌月{LOCK_GRACE_DAY}日を過ぎると管理者（マスター・マネージャー）以外は目標を編集できません。
            </p>

            {names.length === 0 ? (
                <div className="rlt-alert">担当者が登録されていません。設定画面で担当者を追加してください。</div>
            ) : (
                <>
                    <ContactQualityPanel month={month} names={names} />

                    <div className="rlt-card rlt-tblwrap">
                        <table className="rlt-tbl rlt-wk">
                            <thead><tr>
                                <th>週</th><th>担当者</th>
                                {WCOLS.map(([, , label]) => (
                                    <React.Fragment key={label}>
                                        <th className="r">{label}目標</th>
                                        <th className="r">{label}実績{label === '架電' ? '🔒' : ''}</th>
                                    </React.Fragment>
                                ))}
                                <th className="r">達成率平均</th>
                            </tr></thead>
                            <tbody>
                                {[1, 2, 3, 4].map(w => names.map((s, i) => {
                                    const r = rowOf(w, s);
                                    if (!r) return null;
                                    const avg = rateAverage(WCOLS.map(([g, a]) => [Number(r[a]) || 0, Number(r[g]) || 0]));
                                    return (
                                        <tr key={`${w}-${s}`}>
                                            {i === 0 && (
                                                <td className="week" rowSpan={names.length}>
                                                    第{w}週
                                                    {!locked && (
                                                        <div><button className="rlt-btn sec" style={{ marginTop: 4, padding: '1px 6px' }} disabled={busy}
                                                            title={`${w === 1 ? '前月 第4週' : `第${w - 1}週`}の各目標を第${w}週へ一括コピー`}
                                                            onClick={() => copyPrev(w)}>📋 前週コピー</button></div>
                                                    )}
                                                </td>
                                            )}
                                            <td>{s}</td>
                                            {WCOLS.map(([g, a]) => {
                                                const gv = Number(r[g]) || 0;
                                                const av = Number(r[a]) || 0;
                                                const cls = rateClass(av, gv);
                                                return (
                                                    <React.Fragment key={g}>
                                                        <td className="r goal">{input(r, g, locked, locked ? lockTitle : undefined)}</td>
                                                        <td className={`r ${a === 'ca' ? 'auto' : ''} ${cls ? `rlt-${cls}` : ''}`} title={rateTitle(av, gv)}>
                                                            {a === 'ca'
                                                                ? <span title={`売り反響の📞架電記録から自動集計（第${w}週・${s}）`}>{av}</span>
                                                                : input(r, a, false)}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className={`r ${avg === null ? '' : `rlt-${rateClass(avg, 1)}`}`}>{avg === null ? '―' : pct(avg)}</td>
                                        </tr>
                                    );
                                }))}
                                <tr className="total">
                                    <td colSpan={2}>月次合計</td>
                                    {WCOLS.map(([g, a]) => {
                                        const cls = rateClass(total(a), total(g));
                                        return (
                                            <React.Fragment key={g}>
                                                <td className="r">{total(g)}</td>
                                                <td className={`r ${cls ? `rlt-${cls}` : ''}`} title={rateTitle(total(a), total(g))}>{total(a)}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                    <td className={`r ${total('cg') ? `rlt-${rateClass(total('ca'), total('cg'))}` : ''}`}>
                                        {total('cg') ? pct(total('ca') / total('cg')) : '―'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="rlt-card">
                        <div className="rlt-card-head"><h3>担当者別 月次計（自動集計）</h3></div>
                        <div className="rlt-tblwrap">
                            <table className="rlt-tbl">
                                <thead><tr>
                                    <th>担当者</th>
                                    {WCOLS.map(([, , label]) => <th key={label} className="r">{label}計</th>)}
                                    <th className="r">達成率平均</th>
                                </tr></thead>
                                <tbody>
                                    {names.map(s => {
                                        const mine = rows.filter(r => r.staff === s);
                                        const avg = rateAverage(WCOLS.map(([g, a]) => [total(a, mine), total(g, mine)]));
                                        return (
                                            <tr key={s}>
                                                <td>{s}</td>
                                                {WCOLS.map(([g, a]) => {
                                                    const cls = rateClass(total(a, mine), total(g, mine));
                                                    return (
                                                        <td key={a} className={`r ${cls ? `rlt-${cls}` : ''}`} title={rateTitle(total(a, mine), total(g, mine))}>
                                                            {total(a, mine)}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`r ${avg === null ? '' : `rlt-${rateClass(avg, 1)}`}`}>{avg === null ? '―' : pct(avg)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WeeklyPlan;
