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

Ако при стартиране на worker-а или тестовете видите грешка като:

```text
Uncaught Error: No such module "jsonrepair". imported from "worker.js"
```

липсват инсталираните зависимости. Решението е да изпълните:

```bash
npm install
```

След успешната инсталация можете отново да стартирате `npm run dev` или
`npx wrangler publish`.

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

The worker configuration is stored in `wrangler.toml`. Update `account_id` with your Cloudflare account if needed. For the `USER_METADATA_KV` namespace the file expects the environment variables `USER_METADATA_KV_ID` and `USER_METADATA_KV_PREVIEW_ID`. Configure them as GitHub secrets so the workflow can substitute the correct IDs before publishing.
You can verify this setup locally by running:

```bash
node scripts/validate-wrangler.js
```
This script checks for placeholder values and for a provided `CF_API_TOKEN`.

### Manual publish

For manual deployment run:

```bash
npx wrangler publish
```

This will upload the worker using the settings from `wrangler.toml`.

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
- `ADMIN_PASS_HASH` – bcrypt hash of the admin password for `login.php`.
- `CF_API_TOKEN` – token used by `save-questions.php` to update the Cloudflare KV store.

Example of generating a hash:

```bash
php -r "echo password_hash('yourPassword', PASSWORD_DEFAULT);"
```

Set the output as the value for `ADMIN_PASS_HASH`.
## Допълнителни функции
- **Извънредно хранене** – бутонът "Добави извънредно хранене" в `code.html` отваря модалната форма `extra-meal-entry-form.html`. Логиката в `js/extraMealForm.js` изпраща данните към `/api/log-extra-meal` в `worker.js`.
- **Изследвания** – POST заявки към `/api/uploadTestResult` и `/api/uploadIrisDiag` записват данни за проведени тестове или ирисова диагностика в KV и създават събитие за автоматична адаптация на плана.
- **Промяна на план** – когато в чата се открие заявка за модификация, в KV се записва ключ `event_planMod_<userId>`. Планираната Cron задача извиква `processPendingUserEvents`, който обработва тези събития и стартира ново генериране на плана.
- **AI помощник** – POST заявка към `/api/aiHelper` изпраща последните логове на потребителя към модела `@cf/meta/llama-3-8b-instruct` в Cloudflare AI и връща текстово обобщение.

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

Можете да опишете графика и директно във `wrangler.toml`:

```toml
[triggers]
crons = ["0 */1 * * *"]
```

Файлът `wrangler.toml` се използва от GitHub Actions и от `wrangler publish`,
затова добавеният блок ще приложи същия график и при автоматичното публикуване.

## License

This project is licensed under the ISC license. See [LICENSE](LICENSE).
