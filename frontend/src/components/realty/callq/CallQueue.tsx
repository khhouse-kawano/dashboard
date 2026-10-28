import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AuthContext from '../../../context/AuthContext';
import { REALTY_CSS, loadRealtyState, loadRecords, post, saveRealtySettings } from '../common/realtyState';
import type { WeeklyRow } from '../common/realtyState';
import { recordFieldChanges, saveBrokerageRecord } from '../common/leadUtiles';
import LeadEdit from '../common/LeadEdit';
import { todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import { openNavi } from '../navi/naviHost';
import {
    CQ_OUT, ST, TAGL, build, callOutcome, callqConf, callqScripts, callsOnly, contactKpi, diffDays, keyOf, newListings,
    sameName, scriptFor, setDone, splitKey, tagsOf, telOf, weekGoal, weekRange,
} from './callqLogic';
import type { LeadKind, Outcome, UndoToken } from './callqLogic';

/**
 * 📞 今日の架電キュー（不動産企画係。v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリの V16.paint。上から順に、考えずに1件ずつ潰すための画面。
 *   抽出・並び・要件タグ・一言目は callqLogic.ts、4つのボタンの書き込みは ② の planner:call_mark。
 * ⚠️ この画面のゴールは「成約」ではなく「相手の今の状況を確認できたか」（接触確認率）。
 */

const STYLE = `
.rlt-cq-meters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.rlt-cq-meter { border: 1px solid #e9ecef; border-radius: 8px; padding: 8px 12px; background: #fff; }
.rlt-cq-meter .t { display: flex; justify-content: space-between; font-size: 11px; color: #6c757d; }
.rlt-cq-meter .v { font-size: 20px; font-weight: bold; color: #343a40; font-variant-numeric: tabular-nums; }
.rlt-cq-meter .v small { font-size: 11px; font-weight: normal; color: #6c757d; }
.rlt-cq-bar { height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden; margin-top: 4px; }
.rlt-cq-bar i { display: block; height: 100%; background: #0d6efd; }
.rlt-cq-bar i.ok { background: #198754; } .rlt-cq-bar i.mid { background: #ffc107; } .rlt-cq-bar i.bad { background: #dc3545; }
.rlt-cq-note { border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 12px; border: 1px solid #b6d4fe; background: #e7f1ff; color: #084298; line-height: 1.7; }
.rlt-cq-note.done { border-color: #a3cfbb; background: #d1e7dd; color: #0f5132; }
.rlt-cq-empty { text-align: center; color: #6c757d; padding: 24px; font-size: 12px; line-height: 1.8; }
.rlt-cq-list { display: flex; flex-direction: column; gap: 10px; }
.rlt-cq-card { border: 1px solid #dee2e6; border-radius: 8px; padding: 10px 14px; background: #fff; }
.rlt-cq-card.next { border: 2px solid #0d6efd; box-shadow: 0 2px 8px rgba(13,110,253,.15); }
.rlt-cq-card.done { background: #f8f9fa; opacity: .75; }
.rlt-cq-r1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rlt-cq-no { width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; color: #495057; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; }
.rlt-cq-card.next .rlt-cq-no { background: #0d6efd; color: #fff; }
.rlt-cq-nm { font-size: 14px; font-weight: bold; color: #212529; }
.rlt-cq-tel { font-size: 13px; font-weight: bold; color: #0d6efd; text-decoration: none; }
.rlt-cq-tel.no { color: #adb5bd; font-weight: normal; font-size: 11px; }
.rlt-cq-sp { flex: 1; }
.rlt-cq-meta { font-size: 11px; color: #495057; margin-top: 6px; line-height: 1.7; }
.rlt-cq-scr { margin-top: 8px; background: #fff8e1; border: 1px solid #ffe69c; border-radius: 6px; padding: 8px 10px; font-size: 12px; white-space: pre-wrap; color: #343a40; }
.rlt-cq-scr .lb { display: block; font-size: 10px; font-weight: bold; color: #997404; margin-bottom: 2px; }
.rlt-cq-btns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.rlt-cq-btns button { border-radius: 6px; padding: 8px 4px; font-size: 12px; font-weight: bold; cursor: pointer; border: 1px solid; background: #fff; }
.rlt-cq-btns button:disabled { opacity: .5; cursor: wait; }
.rlt-cq-btns .abs { border-color: #6c757d; color: #495057; }
.rlt-cq-btns .talk { border-color: #0d6efd; color: #0d6efd; }
.rlt-cq-btns .apo { border-color: #198754; color: #198754; }
.rlt-cq-btns .end { border-color: #6f42c1; color: #6f42c1; }
.rlt-cq-btns button:hover:not(:disabled) { filter: brightness(.95); background: #f8f9fa; }
.rlt-badge { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 10px; font-weight: bold; margin-left: 4px; }
.rlt-badge.navy { background: #cfe2ff; color: #084298; } .rlt-badge.amber { background: #fff3cd; color: #997404; }
.rlt-badge.green { background: #d1e7dd; color: #0f5132; } .rlt-badge.red { background: #f8d7da; color: #842029; }
.rlt-badge.gray { background: #e9ecef; color: #495057; }
.rlt-cq-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #212529; color: #fff; padding: 8px 18px; border-radius: 6px; font-size: 12px; z-index: 2000; }
@media (max-width: 640px) { .rlt-cq-btns { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const fmtD = (ds: unknown): string => {
    const s = str(ds).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : (s || '―');
};
const fmtDT = (c: unknown): string => {
    const x = typeof c === 'object' && c !== null ? str((c as { date?: unknown }).date) : str(c);
    if (!x) return '―';
    return x.length > 10 ? `${fmtD(x)} ${x.slice(11, 16)}` : fmtD(x);
};

const copyText = async (t: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; }
    } catch { /* 下の方法で試す */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
};

const CallQueue: React.FC = () => {
    const { userName } = useContext(AuthContext);
    const [leads, setLeads] = useState<Row[]>([]);
    const [buyLeads, setBuyLeads] = useState<Row[]>([]);
    const [ledger, setLedger] = useState<Row[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [weekly, setWeekly] = useState<Record<string, WeeklyRow[]>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    // ⚠️ ST（並び・記録済）はモジュールの変数。変えたら描き直すための印
    const [, setTick] = useState(0);
    const repaint = () => setTick(n => n + 1);
    const [toast, setToast] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);
    const [editing, setEditing] = useState<Row | null>(null);

    const showToast = (m: string) => {
        setToast(m);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2200);
    };

    const conf = useMemo(() => callqConf(settings.callq), [settings.callq]);
    const scripts = useMemo(() => callqScripts(settings.callqScripts), [settings.callqScripts]);
    /** 自分（以前のアプリの currentUser）。設定の担当者に空白違いで一致すれば設定の名前 */
    const me = useMemo(() => {
        const list = Array.isArray(settings.staff) ? settings.staff as { name?: string }[] : [];
        return list.find(s => s.name && sameName(s.name, userName || ''))?.name ?? (userName || '');
    }, [settings.staff, userName]);
    const company = str((settings.company as { name?: string } | undefined)?.name);

    const load = useCallback(async () => {
        try {
            const [rec, st] = await Promise.all([loadRecords(['leads', 'buyLeads', 'ledger']), loadRealtyState()]);
            setLeads(rec.records.leads);
            setBuyLeads(rec.records.buyLeads);
            setLedger(rec.records.ledger);
            setSettings(rec.settings as Record<string, unknown>);
            setWeekly(st.weekly);
        } catch (e) {
            alert(`読み込めませんでした: ${(e as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // ⚠️ 並びは日が変わったときと「再抽出」のときだけ作る（以前のアプリと同じく、作業中に行が動かないように）
    useEffect(() => {
        if (!loading && ST.day !== todayStr()) { build(leads, buyLeads, conf, me); repaint(); }
    }, [loading, leads, buyLeads, conf, me]);

    const rebuild = (mine = ST.mine, c = conf) => {
        ST.mine = mine;
        build(leads, buyLeads, c, me);
        repaint();
    };

    /** 件数を変えて保存し、並べ直す（V16.setSize。⚠️ 設定はチーム全員で共有） */
    const setSize = async (v: string) => {
        const size = Math.max(1, Math.min(50, Math.round(Number(v) || 10)));
        const next = { ...conf, size };
        try {
            const saved = await saveRealtySettings({ callq: next });
            setSettings(prev => ({ ...prev, callq: saved.callq }));
            rebuild(ST.mine, next);
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
        }
    };

    const rowsOf = (kind: LeadKind) => (kind === 'buyLeads' ? buyLeads : leads);
    const setRowsOf = (kind: LeadKind) => (kind === 'buyLeads' ? setBuyLeads : setLeads);
    const recOf = (key: string): { kind: LeadKind; rec: Row | undefined } => {
        const { kind, id } = splitKey(key);
        return { kind, rec: rowsOf(kind).find(x => str(x.id) === id) };
    };
    const replaceRow = (kind: LeadKind, row: Row | null) => {
        if (!row) return;
        setRowsOf(kind)(prev => prev.map(x => (str(x.id) === str(row.id) ? row : x)));
    };

    const scrollToNext = () => window.setTimeout(() => {
        const e = document.getElementById('rlt-cq-next');
        if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);

    /** 4つのボタン（V16.mark） */
    const mark = async (key: string, oc: Outcome) => {
        const { kind, rec } = recOf(key);
        if (!rec) { showToast('対象が見つかりません（画面を再読み込みしてください）'); return; }
        setBusy(true);
        try {
            const d = await post('call_mark', { kind, id: rec.id, outcome: oc });
            const row = (d.row as Row | null) ?? null;
            replaceRow(kind, row);
            ST.done[key] = oc;
            ST.undo = (d.undo as UndoToken) ?? null;
            repaint();
            showToast(`${CQ_OUT[oc].icon} ${CQ_OUT[oc].label}を記録しました${oc === 'end' ? '（追客終了・他決）' : `（次回 ${fmtD(row?.nextDate)}）`}`);
            scrollToNext();
        } catch (e) {
            alert(`記録できませんでした: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    /** 直前の記録を取消（V16.undo） */
    const undo = async () => {
        const u = ST.undo;
        if (!u) { showToast('取消できる記録がありません'); return; }
        setBusy(true);
        try {
            const d = await post('call_undo', u);
            replaceRow(u.kind, (d.row as Row | null) ?? null);
            delete ST.done[keyOf(u.kind, u.id)];
            ST.undo = null;
            repaint();
            showToast('直前の記録を取り消しました');
        } catch (e) {
            alert(`取り消せませんでした: ${(e as Error).message}`);
            ST.undo = null;
            repaint();
        } finally {
            setBusy(false);
        }
    };

    const copy = async (l: Row, tag: keyof typeof TAGL) => {
        const ok = await copyText(scriptFor(scripts, l, tag, company, me));
        showToast(ok ? '一言目をコピーしました' : 'コピーできませんでした（ブラウザの権限をご確認ください）');
    };

    /** 「開く」→ 反響の編集（チームサマリーの「開く」と同じ保存の仕方） */
    const saveEdit = async () => {
        const cur = editing;
        setEditing(null);
        if (!cur?.id) return;
        const kind: LeadKind = cur.kind === 'buyLeads' ? 'buyLeads' : 'leads';
        const before = rowsOf(kind).find(x => str(x.id) === str(cur.id));
        const { id: _id, internal_id: _i, created_at: _c, updated_at: _u, ...fields } = cur;
        try {
            const row = await saveBrokerageRecord(str(cur.id), fields);
            replaceRow(kind, (row as Row | null) ?? { ...before, ...fields });
            if (before) {
                await recordFieldChanges({
                    entity: kind === 'buyLeads' ? 'buy' : 'lead', entityId: str(cur.id),
                    label: str(before.seller) || str(before.name) || str(before.addr) || str(cur.id),
                    before, after: fields, by: userName || '不明',
                });
            }
        } catch (e) {
            alert(`保存に失敗しました: ${(e as Error).message}`);
        }
    };

    /** 架電ナビで記録したら、返ってきた反響で置き換え、キューに並んでいれば記録済にする（V16.setDone） */
    const openNaviFor = (l: Row) => openNavi({
        lead: l, settings, me,
        onSaved: (row, oc) => {
            if (row) replaceRow('leads', row);
            if (oc) setDone(keyOf('leads', l.id), oc);
            repaint();
        },
    });

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const t = todayStr();
    const keys = ST.order;
    const nextKey = keys.find(k => !ST.done[k]) ?? '';
    const doneN = Object.keys(ST.done).length;
    const newProps = newListings(ledger, t).length;

    // メーター（meters）。⚠️ 目標は個人のものなので「自分の担当のみ」のときだけ使う
    const who = ST.mine ? me : '';
    const wg = ST.mine ? weekGoal(weekly, me, t) : 0;
    const dg = Math.ceil(wg / (Number(conf.dailyDivisor) || 5));
    const kd = contactKpi(leads, buyLeads, who, t, t);
    const [wf, wt] = weekRange(t);
    const kw = contactKpi(leads, buyLeads, who, wf, wt);
    const km = contactKpi(leads, buyLeads, who, `${t.slice(0, 7)}-01`, `${t.slice(0, 7)}-31`);
    const left = keys.filter(k => !ST.done[k]).length;
    const noGoal = ST.mine ? '週次行動計画に目標未入力' : 'チーム合計';
    const bar = (a: number, g: number | null) => {
        if (g === null) return null;
        const r = g > 0 ? a / g : 0;
        const cls = g <= 0 ? '' : r >= 1 ? 'ok' : r >= 0.8 ? 'mid' : 'bad';
        return <div className="rlt-cq-bar"><i className={cls} style={{ width: `${Math.min(100, Math.round(r * 100))}%` }}></i></div>;
    };

    const card = (key: string, i: number) => {
        const { kind, rec: l } = recOf(key);
        if (!l) return null;
        const done = ST.done[key];
        const tags = tagsOf(kind, l, newProps, t);
        const top = tags[0];
        const tel = telOf(l);
        const nm = str(l.name).trim() || (kind === 'leads' ? str(l.addr) || '（顧客名なし）' : str(l.targetProperty) || '（顧客名なし）');
        const cs = callsOnly(l);
        const lastc = cs.length ? cs[cs.length - 1] : null;
        const oc = lastc ? callOutcome(lastc) : '';
        const sub = kind === 'leads' ? str(l.addr) : str(l.targetProperty);
        const next = str(l.nextDate).slice(0, 10);
        const recv = str(l.receivedDate).slice(0, 10);
        const isNext = key === nextKey;
        return (
            <div key={key} className={`rlt-cq-card ${done ? 'done' : ''} ${isNext ? 'next' : ''}`} id={isNext ? 'rlt-cq-next' : undefined}>
                <div className="rlt-cq-r1">
                    <span className="rlt-cq-no">{done ? '✓' : i + 1}</span>
                    <span className="rlt-cq-nm">{nm}</span>
                    {tel ? <a className="rlt-cq-tel" href={`tel:${tel}`}>☎ {tel}</a> : <span className="rlt-cq-tel no">☎ 電話番号なし</span>}
                    <span>{tags.map(k => <span key={k} className={`rlt-badge ${TAGL[k].cls}`}>{TAGL[k].lbl}</span>)}</span>
                    <span className="rlt-cq-sp"></span>
                    {kind === 'leads' && !done && <button className="rlt-btn sec" onClick={() => openNaviFor(l)}>🧭 ナビで架電</button>}
                    <button className="rlt-btn sec" onClick={() => setEditing({ ...l })}>開く</button>
                </div>
                <div className="rlt-cq-meta">
                    {kind === 'leads' ? `📨 売り反響／${str(l.source) || '反響元なし'}` : `🏠 買い反響／${str(l.portal) || '反響元なし'}`}
                    {'　／　担当：'}{str(l.staff) || <span className="rlt-badge red">未割当</span>}
                    {`　／　受信 ${fmtD(recv)}${recv ? `（${diffDays(t, recv)}日前）` : ''}`}
                    <br />
                    {sub && `物件：${sub}　／　`}
                    {`フェーズ：${str(l.phase) || '―'}　／　前回：${lastc ? `${fmtDT(lastc)}${oc ? `（${CQ_OUT[oc].label}）` : ''}` : '記録なし'}／通算 📞${cs.length}`}
                    {next && <>{`　／　次回：${fmtD(next)}`}{next < t && <span className="rlt-badge red">{diffDays(t, next)}日超過</span>}{str(l.nextNote) && `／${str(l.nextNote)}`}</>}
                    {str(l.note) && `　／　メモ：${str(l.note).slice(0, 60)}`}
                </div>
                {done ? (
                    <div className="rlt-cq-meta">
                        <b>{CQ_OUT[done].icon} {CQ_OUT[done].label}</b> を記録しました{next ? `（次回 ${fmtD(next)}／${str(l.nextNote)}）` : ''}
                    </div>
                ) : (
                    <>
                        <div className="rlt-cq-scr">
                            <span className="lb">一言目（{TAGL[top].lbl}）</span>
                            {scriptFor(scripts, l, top, company, me)}
                            <div style={{ marginTop: 6 }}><button className="rlt-btn sec" onClick={() => void copy(l, top)}>📋 コピー</button></div>
                        </div>
                        <div className="rlt-cq-btns">
                            {(['abs', 'talk', 'apo', 'end'] as Outcome[]).map(o => (
                                <button key={o} className={o} disabled={busy} onClick={() => void mark(key, o)}>
                                    {CQ_OUT[o].icon} {o === 'talk' ? '通電・継続' : o === 'apo' ? 'アポ獲得' : o === 'end' ? '終了確定' : '不在'}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    };

    const staffNames = (Array.isArray(settings.staff) ? settings.staff as { name?: string }[] : []).map(s => str(s.name)).filter(Boolean);

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-phone me-2" style={{ color: '#0d6efd' }}></i>今日の架電キュー</h1>
                <p className="rlt-sub">上から順に、考えずに1件ずつ潰すための画面です。{fmtD(t)}</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head" style={{ alignItems: 'center' }}>
                    <h3>本日の対象 {keys.length}件<span className={`rlt-badge ${doneN ? 'green' : 'gray'}`}>記録済 {doneN}</span></h3>
                    <span className="rlt-cq-sp"></span>
                    <label className="rlt-note" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={ST.mine} onChange={e => rebuild(e.target.checked)} /> 自分の担当のみ{me ? `（${me}）` : ''}
                    </label>
                    <label className="rlt-note">件数 <input
                        key={conf.size} type="number" min={1} max={50} defaultValue={conf.size} className="rlt-input"
                        style={{ width: 64, textAlign: 'right' }} onBlur={e => { if (Number(e.target.value) !== conf.size) void setSize(e.target.value); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    /></label>
                    <button className="rlt-btn sec" onClick={() => { rebuild(); showToast('本日の架電キューを再抽出しました'); }} disabled={busy}>🔄 再抽出</button>
                    {ST.undo && <button className="rlt-btn sec" onClick={() => void undo()} disabled={busy}>↩ 直前の記録を取消</button>}
                </div>
                <div className="rlt-body">
                    <div className="rlt-cq-meters">
                        <div className="rlt-cq-meter">
                            <div className="t"><span>今日の架電</span><span>{dg ? `目標 ${dg}件` : noGoal}</span></div>
                            <div className="v">{kd.calls}<small> 件</small></div>{bar(kd.calls, dg || null)}
                        </div>
                        <div className="rlt-cq-meter">
                            <div className="t"><span>今週の架電</span><span>{wg ? `目標 ${wg}件` : noGoal}</span></div>
                            <div className="v">{kw.calls}<small> 件</small></div>{bar(kw.calls, wg || null)}
                        </div>
                        <div className="rlt-cq-meter">
                            <div className="t"><span>接触確認率（今月）</span><span>確認 {km.contact}／{km.known}件</span></div>
                            <div className="v">{km.rate === null ? '―' : `${Math.round(km.rate * 100)}%`}<small> 🗣{km.talk}／📅{km.apo}／✅{km.end}／📵{km.abs}</small></div>
                        </div>
                        <div className="rlt-cq-meter">
                            <div className="t"><span>残りのキュー</span><span>全{keys.length}件</span></div>
                            <div className="v">{left}<small> 件</small></div>{bar(keys.length - left, keys.length || null)}
                        </div>
                    </div>

                    <div className="rlt-cq-note">
                        🎯 <b>この画面のゴールは「成約」ではなく「相手の今の状況を確認できたか」</b>です。
                        他社で決まった・売却をやめた、と分かることも前進なので、<b>✅終了確定も接触確認としてプラス計上</b>されます。<br />
                        4つのボタンを押すと、<b>架電記録・フェーズ・次回連絡予定日</b>までまとめて更新され、次の行へ進みます（📵不在→翌日／🗣通電→7日後／📅アポ→2日後に自動設定）。
                    </div>

                    {!keys.length ? (
                        <div className="rlt-cq-empty">
                            本日かける対象はありません。<br />
                            次回連絡予定日が今日以前のもの、まだ一度も架電していないもの、
                            予定日が未設定で売り{conf.staleSell}日／買い{conf.staleBuy}日以上ふれていないものが自動で並びます。
                        </div>
                    ) : (
                        <>
                            {!nextKey && (
                                <div className="rlt-cq-note done">
                                    🎉 本日ぶんはすべて記録できました（{keys.length}件）。次回連絡予定日は自動で入っています。追加でかける場合は「🔄 再抽出」を押してください。
                                </div>
                            )}
                            <div className="rlt-cq-list">{keys.map((k, i) => card(k, i))}</div>
                        </>
                    )}
                </div>
            </div>

            {toast && <div className="rlt-cq-toast" role="status">{toast}</div>}

            <LeadEdit
                isOpen={editing !== null}
                onClose={() => setEditing(null)}
                onSave={() => void saveEdit()}
                customerInfo={editing ?? {}}
                setCustomerInfo={setEditing}
                leadCategory={editing?.kind === 'buyLeads' ? 'buy' : 'sell'}
                staffList={staffNames}
            />
        </div>
    );
};

export default CallQueue;
