<?php

/**
 * 注文営業のダッシュボードを開いたときに出す「要確認」と「本日の予定」
 * （frontend/src/components/DailyActionModal.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **backend-express/src/features/dailyAction.ts と同じ形にしておくこと。**
 *   こちらは ② への転送が失敗したときのフォールバックである。
 *   形が違うと、転送が失敗した瞬間にモーダルが壊れる（しかも普段は
 *   ② が応答するので気づくのが遅れる）。
 *
 * ⚠️⚠️ **判定条件は menu.php と同じものを使うこと。**
 *   ⚠️ 片方だけ直すと **バッジの件数と一覧の行数が食い違う。**
 *   ⚠️ 未同期の条件は frontend の listTags.ts の `isPendingSync()` とも同じ。
 *
 * ⚠️ menu は COUNT しか返さない（2026-09-14 に 18.2MB → 数十バイトにした）。
 *   ⚠️⚠️ **あの形に戻してはならない。** ここは**モーダルを開くときだけ**
 *   呼ばれる別経路で、表に出す5列しか取らない。
 * ─────────────────────────────────────────────
 */

/**
 * 「確認しました」の記録（roll = 'check'）。
 *
 * ⚠️⚠️ **② へは転送していない。**（express_proxy.php は 'daily_action:list' だけ）
 *   ⚠️ UPDATE なので、⚠️ **自動フォールバックで二重に走ると困る。**
 *
 * ⚠️ `staff` はログインに使うテーブル（⚠️ **`staff_list` ではない**）。
 * ⚠️⚠️ **誰か分からないときは何もしない。** ⚠️ 全員の行を更新する事故を避ける。
 */
$roll = $data['roll'] ?? '';

/**
 * トークンからログイン中のスタッフを引く。
 *
 * ⚠️ `$headers` は db.php が `getallheaders()` で用意している。
 * ⚠️ ⚠️ **`requireStaff()` は使わない。** あれは 401 を返して `exit` する。
 *   ⚠️ 一覧のほうは**誰か分からなくても出したい**（出ないより出しすぎるほうが安全）。
 */
$daily_action_token = $headers['Token'] ?? $headers['token'] ?? '';
$daily_action_user = $daily_action_token === '' ? false : getUserByToken($pdo, $daily_action_token);

if ($roll === 'check') {
    // ⚠️⚠️ **誰か分からないときは何もしない。** 全員の行を更新する事故を避ける
    if (!$daily_action_user || empty($daily_action_user['id'])) {
        echo json_encode(["status" => "error"], JSON_UNESCAPED_UNICODE);
        return;
    }
    $stmt_check = $pdo->prepare("UPDATE staff SET check_daily_action = CURDATE() WHERE id = ?");
    $stmt_check->execute([$daily_action_user['id']]);
    echo json_encode(["status" => "success"], JSON_UNESCAPED_UNICODE);
    return;
}

/**
 * 日付の列を DATE に揃える式。
 *
 * ⚠️⚠️ **本番データは 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在している。**
 *   ⚠️ 片方しか見ないと STR_TO_DATE が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ 末尾に時刻や空白が付いた値があるため SUBSTRING(...,1,10) で切る。
 */
function dailyActionDate(string $column): string
{
    return "STR_TO_DATE(REPLACE(SUBSTRING($column, 1, 10), '/', '-'), '%Y-%m-%d')";
}

// ⚠️⚠️ **別名（i. / m.）を必ず付けること。** shop_list を LEFT JOIN しているため
$inquiry_date = dailyActionDate('i.inquiry_date');
$reserved_date = dailyActionDate('m.reserved_interview');
$register_date = dailyActionDate('m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99');

