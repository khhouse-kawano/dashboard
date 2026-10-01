<?php

/**
 * 反響の付帯情報の更新（同期サービス sync から呼ばれる）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **旧API `dashboard/api/changeShop.php` からの移植**（2026-09-30 / v2.2.155）。
 *
 * ⚠️ 旧APIは枝分かれを `demand` で指定していたが、`roll` に変えてある。
 *   ⚠️ 新しいゲートウェイでは `demand` という名前を使っていない
 *     （振り分けは `request`、その中の枝分かれは `roll`）。
 *
 *   roll = 'robo'          … マイホームロボのID・URLを入れる
 *   roll = 'before_survey' … 事前アンケートを同期済みにする
 *   roll = 'sync'          … 反響を同期済みにして pg_id を入れる
 *   roll = 'sync_error'    … 同期済みを取り消す
 *   roll = 'note'          … 備考を入れる
 *   roll = 'duplicate'     … 重複名簿として伏せる
 *   roll = 'new_customer'  … 顧客を作る（無いときだけ）
 *
 * ⚠️⚠️ **旧APIの `demand: 'shop' / 'staff' / 'tag'` はここに移していない。**
 *   ⚠️ すでに移植済みの受け口があるため。**二重に持たせない。**
 *     shop  → handlers/listAction/list_shop_change.php
 *     staff → handlers/listAction/list_staff_change.php
 *     tag   → handlers/listAction/list_tag.php
 *   ⚠️⚠️ **tag は仕様ごと変わっている。**
 *     ⚠️ 旧APIは `black_list` 列へ空白区切りで追記し、出現回数の偶奇で
 *       ON/OFF を判定していた。⚠️ **現行はフラグ列（duplicate_flag 等）。**
 *     ⚠️ ⚠️ **旧APIの書き方をここへ持ち込まないこと**（一覧の絞り込みが壊れる）。
 *
 * ⚠️⚠️ **認証は要求しない（`requireStaff` を呼ばない）。**
 *   ⚠️ 呼び出し元は同期サービス（サーバー）であり、⚠️ **ログイン利用者ではない**
 *     ためトークンを持てない。⚠️ 旧APIも合い言葉すら見ていなかった。
 *   ⚠️ 他の同期サービス向けハンドラ（hotlead.php など）と同じ扱いにしてある。
 *
 * ⚠️⚠️ **返す形を旧APIから変えてある。**
 *   ⚠️ 旧APIは毎回 `inquiry_customer` の全件（数万行）を返していたが、
 *     ⚠️ ⚠️ **呼び出し元はいずれも応答を捨てている**（`console.log` のみ）。
 *   ⚠️ ここでは `{status, message}` だけを返す。
 *   ⚠️ ⚠️ **画面から呼ぶ用途はない。** 一覧が要るなら `list` を別途叩くこと。
 * ─────────────────────────────────────────────
 */

/**
 * `customers` に入れる列と、指定が無いときの値。
 *
 * ⚠️⚠️ **`customers` の列はすべて NOT NULL で、既定値を持たない**（`trash` を除く）。
 *   ⚠️ ⚠️ **旧APIは8列しか指定していなかったため、STRICT_TRANS_TABLES 下では
 *     必ず `Field 'date' doesn't have a default value` で落ちる。**
 *   ⚠️ 本番は非厳密で通っていたとみられるが、⚠️ **移植にあたって全列を埋める。**
 *
 * ⚠️ 呼び出し元が送ってくるのは id / name / register / shop /
 *   reserved_status / response_status / campaign / zip の8つだけ。
 *   ⚠️ **残りは空文字（フラグ列は 0）で埋める。**
 *
 * ⚠️⚠️ **`no`（AUTO_INCREMENT）と `trash`（既定値あり）は入れない。**
 * ⚠️ 列を増やしたらここにも足すこと。⚠️ 足さないと INSERT が落ちる。
 */
const CUSTOMERS_COLUMNS = [
    'id'                => '',
    'name'              => '',
    'date'              => '',
    'status'            => '',
    'rank'              => '',
    'rank_period'       => '',
    'register'          => '',
    'reserve'           => '',
    'shop'              => '',
    'staff'             => '',
    'medium'            => '',
    'estate'            => '',
    'place'             => '',
    'budget'            => '',
    'loan'              => '',
    'repayment'         => '',
    'contract'          => '',
    'meeting'           => '',
    'rank_history'      => '',
    'section'           => '',
    'appointment'       => '',
    'second_reserve'    => '',
    'line_group'        => '',
    'screening'         => '',
    'rival'             => '',
    'period'            => '',
    'survey'            => '',
    'importance'        => '',
    'note'              => '',
    'sales_meeting'     => '',
    // ⚠️ ここから3つは tinyint。⚠️ **空文字を入れると厳密モードで落ちる**
    'before_survey'     => '0',
    'before_interview'  => '0',
    'after_interview'   => '0',
    'call_status'       => '',
    'reserved_status'   => '',
    'phone_number'      => '',
    'full_address'      => '',
    'zip'               => '',
    'lat_lng'           => '',
    'response_status'   => '',
    'campaign'          => '',
    'cancel_status'     => '',
    'ice_world'         => '',
    'gift'              => '',
];

