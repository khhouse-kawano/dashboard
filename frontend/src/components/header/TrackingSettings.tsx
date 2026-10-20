import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 広告流入トラッキングの設定（v2.2.199 新規）。ヘッダー「反響管理 → トラッキング設定」（Master / BrandAdmin）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ サイトを登録すると site_key が発行され、各サイトに入れるタグ（tracker.js）を出す。
 * ⚠️ タグは2種類（v2.2.200〜）：GTM のカスタム HTML 用（gtmTag）と、フッターに直接貼る用（trackingTag）。
 *   ⚠️⚠️ GTM に trackingTag をそのまま入れると動かない。GTM は <script src> を作り直すときに data-site を捨て、
 *   tracker.js がサイトを見分けられず何もしない（2026-10-20 kh-house.jp で確認）。GTM 用は要素を自分で作って data-site を付ける。
 * ⚠️ ② は features/tracking/sites.ts（⚠️ 権限は ② でも確かめる。メニューから隠すだけでは閉じない）。
 * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
 * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
 * ─────────────────────────────────────────────
 */

export const TRACKER_URL = 'https://api.khg-marketing.info/t/v1/tracker.js';
export const trackingTag = (siteKey: string): string => `<script src="${TRACKER_URL}" data-site="${siteKey}" defer></script>`;
export const gtmTag = (siteKey: string): string => [
    '<script>',
    '(function () {',
    "  var s = document.createElement('script');",
    `  s.src = '${TRACKER_URL}';`,
    '  s.defer = true;',
    `  s.setAttribute('data-site', '${siteKey}');`,
    '  document.body.appendChild(s);',
    '})();',
    '</script>',
].join('\n');

type TagKind = 'gtm' | 'footer';
const TAG_KINDS: { kind: TagKind; label: string; make: (siteKey: string) => string }[] = [
    { kind: 'gtm', label: 'GTM 用：GTM（Googleタグマネージャー）のカスタム HTML に入れるタグ（トリガーは「All Pages」）', make: gtmTag },
    { kind: 'footer', label: 'フッター用：GTM を使わず、すべてのページのフッターに直接貼るタグ', make: trackingTag },
];

/** ブランドキー → 表示名（⚠️ ② の TRACKING_BRANDS と同じキー） */
const BRAND_LABEL: Record<string, string> = {
    kh: '国分ハウジング', djh: 'デイジャストハウス', nagomi: 'なごみ工務店', fh: 'フルコミホーム',
    '2l': 'ニーエルホーム', pg: 'PG HOUSE', jh: 'ジャスフィーホーム', khf: 'かえるホーム',
};

interface Site {
    id: number;
    siteKey: string;
    name: string;
    brand: string;
    origins: string[];
    active: boolean;
    memo: string;
    updatedBy: string;
    updatedAt: string;
    touches30d: number;
    lastTouch: string | null;
}

interface Draft {
    id: number | null;
    name: string;
    brand: string;
    origins: string;
    active: boolean;
    memo: string;
}

const emptyDraft: Draft = { id: null, name: '', brand: '', origins: '', active: true, memo: '' };

/** クリップボードへ。⚠️ 使えない環境では選択して Ctrl+C を促す */
const copyText = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};

