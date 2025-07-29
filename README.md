# BodyBest

A simple static web application for tracking nutrition and workouts.

## Development Setup

For a quick overview in Bulgarian, see [docs/DEV_GUIDE_BG.md](docs/DEV_GUIDE_BG.md).


1. Install [Node.js](https://nodejs.org/) (version 18 or later).
2. Install dependencies (Jest is included as a dev dependency):

```bash
npm install
```

3. Проверете кода и тестовете:

```bash
npm run lint
npm test
```

### Start Development Server

Run the Vite dev server which provides hot reload:

```bash
npm run dev
```

API requests to paths starting with `/api` are automatically proxied to
`https://openapichatbot.radilov-k.workers.dev` when running the dev server.

The application will be available at `http://localhost:5173` by default.

### Мобилна навигация

Менюто вече превърта страницата до горе при отваряне и се показва над заглавката благодарение на `z-index: 1100`. Уверете се, че всяка страница зарежда `script.js` или `js/basicNav.js`.

### Динамична тема

Интерфейсът следва системната светла/тъмна настройка. Ако в LocalStorage е избрана опцията "system", промяната на темата в операционната система се отразява моментално.

### Цветови теми
Цветовете на потребителския интерфейс са описани в `js/themeConfig.js` и са групирани по категории. При първоначално зареждане админ панелът записва два шаблона "Light" и "Dark" в `localStorage.colorThemes` с стойности от `css/base_styles.css`. Освен тях е наличен и по-яркият шаблон `Vivid`.
В секцията "Настройки на цветове" можете да:

1. Променяте цветовете по групи и да преглеждате резултата чрез бутона **Прегледай**.
2. Записвате и зареждате шаблони от падащото меню.
3. Експортирате текущата тема като JSON файл или да импортирате вече съществуващ.

Така настройките засягат само публичната част на сайта и са по-лесни за управление.

#### Персонализация за потребители
В `personalization.html` цветoвите настройки са разделени по табове – Dashboard,
Index и Quest. Всеки таб съдържа полета от съответната група от `themeConfig.js`.
Промените се съхраняват отделно в `localStorage.dashboardColorThemes`,
`localStorage.indexColorThemes` и `localStorage.questColorThemes`. При зареждане
на всяка страница избраните стойности се прилагат автоматично.
Ако сте администратор, можете да използвате бутона **„Запази глобално“** след
тест, за да изпратите избраните стойности към сървъра.
Налични са и допълнителни полета за прозрачност и градиенти.

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

### Type Check

Make sure dependencies are installed (`npm ci` or `npm install`) before running the TypeScript compiler in check mode:

```bash
npx tsc --noEmit
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
npm test         # стартира Jest тестовете
# или наблюдавайте само променените файлове
npm run test:watch
# или стартирайте директно
npx jest
# или пуснете конкретен тестов файл
npm run test:file js/__tests__/adminConfig.test.js
# или изпълнете тестове, свързани със стейджнатите файлове
npm run test:related
```
Тестовете използват `jsdom` среда и ES модули. Конфигурацията на Jest
задава `extensionsToTreatAsEsm: ['.ts']` и изключва преобразувания, така че
кодът се изпълнява нативно в Node 18+.
Препоръчително е за локална работа да използвате `npm run test:watch`,
тъй като изпълнява само променените тестове и ускорява процеса.
Използвайте `npm run test:file <път>` за бързо пускане само на нужния файл.
`npm test` автоматично подава флага `--runInBand`, така че тестовете се
изпълняват последователно и изключва HTTP/HTTPS proxy променливите (както в горен,
така и в долен регистър) и проверява дали е инсталиран Jest. Ако липсва,
скриптът завършва с грешка, вместо да изчаква интерактивен отговор, затова
пуснете `npm ci` или `npm install` преди тестовете.
При грешки "JavaScript heap out of memory" задайте по-голям лимит:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm test
```
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

### Coverage

Създава HTML отчет за покритието с командата:

```bash
npm run coverage
```

Файловете се намират в `coverage/lcov-report`.
Папката `coverage/` е добавена в `.gitignore` и се генерира локално при нужда.
### Registration Module Example

Include the common registration logic by importing `setupRegistration`:

```html
<script type="module">
  import { setupRegistration } from "./js/register.js";
  setupRegistration("#register-form", "#register-message");
</script>
```


### Отстраняване на проблеми

Ако изграждането на GitHub Action или локална задача спре на стъпка
"downloading repo" и приключи с `failed`, най-честата причина е нестабилна
мрежова връзка или липсваща конфигурация за достъп. Потвърдете, че имате
валиден интернет и коректни ключове за клониране. След успешно клониране
стартирайте `npm install`, за да се изтеглят зависимостите.

Ако при стартиране на worker-а или тестовете липсват инсталираните зависимости, изпълнете:

```bash
npm install
```

If you see an error such as **"Cannot find module './mailer.js'"**, most often it
means the Node dependencies haven't been installed. Run `npm install` and then
try again. Recent versions of the worker rely on the `MAILER_ENDPOINT_URL`
environment variable instead of dynamic imports. If this variable is missing, the
worker uses the helper from `sendEmailWorker.js` and posts directly to
`MAIL_PHP_URL` (defaults to `https://mybody.best/mailer/mail.php`). A **500** error from
`/api/sendTestEmail` usually indicates a problem with the PHP backend. Inspect
the worker logs for details.

If TypeScript complains that it cannot find `Buffer` or the type definition file
for **`node`**, make sure Node.js types are installed and enabled:

```bash
npm install  # installs dev dependencies, including @types/node
```

Check that `tsconfig.json` includes `"node"` in the `types` array.

> **Tip**: Activate Node compatibility in `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

When `nodejs_compat` is enabled, Cloudflare Workers expose `Buffer` globally,
so you can use it directly:

```ts
const encoded = Buffer.from('hello').toString('base64');
```

> **Note**: Уеб редакторът на Cloudflare няма типове за Node. Възможно е да виждате предупреждения в редактора, макар че worker-ът работи нормално след деплой.

След успешната инсталация стартирайте `npm run dev` отново.

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

> **Note**: При активирано `nodejs_compat` Cloudflare Workers предоставят `Buffer` и други Node функции като глобални, така че няма нужда от `import`.

### Generate Documentation

Create API documentation using Typedoc:

```bash
npm run docs
```
The output is placed in `docs/api`. Open `docs/api/index.html` in your browser to view the API documentation.
Папката `docs/api` не се проследява от Git. Генерирайте документацията локално при необходимост.
Тестовите файлове се пропускат чрез настройката

```json
"exclude": ["**/__tests__/**"]
```
така че документацията съдържа само продукционни модули.

### Template Loading

Client pages sometimes fetch HTML snippets at runtime. Templates such as
`profileTemplate.html` and `extra-meal-entry-form.html` must reside in the same
origin as the application. The helper `loadTemplateInto(url, containerId)`
rejects cross-origin URLs and sanitizes the response before inserting it into
the page.

Файлът `profileTemplate.dev.js`, който зарежда макети за тази страница в режим на разработка, вече се намира в `scripts/`.

## Deployment to Cloudflare

A GitHub Action workflow at `.github/workflows/deploy.yml` deploys the worker manually. Use the **Run workflow** button in the Actions tab to start a deployment. It runs `wrangler deploy` using the secret `CF_API_TOKEN` for authentication. Pull requests from forks cannot access the secrets, so those builds will skip deployment.

> **Important**: Do **not** run `wrangler deploy` manually. All production deployments should go through the GitHub Action so the worker version matches the repository history. You can freely use `wrangler dev` locally for testing, but push your changes to trigger an official deployment.

To set the token:

1. Generate an API token with **Edit Cloudflare Workers** permissions.
2. In your repository settings, create a GitHub secret named `CF_API_TOKEN` containing the token value.

The worker configuration is stored in `wrangler.toml`. Update `account_id` with your Cloudflare account if needed. For the `USER_METADATA_KV` namespace the file expects the environment variables `USER_METADATA_KV_ID` and `USER_METADATA_KV_PREVIEW_ID`. Configure them as GitHub secrets so the workflow can substitute the correct IDs before deployment. **Важно:** полето `compatibility_date` не може да сочи в бъдещето спрямо датата на деплой. Ако е зададена по-нова дата, Cloudflare ще откаже деплойването. Затова поддържайте стойност, която е днес или по-стара. Например:

For email notifications you may set `MAILER_ENDPOINT_URL` to point to a standalone worker or service that performs the delivery. Ако липсва, и работникът, и Node скриптът изпращат заявките до `MAIL_PHP_URL` чрез `fetch`.

```toml
compatibility_date = "2025-06-20"
compatibility_flags = ["nodejs_compat"]
```
Препоръчително е периодично (например веднъж годишно) да обновявате тази дата до последна валидна стойност, за да се възползва worker-ът от новите възможности на Cloudflare.
Опцията `nodejs_compat` активира Node съвместимост и позволява използването на модула `buffer` без допълнителни зависимости.
В workflow-а има стъпка `update-compat-date`, която автоматично я коригира, ако е зададена по-нова от днешната.

Пример за промяна в `wrangler.toml` с дата в миналото:

```toml
compatibility_date = "2025-06-20"
```
You can verify this setup locally by running:

```bash
node scripts/validate-wrangler.js
```
This script checks for placeholder values and for a provided `CF_API_TOKEN`.

### Worker Scripts

- The repository contains two Cloudflare workers.
- `worker.js` – the main application worker defined in `wrangler.toml`. It gets deployed to Cloudflare through the GitHub workflow when you run the deployment manually.
- `worker-backend.js` – a lightweight proxy used by the PHP backend to call Cloudflare AI. Deploy it separately, for example:

```bash
wrangler deploy worker-backend.js --name bodybest-backend
```

Bind the `SETTINGS` KV namespace and provide `CF_AI_TOKEN`, `CF_ACCOUNT_ID` and model variables as secrets.

Заявките към този работник трябва да са **само POST**. При опит с друг метод
ще получите **HTTP 405 Method Not Allowed**:

```bash
curl -X GET https://<your-backend-url>
# => HTTP/1.1 405 Method Not Allowed
```


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
| `model_questionnaire_analysis` | Модел за анализ на първоначалния въпросник |
| `prompt_image_analysis` | Шаблон за промпт при анализ на изображение |
| `prompt_questionnaire_analysis` | Шаблон за анализ на подадените отговори |
| `prompt_adaptive_quiz_generation` | Шаблон за създаване на адаптивен въпросник |
| `prompt_analytics_textual_summary` | Шаблон за текстов анализ на прогреса |
| `prompt_analyze_quiz_and_suggest_changes` | Шаблон за анализ на отговорите и предложения за промяна |
| `prompt_chat` | Шаблон за чат промптове |
| `prompt_praise_generation` | Шаблон за генериране на похвали |
| `prompt_principle_adjustment` | Шаблон за промпт при корекция на принципи |
| `prompt_unified_plan_generation_v2` | Шаблон за унифицирано генериране на план |
| `prompt_plan_modification` | Шаблон за заявка към AI при промени в плана |
| `plan_token_limit` | Максимални токени при генериране на план |
| `plan_temperature` | Температура за плана |
| `chat_token_limit` | Максимални токени в чат сесия |
| `chat_temperature` | Температура за чат модела |
| `mod_token_limit` | Token limit при промяна на плана |
| `mod_temperature` | Температура при промяна на плана |
| `image_token_limit` | Token limit за анализ на изображение |
| `image_temperature` | Температура за анализ на изображение |
| `welcome_email_subject` | Тема на приветствения имейл |
| `welcome_email_body` | HTML съдържание за приветствения имейл |
| `questionnaire_email_subject` | Тема на имейла след попълнен въпросник |
| `questionnaire_email_body` | HTML съдържание за потвърждението на въпросника |
| `send_questionnaire_email` | "1" или "0" за включване или изключване на потвърждението |
| `from_email_name` | Име на подателя в изпращаните имейли |
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
- `PHP_FILE_API_URL`
- `PHP_FILE_API_TOKEN`
- `CF_AI_TOKEN` – API token used for Cloudflare AI requests
- `OPENAI_API_KEY` – set via `wrangler secret put OPENAI_API_KEY`, used by `worker.js`
- `FROM_EMAIL` – optional sender address for outgoing emails
- `FROM_NAME` – optional display name shown in the "From" header

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

### Maintenance Mode

Set `MAINTENANCE_MODE=1` to show a static maintenance page for every request.
The worker looks for a KV entry `maintenance_page` and falls back to
`maintenance.html` when the key is missing.

Example `.env` value:

```env
MAINTENANCE_MODE=1
```

Or in `wrangler.toml`:

```toml
[vars]
MAINTENANCE_MODE = "1"
```

Set to `0` or remove the variable to disable the mode.

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
Има и секция **Тест на анализ на въпросник**, която изпраща JSON отговори към `/api/submitQuestionnaire` и извежда статуса на обработката заедно с получения анализ. Заредете файл с резултати или поставете съдържанието в текстовото поле и натиснете **Изпрати**.
Падащо меню **Клиент** автоматично се попълва със списък на всички профили. Може и да въведете `userId` ръчно. Достатъчно е да посочите имейл или `userId` (или и двете). Ако не подадете JSON данни, се зарежда автоматично съхраненият въпросник и се стартира нов анализ. При успешно изпращане и върнат идентификатор се появява бутон **Отвори анализа**, който отваря `analyze.html?userId=<ID>` в нов таб.

```bash
curl -X POST https://<your-domain>/api/submitQuestionnaire \
  -H "Content-Type: application/json" \
  --data '{"email":"user@example.com","answers":[{"id":1,"value":"Да"}]}'
```

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

Пример с новия ендпойнт за байтов масив:

```bash
curl -X POST https://<your-domain>/api/runImageModel \
  -H "Content-Type: application/json" \
  --data '{"model":"@cf/llava-hf/llava-1.5-7b-hf","prompt":"Какво има?","image":[1,2,3]}'
```
Този ендпойнт приема само POST заявки. При друг метод ще получите статус 405.

### Персонален анализ (`analyze.html`)

След попълване на въпросника Cloudflare worker-ът съхранява резултата като `<userId>_analysis` и го връща чрез `/api/getInitialAnalysis?userId=<ID>`.
Статусът на изчисляването се пази отделно в ключ `<userId>_analysis_status` и може да се провери с `/api/analysisStatus?userId=<ID>`.
Шаблонът `reganalize/analyze.html` визуализира тези данни.
Когато анализът е генериран, потребителят получава имейл с линк към страницата,
на който параметърът `userId` зарежда индивидуалния JSON.

1. Извикайте ендпойнта и запишете JSON отговора.
2. Заменете плейсхолдъра `/*---JSON_DATA_PLACEHOLDER---*/` в HTML с получения JSON.
3. Отворете готовия файл в браузър.

Примерен Node.js скрипт:

```bash
node -e "const fs=require('fs');const data=require('./analysis.json');const html=fs.readFileSync('reganalize/analyze.html','utf8').replace('/*---JSON_DATA_PLACEHOLDER---*/',JSON.stringify(data));fs.writeFileSync('analyze.html',html);"
```

По-удобно може да използвате `scripts/injectAnalysis.js`, който автоматично извлича анализа и го вгражда:

```bash
node scripts/injectAnalysis.js https://<your-domain> <userId>
```


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
- `POST /api/requestPasswordReset` – изпраща линк за възстановяване на парола.
- `POST /api/performPasswordReset` – задава нова парола по изпратения токен.
- `GET /api/getAiConfig` – зарежда текущата AI конфигурация.
- `POST /api/setAiConfig` – записва токени и модели в `RESOURCES_KV`.
- `GET /api/listAiPresets` – връща имената на записаните AI конфигурации.
- `GET /api/getAiPreset` – връща данните за конкретен пресет.
- `POST /api/saveAiPreset` – съхранява нов пресет или обновява съществуващ.
- `POST /api/testAiModel` – проверява връзката с конкретен AI модел.
- `POST /api/submitQuestionnaire` – изпраща отговорите от началния въпросник.
- `GET /api/analysisStatus` – връща текущия статус на персоналния анализ.
- `GET /api/getInitialAnalysis` – връща първоначалния анализ.
- `POST /api/analyzeImage` – анализира качено изображение и връща резултат. Изпращайте поле `image` с пълен `data:` URL. Ендпойнтът не изисква `WORKER_ADMIN_TOKEN`, освен ако изрично не сте го добавили като защита.
- `POST /api/runImageModel` – изпраща байтовете на изображение към избран Cloudflare AI модел. Заявката приема `{ "model": "@cf/llava-hf/llava-1.5-7b-hf", "prompt": "Описание", "image": [..] }` и връща JSON от `env.AI.run`. При заявки с друг метод се връща статус 405.
- `POST /api/sendTestEmail` – изпраща тестов имейл. Изисква администраторски токен.
- `POST /api/sendEmail` – изпраща имейл чрез PHP бекенда. Изисква HTTP заглавка `Authorization: Bearer <WORKER_ADMIN_TOKEN>` и приема JSON `{ "to": "user@example.com", "subject": "Тема", "text": "Съобщение" }`. Заявките са ограничени до няколко на минута.

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
  могат да се използват имената `to`, `text` или `message`.
  По желание може да зададете име на подателя чрез поле `fromName`.

  ```bash
  curl -X POST https://<your-domain>/api/sendTestEmail \
    -H "Authorization: Bearer <WORKER_ADMIN_TOKEN>" \
    -H "Content-Type: application/json" \
    --data '{"to":"someone@example.com","subject":"Тест","message":"Здравей"}'
  ```
  ```javascript
  await fetch('/api/sendTestEmail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WORKER_ADMIN_TOKEN}`
    },
    body: JSON.stringify({
      to: 'someone@example.com',
      subject: 'Тест',
      message: 'Здравей'
    })
  });
  ```
  Ако `MAILER_ENDPOINT_URL` не е зададен, работникът използва `sendEmailWorker.js`
  и изпраща данните директно към `MAIL_PHP_URL`.

### Смяна на парола

`/api/requestPasswordReset` изпраща имейл с линк за задаване на нова парола. Заявката приема JSON поле `email`.

```bash
curl -X POST https://<your-domain>/api/requestPasswordReset \
  -H "Content-Type: application/json" \
  --data '{"email":"user@example.com"}'
