import { useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { markCategoryChosen } from '../DailyAction';
import {
    DIVISION_PARAM, GUIDE_SCREENS, SCREEN_PARAM, isGuideRequest, openScreenLabel, planScreen, replyToGuide,
} from './guideScreens';

/**
 * 業務ガイドの「画面を開く」を、ダッシュボードの窓で受けて開く（v2.2.196 新規）。⚠️ Header.tsx で1回だけ呼ぶ。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 受け取り方は2つ（guideScreens.ts の説明）:
 *   1. ガイドの窓からの postMessage（status → open）
 *   2. 開き直したときの URL の目印 `?guide_screen=名前`（⚠️ 読んだら URL から消す）
 * ⚠️ ページはメニューと同じく `navigate(path, { state: { authority } })`（Menu.tsx の handleNavigate と同じ）。
 * ⚠️ 事業を切り替えるときは Category.tsx の goToDashboard と同じく setCategory ＋ markCategoryChosen。
 * ⚠️ ヘッダーで開いているモーダルは先に閉じる（⚠️ 開いたままページを移ると、新しいページの上に残る）。
 * ─────────────────────────────────────────────
 */
interface Handlers {
    /** ヘッダーのメニューの画面を開く。⚠️ そのメニューに出ていない項目（権限が無い）なら false */
    openMenuItem: (menu: string, item: string) => boolean;
    openClaude: () => void;
    /** ヘッダーが開いているモーダルを閉じる */
    closeHeaderModals: () => void;
}

export const useGuideScreenReceiver = (handlers: Handlers): void => {
    const { authority, category, shopName, setCategory } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    // ⚠️ message の受け口は1回だけ付ける。⚠️ 最新の値は ref から読む
    const latest = useRef({ handlers, authority, category, shopName, setCategory, navigate });
    latest.current = { handlers, authority, category, shopName, setCategory, navigate };

    /** 開く。⚠️ 開けなければ、その理由 */
    const openRef = useRef((name: string, articleDivision: string | null): string | null => {
        const { handlers: h, authority: a, category: c, shopName: s, setCategory: setC, navigate: nav } = latest.current;
        const plan = planScreen(name, articleDivision, c, s);
        if (!plan.ok) return plan.message;
        const screen = GUIDE_SCREENS[name];
        if (plan.switchLabel !== null && plan.division !== null) {
            setC(plan.division);
            markCategoryChosen(plan.division);
        }
        h.closeHeaderModals();
        if (screen.claude) { h.openClaude(); return null; }
        if (screen.menu !== undefined) {
            const [menu, item] = screen.menu.split('/');
            return h.openMenuItem(menu, item) ? null : `「${name}」はこのアカウントでは開けません。`;
        }
        if (plan.path === null) return `「${name}」は開けません。`;
        nav(plan.path, { state: { authority: a } });
        return null;
    });

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || !isGuideRequest(event.data)) return;
            const { step, id, name, articleDivision } = event.data;
            const { category: c, shopName: s } = latest.current;
            if (step === 'status') {
                replyToGuide(event.source, id, planScreen(name, articleDivision, c, s), openScreenLabel());
                return;
            }
            const error = openRef.current(name, articleDivision);
            replyToGuide(event.source, id, error === null ? planScreen(name, articleDivision, c, s) : { ok: false, message: error }, null);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // ⚠️ 開き直したときの目印。⚠️ 先に URL から消す（⚠️ 再読み込みでまた開かないように）
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const name = params.get(SCREEN_PARAM);
        if (name === null) return;
        const articleDivision = params.get(DIVISION_PARAM);
        params.delete(SCREEN_PARAM);
        params.delete(DIVISION_PARAM);
        const rest = params.toString();
        navigate(`${location.pathname}${rest === '' ? '' : `?${rest}`}`, { replace: true });
        const error = openRef.current(name, articleDivision);
        if (error !== null) window.alert(error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);
};
