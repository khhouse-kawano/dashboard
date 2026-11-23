import { useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 架電ステータス・架電アクションの選択肢（v2.2.293。② の request call_status_options。表は call_status）。
 *
 * ─────────────────────────────────────────────
 * 使うところ:
 *   ・顧客DB（DatabaseOrder.tsx・DatabaseKaeru.tsx・DatabaseResale.tsx）の「架電状況」の絞り込み … statuses
 *   ・顧客情報の架電記録（information/TableCall.tsx）の架電ステータス … statuses、アクション内容 … actions
 * 管理: ヘッダーの「システム管理 → 架電ステータス」（header/system/CallStatusSettings.tsx）。
 *
 * ⚠️ ② には category ではなく division を送る（category はゲートウェイの振り分けの鍵に入るため）。
 * ⚠️ 事業ごとに1回だけ読む（同じ画面で何度開いても読み直さない）。管理画面で保存したら clearCallStatusOptionsCache() で捨てる。
 * ⚠️⚠️ ② に届かない・応答が正しくないときは、v2.2.292 まで画面に書いてあった固定の選択肢（FALLBACK）を使う。
 * ⚠️ 非表示にした値でも、そのお客様に今入っている値は withCurrent() で選択肢に残す（残さないと select が先頭を出し、
 *   触っていないのに値が変わったように見える・保存すると消える）。
 * ─────────────────────────────────────────────
 */

export type CallStatusOptions = { statuses: string[]; actions: string[] };

/** ② に届かないときの選択肢（⚠️ v2.2.292 まで画面に固定で書いてあったもの。足さないこと） */
export const FALLBACK_CALL_STATUS_OPTIONS: CallStatusOptions = {
    statuses: ['未通電', '継続', '来場アポ', '来場済み', '架電停止'],
    actions: ['通電', '未通電', 'SMS送信', 'メール送信', '資料郵送', '次回架電日'],
};

const cache = new Map<string, Promise<CallStatusOptions>>();

const strings = (v: unknown): string[] | null =>
    Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;

/** 事業（order / spec / used）の選択肢を読む（⚠️ 失敗したら固定の選択肢。次に開いたときは読み直す） */
export const loadCallStatusOptions = (division: string): Promise<CallStatusOptions> => {
    const cached = cache.get(division);
    if (cached) return cached;
    const promise = apiClient.post('', { request: 'call_status_options', division })
        .then((res) => {
            const statuses = strings(res.data?.statuses);
            const actions = strings(res.data?.actions);
            if (res.data?.status !== 'ok' || statuses === null || actions === null) throw new Error('call_status_options の応答が正しくありません');
            return { statuses, actions };
        })
        .catch((e) => {
            console.error('架電ステータスの選択肢を読めませんでした。固定の選択肢を使います:', e);
            cache.delete(division);
            return FALLBACK_CALL_STATUS_OPTIONS;
        });
    cache.set(division, promise);
    return promise;
};

/** 管理画面で保存したあとに呼ぶ（⚠️ 次に開いた画面が新しい選択肢を読む） */
export const clearCallStatusOptionsCache = (): void => cache.clear();

/** 選択肢を読む（⚠️ 読み終わるまでは固定の選択肢を出す） */
export const useCallStatusOptions = (division: string): CallStatusOptions => {
    const [options, setOptions] = useState<CallStatusOptions>(FALLBACK_CALL_STATUS_OPTIONS);
    useEffect(() => {
        let alive = true;
        void loadCallStatusOptions(division).then((o) => { if (alive) setOptions(o); });
        return () => { alive = false; };
    }, [division]);
    return options;
};

/** 今の値が選択肢に無ければ（非表示にした・名前を変えた）、先頭に足して残す */
export const withCurrent = (options: string[], current: string | undefined | null): string[] =>
    current && !options.includes(current) ? [current, ...options] : options;
