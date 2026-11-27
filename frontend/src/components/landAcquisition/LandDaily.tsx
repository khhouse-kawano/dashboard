import React, { useEffect, useMemo, useState } from 'react';
import { useListUrlSync } from '../database/listUrl';
import { errorText, fmtNum, landGet, landPost, mapUrlOf, monthLabel, useAsync, useLandMaster, type KpiDef, type LandApproach, type LandVendor } from './landApi';
import { Field, LoadState, MapLink, MemberSelect } from './LandParts';
import LandDealModal, { type DealPreset } from './LandDealModal';
import { downloadCsv, fetchAllRows, stamp } from './landCsv';
import { LAND_CSS, rateClass } from './landStyle';
import { AP_TYPES_LEAD, TSUBO_M2 } from './landLogic';

/**
 * 日次・アプローチ（建売営業 → 土地仕入 → 日次・アプローチ。/landDaily。v2.2.311。移行元の「日次・アプローチ」タブ）。
 *
 * ⚠️ 開いたときの担当者は、ログインした人に結び付いた担当者（仕入設定で結び付ける）。結び付いていなければ選ぶ。
 * ⚠️ アプローチは1件ずつ記録する（land:approach_save）。種別が直案件・業者持込なら「案件候補」を既定で ON（移行元と同じ）。
 * ⚠️ まとめ入力（履歴を残さない件数の補完）と日報は、1日・1担当者に1件。同じ日に保存すると上書き。
 * ⚠️ URL に担当者（memberId）と日付（date）を出す。
 */

type Daily = {
    month: string;
    counts: { id: number; date: string; counts: Record<string, number>; info: number; note: string; updatedBy: string }[];
    reports: { id: number; date: string; done: string; info: string; issue: string; next: string; updatedBy: string }[];
    days: { date: string; rec: number; log: number; info: number; byType: Record<string, number> }[];
};
type KpiRow = KpiDef & { actual: number; target: number; rate: number | null };
const REPORT_FIELDS: [keyof ReportForm, string, string][] = [
    ['done', '本日の活動', '例）鹿屋方面ローラー。〇〇不動産・△△建設ほか5社訪問。'],
    ['info', '取得情報・進捗', '例）国分中央3丁目の相続地（約120坪）。9月末に測量完了予定。'],
    ['issue', '課題・相談事項', '例）解体費の見積が高く、買付金額の判断で相談したい。'],
    ['next', '明日の予定', '例）霧島市内3社訪問。〇〇不動産へ買付の返答督促。'],
];
type ReportForm = { done: string; info: string; issue: string; next: string };
type ApForm = { id?: number; time: string; vendorName: string; vendorId: number | null; type: string; contact: string; reaction: string; infoCount: number; landM2: string; address: string; mapUrl: string; memo: string; isCandidate: boolean };
const emptyAp = (): ApForm => ({ time: '', vendorName: '', vendorId: null, type: '訪問', contact: '', reaction: '普通', infoCount: 0, landM2: '', address: '', mapUrl: '', memo: '', isCandidate: false });
const weekday = (d: string) => '日月火水木金土'[new Date(`${d}T00:00:00`).getDay()] ?? '';
const AP_PAGE = 30;

