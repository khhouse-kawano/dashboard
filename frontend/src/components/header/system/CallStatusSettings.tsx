import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { errorMessageOf } from '../../report/sharedReport';
import { clearCallStatusOptionsCache } from '../../database/callStatusOptions';

/**
 * 架電ステータス（v2.2.293 新規）。ヘッダーの「システム管理 → 架電ステータス」（⚠️ Master・insideSales。headerScreens.tsx の isInsideSales）。
 *
 * ─────────────────────────────────────────────
 *   上: 架電ステータス・架電アクションの選択肢（表 call_status）の追加・編集・表示／非表示
 *       ⚠️ 顧客DB の「架電状況」の絞り込みと、顧客情報の架電記録の選択肢になる（database/callStatusOptions.ts）
 *   下: インサイドセールスの担当者（staff_list の shop = インサイドセールス・今年度・inside = 1）の在籍／退職と管理店舗
 *       ⚠️ 管理店舗は注文事業の店舗から複数選ぶ（staff_list.managed_shops に JSON で入る）
 *
 * ⚠️ ② の call_status_admin / call_status_save / inside_staff_save も Master・insideSales を確かめる（features/callStatusMaster.ts）。
 * ⚠️ 消すボタンは作らない（非表示にする）。顧客に入っている値の意味が分からなくなるため。
 * ⚠️ 見た目は SharedReports.tsx に合わせている（接頭辞 cs_）。⚠️ 閉じるボタンは無い（ページ）。
 * ─────────────────────────────────────────────
 */

type Kind = 'status' | 'action';
type Division = 'order' | 'spec' | 'used' | 'all';

interface CallStatusItem {
    no: number;
    kind: Kind;
    name: string;
    division: Division;
    flag: number;
    sort: number;
    updated_at: string | null;
}

interface InsideStaff {
    id: number;
    name: string;
    staffStatus: string;
    managedShops: string[];
}

interface AdminResponse {
    status: string;
    period: string;
    items: CallStatusItem[];
    staff: InsideStaff[];
    shops: string[];
}

type Draft = { no: number; kind: Kind; name: string; division: Division; flag: number; sort: string };

const KIND_LABEL: Record<Kind, string> = { status: '架電ステータス', action: '架電アクション' };
const KIND_NOTE: Record<Kind, string> = {
    status: '顧客DB の「架電状況」の絞り込みと、顧客情報の「架電ステータス」の選択肢です。',
    action: '顧客情報の架電記録の「アクション内容」の選択肢です。',
};
const DIVISIONS: { value: Division; label: string }[] = [
    { value: 'all', label: '全事業' },
    { value: 'order', label: '注文' },
    { value: 'spec', label: '建売' },
    { value: 'used', label: '中古' },
];
const divisionLabel = (d: string): string => DIVISIONS.find((x) => x.value === d)?.label ?? d;

const emptyDraft = (kind: Kind, items: CallStatusItem[]): Draft => ({
    no: 0, kind, name: '', division: 'all', flag: 1,
    // ⚠️ 新しい行は、その種類のいちばん後ろ（並び順の最大 + 10）
    sort: String(Math.max(0, ...items.filter((i) => i.kind === kind).map((i) => i.sort)) + 10),
});

