<?php
try {
    $sql = "UPDATE customers SET cancel_status = ? WHERE id = ?";
    $stmt = $pdo->prepare($sql);

    if ($stmt->execute([$data['cancel_status'], $data['id']])) {
        $response = ['status' => 'success', 'message' => $data['id'] . 'の登録に成功しました。'];
    } else {
        $response = ['status' => 'error', 'message' => $data['id'] . 'の登録に失敗しました。'];
    }
} catch (PDOException $e) {
    $response = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
