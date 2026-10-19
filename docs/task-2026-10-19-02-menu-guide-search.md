# v2.2.198 左メニューに業務ガイドの検索を付ける（2026-10-19）

## 依頼（ReadMeClaude.md）
- `frontend/src/components/Menu.tsx`：ロゴの下・「全社報告用フォーマット」の上に検索バー（`const [searchGuide, setSearchGuide] = useState('')`）
- 入力があれば記事のタイトルに含むものを候補に出す。押したら右の帳票の場所（`isSp === false`）に title・section・summary・body を出す
- ボタンで該当コンポーネントも出せる。category と合わせた表示

## 決めたこと・指示書と違う点
- ⚠️ 指示書の `guide_history` は**直す前の内容（履歴）**の表。今の記事は `guide_article` なので、**検索も表示も guide_article**（② の既存の `guide_list`・`guide_article`）。⚠️ ②・① の変更なし。
- 候補は「いまの事業（category）＋全事業共通」の記事・公開中だけ・最大10件。事業の札（色は業務ガイドと同じ）と分類を付ける。
- 不動産企画係など、業務ガイドを見られない事業には検索バーを出さない（`isGuideCategory` ＋ `allowedGuideDivisions`）。
- 記事の一覧は**最初に文字を入れたときに1回だけ**取る（⚠️ Menu は PC 用・スマホ用で2回マウントされるため、`fetchGuideListOnce` で共有）。
- スマホ（`isSp`）は記事を押すと業務ガイドの画面（`/guide?title=`）に移る（既存の `openGuide`）。
- 記事の「画面を開く」は**この窓で開き、記事を閉じる**。中身は v2.2.196 の受け口（`useGuideScreenReceiver` の openRef）と同じ処理（事業の切り替え・ヘッダーのメニュー・権限の判定）。確認は事業を切り替えるときだけ。
- 記事の枠の右上はアクティブユーザーの枠（ActiveUser.tsx）が重なって押せないので、「× 閉じる」「別の窓で開く」は**左に寄せた**（Playwright で発見）。
- ページを移ったら（メニュー・画面を開く・事業の切り替え）記事を閉じる。Esc でも閉じる（⚠️ 画面のモーダルが開いているときはそちらに任せる）。

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components | **Menu.tsx** | 検索バー・候補・記事の枠の呼び出し。追加: `loadGuideList` `onSearchGuide` `guideSuggestions` `chooseGuide` `onSearchGuideKey` `markMatch` `GUIDE_SUGGEST_MAX` `GUIDE_SEARCH_CSS` |
| frontend/src/components/guide | **GuideSearchPanel.tsx（新規）** | 記事を右側に出す枠。`fetchGuideListOnce` `divisionLabelOf` `divisionColorOf` `GuideListItem` |
| 同上 | **useGuideScreenReceiver.ts** | `openGuideScreenHere`（ダッシュボードの中から画面を開く）を追加 |
| 同上 | **GuideScreenButton.tsx** | `onOpenedHere`（この窓で開くモード）を追加。⚠️ ガイドの窓での動きは変えていない |
| 同上 | **GuideMarkdown.tsx** | `onScreenOpened` を受けて GuideScreenButton に渡す |
| 同上 | **Guide.tsx** | CSS を `GUIDE_CSS` として export（記事の見た目を共有） |
| frontend/src/utils | version.ts | 2.2.198 |
| backend/scripts/sql | 2026-10-19_update_log_2.2.198.sql | update_log ＋ 記事1本（ローカル適用済み：no=297） |
| backend/scripts/guide/articles/common | screen-180.md | 記事「業務ガイドの使い方」に「## 左のメニューから探す」を追加 |

## 業務ガイドの記事
- **業務ガイドの使い方**（全事業共通）：「左のメニューから探す」の節を追加（探し方・出る記事・右側に出ること・閉じ方・画面を開くボタン・別の窓で開く・スマホの動き）。

## 確認（Playwright・`frontend/build`・応答は模擬、記事はローカルDBの guide_article 59本）
- 検索バーがロゴの下・全社報告用フォーマットの上にある。入力前は guide_list を取りに行かない（0回）→ 入力で1回だけ（2つの Menu でも1回）
- 注文営業で「契約」→ 6件、注文営業と全事業共通だけ。建売営業で「契約」→ 建売営業と全事業共通だけ
- 該当なし → 「該当する記事がありません」
- ↓・Enter で選べる。記事の枠はメニューの右（x=200）・ヘッダーの下。事業の札・分類・タイトル・概要・本文が出る。入力欄は空に戻る
- 記事どうしのリンク（顧客DB → 失注したら）で切り替わる
- 「× 閉じる」・Esc・左メニューの項目で閉じる
- 「反響一覧を開く」→ /list に移り、記事は閉じる。「重複反響サマリーを開く」（ヘッダーのメニュー）→ その画面のモーダルが開き、記事は閉じる
- 不動産企画係：検索バーなし。スマホ（390px）：候補を押すと /guide?id=8 に移る
- ガイドの窓の「画面を開く」は従来どおり（「ダッシュボードの窓で開きました」・ダッシュボード側が /list）
- ① 経由: `guide_list`・`guide_article` をトークン無しで ① に → 401（② まで届く）
- 型チェック: 既存の5件のみ（増えていない）。ビルド: main.8bec2bb0.js
- ⚠️ /list は模擬データ（空）で落ちるが、改修前からの模擬の都合（本番の応答では起きない）

