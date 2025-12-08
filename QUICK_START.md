# Quick Start Guide - Бърз старт

> Най-бързият начин да започнеш работа с BodyBest проекта.

## За нови разработчици

### 1. Разбиране на проекта (5 минути)

Започни с тези 3 документа в този ред:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Прочети секциите:
   - Обща визия и философия
   - Архитектурен модел (диаграмата)
   - Структура на директориите (overview)

2. **[README.md](./README.md)** - Прочети:
   - Development Setup
   - NPM Scripts
   - Common Issues

3. **[docs/DEV_GUIDE_BG.md](./docs/DEV_GUIDE_BG.md)** - Основни команди

**Време:** ~5 минути  
**Резултат:** Разбираш какво е проектът и къде се намират нещата

---

### 2. Setup на околната среда (10 минути)

```bash
# 1. Clone
git clone https://github.com/Radilovk/bodybest.git
cd bodybest

# 2. Install
npm install

# 3. Start dev server
npm run dev
# → http://localhost:5173
```

**Проверка:**
- Отвори `http://localhost:5173`
- Трябва да видиш landing page
- API заявките се proxy-ват към production worker

**Време:** ~10 минути  
**Резултат:** Работеща локална среда

---

### 3. Първа задача (30 минути)

#### Scenario: Промяна на текст в dashboard

**Стъпки:**

1. **Намери файла**
   - Консултирай [FILE_STRUCTURE.md](./FILE_STRUCTURE.md)
   - Dashboard е в `index.html`

2. **Намери модула**
   - Консултирай [MODULE_MAP.md](./MODULE_MAP.md)
   - UI логиката е в `js/populateUI.js`

3. **Направи промяната**
   ```bash
   # Отвори файла
   code js/populateUI.js
   
   # Направи промяна
   # Vite автоматично refresh-ва
   ```

4. **Провери**
   - Виж промяната в браузъра
   - Провери console за грешки

5. **Test & Lint**
   ```bash
   npm run lint
   # npm test  # ако има тестове
   ```

6. **Commit**
   ```bash
   git add js/populateUI.js
   git commit -m "Update dashboard text"
   git push
   ```

**Време:** ~30 минути  
**Резултат:** Направена и пуснат променя

---

## За опитни разработчици

### Бърз преглед

**Архитектура:**
- Frontend: Vanilla JS (ES Modules) + Vite
- Backend: Cloudflare Workers
- Database: Cloudflare KV
- AI: Multiple providers (Gemini, Claude, Llama, etc.)

**Ключови концепции:**
- Offline-first logging
- Singleton patterns за managers
- Event-driven communication
- CSS variables за themes
- Persistent caching

**Горещи точки:**
```
js/offlineLogSync.js    # Offline logging система
js/requestCache.js      # Persistent cache
js/planGeneration.js    # AI план генериране
worker.js               # Main worker (~9000 lines)
```

### Типични задачи

#### Добавяне на нов API endpoint

1. **Worker** (`worker.js`):
   ```javascript
   if (url.pathname === '/api/myNewEndpoint') {
     // Handle request
     return Response.json({ success: true });
   }
   ```

2. **Config** (`js/config.js`):
   ```javascript
   export const apiEndpoints = {
     // ...
     myNewEndpoint: '/api/myNewEndpoint'
   };
   ```

3. **Client usage**:
   ```javascript
   import { apiEndpoints } from './config.js';
   const result = await fetch(apiEndpoints.myNewEndpoint)
     .then(r => r.json());
   ```

---

#### Добавяне на нов UI модул

1. **Създай файл** `js/myModule.js`:
   ```javascript
   export function myFunction() {
     // Implementation
   }
   
   export class MyClass {
     constructor() { }
   }
   ```

2. **Добави test** `js/__tests__/myModule.test.js`:
   ```javascript
   import { myFunction } from '../myModule.js';
   
   test('myFunction works', () => {
     expect(myFunction()).toBe('expected');
   });
   ```

3. **Import in app**:
   ```javascript
   import { myFunction } from './js/myModule.js';
   ```

4. **Document** в [MODULE_MAP.md](./MODULE_MAP.md)

---

