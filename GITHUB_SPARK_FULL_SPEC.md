# 🎯 GitHub Spark - MyBody.Best Пълна Спецификация

## 🌟 ПРОЕКТНА ВИЗИЯ

**MyBody.Best** - Интелигентна AI-базирана платформа за персонализирано хранително планиране и здравен мониторинг.

**Слоган:** "Не програма, а система. Не съвет, а анализ. Не диета, а стратегия."

### Философия
✨ Максимална простота | 🎨 Изключителен дизайн | 💎 Отлична интеракция | ⚡ Висока ефективност

---

## 📊 ПРОЕКТНА СТАТИСТИКА

- **Код:** ~35,000 LOC
- **JavaScript:** 50+ модула (22,599 LOC)
- **HTML:** 40+ страници
- **CSS:** 16 модули (~3,000 LOC)
- **Backend:** 3 Cloudflare Workers
- **API:** 50+ endpoints
- **AI Модели:** 4 providers (Cloudflare, OpenAI, Gemini, Cohere)

---

## 🏗️ ТЕХНОЛОГИЧЕН СТЕК

### Frontend
```
Core:
- Vanilla JavaScript (ES Modules)
- Vite 6.3.5 (build + dev server)
- Node.js 18+
- Chart.js (visualization)

Styling:
- Custom CSS Variables система
- 16 модулни CSS файла
- Bootstrap Icons 1.11.3
- Font Awesome 6.4.0
- Google Fonts (Montserrat, Open Sans)
- Responsive Design (Mobile-First)

Features:
- 3 теми: Light ☀️, Dark 🌙, Vivid ✨
- Динамично theme switching
- Пълна персонализация на цветове
- Smooth animations
- PWA готовност
```

### Backend
```
Serverless Architecture (Cloudflare):
- worker.js (~3000 LOC) - Main API worker
- worker-backend.js - PHP proxy
- sendEmailWorker.js - Email delivery

Storage:
- RESOURCES_KV - AI configs, templates, recipes
- USER_METADATA_KV - User data, plans, logs
- CONTACT_REQUESTS_KV - Contact forms

Automation:
- Cron Triggers (hourly) - Plan regeneration, email queue
```

### AI Integration
```
Multi-Model Architecture:
├── Cloudflare AI
│   ├── llama-3-8b-instruct (chat)
│   ├── llama-3.2-11b-instruct (analysis)
│   └── llava-v1.6b (image analysis)
├── OpenAI GPT (plan generation)
├── Gemini Vision (image recognition)
└── Cohere command-r-plus (specialized analysis)
```

---

## 💎 КЛЮЧОВИ ФУНКЦИОНАЛНОСТИ

### 1. Authentication System
- Email/Password регистрация
- Bcrypt password hashing
- JWT session management
- Password reset flow
- Demo accounts

### 2. Интелигентен Въпросник
**questions.json (837 LOC)**
```
5 Секции, 40+ Въпроса:
├── Основни данни (име, пол, възраст, тегло, цел)
├── Хранителни навици (диети, водоприем, емоционално хранене)
├── Физическа активност (спорт, честота, интензитет)
├── Lifestyle (сън, стрес, хидратация)
└── Медицинско (диагнози, алергии, лекарства)

Features:
- Условна логика (dependsOn fields)
- Dynamic rendering
- Real-time validation
- Auto-save
- Progress tracking
```

### 3. AI-Генериран План
```
Plan Components:
├── Macro Requirements
│   ├── TDEE calculation (Mifflin-St Jeor)
│   ├── Калории, Протеини, Въглехидрати, Мазнини, Фибри
│   └── Percentage breakdown
├── Weekly Meal Plan (7 дни)
│   ├── Закуска, Обяд, Вечеря, Междинни хранения
│   └── Macro breakdown per meal
├── Workout Plan
│   └── Schedule, exercises, duration, intensity
└── Health Recommendations
    └── Water, sleep, stress management

AI Flow:
1. Questionnaire → submitQuestionnaire
2. AI анализ → Cloudflare AI
3. TDEE calc → BMR * activity_multiplier
4. Macro distribution → Protein/Carbs/Fat targets
5. Plan generation → OpenAI GPT
6. JSON validation → jsonrepair
7. KV storage → {userId}_plan
8. Email notification
9. Dashboard display
```

