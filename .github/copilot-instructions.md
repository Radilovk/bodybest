# BodyBest - GitHub Copilot Instructions

## Обща информация за проекта / General Project Information

**BodyBest** е прогресивно уеб приложение (PWA) за проследяване на хранене, тренировки и здравни показатели с AI-асистирано планиране.

### Основни принципи / Core Principles

1. **Простота** - Винаги търси **най-простото работещо решение**
2. **Ефективност** - Оптимизация на производителността
3. **Отличен дизайн** - Качествен UI/UX дизайн **само за мобилни екрани** (телефон)
4. **Offline-First** - Работа без интернет връзка
5. **AI-Powered** - Интелигентни препоръки и адаптация

### Целева платформа / Target Platform

⚠️ **КРИТИЧНО ВАЖНО**: Проектът е **изключително и само за екран на телефон**. Качеството на UX/UI трябва да бъде на изключително ниво.

- Всички промени трябва да са оптимизирани за мобилни устройства
- Responsive дизайн **не е цел** - фокусът е mobile-first/mobile-only
- UI елементи трябва да са лесни за докосване и навигация на малки екрани

## Архитектура на проекта / Project Architecture

### Ключови документи / Key Documents

**ЗАДЪЛЖИТЕЛНО**: Преди всяка промяна, прочети:
- 📖 **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Пълна архитектура и логика на проекта
- 📖 **[README.md](../README.md)** - Бърз старт и основни функционалности
- 📖 **[MODULE_MAP.md](../MODULE_MAP.md)** - Детайлна карта на всички модули
- 📖 **[FILE_STRUCTURE.md](../FILE_STRUCTURE.md)** - Структура на файлове и директории

### Технологичен стек / Tech Stack

#### Frontend
- **HTML5** - Семантична структура
- **CSS3** - Модулни стилове с CSS променливи
- **JavaScript (ES Modules)** - Нативни модули **без bundler**
- **Vite** - Dev server и build tool
- **Chart.js** - Графики и визуализации

#### Backend
- **Cloudflare Workers** - Serverless API platform
- **Cloudflare KV** - Key-Value storage
- **Cloudflare AI** - AI модели за анализ и генериране
- **Node.js 18+** - Runtime за скриптове и тестове

#### Важни файлове / Important Files
- **worker.js** (~9000 lines) - Главен Cloudflare Worker с всички API endpoints
- **worker-backend.js** - PHP proxy worker за Cloudflare AI
- **mailer.js** - Email helper
- **sendEmailWorker.js** - Email worker

## Правила за разработка / Development Rules

### 1. Философия на кода / Code Philosophy

**"Най-простият, лесен и работещ начин"** - това е мантрата!

- ✅ Избирай прости решения пред сложни
- ✅ Избягвай излишна абстракция
- ✅ Практичност над теоретична "чистота"
- ❌ **НИКОГА** не усложнявай логиката излишно
- ❌ Не добавяй функционалности "за всеки случай"

### 2. Структура на кода / Code Structure

#### ES Modules Pattern
```javascript
// Използвай ES6 imports/exports
import { myFunction } from './myModule.js';
export function myFunction() { ... }

// НЕ използвай CommonJS
// ❌ const utils = require('./utils');
```

#### Singleton Pattern (където е необходимо)
```javascript
let instance = null;

export function getSingleton(options = {}) {
  if (!instance) {
    instance = new MyClass(options);
  }
  return instance;
}
```

#### Event-driven Communication
```javascript
// Емитване на събития
window.dispatchEvent(new CustomEvent('myEvent', {
  detail: { data: 'value' }
}));

// Слушане на събития
window.addEventListener('myEvent', (e) => {
  console.log(e.detail.data);
});
```

### 3. UI/UX Стандарти / UI/UX Standards

#### Мобилна оптимизация / Mobile Optimization
```css
/* Винаги mobile-first */
.element {
  /* Base styles за мобилен */
  padding: 16px;
  font-size: 16px;
  touch-action: manipulation; /* Оптимизация за touch */
}

/* Не добавяй desktop breakpoints освен ако не е абсолютно необходимо */
```

#### Touch-friendly елементи
- Минимален размер на touch targets: **44x44px**
- Spacing между интерактивни елементи: минимум **8px**
- Използвай clear visual feedback за touch states

#### Performance
- Lazy load тежки модули
- Използвай `IntersectionObserver` за lazy content
- Кешира данни локално (localStorage/IndexedDB)

### 4. Стил на код / Code Style

**Спазвай ESLint правилата:**
```bash
npm run lint
```

#### Конвенции за именуване / Naming Conventions
```javascript
// camelCase за променливи и функции
const userName = 'Ivan';
function getUserData() { ... }

// PascalCase за класове
class UserProfile { ... }

// UPPER_SNAKE_CASE за константи
const MAX_RETRIES = 3;
const API_ENDPOINT = '/api/data';

// Префикс за private/internal
const _internalFunction = () => { ... };
```

