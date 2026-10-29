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
import { canEnterCategory } from '../../utils/shopAccess';

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
    // ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけ（Header.tsx の AI_ANALYSIS_AUTHORITY と同じ）
    'Claudeによる分析': { claude: true, authority: ['Master', 'BrandAdmin', 'Manager'] },
    '重複反響サマリー': { menu: '反響管理/重複反響サマリー' },
    'ブラックリスト設定': { menu: '反響管理/ブラックリスト設定' },
    '事後アンケート': { menu: '反響管理/事後アンケート' },
    // ⚠️ v2.2.215。Header.tsx の menuMapping と同じく全員
    'オーナーズハウス募集': { menu: '反響管理/オーナーズハウス募集' },
    '広告費シミュレーター': { menu: '反響管理/広告費シミュレーター', authority: ['Master'] },
    // ⚠️ v2.2.199（広告流入トラッキング）。Header.tsx の menuMapping と同じく Master / BrandAdmin
    'アクセス解析': { menu: '反響管理/アクセス解析', authority: ADMIN },
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
        // ⚠️ v2.2.217 で BrandAdmin の表示名が「ブランド管理者」に、Manager が「マネージャー」になったため、権限名を並べない
        return screen.authority.length === 1 ? '管理者だけが開ける画面です' : '権限のある人だけが開ける画面です';
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
 * @param shopName 担当事業（order / spec / used / realty / all）。⚠️ 切り替えてよいかの判定は Category.tsx の goToDashboard と同じ（utils/shopAccess.ts）
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
    if (switching && !canEnterCategory(shopName, division as string)) {
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
