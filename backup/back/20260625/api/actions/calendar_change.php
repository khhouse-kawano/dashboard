<?php
$data = json_decode(file_get_contents("php://input"), true);
$id = isset($data['id']) ? $data['id'] : "";
$request = isset($data['request']) ? $data['request'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$category = isset($data['category']) ? $data['category'] : "";
$startDate = isset($data['startDate']) ? $data['startDate'] : "";
$endDate = isset($data['endDate']) ? $data['endDate'] : "";
$title = isset($data['title']) ? $data['title'] : "";
$note = isset($data['note']) ? $data['note'] : "";
$url = isset($data['url']) ? $data['url'] : "";
$reserved = isset($data['reserved']) ? $data['reserved'] : "";
$new = isset($data['new']) ? $data['new'] : "";
$next = isset($data['next']) ? $data['next'] : "";
$registered = isset($data['registered']) ? $data['registered'] : "";
$date = isset($data['date']) ? $data['date'] : "";
$requestArray = isset($data['requestArray']) ? $data['requestArray'] : [];
try {
    if ($request === 'calendar_change') {
        $fields = [];
        $params = [];
        foreach ($requestArray as $req) {
            switch ($req) {
                case 'title':
                    if ($title !== "") {
                        $fields[] = "title = ?";
                        $params[] = $title;
                    }
                    break;
                case 'startDate':
                    if ($startDate !== "") {
                        $fields[] = "startDate = ?";
                        $params[] = $startDate;
                    }
                    break;
                case 'endDate':
                    if ($endDate !== "") {
                        $fields[] = "endDate = ?";
                        $params[] = $endDate;
                    }
                    break;

                case 'note':
                    if ($note !== "") {
                        $fields[] = "note = ?";
                        $params[] = $note;
                    }
                    break;
                case 'url':
                    if ($url !== "") {
                        $fields[] = "url = ?";
                        $params[] = $url;
                    }
                    break;
            }
        }
        $fields[] = "flag = 1";

        $sqlUpdate = "UPDATE event_calendar SET " . implode(", ", $fields) . " WHERE id = ?";
        $params[] = $id;

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute($params);
        $newSql = "SELECT *
        FROM event_calendar WHERE flag = 1";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($newEvents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($request === 'response_change') {
        function upsertCount($pdo, $shop, $title, $date, $category, $count)
        {
            $sqlCheck = "SELECT COUNT(*) FROM reserved_calendar 
                 WHERE shop = ? AND event = ? AND date = ? AND category = ?";
            $stmtCheck = $pdo->prepare($sqlCheck);
            $stmtCheck->execute([$shop, $title, $date, $category]);
            $exists = $stmtCheck->fetchColumn() > 0;

            if ($exists) {
                $sqlUpdate = "UPDATE reserved_calendar 
                      SET count = ? 
                      WHERE shop = ? AND event = ? AND date = ? AND category = ?";
                $stmtUpdate = $pdo->prepare($sqlUpdate);
                $stmtUpdate->execute([$count, $shop, $title, $date, $category]);
            } else {
                $sqlInsert = "INSERT INTO reserved_calendar (shop, event, date, category, count)
                      VALUES (?, ?, ?, ?, ?)";
                $stmtInsert = $pdo->prepare($sqlInsert);
                $stmtInsert->execute([$shop, $title, $date, $category, $count]);
            }
        }

        if (in_array('reserved', $requestArray, true)) {
            upsertCount($pdo, $shop, $title, $date, 'reserved', $reserved);
        }
        if (in_array('new', $requestArray, true)) {
            upsertCount($pdo, $shop, $title, $date, 'new', $new);
        }
        if (in_array('next', $requestArray, true)) {
            upsertCount($pdo, $shop, $title, $date, 'next', $next);
        }
        if (in_array('registered', $requestArray, true)) {
            upsertCount($pdo, $shop, $title, $date, 'registered', $registered);
        }

        $newSql = "SELECT * FROM reserved_calendar";
        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($newEvents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($request === 'delete_calendar') {
        $sqlUpdate = "UPDATE event_calendar SET flag = 0 WHERE id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$id]);

        $newSql = "SELECT *
        FROM event_calendar WHERE flag = 1";
        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($newEvents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
