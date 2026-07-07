<?php
$inquiry_id = isset($data['id']) ? $data['id'] : "";

$sqlUpdate = "UPDATE inquiry_customer
        SET mhl_mail = ?
        WHERE inquiry_id = ? AND mhl_mail = ''";
$stmtUpdate = $pdo->prepare($sqlUpdate);
$now = date("Y-m-d H:i:s");
if ($stmtUpdate->execute([$now . ',' . $data['ua'] . ',' . $data['ip'], $inquiry_id])) {
    echo json_encode(["status" => "success"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode(["status" => "error"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
