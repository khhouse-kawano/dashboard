import React, { useEffect, useState } from 'react';
import { errorText, landGet, landPost, reloadLandMaster, useAsync, type LandMaster } from './landApi';
import { Field, LoadState, MemberSelect } from './LandParts';

/**
 * 仕入設定の「年度・アラート／適正在庫／選択肢／反響ソース／KPI の定義／更新履歴」（v2.2.311。移行元の「設定・データ」タブ）。
 * ⚠️ 読み込みは ② の land_settings_data（GET）。保存は land:setting_save・stock_save・option_save・source_save・kpi_save（POST）。
 * ⚠️ 選択肢は消さずに止める（保存済みの記録の値が選べなくならないように）。
 * ⚠️ 自動で数える6指標は名前・単位・説明・並び・使うかだけ変えられる。新しい KPI は手入力だけ（目標・月次入力で入れる）。
 */

interface SettingsData {
    settings: { fyStart: number; leadDays: number; warnDays: number };
    stock: { id: number; memberId: number | null; areaName: string; proper: number; stock: number; sales: number }[];
    options: Record<string, { value: string; active: boolean }[]>;
    sources: { id: number; name: string; kind: string; memo: string; sort: number; active: boolean }[];
    kpiDefs: { id: number; key: string; label: string; unit: string; calc: string; description: string; sort: number; active: boolean }[];
    audit: { at: string; user: string; act: string; target: string; name: string; note: string }[];
}
const OPTION_LABEL: Record<string, string> = {
    deal_kind: '案件種別', ap_type: 'アプローチ種別', reaction: '反応・感触', reply_result: '買付の返答結果', lost_reason: '失注理由',
    deal_terms: '契約条件', vendor_kind: '業者の区分', phase: '育成フェーズ', bottleneck: 'ボトルネック',
};
const ACT_LABEL: Record<string, string> = {
    create: '登録', update: '変更', delete: '削除', status: 'ステータス', reply: '買付返答', lost: '失注理由', daily: 'まとめ入力', report: '日報',
    target: '目標', member: '担当者', import: '取込', system: 'システム',
};
type StockRow = { memberId: number | null; areaName: string; proper: string; stock: string; sales: string };