#### Коментари / Comments
```javascript
// Добави коментари САМО когато логиката не е очевидна
// Добри коментари обясняват "ЗАЩО", не "КАКВО"

// ✅ Добър коментар
// Използваме exponential backoff за да не претоварим API
const delay = Math.pow(2, retryCount) * 1000;

// ❌ Лош коментар
// Умножи 2 на степен retryCount пъти 1000
const delay = Math.pow(2, retryCount) * 1000;
```

### 5. Тестване / Testing

**Задължително** преди commit:
```bash
npm run lint    # ESLint проверка
npm test        # Jest unit tests
```

#### Test Pattern
```javascript
// js/__tests__/myModule.test.js
import { myFunction } from '../myModule.js';

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### 6. API Разработка / API Development

#### Endpoint Pattern (worker.js)
```javascript
// В worker.js fetch функцията
if (method === 'POST' && path === '/api/myEndpoint') {
  responseBody = await handleMyEndpointRequest(request, env, ctx);
}

// Отделна handler функция
async function handleMyEndpointRequest(request, env, ctx) {
  try {
    const { param1, param2 } = await request.json();
    
    // Валидация
    if (!param1) {
      return { success: false, message: 'Missing param1', statusHint: 400 };
    }
    
    // Бизнес логика
    const result = await processData(param1, param2, env);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in handleMyEndpointRequest:', error);
    return { success: false, message: 'Internal error', statusHint: 500 };
  }
}
```

#### CORS Headers
CORS headers се обработват автоматично в worker.js. Не е нужно да ги добавяш ръчно.

### 7. Offline-First Архитектура / Offline-First Architecture

#### Pattern за offline данни
```javascript
import { getOfflineLogSync } from './js/offlineLogSync.js';

// Записване на данни - instant в localStorage
await offlineLogSync.queueEntry(data);

// Автоматична синхронизация на фона (всеки 30 секунди)
// Не е нужно да се грижиш за sync логиката
```

#### Storage Quota Handling
```javascript
import { safeSetItem } from './js/safeStorage.js';

// Safe storage с automatic quota handling
const result = safeSetItem('myKey', data, {
  critical: false,  // Може да се evict при нужда
  showWarning: true // Показва UI warning
});
```

### 8. Работа с KV Storage / KV Storage

#### Четене от KV
```javascript
// Потребителски данни
const plan = await env.USER_METADATA_KV.get(`${userId}_final_plan`, 'json');

// Конфигурация и ресурси
const prompt = await env.RESOURCES_KV.get('prompt_unified_plan_generation_v2');
```

#### Запис в KV
```javascript
await env.USER_METADATA_KV.put(
  `${userId}_final_plan`,
  JSON.stringify(plan),
  { expirationTtl: 60 * 60 * 24 * 365 } // 1 година
);
```

#### KV Index Pattern
```javascript
// Поддържай индекс за бърз достъп
const index = [
  `${userId}_final_plan`,
  `${userId}_questionnaire`,
  // ... други важни ключове
];
await env.USER_METADATA_KV.put(`${userId}_kv_index`, JSON.stringify(index));
```

### 9. AI Интеграция / AI Integration

#### Извикване на AI модели
```javascript
// Вземи модел конфигурацията от KV
const model = await env.RESOURCES_KV.get('model_chat');
const prompt = await env.RESOURCES_KV.get('prompt_chat');

// Извикай модела
const response = await callModel(model, prompt, env, {
  temperature: 0.7,
  maxTokens: 2000
});
```

#### AI Model Types
- **Gemini** - Основен модел за планове (`model_plan_generation`)
- **Claude** - Анализ на въпросници (`model_questionnaire_analysis`)
- **Llama 3** - Cloudflare AI модел за чат (`model_chat`)
- **LLaVA** - Анализ на изображения (`model_image_analysis`)

### 10. Теми и стилове / Themes and Styles

#### CSS Променливи
```css
/* Дефинирани в css/base_styles.css */
:root {
  --primary-color: #007bff;
  --background-color: #f4f7f6;
  /* ... */
}

body.dark-theme {
  --primary-color: #4dabff;
  --background-color: #1a1a2e;
}

