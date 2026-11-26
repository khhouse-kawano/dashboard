import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../utils/apiClient';

/**
 * v2.2.305 ランク（RankOrder / RankKaeru / RankResale）の読み込みと URL。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ふだんは ② の rank_list（GET）で、対象の月（'YYYY/MM'）か期（'YYYY'＝前の年の6月〜その年の5月）に関係する顧客と、
 *   ランクの付いた顧客だけを読む（② の features/rank の runRankList）。⚠️ 画面はこれまでどおり月で数え直す。
 * ⚠️ ② に届かないときは今までの POST の rank（全件）に切り替える（⚠️ 以後はずっと POST。全件なので月を変えても読み直さない）。
 * ⚠️ 返す形は POST の rank と同じ（customer・staff・shop・section・achievement・expected）。
 * ─────────────────────────────────────────────
 */

/** URL の対象の月（?period=）。⚠️ 形が違えば ''（今月） */
export const readRankPeriod = (): string => {
    const value = new URLSearchParams(window.location.search).get('period') ?? '';
    return /^\d{4}(\/\d{2})?$/.test(value) ? value : '';
};

export const useRankLoader = (category: string) => {
    const serverModeRef = useRef(true);
    /** 全件（POST）を読み終えたか */
    const fullLoadedRef = useRef(false);

    /** 対象の月の分を読む（⚠️ ② に届かなければ全件の POST） */
    const fetchRank = useCallback(async (period: string) => {
        if (serverModeRef.current) {
            try {
                const response = await apiClient.get('', { params: { request: 'rank_list', category, period } });
                if (response?.data?.status !== 'ok' || !Array.isArray(response.data.customer)) throw new Error('invalid rank_list response');
                return response;
            } catch (error) {
                console.error('rank_list に失敗しました。全件の読み込みに切り替えます:', error);
                serverModeRef.current = false;
            }
        }
        const response = await apiClient.post('', { request: 'rank', category });
        fullLoadedRef.current = true;
        return response;
    }, [category]);

    /** 月を変えたときに読み直す必要があるか（⚠️ 全件を読み終えていれば要らない） */
    const needsReload = useCallback(() => serverModeRef.current || !fullLoadedRef.current, []);
    /** ② で読んでいるか（⚠️ ランクを直したあとに、② から読み直すか、POST の応答の一覧を使うかを決める） */
    const isServerMode = useCallback(() => serverModeRef.current, []);

    return { fetchRank, needsReload, isServerMode };
};

/** 対象の月を URL（?period=）にも出す（⚠️ 今月なら出さない。ほかのパラメータは残す。履歴は増やさない） */
export const useRankPeriodUrl = (period: string, thisMonth: string) => {
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        if (period === '') return;
        const next = new URLSearchParams(searchParams);
        if (period === thisMonth) next.delete('period');
        else next.set('period', period);
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [period, thisMonth, searchParams, setSearchParams]);
};