## コード

### frontend/src/components/guide/GuideSearchPanel.tsx（新規・全文）
```tsx
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
```

### frontend/src/components/Menu.tsx（全文）
```tsx
import { useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useState, useContext, useMemo, useId } from 'react';
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from '../context/AuthContext';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import Logo from '../assets/images/logo.png';
import Estate from './Estate';
import { useIsSp } from '../utils/isSp';
import apiClient from "../utils/apiClient";
import { isPendingSync } from './list/listTags';
import { missingLostFields } from '../utils/informationUtils';
import GuideSearchPanel, { GuideListItem, divisionColorOf, divisionLabelOf, fetchGuideListOnce } from './guide/GuideSearchPanel';
import { GUIDE_COMMON, allowedGuideDivisions, isGuideCategory, openGuide } from './guide/openGuide';

type UnSync = { inquiry_date: string, sync: number, duplicate_flag: number, support_flag: number, black_flag: number };
type Cancel = Record<string, string>;
type Props = {
    key: number,
    onReload: () => void
};

// 💡 メニュー項目の型定義
type Badge = { label: string; top: string };
type MenuItem = {
    id: string;
    path: string;
    icon: string;
    // 💡 string から React.ReactNode に変更することで <span> 等のJSXが使用可能になります
    label: React.ReactNode;
    show: boolean;               // 表示条件
    exact?: boolean;             // パスの完全一致でアクティブ判定をするか
    activePaths?: string[];      // 複数のパスでアクティブ判定する場合
    isAdminOnly?: boolean;       // 管理者バッジを表示するか
    badges?: Badge[];            // 通知バッジの設定
};

/**
 * 進行中（または完了済み）の menu リクエスト。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **Menu は App.tsx で2箇所にマウントされている。**
 *   PC用（`.modal_menu`）とスマホ用（`.modal_menu_sp`）の両方が常に
 *   マウントされ、CSS で見た目だけを切り替えている。
 *   ⚠️ そのため何もしないと **useEffect が2回走り、同じデータを2回取る。**
 *     2026-09-14 の実測では 18.2MB を2回（3.25秒 / 2.88秒）取得していた。
 *
 * ⚠️ どちらか片方だけレンダリングする形にはできない。
 *   `useIsSp()` の初期値が false（PC扱い）なので、スマホでは
 *   「PC用がマウント → useEffect で判定 → 差し替え」となり**結局2回走る。**
 *
 * ⚠️ `key`（再読み込みのたびに変わる）が同じ間は同じ Promise を返す。
 *   完了後も保持するので、2つ目のインスタンスが後からマウントされても
 *   再取得しない。
 * ─────────────────────────────────────────────
 */
let menuRequest: { key: number, promise: Promise<any> } | null = null;

const fetchMenuOnce = (key: number) => {
    if (menuRequest && menuRequest.key === key) return menuRequest.promise;
    menuRequest = { key, promise: apiClient.post("", { request: "menu" }) };
    return menuRequest.promise;
};

const Menu = ({ key, onReload }: Props) => {
    const { authority, category, version, shopName } = useContext(AuthContext);
    const location = useLocation();
    const currentPath = location.pathname;
    const fullPath = location.pathname + location.search;
    const navigate = useNavigate();
    const isSp = useIsSp();

    /**
     * サーバーが数えた件数。
     * ⚠️ null なら旧形式（全件を受け取ってフロントで数える）。
     *   ⚠️ ① と ② の両方が新しい形になったら、旧経路ごと消してよい。
     */
    const [serverCounts, setServerCounts] = useState<{ sync: number, cancel: number, lost: number } | null>(null);
    const [unSyncList, setUnSyncList] = useState<UnSync[]>([]);
    const [sync, setSync] = useState(0);
    const [cancelList, setCancelList] = useState<Cancel[]>([]);
    const [cancel, setCancel] = useState(0);
    const [lost, setLost] = useState(0);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [estateId, setEstateId] = useState('');

    /**
     * 業務ガイドの検索（v2.2.198）。⚠️ 記事の一覧は最初に文字を入れたときに取る（⚠️ メニューを開くたびには取らない）。
     * ⚠️ 選んだ記事は PC なら右側（GuideSearchPanel）、スマホなら業務ガイドの窓で開く。
     */
    const [searchGuide, setSearchGuide] = useState('');
    const [guideList, setGuideList] = useState<GuideListItem[] | null>(null);
    const [guideListFailed, setGuideListFailed] = useState(false);
    const [guideActive, setGuideActive] = useState(0);
    const [guideId, setGuideId] = useState<number | null>(null);
    /** ⚠️ Menu は2回マウントされるので、候補の id は useId で分ける */
    const guideListId = useId();
    const canSearchGuide = isGuideCategory(category) && allowedGuideDivisions(authority, category, shopName).length > 0;

    const dateFormate = (value: string) => (value ?? '').replace(/\//g, '-');

    useEffect(() => {
        const fetchData = async () => {
            // ⚠️ 2箇所からマウントされるので、同じ key の間は1回しか取りに行かない
            const response = await fetchMenuOnce(key);
            const data = response.data ?? {};

            // ⚠️⚠️ **新旧どちらの応答でも動くようにしてある。**
            //   2026-09-14 にサーバー側で COUNT するよう変えた（18.2MB → 数十バイト）。
            //   ⚠️ ① と ② のどちらが応答するかで形が変わりうるため、
            //     デプロイの順序やフォールバックで壊れないよう両対応にしている。
            //   ⚠️ ① と ② の両方が新しい形になったら、下の旧経路は消してよい。
            if (typeof data.sync === 'number') {
                setServerCounts({ sync: data.sync, cancel: data.cancel ?? 0, lost: data.lost ?? 0 });
            } else {
                // 旧形式（全件を受け取ってフロントで数える）
                setServerCounts(null);
                setUnSyncList(data.inquiry ?? []);
                setCancelList(data.customer ?? []);
            }
        };
        fetchData();
        setMonthArray(getYearMonthArray(2025, 1).slice(5));
    }, [key]);

    useEffect(() => {
        // ⚠️ サーバーが数えてくれた場合はそのまま使う
        if (serverCounts) {
            setSync(serverCounts.sync);
            return;
        }
        const total = unSyncList.filter(c => {
            return monthArray.includes(c.inquiry_date.slice(0, 7)) && isPendingSync(c);
        }).length;
        setSync(total);
    }, [unSyncList, monthArray, serverCounts]);

    useEffect(() => {
        // ⚠️ サーバーが数えてくれた場合はそのまま使う
        if (serverCounts) {
            setCancel(serverCounts.cancel);
            setLost(serverCounts.lost);
            return;
        }
        const cancelLength = cancelList.filter(item => {
            const now = new Date();
            const today = now.getTime();
            const target = new Date(dateFormate(item.reserved_interview)).getTime();
            const base = new Date('2026-01-01').getTime();
            return target < today && base < target && (!item.interview && !item.cancel_status) && item.status !== '重複'
        }).length;
        setCancel(cancelLength);

        const lostLength = cancelList.filter(item => {
            const now = new Date();
            const today = now.getTime();
            const target = new Date(dateFormate(item.register)).getTime();
            const base = new Date('2026-06-01').getTime();
            /**
             * ⚠️⚠️ **判定は informationUtils の `missingLostFields()` に集約した**
             *   （2026-09-17）。⚠️ 以前はここに条件が写されており、
             *   ⚠️ **② が数えなかったときだけ古い基準の件数が出ていた。**
             * ⚠️ ここで条件を書き足さないこと。
             */
            return target < today && base < target && item.status === '失注' && missingLostFields(item).length > 0 && Number(item.trash) === 1;
        }).length
        setLost(lostLength);
    }, [cancelList, serverCounts]);

    const handleNavigate = (path: string) => {
        setGuideId(null);
        navigate(path, { state: { authority } });
    };

    // ⚠️ ページ・事業を移ったら記事を閉じる（⚠️ 記事の「画面を開く」で移ったときも）
    useEffect(() => { setGuideId(null); }, [fullPath, category]);

    const loadGuideList = () => {
        setGuideListFailed(false);
        fetchGuideListOnce().then(setGuideList).catch(() => setGuideListFailed(true));
    };

    const onSearchGuide = (value: string) => {
        setSearchGuide(value);
        setGuideActive(0);
        if (guideList === null && value.trim() !== '') loadGuideList();
    };

    /** 候補。⚠️ タイトルに含むもの・いまの事業と全事業共通の記事だけ・公開中だけ */
    const guideKeyword = searchGuide.trim().toLowerCase();
    const guideSuggestions = useMemo(() => {
        if (guideKeyword === '' || guideList === null) return [];
        return guideList
            .filter((a) => a.published !== 0 && (a.division === category || a.division === GUIDE_COMMON))
            .filter((a) => a.title.toLowerCase().includes(guideKeyword))
            .slice(0, GUIDE_SUGGEST_MAX);
    }, [guideList, guideKeyword, category]);

    const chooseGuide = (item: GuideListItem) => {
        setSearchGuide('');
        if (isSp) { openGuide(item.title); return; }
        setGuideId(item.id);
    };

    const onSearchGuideKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') { setSearchGuide(''); return; }
        if (guideSuggestions.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setGuideActive((i) => (i + 1) % guideSuggestions.length); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setGuideActive((i) => (i - 1 + guideSuggestions.length) % guideSuggestions.length); }
        if (e.key === 'Enter') { e.preventDefault(); chooseGuide(guideSuggestions[Math.min(guideActive, guideSuggestions.length - 1)]); }
    };

    /** タイトルの一致した部分に印を付ける */
    const markMatch = (title: string): React.ReactNode => {
        const at = title.toLowerCase().indexOf(guideKeyword);
        if (at < 0) return title;
        return <>{title.slice(0, at)}<mark>{title.slice(at, at + guideKeyword.length)}</mark>{title.slice(at + guideKeyword.length)}</>;
    };

    const checkIsActive = (item: MenuItem) => {
        if (item.activePaths) return item.activePaths.some(p => fullPath.includes(p));
        return item.exact ? fullPath === item.path : fullPath.includes(item.path);
    };

    const categoryMapping = {
        'order': { label: '注文営業', class: 'text-white bg-primary rounded px-2 py-0 ms-1' },
        'spec': { label: '建売営業', class: 'text-white bg-success rounded px-2 py-0 ms-1' },
        'used': { label: '中古リノベ', class: 'text-white bg-warning rounded px-2 py-0 ms-1' },
        'planner': { label: '不動産企画係', class: 'text-white bg-info rounded px-2 py-0 ms-1' },
    };

    const MENU_CONFIG: MenuItem[] = useMemo(() => [
        { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'planner', exact: true },
        { id: 'summary', path: '/summary', icon: 'fa-chart-line', label: 'チームサマリー', show: !isSp && category === 'planner', exact: true },
        { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'planner', exact: true },
        { id: 'leadSell', path: '/leadSell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'planner', exact: true },
        { id: 'leadBuy', path: '/leadBuy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'planner', exact: true },
        { id: 'report', path: '/leadOpportunity', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'planner', exact: true },
        { id: 'leadResale', path: '/leadResale', icon: 'fa-arrows-rotate', label: '買取再販案件', show: !isSp && category === 'planner', exact: true },
        {
            id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
            badges: (category === 'order' && sync > 0) ? [{ label: `未同期 ${sync}件`, top: '8px' }] : []
        },
        { id: 'list_renove', path: '/list?shop=renove', icon: 'fa-phone', label: '反響一覧', show: category === 'used', exact: true },
        {
            id: 'database', path: '/database', icon: 'fa-magnifying-glass', label: '顧客DB', show: category !== 'planner', exact: true,
            badges: category === 'order' ? [
                cancel > 0 ? { label: `来場未入力 ${cancel}件`, top: '2px' } : null,
                lost > 0 ? { label: `失注未入力 ${lost}件`, top: '16px' } : null
            ].filter(Boolean) as Badge[] : []
        },
        { id: 'rank', path: '/rank', icon: 'fa-person', label: '店舗・担当別反響', show: category !== 'planner', exact: true },
        { id: 'map', path: '/map', icon: 'fa-map', label: '反響MAP', show: category !== 'planner', exact: true },
        /**
         * ⚠️ 建売（spec）も 2026-09-16 から表示する。
         *   ⚠️ 画面（customer/CustomerKaeru.tsx）も ② の `customer:spec` も
         *     **元からあった**が、ここが `order` だけだったため
         *     ⚠️ **URL を直接開かないと辿り着けなかった。**
         *   ⚠️ `used`（中古）は画面が無いので出さない。
         */
        { id: 'customer', path: '/customer', icon: 'fa-mobile-screen', label: '販促媒体別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        /**
         * ⚠️⚠️ **建売（spec）にも出す**（2026-09-18 の指示で**戻した**）。
         *   ⚠️ 経緯: 2026-09-11 に `ShopKaeru.tsx` を足して spec にも出していたが、
         *     ⚠️ 2026-09-16 に「要件を整理するので一旦消す」と言われて外していた。
         *     ⚠️ ⚠️ **画面（shop/ShopKaeru.tsx）と ② の `shop:spec` は消していない**ので、
         *       この1行を戻すだけで済んだ。
         *   ⚠️ `used`（中古）は画面が無いので元から出していない。
         *
         * ⚠️⚠️ **建売では「販促媒体別広告費」と契約率の分母が違う**（2026-09-18 時点）。
         *   店舗別広告費（ShopKaeru） … 契約率 ＝ 契約 ÷ **接触数**
         *   販促媒体別広告費（CustomerKaeru） … 契約率 ＝ 契約 ÷ **申込**
         *   ⚠️ **同じ名前の列で数字が違う。** 揃えるかは利用者の判断を待っている。
         */
        { id: 'shop', path: '/shop', icon: 'fa-chart-pie', label: '店舗別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        { id: 'property_used', path: '/property', icon: 'fa-house', label: '掲載物件一覧', show: category === 'planner', exact: false },
        { id: 'broker', path: '/broker', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'planner', exact: false },
        { id: 'customerTrend', path: '/customerTrend', icon: 'fa-chart-bar', label: '販促媒体別反響推移', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
        { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'planner', exact: true },
        { id: 'calendar', path: '/calendar', icon: 'fa-calendar', label: 'カレンダー', show: !isSp && category === 'order', exact: true },
        { id: 'property_spec', path: '/property', icon: 'fa-house', label: '物件DB', show: !isSp && category === 'spec', exact: false },
        { id: 'campaign', path: '/campaign', activePaths: ['/campaign', '/editcampaign'], icon: 'fa-calendar-days', label: 'キャンペーン管理', show: !isSp && category === 'order' && (authority === "BrandAdmin" || authority === "Master"), isAdminOnly: true },
        { id: 'budget', path: '/budget', icon: 'fa-money-check', label: '予算詳細', show: !isSp && (authority === "BrandAdmin" || authority === "Master"), exact: false, isAdminOnly: true },
        { id: 'photo', path: '/photo', icon: 'fa-camera', label: 'K-snap登録', show: !isSp && category === 'order', exact: false },
        { id: 'photo', path: '/insideSales', icon: 'fa-camera', label: 'ISカレンダー', show: (authority === 'insideSales' || authority === 'Master') && category === 'order', exact: false, isAdminOnly: true },
    ], [isSp, category, authority, sync, cancel, lost]);

    if (currentPath === '/login' || currentPath === '/home') return null;

    return (
        <>
            <div className="d-md-flex flex-column p-2" style={{ height: '100vh', borderRight: '1px solid #D3D3D3', overflowY: 'auto' }}>
                <div className="menuLogo m-3 position-relative" style={{ cursor: 'pointer' }} onClick={() => handleNavigate("/home")}>
                    <img src={Logo} alt="PG-CLOUDダッシュボード" className="w-100" />
                    <div style={{ fontSize: '10px', bottom: '-10px', right: '0' }} className="position-absolute">
                        ver{version}
                        <span style={{ fontSize: '8px', textAlign: 'center' }} className={categoryMapping[category as keyof typeof categoryMapping]?.class || ''}>
                            {categoryMapping[category as keyof typeof categoryMapping]?.label || ''}
                        </span>
                    </div>
                </div>

                {canSearchGuide && (
                    <div className="mg_search">
                        <style>{GUIDE_SEARCH_CSS}</style>
                        <div className="mg_box">
                            <i className="fa-solid fa-book-open mg_icon" aria-hidden="true"></i>
                            <input type="search" className="mg_input" placeholder="業務ガイドを探す" value={searchGuide}
                                onChange={(e) => onSearchGuide(e.target.value)} onKeyDown={onSearchGuideKey}
                                role="combobox" aria-label="業務ガイドの記事を探す" aria-controls={guideListId} aria-expanded={guideKeyword !== ''} />
                        </div>
                        {guideKeyword !== '' && (
                            <ul className="mg_suggest" id={guideListId} role="listbox" aria-label="業務ガイドの記事">
                                {guideListFailed ? (
                                    <li className="mg_note">読み込めませんでした。<button type="button" className="mg_retry" onClick={loadGuideList}>もう一度</button></li>
                                ) : guideList === null ? (
                                    <li className="mg_note">読み込み中…</li>
                                ) : guideSuggestions.length === 0 ? (
                                    <li className="mg_note">該当する記事がありません</li>
                                ) : guideSuggestions.map((a, i) => (
                                    <li key={a.id} role="option" aria-selected={i === guideActive}
                                        className={`mg_item${i === guideActive ? ' is_active' : ''}`}
                                        onMouseEnter={() => setGuideActive(i)} onClick={() => chooseGuide(a)}>
                                        <span className="mg_title">{markMatch(a.title)}</span>
                                        <span className="mg_sub">
                                            <span className="mg_div" style={{ '--mg-div': divisionColorOf(a.division) } as React.CSSProperties}>{divisionLabelOf(a.division)}</span>
                                            {a.section}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {MENU_CONFIG.filter(item => item.show).map((item, index) => {
                    const isActive = checkIsActive(item);
                    return (
                        <div
                            key={`${item.id}-${index}`}
                            className={`position-relative category_menu ps-3 ${isActive ? "selected" : ""}`}
                            onClick={() => handleNavigate(item.path)}
                        >
                            <i className={`fa-solid ${item.icon} me-1 text-secondary`}></i>
                            {item.label}
                            {item.isAdminOnly && (
                                <span className="bg-primary text-white rounded ms-2" style={{ fontSize: '8px', padding: '1px 3px' }}>
                                    管理者専用
                                </span>
                            )}
                            {item.badges?.map((badge, idx) => (
                                <div key={idx} className="position-absolute menu_sync" style={{ top: badge.top, right: '10px' }}>
                                    {badge.label}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            <Estate estateId={estateId} setEstateId={setEstateId} />
            {guideId !== null && guideList !== null && !isSp && (
                <GuideSearchPanel articleId={guideId} articles={guideList} onSelect={setGuideId} onClose={() => setGuideId(null)} />
            )}
        </>
    );
}

/** 業務ガイドの検索の候補の数 */
const GUIDE_SUGGEST_MAX = 10;

/** 業務ガイドの検索（v2.2.198）。⚠️ 接頭辞 mg_。⚠️ 色は業務ガイド（Guide.tsx）に合わせる */
const GUIDE_SEARCH_CSS = `
.mg_search { margin: 4px 4px 10px; font-size: 12px; }
.mg_box { position: relative; }
.mg_icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-size: 11px; color: #0f766e; pointer-events: none; }
.mg_input { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 5px 8px 5px 26px; font-size: 12px; background: #f8fafc; color: #1f2937; }
.mg_input::placeholder { color: #9ca3af; }
.mg_input:focus { outline: 2px solid #99f6e4; border-color: #14b8a6; background: #fff; }
.mg_suggest { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;
              box-shadow: 0 6px 16px rgba(15, 23, 42, .08); max-height: 50vh; overflow-y: auto; }
.mg_item { display: flex; flex-direction: column; gap: 1px; padding: 5px 7px; border-radius: 6px; cursor: pointer; line-height: 1.4; }
.mg_item.is_active { background: #ecfdf5; }
.mg_title { font-weight: 700; color: #1f2937; word-break: break-all; }
.mg_title mark { padding: 0; background: linear-gradient(transparent 55%, #fef08a 55%); color: inherit; }
.mg_sub { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #6b7280; }
.mg_div { color: #fff; background: var(--mg-div); border-radius: 999px; padding: 0 6px; font-weight: 700; white-space: nowrap; }
.mg_note { padding: 6px 7px; color: #9ca3af; }
.mg_retry { border: none; background: none; padding: 0; color: #0f766e; font-weight: 700; text-decoration: underline; cursor: pointer; font-size: 12px; }
`;

export default Menu;
```

### 差分（guide/ の既存ファイル・version.ts・記事）
```diff
diff --git a/backend/scripts/guide/articles/common/screen-180.md b/backend/scripts/guide/articles/common/screen-180.md
index 3573ac95..679fca59 100644
--- a/backend/scripts/guide/articles/common/screen-180.md
+++ b/backend/scripts/guide/articles/common/screen-180.md
@@ -12,6 +12,17 @@ summary: このガイドの開き方と読み方。
 
 ガイドは**別のウインドウ**で開きます。作業中の画面と並べて読めます。何度押しても窓は1つで、中身が切り替わります。
 
+## 左のメニューから探す
+左のメニューのロゴの下に「業務ガイドを探す」の欄があります。記事のタイトルの一部（例：契約、来場）を入れると、合う記事が出ます。
+- 出るのは、いま選んでいる事業の記事と「全事業共通」の記事です。事業の印と分類が付きます
+- 記事を押すと、**ダッシュボードの右側（表や帳票の場所）**に記事が出ます。「× 閉じる」か Esc キーで閉じ、元の画面に戻ります
+- 記事の青いボタン（「↗ 〜を開く」）を押すと、記事を閉じてその画面が開きます
+- 緑の下線の言葉を押すと、同じ場所で別の記事に切り替わります
+- 「別の窓で開く」を押すと、ガイドの窓でその記事を開きます（作業中の画面と並べて読みたいとき）
+- 左のメニューで別の画面に移ると、記事は閉じます
+
+> スマホでは、記事を押すとガイドの画面に移ります。
+
 ## 事業の切り替え
 上の「注文営業」「建売営業」「中古リノベ」で、その事業の記事に切り替わります。はじめは、いま選んでいる事業の記事が出ます。全事業に関係する記事には「全事業共通」の印が付き、どの事業にも出ます。
 
diff --git a/frontend/src/components/guide/Guide.tsx b/frontend/src/components/guide/Guide.tsx
index 23bc61cc..41544ade 100644
--- a/frontend/src/components/guide/Guide.tsx
+++ b/frontend/src/components/guide/Guide.tsx
@@ -171,7 +171,7 @@ const Guide: React.FC = () => {
 
     if (!allowed) {
         return (
-            <div className="gd_root"><style>{CSS}</style>
+            <div className="gd_root"><style>{GUIDE_CSS}</style>
                 <div className="gd_denied">業務ガイドは、いまは注文営業・建売営業・中古リノベの方向けです。</div>
             </div>
         );
@@ -179,7 +179,7 @@ const Guide: React.FC = () => {
 
     return (
         <div className="gd_root">
-            <style>{CSS}</style>
+            <style>{GUIDE_CSS}</style>
             <header className="gd_top">
                 <button type="button" className="gd_menu_btn" onClick={() => setNavOpen((v) => !v)} aria-label="目次を開く" aria-expanded={navOpen}>☰</button>
                 <button type="button" className="gd_brand" onClick={goHome}>業務ガイド</button>
@@ -284,8 +284,9 @@ const Guide: React.FC = () => {
 /**
  * ⚠️ GoogleReview.tsx に合わせた配色・角丸・文字の大きさ（接頭辞 gd_）。
  * ⚠️ 本文は読み物なので、表の画面より文字を大きく、行間を広く、1行を約40字までに抑える。
+ * ⚠️ v2.2.198: 左メニューの業務ガイドの検索（GuideSearchPanel.tsx）でも記事の見た目に使う。
  */
-const CSS = `
+export const GUIDE_CSS = `
 .gd_root { position: fixed; inset: 0; display: flex; flex-direction: column; background: #fff; color: #1f2937;
            font-size: 13px; z-index: 1; }
 .gd_top { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 20px;
diff --git a/frontend/src/components/guide/GuideMarkdown.tsx b/frontend/src/components/guide/GuideMarkdown.tsx
index 2d42df67..84f44050 100644
--- a/frontend/src/components/guide/GuideMarkdown.tsx
+++ b/frontend/src/components/guide/GuideMarkdown.tsx
@@ -163,9 +163,11 @@ interface Props {
     onOpen: (title: string) => void;
     /** 記事の事業（⚠️ 全事業共通は null）。⚠️ 「画面を開く」でどの事業の画面を開くかに使う */
     articleDivision: string | null;
+    /** ⚠️ v2.2.198: 渡すと「画面を開く」をいまの窓で開き、開けたら呼ぶ（GuideScreenButton の onOpenedHere） */
+    onScreenOpened?: () => void;
 }
 
-const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen, articleDivision }) => (
+const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen, articleDivision, onScreenOpened }) => (
     <div className="gd_md">
         <ReactMarkdown
             components={{
@@ -173,7 +175,7 @@ const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen, articleDivisi
                     if (href === STRONG_HREF) return <strong>{children}</strong>;
                     // ⚠️ 本文の画面の名前の後ろの小さいボタン（expandMentions）。⚠️ 登録のある名前だけが来る
                     if (href !== undefined && href.startsWith(MINI_PREFIX)) {
-                        return <GuideScreenButton name={decodeURIComponent(href.slice(MINI_PREFIX.length))} articleDivision={articleDivision} compact />;
+                        return <GuideScreenButton name={decodeURIComponent(href.slice(MINI_PREFIX.length))} articleDivision={articleDivision} compact onOpenedHere={onScreenOpened} />;
                     }
                     if (href !== undefined && href.startsWith(SCREEN_PREFIX)) {
                         const name = decodeURIComponent(href.slice(SCREEN_PREFIX.length));
@@ -181,7 +183,7 @@ const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen, articleDivisi
                         if (GUIDE_SCREENS[name] === undefined) {
                             return <span className="gd_screen is_missing" title="この画面は登録されていません">{name}（画面の登録なし）</span>;
                         }
-                        return <GuideScreenButton name={name} articleDivision={articleDivision} />;
+                        return <GuideScreenButton name={name} articleDivision={articleDivision} onOpenedHere={onScreenOpened} />;
                     }
                     if (href !== undefined && href.startsWith(LINK_PREFIX)) {
                         const title = decodeURIComponent(href.slice(LINK_PREFIX.length));
diff --git a/frontend/src/components/guide/GuideScreenButton.tsx b/frontend/src/components/guide/GuideScreenButton.tsx
index d72937e1..19d3e76c 100644
--- a/frontend/src/components/guide/GuideScreenButton.tsx
+++ b/frontend/src/components/guide/GuideScreenButton.tsx
@@ -1,6 +1,7 @@
 import React, { useContext, useEffect, useRef, useState } from 'react';
 import AuthContext from '../../context/AuthContext';
-import { GuideReply, askDashboard, openDashboardWithScreen, screenBlockedReason } from './guideScreens';
+import { ScreenPlan, askDashboard, openDashboardWithScreen, planScreen, screenBlockedReason } from './guideScreens';
+import { openGuideScreenHere } from './useGuideScreenReceiver';
 
 /**
  * 記事の `[[画面:名前]]` から出す「画面を開く」ボタン（v2.2.196 新規）。⚠️ 見た目は Guide.tsx の CSS（gd_screen*）。
@@ -11,6 +12,9 @@ import { GuideReply, askDashboard, openDashboardWithScreen, screenBlockedReason
  *   ⚠️ 保存していない入力が消えることがあるため。⚠️ 事業を切り替えて開くときも確認を出す。
  *   ⚠️ 何も開いていなければ確認なしで開く。
  * ⚠️ 押せない画面（権限・スマホ）は灰色で、理由を横に出す（⚠️ 見た目だけ。権限は各画面と ② が守る）。
+ *
+ * ⚠️ v2.2.198: `onOpenedHere` を渡すと、**いまの窓（ダッシュボード）で開く**（左メニューの業務ガイドの検索 → GuideSearchPanel.tsx）。
+ *   ⚠️ 窓どうしのやりとりはしない。⚠️ 確認は事業を切り替えるときだけ（⚠️ 開いている画面は記事の後ろにあり、利用者が自分で見ている）。
  * ─────────────────────────────────────────────
  */
 interface Props {
@@ -22,17 +26,22 @@ interface Props {
      * ⚠️ 文字は「開く」だけ（⚠️ 名前は直前に書いてある）。⚠️ 押せない理由は横に出さず、マウスを当てたときの説明だけ（⚠️ 文が読みにくくなるため）
      */
     compact?: boolean;
+    /** いまの窓（ダッシュボード）で開く。⚠️ 開けたら呼ぶ（記事を閉じる） */
+    onOpenedHere?: () => void;
 }
 
+/** 開く前の確認に出す内容（⚠️ ガイドの窓では status の返事＝GuideReply をそのまま入れる） */
+type Confirming = { plan: ScreenPlan; openScreen: string | null };
+
 type Notice = { tone: 'ok' | 'error'; text: string } | null;
 
 const NOTICE_MS = 5000;
 
-const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = false }) => {
-    const { authority } = useContext(AuthContext);
+const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = false, onOpenedHere }) => {
+    const { authority, category, shopName } = useContext(AuthContext);
     const blocked = screenBlockedReason(name, authority);
     const [busy, setBusy] = useState(false);
-    const [confirming, setConfirming] = useState<GuideReply | null>(null);
+    const [confirming, setConfirming] = useState<Confirming | null>(null);
     const [notice, setNotice] = useState<Notice>(null);
     const openButtonRef = useRef<HTMLButtonElement | null>(null);
 
@@ -56,7 +65,15 @@ const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = f
         setNotice({ tone: 'ok', text: 'ダッシュボードを開き直して開きました' });
     };
 
+    const openHere = () => {
+        setConfirming(null);
+        const error = openGuideScreenHere(name, articleDivision);
+        if (error !== null) { setNotice({ tone: 'error', text: error }); return; }
+        onOpenedHere?.();
+    };
+
     const open = async () => {
+        if (onOpenedHere !== undefined) { openHere(); return; }
         setConfirming(null);
         setBusy(true);
         const reply = await askDashboard('open', name, articleDivision);
@@ -71,6 +88,13 @@ const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = f
     const onClick = async () => {
         if (blocked !== null || busy) return;
         setNotice(null);
+        if (onOpenedHere !== undefined) {
+            const plan = planScreen(name, articleDivision, category, shopName);
+            if (!plan.ok) { setNotice({ tone: 'error', text: plan.message }); return; }
+            if (plan.switchLabel !== null) { setConfirming({ plan, openScreen: null }); return; }
+            openHere();
+            return;
+        }
         setBusy(true);
         const reply = await askDashboard('status', name, articleDivision);
         setBusy(false);
@@ -84,7 +108,7 @@ const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = f
         <span className="gd_screen_wrap">
             <button type="button" className={`gd_screen${compact ? ' is_compact' : ''}`} onClick={onClick} disabled={blocked !== null || busy}
                 aria-busy={busy} aria-label={compact ? `${name}を開く` : undefined}
-                title={blocked ?? `ダッシュボードの窓で「${name}」を開く`}>
+                title={blocked ?? (onOpenedHere !== undefined ? `「${name}」を開く` : `ダッシュボードの窓で「${name}」を開く`)}>
                 <span className="gd_screen_icon" aria-hidden="true">↗</span>
                 {compact ? '開く' : `${name}を開く`}
             </button>
diff --git a/frontend/src/components/guide/useGuideScreenReceiver.ts b/frontend/src/components/guide/useGuideScreenReceiver.ts
index 7e0ce1b8..e141195a 100644
--- a/frontend/src/components/guide/useGuideScreenReceiver.ts
+++ b/frontend/src/components/guide/useGuideScreenReceiver.ts
@@ -26,6 +26,17 @@ interface Handlers {
     closeHeaderModals: () => void;
 }
 
+type OpenHere = (name: string, articleDivision: string | null) => string | null;
+let openHereRef: { current: OpenHere } | null = null;
+
+/**
+ * ダッシュボードの窓の中から画面を開く（v2.2.198 追加。左メニューの業務ガイドの検索 → GuideSearchPanel.tsx）。
+ * ⚠️ 中身は下の useGuideScreenReceiver の openRef と同じ（⚠️ 事業の切り替え・ヘッダーのメニュー・権限の判定も同じ）。
+ * ⚠️ 開けなければ、その理由。
+ */
+export const openGuideScreenHere: OpenHere = (name, articleDivision) =>
+    openHereRef === null ? `「${name}」は開けません。画面を再読み込みしてください。` : openHereRef.current(name, articleDivision);
+
 export const useGuideScreenReceiver = (handlers: Handlers): void => {
     const { authority, category, shopName, setCategory } = useContext(AuthContext);
     const navigate = useNavigate();
@@ -55,6 +66,12 @@ export const useGuideScreenReceiver = (handlers: Handlers): void => {
         return null;
     });
 
+    // ⚠️ openGuideScreenHere から呼べるようにする（⚠️ Header は1つだけなので、登録も1つ）
+    useEffect(() => {
+        openHereRef = openRef;
+        return () => { if (openHereRef === openRef) openHereRef = null; };
+    }, []);
+
     useEffect(() => {
         const onMessage = (event: MessageEvent) => {
             if (event.origin !== window.location.origin || !isGuideRequest(event.data)) return;
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 27f903be..26da651c 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.197';
+export const newVersion = '2.2.198';
```
