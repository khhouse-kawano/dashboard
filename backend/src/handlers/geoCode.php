<?php
/**
 * ⚠️⚠️ **2026-09-15 以降、この処理は呼ばれていない。**
 *
 *   ⚠️ `property_list_kaeru` の latitude / longitude を更新するが、
 *     **この2列を読んでいる処理はどこにも無い**（backend / backend-express /
 *     frontend を検索して確認済み。EstateInfo.tsx が使うのは estate_info テーブル）。
 *
 *   ⚠️ 以前は runGeocode.ts の「物件データの処理」から呼ばれていたが、
 *     呼び出し側は **property_db** の一覧を見て **property_id** を持つ行に対し
 *     `property_number` を送っていたため、**常に 0 行更新**だった。
 *     ⚠️ 保存されないので毎回1,031件を Geocoding に投げ続け、
 *       請求が ¥150,000 を超えた。
 *
 *   ⚠️ 物件の経緯度は **property_db.lat_lng** に customer_address.php が保存する。
 *     ⚠️ こちらを復活させると**二重取得に戻る**ので、消すか放置すること。
 *     判断は利用者側に委ねるため、ファイル自体は残してある。
 */
try {
    $params = [
        ':latitude'  => $data['latitude'] ?? null,
        ':longitude' => $data['longitude'] ?? null,
        ':id'        => $data['id'] ?? null,
    ];

    $sql = "UPDATE property_list_kaeru SET latitude = :latitude, longitude = :longitude WHERE property_number = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['status' => 'success']);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error']);
}
