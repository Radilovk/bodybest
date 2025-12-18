# Daily Logs Storage & Analytics Period Filtering

## Обзор / Overview

Този документ описва оптималното решение за съхранение на дневни логове и функционалността за филтриране на аналитиката по период.

## Съхранение на дневни логове / Daily Logs Storage

### Текущ подход (оптимален)

Дневните логове се съхраняват като **отделни KV записи за всяка дата**:

```
Key pattern: {userId}_log_{YYYY-MM-DD}
Example: user123_log_2024-12-18
```

### Предимства на текущия подход

1. **Бърз достъп** - Директен достъп до конкретна дата без обработка на големи масиви
2. **Ефективно обновяване** - Промяна само на конкретния ден, без пренаписване на цели колекции
3. **Няма ограничение за размер** - Всеки ден има отделен лимит от 25MB (KV limit)
4. **Лесна архивация** - Стари записи могат лесно да се архивират или изтриват
5. **Паралелно четене** - Множество дати могат да се четат едновременно с Promise.all()
6. **Минимално натоварване** - Само необходимите дати се извличат от backend

### Алтернативи (НЕ препоръчани)

❌ **Един масив за всички логове**: 
- Проблем: Бавно при много записи, целият масив трябва да се чете/пише
- Лимит: 25MB за целия масив ограничава дългосрочното използване

❌ **Месечни колекции**:
- Проблем: По-сложна логика за управление, по-трудно извличане на текуща седмица
- Липса на гъвкавост при промяна на периода

### Параметри на съхранение

```javascript
// worker.js константи
const USER_ACTIVITY_LOG_LIST_LIMIT = 100;  // Максимален брой логове в отговора
const USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS = 7;  // Default период за аналитика
```

## Филтриране по период на аналитиката / Analytics Period Filtering

### Функционалност

Потребителите и администраторите могат да променят периода на аналитиката между:
- **Седмица** (7 дни) - по подразбиране
- **Месец** (30 дни)
- **Всички** (цялата история)

### Имплементация

#### Backend (worker.js)

**API Endpoint**: `/api/dashboardData?userId={userId}&period={period}`

**Parameters**:
- `userId` (required) - ID на потребителя
- `period` (optional) - Период за аналитика: `7`, `30`, или `all`

**Функция**: `calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries, currentStatus, customPeriodDays)`

```javascript
// Default 7 days
const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries, currentStatus);

// Custom period
const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries, currentStatus, 30);

// All available data
const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries, currentStatus, logEntries.length);
```

**Response добавки**:
```json
{
  "success": true,
  "analytics": {
    "current": { ... },
    "detailed": [ ... ],
    "textualAnalysis": "...",
    "streak": { ... },
    "periodDays": 7  // NEW: Период използван за изчисления
  },
  "analyticsPeriod": 7  // NEW: Избран период
}
```

#### Frontend - User Dashboard

**Файлове**:
- `code.html` - UI за избор на период
- `js/analyticsPeriodSelector.js` - Логика за управление на периода
- `js/app.js` - Интеграция с API
- `js/populateUI.js` - Показване на период в UI

**UI компоненти**:
```html
<div class="analytics-period-selector">
  <div class="period-label">Период на анализ:</div>
  <div class="period-buttons">
    <button class="period-btn" data-period="7">Седмица</button>
    <button class="period-btn" data-period="30">Месец</button>
    <button class="period-btn" data-period="all">Всички</button>
  </div>
</div>
```

**Функции**:
```javascript
// Инициализация
initAnalyticsPeriodSelector(async (period) => {
  await loadDashboardData(period);
});

// Вземане на текущ период
const period = getCurrentPeriod(); // 7, 30, or 'all'

// Форматиране за показване
const text = formatPeriodText(30); // "Последните 30 дни"
```

#### Frontend - Admin Panel

**Файлове**:
- `admin.html` - UI за избор на период (2 селектора: за логове и аналитика)
- `js/adminAnalyticsPeriodSelector.js` - Логика за админ периоди
- `js/admin.js` - Интеграция и филтриране

**UI компоненти**:
```html
<!-- Период за логове -->
<div class="admin-period-selector">
  <label>Период:</label>
  <button class="admin-period-btn" data-period="7">7 дни</button>
  <button class="admin-period-btn" data-period="30">30 дни</button>
  <button class="admin-period-btn" data-period="all">Всички</button>
</div>

<!-- Период за аналитика -->
<div class="admin-analytics-period-selector">
  <label>Период:</label>
  <button class="admin-analytics-period-btn" data-period="7">7 дни</button>
  <button class="admin-analytics-period-btn" data-period="30">30 дни</button>
  <button class="admin-analytics-period-btn" data-period="all">Всички</button>
</div>
```

