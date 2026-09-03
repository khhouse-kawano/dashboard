<?php

/**
 * 公開ギャラリーのログイン。パスワードから顧客IDを引く。
 *
 * リクエスト: { "request": "k-snap_login", "pass": "..." }
 *
 * ⚠️⚠️ これは**顧客向けの公開API**である。認証を要求してはいけない。
 *   認証の一括強化を行うときは必ず除外すること。
 *
 * ⚠️ パスワードは `k-snap_customer.pass` に平文で保存されており、
 *   ここで平文比較している。加えて試行回数の制限が無い。
 *   4桁程度なら総当たりで突破できる。写真の閲覧権限しか無いとはいえ、
 *   **他人の顧客ページ（氏名を含む写真）が見られる**ことになる。
 *   対策は認証の再設計とは別の課題として docs に残すこと。
 */

$pass = $data['pass'] ?? null;

if ($pass === null || trim($pass) === '') {
    echo json_encode(["status" => "error"]);
    exit;
}

try {
    $sql = "SELECT `id` FROM `k-snap_customer` WHERE `pass` = :pass LIMIT 1";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':pass' => $pass]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        echo json_encode([
            "status" => "success",
            "id"      => $result['id']
        ]);
    } else {
        echo json_encode(["status" => "not_found"]);
    }
    exit;

} catch (PDOException $e) {
    echo json_encode(["status" => "error"]);
    exit;
}