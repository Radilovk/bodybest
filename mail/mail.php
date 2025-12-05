<?php
// Дебъгване на грешки
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

// Часова зона
date_default_timezone_set('Europe/Sofia');

// Тест за активен файл — можете да премахнете този ред след теста
file_put_contents(__DIR__.'/debug_alive.txt', "mail.php се изпълнява: ".date('r'));

// PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__.'/PHPMailer/Exception.php';
require __DIR__.'/PHPMailer/PHPMailer.php';
require __DIR__.'/PHPMailer/SMTP.php';

// Данни (JSON или FORM)
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents('php://input'), true);
} else {
    $data = $_POST;
}
file_put_contents(__DIR__.'/debug_data.txt', print_r($data, true));

// Вземане и дебъг на email
$to_raw = $data['to'] ?? '';
file_put_contents(__DIR__.'/debug_to_raw.txt', $to_raw);

// Валидация на email с trim
$to = isset($data['to']) ? filter_var(trim($data['to']), FILTER_VALIDATE_EMAIL) : null;
file_put_contents(__DIR__.'/debug_to_valid.txt', $to);

// Ако няма валиден email, записва debug_error.txt и спира
if (!$to) {
    file_put_contents(__DIR__.'/debug_error.txt', "FAIL: to: " . print_r($to, true));
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Невалиден email адрес.']);
    exit;
}

// Subject и message
// Важно: $message вече трябва да съдържа пълния HTML код, който искате да изпратите.
$subject = isset($data['subject']) ? trim($data['subject']) : '';
$message = isset($data['message']) ? trim($data['message']) : '';

if (mb_strlen($subject) < 2) {
    file_put_contents(__DIR__.'/debug_error.txt', "FAIL: subject: " . $subject);
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Темата е твърде къса.']);
    exit;
}
if (mb_strlen($message) < 2) {
    file_put_contents(__DIR__.'/debug_error.txt', "FAIL: message: " . $message);
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Съобщението е твърде кратко.']);
    exit;
}

// PHPMailer конфиг
$from_email = 'info@onebody.top';
$from_name = 'OneBody.Top';

$mail = new PHPMailer(true);

try {
  // SMTP Настройки
  $mail->isSMTP();
  $mail->Host       = 'onebody.top';
  $mail->SMTPAuth   = true;
  $mail->Username   = 'info@onebody.top';
  $mail->Password   = 'Legion69.#'; // ВАЖНО: Пазете паролата сигурно, не я качвайте в публични хранилища!
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
  $mail->Port       = 465;
  $mail->CharSet    = 'UTF-8';

    // Получатели
    $mail->setFrom($from_email, $from_name);
    $mail->addAddress($to);

    // Съдържание
    $mail->isHTML(true); // Посочваме, че имейлът е в HTML формат
    $mail->Subject = $subject;

    // --- КЛЮЧОВА ПРОМЯНА ---
    // Body съдържа директно HTML-а, без да се обработва с htmlspecialchars()
    $mail->Body    = $message;
    // AltBody съдържа текстова версия за клиенти, които не поддържат HTML,
    // и за подобряване на доставката (по-малка вероятност да е спам).
    // strip_tags() е лесен начин да се създаде такава версия.
    $mail->AltBody = strip_tags($message);
    // -------------------------

    $mail->send();
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Имейлът е изпратен успешно.']);

} catch (Exception $e) {
    file_put_contents(__DIR__.'/debug_error.txt', "MAIL ERROR: ".$mail->ErrorInfo);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Възникна грешка при изпращане на имейла: ' . $mail->ErrorInfo]);
}
?>