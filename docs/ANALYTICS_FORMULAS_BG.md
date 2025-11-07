# Формули за Аналитика

Този документ описва подобрените формули за изчисляване на аналитични показатели в приложението BodyBest.

## Обща информация

Всички аналитични показатели се изчисляват на базата на:
- Последните 30 дни активност (конфигурируемо)
- Данни от дневника на потребителя
- Профилна информация и цели
- План за хранене

## 1. Engagement Score (Ангажираност)

### Формула
```
engagementScore = cap(
    (mealAdherence × 0.4) + 
    (indexCompletion × 0.4) + 
    (logCompletion × 0.2) +
    streakBonus +
    qualityBonus
)
```

### Компоненти

**Meal Adherence (Спазване на хранителния план)** - 40%
- Процент от планираните хранения, които са отбелязани като изпълнени
- `(completedMeals / plannedMeals) × 100`

**Index Completion (Попълване на индекси)** - 40%
- Процент от попълнените индекси (настроение, енергия, спокойствие, сън, хидратация)
- `(filledIndexFields / expectedIndexFields) × 100`

**Log Completion (Попълване на дневник)** - 20%
- Процент от дните с поне един запис в дневника
- `(daysWithLogs / totalDays) × 100`

**Streak Bonus (Бонус за последователност)** - до +10%
- +10% за активен streak от 7+ последователни дни
- +5% за активен streak от 3-6 последователни дни
- 0% за streak под 3 дни

**Quality Bonus (Бонус за качество)** - до +5%
- +5% ако средно се попълват 4+ индекси на ден
- +2% ако средно се попълват 3 индекси на ден
- 0% при под 3 индекси средно на ден

### Цел
Максимален резултат: 100%  
Минимален резултат: 0%

## 2. Overall Health Score (Общ здравен индекс)

### Формула
```
overallHealthScore = cap(
    (mood × 0.15) +
    (energy × 0.15) +
    (calmness × 0.10) +
    (sleep × 0.15) +
    (hydration × 0.10) +
    (bmiScore × 0.20) +
    (engagementScore × 0.15)
)
```

### Компоненти

| Компонент | Тежест | Описание |
|-----------|--------|----------|
| Настроение (Mood) | 15% | Средно настроение (скала 1-5) |
| Енергия (Energy) | 15% | Средно ниво на енергия (скала 1-5) |
| Спокойствие (Calmness) | 10% | Средно ниво на спокойствие (скала 1-5) |
| Сън (Sleep) | 15% | Средно качество на съня (скала 1-5) |
| Хидратация (Hydration) | 10% | Средно ниво на хидратация (скала 1-5) |
| BMI Оценка | 20% | Оценка базирана на Body Mass Index |
| Ангажираност | 15% | Engagement Score (виж по-горе) |

### Конверсия от скала 1-5 към проценти
```
percentage = (value / 5) × 100
```
- 1/5 → 20%
- 2/5 → 40%
- 3/5 → 60%
- 4/5 → 80%
- 5/5 → 100%

### Цел
Максимален резултат: 100%  
Минимален резултат: 0%

## 3. BMI Score (Подобрена формула)

### Подобрения
- Заменена стъпаловидната функция с плавна крива
- По-фини градации в междинните зони
- По-реалистична оценка за граничните случаи

### Формула по зони

**Оптимална зона (BMI 18.5 - 25):**
```
score = 100
```

**Под оптималното (BMI < 18.5):**
```
BMI 17-18.5  → 85-100 (плавна крива)
BMI 16-17    → 65-85
BMI 15-16    → 40-65
BMI 14-15    → 20-40
BMI < 14     → 5-20
```

**Над оптималното (BMI > 25):**
```
BMI 25-27    → 100-80 (плавна крива)
BMI 27-30    → 80-60
BMI 30-35    → 60-40
BMI 35-40    → 40-20
BMI 40-45    → 20-5
BMI > 45     → 5
```

### Изчисление на BMI
```
BMI = weight_kg / (height_m)²
```

## 4. Goal Progress (Напредък към целта)

### 4.1 Цел: Отслабване

**Подобрена нелинейна формула:**

Отчита факта, че загубата на тегло е по-лесна в началото и по-трудна с приближаване към целта.

