# Настройки на имейл акаунта в cPanel

## Обобщение на промените

Имейл адресът е сменен от `info@mybody.best` на `info@onebody.top`.

## Стъпки за настройка в cPanel

### 1. Създаване на имейл акаунт (ако още не съществува)

1. Влезте в cPanel на хостинга
2. Отидете на **Email Accounts** (Имейл акаунти)
3. Кликнете на **Create** (Създай)
4. Въведете:
   - **Email:** `info`
   - **Domain:** `onebody.top`
   - **Password:** използвайте съществуващата парола (Legion69.#)
5. Кликнете **Create Account**

### 2. Проверка на SMTP настройките

Уверете се, че следните SMTP настройки са активни за домейна:

| Параметър | Стойност |
|-----------|----------|
| SMTP Host | `onebody.top` |
| SMTP Port | `465` (SSL/TLS) или `587` (STARTTLS) |
| Encryption | SSL/TLS (SMTPS) |
| Username | `info@onebody.top` |
| Password | Същата парола (Legion69.#) |

### 3. Проверка на DNS записите

В секцията **Zone Editor** или **DNS Settings** проверете наличието на:

- **MX запис:** Трябва да сочи към mail сървъра на хостинга
- **SPF запис:** `v=spf1 +a +mx +ip4:[IP на сървъра] ~all`
- **DKIM запис:** Генерирайте от cPanel → Email Deliverability
- **DMARC запис:** `_dmarc.onebody.top` TXT `v=DMARC1; p=none;`

### 4. Качване на актуализираните файлове

Качете следните файлове на сървъра чрез File Manager или FTP:

```
mail/
├── mail.php          # Актуализиран - основен файл за изпращане на имейли
├── PHPMailer.php     # Без промени
├── SMTP.php          # Без промени
├── Exception.php     # Без промени
└── htaccess          # Без промени
```

### 5. Тестване на имейл функционалността

1. Отворете `mail/mail.html` в браузъра
2. Въведете тестов имейл адрес, тема и съобщение
3. Изпратете тестов имейл
4. Проверете дали имейлът е получен успешно

### 6. Отстраняване на проблеми

Ако имейлите не се изпращат:

1. Проверете `mail/debug_error.txt` за грешки
2. Проверете `mail/debug_data.txt` за входните данни
3. Уверете се, че PHP mail функцията е разрешена на сървъра
4. Проверете firewall настройките за порт 465

### 7. Сигурност

**ВАЖНО:** Файлът `mail/mail.php` съдържа паролата в открит вид. Препоръчително е:

1. Да се използват environment variables за паролата
2. Да се ограничи достъпът до `mail/` директорията чрез `.htaccess`
3. Да се използва HTTPS за всички заявки

## Контактна информация

- **Нов имейл:** info@onebody.top
- **Стар имейл:** info@mybody.best (вече не се използва)

## Променени файлове

Следните файлове бяха актуализирани с новия домейн:

- `mail/mail.php` - SMTP настройки
- `docs/mail.php` - fallback имейл настройки
- `docs/mail_smtp.php` - SMTP конфигурация
- `sendEmailWorker.js` - Cloudflare Worker настройки
- `worker.js` - CORS allowed origins
- HTML файлове с контактна информация (index.html, contact.html, about.html, blog.html, faq.html, privacy.html, terms.html)