### 4. Interactive Dashboard (code.html)
```
5 Главни Панела:
├── 📊 Main Indexes
│   └── Тегло, BMI, TDEE, Active days
├── 📈 Detailed Analytics (Accordion)
│   └── Калории, Протеини, Въглехидрати, Мазнини, Фибри прогрес
├── 📅 Week Plan
│   └── Календар, Meal check-offs, Daily totals, Extra meals
├── 💡 Recommendations
│   └── AI съвети, Workout план, Водоприем, Сън
└── 👤 Profile
    └── User info, Goals, Weight chart, Edit

Interactive Features:
✓ Meal check-offs (click за отбелязване)
✓ Extra meal logging (форма + макроси)
✓ Weight tracking (Chart.js graph)
✓ Progress bars (color-coded)
✓ AI chat inline
✓ Plan modification (chat interface)
```

### 5. AI Chat Assistant
```
Capabilities:
├── Contextual responses (plan-aware)
├── Image analysis (upload → AI → calories/macros)
├── Multi-turn conversations (context retention)
├── Special commands (/analyze, /progress, /suggest)
└── Markdown rendering

Technical:
- File upload (Base64 encoding)
- Typing indicators
- Message history (KV storage)
- Multi-model support
```

### 6. Image Analysis Pipeline
```
1. Upload (drag-drop / file picker)
2. Resize/compress (client-side)
3. Base64 encode
4. POST /api/analyzeImage
5. AI inference (LLaVA / Gemini Vision)
6. Response: Detected foods, Calories, Macros, Suggestions
7. Optional: Auto-log as extra meal

Formats: JPEG, PNG, WebP (max 10MB)
```

### 7. Comprehensive Admin Panel
```
admin.html Sections:
├── 👥 Client Management
│   └── List, View, Edit, Delete, KV browser, Activity logs
├── 🤖 AI Configuration
│   └── Models, Prompts, Tokens, Temperature, Presets, Testing
├── 🎨 Theme Management
│   └── Light/Dark/Vivid editors, Color pickers, Export/Import, Preview
├── 📧 Email Configuration
│   └── Templates (7 types), Subject/Body editors, HTML preview, Test send
├── 🔧 System Settings
│   └── Maintenance mode, CORS, Rate limits, Feature flags
├── 📊 Analytics
│   └── Usage logs, Errors, API metrics, User stats
├── 💬 Communication
│   └── Admin queries, Client replies, Feedback, Notifications
└── 🧪 Testing Tools
    └── AI model test, Email test, Image analysis test, Questionnaire test
```

### 8. Plan Modification System
```
Workflow:
1. User открива Plan Mod Chat
2. Описва промяна (напр. "повече риба")
3. AI потвърждава
4. System създава event_planMod
5. Cron извлича event
6. AI регенерира план
7. Update {userId}_plan
8. Notification "План актуализиран!"

Features:
- Chat-based interface
- Auto regeneration
- Change history
- Context-aware AI
```

### 9. Extra Meal Logging
```
Form Fields:
- Описание (textarea)
- Количество (text)
- Време (time picker)
- Причина (dropdown)
- Усещане (dropdown)
- Макроси (опционално): Калории, Протеини, Въглехидрати, Мазнини
- Снимка (опционално)

Flow:
Upload image → AI analyze → Auto-fill macros → Submit → Update dashboard
```

### 10. Achievements & Gamification
```
Types:
├── Weight milestones (1kg, 5kg, goal reached)
├── Consistency (7-day, 30-day, 100-day streaks)
├── Macro precision (3 days, 7 days, perfect week)
└── Special (first workout, first image, first plan)

Features:
- Badge system
- AI-generated praise
- Progress tracking
- Notifications
```

### 11. Theme & Personalization
```
3 Built-in Themes:
- ☀️ Light
- 🌙 Dark
- ✨ Vivid (high-contrast)

Персонализация по табове:
├── Dashboard Colors
├── Index/Landing Colors
├── Quest Colors
└── Code Colors

Storage: LocalStorage (JSON)
Export/Import: Full theme JSON
Live Preview: Real-time updates
```

