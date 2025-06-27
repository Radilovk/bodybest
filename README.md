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
### Registration Module Example

Include the common registration logic by importing `setupRegistration`:

```html
<script type="module">
  import { setupRegistration } from "./js/register.js";
  setupRegistration("#register-form", "#register-message");
</script>
```


### Отстраняване на проблеми

Ако при стартиране на worker-а или тестовете липсват инсталираните зависимости, изпълнете:

```bash
npm install
```

If you see an error such as **"Cannot find module './mailer.js'"**, most often it
means the Node dependencies haven't been installed. Run `npm install` and then
try again. Recent versions of the worker rely on the `MAILER_ENDPOINT_URL`
environment variable instead of dynamic imports. If this variable is missing, the
worker attempts to send messages directly through MailChannels using the
`FROM_EMAIL` address. A **500** error from `/api/sendTestEmail` usually indicates
a failure from MailChannels or your external mailer service. Inspect the worker
logs for details.


След успешната инсталация можете отново да стартирате `npm run dev`.

If the error persists, be sure to run TypeScript with this configuration:

```bash
npx tsc --project tsconfig.json
# or
npx ts-node --project tsconfig.json worker.js
```

#### Troubleshooting Cloudflare AI

- Run `wrangler secret list` and confirm `CF_AI_TOKEN` is listed.
- Ensure the token has **Workers AI: Run** permission.
- Check that `model_image_analysis` points to a valid model:

```bash
wrangler kv key get model_image_analysis --binding=RESOURCES_KV
```

Example errors:

```
HTTP 403 permission missing: Workers AI: Run
HTTP 404 account not found or not authorized to access account
```

##### Verify the base64 string

You can confirm the input is a valid image by decoding the base64 data locally:

```bash
echo "<BASE64>" | base64 --decode > test.jpg
file test.jpg
```

The `file` output should recognize an image format like JPEG or PNG.  
Cloudflare returns `Tensor error: failed to decode u8` when the data isn't a valid image.

### Generate Documentation

Create API documentation using Typedoc:

```bash
npm run docs
```
The output is placed in the `docs/` folder.

Type-check the source with:

```bash
npx tsc --noEmit
```

### Template Loading

Client pages sometimes fetch HTML snippets at runtime. Templates such as
`profileTemplate.html` and `extra-meal-entry-form.html` must reside in the same
origin as the application. The helper `loadTemplateInto(url, containerId)`
rejects cross-origin URLs and sanitizes the response before inserting it into
the page.

## Deployment to Cloudflare

A GitHub Action workflow at `.github/workflows/deploy.yml` automatically deploys the worker when you push to `main` or open a pull request. It runs `wrangler deploy` using the secret `CF_API_TOKEN` for authentication. Pull requests from forks cannot access the secrets, so those builds will skip deployment.

To set the token:

1. Generate an API token with **Edit Cloudflare Workers** permissions.
2. In your repository settings, create a GitHub secret named `CF_API_TOKEN` containing the token value.

The worker configuration is stored in `wrangler.toml`. Update `account_id` with your Cloudflare account if needed. For the `USER_METADATA_KV` namespace the file expects the environment variables `USER_METADATA_KV_ID` and `USER_METADATA_KV_PREVIEW_ID`. Configure them as GitHub secrets so the workflow can substitute the correct IDs before deployment. **Важно:** полето `compatibility_date` не може да сочи в бъдещето спрямо датата на деплой. Ако е зададена по-нова дата, Cloudflare ще откаже деплойването. Затова поддържайте стойност, която е днес или по-стара. Например:

For email notifications you may set `MAILER_ENDPOINT_URL` to point to a standalone worker or service that performs the delivery. If the variable is omitted, the main worker still sends emails directly via MailChannels using the `FROM_EMAIL` address.

