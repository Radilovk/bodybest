<?php
// Remember me session duration: 30 days
define('REMEMBER_ME_DURATION', 30 * 24 * 60 * 60);

// Check for "remember me" before starting session
$rememberMe = false;
$data = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    
    // Only check rememberMe if JSON was successfully parsed
    if ($data && isset($data['rememberMe'])) {
        $rememberMe = $data['rememberMe'] === true;
    }
    
    // Configure session settings before starting session
    if ($rememberMe) {
        ini_set('session.cookie_lifetime', REMEMBER_ME_DURATION);
        ini_set('session.gc_maxlifetime', REMEMBER_ME_DURATION);
    }
}

session_start();

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

// Data was already parsed above for rememberMe check
if (!$data || !isset($data['password']) || !isset($data['username'])) {
    echo json_encode(["success"=>false, "message"=>"Липсват данни за вход"]);
    exit;
}

$username = trim($data['username']);
$password = $data['password'];
$envUser = getenv('ADMIN_USERNAME');
$envHash = getenv('ADMIN_PASS_HASH');
$expectedUser = ($envUser !== false && $envUser !== '') ? $envUser : 'admin';

// Helper function to set persistent cookie
function setPersistentSessionCookie() {
    $sessionName = session_name();
    $sessionId = session_id();
    setcookie($sessionName, $sessionId, time() + REMEMBER_ME_DURATION, '/');
}

if ($username === $expectedUser) {
    if ($envHash !== false && $envHash !== '' && password_verify($password, $envHash)) {
        $_SESSION['isAdmin'] = true;
        session_regenerate_id(true);
        
        // Set persistent cookie if "remember me" is checked
        if ($rememberMe) {
            setPersistentSessionCookie();
        }
        
        echo json_encode(["success" => true, "message" => "Logged in"]);
        exit;
    }
    if (($envHash === false || $envHash === '') && $password === '6131') {
        $_SESSION['isAdmin'] = true;
        session_regenerate_id(true);
        
        // Set persistent cookie if "remember me" is checked
        if ($rememberMe) {
            setPersistentSessionCookie();
        }
        
        echo json_encode(["success" => true, "message" => "Logged in"]);
        exit;
    }
}

http_response_code(401);
echo json_encode(["success" => false, "message" => "Невалидни данни"]);
