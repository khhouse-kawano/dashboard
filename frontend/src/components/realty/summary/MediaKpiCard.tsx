import React, { useMemo, useState } from 'react';
import { periodGroups } from '../common/leadFunnel';
import { todayStr } from './kpi';
import type { Row } from './kpi';
import { DSK_AXES, DSK_KIND, DSK_NOSRC, dskAgg, dskCsv, dskLabel, dskMetricVal, dskRate, dskTone } from './mediaKpi';
import type { DskAxis, DskKind, DskRow, DskState } from './mediaKpi';

/**
 * 売りKPI・買いKPI のカード（v2.2.254。以前のアプリ v14.30 の dashKpiCard）。チームサマリーの見出しの下に置く。
 * ⚠️ 表示の条件（軸・期間・絞り込み・指標）は端末ごと・保存しない（以前のアプリと同じ）。
 * ⚠️ 対象月（期間「期首〜対象月の累計」の終わり）は、チームサマリーで選んだ月。通期を選んでいるときは今月。
 */
type Props = {
    kind: DskKind;
    /** 売り反響（kind=sell）か買い反響（kind=buy）。削除済みは除いたもの */
    rows: Row[];
    /** 対象月（'YYYY-MM'） */
    targetMonth: string;
    fiscalStart: string | undefined;
    /** 設定の並び（売りは反響元 sources・買いはポータル buyPortals） */
    order: string[];
    /** 設定の担当者の氏名 */
    staffNames: string[];
};

const css = `
.mkpi_card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 4px rgba(0,0,0,.05);border:1px solid #e9ecef;margin-bottom:16px;min-width:1200px}
.mkpi_head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.mkpi_title{font-size:13px;font-weight:bold;color:#343a40;margin-right:4px}
.mkpi_sel{font-size:11px;padding:3px 6px;border:1px solid #ced4da;border-radius:4px;background:#fff;color:#343a40}
.mkpi_btn{margin-left:auto;font-size:11px;padding:3px 10px;border:1px solid #ced4da;border-radius:4px;background:#fff;cursor:pointer;color:#343a40}
.mkpi_btn:hover{background:#f1f3f5}
.mkpi_note{font-size:10px;color:#6c757d;margin-bottom:8px;line-height:1.6}
.mkpi_wrap{overflow-x:auto;border:1px solid #dee2e6;border-radius:4px}
.mkpi_tbl{width:100%;border-collapse:collapse}
.mkpi_tbl th{padding:6px 8px;font-size:11px;background:#f8f9fa;color:#495057;border-bottom:1px solid #dee2e6;white-space:nowrap;font-weight:bold;text-align:right;position:sticky;top:0}
.mkpi_tbl td{padding:6px 8px;font-size:11px;border-bottom:1px solid #dee2e6;text-align:right;font-variant-numeric:tabular-nums}
.mkpi_tbl th:first-child,.mkpi_tbl td:first-child{text-align:left;white-space:nowrap}
.mkpi_tbl td.mkpi_auto{background:#f8f9fa}
.mkpi_tbl tr.mkpi_total td{background:#f1f3f5;font-weight:bold}
.mkpi_tbl td.mkpi_empty{text-align:center;color:#6c757d}
.mkpi_high{color:#198754;font-weight:bold}
.mkpi_low{color:#dc3545;font-weight:bold}
.mkpi_small{font-size:10px;font-weight:normal;color:#6c757d}
.mkpi_foot{font-size:10px;color:#6c757d;margin-top:6px}
`;

const toneClass = (t: '' | 'low' | 'high') => (t === 'high' ? 'mkpi_high' : t === 'low' ? 'mkpi_low' : undefined);

