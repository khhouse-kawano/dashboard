import React, { useEffect, useMemo, useState } from 'react';
import { useListUrlSync } from '../database/listUrl';
import { errorText, landGet, landPost, monthLabel, useAsync, useLandMaster, type KpiDef } from './landApi';
import { LoadState } from './LandParts';
import { LAND_CSS } from './landStyle';

/**
 * 目標・月次入力（建売営業 → 土地仕入 → 目標・月次入力。/landTargets。v2.2.311。移行元の「月次入力」タブ・設定の年間目標）。
 *
 * ⚠️ 読み込みは ② の land_targets（GET）、保存は land:target_save・land:manual_save（POST。rows は JSON の文字列で送る）。
 * ⚠️ 手入力の実績は、記録から自動で数えた実績に「足す」分。手入力だけの KPI（仕入設定で足したもの）は、これだけで数える。
 * ⚠️ 0 や空にして保存すると、その目標・実績を消す。⚠️ 条件は URL にも出す（month）。
 */

type Grid = Record<number, Record<string, string>>;
interface Targets {
    month: string; fy: number; months: string[]; kpiDefs: KpiDef[];
    members: { id: number; name: string; areaName: string; active: boolean; auto: Record<string, number> }[];
    monthTargets: Record<number, Record<string, number>>; yearTargets: Record<number, Record<string, number>>; manual: Record<number, Record<string, number>>;
}
const toGrid = (src: Record<number, Record<string, number>>): Grid =>
    Object.fromEntries(Object.entries(src).map(([id, v]) => [id, Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]))]));

const LandTargets = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const [month, setMonth] = useState(initUrl.get('month') ?? '');
    const listParams = useMemo(() => (month ? { month } : ({} as Record<string, string>)), [month]);
    useListUrlSync(listParams, 1, 20, []);
    const { data, loading, error, reload } = useAsync(() => landGet<Targets>('land_targets', listParams), [listParams]);
    const [monthGrid, setMonthGrid] = useState<Grid>({});
    const [manualGrid, setManualGrid] = useState<Grid>({});
    const [yearGrid, setYearGrid] = useState<Grid>({});
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [showStopped, setShowStopped] = useState(false);

    useEffect(() => {
        if (!data) return;
        setMonthGrid(toGrid(data.monthTargets)); setManualGrid(toGrid(data.manual)); setYearGrid(toGrid(data.yearTargets));
    }, [data]);

    const save = async (roll: 'target_save' | 'manual_save', grid: Grid, extra: Record<string, string>, label: string) => {
        if (!data) return;
        setBusy(true); setMsg(null);
        const rows = data.members.flatMap((m) => data.kpiDefs.map((k) => ({ memberId: m.id, kpiKey: k.key, value: grid[m.id]?.[k.key] ?? '' })));
        try {
            await landPost(roll, { ...extra, rows: JSON.stringify(rows) });
            setMsg({ ok: true, text: `${label}を保存しました。` });
            void reload();
        } catch (e) { setMsg({ ok: false, text: errorText(e, '保存できませんでした。') }); } finally { setBusy(false); }
    };

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const members = (data?.members ?? []).filter((m) => showStopped || m.active);

    const gridTable = (grid: Grid, setGrid: React.Dispatch<React.SetStateAction<Grid>>, showAuto: boolean) => (
        <div className="ld_table_wrap">
            <table className="ld_table"><thead><tr>
                <th className="ld_th">担当</th>
                {(data?.kpiDefs ?? []).map((k) => <th key={k.key} className="ld_th ld_num">{k.label}<div className="ld_sub">{k.unit}{k.calc !== 'auto' ? '・手入力だけ' : ''}</div></th>)}
            </tr></thead><tbody>
                {members.map((m) => (
                    <tr key={m.id} className="ld_row">
                        <td className="ld_td ld_nowrap"><b>{m.name}</b><div className="ld_sub">{m.active ? m.areaName : '停止中'}</div></td>
                        {(data?.kpiDefs ?? []).map((k) => (
                            <td key={k.key} className="ld_td ld_num">
                                <input className="ld_input" type="number" style={{ width: 72, textAlign: 'right' }} aria-label={`${m.name}の${k.label}`}
                                    value={grid[m.id]?.[k.key] ?? ''} onChange={(e) => { const v = e.target.value; setGrid((g) => ({ ...g, [m.id]: { ...(g[m.id] ?? {}), [k.key]: v } })); }} />
                                {showAuto && k.calc === 'auto' && <div className="ld_sub">自動 {m.auto[k.key] ?? 0}</div>}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody></table>
        </div>
    );

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head"><span className="ld_title"><i className="fa-solid fa-bullseye me-2 text-primary" aria-hidden="true" />目標・月次入力</span></div>
                <div className="ld_bar">
                    <div><div className="ld_label">対象月</div>
                        <select className="ld_select" value={month || data?.month || ''} onChange={(e) => setMonth(e.target.value)}>
                            {[...(data?.months ?? [])].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select></div>
                    <label className="ld_note d-flex align-items-center gap-1"><input type="checkbox" checked={showStopped} onChange={(e) => setShowStopped(e.target.checked)} />停止中の担当者も出す</label>
                </div>
                {msg && <div className={msg.ok ? 'ld_ok' : 'ld_error'}>{msg.text}</div>}
                <LoadState loading={loading && !data} error={error} />
                {data && (
                    <>
                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">{monthLabel(data.month)} の月間目標</span>
                                <button className="ld_btn is_primary" disabled={busy} onClick={() => void save('target_save', monthGrid, { periodType: 'month', period: data.month }, '月間目標')}>保存</button></div>
                            {gridTable(monthGrid, setMonthGrid, false)}
                        </div>
                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">{monthLabel(data.month)} の手入力の実績</span>
                                <button className="ld_btn is_primary" disabled={busy} onClick={() => void save('manual_save', manualGrid, { ym: data.month }, '手入力の実績')}>保存</button></div>
                            <div className="ld_caution mb-2">記録から自動で数えた実績（各欄の下の「自動」）に、ここで入れた数を足します。1件ずつ記録していない分を補うときに使います。</div>
                            {gridTable(manualGrid, setManualGrid, true)}
                        </div>
                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">{data.fy}年度（6月〜翌5月）の年間目標</span>
                                <button className="ld_btn is_primary" disabled={busy} onClick={() => void save('target_save', yearGrid, { periodType: 'year', period: String(data.fy) }, '年間目標')}>保存</button></div>
                            {gridTable(yearGrid, setYearGrid, false)}
                        </div>
                        <div className="ld_note">0 か空にして保存すると、その欄を消します。チームの目標は、稼働中の担当者の目標を足したものです。</div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LandTargets;
