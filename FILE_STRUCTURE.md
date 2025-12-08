# File Structure - Файлова структура

> Детайлно описание на всички файлове и директории в проекта.

## Съдържание

1. [Root Files](#root-files)
2. [HTML Pages](#html-pages)
3. [JavaScript](#javascript)
4. [CSS](#css)
5. [Backend](#backend)
6. [Scripts](#scripts)
7. [Documentation](#documentation)
8. [Data & Resources](#data--resources)
9. [Configuration](#configuration)

---

## Root Files

### Worker Files

#### `worker.js` (~9000 lines)
**Отговорност:** Main Cloudflare Worker

**Секции:**
- Authentication & User management
- Plan generation & modification
- AI services integration
- Logging endpoints
- Analytics
- Email services
- Cron jobs
- Admin endpoints

**Endpoints:** 60+ API endpoints

**Зависимости:**
- `node:buffer` - Buffer support
- Cloudflare Workers APIs
- KV namespaces

---

#### `worker-backend.js` (~200 lines)
**Отговорност:** PHP proxy worker за Cloudflare AI

**Функции:**
- Приема POST заявки от PHP backend
- Извиква Cloudflare AI models
- Връща резултати

**Конфигурация:**
- Binding: `AI`
- Binding: `SETTINGS` (KV)

---

#### `sendEmailWorker.js` (~150 lines)
**Отговорност:** Email sending worker

**Функции:**
- `/api/sendEmail` endpoint
- Rate limiting
- PHP backend integration

**Конфигурация:**
- `MAIL_PHP_URL` environment variable
- Admin token защита

---

#### `mailer.js` (~100 lines)
**Отговорност:** Email helper functions

**Функции:**
- `sendEmail(to, subject, body)` - Изпраща имейл
- Template support
- HTML email support

**Използване:**
```javascript
import { sendEmail } from './mailer.js';
await sendEmail('user@example.com', 'Subject', '<p>Body</p>');
```

---

### Configuration Files

#### `package.json`
**NPM Configuration**

**Scripts:**
```json
{
  "dev": "vite",
  "build": "vite build",
  "start": "vite preview",
  "lint": "eslint .",
  "test": "node scripts/validateMacros.js && sh ./scripts/test.sh",
  "test:watch": "sh ./scripts/test.sh --watch",
  "test:file": "node scripts/test.sh --runTestsByPath",
  "test:related": "node scripts/test-related.js",
  "coverage": "NODE_OPTIONS=--experimental-vm-modules jest --coverage",
  "docs": "typedoc",
  "sync-kv": "node scripts/sync-kv.js",
  "migrate-macros": "node scripts/migrate-final-plan-macros.js",
  "deploy": "wrangler deploy && npm run migrate-macros"
}
```

**Dependencies:**
- `dotenv` - Environment variables
- `jsonrepair` - JSON repair utility

**DevDependencies:**
- `vite` - Build tool
- `eslint` - Linter
- `jest` - Testing
- `typedoc` - Documentation
- `@cloudflare/workers-types` - TypeScript types

---

#### `wrangler.toml`
**Cloudflare Worker Configuration**

```toml
name = "bodybest"
main = "worker.js"
compatibility_date = "2025-06-20"
compatibility_flags = ["nodejs_compat"]

[triggers]
crons = ["0 */1 * * *"]

[[kv_namespaces]]
binding = "RESOURCES_KV"
id = "..."

[[kv_namespaces]]
binding = "USER_METADATA_KV"
id = "..."

[vars]
ALLOWED_ORIGINS = "..."
```

---

#### `vite.config.js`
**Vite Configuration**

```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://openapichatbot.radilov-k.workers.dev',
        changeOrigin: true
      }
    }
  }
}
```

---

#### `eslint.config.js`
**ESLint Configuration**

**Rules:**
- ES Modules
- Node.js 18+
- No console warnings
- Indent: 2 spaces

---

#### `jest.config.js`
**Jest Configuration**

```javascript
export default {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
}
```

---

#### `tsconfig.json`
**TypeScript Configuration**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"],
    "types": ["node", "@cloudflare/workers-types"]
  }
}
```

---

#### `.gitignore`
**Git Ignore Rules**

```
node_modules/
dist/
coverage/
.env
.dev.vars
docs/api/
*.log
```

---

#### `.npmrc`
**NPM Configuration**

```
loglevel=error
```

---

## HTML Pages

### User Pages

#### `landing.html`
**Landing page за visitors**

**Секции:**
- Hero section
- Features
- Pricing (placeholder)
- FAQ
- Call to action

**Скриптове:**
- `script.js` - Main landing script
- Lazy load: `authModal.js`

---

#### `index.html`
**Main dashboard**

**Секции:**
- Top navigation
- Calories & macros cards
- Meal tracking
- Progress charts
- Quick actions
- AI chat

**Скриптове:**
- `app.js` - Main initialization
- `uiHandlers.js` - Event handlers
- `populateUI.js` - UI population
- `chat.js` - Chat functionality

**Стилове:**
- `index_styles.css`
- `base_styles.css`

---

#### `quest.html`
**Initial questionnaire**

**Секции:**
- Multi-step form (5 стъпки)
- Progress indicator
- Question groups:
  - Personal info
  - Goals
  - Current state
  - Preferences
  - Medical history

**Скриптове:**
- `questionnaireCore.js`
- `stepProgress.js`

**Стилове:**
- `quest_styles.css`
- `quest_theme.css`

---

#### `code.html`
**Nutrition plan display**

**Секции:**
- Plan overview
- Daily meals breakdown
- Macro distribution
- Principles
- Adaptive quiz
- Modification tools

**Скриптове:**
- `planEditor.js`
- `planModChat.js`
- `planRegenerator.js`

---

#### `assistant.html`
**Standalone AI assistant**

**Секции:**
- Chat interface
- Image upload
- Message history

**Скриптове:**
- `assistantChat.js`
- `messageUtils.js`

---

#### `profile-edit.html`
**User profile editing**

**Секции:**
- Personal info
- Body measurements
- Goals
- Preferences

**Скриптове:**
- `profileEdit.js`

---

### Admin Pages

#### `admin.html`
**Administration panel**

**Секции:**
- Dashboard stats
- AI Configuration
- Email Settings
- Theme Editor
- User Management
- Maintenance Mode
- Test Tools

**Скриптове:**
- `admin.js`
- `adminConfig.js`
- `adminColors.js`
- `maintenanceMode.js`

**Стилове:**
- `admin.css`

---

#### `clientProfile.html`
**Client profile view (admin)**

**Секции:**
- Client info
- Plan history
- Logs
- Analytics

**Скриптове:**
- `clientProfile.js`

**Стилове:**
- `clientProfile.css`

---

#### `editclient.html`
**Edit client data (admin)**

**Скриптове:**
- `editClient.js`

---

### Authentication Pages

#### `login.html`
**Login form**

**Функции:**
- Email/password login
- Remember me
- Forgot password link

**Скриптове:**
- `auth.js`

---

#### `logout.html`
**Logout redirect**

**Функции:**
- Изчиства session
- Redirect към login

---

#### `forgot-password.html`
**Password reset request**

**API:**
- POST `/api/requestPasswordReset`

---

#### `reset-password.html`
**Password reset form**

**API:**
- POST `/api/performPasswordReset`

---

### Static Pages

#### `about.html`
**About page**

---

#### `contact.html`
**Contact form**

**Скриптове:**
- `contactForm.js`

---

#### `faq.html`
**FAQ page**

---

#### `privacy.html`
**Privacy policy**

---

#### `terms.html`
**Terms of service**

---

#### `blog.html`
**Blog listing**

---

### Special Pages

#### `maintenance.html`
**Maintenance mode page**

**Показва се когато:**
- `MAINTENANCE_MODE=1` в worker

---

#### `extra-meal-entry-form.html`
**Extra meal modal template**

**Използва се от:**
- `extraMealForm.js`

---

#### `profileTemplate.html`
**Profile template partial**

**Зарежда се с:**
- `templateLoader.js`

---

#### `macroAnalyticsCardStandalone.html`
**Standalone macro analytics demo**

**Компонент:**
- `<macro-analytics-card>`

---

#### `macroChart.html`
**Chart.js demo**

---

#### `radar-chart-template.html`
**Radar chart template**

---

#### `Userdata.html`
**User data display (legacy?)**

---

#### `demoquest.html`
**Demo questionnaire**

**JSON:**
- `demo_questions.json`

---

#### `homeo.html`
**Homeopathy info (legacy?)**

---

#### `read.html`
**Reading page (legacy?)**

---

## JavaScript

### Core (`js/`)

```
js/
├── app.js                    # Main app initialization
├── config.js                 # Configuration constants
├── utils.js                  # Common utilities
├── script.js                 # Landing page script
│
├── 🔐 Authentication
│   ├── auth.js
│   ├── authModal.js
│   └── register.js
│
├── 💾 Data Management
│   ├── offlineLogSync.js     # Offline logging (singleton)
│   ├── requestCache.js       # Persistent caching
│   ├── safeStorage.js        # Storage quota management
│   └── logger.js             # Centralized logging
│
├── 📊 Analytics & Planning
│   ├── macroUtils.js
│   ├── planGeneration.js
│   ├── planEditor.js
│   ├── planModChat.js
│   ├── planRegenerator.js
│   ├── planProposalManager.js
│   ├── planProposalIntegration.js
│   └── metricUtils.js
│
├── 🎨 UI Components
│   ├── uiHandlers.js
│   ├── uiElements.js
│   ├── populateUI.js
│   ├── themeControls.js
│   ├── themeConfig.js
│   ├── themeStorage.js
│   ├── highContrastMode.js
│   ├── onboardingWizard.js
│   ├── syncStatusIndicator.js
│   ├── stepProgress.js
│   ├── templateLoader.js
│   ├── partialLoader.js
│   ├── loading.js
│   └── tooltipState.js
│
├── 💬 Chat & AI
│   ├── chat.js
│   ├── assistantChat.js
│   └── messageUtils.js
│
├── 📝 Forms
│   ├── questionnaireCore.js
│   ├── extraMealForm.js
│   └── contactForm.js
│
├── 🎓 Admin
│   ├── admin.js
│   ├── adminConfig.js
│   ├── adminColors.js
│   └── maintenanceMode.js
│
├── 🛠️ Utilities
│   ├── htmlSanitizer.js
│   ├── debounce.js
│   ├── swipeUtils.js
│   ├── chartLoader.js
│   ├── labelMap.js
│   ├── macroCardLocales.js
│   ├── eventListeners.js
│   ├── initProfilePage.js
│   ├── profileEdit.js
│   ├── clientProfile.js
│   ├── editClient.js
│   ├── achievements.js
│   ├── userProfiles.js
│   └── integrationExample.js
│
├── 🎯 Components
│   └── macroAnalyticsCardComponent.js
│
└── 🧪 Testing
    ├── __tests__/            # Jest тестове (40+ файла)
    │   ├── adminConfig.test.js
    │   ├── auth.test.js
    │   ├── macroUtils.test.js
    │   ├── offlineLogSync.test.js
    │   ├── requestCache.test.js
    │   ├── themeAccessibility.test.js
    │   └── ...
    │
    └── testHelpers/          # Test utilities
        ├── mockFetch.js
        ├── mockLocalStorage.js
        └── setupTestEnvironment.js
```

**Total:** 50+ JavaScript files

---

## CSS

### Style Modules (`css/`)

```
css/
├── base_styles.css               # Base + themes (Light/Dark/Vivid)
│   ├── :root                     # Light theme variables
│   ├── body.dark-theme           # Dark theme
│   ├── body.vivid-theme          # Vivid theme
│   └── body.high-contrast        # High contrast mode
│
├── index_styles.css              # Dashboard styles
├── landing_styles.css            # Landing page
├── quest_styles.css              # Questionnaire
├── quest_theme.css               # Quest theme
├── admin.css                     # Admin panel
├── clientProfile.css             # Client profile
│
├── 📦 Components
│   ├── components_styles.css
│   ├── dashboard_panel_styles.css
│   ├── profile_panel_styles.css
│   ├── week_plan_panel_styles.css
│   ├── recommendations_panel_styles.css
│   ├── extra_meal_form_styles.css
│   ├── plan_mod_chat_styles.css
│   ├── sync_status_indicator_styles.css
│   └── onboarding_wizard_styles.css
│
└── 🎨 Layout
    ├── layout_styles.css
    └── responsive_styles.css
```

**Total:** 18 CSS files

**CSS Variables:** 100+ променливи за теми

---

## Backend

### Backend Tests (`backend/tests/`)

```
backend/tests/
├── checkPlanPrerequisites.test.js       # Prerequisites check
├── regeneratePlan.test.js               # Plan regeneration
├── submitQuestionnairePlanStart.test.js # Questionnaire flow
└── dashboardPendingInputs.test.js       # Dashboard inputs
```

**Тестват:**
- Worker endpoints
- Integration flows
- Business logic

---

## Scripts

### Utility Scripts (`scripts/`)

```
scripts/
├── 🔄 KV Management
│   ├── sync-kv.js                      # Sync DIET_RESOURCES → RESOURCES_KV
│   ├── manage-kv.js                    # KV operations (get/put/delete)
│   ├── migrate-final-plan-macros.js    # Macro data migration
│   ├── migrate-weight-logs.js          # Weight logs migration
│   └── repair-log.js                   # Repair invalid JSON logs
│
├── 🧪 Testing
│   ├── test.sh                         # Test runner wrapper
│   ├── test-related.js                 # Test staged files
│   └── validateMacros.js               # Macro validation
│
├── ✅ Validation
│   ├── validate-json.js                # JSON file validation
│   └── validate-wrangler.js            # Wrangler config check
│
├── 🛠️ Development
│   ├── profileTemplate.dev.js          # Dev template loader
│   ├── injectAnalysis.js               # Inject analysis into HTML
│   └── generateChangeLog.js            # Generate changelog
│
├── 🚀 Deployment
│   ├── prepare-wrangler.js             # Prepare for deploy
│   ├── update-compat-date.js           # Update compatibility_date
│   └── convertProductMacros.js         # Convert product data
│
└── 📊 Monitoring
    └── view-usage-logs.js              # View AI usage logs
```

**Total:** 17 scripts

---

## Documentation

### Docs (`docs/`)

```
docs/
├── 📚 Guides
│   ├── DEV_GUIDE_BG.md                 # Developer guide (BG)
│   ├── IMPLEMENTATION_SUMMARY_BG.md     # Implementation summary
│   ├── PROJECT_OVERVIEW_BG.md          # Project overview
│   └── SUMMARY_BG.md                   # General summary
│
├── 🤖 AI & Plans
│   ├── AI_PLAN_MODIFICATION_BG.md      # Plan modification logic
│   ├── ANALYTICS_FORMULAS_BG.md        # Analytics formulas
│   ├── PLAN_PROPOSAL_OPTIMIZATION_BG.md
│   ├── QUESTIONNAIRE_ANALYSIS_CORRELATION.md
│   └── OPTIMIZATIONS.md
│
├── 📋 Examples
│   ├── final_plan_kv_example.md        # Plan JSON example
│   ├── questionnaire_kv_example.md     # Questionnaire example
│   ├── nutrientOverridesListExample.md
│   ├── recalculateCaloriesExample.md
│   ├── scaleMacrosExample.md
│   └── image_analysis_template_bg.md
│
├── 🔧 Technical
│   ├── product_data_sync.md            # Product data sync
│   └── change-log.md                   # Project changelog
│
├── 📊 Data
│   ├── final_plan_template.json        # Plan template
│   └── change-log-data.json            # Changelog data
│
├── 🎨 HTML
│   ├── quest-structure.html            # Quest structure demo
│   └── mail_smtp.php                   # PHP email script
│
└── 📖 API (generated)
    └── api/                            # TypeDoc output
        └── index.html
```

**Total:** 20+ documentation files

---

## Data & Resources

### Data Files (`data/`)

```
data/
├── commonFoods.json                    # Common foods database
├── detailedMetricInfoTexts.json        # Metric info texts
├── mainIndexInfoTexts.json             # Index page texts
├── trackerInfoTexts.json               # Tracker texts
├── welcomeEmailTemplate.html           # Welcome email HTML
└── testEmailTemplate.html              # Test email HTML
```

---

### KV Resources (`kv/DIET_RESOURCES/`)

```
kv/DIET_RESOURCES/
├── 🤖 AI Prompts
│   ├── prompt_unified_plan_generation_v2.txt
│   ├── prompt_questionnaire_analysis.txt
│   ├── prompt_plan_modification.txt
│   ├── prompt_chat.txt
│   ├── prompt_image_analysis.txt
│   ├── prompt_analytics_textual_summary.txt
│   ├── prompt_initial_analysis.txt
│   ├── prompt_macro_calculation.txt
│   └── prompt_principle_adjustment.txt
│
├── 📊 Diet Data
│   ├── question_definitions.json       # Questions schema
│   ├── recipe_data.json                # Recipes
│   ├── product_macros.json             # Product macros
│   ├── product_measure.json            # Measurements
│   ├── product_measure.txt             # Measurements (text)
│   ├── nutrient_overrides.json         # Nutrient overrides
│   ├── base_diet_model.json            # Base model
│   ├── allowed_meal_combinations.txt   # Meal combos
│   └── eating_psychology.txt           # Psychology texts
│
└── 📝 Text Resources
    └── *.txt                           # Various text files
```

**Sync:** `npm run sync-kv` → RESOURCES_KV

---

### Locales (`locales/`)

```
locales/
├── macroCard.bg.json                   # Bulgarian translations
└── macroCard.en.json                   # English translations
```

---

### Images (`img/`)

```
img/
└── [Various image assets]
```

---

### Mail Scripts (`mail/`)

```
mail/
└── [PHP mail scripts]
```

---

### Partials (`partials/`)

```
partials/
└── [HTML partial templates]
```

---

## Configuration Details

### Environment Variables

**Worker Secrets:**
```bash
GEMINI_API_KEY
OPENAI_API_KEY
CF_AI_TOKEN
CF_ACCOUNT_ID
WORKER_ADMIN_TOKEN
PHP_FILE_API_URL
PHP_FILE_API_TOKEN
FROM_EMAIL
FROM_NAME
EMAIL_PASSWORD
command-r-plus              # Cohere API key
```

**Worker Vars:**
```bash
ALLOWED_ORIGINS
MAINTENANCE_MODE
MAILER_ENDPOINT_URL
MAIL_PHP_URL
ANALYSIS_PAGE_URL
PASSWORD_RESET_PAGE_URL
```

**Local `.env` (development):**
```bash
USE_LOCAL_PROXY=true
WORKER_URL=http://localhost:8787
```

---

### KV Bindings

**`wrangler.toml`:**
```toml
[[kv_namespaces]]
binding = "RESOURCES_KV"
id = "..."
preview_id = "..."

[[kv_namespaces]]
binding = "USER_METADATA_KV"
id = "..."
preview_id = "..."
```

**Environment Variables:**
```bash
USER_METADATA_KV_ID="..."
USER_METADATA_KV_PREVIEW_ID="..."
```

---

## Special Files

### `questions.json`
**Questionnaire definitions**

Located: Root directory

**Structure:**
```json
[
  {
    "id": 1,
    "text": "Question text",
    "type": "radio",
    "options": ["Option 1", "Option 2"],
    "required": true
  }
]
```

---

### `demo_questions.json`
**Demo questionnaire**

Used by: `demoquest.html`

---

### `session_check.php`
**PHP session validation**

---

### `login.php`
**PHP login handler**

---

### `logout.php`
**PHP logout handler**

---

### `save-questions.php`
**PHP questionnaire handler**

---

### `file_manager_api.php`
**PHP file manager API**

---

### `style.css`
**Legacy global styles**

---

### `jest.setup.js`
**Jest test setup**

---

### `global.d.ts`
**TypeScript global definitions**

---

### `mailer.d.ts`
**TypeScript mailer definitions**

---

### `typedoc.json`
**TypeDoc configuration**

```json
{
  "entryPoints": ["js/*.js"],
  "exclude": ["**/__tests__/**"],
  "out": "docs/api"
}
```

---

### `typedoc.tsconfig.json`
**TypeDoc TypeScript config**

---

## File Count Summary

| Category | Count |
|----------|-------|
| HTML pages | 29 |
| JavaScript files | 50+ |
| CSS files | 18 |
| Scripts | 17 |
| Documentation | 20+ |
| KV resources | 18+ |
| Tests | 45+ |
| **Total** | **~200 files** |

---

## Important Paths

### User-facing URLs
```
/                           → landing.html
/index.html                 → Dashboard (requires auth)
/quest.html                 → Questionnaire
/code.html                  → Nutrition plan
/assistant.html             → AI chat
/admin.html                 → Admin panel
/login.html                 → Login
/profile-edit.html          → Profile editing
```

### API URLs
```
/api/login                  → Authentication
/api/register               → Registration
/api/submitQuestionnaire    → Submit questionnaire
/api/generatePlan           → Generate plan
/api/log                    → Log meal
/api/batch-log              → Batch logging
/api/chat                   → AI chat
/api/analyzeImage           → Image analysis
... (60+ endpoints)
```

---

## Naming Conventions

### Files
- **HTML:** `kebab-case.html`
- **JavaScript:** `camelCase.js`
- **CSS:** `snake_case.css`
- **Scripts:** `kebab-case.js`
- **Docs:** `UPPERCASE_SNAKE.md`

### JavaScript
- **Functions:** `camelCase()`
- **Classes:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Private:** `_prefixed`

### CSS
- **Classes:** `kebab-case`
- **IDs:** `camelCase`
- **Variables:** `--kebab-case`

---

**Последна актуализация:** 2024-12-08  
**Версия:** 1.0.0
