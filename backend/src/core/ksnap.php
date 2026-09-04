<?php

/**
 * K-SNAP（スナップ写真）の共通処理。
 *
 * ─────────────────────────────────────────────
 * 移行の経緯
 *
 *   もともと ① レンタルサーバーの /k-snap/api/ に別アプリとして置かれており、
 *   リポジトリ管理外だった。2026-09-03 に dashboard へ集約した。
 *
 *   移行時に変えたのは以下の3点だけで、SQLとレスポンスの形は変えていない。
 *     1. 暗号鍵をソース直書きから環境変数へ
 *     2. 画像アップロードに拡張子と実体の検証を追加
 *     3. 画像の保存先を環境変数へ
 * ─────────────────────────────────────────────
 *
 * ⚠️ 顧客向け（公開）とスタッフ向けが混在している。
 *   認証を一括で強化するときは、下記の「顧客向け」を除外しないと
 *   **公開ギャラリーが止まる**（顧客はスタッフのトークンを持たない）。
 *
 *     顧客向け（公開・認証不可）
 *       k-snap_login / k-snap / k-snap_customer / k-snap_customer_update
 *     スタッフ向け（認証を要求すべき）
 *       k-snap_edit / k-snap_load / k-snap_update / k-snap_show
 */

// ---------------------------------------------------------------------------
// owner の決定論的暗号化
// ---------------------------------------------------------------------------

/**
 * 公開ギャラリーに返す owner を暗号化する。
 *
 * ⚠️ 固定IVを使っているため「同じ入力 → 常に同じ暗号文」になる。
 *   これは意図した仕様である。フロントが owner でグループ化・絞り込みを
 *   行うため、暗号文が毎回変わると機能が成立しない。
 *
 * ⚠️ その代償として、**同じ人かどうかは第三者にも分かる**（等価性が漏れる）。
 *   氏名そのものは隠れるが、機密性の高い用途には使えない方式である。
 *
 * ⚠️ 鍵を変更すると既存の暗号文と一致しなくなり、
 *   フロントの owner による絞り込みが壊れる。値は変えないこと。
 */
function ksnapEncryptOwner(string $value): string
{
    if ($value === '') {
        return '';
    }

    $key = getenv('KSNAP_OWNER_KEY');
    $iv  = getenv('KSNAP_OWNER_IV');

    // ⚠️ 未設定のまま平文を返してはいけない。氏名がそのまま公開される。
    //   空文字を返して「表示されない」状態にし、原因はログに残す。
    if ($key === false || $key === '' || $iv === false || $iv === '') {
        error_log('ksnap: KSNAP_OWNER_KEY / KSNAP_OWNER_IV が未設定です');
        return '';
    }

    $encrypted = openssl_encrypt($value, 'aes-256-cbc', $key, 0, $iv);
    if ($encrypted === false) {
        error_log('ksnap: owner の暗号化に失敗しました');
        return '';
    }

    return base64_encode($encrypted);
}

/**
 * 取得した行の owner を暗号化済みに差し替える。
 *
 * @param array<int, array<string, mixed>> $rows
 * @return array<int, array<string, mixed>>
 */
function ksnapEncryptOwnerColumn(array $rows): array
{
    return array_map(static function (array $item): array {
        if (isset($item['owner'])) {
            $item['owner'] = ksnapEncryptOwner((string) $item['owner']);
        }
        return $item;
    }, $rows);
}

// ---------------------------------------------------------------------------
// 画像
// ---------------------------------------------------------------------------

/** 受け付ける拡張子。⚠️ ホワイトリスト以外を通さないこと */
const KSNAP_ALLOWED_EXT = ['jpg', 'jpeg', 'png'];

/** 受け付ける画像形式（getimagesize が返す定数） */
const KSNAP_ALLOWED_IMAGE_TYPES = [IMAGETYPE_JPEG, IMAGETYPE_PNG];

/** 上限。フロントで1920pxに縮小しているため、これを超えるのは異常 */
const KSNAP_MAX_BYTES = 12 * 1024 * 1024;

