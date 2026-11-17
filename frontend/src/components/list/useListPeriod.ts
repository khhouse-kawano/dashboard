import { useMonthPeriod } from '../../utils/useMonthPeriod';
import type { MonthPeriodDefaults } from '../../utils/useMonthPeriod';
import { currentMonthValue, previousMonthValue } from './listUtils';

/** 反響一覧の初期値：開始月は1か月前（選択肢に無ければ先頭）、終了月は当月 */
const LIST_PERIOD_DEFAULTS: MonthPeriodDefaults = {
    start: monthArray => previousMonthValue({ monthArray }),
    end: () => currentMonthValue(),
};

/**
 * 反響一覧（ListOrder / ListKaeru / ListResale）の期間を URL のクエリで持つ（v2.2.275）。
 * ⚠️ v2.2.277: 中身は utils/useMonthPeriod.ts に移した（店舗別反響推移と共通）。決まりはそちらのコメント。
 */
export const useListPeriod = () => useMonthPeriod(LIST_PERIOD_DEFAULTS);
