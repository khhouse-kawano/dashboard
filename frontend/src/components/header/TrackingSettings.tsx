import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import TrackingDetail, { type DetailAxis } from './TrackingDetail';
import TrackingVendorFunnel from './TrackingVendorFunnel';

/**
 * アクセス解析（v2.2.199 新規「トラッキング設定」→ v2.2.203 で「アクセス解析」に改名）。ヘッダー「反響管理 → アクセス解析」（Master / BrandAdmin）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ サイトを登録すると site_key が発行され、各サイトに入れるタグ（tracker.js）を出す。
 * ⚠️ タグは2種類（v2.2.200〜）：GTM のカスタム HTML 用（gtmTag）と、フッターに直接貼る用（trackingTag）。
 *   ⚠️⚠️ GTM に trackingTag をそのまま入れると動かない。GTM は <script src> を作り直すときに data-site を捨て、
 *   tracker.js がサイトを見分けられず何もしない（2026-10-20 kh-house.jp で確認）。GTM 用は要素を自分で作って data-site を付ける。
 * ⚠️ ② は features/tracking/sites.ts（⚠️ 権限は ② でも確かめる。メニューから隠すだけでは閉じない）。
 * ⚠️ v2.2.202 サイト名を押すと、その行の下にサマリー（SiteSummary）が開く。⚠️ 開閉はサイトごと（ほかのサイトと連動しない）。
 *   ⚠️ サマリーは開いたときに取りに行く（tracking_site_summary。② は features/tracking/summary.ts）。⚠️「再読み込み」で一覧と開いているサマリーを取り直す。
 *   ⚠️ CV の数え方は ② の features/tracking/conversions.ts（直近30日の反響の khg_vid が、問い合わせの日までにそのサイトに来ていたもの）。
 * ⚠️ v2.2.205 自社のフォームでないサイト（かえるホーム）は、CV 用のタグ（cv.js。cvGtmTag）も出す。② が cvForm を返すサイトだけ。
 *   ⚠️ cv.js は「確認画面へ」でメール・電話のハッシュを送り、② が反響と突き合わせる（features/tracking/cvMatch.ts）。
 *   ⚠️ 一覧の CV の下に「フォーム送信 n件（結びつき m件）」。送っているのに結びつかないなら、フォームの入力欄の名前が変わったなど。
 * ⚠️ v2.2.203 サマリーの着地ページ・流入元を押すと、詳細のモーダル（TrackingDetail.tsx）が開く。着地ページは右のアイコンでそのページを開く。
 *   ⚠️ 上の「Meta から取り込む」は ② の meta_ads_import（待たずに返る。終わったかは「最後の取り込み」で見る）。⚠️ ② は6時間ごとにも自動で取り込む。
 * ⚠️ v2.2.232 サマリーの表の上に帯グラフ（PV・CV の割合）。流入元タブでは「業者別」（PURE GROWTH・Bander。② の vendors.ts）も出し、
 *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。
 * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
 * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
 * ─────────────────────────────────────────────
 */

export const TRACKER_URL = 'https://api.khg-marketing.info/t/v1/tracker.js';
export const trackingTag = (siteKey: string): string => `<script src="${TRACKER_URL}" data-site="${siteKey}" defer></script>`;
/** GTM 用。⚠️ src を差し替えて CV 用（cv.js）にも使う */
const gtmScriptTag = (src: string, siteKey: string): string => [
    '<script>',
    '(function () {',
    "  var s = document.createElement('script');",
    `  s.src = '${src}';`,
    '  s.defer = true;',
    `  s.setAttribute('data-site', '${siteKey}');`,
    '  document.body.appendChild(s);',
    '})();',
    '</script>',
].join('\n');
export const gtmTag = (siteKey: string): string => gtmScriptTag(TRACKER_URL, siteKey);
/** v2.2.205 自社のフォームでないサイトの CV 用（tracker.js と一緒に、GTM の All Pages で入れる） */
export const CV_URL = 'https://api.khg-marketing.info/t/v1/cv.js';
export const cvGtmTag = (siteKey: string): string => gtmScriptTag(CV_URL, siteKey);