const LandDaily = () => {
    const { master, error: masterError } = useLandMaster();
    const [initUrl] = useState(() => new URLSearchParams(window.location.search));
    const [memberId, setMemberId] = useState<number | null>(initUrl.get('memberId') ? Number(initUrl.get('memberId')) : null);
    const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(initUrl.get('date') ?? '') ? initUrl.get('date')! : '');
    const [ap, setAp] = useState<ApForm>(emptyAp());
    const [vendorHits, setVendorHits] = useState<LandVendor[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [info, setInfo] = useState(0);
    const [note, setNote] = useState('');
    const [report, setReport] = useState<ReportForm>({ done: '', info: '', issue: '', next: '' });
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [apLimit, setApLimit] = useState(AP_PAGE);
    const [modal, setModal] = useState<{ preset: DealPreset } | null>(null);

    // 開いたとき：担当者＝自分（結び付いていれば）・日付＝今日
    useEffect(() => {
        if (!master) return;
        if (memberId === null && master.meMemberId !== null) setMemberId(master.meMemberId);
        if (date === '') setDate(master.today);
    }, [master, memberId, date]);
    const month = date.slice(0, 7);
    const listParams = useMemo(() => {
        const p: Record<string, string> = {};
        if (memberId !== null) p.memberId = String(memberId);
        if (date && master && date !== master.today) p.date = date;
        return p;
    }, [memberId, date, master]);
    useListUrlSync(listParams, 1, 20, []);

    const ready = memberId !== null && month !== '';
    const daily = useAsync(() => (ready ? landGet<Daily>('land_daily', { memberId: memberId!, month }) : Promise.resolve(null)), [memberId, month, ready]);
    const progress = useAsync(() => (ready ? landGet<{ kpis: KpiRow[]; progress: { pct: number } }>('land_summary', { scope: 'month', month, sel: `m:${memberId}` }) : Promise.resolve(null)), [memberId, month, ready]);
    const history = useAsync(() => (ready ? landGet<{ rows: LandApproach[]; total: number }>('land_approach_list', { sel: `m:${memberId}`, month, limit: apLimit }) : Promise.resolve(null)), [memberId, month, ready, apLimit]);
    const candidates = useAsync(() => (memberId !== null ? landGet<{ rows: LandApproach[]; total: number }>('land_approach_list', { sel: `m:${memberId}`, candidate: '1', limit: 50 }) : Promise.resolve(null)), [memberId]);

    // その日のまとめ入力・日報を入力欄に入れる
    useEffect(() => {
        const c = daily.data?.counts.find((x) => x.date === date);
        setCounts(c?.counts ?? {}); setInfo(c?.info ?? 0); setNote(c?.note ?? '');
        const r = daily.data?.reports.find((x) => x.date === date);
        setReport({ done: r?.done ?? '', info: r?.info ?? '', issue: r?.issue ?? '', next: r?.next ?? '' });
    }, [daily.data, date]);

    // 業者名の候補
    useEffect(() => {
        const q = ap.vendorName.trim();
        if (q === '') { setVendorHits([]); return; }
        const t = window.setTimeout(() => {
            landGet<{ rows: LandVendor[] }>('land_vendor_list', { q, limit: 10, sort: 'name', dir: 'asc' }).then((r) => setVendorHits(r.rows)).catch(() => setVendorHits([]));
        }, 300);
        return () => window.clearTimeout(t);
    }, [ap.vendorName]);

    const reloadAll = () => { void daily.reload(); void progress.reload(); void history.reload(); void candidates.reload(); };
    const run = async (fn: () => Promise<unknown>, okText: string) => {
        setBusy(true); setMsg(null);
        try { await fn(); setMsg({ ok: true, text: okText }); reloadAll(); return true; } catch (e) { setMsg({ ok: false, text: errorText(e, '保存できませんでした。') }); return false; } finally { setBusy(false); }
    };
    const saveAp = async () => {
        if (memberId === null) return;
        const body: Record<string, unknown> = { ...ap, date, memberId, landM2: ap.landM2 };
        if (!ap.vendorId) delete body.vendorId;
        if (await run(() => landPost('approach_save', body), ap.id ? 'アプローチを直しました。' : 'アプローチを記録しました。')) setAp(emptyAp());
    };
    const editAp = (a: LandApproach) => {
        setDate(a.date);
        setAp({ id: a.id, time: a.time, vendorName: a.vendorName, vendorId: a.vendorId, type: a.type, contact: a.contact, reaction: a.reaction, infoCount: a.infoCount, landM2: a.landM2 === null ? '' : String(a.landM2), address: a.address, mapUrl: a.mapUrl, memo: a.memo, isCandidate: a.isCandidate });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const deleteAp = (a: LandApproach) => {
        if (!window.confirm(`${a.date} ${a.vendorName || ''} のアプローチを削除します。よろしいですか？`)) return;
        void run(() => landPost('approach_delete', { id: a.id }), 'アプローチを削除しました。');
    };
    const saveDaily = (del = false) => {
        if (memberId === null) return;
        if (del && !window.confirm(`${date} のまとめ入力を削除します。よろしいですか？`)) return;
        void run(() => landPost('daily_save', { date, memberId, counts, info, note, ...(del ? { delete: true } : {}) }), del ? 'まとめ入力を削除しました。' : 'まとめ入力を保存しました。');
    };
    const saveReport = (del = false) => {
        if (memberId === null) return;
        if (del && !window.confirm(`${date} の日報を削除します。よろしいですか？`)) return;
        void run(() => landPost('report_save', { date, memberId, ...report, ...(del ? { delete: true } : {}) }), del ? '日報を削除しました。' : '日報を保存しました。');
    };

    /** その担当者のアプローチを全期間 CSV に（移行元のアプローチ履歴の書き出しと同じ列） */
    const exportCsv = async () => {
        if (memberId === null) return;
        setBusy(true);
        try {
            const all = await fetchAllRows<LandApproach>('land_approach_list', { sel: `m:${memberId}` });
            downloadCsv(`アプローチ履歴_${stamp()}.csv`, [
                ['日付', (a) => a.date], ['時刻', (a) => a.time], ['担当', (a) => a.memberName], ['業者名', (a) => a.vendorName], ['先方担当者名', (a) => a.contact],
                ['種別', (a) => a.type], ['反応・感触', (a) => a.reaction], ['情報取得数', (a) => a.infoCount], ['取得情報', (a) => a.memo], ['物件所在地', (a) => a.address],
                ['地図リンク', (a) => mapUrlOf(a.address, a.mapUrl)], ['土地面積(㎡)', (a) => a.landM2 ?? ''], ['土地面積(坪)', (a) => a.tsubo ?? ''],
                ['案件候補', (a) => (a.isCandidate ? '○' : '')], ['案件化', (a) => (a.dealCount > 0 ? '案件化済み' : '')], ['記録者', (a) => a.createdBy],
            ], all);
        } catch (e) { setMsg({ ok: false, text: errorText(e, '書き出せませんでした。') }); } finally { setBusy(false); }
    };

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const memberName = master.members.find((m) => m.id === memberId)?.name ?? '';
    const counter = (k: string, label: string, value: number, setValue: (n: number) => void) => (
        <div key={k} className="ld_field"><span className="ld_label">{label}</span>
            <div className="ld_counter">
                <button type="button" onClick={() => setValue(Math.max(0, value - 1))} aria-label={`${label}を減らす`}>−</button>
                <input className="ld_input" type="number" min={0} value={value} onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))} />
                <button type="button" onClick={() => setValue(value + 1)} aria-label={`${label}を増やす`}>＋</button>
            </div></div>
    );

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head"><span className="ld_title"><i className="fa-solid fa-shoe-prints me-2 text-primary" aria-hidden="true" />日次・アプローチ</span></div>
                <div className="ld_bar">
                    <div><div className="ld_label">担当者</div><MemberSelect master={master} value={memberId} onChange={setMemberId} /></div>
                    <div><div className="ld_label">日付</div><input type="date" className="ld_input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    {master.meMemberId === null && <span className="ld_note">ログインした人が担当者に結び付いていません（「仕入設定」で結び付けると、開いたときに自分が選ばれます）。</span>}
                </div>
                {msg && <div className={msg.ok ? 'ld_ok' : 'ld_error'}>{msg.text}</div>}
                {memberId === null ? <div className="ld_caution">担当者を選んでください。</div> : (
                    <>
                        {progress.data && (
                            <div className="ld_kpi">
                                {progress.data.kpis.map((k) => (
                                    <div key={k.key} className="ld_kpi_card"><div className="ld_kpi_label">{memberName}・{monthLabel(month)}の{k.label}</div>
                                        <div className="ld_kpi_value">{fmtNum(k.actual)}<small>{k.unit}</small></div>
                                        <div className="ld_kpi_sub"><span>目標 {fmtNum(k.target)}</span><b>{k.rate === null ? '—' : `${k.rate}%`}</b></div>
                                        <div className="ld_meter"><i className={rateClass(k.rate)} style={{ width: `${Math.min(100, k.rate ?? 0)}%` }} /><u style={{ left: `${progress.data!.progress.pct}%` }} /></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">{ap.id ? 'アプローチを直す' : 'アプローチを1件ずつ記録'}（{date}）</span>{ap.id && <button className="ld_btn is_sm" onClick={() => setAp(emptyAp())}>やめる</button>}</div>
                                <div className="ld_grid">
                                    <Field label="業者名（マスタから選ぶか、新しい名前を入れる）">
                                        <input className="ld_input" list="ld_daily_vendors" value={ap.vendorName}
                                            onChange={(e) => { const v = e.target.value; const h = vendorHits.find((x) => x.name === v); setAp((f) => ({ ...f, vendorName: v, vendorId: h ? h.id : null })); }} />
                                        <datalist id="ld_daily_vendors">{vendorHits.map((v) => <option key={v.id} value={v.name}>{v.vkind}</option>)}</datalist>
                                    </Field>
                                    <Field label="アプローチ種別">
                                        <select className="ld_select" value={ap.type} onChange={(e) => { const t = e.target.value; setAp((f) => ({ ...f, type: t, isCandidate: f.id ? f.isCandidate : AP_TYPES_LEAD.includes(t) })); }}>
                                            {(master.options.ap_type ?? []).map((v) => <option key={v}>{v}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="訪問先・架電先の担当者名"><input className="ld_input" value={ap.contact} onChange={(e) => setAp((f) => ({ ...f, contact: e.target.value }))} /></Field>
                                    <Field label="反応・感触">
                                        <select className="ld_select" value={ap.reaction} onChange={(e) => setAp((f) => ({ ...f, reaction: e.target.value }))}>{(master.options.reaction ?? []).map((v) => <option key={v}>{v}</option>)}</select>
                                    </Field>
                                    <Field label="時刻（任意）"><input type="time" className="ld_input" value={ap.time} onChange={(e) => setAp((f) => ({ ...f, time: e.target.value }))} /></Field>
                                    <Field label="情報取得数（このアプローチで得た土地情報の件数）"><input type="number" min={0} className="ld_input" value={ap.infoCount} onChange={(e) => setAp((f) => ({ ...f, infoCount: Math.max(0, Number(e.target.value) || 0) }))} /></Field>
                                    <Field label={`土地面積（㎡・任意）${ap.landM2 ? `＝ ${Math.round((Number(ap.landM2) / TSUBO_M2) * 100) / 100} 坪` : ''}`}><input type="number" min={0} step="0.01" className="ld_input" value={ap.landM2} onChange={(e) => setAp((f) => ({ ...f, landM2: e.target.value }))} /></Field>
                                    <Field label="物件所在地（任意）"><div className="d-flex align-items-center"><input className="ld_input flex-grow-1" value={ap.address} onChange={(e) => setAp((f) => ({ ...f, address: e.target.value }))} /><MapLink url={mapUrlOf(ap.address, ap.mapUrl)} /></div></Field>
                                    <Field label="取得情報（売主の事情・価格感・条件など）" full><textarea className="ld_textarea" value={ap.memo} onChange={(e) => setAp((f) => ({ ...f, memo: e.target.value }))} /></Field>
                                    <label className="ld_field is_full" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <input type="checkbox" checked={ap.isCandidate} onChange={(e) => setAp((f) => ({ ...f, isCandidate: e.target.checked }))} />
                                        <span>案件候補にする（「案件化待ち」に出ます。案件にすると外れます）</span>
                                    </label>
                                </div>
                                <div className="mt-2"><button className="ld_btn is_primary" disabled={busy} onClick={() => void saveAp()}>{ap.id ? '直す' : '記録する'}</button></div>
                            </div>

                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">案件化待ち（{memberName}）</span><span className="ld_badge">{candidates.data?.total ?? 0}件</span></div>
                                {(candidates.data?.rows.length ?? 0) === 0 ? <div className="ld_empty">案件候補のアプローチはありません。</div> : (
                                    <div className="ld_table_wrap" style={{ maxHeight: 420 }}>
                                        <table className="ld_table"><tbody>{candidates.data!.rows.map((a) => (
                                            <tr key={a.id} className="ld_row">
                                                <td className="ld_td ld_nowrap">{a.date}</td>
                                                <td className="ld_td"><b>{a.vendorName || '—'}</b><div className="ld_sub">{a.type}・{a.memo}</div></td>
                                                <td className="ld_td"><button className="ld_btn is_sm" onClick={() => setModal({ preset: { memberId: a.memberId, vendorId: a.vendorId, vendorName: a.vendorName, address: a.address, mapUrl: a.mapUrl, landM2: a.landM2, apId: a.id, memo: a.memo } })}>案件にする</button></td>
                                            </tr>))}</tbody></table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="ld_two">
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">まとめ入力（{date}）</span><span className="ld_note">1件ずつ記録しない件数を補います。同じ日は上書きです。</span></div>
                                <div className="ld_grid">
                                    {master.apBreakdown.map((b) => counter(b.k, b.label, counts[b.k] ?? 0, (n) => setCounts((c) => ({ ...c, [b.k]: n }))))}
                                    {counter('info', '情報取得', info, setInfo)}
                                    <Field label="メモ" full><input className="ld_input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                                </div>
                                <div className="mt-2 d-flex gap-2">
                                    <button className="ld_btn is_primary" disabled={busy} onClick={() => saveDaily()}>保存</button>
                                    {daily.data?.counts.some((c) => c.date === date) && <button className="ld_btn is_danger" disabled={busy} onClick={() => saveDaily(true)}>この日の分を削除</button>}
                                </div>
                            </div>
                            <div className="ld_card">
                                <div className="ld_card_head"><span className="ld_card_title">簡易日報（{date}）</span><span className="ld_note">1日に1本。同じ日は上書きです。</span></div>
                                <div className="ld_grid">
                                    {REPORT_FIELDS.map(([k, label, ph]) => (
                                        <Field key={k} label={label} full><textarea className="ld_textarea" placeholder={ph} value={report[k]} onChange={(e) => setReport((r) => ({ ...r, [k]: e.target.value }))} /></Field>
                                    ))}
                                </div>
                                <div className="mt-2 d-flex gap-2">
                                    <button className="ld_btn is_primary" disabled={busy} onClick={() => saveReport()}>保存</button>
                                    {daily.data?.reports.some((r) => r.date === date) && <button className="ld_btn is_danger" disabled={busy} onClick={() => saveReport(true)}>この日の日報を削除</button>}
                                </div>
                            </div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">{monthLabel(month)} 日別の記録（{memberName}）</span></div>
                            <LoadState loading={daily.loading} error={daily.error} />
                            <div className="ld_table_wrap" style={{ maxHeight: 360 }}>
                                <table className="ld_table"><thead><tr>
                                    <th className="ld_th">日付</th>{master.apBreakdown.map((b) => <th key={b.k} className="ld_th ld_num">{b.label}</th>)}
                                    <th className="ld_th ld_num">AP合計</th><th className="ld_th ld_num">うち1件ずつ</th><th className="ld_th ld_num">情報取得</th><th className="ld_th">日報</th>
                                </tr></thead><tbody>
                                    {(daily.data?.days ?? []).map((d) => (
                                        <tr key={d.date} className={`ld_row is_click${d.date === date ? ' is_due' : ''}`} onClick={() => setDate(d.date)}>
                                            <td className="ld_td ld_nowrap">{d.date}（{weekday(d.date)}）</td>
                                            {master.apBreakdown.map((b) => <td key={b.k} className="ld_td ld_num">{d.byType[b.k] || ''}</td>)}
                                            <td className="ld_td ld_num"><b>{d.rec + d.log}</b></td><td className="ld_td ld_num">{d.rec}</td><td className="ld_td ld_num">{d.info}</td>
                                            <td className="ld_td">{daily.data!.reports.some((r) => r.date === d.date) ? '○' : ''}</td>
                                        </tr>
                                    ))}
                                    {(daily.data?.days.length ?? 0) === 0 && <tr><td className="ld_td ld_empty" colSpan={master.apBreakdown.length + 5}>この月の記録はまだありません。</td></tr>}
                                </tbody></table>
                            </div>
                        </div>

                        <div className="ld_card">
                            <div className="ld_card_head"><span className="ld_card_title">個人アプローチ履歴（{memberName}・{monthLabel(month)}）</span><span className="ld_badge">{history.data?.total ?? 0}件</span>
                                <button className="ld_btn is_sm" disabled={busy} onClick={() => void exportCsv()}><i className="fa-solid fa-file-csv me-1" aria-hidden="true" />{memberName}の全期間を CSV で書き出す</button></div>
                            <div className="ld_table_wrap" style={{ maxHeight: 480 }}>
                                <table className="ld_table"><thead><tr>
                                    <th className="ld_th">日付</th><th className="ld_th">業者名</th><th className="ld_th">種別</th><th className="ld_th">先方の担当</th><th className="ld_th">反応</th>
                                    <th className="ld_th ld_num">情報</th><th className="ld_th">取得情報</th><th className="ld_th">案件</th><th className="ld_th" />
                                </tr></thead><tbody>
                                    {(history.data?.rows ?? []).map((a) => (
                                        <tr key={a.id} className="ld_row">
                                            <td className="ld_td ld_nowrap">{a.date}{a.time && <div className="ld_sub">{a.time}</div>}</td>
                                            <td className="ld_td"><b>{a.vendorName || '—'}</b></td><td className="ld_td ld_nowrap">{a.type}</td><td className="ld_td">{a.contact}</td><td className="ld_td ld_nowrap">{a.reaction}</td>
                                            <td className="ld_td ld_num">{a.infoCount}</td>
                                            <td className="ld_td">{a.memo}{a.address && <div className="ld_sub">{a.address}<MapLink url={mapUrlOf(a.address, a.mapUrl)} /></div>}</td>
                                            <td className="ld_td ld_nowrap">{a.dealCount > 0 ? <span className="ld_pill s-done">案件化済み</span> : a.isCandidate ? <span className="ld_pill s-wait">案件候補</span> : ''}</td>
                                            <td className="ld_td ld_nowrap"><button className="ld_btn is_sm me-1" onClick={() => editAp(a)}>直す</button><button className="ld_btn is_sm is_danger" onClick={() => deleteAp(a)}>削除</button></td>
                                        </tr>
                                    ))}
                                    {(history.data?.rows.length ?? 0) === 0 && <tr><td className="ld_td ld_empty" colSpan={9}>この月のアプローチはまだありません。</td></tr>}
                                </tbody></table>
                            </div>
                            {(history.data?.total ?? 0) > (history.data?.rows.length ?? 0) && <button className="ld_btn mt-2" onClick={() => setApLimit((n) => n + AP_PAGE)}>さらに{AP_PAGE}件を読む</button>}
                        </div>
                    </>
                )}
            </div>
            {modal && <LandDealModal show master={master} dealId={null} preset={modal.preset} onClose={() => setModal(null)} onSaved={() => { setModal(null); reloadAll(); }} />}
        </div>
    );
};

export default LandDaily;
