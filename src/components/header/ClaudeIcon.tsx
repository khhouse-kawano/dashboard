import React from 'react';
import ClaudeImg from '../../assets/images/claude.png';

/** Anthropic 公式のアクセントカラー。ボタンの縁取りやホバー色に使う */
export const CLAUDE_ORANGE = '#D97757';

type Props = {
    /** 画像の高さ（px）。幅はアスペクト比を保って自動調整される */
    height?: number;
    /** グレーアウト表示にする（未実装メニュー用） */
    muted?: boolean;
};

/**
 * Claude のロゴ画像。
 * 画像内に「Claude」の文字が含まれているため、隣にテキストで «Claude» を置かないこと。
 */
const ClaudeIcon: React.FC<Props> = ({ height = 15, muted = false }) => (
    <img
        src={ClaudeImg}
        alt="Claude"
        style={{
            height: `${height}px`,
            width: 'auto',
            display: 'block',
            filter: muted ? 'grayscale(100%)' : undefined,
        }}
    />
);

export default ClaudeIcon;
