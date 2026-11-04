import { googleLogout } from '@react-oauth/google';
import apiClient from './apiClient';

/**
 * ログアウト（v2.2.242 新規）。右上のパネル（components/ActiveUser.tsx）のボタンから呼ぶ。
 *
 * ─────────────────────────────────────────────
 * 1. ① の logout（backend/src/handlers/logout.php）で staff.api_token を空にし、日時を残す
 *    ⚠️ 失敗しても（トークンが無効・通信できない）2 以降は必ず行う（⚠️ 画面を閉じられない状態にしない）
 * 2. Google の自動選択を止め、ログイン画面の One Tap を出さない目印を付ける（JUST_LOGGED_OUT。Login.tsx が読む）
 *    ⚠️ 付けないと、ログイン画面に戻った直後に One Tap からそのまま入り直してしまうことがある（2026-11-04 の決定）
 * 3. 保存しているログインの情報を消して、ログイン画面へ（⚠️ 再読み込みで AuthProvider の状態ごと消す）
 * ─────────────────────────────────────────────
 */

/** ⚠️ sessionStorage のキー（⚠️ そのタブだけ。ログインに成功したら Login.tsx が消す） */
export const JUST_LOGGED_OUT = 'just_logged_out';

/** ⚠️ 消す値（⚠️ category は残す。次に入ったときの事業を選び直す画面で上書きされる） */
const AUTH_KEYS = ['token', 'authority', 'userName', 'shopName'];

export const logout = async (): Promise<void> => {
    try {
        await apiClient.post('', { request: 'logout' });
    } catch (error) {
        console.error('ログアウトの記録に失敗しました（画面からはログアウトします）:', error);
    }
    googleLogout();
    try {
        sessionStorage.setItem(JUST_LOGGED_OUT, '1');
    } catch {
        // ⚠️ 保存できない環境（プライベートモードなど）でも、ログアウトは続ける
    }
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
    window.location.replace('/dashboard/login');
};
