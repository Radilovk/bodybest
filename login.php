<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success"=>false, "message"=>"Only POST allowed"]);
    exit;
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);
if (!$data || !isset($data['password']) || !isset($data['username'])) {
    echo json_encode(["success"=>false, "message"=>"Липсват данни за вход"]);
    exit;
}

if ($data['username'] === 'admin' && $data['password'] === '6131') {
    $_SESSION['isAdmin'] = true;
    echo json_encode(["success" => true, "message" => "Logged in"]);
} else {
    echo json_encode(["success" => false, "message" => "Невалидни данни"]);
}
