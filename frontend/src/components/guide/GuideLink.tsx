import React from 'react';
import { openGuide } from './openGuide';

/**
 * 画面の中に置く「業務ガイドへのリンク」（v2.2.194）。
 *
 * 例: `<GuideLink title="契約したら（注文営業）" />`
 *     `<GuideLink title="来場">来場とは</GuideLink>`
 *
 * ⚠️ 押すと業務ガイドの別ウインドウでその記事が開く（⚠️ 作業中の画面はそのまま）。
 * ⚠️ title は記事のタイトルと**完全に一致**させること（⚠️ 一致しなければガイドの一覧が開く）。
 */
const GuideLink: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <button
        type="button"
        onClick={() => openGuide(title)}
        title={`業務ガイド「${title}」を開く`}
        style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#0f766e', fontWeight: 700, fontSize: 'inherit',
            textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
        }}
    >
        {children ?? title}
    </button>
);

export default GuideLink;
