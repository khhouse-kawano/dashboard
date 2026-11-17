import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from './apiClient';
import { toMonthParam } from './useMonthPeriod';

/**
 * 追加で取るもの（例 `{ lastYear: 昨年実績のチェック, budget: 広告費のチェック }`）。
 * ⚠️ true のときだけ `キー=1` を送る。false のキーは送らない。
 */
export type TrendFlags = Record<string, boolean>;

interface TrendQuery {
    category: string;
    startMonth: string;
    endMonth: string;
    flags: TrendFlags;
}

/**
 * 読み込み済みの応答で、いまの表示に足りるか。
 * ⚠️ 期間が同じで、いま必要な追加分（true のフラグ）を読み込み済みなら足りる。
 *   ⚠️ チェックを外しただけ（true → false）なら取り直さない（多めに持っていても数字は変わらない）。
 */
const covers = (loaded: TrendQuery | null, need: TrendQuery): boolean =>
    loaded !== null
    && loaded.category === need.category
    && loaded.startMonth === need.startMonth
    && loaded.endMonth === need.endMonth
    && Object.entries(need.flags).every(([key, on]) => !on || loaded.flags[key] === true);

/**
 * 推移の画面（店舗別反響推移。v2.2.278 で販促媒体別反響推移も）のデータを、期間の分だけ GET で読む（v2.2.277）。
 *
 * ⚠️ startMonth / endMonth は画面の 'YYYY/MM'（'YYYYMM' にして送る）。
 * ⚠️ ① の core/db.php の GET_ALLOWED_REQUESTS に request が入っていないと 400 になる。
 * ⚠️ 期間・フラグが変わったら読み直す。⚠️ 店舗・媒体などの絞り込みは画面の中だけで済むので読み直さない。
 * ⚠️ 古い応答で新しい条件の結果を上書きしない（連番 seqRef。反響一覧の loadSeqRef と同じ考え方）。
 *
 * @returns data … 最後に読み込めた応答（⚠️ isReady が false の間は、いまの条件とは別の期間のもの）
 *          isReady … いまの条件に足りるデータが揃っているか。⚠️ false の間は数字を出さないこと
 *          failed … いまの条件の読み込みに失敗したか
 *          reload … いまの条件で読み直す（顧客の詳細を閉じたあとなど）
 */
export const useTrendData = <T,>(request: string, category: string, startMonth: string, endMonth: string, flags: TrendFlags) => {
    const [loaded, setLoaded] = useState<{ data: T; query: TrendQuery } | null>(null);
    const [failed, setFailed] = useState(false);
    const seqRef = useRef(0);

    // ⚠️ flags は画面が毎回作り直すオブジェクトなので、中身の文字列で変化を見る
    const flagsKey = JSON.stringify(flags);
    const needRef = useRef<TrendQuery>({ category, startMonth, endMonth, flags });
    needRef.current = { category, startMonth, endMonth, flags };

    const load = useCallback(async (query: TrendQuery) => {
        const seq = ++seqRef.current;
        setFailed(false);
        const flagParams = Object.fromEntries(Object.entries(query.flags).filter(([, on]) => on).map(([key]) => [key, '1']));
        try {
            const response = await apiClient.get('', {
                params: {
                    request,
                    category: query.category,
                    startMonth: toMonthParam(query.startMonth),
                    endMonth: toMonthParam(query.endMonth),
                    ...flagParams,
                },
            });
            if (seq !== seqRef.current) return;
            setLoaded({ data: response.data as T, query });
        } catch (error) {
            if (seq !== seqRef.current) return;
            console.error(`${request} の取得エラー:`, error);
            setFailed(true);
        }
    }, [request]);

    useEffect(() => {
        if (!category || !startMonth || !endMonth) return;
        const need = needRef.current;
        if (covers(loaded?.query ?? null, need)) {
            // ⚠️ 読み込み中の古い条件の応答（例: 期間を変えてすぐ元に戻した）が後から届いても捨てる
            seqRef.current++;
            setFailed(false);
            return;
        }
        void load(need);
        // ⚠️ loaded は入れない（読み込みが終わるたびに読み直すことになる）。flags は flagsKey で見る
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, startMonth, endMonth, flagsKey, load]);

    const reload = useCallback(() => { void load(needRef.current); }, [load]);

    const isReady = covers(loaded?.query ?? null, needRef.current);
    return { data: loaded?.data ?? null, isReady, failed: failed && !isReady, reload };
};
