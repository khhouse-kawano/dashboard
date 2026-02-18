<?php
try {
    $subject = $data['title'];
    $message = $data['html'];
    mb_language("Japanese");
    mb_internal_encoding("UTF-8");
    $encoded_subject = mb_encode_mimeheader($subject, "UTF-8");
    $headers = "From: " . mb_encode_mimeheader($data['brand']) . "<pgcloud@khg-marketing.info>\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: 8bit\r\n";

    if (!empty($data['to']) && !empty($data['html'])) {
        mail($data['to'], $encoded_subject, $message, $headers);
    }
    $response = [
        'status' => 'success',
        'message' => '送信完了'
    ];
} catch (PDOException $e) {
    $response = [
        'status' => 'error',
        'message' => '登録エラー: ' . $e->getMessage()
    ];
}
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
