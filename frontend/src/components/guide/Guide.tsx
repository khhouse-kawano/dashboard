import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import GuideMarkdown, { headingsOf } from './GuideMarkdown';
import GuideEditor, { GuideDraft } from './GuideEditor';
import { GUIDE_DIVISIONS, GUIDE_COMMON, allowedGuideDivisions } from './openGuide';

/**
 * 業務ガイド（v2.2.194 新規）。別ウインドウで開く `/guide`（記事は `/guide?id=12`）。
 *
 * ⚠️⚠️ **記事を `/guide/12` の形にしないこと。** ⚠️ index.html が画面の部品を相対パス（`./static/...`）で読むため、
 *   ⚠️ 2段の URL で再読み込みすると部品の場所がずれて真っ白になる（2026-10-16 にブラウザで確認）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開き方: openGuide.ts（ヘッダー・アクティブユーザー・トップ画面の「業務ガイド」ボタン、GuideLink）。
 * ⚠️⚠️ App.tsx で `/guide` のときだけヘッダー・メニュー・アクティブユーザー・要確認を出さない。
 *
 * ⚠️ 画面: 左＝目次（分類別の記事一覧・検索）／中央＝記事／右＝記事内の見出し。
 *   ⚠️ 窓を狭くすると右の見出しを消し、左の目次はボタンで開閉する。
 *
 * ⚠️ 事業（注文営業・建売営業・中古リノベ）ごとに記事を分けて出す（⚠️ 建売・中古は 2026-10-16 の追加指示）。
 *   ⚠️ 共通（common）の記事はどの事業にも出す。⚠️ 見られる事業は allowedGuideDivisions（openGuide.ts）。
 *   ⚠️ リンクは事業をまたいで張れる。⚠️ 別の事業の記事を開いたら、上の切り替えもその事業に移す。
 * ⚠️ 編集（作る・直す）は Master / BrandAdmin（② が判定し、`canEdit` で返す）。
 * ⚠️ `?title=タイトル` で開かれたら、そのタイトルの記事へ移る（GuideLink 用）。
 * ─────────────────────────────────────────────
 */

interface ArticleSummary {
    id: number;
    title: string;
    division: string;
    section: string;
    summary: string;
    sort: number;
    published: number;
    updated_by: string;
    updated_at: string;
}

interface Article extends ArticleSummary {
    body: string;
}

const emptyDraft = (section: string, division: string, title = ''): GuideDraft => ({
    id: null, title, division, section, summary: '', body: '', sort: 0, published: true,
});