```toml
compatibility_date = "2025-06-20"
```
Препоръчително е периодично (например веднъж годишно) да обновявате тази дата до последна валидна стойност, за да се възползва worker-ът от новите възможности на Cloudflare.
В workflow-а има стъпка `update-compat-date`, която автоматично я коригира, ако е зададена по-нова от днешната.

Пример за промяна в `wrangler.toml`:

```toml
compatibility_date = "2026-01-15"
```
You can verify this setup locally by running:

```bash
node scripts/validate-wrangler.js
```
This script checks for placeholder values and for a provided `CF_API_TOKEN`.

### Worker Scripts

The repository contains two Cloudflare workers.

- `worker.js` – the main application worker defined in `wrangler.toml`. The GitHub workflow deploys this worker automatically.
- `worker-backend.js` – a lightweight proxy used by the PHP backend to call Cloudflare AI. Deploy it separately, for example:

```bash
wrangler deploy worker-backend.js --name bodybest-backend
```

Bind the `SETTINGS` KV namespace and provide `CF_AI_TOKEN`, `CF_ACCOUNT_ID` and model variables as secrets.


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

За преглед на логовете от администраторските операции използвайте `view-usage-logs.js`:

```bash
node scripts/view-usage-logs.js sendTestEmail 5
```

Скриптът показва последните N записа за зададения тип (`sendTestEmail` или `analyzeImage`).

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
| `model_image_analysis` | Модел за анализ на изображения |
| `prompt_image_analysis` | Шаблон за промпт при анализ на изображение |
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
- `OPENAI_API_KEY` – set via `wrangler secret put OPENAI_API_KEY`, used by `worker.js`
- `FROM_EMAIL` – optional sender address for outgoing emails

Без тази стойност част от AI функционалностите няма да работят.

Optionally set `CF_ACCOUNT_ID` via `wrangler secret put` if it differs from the value in `wrangler.toml`. Ако липсва, работникът използва стойността от `wrangler.toml`.

These names are referenced in `worker.js` and must exist for the worker to function.

### Allowed Origins

The worker and PHP scripts support a custom list of allowed origins for CORS via the
`ALLOWED_ORIGINS` environment variable. Provide a comma-separated list of
domains from which the application (for example the admin panel) will be
loaded. If the variable is not set, the default list includes
`https://radilovk.github.io`, `https://radilov-k.github.io`,
`http://localhost:5173`, `http://localhost:3000` and `null`.

Add the variable in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://admin.example.com,https://myapp.example.com"
```

This list is combined with the defaults when building the CORS headers.

### PHP API Environment Variables

The PHP helper scripts expect the following variables set in the server environment:

- `STATIC_TOKEN` – shared secret token used for authentication in `file_manager_api.php`.
- `CF_API_TOKEN` – token used by `save-questions.php` to update the Cloudflare KV store.
- `ALLOWED_ORIGINS` – optional comma-separated list of origins allowed to
  access the PHP scripts and `worker-backend.js`. Defaults match the worker
  configuration when not provided.

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
която позволява бързо обновяване на използваните AI модели.

1. Влезте в `admin.html` с администраторски акаунт.
2. Придвижете се до секцията „AI конфигурация“.
3. В отделните секции можете да задавате освен името на `Model`
   и съответните `Prompt`, `Token limit` и `Temperature` стойности.
   За анализа на изображения има задължително поле *Prompt*,
   което ботът използва като основен текст.
   Полетата за токени и температура показват динамични подсказки
   според въведения модел.
4. Натиснете **Запази** – данните се изпращат към `/api/setAiConfig`.
   При зареждане на страницата същите стойности се четат чрез `/api/getAiConfig`.
5. Ако работникът е конфигуриран със секрет `WORKER_ADMIN_TOKEN`,
   заявките към `/api/setAiConfig` трябва да съдържат HTTP заглавка
   `Authorization: Bearer <токен>`. Когато секретът липсва,
   проверка не се извършва – полезно за локална разработка.
6. Можете да запазвате и зареждате комбинации от модели като "пресети".
   Списъкът се зарежда чрез `/api/listAiPresets`, конкретен пресет – чрез
   `/api/getAiPreset`, а нов пресет се създава с POST заявка към
   `/api/saveAiPreset`. Валидирането на токена при този ендпойнт
   също се пропуска, ако няма зададен секрет.
7. До всяко поле за модел има бутон **Тествай**. С него се изпраща кратка заявка
   към `/api/testAiModel`, която проверява връзката с избрания AI модел и
   показва грешка при проблем с комуникацията.

   Пример: за да използвате Cloudflare LLaVA за анализ на изображения,
   въведете `@cf/llava-hf/llava-v1.6b` в полето *Model Image Analysis*.
   Това записва стойността като KV ключ `model_image_analysis` и позволява
   използването на LLaVA при заявки към `/api/analyzeImage`.

   Същото може да се зададе и през CLI:

   ```bash
