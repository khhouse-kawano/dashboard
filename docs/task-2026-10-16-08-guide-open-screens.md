# 2026-10-16 業務ガイドの記事から画面を開く（v2.2.196）

## 依頼
- 業務ガイドの記事から、ダッシュボードの見方に加えて帳票・編集画面（コンポーネント）へ移動したい
- 決めたこと（相談のうえ）:
  - 書き方は `[[画面:名前]]`。行き先はページ（左のメニュー）とヘッダーのメニューの画面
  - **開くのはダッシュボードの窓**（ガイドの窓は残す）
  - **ダッシュボードの窓で何か画面を開いていたら確認を出す**（保存していない内容が消えることがあるため）
  - 特定のお客様の画面まで開くのは対象外
- 途中の追加指示: 「業務の流れの中で反響一覧などコンポネント名が出る場面では開くボタンを表示。それ以外のガイドでも同じく」
  → 本文に画面の名前が出てくると、表示のときに小さい「開く」ボタンを自動で付ける（記事を1本ずつ書き換えない。現場で直した記事にも効く）

## しくみ
1. ガイドの窓 → ダッシュボードの窓（`window.opener.postMessage`）: 「この画面を開ける？」
2. ダッシュボードの窓 → ガイド: 開けるか・どの事業で開くか・いま開いている画面の名前（`.modal.show` の見出し。要確認 DailyAction は数えない）
3. 開いている画面がある、または事業を切り替えるときは **ガイドの窓**で確認（やめる／開く。Esc で閉じる）
4. 「開く」→ ダッシュボードの窓でページへ移動（Menu.tsx と同じ `navigate(path, { state: { authority } })`）またはヘッダーのメニューを開く。ヘッダーのモーダルは先に閉じる
- ダッシュボードの窓が無い・答えない（1.2秒）ときは `/dashboard/home?guide_screen=名前` を名前付きの窓（khg-dashboard）で開き直す。受け取った側が読んで URL から消す
- 事業の切り替え: 記事の事業（共通の記事はいまの事業）でページを選ぶ。担当事業が all か同じ事業なら setCategory ＋ markCategoryChosen（Category.tsx と同じ）。それ以外は「担当の事業ではないため開けません」
- 押せない画面（権限・スマホでのメニュー画面）は灰色で理由を出す（見た目だけ。権限は各画面と ② が守る。メニューは Header.tsx 側でも menuMapping にある項目か確かめる）
- スマホ判定: 「名前（khg-business-guide）の付いた別ウインドウ＝PC」「それ以外で幅 768px 未満＝スマホ」
  - ⚠️ 最初は窓の幅で判定していた → ガイドの窓は画面の半分（720px）で開くため PC でもスマホ扱いになった（テストで発覚・修正）
  - ⚠️ 次に「元の窓があるか」で判定した → PC で元の窓を閉じるとスマホ扱いになり、開き直しが同じタブで起きた（テストで発覚・修正）

## 本文の自動ボタン（expandMentions）
- `「顧客DB」`・`「反響管理 → 重複反響サマリー」`（メニューの道順は menu が一致する画面だけ）・`[[顧客DB]]`・`[[反響一覧（建売営業）]]` … 行ごとに1回
- かぎかっこ無しの名前（`顧客DBに載せる`）… **その記事で最初の1回だけ**。長い名前から探す。カレンダー・マーケット情報・店舗編集・権限編集はかぎかっこ・リンクのときだけ
- 付けない: 見出しの行、コードの中、`[[画面:同じ名前]]` の大きいボタンがある記事
- 全記事で小さいボタン 41 個（Playwright で集計）

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/guide | **guideScreens.ts（新規）** | `GUIDE_SCREENS`（44画面）・`screenNameOf`・`screenBlockedReason`・`planScreen`・`askDashboard`・`replyToGuide`・`openDashboardWithScreen`・`openScreenLabel`・`isGuideRequest` |
| 〃 | **useGuideScreenReceiver.ts（新規）** | ダッシュボードの窓で受ける hook（postMessage と `?guide_screen=`） |
| 〃 | **GuideScreenButton.tsx（新規）** | 「画面を開く」ボタン（大・小 `compact`）と確認 |
| 〃 | GuideMarkdown.tsx | `[[画面:名前]]`・`expandMentions`・`encodeTarget`、props `articleDivision` |
| 〃 | Guide.tsx | `articleDivision` を渡す、CSS（gd_screen*・gd_confirm*・gd_syntax_screens） |
| 〃 | GuideEditor.tsx | 書き方に `[[画面:顧客DB]]` と画面の名前の一覧、プレビューに `articleDivision` |
| 〃 | openGuide.ts | `GUIDE_WINDOW` を export |
| frontend/src/components/header | Header.tsx | ドロップダウンの onClick の中身を **`openMenuItem(menu, item)`** に出した（中身は同じ。menuMapping に無い項目は false）。`closeHeaderModals` を追加。`useGuideScreenReceiver` を呼ぶ |
| backend/scripts/guide | build-guide-sql.cjs | `[[画面:名前]]` を guideScreens.ts の名前と照らして警告（記事へのリンクとしては数えない） |
| backend/scripts/guide/articles | 28本 | 画面の記事26本の最初の段落の下に `[[画面:名前]]`、業務ガイドの使い方・書き方に説明を追加 |
| backend/scripts/sql | 2026-10-16_update_log_2.2.196.sql（新規） | update_log 1行 ＋ 記事28本 |
| / | CLAUDE.md | 業務ガイドの書き方に `[[画面:名前]]` と、画面を足したら GUIDE_SCREENS も直すルール |
| frontend/src/utils | version.ts | 2.2.196 |

## 業務ガイドの記事（直したもの）
- 画面の記事（26本）: 最初の段落の下に「↗ ○○を開く」
  - common: 重複反響サマリー／紹介キャンペーンサマリー／営業別契約率／契約数ランキング／Claudeによる分析（＋Claudeによる競合分析）
  - order: 反響一覧／顧客DB／店舗・担当別反響／反響MAP／販促媒体別広告費／店舗別広告費／反響推移（2つ）／カレンダー／K-snap登録／全社報告用フォーマット／AIデジタル資金計画書（顧客DB）
  - spec: 反響一覧／顧客DB／店舗・担当別反響／広告費の画面（2つ）／物件DB／全社報告用フォーマット
  - used: 反響一覧／顧客DB／店舗・担当別反響／全社報告用フォーマット
- 業務ガイドの使い方: 「## 画面を開く」を追加（確認・事業の切り替え・開き直し・灰色のボタン・前に出ないとき）
- 業務ガイドの書き方: `[[画面:顧客DB]]` と、かぎかっこで書くと自動でボタンが付くこと
- 業務の流れ・用語の記事は書き換えていない（自動の小さいボタンで出る）

## 確かめたこと（Playwright。ダッシュボードの窓＋ヘッダーの「業務ガイド」で開いた別ウインドウ）
- a 何も開いていない → 確認なしで重複反響サマリーがダッシュボードの窓に開く、「ダッシュボードの窓で開きました」
- b 重複反響サマリーを開いたまま顧客DB → 確認（「重複反響サマリー」が開いています…）→ やめる → 変わらない
- c 確認 → 開く（Enter）→ /database へ移り、ヘッダーのモーダルは閉じた
- d Esc で確認が閉じる
- e 一般の人の営業別契約率は灰色「マネージャー・管理者だけが開ける画面です」、登録の無い名前は赤い札、コードの中はボタンにならない
- f ダッシュボードの窓を閉じる → 開き直して /rank。2回目は同じ窓（窓が増えない）でメニューの画面が開く
- 2 全事業の人: 建売営業の物件DB → 「建売営業に切り替えて開きます」→ /property・category=spec・要確認の事業も spec。共通の記事の顧客DB は今の事業のまま確認なし。中古リノベの反響一覧 → /list?shop=renove・used
- 3 担当が注文営業だけの人が建売の画面 → 「担当の事業ではないため開けません」
- 4 スマホ幅（同じタブ）: メニューの画面は灰色「PC で開いてください」、ページは同じタブで移る
- 5 ヘッダーのドロップダウン（重複反響サマリー・営業別契約率）は今まで通り開く／全59記事: 見出しにボタン無し・生の記号無し（「書き方」の記事はコードの例なので対象外）／小さいボタンで反響一覧が開く
- build-guide-sql.cjs: 登録の無い `[[画面:顧客データ]]` だけ警告、コードの中は無視
- 型チェック: 既存の5件のみ
- ⚠️ ② と ① の PHP は今回変更なし（新しい request なし）。① 経由の確認は対象外

## コード（新規ファイルは全文、変更は差分）

