# Бърз справочник: Психометрична адаптация на плана

> **v2.0 REVISED** - Адресирани рискове, опростена сложност  
> **Кратко ръководство** за разработчици, работещи с психометричната адаптация на `final_plan`

---

## ⚠️ Важни промени в v2.0

1. **16 типа → 8 режима**: Опростена поддръжка
2. **Concordance-базирана логика**: high/medium/low → различни действия
3. **Приоритети**: Тестове влияят на КАК, НЕ на КАКВО (калории/макроси)
4. **Минимален вход**: Само ключове към AI, не дълги текстове
5. **Управление на рискове**: Concrete митигации

---

## 📋 Основни концепции

### Приоритети (1 → 2 → 3)

```
1️⃣ БАЗА (КАКВО) ← initial_answers
   └─ Калории, макроси, цел, медицински ограничения
   
2️⃣ СТИЛ (КАК) ← Психо-тестове
   └─ Комуникация, структура, гъвкавост
   
3️⃣ ПРЕДПАЗИТЕЛИ ← Correlation
   └─ Risk areas, coping strategies
```

### Concordance Levels

```
≥ 0.75  →  "high"     → FULL adaptation ✅
≥ 0.55  →  "medium"   → COMMUNICATION only ⚠️
< 0.55  →  "low"      → NO adaptation + 7-day observation ❌
```

### Тегла (САМО при high concordance)

```
High (≥0.75):    70% personality + 30% visual
Medium (0.55-0.74): 100% personality, 0% visual
Low (<0.55):      NO psycho-tests
```

---

## 🎯 8 комуникационни режима (не 16 типа)

### Групиране

```
4 Communication Styles × 2 Structure Needs = 8 Modes
```

| Режим | Включва типове | Тон | Структура |
|-------|----------------|-----|-----------|
| **DIRECT_STRUCTURED** | X-S-D-J, E-S-D-J | Directive | High |
| **DIRECT_FLEXIBLE** | X-S-D-P, E-S-D-P | Directive | Low |
| **SUPPORTIVE_STRUCTURED** | X-S-M-J, E-S-M-J | Gentle | High |
| **SUPPORTIVE_FLEXIBLE** | X-S-M-P, E-S-M-P | Gentle | Low |
| **STRATEGIC_STRUCTURED** | X-V-D-J, E-V-D-J | Analytical | High |
| **STRATEGIC_FLEXIBLE** | X-V-D-P | Analytical | Low |
| **EMPATHETIC_STRUCTURED** | X-V-M-J, E-V-M-J | Understanding | High |
| **EMPATHETIC_FLEXIBLE** | X-V-M-P, E-V-M-P | Understanding | Low |

### Бърза reference таблица

| Режим | Дължина | Честота | Risk Areas | Coping |
|-------|---------|---------|------------|--------|
| DIRECT_STRUCTURED | Short | Moderate | over_control | planned_flexibility |
| DIRECT_FLEXIBLE | Short | Low | meal_skipping | anchor_meals |
| SUPPORTIVE_STRUCTURED | Medium | High | fear_of_change | gradual_changes |
| SUPPORTIVE_FLEXIBLE | Medium | High | external_eating | saying_no |
| STRATEGIC_STRUCTURED | Long | Low | over_optimization | pleasure_integration |
| STRATEGIC_FLEXIBLE | Medium | Low | diet_hopping | time_boxed_trials |
| EMPATHETIC_STRUCTURED | Medium | Moderate | overthinking | simplification |
| EMPATHETIC_FLEXIBLE | Medium | High | emotional_eating | emotion_work |

---

## 🏗️ Структура на adaptedGuidance - ОПРОСТЕНА

### При high concordance (≥0.75)

```json
{
  "adaptedGuidance": {
    "concordanceLevel": "high",
    "adaptationLevel": "full",
    "communicationMode": "DIRECT_STRUCTURED",
    "keys": {
      "tone": "directive",
      "length": "short",
      "frequency": "moderate",
      "structure": "high",
      "flexibility": "low"
    },
    "riskAreas": ["over_control"],
    "coping": ["planned_flexibility"]
  }
}
```

### При medium concordance (0.55-0.74)

```json
{
  "adaptedGuidance": {
    "concordanceLevel": "medium",
    "adaptationLevel": "communication_only",
    "communicationMode": "SUPPORTIVE_STRUCTURED",
    "keys": {
      "tone": "gentle",
      "length": "medium"
      // НЕ се подават structure, flexibility
    }
  }
}
```

### При low concordance (<0.55)

```json
{
  "adaptedGuidance": {
    "concordanceLevel": "low",
    "adaptationLevel": "none",
    "observationMode": true,
    "observationDays": 7
  }
}
```

---

## 💬 Комуникационни примери

### High concordance - пълна адаптация

**DIRECT_STRUCTURED**:
> "Логнах дневните ти хранения. Днес пропусна обяда - нека го добавим сега."

**EMPATHETIC_FLEXIBLE**:
> "Виждам, че днес е бил труден. Как се чувстваш? Искаш ли да говорим за плана?"

