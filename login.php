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

define('ADMIN_PASS', 'admin123');

if ($data['password'] === ADMIN_PASS) {
    $_SESSION['isAdmin'] = true;
    echo json_encode(["success"=>true, "message"=>"Logged in"]);
} else {
    echo json_encode(["success"=>false, "message"=>"Грешна парола"]);
}
