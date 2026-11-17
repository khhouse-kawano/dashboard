<?php

/**
 * 画面が送る期間（startMonth / endMonth、'YYYYMM'）を月の一覧にする。
 * v2.2.274 で list.php に作り、v2.2.277 で共通にした（反響一覧・店舗別反響推移。v2.2.278 で販促媒体別反響推移も使う）。
 *
 * ⚠️⚠️ ② の backend-express/src/utils/period.ts と同じ規則にすること（② が落ちたときに件数が食い違わないように）。
 */

/**
 * startMonth / endMonth → ['YYYY/MM', ...]。
 *
 * ⚠️ 両方とも無ければ null（今までどおり全件）。⚠️ 開始月が終了月より後なら [] （0件）。
 * ⚠️ 書式が違う・片方だけ・120か月を超えるときは false（呼び出し側で 400）。
 *
 * @return string[]|null|false
 */
function periodMonths(array $data)
{
        $start = $data['startMonth'] ?? '';
        $end = $data['endMonth'] ?? '';
        if ($start === '' && $end === '') return null;
        if (!is_scalar($start) || !is_scalar($end)) return false;
        $start = (string)$start;
        $end = (string)$end;
        $pattern = '/^\d{4}(0[1-9]|1[0-2])$/';
        if (!preg_match($pattern, $start) || !preg_match($pattern, $end)) return false;

        $year = (int)substr($start, 0, 4);
        $month = (int)substr($start, 4, 2);
        $endYear = (int)substr($end, 0, 4);
        $endMonth = (int)substr($end, 4, 2);
        $months = [];
        while ($year < $endYear || ($year === $endYear && $month <= $endMonth)) {
                $months[] = sprintf('%04d/%02d', $year, $month);
                if (count($months) > 120) return false;
                $month++;
                if ($month > 12) {
                        $month = 1;
                        $year++;
                }
        }
        return $months;
}

/**
 * 前年同月を足した月の一覧（昨年実績を出すとき用）。⚠️ 重複は除き、古い順に並べる。
 *
 * @param string[] $months
 * @return string[]
 */
function withLastYearMonths(array $months): array
{
        $all = $months;
        foreach ($months as $m) {
                $all[] = sprintf('%04d', (int)substr($m, 0, 4) - 1) . substr($m, 4);
        }
        $all = array_values(array_unique($all));
        sort($all, SORT_STRING);
        return $all;
}

/**
 * 日付の列を月で絞る条件。⚠️ 画面の判定（'-' を '/' にして先頭7文字）と同じ。
 * $months が null なら絞らない（'1 = 1'）。⚠️ $column は呼び出し側の固定の列名だけを渡す（利用者の入力を入れない）。
 *
 * @param string[]|null $months
 * @return array{0: string, 1: string[]}
 */
function monthCondition(string $column, ?array $months): array
{
        if ($months === null) return ['1 = 1', []];
        if ($months === []) return ['1 = 0', []];
        $marks = implode(', ', array_fill(0, count($months), '?'));
        return ["LEFT(REPLACE({$column}, '-', '/'), 7) IN ({$marks})", $months];
}

/**
 * 日付の列の「どれか1つ」が月の一覧に入る行に絞る条件（店舗別反響推移など）。
 * ⚠️ NULL の列があっても条件が NULL にならないよう COALESCE する。
 * ⚠️ $columns は呼び出し側の固定の列名だけを渡す（利用者の入力を入れない）。
 *
 * @param string[] $columns
 * @param string[]|null $months
 * @return array{0: string, 1: string[]}
 */
function anyMonthCondition(array $columns, ?array $months): array
{
        if ($months === null) return ['1 = 1', []];
        if ($months === [] || $columns === []) return ['1 = 0', []];
        $sqls = [];
        $params = [];
        foreach ($columns as $column) {
                [$sql, $p] = monthCondition("COALESCE({$column}, '')", $months);
                $sqls[] = $sql;
                array_push($params, ...$p);
        }
        return ['(' . implode(' OR ', $sqls) . ')', $params];
}
