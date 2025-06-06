<?php
// file_manager_api.php – Управление на файловете - Версия с корекция САМО в handleReadFileRequest

// Конфигурация
define('UPLOADS_DIR', __DIR__ . '/user_profiles/'); // ОСТАВА БЕЗ ПРОМЯНА
define('STATIC_TOKEN', 'FXW29QFHZ3M70VDUFN1FSLG6WVI9UOF1'); // API ключ за удостоверяване

// Задаване на CORS заглавки
header("Access-Control-Allow-Origin: *"); // Може да се ограничи до твоя Worker или домейни
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Създаване на директорията за качване, ако не съществува (Остава без промяна)
if (!is_dir(UPLOADS_DIR)) {
    // Опитваме да създадем главната директория рекурсивно
    if (!mkdir(UPLOADS_DIR, 0755, true) && !is_dir(UPLOADS_DIR)) {
        // Грешка, ако не успее да създаде главната директория
        http_response_code(500);
        // Логваме грешката
        error_log("Failed to create base upload directory: " . UPLOADS_DIR);
        echo json_encode(['error' => 'Неуспех при създаването на директорията за качване']);
        exit;
    }
}

// Функция за удостоверяване чрез Authorization header (Остава без промяна)
function authenticate() {
    $headers = getallheaders();
    $authHeader = null;
    // По-устойчиво четене на хедъра (може да е с малка или главна буква)
    foreach ($headers as $name => $value) {
        if (strtolower($name) === 'authorization') {
            $authHeader = $value;
            break;
        }
    }

    if ($authHeader) {
        // Проверка за 'Bearer ' префикс
        if (preg_match('/^Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            if ($token === STATIC_TOKEN) {
                return true; // Успешна аутентикация
            } else {
                 error_log("Authentication failed: Invalid token provided.");
            }
        } else {
             error_log("Authentication failed: Invalid Authorization header format.");
        }
    } else {
         error_log("Authentication failed: Authorization header missing.");
    }

    // Неуспешна аутентикация
    http_response_code(401);
    echo json_encode(['error' => 'Неуспешно удостоверяване']);
    exit;
}


// --- Основен switch за заявките (Без промяна в структурата) ---
$requestMethod = $_SERVER['REQUEST_METHOD'];
switch ($requestMethod) {
    case 'GET':
        authenticate(); // Изисква аутентикация за GET
        // Разграничаваме четене на файл от листене на директория
        if (isset($_GET['action']) && $_GET['action'] === 'read_file') {
            handleReadFileRequest(); // <-- ТУК Е ПРОМЯНАТА
        } else {
            handleGetRequest(); // Функцията за листене остава без промяна
        }
        break;
    case 'POST':
        authenticate(); // Изисква аутентикация за POST
        handleCreateFileOrUpload(); // Функцията за създаване/качване остава без промяна
        break;
    case 'PUT':
        authenticate(); // Изисква аутентикация за PUT
        handleUpdateFileRequest(); // Функцията за актуализация остава без промяна
        break;
    case 'DELETE':
        authenticate(); // Изисква аутентикация за DELETE
        handleDeleteRequest(); // Функцията за изтриване остава без промяна
        break;
    case 'OPTIONS':
        // OPTIONS заявките не изискват тяло или аутентикация, само CORS хедъри
        http_response_code(200);
        exit;
    default:
        http_response_code(405); // Method Not Allowed
        echo json_encode(['error' => 'Методът не е разрешен']);
        break;
}


