<?php
// docs/mail.php - example endpoint used by sendEmailWorker.js
// Accepts JSON {to, subject, body} and sends the email.
// Adjust authentication and SMTP settings as needed.

$input = json_decode(file_get_contents('php://input'), true);
if (!isset($input['to'], $input['subject'], $input['body'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid input']);
    exit;
}

$to = $input['to'];
$subject = $input['subject'];
$body = $input['body'];
$headers = "Content-Type: text/plain; charset=UTF-8\r\n";

if (mail($to, $subject, $body, $headers)) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to send']);
}

