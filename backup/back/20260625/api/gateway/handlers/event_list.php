<?php

// 不動産情報
$sql_event = "SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1";
$stmt_event = $pdo->prepare($sql_event);
$stmt_event->execute();
$response_event = $stmt_event->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "event" => $response_event,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
