import React, { useContext, useEffect, useRef, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import { ScreenPlan, askDashboard, openDashboardWithScreen, planScreen, screenBlockedReason } from './guideScreens';
import { openGuideScreenHere } from './useGuideScreenReceiver';

/**
 * 記事の `[[画面:名前]]` から出す「画面を開く」ボタン（v2.2.196 新規）。⚠️ 見た目は Guide.tsx の CSS（gd_screen*）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開くのはダッシュボードの窓（guideScreens.ts の説明）。⚠️ ガイドの窓はそのまま。
 * ⚠️⚠️ **ダッシュボードの窓で何か画面（モーダル）を開いていたら、ガイドの窓で確認を出す**（2026-10-16 の指示）。
 *   ⚠️ 保存していない入力が消えることがあるため。⚠️ 事業を切り替えて開くときも確認を出す。
 *   ⚠️ 何も開いていなければ確認なしで開く。
 * ⚠️ 押せない画面（権限・スマホ）は灰色で、理由を横に出す（⚠️ 見た目だけ。権限は各画面と ② が守る）。
 *
 * ⚠️ v2.2.198: `onOpenedHere` を渡すと、**いまの窓（ダッシュボード）で開く**（左メニューの業務ガイドの検索 → GuideSearchPanel.tsx）。
 *   ⚠️ 窓どうしのやりとりはしない。⚠️ 確認は事業を切り替えるときだけ（⚠️ 開いている画面は記事の後ろにあり、利用者が自分で見ている）。
 * ─────────────────────────────────────────────
 */
interface Props {
    name: string;
    /** 記事の事業（⚠️ 全事業共通の記事は null） */
    articleDivision: string | null;
    /**
     * 本文の画面の名前の後ろに付ける小さいボタン（GuideMarkdown.tsx の expandMentions）。
     * ⚠️ 文字は「開く」だけ（⚠️ 名前は直前に書いてある）。⚠️ 押せない理由は横に出さず、マウスを当てたときの説明だけ（⚠️ 文が読みにくくなるため）
     */
    compact?: boolean;
    /** いまの窓（ダッシュボード）で開く。⚠️ 開けたら呼ぶ（記事を閉じる） */
    onOpenedHere?: () => void;
}

/** 開く前の確認に出す内容（⚠️ ガイドの窓では status の返事＝GuideReply をそのまま入れる） */
type Confirming = { plan: ScreenPlan; openScreen: string | null };

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const NOTICE_MS = 5000;

const GuideScreenButton: React.FC<Props> = ({ name, articleDivision, compact = false, onOpenedHere }) => {
    const { authority, category, shopName } = useContext(AuthContext);
    const blocked = screenBlockedReason(name, authority);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<Confirming | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const openButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (notice === null) return;
        const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (confirming === null) return;
        openButtonRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirming]);

    /** ⚠️ ダッシュボードの窓が無い・答えないときは開き直す */
    const reopen = () => {
        openDashboardWithScreen(name, articleDivision);
        setNotice({ tone: 'ok', text: 'ダッシュボードを開き直して開きました' });
    };

    const openHere = () => {
        setConfirming(null);
        const error = openGuideScreenHere(name, articleDivision);
        if (error !== null) { setNotice({ tone: 'error', text: error }); return; }
        onOpenedHere?.();
    };

    const open = async () => {
        if (onOpenedHere !== undefined) { openHere(); return; }
        setConfirming(null);
        setBusy(true);
        const reply = await askDashboard('open', name, articleDivision);
        setBusy(false);
        if (reply === null) { reopen(); return; }
        if (!reply.plan.ok) { setNotice({ tone: 'error', text: reply.plan.message }); return; }
        // ⚠️ 前に出せるかはブラウザしだい（⚠️ 出せなくても、開いたことは下の文で伝える）
        try { (window.opener as Window | null)?.focus(); } catch { /* 前に出せなくてもよい */ }
        setNotice({ tone: 'ok', text: 'ダッシュボードの窓で開きました' });
    };

    const onClick = async () => {
        if (blocked !== null || busy) return;
        setNotice(null);
        if (onOpenedHere !== undefined) {
            const plan = planScreen(name, articleDivision, category, shopName);
            if (!plan.ok) { setNotice({ tone: 'error', text: plan.message }); return; }
            if (plan.switchLabel !== null) { setConfirming({ plan, openScreen: null }); return; }
            openHere();
            return;
        }
        setBusy(true);
        const reply = await askDashboard('status', name, articleDivision);
        setBusy(false);
        if (reply === null) { reopen(); return; }
        if (!reply.plan.ok) { setNotice({ tone: 'error', text: reply.plan.message }); return; }
        if (reply.openScreen !== null || reply.plan.switchLabel !== null) { setConfirming(reply); return; }
        await open();
    };

    return (
        <span className="gd_screen_wrap">
            <button type="button" className={`gd_screen${compact ? ' is_compact' : ''}`} onClick={onClick} disabled={blocked !== null || busy}
                aria-busy={busy} aria-label={compact ? `${name}を開く` : undefined}
                title={blocked ?? (onOpenedHere !== undefined ? `「${name}」を開く` : `ダッシュボードの窓で「${name}」を開く`)}>
                <span className="gd_screen_icon" aria-hidden="true">↗</span>
                {compact ? '開く' : `${name}を開く`}
            </button>
            {blocked !== null && !compact && <span className="gd_screen_note">{blocked}</span>}
            {notice !== null && <span className={`gd_screen_note is_${notice.tone}`} role="status">{notice.text}</span>}

            {confirming !== null && confirming.plan.ok && (
                <span className="gd_confirm_back" onClick={() => setConfirming(null)}>
                    <span className="gd_confirm" role="dialog" aria-modal="true" aria-labelledby="gd_confirm_title"
                        onClick={(e) => e.stopPropagation()}>
                        <span id="gd_confirm_title" className="gd_confirm_title">「{name}」を開きます</span>
                        {confirming.openScreen !== null && (
                            <span className="gd_confirm_text">
                                ダッシュボードの窓で「{confirming.openScreen}」が開いています。開くと、いまの画面は閉じるか後ろに隠れます。
                                <strong>保存していない内容は消えることがあります。</strong>
                            </span>
                        )}
                        {confirming.plan.switchLabel !== null && (
                            <span className="gd_confirm_text">ダッシュボードの事業を「{confirming.plan.switchLabel}」に切り替えて開きます。</span>
                        )}
                        <span className="gd_confirm_actions">
                            <button type="button" className="gd_btn" onClick={() => setConfirming(null)}>やめる</button>
                            <button type="button" className="gd_btn is_primary" ref={openButtonRef} onClick={open}>開く</button>
                        </span>
                    </span>
                </span>
            )}
        </span>
    );
};

export default GuideScreenButton;
