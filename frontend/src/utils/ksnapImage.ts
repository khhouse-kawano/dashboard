/**
 * K-SNAP のスナップ写真の配信元。
 *
 * ⚠️ **ここ1箇所で定義する。** 各コンポーネントにURLを直書きしないこと。
 *   移行前は3ファイルに `https://khg-marketing.info/k-snap/images/` が
 *   散っており、置き場所を変えるたびに探し回ることになっていた。
 *
 * ⚠️ 2026-09-03 に `/k-snap/images/` から `/dashboard/api/images/` へ移した。
 *   バックエンドの保存先（backend/src/core/ksnap.php の ksnapImageDir）と
 *   **必ず同じ場所を指すこと。** 片方だけ変えると、保存はできるが表示できない
 *   （またはその逆の）状態になる。
 *
 * ⚠️ このディレクトリには .htaccess で .php へのアクセス拒否を置く必要がある。
 *   公開ディレクトリの中にあるため、PHPが置かれると実行されうる。
 *   ディレクトリを移すときは .htaccess も一緒に移すこと。
 */
const DEFAULT_BASE = 'https://khg-marketing.info/dashboard/api/images';

/** 末尾のスラッシュを取り除く。連結時に `//` にならないようにする */
const normalize = (value: string): string => value.replace(/\/+$/, '');

export const KSNAP_IMAGE_BASE = normalize(
    process.env.REACT_APP_KSNAP_IMAGE_BASE ?? DEFAULT_BASE
);

/**
 * ファイル名から画像URLを組み立てる。
 *
 * ⚠️ DBの値に先頭スラッシュが混じっている行がある（Edit.tsx が
 *   `replace(/^\//, '')` で除いていた）。ここで吸収する。
 */
export const ksnapImageUrl = (imageName: string | undefined | null): string => {
    if (imageName === undefined || imageName === null || imageName === '') return '';
    return `${KSNAP_IMAGE_BASE}/${imageName.replace(/^\/+/, '')}`;
};
