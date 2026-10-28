import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    REALTY_CSS, loadRealtyState, newId, saveRealtySettings,
} from '../common/realtyState';
import type { Company, RealtySettings as Settings, Template } from '../common/realtyState';
import type { StaffSetting } from '../summary/kpi';

/**
 * 設定（不動産企画係。v2.2.223）。
 *
 * ⚠️ 移植元は本番アプリの「⚙ 設定・データ管理」（renderSettings）。ここを直すと、チームサマリーなど全画面に反映される。
 * ⚠️ 保存は**入力欄を離れたとき**に、その項目だけ（② の planner:settings）。
 * ⚠️ 本番アプリの次のカードはまだ移していない（それを使う画面と一緒に移す）:
 *   買取再販の粗利の計算方式・経費科目マスタ／架電キュー／売主への販売報告／データ管理（バックアップ・CSV）
 */

const MAX_STAFF = 10;
const MAX_TEMPLATES = 30;

/** 宅建業者情報の欄（本番アプリの DEFAULT_COMPANY と同じ並び） */
const COMPANY_FIELDS: { key: keyof Company; label: string; wide?: boolean; placeholder?: string }[] = [
    { key: 'name', label: '商号', wide: true },
    { key: 'rep', label: '代表者（役職・氏名）', placeholder: '代表取締役　○○ ○○' },
    { key: 'dept', label: '部署' },
    { key: 'addr', label: '所在地', wide: true, placeholder: '鹿児島県○○市○○町0-0-0' },
    { key: 'tel', label: 'TEL' },
    { key: 'fax', label: 'FAX' },
    { key: 'license', label: '免許証番号', wide: true, placeholder: '鹿児島県知事（　）第　　　号' },
    { key: 'assoc', label: '加入協会・保証協会', wide: true },
    { key: 'agent', label: '宅地建物取引士（既定）', placeholder: '氏名' },
    { key: 'agentNo', label: '取引士登録番号' },
];

const STYLE = `
.rlt-set-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px 16px; }
.rlt-set-grid .wide { grid-column: span 2; }
.rlt-set-grid label { display: block; font-size: 11px; color: #6c757d; margin-bottom: 2px; }
.rlt-set-grid input { width: 100%; }
.rlt-set-tpl { border: 1px solid #e9ecef; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
.rlt-set-tpl textarea { width: 100%; margin-top: 6px; font-size: 12px; }
.rlt-set-costs { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
.rlt-set-costs .rlt-tbl { width: auto; }
@media (max-width: 600px) { .rlt-set-grid .wide { grid-column: span 1; } }
`;

type Key = keyof Settings;

const RealtySettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState('');
    const [newSource, setNewSource] = useState('');
    const [newPortal, setNewPortal] = useState('');
    // ⚠️ 入力欄を離れたときに「最新の値」を送るため、描画を待たずに読める写しを持つ
    const latest = useRef<Settings>({});
    // ⚠️ 打っただけで離れていない項目。離れたときにだけ送る（打つたびに送らない）
    const dirty = useRef<Set<Key>>(new Set());

    useEffect(() => {
        loadRealtyState()
            .then(st => { latest.current = st.settings; setSettings(st.settings); })
            .catch((e: Error) => alert(`設定を読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    /** 画面の値だけ変える（保存はしない） */
    const edit = useCallback(<K extends Key>(key: K, value: Settings[K]) => {
        latest.current = { ...latest.current, [key]: value };
        dirty.current.add(key);
        setSettings(latest.current);
    }, []);

    /** その項目を保存する。⚠️ 失敗したら保存済みの値に戻す */
    const persist = useCallback(async (key: Key) => {
        if (!dirty.current.has(key)) return;
        dirty.current.delete(key);
        try {
            const saved = await saveRealtySettings({ [key]: latest.current[key] });
            // ⚠️ 保存中に別の項目を打ち始めていたら、その項目は画面の値を残す
            const merged: Settings = { ...saved };
            dirty.current.forEach(k => { (merged as Record<string, unknown>)[k] = latest.current[k]; });
            latest.current = merged;
            setSettings(merged);
            setSavedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
            const st = await loadRealtyState().catch(() => null);
            if (st) { latest.current = st.settings; setSettings(st.settings); }
        }
    }, []);

    /** 変えてすぐ保存する（追加・削除・選択など） */
    const editAndSave = useCallback(<K extends Key>(key: K, value: Settings[K]) => {
        edit(key, value);
        void persist(key);
    }, [edit, persist]);

    const staff = settings.staff ?? [];
    const sources = settings.sources ?? [];
    const buyPortals = settings.buyPortals ?? [];
    const templates = settings.templates ?? [];
    const company = settings.company ?? {};

    const setStaff = (i: number, field: keyof StaffSetting, value: string | number) =>
        edit('staff', staff.map((s, j) => (j === i ? { ...s, [field]: value } : s)));

    const addStaff = () => {
        if (staff.length >= MAX_STAFF) { alert(`担当者は${MAX_STAFF}名までです`); return; }
        editAndSave('staff', [...staff, { id: newId(), name: '', abbr: '', budget: 0, monthlyGoal: 0, baikaiTarget: 0 }]);
    };
    const removeStaff = (i: number) => {
        if (!window.confirm(`${staff[i].name || 'この担当者'} を削除しますか？（案件・台帳のデータは残ります）`)) return;
        editAndSave('staff', staff.filter((_, j) => j !== i));
    };

    const addName = (key: 'sources' | 'buyPortals', value: string, clear: () => void) => {
        const v = value.trim();
        if (!v) return;
        const list = key === 'sources' ? sources : buyPortals;
        if (list.includes(v)) { alert('既に登録されています'); return; }
        editAndSave(key, [...list, v]);
        clear();
    };

    const setCost = (key: 'srcCosts' | 'portalCosts', name: string, raw: string) => {
        const next = { ...(settings[key] ?? {}) };
        const n = Number(raw) || 0;
        if (n > 0) next[name] = n; else delete next[name];
        edit(key, next);
    };

    const setTemplate = (i: number, field: keyof Template, value: string) =>
        edit('templates', templates.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
    const addTemplate = () => {
        if (templates.length >= MAX_TEMPLATES) { alert(`テンプレートは${MAX_TEMPLATES}件までです`); return; }
        editAndSave('templates', [...templates, { id: newId(), title: '新しいテンプレート', body: '' }]);
    };
    const removeTemplate = (i: number) => {
        if (!window.confirm(`「${templates[i].title || 'このテンプレート'}」を削除しますか？`)) return;
        editAndSave('templates', templates.filter((_, j) => j !== i));
    };

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const numInput = (value: number | undefined, onChange: (v: number) => void, onBlur: () => void, width: number) => (
        <input
            type="number" min={0} className="rlt-input" style={{ width, textAlign: 'right' }}
            value={value || ''} placeholder="0"
            onChange={e => onChange(Number(e.target.value) || 0)} onBlur={onBlur}
        />
    );

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-gear me-2" style={{ color: '#0d6efd' }}></i>設定</h1>
                <p className="rlt-sub">担当者・反響元・期首年月はここで管理すると全画面に反映されます。入力欄を離れると保存します。</p>
                {savedAt && <span className="rlt-saved"><i className="fa-solid fa-check me-1"></i>{savedAt} 保存しました</span>}
            </div>

            <div className="rlt-alert">
                <b>切り替えまでの注意：</b>以前のアプリから全データを取り込むとき、ここでの設定は以前のアプリの設定で上書きされます。切り替えまでは、設定の変更は以前のアプリでも行ってください。
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>期首年月</h3><span className="rlt-note">この月から12か月を集計対象とします（年度切替時のみ変更）</span></div>
                <div className="rlt-body">
                    <input
                        type="month" className="rlt-input" value={settings.fiscalStart ?? ''}
                        onChange={e => e.target.value && editAndSave('fiscalStart', e.target.value)}
                    />
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>担当者（{MAX_STAFF}名まで）</h3><span className="rlt-note">略称は媒介台帳の担当欄と照合します（1文字でも違うと集計されません）</span></div>
                <div className="rlt-tblwrap">
                    <table className="rlt-tbl">
                        <thead><tr>
                            <th>No.</th><th>担当者名</th><th>略称（台帳照合用）</th>
                            <th className="r">年間予算(円)</th><th className="r">今月目標売上(円)</th><th className="r">年間媒介目標(件)</th><th></th>
                        </tr></thead>
                        <tbody>
                            {staff.map((s, i) => (
                                <tr key={s.id || i}>
                                    <td>{i + 1}</td>
                                    <td><input className="rlt-input" value={s.name ?? ''} onChange={e => setStaff(i, 'name', e.target.value)} onBlur={() => persist('staff')} /></td>
                                    <td><input className="rlt-input" style={{ width: 90 }} value={s.abbr ?? ''} onChange={e => setStaff(i, 'abbr', e.target.value)} onBlur={() => persist('staff')} /></td>
                                    <td className="r">{numInput(s.budget, v => setStaff(i, 'budget', v), () => persist('staff'), 130)}</td>
                                    <td className="r">{numInput(s.monthlyGoal, v => setStaff(i, 'monthlyGoal', v), () => persist('staff'), 130)}</td>
                                    <td className="r">{numInput(s.baikaiTarget, v => setStaff(i, 'baikaiTarget', v), () => persist('staff'), 90)}</td>
                                    <td><button className="rlt-icon" title="削除" onClick={() => removeStaff(i)}><i className="fa-solid fa-trash"></i></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="rlt-body" style={{ paddingTop: 10 }}>
                    <button className="rlt-btn sec" onClick={addStaff}>＋ 担当者を追加</button>
                </div>
            </div>

            {([
                ['sources', '反響元マスタ', '売り反響・媒介台帳の反響元の候補', sources, newSource, setNewSource, '反響元名を追加'],
                ['buyPortals', '買いポータルマスタ', '買い反響の反響元の候補', buyPortals, newPortal, setNewPortal, 'ポータル名を追加'],
            ] as const).map(([key, title, note, list, value, setValue, placeholder]) => (
                <div className="rlt-card" key={key}>
                    <div className="rlt-card-head"><h3>{title}</h3><span className="rlt-note">{note}</span></div>
                    <div className="rlt-body">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {list.map(name => (
                                <span className="rlt-chip" key={name}>
                                    {name}
                                    <button className="rlt-icon" title="外す" onClick={() => editAndSave(key, list.filter(x => x !== name))}>✕</button>
                                </span>
                            ))}
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                            <input
                                className="rlt-input" style={{ width: 180 }} placeholder={placeholder} value={value}
                                onChange={e => setValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addName(key, value, () => setValue('')); }}
                            />
                            <button className="rlt-btn sec" onClick={() => addName(key, value, () => setValue(''))}>追加</button>
                        </div>
                    </div>
                </div>
            ))}

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>反響単価設定（1件あたり）</h3><span className="rlt-note">各サイトの反響1件あたりの仕入単価（円）。チームサマリーの反響費用と獲得単価に使います。空欄＝未設定（0円扱い）</span></div>
                <div className="rlt-body rlt-set-costs">
                    {([
                        ['srcCosts', '売り：一括査定サイト等（反響元マスタ）', '反響元', sources],
                        ['portalCosts', '買い：ポータルサイト（買いポータルマスタ）', 'ポータル', buyPortals],
                    ] as const).map(([key, title, col, names]) => (
                        <div key={key}>
                            <div className="rlt-note" style={{ fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
                            <table className="rlt-tbl">
                                <thead><tr><th>{col}</th><th className="r">単価(円/件)</th></tr></thead>
                                <tbody>
                                    {names.map(name => (
                                        <tr key={name}>
                                            <td>{name}</td>
                                            <td className="r">
                                                <input
                                                    type="number" min={0} className="rlt-input" style={{ width: 110, textAlign: 'right' }}
                                                    placeholder="未設定" value={settings[key]?.[name] || ''}
                                                    onChange={e => setCost(key, name, e.target.value)} onBlur={() => persist(key)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head">
                    <h3>営業テンプレート（定型文）</h3>
                    <span className="rlt-note">差込キーワード：{'{{name}}'}=顧客名／{'{{staff}}'}=担当者／{'{{addr}}'}=物件所在地／{'{{property}}'}=問合せ物件／{'{{price}}'}=価格・予算／{'{{today}}'}=本日</span>
                </div>
                <div className="rlt-body">
                    {templates.map((t, i) => (
                        <div className="rlt-set-tpl" key={t.id || i}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input className="rlt-input" style={{ flex: 1 }} placeholder="テンプレート名" value={t.title}
                                    onChange={e => setTemplate(i, 'title', e.target.value)} onBlur={() => persist('templates')} />
                                <button className="rlt-icon" title="削除" onClick={() => removeTemplate(i)}><i className="fa-solid fa-trash"></i></button>
                            </div>
                            <textarea className="rlt-input" rows={5} value={t.body}
                                onChange={e => setTemplate(i, 'body', e.target.value)} onBlur={() => persist('templates')} />
                        </div>
                    ))}
                    {templates.length === 0 && <p className="rlt-sub">テンプレートが登録されていません</p>}
                    <button className="rlt-btn sec" onClick={addTemplate}>＋ テンプレートを追加</button>
                    <p className="rlt-sub" style={{ marginTop: 6 }}>※テンプレートはチーム全員で共有されます</p>
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>宅建業者情報（契約書の「乙」欄）</h3><span className="rlt-note">契約書の乙欄・記名押印欄に印字されます。チーム全員で共有されます</span></div>
                <div className="rlt-body rlt-set-grid">
                    {COMPANY_FIELDS.map(f => (
                        <div key={f.key} className={f.wide ? 'wide' : ''}>
                            <label>{f.label}</label>
                            <input className="rlt-input" placeholder={f.placeholder} value={company[f.key] ?? ''}
                                onChange={e => edit('company', { ...company, [f.key]: e.target.value })} onBlur={() => persist('company')} />
                        </div>
                    ))}
                </div>
            </div>

            <p className="rlt-sub">
                以前のアプリの「買取再販の粗利の計算方式・経費科目」「架電キュー」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、のちの版で移します。
            </p>
        </div>
    );
};

export default RealtySettings;
