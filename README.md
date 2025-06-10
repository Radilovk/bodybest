# BodyBest

A simple static web application for tracking nutrition and workouts.

## Development Setup

1. Install [Node.js](https://nodejs.org/) (version 14 or later).
2. Install dependencies:

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

Check the source code with ESLint:

```bash
npm run lint
```

### Test

Run unit tests with Jest:

```bash
npm test
```

## Deployment to Cloudflare

A GitHub Action workflow at `.github/workflows/deploy.yml` automatically publishes the worker when you push to `main`. It runs `wrangler publish` using the secret `CF_API_TOKEN` for authentication.

To set the token:

1. Generate an API token with **Edit Cloudflare Workers** permissions.
2. In your repository settings, create a GitHub secret named `CF_API_TOKEN` containing the token value.

The worker configuration is stored in `wrangler.toml`. Update `account_id` with your Cloudflare account if needed.

### Manual publish

For manual deployment run:

```bash
npx wrangler publish
```

This will upload the worker using the settings from `wrangler.toml`.

### Работа с KV

Можете да управлявате съдържанието на KV директно през `wrangler`:

```bash
wrangler kv:key put <ключ> "<стойност>" --binding=RESOURCES_KV
wrangler kv:key get <ключ> --binding=RESOURCES_KV
wrangler kv:key delete <ключ> --binding=RESOURCES_KV
```

Заменете `RESOURCES_KV` с `USER_METADATA_KV` при нужда. В директорията `scripts` има примерен Node скрипт `manage-kv.js`, който изпълнява същите операции:

```bash
node scripts/manage-kv.js put exampleKey "примерна стойност"
node scripts/manage-kv.js get exampleKey
node scripts/manage-kv.js delete exampleKey
```
Можете да стартирате скрипта и директно:

```bash
./scripts/manage-kv.js put exampleKey "примерна стойност"
```

### Required Worker Secrets

Before deploying, configure the following secrets in Cloudflare (via the dashboard or `wrangler secret put`):

- `GEMINI_API_KEY`
- `тут_ваш_php_api_url_secret_name`
- `тут_ваш_php_api_token_secret_name`

These names are referenced in `worker.js` and must exist for the worker to function.

### PHP API Environment Variables

The PHP helper scripts expect the following variables set in the server environment:

- `STATIC_TOKEN` – shared secret token used for authentication in `file_manager_api.php`.
- `ADMIN_PASS_HASH` – bcrypt hash of the admin password for `login.php`.

Example of generating a hash:

```bash
php -r "echo password_hash('yourPassword', PASSWORD_DEFAULT);"
```

Set the output as the value for `ADMIN_PASS_HASH`.
## Допълнителни функции
- **Извънредно хранене** – бутонът "Добави извънредно хранене" в `code.html` отваря модалната форма `extra-meal-entry-form.html`. Логиката в `js/extraMealForm.js` изпраща данните към `/api/log-extra-meal` в `worker.js`.

## License

This project is licensed under the ISC license. See [LICENSE](LICENSE).
