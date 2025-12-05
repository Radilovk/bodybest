<?php
// Разреши заявки от frontend/Worker (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Позволи само POST заявки
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Only POST method allowed"]);
    exit;
}

// Извлечи и декодирай JSON от заявката
$data = json_decode(file_get_contents("php://input"), true);
error_log('Input: '.json_encode($data));

// Валидация
$to = $data['to'] ?? '';
$subject = $data['subject'] ?? '(Без тема)';
$body = $data['body'] ?? ($data['message'] ?? '');

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid recipient email"]);
    exit;
}

if (empty($body)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing email body"]);
    exit;
}

// Защита от mail header injection
if (preg_match("/[\r\n]/", $to) || preg_match("/[\r\n]/", $subject)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid header characters detected"]);
    exit;
}

// Имейл заглавки за HTML
$headers = "MIME-Version: 1.0\r\n";
$headers .= "Content-type: text/html; charset=UTF-8\r\n";
$fromEmail = getenv('FROM_EMAIL') ?: 'info@onebody.top';
$fromName = isset($data['fromName']) ? $data['fromName'] : (getenv('FROM_NAME') ?: '');
$fromHeader = $fromName ? "$fromName <{$fromEmail}>" : $fromEmail;
$headers .= "From: {$fromHeader}\r\n";
$headers .= "Reply-To: {$fromEmail}\r\n";

// Изпращане
$success = mail($to, $subject, $body, $headers);
error_log('Success: '.var_export($success, true));

// Отговор
if ($success) {
    http_response_code(200);
    echo json_encode(["success" => $success, "message" => "Email sent successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["success" => $success, "error" => "Failed to send email."]);
}