const MediaKpiCard: React.FC<Props> = ({ kind, rows, targetMonth, fiscalStart, order, staffNames }) => {
    const K = DSK_KIND[kind];
    const [st, setSt] = useState<DskState>({ p: 'cum', staff: '', src: '', axis: 'src', metric: 'r1' });
    const set = (k: keyof DskState) => (e: React.ChangeEvent<HTMLSelectElement>) => setSt(v => ({ ...v, [k]: e.target.value }));
    const tm = /^\d{4}-\d{2}$/.test(targetMonth) ? targetMonth : todayStr().slice(0, 7);

    const A = useMemo(() => dskAgg(kind, rows, st, tm, fiscalStart, order, staffNames), [kind, rows, st, tm, fiscalStart, order, staffNames]);
    const groups = useMemo(() => periodGroups(fiscalStart, rows), [fiscalStart, rows]);
    const srcOptions = useMemo(() => [...new Set([...order, ...rows.map(l => String(l[K.key] ?? '') || DSK_NOSRC)])], [order, rows, K.key]);
    const label = dskLabel(st.p, tm, fiscalStart);
    const { list, T } = A;

    const downloadCsv = () => {
        const { text, fileName } = dskCsv(A, st, tm, fiscalStart);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' }));
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const rateDef = K.rates.map(r => (
        <React.Fragment key={r.k}>
            {r.k !== 'r1' && '／'}<b>{r.label}</b>＝{K.steps.find(s => s.k === r.a)?.label}÷{K.steps.find(s => s.k === r.b)?.label}
        </React.Fragment>
    ));
    const emptyMsg = `${label}に受信した反響はまだありません`;

    const renderCross = () => {
        const mr = K.rates.find(r => r.k === st.metric);
        const mLabel = mr ? mr.label : K.steps.find(s => s.k === st.metric)?.label ?? '';
        const cell = (v: DskRow | undefined, tot: DskRow, key: string) => {
            if (!v) return <td key={key}>―</td>;
            return (
                <td key={key} className={mr ? toneClass(dskTone(v, tot, mr)) : 'mkpi_auto'}
                    title={K.steps.map(s => `${s.label} ${v.counts[s.k]}`).join(' / ')}>
                    {dskMetricVal(K, v, st.metric)}
                </td>
            );
        };
        return (
            <>
                <div className="mkpi_wrap">
                    <table className="mkpi_tbl">
                        <thead>
                            <tr>
                                <th>担当者 ＼ {K.keyLabel}<div className="mkpi_small">（{mLabel}）</div></th>
                                {A.colList.map(c => <th key={c}>{c}</th>)}
                                <th>合計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!A.colList.length ? (
                                <tr><td colSpan={2} className="mkpi_empty">{emptyMsg}</td></tr>
                            ) : (
                                <>
                                    {list.map(o => (
                                        <tr key={o.name}>
                                            <td>{o.name}</td>
                                            {A.colList.map(c => cell(A.cross[o.name]?.[c], A.colT[c], c))}
                                            <td className={mr ? toneClass(dskTone(o, T, mr)) : undefined}><b>{dskMetricVal(K, o, st.metric)}</b></td>
                                        </tr>
                                    ))}
                                    <tr className="mkpi_total">
                                        <td>合計</td>
                                        {A.colList.map(c => <td key={c}>{dskMetricVal(K, A.colT[c], st.metric)}</td>)}
                                        <td>{dskMetricVal(K, T, st.metric)}</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mkpi_foot">率は同じ{K.keyLabel}のチーム合計と比べて色分けしています（担当者間の比較）。セルにマウスを乗せると各段の件数を表示します。</div>
            </>
        );
    };

    const renderFlat = () => {
        const tr = (o: DskRow, tot: boolean) => (
            <tr key={tot ? '__total' : o.name} className={tot ? 'mkpi_total' : undefined}>
                <td>{o.name}</td>
                {K.steps.map(s => <td key={s.k} className={tot ? undefined : 'mkpi_auto'}>{o.counts[s.k]}</td>)}
                {K.rates.map(r => <td key={r.k} className={tot ? undefined : toneClass(dskTone(o, T, r))}>{dskRate(o.counts[r.a], o.counts[r.b])}</td>)}
            </tr>
        );
        return (
            <div className="mkpi_wrap">
                <table className="mkpi_tbl">
                    <thead>
                        <tr>
                            <th>{st.axis === 'src' ? K.keyLabel : '担当者'}</th>
                            {K.steps.map(s => <th key={s.k}>{s.label}</th>)}
                            {K.rates.map(r => <th key={r.k}>{r.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {!T.counts.leads && !list.length
                            ? <tr><td colSpan={1 + K.steps.length + K.rates.length} className="mkpi_empty">{emptyMsg}</td></tr>
                            : <>{list.map(o => tr(o, false))}{tr(T, true)}</>}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="mkpi_card" data-kind={kind}>
            <style>{css}</style>
            <div className="mkpi_head">
                <span className="mkpi_title">{K.title} {DSK_AXES[st.axis]}（{label}）</span>
                <select className="mkpi_sel" value={st.axis} onChange={set('axis')} aria-label="集計の軸">
                    {(Object.keys(DSK_AXES) as DskAxis[]).map(k => <option key={k} value={k}>{DSK_AXES[k]}</option>)}
                </select>
                <select className="mkpi_sel" value={st.p} onChange={set('p')} aria-label="期間">
                    <option value="cum">期首〜対象月の累計</option>
                    {groups.map(g => (
                        <optgroup key={g.label} label={g.label}>
                            {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </optgroup>
                    ))}
                </select>
                {st.axis === 'src' && (
                    <select className="mkpi_sel" value={st.staff} onChange={set('staff')} aria-label="担当">
                        <option value="">担当：全員</option>
                        <option value="__none">未割当のみ</option>
                        {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                )}
                {st.axis === 'staff' && (
                    <select className="mkpi_sel" value={st.src} onChange={set('src')} aria-label={K.keyLabel}>
                        <option value="">{K.keyLabel}：すべて</option>
                        {srcOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                )}
                {st.axis === 'cross' && (
                    <select className="mkpi_sel" value={st.metric} onChange={set('metric')} aria-label="表示する指標">
                        <optgroup label="率">{K.rates.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}</optgroup>
                        <optgroup label="件数">{K.steps.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}</optgroup>
                    </select>
                )}
                <button type="button" className="mkpi_btn" onClick={downloadCsv} title="この表をCSVで保存">⬇ CSV</button>
            </div>
            <div className="mkpi_note">
                {K.from}から自動集計（受信月コホート基準）。{rateDef}。チーム合計より5pt以上<span className="mkpi_high">高い</span>・<span className="mkpi_low">低い</span>率を色分け。分母0は「―」。
            </div>
            {st.axis === 'cross' ? renderCross() : renderFlat()}
        </div>
    );
};

export default MediaKpiCard;