```

Успешният отговор е `{ "success": true, "message": "Изпратихме линк за смяна на паролата." }`.

След получаване на токен, изпратете POST заявка към `/api/performPasswordReset` с полетата `token`, `password` и `confirm_password`:

```bash
curl -X POST https://<your-domain>/api/performPasswordReset \
  -H "Content-Type: application/json" \
  --data '{"token":"<token>","password":"NovaParola1","confirm_password":"NovaParola1"}'
```

При успех ще получите `{ "success": true, "message": "Паролата е обновена успешно." }`. При невалиден токен се връща статус **400** и съобщение "Невалиден или изтекъл токен.".
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
2. Otherwise the worker calls `sendEmailWorker.js`, който изпраща
   заявката към `MAIL_PHP_URL`.

In both cases the `/api/sendTestEmail` endpoint behaves the same and returns a
JSON response indicating success or failure.
A status **500** typically means the PHP backend or your external service
failed and should be investigated via the worker logs.

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

For a simple setup deploy `sendEmailWorker.js`, който излага `/api/sendEmail`.
Point `MAILER_ENDPOINT_URL` към URL адреса на този worker,
за да може основният сервис да изпраща имейли без Node.js.
Requests to this endpoint also require the admin token and are rate limited.

И `worker.js`, и помощният скрипт `mailer.js` изпращат заявките към `MAIL_PHP_URL`
чрез вградената функция `fetch`. Така няма нужда от допълнителни зависимости.
Можете да стартирате `mailer.js` като самостоятелен процес или да го промените
според вашия бекенд.

### Email Environment Variables

To send a test email задайте `WORKER_ADMIN_TOKEN`. Може да посочите `MAILER_ENDPOINT_URL` към отделен worker или да оставите променливата празна, за да се използва директно `MAIL_PHP_URL`. Опционалната `FROM_EMAIL` променя подателя.

| Variable | Purpose |
|----------|---------|
| `MAILER_ENDPOINT_URL` | Endpoint called by `worker.js` when sending emails. If omitted, the worker posts to `sendEmailWorker.js`. The request payload includes both `message` and `body` fields for compatibility. |
| `MAIL_PHP_URL` | Legacy PHP endpoint if you prefer your own backend. Defaults to `https://mybody.best/mailer/mail.php`. |
| `EMAIL_PASSWORD` | Password used by `mailer.js` when authenticating with the SMTP server. |
| `FROM_EMAIL` | Sender address used by `mailer.js` and the PHP backend. |
| `FROM_NAME` | Optional display name for the sender shown in outgoing emails. |
| `WELCOME_EMAIL_SUBJECT` | Optional custom subject for welcome emails sent by `mailer.js`. |
| `WELCOME_EMAIL_BODY` | Optional HTML body template for welcome emails. The string `{{name}}` will be replaced with the recipient's name. |
| `QUESTIONNAIRE_EMAIL_SUBJECT` | Optional subject for the confirmation email sent след изпращане на въпросника. |
| `QUESTIONNAIRE_EMAIL_BODY` | Optional HTML body template for the confirmation email. `{{name}}` ще бъде заменено с името на потребителя. |
| `SEND_QUESTIONNAIRE_EMAIL` | Set to `false` or `0` to disable sending the confirmation email. |
| `SEND_WELCOME_EMAIL` | Set to `false` or `0` to skip the welcome message after registration. |
| `SEND_ANALYSIS_EMAIL` | (deprecated) no effect – анализът се изпраща веднага след въпросника. |
| `ANALYSIS_EMAIL_SUBJECT` | Subject for the email, sent when the personal analysis is ready. |
| `ANALYSIS_EMAIL_BODY` | HTML body template for that email. Use `{{name}}` и `{{link}}` за персонализация. |
| `ANALYSIS_PAGE_URL` | Base URL към `analyze.html` за генериране на линка в писмото. |
| `PASSWORD_RESET_EMAIL_SUBJECT` | Subject за писмото при заявка за нова парола. |
| `PASSWORD_RESET_EMAIL_BODY` | HTML шаблон за имейла с линка за смяна на паролата. Използвайте `{{link}}`. |
| `PASSWORD_RESET_PAGE_URL` | Базов URL към `reset-password.html` за генериране на линка. |
| `WORKER_URL` | Base URL of the main worker used by `mailer.js` to fetch email templates when no subject or body is provided. |

