<?php

// 架電情報
//
// ⚠️⚠️ 対象店舗は backend-express/src/features/inside.ts の TARGET_SHOPS と
//   **同じ内容にしておくこと。** 片方だけ直すと、転送に失敗して ① に
//   フォールバックしたときに対象店舗が食い違う。
//
// ⚠️⚠️ **'PG HOUSE霧島店' は表記ゆれである。消さないこと。**
//   2026-09-11 に実データを数えたところ
//     PGH霧島店      … 222件
//     PG HOUSE霧島店 … 1件
//   の2通りが入っていた。'PGH霧島店' だけにすると1件が漏れる（エラーは出ない）。
//   ⚠️ 本来はデータを直すのが筋。call_sheet を 'PGH霧島店' に UPDATE したら
//     この行を消してよい。直すまでは残すこと。
$sql_call = "SELECT * FROM call_sheet WHERE shop IN ('KH熊本店', 'KH八代店', 'JH熊本店', 'JH八代店', 'PGH霧島店', 'PG HOUSE霧島店');";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute();
$response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);


// スタッフ
//
// インサイドセールス担当は staff_list.inside = 1 で管理されている。
// 以前は staff.brand = 'insideSales' で引いていたが、これはログインの権限区分であり
// 担当者の登録簿ではないため、実際の担当3名のうち1名しか返っていなかった。
//
// ⚠️ staff_list は配属年度（period）ごとに行が増え、同じ人が複数行に現れる。
//   今は全員 period = 2027 の1行だけだが、年度が変わると重複してセレクトボックスに
//   同じ名前が並ぶ。GROUP BY で1人1行に畳んでおく。
$sql_staff = "SELECT name
        FROM staff_list
       WHERE inside = 1 AND name <> ''
       GROUP BY name
       ORDER BY MIN(sort), MIN(id);";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "call" => $response_call,
    "staff" => $response_staff,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
