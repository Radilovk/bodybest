# BodyBest

A simple static web application for tracking nutrition and workouts.

## Development Setup

1. Install [Node.js](https://nodejs.org/) (version 18 or later).
2. Install dependencies (Jest is included as a dev dependency):

```bash
npm install
```

### Start Development Server

Run the Vite dev server which provides hot reload:

```bash
npm run dev
```

API requests to paths starting with `/api` are automatically proxied to
`https://openapichatbot.radilov-k.workers.dev` when running the dev server.

The application will be available at `http://localhost:5173` by default.

### Build

Create an optimized production build in the `dist` folder:

```bash
npm run build
```

### Lint

Check the source code with ESLint (see `eslint.config.js` for configuration):

```bash
npm run lint
```

### Инсталация на зависимости

Преди да стартирате тестовете, инсталирайте необходимите зависимости, за да бъде
достъпен Jest:

```bash
npm ci # или npm install
```

### Test

Run unit tests with Jest:

```bash
npm test         # изпълнява "scripts/test.sh" и Jest
# или стартирайте директно
npx jest
```
`npm test` автоматично изключва HTTP/HTTPS proxy променливите (както в горен,
така и в долен регистър) и проверява дали е инсталиран Jest. Ако липсва,
скриптът завършва с грешка, вместо да изчаква интерактивен отговор, затова
пуснете `npm ci` или `npm install` преди тестовете.
Ако стартирате `npx jest` директно и се появи предупреждение
"Unknown env config \"http-proxy\"", временно изключете променливите ръчно:

```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy \
  npm_config_http_proxy npm_config_https_proxy
npm config delete proxy
npm config delete https-proxy
```
Предупреждението може напълно да се скрие чрез файла `.npmrc`, който задава
`loglevel=error` и е включен в репозиторито.
Тези стъпки намаляват предупрежденията и потенциално ускоряват старта на
тестовете.

### Отстраняване на проблеми

Ако при стартиране на worker-а или тестовете липсват инсталираните зависимости, изпълнете:

```bash
npm install
```


След успешната инсталация можете отново да стартирате `npm run dev`.

### Generate Documentation

Create API documentation using Typedoc:

```bash
npm run docs
```
The output is placed in the `docs/` folder.

## Deployment to Cloudflare

A GitHub Action workflow at `.github/workflows/deploy.yml` automatically publishes the worker when you push to `main`. It runs `wrangler publish` using the secret `CF_API_TOKEN` for authentication.

To set the token:

1. Generate an API token with **Edit Cloudflare Workers** permissions.
2. In your repository settings, create a GitHub secret named `CF_API_TOKEN` containing the token value.

The worker configuration is stored in `wrangler.toml`. Update `account_id` with your Cloudflare account if needed. For the `USER_METADATA_KV` namespace the file expects the environment variables `USER_METADATA_KV_ID` and `USER_METADATA_KV_PREVIEW_ID`. Configure them as GitHub secrets so the workflow can substitute the correct IDs before publishing. **Важно:** полето `compatibility_date` не може да сочи в бъдещето спрямо датата на деплой. Ако е зададена по-нова дата, Cloudflare ще откаже публикуването. Затова поддържайте стойност, която е днес или по-стара. Например:

```toml
compatibility_date = "2025-06-20"
```
Препоръчително е периодично (например веднъж годишно) да обновявате тази дата до последна валидна стойност, за да се възползва worker-ът от новите възможности на Cloudflare.

Пример за промяна в `wrangler.toml`:

```toml
compatibility_date = "2026-01-15"
```
You can verify this setup locally by running:

```bash
node scripts/validate-wrangler.js
```
This script checks for placeholder values and for a provided `CF_API_TOKEN`.


### Работа с KV

Можете да управлявате съдържанието на KV директно през `wrangler`:

```bash
wrangler kv key put <ключ> "<стойност>" --binding=RESOURCES_KV
wrangler kv key get <ключ> --binding=RESOURCES_KV
wrangler kv key delete <ключ> --binding=RESOURCES_KV
```

> За работа с тези команди трябва да имате зададен `CF_API_TOKEN` или да сте изпълнили `wrangler login`.

Заменете `RESOURCES_KV` с `USER_METADATA_KV` при нужда. В директорията `scripts` има примерен Node скрипт `manage-kv.js`, който изпълнява същите операции:

```bash
node scripts/manage-kv.js put exampleKey "примерна стойност"
node scripts/manage-kv.js get exampleKey
node scripts/manage-kv.js delete exampleKey
```

За поправяне на запис от дневника, който съдържа невалиден JSON, може да
използвате помощния скрипт `repair-log.js`:

```bash
node scripts/repair-log.js <userId> <YYYY-MM-DD>
```

Скриптът изтегля стойността от `USER_METADATA_KV`, опитва да я поправи с помощта
на `jsonrepair` и я записва обратно, ако корекцията е успешна.

### Задължителни ключове в `RESOURCES_KV`

Следните ключове трябва да са налични в KV пространството `RESOURCES_KV`, за да
работи правилно Cloudflare worker-ът. Стойностите им могат да се качат чрез
`wrangler kv key put`.

| Ключ | Предназначение |
|------|----------------|
| `allowed_meal_combinations` | JSON със списък на позволените комбинации от хранения |
| `base_diet_model` | Описание на базовия диетичен модел |
| `eating_psychology` | Текстове с психологически насоки при хранене |
| `model_adaptive_quiz` | Име на модела за генериране на адаптивни въпросници |
| `model_adaptive_quiz_analysis` | Модел за анализ на отговорите от адаптивен въпросник |
| `model_chat` | Модел за чат асистента |
| `model_plan_generation` | Модел за първоначално генериране на план |
| `model_principle_adjustment` | Модел за корекция на принципите |
| `prompt_adaptive_quiz_generation` | Шаблон за създаване на адаптивен въпросник |
| `prompt_analytics_textual_summary` | Шаблон за текстов анализ на прогреса |
| `prompt_analyze_quiz_and_suggest_changes` | Шаблон за анализ на отговорите и предложения за промяна |
| `prompt_chat` | Шаблон за чат промптове |
| `prompt_praise_generation` | Шаблон за генериране на похвали |
| `prompt_principle_adjustment` | Шаблон за промпт при корекция на принципи |
| `prompt_unified_plan_generation_v2` | Шаблон за унифицирано генериране на план |
| `question_definitions` | JSON с дефиниции на всички въпроси |
| `recipe_data` | Данни за примерни рецепти |

Примерни команди за добавяне на стойности:

```bash
# качване на шаблон за чат
wrangler kv key put prompt_chat "$(cat templates/prompt_chat.txt)" --binding=RESOURCES_KV
# качване на рецепти
wrangler kv key put recipe_data "$(cat data/recipes.json)" --binding=RESOURCES_KV
```

### Required Worker Secrets

Before deploying, configure the following secrets in Cloudflare (via the dashboard or `wrangler secret put`):

- `GEMINI_API_KEY`
- `тут_ваш_php_api_url_secret_name`
- `тут_ваш_php_api_token_secret_name`
- `CF_AI_TOKEN` – API token used for Cloudflare AI requests

Optionally set `CF_ACCOUNT_ID` via `wrangler secret put` if it differs from the value in `wrangler.toml`. Ако липсва, работникът използва стойността от `wrangler.toml`.

These names are referenced in `worker.js` and must exist for the worker to function.

### PHP API Environment Variables

The PHP helper scripts expect the following variables set in the server environment:

- `STATIC_TOKEN` – shared secret token used for authentication in `file_manager_api.php`.
- `CF_API_TOKEN` – token used by `save-questions.php` to update the Cloudflare KV store.

The admin panel по подразбиране използва фиксирани данни за вход – потребителско име `admin` и парола `6131`.
Ако е зададенa променлива `ADMIN_PASS_HASH`, паролата се проверява по нейния bcrypt хеш. Празни стойности на `ADMIN_PASS_HASH` или `ADMIN_USERNAME` се игнорират и се използват стандартните данни.
Може да се зададе и `ADMIN_USERNAME` за друго потребителско име.
Интерфейсът на страницата за вход позволява показване на паролата и опция
"Запомни ме", която съхранява потребителското име в `localStorage`.
Ако `login.php` липсва (напр. при статичен хостинг), скриптът в `login.html`
ще валидира локално стандартните данни и ще запази сесията в `localStorage`.
Файлът `logout.html` изчиства съхранената сесия и пренасочва обратно към
екрана за вход.
Пример за генериране на хеш:

```bash
php -r "echo password_hash('yourPassword', PASSWORD_DEFAULT);"
```

### Конфигуриране на AI модели

Администраторският панел включва секция **AI конфигурация**,
която позволява обновяване единствено на имената на използваните модели.
API токените се задават като Worker secrets в Cloudflare и
не се виждат в самия панел.

1. Влезте в `admin.html` с администраторски акаунт.
2. Придвижете се до секцията „AI конфигурация“.
3. Попълнете полетата за `Model` за генериране на план,
   за чат и за модификация на план.
4. Натиснете **Запази** – данните се изпращат към `/api/setAiConfig`.
   При зареждане на страницата текущите стойности се четат чрез `/api/getAiConfig`.
5. Ако работникът е конфигуриран със секрет `WORKER_ADMIN_TOKEN`,
   заявките към `/api/setAiConfig` трябва да съдържат HTTP заглавка
   `Authorization: Bearer <токен>`.

> **Важно**: Токените не се съхраняват в KV. Настройте ги като Worker secrets
> за по-висока сигурност.

### Chat Assistant

The standalone page `assistant.html` allows you to send direct commands to the worker.
Open the file in a browser, enter your message and it will call the `/api/chat` endpoint.
The Cloudflare account ID is filled automatically from `config.js`.

Example test request with `curl`:

```bash
curl https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/ai/run/@cf/meta/llama-2-7b-chat-fp16 \
  -H "Authorization: Bearer <CF_AI_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"messages":[{"role":"user","content":"Здравей"}]}'
```

Replace the placeholders with your own values and keep the token secret.
## Допълнителни функции
- **Извънредно хранене** – бутонът "Добави извънредно хранене" в `code.html` отваря модалната форма `extra-meal-entry-form.html`. Логиката в `js/extraMealForm.js` изпраща данните към `/api/log-extra-meal` в `worker.js`.
- **Изследвания** – POST заявки към `/api/uploadTestResult` и `/api/uploadIrisDiag` записват данни за проведени тестове или ирисова диагностика в KV и създават събитие за автоматична адаптация на плана.
- **Промяна на план** – когато в чата се открие заявка за модификация, в KV се записва ключ `event_planMod_<userId>`. Планираната Cron задача извиква `processPendingUserEvents`, който обработва тези събития и стартира ново генериране на плана.
- **AI помощник** – POST заявка към `/api/aiHelper` изпраща последните логове на потребителя към модела `@cf/meta/llama-3-8b-instruct` в Cloudflare AI и връща текстово обобщение.
- **Генериране на похвала** – логиката съхранява моментна снимка на анализите в ключ `<userId>_last_praise_analytics` и добавя ново постижение само когато напредъкът превишава евентуално влошаване, а ИТМ остава в здравословни граници.
- **Нови съобщения/обратна връзка** – в заглавието на администраторския панел се показва червена точка, когато има непотвърдени запитвания или нова обратна връзка. Проверява се автоматично през минута чрез `/api/peekAdminQueries` и `/api/getFeedbackMessages`.

Ендпойнтът `/api/peekAdminQueries` връща списък с неприключени запитвания, без да ги маркира като прочетени. Използва се основно за показване на индикатора, докато `/api/getAdminQueries` обновява флага `read` при зареждане на данните.

### Нови API ендпойнти

- `POST /api/acknowledgeAiUpdate` – маркира резюмето от AI като прочетено.
- `GET /api/getPlanModificationPrompt` – връща шаблона и модела за промяна на плана.
- `GET /api/getAchievements` – връща списък с получените постижения.
- `POST /api/generatePraise` – създава мотивационно съобщение.
- `POST /api/recordFeedbackChat` – отбелязва, че автоматичният чат е разгледан.
- `POST /api/submitFeedback` – изпраща обратна връзка от клиента.
- `GET /api/getAiConfig` – зарежда текущата AI конфигурация.
- `POST /api/setAiConfig` – записва имената на моделите в `RESOURCES_KV`.
- **Дебъг логове** – при изпращане на заглавие `X-Debug: 1` към който и да е API
ендпойнт, worker-ът записва в конзолата кратка информация за заявката.

### Промяна на плана

Процесът за актуализиране на хранителния план вече протича в два последователни етапа:

1. Натиснете бутона **Въведи промени** в секцията „Инструменти за Индивидуализация" на страницата `code.html`. Ще се отвори модален прозорец *Промяна на план*.
2. В полето за чат опишете желаните корекции и натиснете **Изпрати**. След потвърждение от асистента започва генериране на нов план. Докато процесът тече, до бутона се показва въртяща се иконка. Когато новият план е готов, съдържанието на таблото се обновява автоматично.
   Съобщенията от този модален чат включват параметър `source: 'planModChat'` към `/api/chat`. Worker-ът създава събитие за модификация само когато получи този флаг, така че стандартният чат не стартира процеса.

Можете да повторите стъпка&nbsp;1 по всяко време при нужда от нови промени.

- **Пример за запис в KV**

  ```json
  {
    "type": "testResult",
    "userId": "u1",
    "status": "pending",
    "createdTimestamp": 1710000000000,
    "payload": { ... }
  }
  ```

  Полето `status` обозначава текущия етап на обработка (напр. `pending`, `done`),
  а `createdTimestamp` съдържа UNIX време на създаване в милисекунди.

## Cron configuration

Cloudflare позволява изпълнение на работници по зададен график.
За да създадете Cron trigger:

1. Отворете **Workers & Pages** в Cloudflare dashboard и изберете своя worker.
2. В раздел **Triggers** → **Cron Triggers** натиснете **Add Cron Trigger**.
3. Въведете израз като `0 */1 * * *`, който ще задейства работника на всеки час.

При активиране на Cron тригера Cloudflare извиква `scheduled` хендлъра в `worker.js`,
което позволява автоматично обновяване на плановете.

Без активен Cron тригер събитията за промяна на плана остават необработени.
За да стартирате автоматично обновяване на плановете, добавете Cron израз
`*/15 * * * *` в Cloudflare Workers.

Можете да опишете графика и директно във `wrangler.toml`:

```toml
[triggers]
crons = ["0 */1 * * *"]
```

Файлът `wrangler.toml` се използва от GitHub Actions и от `wrangler publish`,
затова добавеният блок ще приложи същия график и при автоматичното публикуване.

## License

This project is licensed under the ISC license. See [LICENSE](LICENSE).
