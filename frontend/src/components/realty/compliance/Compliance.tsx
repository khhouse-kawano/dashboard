import React, { useEffect, useState } from 'react';
import { REALTY_CSS, loadRealtyState, saveCompliance } from '../common/realtyState';
import type { ComplianceItem } from '../common/realtyState';

/**
 * コンプライアンス・法令チェックリスト（不動産企画係。v2.2.223）。
 *
 * ⚠️ 移植元は本番アプリの「⚠️ コンプライアンス・法令チェックリスト」（renderComp）。
 *   1つの取引ごとに上から確かめ、終わったら「入力内容をクリア」で次の取引に使う。
 * ⚠️ チェック項目そのもの（文言・並び）は直せない（本番アプリにも画面が無い）。
 */

/** 状態の選択肢（本番アプリの COMP_STATES）。⚠️ ② の state.ts と同じ */
const COMP_STATES = ['', '✅完了', '⏳確認中', '❌未対応', '➖対象外'];

type EditableField = 'staff' | 'date' | 'status' | 'target' | 'note';

const Compliance: React.FC = () => {
    const [items, setItems] = useState<ComplianceItem[]>([]);
    const [staffNames, setStaffNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    // ⚠️ 物件・顧客名と備考は打っている途中の値を持ち、離れたときに保存する
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        loadRealtyState()
            .then(st => {
                setItems(st.compliance);
                setStaffNames((st.settings.staff ?? []).map(s => (s.name ?? '').trim()).filter(Boolean));
            })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const save = async (id: string, field: EditableField, value: string) => {
        const before = items;
        setItems(list => list.map(c => (c.id === id ? { ...c, [field]: value } : c)));
        try {
            setItems(await saveCompliance({ id, field, value }));
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
            setItems(before);
        }
    };

    const commitText = (c: ComplianceItem, field: 'target' | 'note') => {
        const k = `${c.id}:${field}`;
        if (!(k in drafts)) return;
        const value = drafts[k].trim();
        setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
        if (value !== (c[field] ?? '')) void save(c.id, field, value);
    };

    const reset = async () => {
        if (!window.confirm('担当者・確認日・状態・物件名・備考をすべてクリアしますか？')) return;
        try {
            setItems(await saveCompliance({ reset: true }));
            setDrafts({});
        } catch (e) {
            alert(`クリアできませんでした: ${(e as Error).message}`);
        }
    };

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const target = items.filter(c => c.status && c.status !== '➖対象外');
    const done = target.filter(c => c.status === '✅完了').length;
    const textInput = (c: ComplianceItem, field: 'target' | 'note', width: number) => {
        const k = `${c.id}:${field}`;
        return (
            <input className="rlt-input" style={{ width }} value={k in drafts ? drafts[k] : (c[field] ?? '')}
                onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))} onBlur={() => commitText(c, field)} />
        );
    };

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-list-check me-2" style={{ color: '#0d6efd' }}></i>コンプライアンス・法令チェックリスト</h1>
                <p className="rlt-sub">
                    完了率（対象外を除く）：<b>{done}/{target.length}件　{target.length ? `${((done / target.length) * 100).toFixed(1)}%` : '0%'}</b>
                </p>
            </div>
            <div className="rlt-card">
                <div className="rlt-tblwrap">
                    <table className="rlt-tbl">
                        <thead><tr>
                            <th>No.</th><th>チェック項目</th><th>担当者</th><th>確認日</th><th>状態</th><th>物件・顧客名</th><th>備考</th>
                        </tr></thead>
                        <tbody>
                            {items.map(c => (
                                <tr key={c.id}>
                                    <td>{c.no}</td>
                                    <td>{c.item}</td>
                                    <td>
                                        <select className="rlt-input" value={c.staff ?? ''} onChange={e => save(c.id, 'staff', e.target.value)}>
                                            <option value=""></option>
                                            {/* ⚠️ 設定から外れた担当者が入っていても消えないように選択肢に残す */}
                                            {[...staffNames, ...(c.staff && !staffNames.includes(c.staff) ? [c.staff] : [])].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </td>
                                    <td><input type="date" className="rlt-input" value={c.date ?? ''} onChange={e => save(c.id, 'date', e.target.value)} /></td>
                                    <td>
                                        <select className="rlt-input" value={c.status ?? ''} onChange={e => save(c.id, 'status', e.target.value)}>
                                            {COMP_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td>{textInput(c, 'target', 150)}</td>
                                    <td>{textInput(c, 'note', 170)}</td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan={7} className="rlt-sub">チェック項目がありません（以前のアプリから取り込むと表示されます）</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="rlt-body" style={{ paddingTop: 10 }}>
                    <button className="rlt-btn danger" onClick={reset} disabled={items.length === 0}>入力内容をクリア（次の取引用）</button>
                </div>
            </div>
        </div>
    );
};

export default Compliance;
