import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from '../../../context/AuthContext';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import { todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import { callsOnly, sameName } from '../callq/callqLogic';
import { openNavi, openNaviHistory } from './naviHost';

/**
 * 🧭 架電ナビ（一括査定）の起動用の一覧（不動産企画係。v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリの V18.paint。売り反響を選んでナビを始める。ナビ本体は naviEngine.js（全画面で重ねて出す）。
 * ⚠️ 並び順: 未架電 → 次回連絡予定日が今日以前 → その他（受信日の新しい順）。150件まで（以前のアプリと同じ）
 * ⚠️ ロープレ練習・練習の成績は移行中（2026-10-28 の利用者の判断）。ボタンは出すが押せない
 */

const STYLE = `
.rlt-nv-tbl td.c, .rlt-nv-tbl th.c { text-align: center; }
.rlt-nv-tbl td.trunc { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rlt-badge { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 10px; font-weight: bold; }
.rlt-badge.navy { background: #cfe2ff; color: #084298; } .rlt-badge.red { background: #f8d7da; color: #842029; }
.rlt-badge.gray { background: #e9ecef; color: #6c757d; }
`;

const OFF = ['媒介受託', '追客終了'];
const LIMIT = 150;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const fmtD = (ds: unknown): string => {
    const s = str(ds).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : (s || '―');
};

const CallNavi: React.FC = () => {
    const { userName } = useContext(AuthContext);
    const [leads, setLeads] = useState<Row[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [mine, setMine] = useState(true);
    const [q, setQ] = useState('');

    const load = useCallback(async () => {
        try {
            const rec = await loadRecords(['leads']);
            setLeads(rec.records.leads);
            setSettings(rec.settings as Record<string, unknown>);
        } catch (e) {
            alert(`読み込めませんでした: ${(e as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const me = useMemo(() => {
        const list = Array.isArray(settings.staff) ? settings.staff as { name?: string }[] : [];
        return list.find(s => s.name && sameName(s.name, userName || ''))?.name ?? (userName || '');
    }, [settings.staff, userName]);

    const t = todayStr();
    const list = useMemo(() => {
        let ls = leads.filter(l => !OFF.includes(str(l.phase)));
        if (mine && me) ls = ls.filter(l => sameName(str(l.staff), me));
        const rank = (l: Row) => {
            const n = callsOnly(l).length;
            const next = str(l.nextDate).slice(0, 10);
            return !n ? 0 : next && next <= t ? 1 : 2;
        };
        return ls.sort((a, b) => rank(a) - rank(b) || str(b.receivedDate).localeCompare(str(a.receivedDate)));
    }, [leads, mine, me, t]);

    const shown = useMemo(() => {
        const v = q.trim();
        const top = list.slice(0, LIMIT);
        return v ? top.filter(l => [l.name, l.addr, l.contact, l.source].map(str).join(' ').includes(v)) : top;
    }, [list, q]);

    const onSaved = (row: Row | null) => {
        if (row) setLeads(prev => prev.map(x => (str(x.id) === str(row.id) ? row : x)));
    };
    const start = (lead: Row | null) => openNavi({ lead, settings, me, onSaved });

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const pendingTitle = '移行中です。ロープレ練習は以前のアプリを使ってください';

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-compass me-2" style={{ color: '#0d6efd' }}></i>架電ナビ</h1>
                <p className="rlt-sub">一括査定反響への初回架電を、トークマニュアルの①〜⑨に沿って伴走します。売り反響を選んで開始してください。</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head" style={{ alignItems: 'center' }}>
                    <h3>売り反響（追客中 {list.length}件）</h3>
                    <span style={{ flex: 1 }}></span>
                    <label className="rlt-note" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> 自分の担当のみ{me ? `（${me}）` : ''}
                    </label>
                    <input className="rlt-input" placeholder="氏名・住所・電話で絞り込み" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
                    <button className="rlt-btn sec" onClick={() => start(null)}>反響を選ばずに開始</button>
                    <button className="rlt-btn sec" onClick={() => openNaviHistory({ settings, me })}>📊 通話履歴・分析</button>
                    <button className="rlt-btn sec" disabled title={pendingTitle}>🎧 ロープレ練習（移行中）</button>
                    <button className="rlt-btn sec" disabled title={pendingTitle}>🎧 練習の成績（移行中）</button>
                </div>
                <div className="rlt-tblwrap">
                    <table className="rlt-tbl rlt-nv-tbl">
                        <thead><tr>
                            <th>受信日</th><th>反響元</th><th>売主候補</th><th>フェーズ</th><th className="c">架電</th>
                            <th className="c">次回連絡</th><th>物件所在地</th><th>区分</th><th></th>
                        </tr></thead>
                        <tbody>
                            {shown.length === 0 && <tr><td colSpan={9} className="rlt-sub" style={{ textAlign: 'center', padding: 16 }}>追客中の売り反響はありません。</td></tr>}
                            {shown.map(l => {
                                const n = callsOnly(l).length;
                                const next = str(l.nextDate).slice(0, 10);
                                return (
                                    <tr key={str(l.id)}>
                                        <td>{fmtD(l.receivedDate)}</td>
                                        <td>{str(l.source)}</td>
                                        <td className="trunc"><b>{str(l.name)}</b></td>
                                        <td>{str(l.phase)}</td>
                                        <td className="c">{n || <span className="rlt-badge navy">初回</span>}</td>
                                        <td className="c">{next ? (next <= t ? <span className="rlt-badge red">{fmtD(next)}</span> : fmtD(next)) : '―'}</td>
                                        <td className="trunc" title={str(l.addr)}>{str(l.addr)}</td>
                                        <td>{str(l.category)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}><button className="rlt-btn sec" onClick={() => start(l)}>🧭 ナビで架電</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="rlt-sub" style={{ padding: '8px 16px' }}>
                    並び順：未架電 → 次回連絡予定日が今日以前 → その他（受信日の新しい順）。「記録して次へ」で架電記録・フェーズ・次回連絡予定日が更新され、📞今日の架電キューと週次行動計画の架電実績にも反映されます。
                    文字起こしの全文は売り反響には保存せず、通話記録にだけ保存します（通話記録は不動産企画係の全員が「通話履歴・分析」で見られます）。
                </p>
            </div>
        </div>
    );
};

export default CallNavi;
