<?php

$sql_estate = "SELECT 1 FROM customers_estate WHERE id = ?";
$stmt_estate = $pdo->prepare($sql_estate);
$stmt_estate->execute([$data['id']]);
$exists = $stmt_estate->fetchColumn() !== false;

if ($exists) {
    $sql = 'UPDATE customers_estate 
            SET budget = :budget, pref = :pref, town = :town, area = :area, 
                land_area = :land_area, walk = :walk ,for_house = :for_house
            WHERE id = :id';
    $successMessage = $data['id'] . '様の希望土地情報を更新しました。';
} else {
    $sql = 'INSERT INTO customers_estate 
            (budget, pref, town, area, land_area, walk,for_house, id) 
            VALUES (:budget, :pref, :town, :area, :land_area, :walk,:for_house, :id)';
    $successMessage = $data['id'] . '様の希望土地情報を登録しました。';
}

$stmt = $pdo->prepare($sql);
$stmt->bindValue(':budget', $data['budget'], PDO::PARAM_INT);
$stmt->bindValue(':pref', $data['pref'], PDO::PARAM_STR);
$stmt->bindValue(':town', $data['town'], PDO::PARAM_STR);
$stmt->bindValue(':area', json_encode($data['area'] ?? []), PDO::PARAM_STR);
$stmt->bindValue(':land_area', $data['land_area'], PDO::PARAM_INT);
$stmt->bindValue(':walk', $data['walk'], PDO::PARAM_INT);
$stmt->bindValue(':for_house', $data['for_house'], PDO::PARAM_STR);
$stmt->bindValue(':id', $data['id'], PDO::PARAM_STR);

if ($stmt->execute()) {
    $response_area = ['status' => 'success', 'message' => $successMessage];
} else {
    $response_area = ['status' => 'error', 'message' => $data['id'] . '様の希望土地情報の処理に失敗しました。'];
}
