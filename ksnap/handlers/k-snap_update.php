<?php
// handlers/k-snap_update.php
header('Content-Type: application/json; charset=utf-8');

// 必要ならここで $pdo を require_once で読み込む
// require_once __DIR__ . '/../db.php';

// POST 値の取得（デフォルト値）
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

// ▼ 追加: staff_show と owner を取得（未指定時 staff_show は 1 とする）
$staff_show = $_POST['staff_show'] ?? '1';
$owner      = $_POST['owner'] ?? '';

$created_at = date("Y-m-d H:i:s");

// 画像処理関数（アップロードがあれば保存してファイル名を返す）
function handleUploadedImage(array $fileArr): ?string
{
    if (empty($fileArr['tmp_name'])) {
        return null;
    }

    // 拡張子を取得（安全のため小文字化）
    $ext = strtolower(pathinfo($fileArr['name'], PATHINFO_EXTENSION));
    if ($ext === '') {
        return null;
    }

    // ユニークなファイル名
    $imageName = time() . '_' . bin2hex(random_bytes(5)) . '.' . $ext;

    // 保存先（環境に合わせてパスを調整）
    $savePath = "/home/xs200571/khg-marketing.info/public_html/k-snap/images/" . $imageName;

    if (!move_uploaded_file($fileArr['tmp_name'], $savePath)) {
        return null;
    }

    return $imageName;
}

// トランザクションで安全に処理
try {
    $pdo->beginTransaction();

    // 画像がアップロードされているかチェック
    $newImageName = null;
    if (isset($_FILES['image'])) {
        $newImageName = handleUploadedImage($_FILES['image']);
    }

    if ($id !== '') {
        // UPDATE 処理
        // まず既存レコードを取得（古い画像名を削除するため）
        $stmt = $pdo->prepare("SELECT image FROM `k-snap` WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            // id が見つからない場合はロールバックしてエラー
            $pdo->rollBack();
            echo json_encode([
                "status" => "error",
                "message" => "Record not found",
            ]);
            exit;
        }

        // 古い画像を削除するかどうか（新しい画像がアップロードされた場合のみ）
        if ($newImageName && !empty($existing['image'])) {
            $oldPath = "/home/xs200571/khg-marketing.info/public_html/k-snap/images/" . $existing['image'];
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
        }

        // ▼ 変更: UPDATE 文に owner, staff_show を追加
        $sql = "
            UPDATE `k-snap`
            SET detail = ?, category = ?, plan = ?, pref = ?, town = ?,
                brand = ?, shop = ?, url = ?, note = ?, tag = ?, staff = ?, owner = ?, staff_show = ?, image = COALESCE(?, image)
            WHERE id = ?
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $detail,
            $category,
            $plan,
            $pref,
            $town,
            $brand,
            $shop,
            $url,
            $note,
            $tag,
            $staff,
            $owner,      // 追加
            $staff_show, // 追加
            $newImageName,
            $id
        ]);

        $pdo->commit();

        echo json_encode([
            "status" => "success",
            "message" => "updated",
            "id" => $id,
            "image" => $newImageName ?? $existing['image']
        ]);
        exit;
    } else {
        // INSERT 処理
        // ▼ 変更: INSERT 文に owner, staff_show を追加
        $sql = "
            INSERT INTO `k-snap`
            (detail, category, plan, pref, town, brand, shop, url, note, tag, owner, staff_show, image, created_at, staff)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $detail,
            $category,
            $plan,
            $pref,
            $town,
            $brand,
            $shop,
            $url,
            $note,
            $tag,
            $owner,      // 追加
            $staff_show, // 追加
            $newImageName,
            $created_at,
            $staff
        ]);

        $insertId = $pdo->lastInsertId();
        $pdo->commit();

        echo json_encode([
            "status" => "success",
            "message" => "inserted",
            "id" => $insertId,
            "image" => $newImageName
        ]);
        exit;
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
    exit;
}