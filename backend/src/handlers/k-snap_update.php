<?php

/**
 * スナップ写真の登録・更新（画像アップロードを含む）。
 *
 * リクエスト: multipart/form-data
 *   request=k-snap_update, id（空なら新規）, detail, category, plan, pref, town,
 *   brand, shop, note, url, staff, tag（JSON文字列）, owner, staff_show, image
 *
 * ⚠️ **1リクエストにつき画像1枚**。フロント（photo/Form.tsx）は複数枚のとき
 *   1枚ずつ順番に送っている。ここを複数対応にする場合はフロントも同時に変えること。
 *
 * ⚠️ **Express へは移植できない。** 画像の保存先が ① のファイルシステムであり、
 *   ② VPS からは書き込めない（SSHトンネルはMySQLのTCPだけを通している）。
 *   移植するには画像の置き場所を先に決める必要がある。
 *
 * ⚠️ 移行時に拡張子と実体の検証を追加した（core/ksnap.php）。
 *   移行前は利用者が送ったファイル名の拡張子をそのまま使っており、
 *   `evil.php` を公開ディレクトリに置ける状態だった。**検証を緩めないこと。**
 */

require_once __DIR__ . '/../core/ksnap.php';

header('Content-Type: application/json; charset=utf-8');

// ⚠️ multipart なので $data ではなく $_POST から取る（core/db.php を参照）
$id        = $_POST['id'] ?? '';
$detail    = $_POST['detail'] ?? '';
$category  = $_POST['category'] ?? '';
$plan      = $_POST['plan'] ?? '';
$pref      = $_POST['pref'] ?? '';
$town      = $_POST['town'] ?? '';
$brand     = $_POST['brand'] ?? '';
$shop      = $_POST['shop'] ?? '';
$note      = $_POST['note'] ?? '';
$url       = $_POST['url'] ?? '';
$staff     = $_POST['staff'] ?? '';
$tag       = $_POST['tag'] ?? '[]'; // JSON文字列のまま保存
$staff_show = $_POST['staff_show'] ?? '1';
$owner      = $_POST['owner'] ?? '';

$created_at = date('Y-m-d H:i:s');

try {
    $pdo->beginTransaction();

    $newImageName = null;
    if (isset($_FILES['image'])) {
        $newImageName = ksnapSaveUploadedImage($_FILES['image']);
    }

    if ($id !== '') {
        // -----------------------------------------------------------------
        // 更新
        // -----------------------------------------------------------------
        // 古い画像を消すため、先に既存の値を取る
        $stmt = $pdo->prepare('SELECT image FROM `k-snap` WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            $pdo->rollBack();
            echo json_encode([
                'status' => 'error',
                'message' => 'Record not found',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // ⚠️ 新しい画像の保存に成功した場合だけ古い画像を消す。
        //   保存失敗時に消すと、画像が1枚も無い状態になる。
        if ($newImageName !== null && !empty($existing['image'])) {
            ksnapDeleteImage((string) $existing['image']);
        }

        // ⚠️ image = COALESCE(?, image) にしているのは、画像を差し替えないときに
        //   既存のファイル名を保つため。null を直接入れると画像が消える。
        $sql = "
            UPDATE `k-snap`
            SET detail = ?, category = ?, plan = ?, pref = ?, town = ?,
                brand = ?, shop = ?, url = ?, note = ?, tag = ?, staff = ?, owner = ?, staff_show = ?, image = COALESCE(?, image)
            WHERE id = ?
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $detail, $category, $plan, $pref, $town,
            $brand, $shop, $url, $note, $tag, $staff, $owner, $staff_show,
            $newImageName, $id,
        ]);

        $pdo->commit();

        echo json_encode([
            'status' => 'success',
            'message' => 'updated',
            'id' => $id,
            'image' => $newImageName ?? $existing['image'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -----------------------------------------------------------------
    // 新規
    // -----------------------------------------------------------------
    // ⚠️ 新規で画像が無いのは異常。保存に失敗した場合もここに来る。
    //   画像の無いレコードを作ると一覧で空欄になり、原因が追えなくなる。
    if ($newImageName === null) {
        $pdo->rollBack();
        error_log('k-snap_update: 新規登録で画像が保存できませんでした');
        echo json_encode([
            'status' => 'error',
            'message' => '画像を保存できませんでした。JPGまたはPNG形式か確認してください。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "
        INSERT INTO `k-snap`
        (detail, category, plan, pref, town, brand, shop, url, note, tag, owner, staff_show, image, created_at, staff)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $detail, $category, $plan, $pref, $town,
        $brand, $shop, $url, $note, $tag, $owner, $staff_show,
        $newImageName, $created_at, $staff,
    ]);

    $insertId = $pdo->lastInsertId();
    $pdo->commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'inserted',
        'id' => $insertId,
        'image' => $newImageName,
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    // ⚠️ 例外メッセージをそのまま返さない。SQLやパスが外部に漏れる
    error_log('k-snap_update failed: ' . $e->getMessage());
    echo json_encode([
        'status' => 'error',
        'message' => '保存に失敗しました。',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