// --- Функцията handleGetRequest (Без Промяна) ---
// Тази функция се използва за листене на файлове в директория (ако изобщо се ползва)
function handleGetRequest() {
    $directory = isset($_GET['directory']) ? trim($_GET['directory'], "/") : '';
    $path = UPLOADS_DIR . ($directory ? $directory . '/' : ''); // Добавяме '/' само ако има директория

    // Валидация на пътя
    if (strpos($directory, '..') !== false) {
        http_response_code(400); echo json_encode(['error' => 'Невалиден път.']); return;
    }
     // Допълнителна проверка дали сме в рамките на UPLOADS_DIR (препоръчително)
     $realBaseDir = realpath(UPLOADS_DIR);
     $realPath = realpath($path);
     if ($realBaseDir === false || $realPath === false || strpos($realPath, $realBaseDir) !== 0) {
         http_response_code(400); echo json_encode(['error' => 'Достъп до директорията е отказан.']); return;
     }


    if (!is_dir($path)) {
        http_response_code(404); // Променено от 400 на 404 Not Found
        echo json_encode(['error' => 'Директорията не съществува']);
        return;
    }
    // Сканираме директорията и премахваме '.' и '..'
    $files = array_diff(scandir($path), ['.', '..']);
    http_response_code(200);
    // Връщаме само имената на файловете/директориите като масив
    echo json_encode(array_values($files));
}

