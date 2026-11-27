import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { errorText, landGet, landPost, type LandApproach, type LandDeal, type LandMaster, type LandVendor } from './landApi';
import { Field, MemberSelect } from './LandParts';
import { STATUS_CLASS } from './landStyle';
import { extractVendorFields } from './vendorExtract';

/**
 * 業者の追加・編集と、その業者へのアプローチ履歴・案件（v2.2.311。移行元の openVendorModal）。
 * ⚠️ 保存は ② の land:vendor_save。⚠️ 名前を変えると、案件・アプローチの業者名もそろう。
 * ⚠️ 買取実績 ＝ 手入力の買取数（過去の実績）＋ 決済完了の案件の区画数（自動）。
 * ⚠️ 会社概要・名刺などのテキストから自動で抜き出せる（vendorExtract.ts。画面の中だけ。空いている欄だけに入れる）。
 */

type Detail = { vendor: LandVendor; approaches: LandApproach[]; deals: LandDeal[] };
const RANKS = ['A', 'B', 'C', 'D', 'E'];
const TEMPS = ['◎', '〇', '△', '✕'];

const LandVendorModal = ({ show, vendorId, master, onClose, onSaved }: {
    show: boolean; vendorId: number | null; master: LandMaster; onClose: () => void; onSaved: () => void;
}) => {
    const [form, setForm] = useState<Partial<LandVendor>>({});
    const [detail, setDetail] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [extractText, setExtractText] = useState('');
    const [extractNote, setExtractNote] = useState('');

    useEffect(() => {
        if (!show) return;
        setError(''); setExtractText(''); setExtractNote('');
        if (vendorId === null) { setForm({ vkind: master.options.vendor_kind?.[0] ?? '不動産業者', ownerMemberId: master.meMemberId }); setDetail(null); return; }
        setLoading(true);
        landGet<Detail>('land_vendor_get', { id: vendorId })
            .then((r) => { setDetail(r); setForm(r.vendor); })
            .catch((e) => setError(errorText(e, '業者を読み込めませんでした。')))
            .finally(() => setLoading(false));
    }, [show, vendorId, master]);

    /** 貼り付けたテキストから抜き出し、空いている欄だけに入れる（⚠️ 入っている値は上書きしない） */
    const applyExtract = () => {
        const x = extractVendorFields(extractText);
        const filled: string[] = [];
        const LABEL: Record<string, string> = { name: '業者名', contact: '担当者名', tel: '電話番号', email: 'メール', area: 'エリア', addr: '住所', url: 'URL', memo: 'メモ' };
        setForm((f) => {
            const next = { ...f };
            (Object.keys(LABEL) as (keyof typeof LABEL)[]).forEach((k) => {
                const v = x[k as keyof typeof x];
                if (v && !String(f[k as keyof LandVendor] ?? '').trim()) { (next as Record<string, unknown>)[k] = v; filled.push(LABEL[k]); }
            });
            if (vendorId === null && x.vkind) next.vkind = x.vkind;
            return next;
        });
        setExtractNote(filled.length ? `${filled.join('・')}を入れました。確かめてから保存してください。` : '空いている欄に入れられる値はありませんでした。');
    };
    const setStr = (k: keyof LandVendor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const save = async () => {
        if (!(form.name ?? '').trim()) { setError('業者名を入れてください。'); return; }
        setSaving(true); setError('');
        try {
            const keys: (keyof LandVendor)[] = ['name', 'vkind', 'contact', 'tel', 'email', 'area', 'addr', 'url', 'ownerMemberId', 'rank', 'temp', 'lastVisit', 'buyCount', 'memo'];
            const body: Record<string, unknown> = Object.fromEntries(keys.filter((k) => form[k] !== undefined).map((k) => [k, form[k] ?? '']));
            if (vendorId !== null) body.id = vendorId;
            await landPost('vendor_save', body);
            onSaved();
        } catch (e) { setError(errorText(e, '保存できませんでした。')); } finally { setSaving(false); }
    };
    const remove = async () => {
        if (vendorId === null || !window.confirm(`${form.name} を業者マスタから外します。案件・アプローチの業者名は残ります。よろしいですか？`)) return;
        setSaving(true);
        try { await landPost('vendor_delete', { id: vendorId }); onSaved(); } catch (e) { setError(errorText(e, '外せませんでした。')); } finally { setSaving(false); }
    };
    const settledLots = (detail?.deals ?? []).filter((d) => d.status === '決済完了').reduce((s, d) => s + d.lots, 0);

    return (
        <Modal show={show} onHide={onClose} size="xl" scrollable>
            <Modal.Header closeButton><Modal.Title style={{ fontSize: 15, fontWeight: 700 }}>{vendorId === null ? '業者を追加' : '業者情報'}</Modal.Title></Modal.Header>
            <Modal.Body style={{ fontSize: 13 }}>
                {error !== '' && <div className="ld_error mb-2">{error}</div>}
                {loading ? <div className="ld_note">読み込み中…</div> : (
                    <>
                        <details className="mb-3" open={vendorId === null}>
                            <summary className="ld_section_title" style={{ cursor: 'pointer' }}>会社概要・名刺・署名などのテキストから自動で抜き出す</summary>
                            <textarea className="ld_textarea" style={{ minHeight: 90 }} value={extractText} onChange={(e) => setExtractText(e.target.value)}
                                placeholder="ホームページの会社概要や、メールの署名を貼り付けます" />
                            <button className="ld_btn mt-1" disabled={extractText.trim() === ''} onClick={applyExtract}>抜き出して空いている欄に入れる</button>
                            {extractNote && <span className="ld_note ms-2">{extractNote}</span>}
                        </details>
                        <div className="ld_grid">
                            <Field label="業者名"><input className="ld_input" value={form.name ?? ''} onChange={setStr('name')} /></Field>
                            <Field label="区分">
                                <select className="ld_select" value={form.vkind ?? ''} onChange={setStr('vkind')}>
                                    <option value="">（なし）</option>{(master.options.vendor_kind ?? []).map((v) => <option key={v}>{v}</option>)}
                                </select>
                            </Field>
                            <Field label="担当者名（先方）"><input className="ld_input" value={form.contact ?? ''} onChange={setStr('contact')} /></Field>
                            <Field label="電話番号"><input className="ld_input" value={form.tel ?? ''} onChange={setStr('tel')} /></Field>
                            <Field label="メールアドレス"><input className="ld_input" value={form.email ?? ''} onChange={setStr('email')} /></Field>
                            <Field label="エリア"><input className="ld_input" value={form.area ?? ''} onChange={setStr('area')} /></Field>
                            <Field label="住所" full><input className="ld_input" value={form.addr ?? ''} onChange={setStr('addr')} /></Field>
                            <Field label="社内担当"><MemberSelect master={master} value={form.ownerMemberId ?? null} onChange={(v) => setForm((f) => ({ ...f, ownerMemberId: v }))} /></Field>
                            <Field label="ランク（A＝最重要〜E＝実績なし）">
                                <select className="ld_select" value={form.rank ?? ''} onChange={setStr('rank')}><option value="">（なし）</option>{RANKS.map((v) => <option key={v}>{v}</option>)}</select>
                            </Field>
                            <Field label="温度感">
                                <select className="ld_select" value={form.temp ?? ''} onChange={setStr('temp')}><option value="">（なし）</option>{TEMPS.map((v) => <option key={v}>{v}</option>)}</select>
                            </Field>
                            <Field label="最終訪問日"><input type="date" className="ld_input" value={form.lastVisit ?? ''} onChange={setStr('lastVisit')} /></Field>
                            <Field label="買取数（手入力・過去の実績）"><input type="number" min={0} className="ld_input" value={form.buyCount ?? 0} onChange={(e) => setForm((f) => ({ ...f, buyCount: Number(e.target.value) || 0 }))} /></Field>
                            {vendorId !== null && (
                                <Field label="買取実績（合計）"><div className="ld_kpi_value" style={{ fontSize: 15 }}>{(form.buyCount ?? 0) + settledLots} 区画<span className="ld_sub ms-1">（決済完了 {settledLots}）</span></div></Field>
                            )}
                            <Field label="ホームページ / 参照URL" full><input className="ld_input" value={form.url ?? ''} onChange={setStr('url')} /></Field>
                            <Field label="メモ" full><textarea className="ld_textarea" value={form.memo ?? ''} onChange={setStr('memo')} /></Field>
                        </div>
                        {detail && (
                            <div className="ld_two mt-3">
                                <div>
                                    <div className="ld_section_title">アプローチ履歴（{detail.approaches.length}件）</div>
                                    <div className="ld_table_wrap" style={{ maxHeight: 280 }}>
                                        <table className="ld_table"><thead><tr><th className="ld_th">日付</th><th className="ld_th">担当</th><th className="ld_th">種別</th><th className="ld_th">反応</th><th className="ld_th">取得情報</th></tr></thead>
                                            <tbody>
                                                {detail.approaches.map((a) => (
                                                    <tr key={a.id} className="ld_row"><td className="ld_td ld_nowrap">{a.date}</td><td className="ld_td ld_nowrap">{a.memberName}</td><td className="ld_td ld_nowrap">{a.type}</td><td className="ld_td ld_nowrap">{a.reaction}</td><td className="ld_td">{a.memo}</td></tr>
                                                ))}
                                                {detail.approaches.length === 0 && <tr><td className="ld_td ld_empty" colSpan={5}>まだありません。</td></tr>}
                                            </tbody></table>
                                    </div>
                                </div>
                                <div>
                                    <div className="ld_section_title">この業者からの案件（{detail.deals.length}件）</div>
                                    <div className="ld_table_wrap" style={{ maxHeight: 280 }}>
                                        <table className="ld_table"><thead><tr><th className="ld_th">取得日</th><th className="ld_th">担当</th><th className="ld_th">所在地</th><th className="ld_th ld_num">区画</th><th className="ld_th">ステータス</th></tr></thead>
                                            <tbody>
                                                {detail.deals.map((d) => (
                                                    <tr key={d.id} className="ld_row"><td className="ld_td ld_nowrap">{d.infoDate}</td><td className="ld_td ld_nowrap">{d.memberName}</td><td className="ld_td">{d.address}</td><td className="ld_td ld_num">{d.lots}</td><td className="ld_td"><span className={`ld_pill ${STATUS_CLASS[d.status] ?? ''}`}>{d.status}</span></td></tr>
                                                ))}
                                                {detail.deals.length === 0 && <tr><td className="ld_td ld_empty" colSpan={5}>まだありません。</td></tr>}
                                            </tbody></table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-start gap-2">
                <button className="ld_btn is_primary" disabled={saving || loading} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button>
                <button className="ld_btn" disabled={saving} onClick={onClose}>閉じる</button>
                {vendorId !== null && <button className="ld_btn is_danger ms-auto" disabled={saving} onClick={() => void remove()}>業者マスタから外す</button>}
            </Modal.Footer>
        </Modal>
    );
};

export default LandVendorModal;