/**
 * 画像の保存先ディレクトリ（末尾スラッシュ付き）。
 *
 * ⚠️ フロントの配信元（frontend/src/utils/ksnapImage.ts の KSNAP_IMAGE_BASE）と
 *   **同じ場所を指すこと。** 片方だけ変えると、保存はできるが表示できない
 *   （またはその逆の）状態になり、原因が分かりにくい。
 *
 *     保存先（このファイル） /dashboard/api/images/
 *     配信元（フロント）      https://khg-marketing.info/dashboard/api/images/
 *
 * ⚠️ 2026-09-03 に /k-snap/images/ から移した。
 *   **既存の画像を移動しないと、過去のスナップが表示されなくなる。**
 *
 * ⚠️ 公開ディレクトリの中にあるため、**ここにPHPが置かれると実行されうる。**
 *   .htaccess で .php へのアクセスを拒否すること。移行前の
 *   /k-snap/images/.htaccess と同じ内容を新しいディレクトリにも置く。
 *
 * ⚠️⚠️ ① とローカル(Docker)で core/ の階層が違うため、**既定値では合わない。**
 *
 *     ローカル : /var/www/html/core        → 1つ上が images/ の親
 *     ①        : .../dashboard/api/gateway/core  → **2つ上**が images/ の親
 *
 *   計算で吸収しようとすると、どちらかで必ず外れる。
 *   **① では KSNAP_IMAGE_DIR を .htaccess の SetEnv で明示指定すること。**
 *   既定値はローカル用と考えてよい。
 */
function ksnapImageDir(): string
{
    $dir = getenv('KSNAP_IMAGE_DIR');
    if ($dir === false || $dir === '') {
        // core/ の1つ上（ローカルの構成）
        $dir = dirname(__DIR__) . '/images';
    }

    $dir = rtrim($dir, '/') . '/';

    // ⚠️ 存在しないまま進むと、アップロードが黙って失敗する。
    //   原因がパスのずれだと分かるようにログへ残す。
    if (!is_dir($dir)) {
        error_log('ksnap: 画像ディレクトリが存在しません dir=' . $dir
            . ' / KSNAP_IMAGE_DIR の設定を確認してください');
    }

    return $dir;
}

/**
 * アップロードされた画像を保存し、ファイル名を返す。失敗時は null。
 *
 * ⚠️ 移行前は拡張子を検証していなかった。利用者が送ったファイル名から
 *   拡張子を取り出してそのまま保存していたため、`evil.php` を送れば
 *   **公開ディレクトリにPHPが置かれる**状態だった。
 *   ホワイトリストと実体の検証を追加している。**緩めないこと。**
 *
 * @param array<string, mixed> $fileArr $_FILES['image']
 */
function ksnapSaveUploadedImage(array $fileArr): ?string
{
    // ⚠️ error を見ないと、サイズ超過で中身が空のまま処理が進む
    $error = (int) ($fileArr['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        if ($error !== UPLOAD_ERR_NO_FILE) {
            error_log('ksnap: アップロードエラー code=' . $error);
        }
        return null;
    }

    $tmpName = (string) ($fileArr['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        error_log('ksnap: アップロードされたファイルではありません');
        return null;
    }

    $size = (int) ($fileArr['size'] ?? 0);
    if ($size <= 0 || $size > KSNAP_MAX_BYTES) {
        error_log('ksnap: サイズが範囲外です size=' . $size);
        return null;
    }

    $ext = strtolower(pathinfo((string) ($fileArr['name'] ?? ''), PATHINFO_EXTENSION));
    if (!in_array($ext, KSNAP_ALLOWED_EXT, true)) {
        error_log('ksnap: 許可されない拡張子です ext=' . $ext);
        return null;
    }

    // ⚠️ 拡張子だけでは不十分。`x.jpg` の中身がPHPというケースを弾く
    $info = @getimagesize($tmpName);
    if ($info === false || !in_array($info[2], KSNAP_ALLOWED_IMAGE_TYPES, true)) {
        error_log('ksnap: 画像として解釈できません');
        return null;
    }

    // ⚠️ ファイル名は必ずサーバー側で作る。利用者の名前を使うとパス操作を許す
    $imageName = time() . '_' . bin2hex(random_bytes(5)) . '.' . $ext;
    $savePath = ksnapImageDir() . $imageName;

    if (!move_uploaded_file($tmpName, $savePath)) {
        error_log('ksnap: 画像の保存に失敗しました path=' . $savePath);
        return null;
    }

    return $imageName;
}

/**
 * 古い画像を削除する。
 *
 * ⚠️ ファイル名だけを受け取り、ディレクトリはこちらで決める。
 *   DBの値をパスとして連結すると、`../` を含む値で任意のファイルを消せる。
 */
function ksnapDeleteImage(string $imageName): void
{
    if ($imageName === '' || basename($imageName) !== $imageName) {
        return;
    }

    $path = ksnapImageDir() . $imageName;
    if (is_file($path)) {
        @unlink($path);
    }
}