```
actualLoss = initialWeight - currentWeight
rawProgress = actualLoss / targetLoss

if rawProgress < 50%:
    goalProgress = rawProgress × 120    // 0-50% става 0-60%
else:
    goalProgress = 60 + (rawProgress - 0.5) × 80    // 50-100% става 60-100%
```

**Пример:**
- Цел: 10 кг загуба
- Реално загубени 2.5 кг (25%) → progress = 30%
- Реално загубени 5 кг (50%) → progress = 60%
- Реално загубени 7.5 кг (75%) → progress = 80%
- Реално загубени 10 кг (100%) → progress = 100%

### 4.2 Цел: Покачване на мускулна маса

**Линейна формула:**

Качването на маса е по-предвидим процес, затова използваме линейна прогресия.

```
actualGain = currentWeight - initialWeight
goalProgress = (actualGain / targetGain) × 100
```

**Пример:**
- Цел: 5 кг качване
- Реално качени 2.5 кг → progress = 50%
- Реално качени 5 кг → progress = 100%

### 4.3 Цел: Поддържане на тегло

**Подобрена формула с буферна зона:**

```
targetWeight = maintenance target
baseDeviation = 3% от targetWeight
bufferDeviation = 2% от targetWeight
actualDeviation = |currentWeight - targetWeight|

if actualDeviation ≤ baseDeviation:
    goalProgress = 100
else if actualDeviation ≤ (baseDeviation + bufferDeviation):
    // Буферна зона 3-5% - плавно намаление до 90%
    excess = actualDeviation - baseDeviation
    goalProgress = 100 - (excess / bufferDeviation) × 10
else:
    // Над 5% - по-бързо намаление
    excess = actualDeviation - baseDeviation - bufferDeviation
    goalProgress = max(0, 90 - (excess / baseDeviation) × 60)
```

**Пример (за 70 кг цел):**
- Реално тегло 70 кг (0% отклонение) → progress = 100%
- Реално тегло 71.5 кг (2.1% отклонение) → progress = 100%
- Реално тегло 72.8 кг (4% отклонение) → progress = 95%
- Реално тегло 74 кг (5.7% отклонение) → progress = 85%
- Реално тегло 77 кг (10% отклонение) → progress = 50%

### Предимства на новата формула:
1. **По-толерантна към краткосрочни флуктуации** - нормалните дневни вариации до 3% не намаляват оценката
2. **Буферна зона** - 3-5% отклонение води до минимална загуба на точки
3. **Плавна крива** - няма рязки скокове в оценката

## Автоматично изчистване на дневни данни

### Логика
При смяна на календарния ден:
1. Изчистване на `todaysMealCompletionStatus` (отбелязани хранения)
2. Изчистване на `todaysExtraMeals` (извънредни хранения)
3. Нулиране на `currentIntakeMacros` (текущи макронутриенти)

### Тригери
- При зареждане на dashboard (`loadDashboardData`)
- При преизчисляване на макроси (`recalculateCurrentIntakeMacros`)
- При връщане към приложението (visibility change event)

### Проверка
```javascript
function ensureFreshDailyIntake() {
    const todayDateStr = getLocalDate(); // YYYY-MM-DD
    const lastDate = sessionStorage.getItem('lastDashboardDate');
    
    if (lastDate !== todayDateStr) {
        resetDailyIntake();
        sessionStorage.setItem('lastDashboardDate', todayDateStr);
    }
}
```

## Минимизиране на заявки към бекенда

### Стратегии

1. **Request Caching** - Кеширане на GET заявки с TTL
   - Dashboard data: 30 секунди
   - Profile data: 60 секунди
   - Analytics: 30 секунди

2. **Премахнато polling** - Няма автоматични периодични заявки

3. **Debouncing** - Забавяне на заявки при потребителски вход
   - Nutrient lookup: 300ms debounce
   - Auto-save: 1000ms debounce

4. **Локално изчисляване** - Макросите се изчисляват на клиента

## История на промените

### Версия 2.0 (Текуща)
- ✅ Подобрена BMI формула с плавни прагове
- ✅ Добавен streak bonus към engagement score
- ✅ Добавен quality bonus към engagement score
- ✅ Подобрена формула за goal progress при поддържане
- ✅ Нелинейна прогресия за отслабване
- ✅ Автоматична проверка при visibility change

### Версия 1.0 (Първоначална)
- ✅ Базови формули за engagement, health score и goal progress
- ✅ Стъпаловидна BMI функция
- ✅ Линейна прогресия за всички цели