body.vivid-theme {
  --primary-color: #00d4ff;
  --background-color: #0f0e17;
}
```

#### Theme Switching
Теми се управляват автоматично от `js/themeControls.js`. Не модифицирай логиката без основателна причина.

## Специфични насоки / Specific Guidelines

### Когато добавяш нова функционалност / When Adding New Features

1. **Провери ARCHITECTURE.md** - може вече да съществува подобна функционалност
2. **Виж MODULE_MAP.md** - избери правилния модул за промяната
3. **Следвай съществуващи patterns** - не измисляй нови подходи без причина
4. **Направи промяната възможно най-малка** - surgical precision
5. **Тествай на мобилен екран** - emulate mobile device в DevTools

### Когато оправяш bug / When Fixing Bugs

1. **Разбери root cause** - не прилагай band-aid решения
2. **Провери за подобни случаи** - може да има същия bug на други места
3. **Добави test** - предотврати regression
4. **Документирай промяната** - актуализирай коментари ако е нужно

### Когато правиш refactoring / When Refactoring

**ВНИМАНИЕ**: Refactoring само когато е абсолютно необходим!

1. **Не променяй поведението** - refactoring не добавя функционалност
2. **Едно нещо наведнъж** - не смесвай refactoring с нови features
3. **Провери тестовете** - всички тестове трябва да минават след промяната
4. **Commit често** - малки, атомарни commits

## Чести грешки / Common Mistakes

### ❌ НЕ правя това / DON'T Do This

```javascript
// ❌ Излишна абстракция
class DataManager {
  constructor(strategy) {
    this.strategy = strategy;
  }
  // ... 200 реда код за нещо просто
}

// ❌ Преждевременна оптимизация
const memoized = useMemo(() => expensiveCalc(x), [x, y, z, a, b, c]);

// ❌ Over-engineering
const result = await Promise.all([
  fetch1(),
  fetch2(),
  fetch3()
]).then(([r1, r2, r3]) => processComplex(r1, r2, r3));

// ❌ Magic numbers без обяснение
setTimeout(callback, 86400000); // Какво е това число?
```

### ✅ Правя това вместо / DO This Instead

```javascript
// ✅ Директно и ясно
async function saveUserData(userId, data, env) {
  await env.USER_METADATA_KV.put(`${userId}_data`, JSON.stringify(data));
}

// ✅ Оптимизирай само когато има реален проблем
const result = expensiveCalc(x);

// ✅ Ясен и поддържаем код
const data1 = await fetch1();
const data2 = await fetch2();
const result = processSimple(data1, data2);

// ✅ Именувани константи
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 86400000
setTimeout(callback, ONE_DAY_MS);
```

## Git Workflow

### Commit Messages

```bash
# ✅ Добри commit съобщения (на български е OK)
git commit -m "Добавен endpoint за nutrient lookup"
git commit -m "Поправен bug при синхронизация на offline логове"
git commit -m "Оптимизиран performance на dashboard analytics"

# ❌ Лоши commit съобщения
git commit -m "fix"
git commit -m "update"
git commit -m "changes"
```

### Branch Strategy

- `main` - Production ready код
- `develop` - Development branch (ако съществува)
- `feature/име-на-feature` - Нови функционалности
- `fix/име-на-bug` - Bug fixes
- `copilot/*` - Copilot generated branches

## Документация / Documentation

### Когато да актуализираш документацията / When to Update Docs

- ✅ Добавяш нов API endpoint → актуализирай README.md
- ✅ Променяш архитектура → актуализирай ARCHITECTURE.md
- ✅ Добавяш нов модул → актуализирай MODULE_MAP.md
- ✅ Променяш структура на файлове → актуализирай FILE_STRUCTURE.md

### TypeDoc Генериране
```bash
npm run docs  # Генерира API документация в docs/api/
```

## Важни забележки / Important Notes

### За Performance

- Използвай `requestIdleCallback` за non-critical операции
- Lazy load модули с `import()` динамично
- Дебъг с Chrome DevTools -> Performance tab
- Target: First Contentful Paint < 1.5s

### За Security

- **Никога** не commit secrets или API keys
- Използвай environment variables
- Sanitize всички user inputs
- Validate всички данни от API

### За Accessibility

- Всички теми са WCAG 2.1 AA compliant
- Contrast ratio минимум 4.5:1 за текст
- Keyboard navigation трябва да работи навсякъде
- Focus indicators минимум 3px outline

## Бързи команди / Quick Commands

```bash
# Development
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build

# Testing & Quality
npm run lint         # ESLint check
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run coverage     # Test coverage report

# Deployment
npm run deploy       # Deploy to Cloudflare Workers
npm run sync-kv      # Sync KV resources

# Documentation
npm run docs         # Generate TypeDoc
```

## Контакти и ресурси / Contacts and Resources

- **GitHub Repository**: https://github.com/Radilovk/bodybest
- **Cloudflare Dashboard**: Workers & Pages → bodybest
- **Documentation Index**: [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)

## Финални думи / Final Words

**Запомни**: 
- 📱 Само мобилен екран
- 🎯 Простота над всичко
- ⚡ Бързодействие е критично
- 🎨 UX/UI качество е приоритет #1

**Винаги питай себе си**:
- Това ли е най-простото решение?
- Работи ли на малък екран?
- Бързо ли зарежда?
- Ясен ли е кодът за следващия разработчик?

Ако отговорът на някой от въпросите е "НЕ", помисли отново! 🤔

---

**Версия**: 1.0.0  
**Последна актуализация**: 2024-12-12  
**Създадено с помощта на**: GitHub Copilot