/**
 * 店舗名の表示。
 *
 * ⚠️⚠️ **`shop_list` の `show_flag = 1` に無い店舗名は `{ブランド}未設定` と出す**
 *   （2026-09-28 の指示）。
 *   ⚠️ 実データに `KH国分ハウジング` `PGH` `なごみ姶良霧島店` のような、
 *     ⚠️ **店舗マスタに無い値**が入っている（反響フォーム側の自由入力）。
 *
 * ⚠️ ブランドの言い換えは frontend/src/utils/shopFormate.ts と**同じ**にすること。
 *   ⚠️ `Nagomi` → `なごみ` ／ `PG HOUSE` → `PGH`
 * ⚠️⚠️ **出す文字列は `{ブランド}店舗未設定`。** ⚠️ `{ブランド}未設定` ではない。
 *   ⚠️ shop_list に `KH店舗未設定` `DJH店舗未設定` などが**実在する**（show_flag = 1）。
 *   ⚠️ ⚠️ **別の文字列にすると、同じ意味の行が2種類並ぶ。**
 * ⚠️ ⚠️ **Express の dailyAction.ts と必ず揃えること。**
 */
function dailyActionShop(string $shopColumn, string $brandColumn): string
{
    $brand = "CASE TRIM(COALESCE($brandColumn, ''))
                WHEN 'Nagomi' THEN 'なごみ'
                WHEN 'PG HOUSE' THEN 'PGH'
                ELSE TRIM(COALESCE($brandColumn, ''))
              END";
    return "CASE
              WHEN s.shop IS NOT NULL THEN TRIM($shopColumn)
              WHEN $brand <> '' THEN CONCAT($brand, '店舗未設定')
              ELSE ''
            END";
}

/**
 * 表示対象の店舗。
 * ⚠️ **`show_flag = 1` だけで絞る**（指示）。⚠️ 事業では絞らない。
 * ⚠️ GROUP BY で重複を潰す。⚠️ **潰さないと JOIN で行が増える。**
 */
$visible_shops = "(SELECT shop FROM shop_list WHERE show_flag = 1 AND TRIM(COALESCE(shop, '')) <> '' GROUP BY shop)";

/**
 * 事業ごとのテーブルと「本日の予定」に出す工程（v2.2.175 で建売・中古にも広げた）。
 *
 * ⚠️⚠️ **Express の dailyAction.ts の DAILY_SOURCES と同じにすること。**
 * ⚠️ 工程は各事業の actionMap（⚠️ 次回アクション日は除く。本日要連絡で出すため）。
 * ⚠️ 中古は同じ列に区分ごとに別の名前がある → 行の in_charge_store（取引区分）で名前を決める。
 * ⚠️ 来場日未入力は注文だけ。
 */
$daily_category = in_array($data['category'] ?? '', ['spec', 'used'], true) ? $data['category'] : 'order';

