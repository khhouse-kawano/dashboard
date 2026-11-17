import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getYearMonthArray } from './getYearMonthArray';
import { get11MonthsAgoString } from './get11MonthsAgoString';

/** URL のクエリ名。値は 'YYYYMM'（例 `/list?startMonth=202610&endMonth=202611`） */
const START_PARAM = 'startMonth';
const END_PARAM = 'endMonth';

/** 'YYYY/MM' → 'YYYYMM'（URL・サーバーへ送る形） */
export const toMonthParam = (month: string): string => month.replace('/', '');

/** 'YYYYMM' → 'YYYY/MM'。⚠️ 選択肢（monthArray）に無ければ null */
const fromParam = (value: string | null, monthArray: string[]): string | null => {
    if (value === null || !/^\d{6}$/.test(value)) return null;
    const month = `${value.slice(0, 4)}/${value.slice(4, 6)}`;
    return monthArray.includes(month) ? month : null;
};

/**
 * URL に無いときの期間（初期値）。⚠️ 選択肢（2025/01〜当月）の中の値を返すこと。
 * ⚠️⚠️ モジュールの定数として作って渡す（画面の中で毎回作ると、描画のたびに期間を計算し直す）。
 */
export interface MonthPeriodDefaults {
    start: (monthArray: string[]) => string;
    end: (monthArray: string[]) => string;
}

/**
 * 推移の画面の初期値：開始月は11か月前（日本時間。選択肢に無ければ先頭）、終了月は選択肢の最後（当月）。
 * ⚠️ 店舗別反響推移（注文・建売）で使う。v2.2.278 で販促媒体別反響推移も使う。
 * ⚠️ 以前の画面は終了月を空（＝最後の月まで）にしていた。選択肢の最後を入れても表示する月は同じ。
 */
export const TREND_PERIOD_DEFAULTS: MonthPeriodDefaults = {
    start: monthArray => {
        const value = get11MonthsAgoString().replace('-', '/');
        return monthArray.includes(value) ? value : monthArray[0];
    },
    end: monthArray => monthArray[monthArray.length - 1],
};

/**
 * 期間（開始月・終了月）を URL のクエリで持つ。v2.2.275 に反響一覧用（list/useListPeriod.ts）で作り、
 * v2.2.277 で店舗別反響推移でも使うよう汎用にした（v2.2.278 で販促媒体別反響推移も使う）。
 *
 * ⚠️ URL が正。再読み込み・URL の共有・ブラウザの「戻る」で同じ期間が開く。
 * ⚠️ URL に無い・選択肢に無い値は初期値（defaults）。⚠️ 初期値は URL に書かない。
 *   ⚠️ 不正な値は URL から消す（replace。履歴は増やさない）。
 * ⚠️ 開始月が終了月より後でもそのまま使う（0件。サーバーも同じ扱い）。
 * ⚠️⚠️ ほかのクエリ（中古の `shop=renove`・業務ガイドの目印など）は消さない。
 * ⚠️ 画面の URL は1段のまま（homepage "./" のため /list/... にすると再読み込みで真っ白）。
 * ⚠️ Menu.tsx は startMonth / endMonth を除いた URL でメニューの選択状態を決めている。
 */
export const useMonthPeriod = (defaults: MonthPeriodDefaults) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawStart = searchParams.get(START_PARAM);
    const rawEnd = searchParams.get(END_PARAM);

    const { startMonth, endMonth, invalid } = useMemo(() => {
        const monthArray = getYearMonthArray(2025, 1);
        const start = fromParam(rawStart, monthArray);
        const end = fromParam(rawEnd, monthArray);
        return {
            startMonth: start ?? defaults.start(monthArray),
            endMonth: end ?? defaults.end(monthArray),
            invalid: (rawStart !== null && start === null) || (rawEnd !== null && end === null),
        };
    }, [rawStart, rawEnd, defaults]);

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
            next.set(START_PARAM, toMonthParam(start));
            next.set(END_PARAM, toMonthParam(end));
            return next;
        });
    }, [setSearchParams]);

    const setStartMonth = useCallback((month: string) => setPeriod(month, endMonth), [setPeriod, endMonth]);
    const setEndMonth = useCallback((month: string) => setPeriod(startMonth, month), [setPeriod, startMonth]);

    return { startMonth, endMonth, setStartMonth, setEndMonth };
};