### HTML шаблон за приветствени имейли

Файлът `data/welcomeEmailTemplate.html` съдържа готов дизайн за писмото "Добре дошли". Заменете `https://via.placeholder.com/200x50.png?text=Вашето+Лого` с реалното лого и използвайте плейсхолдърите `{{name}}` и `{{current_year}}` за персонализация. Преди изпращане е полезно HTML кодът да се обработи с **CSS inliner** инструмент (напр. Campaign Monitor Inliner или [Juice](https://github.com/Automattic/juice)), който прехвърля стиловете от `<style>` в елементите и така подобрява съвместимостта на имейл клиентите.

#### Example: configuring analysis email

Имейлът с линк към анализа се изпраща веднага след попълване на въпросника, без значение от `SEND_ANALYSIS_EMAIL`.

Добавете следните променливи в `.env` или `wrangler.toml`:

```env
ANALYSIS_EMAIL_SUBJECT=Персоналният ви анализ е готов
ANALYSIS_EMAIL_BODY=<p>Здравей, {{name}}. <a href="{{link}}">Виж анализа</a>.</p>
ANALYSIS_PAGE_URL=https://example.com/analyze.html
```

При ненастроени стойности се използват вградените теми и HTML шаблон.
Секцията **Настройки за имейли** в `admin.html` показва визуално превю под всяко поле за HTML съдържание, за да виждате крайния резултат преди изпращане.

**Очакван резултат**

```
Subject: Персоналният ви анализ е готов
<p>Здравей, Иван.</p>
<p><a href="https://example.com/analyze.html?userId=123">Виж анализа</a>.</p>
```

Проверете стойностите така:

```bash
# показва тайните записани за работника
wrangler secret list

# или прегледайте локалния .env файл
grep MAIL_PHP_URL .env
```
Примерен PHP скрипт за изпращане на писма е наличен в [docs/mail_smtp.php](docs/mail_smtp.php). Настройте `MAIL_PHP_URL` да сочи към същия или сходен адрес.
Скриптът приема JSON поле `body` или `message` и използва стойността като HTML съдържание на имейла.

### PHP script requirements

The file `docs/mail_smtp.php` relies on **PHPMailer** for SMTP. Install it via Composer:

```bash
composer require phpmailer/phpmailer
```

The script expects `vendor/autoload.php` to reside one directory above the PHP file (`require __DIR__ . '/../vendor/autoload.php';`). Ensure the `vendor` folder is placed accordingly to avoid "Failed opening required" errors.

## Cron configuration

Cloudflare позволява изпълнение на работници по зададен график.
За да създадете Cron trigger:

1. Отворете **Workers & Pages** в Cloudflare dashboard и изберете своя worker.
2. В раздел **Triggers** → **Cron Triggers** натиснете **Add Cron Trigger**.
3. Въведете израз като `0 */1 * * *`, който ще задейства работника на всеки час.

При активиране на Cron тригера Cloudflare извиква `scheduled` хендлъра в `worker.js`,
което позволява автоматично обновяване на плановете.

Лимитите за брой потребители, които се обработват при всяко изпълнение, могат да се регулират чрез променливите на средата `MAX_PROCESS_PER_RUN_PLAN_GEN`, `MAX_PROCESS_PER_RUN_PRINCIPLES` и `MAX_PROCESS_PER_RUN_ADAPTIVE_QUIZ`.

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
