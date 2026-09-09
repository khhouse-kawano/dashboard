<?php

/**
 * 競合資料（PDF）のアップロードと competitor_pdf テーブルへの保存。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **この処理は ① レンタルサーバーに残す。② VPS へ移植しない。**
 *
 *   ファイル本体は ① の `handlers/uploads/competitors/` に置き、
 *   `https://khg-marketing.info/.../uploads/competitors/xxx.pdf` として
 *   配信している。② から ① のファイルシステムへは書けない。
 *
 *   もともと customer_info.php が「PDFの保存」と「master_data の保存」を
 *   1リクエストで両方やっていた。master_data の保存を Express へ移すため、
 *   PDF の部分だけをこのファイルに切り出した。
 *
 *   ⚠️ 中身は customer_info.php から**ロジックを変えずに**移している。
 *     完全上書き方式（existing_pdfs ＋ 新規アップロード＝最終状態）も同じ。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **express_proxy.php の許可リストに追加してはいけない。**
 *   multipart は shouldProxyToExpress() が転送を拒否するため実際には
 *   転送されないが、「拒否されるから安全」に頼らないこと。
 *
 * ⚠️ 呼び出し順序: フロントは **master_data の保存（Express）→ このPDF保存** の
 *   順に送る。逆にすると、新規顧客のときに master_data の行が
 *   まだ無い状態で PDF だけが登録される。
 *   （competitor_pdf は id だけで成立するため保存自体は通るが、
 *     顧客一覧に出ない PDF が残る）
 *
 * request: 'competitor_pdf_upload'
 * 受け取る値（multipart/form-data）
 *   id                      … master_data.id
 *   existing_pdfs           … 残す既存ファイルの JSON 配列（削除は含めない）
 *   competitor_pdf_files[]  … 新規アップロードするファイル
 *   competitor_pdf_names[]  … 上記に対応する表示名
 *   competitor_pdf_staff[]  … 上記に対応する登録者名
 */

// ⚠️ multipart で来るため $data は空。$_POST から取る
if (empty($data)) {
    $data = $_POST;
}

$id = $data['id'] ?? null;

if (!$id) {
    echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません。'], JSON_UNESCAPED_UNICODE);
    exit;
}

$new_uploaded_pdfs = [];
$upload_errors = [];

if (isset($_FILES['competitor_pdf_files']) && is_array($_FILES['competitor_pdf_files']['name'])) {
    $uploadDir = __DIR__ . '/uploads/competitors/';

    // ⚠️ ディレクトリが作れない場合はエラーにする（権限の問題を黙って飲まない）
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0777, true)) {
            echo json_encode([
                'status' => 'error',
                'message' => 'アップロード先のディレクトリ作成に失敗しました。権限(パーミッション)を確認してください。',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $fileCount = count($_FILES['competitor_pdf_files']['name']);
    for ($i = 0; $i < $fileCount; $i++) {
        if ($_FILES['competitor_pdf_files']['error'][$i] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['competitor_pdf_files']['tmp_name'][$i];
            $originalFileName = basename($_FILES['competitor_pdf_files']['name'][$i]);
            $fileExt = strtolower(pathinfo($originalFileName, PATHINFO_EXTENSION));

            $customName = $_POST['competitor_pdf_names'][$i] ?? $originalFileName;
            $staffName = $_POST['competitor_pdf_staff'][$i] ?? '';

            // ⚠️ 拡張子だけでなく MIME も見る。拡張子を .pdf に変えた実行ファイルを弾くため
            if ($fileExt === 'pdf' && mime_content_type($tmpName) === 'application/pdf') {
                // ⚠️ 元のファイル名は使わない。日本語や ../ を含むファイル名で
                //   公開ディレクトリに任意のパスを作られるのを防ぐ
                $newFileName = uniqid('pdf_') . '_' . time() . '_' . $i . '.pdf';
                $destination = $uploadDir . $newFileName;

                if (move_uploaded_file($tmpName, $destination)) {
                    $new_uploaded_pdfs[] = [
                        'name' => $customName,
                        'path' => '/uploads/competitors/' . $newFileName,
                        'staff' => $staffName,
                    ];
                } else {
                    $upload_errors[] = "ファイル {$originalFileName} のサーバー保存に失敗しました。";
                }
            }
        } else {
            // PHP 側でファイル上限や通信エラーが起きた場合のコードを記録
            $upload_errors[] = 'ファイルアップロードエラーコード: ' . $_FILES['competitor_pdf_files']['error'][$i];
        }
    }
}

if (!empty($upload_errors)) {
    echo json_encode(['status' => 'error', 'message' => implode(' / ', $upload_errors)], JSON_UNESCAPED_UNICODE);
    exit;
}

$existing_pdfs = [];
if (isset($_POST['existing_pdfs'])) {
    $decoded = json_decode($_POST['existing_pdfs'], true);
    if (is_array($decoded)) {
        $existing_pdfs = $decoded;
    }
}

$final_pdfs = array_merge($existing_pdfs, $new_uploaded_pdfs);

// ⚠️ existing_pdfs はファイルが無くても必ず送られてくる。
//   これが無いと「画面で削除したのに消えない」状態になる（完全上書き方式）。
if (isset($_POST['existing_pdfs']) || !empty($new_uploaded_pdfs)) {
    try {
        $newPdfPathJson = json_encode($final_pdfs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // ⚠️⚠️ **json_encode の失敗を必ず見る。**
        //   ファイル名に不正なUTF-8（cp932 のまま送られた等）が混じると
        //   json_encode は false を返す。移植元の customer_info.php は
        //   これを見ていなかったため、false が空文字として保存され
        //   **PDF一覧が丸ごと消えていた**（実際にローカル検証で再現した）。
        //   消すより、保存せずエラーを返すほうが被害が小さい。
        if ($newPdfPathJson === false) {
            error_log('competitor_pdf_upload: json_encode に失敗しました（' . json_last_error_msg() . '）');
            echo json_encode([
                'status' => 'error',
                'message' => 'ファイル名に使用できない文字が含まれています。名前を変更して再度お試しください。',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $checkStmt = $pdo->prepare('SELECT id FROM competitor_pdf WHERE id = :id');
        $checkStmt->execute(['id' => $id]);

        if ($checkStmt->fetch()) {
            $updatePdfStmt = $pdo->prepare('UPDATE competitor_pdf SET pdf_path = :pdf_path WHERE id = :id');
            $updatePdfStmt->execute(['pdf_path' => $newPdfPathJson, 'id' => $id]);
        } else {
            $insertPdfStmt = $pdo->prepare('INSERT INTO competitor_pdf (id, pdf_path) VALUES (:id, :pdf_path)');
            $insertPdfStmt->execute(['id' => $id, 'pdf_path' => $newPdfPathJson]);
        }
    } catch (PDOException $e) {
        // ⚠️ 例外の内容を応答に含めない（SQLや列名が漏れる）
        error_log('competitor_pdf_upload: DB保存に失敗しました: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => 'PDF情報の保存に失敗しました。'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

echo json_encode([
    'status' => 'success',
    'uploaded' => count($new_uploaded_pdfs),
    'total' => count($final_pdfs),
], JSON_UNESCAPED_UNICODE);
