<?php
// 人事マスタ（staff_list）への新規登録。
//
// ⚠️ ログイン権限テーブル（staff）には触らない。
//   以前はここで staff にも 'ordinary' で自動INSERTしていたが、
//   staff_list（人事マスタ）と staff（ログイン権限）は役割が別であり、
//   自動連携していると「退職者のログインが残る」「人事登録しただけの人が
//   ログインできる」といった不整合が起きるため廃止した。
//   ログイン用アカウントは EditAuth（header_auth_insert）で個別に作成する。

// ⚠️ メールアドレスは受け取らない。ログイン用メールアドレスは staff テーブル側の
//   情報であり、EditAuth（header_auth_insert）が扱う。
$khg_id   = $data['khg_id'] ?? '';
$name     = $data['name'] ?? '';
$position = $data['position'] ?? '一般';
$status   = $data['status'] ?? '在籍';
$section  = $data['section'] ?? '';
$shop     = $data['shop'] ?? '';
$category = $data['category'] ?? '0';
$rank     = $data['rank'] ?? '0';
$report   = $data['report'] ?? '0';
$multi    = $data['multi'] ?? '0';
$estate   = $data['estate'] ?? '0';
$inside   = $data['inside'] ?? '0'; // インサイドセールス担当フラグ
$period   = $data['period'] ?? '';

if (trim($name) === '') {
    echo json_encode([
        "status" => "error", 
        "message" => "氏名を入力してください。"
    ]);
    exit;
}

try {
    // ⚠️ staff_list は id（auto_increment）と inside を除く全カラムが
    //   NOT NULL かつデフォルト値なしで定義されている。
    //   1つでも省略すると 1364 (Field doesn't have a default value) で
    //   INSERT が失敗するため、この画面で扱わないカラムも明示的に埋める。
    //
    //   pg_id / robo_id / memo … 外部システムのIDと備考。この画面では扱わない
    //   mail                   … 人事マスタ側のメール。ログイン用メールアドレス
    //                            （staff テーブル）とは別物で、UIから削除済み
    //   sort                   … 表示順。未指定なので 0
    //
    //   （DDL で DEFAULT を付けるのが本来の解決だが、本番テーブルの変更に
    //     なるためここでは行っていない）
    $sql = "
        INSERT INTO `staff_list` (
            `khg_id`, `pg_id`, `robo_id`, `name`, `position`, `mail`, `memo`, `sort`,
            `status`, `section`, `shop`,
            `category`, `rank`, `report`, `multi`, `estate`, `inside`, `period`
        ) VALUES (
            :khg_id, '', '', :name, :position, '', '', 0,
            :status, :section, :shop,
            :category, :rank, :report, :multi, :estate, :inside, :period
        )
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':khg_id'   => $khg_id,
        ':name'     => $name,
        ':position' => $position,
        ':status'   => $status,
        ':section'  => $section,
        ':shop'     => $shop,
        ':category' => $category,
        ':rank'     => $rank,
        ':report'   => $report,
        ':multi'    => $multi,
        ':estate'   => $estate,
        ':inside'   => $inside,
        ':period'   => $period
    ]);

    // フロント側は返した id をそのまま更新API（header_staff_update）に使う。
    // ここで返さないと存在しないIDで UPDATE され、登録直後の編集が無反応になる。
    echo json_encode([
        "status" => "success",
        "message" => "スタッフを新規登録しました。",
        "id" => $pdo->lastInsertId(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;

} catch (PDOException $e) {
    echo json_encode([
        "status" => "error",
        "message" => "データベースの登録処理に失敗しました。",
        "debug" => $e->getMessage()
    ]);
    exit;
}