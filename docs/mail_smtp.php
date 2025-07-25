<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Only POST method allowed"]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

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

if (preg_match("/[\r\n]/", $to) || preg_match("/[\r\n]/", $subject)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid header characters detected"]);
    exit;
}

require __DIR__ . '/../vendor/autoload.php';

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = 'mybody.best';
    $mail->Port = 465;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->SMTPAuth = true;
    $mail->Username = getenv('FROM_EMAIL') ?: 'info@mybody.best';
    $mail->Password = getenv('EMAIL_PASSWORD');

    $fromEmail = getenv('FROM_EMAIL') ?: 'info@mybody.best';
    $mail->setFrom($fromEmail);
    $mail->addAddress($to);
    $mail->Subject = $subject;
    $mail->isHTML(true);
    $mail->Body = $body;

    $mail->send();
    http_response_code(200);
    echo json_encode(["success" => true, "message" => "Email sent successfully."]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $mail->ErrorInfo]);
}
