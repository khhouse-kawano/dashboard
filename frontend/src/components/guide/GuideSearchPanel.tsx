import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import GuideMarkdown from './GuideMarkdown';
import { GUIDE_CSS } from './Guide';
import { GUIDE_COMMON, GUIDE_DIVISIONS, openGuide } from './openGuide';

/**
 * 左メニューの業務ガイドの検索で選んだ記事を、ダッシュボードの右側（帳票の場所）に出す（v2.2.198 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 検索バーは Menu.tsx。⚠️ PC だけ（⚠️ スマホは業務ガイドの窓で開く）。
 * ⚠️ 記事は guide_article（② の `guide_list`・`guide_article`。⚠️ guide_history は直す前の内容なので使わない）。
 * ⚠️ 見た目は業務ガイドと同じ（Guide.tsx の GUIDE_CSS）。⚠️ 枠だけ接頭辞 gs_。
 * ⚠️ 置き場所はメニューの右（⚠️ メニューの幅は App.css の .modal_menu ＝ 20%・最大 200px）。
 *   ⚠️ 重なり: ヘッダー（1050）・モーダル（1055）より下。
 * ⚠️ 記事の「画面を開く」は**この窓で開き、記事を閉じる**（GuideScreenButton の onOpenedHere）。
 * ⚠️ 記事どうしのリンクは、ここで次の記事に切り替える。
 * ─────────────────────────────────────────────
 */

export interface GuideListItem {
    id: number;
    title: string;
    division: string;
    section: string;
    summary: string;
    /** 1 = 公開（⚠️ 編集できる人には隠した記事も返る） */
    published: number;
}

interface Article extends GuideListItem {
    body: string;
}

/**
 * 記事の一覧（本文なし）。⚠️ Menu は PC 用とスマホ用で2回マウントされるので、1回だけ取りに行く。
 * ⚠️ 失敗したら次の入力で取り直す。
 */
let listRequest: Promise<GuideListItem[]> | null = null;
export const fetchGuideListOnce = (): Promise<GuideListItem[]> => {
    if (listRequest === null) {
        listRequest = apiClient.post('', { request: 'guide_list' })
            .then((response) => (response.data?.articles ?? []) as GuideListItem[])
            .catch((e) => {
                console.error('guide_list failed:', e);
                listRequest = null;
                throw e;
            });
    }
    return listRequest;
};

export const divisionLabelOf = (division: string): string =>
    division === GUIDE_COMMON ? '全事業共通' : GUIDE_DIVISIONS.find((d) => d.value === division)?.label ?? division;
export const divisionColorOf = (division: string): string =>
    GUIDE_DIVISIONS.find((d) => d.value === division)?.color ?? '#6b7280';

interface Props {
    articleId: number;
    /** 一覧（⚠️ 全事業。記事どうしのリンクに使う） */
    articles: GuideListItem[];
    onSelect: (id: number) => void;
    onClose: () => void;
}

const GuideSearchPanel: React.FC<Props> = ({ articleId, articles, onSelect, onClose }) => {
    const [article, setArticle] = useState<Article | null>(null);
    const [message, setMessage] = useState('');
    const titleToId = useMemo(() => new Map(articles.map((a) => [a.title, a.id])), [articles]);

    useEffect(() => {
        let cancelled = false;
        setMessage('');
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'guide_article', id: articleId });
                if (cancelled) return;
                const loaded: Article | null = response.data?.article ?? null;
                setArticle(loaded);
                if (loaded === null) setMessage('記事が見つかりませんでした。');
            } catch (e) {
                if (cancelled) return;
                console.error('guide_article failed:', e);
                setArticle(null);
                setMessage('記事を読み込めませんでした。もう一度選び直してください。');
            }
        })();
        return () => { cancelled = true; };
    }, [articleId]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // ⚠️ 画面のモーダルが開いているときは、そちらの Esc に任せる
            if (e.key === 'Escape' && document.querySelector('.modal.show') === null) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const openByTitle = (title: string) => {
        const id = titleToId.get(title);
        if (id === undefined) { setMessage(`「${title}」の記事はまだありません。`); return; }
        onSelect(id);
    };

    const shown = article !== null && article.id === articleId ? article : null;

    return (
        <div className="gs_panel" role="dialog" aria-label="業務ガイドの記事">
            <style>{GUIDE_CSS}{CSS}</style>
            {/* ⚠️ ボタンは左に寄せる（⚠️ 右上はアクティブユーザーの枠＝ActiveUser.tsx が重なって押せない） */}
            <div className="gs_bar">
                <span className="gs_eyebrow">業務ガイド</span>
                <button type="button" className="gd_btn" onClick={onClose} title="閉じる（Esc）">× 閉じる</button>
                {shown && (
                    <button type="button" className="gd_btn" onClick={() => openGuide(shown.title)}
                        title="業務ガイドの窓でこの記事を開く（作業中の画面と並べて読めます）">
                        別の窓で開く
                    </button>
                )}
            </div>
            {/* ⚠️ key: リンクで次の記事に移ったら先頭から読めるよう、スクロールを戻す */}
            <div className="gs_scroll" key={articleId}>
                {message !== '' && <div className="gd_error" role="status">{message}</div>}
                {shown === null ? (
                    message === '' && <div className="gs_loading">読み込み中…</div>
                ) : (
                    <article className="gd_article">
                        <div className="gd_meta">
                            <span className="gs_div" style={{ '--gs-div': divisionColorOf(shown.division) } as React.CSSProperties}>
                                {divisionLabelOf(shown.division)}
                            </span>
                            <span className="gd_tag">{shown.section}</span>
                        </div>
                        <h1 className="gd_h1">{shown.title}</h1>
                        {shown.summary && <p className="gd_lead">{shown.summary}</p>}
                        <GuideMarkdown body={shown.body} titleToId={titleToId} onOpen={openByTitle}
                            articleDivision={shown.division === GUIDE_COMMON ? null : shown.division} onScreenOpened={onClose} />
                    </article>
                )}
            </div>
        </div>
    );
};

const CSS = `
.gs_panel { position: fixed; top: calc(var(--header-h, 30px) + 6px); left: min(20vw, 200px); right: 0; bottom: 0; z-index: 1040;
            display: flex; flex-direction: column; background: #fff; color: #1f2937; font-size: 13px;
            border-left: 1px solid #e5e7eb; box-shadow: -8px 0 24px rgba(15, 23, 42, .08); }
.gs_bar { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 8px 16px 8px 24px;
          border-bottom: 1px solid #e5e7eb; background: #f8fafc; }
.gs_eyebrow { margin-right: 6px; font-size: 12px; font-weight: 700; color: #0f766e; letter-spacing: .04em; }
.gs_bar .gd_btn:focus-visible { outline: 2px solid #14b8a6; }
.gs_scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 24px 40px 80px; }
.gs_loading { color: #9ca3af; font-size: 13px; text-align: center; padding: 40px 0; }
.gs_div { font-size: 11px; font-weight: 700; color: #fff; background: var(--gs-div); border-radius: 999px; padding: 2px 10px; }
`;

export default GuideSearchPanel;
