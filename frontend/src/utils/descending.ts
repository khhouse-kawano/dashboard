/**
 * 選択肢を新しい順（降順）に並べた写しを返す（v2.2.279）。
 *
 * ⚠️ 月・期の配列（getYearMonthArray・getYears）は古い順で作り、期間の切り出しや集計の位置の計算にも使う。
 *   ⚠️ 配列そのものは並べ替えず、`<option>` を並べるところだけこれを通す。
 * ⚠️ 期間を選ぶ欄は、新しい順を標準にする（2026-11-18 の利用者の指示）。
 */
export const descending = <T,>(items: readonly T[]): T[] => [...items].reverse();
