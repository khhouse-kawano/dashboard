<?php
$sql = "SELECT 
    c.id, 
    c.name, 
    c.status, 
    c.medium, 
    c.rank, 
    c.register, 
    c.reserve, 
    c.shop, 
    c.medium, 
    c.estate, 
    c.meeting, 
    c.appointment, 
    c.line_group, 
    c.screening, 
    c.rival, 
    c.period, 
    c.survey, 
    c.budget, 
    c.importance, 
    c.note, 
    c.staff, 
    c.section, 
    c.contract, 
    c.sales_meeting,
    c.trash,
    (SELECT date FROM customers ORDER BY STR_TO_DATE(date, '%Y/%c/%d %H:%i:%s') DESC LIMIT 1) AS latest_date,
    (SELECT sales_meeting FROM customers ORDER BY LENGTH(sales_meeting) DESC LIMIT 1) AS last_meeting
    FROM customers AS c WHERE trash = 1
    ORDER BY STR_TO_DATE(c.register, '%Y/%m/%d') DESC;";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
