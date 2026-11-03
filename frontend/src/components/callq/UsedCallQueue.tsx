import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import InformationEditResale from '../information/InformationEditResale';

/**
 * 📞 今日の架電キュー（中古リノベ。v2.2.239）。左のメニュー「全社報告用フォーマット」の下。
 *
 * ⚠️ 見た目は不動産企画係の今日の架電キュー（realty/callq/CallQueue.tsx）に合わせている。⚠️ 一言目・接触確認率・残りのキューは出さない（2026-11-03 の指示）。
 * ⚠️ 抽出と集計は ② の callq_used:list、カードの記録は callq_used:mark（features/callq/usedQueue.ts）。
 *   キュー＝最後の「次回架電日」が今日以前で、その日以降にまだ架電（通電・未通電・SMS送信）していない顧客。
 * ⚠️ 並び順は読み込んだときに固定する（記録しても行が動かないように）。並べ直すのは「🔄 再読み込み」。
 */

type CallEntry = { day: string; time: string; action: string; note: string; staff: string };
type QueueCard = {
    id: string; name: string; tel: string; staff: string; medium: string; inquiryDay: string;
    status: string; callStatus: string; nextDay: string; dueDay: string; overdue: number; done: CallEntry | null; calls: number; recent: CallEntry[];
};
type Kpi = { today: number; week: number; month: number };
type ListBody = {
    status?: string; message?: string; today: string; week: [string, string]; me: string;
    kpi: { all: Kpi; mine: Kpi }; cards: QueueCard[]; actions: string[];
};
type Draft = { action: string; note: string; nextDay: string };

const EMPTY_DRAFT: Draft = { action: '', note: '', nextDay: '' };

const STYLE = `
.ucq-page { padding: 4px 8px 24px; }
.ucq-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 14px; }
.ucq-head h1 { font-size: 14px; font-weight: bold; color: #495057; margin: 0; }
.ucq-sub { font-size: 11px; color: #6c757d; margin: 0; }
.ucq-card-box { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.ucq-box-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px 8px; }
.ucq-box-head h3 { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; }
.ucq-body { padding: 4px 16px 14px; font-size: 12px; }
.ucq-label { font-size: 11px; color: #6c757d; cursor: pointer; }
.ucq-btn { font-size: 11px; font-weight: bold; border-radius: 4px; padding: 3px 12px; border: 1px solid #0d6efd; background: #0d6efd; color: #fff; cursor: pointer; }
.ucq-btn.sec { background: #fff; color: #0d6efd; }
.ucq-btn:disabled { opacity: .5; cursor: not-allowed; }
.ucq-sp { flex: 1; }
.ucq-meters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.ucq-meter { border: 1px solid #e9ecef; border-radius: 8px; padding: 8px 12px; background: #fff; }
.ucq-meter .t { display: flex; justify-content: space-between; font-size: 11px; color: #6c757d; }
.ucq-meter .v { font-size: 20px; font-weight: bold; color: #343a40; font-variant-numeric: tabular-nums; }
.ucq-meter .v small { font-size: 11px; font-weight: normal; color: #6c757d; }
.ucq-note { border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 12px; border: 1px solid #b6d4fe; background: #e7f1ff; color: #084298; line-height: 1.7; }
.ucq-note.done { border-color: #a3cfbb; background: #d1e7dd; color: #0f5132; }
.ucq-empty { text-align: center; color: #6c757d; padding: 24px; font-size: 12px; line-height: 1.8; }
.ucq-list { display: flex; flex-direction: column; gap: 10px; }
.ucq-card { border: 1px solid #dee2e6; border-radius: 8px; padding: 10px 14px; background: #fff; }
.ucq-card.next { border: 2px solid #0d6efd; box-shadow: 0 2px 8px rgba(13,110,253,.15); }
.ucq-card.done { background: #f8f9fa; opacity: .75; }
.ucq-r1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ucq-no { width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; color: #495057; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; }
.ucq-card.next .ucq-no { background: #0d6efd; color: #fff; }
.ucq-nm { font-size: 14px; font-weight: bold; color: #212529; }
.ucq-tel { font-size: 13px; font-weight: bold; color: #0d6efd; text-decoration: none; }
.ucq-tel.no { color: #adb5bd; font-weight: normal; font-size: 11px; }
.ucq-meta { font-size: 11px; color: #495057; margin-top: 6px; line-height: 1.7; }
.ucq-recent { margin-top: 6px; border-left: 3px solid #e9ecef; padding-left: 8px; font-size: 11px; color: #6c757d; line-height: 1.6; overflow-wrap: anywhere; }
.ucq-recent b { color: #495057; }
.ucq-acts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.ucq-acts button { border-radius: 6px; padding: 8px 4px; font-size: 12px; font-weight: bold; cursor: pointer; border: 1px solid #ced4da; background: #fff; color: #495057; }
.ucq-acts button:hover:not(:disabled):not(.on) { background: #f8f9fa; }
.ucq-acts button.on { border-color: #0d6efd; background: #0d6efd; color: #fff; }
.ucq-acts button:disabled { opacity: .5; cursor: wait; }
.ucq-form { display: flex; gap: 8px; margin-top: 8px; align-items: flex-start; flex-wrap: wrap; }
.ucq-memo { flex: 1; min-width: 220px; font-size: 12px; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 6px; resize: vertical; }
.ucq-memo:focus, .ucq-date:focus { outline: 2px solid #0d6efd33; border-color: #0d6efd; }
.ucq-next { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #6c757d; }
.ucq-date { font-size: 12px; padding: 5px 6px; border: 1px solid #ced4da; border-radius: 6px; }
.ucq-save { align-self: stretch; padding: 0 18px; font-size: 12px; }
.ucq-badge { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 10px; font-weight: bold; margin-left: 4px; }
.ucq-badge.red { background: #f8d7da; color: #842029; } .ucq-badge.navy { background: #cfe2ff; color: #084298; }
.ucq-badge.gray { background: #e9ecef; color: #495057; } .ucq-badge.green { background: #d1e7dd; color: #0f5132; }
.ucq-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #212529; color: #fff; padding: 8px 18px; border-radius: 6px; font-size: 12px; z-index: 2000; }
@media (max-width: 640px) { .ucq-acts { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
`;