// --- НОВАТА, КОРИГИРАНА ВЕРСИЯ НА handleReadFileRequest ---
function handleReadFileRequest() {
    // Проверка дали е подадено име на файл
    if (!isset($_GET['filename'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Не е посочен файл за четене']);
        return;
    }

    // Вземаме директорията от GET параметъра, ако е зададена, иначе празен стринг
    $directory = isset($_GET['directory']) ? trim($_GET['directory'], "/") : '';
    // Почистваме името на файла от / и опити за обхождане
    $filename = basename(trim($_GET['filename'], "/"));

    // Проверка за опити за обхождане '..' в директорията или файла
    if (strpos($directory, '..') !== false || strpos($filename, '..') !== false) {
        http_response_code(400);
        echo json_encode(['error' => 'Невалиден път до файла.']);
        return;
    }

    // Конструираме пълния път до файла.
    // UPLOADS_DIR вече завършва на '/', така че добавяме $directory и '/' само ако $directory не е празен.
    $filePath = UPLOADS_DIR . ($directory ? $directory . '/' : '') . $filename;

    // Логваме конструирания път за дебъг
    error_log("handleReadFileRequest: Attempting to read file at path: " . $filePath);

    // Проверяваме дали файлът съществува на този път
    if (!file_exists($filePath)) {
        http_response_code(404); // Not Found
        error_log("handleReadFileRequest: File not found at path: " . $filePath);
        echo json_encode(['error' => 'Файлът не съществува']);
        return;
    }

    // Проверяваме дали файлът е четим
     if (!is_readable($filePath)) {
         http_response_code(403); // Forbidden
         error_log("handleReadFileRequest: File not readable: " . $filePath);
         echo json_encode(['error' => 'Няма права за четене на файла.']);
         return;
     }

    // Четем съдържанието на файла
    $content = file_get_contents($filePath);
    if ($content === false) {
        http_response_code(500); // Internal Server Error
         error_log("handleReadFileRequest: Failed to read file content: " . $filePath);
        echo json_encode(['error' => 'Грешка при четене на файла']);
        return;
    }

    // Всичко е ОК, връщаме съдържанието
    http_response_code(200);
    echo json_encode(['content' => $content]);
}
// --- КРАЙ НА ПРОМЯНАТА ---


// --- Функцията handleCreateFileOrUpload (Без Промяна) ---
// Тази функция се използва при регистрация и качване на TXT бекъп
function handleCreateFileOrUpload() {
    $directory = isset($_POST['directory']) ? trim($_POST['directory'], "/") : '';
    $path = UPLOADS_DIR . ($directory ? $directory . '/' : ''); // Конструира пътя с поддиректория

    // Проверка за сигурност '..'
    if (strpos($directory, '..') !== false) {
        http_response_code(400); echo json_encode(['error' => 'Невалиден път.']); return;
    }

    // Опит за създаване на директорията, ако не съществува
    if (!is_dir($path)) {
        error_log("handleCreateFileOrUpload: Directory does not exist: " . $path . ". Attempting to create...");
        // Използваме @ за потискане на стандартния warning, за да върнем наш JSON отговор
        if (!@mkdir($path, 0755, true)) { // 0755 са стандартни права, рекурсивно създаване
             $error = error_get_last();
             error_log("handleCreateFileOrUpload: Failed to create directory: " . $path . ". Error: " . ($error['message'] ?? 'Unknown error'));
             // Проверка дали все пак не е създадена (състезателно състояние)
             if (!is_dir($path)) {
                 http_response_code(500);
                 echo json_encode(['error' => 'Неуспех при създаването на директорията.', 'details' => ($error['message'] ?? 'N/A')]);
                 return;
             }
        } else {
            error_log("handleCreateFileOrUpload: Successfully created directory: " . $path);
        }
    }

    // Проверка дали директорията е записваема СЛЕД опит за създаване
     if (!is_writable($path)) {
         error_log("handleCreateFileOrUpload: Directory is not writable: " . $path);
         http_response_code(500);
         echo json_encode(['error' => 'Целевата директория не е записваема.']);
         return;
     }

    // Обработка на създаване на файл по име и съдържание
    if (isset($_POST['filename']) && !empty($_POST['filename'])) {
        $filename = basename(trim($_POST['filename'])); // Почистване на името

         // Още една проверка за '..' в името на файла
         if (strpos($filename, '..') !== false) {
             http_response_code(400); echo json_encode(['error' => 'Невалидно име на файла.']); return;
         }

        $filePath = $path . '/' . $filename;

        if (file_exists($filePath)) {
            http_response_code(409); // Conflict
            echo json_encode(['error' => 'Файлът вече съществува']);
            return;
        }

        $content = isset($_POST['content']) ? $_POST['content'] : '';

        // Записване на съдържанието във файла
        if (file_put_contents($filePath, $content) === false) {
            http_response_code(500);
            error_log("handleCreateFileOrUpload: Failed to write content to file: " . $filePath);
            echo json_encode(['error' => 'Неуспех при създаване на файла']);
            return;
        }

        http_response_code(201); // Created
        echo json_encode(['message' => 'Файлът е успешно създаден', 'file' => $filename]);
        return;
    }

    // Обработка на качване на файл от <input type="file">
    if (!empty($_FILES) && isset($_FILES['file'])) {
        $file = $_FILES['file'];
        $uploadFilename = basename($file['name']); // Почистване на името

         // Проверка за '..'
         if (strpos($uploadFilename, '..') !== false) {
              http_response_code(400); echo json_encode(['error' => 'Невалидно име на качения файл.']); return;
         }

        $destination = $path . '/' . $uploadFilename;

        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            error_log("handleCreateFileOrUpload: File upload error code: " . $file['error']);
            echo json_encode(['error' => 'Грешка при качването на файла', 'details' => $file['error']]);
            return;
        }

        // Преместване на временния качен файл
        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            http_response_code(500);
            error_log("handleCreateFileOrUpload: Failed to move uploaded file to: " . $destination);
            echo json_encode(['error' => 'Неуспех при преместването на качения файл']);
            return;
        }

        http_response_code(201); // Created
        echo json_encode(['message' => 'Файлът е качен успешно', 'file' => $uploadFilename]);
        return;
    }

    // Ако не е подадено нито име на файл, нито е качен файл
    http_response_code(400);
    echo json_encode(['error' => 'Не е качен файл или липсва име за нов файл']);
}


