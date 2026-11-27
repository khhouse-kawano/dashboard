import React, { useContext, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import { errorText, landGet, landPost, reloadLandMaster, useAsync, useLandMaster } from './landApi';
import { LoadState } from './LandParts';
import { LAND_CSS } from './landStyle';

/**
 * 仕入設定（建売営業 → 土地仕入 → 仕入設定。/landSettings。v2.2.311。移行元の「設定・データ」タブの一部）。
 *
 * ⚠️ v2.2.311 は「担当者（スタッフとの結び付け・エリア・停止中）」と「移行元から取り込む（Master だけ）」だけ。
 *   目標・適正在庫・アラートの日数・選択肢・反響ソース・KPI の定義は v2.2.312 で足す。
 * ⚠️ 取り込みは移行元の JSON バックアップ。資料（_files）は外し、JSON を文字列のまま送る（① を通ると {} が [] になるため）。
 */

type DryRun = { counts: Record<string, number>; existing: Record<string, number>; fyStart: number };
const COUNT_LABEL: Record<string, string> = {
    members: '担当者', vendors: '業者', approaches: 'アプローチ', deals: '案件', dailyCounts: 'まとめ入力', reports: '日報',
    stock: '適正在庫', audit: '更新履歴', targetMonths: '月間目標（月数）', reviews: '月次レビュー',
};

const LandSettings = () => {
    const { authority } = useContext(AuthContext);
    const isMaster = authority === 'Master';
    const { master, error: masterError } = useLandMaster();
    const staff = useAsync(() => landGet<{ staff: { id: number; name: string; shop: string }[] }>('land_staff_candidates'), []);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [file, setFile] = useState<{ name: string; payload: string; files: number } | null>(null);
    const [dry, setDry] = useState<DryRun | null>(null);

    const saveMember = async (id: number, body: Record<string, unknown>) => {
        setBusy(true); setMsg(null);
        try { await landPost('member_save', { id, ...body }); await reloadLandMaster(); setMsg({ ok: true, text: '担当者を保存しました。' }); } catch (e) { setMsg({ ok: false, text: errorText(e, '保存できませんでした。') }); } finally { setBusy(false); }
    };

    const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setDry(null); setMsg(null);
        const rd = new FileReader();
        rd.onload = async () => {
            try {
                const data = JSON.parse(String(rd.result)) as Record<string, unknown>;
                if (!Array.isArray(data.members)) throw new Error('form');
                const files = Array.isArray(data._files) ? data._files.length : 0;
                delete data._files; // ⚠️ 資料（画像）は送らない（大きすぎるため。v2.2.313 で移す）
                const payload = JSON.stringify(data);
                setFile({ name: f.name, payload, files });
                setBusy(true);
                const r = await landPost<DryRun>('import', { dryRun: true, payload });
                setDry(r);
            } catch (err) {
                setFile(null);
                setMsg({ ok: false, text: (err as Error).message === 'form' ? '仕入KPI管理のバックアップ（JSON）ではありません。' : errorText(err, 'ファイルを読めませんでした。') });
            } finally { setBusy(false); }
        };
        rd.readAsText(f);
    };
    const runImport = async () => {
        if (!file || !window.confirm('土地仕入の記録（案件・業者・アプローチ・まとめ入力・日報・目標など）を、このバックアップの内容で入れ替えます。よろしいですか？')) return;
        setBusy(true); setMsg(null);
        try {
            const r = await landPost<{ linked: number; apSkipped: number }>('import', { payload: file.payload });
            await reloadLandMaster();
            setMsg({ ok: true, text: `取り込みました。担当者 ${r.linked}名をスタッフに自動で結び付けました${r.apSkipped ? `（日付の無いアプローチ ${r.apSkipped}件は入れていません）` : ''}。` });
            setFile(null); setDry(null);
        } catch (e) { setMsg({ ok: false, text: errorText(e, '取り込めませんでした。') }); } finally { setBusy(false); }
    };

    if (!master) return <div className="ld_wrap"><style>{LAND_CSS}</style><LoadState loading={!masterError} error={masterError} /></div>;
    const staffList = staff.data?.staff ?? [];

    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head"><span className="ld_title"><i className="fa-solid fa-gear me-2 text-primary" aria-hidden="true" />仕入設定</span></div>
                {msg && <div className={msg.ok ? 'ld_ok' : 'ld_error'}>{msg.text}</div>}

                <div className="ld_card">
                    <div className="ld_card_head"><span className="ld_card_title">担当者</span><span className="ld_badge">{master.members.length}名</span></div>
                    <div className="ld_caution mb-2">
                        担当者に Dashboard のスタッフを結び付けると、その人がログインしたときに「日次・アプローチ」などで自分が選ばれます。
                        停止中にした担当者は、選択肢とチームの目標から外れます（過去の記録は残ります）。
                    </div>
                    <LoadState loading={staff.loading} error={staff.error} />
                    <div className="ld_table_wrap">
                        <table className="ld_table"><thead><tr><th className="ld_th">担当者</th><th className="ld_th">エリア</th><th className="ld_th">Dashboard のスタッフ</th><th className="ld_th">状態</th></tr></thead>
                            <tbody>
                                {master.members.map((m) => (
                                    <tr key={m.id} className="ld_row">
                                        <td className="ld_td"><b>{m.name}</b></td>
                                        <td className="ld_td">
                                            <select className="ld_select" disabled={busy} value={m.areaId ?? ''} onChange={(e) => void saveMember(m.id, { areaId: e.target.value })}>
                                                <option value="">その他</option>{master.areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                                            </select>
                                        </td>
                                        <td className="ld_td">
                                            <select className="ld_select" disabled={busy} value={m.staffId ?? ''} onChange={(e) => void saveMember(m.id, { staffId: e.target.value })}>
                                                <option value="">（結び付けない）</option>
                                                {m.staffId !== null && !staffList.some((s) => s.id === m.staffId) && <option value={m.staffId}>（id {m.staffId}）</option>}
                                                {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}{s.shop === 'all' ? '（全事業）' : ''}</option>)}
                                            </select>
                                        </td>
                                        <td className="ld_td">
                                            <button className={`ld_btn is_sm${m.active ? ' is_on' : ''}`} disabled={busy} onClick={() => void saveMember(m.id, { active: m.active ? 0 : 1 })}>{m.active ? '稼働中' : '停止中'}</button>
                                        </td>
                                    </tr>
                                ))}
                                {master.members.length === 0 && <tr><td className="ld_td ld_empty" colSpan={4}>担当者がいません。下の「移行元から取り込む」で取り込んでください。</td></tr>}
                            </tbody></table>
                    </div>
                </div>

                {isMaster && (
                    <div className="ld_card">
                        <div className="ld_card_head"><span className="ld_card_title">移行元（仕入KPI管理）から取り込む</span><span className="ld_badge">Master だけ</span></div>
                        <div className="ld_caution mb-2">
                            仕入KPI管理の「設定・データ → 書き出し・バックアップ」で書き出した JSON を選びます。まず件数だけを確かめ、「取り込む」を押すと入れ替えます。<br />
                            ⚠️ 土地仕入の記録（案件・業者・アプローチ・まとめ入力・日報・目標・手入力の実績・レビュー・適正在庫・更新履歴）は、すべてこのファイルの内容に入れ替わります。
                            担当者とスタッフの結び付けは残ります。資料（図面など）は、この版では取り込みません。
                        </div>
                        <input type="file" accept=".json,application/json" disabled={busy} onChange={pickFile} />
                        {busy && <span className="ld_note ms-2">確かめています…</span>}
                        {file && dry && (
                            <div className="mt-2">
                                <div className="ld_note mb-1">{file.name}（{dry.fyStart}年度）の中身{file.files > 0 && `・資料 ${file.files}件は取り込みません`}</div>
                                <div className="ld_kpi">
                                    {Object.entries(dry.counts).map(([k, v]) => <div key={k} className="ld_kpi_card"><div className="ld_kpi_label">{COUNT_LABEL[k] ?? k}</div><div className="ld_kpi_value">{v.toLocaleString()}</div></div>)}
                                </div>
                                <div className="ld_note mt-1">いま入っている記録：案件 {dry.existing.deals}件・業者 {dry.existing.vendors}社・アプローチ {dry.existing.approaches}件（入れ替わります）</div>
                                <button className="ld_btn is_primary mt-2" disabled={busy} onClick={() => void runImport()}>取り込む</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LandSettings;