#### Промяна на тема цвят

1. **CSS** (`css/base_styles.css`):
   ```css
   :root {
     --primary-color: #007bff; /* ← Промени */
   }
   ```

2. **Или през admin panel**:
   - Отвори `/admin.html`
   - "Настройки на цветове"
   - Visual editor

---

#### Debugging Worker

```bash
# Local dev
wrangler dev

# Production logs
wrangler tail

# Test endpoint
curl -X POST https://your-worker.workers.dev/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"data":"value"}'
```

---

## Често използвани пътища

### Файлове

```
index.html              # Dashboard
landing.html            # Landing page
quest.html              # Questionnaire
code.html               # Nutrition plan
admin.html              # Admin panel

js/app.js               # Main app
js/config.js            # Configuration
js/offlineLogSync.js    # Offline logging
js/planGeneration.js    # Plan generation
js/themeControls.js     # Theme system

worker.js               # Main worker
wrangler.toml           # Worker config

css/base_styles.css     # Themes
css/index_styles.css    # Dashboard styles
```

### Документация

```
ARCHITECTURE.md         # Архитектура
MODULE_MAP.md           # Модули
FILE_STRUCTURE.md       # Файлове
README.md               # Main doc
docs/DEV_GUIDE_BG.md    # Dev guide
```

### Команди

```bash
npm run dev             # Dev server
npm run build           # Production build
npm run lint            # ESLint
npm test                # Jest tests
npm run docs            # TypeDoc
npm run sync-kv         # Sync KV resources
npm run deploy          # Deploy to Cloudflare
```

---

## Често срещани въпроси

### Къде се намира логиката за X?

1. Провери [MODULE_MAP.md](./MODULE_MAP.md) - списък на всички модули
2. Провери [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) - пълна структура
3. Search в кода: `git grep "functionName"`

### Как работи offline logging?

- Виж [ARCHITECTURE.md](./ARCHITECTURE.md) → "Offline-First модел"
- Виж [MODULE_MAP.md](./MODULE_MAP.md) → `js/offlineLogSync.js`
- Виж [README.md](./README.md) → "Offline-First Architecture"

### Как да добавя нов AI модел?

1. Admin panel → "AI конфигурация"
2. Добави модел и prompt
3. Или директно в KV:
   ```bash
   wrangler kv key put model_my_model "model-name" --binding=RESOURCES_KV
   ```

### Как работи theme системата?

- Виж [MODULE_MAP.md](./MODULE_MAP.md) → "UI Components" → `themeControls.js`
- Виж `css/base_styles.css` → CSS променливи
- Admin panel → "Настройки на цветове"

### Как да deploy-на?

```bash
# GitHub Actions (препоръчително)
# Push to main branch

# Или ръчно (НЕ препоръчително)
npm run deploy
```

---

## Проблеми?

### ESLint/Jest не работи

```bash
npm ci          # Clean install
npm run lint
npm test
```

### Dev server не стартира

```bash
# Провери порт
lsof -i :5173

# Рестартирай
npm run dev
```

### Worker грешка

```bash
# Провери logs
wrangler tail

# Локален test
wrangler dev
```

### KV данни липсват

```bash
# Sync от kv/DIET_RESOURCES/
npm run sync-kv

# Или manual
wrangler kv key get my_key --binding=RESOURCES_KV
```

---

## Следващи стъпки

След като си наясно с основите:

1. **Прочети [ARCHITECTURE.md](./ARCHITECTURE.md)** изцяло
2. **Разгледай [MODULE_MAP.md](./MODULE_MAP.md)** за модули от интерес
3. **Експериментирай** с промени
4. **Чети кода** - код е документация
5. **Питай въпроси** в issues/PR-и

---

## Принципи на проекта

Винаги помни:

✅ **Простота** - Най-простото работещо решение  
⚡ **Ефективност** - Оптимизация на производителността  
🎨 **Отлична визия** - Качествен UI/UX  
📱 **Offline-First** - Работа без интернет  
🤖 **AI-Powered** - Интелигентни препоръки  

---

**Успех с разработката!** 🚀

**Последна актуализация:** 2024-12-08  
**Версия:** 1.0.0