$roll       = trim((string)($data['roll'] ?? ''));
$inquiry_id = trim((string)($data['inquiry_id'] ?? ''));

/** 失敗の返し方をそろえる */
function inquiryUpdateFail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(
        ['status' => 'error', 'message' => $message],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

/** 成功の返し方をそろえる */
function inquiryUpdateDone(string $message): void
{
    echo json_encode(
        ['status' => 'success', 'message' => $message],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

/**
 * `inquiry_customer` を1行だけ更新する。
 *
 * ⚠️ 列名は呼び出し側が定数で渡す。⚠️ **リクエストの値を列名にしないこと。**
 * ⚠️⚠️ **更新行数では成否を判断しない。**
 *   ⚠️ MySQL は値が変わらなかった UPDATE を「0行」と数えるため、
 *     ⚠️ **同じ値をもう一度送っただけで「失敗」になってしまう。**
 *   ⚠️ 行の有無は別途 SELECT で確かめる。
 */
function inquiryUpdateColumns(PDO $pdo, string $setClause, array $params, string $inquiryId): bool
{
    $exists = $pdo->prepare('SELECT 1 FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
    $exists->execute([$inquiryId]);

    if ($exists->fetchColumn() === false) {
        return false;
    }

    $params[] = $inquiryId;
    $pdo->prepare("UPDATE inquiry_customer SET {$setClause} WHERE inquiry_id = ?")->execute($params);

    return true;
}

if ($roll === '') {
    inquiryUpdateFail(400, 'roll がありません。');
}

try {
    // -----------------------------------------------------------------
    // マイホームロボのID・URL
    // -----------------------------------------------------------------
    if ($roll === 'robo') {
        if ($inquiry_id === '') inquiryUpdateFail(400, 'inquiry_id がありません。');

        $ok = inquiryUpdateColumns(
            $pdo,
            'mhl_id = ?, mhl_url = ?',
            // ⚠️ mhl_id / mhl_url は **NOT NULL**。⚠️ null を入れず空文字にする
            [(string)($data['mhl_id'] ?? ''), (string)($data['mhl_url'] ?? '')],
            $inquiry_id
        );

        if (!$ok) inquiryUpdateFail(404, "{$inquiry_id} が見つかりません。");
        inquiryUpdateDone("{$inquiry_id} にマイホームロボの情報を登録しました。");
    }

    // -----------------------------------------------------------------
    // 事前アンケートを同期済みにする
    //
    // ⚠️⚠️ **対象は `before_survey` テーブルで、反響ではない。**
    //   ⚠️ 主キーは `id`（AUTO_INCREMENT の数値）。⚠️ **inquiry_id ではない。**
    //   ⚠️ 旧APIは `sbid` という名前で受け取っていた。⚠️ 呼び出し元に合わせて残す。
    // -----------------------------------------------------------------
    if ($roll === 'before_survey') {
        $sbid = (int)($data['sbid'] ?? 0);
        if ($sbid <= 0) inquiryUpdateFail(400, 'sbid がありません。');

        $exists = $pdo->prepare('SELECT 1 FROM before_survey WHERE id = ? LIMIT 1');
        $exists->execute([$sbid]);
        if ($exists->fetchColumn() === false) {
            inquiryUpdateFail(404, "事前アンケート {$sbid} が見つかりません。");
        }

        $pdo->prepare('UPDATE before_survey SET sync = 1 WHERE id = ?')->execute([$sbid]);
        inquiryUpdateDone("事前アンケート {$sbid} を同期済みにしました。");
    }

    // -----------------------------------------------------------------
    // 同期済みにする / 取り消す
    // -----------------------------------------------------------------
    if ($roll === 'sync') {
        if ($inquiry_id === '') inquiryUpdateFail(400, 'inquiry_id がありません。');

        // ⚠️ pg_id は **NOT NULL**。⚠️ 空文字を入れる
        $ok = inquiryUpdateColumns($pdo, 'sync = 1, pg_id = ?', [(string)($data['pg_id'] ?? '')], $inquiry_id);

        if (!$ok) inquiryUpdateFail(404, "{$inquiry_id} が見つかりません。");
        inquiryUpdateDone("{$inquiry_id} を同期済みにしました。");
    }

    if ($roll === 'sync_error') {
        if ($inquiry_id === '') inquiryUpdateFail(400, 'inquiry_id がありません。');

        $ok = inquiryUpdateColumns($pdo, 'sync = 0', [], $inquiry_id);

        if (!$ok) inquiryUpdateFail(404, "{$inquiry_id} が見つかりません。");
        inquiryUpdateDone("{$inquiry_id} の同期を取り消しました。");
    }

    // -----------------------------------------------------------------
    // 備考
    // -----------------------------------------------------------------
    if ($roll === 'note') {
        if ($inquiry_id === '') inquiryUpdateFail(400, 'inquiry_id がありません。');

        $ok = inquiryUpdateColumns($pdo, 'note = ?', [(string)($data['note'] ?? '')], $inquiry_id);

        if (!$ok) inquiryUpdateFail(404, "{$inquiry_id} が見つかりません。");
        inquiryUpdateDone("{$inquiry_id} の備考を更新しました。");
    }

    // -----------------------------------------------------------------
    // 重複名簿として伏せる
    //
    // ⚠️⚠️ **`shop` に追記するため、二度押すと `重複名簿重複名簿` になる。**
    //   ⚠️ 旧APIからの持ち越し。⚠️ **既に付いている場合は何もしない**ようにしてある。
    // -----------------------------------------------------------------
    if ($roll === 'duplicate') {
        if ($inquiry_id === '') inquiryUpdateFail(400, 'inquiry_id がありません。');

        $find = $pdo->prepare('SELECT shop FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
        $find->execute([$inquiry_id]);
        $shop = $find->fetchColumn();

        if ($shop === false) inquiryUpdateFail(404, "{$inquiry_id} が見つかりません。");

        if (strpos((string)$shop, '重複名簿') !== false) {
            inquiryUpdateDone("{$inquiry_id} は既に重複名簿です。");
        }

        $pdo->prepare("UPDATE inquiry_customer SET shop = CONCAT(shop, '重複名簿'), sync = 1 WHERE inquiry_id = ?")
            ->execute([$inquiry_id]);

        inquiryUpdateDone("{$inquiry_id} を重複名簿にしました。");
    }

    // -----------------------------------------------------------------
    // 顧客を作る（無いときだけ）
    //
    // ⚠️⚠️ **`customers` と `master_data` の2つに入れる。**
    //   ⚠️ 旧APIは片方ずつ判定し、⚠️ **それぞれで `echo` していた**ため、
    //     ⚠️ ⚠️ **JSONが2つ連結された壊れた応答を返すことがあった。**
    //     ⚠️ ここでは最後に1回だけ返す。
    //
    // ⚠️⚠️ **両方まとめてトランザクションにしてある。**
    //   ⚠️ 旧APIは `customers` だけ作られて `master_data` が無い状態を作りえた。
    // -----------------------------------------------------------------
    if ($roll === 'new_customer') {
        $id = trim((string)($data['id'] ?? ''));
        if ($id === '') inquiryUpdateFail(400, 'id がありません。');

        $created = [];

        $pdo->beginTransaction();

        $findCustomer = $pdo->prepare('SELECT 1 FROM customers WHERE id = ? LIMIT 1');
        $findCustomer->execute([$id]);

        if ($findCustomer->fetchColumn() === false) {
            $values = [];
            foreach (CUSTOMERS_COLUMNS as $column => $default) {
                $values[] = $column === 'id'
                    ? $id
                    : (array_key_exists($column, $data) ? (string)$data[$column] : $default);
            }

            $pdo->prepare(
                'INSERT INTO customers (' . implode(', ', array_keys(CUSTOMERS_COLUMNS)) . ')
                 VALUES (' . implode(', ', array_fill(0, count(CUSTOMERS_COLUMNS), '?')) . ')'
            )->execute($values);

            $created[] = 'customers';
        }

        $findMaster = $pdo->prepare('SELECT 1 FROM master_data WHERE id = ? LIMIT 1');
        $findMaster->execute([$id]);

        if ($findMaster->fetchColumn() === false) {
            $pdo->prepare(
                'INSERT INTO master_data
                    (id, customer_contacts_name, customer_contacts_name_kana, full_address,
                     customer_contacts_mobile_phone_number, customer_contacts_email, postal_code)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $id,
                (string)($data['customer_contacts_name'] ?? ''),
                (string)($data['customer_contacts_name_kana'] ?? ''),
                (string)($data['full_address'] ?? ''),
                (string)($data['customer_contacts_mobile_phone_number'] ?? ''),
                (string)($data['customer_contacts_email'] ?? ''),
                (string)($data['postal_code'] ?? ''),
            ]);
            $created[] = 'master_data';
        }

        $pdo->commit();

        inquiryUpdateDone(
            $created === []
                ? "{$id} は既に登録済みです。"
                : "{$id} を登録しました（" . implode(' / ', $created) . '）。'
        );
    }

    inquiryUpdateFail(400, 'roll が不正です。');
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('inquiry_update: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
