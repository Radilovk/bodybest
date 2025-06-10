<?php
header("Content-Type: application/json; charset=utf-8");

// ----- Конфигурация чрез променливи на средата -----
$cloudflareApiToken = getenv('CF_API_TOKEN');
$cloudflareAccountId = 'c2015f4060e04bc3c414f78a9946668e'; // Cloudflare Account ID
$kvNamespaceId = '8ebf65a6ed0a44e7b7d1b4bc6f24465e'; // Namespace ID за RESOURCES_KV
$kvKeyName = 'question_definitions';
// -----------------------------------------------------

// Обработка на OPTIONS заявка за проверка на сесията
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Може да добавите реална проверка на сесия тук
    echo json_encode(["session" => true]);
    exit;
}

// Функция за изпращане на отговор и прекратяване на скрипта
function respondAndExit($code, $success, $message) {
    http_response_code($code);
    echo json_encode([
        "success" => $success,
        "message" => $message
    ]);
    exit;
}

// Проверка дали конфигурацията е попълнена (проста проверка)
if (empty($cloudflareApiToken) || empty($cloudflareAccountId) || empty($kvNamespaceId)) {
    error_log("save-questions.php: Липсва CF_API_TOKEN или друга конфигурация.");
    respondAndExit(500, false, "Сървърът няма достъп до Cloudflare (липсва CF_API_TOKEN).");
}


// 1. Получаване на входящите данни (POST body)
$input = file_get_contents('php://input');
if (!$input) {
    error_log("save-questions.php: Няма получени данни.");
    respondAndExit(400, false, "Няма получени данни.");
}

// 2. Декодиране на JSON данните
$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    $jsonError = json_last_error_msg();
    error_log("save-questions.php: Грешка при декодиране на JSON: " . $jsonError);
    respondAndExit(400, false, "Грешка при декодиране на JSON: " . $jsonError);
}

// 3. Определяне на път към файла questions.json
$jsonFilePath = __DIR__ . "/questions.json";

// 4. Ако файлът не съществува, опитайте да го създадете
if (!file_exists($jsonFilePath)) {
    $created = @file_put_contents($jsonFilePath, '');
    if ($created === false && !file_exists($jsonFilePath)) {
        error_log("save-questions.php: Неуспешно създаване на файла " . $jsonFilePath);
        respondAndExit(500, false, "Неуспешно създаване на файла.");
    }
}

// 5. Проверка дали файлът е записваем
if (!is_writable($jsonFilePath)) {
    error_log("save-questions.php: Файлът " . $jsonFilePath . " не е записваем.");
    respondAndExit(500, false, "Файлът не е записваем. Уверете се, че имате необходимите права.");
}

// 6. Преобразуване на получените данни в красив формат
$jsonEncoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if ($jsonEncoded === false) {
    $jsonEncodeError = json_last_error_msg();
    error_log("save-questions.php: Грешка при JSON енкодиране: " . $jsonEncodeError);
    respondAndExit(500, false, "Грешка при енкодиране на данните: " . $jsonEncodeError);
}

// 7. Записване на данните във файла
$result = file_put_contents($jsonFilePath, $jsonEncoded);
if ($result === false) {
    error_log("save-questions.php: Грешка при запис на файла " . $jsonFilePath);
    respondAndExit(500, false, "Грешка при запис на файла.");
}

// ----- 8. Актуализиране на Cloudflare KV -----
$apiUrl = "https://api.cloudflare.com/client/v4/accounts/{$cloudflareAccountId}/storage/kv/namespaces/{$kvNamespaceId}/values/{$kvKeyName}";

// Инициализиране на cURL сесия
$ch = curl_init();

// Настройка на cURL опциите
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonEncoded);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer {$cloudflareApiToken}",
    "Content-Type: text/plain"
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

// Изпълнение на заявката
$cfApiResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

// Затваряне на cURL сесията
curl_close($ch);

// Проверка на резултата от cURL заявката
if ($curlError) {
    error_log("save-questions.php: cURL грешка при обновяване на KV: " . $curlError);
    respondAndExit(500, false, "Файлът е записан локално, но неуспешно обновяване в Cloudflare KV (cURL грешка).");
} elseif ($httpCode >= 200 && $httpCode < 300) {
    error_log("save-questions.php: Успешно обновен ключ '{$kvKeyName}' в Cloudflare KV. HTTP Status: {$httpCode}");
    respondAndExit(200, true, "Файлът е записан успешно и синхронизиран с Cloudflare.");
} else {
    $apiErrorDetails = $cfApiResponse ? strip_tags($cfApiResponse) : 'Няма допълнителни детайли.';
    // Log detailed error including potentially incorrect token/permissions if 401/403
    error_log("save-questions.php: Грешка от Cloudflare API (HTTP {$httpCode}) при обновяване на KV: " . $apiErrorDetails . " (Проверете API токена и правата му!)");
    respondAndExit(500, false, "Файлът е записан локално, но неуспешно обновяване в Cloudflare KV (API грешка: {$httpCode}). Проверете API токена. Детайли: " . substr($apiErrorDetails, 0, 200));
}

?>