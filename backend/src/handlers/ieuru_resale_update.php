<?php

try {
    // 必須チェック：Node.jsからは name か email が送られてくるため、どちらもない場合はエラー
    if (!$data || (empty($data['email']) && empty($data['name']))) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '無効なデータ、または必要な情報がありません。']);
        exit;
    }

    // ==========================================
    // 1. email で既存ユーザーの重複チェック
    // ==========================================
    $existingRecord = false;
    $checkEmail = $data['email'] ?? '';

    // ※注意: 不動産査定の場合、同じ人が別の物件を査定する可能性があるため、
    // 常に新規登録(INSERT)とする場合はこのチェックを外し、$existingRecord = false; のままにしてください。
    if ($checkEmail !== '') {
        $checkStmt = $pdo->prepare("SELECT id FROM ieuru_resale WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $checkEmail]);
        $existingRecord = $checkStmt->fetch(PDO::FETCH_ASSOC);
    }

    // ==========================================
    // 2. ユニークIDの発行とデータのマッピング
    // ==========================================
    // すでに存在していればそのIDを使い、新規ならPHPで一意のIDを生成する
    $uniqueId = $existingRecord ? $existingRecord['id'] : uniqid('ie_');

    // 抽出した全項目をバインド用の配列にセット
    $params = [
        ':id'                          => $uniqueId,
        ':email'                       => $data['email'] ?? null,
        ':name'                        => $data['name'] ?? null,
        ':nameKana'                    => $data['nameKana'] ?? null,
        ':age'                         => $data['age'] ?? null,
        ':address'                     => $data['address'] ?? null,
        ':mobile'                      => $data['mobile'] ?? null,
        ':preferredContactTime'        => $data['preferredContactTime'] ?? null,
        ':reasonForAssessment'         => $data['reasonForAssessment'] ?? null,
        ':requestsToCompany'           => $data['requestsToCompany'] ?? null,
        ':replacementFlag'             => $data['replacementFlag'] ?? null,
        ':assessmentMethod'            => $data['assessmentMethod'] ?? null,
        ':comment'                     => $data['comment'] ?? null,
        ':requestDate'                 => $data['requestDate'] ?? null,
        ':concurrentAssessments'       => $data['concurrentAssessments'] ?? null,
        ':propertyType'                => $data['propertyType'] ?? null,
        ':propertyAddress'             => $data['propertyAddress'] ?? null,
        ':mansionName'                 => $data['mansionName'] ?? null,
        ':roomNumber'                  => $data['roomNumber'] ?? null,
        ':buildingName'                => $data['buildingName'] ?? null,
        ':exclusiveArea'               => $data['exclusiveArea'] ?? null,
        ':buildingArea'                => $data['buildingArea'] ?? null,
        ':landArea'                    => $data['landArea'] ?? null,
        ':totalFloorArea'              => $data['totalFloorArea'] ?? null,
        ':floorPlan'                   => $data['floorPlan'] ?? null,
        ':buildingAge'                 => $data['buildingAge'] ?? null,
        ':propertyStatus'              => $data['propertyStatus'] ?? null,
        ':relationshipToProperty'      => $data['relationshipToProperty'] ?? null,
        ':ownershipPeriod'             => $data['ownershipPeriod'] ?? null,
        ':surroundingEnvironment'      => $data['surroundingEnvironment'] ?? null,
        ':buildingStructure'           => $data['buildingStructure'] ?? null,
        ':roadFrontage'                => $data['roadFrontage'] ?? null,
        ':propertyAppeal'              => $data['propertyAppeal'] ?? null,
        ':purchaseAssessment'          => $data['purchaseAssessment'] ?? null,
        ':assessmentAmountHighAndFast' => $data['assessmentAmountHighAndFast'] ?? null,
        ':priceMovement'               => $data['priceMovement'] ?? null,
        ':amountAfterTaxes'            => $data['amountAfterTaxes'] ?? null,
        ':concerns'                    => $data['concerns'] ?? null,
        ':whatToDoIfSoldHigher'        => $data['whatToDoIfSoldHigher'] ?? null,
        ':registered'                  => $data['registered'] ?? null,
        ':remarks'                     => $data['remarks'] ?? null,
    ];

    // ==========================================
    // 3. INSERT / UPDATE の実行
    // ==========================================
    if ($existingRecord) {
        // --- 存在する場合は UPDATE ---
        $sql = "UPDATE ieuru_resale SET 
                    email = :email,
                    name = :name,
                    nameKana = :nameKana,
                    age = :age,
                    address = :address,
                    mobile = :mobile,
                    preferredContactTime = :preferredContactTime,
                    reasonForAssessment = :reasonForAssessment,
                    requestsToCompany = :requestsToCompany,
                    replacementFlag = :replacementFlag,
                    assessmentMethod = :assessmentMethod,
                    comment = :comment,
                    requestDate = :requestDate,
                    concurrentAssessments = :concurrentAssessments,
                    propertyType = :propertyType,
                    propertyAddress = :propertyAddress,
                    mansionName = :mansionName,
                    roomNumber = :roomNumber,
                    buildingName = :buildingName,
                    exclusiveArea = :exclusiveArea,
                    buildingArea = :buildingArea,
                    landArea = :landArea,
                    totalFloorArea = :totalFloorArea,
                    floorPlan = :floorPlan,
                    buildingAge = :buildingAge,
                    propertyStatus = :propertyStatus,
                    relationshipToProperty = :relationshipToProperty,
                    ownershipPeriod = :ownershipPeriod,
                    surroundingEnvironment = :surroundingEnvironment,
                    buildingStructure = :buildingStructure,
                    roadFrontage = :roadFrontage,
                    propertyAppeal = :propertyAppeal,
                    purchaseAssessment = :purchaseAssessment,
                    assessmentAmountHighAndFast = :assessmentAmountHighAndFast,
                    priceMovement = :priceMovement,
                    amountAfterTaxes = :amountAfterTaxes,
                    concerns = :concerns,
                    whatToDoIfSoldHigher = :whatToDoIfSoldHigher,
                    registered = :registered,
                    remarks = :remarks
                WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'updated', 'id' => $uniqueId]);
    } else {
        // --- 存在しない場合は INSERT ---
        $sql = "INSERT INTO ieuru_resale (
                    id, email, name, nameKana, age, address, mobile, preferredContactTime, 
                    reasonForAssessment, requestsToCompany, replacementFlag, assessmentMethod, comment, 
                    requestDate, concurrentAssessments, propertyType, propertyAddress, mansionName, 
                    roomNumber, buildingName, exclusiveArea, buildingArea, landArea, totalFloorArea, 
                    floorPlan, buildingAge, propertyStatus, relationshipToProperty, ownershipPeriod, 
                    surroundingEnvironment, buildingStructure, roadFrontage, propertyAppeal, 
                    purchaseAssessment, assessmentAmountHighAndFast, priceMovement, amountAfterTaxes, 
                    concerns, whatToDoIfSoldHigher, registered, remarks
                ) VALUES (
                    :id, :email, :name, :nameKana, :age, :address, :mobile, :preferredContactTime, 
                    :reasonForAssessment, :requestsToCompany, :replacementFlag, :assessmentMethod, :comment, 
                    :requestDate, :concurrentAssessments, :propertyType, :propertyAddress, :mansionName, 
                    :roomNumber, :buildingName, :exclusiveArea, :buildingArea, :landArea, :totalFloorArea, 
                    :floorPlan, :buildingAge, :propertyStatus, :relationshipToProperty, :ownershipPeriod, 
                    :surroundingEnvironment, :buildingStructure, :roadFrontage, :propertyAppeal, 
                    :purchaseAssessment, :assessmentAmountHighAndFast, :priceMovement, :amountAfterTaxes, 
                    :concerns, :whatToDoIfSoldHigher, :registered, :remarks
                )";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'action' => 'inserted', 'id' => $uniqueId]);
    }

    // Dashboard連携
    require_once __DIR__ . '/portal/ieuru_resale.php';

} catch (PDOException $e) {
    // データベースエラー時のハンドリング
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // その他のエラー
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'System error: ' . $e->getMessage()]);
}