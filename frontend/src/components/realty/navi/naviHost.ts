/**
 * 架電ナビ（naviEngine.js）を開く窓口（v2.2.226）。
 *
 * ⚠️ ナビは1つだけ作り、架電キュー・架電ナビの一覧・売り反響の画面から使い回す（以前のアプリの V18 と同じく、
 *   閉じても入力中の内容は残る）。保存のあとは、開いた画面の onSaved を呼ぶ。
 * ⚠️ 反響（brokerage_listings の行）を以前のアプリの形に直して渡す（toNaviLead）。
 */
import { post } from '../common/realtyState';
import type { ApiBody } from '../common/realtyState';
import apiClient from '../../../utils/apiClient';
import { callsOf } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import type { Outcome } from '../callq/callqLogic';
// ⚠️ 以前のアプリの書き方のままの JS（naviEngine.js の見出し）
import { createNavi } from './naviEngine';

type Navi = { open: (lead: Row | null) => void; hist: () => void };

type Ctx = {
    settings: Record<string, unknown>;
    me: string;
    onSaved?: (row: Row | null, oc: Outcome | null) => void;
};

let navi: Navi | null = null;
let ctx: Ctx = { settings: {}, me: '' };

const parseObj = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw !== 'string' || raw.trim() === '') return {};
    try {
        const v: unknown = JSON.parse(raw);
        return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
    } catch {
        return {};
    }
};

/**
 * 売り反響の行 → 以前のアプリの形。
 *   callDates … JSON 文字列 → 配列
 *   detail    … ポータルの反響の詳細（年齢・面積・希望連絡時間など）。Dashboard に列が無いので原本（raw_data）から読む
 */
export const toNaviLead = (row: Row): Row => ({
    ...row,
    callDates: callsOf(row),
    detail: parseObj(parseObj(row.raw_data).detail),
});

/** 画面に出す知らせ（ナビを閉じたあと。以前のアプリの window.toast） */
const toast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#212529;color:#fff;padding:8px 18px;border-radius:6px;font-size:12px;z-index:3000;max-width:90vw';
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2600);
};

/** 保存の失敗。⚠️ 通信の失敗・② の障害（5xx）だけ retryable（未送信として残して送り直す）。入力の誤りは残さない */
class SaveError extends Error {
    retryable: boolean;
    constructor(message: string, retryable: boolean) {
        super(message);
        this.retryable = retryable;
    }
}

const save = async (payload: Record<string, unknown>): Promise<ApiBody> => {
    try {
        // ⚠️ ① を通ると {} が [] になるため、JSON は文字列で送る（② の parseJsonText）
        const res = await apiClient.post<ApiBody>('', { request: 'planner', roll: 'navi_save', json: JSON.stringify(payload) });
        if (res.data?.status === 'error') throw new SaveError(res.data.message || '保存に失敗しました', false);
        return res.data;
    } catch (e: unknown) {
        if (e instanceof SaveError) throw e;
        const r = (e as { response?: { status?: number; data?: ApiBody } })?.response;
        if (r && r.status !== undefined && r.status < 500) throw new SaveError(r.data?.message || '保存に失敗しました', false);
        throw new SaveError('通信に失敗しました', true);
    }
};

const ensure = (): Navi => {
    if (navi) return navi;
    navi = createNavi({
        me: () => ctx.me,
        settings: () => ctx.settings,
        save,
        loadLogs: async (from: string, to: string) => ((await post('call_logs', { from, to })).logs as Row[]) ?? [],
        onSaved: (row: Row | null, oc: Outcome | null) => ctx.onSaved?.(row, oc),
        toast,
    }) as Navi;
    return navi;
};

/** 架電ナビを開く。lead が null なら「反響を選ばずに開始」 */
export const openNavi = (args: Ctx & { lead: Row | null }): void => {
    ctx = { settings: args.settings, me: args.me, onSaved: args.onSaved };
    ensure().open(args.lead ? toNaviLead(args.lead) : null);
};

/** 通話履歴・分析だけを開く */
export const openNaviHistory = (args: Ctx): void => {
    ctx = { settings: args.settings, me: args.me, onSaved: args.onSaved };
    ensure().hist();
};