### Medium concordance - само комуникация

**SUPPORTIVE режим** (БЕЗ структурни промени):
> "Здравей 👋 Виждам, че храненията са различни от обичайното - това е OK."

### Low concordance - generic

> "Добър ден! Имаш ли въпроси за плана днес?"

---

## 🔧 API Endpoints

### Генериране на composite profile
```javascript
POST /api/generateCompositeProfile
Body: { userId: "user123" }

Response: {
  success: true,
  data: {
    compositeProfile: {...},
    concordanceLevel: "high|medium|low",
    shouldRegeneratePlan: true
  }
}
```

### KV ключове
```
{userId}_composite_profile     // Обединен профил
{userId}_correlation_history   // История на корелации
{userId}_psycho_regeneration_pending  // Флаг за регенериране
```

---

## 📈 Decision Tree

```
calculateCorrelationScore()
   ↓
   ├─ score >= 0.75? → HIGH
   │   └─→ Apply full adaptation (8 modes + structure)
   │
   ├─ score >= 0.55? → MEDIUM
   │   └─→ Apply communication only (8 modes, NO structure)
   │
   └─ score < 0.55? → LOW
       └─→ NO adaptation (generic + 7-day observation)
```

---

## ⚠️ Важни правила

### Правило 1: Приоритети
```
initial_answers (база) > психо-тестове (стил)
```

### Правило 2: При конфликт
```
НЕ сменяй целта, смени формата на изпълнение
```

### Правило 3: Immutable полета
```
caloriesMacros   ← НЕ СЕ ПРОМЕНЯ
goal             ← НЕ СЕ ПРОМЕНЯ
medicalConditions ← НЕ СЕ ПРОМЕНЯ
```

### Правило 4: AI вход
```
✅ Подавай: ключове (tone, structure, flexibility)
❌ НЕ подавай: дълги текстове, параграфи
```

---

## 🚀 Quick Start за разработчици

### 1. Извличане на данни
```javascript
const initialAnswers = await env.USER_METADATA_KV.get(`${userId}_initial_answers`, 'json');
const psychTests = await env.USER_METADATA_KV.get(`${userId}_psych_tests`, 'json');
```

### 2. Изчисляване на корелация
```javascript
const correlationScore = calculateCorrelationScore(
  initialAnswers, 
  psychTests.personalityTest
);

const concordanceLevel = 
  correlationScore >= 0.75 ? 'high' :
  correlationScore >= 0.55 ? 'medium' : 'low';
```

### 3. Decision point
```javascript
if (concordanceLevel === 'low') {
  // NO adaptation, 7-day observation
  return { adaptationLevel: 'none', observationMode: true };
}

if (concordanceLevel === 'medium') {
  // ONLY communication
  return {
    adaptationLevel: 'communication_only',
    communicationMode: mapToMode(psychTests.personalityTest.typeCode),
    keys: { tone: '...', length: '...' }
  };
}

// HIGH - full adaptation
return {
  adaptationLevel: 'full',
  communicationMode: mapToMode(psychTests.personalityTest.typeCode),
  keys: { tone: '...', length: '...', structure: '...', flexibility: '...' },
  riskAreas: [...],
  coping: [...]
};
```

### 4. Mapping 16 типа → 8 режима
```javascript
function mapToMode(typeCode) {
  // Extract last 2 letters: communication + structure
  const communication = typeCode[2]; // D or M
  const structure = typeCode[3];     // J or P
  
  // Extract first 2 for additional context
  const energy = typeCode[0];        // X or E
  const innovation = typeCode[1];    // S or V
  
  // Determine communication style
  let style;
  if ((communication === 'D') && (innovation === 'S')) style = 'DIRECT';
  else if ((communication === 'M') && (innovation === 'S')) style = 'SUPPORTIVE';
  else if ((communication === 'D') && (innovation === 'V')) style = 'STRATEGIC';
  else if ((communication === 'M') && (innovation === 'V')) style = 'EMPATHETIC';
  
  // Determine structure need
  const structureNeed = (structure === 'J') ? 'STRUCTURED' : 'FLEXIBLE';
  
  return `${style}_${structureNeed}`;
}
```

---

## 📚 Допълнителни ресурси

- **Пълна документация**: [`PSYCHOMETRIC_PLAN_ADAPTATION_PROPOSAL_BG.md`](./PSYCHOMETRIC_PLAN_ADAPTATION_PROPOSAL_BG.md)
- **Психо тестове**: [`psycho_tests_to_final_plan.md`](./psycho_tests_to_final_plan.md)
- **Корелационен анализ**: [`QUESTIONNAIRE_ANALYSIS_CORRELATION.md`](./QUESTIONNAIRE_ANALYSIS_CORRELATION.md)
- **Подобрения**: [`PSYCHO_TEST_IMPROVEMENTS.md`](./PSYCHO_TEST_IMPROVEMENTS.md)

---

**Версия**: 1.0.0  
**Дата**: 2024-12-16  
**Актуализация**: При промени в основната документация
