import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { CLAUDE_ORANGE } from './ClaudeIcon';
import apiClient from '../../utils/apiClient';
import ClaudeAnalysisResult from './ClaudeAnalysisResult';
import type { AnySnapshot, AnalysisKind, StructuredAnalysis } from './ClaudeAnalysisResult';

/**
 * Claude による分析メニュー。
 *
 * 分析は1回あたり40〜60秒かかり、実行のたびに課金が発生する。
 * そのため「実行中はボタンを押せない」「経過時間を表示する」ことを必須としている。
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
 */
export type Division = 'order' | 'kaeru';

const DIVISIONS: { value: Division; label: string; note: string }[] = [
    { value: 'order', label: '注文営業', note: '注文住宅部門' },
    { value: 'kaeru', label: '建売営業', note: '建売住宅部門' },
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

type Meta = {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number | null;
    duration_ms: number;
    used_today: number;
    daily_limit: number;
};

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

const ClaudeAnalysis: React.FC = () => {
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

    const clearResult = (): void => {
        setResult('');
        setStructured(null);
        setSnapshot(null);
        setMeta(null);
        setError('');
        setNotice('');
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
    // メニュー選択画面
    // ------------------------------------------------------------------
    if (selected === null) {
        return (
            <div className="py-2">
                <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                    分析したい内容を選んでください。ダッシュボードの集計値をもとに Claude が分析します。
                </p>

                {/* 分析対象の部門。選択に応じて参照するテーブルが切り替わる */}
                <div className="d-flex align-items-center gap-2 mb-3">
                    <label
                        htmlFor="claude-division"
                        className="fw-bold mb-0 flex-shrink-0"
                        style={{ fontSize: '13px' }}
                    >
                        分析対象
                    </label>
                    <select
                        id="claude-division"
                        className="form-select form-select-sm"
                        value={division}
                        onChange={(e) => setDivision(e.target.value as Division)}
                        style={{
                            fontSize: '13px',
                            maxWidth: '200px',
                            borderColor: '#e8e6dc',
                        }}
                    >
                        {DIVISIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                    <span className="text-muted" style={{ fontSize: '12px' }}>
                        {DIVISIONS.find((d) => d.value === division)?.note}のデータを分析します
                    </span>
                </div>

                <div className="row g-2">
                    {MENUS.map((menu) => {
                        const available = AVAILABLE.has(menu.type);

                        return (
                            <div key={menu.type} className="col-12 col-md-6 col-lg-4">
                                <button
                                    type="button"
                                    onClick={() => handleSelect(menu)}
                                    disabled={!available}
                                    title={available ? menu.description : '準備中です'}
                                    className="btn w-100 h-100 text-start d-flex align-items-start gap-2 p-3 position-relative"
                                    style={{
                                        fontSize: '13px',
                                        border: '1px solid #e8e6dc',
                                        borderRadius: '8px',
                                        backgroundColor: available ? '#fff' : '#f5f4f0',
                                        boxShadow: 'none',
                                        // 未実装のメニューは薄く見せる（表示自体は残す）
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
                                            {menu.description}
                                        </span>
                                    </span>

                                    {!available && (
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
                                            準備中
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
            </div>
        );
    }

    // ------------------------------------------------------------------
    // 選択後（入力・実行中・結果）
    // ------------------------------------------------------------------
    return (
        <div className="py-2">
            <div className="d-flex align-items-center gap-2 mb-3">
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
                {/* どの部門の分析か。結果を取り違えないよう常に表示する */}
                <span
                    className="px-2 py-1"
                    style={{
                        fontSize: '11px',
                        borderRadius: '4px',
                        backgroundColor: '#fdf8f6',
                        color: CLAUDE_ORANGE,
                        border: `1px solid ${CLAUDE_ORANGE}`,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {DIVISIONS.find((d) => d.value === division)?.label}
                </span>
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
                    <p className="text-muted mt-3 mb-0" style={{ fontSize: '13px' }}>
                        分析中です… {elapsed} 秒経過
                    </p>
                    <p className="text-muted mb-0" style={{ fontSize: '12px' }}>
                        通常40〜60秒かかります。画面を閉じずにお待ちください。
                    </p>
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

            {/* 使用量とコスト */}
            {(structured !== null || result !== '') && !loading && (
                <>
                    {meta !== null && (
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
        </div>
    );
};

export default ClaudeAnalysis;
