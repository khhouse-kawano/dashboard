<?php
$data = $_POST;

$allowed = [
    'name',
    'staff',
    'status',
    'rank',
    'rank_period',
    'medium',
    'importance',
    'period',
    'budget',
    'register',
    'reserve',
    'line_group',
    'screening',
    'survey',
    'note',
    'call_status'
];

$setParts = [];
$params = [];

foreach ($allowed as $column) {
    if (isset($data[$column])) {
        $setParts[] = "$column = :$column";
        $params[":$column"] = $data[$column];
    }
}
try {
    $sql = "UPDATE customers SET " . implode(", ", $setParts) . " WHERE id = :id";
    $params[':id'] = $id;

    $stmt = $dbh->prepare($sql);
    $stmt->execute($params);

    $select = $pdo->prepare("SELECT * FROM customers ORDER BY register DESC");
    $select->execute();
    $customers = $select->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'customers' => $customers
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => '更新エラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