$resale_steps = [
    '買い:中古リノベ' => [
        ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
        ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
        ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
        ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
        ['リフォーム契約', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
        ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
    ],
    '買い:ポータル' => [
        ['初回来場', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
        ['物件案内', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'],
        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
        ['2回目以降物件案内', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
        ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
        ['売買契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
    ],
    '売り:ポータル' => [
        ['査定アポ', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV'],
        ['査定書提出', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'],
        ['訪問査定', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'],
        ['媒介取得', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'],
    ],
];

$fixed_steps = [
    'order' => [
        ['初回面談', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
        ['事前審査', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'],
        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
        ['契約', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
    ],
    'spec' => [
        ['接触（通話・返信）', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z'],
        ['初回面談', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'],
        ['2回目以降面談', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'],
        ['申し込み', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
        ['自社契約', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'],
        ['仲介契約', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'],
    ],
];

$daily_master  = ['order' => 'master_data', 'spec' => 'master_data_kaeru', 'used' => 'master_data_resale'][$daily_category];
$daily_inquiry = ['order' => 'inquiry_customer', 'spec' => 'inquiry_customer_kaeru', 'used' => 'inquiry_customer_resale'][$daily_category];
$daily_has_cancel = $daily_category === 'order';

// 工程の列（重複なし）・表の並び
$all_steps = $daily_category === 'used' ? array_merge(...array_values($resale_steps)) : $fixed_steps[$daily_category];
$today_columns = array_values(array_unique(array_map(fn ($step) => $step[1], $all_steps)));
$step_order    = array_values(array_unique(array_map(fn ($step) => $step[0], $all_steps)));

/** 列と取引区分 → 表示名（⚠️ Express の labelOf と同じ） */
$step_label_of = function (string $column, string $deal) use ($daily_category, $resale_steps, $fixed_steps, $all_steps): string {
    $steps = $daily_category === 'used'
        ? ($resale_steps[$deal] ?? $resale_steps['買い:中古リノベ'])
        : $fixed_steps[$daily_category];
    foreach ([$steps, $all_steps] as $list) {
        foreach ($list as $step) {
            if ($step[1] === $column) return $step[0];
        }
    }
    return $column;
};

/**
 * 未同期を数え始める月。
 * ⚠️ 注文は menu.php の $sync_start_month と同じ。⚠️ **片方だけ変えると件数がずれる。**
 * ⚠️⚠️ v2.2.175 修正: **建売・中古は 2026/08 から**（指示）。2026年7月までは未同期として数えない。
 * ⚠️ Express の dailyAction.ts の SYNC_START_MONTH と同じにすること。
 */
$sync_start_months = ['order' => '2025/06', 'spec' => '2026/08', 'used' => '2026/08'];
$sync_start_month = $sync_start_months[$daily_category];

/**
 * 1つの表に出す上限。
 * ⚠️ 上限が無いと放置が溜まったときにモーダルが開かなくなる。
 * ⚠️ 放置日数の長い順なので、切り捨てられるのは**新しいものから**である。
 */
$row_limit = 200;

// 未同期の反響（まだ顧客になっていない）。
// ⚠️⚠️ **当日の反響は出さない**（DATEDIFF > 0）。まだ「放置」ではないため。
// ⚠️⚠️ **氏名（first_name）が入っている行だけを出す**（2026-09-28 の追記）。
//   ⚠️ 実測47件のうち17件は氏名が空だった（反響フォーム側の取りこぼし）。
//   ⚠️ ⚠️ **誰のことか分からない行を晒しても動きようがない。**
// ⚠️ 店舗 … shop_list(show_flag=1) に無ければ「{ブランド}未設定」（dailyActionShop）
// ⚠️ 媒体 … 空なら medium（こちらは全件埋まっている）
$sql_unsync = "SELECT 'unsync' AS kind,
         DATEDIFF(CURDATE(), $inquiry_date) AS days,
         " . dailyActionShop('i.shop', 'i.brand') . " AS shop,
         DATE_FORMAT($inquiry_date, '%Y-%m-%d') AS register,
         TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS customer,
         COALESCE(NULLIF(TRIM(i.response_medium), ''), NULLIF(TRIM(i.medium), ''), '') AS medium,
         /* ⚠️ キャンペーン名（2026-09-28）。⚠️ **未同期の表にだけ出す。**
            ⚠️ 実測では9割以上が空。⚠️ **空文字で返し、画面が `-` と出す。** */
         COALESCE(NULLIF(TRIM(i.hp_campaign), ''), '') AS campaign
    FROM $daily_inquiry i
    LEFT JOIN $visible_shops s ON s.shop = TRIM(i.shop)
   WHERE COALESCE(i.sync, 0) = 0
     AND COALESCE(i.duplicate_flag, 0) <> 1
     AND COALESCE(i.support_flag, 0) <> 1
     AND COALESCE(i.black_flag, 0) <> 1
     AND TRIM(COALESCE(i.first_name, '')) <> ''
     /* ⚠️ v2.2.175: '-' を '/' に揃えて比べる（⚠️ 建売に 'YYYY-MM-DD' が混ざる。⚠️ 注文は0件なので結果は同じ） */
     AND REPLACE(SUBSTRING(i.inquiry_date, 1, 7), '-', '/') BETWEEN :start_month AND DATE_FORMAT(NOW(), '%Y/%m')
     AND DATEDIFF(CURDATE(), $inquiry_date) > 0
   ORDER BY days DESC
   LIMIT $row_limit";
$stmt_unsync = $pdo->prepare($sql_unsync);
$stmt_unsync->execute([':start_month' => $sync_start_month]);
$response_unsync = $stmt_unsync->fetchAll(PDO::FETCH_ASSOC);

// 来場予定日を過ぎたのに結果が入っていない顧客。
// ⚠️ 基準日 '2026-01-01' は menu.php と同じ（それより前の予約は数えない運用）。
// ⚠️⚠️ **当日の予約は出さない。** menu.php の `< NOW()` は当日分も数えるため、
//   バッジの件数よりここの行数は少し少なくなる。
$sql_cancel = "SELECT 'cancel' AS kind,
         DATEDIFF(CURDATE(), $reserved_date) AS days,
         " . dailyActionShop('m.in_charge_store', 'm.brand') . " AS shop,
         COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
         COALESCE(m.customer_contacts_name, '') AS customer,
         /* ⚠️ 担当営業（2026-09-28）。⚠️ **来場日未入力と本日の予定にだけ出す。**
            ⚠️ 未同期は inquiry_customer 由来で、⚠️ **まだ担当が決まっていない。**
            ⚠️⚠️ **in_charge_user をそのまま出す**（指示）。
              ⚠️ 「◯◯店 管理」に付け替えられている行はそのまま表示される。
              ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。 */
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
         COALESCE(m.sales_promotion_name, '') AS medium
    FROM master_data m
    LEFT JOIN $visible_shops s ON s.shop = TRIM(m.in_charge_store)
   WHERE m.show_dashboard = 1
     AND COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
     AND COALESCE(m.cancel_status, '') = ''
     AND COALESCE(m.status, '') <> '重複'
     AND $reserved_date > '2026-01-01'
     AND DATEDIFF(CURDATE(), $reserved_date) > 0
   ORDER BY days DESC
   LIMIT $row_limit";
// ⚠️ 来場日未入力は注文だけ（v2.2.175 合意）
$response_cancel = [];
if ($daily_has_cancel) {
    $stmt_cancel = $pdo->prepare($sql_cancel);
    $stmt_cancel->execute();
    $response_cancel = $stmt_cancel->fetchAll(PDO::FETCH_ASSOC);
}

// 本日の予定。
// ⚠️ 1人が同じ日に複数の工程を持つことがあるので、工程ごとに1行出す。
//   ⚠️ まとめると「何の予定か」が分からなくなる。
$today_parts = [];
$today_params = [];
foreach ($today_columns as $index => $column) {
    $step_date = dailyActionDate('m.' . $column);
    $today_parts[] = "SELECT :col$index AS col,
         COALESCE(m.in_charge_store, '') AS deal,
         " . dailyActionShop('m.in_charge_store', 'm.brand') . " AS shop,
         COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
         COALESCE(m.customer_contacts_name, '') AS customer,
         /* ⚠️ 担当営業（2026-09-28）。⚠️ **来場日未入力と本日の予定にだけ出す。**
            ⚠️ 未同期は inquiry_customer 由来で、⚠️ **まだ担当が決まっていない。**
            ⚠️⚠️ **in_charge_user をそのまま出す**（指示）。
              ⚠️ 「◯◯店 管理」に付け替えられている行はそのまま表示される。
              ⚠️ 旧担当（first_interviewed_user）には**寄せていない**。 */
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
         COALESCE(m.sales_promotion_name, '') AS medium
    FROM $daily_master m
    LEFT JOIN $visible_shops s ON s.shop = TRIM(m.in_charge_store)
   WHERE m.show_dashboard = 1
     AND COALESCE(m.status, '') <> '重複'
     AND $step_date = CURDATE()";
    $today_params[":col$index"] = $column;
}
$sql_today = implode("\n   UNION ALL\n", $today_parts) . "\n   ORDER BY shop, customer\n   LIMIT $row_limit";
$stmt_today = $pdo->prepare($sql_today);
$stmt_today->execute($today_params);
$response_today = $stmt_today->fetchAll(PDO::FETCH_ASSOC);
foreach ($response_today as &$today_row) {
    $today_row['step'] = $step_label_of((string)$today_row['col'], (string)$today_row['deal']);
}
unset($today_row);

/**
 * 本日要連絡（v2.2.175）。⚠️ Express の fetchContacts と同じ。
 *   商談ステップの「次回アクション日」か、架電の「次回架電日」が ⚠️ 今日のお客様。
 *   ⚠️ 記録（ログ）から数える。⚠️ 1人1行。⚠️ 両方あれば「次回アクション・次回架電」。
 * ⚠️ 正規表現は daily_report.php と同じ書き方（⚠️ day の書き方の揺れに対応）。
 *   ⚠️ `\\\\` は正規表現の `\\`（= バックスラッシュ1文字）。
 */
$stmt_today_date = $pdo->query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
$today_date = (string)$stmt_today_date->fetchColumn();
[$today_y, $today_m, $today_d] = explode('-', $today_date);
$today_regexp = '"day"[[:space:]]*:[[:space:]]*"' . $today_y . '(-|\\\\?/)' . $today_m . '(-|\\\\?/)' . $today_d;

$ids_with_today = function (string $table, string $column, string $action) use ($pdo, $today_regexp, $today_date): array {
    $stmt = $pdo->prepare("SELECT id, {$column} AS log FROM {$table} WHERE {$column} REGEXP ?");
    $stmt->execute([$today_regexp]);
    $ids = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $logs = json_decode($row['log'] ?? '', true);
        if (!is_array($logs)) continue;
        foreach ($logs as $log) {
            if (!is_array($log)) continue;
            $name = explode(',', (string)($log['action'] ?? ''))[0];
            $day = substr(str_replace('/', '-', trim((string)($log['day'] ?? ''))), 0, 10);
            if ($name === $action && $day === $today_date) {
                $ids[(string)$row['id']] = true;
                break;
            }
        }
    }
    return $ids;
};
$action_ids  = $ids_with_today('interview_sheet', 'interview_log', '次回アクション日');
$call_ids    = $ids_with_today('call_sheet', 'call_log', '次回架電日');
$contact_ids = array_map('strval', array_keys($action_ids + $call_ids));

$response_contact = [];
if (count($contact_ids) > 0) {
    $contact_holders = implode(',', array_fill(0, count($contact_ids), '?'));
    $sql_contact = "SELECT m.id AS id,
         " . dailyActionShop('m.in_charge_store', 'm.brand') . " AS shop,
         COALESCE(DATE_FORMAT($register_date, '%Y-%m-%d'), '') AS register,
         COALESCE(m.customer_contacts_name, '') AS customer,
         COALESCE(NULLIF(TRIM(m.in_charge_user), ''), '') AS staff,
         COALESCE(m.sales_promotion_name, '') AS medium
    FROM $daily_master m
    LEFT JOIN $visible_shops s ON s.shop = TRIM(m.in_charge_store)
   WHERE m.show_dashboard = 1
     AND COALESCE(m.status, '') <> '重複'
     AND m.id IN ($contact_holders)
   ORDER BY shop, customer
   LIMIT $row_limit";
    $stmt_contact = $pdo->prepare($sql_contact);
    $stmt_contact->execute($contact_ids);
    foreach ($stmt_contact->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $contact_id = (string)$row['id'];
        unset($row['id']);
        $kinds = [];
        if (isset($action_ids[$contact_id])) $kinds[] = '次回アクション';
        if (isset($call_ids[$contact_id])) $kinds[] = '次回架電';
        $row['contact'] = implode('・', $kinds);
        $response_contact[] = $row;
    }
}

// ⚠️ days は PDO が文字列で返すため、Express と同じ数値に揃える
$to_int_days = function (array $rows): array {
    foreach ($rows as &$row) {
        $row['days'] = (int) $row['days'];
    }
    unset($row);
    return $rows;
};
$response_unsync = $to_int_days($response_unsync);
$response_cancel = $to_int_days($response_cancel);

/**
 * ⚠️⚠️ **表は種類ごとに分ける**（2026-09-28 の指示）。
 *   ⚠️ 以前は未同期と来場日未入力を1つに混ぜていた。
 *   ⚠️ ⚠️ **混ぜると何をすればよいかが読み取れない**というのが変更の理由。
 * ⚠️ 並びは Express の runDailyAction() と**同じ順**にすること。
 */
// ⚠️ 並びは 本日要連絡 → 未同期 → 来場日未入力（注文だけ） → 本日の予定（工程順。行がある工程だけ）
$sections = [
    // ⚠️ hasCampaign は**未同期だけ true**（2026-09-28 の指示）。
    //   ⚠️ 来場日未入力・本日の予定は master_data 由来で、この列を返していない。
    // ⚠️ hasStaff は**未同期以外 true**（2026-09-28）。⚠️ 未同期はまだ担当が決まっていない
    // ⚠️ hasContact / highlight は**本日要連絡だけ true**（v2.2.175）
    ["label" => "本日要連絡", "hasDays" => false, "hasCampaign" => false, "hasStaff" => true, "hasContact" => true, "highlight" => true, "rows" => $response_contact],
    ["label" => "未同期", "hasDays" => true, "hasCampaign" => true, "hasStaff" => false, "hasContact" => false, "highlight" => false, "rows" => $response_unsync],
];
if ($daily_has_cancel) {
    $sections[] = ["label" => "来場日未入力", "hasDays" => true, "hasCampaign" => false, "hasStaff" => true, "hasContact" => false, "highlight" => false, "rows" => $response_cancel];
}
$present_steps = array_values(array_unique(array_map(fn ($row) => $row['step'], $response_today)));
usort($present_steps, function ($a, $b) use ($step_order) {
    $ia = array_search($a, $step_order, true);
    $ib = array_search($b, $step_order, true);
    return ($ia === false ? count($step_order) : $ia) <=> ($ib === false ? count($step_order) : $ib);
});
foreach ($present_steps as $step_name) {
    $step_rows = [];
    foreach ($response_today as $row) {
        if ($row['step'] !== $step_name) continue;
        // ⚠️ col / deal / step は画面に要らないので外す（⚠️ Express と同じ形）
        unset($row['col'], $row['deal'], $row['step']);
        $step_rows[] = $row;
    }
    $sections[] = [
        "label" => "本日の" . $step_name,
        "hasDays" => false,
        "hasCampaign" => false,
        "hasStaff" => true,
        "hasContact" => false,
        "highlight" => false,
        "rows" => $step_rows,
    ];
}

$total = 0;
foreach ($sections as $section) {
    $total += count($section['rows']);
}

/**
 * ⚠️⚠️ **その人が今日もう確認したか。**
 *   ⚠️ `staff.check_daily_action` が本日なら出さない。
 *   ⚠️ ⚠️ **誰か分からないときは出す**（出ないより出しすぎるほうが安全）。
 */
$show = true;
if ($daily_action_user && !empty($daily_action_user['check_daily_action'])) {
    $show = $daily_action_user['check_daily_action'] !== date('Y-m-d');
}

// ⚠️ キーの順序も Express と揃えている
$result = [
    "sections" => $sections,
    "total" => $total,
    "truncated" => count($response_unsync) >= $row_limit || count($response_cancel) >= $row_limit || count($response_contact) >= $row_limit,
    "show" => $show,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
