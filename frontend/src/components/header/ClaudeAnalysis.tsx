import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import AuthContext from '../../context/AuthContext';
import { CLAUDE_ORANGE } from './ClaudeIcon';
import apiClient from '../../utils/apiClient';
import ClaudeAnalysisResult from './ClaudeAnalysisResult';
import ClaudeAnalysisPrint from './ClaudeAnalysisPrint';
import type { AnySnapshot, AnalysisKind, StructuredAnalysis } from './ClaudeAnalysisResult';

/**
 * Claude による分析メニュー。
 *
 * 分析は1回あたり40〜60秒かかり、実行のたびに課金が発生する。
 * そのため「実行中はボタンを押せない」「経過時間を表示する」ことを必須としている。
 *
 * 結果はサーバー側で kpi_analysis_history に保存され、
 * 「保存済みの分析」から課金なしで復元できる。
 */

export type AnalysisType =
    | 'inquiry_trend'
    | 'competitor'
    | 'brand'
    | 'shop'
    | 'medium'
    | 'custom';

type MenuItem = {
    type: AnalysisType;
    label: string;
    description: string;
    icon: string;
};

/**
 * 分析対象の部門。
 * サーバー側は受け取った値をホワイトリストで解決するため、
 * ここの値と backend/src/core/kpi.php の KPI_DIVISIONS のキーを一致させること。
 *
 * shopDivision は shop_list.division の値。課・店舗の絞り込みで突き合わせる。
 */
export type Division = 'order' | 'kaeru';

const DIVISIONS: { value: Division; label: string; shopDivision: string }[] = [
    { value: 'order', label: '注文事業',     shopDivision: '注文事業' },
    { value: 'kaeru', label: '建売分譲事業', shopDivision: '建売分譲事業' },
];

const MENUS: MenuItem[] = [
    { type: 'inquiry_trend', label: '反響推移を分析', description: '月別の反響数と媒体構成の変化', icon: 'fa-chart-line' },
    { type: 'competitor', label: '他社動向を分析', description: '競合の出現状況と失注理由', icon: 'fa-users-viewfinder' },
    { type: 'brand', label: 'ブランド別サマリー', description: 'KH / DJH / JH などブランド単位', icon: 'fa-layer-group' },
    { type: 'shop', label: '店舗別サマリー', description: '店舗ごとの反響・アポ・契約', icon: 'fa-store' },
    { type: 'medium', label: '販促媒体別サマリー', description: '媒体ごとの獲得数と契約率', icon: 'fa-bullhorn' },
    { type: 'custom', label: 'その他', description: '分析したい内容を自由に記入', icon: 'fa-pen-to-square' },
];

/**
 * 画面から選択できる分析タイプ。
 * ここに含まれないメニューはグレーアウトして押せなくする（表示自体は残す）。
 * 実装が済んだものからこのセットに追加していく。
 */
const AVAILABLE: ReadonlySet<AnalysisType> = new Set<AnalysisType>(['inquiry_trend', 'shop', 'medium']);

/**
 * バックエンドと接続済みの分析タイプ。
 * ここに含まれないものは API を呼ばず、課金を発生させずにサンプルを表示する。
 */
const IMPLEMENTED: ReadonlySet<AnalysisType> = new Set<AnalysisType>(['inquiry_trend', 'shop', 'medium']);

/** メニュー画面に出す保存済み分析の件数と、「もっと見る」1回あたりの追加件数 */
const HISTORY_PREVIEW_COUNT = 5;
const HISTORY_PAGE_SIZE = 20;
/** kpi_analysis_list が1回に返せる上限（サーバー側と合わせる） */
const HISTORY_MAX_COUNT = 100;

type Meta = {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number | null;
    duration_ms: number;
    used_today: number;
    daily_limit: number;
};

/** kpi_filter_master が返す絞り込みマスタ */
type ShopMaster = { division: string; section: string; shop: string };
type StaffMaster = { name: string; shop: string; section: string };

/** kpi_analysis_list が返す1件（本体のJSONは含まない） */
type HistoryItem = {
    id: number;
    title: string;
    headline: string;
    analysis_type: AnalysisType;
    division: Division;
    scope_label: string;
    model: string;
    created_at: string;
    staff_name: string | null;
};

