import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { currentMonthValue, previousMonthValue } from './listUtils';

/** URL のクエリ名。値は 'YYYYMM'（例 `/list?startMonth=202610&endMonth=202611`） */
const START_PARAM = 'startMonth';
const END_PARAM = 'endMonth';

/** 'YYYY/MM' → 'YYYYMM' */
const toParam = (month: string): string => month.replace('/', '');

/** 'YYYYMM' → 'YYYY/MM'。⚠️ 選択肢（monthArray）に無ければ null */
const fromParam = (value: string | null, monthArray: string[]): string | null => {
    if (value === null || !/^\d{6}$/.test(value)) return null;
    const month = `${value.slice(0, 4)}/${value.slice(4, 6)}`;
    return monthArray.includes(month) ? month : null;
};

/**
 * 反響一覧（ListOrder / ListKaeru / ListResale）の期間を URL のクエリで持つ（v2.2.275）。
 *
 * ⚠️ URL が正。再読み込み・URL の共有・ブラウザの「戻る」で同じ期間が開く。
 * ⚠️ URL に無い・選択肢に無い値は初期値（開始月は1か月前、終了月は当月）。⚠️ 初期値は URL に書かない。
 *   ⚠️ 不正な値は URL から消す（replace。履歴は増やさない）。
 * ⚠️ 開始月が終了月より後でもそのまま使う（今までどおり 0件。サーバーも同じ扱い）。
 * ⚠️⚠️ ほかのクエリ（中古の `shop=renove`・業務ガイドの目印など）は消さない。
 * ⚠️ 画面の URL は1段のまま（homepage "./" のため /list/... にすると再読み込みで真っ白）。
 */
export const useListPeriod = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawStart = searchParams.get(START_PARAM);
    const rawEnd = searchParams.get(END_PARAM);

    const { startMonth, endMonth, invalid } = useMemo(() => {
        const monthArray = getYearMonthArray(2025, 1);
        const start = fromParam(rawStart, monthArray);
        const end = fromParam(rawEnd, monthArray);
        return {
            startMonth: start ?? previousMonthValue({ monthArray }),
            endMonth: end ?? currentMonthValue(),
            invalid: (rawStart !== null && start === null) || (rawEnd !== null && end === null),
        };
    }, [rawStart, rawEnd]);

    useEffect(() => {
        if (!invalid) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete(START_PARAM);
            next.delete(END_PARAM);
            return next;
        }, { replace: true });
    }, [invalid, setSearchParams]);

    /** ⚠️ 片方を変えても両方を書く（URL だけで期間が決まるように）。⚠️ push なので「戻る」で前の期間に戻る */
    const setPeriod = useCallback((start: string, end: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set(START_PARAM, toParam(start));
            next.set(END_PARAM, toParam(end));
            return next;
        });
    }, [setSearchParams]);

    const setStartMonth = useCallback((month: string) => setPeriod(month, endMonth), [setPeriod, endMonth]);
    const setEndMonth = useCallback((month: string) => setPeriod(startMonth, month), [setPeriod, startMonth]);

    return { startMonth, endMonth, setStartMonth, setEndMonth };
};
