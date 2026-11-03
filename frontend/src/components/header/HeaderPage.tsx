import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { canOpenScreen } from './headerScreens';
import type { HeaderScreen } from './headerScreens';

/**
 * ヘッダーのメニューの画面を、ページとして描く枠（v2.2.241 新規）。⚠️ App.tsx のルートが headerScreens.tsx の1件ごとに使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 見出し（メニュー › 項目）＋本文。本文は高さを決めて中でスクロールする。
 *   ⚠️ v2.2.240 までの全画面モーダルの Modal.Body と同じ作り（⚠️ 各画面の表の見出しの固定・height: 100% がそのまま効く）。
 *   ⚠️ 各画面の注記に残っている「Header.tsx の全画面モーダル」「isFullscreenMenu」「Modal.Body は p-0」は、
 *     ⚠️ v2.2.241 からはこの本文（.hp_body。padded の無い画面は余白なし）のこと。⚠️ 余白は今も各画面が自分で持つ。
 * ⚠️ 見られない人（allow が false）には案内だけ出し、⚠️ 画面の部品を描かない（⚠️ データも取りに行かない）。
 *   ⚠️ URL を直接打って開いた場合のため。⚠️ メニューには最初から出していない。
 * ⚠️ 閉じるボタンは無い（ページなので、ほかのメニュー・ブラウザの「戻る」で移る）。
 * ⚠️ 見出しの .hp_title は業務ガイドが「いま開いている画面」として読む（guideScreens.ts の openScreenLabel）。⚠️ クラス名を変えない。
 * ─────────────────────────────────────────────
 */
const HeaderPage = ({ screen }: { screen: HeaderScreen }) => {
    const { authority, category } = useContext(AuthContext);
    const navigate = useNavigate();
    const allowed = canOpenScreen(screen, { authority, category });

    const body = !allowed
        ? <div className="hp_notice">この画面を見る権限がありません。</div>
        : screen.render
            ? screen.render()
            : <div className="hp_notice">現在、{screen.item} のコンポーネントを準備中です。</div>;

    return (
        <div className="content hp_page">
            <style>{`
                .content.hp_page { height: calc(100vh - var(--header-h, 30px) - 6px); overflow: hidden; }
                .hp_head { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; padding: 8px 16px 6px;
                           font-size: 15px; color: #6c757d; }
                .hp_menu { font-size: 12px; color: #8898aa; }
                .hp_sep { font-size: 12px; color: #ced4da; }
                .hp_title { font-size: 15px; font-weight: 700; color: #6c757d; margin: 0; display: inline-flex; align-items: center; }
                .hp_link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
                .hp_body { flex: 1 1 auto; min-height: 0; overflow: auto; }
                .hp_body.is_padded { padding: 8px 16px 16px; }
                .hp_notice { font-size: 13px; color: #6c757d; text-align: center; padding: 32px 16px; }
            `}</style>
            <div className="hp_head">
                {screen.menu && <><span className="hp_menu">{screen.menu}</span><span className="hp_sep" aria-hidden="true">›</span></>}
                <h1 className="hp_title">{screen.label ?? screen.item}</h1>
                {allowed && screen.link && (
                    <button type="button" className="btn btn-sm btn-outline-secondary hp_link" onClick={() => navigate(screen.link!.path)}>
                        <i className={screen.link.icon} aria-hidden="true" />
                        {screen.link.label}
                    </button>
                )}
            </div>
            <div className={`hp_body${screen.padded ? ' is_padded' : ''}`}>{body}</div>
        </div>
    );
};

export default HeaderPage;
