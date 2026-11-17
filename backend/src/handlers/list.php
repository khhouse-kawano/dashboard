<?php
$category = $data['category'] ?? '';

$allowed_categories = ['order', 'spec', 'used', 'common'];

$roll = $data['roll'] ?? '';

if (!in_array($category, $allowed_categories, true)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なカテゴリです']);
        exit;
}

/**
 * 反響一覧の期間（v2.2.274）。startMonth / endMonth（'YYYYMM'）→ ['YYYY/MM', ...]。
 *
 * ⚠️ 両方とも無ければ null（今までどおり全件）。⚠️ 開始月が終了月より後なら [] （0件）。
 * ⚠️ 書式が違う・片方だけ・120か月を超えるときは false（呼び出し側で 400）。
 * ⚠️⚠️ ② の features/list/period.ts の listPeriodMonths() と同じ規則にすること。
 *
 * @return string[]|null|false
 */
function listPeriodMonths(array $data)
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
 * 日付の列を月で絞る条件。⚠️ 画面の monthFormate（'-' を '/' にして先頭7文字）と同じ判定。
 * $months が null なら絞らない（'1 = 1'）。⚠️ $column は呼び出し側の固定の列名だけを渡す（利用者の入力を入れない）。
 *
 * @param string[]|null $months
 * @return array{0: string, 1: string[]}
 */
function listMonthCondition(string $column, ?array $months): array
{
        if ($months === null) return ['1 = 1', []];
        if ($months === []) return ['1 = 0', []];
        $marks = implode(', ', array_fill(0, count($months), '?'));
        return ["LEFT(REPLACE({$column}, '-', '/'), 7) IN ({$marks})", $months];
}

if ($roll) {
        require_once __DIR__ . "/listAction/list_{$roll}.php";
} else {
        $listMonths = listPeriodMonths($data);
        if ($listMonths === false) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => '期間の指定が正しくありません'], JSON_UNESCAPED_UNICODE);
                exit;
        }
        // ⚠️ 重複判定用の全反響（軽い列だけ）を返すか（注文だけ。画面が初回と再読み込みのときに dup=1 を送る）
        $listWithDup = ($data['dup'] ?? '') === '1' || ($data['dup'] ?? null) === 1;
        require_once __DIR__ . "/listAction/list_{$category}.php";
}


exit;