const Guide: React.FC = () => {
    const { authority, category, shopName } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const idParam = searchParams.get('id') ?? undefined;
    const titleParam = searchParams.get('title') ?? '';

    const allowedDivisions = useMemo(() => allowedGuideDivisions(authority, category, shopName), [authority, category, shopName]);
    const allowed = allowedDivisions.length > 0;

    const [articles, setArticles] = useState<ArticleSummary[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [canEdit, setCanEdit] = useState(false);
    const [listLoaded, setListLoaded] = useState(false);
    const [article, setArticle] = useState<Article | null>(null);
    const [message, setMessage] = useState('');
    const [keyword, setKeyword] = useState('');
    const [draft, setDraft] = useState<GuideDraft | null>(null);
    const [navOpen, setNavOpen] = useState(false);
    /** 表示中の事業。⚠️ はじめは選んでいる事業（category）。⚠️ 見られなければ最初の1つ */
    const [division, setDivision] = useState<string>(() => (allowedDivisions.includes(category) ? category : allowedDivisions[0] ?? 'order'));
    const divisionLabel = GUIDE_DIVISIONS.find((d) => d.value === division)?.label ?? '';

    const loadList = useCallback(async () => {
        try {
            const response = await apiClient.post('', { request: 'guide_list' });
            setArticles(response.data?.articles ?? []);
            setSections(response.data?.sections ?? []);
            setCanEdit(response.data?.canEdit === true);
        } catch (e) {
            console.error('guide_list failed:', e);
            setMessage('記事の一覧を読み込めませんでした。ウインドウを開き直してください。');
        } finally {
            setListLoaded(true);
        }
    }, []);

    useEffect(() => { if (allowed) loadList(); }, [allowed, loadList]);

    const titleToId = useMemo(() => new Map(articles.map((a) => [a.title, a.id])), [articles]);

    /** タイトルで開く（⚠️ 無い記事は、編集できる人なら新規作成） */
    const openByTitle = useCallback((title: string) => {
        const found = titleToId.get(title);
        if (found !== undefined) {
            navigate(`/guide?id=${found}`);
            return;
        }
        if (canEdit) {
            setDraft(emptyDraft(sections[0] ?? '用語', division, title));
            return;
        }
        setArticle(null);
        setMessage(`「${title}」の記事はまだありません。`);
    }, [titleToId, canEdit, sections, division, navigate]);

    // ⚠️ `?title=` で開かれたとき（GuideLink）。⚠️ 一覧を読み終えてから探す
    useEffect(() => {
        if (!listLoaded || titleParam === '') return;
        openByTitle(titleParam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listLoaded, titleParam]);

    // 記事を読む
    useEffect(() => {
        if (!allowed || idParam === undefined) { setArticle(null); return; }
        let cancelled = false;
        setMessage('');
        setDraft(null);
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'guide_article', id: Number(idParam) });
                if (cancelled) return;
                const loaded: Article | null = response.data?.article ?? null;
                setArticle(loaded);
                // ⚠️ 別の事業の記事へリンクで移ったら、切り替えもその事業へ（⚠️ 共通の記事では動かさない）
                if (loaded && loaded.division !== GUIDE_COMMON && allowedDivisions.includes(loaded.division)) setDivision(loaded.division);
            } catch (e) {
                if (cancelled) return;
                console.error('guide_article failed:', e);
                setArticle(null);
                setMessage('記事が見つかりませんでした。左の目次から選び直してください。');
            }
        })();
        return () => { cancelled = true; };
    }, [allowed, idParam, allowedDivisions]);

    useEffect(() => {
        document.title = article ? `業務ガイド｜${article.title}` : '業務ガイド';
    }, [article]);

    const filtered = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        return articles
            .filter((a) => a.division === division || a.division === GUIDE_COMMON)
            .filter((a) => k === '' || `${a.title} ${a.summary}`.toLowerCase().includes(k));
    }, [articles, keyword, division]);
    const bySection = useMemo(
        () => sections.map((s) => ({ section: s, items: filtered.filter((a) => a.section === s) })).filter((g) => g.items.length > 0),
        [sections, filtered]
    );
    const headings = useMemo(() => (article ? headingsOf(article.body) : []), [article]);
    const editorDivisions = useMemo(
        () => [...GUIDE_DIVISIONS.filter((d) => allowedDivisions.includes(d.value)).map(({ value, label }) => ({ value, label })), { value: GUIDE_COMMON, label: '全事業共通' }],
        [allowedDivisions]
    );

    const goHome = () => { setDraft(null); setArticle(null); setNavOpen(false); navigate('/guide'); };
    const goArticle = (id: number) => { setNavOpen(false); setDraft(null); navigate(`/guide?id=${id}`); };
    const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const onSaved = async (id: number) => {
        setDraft(null);
        await loadList();
        if (String(id) === idParam) {
            const response = await apiClient.post('', { request: 'guide_article', id });
            setArticle(response.data?.article ?? null);
        } else {
            navigate(`/guide?id=${id}`);
        }
    };

    if (!allowed) {
        return (
            <div className="gd_root"><style>{GUIDE_CSS}</style>
                <div className="gd_denied">業務ガイドは、いまは注文営業・建売営業・中古リノベの方向けです。</div>
            </div>
        );
    }

    return (
        <div className="gd_root">
            <style>{GUIDE_CSS}</style>
            <header className="gd_top">
                <button type="button" className="gd_menu_btn" onClick={() => setNavOpen((v) => !v)} aria-label="目次を開く" aria-expanded={navOpen}>☰</button>
                <button type="button" className="gd_brand" onClick={goHome}>業務ガイド</button>
                {/* ⚠️ 事業の切り替え。⚠️ 1つしか見られない人には札として出す（押せない） */}
                <div className="gd_divs" role="group" aria-label="事業">
                    {GUIDE_DIVISIONS.filter((d) => allowedDivisions.includes(d.value)).map((d) => (
                        <button key={d.value} type="button" aria-pressed={d.value === division}
                            className={`gd_div${d.value === division ? ' is_active' : ''}`}
                            style={{ '--gd-div': d.color } as React.CSSProperties}
                            disabled={allowedDivisions.length === 1}
                            onClick={() => { setDivision(d.value); goHome(); }}>
                            {d.label}
                        </button>
                    ))}
                </div>
                <input className="gd_search" type="search" placeholder="記事を探す（例：契約、来場）" value={keyword}
                    onChange={(e) => { setKeyword(e.target.value); setNavOpen(true); }} aria-label="記事を探す" />
                {canEdit && (
                    <button type="button" className="gd_btn is_primary gd_new" onClick={() => setDraft(emptyDraft(sections[0] ?? '用語', division))}>
                        記事を作る
                    </button>
                )}
            </header>

            <div className={`gd_body${draft ? ' is_editing' : ''}`}>
                <nav className={`gd_nav${navOpen ? ' is_open' : ''}`} aria-label="記事の目次">
                    {bySection.map((g) => (
                        <div key={g.section} className="gd_nav_group">
                            <div className="gd_nav_section">{g.section}</div>
                            {g.items.map((a) => (
                                <button key={a.id} type="button"
                                    className={`gd_nav_item${String(a.id) === idParam ? ' is_active' : ''}${a.published ? '' : ' is_hidden'}`}
                                    onClick={() => goArticle(a.id)}>
                                    {a.title}{!a.published && <span className="gd_badge">非公開</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                    {listLoaded && bySection.length === 0 && <div className="gd_empty">該当する記事がありません。</div>}
                </nav>

                <main className="gd_main">
                    {draft ? (
                        <GuideEditor key={`${draft.id ?? 'new'}-${draft.title}`} draft={draft} sections={sections} divisions={editorDivisions}
                            titleToId={titleToId} onSaved={onSaved} onCancel={() => setDraft(null)} />
                    ) : article ? (
                        <article className="gd_article">
                            <div className="gd_meta">
                                <span className="gd_tag">{article.section}</span>
                                {article.division === GUIDE_COMMON && <span className="gd_tag is_common">全事業共通</span>}
                                {!article.published && <span className="gd_badge">非公開</span>}
                                <span className="gd_updated">更新 {article.updated_at}{article.updated_by ? `（${article.updated_by}）` : ''}</span>
                                {canEdit && (
                                    <button type="button" className="gd_btn gd_edit" onClick={() => setDraft({
                                        id: article.id, title: article.title, division: article.division, section: article.section,
                                        summary: article.summary, body: article.body, sort: article.sort, published: article.published === 1,
                                    })}>直す</button>
                                )}
                            </div>
                            <h1 className="gd_h1">{article.title}</h1>
                            {article.summary && <p className="gd_lead">{article.summary}</p>}
                            <GuideMarkdown body={article.body} titleToId={titleToId} onOpen={openByTitle}
                                articleDivision={article.division === GUIDE_COMMON ? null : article.division} />
                        </article>
                    ) : (
                        <div className="gd_home">
                            {message !== '' && <div className="gd_error" role="status">{message}</div>}
                            <h1 className="gd_h1">業務ガイド（{divisionLabel}）</h1>
                            <p className="gd_lead">ダッシュボードの使い方と、{divisionLabel}の業務の流れをまとめています。作業中の画面と並べて読めるよう、別のウインドウで開いています。</p>
                            <div className="gd_cards">
                                {bySection.map((g) => (
                                    <section key={g.section} className="gd_card">
                                        <h2 className="gd_card_title">{g.section}</h2>
                                        <ul>
                                            {g.items.map((a) => (
                                                <li key={a.id}>
                                                    <button type="button" className="gd_card_link" onClick={() => goArticle(a.id)}>{a.title}</button>
                                                    {a.summary && <div className="gd_card_sub">{a.summary}</div>}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {!draft && article && headings.length > 0 && (
                    <aside className="gd_toc" aria-label="この記事の見出し">
                        <div className="gd_toc_title">この記事の見出し</div>
                        {headings.map((h) => (
                            <button key={h.id} type="button" className={`gd_toc_item is_h${h.level}`} onClick={() => jump(h.id)}>{h.text}</button>
                        ))}
                    </aside>
                )}
            </div>
        </div>
    );
};

/**
 * ⚠️ GoogleReview.tsx に合わせた配色・角丸・文字の大きさ（接頭辞 gd_）。
 * ⚠️ 本文は読み物なので、表の画面より文字を大きく、行間を広く、1行を約40字までに抑える。
 * ⚠️ v2.2.198: 左メニューの業務ガイドの検索（GuideSearchPanel.tsx）でも記事の見た目に使う。
 */
export const GUIDE_CSS = `
.gd_root { position: fixed; inset: 0; display: flex; flex-direction: column; background: #fff; color: #1f2937;
           font-size: 13px; z-index: 1; }
.gd_top { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 20px;
          border-bottom: 1px solid #e5e7eb; background: #f8fafc; }
.gd_menu_btn { display: none; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 4px 10px; cursor: pointer; }
.gd_brand { border: none; background: none; padding: 0; cursor: pointer; font-weight: 700; font-size: 15px;
            letter-spacing: .02em; color: #0f766e; white-space: nowrap; }
.gd_divs { display: flex; gap: 4px; flex-shrink: 0; }
.gd_div { border: 1px solid #e5e7eb; background: #fff; color: #4b5563; border-radius: 999px; padding: 2px 10px;
          font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.gd_div:hover:not(:disabled) { border-color: var(--gd-div); color: var(--gd-div); }
.gd_div.is_active { background: var(--gd-div); border-color: var(--gd-div); color: #fff; }
.gd_div:disabled { cursor: default; }
.gd_search { flex: 1 1 auto; max-width: 420px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.gd_search:focus, .gd_input:focus, .gd_textarea:focus { outline: 2px solid #99f6e4; border-color: #14b8a6; }
.gd_new { margin-left: auto; }

.gd_body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr) 210px; }
.gd_body.is_editing { grid-template-columns: 250px minmax(0, 1fr); }
.gd_nav { border-right: 1px solid #e5e7eb; overflow-y: auto; padding: 14px 10px 30px; background: #fff; }
.gd_nav_group + .gd_nav_group { margin-top: 14px; }
.gd_nav_section { font-size: 11px; font-weight: 700; color: #6b7280; padding: 0 8px 4px; letter-spacing: .04em; }
.gd_nav_item { display: block; width: 100%; text-align: left; border: none; background: none; border-radius: 8px;
               padding: 6px 8px; font-size: 13px; color: #1f2937; cursor: pointer; line-height: 1.5; }
.gd_nav_item:hover { background: #f1f5f9; }
.gd_nav_item.is_active { background: #ecfdf5; color: #0f766e; font-weight: 700; }
.gd_nav_item.is_hidden { color: #9ca3af; }
.gd_nav_item:focus-visible, .gd_card_link:focus-visible, .gd_toc_item:focus-visible, .gd_ref:focus-visible, .gd_div:focus-visible { outline: 2px solid #14b8a6; }
.gd_badge { margin-left: 6px; font-size: 10px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 999px; padding: 0 6px; }
.gd_empty { color: #9ca3af; font-size: 12px; padding: 8px; }

.gd_main { overflow-y: auto; padding: 28px 40px 80px; scroll-behavior: smooth; }
.gd_article, .gd_home { max-width: 44em; margin: 0 auto; }
.gd_meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.gd_tag { font-size: 11px; font-weight: 700; color: #0f766e; background: #ecfdf5; border-radius: 999px; padding: 2px 10px; }
.gd_tag.is_common { color: #4b5563; background: #f3f4f6; }
.gd_updated { font-size: 11px; color: #9ca3af; }
.gd_edit { margin-left: auto; }
.gd_h1 { font-size: 24px; font-weight: 700; line-height: 1.4; margin: 4px 0 8px; letter-spacing: .01em; }
.gd_lead { font-size: 14px; color: #4b5563; line-height: 1.8; margin: 0 0 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }

/* ⚠️ 本文。⚠️ 読み物なので 15px・行間 1.95 */
.gd_md { font-size: 15px; line-height: 1.95; }
.gd_md h2 { font-size: 19px; font-weight: 700; margin: 36px 0 10px; padding-top: 14px; border-top: 1px solid #e5e7eb; scroll-margin-top: 12px; }
.gd_md h3 { font-size: 16px; font-weight: 700; margin: 26px 0 8px; padding-left: 10px; border-left: 4px solid #14b8a6; scroll-margin-top: 12px; }
.gd_md p { margin: 0 0 14px; }
.gd_md ul, .gd_md ol { margin: 0 0 16px; padding-left: 1.5em; }
.gd_md li { margin: 4px 0; }
.gd_md ol > li::marker { font-weight: 700; color: #0f766e; }
.gd_md strong { background: linear-gradient(transparent 62%, #fef08a 62%); }
.gd_md code { font-size: 13px; background: #f3f4f6; border-radius: 4px; padding: 1px 6px; }
.gd_md hr { border: none; border-top: 1px dashed #e5e7eb; margin: 24px 0; }
.gd_md a { color: #2563eb; }
.gd_ref { border: none; background: none; padding: 0; font: inherit; color: #0f766e; font-weight: 700; cursor: pointer;
          text-decoration: underline; text-decoration-color: #99f6e4; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.gd_ref:hover { text-decoration-color: #0f766e; }
.gd_ref.is_missing { color: #dc2626; text-decoration-color: #fecaca; }
/* ⚠️ v2.2.196: 「画面を開く」ボタン（GuideScreenButton.tsx）。⚠️ 記事へのリンク（緑の下線）と見分けられるよう、青の枠付きの札 */
.gd_screen_wrap { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; vertical-align: baseline; }
.gd_screen { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8;
             border-radius: 999px; padding: 1px 12px 1px 9px; font: inherit; font-size: 13px; font-weight: 700; line-height: 1.7;
             cursor: pointer; white-space: nowrap; }
.gd_screen:hover:not(:disabled) { background: #dbeafe; border-color: #93c5fd; }
.gd_screen:focus-visible { outline: 2px solid #3b82f6; outline-offset: 1px; }
.gd_screen:disabled { background: #f3f4f6; border-color: #e5e7eb; color: #9ca3af; cursor: default; }
.gd_screen[aria-busy="true"] { cursor: progress; }
.gd_screen.is_missing { background: #fef2f2; border-color: #fecaca; color: #dc2626; cursor: default; }
.gd_screen_icon { font-size: 12px; }
/* ⚠️ 本文の画面の名前の後ろに付く小さいボタン（GuideMarkdown.tsx の expandMentions）。⚠️ 文の流れを崩さない大きさ */
.gd_screen.is_compact { font-size: 11px; line-height: 1.6; padding: 0 8px 0 6px; gap: 2px; margin: 0 3px; vertical-align: 1px; }
.gd_screen.is_compact .gd_screen_icon { font-size: 10px; }
.gd_screen_note { font-size: 12px; color: #6b7280; }
.gd_screen_note.is_ok { color: #0f766e; font-weight: 700; }
.gd_screen_note.is_error { color: #b91c1c; font-weight: 700; }
/* ⚠️ 開く前の確認（⚠️ 本文の段落の中に置くので span で組む。見た目はモーダル） */
.gd_confirm_back { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
                   background: rgba(15, 23, 42, .35); padding: 16px; }
.gd_confirm { display: flex; flex-direction: column; gap: 10px; width: min(100%, 440px); background: #fff; border-radius: 12px;
              padding: 18px 20px; box-shadow: 0 12px 32px rgba(15, 23, 42, .2); font-size: 14px; line-height: 1.8; cursor: default; }
.gd_confirm_title { font-size: 16px; font-weight: 700; color: #1f2937; }
.gd_confirm_text { color: #374151; }
.gd_confirm_text strong { display: block; margin-top: 4px; color: #b91c1c; background: none; }
.gd_confirm_actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.gd_callout { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; border: 1px solid; font-size: 14px; line-height: 1.85; }
.gd_callout p:last-child { margin-bottom: 0; }
.gd_callout.is_tip { background: #f0fdfa; border-color: #99f6e4; }
.gd_callout.is_warn { background: #fffbeb; border-color: #fde68a; color: #78350f; }
.gd_callout.is_check { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }

.gd_toc { border-left: 1px solid #e5e7eb; overflow-y: auto; padding: 28px 14px; }
.gd_toc_title { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 6px; }
.gd_toc_item { display: block; width: 100%; text-align: left; border: none; background: none; cursor: pointer;
               font-size: 12px; color: #4b5563; padding: 4px 6px; border-radius: 6px; line-height: 1.5; }
.gd_toc_item:hover { background: #f1f5f9; color: #0f766e; }
.gd_toc_item.is_h3 { padding-left: 18px; font-size: 11.5px; color: #6b7280; }

.gd_cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.gd_card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; background: #fff; }
.gd_card_title { font-size: 14px; font-weight: 700; color: #0f766e; margin: 0 0 8px; }
.gd_card ul { list-style: none; margin: 0; padding: 0; }
.gd_card li { padding: 6px 0; border-top: 1px solid #f1f5f9; }
.gd_card li:first-child { border-top: none; }
.gd_card_link { border: none; background: none; padding: 0; font-size: 14px; font-weight: 700; color: #1f2937; cursor: pointer; text-align: left; }
.gd_card_link:hover { color: #0f766e; text-decoration: underline; }
.gd_card_sub { font-size: 12px; color: #6b7280; line-height: 1.6; }

.gd_btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: #374151; white-space: nowrap; }
.gd_btn:hover { background: #f8fafc; }
.gd_btn.is_primary { background: #0f766e; border-color: #0f766e; color: #fff; }
.gd_btn.is_primary:hover { background: #115e59; }
.gd_btn:disabled { opacity: .6; cursor: default; }
.gd_error { font-size: 12px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
.gd_denied { margin: 80px auto; max-width: 30em; text-align: center; color: #4b5563; font-size: 14px; }

.gd_editor { max-width: 1200px; margin: 0 auto; }
.gd_editor_head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.gd_editor_title { font-weight: 700; font-size: 15px; }
.gd_editor_actions { margin-left: auto; display: flex; gap: 8px; }
.gd_form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; background: #f8fafc; border: 1px solid #e5e7eb;
           border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
.gd_field { display: flex; flex-direction: column; gap: 2px; }
.gd_field.is_wide { flex: 1 1 260px; }
.gd_field.is_narrow { width: 80px; }
.gd_field.is_full { flex: 1 1 100%; }
.gd_check { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding-bottom: 6px; }
.gd_label { font-size: 11px; font-weight: 700; color: #6b7280; }
.gd_input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; background: #fff; }
.gd_split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.gd_split_col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.gd_textarea { min-height: 60vh; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.8;
               font-family: ui-monospace, Consolas, 'BIZ UDGothic', monospace; resize: vertical; }
.gd_preview { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; min-height: 60vh; overflow: auto; }
.gd_syntax { font-size: 12px; color: #4b5563; margin-top: 6px; }
.gd_syntax summary { cursor: pointer; font-weight: 700; }
.gd_syntax dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 8px 0; }
.gd_syntax dd { margin: 0; }
.gd_syntax_screens { line-height: 1.8; }

/* ⚠️ 窓が狭いとき: 右の見出しを消す → さらに狭いと左の目次を開閉式にする */
@media (max-width: 1100px) {
  .gd_body { grid-template-columns: 230px minmax(0, 1fr); }
  .gd_toc { display: none; }
}
@media (max-width: 760px) {
  .gd_menu_btn { display: inline-block; }
  .gd_top { flex-wrap: wrap; }
  .gd_body, .gd_body.is_editing { grid-template-columns: minmax(0, 1fr); position: relative; }
  .gd_nav { display: none; position: absolute; inset: 0 30% 0 0; z-index: 3; box-shadow: 4px 0 16px rgba(15, 23, 42, .12); }
  .gd_nav.is_open { display: block; }
  .gd_main { padding: 20px 18px 60px; }
  .gd_split { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .gd_main { scroll-behavior: auto; } }
`;

export default Guide;
