# Manual Testing Guide: Persistent Login Feature

## Цел
Тази функционалност позволява на потребителя да остане логнат в системата след затваряне на браузъра, когато е избрал опцията "Запомни ме".

## Предварителни изисквания
- PHP сървър (за локално тестване използвайте `php -S localhost:8000`)
- Браузър с Dev Tools за проверка на cookies

## Тест Сценарий 1: Вход БЕЗ "Запомни ме"

### Стъпки:
1. Отворете `login.html` в браузър
2. Въведете валидни credentials (username: `admin`, password: `6131`)
3. **НЕ** чекирайте "Запомни ме" checkbox
4. Натиснете "Влез"
5. Проверете че сте пренасочени към `admin.html`
6. Отворете Dev Tools → Application/Storage → Cookies
7. Проверете PHPSESSID cookie - трябва да няма expiration date (Session cookie)
8. Затворете браузъра напълно
9. Отворете браузъра отново и идете на `admin.html`

### Очакван резултат:
- След рестартиране на браузъра, потребителят НЕ е логнат
- Автоматично пренасочване към `login.html`
- PHPSESSID cookie е изчистен

## Тест Сценарий 2: Вход С "Запомни ме"

### Стъпки:
1. Отворете `login.html` в браузър
2. Въведете валидни credentials (username: `admin`, password: `6131`)
3. **ЧЕКИРАЙТЕ** "Запомни ме" checkbox
4. Натиснете "Влез"
5. Проверете че сте пренасочени към `admin.html`
6. Отворете Dev Tools → Application/Storage → Cookies
7. Проверете PHPSESSID cookie - трябва да има expiration date ~30 дни в бъдещето
8. Затворете браузъра напълно
9. Отворете браузъра отново и идете на `admin.html`

### Очакван резултат:
- След рестартиране на браузъра, потребителят ОСТАВА логнат
- `admin.html` се зарежда нормално без redirect
- PHPSESSID cookie е все още валиден
- localStorage флаг `adminSession` е все още `'true'`

## Тест Сценарий 3: Logout след "Запомни ме"

### Стъпки:
1. Влезте с "Запомни ме" чекиран (следвайте Сценарий 2, стъпки 1-5)
2. Натиснете бутон "Изход" или отворете `logout.html`
3. Проверете че сте пренасочени към `login.html`
4. Проверете localStorage - `adminSession` флаг трябва да е изчистен
5. Опитайте да отворите `admin.html` директно

### Очакван резултат:
- След logout, потребителят НЕ е логнат
- Сесията е унищожена
- Автоматично пренасочване към `login.html` при опит за достъп до `admin.html`

## Тест Сценарий 4: Запазване на username без "Запомни ме"

### Стъпки:
1. Отворете `login.html`
2. Въведете username `admin`
3. НЕ чекирайте "Запомни ме"
4. Влезте в системата
5. Излезте (logout)
6. Отворете `login.html` отново

### Очакван резултат:
- Username полето е празно (функцията "Запомни ме" не е активирана)

## Проверка на PHP Session Settings

За да проверите дали PHP session settings са правилно конфигурирани при "Запомни ме":

```php
// Добавете временно в login.php след успешен login:
error_log("Session cookie lifetime: " . ini_get('session.cookie_lifetime'));
error_log("Session GC max lifetime: " . ini_get('session.gc_maxlifetime'));
```

### Очаквани стойности:
- **Без "Запомни ме"**: 
  - `session.cookie_lifetime` = 0 (default - session cookie)
  - `session.gc_maxlifetime` = 1440 (default - 24 minutes)

- **С "Запомни ме"**:
  - `session.cookie_lifetime` = 2592000 (30 дни)
  - `session.gc_maxlifetime` = 2592000 (30 дни)

## Известни Ограничения

1. PHP session garbage collection може да изчисти сесиите преди изтичане на 30-дневния период, ако сървърът е конфигуриран с по-кратък `gc_maxlifetime` default
2. При споделен hosting, може да е необходима специална конфигурация
3. HTTPS е препоръчително за production за security на cookies

## Технически Детайли

### Промени в кода:
- `login.php`: Добавена логика за persistent sessions
- `login.html`: Добавено изпращане на `rememberMe` параметър

### Session lifetime:
- Default (без "Запомни ме"): Session expires on browser close
- С "Запомни ме": 30 дни (2,592,000 seconds)