// --- Функцията handleUpdateFileRequest (Без Промяна) ---
// Тази функция се използва за актуализиране на съществуващ файл
function handleUpdateFileRequest() {
    // Използваме php://input за PUT заявки, които не са application/x-www-form-urlencoded
    // Ако Worker-ът изпраща JSON, трябва да го декодираме
    $inputData = json_decode(file_get_contents("php://input"), true);

    // Ако не е JSON, пробваме да парснем като query string (както беше преди)
    if ($inputData === null && json_last_error() !== JSON_ERROR_NONE) {
         parse_str(file_get_contents("php://input"), $inputData);
    }

    if (!isset($inputData['filename']) || !isset($inputData['content'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Липсват задължителни параметри: filename и content']);
        return;
    }

    // Вземаме директорията от данните, ако е подадена (важно за съвместимост, ако се ползва)
    $directory = isset($inputData['directory']) ? trim($inputData['directory'], "/") : '';
    $filename = basename(trim($inputData['filename'], "/"));

    // Проверки за сигурност
    if (strpos($directory, '..') !== false || strpos($filename, '..') !== false) {
        http_response_code(400); echo json_encode(['error' => 'Невалиден път.']); return;
    }

    $path = UPLOADS_DIR . ($directory ? $directory . '/' : '');
    $filePath = $path . $filename; // UPLOADS_DIR завършва на /

     // Проверка дали сме в рамките на UPLOADS_DIR
     /* // Тази проверка може да е твърде стриктна, ако UPLOADS_DIR е символна връзка
     $realBaseDir = realpath(UPLOADS_DIR);
     $realFilePath = realpath($filePath); // Ще върне false, ако файлът още не съществува
     if ($realBaseDir === false || ($realFilePath !== false && strpos($realFilePath, $realBaseDir) !== 0)) {
         http_response_code(400); echo json_encode(['error' => 'Достъп до файла е отказан.']); return;
     }
     */

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Файлът не съществува за актуализация']);
        return;
    }

     if (!is_writable($filePath)) { // Проверка дали самият файл е записваем
          http_response_code(403);
          error_log("handleUpdateFileRequest: File not writable: " . $filePath);
          echo json_encode(['error' => 'Няма права за запис във файла.']);
          return;
      }

    // Записваме новото съдържание
    if (file_put_contents($filePath, $inputData['content']) === false) {
        http_response_code(500);
        error_log("handleUpdateFileRequest: Failed to update file: " . $filePath);
        echo json_encode(['error' => 'Грешка при актуализиране на файла']);
        return;
    }

    http_response_code(200);
    echo json_encode(['message' => 'Файлът е успешно актуализиран']);
}


// --- Функцията handleDeleteRequest (Без Промяна) ---
// Тази функция се използва за изтриване на файл
function handleDeleteRequest() {
    if (!isset($_GET['filename'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Не е посочен файл за изтриване']);
        return;
    }

    // Вземаме директорията, ако е подадена
    $directory = isset($_GET['directory']) ? trim($_GET['directory'], "/") : '';
    $filename = basename(trim($_GET['filename'], "/"));

     // Проверки за сигурност
    if (strpos($directory, '..') !== false || strpos($filename, '..') !== false) {
        http_response_code(400); echo json_encode(['error' => 'Невалиден път.']); return;
    }

    $path = UPLOADS_DIR . ($directory ? $directory . '/' : '');
    $filePath = $path . $filename; // UPLOADS_DIR завършва на /

     // Проверка дали сме в рамките на UPLOADS_DIR
     /* // Отново, realpath може да е проблемен
     $realBaseDir = realpath(UPLOADS_DIR);
     $realFilePath = realpath($filePath); // Връща false, ако файлът вече е изтрит
     if ($realBaseDir === false || ($realFilePath !== false && strpos($realFilePath, $realBaseDir) !== 0)) {
         http_response_code(400); echo json_encode(['error' => 'Достъп до файла е отказан.']); return;
     }
     */

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Файлът не е намерен за изтриване']);
        return;
    }

    // Опит за изтриване
    if (!unlink($filePath)) {
        http_response_code(500);
         error_log("handleDeleteRequest: Failed to delete file: " . $filePath);
        echo json_encode(['error' => 'Грешка при изтриването на файла']);
        return;
    }

    http_response_code(200);
    echo json_encode(['message' => 'Файлът е изтрит успешно']);
}
?>