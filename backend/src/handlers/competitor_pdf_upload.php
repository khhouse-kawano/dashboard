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
 *   ⚠️ 中身は customer_info.php から切り出したもの。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **express_proxy.php の許可リストに追加してはいけない。**
 *   multipart は shouldProxyToExpress() が転送を拒否するため実際には
 *   転送されないが、「拒否されるから安全」に頼らないこと。
 *
 * ⚠️ 呼び出し順序: フロントは **master_data の保存（Express）→ このPDF保存** の
 *   順に送る。逆にすると、新規顧客のときに master_data の行が
 *   まだ無い状態で PDF だけが登録される。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-21 に competitor_pdf を「1ファイル1行」に作り替えた。**
 *
 *   旧: 顧客1人につき1行。`pdf_path` に JSON 配列。
 *   新: no / id / name / path / staff / company / category の1ファイル1行。
 *
 *   ⚠️ 完全上書き方式は**変えていない**。
 *     `existing_pdfs`（残すもの）＋ 新規アップロード ＝ 最終状態。
 *   ⚠️ ⚠️ **その顧客の行をいったん全部消してから入れ直す。**
 *     ⚠️ 1件ずつ差分を取ると、名前だけ変えた行を消してしまう事故が起きる。
 *     ⚠️ ファイルの実体（uploads/competitors/）は**消さない**。
 *       削除された PDF の実体が残るが、URL を知らなければ辿れない。
 *       （旧方式でも同じ。実体の掃除は別途）
 * ─────────────────────────────────────────────
 *
 * request: 'competitor_pdf_upload'
 * 受け取る値（multipart/form-data）
 *   id                        … master_data.id
 *   existing_pdfs             … 残す既存ファイルの JSON 配列（削除は含めない）
 *                               [{name, path, staff, company, category}, ...]
 *   competitor_pdf_files[]    … 新規アップロードするファイル
 *   competitor_pdf_names[]    … 上記に対応する表示名
 *   competitor_pdf_staff[]    … 上記に対応する登録者名
 *   competitor_pdf_company[]  … ⚠️ 2026-09-21 追加。他社名
 *   competitor_pdf_category[] … ⚠️ 2026-09-21 追加。種別
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

/**
 * 資料の種別。
 *
 * ⚠️⚠️ **フロント（utils/competitorPdfUpload.ts の PDF_CATEGORIES）と同じ内容にすること。**
 *   ⚠️ ここに無い値は空文字にする。⚠️ **弾いてエラーにはしない**
 *     （面談中に保存できなくなるほうが困る。⚠️ 未分類として残せばよい）。
 */
$allowed_categories = ['カタログパンフレット', '見積もり・提案書', 'チラシ', 'その他'];

$normalize_category = static function ($value) use ($allowed_categories) {
    $text = trim((string) ($value ?? ''));
    return in_array($text, $allowed_categories, true) ? $text : '';
};

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
            $companyName = trim((string) ($_POST['competitor_pdf_company'][$i] ?? ''));
            $categoryName = $normalize_category($_POST['competitor_pdf_category'][$i] ?? '');

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
                        'company' => $companyName,
                        'category' => $categoryName,
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
        /**
         * ⚠️⚠️ **いったん全部消してから入れ直す。**
         *   ⚠️ 1件ずつ差分を取ると、名前だけ変えた行を消す事故が起きる。
         *   ⚠️ **トランザクションで囲む。** 途中で落ちると資料が全部消える。
         */
        $pdo->beginTransaction();

        $deleteStmt = $pdo->prepare('DELETE FROM competitor_pdf WHERE id = :id');
        $deleteStmt->execute(['id' => $id]);

        $insertStmt = $pdo->prepare(
            'INSERT INTO competitor_pdf (id, name, path, staff, company, category)
             VALUES (:id, :name, :path, :staff, :company, :category)'
        );

        foreach ($final_pdfs as $pdf) {
            if (!is_array($pdf)) {
                continue;
            }
            // ⚠️ path が無い行は入れない。⚠️ 開けない資料が一覧に出てしまう
            $path = trim((string) ($pdf['path'] ?? ''));
            if ($path === '') {
                continue;
            }

            $insertStmt->execute([
                'id' => $id,
                'name' => (string) ($pdf['name'] ?? ''),
                'path' => $path,
                'staff' => (string) ($pdf['staff'] ?? ''),
                'company' => trim((string) ($pdf['company'] ?? '')),
                'category' => $normalize_category($pdf['category'] ?? ''),
            ]);
        }

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
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
