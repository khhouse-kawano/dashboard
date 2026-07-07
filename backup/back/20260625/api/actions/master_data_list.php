<?php
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = "SELECT id, 
    brand,
    customer_contacts_email as mail,
    step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as reserve,
    in_charge_store as shop,
    step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as contract,
    step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as second_reserve,
    step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as appoint
    FROM master_data";
    $stmt = $pdo->prepare($sql);
    if ($stmt->execute()) {
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        echo json_encode(["message" => "error", "details" => "更新に失敗しました"]);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