const TrackingSettings: React.FC = () => {
    const [sites, setSites] = useState<Site[]>([]);
    const [brands, setBrands] = useState<string[]>(Object.keys(BRAND_LABEL));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [openTag, setOpenTag] = useState<number | null>(null);
    /** コピーした（`サイトID:種類`）。⚠️ 先頭が ! ならコピーに失敗した */
    const [copied, setCopied] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post('', { request: 'tracking_site_list' });
            setSites(response.data?.sites ?? []);
            if (Array.isArray(response.data?.brands)) setBrands(response.data.brands);
        } catch (e) {
            console.error('tracking_site_list failed:', e);
            setError('サイトの一覧を読み込めませんでした。管理者の権限が必要です。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const kpi = useMemo(() => ({
        total: sites.length,
        active: sites.filter((s) => s.active).length,
        touches: sites.reduce((sum, s) => sum + s.touches30d, 0),
    }), [sites]);

    const startEdit = (site: Site | null) => {
        setFormError('');
        setDraft(site === null ? { ...emptyDraft } : {
            id: site.id, name: site.name, brand: site.brand, origins: site.origins.join('\n'), active: site.active, memo: site.memo,
        });
    };

    const save = async () => {
        if (draft === null) return;
        setSaving(true);
        setFormError('');
        try {
            const response = await apiClient.post('', {
                request: 'tracking_site_save',
                id: draft.id ?? undefined,
                name: draft.name,
                brand: draft.brand,
                origins: draft.origins.split(/[\s,]+/).filter((o) => o !== ''),
                active: draft.active,
                memo: draft.memo,
            });
            const newId: number | undefined = response.data?.id;
            setDraft(null);
            await load();
            // ⚠️ 新しく登録したら、そのままタグを開いておく（貼る作業へ進めるように）
            if (draft.id === null && newId !== undefined) setOpenTag(newId);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
            setFormError(message ?? '保存できませんでした。もう一度お試しください。');
        } finally {
            setSaving(false);
        }
    };

    const copy = async (site: Site, kind: TagKind, text: string) => {
        const key = `${site.id}:${kind}`;
        if (await copyText(text)) {
            setCopied(key);
            window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
        } else {
            setCopied(`!${key}`);
        }
    };

    return (
        <div className="tk_wrap">
            <style>{CSS}</style>
            <div className="tk_inner">
                <div className="tk_head">
                    <span className="tk_title"><i className="fa-solid fa-route me-2 text-primary" aria-hidden="true" />トラッキング設定</span>
                    {/* ⚠️ 右端に置かないこと（⚠️ 右上はアクティブユーザーの枠＝ActiveUser.tsx が重なって押せない） */}
                    <button type="button" className="tk_btn is_primary" onClick={() => startEdit(null)}>サイトを登録</button>
                    <span className="tk_note">広告から来た人の流入情報と、訪問者ごとのID（顧客ID）を、各サイトのタグで記録します</span>
                </div>

                <div className="tk_kpi">
                    <div className="tk_kpi_card"><div className="tk_kpi_label">登録サイト</div><div className="tk_kpi_value">{kpi.total}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">有効</div><div className="tk_kpi_value">{kpi.active}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">直近30日の広告からの着地</div><div className="tk_kpi_value">{kpi.touches.toLocaleString()}</div></div>
                </div>

                <div className="tk_caution">
                    ※ タグは、サイトの<b>すべてのページ</b>で1回だけ動くように入れます。GTM を使っているサイトは「GTM 用」を、使っていないサイトは「フッター用」を使ってください（GTM にフッター用を入れても動きません）。<br />
                    ※ 「許可するオリジン」は、タグを貼るサイトの <b>https://ドメイン</b> です（例：https://kh-house.jp）。ここに無いドメインからの記録は保存しません。<br />
                    ※ 訪問者ごとのID（顧客ID）はブラウザに保存されます。リリース前に、プライバシーポリシーへ利用目的の記載が必要です。
                </div>

                {draft !== null && (
                    <div className="tk_form" role="group" aria-label={draft.id === null ? 'サイトを登録' : 'サイトを直す'}>
                        <div className="tk_form_title">{draft.id === null ? 'サイトを登録' : 'サイトを直す'}</div>
                        <label className="tk_field is_wide"><span className="tk_label">サイト名</span>
                            <input className="tk_input" value={draft.name} maxLength={255} placeholder="例：国分ハウジング（kh-house.jp）"
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                        </label>
                        <label className="tk_field"><span className="tk_label">ブランド</span>
                            <select className="tk_input" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })}>
                                <option value="">（なし）</option>
                                {brands.map((b) => <option key={b} value={b}>{BRAND_LABEL[b] ?? b}</option>)}
                            </select>
                        </label>
                        <label className="tk_field is_wide"><span className="tk_label">許可するオリジン（1行に1つ）</span>
                            <textarea className="tk_input" rows={2} value={draft.origins} placeholder={'https://kh-house.jp'}
                                onChange={(e) => setDraft({ ...draft, origins: e.target.value })} />
                        </label>
                        <label className="tk_field is_wide"><span className="tk_label">メモ（設置場所など）</span>
                            <input className="tk_input" value={draft.memo} maxLength={500} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
                        </label>
                        <label className="tk_check">
                            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                            有効（外すと記録を止めます）
                        </label>
                        <div className="tk_form_actions">
                            {formError !== '' && <span className="tk_error" role="alert">{formError}</span>}
                            <button type="button" className="tk_btn" onClick={() => setDraft(null)} disabled={saving}>やめる</button>
                            <button type="button" className="tk_btn is_primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存する'}</button>
                        </div>
                    </div>
                )}

                {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}

                <div className="tk_table_wrap">
                    <table className="tk_table">
                        <thead>
                            <tr>
                                <th className="tk_th">サイト名</th>
                                <th className="tk_th">ブランド</th>
                                <th className="tk_th">許可するオリジン</th>
                                <th className="tk_th">状態</th>
                                <th className="tk_th tk_num">直近30日の着地</th>
                                <th className="tk_th">最後の着地</th>
                                <th className="tk_th">更新</th>
                                <th className="tk_th"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="tk_td tk_empty" colSpan={8}>読み込み中…</td></tr>
                            ) : sites.length === 0 ? (
                                <tr><td className="tk_td tk_empty" colSpan={8}>まだサイトがありません。「サイトを登録」から始めてください。</td></tr>
                            ) : sites.map((s) => (
                                <React.Fragment key={s.id}>
                                    <tr className={`tk_row${s.active ? '' : ' is_off'}`}>
                                        <td className="tk_td"><div className="tk_name">{s.name}</div>{s.memo && <div className="tk_sub">{s.memo}</div>}</td>
                                        <td className="tk_td">{s.brand ? <span className="tk_tag">{BRAND_LABEL[s.brand] ?? s.brand}</span> : ''}</td>
                                        <td className="tk_td">{s.origins.map((o) => <div key={o} className="tk_origin">{o}</div>)}</td>
                                        <td className="tk_td"><span className={`tk_state${s.active ? ' is_on' : ''}`}>{s.active ? '有効' : '無効'}</span></td>
                                        <td className="tk_td tk_num">{s.touches30d.toLocaleString()}</td>
                                        <td className="tk_td tk_date">{s.lastTouch ?? '—'}</td>
                                        <td className="tk_td tk_date">{s.updatedAt}{s.updatedBy && <div className="tk_sub">{s.updatedBy}</div>}</td>
                                        <td className="tk_td tk_actions">
                                            <button type="button" className="tk_link" aria-expanded={openTag === s.id}
                                                onClick={() => setOpenTag(openTag === s.id ? null : s.id)}>タグ</button>
                                            <button type="button" className="tk_link" onClick={() => startEdit(s)}>直す</button>
                                        </td>
                                    </tr>
                                    {openTag === s.id && (
                                        <tr className="tk_detail">
                                            <td className="tk_td" colSpan={8}>
                                                {TAG_KINDS.map(({ kind, label, make }) => {
                                                    const key = `${s.id}:${kind}`;
                                                    const text = make(s.siteKey);
                                                    return (
                                                        <div key={kind} className="tk_tag_block">
                                                            <div className="tk_label">{label}</div>
                                                            <div className="tk_code_row">
                                                                <code className="tk_code" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{text}</code>
                                                                <button type="button" className="tk_btn is_primary" onClick={() => copy(s, kind, text)}>
                                                                    {copied === key ? 'コピーしました' : 'コピー'}
                                                                </button>
                                                            </div>
                                                            {copied === `!${key}` && <div className="tk_error">コピーできませんでした。タグを押して選び、Ctrl+C でコピーしてください。</div>}
                                                        </div>
                                                    );
                                                })}
                                                <div className="tk_sub">どちらか一方だけ入れてください（両方あると着地が2回記録されます）。サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/** ⚠️ GoogleReview.tsx と同じ配色・余白・角丸（接頭辞 tk_）。⚠️ 全画面で表だけ中でスクロールする */
const CSS = `
.tk_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column; padding: 16px 40px 20px; box-sizing: border-box; }
.tk_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; min-height: 0; flex: 1; }
.tk_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.tk_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.tk_note { font-size: 11px; color: #6b7280; }
.tk_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
.tk_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
.tk_kpi_label { font-size: 11px; color: #6b7280; }
.tk_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tk_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
.tk_form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
.tk_form_title { flex: 1 1 100%; font-weight: 700; font-size: 13px; }
.tk_field { display: flex; flex-direction: column; gap: 2px; margin: 0; }
.tk_field.is_wide { flex: 1 1 260px; }
.tk_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
.tk_input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; background: #fff; font-family: inherit; }
.tk_input:focus { outline: 2px solid #bfdbfe; border-color: #3b82f6; }
.tk_check { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding-bottom: 6px; margin: 0; }
.tk_form_actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.tk_btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: #374151; white-space: nowrap; }
.tk_btn:hover { background: #f8fafc; }
.tk_btn.is_primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.tk_btn.is_primary:hover { background: #1d4ed8; }
.tk_btn:disabled { opacity: .6; cursor: default; }
.tk_btn:focus-visible, .tk_link:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
.tk_error { font-size: 12px; color: #b91c1c; font-weight: 700; }
.tk_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; flex: 1 1 auto; min-height: 0; }
.tk_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.tk_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 9px 12px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.tk_td { border-bottom: 1px solid #f1f5f9; padding: 9px 12px; vertical-align: middle; }
.tk_row:hover > .tk_td { background: #f8fafc; }
.tk_row.is_off > .tk_td { color: #9ca3af; }
.tk_num { text-align: right; font-variant-numeric: tabular-nums; }
.tk_name { font-weight: 700; font-size: 13px; }
.tk_sub { font-size: 11px; color: #6b7280; }
.tk_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.tk_origin { font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
.tk_state { font-size: 10px; font-weight: 700; border-radius: 999px; padding: 2px 8px; background: #f3f4f6; color: #6b7280; white-space: nowrap; }
.tk_state.is_on { background: #ecfdf5; color: #047857; }
.tk_date { font-size: 11px; color: #4b5563; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tk_actions { white-space: nowrap; text-align: right; }
.tk_link { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer; background: none; border: none; padding: 2px 6px; }
.tk_link:hover { text-decoration: underline; }
.tk_detail > .tk_td { background: #fbfdff; padding: 10px 16px 14px; }
.tk_code_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0; }
.tk_code { flex: 1 1 480px; display: block; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #1f2937; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; word-break: break-all; cursor: text; }
.tk_tag_block + .tk_tag_block { margin-top: 10px; }
.tk_empty { color: #9ca3af; text-align: center; padding: 24px; }
`;

export default TrackingSettings;
