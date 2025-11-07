<?php
session_start();

// Extend session lifetime if "remember me" is requested
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    if (isset($data['rememberMe']) && $data['rememberMe'] === true) {
        // Set session cookie to last 30 days
        ini_set('session.cookie_lifetime', 30 * 24 * 60 * 60);
        ini_set('session.gc_maxlifetime', 30 * 24 * 60 * 60);
        // Regenerate session with extended lifetime
        session_regenerate_id(true);
    }
}

header('Content-Type: application/json; charset=utf-8');
// Configure allowed origins
$defaultAllowedOrigins = [
    'https://radilovk.github.io',
    'https://radilov-k.github.io',
    'http://localhost:5173',
    'http://localhost:3000',
    'null'
];
$envOrigins = getenv('ALLOWED_ORIGINS');
$allowedOrigins = $envOrigins ? array_filter(array_map('trim', explode(',', $envOrigins))) : [];
$allowedOrigins = array_unique(array_merge($allowedOrigins, $defaultAllowedOrigins));
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? 'null';
$originToSend = in_array($requestOrigin, $allowedOrigins, true) ? $requestOrigin : $allowedOrigins[0];
header('Access-Control-Allow-Origin: ' . $originToSend);
header('Vary: Origin');

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
$rememberMe = isset($data['rememberMe']) ? $data['rememberMe'] : false;
$envUser = getenv('ADMIN_USERNAME');
$envHash = getenv('ADMIN_PASS_HASH');
$expectedUser = ($envUser !== false && $envUser !== '') ? $envUser : 'admin';

if ($username === $expectedUser) {
    if ($envHash !== false && $envHash !== '' && password_verify($password, $envHash)) {
        $_SESSION['isAdmin'] = true;
        session_regenerate_id(true);
        
        // Set persistent cookie if "remember me" is checked
        if ($rememberMe) {
            $sessionName = session_name();
            $sessionId = session_id();
            setcookie($sessionName, $sessionId, time() + (30 * 24 * 60 * 60), '/');
        }
        
        echo json_encode(["success" => true, "message" => "Logged in"]);
        exit;
    }
    if (($envHash === false || $envHash === '') && $password === '6131') {
        $_SESSION['isAdmin'] = true;
        session_regenerate_id(true);
        
        // Set persistent cookie if "remember me" is checked
        if ($rememberMe) {
            $sessionName = session_name();
            $sessionId = session_id();
            setcookie($sessionName, $sessionId, time() + (30 * 24 * 60 * 60), '/');
        }
        
        echo json_encode(["success" => true, "message" => "Logged in"]);
        exit;
    }
}

http_response_code(401);
echo json_encode(["success" => false, "message" => "Невалидни данни"]);