### 12. Локализация (i18n)
```
Current: 🇧🇬 Български (primary), 🇬🇧 English (partial)

System:
- JSON-based translations
- Dynamic language switching
- Placeholder interpolation
- Caching mechanism

Files: locales/*.json
```

---

## 🔗 API ARCHITECTURE (50+ Endpoints)

### Authentication (7)
```
POST /api/register, /api/registerDemo, /api/login
POST /api/requestPasswordReset, /api/performPasswordReset
GET  /api/getProfile
POST /api/updateProfile
```

### Dashboard & Data (6)
```
GET  /api/dashboardData, /api/planLog, /api/planStatus
POST /api/log, /api/log-extra-meal, /api/updatePlanData
```

### AI & Chat (6)
```
POST /api/chat, /api/aiHelper
POST /api/analyzeImage, /api/runImageModel
POST /api/generatePraise
```

### Plan Management (8)
```
POST /api/regeneratePlan
GET  /api/checkPlanPrerequisites, /api/getPlanModificationPrompt
POST /api/proposePlanChange, /api/approvePlanChange, /api/rejectPlanChange
GET  /api/getPendingPlanChanges
```

### Questionnaire (7)
```
POST /api/submitQuestionnaire, /api/submitDemoQuestionnaire
POST /api/reAnalyzeQuestionnaire
GET  /api/analysisStatus, /api/getInitialAnalysis
GET  /api/getAdaptiveQuiz
POST /api/submitAdaptiveQuiz
```

### Admin (15)
```
GET  /api/listClients, /api/listUserKv
POST /api/deleteClient, /api/updateKv
GET  /api/getAiConfig, /api/listAiPresets, /api/getAiPreset
POST /api/setAiConfig, /api/saveAiPreset, /api/testAiModel
POST /api/addAdminQuery
GET  /api/getAdminQueries, /api/peekAdminQueries, /api/peekAdminNotifications
```

### Communication (8)
```
POST /api/addClientReply
GET  /api/getClientReplies, /api/peekClientReplies
POST /api/submitFeedback, /api/recordFeedbackChat
GET  /api/getFeedbackMessages
POST /api/acknowledgeAiUpdate
```

### Email & System (6)
```
POST /api/sendTestEmail, /api/sendEmail
GET  /api/getMaintenanceMode
POST /api/setMaintenanceMode, /api/updateStatus
GET  /api/getAchievements
```

---

## 💾 DATA MODEL (KV Storage)

### RESOURCES_KV (Shared)
```
AI Configuration (30+ keys):
- model_*, prompt_*, *_token_limit, *_temperature

Email Templates (14 keys):
- welcome_email_*, questionnaire_email_*, analysis_email_*
- password_reset_email_*, send_*_email flags

Data:
- question_definitions, recipe_data
- allowed_meal_combinations, base_diet_model, eating_psychology

Settings:
- maintenance_page
```

### USER_METADATA_KV (Per User)
```
Per User (~15 keys):
├── {userId}_profile
├── {userId}_plan
├── {userId}_analysis + _status
├── {userId}_questionnaire
├── {userId}_log_{date}
├── {userId}_weight_log
├── {userId}_extra_meals
├── {userId}_achievements
├── {userId}_analysis_macros
├── {userId}_last_praise_analytics
├── {userId}_adaptive_quiz_{timestamp}
├── {userId}_kv_index
└── {userId}_password_reset_token
```

---

## 🔐 SECURITY

### Authentication
- Bcrypt password hashing (cost=10)
- JWT tokens със expiration
- Session validation
- CSRF protection

### Authorization
- Role-based access (admin/user)
- WORKER_ADMIN_TOKEN за sensitive ops
- Rate limiting per endpoint

### Rate Limits
```
/api/sendEmail:          5 requests/hour
/api/chat:               30 requests/minute
/api/analyzeImage:       10 requests/hour
/api/submitQuestionnaire: 3 requests/hour
Default:                 100 requests/minute
```

### Data Protection
- Input sanitization (htmlSanitizer.js)
- XSS prevention
- CORS whitelist
- Secure KV storage

