/**
 * 公開ギャラリー（K-SNAP）の接続先。
 *
 * ⚠️ **ここ1箇所で定義する。** 各コンポーネントにURLを直書きしないこと。
 *   取り込み前は7箇所に `https://khg-marketing.info/k-snap/api/` が散っており、
 *   開発中も本番APIを直接叩いていた。`k-snap_customer_update` は書き込み系なので、
 *   **開発中の操作が本番の顧客データを上書きしていた。**
 */

/**
 * APIの向き先。
 *
 * ⚠️ 2026-09-03 に `/k-snap/api/` から `/dashboard/api/gateway/` へ移した。
 *   ハンドラは dashboard 側（backend/src/handlers/k-snap*.php）に集約済みで、
 *   参照系5件は ② VPS の Express が処理する。
 *
 * ⚠️ 開発時は自動でローカルのPHP（docker-compose の php-web）を向く。
 *   これで開発中に本番データを書き換える事故が起きない。
 *   `VITE_API_BASE` を置けば上書きできる。
 */
const DEV_API_BASE = 'http://localhost:8080/';
const PROD_API_BASE = 'https://khg-marketing.info/dashboard/api/gateway/';

export const API_BASE: string =
    import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? DEV_API_BASE : PROD_API_BASE);

/**
 * 画像の参照元（末尾スラッシュなし）。
 *
 * ⚠️ バックエンドの保存先（backend/src/core/ksnap.php の ksnapImageDir）と
 *   **同じ場所を指すこと。** 片方だけ変えると、保存はできるが表示できない状態になる。
 *
 * ⚠️ ダッシュボード側にも同じ定義がある（frontend/src/utils/ksnapImage.ts）。
 *   置き場所を変えるときは両方直すこと。
 */
export const IMAGE_BASE_URL: string =
    import.meta.env.VITE_KSNAP_IMAGE_BASE ?? 'https://khg-marketing.info/dashboard/api/images';

/**
 * 共通ヘッダー。
 *
 * ⚠️ `Authorization: 4081Kokubu` は取り込み前の `/k-snap/api/index.php`
 *   （スタブ）が検証していた固定文字列。dashboard の API では検証していない。
 *   認証情報ではないが、外すと旧APIへ戻したときに 401 になるため残している。
 *   認証の再設計（docs/auth-redesign-proposal.md）で整理する対象。
 */
export const API_HEADERS = {
    Authorization: '4081Kokubu',
    'Content-Type': 'application/json',
} as const;
