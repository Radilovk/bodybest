<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

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

$username = trim($data['username']);
$password = $data['password'];
$envUser = getenv('ADMIN_USERNAME');
$envHash = getenv('ADMIN_PASS_HASH');
$expectedUser = ($envUser !== false && $envUser !== '') ? $envUser : 'admin';

if ($username === $expectedUser) {
    if ($envHash !== false && $envHash !== '' && password_verify($password, $envHash)) {
        $_SESSION['isAdmin'] = true;
        session_regenerate_id(true);
        echo json_encode(["success" => true, "message" => "Logged in"]);
        exit;
    }
    if (($envHash === false || $envHash === '') && $password === '6131') {
        $_SESSION['isAdmin'] = true;
        session_regenerate_id(true);
        echo json_encode(["success" => true, "message" => "Logged in"]);
        exit;
    }
}

http_response_code(401);
echo json_encode(["success" => false, "message" => "Невалидни данни"]);
