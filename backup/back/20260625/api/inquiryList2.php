<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);
$month = isset($data['month']) ? $data['month'] : "";

    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $db_user = 'xs200571_kawano';
    $db_password = '4081kawano';


try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // SQLクエリを構築
    $sql = "SELECT 
    COALESCE(id, '') as inquiry_id,
    COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
    COALESCE(customer_contacts_mobile_phone_number, '') as mobile,
    COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
    COALESCE(status, '') as status,
    COALESCE(customer_contacts_email, '') as mail
    FROM master_data";

    // プレースホルダーを使ってステートメントを実行
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
?>