const ACTION_ICON: Record<string, string> = { '通電': '🗣', '未通電': '📵', 'SMS送信': '💬', 'メール送信': '✉️', '資料郵送': '📮' };

const fmtD = (ds: string): string => {
    const [y, m, d] = ds.slice(0, 10).split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : (ds || '―');
};
const bare = (s: string): string => s.replace(/[\s　]/g, '');
/** 記録のメモ（⚠️ 取り込んだ古い記録には改行の代わりに <br> が入っている） */
const plainNote = (s: string): string => s.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const errorMessage = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e instanceof Error ? e.message : fallback);

const UsedCallQueue: React.FC = () => {
    const { token, authority } = useContext(AuthContext);
    const [data, setData] = useState<ListBody | null>(null);
    const [cards, setCards] = useState<QueueCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    // ⚠️ v2.2.240: 初期値はチーム全体（2026-11-03 の指示で true → false）
    const [mine, setMine] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [openId, setOpenId] = useState('');
    const [toast, setToast] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);

    const showToast = (m: string) => {
        setToast(m);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2200);
    };

    /** keepOrder = 今の並びを保つ（記録・顧客画面を閉じたあと）。⚠️ 新しく対象になった顧客は末尾 */
    const load = useCallback(async (keepOrder: boolean) => {
        try {
            const res = await apiClient.post<ListBody>('', { request: 'callq_used', roll: 'list' });
            const body = res.data;
            if (body?.status === 'error') throw new Error(body.message || '読み込めませんでした');
            setData(body);
            setCards(prev => {
                if (!keepOrder) return body.cards;
                const at = new Map(prev.map((c, i) => [c.id, i]));
                return [...body.cards].sort((a, b) => (at.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (at.get(b.id) ?? Number.MAX_SAFE_INTEGER));
            });
        } catch (e) {
            alert(`読み込めませんでした: ${errorMessage(e, '通信エラー')}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(false); }, [load]);

    const draftOf = (id: string): Draft => drafts[id] ?? EMPTY_DRAFT;
    const setDraft = (id: string, patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_DRAFT), ...patch } }));

    const scrollToNext = () => window.setTimeout(() => {
        const e = document.getElementById('ucq-next');
        if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);

    const mark = async (card: QueueCard) => {
        const d = draftOf(card.id);
        if (!d.action && !d.nextDay) { showToast('アクションを選ぶか、次回架電日を入れてください'); return; }
        setBusy(true);
        try {
            const res = await apiClient.post('', { request: 'callq_used', roll: 'mark', id: card.id, action: d.action, note: d.note, next_day: d.nextDay });
            if (res.data?.status === 'error') throw new Error(res.data.message || '記録できませんでした');
            setDrafts(prev => { const { [card.id]: _, ...rest } = prev; return rest; });
            showToast(`${d.action ? `${ACTION_ICON[d.action] ?? ''} ${d.action}を記録しました` : '次回架電日を記録しました'}${d.nextDay ? `（次回 ${fmtD(d.nextDay)}）` : ''}`);
            await load(true);
            scrollToNext();
        } catch (e) {
            alert(`記録できませんでした: ${errorMessage(e, '通信エラー')}`);
        } finally {
            setBusy(false);
        }
    };

    const closeCustomer = () => {
        setOpenId('');
        void load(true);
    };

    if (loading) return <div className="ucq-page"><style>{STYLE}</style><p className="ucq-sub">読み込み中…</p></div>;
    if (data === null) return <div className="ucq-page"><style>{STYLE}</style><p className="ucq-sub">読み込めませんでした。画面を再読み込みしてください。</p></div>;

    const me = bare(data.me);
    const shown = mine ? cards.filter(c => bare(c.staff) === me) : cards;
    const kpi = mine ? data.kpi.mine : data.kpi.all;
    const nextId = shown.find(c => c.done === null)?.id ?? '';
    const doneN = shown.filter(c => c.done !== null).length;
    const [wf, wt] = data.week;

    const card = (c: QueueCard, i: number) => {
        const d = draftOf(c.id);
        const isNext = c.id === nextId;
        return (
            <div key={c.id} className={`ucq-card ${c.done ? 'done' : ''} ${isNext ? 'next' : ''}`} id={isNext ? 'ucq-next' : undefined}>
                <div className="ucq-r1">
                    <span className="ucq-no">{c.done ? '✓' : i + 1}</span>
                    <span className="ucq-nm">{c.name || '（顧客名なし）'}</span>
                    {c.tel ? <a className="ucq-tel" href={`tel:${c.tel}`}>☎ {c.tel}</a> : <span className="ucq-tel no">☎ 電話番号なし</span>}
                    <span>
                        {c.overdue > 0 ? <span className="ucq-badge red">{c.overdue}日超過</span> : <span className="ucq-badge navy">今日の予定</span>}
                        {c.callStatus && <span className="ucq-badge gray">{c.callStatus}</span>}
                    </span>
                    <span className="ucq-sp"></span>
                    <button className="ucq-btn sec" onClick={() => setOpenId(c.id)}>開く</button>
                </div>
                <div className="ucq-meta">
                    {`担当：${c.staff || '未割当'}　／　媒体：${c.medium || '―'}　／　反響 ${fmtD(c.inquiryDay)}　／　状況：${c.status || '―'}`}
                    <br />
                    {`次回架電日：${fmtD(c.dueDay)}　／　通算 📞${c.calls}`}
                </div>
                {c.recent.length > 0 && (
                    <div className="ucq-recent">
                        {c.recent.map((r, k) => (
                            <div key={k}><b>{fmtD(r.day)}{r.time ? ` ${r.time}` : ''} {r.action || '（アクションなし）'}</b>{r.staff ? `（${r.staff}）` : ''}{r.note ? `：${plainNote(r.note).slice(0, 80)}` : ''}</div>
                        ))}
                    </div>
                )}
                {c.done ? (
                    <div className="ucq-meta">
                        <b>{ACTION_ICON[c.done.action] ?? ''} {c.done.action}</b> を記録しました（{fmtD(c.done.day)}{c.done.time ? ` ${c.done.time}` : ''}）
                        {c.nextDay > data.today ? `　次回 ${fmtD(c.nextDay)}` : '　※ 次の次回架電日はまだ入っていません'}
                    </div>
                ) : (
                    <>
                        <div className="ucq-acts" role="group" aria-label="アクション内容">
                            {data.actions.map(a => (
                                <button key={a} type="button" className={d.action === a ? 'on' : ''} aria-pressed={d.action === a} disabled={busy}
                                    onClick={() => setDraft(c.id, { action: d.action === a ? '' : a })}>
                                    {ACTION_ICON[a] ?? ''} {a}
                                </button>
                            ))}
                        </div>
                        <div className="ucq-form">
                            <textarea className="ucq-memo" rows={2} placeholder="メモ（ヒアリング内容など）" value={d.note}
                                onChange={e => setDraft(c.id, { note: e.target.value })} aria-label="メモ" />
                            <label className="ucq-next">次回架電日
                                <input type="date" className="ucq-date" min={data.today} value={d.nextDay} onChange={e => setDraft(c.id, { nextDay: e.target.value })} />
                            </label>
                            <button className="ucq-btn ucq-save" disabled={busy || (!d.action && !d.nextDay)} onClick={() => void mark(c)}>記録</button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="ucq-page">
            <style>{STYLE}</style>
            <div className="ucq-head">
                <h1><i className="fa-solid fa-phone me-2" style={{ color: '#0d6efd' }}></i>今日の架電キュー</h1>
                <p className="ucq-sub">次回架電日が今日までのお客様に、上から順にかけていくための画面です。{fmtD(data.today)}</p>
            </div>

            <div className="ucq-card-box">
                <div className="ucq-box-head">
                    <h3>本日の対象 {shown.length}件<span className={`ucq-badge ${doneN ? 'green' : 'gray'}`}>記録済 {doneN}</span></h3>
                    <span className="ucq-sp"></span>
                    <label className="ucq-label">
                        <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> 自分の担当のみ（{data.me}）
                    </label>
                    <button className="ucq-btn sec" disabled={busy} onClick={() => { void load(false); showToast('架電キューを読み込み直しました'); }}>🔄 再読み込み</button>
                </div>
                <div className="ucq-body">
                    <div className="ucq-meters">
                        <div className="ucq-meter">
                            <div className="t"><span>今日の架電</span><span>次回架電日が今日</span></div>
                            <div className="v">{kpi.today}<small> 件</small></div>
                        </div>
                        <div className="ucq-meter">
                            <div className="t"><span>今週の架電</span><span>{fmtD(wf)}〜{fmtD(wt).slice(5)}</span></div>
                            <div className="v">{kpi.week}<small> 件</small></div>
                        </div>
                        <div className="ucq-meter">
                            <div className="t"><span>今月の架電</span><span>{Number(data.today.slice(5, 7))}月</span></div>
                            <div className="v">{kpi.month}<small> 件</small></div>
                        </div>
                    </div>

                    <div className="ucq-note">
                        今週・今月の架電は、<b>通電・未通電・SMS送信</b>の記録の数です（{mine ? 'かけた人が自分の分' : 'チーム全員の分'}）。<br />
                        アクションを選んでメモを書き、「記録」を押すと、お客様の架電記録に今日の日付で1件足されます。次回架電日を入れると、その日のキューに並びます。
                    </div>

                    {shown.length === 0 ? (
                        <div className="ucq-empty">
                            本日かける対象はありません。<br />
                            次回架電日が今日以前で、その日以降にまだ架電（通電・未通電・SMS送信）していないお客様が並びます。<br />
                            架電停止のお客様と、契約済み・失注のお客様は並びません。
                        </div>
                    ) : (
                        <>
                            {!nextId && <div className="ucq-note done">🎉 本日ぶんはすべて記録できました（{shown.length}件）。</div>}
                            <div className="ucq-list">{shown.map((c, i) => card(c, i))}</div>
                        </>
                    )}
                </div>
            </div>

            {toast && <div className="ucq-toast" role="status">{toast}</div>}
            <InformationEditResale id={openId} token={token} onClose={closeCustomer} authority={authority} />
        </div>
    );
};

export default UsedCallQueue;
