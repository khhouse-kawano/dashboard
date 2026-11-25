import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import apiClient from '../../../utils/apiClient';

/**
 * 集客イベント → フォーム作成（v2.2.298）。イベントの予約フォームを作り、番号付きの URL を出す。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 申し込みは event_db に入り、反響一覧（EventList.tsx）に出る。公開フォームは backend/forms/event/index.html。
 * ⚠️ 入力欄の名前・種類・選択肢は ② の features/eventForm/fields.ts が元。この画面は受け取って並べるだけ（写さない）。
 * ⚠️ 使えるのは反響一覧を開けるスタッフ全員（2026-11-25 の指示）。② も auth staff だけで権限は見ない。
 * ⚠️ 作ったフォームは消さない（URL を配ったあとに消すと開いた人が困る）。止めるときは「受付中」を外す。
 * ⚠️ v2.2.299 イベントはイベントカレンダー（event_calendar の全社 shop='khg'・表示中 flag=1）から選ぶ。
 *   ⚠️「新しく追加する」は開始日・終了日・名前を ② に送り、② がカレンダーに1行入れる（画面からカレンダーへは書かない）。
 *   ⚠️ 反響一覧に出る名前は「開始日_名前」（例: 2026-12-05_○○フェア）。集客サマリーはこの形で開催日と結び付ける。
 * ⚠️ fields は JSON の文字列で送る（① を通ると空の {} が [] に変わるため）。
 * ─────────────────────────────────────────────
 */

type FieldKey = string;

/** イベントカレンダーのイベント（② の features/eventForm/calendar.ts） */
interface CalendarEvent {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
    url: string;
}

interface FieldDef {
    key: FieldKey;
    label: string;
    kind: string;
    options: string[];
    fixed: boolean;
    /** 新しいフォームで必須にしておくか（② の fields.ts が決める） */
    defaultRequired: boolean;
}

type FieldSettings = Record<FieldKey, { show: boolean; required: boolean }>;

interface EventForm {
    id: number;
    url: string;
    title: string;
    /** ⚠️ v2.2.298 で作ったフォームは null（編集でイベントを選び直す） */
    calendar_id: number | null;
    mail_to: string;
    mail_cc: string;
    fields: FieldSettings;
    active: boolean;
    created_by: string;
    created_at: string;
    updated_by: string;
    updated_at: string;
}

interface Draft {
    id: number | null;
    /** 'pick' = イベントカレンダーから選ぶ、'new' = 開始日・終了日・名前を入れて追加する */
    titleMode: 'pick' | 'new';
    /** 選んだカレンダーのイベントの id（⚠️ select の値なので文字。未選択は ''） */
    calendarId: string;
    newStart: string;
    newEnd: string;
    newName: string;
    /** 編集のときの今のイベント名（⚠️ v2.2.298 のフォームは選び直すまでこれを見せる） */
    currentTitle: string;
    mail_to: string;
    mail_cc: string;
    fields: FieldSettings;
    active: boolean;
}

const KIND_LABEL: Record<string, string> = {
    text: '文字', tel: '電話番号', email: 'メール', zip: '郵便番号（住所を検索）', radio: '選択', number: '人数', textarea: '文章',
};

/** 新しいフォームの欄の既定（全部聞く。必須は ② が返す defaultRequired） */
const initialFields = (defs: FieldDef[]): FieldSettings =>
    Object.fromEntries(defs.map(d => [d.key, { show: true, required: d.defaultRequired }]));

const emptyDraft = (defs: FieldDef[]): Draft => ({
    id: null, titleMode: 'pick', calendarId: '', newStart: '', newEnd: '', newName: '', currentTitle: '',
    mail_to: '', mail_cc: '', fields: initialFields(defs), active: true,
});

const draftOf = (f: EventForm): Draft => ({
    id: f.id, titleMode: 'pick', calendarId: f.calendar_id === null ? '' : String(f.calendar_id), newStart: '', newEnd: '', newName: '',
    currentTitle: f.title, mail_to: f.mail_to, mail_cc: f.mail_cc, fields: f.fields, active: f.active,
});

