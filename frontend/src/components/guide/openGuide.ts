/**
 * 業務ガイドを別ウインドウで開く（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ウインドウに名前（GUIDE_WINDOW）を付けて開く。**
 *   ⚠️ 2回目以降は**同じウインドウ**の中身が切り替わる（⚠️ ボタンを押すたびに窓が増えない）。
 *
 * ⚠️ 中身は同じアプリの `/guide`（App.tsx でヘッダー・メニュー・アクティブユーザーを出さない）。
 *   ⚠️ 同じドメインなのでログイン状態（localStorage の token）はそのまま使える。
 *
 * ⚠️ スマホ（幅 768px 未満）は別ウインドウが扱いにくいので、同じタブで移動する。
 * ─────────────────────────────────────────────
 */

export const GUIDE_WINDOW = 'khg-business-guide';

/**
 * 業務ガイドの対象の事業。⚠️ 色はトップ画面（Category.tsx）のボタンと同じ。
 * ⚠️ はじめは注文営業だけ → 2026-10-16 の追加指示で建売営業・中古リノベを足した。⚠️ 不動産企画係は対象外。
 */
export const GUIDE_DIVISIONS = [
    { value: 'order', label: '注文営業', color: '#0d6efd' },
    { value: 'spec', label: '建売営業', color: '#198754' },
    { value: 'used', label: '中古リノベ', color: '#d97706' },
] as const;
/** 全事業に出す記事の事業区分 */
export const GUIDE_COMMON = 'common';

/** 入口ボタンを出す事業（⚠️ 選んでいる事業＝category で判定） */
export const isGuideCategory = (category: string): boolean => GUIDE_DIVISIONS.some((d) => d.value === category);

/**
 * 見られる事業。⚠️ shopName は担当事業（order / spec / used / all）。
 * ⚠️ Master と全事業（all）の人はすべて。⚠️ 選んでいる事業（category）も足す（⚠️ 事業の権限はトップ画面が確かめている）。
 */
export const allowedGuideDivisions = (authority: string, category: string, shopName: string): string[] =>
    GUIDE_DIVISIONS.map((d) => d.value as string).filter((v) =>
        authority === 'Master' || shopName === 'all' || shopName === v || category === v);

/** ⚠️ Router の basename（App.tsx の `/dashboard`）を含めた URL */
const guideUrl = (title?: string): string =>
    `/dashboard/guide${title ? `?title=${encodeURIComponent(title)}` : ''}`;

/** 業務ガイドを開く。⚠️ title を渡すと、その記事を開く（無ければ一覧） */
export const openGuide = (title?: string): void => {
    const url = guideUrl(title);
    if (window.innerWidth < 768) {
        window.location.assign(url);
        return;
    }
    // ⚠️ 画面の右側に寄せて開く（⚠️ 作業中の画面と並べて読む前提）
    const width = Math.min(1180, Math.max(720, Math.round(window.screen.availWidth * 0.5)));
    const height = Math.max(640, window.screen.availHeight - 80);
    const left = Math.max(0, window.screen.availWidth - width);
    const opened = window.open(url, GUIDE_WINDOW, `width=${width},height=${height},left=${left},top=0`);
    // ⚠️ ポップアップを止められたら、同じタブで開く（⚠️ 何も起きないよりよい）
    if (opened === null) {
        window.location.assign(url);
        return;
    }
    opened.focus();
};
