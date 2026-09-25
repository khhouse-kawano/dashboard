import React from 'react';
import NexusBadge, { NEXUS_LEGEND_LABEL } from '../NexusBadge';

/**
 * ギフト進呈可否を表す信号機ドットと、その凡例。
 *
 * 注文事業（DatabaseOrder）と建売分譲（DatabaseKaeru）の両方で使う。
 * 見た目と凡例の文言をここに集約しておくことで、片方だけ色や文言が
 * 変わってしまう状態を防ぐ。
 *
 * 判定条件はサーバー側の backend/src/core/gift.php に集約されており、
 * 顧客一覧APIが gift（1 = 進呈可 / 0 = 不可）として返す。
 * フロント側では条件を再実装しないこと（二重管理になり必ずずれる）。
 */

const GREEN_LABEL = 'ギフト進呈可';
const RED_LABEL = 'ギフト進呈不可';

/** ドットの直径。顧客名の文字サイズより小さく見せるため em で指定する */
const DOT_SIZE = '0.6em';

type GiftDotProps = {
    /** 顧客一覧APIが返す gift。1 = 進呈可 */
    gift?: number | string;
};

/**
 * 顧客名の先頭に置く信号機ドット。
 *
 * gift が未定義の場合は何も描画しない。
 * APIがまだ gift を返していない画面で、全件レッドに見えてしまうのを防ぐため
 * （「不可」と「判定していない」は別物）。
 */
export const GiftDot = ({ gift }: GiftDotProps) => {
    if (gift === undefined || gift === null || gift === '') return null;

    const isGreen = Number(gift) === 1;

    return (
        <i
            className={`fa-solid fa-circle me-1 ${isGreen ? 'text-success' : 'text-danger'}`}
            style={{ fontSize: DOT_SIZE, verticalAlign: 'middle' }}
            title={isGreen ? GREEN_LABEL : RED_LABEL}
        />
    );
};

type GiftLegendProps = {
    /**
     * ⚠️ Nexus アイコンの説明も並べる。
     *   ⚠️⚠️ **注文事業（DatabaseOrder）だけ true にすること。**
     *     ⚠️ 建売分譲にはこのアイコンを出していないので、
     *       ⚠️ **凡例だけ出すと「どこにも無い印」の説明になる。**
     */
    nexus?: boolean;
};

/** テーブル上部に置く凡例 */
export const GiftLegend = ({ nexus }: GiftLegendProps) => (
    <div className="d-flex align-items-center" style={{ fontSize: '10px', gap: '12px' }}>
        <span>
            <i
                className="fa-solid fa-circle me-1 text-success"
                style={{ fontSize: DOT_SIZE, verticalAlign: 'middle' }}
            />
            {GREEN_LABEL}
        </span>
        <span>
            <i
                className="fa-solid fa-circle me-1 text-danger"
                style={{ fontSize: DOT_SIZE, verticalAlign: 'middle' }}
            />
            {RED_LABEL}
        </span>
        {nexus && (
            <span className="d-flex align-items-center">
                <NexusBadge className="me-1" />
                {NEXUS_LEGEND_LABEL}
            </span>
        )}
    </div>
);