---

## ⚙️ AUTOMATION (Cron Jobs)

### Cloudflare Cron (Hourly)
```
Automated Tasks:
├── Process Events
│   ├── event_planMod → Regenerate plan
│   ├── event_adaptiveQuiz → Generate quiz
│   └── event_principleAdj → Adjust principles
├── Email Queue Processing
├── Cleanup Tasks
│   ├── Expired reset tokens
│   ├── Old logs (>90 days)
│   └── Temporary KV entries
└── Analytics Updates
```

---

## 🎨 DESIGN SYSTEM

### Color Palette (CSS Variables)
```css
:root {
  /* Primary */
  --primary-color: #5BC0BE;
  --secondary-color: #FFD166;
  --accent-color: #FF6B6B;
  
  /* Macro Colors */
  --macro-protein-color: #5BC0BE;
  --macro-carbs-color: #FFD166;
  --macro-fat-color: #FF6B6B;
  
  /* Spacing (8px base) */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
}
```

### Typography
- **Headings:** Montserrat (300-800)
- **Body:** Open Sans (300-600)
- **Scale:** Modular 1.25 ratio

### Components
Cards, Buttons (3 variants), Forms, Modals, Notifications, Charts, Progress Bars, Badges, Tabs, Accordions

### Responsive Breakpoints
576px (small), 768px (tablet), 992px (desktop), 1200px (large)

---

## 🧪 TESTING

### Stack
```
Jest 29.7.0
├── jest-environment-jsdom (DOM testing)
├── @testing-library/dom (queries)
└── timezone-mock (date testing)

Test Files (10+):
- macroUtils.test.js
- extraMealForm.test.js
- adminConfig.test.js
- ... (and more)

Commands:
npm test              # All tests
npm run test:watch   # Watch mode
npm run coverage     # Coverage report
```

---

## 🚀 BUILD & DEPLOYMENT

### Development
```bash
npm run dev       # Vite dev (localhost:5173)
npm run lint      # ESLint
npm test          # Jest tests
npm run docs      # TypeDoc
```

### Production
```bash
npm run build     # Vite build → dist/
npm run start     # Preview
npm run deploy    # Cloudflare Workers deploy + macros migration
```

### Environment Variables
```
Required Secrets:
- GEMINI_API_KEY, OPENAI_API_KEY
- CF_AI_TOKEN, command-r-plus (Cohere)
- PHP_FILE_API_URL, PHP_FILE_API_TOKEN
- FROM_EMAIL, FROM_NAME

Optional:
- WORKER_ADMIN_TOKEN
- MAILER_ENDPOINT_URL, MAIL_PHP_URL
- MAINTENANCE_MODE (0/1)
- ALLOWED_ORIGINS (CSV)
```

---

## 📦 DEPENDENCIES

### Production (2)
```json
{
  "dotenv": "^16.5.0",
  "jsonrepair": "^3.12.0"
}
```

### Dev (12)
```json
{
  "@cloudflare/workers-types": "^4.20250627.0",
  "vite": "^6.3.5",
  "jest": "^29.7.0",
  "eslint": "^9.32.0",
  "typedoc": "^0.28.5",
  // ... (and 7 more)
}
```

### CDN
Bootstrap Icons, Font Awesome, Google Fonts

---

## 🎯 GITHUB SPARK MIGRATION STRATEGY

### 100% Функционалност (MUST HAVE)
✅ Всички 50+ API endpoints
✅ AI интеграция (4 models)
✅ Пълен въпросник (837 LOC)
✅ Dashboard (5 панела)
✅ Chat + Image analysis
✅ Admin панел (всички секции)
✅ Theme system (3 themes)
✅ Персонализация
✅ Email система (7 типа)
✅ Achievements
✅ Plan modification
✅ Extra meal logging
✅ Weight tracking
✅ Локализация (BG/EN)

### Препоръчани Оптимизации (Без загуба на features)

#### Performance
- Code splitting (dynamic imports)
- Service Worker (offline support)
- WebSocket за real-time chat
- IndexedDB за storage
- Image lazy loading
- CSS purging