/** 選択肢の表記（2026-12-05〜12-06　○○フェア）。⚠️ 1日だけのイベントは開始日だけ */
const eventLabel = (e: CalendarEvent): string =>
    `${e.startDate}${e.endDate !== '' && e.endDate !== e.startDate ? `〜${e.endDate.slice(5)}` : ''}　${e.title}`;

/** 反響一覧に出る名前（② の eventTitleOf と同じ形）。⚠️ 決まっていなければ '' */
const titleOf = (d: Draft, events: CalendarEvent[]): string => {
    if (d.titleMode === 'new') return d.newStart !== '' && d.newName.trim() !== '' ? `${d.newStart}_${d.newName.trim()}` : '';
    const e = events.find(ev => String(ev.id) === d.calendarId);
    return e ? `${e.startDate}_${e.title}` : '';
};

const messageOf = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: unknown } | undefined)?.message;
        if (typeof message === 'string' && message !== '') return message;
        if (error.response) return `応答 ${error.response.status}`;
    }
    return error instanceof Error ? error.message : '原因不明';
};

const CSS = `
.ef_wrap { font-size: 13px; color: #1f2937; padding: 16px 20px 24px; height: 100%; overflow: auto; box-sizing: border-box; background: #fff; }
.ef_inner { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.ef_head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.ef_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.ef_note { font-size: 11px; color: #6b7280; }
.ef_btn { border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid transparent;
          white-space: nowrap; background: #2563eb; color: #fff; }
.ef_btn:hover { background: #1d4ed8; }
.ef_btn:disabled { background: #93c5fd; cursor: default; }
.ef_btn_ghost { background: #fff; color: #4b5563; border-color: #d1d5db; }
.ef_btn_ghost:hover { background: #f3f4f6; }
.ef_btn_sm { padding: 3px 10px; font-size: 11px; }
.ef_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
.ef_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; }
.ef_done { font-size: 12px; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 12px;
           display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ef_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.ef_card_title { font-size: 13px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px; }
.ef_grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.ef_field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ef_label { font-size: 11px; font-weight: 700; color: #6b7280; }
.ef_input { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 10px; font-size: 12px; background: #fff; color: #1f2937; outline: none; width: 100%; box-sizing: border-box; }
.ef_input:focus { border-color: #2563eb; }
.ef_hint { font-size: 11px; color: #9ca3af; }
.ef_seg { display: inline-flex; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; align-self: flex-start; }
.ef_seg button { border: 0; background: #fff; color: #4b5563; font-size: 11px; font-weight: 700; padding: 4px 12px; cursor: pointer; }
.ef_seg button.is_on { background: #2563eb; color: #fff; }
.ef_row3 { display: flex; gap: 6px; align-items: center; }
.ef_row3 .ef_input { flex: 1 1 0; min-width: 0; }
.ef_tilde { color: #9ca3af; }
.ef_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
.ef_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.ef_table th { position: sticky; top: 0; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 8px 10px; text-align: left;
               font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.ef_table td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.ef_table tr:last-child td { border-bottom: 0; }
.ef_table tr.is_current td { background: #eff6ff; }
.ef_table .ef_center { text-align: center; }
.ef_table .ef_num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.ef_url { color: #2563eb; word-break: break-all; }
.ef_pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
.ef_pill_on { background: #dcfce7; color: #166534; }
.ef_pill_off { background: #f3f4f6; color: #6b7280; }
.ef_fixed { font-size: 10px; color: #9ca3af; margin-left: 6px; }
.ef_check { width: 16px; height: 16px; cursor: pointer; }
.ef_actions { display: flex; gap: 8px; align-items: center; }
`;