const LandSettingsMore = ({ master }: { master: LandMaster }) => {
    const { data, loading, error, reload } = useAsync(() => landGet<SettingsData>('land_settings_data'), []);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [cfg, setCfg] = useState({ fyStart: '', leadDays: '', warnDays: '' });
    const [stock, setStock] = useState<StockRow[]>([]);
    const [optKey, setOptKey] = useState('reaction');
    const [opts, setOpts] = useState<{ value: string; active: boolean }[]>([]);
    const [newOpt, setNewOpt] = useState('');
    const [src, setSrc] = useState({ name: '', kind: '', memo: '' });
    const [kpi, setKpi] = useState({ key: '', label: '', unit: '件', description: '' });

    useEffect(() => {
        if (!data) return;
        setCfg({ fyStart: String(data.settings.fyStart), leadDays: String(data.settings.leadDays), warnDays: String(data.settings.warnDays) });
        setStock(data.stock.map((s) => ({ memberId: s.memberId, areaName: s.areaName, proper: String(s.proper), stock: String(s.stock), sales: String(s.sales) })));
    }, [data]);
    useEffect(() => { if (data) setOpts(data.options[optKey] ?? []); }, [data, optKey]);

    const run = async (fn: () => Promise<unknown>, okText: string) => {
        setBusy(true); setMsg(null);
        try { await fn(); setMsg({ ok: true, text: okText }); await reload(); await reloadLandMaster(); } catch (e) { setMsg({ ok: false, text: errorText(e, '保存できませんでした。') }); } finally { setBusy(false); }
    };
    if (!data) return <LoadState loading={loading} error={error} />;
    const fy = data.settings.fyStart;

    return (
        <>
            {msg && <div className={msg.ok ? 'ld_ok' : 'ld_error'}>{msg.text}</div>}
            <div className="ld_card">
                <div className="ld_card_head"><span className="ld_card_title">年度・買付 返答期日のアラート</span>
                    <button className="ld_btn is_primary" disabled={busy} onClick={() => void run(() => landPost('setting_save', { fyStart: Number(cfg.fyStart), leadDays: Number(cfg.leadDays), warnDays: Number(cfg.warnDays) }), '設定を保存しました。')}>保存</button></div>
                <div className="ld_grid">
                    <Field label="対象年度（6月始まり）"><input type="number" className="ld_input" value={cfg.fyStart} onChange={(e) => setCfg((c) => ({ ...c, fyStart: e.target.value }))} /></Field>
                    <Field label="返答期日の既定（買付日から何日後）"><input type="number" min={0} max={90} className="ld_input" value={cfg.leadDays} onChange={(e) => setCfg((c) => ({ ...c, leadDays: e.target.value }))} /></Field>
                    <Field label="アラートを出し始める日数（期日の何日前から）"><input type="number" min={0} max={60} className="ld_input" value={cfg.warnDays} onChange={(e) => setCfg((c) => ({ ...c, warnDays: e.target.value }))} /></Field>
                </div>
            </div>

            <div className="ld_card">
                <div className="ld_card_head"><span className="ld_card_title">適正在庫（{fy}年度）</span>
                    <button className="ld_btn" disabled={busy} onClick={() => setStock((s) => [...s, { memberId: null, areaName: '', proper: '0', stock: '0', sales: '0' }])}>行を足す</button>
                    <button className="ld_btn is_primary" disabled={busy} onClick={() => void run(() => landPost('stock_save', { fy, rows: JSON.stringify(stock) }), '適正在庫を保存しました。')}>保存</button></div>
                <div className="ld_table_wrap"><table className="ld_table"><thead><tr><th className="ld_th">担当</th><th className="ld_th">詳細エリア</th><th className="ld_th ld_num">適正在庫</th><th className="ld_th ld_num">在庫</th><th className="ld_th ld_num">販売</th><th className="ld_th ld_num">過不足</th><th className="ld_th" /></tr></thead>
                    <tbody>{stock.map((r, i) => {
                        const set = (k: keyof StockRow, v: StockRow[keyof StockRow]) => setStock((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                        const gap = Number(r.stock || 0) - Number(r.proper || 0);
                        return (
                            <tr key={i} className="ld_row">
                                <td className="ld_td"><MemberSelect master={master} value={r.memberId} onChange={(v) => set('memberId', v)} includeStopped /></td>
                                <td className="ld_td"><input className="ld_input" value={r.areaName} onChange={(e) => set('areaName', e.target.value)} placeholder="例）霧島市" /></td>
                                {(['proper', 'stock', 'sales'] as const).map((k) => <td key={k} className="ld_td ld_num"><input type="number" min={0} className="ld_input" style={{ width: 70, textAlign: 'right' }} value={r[k]} onChange={(e) => set(k, e.target.value)} /></td>)}
                                <td className="ld_td ld_num" style={{ color: gap < 0 ? '#b91c1c' : undefined, fontWeight: 700 }}>{gap > 0 ? '+' : ''}{gap}</td>
                                <td className="ld_td"><button className="ld_btn is_sm is_danger" onClick={() => setStock((s) => s.filter((_, j) => j !== i))}>外す</button></td>
                            </tr>
                        );
                    })}</tbody></table></div>
            </div>

            <div className="ld_two">
                <div className="ld_card">
                    <div className="ld_card_head"><span className="ld_card_title">選択肢</span>
                        <select className="ld_select" value={optKey} onChange={(e) => setOptKey(e.target.value)}>{Object.keys(OPTION_LABEL).map((k) => <option key={k} value={k}>{OPTION_LABEL[k]}</option>)}</select>
                        <button className="ld_btn is_primary" disabled={busy} onClick={() => void run(() => landPost('option_save', { listKey: optKey, values: JSON.stringify(opts) }), `${OPTION_LABEL[optKey]}を保存しました。`)}>保存</button></div>
                    {opts.map((o, i) => (
                        <div key={o.value} className="d-flex align-items-center gap-2" style={{ padding: '3px 0' }}>
                            <button className={`ld_btn is_sm${o.active ? ' is_on' : ''}`} onClick={() => setOpts((l) => l.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}>{o.active ? '使う' : '止めた'}</button>
                            <span style={{ color: o.active ? undefined : '#9ca3af' }}>{o.value}</span>
                        </div>
                    ))}
                    <div className="d-flex gap-2 mt-2"><input className="ld_input" value={newOpt} onChange={(e) => setNewOpt(e.target.value)} placeholder="新しい選択肢" />
                        <button className="ld_btn" onClick={() => { const v = newOpt.trim(); if (v && !opts.some((o) => o.value === v)) setOpts((l) => [...l, { value: v, active: true }]); setNewOpt(''); }}>足す</button></div>
                    <div className="ld_note mt-1">止めた選択肢は、新しく選べなくなるだけで、保存済みの記録には残ります。{optKey === 'ap_type' && '⚠️ アプローチ種別の名前を変えると、集計で「訪問」に数えられます。'}</div>
                </div>

                <div className="ld_card">
                    <div className="ld_card_head"><span className="ld_card_title">反響ソース</span><span className="ld_badge">{data.sources.filter((s) => s.active).length}件</span></div>
                    <div className="ld_note mb-1">土地の情報がどこから来たか。1件でも入れると、案件の画面で選べるようになります。</div>
                    {data.sources.map((s) => (
                        <div key={s.id} className="d-flex align-items-center gap-2" style={{ padding: '3px 0' }}>
                            <button className={`ld_btn is_sm${s.active ? ' is_on' : ''}`} disabled={busy} onClick={() => void run(() => landPost('source_save', { ...s, active: !s.active }), '反響ソースを保存しました。')}>{s.active ? '使う' : '止めた'}</button>
                            <span>{s.name}</span><span className="ld_sub">{s.kind}</span>
                        </div>
                    ))}
                    <div className="ld_grid mt-2">
                        <Field label="名前"><input className="ld_input" value={src.name} onChange={(e) => setSrc((x) => ({ ...x, name: e.target.value }))} /></Field>
                        <Field label="種類（任意）"><input className="ld_input" value={src.kind} onChange={(e) => setSrc((x) => ({ ...x, kind: e.target.value }))} placeholder="業者・ポータルなど" /></Field>
                    </div>
                    <button className="ld_btn mt-2" disabled={busy || !src.name.trim()} onClick={() => void run(async () => { await landPost('source_save', { ...src, sort: data.sources.length + 1 }); setSrc({ name: '', kind: '', memo: '' }); }, '反響ソースを足しました。')}>反響ソースを足す</button>
                </div>
            </div>

            <div className="ld_card">
                <div className="ld_card_head"><span className="ld_card_title">KPI の定義</span></div>
                <div className="ld_table_wrap"><table className="ld_table"><thead><tr><th className="ld_th">キー</th><th className="ld_th">名前</th><th className="ld_th">単位</th><th className="ld_th">数え方</th><th className="ld_th">説明</th><th className="ld_th">状態</th></tr></thead>
                    <tbody>{data.kpiDefs.map((k) => (
                        <tr key={k.id} className="ld_row"><td className="ld_td">{k.key}</td><td className="ld_td">{k.label}</td><td className="ld_td">{k.unit}</td>
                            <td className="ld_td">{k.calc === 'auto' ? '自動（記録から）' : '手入力'}</td><td className="ld_td"><span className="ld_sub">{k.description}</span></td>
                            <td className="ld_td"><button className={`ld_btn is_sm${k.active ? ' is_on' : ''}`} disabled={busy} onClick={() => void run(() => landPost('kpi_save', { ...k, active: !k.active }), 'KPI を保存しました。')}>{k.active ? '使う' : '止めた'}</button></td></tr>
                    ))}</tbody></table></div>
                <div className="ld_section_title mt-3">KPI を足す（手入力の KPI）</div>
                <div className="ld_grid">
                    <Field label="キー（英小文字・数字・_）"><input className="ld_input" value={kpi.key} onChange={(e) => setKpi((x) => ({ ...x, key: e.target.value }))} placeholder="例）survey" /></Field>
                    <Field label="名前"><input className="ld_input" value={kpi.label} onChange={(e) => setKpi((x) => ({ ...x, label: e.target.value }))} placeholder="例）現地調査" /></Field>
                    <Field label="単位"><input className="ld_input" value={kpi.unit} onChange={(e) => setKpi((x) => ({ ...x, unit: e.target.value }))} /></Field>
                    <Field label="説明（任意）"><input className="ld_input" value={kpi.description} onChange={(e) => setKpi((x) => ({ ...x, description: e.target.value }))} /></Field>
                </div>
                <button className="ld_btn mt-2" disabled={busy || !kpi.key.trim() || !kpi.label.trim()} onClick={() => void run(async () => { await landPost('kpi_save', { ...kpi, sort: data.kpiDefs.length + 1 }); setKpi({ key: '', label: '', unit: '件', description: '' }); }, 'KPI を足しました。')}>KPI を足す</button>
                <div className="ld_note mt-1">足した KPI の目標と実績は「目標・月次入力」で入れます。カード・ヒートマップにも出ます。</div>
            </div>

            <div className="ld_card">
                <div className="ld_card_head"><span className="ld_card_title">更新履歴（新しい200件）</span></div>
                <div className="ld_table_wrap" style={{ maxHeight: 400 }}><table className="ld_table"><thead><tr><th className="ld_th">日時</th><th className="ld_th">した人</th><th className="ld_th">操作</th><th className="ld_th">対象</th><th className="ld_th">名前</th><th className="ld_th">内容</th></tr></thead>
                    <tbody>{data.audit.map((a, i) => (
                        <tr key={i} className="ld_row"><td className="ld_td ld_nowrap">{a.at.slice(0, 16)}</td><td className="ld_td ld_nowrap">{a.user}</td><td className="ld_td ld_nowrap">{ACT_LABEL[a.act] ?? a.act}</td><td className="ld_td ld_nowrap">{a.target}</td><td className="ld_td">{a.name}</td><td className="ld_td"><span className="ld_sub">{a.note}</span></td></tr>
                    ))}</tbody></table></div>
            </div>
        </>
    );
};

export default LandSettingsMore;
