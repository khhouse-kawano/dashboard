<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/token.php';
require_once __DIR__ . '/core/helpers.php';

header("Content-Type: application/json; charset=utf-8");

$handler = __DIR__ . "/handlers/" . $request . ".php";

require_once $handler;
