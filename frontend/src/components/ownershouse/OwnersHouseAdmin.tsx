import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../utils/apiClient';
import OwnersHouseEditModal from './OwnersHouseEditModal';
import type { AdminListResponse, OwnersHouse } from './types';
import { emptyHouse } from './types';

/**
 * オーナーズハウスの管理画面（左のメニュー「オーナーズハウス」。注文・PC のみ）。（v2.2.284）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 物件は ownershouse。サイト（kh-house.jp/owners_house/）は公開（flag = '1'）の物件だけを ② から読む。
 * ⚠️ 一覧はページ送りにせず、30件ずつ描く。表の一番下が見えたら（IntersectionObserver）次の30件を足す。
 *   ⚠️ 絞り込みを変えたら30件に戻す。
 * ⚠️ 行を押すと OwnersHouseEditModal で1件を直す（表の中では直さない）。
 * ─────────────────────────────────────────────
 */

const PAGE_SIZE = 30;

const OwnersHouseAdmin: React.FC = () => {
    const [data, setData] = useState<AdminListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [category, setCategory] = useState('');
    const [visibility, setVisibility] = useState('');
    const [pref, setPref] = useState('');
    const [keyword, setKeyword] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [editing, setEditing] = useState<OwnersHouse | null>(null);
    const sentinelRef = useRef<HTMLTableRowElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post<AdminListResponse>('', { request: 'owners_house_admin_list' });
            if (res.data?.status !== 'success') throw new Error(res.data?.message ?? 'error');
            setData(res.data);
        } catch (e) {
            console.error('[ownershouse] 読み込みに失敗しました', e);
            setError('物件を読み込めませんでした。時間をおいて開き直してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const houses = useMemo(() => data?.houses ?? [], [data]);
    const prefs = useMemo(() => [...new Set(houses.map(h => h.pref).filter(Boolean))], [houses]);

    const filtered = useMemo(() => {
        const k = keyword.trim();
        return houses.filter(h =>
            (category ? h.category === category : true)
            && (visibility === '' ? true : visibility === '1' ? h.flag === '1' : h.flag !== '1')
            && (pref ? h.pref === pref : true)
            && (k ? [h.id, h.title, h.name, h.area, h.shop, h.tag, h.staff].some(v => (v ?? '').includes(k)) : true));
    }, [houses, category, visibility, pref, keyword]);

    // 絞り込みを変えたら30件に戻し、表を一番上へ
    useEffect(() => {
        setLimit(PAGE_SIZE);
        scrollRef.current?.scrollTo({ top: 0 });
    }, [category, visibility, pref, keyword]);

    // 表の一番下（sentinel）が見えたら次の30件
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) setLimit(prev => Math.min(prev + PAGE_SIZE, filtered.length));
        }, { root: scrollRef.current, rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [filtered.length, limit]);

    const kpi = useMemo(() => ({
        total: houses.length,
        published: houses.filter(h => h.flag === '1').length,
        owners: houses.filter(h => h.category === 'オーナーズハウス').length,
        model: houses.filter(h => h.category === 'モデルハウス').length,
        noPin: houses.filter(h => !h.lat_and_long).length,
    }), [houses]);

    const shown = filtered.slice(0, limit);

    return (
        <div className="ohs_wrap">
            <style>{`
                .ohs_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column; padding: 16px 40px 20px; box-sizing: border-box; }
                .ohs_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; min-height: 0; flex: 1; gap: 10px; }
                .ohs_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ohs_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .ohs_note { font-size: 11px; color: #6b7280; }
                .ohs_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .ohs_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .ohs_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .ohs_kpi_card { flex: 1 1 140px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .ohs_kpi_label { font-size: 11px; color: #6b7280; }
                .ohs_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                /* ⚠️ 表の枠の高さを画面に収める。⚠️ 収めないと表が伸びきって続きの目印（sentinel）が常に見え、全件を一度に描いてしまう */
                .ohs_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; flex: 1 1 auto; min-height: 240px; max-height: calc(100vh - 290px); }
                .ohs_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .ohs_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 9px 12px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .ohs_td { border-bottom: 1px solid #f1f5f9; padding: 8px 12px; vertical-align: middle; }
                .ohs_row { cursor: pointer; }
                .ohs_row:hover > .ohs_td { background: #f0f7ff; }
                .ohs_thumb { width: 64px; height: 44px; object-fit: cover; border-radius: 6px; background: #f3f4f6; display: block; }
                .ohs_pill { font-size: 10px; border-radius: 999px; padding: 2px 8px; white-space: nowrap; font-weight: 700; }
                .ohs_pill_on { background: #dcfce7; color: #166534; }
                .ohs_pill_off { background: #f3f4f6; color: #6b7280; }
                .ohs_cat { font-size: 10px; border-radius: 999px; padding: 2px 8px; white-space: nowrap; background: #eff6ff; color: #1d4ed8; }
                .ohs_cat_model { background: #fef3c7; color: #92400e; }
                .ohs_warn { font-size: 10px; color: #b91c1c; }
                .ohs_sub { font-size: 11px; color: #6b7280; }
                .ohs_more { text-align: center; color: #9ca3af; font-size: 11px; padding: 10px; }
            `}</style>
            <div className="ohs_inner">
                <div className="ohs_head">
                    <span className="ohs_title"><i className="fa-solid fa-house-chimney me-2 text-primary" aria-hidden="true" />オーナーズハウス</span>
                    <span className="ohs_note">※ 公開の物件だけが kh-house.jp/owners_house/ に出ます。行を押すと内容と地図のピンを直せます</span>
                    <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setEditing(emptyHouse(''))} disabled={!data}>
                        <i className="fa-solid fa-plus me-1" aria-hidden="true" />物件を追加
                    </button>
                </div>

                <div className="ohs_kpi">
                    <div className="ohs_kpi_card"><div className="ohs_kpi_label">物件</div><div className="ohs_kpi_value">{kpi.total}</div></div>
                    <div className="ohs_kpi_card"><div className="ohs_kpi_label">公開中</div><div className="ohs_kpi_value">{kpi.published}</div></div>
                    <div className="ohs_kpi_card"><div className="ohs_kpi_label">オーナーズハウス</div><div className="ohs_kpi_value">{kpi.owners}</div></div>
                    <div className="ohs_kpi_card"><div className="ohs_kpi_label">モデルハウス</div><div className="ohs_kpi_value">{kpi.model}</div></div>
                    <div className="ohs_kpi_card"><div className="ohs_kpi_label">ピン未設定</div><div className="ohs_kpi_value">{kpi.noPin}</div></div>
                </div>

                <div className="ohs_bar">
                    <div>
                        <div className="ohs_label">種別</div>
                        <select className="form-select form-select-sm" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">すべて</option>
                            {(data?.categories ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="ohs_label">公開</div>
                        <select className="form-select form-select-sm" value={visibility} onChange={e => setVisibility(e.target.value)}>
                            <option value="">すべて</option>
                            <option value="1">公開中</option>
                            <option value="0">非公開</option>
                        </select>
                    </div>
                    <div>
                        <div className="ohs_label">都道府県</div>
                        <select className="form-select form-select-sm" value={pref} onChange={e => setPref(e.target.value)}>
                            <option value="">すべて</option>
                            {prefs.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 240px' }}>
                        <div className="ohs_label">キーワード</div>
                        <input className="form-control form-control-sm" placeholder="ID・見出し・所在地・店舗・タグ" value={keyword} onChange={e => setKeyword(e.target.value)} />
                    </div>
                    <span className="ohs_note ms-auto">{filtered.length} 件</span>
                </div>

                {error && <div className="alert alert-danger py-2 mb-0" style={{ fontSize: '12px' }}>{error}</div>}

                <div className="ohs_table_wrap" ref={scrollRef}>
                    {loading && !data ? <div className="p-3 text-muted">読み込み中…</div> : (
                        <table className="ohs_table">
                            <thead>
                                <tr>
                                    {['', 'ID', '公開', '種別', '見出し・所在地', 'エリア', '管理店舗', '間取り・構造', '更新'].map(h => <th className="ohs_th" key={h}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(h => (
                                    <tr className="ohs_row" key={h.no} onClick={() => setEditing(h)}>
                                        <td className="ohs_td">{h.img_1 ? <img className="ohs_thumb" src={h.img_1} alt="" loading="lazy" /> : <span className="ohs_thumb" />}</td>
                                        <td className="ohs_td" style={{ fontVariantNumeric: 'tabular-nums' }}>{h.id}</td>
                                        <td className="ohs_td"><span className={`ohs_pill ${h.flag === '1' ? 'ohs_pill_on' : 'ohs_pill_off'}`}>{h.flag === '1' ? '公開' : '非公開'}</span></td>
                                        <td className="ohs_td"><span className={`ohs_cat${h.category === 'モデルハウス' ? ' ohs_cat_model' : ''}`}>{h.category}</span></td>
                                        <td className="ohs_td">
                                            <div style={{ fontWeight: 700 }}>{h.title || '（見出しなし）'}</div>
                                            <div className="ohs_sub">{h.name}</div>
                                            {!h.lat_and_long && <div className="ohs_warn"><i className="fa-solid fa-location-dot me-1" />ピン未設定</div>}
                                        </td>
                                        <td className="ohs_td">{h.pref} {h.area}{!h.lg_code && h.area && <div className="ohs_sub">コードなし</div>}</td>
                                        <td className="ohs_td">{h.shop}<div className="ohs_sub">{h.brand}</div></td>
                                        <td className="ohs_td">{[h.plan, h.structure, h.large].filter(v => v && v !== '-').join('・')}</td>
                                        <td className="ohs_td ohs_sub">{h.updated_at ? <>{h.updated_at.slice(0, 10)}<br />{h.updated_by}</> : '—'}</td>
                                    </tr>
                                ))}
                                {limit < filtered.length && <tr ref={sentinelRef}><td className="ohs_more" colSpan={9}>続きを読み込み中…</td></tr>}
                                {filtered.length === 0 && !loading && <tr><td className="ohs_more" colSpan={9}>該当する物件がありません</td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {editing && data && (
                <OwnersHouseEditModal house={editing} shops={data.shops} codes={data.codes} categories={data.categories} brands={data.brands}
                    onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
            )}
        </div>
    );
};

export default OwnersHouseAdmin;
