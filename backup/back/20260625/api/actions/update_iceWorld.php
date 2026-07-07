<?php
try {
    $sql = "UPDATE customers SET ice_world = :ice_world WHERE id = :id";
    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(':ice_world', $data['ice_world'], PDO::PARAM_STR);
    $stmt->bindValue(':id', $data['id'], PDO::PARAM_STR);

    $stmt->execute();

    $select = $pdo->prepare("SELECT * FROM customers ORDER BY id ASC");
    $select->execute();
    $customers = $select->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode([
        'error' => '更新エラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
