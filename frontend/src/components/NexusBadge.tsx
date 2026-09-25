import React from 'react';

/**
 * Nexus（自社の別システム）へ移行できる顧客に付けるアイコン。
 *
 * ⚠️ 出すかどうかは呼び出し側が `isNexus()` / `isNexusRow()` で決める。
 *   ⚠️ **このコンポネント自身は判定しない**（画面ごとにデータの形が違うため）。
 *
 * ⚠️⚠️ **角丸の「Nexus」タグにしないこと**（2026-09-25 の指示）。
 *   ⚠️ 文字を四角で囲むと **リンクかボタンに見える。**
 *   ⚠️ **押しても何も起きない**ので、問い合わせのもとになる。
 *   ⚠️ 大文字の `N` を**ネイビーの丸で囲む**形で固定する。
 *
 * ⚠️ Nexus へ直接リンクする案は **2026-09-25 に見送った。**
 *   ⚠️ Nexus 側の ID は **乱数の UUID** で、Dashboard の ULID からは導けない。
 *   ⚠️ **対応表を持たないかぎりリンクは作れない**（作るなら列の追加が要る）。
 */
type Props = {
    /** 余白の付け方が画面ごとに違うので外から渡す（例: 'me-1' / 'mt-1'） */
    className?: string;
    /**
     * 文字で出すときの文言。
     *
     * ⚠️ 渡さなければ **丸囲みの `N`**（一覧の行に置く形）。
     * ⚠️ 渡すと **その文字を入れた帯**になる（顧客情報編集の見出しに置く形）。
     *   ⚠️⚠️ **一覧の行には渡さないこと。** 行が横に伸びてリンクに見える。
     */
    label?: string;
};

/** ⚠️ 丸の直径。⚠️ **文字サイズと揃えること**（ずらすと楕円になる） */
const CIRCLE_SIZE = '14px';

/** ⚠️ 顧客データベースの凡例に出す文言（2026-09-25 の指示どおり） */
export const NEXUS_LEGEND_LABEL = '国分Nexus連携済み';
/** ⚠️ 顧客情報編集の見出しに出す文言（⚠️ **こちらは「国分」を付けない**） */
export const NEXUS_HEADER_LABEL = 'Nexus連携済み';

const BASE_STYLE = {
    backgroundColor: '#1b2a56',
    color: '#ffffff',
    fontSize: '9px',
    lineHeight: 1,
    verticalAlign: 'middle' as const
};

const NexusBadge = ({ className, label }: Props) => (
    label === undefined
        ? (
            <span
                className={`d-inline-flex align-items-center justify-content-center rounded-circle fw-bold ${className ?? ''}`}
                style={{ ...BASE_STYLE, width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
                title={NEXUS_LEGEND_LABEL}
            >
                N
            </span>
        )
        : (
            <span
                className={`d-inline-block rounded fw-bold ${className ?? ''}`}
                style={{ ...BASE_STYLE, letterSpacing: '0.5px', padding: '2px 6px', whiteSpace: 'nowrap' }}
            >
                {label}
            </span>
        )
);

export default NexusBadge;