**Функции**:
```javascript
// Инициализация за логове
initAdminLogsPeriodSelector(async (period) => {
  const logs = dashData.dailyLogs || [];
  const filtered = period === 'all' ? logs : logs.slice(0, period);
  await displayDailyLogs(filtered, false);
});

// Инициализация за аналитика
initAdminAnalyticsPeriodSelector(async (period) => {
  const url = `${apiEndpoints.dashboard}?userId=${userId}&period=${period}`;
  const data = await fetch(url).then(r => r.json());
  displayDashboardSummary(data);
});
```

## Аналитични метрики / Analytics Metrics

Всички метрики се изчисляват за избрания период:

### Основни индекси / Main Indexes
- `goalProgress` - Прогрес към целта (%)
- `engagementScore` - Ангажираност (%)
- `overallHealthScore` - Общ здравен резултат (%)

### Детайлни метрики / Detailed Metrics
- `bmi_status` - BMI и категория
- `meal_adherence` - Придържане към хранения (%)
- `sleep_quality` - Качество на съня (1-5)
- `stress_level` - Ниво на спокойствие (1-5)
- `energy_level` - Ниво на енергия (1-5)
- `mood` - Настроение (1-5)
- `hydration` - Хидратация (1-5)
- `log_consistency` - Редовност на дневника (%)

### Текстов анализ / Textual Analysis

Автоматично генериран текст описващ:
- Общ прогрес и ангажираност
- Силни страни (метрики >70%)
- Области за внимание (метрики <50%)

**Пример**:
```
Анализ за последните 7 дни
Целта Ви е отслабване. Общият напредък е 45%, а ангажираността е 72%.
Силни страни се открояват при Ниво на Енергия (4.2/5) и Качество на Съня (4.0/5).
Необходимо е внимание към Ниво на Спокойствие (2.8/5).
```

## Графики и визуализации / Charts and Visualizations

### User Dashboard
- **Progress History Chart** - История на напредъка (линейна графика)
- **Macro Analytics Card** - Текущи макроси и прогрес
- **Detailed Metrics Cards** - Детайлни показатели с прогрес бари

### Admin Panel
- **Weight Chart** - График на теглото във времето
- **Analytics Summary** - Обобщени аналитични данни
- **Daily Logs Table** - Таблица с дневни записи

## Оптимизации / Optimizations

### Кеширане / Caching

```javascript
// cachedFetch в app.js
const data = await cachedFetch(apiUrl, {
  ttl: period !== null ? 0 : 30000  // Без кеш при промяна на период
});
```

### Batch заявки / Batch Requests

```javascript
// worker.js - Паралелно четене на множество дати
const logRecords = await Promise.all(
  sortedDates.map(date => 
    env.USER_METADATA_KV.get(`${userId}_log_${date}`)
  )
);
```

### Лимити / Limits

- Максимум 100 логове се връщат (`USER_ACTIVITY_LOG_LIST_LIMIT`)
- Default аналитичен период: 7 дни
- Maximum период: цялата история (обикновено <365 дни)

## Бъдещи подобрения / Future Enhancements

### Потенциални разширения

1. **Custom периоди**
   - Потребителят може да избере точна дата от/до
   - Сравнение между два периода

2. **Автоматични награди**
   - Базирани на постижения за определен период
   - Streak bonuses за последователност

3. **Export функционалност**
   - CSV/PDF export на данни за избран период
   - Графики и отчети за печат

4. **Predictive Analytics**
   - AI прогнози базирани на исторически данни
   - Trend analysis за бъдещи периоди

## Заключение / Conclusion

Имплементацията осигурява:

✅ **Оптимално съхранение** - Един KV запис на дата (най-ефективен подход)  
✅ **Гъвкава аналитика** - Избор на период (седмица/месец/всички)  
✅ **Минимално натоварване** - Само нужните данни се обработват  
✅ **Отличен UX** - Интуитивни селектори с моментален feedback  
✅ **Лесна разширяемост** - Готовност за бъдещи функции  

Проектът следва принципа на **простота и ефективност** - използва се най-прекият и елементарен подход за постигане на целите без излишна сложност.

---

**Автор**: GitHub Copilot  
**Дата**: 2024-12-18  
**Версия**: 1.0.0
