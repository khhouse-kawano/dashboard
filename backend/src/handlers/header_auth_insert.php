<?php
// ログイン用アカウント（staff テーブル）の新規作成。
//
// ⚠️ 人事マスタ（staff_list）には触らない。両テーブルは連携していない。
//   人事登録は EditStaff（header_staff_insert）で別途行う。

$name  = trim($data['name'] ?? '');
$mail  = trim($data['mail'] ?? '');
$brand = $data['brand'] ?? 'ordinary';

// 権限は許可リストで検証する。リクエストの値がそのまま入ると
// 想定外の権限文字列が保存され、画面上どの選択肢にも一致しなくなる。
$allowedBrands = ['Master', 'BrandAdmin', 'ordinary'];

if ($name === '') {
    echo json_encode(["status" => "error", "message" => "氏名を入力してください。"], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($mail === '' || !filter_var($mail, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["status" => "error", "message" => "有効なメールアドレスを入力してください。"], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!in_array($brand, $allowedBrands, true)) {
    echo json_encode(["status" => "error", "message" => "許可されていない権限です。"], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // login.php はメールアドレスだけでユーザーを特定するため、
    // 重複を許すと後から登録した方がログインできなくなる。ここで弾く。
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM staff WHERE mail = ?");
    $stmt->execute([$mail]);
    if ((int) $stmt->fetchColumn() > 0) {
        echo json_encode([
            "status"  => "error",
            "message" => "このメールアドレスは既に登録されています。",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO staff (name, brand, mail) VALUES (:name, :brand, :mail)");
    $stmt->execute([
        ':name'  => $name,
        ':brand' => $brand,
        ':mail'  => $mail,
    ]);

    echo json_encode([
        "status"  => "success",
        "message" => "ログイン用アカウントを作成しました。",
        "id"      => $pdo->lastInsertId(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;

} catch (PDOException $e) {
    error_log('header_auth_insert: ' . $e->getMessage());
    echo json_encode([
        "status"  => "error",
        "message" => "データベースの登録処理に失敗しました。",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