type TagKind = 'gtm' | 'footer' | 'cv';
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
    cv30d: number;
    /** v2.2.205 CV 用のタグ（cv.js）の直近30日の送信・反響に結びついた件数。⚠️ CV 用のタグを使わないブランドは null */
    cvForm: { sent: number; matched: number } | null;
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

interface SummaryRow {
    key: string;
    visits: number;
    ad: number;
    cv: number;
}

/** v2.2.232 業者別（utm_campaign の末尾 _pt1・_pt2。② の vendors.ts）。⚠️ 業者の付いていない分は来ない */
interface VendorRow {
    key: string;
    /** utm_campaign の末尾（例 _pt1） */
    suffix: string;
    name: string;
    visits: number;
    cv: number;
}

interface Summary {
    days: number;
    kpi: { visits: number; ad: number; cv: number };
    landing: SummaryRow[];
    source: SummaryRow[];
    vendors: VendorRow[];
}

type SummaryTab = 'landing' | 'source';
type SummarySortKey = 'key' | 'visits' | 'ad' | 'cv' | 'rate';
/** 帯グラフの切り替え（v2.2.232）。⚠️ 業者別は流入元タブだけ */
type BandMode = 'visits' | 'cv' | 'vendor';
/** 帯グラフに出す件数。⚠️ これより後ろは「その他」にまとめる */
const BAND_TOP = 8;
const BAND_COLORS = ['#2563eb', '#f97316', '#10b981', '#a855f7', '#eab308', '#06b6d4', '#ef4444', '#ec4899'];
const BAND_REST_COLOR = '#cbd5e1';

interface BandItem {
    label: string;
    value: number;
    color: string;
    /** 押すと開く（業者の社名） */
    onClick?: () => void;
}

/** 100% の帯グラフ（v2.2.232）。⚠️ 0件の項目は帯に出さないが、凡例には出す */
const BandChart: React.FC<{ title: string; items: BandItem[] }> = ({ title, items }) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    const share = (v: number): string => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—');
    return (
        <div className="tk_band_block">
            <div className="tk_band_title">{title}<span className="tk_sub">（計 {total.toLocaleString()}）</span></div>
            <div className="tk_band" role="img" aria-label={`${title}の割合`}>
                {/* ⚠️ key に番号を付ける（http と https の着地ページは同じ表示になる） */}
                {total === 0 ? <div className="tk_band_empty">記録がありません</div> : items.map((i, n) => i.value > 0 && (
                    <div key={`${n}-${i.label}`} className="tk_band_seg" style={{ width: `${(i.value / total) * 100}%`, background: i.color }} title={`${i.label}　${i.value.toLocaleString()}（${share(i.value)}）`} />
                ))}
            </div>
            <div className="tk_band_legend">
                {items.map((i, n) => (
                    <span key={`${n}-${i.label}`} className="tk_band_item" title={i.label}>
                        <span className="tk_band_swatch" style={{ background: i.color }} />
                        {i.onClick ? <button type="button" className="tk_key_btn tk_band_name" onClick={i.onClick}>{i.label}</button> : <span className="tk_band_name">{i.label}</span>}
                        <span className="tk_band_num">{i.value.toLocaleString()}（{share(i.value)}）</span>
                    </span>
                ))}
            </div>
        </div>
    );
};

const rateOf = (cv: number, visits: number): number | null => (visits > 0 ? (cv / visits) * 100 : null);
const formatRate = (rate: number | null): string => (rate === null ? '—' : `${rate.toFixed(1)}%`);

