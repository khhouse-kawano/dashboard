<?php

/**
 * 市況分析（Market）で共通に使う SQL 断片。
 *
 * e-Stat 由来の3テーブルは area の表記体系が揃っていない。
 * ここを吸収しないと市区町村どうしが突合できず、世帯数や着工棟数が
 * 一覧に出てこない（実際、旧実装では郡下の町の世帯数が常に「-」だった）。
 *
 *   population   郡 = 「三養基郡」        町 = 「三養基郡基山町」（郡名が接頭辞に付く）
 *   building     郡 = 「三養基郡」        町 = 「基山町」
 *   households   郡 = 無し               町 = 「基山町」
 *
 * そこで「郡名の接頭辞を落とした市区町村名」を areaKey として全テーブルに持たせ、
 * 突合はこのキーで行う。
 */

/**
 * area から突合用のキーを作る SQL 式を返す。
 *
 * 親（郡・政令市）の接頭辞を落として、市区町村レベルの名前だけを残す。
 *
 *   三養基郡基山町 → 基山町     population は郡名を前置きする
 *   熊本市中央区   → 中央区     population / households は市名を前置きする
 *   熊本市　中央区 → 中央区     households_c は全角スペース区切り
 *   中央区         → 中央区     building は最初から市名なし
 *   三養基郡       → 三養基郡   郡そのものは集計単位なので残す
 *   鹿児島市       → 鹿児島市   親を持たない市はそのまま
 *
 * 「南九州市」「いちき串木野市」のように市名の途中に市や郡を含むものを
 * 削ってしまわないよう、末尾が町村区で終わる場合だけ接頭辞を外している。
 *
 * ※ 全国に広げると、同じ県内に同名の区が生まれる（横浜市南区と相模原市南区は
 *   どちらも「南区」）。市況分析の対象は九州で、区を持つのは熊本市だけなので
 *   今は衝突しない。対象県を広げるときはここを見直すこと。
 *
 * @param string $column テーブル別名を含む列名（例: 'p.area'）
 */
function marketAreaKeyExpr(string $column): string
{
    return "IF({$column} REGEXP '^.+?[郡市][[:space:]　]*.+[町村区]$', "
        . "REGEXP_REPLACE({$column}, '^.+?[郡市][[:space:]　]*', ''), "
        . "{$column})";
}

/**
 * 「郡そのもの」の行かどうかを返す SQL 式。
 *
 * 郡の行は、その郡に属する町の行と数値が重複している
 * （佐賀県2025/10 なら 三養基郡12 = 基山町6 + 上峰町2 + みやき町4）。
 * 県全体の合計を出すときは、郡の行を必ず除外しないと二重に数えてしまう。
 *
 * @param string $column テーブル別名を含む列名
 */
function marketIsDistrictExpr(string $column): string
{
    return "({$column} REGEXP '郡$')";
}

/**
 * 「政令市の区」の行かどうかを返す SQL 式。
 *
 * 区の行は、その区が属する市の行と数値が重複している
 * （熊本県2026/06 なら 熊本市128 = 中央区12 + 東区40 + 西区13 + 南区31 + 北区32）。
 * 郡とは親子が逆だが、素朴に足すと二重に数える点は同じなので、
 * 県計を作るときは郡と一緒に除外する。
 *
 * ※ 東京23区は市に属さない特別区で、これを除くと東京都の合計が過小になる。
 *   市況分析の対象は九州のため今は問題にならないが、対象県を広げるときは
 *   ここを見直すこと。
 *
 * @param string $column テーブル別名を含む列名
 */
function marketIsWardExpr(string $column): string
{
    return "({$column} REGEXP '区$')";
}

/**
 * text 型で保存された日付を 'YYYY-MM-DD' に整える SQL 式を返す。
 *
 * master_data 系のステップ日付は text 型で、`2024/08/08` と `2024-08-08` が混在する。
 * どちらでも読めるように2通り試し、読めなければ NULL にする。
 * COALESCE の順序に意味は無い（同じ文字列が両方の形式で成立することはない）。
 *
 * @param string $column テーブル別名を含む列名
 */
function marketTextDateExpr(string $column): string
{
    $trimmed = "NULLIF(TRIM({$column}), '')";
    return "DATE_FORMAT("
        . "COALESCE(STR_TO_DATE({$trimmed}, '%Y/%m/%d'), STR_TO_DATE({$trimmed}, '%Y-%m-%d'))"
        . ", '%Y-%m-%d')";
}

/**
 * JSON を返して終了する。全ハンドラで同じ形にそろえるための入口。
 *
 * JSON_UNESCAPED_UNICODE を付けないと日本語が \uXXXX に展開されて
 * レスポンスが数倍に膨らむ。
 */
function marketRespond(array $payload): void
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