wrangler kv key put model_image_analysis "@cf/llava-hf/llava-v1.6b" --binding=RESOURCES_KV
```

> **Note**: Всички Cloudflare AI модели за анализ на изображения приемат JSON с
> полета `prompt` и `image` (data URL) вместо `messages`.
> Пример за директно извикване през `env.AI.run`:

```javascript
const result = await env.AI.run('@cf/llava-hf/llava-v1.6b', {
  prompt: 'Опиши какво виждаш',
  image: `data:image/png;base64,${base64}`
});
```

Кратък пример с `fetch` към Cloudflare AI:

```javascript
await fetch(CF_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${CF_AI_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Опиши какво виждаш',
    image: `data:image/png;base64,${base64}`
  })
});
```

По същия начин може да подадете изображение към всеки Cloudflare AI модел
чрез JSON обект от вида:

```json
{
  "image": "data:image/jpeg;base64,<BASE64>",
  "prompt": "INPUT PROMPT"
}
```

Администраторският скрипт `admin.js` добавя автоматично тази
заглавка, ако в `sessionStorage` съществува ключ `adminToken`.
Стойността може да зададете от панела в полето „Admin Token“,
което я записва в `sessionStorage`. Може и ръчно да я зададете през конзолата:

```javascript
sessionStorage.setItem('adminToken', '<вашият токен>');
```

Токените за моделите вече се задават единствено като *worker secrets*.
Панелът не записва ключове в KV и отговаря само за имената на моделите.
Самият `WORKER_ADMIN_TOKEN` също не може да се редактира през панела –
необходимо е да го зададете като *worker secret* преди деплой.

### Chat Assistant

The standalone page `assistant.html` allows you to send direct commands to the worker.
Open the file in a browser, enter your message and it will call the `/api/chat` endpoint.
The Cloudflare account ID is filled automatically from `config.js`.
Use the small image button next to the send icon to upload a picture. The file is sent to `/api/analyzeImage` and the analysis appears as a bot reply.
The admin panel (`admin.html`) also provides a **Test Image Analysis** form that sends a selected picture to `/api/analyzeImage` and shows the JSON response.

Some models require a short license confirmation before you can send other messages. Start the conversation with:

```json
{
  "messages": [
    { "role": "user", "content": "agree" }
  ]
}
```

After this step you can send regular prompts and images to the model.

For multi-modal requests combining an image with text, use the following
structure:

```json
{
  "messages": [
    { "role": "user", "content": "agree" },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": { "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..." }
        },
        {
          "type": "text",
          "text": "Опиши подробно какво има на изображението. Ако има медицински детайли, анализирай ги."
        }
      ]
    }
  ]
}
```


Example test request with `curl`:

```bash
curl https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/ai/run/@cf/meta/llama-3.2-11b-instruct \
  -H "Authorization: Bearer <CF_AI_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"messages":[{"role":"user","content":"Здравей"}]}'