const CallStatusSettings: React.FC = () => {
    const [data, setData] = useState<AdminResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    /** 編集中の行（no = 0 は追加） */
    const [draft, setDraft] = useState<Draft | null>(null);
    /** インサイドセールスの担当者の編集中の値（id ごと） */
    const [staffDraft, setStaffDraft] = useState<Record<number, { staffStatus: string; managedShops: string[] }>>({});

    const apply = (res: AdminResponse) => {
        setData(res);
        setStaffDraft(Object.fromEntries(res.staff.map((s) => [s.id, { staffStatus: s.staffStatus, managedShops: s.managedShops }])));
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'call_status_admin' });
            if (res.data?.status !== 'ok') throw new Error('unexpected response');
            apply(res.data as AdminResponse);
        } catch (e) {
            console.error('架電ステータスの一覧の取得に失敗しました:', e);
            setError(errorMessageOf(e, '一覧を読み込めませんでした。時間をおいて開き直してください。'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    /** 保存して、返ってきた一覧で画面を直す（⚠️ 顧客DB・顧客情報の選択肢も読み直させる） */
    const post = async (body: Record<string, unknown>, done: string): Promise<boolean> => {
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const res = await apiClient.post('', body);
            if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '');
            apply(res.data as AdminResponse);
            clearCallStatusOptionsCache();
            setNotice(done);
            return true;
        } catch (e) {
            setError(errorMessageOf(e, '保存できませんでした。'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const saveDraft = async () => {
        if (!draft) return;
        if (draft.name.trim() === '') { setError('名前を入れてください。'); return; }
        const before = data?.items.find((i) => i.no === draft.no);
        if (before && before.name !== draft.name.trim()
            && !window.confirm(`「${before.name}」を「${draft.name.trim()}」に変えますか？\nすでに「${before.name}」が入っているお客様・架電記録の値は変わりません（そのまま「${before.name}」と出ます）。`)) return;
        const saved = await post(
            { request: 'call_status_save', no: draft.no, kind: draft.kind, name: draft.name.trim(), division: draft.division, flag: draft.flag, sort: Number(draft.sort) },
            draft.no === 0 ? `「${draft.name.trim()}」を追加しました。` : `「${draft.name.trim()}」を保存しました。`
        );
        if (saved) setDraft(null);
    };

    const toggleFlag = (item: CallStatusItem) => void post(
        { request: 'call_status_save', no: item.no, kind: item.kind, name: item.name, division: item.division, flag: item.flag === 1 ? 0 : 1, sort: item.sort },
        `「${item.name}」を${item.flag === 1 ? '非表示' : '表示'}にしました。`
    );

    const saveStaff = (s: InsideStaff) => {
        const d = staffDraft[s.id];
        if (!d) return;
        void post({ request: 'inside_staff_save', id: s.id, staffStatus: d.staffStatus, managedShops: d.managedShops }, `${s.name}さんを保存しました。`);
    };

    const toggleShop = (id: number, shop: string) => setStaffDraft((prev) => {
        const d = prev[id];
        if (!d) return prev;
        const managedShops = d.managedShops.includes(shop) ? d.managedShops.filter((x) => x !== shop) : [...d.managedShops, shop];
        return { ...prev, [id]: { ...d, managedShops } };
    });

    const counts = useMemo(() => {
        const items = data?.items ?? [];
        return {
            status: items.filter((i) => i.kind === 'status' && i.flag === 1).length,
            action: items.filter((i) => i.kind === 'action' && i.flag === 1).length,
            hidden: items.filter((i) => i.flag !== 1).length,
            staff: (data?.staff ?? []).filter((s) => s.staffStatus === '在籍').length,
        };
    }, [data]);

    const kpi = (label: string, value: string) => (
        <div className="cs_kpi_card"><div className="cs_kpi_label">{label}</div><div className="cs_kpi_value">{value}</div></div>
    );

    /** 編集中の行の入力欄 */
    const draftRow = (d: Draft) => (
        <tr className="cs_row is_editing" key={`draft-${d.no}`}>
            <td className="cs_td">
                <input className="form-control form-control-sm" value={d.name} maxLength={32} autoFocus aria-label="名前"
                    placeholder={d.kind === 'status' ? '例：IS対応中' : '例：SMS返信あり'}
                    onChange={(e) => setDraft({ ...d, name: e.target.value })} />
            </td>
            <td className="cs_td">
                <select className="form-select form-select-sm" value={d.division} aria-label="事業"
                    onChange={(e) => setDraft({ ...d, division: e.target.value as Division })}>
                    {DIVISIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
            </td>
            <td className="cs_td">
                <input className="form-control form-control-sm cs_num" type="number" min={0} max={99999} value={d.sort} aria-label="並び順"
                    onChange={(e) => setDraft({ ...d, sort: e.target.value })} />
            </td>
            <td className="cs_td">
                <div className="form-check form-switch m-0">
                    <input className="form-check-input" type="checkbox" checked={d.flag === 1} aria-label="表示"
                        onChange={(e) => setDraft({ ...d, flag: e.target.checked ? 1 : 0 })} />
                </div>
            </td>
            <td className="cs_td cs_time">—</td>
            <td className="cs_td">
                <span className="d-inline-flex gap-1">
                    <button type="button" className="cs_btn is_primary" disabled={saving} onClick={() => void saveDraft()}>{saving ? '保存中…' : '保存'}</button>
                    <button type="button" className="cs_btn" disabled={saving} onClick={() => setDraft(null)}>やめる</button>
                </span>
            </td>
        </tr>
    );

    const optionCard = (kind: Kind) => {
        const items = (data?.items ?? []).filter((i) => i.kind === kind);
        return (
            <section className="cs_card" aria-label={KIND_LABEL[kind]}>
                <div className="cs_card_head">
                    <div>
                        <div className="cs_card_title">{KIND_LABEL[kind]}</div>
                        <div className="cs_note">{KIND_NOTE[kind]}</div>
                    </div>
                    <button type="button" className="cs_btn is_primary ms-auto" disabled={saving || draft !== null}
                        onClick={() => { setNotice(''); setDraft(emptyDraft(kind, data?.items ?? [])); }}>＋ 追加</button>
                </div>
                <div className="cs_table_wrap">
                    <table className="cs_table">
                        <thead>
                            <tr>
                                <th className="cs_th" style={{ minWidth: 160 }}>名前</th>
                                <th className="cs_th" style={{ width: 90 }}>事業</th>
                                <th className="cs_th" style={{ width: 90 }}>並び順</th>
                                <th className="cs_th" style={{ width: 70 }}>表示</th>
                                <th className="cs_th" style={{ width: 130 }}>更新</th>
                                <th className="cs_th" style={{ width: 120 }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {draft?.kind === kind && draft.no === 0 && draftRow(draft)}
                            {items.length === 0 && !(draft?.kind === kind && draft.no === 0) && (
                                <tr><td className="cs_td cs_empty" colSpan={6}>{loading ? '読み込み中…' : 'まだありません'}</td></tr>
                            )}
                            {items.map((item) => (draft?.no === item.no ? draftRow(draft) : (
                                <tr key={item.no} className={`cs_row${item.flag === 1 ? '' : ' is_hidden'}`}>
                                    <td className="cs_td cs_name">{item.name}</td>
                                    <td className="cs_td"><span className={`cs_pill is_${item.division}`}>{divisionLabel(item.division)}</span></td>
                                    <td className="cs_td cs_num">{item.sort}</td>
                                    <td className="cs_td">
                                        <div className="form-check form-switch m-0" title={item.flag === 1 ? '選択肢に出す' : '選択肢に出さない'}>
                                            <input className="form-check-input" type="checkbox" checked={item.flag === 1} disabled={saving || draft !== null}
                                                aria-label={`${item.name}を表示`} onChange={() => toggleFlag(item)} />
                                        </div>
                                    </td>
                                    <td className="cs_td cs_time">{item.updated_at ?? '—'}</td>
                                    <td className="cs_td">
                                        <button type="button" className="cs_btn" disabled={saving || draft !== null}
                                            onClick={() => { setNotice(''); setDraft({ no: item.no, kind: item.kind, name: item.name, division: item.division, flag: item.flag, sort: String(item.sort) }); }}>編集</button>
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    };

    return (
        <div className="cs_wrap">
            <style>{`
                .cs_wrap { font-size: 13px; color: #1f2937; padding: 12px 40px 24px; box-sizing: border-box; }
                .cs_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
                .cs_note { font-size: 11px; color: #6b7280; }
                .cs_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .cs_kpi_card { flex: 1 1 150px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .cs_kpi_label { font-size: 11px; color: #6b7280; }
                .cs_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .cs_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .cs_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; }
                .cs_ok { font-size: 12px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; }
                .cs_grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(520px, 1fr)); gap: 12px; align-items: start; }
                .cs_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; display: flex;
                           flex-direction: column; gap: 10px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
                .cs_card_head { display: flex; align-items: flex-start; gap: 10px; }
                .cs_card_title { font-size: 15px; font-weight: 700; }
                .cs_section_title { font-size: 15px; font-weight: 700; margin-top: 6px; }
                .cs_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; }
                .cs_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .cs_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .cs_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
                .cs_row:hover > .cs_td { background: #f8fafc; }
                .cs_row.is_hidden > .cs_td { color: #9ca3af; }
                .cs_row.is_editing > .cs_td { background: #eff6ff; }
                .cs_name { font-weight: 700; white-space: nowrap; min-width: 140px; }
                .cs_row.is_hidden .cs_name { font-weight: 400; text-decoration: line-through; }
                .cs_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                input.cs_num { width: 80px; }
                .cs_time { white-space: nowrap; font-variant-numeric: tabular-nums; color: #6b7280; }
                .cs_pill { display: inline-block; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .cs_pill.is_all { background: #f3f4f6; color: #374151; }
                .cs_pill.is_order { background: #eff6ff; color: #1e40af; }
                .cs_pill.is_spec { background: #ecfdf5; color: #047857; }
                .cs_pill.is_used { background: #fdf2ec; color: #b4532a; }
                .cs_pill.is_on { background: #dcfce7; color: #166534; }
                .cs_pill.is_off { background: #f3f4f6; color: #6b7280; }
                .cs_btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 6px; font-size: 11px;
                          font-weight: 700; padding: 2px 8px; cursor: pointer; white-space: nowrap; }
                .cs_btn:hover:not(:disabled) { background: #f1f5f9; }
                .cs_btn:disabled { opacity: .5; cursor: default; }
                .cs_btn.is_primary { background: #2563eb; border-color: #2563eb; color: #fff; }
                .cs_btn.is_primary:hover:not(:disabled) { background: #1d4ed8; }
                .cs_empty { text-align: center; color: #9ca3af; padding: 24px 0; }
                .cs_staff_grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
                .cs_staff_head { display: flex; align-items: center; gap: 8px; }
                .cs_staff_name { font-size: 14px; font-weight: 700; }
                .cs_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 4px; }
                .cs_chips { display: flex; flex-wrap: wrap; gap: 6px; }
                .cs_chip { border: 1px solid #d1d5db; background: #fff; color: #4b5563; border-radius: 999px; font-size: 11px;
                           padding: 2px 10px; cursor: pointer; white-space: nowrap; }
                .cs_chip:hover { border-color: #2563eb; }
                .cs_chip.is_on { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 700; }
                .cs_seg { display: inline-flex; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
                .cs_seg button { border: 0; background: #fff; color: #4b5563; font-size: 11px; font-weight: 700; padding: 3px 12px; cursor: pointer; }
                .cs_seg button + button { border-left: 1px solid #d1d5db; }
                .cs_seg button.is_on { background: #2563eb; color: #fff; }
                @media (max-width: 900px) { .cs_wrap { padding: 12px 16px 16px; } .cs_grid { grid-template-columns: 1fr; } }
            `}</style>

            <div className="cs_inner">
                <div className="cs_note">
                    架電ステータス・架電アクションの選択肢と、インサイドセールスの担当者の管理店舗を設定します。保存した選択肢は、次に顧客DB・顧客情報を開いたときから出ます。
                </div>

                {error !== '' && <div className="cs_error" role="alert">{error}</div>}
                {notice !== '' && <div className="cs_ok" role="status">{notice}</div>}

                {data && (
                    <>
                        <div className="cs_kpi">
                            {kpi('表示中の架電ステータス', `${counts.status}件`)}
                            {kpi('表示中の架電アクション', `${counts.action}件`)}
                            {kpi('非表示', `${counts.hidden}件`)}
                            {kpi(`インサイドセールス（${data.period}年度・在籍）`, `${counts.staff}人`)}
                        </div>

                        <div className="cs_caution">
                            名前はお客様の情報にそのまま入る文字です。名前を変えたり非表示にしたりしても、すでに入っているお客様・架電記録の値は変わりません（そのお客様を開くと、今の値のまま出ます）。使わなくなった選択肢は消さずに「表示」を外してください。
                            「事業」が全事業の選択肢は、注文・建売・中古のすべてに出ます。
                        </div>

                        <div className="cs_grid">
                            {optionCard('status')}
                            {optionCard('action')}
                        </div>

                        <div className="cs_section_title">インサイドセールスの担当者（{data.period}年度）</div>
                        <div className="cs_note">
                            スタッフ編集でインサイドセールス（店舗「インサイドセールス」・今年度・インサイドセールスの印あり）にした人が出ます。管理店舗は注文事業の店舗から選びます（いくつでも選べます）。
                        </div>
                        <div className="cs_staff_grid">
                            {data.staff.length === 0 && <div className="cs_card cs_empty">今年度のインサイドセールスの担当者はいません</div>}
                            {data.staff.map((s) => {
                                const d = staffDraft[s.id] ?? { staffStatus: s.staffStatus, managedShops: s.managedShops };
                                const changed = d.staffStatus !== s.staffStatus || JSON.stringify([...d.managedShops].sort()) !== JSON.stringify([...s.managedShops].sort());
                                // ⚠️ 選べる店舗に無い管理店舗（店舗名が変わったなど）も外せるように出す
                                const shopChoices = [...data.shops, ...d.managedShops.filter((x) => !data.shops.includes(x))];
                                return (
                                    <section key={s.id} className="cs_card" aria-label={s.name}>
                                        <div className="cs_staff_head">
                                            <span className="cs_staff_name">{s.name}</span>
                                            <span className={`cs_pill ${s.staffStatus === '在籍' ? 'is_on' : 'is_off'}`}>{s.staffStatus || '未設定'}</span>
                                            <span className="cs_note ms-auto">管理店舗 {s.managedShops.length}店</span>
                                        </div>
                                        <div>
                                            <div className="cs_label">在籍・退職</div>
                                            <div className="cs_seg" role="group" aria-label={`${s.name}の在籍・退職`}>
                                                {['在籍', '退職'].map((v) => (
                                                    <button key={v} type="button" className={d.staffStatus === v ? 'is_on' : ''}
                                                        onClick={() => setStaffDraft((prev) => ({ ...prev, [s.id]: { ...d, staffStatus: v } }))}>{v}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="cs_label">管理店舗（{d.managedShops.length}店）</div>
                                            <div className="cs_chips">
                                                {shopChoices.map((shop) => (
                                                    <button key={shop} type="button" className={`cs_chip${d.managedShops.includes(shop) ? ' is_on' : ''}`}
                                                        aria-pressed={d.managedShops.includes(shop)} onClick={() => toggleShop(s.id, shop)}>{shop}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="d-flex gap-1 justify-content-end">
                                            {changed && <button type="button" className="cs_btn" disabled={saving}
                                                onClick={() => setStaffDraft((prev) => ({ ...prev, [s.id]: { staffStatus: s.staffStatus, managedShops: s.managedShops } }))}>元に戻す</button>}
                                            <button type="button" className="cs_btn is_primary" disabled={saving || !changed} onClick={() => saveStaff(s)}>
                                                {saving ? '保存中…' : '保存'}
                                            </button>
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </>
                )}
                {!data && loading && <div className="cs_note">読み込み中…</div>}
            </div>
        </div>
    );
};

export default CallStatusSettings;
