import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLAUDE_ORANGE } from './ClaudeIcon';
import ClaudeAnalysisResult from './ClaudeAnalysisResult';
import type { AnalysisKind, AnySnapshot, StructuredAnalysis } from './ClaudeAnalysisResult';

/**
 * 分析結果の印刷プレビューと PDF 保存。
 *
 * ─────────────────────────────────────────────
 * なぜ「プレビュー → ブラウザの印刷」なのか
 *
 *   PDF生成を自前で行う方法（pdf-lib / Puppeteer）は、いずれも
 *   「画面と同じ見た目」を別実装で作り直すことになる。
 *   ・pdf-lib   … HTMLを描画できず、座標指定でレイアウトを組み直す
 *   ・Puppeteer … ② VPS に Chromium(約400MB)と日本語フォントが必要
 *
 *   ブラウザの印刷機能なら、いま画面に出ているものがそのままPDFになる。
 *   日本語フォントの埋め込みも不要で、文字は選択・検索できる状態で残る。
 *
 * ⚠️ プレビューを画面に出すこと自体が、グラフを正しく印刷するための条件でもある。
 *   recharts の ResponsiveContainer は親要素の幅を実測して SVG を描く。
 *   非表示のまま印刷すると幅0で測られてグラフが消える。
 *   先に画面に出しておけば SVG は px 指定で確定しているため、
 *   印刷時はそれをそのまま出力するだけになる。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 用紙の幅を 700px 固定にしている理由
 *   A4縦 210mm から余白 12mm×2 を引くと 186mm = 約703px（1px = 1/96インチ）。
 *   プレビューを同じ幅にしておくと、印刷時に縮小・拡大が起こらず
 *   画面の見た目とPDFが一致する。
 */

/**
 * A4縦・余白12mm に収まる用紙幅（px）。
 *
 * ⚠️ ここを広げてはいけない。
 *   A4縦の印刷可能幅は 210mm − 12mm×2 = 186mm ≒ 703px（1px = 1/96インチ）。
 *   これを超えると印刷時に右側が用紙からはみ出て切れる。
 *   Chrome は既定で縮小しないため、利用者が拡大率を手で下げるまで気づけない。
 */
const PAPER_WIDTH = 700;

/**
 * 外枠の最大幅（Bootstrap の modal-xl と同じ）。
 * 用紙は上記のとおり広げられないが、ヘッダー行はここまで広げて操作しやすくする。
 */
const SHELL_WIDTH = 1140;

const PORTAL_ID = 'claude-print-portal';

/**
 * 印刷用のスタイル。
 *
 * ⚠️ `body > *:not(#claude-print-portal)` でダッシュボード本体を隠すのが要点。
 *   オーバーレイで覆っているだけでは、背後のDOMも印刷対象に含まれてしまう。
 *   ポータルを body 直下に置いているのはこの1行を書けるようにするため。
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }

#${PORTAL_ID} .cp-overlay {
    position: fixed; inset: 0; z-index: 2000;
    display: flex; flex-direction: column;
    background: rgba(20, 20, 19, 0.55);
}

/* ---- ヘッダー行。modal-header 相当。スクロールしても残る ---- */
#${PORTAL_ID} .cp-header {
    flex: none;
    background: #faf9f5;
    border-bottom: 1px solid #e8e6dc;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
}
#${PORTAL_ID} .cp-header-inner {
    width: ${SHELL_WIDTH}px; max-width: 100%;
    margin: 0 auto;
    padding: 10px 16px;
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
/* 案内文は伸縮させ、ボタンは縮ませない */
#${PORTAL_ID} .cp-guide { flex: 1 1 260px; min-width: 0; }
#${PORTAL_ID} .cp-actions { flex: 0 0 auto; display: flex; gap: 8px; }

/* ---- 本体。ここだけスクロールする ---- */
#${PORTAL_ID} .cp-body {
    flex: 1 1 auto; overflow: auto;
    padding: 20px 12px 64px;
}
#${PORTAL_ID} .cp-paper {
    width: ${PAPER_WIDTH}px;
    max-width: 100%;
    margin: 0 auto;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    padding: 28px 24px 32px;
}

@media print {
    /* ダッシュボード本体を印刷対象から外す */
    body > *:not(#${PORTAL_ID}) { display: none !important; }

    #${PORTAL_ID} .cp-overlay {
        display: block !important;
        position: static !important;
        background: #fff !important;
    }
    /* ⚠️ overflow: auto を残すと、印刷時に1ページ目で切れる */
    #${PORTAL_ID} .cp-body {
        overflow: visible !important;
        padding: 0 !important;
    }
    #${PORTAL_ID} .cp-paper {
        box-shadow: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    .cp-hide { display: none !important; }

    /* 見出しと本文が別ページに割れるのを防ぐ */
    #${PORTAL_ID} .row > * { break-inside: avoid; page-break-inside: avoid; }
    #${PORTAL_ID} svg { break-inside: avoid; page-break-inside: avoid; }

    /* 背景色つきのカードやバッジを印刷でも残す */
    #${PORTAL_ID} * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

