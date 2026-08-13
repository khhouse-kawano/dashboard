<?php
// $pdo, $data は定義済みとする

try {
    // 💡 テーブルの全カラム（id以外）に対するINSERT文
    $sql = "INSERT INTO suumo_property (rank, area, company, name, price, plan, url, registered_at) 
            VALUES (:rank, :area, :company, :name, :price, :plan, :url, :registered_at)";
            
    $stmt = $pdo->prepare($sql);
    
    // 値のバインド（$dataのプロパティが存在しない場合は null をセット）
    $stmt->bindValue(':rank', $data['rank'] ?? null);
    $stmt->bindValue(':area', $data['area'] ?? null);
    $stmt->bindValue(':company', $data['company'] ?? null);
    $stmt->bindValue(':name', $data['name'] ?? null);
    $stmt->bindValue(':price', $data['price'] ?? null);
    $stmt->bindValue(':plan', $data['plan'] ?? null);
    $stmt->bindValue(':url', $data['url'] ?? null);
    $stmt->bindValue(':registered_at', $data['registered_at'] ?? null);
    
    // 実行（真理の保存）
    $stmt->execute();
    
    // （オプション）成功時のレスポンス出力など
    echo json_encode(["status" => "success", "message" => "DB保存完了"]);

} catch (PDOException $e) {
    // エラーハンドリング
    error_log("DB INSERT ERROR: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "DB保存エラー"]);
}