<?php

$sql = "UPDATE staff_list SET memo = :memo WHERE name = :name AND shop = :shop";
$stmt = $pdo->prepare($sql);
$stmt->bindValue(':memo', $data['memo']);
$stmt->bindValue(':name', $data['staff']);
$stmt->bindValue(':shop', $data['shop']);
$stmt->execute();

exit;