/** 保存済み結果を開いているときの出所情報。課金メタの代わりに表示する */
type RestoredInfo = { title: string; staffName: string | null; createdAt: string; model: string };

/** UIの確認用サンプル。実装が済んだタイプでは実際の分析結果に置き換わる */
const SAMPLE_MARKDOWN = `## 全体傾向

これは表示確認用のサンプルです。実際の分析結果もこの形式で表示されます。

## 注目すべき変化

- **契約率**: 3.84%（905件 / 23,555件）→ 媒体構成の偏りが影響
- **ランク未設定**: 14,697件（62.4%）→ 優先度付けが機能していない

## 要因の仮説

データから読み取れることと推測を分けて記述されます。

## 打ち手の提案

1. 具体的で実行可能な提案が最大3点まで示されます。
`;

/** '2026-08-27 14:03:11' → '2026/8/27 14:03' */
const formatSavedAt = (value: string): string => {
    const d = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} `
        + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const ClaudeAnalysis: React.FC = () => {
    // 新規実行のときの「実行者」。保存済みを開いた場合は履歴の staff_name を使う
    const { userName } = useContext(AuthContext);

    const [selected, setSelected] = useState<MenuItem | null>(null);
    const [division, setDivision] = useState<Division>('order');
    const [customText, setCustomText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [elapsed, setElapsed] = useState<number>(0);
    const [result, setResult] = useState<string>('');
    const [structured, setStructured] = useState<StructuredAnalysis | null>(null);
    const [snapshot, setSnapshot] = useState<AnySnapshot | null>(null);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [error, setError] = useState<string>('');
    const [notice, setNotice] = useState<string>('');

    // 絞り込み（課 → 店舗 → スタッフ）。空文字は「絞り込まない」
    const [shopMaster, setShopMaster] = useState<ShopMaster[]>([]);
    const [staffMaster, setStaffMaster] = useState<StaffMaster[]>([]);
    // マスタ取得中。課のセレクトは無効化せず、選択肢の代わりに読み込み中と出す
    const [masterLoading, setMasterLoading] = useState<boolean>(true);
    const [section, setSection] = useState<string>('');
    const [shop, setShop] = useState<string>('');
    const [staff, setStaff] = useState<string>('');

    // 保存済みの分析
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [historyTotal, setHistoryTotal] = useState<number>(0);
    const [historyLimit, setHistoryLimit] = useState<number>(HISTORY_PREVIEW_COUNT);
    const [restored, setRestored] = useState<RestoredInfo | null>(null);
    // 復元中フラグ。restored は取得後に入るため、待機中の文言の出し分けには使えない
    const [restoring, setRestoring] = useState<boolean>(false);

    // 印刷プレビューを開いているか。開いている間は本体をスクロールさせない
    const [printing, setPrinting] = useState<boolean>(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 実行中の経過秒数を1秒ごとに更新する。
    // 40〜60秒かかるため、これが無いと「固まった」と誤解される。
    useEffect(() => {
        if (loading) {
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
        } else if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return () => {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [loading]);

    // ------------------------------------------------------------------
    // 絞り込みマスタ（起動時に1回だけ取得）
    //
    // 3段のカスケードを都度APIで引くと通信が増えるだけなので、
    // 対象になりうる店舗と担当者をまとめて受け取り、絞り込みは画面側で行う。
    // 取得に失敗しても分析自体は部門単位で実行できるため、致命的には扱わない。
    // ------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const res = await apiClient.post('', { request: 'kpi_filter_master' });
                if (cancelled || res.data?.status !== 'ok') return;
                setShopMaster(res.data.shops ?? []);
                setStaffMaster(res.data.staff ?? []);
            } catch {
                // 絞り込みが使えないだけで、部門単位の分析は可能。画面は止めない
            } finally {
                if (!cancelled) setMasterLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const loadHistory = useCallback(async (limit: number): Promise<void> => {
        try {
            const res = await apiClient.post('', { request: 'kpi_analysis_list', limit });
            if (res.data?.status !== 'ok') return;
            setHistory(res.data.items ?? []);
            setHistoryTotal(res.data.total ?? 0);
        } catch {
            // 履歴が出ないだけ。新規分析の妨げにはしない
        }
    }, []);

    useEffect(() => { void loadHistory(historyLimit); }, [loadHistory, historyLimit]);

    // ------------------------------------------------------------------
    // カスケードの選択肢
    // ------------------------------------------------------------------
    const shopDivision = DIVISIONS.find((d) => d.value === division)?.shopDivision ?? '';

    /** 対象部門の課。report_flag = 1 の店舗を持つ課だけがサーバーから届く */
    const sectionOptions = useMemo<string[]>(() => {
        const seen = new Set<string>();
        shopMaster.forEach((s) => {
            if (s.division === shopDivision && s.section !== '') seen.add(s.section);
        });
        return Array.from(seen);
    }, [shopMaster, shopDivision]);

    const shopOptions = useMemo<string[]>(() => {
        if (section === '') return [];
        return shopMaster
            .filter((s) => s.division === shopDivision && s.section === section)
            .map((s) => s.shop);
    }, [shopMaster, shopDivision, section]);

    const staffOptions = useMemo<string[]>(() => {
        if (shop === '') return [];
        const seen = new Set<string>();
        staffMaster.forEach((s) => { if (s.shop === shop) seen.add(s.name); });
        return Array.from(seen);
    }, [staffMaster, shop]);

    /**
     * 店舗まで絞り込むと「店舗別サマリー」は棒グラフが1本になり意味を失う。
     * そのためメニューをグレーアウトして押せなくする（サーバー側でも弾いている）。
     */
    const shopSummaryBlocked = shop !== '';

    /** 現在の絞り込みを人が読める形にしたもの */
    const scopeLabel = [
        DIVISIONS.find((d) => d.value === division)?.label ?? '',
        section, shop, staff,
    ].filter((v) => v !== '').join(' › ');

    // 親を変えたら子はリセットする。整合しない組み合わせはサーバーが弾くが、
    // そもそも画面に残さないほうが分かりやすい
    const changeDivision = (value: Division): void => {
        setDivision(value);
        setSection('');
        setShop('');
        setStaff('');
    };
    const changeSection = (value: string): void => {
        setSection(value);
        setShop('');
        setStaff('');
    };
    const changeShop = (value: string): void => {
        setShop(value);
        setStaff('');
    };

    const clearResult = (): void => {
        setResult('');
        setStructured(null);
        setSnapshot(null);
        setMeta(null);
        setError('');
        setNotice('');
        setRestored(null);
        setRestoring(false);
        // 結果が入れ替わるのにプレビューが残ると、古い内容を印刷してしまう
        setPrinting(false);
    };

    const reset = (): void => {
        setSelected(null);
        setCustomText('');
        clearResult();
    };

    const runAnalysis = async (menu: MenuItem): Promise<void> => {
        clearResult();

        if (!IMPLEMENTED.has(menu.type)) {
            // 未実装のタイプは API を呼ばない（＝課金しない）
            setResult(SAMPLE_MARKDOWN);
            setNotice(`「${menu.label}」はまだ実装されていません。以下は表示確認用のサンプルです（課金は発生していません）。`);
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post('', {
                request: 'kpi_analyze',
                type: menu.type,
                division,
                // 空文字は送らない。サーバー側は未指定＝絞り込みなしとして扱う
                ...(section !== '' ? { section } : {}),
                ...(shop    !== '' ? { shop }    : {}),
                ...(staff   !== '' ? { staff }   : {}),
                ...(menu.type === 'custom' ? { question: customText.trim() } : {}),
            });

            const body = response.data;

            if (body?.status !== 'ok') {
                setError(body?.message ?? '分析に失敗しました。');
                return;
            }

            setMeta(body.meta ?? null);

            if (body.format === 'structured') {
                setStructured(body.analysis as StructuredAnalysis);
                setSnapshot(body.kpi as AnySnapshot);
                // 保存された結果を一覧に反映する
                void loadHistory(historyLimit);
            } else {
                setResult(String(body.analysis ?? ''));
            }
        } catch (e: unknown) {
            // axios は非2xxで例外になる。サーバーが返した日本語メッセージを優先して見せる
            const message =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                ?? '通信に失敗しました。時間をおいて再度お試しください。';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (menu: MenuItem): void => {
        setSelected(menu);
        clearResult();

        // 「その他」は入力欄を出すだけで、すぐには実行しない
        if (menu.type !== 'custom') {
            void runAnalysis(menu);
        }
    };

    // ------------------------------------------------------------------
    // 保存済みの分析を開く。Claude は呼ばないので課金は発生しない
    // ------------------------------------------------------------------
    const openHistory = async (item: HistoryItem): Promise<void> => {
        const menu = MENUS.find((m) => m.type === item.analysis_type);
        if (menu === undefined) {
            // 保存後にメニュー定義から消えた分析タイプ。描画方法が決まらない
            setError(`この分析（${item.analysis_type}）は現在の画面では表示できません。`);
            return;
        }

        setSelected(menu);
        clearResult();
        setRestoring(true);
        setLoading(true);

        try {
            const res = await apiClient.post('', { request: 'kpi_analysis_get', id: item.id });
            const body = res.data;

            if (body?.status !== 'ok') {
                setError(body?.message ?? '保存された分析結果を開けませんでした。');
                return;
            }

            setStructured(body.analysis as StructuredAnalysis);
            setSnapshot(body.kpi as AnySnapshot);
            setRestored({
                title:     body.item?.title ?? item.title,
                staffName: body.item?.staff_name ?? item.staff_name,
                createdAt: body.item?.created_at ?? item.created_at,
                model:     body.item?.model ?? item.model,
            });
        } catch (e: unknown) {
            const message =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                ?? '通信に失敗しました。時間をおいて再度お試しください。';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const deleteHistory = async (item: HistoryItem): Promise<void> => {
        // 復元できなくなる操作なので、必ず一度確認する
        if (!window.confirm(`「${item.title}」を削除します。よろしいですか？`)) return;

        try {
            const res = await apiClient.post('', { request: 'kpi_analysis_delete', id: item.id });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '削除に失敗しました。');
                return;
            }
            void loadHistory(historyLimit);
        } catch {
            setError('削除に失敗しました。時間をおいて再度お試しください。');
        }
    };

    // ------------------------------------------------------------------
    // メニュー選択画面
    // ------------------------------------------------------------------
    if (selected === null) {
        const selectStyle: React.CSSProperties = { fontSize: '13px', borderColor: '#e8e6dc' };

        return (
            <div className="py-2">
                <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                    分析したい内容を選んでください。ダッシュボードの集計値をもとに Claude が分析します。
                </p>

                {/* 履歴の削除・復元の失敗はこの画面で起きる。
                    結果画面にしかエラー欄が無いと、失敗が黙って握り潰される */}
                {error !== '' && (
                    <div className="alert alert-danger d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                        <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                        <span className="flex-grow-1">{error}</span>
                        <button
                            type="button"
                            onClick={() => setError('')}
                            className="btn-close flex-shrink-0"
                            aria-label="閉じる"
                        />
                    </div>
                )}

                {/* 分析対象。部門 → 課 → 店舗 → スタッフ の順に絞り込める。
                    親を選ばないと子は選べない（サーバー側も同じ制約で検証する） */}
                <div className="row g-2 mb-2">
                    <div className="col-6 col-md-3">
                        <label htmlFor="claude-division" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                            分析対象
                        </label>
                        <select
                            id="claude-division"
                            className="form-select form-select-sm"
                            value={division}
                            onChange={(e) => changeDivision(e.target.value as Division)}
                            style={selectStyle}
                        >
                            {DIVISIONS.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-6 col-md-3">
                        <label htmlFor="claude-section" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                            課を選択
                        </label>
                        {/* 分析対象は常に選択済みなので、この欄も初回描画から操作できる。
                            マスタ取得中は選択肢がまだ無いことだけを伝える */}
                        <select
                            id="claude-section"
                            className="form-select form-select-sm"
                            value={section}
                            onChange={(e) => changeSection(e.target.value)}
                            style={selectStyle}
                        >
                            <option value="">部門全体</option>
                            {/* value を空にすると「部門全体」と重複するため別値にする。
                                disabled なので選択されることはない */}
                            {masterLoading && <option value="__loading" disabled>読み込み中…</option>}
                            {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-3">
                        <label htmlFor="claude-shop" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                            店舗を選択
                        </label>
                        <select
                            id="claude-shop"
                            className="form-select form-select-sm"
                            value={shop}
                            onChange={(e) => changeShop(e.target.value)}
                            disabled={section === ''}
                            style={selectStyle}
                        >
                            <option value="">課内すべて</option>
                            {shopOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-3">
                        <label htmlFor="claude-staff" className="form-label fw-bold mb-1" style={{ fontSize: '12px' }}>
                            スタッフを選択
                        </label>
                        <select
                            id="claude-staff"
                            className="form-select form-select-sm"
                            value={staff}
                            onChange={(e) => setStaff(e.target.value)}
                            disabled={shop === ''}
                            style={selectStyle}
                        >
                            <option value="">店舗内すべて</option>
                            {staffOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <p className="text-muted mb-3" style={{ fontSize: '12px' }}>
                    <i className="fa-solid fa-filter me-1" aria-hidden="true" />
                    {scopeLabel} のデータを分析します
                </p>

                <div className="row g-2">
                    {MENUS.map((menu) => {
                        // 店舗を絞り込んでいる間は「店舗別サマリー」を選べない
                        const blocked   = menu.type === 'shop' && shopSummaryBlocked;
                        const available = AVAILABLE.has(menu.type) && !blocked;
                        const badge     = blocked ? '対象外' : (!AVAILABLE.has(menu.type) ? '準備中' : null);
                        const tip       = blocked
                            ? '店舗・スタッフを絞り込んでいる間は選択できません'
                            : (available ? menu.description : '準備中です');

                        return (
                            <div key={menu.type} className="col-12 col-md-6 col-lg-4">
                                <button
                                    type="button"
                                    onClick={() => handleSelect(menu)}
                                    disabled={!available}
                                    title={tip}
                                    className="btn w-100 h-100 text-start d-flex align-items-start gap-2 p-3 position-relative"
                                    style={{
                                        fontSize: '13px',
                                        border: '1px solid #e8e6dc',
                                        borderRadius: '8px',
                                        backgroundColor: available ? '#fff' : '#f5f4f0',
                                        boxShadow: 'none',
                                        // 選べないメニューは薄く見せる（表示自体は残す）
                                        opacity: available ? 1 : 0.5,
                                        cursor: available ? 'pointer' : 'not-allowed',
                                        // Bootstrap の disabled 既定より、上の opacity を優先させる
                                        pointerEvents: 'auto',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!available) return;
                                        e.currentTarget.style.borderColor = CLAUDE_ORANGE;
                                        e.currentTarget.style.backgroundColor = '#fdf8f6';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!available) return;
                                        e.currentTarget.style.borderColor = '#e8e6dc';
                                        e.currentTarget.style.backgroundColor = '#fff';
                                    }}
                                >
                                    <i
                                        className={`fa-solid ${menu.icon} mt-1`}
                                        style={{ color: available ? CLAUDE_ORANGE : '#b0aea5', width: '16px' }}
                                        aria-hidden="true"
                                    />
                                    <span>
                                        <span className="d-block fw-bold text-dark">{menu.label}</span>
                                        <span className="d-block text-muted mt-1" style={{ fontSize: '12px' }}>
                                            {blocked ? tip : menu.description}
                                        </span>
                                    </span>

                                    {badge !== null && (
                                        <span
                                            className="position-absolute top-0 end-0 mt-2 me-2 px-2 py-1"
                                            style={{
                                                fontSize: '10px',
                                                backgroundColor: '#e8e6dc',
                                                color: '#6c6a63',
                                                borderRadius: '4px',
                                                lineHeight: 1,
                                            }}
                                        >
                                            {badge}
                                        </span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p className="text-muted mt-3 mb-0" style={{ fontSize: '12px' }}>
                    <i className="fa-regular fa-clock me-1" aria-hidden="true" />
                    分析には40〜60秒かかります。1回あたり十数円の費用が発生します。
                </p>

                {/* 保存済みの分析。開いても課金は発生しない */}
                {history.length > 0 && (
                    <div className="mt-4">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="fw-bold" style={{ fontSize: '13px' }}>
                                <i className="fa-regular fa-bookmark me-1" style={{ color: CLAUDE_ORANGE }} aria-hidden="true" />
                                保存済みの分析
                            </span>
                            <span className="text-muted" style={{ fontSize: '11px' }}>
                                開いても課金は発生しません（全{historyTotal}件）
                            </span>
                        </div>

                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="d-flex align-items-start gap-2 px-3 py-2 mb-1"
                                style={{ border: '1px solid #e8e6dc', borderRadius: '8px', backgroundColor: '#fff' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => void openHistory(item)}
                                    className="btn btn-link p-0 text-start flex-grow-1"
                                    style={{ fontSize: '12px', textDecoration: 'none', color: 'inherit' }}
                                >
                                    <span className="d-block fw-bold text-dark">{item.title}</span>
                                    <span
                                        className="d-block text-muted mt-1"
                                        style={{
                                            fontSize: '11px', lineHeight: 1.6,
                                            display: '-webkit-box', WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                        }}
                                    >
                                        {item.headline}
                                    </span>
                                    <span className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>
                                        {formatSavedAt(item.created_at)}
                                        {item.staff_name !== null && ` ／ ${item.staff_name}`}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void deleteHistory(item)}
                                    className="btn btn-sm btn-link text-muted p-1 flex-shrink-0"
                                    title="この分析結果を削除"
                                    style={{ fontSize: '12px' }}
                                >
                                    <i className="fa-regular fa-trash-can" aria-hidden="true" />
                                </button>
                            </div>
                        ))}

                        {/* 上限まで到達したらボタンを出さない。
                            押しても増えないボタンが残ると壊れて見える */}
                        {historyTotal > history.length && history.length < HISTORY_MAX_COUNT && (
                            <button
                                type="button"
                                onClick={() => setHistoryLimit((n) => Math.min(n + HISTORY_PAGE_SIZE, HISTORY_MAX_COUNT))}
                                className="btn btn-sm btn-link p-0 mt-1"
                                style={{ fontSize: '12px', color: CLAUDE_ORANGE, textDecoration: 'none' }}
                            >
                                もっと見る（残り {historyTotal - history.length} 件）
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ------------------------------------------------------------------
    // 選択後（入力・実行中・結果）
    // ------------------------------------------------------------------
    return (
        <div className="py-2">
            <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                <button
                    type="button"
                    onClick={reset}
                    disabled={loading}
                    className="btn btn-sm btn-outline-secondary"
                    style={{ fontSize: '12px' }}
                >
                    <i className="fa-solid fa-chevron-left me-1" aria-hidden="true" />
                    メニューへ戻る
                </button>
                <span className="fw-bold" style={{ fontSize: '14px' }}>{selected.label}</span>

                {/* どの範囲の分析か。結果を取り違えないよう常に表示する */}
                <span
                    className="px-2 py-1"
                    style={{
                        fontSize: '11px',
                        borderRadius: '4px',
                        backgroundColor: '#fdf8f6',
                        color: CLAUDE_ORANGE,
                        border: `1px solid ${CLAUDE_ORANGE}`,
                        lineHeight: 1.4,
                    }}
                >
                    {restored !== null && snapshot !== null
                        ? ((snapshot as { scope_label?: string }).scope_label ?? scopeLabel)
                        : scopeLabel}
                </span>

                {restored !== null && (
                    <span
                        className="px-2 py-1"
                        style={{
                            fontSize: '11px', borderRadius: '4px', lineHeight: 1.4,
                            backgroundColor: '#f0efe9', color: '#5c5a52',
                        }}
                    >
                        <i className="fa-regular fa-bookmark me-1" aria-hidden="true" />
                        保存済み
                    </span>
                )}

                {/* 印刷プレビュー。グラフ付きの構造化結果だけが対象。
                    Markdown のサンプル表示には出さない（印刷する意味がない） */}
                {structured !== null && snapshot !== null && !loading && (
                    <button
                        type="button"
                        onClick={() => setPrinting(true)}
                        className="btn btn-sm ms-auto"
                        style={{
                            fontSize: '12px',
                            border: `1px solid ${CLAUDE_ORANGE}`,
                            color: CLAUDE_ORANGE,
                            backgroundColor: '#fff',
                        }}
                    >
                        <i className="fa-solid fa-file-pdf me-1" aria-hidden="true" />
                        プレビュー / PDF
                    </button>
                )}
            </div>

            {/* 「その他」の入力欄 */}
            {selected.type === 'custom' && result === '' && (
                <div className="mb-3">
                    <label className="form-label text-muted" style={{ fontSize: '13px' }}>
                        分析したい内容を記入してください
                    </label>
                    <textarea
                        className="form-control"
                        rows={4}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="例：直近3ヶ月で失注が増えている店舗と、その共通点を教えてください"
                        style={{ fontSize: '13px' }}
                        disabled={loading}
                    />
                    <button
                        type="button"
                        onClick={() => void runAnalysis(selected)}
                        disabled={loading || customText.trim() === ''}
                        className="btn mt-2"
                        style={{
                            fontSize: '13px',
                            backgroundColor: CLAUDE_ORANGE,
                            borderColor: CLAUDE_ORANGE,
                            color: '#fff',
                        }}
                    >
                        <span>分析する</span>
                    </button>
                </div>
            )}

            {/* 実行中 */}
            {loading && (
                <div className="text-center py-5">
                    <div className="spinner-border" style={{ color: CLAUDE_ORANGE }} role="status">
                        <span className="visually-hidden">分析中</span>
                    </div>
                    {/* 保存済みの読み込みは一瞬で終わるため、待ち時間の案内は出さない */}
                    {!restoring && (
                        <>
                            <p className="text-muted mt-3 mb-0" style={{ fontSize: '13px' }}>
                                分析中です… {elapsed} 秒経過
                            </p>
                            <p className="text-muted mb-0" style={{ fontSize: '12px' }}>
                                通常40〜60秒かかります。画面を閉じずにお待ちください。
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* エラー */}
            {error !== '' && (
                <div className="alert alert-danger" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation me-2" aria-hidden="true" />
                    {error}
                </div>
            )}

            {/* 注意書き（未実装のサンプル表示など） */}
            {notice !== '' && (
                <div className="alert" style={{ fontSize: '12px', backgroundColor: '#fdf8f6', border: `1px solid ${CLAUDE_ORANGE}`, color: '#8a4a33' }}>
                    <i className="fa-solid fa-circle-info me-2" aria-hidden="true" />
                    {notice}
                </div>
            )}

            {/* 結果：構造化（グラフ付きダッシュボード） */}
            {structured !== null && snapshot !== null && !loading && (
                <ClaudeAnalysisResult
                    type={selected.type as AnalysisKind}
                    snapshot={snapshot}
                    analysis={structured}
                />
            )}

            {/* 結果：Markdown（未実装タイプのサンプル表示など） */}
            {result !== '' && !loading && (
                <div
                    className="claude-analysis-result px-3 py-2"
                    style={{
                        fontSize: '13px',
                        lineHeight: 1.8,
                        backgroundColor: '#faf9f5',
                        border: '1px solid #e8e6dc',
                        borderRadius: '8px',
                    }}
                >
                    <ReactMarkdown>{result}</ReactMarkdown>
                </div>
            )}

            {/* 出所。新規実行なら課金メタ、復元なら保存日時と実行者 */}
            {(structured !== null || result !== '') && !loading && (
                <>
                    {restored !== null ? (
                        <p className="text-muted mt-2 mb-0" style={{ fontSize: '11px' }}>
                            {formatSavedAt(restored.createdAt)} に保存された分析結果です
                            {restored.staffName !== null && `（実行者: ${restored.staffName}）`}
                            ／{restored.model}／再実行していないため課金は発生していません
                        </p>
                    ) : meta !== null && (
                        <p className="text-muted mt-2 mb-0" style={{ fontSize: '11px' }}>
                            {meta.model}／入力 {meta.input_tokens.toLocaleString()} トークン・
                            出力 {meta.output_tokens.toLocaleString()} トークン／
                            {meta.cost_usd !== null && `約 $${meta.cost_usd.toFixed(4)}／`}
                            {(meta.duration_ms / 1000).toFixed(1)} 秒／
                            本日 {meta.used_today} / {meta.daily_limit} 回
                        </p>
                    )}
                </>
            )}

            {/* 印刷プレビュー。body 直下のポータルに描画される */}
            {printing && structured !== null && snapshot !== null && (
                <ClaudeAnalysisPrint
                    type={selected.type as AnalysisKind}
                    snapshot={snapshot}
                    analysis={structured}
                    title={restored?.title ?? selected.label}
                    scopeLabel={
                        restored !== null
                            ? ((snapshot as { scope_label?: string }).scope_label ?? scopeLabel)
                            : scopeLabel
                    }
                    model={restored?.model ?? meta?.model ?? ''}
                    savedAt={restored?.createdAt ?? null}
                    staffName={restored?.staffName ?? (userName === '' ? null : userName)}
                    onClose={() => setPrinting(false)}
                />
            )}
        </div>
    );
};

export default ClaudeAnalysis;
