<?php
// ログイン権限一覧（staff テーブル）。
//
// ⚠️ 人事マスタ（staff_list）とは別物であり、連携していない。
//   このハンドラは staff のみを返す。以前は section_list / shop_list も
//   返していたが、EditAuth.tsx では使っていない無駄なクエリだったため削除した。
//
// ⚠️⚠️ 2026-10-05（v2.2.163）: **以前は `SELECT * FROM staff` をそのまま返していた。**
//   ⚠️ ⚠️ **全スタッフの api_token と password がブラウザへ送られていた。**
//     api_token はログイン状態そのもので、取得した人は Master を含む誰にでもなりすませた。
//     しかもこのハンドラには認証チェックが無く、ログインしていなくても返っていた。
//   ⚠️ log 列（合計221MB）も返しており、ローカルではメモリ上限で落ちていた。
//
//   ⚠️⚠️ **返す列は必ず明示すること。`SELECT *` に戻さないこと。**
//
// ⚠️ 通常は ② へ転送される（core/express_proxy.php）。ここが動くのは ② が落ちたときだけ。
//   ⚠️ 総アクセス時間は ② でしか計算しない（このハンドラは返さない）。

require_once __DIR__ . '/../core/authz.php';

$staffRow = requireStaff($pdo, $headers);
requireAuthority($staffRow, ['Master', 'BrandAdmin']);

$sql = "SELECT id, name, brand, shop, mail, heartbeat, (password <> '') AS has_password
          FROM staff
         WHERE mail <> ''
         ORDER BY id";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "staff" => $staff,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