```

Replace the placeholders with your own values and keep the token secret.

In addition to text messages you can upload an image for automatic analysis.
Open `assistant.html`, choose a file and it will be converted to a full data URL
and sent to `/api/analyzeImage` as JSON with fields `userId`, `image` and an
optional `prompt` describing what you want to see. Malformed Base64 will return
"Невалиден Base64 стринг.". You can convert a file in the browser using
FileReader:
```javascript
const reader = new FileReader();
reader.onload = () => send({image: reader.result});
reader.readAsDataURL(file);
```
You can also generate a Base64 string via shell:
```bash
base64 -w0 image.jpg > base64.txt
```
The worker forwards the image data together with your text prompt to the
configured vision model and returns a JSON summary describing the detected
objects or text. По подразбиране ендпойнтът е отворен и не изисква `WORKER_ADMIN_TOKEN`.

Example `curl` request sending both image and text:

```bash
curl -X POST https://<your-domain>/api/analyzeImage \
  -H "Content-Type: application/json" \
  --data '{"userId":"123","image":"data:image/jpeg;base64,<base64>","prompt":"Намери текст"}'
```
The worker also accepts a `data:` URL directly:
```bash
curl -X POST https://<your-domain>/api/analyzeImage \
  -H "Content-Type: application/json" \
  --data '{"userId":"123","image":"data:image/png;base64,<base64>","prompt":"Опиши"}'
```
Add the `Authorization` header only ако сте активирали защита с `WORKER_ADMIN_TOKEN`.

For Cloudflare models set `CF_AI_TOKEN`. When using Gemini Vision provide
`GEMINI_API_KEY`. Without these secrets the endpoint will respond with an error.

Example with the Cloudflare LLaVA model (KV key `model_image_analysis=@cf/llava-hf/llava-v1.6b`):

```bash
curl -X POST https://<your-domain>/api/analyzeImage \
  -H "Content-Type: application/json" \
  --data '{"userId":"123","image":"data:image/png;base64,<base64>","prompt":"Опиши подробно"}'
