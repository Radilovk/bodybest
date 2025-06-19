<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success"=>false, "message"=>"Only POST allowed"]);
    exit;
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);
if (!$data || !isset($data['password'])) {
    echo json_encode(["success"=>false, "message"=>"No password provided"]);
    exit;
}

// Очакваме хеш на паролата в променлива на средата
$adminHash = getenv('ADMIN_PASS_HASH');
if ($adminHash === false) {
    error_log('ADMIN_PASS_HASH env not set');
    echo json_encode(["success"=>false, "message"=>"Server configuration error"]);
    exit;
}

if (password_verify($data['password'], $adminHash)) {
    $_SESSION['isAdmin'] = true;
    echo json_encode(["success"=>true, "message"=>"Logged in"]);
} else {
    echo json_encode(["success"=>false, "message"=>"Грешна парола"]);
}