### frontend/src/components/guide/guideScreens.ts（新規）
```tsx
/**
 * 業務ガイドの記事から開ける画面の一覧と、ガイドの窓 ⇄ ダッシュボードの窓のやりとり（v2.2.196 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 記事には `[[画面:名前]]` と書く（GuideMarkdown.tsx が「画面を開く」ボタンにする）。
 *   ⚠️ 名前は下の GUIDE_SCREENS のキー。⚠️ 無い名前は赤い押せないボタンになる。
 *   ⚠️⚠️ **キーを足す・変えるときは、行を `    '名前': {` の形のまま書くこと。**
 *     ⚠️ backend/scripts/guide/build-guide-sql.cjs がこの形で名前を読み、記事の書き間違いを知らせている。
 *
 * ⚠️ 開くのは **ダッシュボードの窓**（ガイドを開いた元の窓 = window.opener）。ガイドの窓はそのまま残る。
 *   1. ガイド → 元の窓: 「この画面を開ける？」（status）
 *   2. 元の窓 → ガイド: 開けるか・何か画面を開いているか・事業を切り替えるか（status-reply）
 *   3. 何か開いていれば、ガイドの窓に確認を出す（⚠️ 保存していない内容が消えることがあるため。2026-10-16 の指示）
 *   4. ガイド → 元の窓: 「開いて」（open）
 *   ⚠️ 元の窓が無い・答えない（閉じた・ログアウトした・スマホで同じタブ）ときは、
 *     ⚠️ ダッシュボードを `?guide_screen=名前` 付きで開き直す（Header.tsx の useGuideScreenReceiver が読む）。
 *
 * ⚠️⚠️ **ここで画面を隠すのは見た目だけ。** 権限は各画面と ② が守る。
 *   ⚠️ メニューの画面は、受け取った側（Header.tsx）が自分のメニューに出ている項目かも確かめる。
 * ─────────────────────────────────────────────
 */

import { GUIDE_WINDOW } from './openGuide';

export type GuideDivision = 'order' | 'spec' | 'used';

export interface GuideScreen {
    /** 左のメニューのページ。⚠️ 事業でページが違えば事業ごとに書く */
    route?: string | Partial<Record<GuideDivision, string>>;
    /** ヘッダーのメニュー（`メニュー/項目`。Header.tsx の editMapping・menuMapping と同じ形） */
    menu?: string;
    /** ヘッダー左上の「Claudeによる分析」 */
    claude?: true;
    /** ページのある事業（⚠️ route が文字列のとき必須。事業ごとに書いたときはそのキー）。⚠️ 無ければどの事業でも開ける */
    divisions?: GuideDivision[];
    /** 開ける権限（⚠️ 無ければ全員） */
    authority?: string[];
    /** PC でしか開けない（⚠️ メニュー・Claude はいつも PC だけ） */
    pcOnly?: true;
}

const ADMIN = ['Master', 'BrandAdmin'];

/* ⚠️ build-guide-sql.cjs はこの印から下の `    '名前': {` を読む（GUIDE_SCREENS_BEGIN 〜 END） */
// GUIDE_SCREENS_BEGIN
export const GUIDE_SCREENS: Record<string, GuideScreen> = {
    // ── 左のメニュー（Menu.tsx の MENU_CONFIG と同じ条件）
    '全社報告用フォーマット': { route: '/company', divisions: ['order', 'spec', 'used'] },
    '反響一覧': {
        route: { order: '/list', spec: '/list', used: '/list?shop=renove' },
    },
    '顧客DB': { route: '/database', divisions: ['order', 'spec', 'used'] },
    '店舗・担当別反響': { route: '/rank', divisions: ['order', 'spec', 'used'] },
    '反響MAP': { route: '/map', divisions: ['order', 'spec', 'used'] },
    '販促媒体別広告費': { route: '/customer', divisions: ['order', 'spec'], pcOnly: true },
    '店舗別広告費': { route: '/shop', divisions: ['order', 'spec'], pcOnly: true },
    '販促媒体別反響推移': { route: '/customerTrend', divisions: ['order', 'spec'], pcOnly: true },
    '店舗別反響推移': { route: '/shopTrend', divisions: ['order', 'spec', 'used'], pcOnly: true },
    'カレンダー': { route: '/calendar', divisions: ['order'], pcOnly: true },
    'K-snap登録': { route: '/photo', divisions: ['order'], pcOnly: true },
    '物件DB': { route: '/property', divisions: ['spec'], pcOnly: true },
    'キャンペーン管理': { route: '/campaign', divisions: ['order'], authority: ADMIN, pcOnly: true },
    '予算詳細': { route: '/budget', divisions: ['order', 'spec', 'used'], authority: ADMIN, pcOnly: true },
    'マーケット情報': { route: '/market' },
    // ── ヘッダーのメニュー（Header.tsx の menuMapping と同じ条件）
    'Claudeによる分析': { claude: true },
    '重複反響サマリー': { menu: '反響管理/重複反響サマリー' },
    'ブラックリスト設定': { menu: '反響管理/ブラックリスト設定' },
    '事後アンケート': { menu: '反響管理/事後アンケート' },
    '広告費シミュレーター': { menu: '反響管理/広告費シミュレーター', authority: ['Master'] },
    '紹介キャンペーンサマリー': { menu: '紹介キャンペーン/紹介キャンペーンサマリー' },
    '紹介キャンペーンの反響一覧': { menu: '紹介キャンペーン/反響一覧' },
    '月次日報': { menu: '活動サマリー/月次日報' },
    '営業別契約率': { menu: '活動サマリー/営業別契約率', authority: ADMIN },
    'アクションボード': { menu: '活動サマリー/アクションボード', divisions: ['order'] },
    '契約数ランキング': { menu: '活動サマリー/契約数ランキング' },
    '他社広告ライブラリ': { menu: '他社動向/他社広告ライブラリ' },
    '他社資料': { menu: '他社動向/他社資料' },
    '競合サマリー': { menu: '他社動向/競合サマリー' },
    'Claudeによる競合分析': { menu: '他社動向/Claudeによる競合分析' },
    '架電状況（注文営業）': { menu: '架電状況/注文営業' },
    '架電状況（建売営業）': { menu: '架電状況/建売営業' },
    '架電状況（中古営業）': { menu: '架電状況/中古営業' },
    'アンバサダー管理': { menu: '公式アンバサダー/アンバサダー管理' },
    'アンバサダーの反響一覧': { menu: '公式アンバサダー/反響一覧' },
    '集客イベントの反響一覧': { menu: '集客イベント/反響一覧' },
    '集客サマリー': { menu: '集客イベント/集客サマリー' },
    'イベントの広告費入力': { menu: '集客イベント/広告費入力' },
    '口コミ集計': { menu: 'Google口コミ/口コミ集計' },
    '仲介物件登録': { menu: '土地・物件管理/仲介物件登録' },
    'SatBaseサマリー': { menu: '土地・物件管理/SatBaseサマリー' },
    '店舗編集': { menu: 'システム管理/店舗編集' },
    'スタッフ編集・追加': { menu: 'システム管理/スタッフ編集・追加' },
    '権限編集': { menu: 'システム管理/権限編集' },
};
// GUIDE_SCREENS_END

const DIVISION_LABEL: Record<GuideDivision, string> = { order: '注文営業', spec: '建売営業', used: '中古リノベ' };
const isDivision = (value: string): value is GuideDivision => value === 'order' || value === 'spec' || value === 'used';

/** ガイドを開いた元の窓（ダッシュボード）。⚠️ 同じアプリの窓だけを相手にする（⚠️ 元の窓が別のサイトへ移っていたら届かない＝答えが来ない） */
const dashboardWindow = (): Window | null => {
    const opener = window.opener as Window | null;
    return opener !== null && !opener.closed ? opener : null;
};

/**
 * スマホか。
 * ⚠️⚠️ **ガイドの窓の幅だけで決めない。** ⚠️ ガイドの窓は画面の半分（720px〜）で開くので、
 *   ⚠️ 窓の幅で見ると PC でもスマホ扱いになり、メニューの画面のボタンが押せなくなる（2026-10-16 にブラウザで確認）。
 * ⚠️ openGuide.ts は PC では名前（GUIDE_WINDOW）を付けた別ウインドウで開き、幅 768px 未満のときだけ同じタブで開く。
 *   ⚠️ なので「名前の付いた別ウインドウ＝PC」、「それ以外で窓が狭い＝スマホ（同じタブ）」と見る。
 *   ⚠️⚠️ 元の窓（opener）の有無では決めない（⚠️ PC で元の窓を閉じるとスマホ扱いになり、開き直しが同じタブで起きた。2026-10-16 に確認）。
 */
const isPhoneScreen = (): boolean => window.name !== GUIDE_WINDOW && window.innerWidth < 768;

/** 記事のタイトルの末尾の事業（`顧客DB（建売営業）` → `顧客DB`） */
const DIVISION_SUFFIX = /（(注文営業|建売営業|中古リノベ)）$/;

/**
 * 本文に出てくる言葉 → 開ける画面の名前（v2.2.196・2026-10-16 の指示「画面の名前が出るところには開くボタン」）。
 * ⚠️ GuideMarkdown.tsx の expandMentions が `「〜」` と `[[記事]]` に使う。⚠️ 当てはまらなければ null。
 *   `顧客DB` / `反響一覧（建売営業）` … そのまま（⚠️ 末尾の事業は外す）
 *   `反響管理 → 重複反響サマリー` … ヘッダーのメニューの道順。⚠️ **menu が `反響管理/重複反響サマリー` の画面だけ**
 *     （⚠️ 最後の言葉だけで探さない。`紹介キャンペーン → 反響一覧` が左のメニューの反響一覧にならないように）
 */
export const screenNameOf = (text: string): string | null => {
    const trimmed = text.trim();
    if (/[→>＞]/.test(trimmed)) {
        const menu = trimmed.split(/\s*[→>＞]\s*/).join('/');
        return Object.keys(GUIDE_SCREENS).find((name) => GUIDE_SCREENS[name].menu === menu) ?? null;
    }
    const name = trimmed.replace(DIVISION_SUFFIX, '');
    return GUIDE_SCREENS[name] === undefined ? null : name;
};

/** ページのある事業。⚠️ 空なら事業を問わない */
const divisionsOf = (screen: GuideScreen): GuideDivision[] => {
    if (screen.divisions) return screen.divisions;
    if (screen.route !== undefined && typeof screen.route !== 'string') return Object.keys(screen.route).filter(isDivision);
    return [];
};

/** PC だけの画面か。⚠️ ヘッダーのメニューと Claude はスマホに出していない（Header.tsx は PC だけ描く） */
const isPcOnly = (screen: GuideScreen): boolean => screen.pcOnly === true || screen.menu !== undefined || screen.claude === true;

/**
 * ガイドの窓でボタンを押せるか（⚠️ 見た目だけ。権限は各画面と ② が守る）。
 * @returns 押せなければその理由
 */
export const screenBlockedReason = (name: string, authority: string): string | null => {
    const screen = GUIDE_SCREENS[name];
    if (screen === undefined) return 'この画面はまだ登録されていません';
    if (screen.authority && !screen.authority.includes(authority)) {
        return screen.authority.length === 1 ? '管理者だけが開ける画面です' : 'マネージャー・管理者だけが開ける画面です';
    }
    if (isPcOnly(screen) && isPhoneScreen()) return 'PC で開いてください';
    return null;
};

/** 開き方を決めた結果（⚠️ ダッシュボードの窓で決める） */
export type ScreenPlan =
    | { ok: false; message: string }
    | { ok: true; division: GuideDivision | null; switchLabel: string | null; path: string | null };

/**
 * どの事業で・どのページを開くかを決める（⚠️ ダッシュボードの窓で呼ぶ）。
 * @param articleDivision 記事の事業（⚠️ 全事業共通の記事は null。そのときはいま選んでいる事業を優先）
 * @param category ダッシュボードで選んでいる事業
 * @param shopName 担当事業（order / spec / used / all）。⚠️ 切り替えてよいかの判定は Category.tsx の goToDashboard と同じ
 */
export const planScreen = (name: string, articleDivision: string | null, category: string, shopName: string): ScreenPlan => {
    const screen = GUIDE_SCREENS[name];
    if (screen === undefined) return { ok: false, message: `「${name}」は開けません（画面の登録がありません）。` };
    const divisions = divisionsOf(screen);
    let division: GuideDivision | null = null;
    if (divisions.length > 0) {
        if (articleDivision !== null && isDivision(articleDivision) && divisions.includes(articleDivision)) division = articleDivision;
        else if (isDivision(category) && divisions.includes(category)) division = category;
        else division = divisions[0];
    }
    const switching = division !== null && division !== category;
    if (switching && shopName !== 'all' && shopName !== division) {
        return { ok: false, message: `「${name}」は${DIVISION_LABEL[division as GuideDivision]}の画面です。担当の事業ではないため開けません。` };
    }
    let path: string | null = null;
    if (typeof screen.route === 'string') path = screen.route;
    else if (screen.route !== undefined && division !== null) path = screen.route[division] ?? null;
    return { ok: true, division, switchLabel: switching ? DIVISION_LABEL[division as GuideDivision] : null, path };
};

// ── 窓どうしのやりとり ───────────────────────────
const MESSAGE = 'khg-guide-screen';
/** ⚠️ 元の窓が開き直したときの URL の目印（Header.tsx が読んで消す） */
export const SCREEN_PARAM = 'guide_screen';
export const DIVISION_PARAM = 'guide_division';

export type GuideRequest = { kind: typeof MESSAGE; step: 'status' | 'open'; id: string; name: string; articleDivision: string | null };
export type GuideReply = { kind: typeof MESSAGE; step: 'reply'; id: string; plan: ScreenPlan; openScreen: string | null };

export const isGuideRequest = (data: unknown): data is GuideRequest =>
    typeof data === 'object' && data !== null && (data as GuideRequest).kind === MESSAGE
    && ((data as GuideRequest).step === 'status' || (data as GuideRequest).step === 'open');

/** 答えを待つ時間。⚠️ 過ぎたら元の窓は無いものとして開き直す */
const REPLY_TIMEOUT_MS = 1200;

/** 元の窓へ送って答えを待つ。⚠️ 答えが来なければ null */
export const askDashboard = (step: 'status' | 'open', name: string, articleDivision: string | null): Promise<GuideReply | null> => {
    const target = dashboardWindow();
    if (target === null) return Promise.resolve(null);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
        const timer = window.setTimeout(() => { window.removeEventListener('message', onMessage); resolve(null); }, REPLY_TIMEOUT_MS);
        function onMessage(event: MessageEvent) {
            if (event.origin !== window.location.origin) return;
            const data = event.data as GuideReply;
            if (data?.kind !== MESSAGE || data.step !== 'reply' || data.id !== id) return;
            window.clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            resolve(data);
        }
        window.addEventListener('message', onMessage);
        try {
            const request: GuideRequest = { kind: MESSAGE, step, id, name, articleDivision };
            target.postMessage(request, window.location.origin);
        } catch {
            window.clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            resolve(null);
        }
    });
};

export const replyToGuide = (source: MessageEventSource | null, id: string, plan: ScreenPlan, openScreen: string | null): void => {
    if (source === null) return;
    const reply: GuideReply = { kind: MESSAGE, step: 'reply', id, plan, openScreen };
    (source as Window).postMessage(reply, window.location.origin);
};

/** ⚠️ 開き直したダッシュボードの窓の名前（⚠️ 2回目以降は同じ窓が切り替わる） */
const DASHBOARD_WINDOW = 'khg-dashboard';

/** 元の窓が無いとき: ダッシュボードを開き直してそこで開く。⚠️ スマホ（同じタブ）はこのタブで移る */
export const openDashboardWithScreen = (name: string, articleDivision: string | null): void => {
    const params = new URLSearchParams({ [SCREEN_PARAM]: name });
    if (articleDivision !== null) params.set(DIVISION_PARAM, articleDivision);
    // ⚠️ Router の basename（App.tsx の `/dashboard`）を含める。⚠️ /home は事業を選ぶ画面（ヘッダーは出ている）
    const url = `/dashboard/home?${params.toString()}`;
    if (isPhoneScreen()) { window.location.assign(url); return; }
    const opened = window.open(url, DASHBOARD_WINDOW);
    if (opened === null) { window.location.assign(url); return; }
    opened.focus();
};

/**
 * ダッシュボードの窓で開いている画面の名前（⚠️ 確認の文に使う）。⚠️ 何も開いていなければ null。
 * ⚠️ react-bootstrap のモーダルは `.modal.show` で出ている。
 * ⚠️⚠️ **要確認（DailyAction.tsx の `.da_head`）は数えない**（⚠️ 画面を移るたびに出るもので、閉じても困らない）。
 */
export const openScreenLabel = (): string | null => {
    const shown = Array.from(document.querySelectorAll('.modal.show')).filter((m) => m.querySelector('.da_head') === null);
    if (shown.length === 0) return null;
    const top = shown[shown.length - 1];
    const title = (top.querySelector('.modal-header')?.textContent ?? '').replace(/\s+/g, ' ').replace(/閉じる/g, '').trim();
    return title === '' ? '画面' : title.slice(0, 30);
};
```

### frontend/src/components/guide/useGuideScreenReceiver.ts（新規）
```tsx
import { useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { markCategoryChosen } from '../DailyAction';
import {
    DIVISION_PARAM, GUIDE_SCREENS, SCREEN_PARAM, isGuideRequest, openScreenLabel, planScreen, replyToGuide,
} from './guideScreens';

/**
 * 業務ガイドの「画面を開く」を、ダッシュボードの窓で受けて開く（v2.2.196 新規）。⚠️ Header.tsx で1回だけ呼ぶ。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 受け取り方は2つ（guideScreens.ts の説明）:
 *   1. ガイドの窓からの postMessage（status → open）
 *   2. 開き直したときの URL の目印 `?guide_screen=名前`（⚠️ 読んだら URL から消す）
 * ⚠️ ページはメニューと同じく `navigate(path, { state: { authority } })`（Menu.tsx の handleNavigate と同じ）。
 * ⚠️ 事業を切り替えるときは Category.tsx の goToDashboard と同じく setCategory ＋ markCategoryChosen。
 * ⚠️ ヘッダーで開いているモーダルは先に閉じる（⚠️ 開いたままページを移ると、新しいページの上に残る）。
 * ─────────────────────────────────────────────
 */
interface Handlers {
    /** ヘッダーのメニューの画面を開く。⚠️ そのメニューに出ていない項目（権限が無い）なら false */
    openMenuItem: (menu: string, item: string) => boolean;
    openClaude: () => void;
    /** ヘッダーが開いているモーダルを閉じる */
    closeHeaderModals: () => void;
}

export const useGuideScreenReceiver = (handlers: Handlers): void => {
    const { authority, category, shopName, setCategory } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    // ⚠️ message の受け口は1回だけ付ける。⚠️ 最新の値は ref から読む
    const latest = useRef({ handlers, authority, category, shopName, setCategory, navigate });
    latest.current = { handlers, authority, category, shopName, setCategory, navigate };

    /** 開く。⚠️ 開けなければ、その理由 */
    const openRef = useRef((name: string, articleDivision: string | null): string | null => {
        const { handlers: h, authority: a, category: c, shopName: s, setCategory: setC, navigate: nav } = latest.current;
        const plan = planScreen(name, articleDivision, c, s);
        if (!plan.ok) return plan.message;
        const screen = GUIDE_SCREENS[name];
        if (plan.switchLabel !== null && plan.division !== null) {
            setC(plan.division);
            markCategoryChosen(plan.division);
        }
        h.closeHeaderModals();
        if (screen.claude) { h.openClaude(); return null; }
        if (screen.menu !== undefined) {
            const [menu, item] = screen.menu.split('/');
            return h.openMenuItem(menu, item) ? null : `「${name}」はこのアカウントでは開けません。`;
        }
        if (plan.path === null) return `「${name}」は開けません。`;
        nav(plan.path, { state: { authority: a } });
        return null;
    });

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || !isGuideRequest(event.data)) return;
            const { step, id, name, articleDivision } = event.data;
            const { category: c, shopName: s } = latest.current;
            if (step === 'status') {
                replyToGuide(event.source, id, planScreen(name, articleDivision, c, s), openScreenLabel());
                return;
            }
            const error = openRef.current(name, articleDivision);
            replyToGuide(event.source, id, error === null ? planScreen(name, articleDivision, c, s) : { ok: false, message: error }, null);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // ⚠️ 開き直したときの目印。⚠️ 先に URL から消す（⚠️ 再読み込みでまた開かないように）
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const name = params.get(SCREEN_PARAM);
        if (name === null) return;
        const articleDivision = params.get(DIVISION_PARAM);
        params.delete(SCREEN_PARAM);
        params.delete(DIVISION_PARAM);
        const rest = params.toString();
        navigate(`${location.pathname}${rest === '' ? '' : `?${rest}`}`, { replace: true });
        const error = openRef.current(name, articleDivision);
        if (error !== null) window.alert(error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);
};
```

### frontend/src/components/guide/GuideScreenButton.tsx（新規）
```tsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import { GuideReply, askDashboard, openDashboardWithScreen, screenBlockedReason } from './guideScreens';

/**
 * 記事の `[[画面:名前]]` から出す「画面を開く」ボタン（v2.2.196 新規）。⚠️ 見た目は Guide.tsx の CSS（gd_screen*）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開くのはダッシュボードの窓（guideScreens.ts の説明）。⚠️ ガイドの窓はそのまま。
 * ⚠️⚠️ **ダッシュボードの窓で何か画面（モーダル）を開いていたら、ガイドの窓で確認を出す**（2026-10-16 の指示）。
 *   ⚠️ 保存していない入力が消えることがあるため。⚠️ 事業を切り替えて開くときも確認を出す。
 *   ⚠️ 何も開いていなければ確認なしで開く。
 * ⚠️ 押せない画面（権限・スマホ）は灰色で、理由を横に出す（⚠️ 見た目だけ。権限は各画面と ② が守る）。
 * ─────────────────────────────────────────────
 */
interface Props {
    name: string;
    /** 記事の事業（⚠️ 全事業共通の記事は null） */
    articleDivision: string | null;
    /**
     * 本文の画面の名前の後ろに付ける小さいボタン（GuideMarkdown.tsx の expandMentions）。
     * ⚠️ 文字は「開く」だけ（⚠️ 名前は直前に書いてある）。⚠️ 押せない理由は横に出さず、マウスを当てたときの説明だけ（⚠️ 文が読みにくくなるため）
     */
    compact?: boolean;
}

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const NOTICE_MS = 5000;

const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = false }) => {
    const { authority } = useContext(AuthContext);
    const blocked = screenBlockedReason(name, authority);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<GuideReply | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const openButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (notice === null) return;
        const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (confirming === null) return;
        openButtonRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirming]);

    /** ⚠️ ダッシュボードの窓が無い・答えないときは開き直す */
    const reopen = () => {
        openDashboardWithScreen(name, articleDivision);
        setNotice({ tone: 'ok', text: 'ダッシュボードを開き直して開きました' });
    };

    const open = async () => {
        setConfirming(null);
        setBusy(true);
        const reply = await askDashboard('open', name, articleDivision);
        setBusy(false);
        if (reply === null) { reopen(); return; }
        if (!reply.plan.ok) { setNotice({ tone: 'error', text: reply.plan.message }); return; }
        // ⚠️ 前に出せるかはブラウザしだい（⚠️ 出せなくても、開いたことは下の文で伝える）
        try { (window.opener as Window | null)?.focus(); } catch { /* 前に出せなくてもよい */ }
        setNotice({ tone: 'ok', text: 'ダッシュボードの窓で開きました' });
    };

    const onClick = async () => {
        if (blocked !== null || busy) return;
        setNotice(null);
        setBusy(true);
        const reply = await askDashboard('status', name, articleDivision);
        setBusy(false);
        if (reply === null) { reopen(); return; }
        if (!reply.plan.ok) { setNotice({ tone: 'error', text: reply.plan.message }); return; }
        if (reply.openScreen !== null || reply.plan.switchLabel !== null) { setConfirming(reply); return; }
        await open();
    };

    return (
        <span className="gd_screen_wrap">
            <button type="button" className={`gd_screen${compact ? ' is_compact' : ''}`} onClick={onClick} disabled={blocked !== null || busy}
                aria-busy={busy} aria-label={compact ? `${name}を開く` : undefined}
                title={blocked ?? `ダッシュボードの窓で「${name}」を開く`}>
                <span className="gd_screen_icon" aria-hidden="true">↗</span>
                {compact ? '開く' : `${name}を開く`}
            </button>
            {blocked !== null && !compact && <span className="gd_screen_note">{blocked}</span>}
            {notice !== null && <span className={`gd_screen_note is_${notice.tone}`} role="status">{notice.text}</span>}

            {confirming !== null && confirming.plan.ok && (
                <span className="gd_confirm_back" onClick={() => setConfirming(null)}>
                    <span className="gd_confirm" role="dialog" aria-modal="true" aria-labelledby="gd_confirm_title"
                        onClick={(e) => e.stopPropagation()}>
                        <span id="gd_confirm_title" className="gd_confirm_title">「{name}」を開きます</span>
                        {confirming.openScreen !== null && (
                            <span className="gd_confirm_text">
                                ダッシュボードの窓で「{confirming.openScreen}」が開いています。開くと、いまの画面は閉じるか後ろに隠れます。
                                <strong>保存していない内容は消えることがあります。</strong>
                            </span>
                        )}
                        {confirming.plan.switchLabel !== null && (
                            <span className="gd_confirm_text">ダッシュボードの事業を「{confirming.plan.switchLabel}」に切り替えて開きます。</span>
                        )}
                        <span className="gd_confirm_actions">
                            <button type="button" className="gd_btn" onClick={() => setConfirming(null)}>やめる</button>
                            <button type="button" className="gd_btn is_primary" ref={openButtonRef} onClick={open}>開く</button>
                        </span>
                    </span>
                </span>
            )}
        </span>
    );
};

export default GuideScreenButton;
```

### 変更したファイルの差分
```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index cebe57da..675c9309 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -53,16 +53,19 @@ MSYS_NO_PATHCONV=1 docker exec dashboard-mariadb-db-1 sh -c 'mariadb --default-c
 - ⚠️ **現場の人が画面で手直しした記事でも、エージェントの内容を最優先する**（上書きする）。上書きの直前の内容は、スクリプトが出す SQL が `guide_history` に残すので消えない。
 - ⚠️ タイトルを変えるときは、スクリプトの出力の前に `UPDATE guide_article SET title = '新' WHERE title = '旧';` を手で書く（書かないと別の記事として増える）。
 - ⚠️ タイトルは事業が違っても重複できない。建売・中古の記事は末尾に「（建売営業）」「（中古リノベ）」を付ける。
 - 書き方：
   - 読むのは現場の営業・マーケティング担当（非エンジニア）。
   - テーブル名・カラム名・システムの用語は出さない。
   - 表（`|` 区切り）は使えない。
   - 記事どうしのリンクは `[[タイトル]]`。
+  - 画面を開くボタンは `[[画面:名前]]`（v2.2.196〜）。名前は `frontend/src/components/guide/guideScreens.ts` の `GUIDE_SCREENS` のキー。画面を説明する記事には最初の段落の下に置く。
+    - 本文に画面の名前（`「顧客DB」`・`[[顧客DB]]`・かぎかっこ無しの初出）が出ると、表示のときに小さい「開く」ボタンが自動で付く（GuideMarkdown.tsx の expandMentions）。
+- ⚠️ **画面（ページ・ヘッダーのメニューの項目）を追加・改名したら、`GUIDE_SCREENS` にも登録・修正する**（ページは Menu.tsx の `MENU_CONFIG`、メニューは Header.tsx の `menuMapping` と同じ条件にそろえる）。⚠️ キーの行は `    '名前': {` の形を崩さない（記事のスクリプトがこの形で名前を読む）。
   - `> 注意：` は黄色、`> 要確認：` は赤（社内ルールなど現場で確かめること）、それ以外の `>` は緑の枠になる。
 
 # セキュリティと禁止事項
 - `.env` やクレデンシャル（パスワードやAPIキー等）が含まれるファイルは、いかなる理由があっても読み書きしないこと。
 - システム全体に影響を与える破壊的なコマンド（`rm -rf`, DBの削除など）は実行しないこと。
 - 実行すべきか迷うコマンドや処理については、必ずユーザーに事前確認すること。
 
 # コミュニケーション
diff --git a/backend/scripts/guide/build-guide-sql.cjs b/backend/scripts/guide/build-guide-sql.cjs
index 4514202a..4a73d1e7 100644
--- a/backend/scripts/guide/build-guide-sql.cjs
+++ b/backend/scripts/guide/build-guide-sql.cjs
@@ -31,16 +31,30 @@
 const fs = require('fs');
 const path = require('path');
 
 const DIR = path.join(__dirname, 'articles');
 const SECTIONS = ['業務の流れ', '画面の使い方', '用語'];
 const DIVISIONS = ['order', 'spec', 'used', 'common'];
 const MAX_BODY_BYTES = 60000; // ⚠️ ② の features/guide.ts と同じ上限
 const LINK = /\[\[([^[\]\n]+)\]\]/g;
+/** ⚠️ v2.2.196: `[[画面:名前]]`（画面を開くボタン）。⚠️ 記事へのリンクとしては数えない */
+const SCREEN = /^画面[:：](.+)$/;
+
+/**
+ * 画面の名前の一覧（frontend/src/components/guide/guideScreens.ts の GUIDE_SCREENS のキー）。
+ * ⚠️ `// GUIDE_SCREENS_BEGIN` 〜 `// GUIDE_SCREENS_END` の間の `    '名前': {` の行を読む（⚠️ あちらの説明のとおり、この形を崩さない）。
+ */
+const screenNames = (() => {
+  const file = path.join(__dirname, '../../../frontend/src/components/guide/guideScreens.ts');
+  const text = fs.readFileSync(file, 'utf8');
+  const block = /\/\/ GUIDE_SCREENS_BEGIN([\s\S]*?)\/\/ GUIDE_SCREENS_END/.exec(text);
+  if (block === null) throw new Error(`${file}: GUIDE_SCREENS_BEGIN / END の印がありません`);
+  return new Set([...block[1].matchAll(/^ {4}'([^']+)': \{/gm)].map((m) => m[1]));
+})();
 
 const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
 
 const parse = (file) => {
   const text = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
   const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
   if (m === null) throw new Error(`${file}: 先頭の --- で囲んだ見出し情報がありません`);
   const meta = Object.fromEntries(m[1].split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
@@ -69,16 +83,21 @@ const targets = process.argv.slice(2).length > 0
   ? process.argv.slice(2).map((f) => parse(f.split(path.sep).join('/').replace(/^.*articles\//, '')))
   : all;
 
 // ⚠️ [[ ]] の行き先が記事ファイルに無ければ知らせる（⚠️ 画面では赤いリンクになる）
 // ⚠️ コード（` ` と ``` の中）は書き方の例なので見ない（⚠️ 画面でもリンクにならない）
 const withoutCode = (body) => body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
 for (const a of targets) {
   for (const [, t] of withoutCode(a.body).matchAll(LINK)) {
+    const screen = SCREEN.exec(t.trim());
+    if (screen !== null) {
+      if (!screenNames.has(screen[1].trim())) process.stderr.write(`⚠️ ${a.file}: [[${t.trim()}]] の画面が guideScreens.ts にありません（赤い札になります）\n`);
+      continue;
+    }
     if (!titleCount.has(t.trim())) process.stderr.write(`⚠️ ${a.file}: [[${t.trim()}]] の記事がありません（赤いリンクになります）\n`);
   }
 }
 
 const out = [];
 out.push('-- ---------------------------------------------------------------');
 out.push(`-- 業務ガイドの記事（${targets.length}本）。backend/scripts/guide/build-guide-sql.cjs で作成`);
 out.push('-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）');
diff --git a/frontend/src/components/guide/Guide.tsx b/frontend/src/components/guide/Guide.tsx
index d3ca4d0c..23bc61cc 100644
--- a/frontend/src/components/guide/Guide.tsx
+++ b/frontend/src/components/guide/Guide.tsx
@@ -236,17 +236,18 @@ const Guide: React.FC = () => {
                                     <button type="button" className="gd_btn gd_edit" onClick={() => setDraft({
                                         id: article.id, title: article.title, division: article.division, section: article.section,
                                         summary: article.summary, body: article.body, sort: article.sort, published: article.published === 1,
                                     })}>直す</button>
                                 )}
                             </div>
                             <h1 className="gd_h1">{article.title}</h1>
                             {article.summary && <p className="gd_lead">{article.summary}</p>}
-                            <GuideMarkdown body={article.body} titleToId={titleToId} onOpen={openByTitle} />
+                            <GuideMarkdown body={article.body} titleToId={titleToId} onOpen={openByTitle}
+                                articleDivision={article.division === GUIDE_COMMON ? null : article.division} />
                         </article>
                     ) : (
                         <div className="gd_home">
                             {message !== '' && <div className="gd_error" role="status">{message}</div>}
                             <h1 className="gd_h1">業務ガイド（{divisionLabel}）</h1>
                             <p className="gd_lead">ダッシュボードの使い方と、{divisionLabel}の業務の流れをまとめています。作業中の画面と並べて読めるよう、別のウインドウで開いています。</p>
                             <div className="gd_cards">
                                 {bySection.map((g) => (
@@ -337,16 +338,42 @@ const CSS = `
 .gd_md strong { background: linear-gradient(transparent 62%, #fef08a 62%); }
 .gd_md code { font-size: 13px; background: #f3f4f6; border-radius: 4px; padding: 1px 6px; }
 .gd_md hr { border: none; border-top: 1px dashed #e5e7eb; margin: 24px 0; }
 .gd_md a { color: #2563eb; }
 .gd_ref { border: none; background: none; padding: 0; font: inherit; color: #0f766e; font-weight: 700; cursor: pointer;
           text-decoration: underline; text-decoration-color: #99f6e4; text-decoration-thickness: 2px; text-underline-offset: 3px; }
 .gd_ref:hover { text-decoration-color: #0f766e; }
 .gd_ref.is_missing { color: #dc2626; text-decoration-color: #fecaca; }
+/* ⚠️ v2.2.196: 「画面を開く」ボタン（GuideScreenButton.tsx）。⚠️ 記事へのリンク（緑の下線）と見分けられるよう、青の枠付きの札 */
+.gd_screen_wrap { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; vertical-align: baseline; }
+.gd_screen { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8;
+             border-radius: 999px; padding: 1px 12px 1px 9px; font: inherit; font-size: 13px; font-weight: 700; line-height: 1.7;
+             cursor: pointer; white-space: nowrap; }
+.gd_screen:hover:not(:disabled) { background: #dbeafe; border-color: #93c5fd; }
+.gd_screen:focus-visible { outline: 2px solid #3b82f6; outline-offset: 1px; }
+.gd_screen:disabled { background: #f3f4f6; border-color: #e5e7eb; color: #9ca3af; cursor: default; }
+.gd_screen[aria-busy="true"] { cursor: progress; }
+.gd_screen.is_missing { background: #fef2f2; border-color: #fecaca; color: #dc2626; cursor: default; }
+.gd_screen_icon { font-size: 12px; }
+/* ⚠️ 本文の画面の名前の後ろに付く小さいボタン（GuideMarkdown.tsx の expandMentions）。⚠️ 文の流れを崩さない大きさ */
+.gd_screen.is_compact { font-size: 11px; line-height: 1.6; padding: 0 8px 0 6px; gap: 2px; margin: 0 3px; vertical-align: 1px; }
+.gd_screen.is_compact .gd_screen_icon { font-size: 10px; }
+.gd_screen_note { font-size: 12px; color: #6b7280; }
+.gd_screen_note.is_ok { color: #0f766e; font-weight: 700; }
+.gd_screen_note.is_error { color: #b91c1c; font-weight: 700; }
+/* ⚠️ 開く前の確認（⚠️ 本文の段落の中に置くので span で組む。見た目はモーダル） */
+.gd_confirm_back { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
+                   background: rgba(15, 23, 42, .35); padding: 16px; }
+.gd_confirm { display: flex; flex-direction: column; gap: 10px; width: min(100%, 440px); background: #fff; border-radius: 12px;
+              padding: 18px 20px; box-shadow: 0 12px 32px rgba(15, 23, 42, .2); font-size: 14px; line-height: 1.8; cursor: default; }
+.gd_confirm_title { font-size: 16px; font-weight: 700; color: #1f2937; }
+.gd_confirm_text { color: #374151; }
+.gd_confirm_text strong { display: block; margin-top: 4px; color: #b91c1c; background: none; }
+.gd_confirm_actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
 .gd_callout { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; border: 1px solid; font-size: 14px; line-height: 1.85; }
 .gd_callout p:last-child { margin-bottom: 0; }
 .gd_callout.is_tip { background: #f0fdfa; border-color: #99f6e4; }
 .gd_callout.is_warn { background: #fffbeb; border-color: #fde68a; color: #78350f; }
 .gd_callout.is_check { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
 
 .gd_toc { border-left: 1px solid #e5e7eb; overflow-y: auto; padding: 28px 14px; }
 .gd_toc_title { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 6px; }
@@ -390,16 +417,17 @@ const CSS = `
 .gd_split_col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
 .gd_textarea { min-height: 60vh; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.8;
                font-family: ui-monospace, Consolas, 'BIZ UDGothic', monospace; resize: vertical; }
 .gd_preview { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; min-height: 60vh; overflow: auto; }
 .gd_syntax { font-size: 12px; color: #4b5563; margin-top: 6px; }
 .gd_syntax summary { cursor: pointer; font-weight: 700; }
 .gd_syntax dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 8px 0; }
 .gd_syntax dd { margin: 0; }
+.gd_syntax_screens { line-height: 1.8; }
 
 /* ⚠️ 窓が狭いとき: 右の見出しを消す → さらに狭いと左の目次を開閉式にする */
 @media (max-width: 1100px) {
   .gd_body { grid-template-columns: 230px minmax(0, 1fr); }
   .gd_toc { display: none; }
 }
 @media (max-width: 760px) {
   .gd_menu_btn { display: inline-block; }
diff --git a/frontend/src/components/guide/GuideEditor.tsx b/frontend/src/components/guide/GuideEditor.tsx
index da8d2bbc..a6803810 100644
--- a/frontend/src/components/guide/GuideEditor.tsx
+++ b/frontend/src/components/guide/GuideEditor.tsx
@@ -1,11 +1,13 @@
 import React, { useState } from 'react';
 import apiClient from '../../utils/apiClient';
 import GuideMarkdown from './GuideMarkdown';
+import { GUIDE_COMMON } from './openGuide';
+import { GUIDE_SCREENS } from './guideScreens';
 
 /**
  * 業務ガイドの記事を作る・直す画面（v2.2.194）。⚠️ Master / BrandAdmin だけに出す（Guide.tsx）。
  *
  * ⚠️ 権限の最終判定は ②（features/guide.ts の saveGuide）が行う。⚠️ ここで隠すのは見た目のためだけ。
  * ⚠️ 保存すると、直前の内容が変更履歴に残る（② 側）。
  */
 
@@ -30,16 +32,18 @@ interface Props {
     onSaved: (id: number) => void;
     onCancel: () => void;
 }
 
 const SYNTAX_HELP: [string, string][] = [
     ['## 見出し', '大きな見出し（右の目次に出る）'],
     ['### 小見出し', '小さな見出し（目次に出る）'],
     ['[[記事のタイトル]]', '別の記事へのリンク。まだ無い記事は赤になる'],
+    // ⚠️ v2.2.196: 画面を開くボタン（GuideScreenButton.tsx）。⚠️ 名前は guideScreens.ts に登録したものだけ
+    ['[[画面:顧客DB]]', 'ダッシュボードの窓でその画面を開くボタン。登録の無い名前は赤になる'],
     ['> 注意：〜', '黄色の注意枠'],
     ['> 要確認：〜', '赤い枠（現場で確かめてほしいこと）'],
     ['> 〜', '緑のポイント枠'],
     ['1. 〜', '番号付きの手順'],
     ['- 〜', '箇条書き'],
     ['**太字**', '強調'],
 ];
 
@@ -134,23 +138,26 @@ const GuideEditor: React.FC<Props> = ({ draft: initial, sections, divisions, tit
                     <details className="gd_syntax">
                         <summary>書き方</summary>
                         <dl>
                             {SYNTAX_HELP.map(([code, desc]) => (
                                 <React.Fragment key={code}><dt><code>{code}</code></dt><dd>{desc}</dd></React.Fragment>
                             ))}
                         </dl>
                         <p>表（｜で区切る書き方）は使えません。箇条書きか見出しで書いてください。</p>
+                        {/* ⚠️ v2.2.196: `[[画面:名前]]` に使える名前（guideScreens.ts の GUIDE_SCREENS） */}
+                        <p className="gd_syntax_screens"><b>画面の名前：</b>{Object.keys(GUIDE_SCREENS).join('、')}</p>
                     </details>
                 </div>
                 <div className="gd_split_col">
                     <div className="gd_label">プレビュー</div>
                     <div className="gd_preview">
                         <h1 className="gd_h1">{draft.title || '（タイトル）'}</h1>
-                        <GuideMarkdown body={draft.body} titleToId={titleToId} onOpen={() => undefined} />
+                        <GuideMarkdown body={draft.body} titleToId={titleToId} onOpen={() => undefined}
+                            articleDivision={draft.division === GUIDE_COMMON ? null : draft.division} />
                     </div>
                 </div>
             </div>
         </div>
     );
 };
 
 export default GuideEditor;
diff --git a/frontend/src/components/guide/GuideMarkdown.tsx b/frontend/src/components/guide/GuideMarkdown.tsx
index 2a7d51b5..2d42df67 100644
--- a/frontend/src/components/guide/GuideMarkdown.tsx
+++ b/frontend/src/components/guide/GuideMarkdown.tsx
@@ -1,74 +1,133 @@
 import React from 'react';
 import ReactMarkdown from 'react-markdown';
+import GuideScreenButton from './GuideScreenButton';
+import { GUIDE_SCREENS, screenNameOf } from './guideScreens';
 
 /**
  * 業務ガイドの本文（Markdown）を表示する（v2.2.194）。
  *
  * ─────────────────────────────────────────────
  * ⚠️ 独自の書き方（編集画面の「書き方」と同じ）:
  *   `[[タイトル]]`        … 別の記事へのリンク。⚠️ 記事があれば緑、まだ無ければ赤（編集できる人が押すと新規作成）
+ *   `[[画面:名前]]`       … ダッシュボードの窓でその画面を開くボタン（v2.2.196。GuideScreenButton.tsx）。⚠️ 名前は guideScreens.ts のキー
+ *   ⚠️ 書かなくても、`「顧客DB」` や `[[顧客DB]]` のように画面の名前が出てくると、後ろに小さい「開く」ボタンが付く（expandMentions）
  *   `> 注意：…`          … 黄色の注意枠
  *   `> 要確認：…`        … 赤い枠（⚠️ 社内ルールなど、現場で確かめてほしいこと）
  *   `> …`（上以外）       … 緑のポイント枠
  *   `## 見出し` `### 小見出し` … 右の目次に出る
  *
  * ⚠️⚠️ **表（| a | b |）は使えない。** ⚠️ 表の書き方（GFM）の部品を入れていないため。
  *   ⚠️ 箇条書きか見出しで書く（編集画面の「書き方」にも書いてある）。
  *
  * ⚠️ リンクは `#guide:<タイトル>` に置き換えてから渡す。
  *   ⚠️ `guide:` のような独自の先頭にすると react-markdown が安全のため URL を消す（⚠️ `#` で始めれば相対 URL 扱いで残る）。
  * ─────────────────────────────────────────────
  */
 
 const LINK_PREFIX = '#guide:';
+const SCREEN_PREFIX = '#screen:';
+/** `[[画面:名前]]`（⚠️ 全角の「：」も受ける）。⚠️ 記事へのリンクより先に置き換える */
+const SCREEN_LINK = /\[\[画面[:：]([^[\]\n]+)\]\]/g;
 const STRONG_HREF = '#guide-strong';
 
 /**
  * コードの外側だけに置き換えをかける。
  * ⚠️ `` ` ``で囲んだところと ``` のブロックの中は書き方の例なので、そのまま出す（⚠️ 「書き方」の記事の `[[ ]]` がリンクにならないように）。
  */
 const outsideCode = (body: string, replace: (text: string) => string): string => {
     let inFence = false;
     return body.split('\n').map((line) => {
         if (/^```/.test(line.trim())) { inFence = !inFence; return line; }
         if (inFence) return line;
         return line.split(/(`[^`]*`)/).map((part, i) => (i % 2 === 1 ? part : replace(part))).join('');
     }).join('\n');
 };
 
-/** `[[タイトル]]` → `[タイトル](#guide:…)`。⚠️ 丸括弧はリンクの区切りと紛れるので符号化する */
+/** ⚠️ 丸括弧はリンクの区切りと紛れるので符号化する */
+const encodeTarget = (text: string): string => encodeURIComponent(text.trim()).replace(/\(/g, '%28').replace(/\)/g, '%29');
+
+/** `[[画面:名前]]` → `[名前](#screen:…)`、`[[タイトル]]` → `[タイトル](#guide:…)` */
 const expandLinks = (body: string): string =>
-    outsideCode(body, (text) => text.replace(/\[\[([^[\]\n]+)\]\]/g, (_, title: string) => {
-        const target = encodeURIComponent(title.trim()).replace(/\(/g, '%28').replace(/\)/g, '%29');
-        return `[${title.trim()}](${LINK_PREFIX}${target})`;
-    }));
+    outsideCode(body, (text) => text
+        .replace(SCREEN_LINK, (_, name: string) => `[${name.trim()}](${SCREEN_PREFIX}${encodeTarget(name)})`)
+        .replace(/\[\[([^[\]\n]+)\]\]/g, (_, title: string) => `[${title.trim()}](${LINK_PREFIX}${encodeTarget(title)})`));
 
 /**
  * `**太字**` → `[太字](#guide-strong)`（表示は <strong>）。
  *
  * ⚠️⚠️ **Markdown の規則では、日本語の太字が閉じないことがある。**
  *   ⚠️ 例: `**「契約済み」**のお客様` … 閉じる `**` の前が「」」、後ろが「の」なので太字の終わりと認められず、
  *     ⚠️ `**` がそのまま文字で出る（2026-10-16 に画面で確認）。⚠️ 現場の人が書く記事では避けようがない。
  *   ⚠️ リンクの形には前後の文字の決まりが無いので、太字をリンクの形に置き換えてから渡す。
  * ⚠️ `[` `]` や `` ` `` を含む太字は置き換えない（⚠️ リンクの中にリンクは作れないため。従来の書き方のまま）。
  * ⚠️ コードの中は置き換えない（outsideCode）。
  */
 const expandStrong = (body: string): string =>
     outsideCode(body, (text) => text.replace(/\*\*([^*\n`[\]]+?)\*\*/g, `[$1](${STRONG_HREF})`));
 
-const expandGuideLinks = (body: string): string => expandLinks(expandStrong(body));
+/**
+ * 画面の名前が出てくるところに、小さな「開く」ボタンを足す（v2.2.196・2026-10-16 の指示）。
+ * ⚠️ 対象: `「顧客DB」`・`「反響管理 → 重複反響サマリー」`・`[[顧客DB]]`・`[[反響一覧（建売営業）]]`（言葉の判定は guideScreens.ts の screenNameOf）。
+ * ⚠️ 足さないところ:
+ *   - 見出しの行（⚠️ 右の目次の文字に混ざるため）・コードの中（outsideCode）
+ *   - 記事に `[[画面:同じ名前]]` の大きいボタンがある画面（⚠️ 同じボタンが並ばないように）
+ *   - 同じ行の2回目以降（⚠️ 1行にボタンが並びすぎないように）
+ * ⚠️ 太字の置き換え（expandStrong）の**後**に呼ぶ。⚠️ 太字になった `[「顧客DB」](#guide-strong)` は、その後ろに足す
+ *   （⚠️ リンクの文字の中にリンクは作れない）。
+ */
+const MINI_PREFIX = '#screen-mini:';
+/**
+ * かぎかっこ・リンクの無い名前（`顧客DBに載せる`）にも付ける（2026-10-16 の追加指示「名前が出るところには開くボタン」）。
+ * ⚠️⚠️ **その記事で最初に出たところだけ**（⚠️ 「顧客DB」は1本の記事に何度も出るので、全部に付けると読めない）。
+ * ⚠️ 長い名前から探す（⚠️ `紹介キャンペーンの反響一覧` の中の `反響一覧` を左のメニューの反響一覧にしない）。
+ * ⚠️ ふつうの言葉としても使う名前は、かぎかっこ・リンクのときだけ（BARE_EXCLUDE）。
+ */
+const BARE_EXCLUDE = new Set(['カレンダー', 'マーケット情報', '店舗編集', '権限編集']);
+const BARE_NAMES = Object.keys(GUIDE_SCREENS).filter((n) => !BARE_EXCLUDE.has(n)).sort((a, b) => b.length - a.length);
+const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
+const BARE_PATTERN = new RegExp(BARE_NAMES.map(escapeRegExp).join('|'), 'g');
+/** ⚠️ 名前を探さないところ: Markdown のリンク・`[[ ]]`・かぎかっこ（⚠️ これらは上で済ませてある） */
+const PROTECTED = /(\[[^\]\n]*\]\([^)\n]*\)|\[\[[^\]\n]*\]\]|「[^」\n]*」)/;
+
+const expandMentions = (body: string): string => {
+    const explicit = new Set([...body.matchAll(SCREEN_LINK)].map((m) => m[1].trim()));
+    /** ⚠️ その記事でボタンを付けた名前（⚠️ かぎかっこの無い名前は、これに入っていれば付けない） */
+    const seen = new Set<string>();
+    return outsideCode(body, (text) => {
+        if (/^\s*#{1,6}\s/.test(text)) return text;
+        const used = new Set<string>();
+        const mini = (word: string): string => {
+            const name = screenNameOf(word);
+            if (name === null || explicit.has(name) || used.has(name)) return '';
+            used.add(name);
+            seen.add(name);
+            return `[開く](${MINI_PREFIX}${encodeTarget(name)})`;
+        };
+        const marked = text
+            .replace(/\[「([^」\n]{1,40})」\]\(#guide-strong\)/g, (all, word: string) => `${all}${mini(word)}`)
+            .replace(/「([^」\n]{1,40})」(?!\]\()/g, (all, word: string) => `${all}${mini(word)}`)
+            .replace(/\[\[(?!画面[:：])([^[\]\n]+)\]\]/g, (all, title: string) => `${all}${mini(title)}`);
+        return marked.split(PROTECTED).map((part, i) => (i % 2 === 1 ? part : part.replace(BARE_PATTERN, (name) => {
+            if (explicit.has(name) || seen.has(name)) return name;
+            seen.add(name);
+            return `${name}[開く](${MINI_PREFIX}${encodeTarget(name)})`;
+        }))).join('');
+    });
+};
+
+const expandGuideLinks = (body: string): string => expandLinks(expandMentions(expandStrong(body)));
 
 /** 見出しの id。⚠️ 目次（headingsOf）と本文（h2/h3）で同じ文字列から作ること */
 const headingId = (text: string): string => `h-${encodeURIComponent(text.trim()).replace(/%/g, '')}`;
 
 /** Markdown の飾りを落とした見出しの文字 */
 const plainHeading = (line: string): string =>
-    line.replace(/\[\[([^[\]\n]+)\]\]/g, '$1').replace(/[*_`]/g, '').trim();
+    line.replace(SCREEN_LINK, '$1').replace(/\[\[([^[\]\n]+)\]\]/g, '$1').replace(/[*_`]/g, '').trim();
 
 /** 目次。⚠️ コードブロックの中の `#` は見出しにしない */
 export const headingsOf = (body: string): { level: 2 | 3; text: string; id: string }[] => {
     const result: { level: 2 | 3; text: string; id: string }[] = [];
     let inCode = false;
     for (const line of body.split('\n')) {
         if (/^```/.test(line.trim())) { inCode = !inCode; continue; }
         if (inCode) continue;
@@ -97,24 +156,38 @@ const calloutKind = (text: string): 'warn' | 'check' | 'tip' => {
 };
 
 interface Props {
     body: string;
     /** 記事のタイトル → id（⚠️ 公開・非公開を問わず。リンクの色分けに使う） */
     titleToId: Map<string, number>;
     /** 記事へのリンクを押したとき */
     onOpen: (title: string) => void;
+    /** 記事の事業（⚠️ 全事業共通は null）。⚠️ 「画面を開く」でどの事業の画面を開くかに使う */
+    articleDivision: string | null;
 }
 
-const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen }) => (
+const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen, articleDivision }) => (
     <div className="gd_md">
         <ReactMarkdown
             components={{
                 a: ({ href, children }) => {
                     if (href === STRONG_HREF) return <strong>{children}</strong>;
+                    // ⚠️ 本文の画面の名前の後ろの小さいボタン（expandMentions）。⚠️ 登録のある名前だけが来る
+                    if (href !== undefined && href.startsWith(MINI_PREFIX)) {
+                        return <GuideScreenButton name={decodeURIComponent(href.slice(MINI_PREFIX.length))} articleDivision={articleDivision} compact />;
+                    }
+                    if (href !== undefined && href.startsWith(SCREEN_PREFIX)) {
+                        const name = decodeURIComponent(href.slice(SCREEN_PREFIX.length));
+                        // ⚠️ 登録の無い名前は赤い札（⚠️ 押せない。書き間違いに気づけるように）
+                        if (GUIDE_SCREENS[name] === undefined) {
+                            return <span className="gd_screen is_missing" title="この画面は登録されていません">{name}（画面の登録なし）</span>;
+                        }
+                        return <GuideScreenButton name={name} articleDivision={articleDivision} />;
+                    }
                     if (href !== undefined && href.startsWith(LINK_PREFIX)) {
                         const title = decodeURIComponent(href.slice(LINK_PREFIX.length));
                         const exists = titleToId.has(title);
                         return (
                             <button
                                 type="button"
                                 className={`gd_ref${exists ? '' : ' is_missing'}`}
                                 onClick={() => onOpen(title)}
diff --git a/frontend/src/components/guide/openGuide.ts b/frontend/src/components/guide/openGuide.ts
index 5eeb3bd2..cc6343fc 100644
--- a/frontend/src/components/guide/openGuide.ts
+++ b/frontend/src/components/guide/openGuide.ts
@@ -7,17 +7,17 @@
  *
  * ⚠️ 中身は同じアプリの `/guide`（App.tsx でヘッダー・メニュー・アクティブユーザーを出さない）。
  *   ⚠️ 同じドメインなのでログイン状態（localStorage の token）はそのまま使える。
  *
  * ⚠️ スマホ（幅 768px 未満）は別ウインドウが扱いにくいので、同じタブで移動する。
  * ─────────────────────────────────────────────
  */
 
-const GUIDE_WINDOW = 'khg-business-guide';
+export const GUIDE_WINDOW = 'khg-business-guide';
 
 /**
  * 業務ガイドの対象の事業。⚠️ 色はトップ画面（Category.tsx）のボタンと同じ。
  * ⚠️ はじめは注文営業だけ → 2026-10-16 の追加指示で建売営業・中古リノベを足した。⚠️ 不動産企画係は対象外。
  */
 export const GUIDE_DIVISIONS = [
     { value: 'order', label: '注文営業', color: '#0d6efd' },
     { value: 'spec', label: '建売営業', color: '#198754' },
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index ae820f9c..62f1ba3c 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -30,16 +30,17 @@ import EventList from './EventList';
 import FestaDashboard from './FestaDashboard';
 import EventSummary from './EventSummary';
 import EventBudget from './EventBudget';
 import GoogleReview from './GoogleReview';
 import UploadLoan from './UploadLoan';
 import RankingLoader from '../company/RankingLoader';
 import { openDailyAction } from '../DailyAction';
 import { isGuideCategory, openGuide } from '../guide/openGuide';
+import { useGuideScreenReceiver } from '../guide/useGuideScreenReceiver';
 import { useNavigate } from "react-router-dom";
 
 // 型安全のための定義
 type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' | '他社動向' | '架電状況' | '活動サマリー' | '公式アンバサダー' | '紹介キャンペーン' | '集客イベント' | 'Google口コミ';
 
 /**
  * 他社動向メニューの最後に出す項目。
  *
@@ -243,16 +244,89 @@ const Header = ({ }) => {
         //
         // ⚠️ 一方 '集客サマリー' は自前のモーダルを持たないので、
         //   共通モーダルに載せる（EventList とは扱いが違う）。
         '集客イベント/集客サマリー': <EventSummary />,
         // ⚠️ 表が横に広いので isFullscreenMenu に入れてある（上を参照）
         'Google口コミ/口コミ集計': <GoogleReview />
     };
 
+    /**
+     * メニューの項目を開く。⚠️ v2.2.196: ドロップダウンの onClick から関数に出した（⚠️ 業務ガイドの「画面を開く」も使う）。
+     * ⚠️ 中身は以前の onClick のまま。⚠️ そのメニューに出ていない項目（権限が無い）は開かずに false。
+     */
+    const openMenuItem = (menu: MenuKey, item: string): boolean => {
+        if (!menuMapping[menu]?.includes(item)) return false;
+        // ⚠️⚠️ 集客イベントの「反響一覧」だけは共通モーダルを
+        //   使わない。EventList が自前の fullscreen モーダルを
+        //   持っているため、共通モーダルに入れると二重になる。
+        //
+        // ⚠️ 以前は menu === '集客イベント' だけで判定しており、
+        //   項目に関係なく必ず EventList を開いていた。
+        //   2026-09-09 に「集客サマリー」を追加したため、
+        //   **項目まで見て分岐する**必要がある。
+        //   item を見ない条件に戻すと、集客サマリーを選んでも
+        //   反響一覧が開く（エラーにならないので気づきにくい）。
+        if (menu === '集客イベント' && item === '反響一覧') {
+            setEventSummary(true);
+            return true;
+        }
+        // ⚠️ 広告費入力も自前のモーダルを持つ。
+        //   共通モーダルに入れず専用の state で開く
+        if (menu === '集客イベント' && item === '広告費入力') {
+            setEventBudget(true);
+            return true;
+        }
+        // ⚠️ おうちづくりフェスタ2026（v2.2.172）も自前の fullscreen モーダル
+        if (menu === '集客イベント' && item === 'おうちづくりフェスタ2026') {
+            setShowFesta(true);
+            return true;
+        }
+        // ⚠️ ローン情報更新も自前のモーダル（md）を持つ（v2.2.168）
+        if (menu === 'システム管理' && item === 'ローン情報更新') {
+            setUploadLoan(true);
+            return true;
+        }
+        // ⚠️ アクションボード（v2.2.169）は ⚠️ **App.tsx に置いてある DailyAction を開くだけ**。
+        //   ⚠️ ActiveUser.tsx のボタンと同じ関数（⚠️ 押したときは取り直し、0件でも開く）。
+        if (menu === '活動サマリー' && item === 'アクションボード') {
+            openDailyAction();
+            return true;
+        }
+        // ⚠️ 契約数ランキング（v2.2.169）も自前のモーダル
+        if (menu === '活動サマリー' && item === '契約数ランキング') {
+            setShowRanking(true);
+            return true;
+        }
+        // ⚠️ キーは `メニュー/項目`。項目名だけだと
+        //   複数のメニューにある「反響一覧」が区別できない
+        setEditMenu(`${menu}/${item}`);
+        setModal(true);
+        return true;
+    };
+
+    /** ⚠️ v2.2.196: 業務ガイドから開く前に、ヘッダーのモーダルを閉じる（⚠️ ページを移ってもヘッダーのモーダルは残るため） */
+    const closeHeaderModals = (): void => {
+        setModal(false);
+        setClaudeModal(false);
+        setEventSummary(false);
+        setShowFesta(false);
+        setEventBudget(false);
+        setUploadLoan(false);
+        setShowRanking(false);
+    };
+
+    // ⚠️ v2.2.196: 業務ガイドの「画面を開く」を受ける（guide/useGuideScreenReceiver.ts）。⚠️ ここで1回だけ
+    useGuideScreenReceiver({
+        // ⚠️ 無いメニュー名は openMenuItem の menuMapping の確かめで false になる
+        openMenuItem: (menu, item) => openMenuItem(menu as MenuKey, item),
+        openClaude,
+        closeHeaderModals,
+    });
+
     useEffect(() => {
         const fetchData = async () => {
             const response = await apiClient.post("", { request: "header" });
             setNewEstate(response.data.estate);
         };
         fetchData();
 
     }, []);
@@ -404,63 +478,17 @@ const Header = ({ }) => {
                         <Dropdown.Menu
                             className="shadow-sm border border-light-subtle py-1"
                             style={{ fontSize: '13px', minWidth: '160px' }}
                         >
                             {menuMapping[menu].map((item) => (
                                 <Dropdown.Item
                                     key={item}
                                     className="py-2 px-3 text-dark position-relative"
-                                    onClick={() => {
-                                        // ⚠️⚠️ 集客イベントの「反響一覧」だけは共通モーダルを
-                                        //   使わない。EventList が自前の fullscreen モーダルを
-                                        //   持っているため、共通モーダルに入れると二重になる。
-                                        //
-                                        // ⚠️ 以前は menu === '集客イベント' だけで判定しており、
-                                        //   項目に関係なく必ず EventList を開いていた。
-                                        //   2026-09-09 に「集客サマリー」を追加したため、
-                                        //   **項目まで見て分岐する**必要がある。
-                                        //   item を見ない条件に戻すと、集客サマリーを選んでも
-                                        //   反響一覧が開く（エラーにならないので気づきにくい）。
-                                        if (menu === '集客イベント' && item === '反響一覧') {
-                                            setEventSummary(true);
-                                            return;
-                                        }
-                                        // ⚠️ 広告費入力も自前のモーダルを持つ。
-                                        //   共通モーダルに入れず専用の state で開く
-                                        if (menu === '集客イベント' && item === '広告費入力') {
-                                            setEventBudget(true);
-                                            return;
-                                        }
-                                        // ⚠️ おうちづくりフェスタ2026（v2.2.172）も自前の fullscreen モーダル
-                                        if (menu === '集客イベント' && item === 'おうちづくりフェスタ2026') {
-                                            setShowFesta(true);
-                                            return;
-                                        }
-                                        // ⚠️ ローン情報更新も自前のモーダル（md）を持つ（v2.2.168）
-                                        if (menu === 'システム管理' && item === 'ローン情報更新') {
-                                            setUploadLoan(true);
-                                            return;
-                                        }
-                                        // ⚠️ アクションボード（v2.2.169）は ⚠️ **App.tsx に置いてある DailyAction を開くだけ**。
-                                        //   ⚠️ ActiveUser.tsx のボタンと同じ関数（⚠️ 押したときは取り直し、0件でも開く）。
-                                        if (menu === '活動サマリー' && item === 'アクションボード') {
-                                            openDailyAction();
-                                            return;
-                                        }
-                                        // ⚠️ 契約数ランキング（v2.2.169）も自前のモーダル
-                                        if (menu === '活動サマリー' && item === '契約数ランキング') {
-                                            setShowRanking(true);
-                                            return;
-                                        }
-                                        // ⚠️ キーは `メニュー/項目`。項目名だけだと
-                                        //   複数のメニューにある「反響一覧」が区別できない
-                                        setEditMenu(`${menu}/${item}`);
-                                        setModal(true);
-                                    }}
+                                    onClick={() => openMenuItem(menu, item)}
                                 >
                                     {/* ⚠️ 競合分析はロゴ＋文言で出す（ヘッダーの「による分析」と同じ形） */}
                                     {item === CLAUDE_COMPETITOR_ITEM
                                         ? <span className="d-flex align-items-center" style={{ gap: '2px' }}>
                                             <ClaudeIcon height={14} />
                                             による競合分析
                                         </span>
                                         : item}
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index c1235355..01f18fc5 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.195';
+export const newVersion = '2.2.196';
```
