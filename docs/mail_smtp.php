<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/vendor/autoload.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST method allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$to = $input['to'] ?? '';
$subject = $input['subject'] ?? '(No subject)';
$body = $input['body'] ?? '';

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid recipient email']);
    exit;
}
if (empty($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing email body']);
    exit;
}

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = 'mail.mybody.best';
    $mail->SMTPAuth = true;
    $mail->Username = 'info@mybody.best';
    $mail->Password = 'YOUR_SMTP_PASSWORD';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port = 465;

    $mail->setFrom('info@mybody.best', 'MyBody');
    $mail->addAddress($to);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $body;
    $mail->send();
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Email sent.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mail->ErrorInfo]);
}

