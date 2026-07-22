<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);


if($_POST['pass'] == 'admin' && strpos($_POST['mail'],'@kh-group.jp') !== false){
    $response = [ 'result' => 'yes'];
    echo json_encode($response);
} else {
    $response = [ 'result' => 'no' ];
    echo json_encode($response);
}
?>