/** 着地ページは % エンコードのまま記録されているので、読める形にして出す（⚠️ 壊れた % なら記録のまま） */
const readableUrl = (url: string): string => {
    if (url === '') return '（不明）';
    try {
        return decodeURI(url.replace(/^https?:\/\//, ''));
    } catch {
        return url.replace(/^https?:\/\//, '');
    }
};

/**
 * サイト1つのサマリー（v2.2.202）。⚠️ サイトの行の下に、表と同じ幅で開く。
 * ⚠️ タブ（着地ページ／流入元）と並べ替えはサイトごとに持つ（ほかのサイトと連動しない）。
 * ⚠️ 表記は「PV」（2026-10-20 の指示）。⚠️ 中身は ② の訪問数（30分以内のページの移動はまとめて1件）で、ページが見られた回数より少ない。
 * ⚠️ reloadKey が変わったら取り直す（親の「再読み込み」）。
 */
const SiteSummary: React.FC<{ siteId: number; siteName: string; reloadKey: number }> = ({ siteId, siteName, reloadKey }) => {
    const [data, setData] = useState<Summary | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<SummaryTab>('landing');
    const [sortKey, setSortKey] = useState<SummarySortKey>('visits');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    /** 詳細を開いている着地ページ・流入元（v2.2.203） */
    const [detail, setDetail] = useState<{ axis: DetailAxis; value: string } | null>(null);
    const [bandMode, setBandMode] = useState<BandMode>('visits');
    /** 歩留まりを開いている業者（v2.2.232） */
    const [vendor, setVendor] = useState<VendorRow | null>(null);
    // ⚠️ 業者別は流入元タブだけ。着地ページに切り替えたら PV に戻して見せる
    const mode: BandMode = bandMode === 'vendor' && tab !== 'source' ? 'visits' : bandMode;

    useEffect(() => {
        let alive = true;
        setError('');
        apiClient.post('', { request: 'tracking_site_summary', site_id: siteId })
            .then((response) => { if (alive) setData(response.data as Summary); })
            .catch((e) => {
                console.error('tracking_site_summary failed:', e);
                if (alive) setError('サマリーを読み込めませんでした。「再読み込み」を押してください。');
            });
        return () => { alive = false; };
    }, [siteId, reloadKey]);

    const rows = useMemo(() => {
        const list = data === null ? [] : [...data[tab]];
        const dir = sortOrder === 'asc' ? 1 : -1;
        const value = (r: SummaryRow): number | string => (sortKey === 'key' ? r.key : sortKey === 'rate' ? rateOf(r.cv, r.visits) ?? -1 : r[sortKey]);
        return list.sort((a, b) => {
            const x = value(a), y = value(b);
            return (typeof x === 'string' ? x.localeCompare(String(y), 'ja') : x - Number(y)) * dir;
        });
    }, [data, tab, sortKey, sortOrder]);

    /** 帯グラフの項目（PV・CV）。⚠️ 表の並べ替えに関係なく多い順。上位 BAND_TOP 件と「その他」 */
    const bandItems = useMemo((): BandItem[] => {
        if (data === null || mode === 'vendor') return [];
        const metric = mode;
        const list = data[tab].filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric]);
        const items: BandItem[] = list.slice(0, BAND_TOP).map((r, i) => ({
            label: tab === 'landing' ? readableUrl(r.key) : r.key || '（不明）', value: r[metric], color: BAND_COLORS[i],
        }));
        const rest = list.slice(BAND_TOP).reduce((s, r) => s + r[metric], 0);
        if (rest > 0) items.push({ label: `その他（${list.length - BAND_TOP}件）`, value: rest, color: BAND_REST_COLOR });
        return items;
    }, [data, tab, mode]);

    if (error !== '') return <div className="tk_error">{error}</div>;
    if (data === null) return <div className="tk_sub">読み込み中…</div>;

    // ⚠️ 業者別の分母は _pt1・_pt2 の付いた分だけ（それ以外は ② が返さない）
    const vendorItems = (metric: 'visits' | 'cv'): BandItem[] => data.vendors.map((v, i) => ({
        label: v.name, value: v[metric], color: BAND_COLORS[i], onClick: () => setVendor(v),
    }));

    const SortHead = ({ label, keyName, num = true }: { label: string; keyName: SummarySortKey; num?: boolean }) => {
        const active = sortKey === keyName;
        return (
            <th className={`tk_th tk_th_sort${num ? ' tk_num' : ''}`} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}>
                {label}
                <span className={`tk_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    return (
        <div className="tk_sum">
            <div className="tk_sum_kpi">
                <div className="tk_sum_card"><div className="tk_kpi_label">PV（直近{data.days}日）</div><div className="tk_sum_value">{data.kpi.visits.toLocaleString()}</div></div>
                <div className="tk_sum_card"><div className="tk_kpi_label">うち広告から</div><div className="tk_sum_value">{data.kpi.ad.toLocaleString()}</div></div>
                <div className="tk_sum_card"><div className="tk_kpi_label">CV（直近{data.days}日の反響）</div><div className="tk_sum_value">{data.kpi.cv.toLocaleString()}</div></div>
                <div className="tk_sum_card"><div className="tk_kpi_label">CV率</div><div className="tk_sum_value">{formatRate(rateOf(data.kpi.cv, data.kpi.visits))}</div></div>
            </div>
            <div className="tk_tabs" role="tablist" aria-label="集計の軸">
                {([['landing', '着地ページ'], ['source', '流入元']] as [SummaryTab, string][]).map(([key, label]) => (
                    <button key={key} type="button" role="tab" aria-selected={tab === key}
                        className={`tk_tab${tab === key ? ' is_active' : ''}`} onClick={() => setTab(key)}>{label}</button>
                ))}
                <span className="tk_sub">CV は、問い合わせの日までの最後の訪問の{tab === 'landing' ? '着地ページ' : '流入元'}で数えます</span>
            </div>
            <div className="tk_band_wrap">
                <div className="tk_band_switch" role="group" aria-label="帯グラフの切り替え">
                    {([['visits', 'PV'], ['cv', 'CV'], ...(tab === 'source' ? [['vendor', '業者別']] : [])] as [BandMode, string][]).map(([key, label]) => (
                        <button key={key} type="button" aria-pressed={mode === key}
                            className={`tk_tab${mode === key ? ' is_active' : ''}`} onClick={() => setBandMode(key)}>{label}</button>
                    ))}
                    {mode === 'vendor' && (
                        <span className="tk_sub">
                            utm_campaign の末尾が{data.vendors.map((v) => ` ${v.suffix} なら ${v.name}`).join('、')}。社名を押すと店舗別の歩留まりが開きます
                        </span>
                    )}
                </div>
                {mode === 'vendor' ? (
                    <>
                        <BandChart title="PV" items={vendorItems('visits')} />
                        <BandChart title="CV" items={vendorItems('cv')} />
                    </>
                ) : <BandChart title={mode === 'visits' ? 'PV' : 'CV'} items={bandItems} />}
            </div>
            <div className="tk_sum_table_wrap">
                <table className="tk_table">
                    <thead>
                        <tr>
                            <SortHead label={tab === 'landing' ? '着地ページ' : '流入元'} keyName="key" num={false} />
                            <SortHead label="PV" keyName="visits" />
                            <SortHead label="うち広告" keyName="ad" />
                            <SortHead label="CV" keyName="cv" />
                            <SortHead label="CV率" keyName="rate" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td className="tk_td tk_empty" colSpan={5}>直近{data.days}日の PV はまだありません。</td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.key} className="tk_row">
                                <td className="tk_td tk_sum_key" title={r.key}>
                                    {/* ⚠️ v2.2.203 文字を押すと詳細（TrackingDetail）が開く。着地ページは右のアイコンでそのページを別のタブで開く（⚠️ http(s) の URL だけ） */}
                                    <button type="button" className="tk_key_btn" onClick={() => setDetail({ axis: tab, value: r.key })}>
                                        {tab === 'landing' ? readableUrl(r.key) : r.key || '（不明）'}
                                    </button>
                                    {tab === 'landing' && /^https?:\/\//.test(r.key) && (
                                        <a className="tk_url_icon" href={r.key} target="_blank" rel="noopener noreferrer" title="このページを開く" aria-label="このページを別のタブで開く">
                                            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                        </a>
                                    )}
                                </td>
                                <td className="tk_td tk_num">{r.visits.toLocaleString()}</td>
                                <td className="tk_td tk_num">{r.ad.toLocaleString()}</td>
                                <td className="tk_td tk_num">{r.cv > 0 ? <b>{r.cv.toLocaleString()}</b> : 0}</td>
                                <td className="tk_td tk_num">{formatRate(rateOf(r.cv, r.visits))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {detail !== null && <TrackingDetail siteId={siteId} axis={detail.axis} value={detail.value} onClose={() => setDetail(null)} />}
            {vendor !== null && <TrackingVendorFunnel siteId={siteId} siteName={siteName} vendor={vendor} onClose={() => setVendor(null)} />}
        </div>
    );
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
    /** サマリーを開いているサイト（⚠️ サイトごとに開閉。ほかのサイトと連動しない） */
    const [openSummary, setOpenSummary] = useState<Set<number>>(new Set());
    const [reloadKey, setReloadKey] = useState(0);
    /** Meta 広告の取り込みの状態（v2.2.203） */
    const [meta, setMeta] = useState<{ configured: boolean; lastImportedAt: string | null }>({ configured: false, lastImportedAt: null });
    const [importMessage, setImportMessage] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post('', { request: 'tracking_site_list' });
            setSites(response.data?.sites ?? []);
            if (Array.isArray(response.data?.brands)) setBrands(response.data.brands);
            if (response.data?.meta) setMeta(response.data.meta);
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
        cv: sites.reduce((sum, s) => sum + s.cv30d, 0),
    }), [sites]);

    const importMeta = async () => {
        setImportMessage('');
        try {
            await apiClient.post('', { request: 'meta_ads_import' });
            setImportMessage('取り込みを始めました。数分かかります。少し待ってから「再読み込み」を押してください。');
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
            setImportMessage(message ?? '取り込みを始められませんでした。');
        }
    };

    const reload = () => {
        load();
        setReloadKey((k) => k + 1);
    };

    const toggleSummary = (id: number) => setOpenSummary((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

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
                    <span className="tk_title"><i className="fa-solid fa-route me-2 text-primary" aria-hidden="true" />アクセス解析</span>
                    {/* ⚠️ 右端に置かないこと（⚠️ 右上はアクティブユーザーの枠＝ActiveUser.tsx が重なって押せない） */}
                    <button type="button" className="tk_btn is_primary" onClick={() => startEdit(null)}>サイトを登録</button>
                    <button type="button" className="tk_btn" onClick={reload} disabled={loading}>
                        <i className="fa-solid fa-rotate-right me-1" aria-hidden="true" />{loading ? '読み込み中…' : '再読み込み'}
                    </button>
                    <span className="tk_note">広告から来た人の流入情報と、訪問者ごとのID（顧客ID）を、各サイトのタグで記録します</span>
                </div>
                {meta.configured && (
                    <div className="tk_meta">
                        <i className="fa-brands fa-meta me-1 text-primary" aria-hidden="true" />Meta 広告：最後の取り込み <b>{meta.lastImportedAt ?? 'まだありません'}</b>（6時間ごとに自動で取り込みます）
                        <button type="button" className="tk_btn" onClick={importMeta}>Meta から取り込む</button>
                        {importMessage !== '' && <span className="tk_sub">{importMessage}</span>}
                    </div>
                )}

                <div className="tk_kpi">
                    <div className="tk_kpi_card"><div className="tk_kpi_label">登録サイト</div><div className="tk_kpi_value">{kpi.total}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">有効</div><div className="tk_kpi_value">{kpi.active}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">直近30日の広告からの着地</div><div className="tk_kpi_value">{kpi.touches.toLocaleString()}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">直近30日のCV</div><div className="tk_kpi_value">{kpi.cv.toLocaleString()}</div></div>
                </div>

                <div className="tk_caution">
                    ※ タグは、サイトの<b>すべてのページ</b>で1回だけ動くように入れます。GTM を使っているサイトは「GTM 用」を、使っていないサイトは「フッター用」を使ってください（GTM にフッター用を入れても動きません）。<br />
                    ※ 「許可するオリジン」は、タグを貼るサイトの <b>https://ドメイン</b> です（例：https://kh-house.jp）。ここに無いドメインからの記録は保存しません。<br />
                    ※ サイト名を押すと、そのサイトの着地ページ別・流入元別の PV（広告以外も含む。30分以内のページの移動はまとめて1件）と CV が開きます。CV は、直近30日の反響のうち、問い合わせの日までにそのサイトに来ていた人の数です。サマリーの着地ページ・流入元を押すと、日別・端末・広告別などの詳細が開きます。<br />
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
                                <th className="tk_th tk_num">直近30日のCV</th>
                                <th className="tk_th">最後の着地</th>
                                <th className="tk_th">更新</th>
                                <th className="tk_th"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ⚠️ 再読み込みのときは表を消さない（開いているサマリーのタブ・並べ替えを残す） */}
                            {loading && sites.length === 0 ? (
                                <tr><td className="tk_td tk_empty" colSpan={9}>読み込み中…</td></tr>
                            ) : sites.length === 0 ? (
                                <tr><td className="tk_td tk_empty" colSpan={9}>まだサイトがありません。「サイトを登録」から始めてください。</td></tr>
                            ) : sites.map((s) => (
                                <React.Fragment key={s.id}>
                                    <tr className={`tk_row${s.active ? '' : ' is_off'}`}>
                                        <td className="tk_td">
                                            <button type="button" className="tk_name_btn" aria-expanded={openSummary.has(s.id)} onClick={() => toggleSummary(s.id)}
                                                title={openSummary.has(s.id) ? 'サマリーを閉じる' : 'サマリーを開く'}>
                                                <i className={`fa-solid fa-chevron-${openSummary.has(s.id) ? 'down' : 'right'} tk_chev`} aria-hidden="true" />{s.name}
                                            </button>
                                            {s.memo && <div className="tk_sub">{s.memo}</div>}
                                        </td>
                                        <td className="tk_td">{s.brand ? <span className="tk_tag">{BRAND_LABEL[s.brand] ?? s.brand}</span> : ''}</td>
                                        <td className="tk_td">{s.origins.map((o) => <div key={o} className="tk_origin">{o}</div>)}</td>
                                        <td className="tk_td"><span className={`tk_state${s.active ? ' is_on' : ''}`}>{s.active ? '有効' : '無効'}</span></td>
                                        <td className="tk_td tk_num">{s.touches30d.toLocaleString()}</td>
                                        <td className="tk_td tk_num">
                                            {s.cv30d.toLocaleString()}
                                            {s.cvForm && <div className="tk_sub">フォーム送信 {s.cvForm.sent.toLocaleString()}件（結びつき {s.cvForm.matched.toLocaleString()}件）</div>}
                                        </td>
                                        <td className="tk_td tk_date">{s.lastTouch ?? '—'}</td>
                                        <td className="tk_td tk_date">{s.updatedAt}{s.updatedBy && <div className="tk_sub">{s.updatedBy}</div>}</td>
                                        <td className="tk_td tk_actions">
                                            <button type="button" className="tk_link" aria-expanded={openTag === s.id}
                                                onClick={() => setOpenTag(openTag === s.id ? null : s.id)}>タグ</button>
                                            <button type="button" className="tk_link" onClick={() => startEdit(s)}>直す</button>
                                        </td>
                                    </tr>
                                    {openSummary.has(s.id) && (
                                        <tr className="tk_summary">
                                            <td className="tk_td" colSpan={9}><SiteSummary siteId={s.id} siteName={s.name} reloadKey={reloadKey} /></td>
                                        </tr>
                                    )}
                                    {openTag === s.id && (
                                        <tr className="tk_detail">
                                            <td className="tk_td" colSpan={9}>
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
                                                {s.cvForm && (() => {
                                                    const key = `${s.id}:cv`;
                                                    const text = cvGtmTag(s.siteKey);
                                                    return (
                                                        <div className="tk_tag_block">
                                                            <div className="tk_label">CV 用：自社のフォームでないサイトの問い合わせを反響と結びつけるタグ（GTM のカスタム HTML・トリガーは「All Pages」。上の GTM 用と一緒に入れる）</div>
                                                            <div className="tk_code_row">
                                                                <code className="tk_code" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{text}</code>
                                                                <button type="button" className="tk_btn is_primary" onClick={() => copy(s, 'cv', text)}>
                                                                    {copied === key ? 'コピーしました' : 'コピー'}
                                                                </button>
                                                            </div>
                                                            {copied === `!${key}` && <div className="tk_error">コピーできませんでした。タグを押して選び、Ctrl+C でコピーしてください。</div>}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="tk_sub">GTM 用とフッター用は、どちらか一方だけ入れてください（両方あると着地が2回記録されます）。サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
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
.tk_name_btn { font-weight: 700; font-size: 13px; color: #1d4ed8; background: none; border: none; padding: 0; cursor: pointer; text-align: left; display: inline-flex; align-items: center; gap: 6px; }
.tk_name_btn:hover { text-decoration: underline; }
.tk_name_btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; border-radius: 4px; }
.tk_chev { font-size: 10px; color: #64748b; width: 10px; }
.tk_summary > .tk_td { background: #f8fafc; padding: 12px 16px 16px; }
.tk_sum { display: flex; flex-direction: column; gap: 10px; }
.tk_sum_kpi { display: flex; gap: 8px; flex-wrap: wrap; }
.tk_sum_card { flex: 1 1 140px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; }
.tk_sum_value { font-size: 17px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tk_tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tk_tab { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: 4px 14px; font-size: 12px; font-weight: 700; color: #4b5563; cursor: pointer; }
.tk_tab:hover { background: #eef2f7; }
.tk_tab.is_active { background: #2563eb; border-color: #2563eb; color: #fff; }
.tk_tab:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
.tk_band_wrap { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.tk_band_switch { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tk_band_block { display: flex; flex-direction: column; gap: 4px; }
.tk_band_title { font-size: 11px; font-weight: 700; color: #4b5563; }
.tk_band { display: flex; height: 22px; border-radius: 6px; overflow: hidden; background: #f3f4f6; }
.tk_band_seg { height: 100%; min-width: 2px; }
.tk_band_seg + .tk_band_seg { border-left: 1px solid #fff; }
.tk_band_empty { font-size: 11px; color: #9ca3af; line-height: 22px; padding: 0 8px; }
.tk_band_legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: #374151; }
.tk_band_item { display: inline-flex; align-items: center; gap: 5px; max-width: 360px; min-width: 0; }
.tk_band_swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.tk_band_name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.tk_band_num { color: #6b7280; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tk_sum_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 360px; }
.tk_th_sort { cursor: pointer; user-select: none; }
.tk_th_sort:hover { background: #eef2f7; }
.tk_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
.tk_sort_icon.is_active { color: #2563eb; }
.tk_sum_key { max-width: 560px; word-break: break-all; font-size: 12px; }
.tk_key_btn { color: #1d4ed8; background: none; border: none; padding: 0; text-align: left; cursor: pointer; font-size: 12px; word-break: break-all; }
.tk_key_btn:hover { text-decoration: underline; }
.tk_key_btn:focus-visible, .tk_url_icon:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; border-radius: 3px; }
.tk_url_icon { font-size: 10px; margin-left: 6px; color: #64748b; text-decoration: none; }
.tk_url_icon:hover { color: #1d4ed8; }
.tk_meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #374151; }
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
