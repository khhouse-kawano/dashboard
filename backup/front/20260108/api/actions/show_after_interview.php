<?php
try {
    $sql = "SELECT * FROM after_interview WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id']]);

    if ($stmt->rowCount() > 0) {
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $response =  $result;
    } else {
        $sql = "SELECT * FROM after_interview WHERE LEFT(shop, 2) = ? AND REPLACE(REPLACE(name, ' ', ''), '　', '') = ?";
        $stmt = $pdo->prepare($sql);
        $normalizedName = preg_replace('/[ 　]/u', '', $data['name']);
        $stmt->execute([$data['brand'], $normalizedName]);
        if ($stmt->rowCount() > 0) {
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $response = $result;
        } else {
            $response = [
                'status' => 'not_found',
                'message' => '該当するデータが見つかりませんでした'
            ];
        }
    }
} catch (PDOException $e) {
    $response = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