/** 集客イベント → フォーム作成 */
const EventFormBuilder = () => {
    const [forms, setForms] = useState<EventForm[]>([]);
    /** 選べるイベント（イベントカレンダーの全社・表示中。開始日の新しい順） */
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [defs, setDefs] = useState<FieldDef[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    /** 作成・編集中のフォーム（⚠️ null のときは編集の枠を出さない） */
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    /** 保存できたフォーム（URL を出す） */
    const [savedId, setSavedId] = useState<number | null>(null);
    const [copied, setCopied] = useState('');

    const load = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await apiClient.post('', { request: 'event_form', roll: 'list' });
            setForms(res.data.forms ?? []);
            setEvents(res.data.events ?? []);
            setDefs(res.data.fields ?? []);
        } catch (error) {
            console.error('event_form（一覧）の読み込みに失敗しました:', error);
            setLoadError(messageOf(error));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const savedForm = useMemo(() => forms.find(f => f.id === savedId) ?? null, [forms, savedId]);

    const startNew = () => { setDraft(emptyDraft(defs)); setSaveError(''); setSavedId(null); };
    const startEdit = (f: EventForm) => { setDraft(draftOf(f)); setSaveError(''); setSavedId(null); };
    const update = (patch: Partial<Draft>) => setDraft(prev => (prev ? { ...prev, ...patch } : prev));

    const setField = (key: FieldKey, patch: Partial<{ show: boolean; required: boolean }>) =>
        setDraft(prev => {
            if (!prev) return prev;
            const next = { ...prev.fields[key], ...patch };
            // ⚠️ 表示しない欄は必須にしない（② も同じように整える）
            if (!next.show) next.required = false;
            return { ...prev, fields: { ...prev.fields, [key]: next } };
        });

    const save = async () => {
        if (!draft) return;
        if (draft.titleMode === 'pick' && titleOf(draft, events) === '') {
            setSaveError('イベントを選んでください。');
            return;
        }
        if (draft.titleMode === 'new') {
            if (draft.newStart === '' || draft.newEnd === '' || draft.newName.trim() === '') {
                setSaveError('開始日・終了日・イベント名を入力してください。');
                return;
            }
            if (draft.newEnd < draft.newStart) {
                setSaveError('終了日は開始日より後の日にしてください。');
                return;
            }
        }
        if (draft.mail_to.trim() === '') {
            setSaveError('反響の通知先のメールアドレスを入力してください。');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            const res = await apiClient.post('', {
                request: 'event_form', roll: 'save',
                ...(draft.id === null ? {} : { id: draft.id }),
                // ⚠️ 今あるイベントは calendar_id、新しいイベントは new_*（② がカレンダーに入れる）。⚠️ イベント名そのものは送らない
                ...(draft.titleMode === 'pick'
                    ? { calendar_id: Number(draft.calendarId) }
                    : { new_title: draft.newName.trim(), new_start: draft.newStart, new_end: draft.newEnd }),
                mail_to: draft.mail_to, mail_cc: draft.mail_cc,
                fields: JSON.stringify(draft.fields), active: draft.active,
            });
            // ⚠️ 一覧を読み直してから「保存しました」を出す（先に出すと、一覧の受付中・停止が古いまま見える）
            await load();
            setSavedId(Number(res.data.id));
            setDraft(null);
        } catch (error) {
            console.error('event_form（保存）に失敗しました:', error);
            setSaveError(messageOf(error));
        } finally {
            setSaving(false);
        }
    };

    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(url);
            window.setTimeout(() => setCopied(''), 2000);
        } catch (error) {
            console.error('URL をコピーできませんでした:', error);
        }
    };

    return (
        <div className="ef_wrap">
            <style>{CSS}</style>
            <div className="ef_inner">
                <div className="ef_head">
                    <span className="ef_title">イベントの予約フォーム作成</span>
                    <span className="ef_note">作ったフォームの申し込みは「反響一覧」に入り、通知先にメールが届きます</span>
                    <button className="ef_btn ef_btn_ghost" onClick={load} disabled={loading}>
                        <i className="fa-solid fa-rotate-right me-1" />{loading ? '読み込み中…' : '読み直す'}
                    </button>
                    <button className="ef_btn" onClick={startNew} disabled={defs.length === 0}>
                        <i className="fa-solid fa-plus me-1" />新しいフォームを作る
                    </button>
                </div>

                <div className="ef_caution">
                    URL は保存すると自動で番号が付きます（https://khg-marketing.info/form/番号/）。フォームは削除できません。受付をやめるときは「受付中」のチェックを外して保存してください。
                    申し込んだ方には、入力した内容の控えがメールで届きます。
                </div>

                {loadError !== '' && <div className="ef_error">フォームの一覧を読み込めませんでした（{loadError}）</div>}

                {savedForm && (
                    <div className="ef_done">
                        <i className="fa-solid fa-circle-check" />
                        <span>保存しました：</span>
                        <a className="ef_url" href={savedForm.url} target="_blank" rel="noreferrer">{savedForm.url}</a>
                        <button className="ef_btn ef_btn_ghost ef_btn_sm" onClick={() => copy(savedForm.url)}>{copied === savedForm.url ? 'コピーしました' : 'URL をコピー'}</button>
                    </div>
                )}

                {draft && (
                    <div className="ef_card">
                        <div className="ef_card_title">
                            {draft.id === null ? '新しいフォーム' : `フォーム ${draft.id} を編集`}
                        </div>

                        <div className="ef_grid">
                            <div className="ef_field">
                                <span className="ef_label">イベント</span>
                                <div className="ef_seg">
                                    <button className={draft.titleMode === 'pick' ? 'is_on' : ''} onClick={() => update({ titleMode: 'pick' })}>イベントカレンダーから選ぶ</button>
                                    <button className={draft.titleMode === 'new' ? 'is_on' : ''} onClick={() => update({ titleMode: 'new' })}>新しく追加する</button>
                                </div>
                                {draft.titleMode === 'pick' ? (
                                    <>
                                        <select className="ef_input" value={draft.calendarId} onChange={e => update({ calendarId: e.target.value })} aria-label="イベント">
                                            <option value="">イベントを選択（全社イベント）</option>
                                            {events.map(e => <option key={e.id} value={String(e.id)}>{eventLabel(e)}</option>)}
                                        </select>
                                        {/*
                                          ⚠️ 編集で、今のイベントが選択肢に無いとき（v2.2.298 で作ったフォーム・カレンダーで非表示にしたイベント）は、
                                            選び直すまで今の名前を見せる（⚠️ 選択欄は空に見えるため）
                                        */}
                                        {draft.id !== null && !events.some(ev => String(ev.id) === draft.calendarId) && (
                                            <span className="ef_hint" style={{ color: '#b45309' }}>今のイベント名は「{draft.currentTitle}」です。イベントカレンダーから選び直してください。</span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="ef_row3">
                                            <input className="ef_input" type="date" value={draft.newStart} onChange={e => update({ newStart: e.target.value, newEnd: draft.newEnd === '' ? e.target.value : draft.newEnd })} aria-label="開始日" />
                                            <span className="ef_tilde">〜</span>
                                            <input className="ef_input" type="date" value={draft.newEnd} min={draft.newStart || undefined} onChange={e => update({ newEnd: e.target.value })} aria-label="終了日" />
                                        </div>
                                        <input className="ef_input" type="text" value={draft.newName} maxLength={200} placeholder="イベント名（例：完成見学会 霧島市）" onChange={e => update({ newName: e.target.value })} aria-label="イベント名" />
                                        <span className="ef_hint">保存するとイベントカレンダー（全社）にも入ります</span>
                                    </>
                                )}
                                <span className="ef_hint">反響一覧には「{titleOf(draft, events) || '開始日_イベント名'}」の名前で出ます</span>
                            </div>
                            <div className="ef_field">
                                <span className="ef_label">反響の通知先（To）</span>
                                <input className="ef_input" type="text" value={draft.mail_to} placeholder="例：event@example.com" onChange={e => update({ mail_to: e.target.value })} />
                                <span className="ef_hint">複数のときはカンマ（,）で区切ります</span>
                            </div>
                            <div className="ef_field">
                                <span className="ef_label">Cc</span>
                                <input className="ef_input" type="text" value={draft.mail_cc} placeholder="任意" onChange={e => update({ mail_cc: e.target.value })} />
                                <label className="ef_hint d-flex align-items-center gap-1 mt-1" style={{ color: '#1f2937', fontSize: '12px' }}>
                                    <input className="ef_check" type="checkbox" checked={draft.active} onChange={e => update({ active: e.target.checked })} />
                                    受付中（外すとフォームを開いても「受付は終了しました」と出ます）
                                </label>
                            </div>
                        </div>

                        <div className="ef_field">
                            <span className="ef_label">フォームで聞く項目</span>
                            <div className="ef_table_wrap">
                                <table className="ef_table">
                                    <thead>
                                        <tr>
                                            <th>項目</th>
                                            <th>入力のしかた</th>
                                            <th className="ef_center" style={{ width: '90px' }}>聞く</th>
                                            <th className="ef_center" style={{ width: '90px' }}>必須</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {defs.map(d => {
                                            const s = draft.fields[d.key] ?? { show: true, required: false };
                                            return (
                                                <tr key={d.key}>
                                                    <td>{d.label}{d.fixed && <span className="ef_fixed">（常に聞く・必須）</span>}</td>
                                                    <td className="ef_note">{KIND_LABEL[d.kind] ?? d.kind}{d.options.length > 0 && `：${d.options.join('・')}`}</td>
                                                    <td className="ef_center">
                                                        <input className="ef_check" type="checkbox" aria-label={`${d.label}を聞く`} checked={d.fixed || s.show} disabled={d.fixed}
                                                            onChange={e => setField(d.key, { show: e.target.checked })} />
                                                    </td>
                                                    <td className="ef_center">
                                                        <input className="ef_check" type="checkbox" aria-label={`${d.label}を必須にする`} checked={d.fixed || s.required} disabled={d.fixed || !s.show}
                                                            onChange={e => setField(d.key, { required: e.target.checked })} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {saveError !== '' && <div className="ef_error">{saveError}</div>}

                        <div className="ef_actions">
                            <button className="ef_btn" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存する'}</button>
                            <button className="ef_btn ef_btn_ghost" onClick={() => setDraft(null)} disabled={saving}>やめる</button>
                        </div>
                    </div>
                )}

                <div className="ef_table_wrap">
                    <table className="ef_table">
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }}>番号</th>
                                <th>イベント名</th>
                                <th>URL</th>
                                <th>通知先</th>
                                <th className="ef_center">受付</th>
                                <th>更新</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {forms.map(f => (
                                <tr key={f.id} className={draft?.id === f.id ? 'is_current' : ''}>
                                    <td className="ef_num">{f.id}</td>
                                    <td style={{ fontWeight: 700 }}>{f.title}</td>
                                    <td>
                                        <a className="ef_url" href={f.url} target="_blank" rel="noreferrer">{f.url}</a>
                                        <button className="ef_btn ef_btn_ghost ef_btn_sm ms-2" onClick={() => copy(f.url)}>{copied === f.url ? 'コピーしました' : 'コピー'}</button>
                                    </td>
                                    <td className="ef_note" style={{ maxWidth: '260px' }}>
                                        {f.mail_to}{f.mail_cc !== '' && <><br />Cc：{f.mail_cc}</>}
                                    </td>
                                    <td className="ef_center">
                                        <span className={`ef_pill ${f.active ? 'ef_pill_on' : 'ef_pill_off'}`}>{f.active ? '受付中' : '停止'}</span>
                                    </td>
                                    <td className="ef_note ef_num">{f.updated_at}<br />{f.updated_by}</td>
                                    <td><button className="ef_btn ef_btn_ghost ef_btn_sm" onClick={() => startEdit(f)}>編集</button></td>
                                </tr>
                            ))}
                            {forms.length === 0 && !loading && (
                                <tr><td colSpan={7} className="ef_note" style={{ textAlign: 'center', padding: '24px' }}>まだフォームはありません。「新しいフォームを作る」から作れます。</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EventFormBuilder;
