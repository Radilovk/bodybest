# Module Map - Карта на модулите

> Детайлно описание на всеки JavaScript модул, неговото предназначение, зависимости и API.

## Съдържание

1. [Core Modules](#core-modules)
2. [Authentication](#authentication)
3. [Data Management](#data-management)
4. [Analytics & Planning](#analytics--planning)
5. [UI Components](#ui-components)
6. [Chat & AI](#chat--ai)
7. [Forms](#forms)
8. [Admin](#admin)
9. [Utilities](#utilities)

---

## Core Modules

### `js/app.js`
**Отговорност:** Главна инициализация на dashboard приложението

**Експорти:**
```javascript
initApp()                    // Стартира приложението
checkAuthAndRedirect()       // Проверява authentication
```

**Зависимости:**
- `auth.js` - Authentication
- `populateUI.js` - UI population
- `uiHandlers.js` - Event handlers
- `offlineLogSync.js` - Offline logging

**Използване:**
```javascript
import { initApp } from './app.js';
await initApp();
```

---

### `js/config.js`
**Отговорност:** Централизирани конфигурационни константи

**Експорти:**
```javascript
apiEndpoints = {
  login: '/api/login',
  register: '/api/register',
  generatePlan: '/api/generatePlan',
  log: '/api/log',
  batchLog: '/api/batch-log',
  // ... 60+ endpoints
}

initialBotMessage = "Здравей! Аз съм твоят AI асистент..."
```

**Динамични настройки:**
```javascript
window.USE_LOCAL_PROXY = true;  // Локален proxy
window.WORKER_URL = 'https://...';  // Custom worker URL
```

---

### `js/utils.js`
**Отговорност:** Общи utility функции

**Експорти:**
```javascript
debounce(func, delay)           // Debounce функция
throttle(func, limit)           // Throttle функция
formatDate(date, format)        // Форматиране на дата
getLocalDate()                  // Локална дата като YYYY-MM-DD
validateEmail(email)            // Email валидация
sanitizeHTML(html)              // XSS защита
deepClone(obj)                  // Deep clone на обект
```

**Примери:**
```javascript
import { debounce, getLocalDate } from './utils.js';

const handleSearch = debounce((query) => {
  console.log('Searching:', query);
}, 300);

const today = getLocalDate(); // "2024-12-08"
```

---

## Authentication

### `js/auth.js`
**Отговорност:** Core authentication логика

**Експорти:**
```javascript
login(email, password)          // Вход
logout()                        // Изход
isAuthenticated()               // Проверка
getCurrentUser()                // Текущ потребител
refreshToken()                  // Обновяване на токен
```

**localStorage ключове:**
- `userId` - User ID
- `userEmail` - Email
- `userName` - Name
- `sessionToken` - Session token (optional)

**Примери:**
```javascript
import { login, logout, isAuthenticated } from './auth.js';

// Login
const result = await login('user@example.com', 'password123');
if (result.success) {
  window.location.href = '/index.html';
}

// Check auth
if (!isAuthenticated()) {
  window.location.href = '/login.html';
}

// Logout
logout();
```

---

### `js/authModal.js`
**Отговорност:** Login/Register modal логика (за landing page)

**Експорти:**
```javascript
setupAuthModal()                // Setup modal handlers
showLoginModal()                // Показва login form
showRegisterModal()             // Показва register form
closeAuthModal()                // Затваря modal
```

**Lazy Loading:**
Модулът се зарежда динамично от `script.js`:
```javascript
async function showAuthModal() {
  const { setupAuthModal } = await import('./js/authModal.js');
  setupAuthModal();
}
```

---

### `js/register.js`
**Отговорност:** Registration form логика

**Експорти:**
```javascript
setupRegistration(formSelector, messageSelector)
validateRegistrationForm(formData)
```

**Използване в HTML:**
```html
<script type="module">
  import { setupRegistration } from './js/register.js';
  setupRegistration('#register-form', '#register-message');
</script>
```

---

## Data Management

### `js/offlineLogSync.js`
**Отговорност:** Offline-first logging система (singleton)

**Експорти:**
```javascript
class OfflineLogSync {
  constructor(options)
  addLog(logData)                    // Добавя лог (instant)
  startAutoSync(endpoint)            // Стартира auto sync
  stopAutoSync()                     // Спира auto sync
  syncNow(endpoint)                  // Синхронизира веднага
  hasPendingLogs()                   // Има ли pending логове
  getPendingCount()                  // Брой pending логове
  clearAllPending()                  // Изчиства всички
}

getOfflineLogSync(options = {})      // Factory (singleton)
```

**Конфигурация:**
```javascript
import { getOfflineLogSync } from './offlineLogSync.js';

const sync = getOfflineLogSync({
  storageKey: 'bodybest_pending_logs',
  syncInterval: 30000,              // 30 seconds
  maxBatchSize: 50,
  onSyncSuccess: (result) => console.log('Synced:', result.count),
  onSyncError: (error) => console.error('Sync failed:', error),
  onSyncStatusChange: (status) => updateUI(status)
});

sync.startAutoSync('/api/batch-log');
```

**События:**
```javascript
window.addEventListener('offlineSyncStatus', (e) => {
  console.log('Status:', e.detail.status); // 'syncing' | 'online' | 'error'
  console.log('Pending:', e.detail.pending);
});
```

**localStorage:**
- `bodybest_pending_logs` - Array от pending логове

---

### `js/requestCache.js`
**Отговорност:** Persistent caching система

**Експорти:**
```javascript
class PersistentCache {
  constructor(storageKey, defaultTTL)
  get(key)                           // Взема от кеш
  set(key, value, ttl)               // Записва в кеш
  invalidate(keyPrefix)              // Invalidate по префикс
  clear()                            // Изчиства всичко
  getStats()                         // Статистика
}

getDashboardCache()                  // Dashboard cache (singleton)
getProfileCache()                    // Profile cache (singleton)
```

**Използване:**
```javascript
import { getDashboardCache } from './requestCache.js';

const cache = getDashboardCache();

// Get от кеш
const cached = cache.get(`dashboard:${userId}`);
if (cached) {
  renderDashboard(cached);
  return cached;
}

// Fetch и cache
const data = await fetch(`/api/dashboardData?userId=${userId}`)
  .then(r => r.json());
cache.set(`dashboard:${userId}`, data, 300000); // 5 min

// Invalidate след log
cache.invalidate(`dashboard:${userId}`);
```

**localStorage:**
- `bodybest_dashboard_cache` - Dashboard data
- `bodybest_profile_cache` - Profile data

---

### `js/safeStorage.js`
**Отговорност:** localStorage quota management

**Експорти:**
```javascript
class SafeStorage {
  static safeSetItem(key, value, options)
  static safeGetItem(key)
  static safeRemoveItem(key)
  static getQuotaInfo()
  static clearOldEntries(namespace, keepPercent)
}

safeSetItem(key, value, options)    // Wrapper function
safeGetItem(key)
```

**Използване:**
```javascript
import { safeSetItem, safeGetItem } from './safeStorage.js';

// Safe set (auto eviction при пълен storage)
const result = safeSetItem('myKey', largeData, {
  critical: false,        // Може да се evict
  showWarning: true       // Показва UI warning
});

if (!result.success) {
  console.error('Storage failed:', result.error);
}

// Get
const data = safeGetItem('myKey');
```

**Автоматично управление:**
- Evict до 30% от старите записи при пълен storage
- Fallback към sessionStorage
- User warnings

---

### `js/logger.js`
**Отговорност:** Централизиран logging система

**Експорти:**
```javascript
class Logger {
  static log(message, data)
  static warn(message, data)
  static error(message, data)
  static debug(message, data)
}

log(message, data)
warn(message, data)
error(message, data)
```

**Конфигурация:**
```javascript
window.DEBUG_MODE = true;  // Включва debug logging
```

---

## Analytics & Planning

### `js/macroUtils.js`
**Отговорност:** Macro calculations & utilities

**Експорти:**
```javascript
calculateCurrentMacros(dailyLog)         // Изчислява текущи макроси
calculateMacroPercentages(macros)        // % разпределение
validateMacros(macros)                   // Валидация
formatMacros(macros)                     // Форматиране
compareMacros(plan, current)             // Сравнение
```

**Примери:**
```javascript
import { calculateCurrentMacros } from './macroUtils.js';

const dailyLog = {
  meals: {
    breakfast: { consumed: true, calories: 500 },
    lunch: { consumed: true, calories: 700 }
  },
  extraMeals: [
    { calories: 200, protein_grams: 20, carbs_grams: 10, fat_grams: 8 }
  ]
};

const current = calculateCurrentMacros(dailyLog);
// { calories: 1400, protein_grams: 95, carbs_grams: 140, fat_grams: 42 }
```

---

### `js/planGeneration.js`
**Отговорност:** План генериране и обновяване

**Експорти:**
```javascript
generatePlan(userId)                     // Генерира нов план
regeneratePlan(userId)                   // Пълно регенериране
checkPlanStatus(userId)                  // Проверка на статус
loadPlan(userId)                         // Зарежда план
```

**Примери:**
```javascript
import { generatePlan, checkPlanStatus } from './planGeneration.js';

// Генериране
const result = await generatePlan(userId);
if (result.success) {
  console.log('Plan generated:', result.plan);
}

// Проверка на статус
const status = await checkPlanStatus(userId);
if (status === 'done') {
  const plan = await loadPlan(userId);
}
```

---

### `js/planEditor.js`
**Отговорност:** Редактиране и визуализация на план

**Експорти:**
```javascript
setupPlanEditor()                        // Setup editor
renderPlan(plan)                         // Рисува план
editMeal(mealId)                         // Редактира хранене
savePlanChanges()                        // Записва промени
```

---

### `js/planModChat.js`
**Отговорност:** Форма за заявка за промяна на плана (свободен текст)

**Експорти:**
```javascript
openPlanModificationChat()               // Отваря формата с насоки
handlePlanModChatSend()                  // Изпраща заявката към API
clearPlanModChat()                       // Нулира формата
```

**Интеграция:**
```javascript
import { openPlanModificationChat } from './planModChat.js';

document.getElementById('planModificationBtn')
  ?.addEventListener('click', openPlanModificationChat);
```

**API:**
- Изпраща към `/api/submitPlanChangeRequest`
- Приема финален план и BMI ограничения директно, без cron опашка

---

### `js/planRegenerator.js`
**Отговорност:** UI за plan regeneration

**Експорти:**
```javascript
setupRegenerateButton()                  // Setup button
confirmRegenerate()                      // Confirmation dialog
startRegeneration()                      // Стартира процес
```

---

### `js/metricUtils.js`
**Отговорност:** Health metrics calculations

**Експорти:**
```javascript
calculateBMI(weight, height)             // BMI изчисление
calculateBMR(weight, height, age, gender)// BMR изчисление
calculateTDEE(bmr, activityLevel)        // TDEE изчисление
calculateBodyFat(measurements)           // Body fat %
```

---

## UI Components

### `js/uiHandlers.js`
**Отговорност:** Event handlers за dashboard

**Експорти:**
```javascript
setupEventListeners()                    // Setup всички listeners
handleMealClick(mealId)                  // Handle meal click
handleLogSubmit(formData)                // Handle log form
handleThemeToggle()                      // Handle theme button
```

**Зависимости:**
- `offlineLogSync.js` - За logging
- `themeControls.js` - За теми
- `populateUI.js` - За UI update

---

### `js/uiElements.js`
**Отговорност:** DOM manipulation utilities

**Експорти:**
```javascript
showElement(selector)                    // Показва елемент
hideElement(selector)                    // Скрива елемент
toggleElement(selector)                  // Toggle visibility
updateTextContent(selector, text)        // Update текст
addClass(selector, className)            // Добавя клас
removeClass(selector, className)         // Премахва клас
```

---

### `js/themeControls.js`
**Отговорност:** Тема switching логика

**Експорти:**
```javascript
initTheme()                              // Инициализира тема
toggleTheme()                            // Cycle теми
setTheme(theme)                          // Задава конкретна тема
getCurrentTheme()                        // Текуща тема
applyTheme(theme)                        // Прилага тема
```

**Теми:**
- `light` - Светла тема
- `dark` - Тъмна тема
- `vivid` - Ярка тема
- `system` - Системна настройка

**localStorage:**
- `theme` - Избрана тема

**Използване:**
```javascript
import { initTheme, toggleTheme } from './themeControls.js';

// Init
initTheme();

// Toggle button
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
```

---

### `js/themeConfig.js`
**Отговорност:** Theme definitions and configuration

**Експорти:**
```javascript
themeCategories = {
  primary: ['--primary-color', '--secondary-color', ...],
  background: ['--bg-color', '--card-bg', ...],
  text: ['--text-color', '--text-muted', ...],
  // ... още категории
}

defaultThemes = {
  light: { /* CSS variables */ },
  dark: { /* CSS variables */ },
  vivid: { /* CSS variables */ }
}

getCategoryColors(theme, category)
getAllThemeColors(theme)
```

---

### `js/themeStorage.js`
**Отговорност:** Theme persistence

**Експорти:**
```javascript
saveTheme(theme)                         // Записва тема
loadTheme()                              // Зарежда тема
saveCustomColors(colors)                 // Custom цветове
loadCustomColors()                       // Зарежда custom
```

---

### `js/highContrastMode.js`
**Отговорност:** High contrast accessibility mode

**Експорти:**
```javascript
toggleHighContrast()                     // Toggle режим
isHighContrastEnabled()                  // Проверка
applyHighContrast()                      // Прилага режим
```

**localStorage:**
- `highContrast` - "true" | "false"

**CSS:**
Добавя `high-contrast` class към `<body>`

---

### `js/onboardingWizard.js`
**Отговорност:** Onboarding wizard за нови потребители

**Експорти:**
```javascript
class OnboardingWizard {
  constructor(options)
  show()                                 // Показва wizard
  nextStep()                             // Следваща стъпка
  prevStep()                             // Предишна стъпка
  complete()                             // Завършва wizard
  static reset()                         // Reset wizard
}

showOnboardingIfNeeded(options)         // Helper функция
```

**Стъпки:**
1. Welcome
2. Theme Selection
3. Goal Selection (Cutting/Bulking/Maintenance)
4. Offline Features
5. Complete

**localStorage:**
- `onboardingCompleted` - "true"
- `onboardingConfig` - JSON с избор

**Използване:**
```javascript
import { showOnboardingIfNeeded } from './onboardingWizard.js';

showOnboardingIfNeeded({
  onComplete: (config) => {
    console.log('Selected:', config.theme, config.goal);
    window.location.href = '/quest.html';
  }
});
```

---

### `js/syncStatusIndicator.js`
**Отговорност:** Sync status visual indicator

**Експорти:**
```javascript
class SyncStatusIndicator {
  constructor()
  updateStatus(status)                   // Update статус
  show()                                 // Показва indicator
  hide()                                 // Скрива indicator
}

getSyncStatusIndicator()                 // Factory (singleton)
```

**Статуси:**
- `online` 🟢 - Синхронизирано
- `offline` ⚪ - Offline режим
- `syncing` 🔵 - Синхронизира
- `error` 🟡 - Грешка

**CSS:**
Indicator в долния десен ъгъл

**Интеграция:**
```javascript
import { getSyncStatusIndicator } from './syncStatusIndicator.js';
import { getOfflineLogSync } from './offlineLogSync.js';

const indicator = getSyncStatusIndicator();

const sync = getOfflineLogSync({
  onSyncStatusChange: (status) => {
    indicator.updateStatus(status);
  }
});
```

---

### `js/stepProgress.js`
**Отговорност:** Multi-step form progress indicator

**Експорти:**
```javascript
class StepProgress {
  constructor(totalSteps)
  setStep(step)                          // Задава текуща стъпка
  nextStep()                             // Напред
  prevStep()                             // Назад
  reset()                                // Reset
}
```

**Използване в въпросник:**
```javascript
import { StepProgress } from './stepProgress.js';

const progress = new StepProgress(5);
progress.setStep(1);

// Next
progress.nextStep(); // → step 2
```

---

### `js/populateUI.js`
**Отговорност:** Dashboard UI population

**Експорти:**
```javascript
populateDashboard(userData)              // Попълва dashboard
populateMacros(macros)                   // Макроси карти
populateProgress(progress)               // Прогрес секция
populateMeals(meals)                     // Хранения
updateCalorieBar(current, target)        // Калории bar
```

---

### `js/macroAnalyticsCardComponent.js`
**Отговорност:** Macro analytics web component

**Експорти:**
```javascript
class MacroAnalyticsCard extends HTMLElement {
  // Web component
}

renderMacroAnalyticsCard(plan, current)  // Helper функция
renderMacroChart()                       // Chart.js график
```

**HTML:**
```html
<macro-analytics-card
  exceed-threshold="1.15"
  plan-data='{"calories":2000,...}'
  current-data='{"calories":1500,...}'>
</macro-analytics-card>
```

---

### `js/templateLoader.js`
**Отговорност:** HTML template loading

**Експорти:**
```javascript
loadTemplateInto(url, containerId)       // Зарежда template
sanitizeTemplate(html)                   // Sanitize HTML
```

**Примери:**
```javascript
import { loadTemplateInto } from './templateLoader.js';

await loadTemplateInto('/profileTemplate.html', 'profile-container');
```

---

### `js/partialLoader.js`
**Отговорност:** Partial HTML loading

**Експорти:**
```javascript
loadPartial(path, targetId)              // Зарежда partial
```

---

## Chat & AI

### `js/chat.js`
**Отговорност:** Main dashboard chat

**Експорти:**
```javascript
initChat()                               // Инициализира chat
sendMessage(message)                     // Изпраща съобщение
receiveMessage(message)                  // Получава отговор
clearChat()                              // Изчиства история
```

**localStorage:**
- `chatHistory` - Array от съобщения

**API:**
- POST `/api/chat`

---

### `js/assistantChat.js`
**Отговорност:** Standalone assistant page chat

**Експорти:**
```javascript
setupAssistantChat()                     // Setup chat UI
sendAssistantMessage(message, image)     // Изпраща съобщение
uploadImage(file)                        // Upload изображение
```

**Функции:**
- Text chat
- Image upload + analysis
- File attachments

---

### `js/messageUtils.js`
**Отговорност:** Chat message utilities

**Експорти:**
```javascript
formatMessage(message, type)             // Форматира съобщение
renderMessage(message, container)        // Рисува съобщение
parseMarkdown(text)                      // Markdown parsing
escapeHTML(text)                         // HTML escape
```

---

## Forms

### `js/questionnaireCore.js`
**Отговорност:** Questionnaire логика и валидация

**Експорти:**
```javascript
class QuestionnaireCore {
  constructor(questions)
  validateAnswers(answers)               // Валидация
  calculateProgress()                    // Прогрес %
  submitAnswers(answers)                 // Submit към API
}

setupQuestionnaire()                     // Helper функция
```

**Използване:**
```javascript
import { setupQuestionnaire } from './questionnaireCore.js';

const questionnaire = setupQuestionnaire({
  onSubmit: async (answers) => {
    const result = await fetch('/api/submitQuestionnaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    }).then(r => r.json());
    
    if (result.success) {
      window.location.href = '/analyze.html?userId=' + userId;
    }
  }
});
```

---

### `js/extraMealForm.js`
**Отговорност:** Extra meal logging form

**Експорти:**
```javascript
setupExtraMealForm()                     // Setup form
openExtraMealModal()                     // Отваря modal
closeExtraMealModal()                    // Затваря modal
submitExtraMeal(data)                    // Submit към API
```

**API:**
- POST `/api/log-extra-meal`

**Полета:**
- description
- time
- calories
- protein_grams
- carbs_grams
- fat_grams
- reason
- feeling

---

### `js/contactForm.js`
**Отговорност:** Contact form handling

**Експорти:**
```javascript
setupContactForm()                       // Setup form
validateContactForm(data)                // Валидация
submitContactForm(data)                  // Submit към API
```

---

## Admin

### `js/admin.js`
**Отговорност:** Main admin panel logic

**Експорти:**
```javascript
initAdminPanel()                         // Инициализира панел
loadAdminData()                          // Зарежда данни
refreshStats()                           // Refresh статистика
checkNewQueries()                        // Проверка за нови заявки
```

**Секции:**
- AI Configuration
- Email Settings
- Theme Editor
- User Management
- Maintenance Mode

---

### `js/adminConfig.js`
**Отговорност:** AI models configuration UI

**Експорти:**
```javascript
setupAiConfig()                          // Setup UI
loadAiConfig()                           // Зарежда config
saveAiConfig(config)                     // Записва config
testAiModel(model)                       // Тества модел
```

**API:**
- GET `/api/getAiConfig`
- POST `/api/setAiConfig`
- POST `/api/testAiModel`

**Модели:**
```javascript
{
  model_chat: '@cf/meta/llama-3-8b-instruct',
  model_plan_generation: 'gemini-1.5-pro',
  model_image_analysis: '@cf/llava-hf/llava-v1.6b',
  prompt_chat: 'System prompt...',
  chat_token_limit: 2000,
  chat_temperature: 0.3,
  // ... etc
}
```

---

### `js/adminColors.js`
**Отговорност:** Theme color editor UI

**Експорти:**
```javascript
setupColorEditor()                       // Setup editor
loadColorTheme(theme)                    // Зарежда тема
saveColorTheme(theme, colors)            // Записва тема
previewColors(colors)                    // Preview промени
exportTheme(theme)                       // Export JSON
importTheme(json)                        // Import JSON
```

**Функции:**
- Visual color picker
- Category organization
- Live preview
- Export/Import
- Opacity sliders

---

### `js/maintenanceMode.js`
**Отговорност:** Maintenance mode UI

**Експорти:**
```javascript
checkMaintenanceMode()                   // Проверка
enableMaintenanceMode()                  // Включва
disableMaintenanceMode()                 // Изключва
```

**API:**
- GET `/api/getMaintenanceMode`
- POST `/api/setMaintenanceMode`

---

## Utilities

### `js/htmlSanitizer.js`
**Отговорност:** HTML sanitization за XSS защита

**Експорти:**
```javascript
sanitizeHTML(html)                       // Sanitize HTML
escapeHTML(text)                         // Escape text
stripTags(html)                          // Премахва tags
```

---

### `js/debounce.js`
**Отговорност:** Debounce utility

**Експорти:**
```javascript
debounce(func, delay)                    // Debounce function
```

---

### `js/swipeUtils.js`
**Отговорност:** Touch swipe detection

**Експорти:**
```javascript
setupSwipeDetection(element, callbacks)  // Setup swipe
detectSwipeDirection(startX, endX)       // Detect direction
```

---

### `js/tooltipState.js`
**Отговорност:** Tooltip state management

**Експорти:**
```javascript
showTooltip(element, text)               // Показва tooltip
hideTooltip(element)                     // Скрива tooltip
```

---

### `js/chartLoader.js`
**Отговорност:** Chart.js lazy loading

**Експорти:**
```javascript
loadChartJS()                            // Зарежда Chart.js
createChart(canvas, config)              // Създава chart
```

---

### `js/loading.js`
**Отговорност:** Loading indicators

**Експорти:**
```javascript
showLoading(message)                     // Показва loading
hideLoading()                            // Скрива loading
setLoadingMessage(message)               // Update текст
```

---

### `js/labelMap.js`
**Отговорност:** Label mapping за questions

**Експорти:**
```javascript
getLabelForQuestion(questionId)          // Взема label
formatQuestionLabel(question)            // Форматира label
```

---

### `js/macroCardLocales.js`
**Отговорност:** Macro card локализация

**Експорти:**
```javascript
loadLocale(lang)                         // Зарежда език
getLabel(key)                            // Взема превод
```

**Поддържани езици:**
- `bg` - Български
- `en` - English

**Файлове:**
- `locales/macroCard.bg.json`
- `locales/macroCard.en.json`

---

### `js/eventListeners.js`
**Отговорност:** Централизирано event setup

**Експорти:**
```javascript
setupGlobalListeners()                   // Global listeners
removeAllListeners()                     // Cleanup
```

---

### `js/initProfilePage.js`
**Отговорност:** Profile page initialization

**Експорти:**
```javascript
initProfilePage()                        // Init страница
loadProfileData(userId)                  // Зарежда данни
```

---

### `js/profileEdit.js`
**Отговорност:** Profile editing logic

**Експорти:**
```javascript
setupProfileEdit()                       // Setup форма
saveProfileChanges(data)                 // Записва промени
validateProfileData(data)                // Валидация
```

---

### `js/clientProfile.js`
**Отговорност:** Client profile page (за admin)

**Експорти:**
```javascript
setupClientProfile(clientId)             // Setup страница
loadClientData(clientId)                 // Зарежда данни
```

---

### `js/editClient.js`
**Отговорност:** Edit client form (за admin)

**Експорти:**
```javascript
setupEditClient(clientId)                // Setup форма
saveClientChanges(data)                  // Записва промени
```

---

### `js/achievements.js`
**Отговорност:** Achievements система

**Експорти:**
```javascript
loadAchievements(userId)                 // Зарежда постижения
unlockAchievement(userId, achievementId) // Unlock постижение
renderAchievements(achievements)         // Рисува UI
```

**API:**
- GET `/api/getAchievements`

---

### `js/userProfiles.js`
**Отговорност:** User profile templates

**Експорти:**
```javascript
getAllProfiles()                         // Всички profiles
applyProfile(profileId)                  // Прилага profile
createProfileFromCurrent(name, desc)     // Създава нов
exportProfile(profileId)                 // Export JSON
importProfile(json, name)                // Import JSON
```

**Predefined profiles:**
- `cutting` - Cutting профил
- `bulking` - Bulking профил
- `maintenance` - Maintenance профил

**localStorage:**
- `userProfiles` - Array от profiles

---

### `js/integrationExample.js`
**Отговорност:** Example integration код

**Експорти:**
```javascript
exampleUsage()                           // Показва примери
```

---

## Testing Helpers

### `js/testHelpers/`

#### `mockFetch.js`
```javascript
mockFetch(responses)                     // Mock fetch calls
```

#### `mockLocalStorage.js`
```javascript
mockLocalStorage()                       // Mock localStorage
```

#### `setupTestEnvironment.js`
```javascript
setupTestEnvironment()                   // Setup Jest env
cleanupTestEnvironment()                 // Cleanup
```

---

## Module Dependencies Graph

```
app.js
├── auth.js
├── config.js
├── populateUI.js
│   ├── macroUtils.js
│   └── uiElements.js
├── uiHandlers.js
│   ├── offlineLogSync.js
│   │   ├── safeStorage.js
│   │   └── logger.js
│   ├── themeControls.js
│   │   ├── themeConfig.js
│   │   └── themeStorage.js
│   └── chat.js
│       └── messageUtils.js
└── onboardingWizard.js
    └── stepProgress.js
```

---

## Best Practices

### Import/Export Style
```javascript
// Named exports
export function myFunction() { }
export const myConst = 123;

// Default export (за classes)
export default class MyClass { }

// Import
import { myFunction, myConst } from './module.js';
import MyClass from './MyClass.js';
```

### Singleton Pattern
```javascript
let instance = null;

export function getMyService(options = {}) {
  if (!instance) {
    instance = new MyService(options);
  }
  return instance;
}
```

### Event Communication
```javascript
// Emit
window.dispatchEvent(new CustomEvent('myEvent', {
  detail: { data: 'value' }
}));

// Listen
window.addEventListener('myEvent', (e) => {
  console.log(e.detail.data);
});
```

### Async/Await Error Handling
```javascript
async function myFunction() {
  try {
    const result = await fetch('/api/endpoint');
    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    return { error: error.message };
  }
}
```

---

**Последна актуализация:** 2024-12-08  
**Версия:** 1.0.0