```
Добавете `Authorization` заглавка само при активен `WORKER_ADMIN_TOKEN`.

### Промяна на началното съобщение в чата

Текстът, който се показва при първо отваряне на чата, се намира в `js/config.js`
под формата на променлива `initialBotMessage`. Можете да редактирате този файл
или временно да презапишете стойността чрез конзолата:

```javascript
localStorage.setItem('initialBotMessage', 'Добре дошли!');
```

След презареждане на страницата чатът ще използва новото съобщение.
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
- `POST /api/setAiConfig` – записва токени и модели в `RESOURCES_KV`.
- `GET /api/listAiPresets` – връща имената на записаните AI конфигурации.
- `GET /api/getAiPreset` – връща данните за конкретен пресет.
- `POST /api/saveAiPreset` – съхранява нов пресет или обновява съществуващ.
- `POST /api/testAiModel` – проверява връзката с конкретен AI модел.
- `POST /api/analyzeImage` – анализира качено изображение и връща резултат. Изпращайте поле `image` с пълен `data:` URL. Ендпойнтът не изисква `WORKER_ADMIN_TOKEN`, освен ако изрично не сте го добавили като защита.
- `POST /api/sendTestEmail` – изпраща тестов имейл. Изисква администраторски токен.
- `POST /api/sendEmail` – изпраща имейл чрез MailChannels. Приема JSON `{ "to": "user@example.com", "subject": "Тема", "text": "Съобщение" }`.

  ```bash
  curl -X POST https://<your-domain>/api/testAiModel \
    -H "Authorization: Bearer <WORKER_ADMIN_TOKEN>" \
    -H "Content-Type: application/json" \
    --data '{"model":"@cf/meta/llama-3-8b-instruct"}'
  ```

  Възможен е отговор **HTTP 500**, ако името на модела е невалидно или липсват
  необходимите Cloudflare AI секрети. Имената на моделите трябва да са във
  формата `@cf/...` и да съвпадат с наличните модели в Cloudflare.

  ```bash
  curl -X POST https://<your-domain>/api/sendTestEmail \
    -H "Authorization: Bearer <WORKER_ADMIN_TOKEN>" \
    -H "Content-Type: application/json" \
    --data '{"recipient":"user@example.com","subject":"Test","body":"Hello"}'
  ```
  Полетата `recipient`, `subject` и `body` са задължителни. Като алтернатива
  могат да се използват имената `to` и `text`.

  ```bash
  curl -X POST https://<your-domain>/api/sendTestEmail \
    -H "Authorization: Bearer <WORKER_ADMIN_TOKEN>" \
    -H "Content-Type: application/json" \
    --data '{"to":"someone@example.com","subject":"Тест","text":"Здравей"}'
  ```
  Ако `MAILER_ENDPOINT_URL` не е зададен, работникът изпраща имейла директно
  чрез MailChannels, използвайки адреса от `FROM_EMAIL` (по подразбиране
  `info@mybody.best`).
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

## Email Notifications

The worker can send emails in two ways:

1. If `MAILER_ENDPOINT_URL` is set, requests are forwarded to that endpoint
   (for example a standalone worker) which handles the actual delivery.
2. Otherwise the worker sends messages directly via MailChannels using the
   address from `FROM_EMAIL` (defaults to `info@mybody.best`).

In both cases the `/api/sendTestEmail` endpoint behaves the same and returns a
JSON response indicating success or failure.
A status **500** typically means MailChannels or your external service failed and should be investigated via the worker logs.

To enable real emails:

1. Deploy `sendEmailWorker.js` with Wrangler and note the public URL that it
   prints after deployment.
2. Set `MAILER_ENDPOINT_URL=<worker-url>` either in your environment or inside
   `wrangler.toml`.

Example `.env` snippet:

```env
MAILER_ENDPOINT_URL=https://send-email-worker.example.workers.dev
```

Example in `wrangler.toml`:

```toml
[vars]
MAILER_ENDPOINT_URL = "https://send-email-worker.example.workers.dev"
```

For a simple setup deploy `sendEmailWorker.js`, which exposes `/api/sendEmail`
and sends messages via a PHP backend. Point `MAILER_ENDPOINT_URL` to the URL of
this worker so the main service can dispatch emails without relying on Node.js.

The included `mailer.js` relies on `nodemailer` and therefore requires a Node.js
environment. Run it as a separate service or replace it with a script that calls
an external provider such as Cloudflare
[MailChannels](https://developers.cloudflare.com/email-routing/mailchannels/).

### Email Environment Variables

| Variable | Purpose |
|----------|---------|
| `MAILER_ENDPOINT_URL` | Endpoint called by `worker.js` when sending emails. If omitted, the worker sends via MailChannels using `FROM_EMAIL`. |
| `MAIL_PHP_URL` | Endpoint used by `sendEmailWorker.js` to deliver messages. Defaults to `https://mybody.best/mail.php`. Set this to the public URL of the script from [docs/mail.php](docs/mail.php). |
| `EMAIL_PASSWORD` | Password used by `mailer.js` when authenticating with the SMTP server. |
| `WELCOME_EMAIL_SUBJECT` | Optional custom subject for welcome emails sent by `mailer.js`. |
| `WELCOME_EMAIL_BODY` | Optional HTML body template for welcome emails. The string `{{name}}` will be replaced with the recipient's name. |
| `WORKER_URL` | Base URL of the main worker used by `mailer.js` to fetch email templates when no subject or body is provided. |
Примерен PHP скрипт за изпращане на писма е наличен в [docs/mail.php](docs/mail.php). Настройте `MAIL_PHP_URL` да сочи към същия или сходен адрес.

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

Файлът `wrangler.toml` се използва от GitHub Actions и от `wrangler deploy`,
затова добавеният блок ще приложи същия график и при автоматичното деплойване.

## License

This project is licensed under the ISC license. See [LICENSE](LICENSE).