#### UX
- Skeleton loaders
- Optimistic updates
- Smooth transitions
- Better error states
- Loading indicators

#### Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support
- Contrast improvements (WCAG AA)

#### Testing
- Увеличаване на coverage (target: 80%+)
- E2E tests (Playwright)
- Visual regression tests
- Performance benchmarks

#### Developer Experience
- TypeScript migration (опционално)
- Better error messages
- Debug панел (dev only)
- Hot reload improvements

### Модулна Структура за Spark
```
GitHub Spark Modules:
├── Auth Module (Login, Register, Reset)
├── Questionnaire Module (Forms, Validation)
├── AI Module (Chat, Image, Plan Gen)
├── Dashboard Module (Panels, Charts)
├── Admin Module (Management, Config)
├── Theme Module (Switching, Customization)
└── Shared Module (Components, Utils, API)
```

### State Management
```javascript
// Centralized store (Zustand / Context API)
const useStore = create((set) => ({
  user: null,
  plan: null,
  theme: 'light',
  // ...
}));

// Persistent: localStorage / IndexedDB
```

---

## ⚠️ КРИТИЧНИ КОМПОНЕНТИ (НЕ МОГАТ ДА ЛИПСВАТ)

### Backend
1. **worker.js** (3000+ LOC) - Core API logic
2. **Macro calculations** - Plan mathematics
3. **AI prompts** - Quality depends on them
4. **Email templates** - User communication
5. **KV structure** - Data integrity

### Frontend
1. **questions.json** (837 LOC) - Questionnaire structure
2. **Dashboard панели** - All 5 essential
3. **Theme система** - Core UX
4. **Chart.js** - Data visualization
5. **Image upload/analysis** - Unique feature

### AI Integration
1. **Multi-model support** - Cannot reduce to 1 model
2. **Context retention** - Quality chat
3. **Image analysis pipeline** - Critical functionality
4. **Plan generation prompts** - AI quality

---

## 🏁 ЗАКЛЮЧЕНИЕ

**MyBody.Best** е **production-ready** платформа с:

✅ **AI Intelligence** (4 providers, 6+ models)
✅ **Modern UI/UX** (responsive, themeable, accessible)
✅ **Serverless Backend** (edge computing, KV storage)
✅ **Data Visualization** (Chart.js, custom components)
✅ **Security** (auth, rate limiting, CSRF)
✅ **Scalability** (caching, CDN)
✅ **Testing** (Jest, 10+ test suites)
✅ **Documentation** (comprehensive)

### За GitHub Spark

**Архитектура:**
- 🔧 Модулна и добре структурирана
- 📦 Готова за component extraction
- ⚡ Оптимизирана за performance
- 🎨 Ясна дизайн система
- 🧪 Solid testing foundation

**Migration:**
- **Сложност:** Medium-High (AI integration, 50+ endpoints)
- **Време:** 2-3 седмици full-time
- **Risk:** Low (structured code, good docs)
- **Функционалност:** 100% запазване + подобрения

---

## 📋 MIGRATION CHECKLIST

### Phase 1: Core (Week 1)
- [ ] Auth system
- [ ] Questionnaire (full logic)
- [ ] Dashboard (all panels)
- [ ] Theme switching
- [ ] API client

### Phase 2: AI (Week 1-2)
- [ ] AI integration (all models)
- [ ] Chat assistant
- [ ] Image analysis
- [ ] Plan generation/modification

### Phase 3: Advanced (Week 2)
- [ ] Admin panel (all sections)
- [ ] Email system
- [ ] Achievements
- [ ] Extra meal logging

### Phase 4: Polish (Week 3)
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Testing (E2E, coverage)
- [ ] Documentation

### Enhancements (Post-Launch)
- [ ] Code splitting
- [ ] Service Worker
- [ ] WebSocket chat
- [ ] TypeScript migration
- [ ] Component library

---

**Версия:** 1.0
**Дата:** 2025-01-11
**Автор:** Comprehensive Analysis for GitHub Spark Migration

**ВАЖНО:** Документът е пълна спецификация за GitHub Spark конвертиране със запазване на 100% функционалност + подобрения в performance и UX.