/** '2026-08-27 14:03:11' → '2026/8/27 14:03' */
const formatDateTime = (value: string): string => {
    const d = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} `
        + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * ファイル名に使えない文字を落とす。
 *
 * ⚠️ ブラウザは PDF のファイル名を document.title から作る。
 *   \\ / : * ? " < > | が残っていると保存ダイアログで置換され、
 *   環境によって名前が壊れる。
 */
const toFileName = (value: string): string =>
    value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);

type Props = {
    type: AnalysisKind;
    snapshot: AnySnapshot;
    analysis: StructuredAnalysis;
    /** 見出し。保存済みなら履歴のタイトル、新規実行ならメニュー名 */
    title: string;
    /** 分析範囲（例: 注文事業 › 鹿児島営業1課） */
    scopeLabel: string;
    model: string;
    /** 保存済みを開いている場合の保存日時。新規実行時は null */
    savedAt: string | null;
    /** 実行者。分からなければ null */
    staffName: string | null;
    onClose: () => void;
};

const ClaudeAnalysisPrint: React.FC<Props> = ({
    type, snapshot, analysis, title, scopeLabel, model, savedAt, staffName, onClose,
}) => {
    // ポータル先の要素。body 直下に作る（印刷CSSの :not() が効くようにするため）
    const [host, setHost] = useState<HTMLElement | null>(null);
    const titleRef = useRef<string>('');

    useEffect(() => {
        const el = document.createElement('div');
        el.id = PORTAL_ID;
        document.body.appendChild(el);
        setHost(el);

        // オーバーレイの裏側がスクロールしないようにする
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
            el.remove();
        };
    }, []);

    // Esc で閉じる。モーダル相当のUIなので必須
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    /**
     * 印刷後に document.title を必ず戻す。
     *
     * ⚠️ window.print() の直後に戻すと、ブラウザがまだタイトルを読んでいない
     *   タイミングに当たることがある。afterprint で戻すのが確実。
     */
    useEffect(() => {
        const restore = (): void => {
            if (titleRef.current !== '') {
                document.title = titleRef.current;
                titleRef.current = '';
            }
        };
        window.addEventListener('afterprint', restore);
        return () => {
            window.removeEventListener('afterprint', restore);
            restore();
        };
    }, []);

    const fileName = useMemo<string>(() => {
        const stamp = savedAt !== null ? savedAt.slice(0, 10).replace(/-/g, '') : '';
        return toFileName([stamp, title, scopeLabel].filter((v) => v !== '').join('_'));
    }, [savedAt, title, scopeLabel]);

    const handlePrint = useCallback((): void => {
        titleRef.current = document.title;
        // ブラウザはこのタイトルを PDF のファイル名の既定値に使う
        document.title = fileName;
        window.print();
    }, [fileName]);

    if (host === null) return null;

    const buttonStyle: React.CSSProperties = {
        fontSize: '12px',
        border: '1px solid #e8e6dc',
        backgroundColor: '#fff',
        borderRadius: '6px',
    };

    return createPortal(
        <>
            <style>{PRINT_CSS}</style>

            <div className="cp-overlay" role="dialog" aria-modal="true" aria-label="分析結果の印刷プレビュー">
                {/* ヘッダー行。案内文を左、操作を右に置く。印刷時は消す */}
                <div className="cp-header cp-hide">
                    <div className="cp-header-inner">
                        <div className="cp-guide">
                            <div className="fw-bold" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                                <i className="fa-solid fa-file-pdf me-2" style={{ color: CLAUDE_ORANGE }} aria-hidden="true" />
                                印刷プレビュー
                            </div>
                            <div className="text-muted" style={{ fontSize: '11px', lineHeight: 1.7 }}>
                                PDFにするには、印刷ダイアログの送信先で「PDFに保存」を選んでください。
                                日付やURLが余白に入るのを避けるには「ヘッダーとフッター」のチェックを外してください。
                            </div>
                        </div>

                        <div className="cp-actions">
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="btn btn-sm px-3"
                                style={{
                                    fontSize: '12px',
                                    backgroundColor: CLAUDE_ORANGE,
                                    borderColor: CLAUDE_ORANGE,
                                    color: '#fff',
                                    borderRadius: '6px',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <i className="fa-solid fa-print me-1" aria-hidden="true" />
                                印刷 / PDFとして保存
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn btn-sm px-3"
                                style={{ ...buttonStyle, whiteSpace: 'nowrap' }}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>

                <div className="cp-body">
                <div className="cp-paper">
                    {/* 表紙の見出し。何をどの範囲で分析したものかを紙の上だけで判断できるようにする */}
                    <div style={{ borderBottom: `2px solid ${CLAUDE_ORANGE}`, paddingBottom: '10px', marginBottom: '18px' }}>
                        <div style={{ fontSize: '11px', color: '#6c6a63', letterSpacing: '.08em' }}>
                            KPI ANALYSIS
                        </div>
                        <h1 style={{ fontSize: '19px', fontWeight: 700, margin: '4px 0 6px', lineHeight: 1.5 }}>
                            {title}
                        </h1>
                        <div style={{ fontSize: '11px', color: '#6c6a63', lineHeight: 1.8 }}>
                            <div>分析範囲：{scopeLabel}</div>
                            <div>
                                {savedAt !== null
                                    ? `${formatDateTime(savedAt)} に保存`
                                    : `${formatDateTime(new Date().toISOString().slice(0, 19).replace('T', ' '))} 出力`}
                                {staffName !== null && staffName !== '' && ` ／ 実行者：${staffName}`}
                                {model !== '' && ` ／ ${model}`}
                            </div>
                        </div>
                    </div>

                    {/* 画面と同じコンポーネントをそのまま使う。
                        別の印刷用レイアウトを作ると、片方だけ直して食い違う */}
                    <ClaudeAnalysisResult type={type} snapshot={snapshot} analysis={analysis} />

                    <p style={{ fontSize: '10px', color: '#8a8880', marginTop: '20px', marginBottom: 0, lineHeight: 1.7 }}>
                        数値はダッシュボードの集計値です。文章部分は Claude による解釈であり、
                        「推測」と記された内容はデータで確認されたものではありません。
                    </p>
                </div>
                </div>
            </div>
        </>,
        host
    );
};

export default ClaudeAnalysisPrint;
