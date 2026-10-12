import React, { useState } from 'react';

/**
 * LINE ID の横の LINE アイコン（v2.2.188 新規）。顧客の編集画面（InformationEdit / Kaeru / Resale）の連絡先で使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **押すと「LINE ID をコピー」して「LINE WORKS のトークを新しいタブで開く」。**
 *   ⚠️ 指示書は `https://line.worksmobile.com/message/send?emailList={LINE ID}` を開く案だったが、
 *     2026-10-12 の調査で ⚠️ **お客様の個人 LINE ID ではトークが開けない**ことが分かった。
 *     ・`emailList` は ⚠️ LINE WORKS のアカウント（ログインID）用。⚠️ 公式文書にも無い（予告なく変わりうる）
 *     ・LINE WORKS から ⚠️ **個人 LINE ID でお客様を検索・追加する手段は無い**
 *       （お客様に社員の QR・招待リンクから友だち追加してもらう流れのみ）
 *     → 調査の推奨どおり「コピー ＋ トークを開く」にした（詳細: docs/task-2026-10-12-04-line-id.md）。
 *   ⚠️ 開き先を変えるときは LINE_WORKS_TALK_URL だけ直す。
 * ─────────────────────────────────────────────
 *
 * ⚠️ LINE ID が空なら薄く表示して押せない。
 * ⚠️ 色は LINE のブランドカラー（#06C755）。
 */
const LINE_WORKS_TALK_URL = 'https://talk.worksmobile.com/';
const LINE_GREEN = '#06C755';

type Props = {
    lineId: string | null | undefined;
};

const LineWorksButton = ({ lineId }: Props) => {
    const value = String(lineId ?? '').trim();
    const enabled = value !== '';
    const [copied, setCopied] = useState(false);

    const handleClick = async () => {
        if (!enabled) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            // ⚠️ コピーできなくてもトークは開く（⚠️ 手で入力できるよう ID は画面に出ている）
            console.error('LINE ID をコピーできませんでした', error);
        }
        window.open(LINE_WORKS_TALK_URL, '_blank', 'noopener,noreferrer');
    };

    return (
        <span className="d-inline-flex align-items-center" style={{ verticalAlign: 'middle' }}>
            <button
                type="button"
                onClick={() => void handleClick()}
                disabled={!enabled}
                aria-label={enabled ? `LINE ID（${value}）をコピーして LINE WORKS を開く` : 'LINE ID が未入力です'}
                title={enabled ? `LINE ID（${value}）をコピーして LINE WORKS を開く` : 'LINE ID が未入力です'}
                style={{
                    border: 'none', background: 'transparent', padding: '0 4px', lineHeight: 1,
                    color: LINE_GREEN, opacity: enabled ? 1 : 0.35,
                    cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '20px',
                }}
            >
                <i className="fa-brands fa-line" aria-hidden="true"></i>
            </button>
            {copied && <span style={{ fontSize: '10px', color: LINE_GREEN, fontWeight: 700 }}>コピーしました</span>}
        </span>
    );
};

export default LineWorksButton;
