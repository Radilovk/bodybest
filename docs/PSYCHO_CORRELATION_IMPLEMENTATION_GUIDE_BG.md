# Ръководство за имплементация на корелация между психопрофил и въпросник

Този документ предоставя конкретни стъпки за имплементация на предложението описано в [PSYCHO_PROFILE_CORRELATION_PROPOSAL_BG.md](./PSYCHO_PROFILE_CORRELATION_PROPOSAL_BG.md).

## Преглед на задачата

Имплементацията включва:
1. Създаване на корелационна логика
2. Интеграция в генерирането на план (processSingleUserPlan)
3. Обогатяване на AI промптове
4. Създаване на адаптивни стратегии
5. (Опционално) Нови API endpoints

## Фази на имплементация

### Фаза 1: Основна корелационна логика (Приоритет: Висок)

**Оценка на време:** 3-4 дни

#### 1.1. Създаване на корелационна функция

**Файл:** `worker.js` (нова секция след `createPsychoTestsProfileData`)

```javascript
// ------------- START FUNCTION: calculatePsychoCorrelation -------------
/**
 * Изчислява корелация между initial_answers и психологическия профил
 * @param {Object} initialAnswers - Отговори от въпросника
 * @param {Object} psychoProfile - Психологически профил от psychoTestsProfile
 * @returns {Object} Корелационен резултат
 */
function calculatePsychoCorrelation(initialAnswers, psychoProfile) {
  if (!psychoProfile || !psychoProfile.personalityTest) {
    return null;
  }
  
  const correlations = [];
  const dissonances = [];
  
  const scores = psychoProfile.personalityTest.scores;
  
  // 1. Корелация: Преяждане vs Импулсивност/Дисциплина
  const overeating = initialAnswers.overeatingFrequency || '';
  if (overeating === 'Постоянно' || overeating === 'Често') {
    const I = scores.I || 0;
    const C = scores.C || 0;
    
    if (I >= 65 || C <= 40) {
      correlations.push({
        aspect: 'overeating',
        questionnaireAnswer: overeating,
        psychoMetric: I >= 65 ? 'I' : 'C',
        psychoValue: I >= 65 ? I : C,
        score: 95,
        status: 'confirmed',
        note: `${I >= 65 ? 'Висока импулсивност' : 'Ниска дисциплина'} потвърждава честото преяждане`
      });
    } else {
      dissonances.push({
        aspect: 'overeating_claimed',
        questionnaireAnswer: overeating,
        psychoMetric: 'I/C',
        psychoValue: `I=${I}, C=${C}`,
        score: 35,
        status: 'dissonance',
        note: 'Клиентът твърди, че преяжда, но психопрофилът не показва ясни рискови фактори',
        action: 'monitor_patterns'
      });
    }
  } else if (overeating === 'Рядко' || overeating === 'Никога') {
    const I = scores.I || 0;
    const C = scores.C || 0;
    
    if (I >= 65 || C <= 40) {
      dissonances.push({
        aspect: 'overeating_denied',
        questionnaireAnswer: overeating,
        psychoMetric: I >= 65 ? 'I' : 'C',
        psychoValue: I >= 65 ? I : C,
        score: 30,
        status: 'dissonance',
        note: `${I >= 65 ? 'Висока импулсивност' : 'Ниска дисциплина'} предполага риск от преяждане, който клиентът не признава`,
        action: 'gentle_inquiry_and_observation'
      });
    } else {
      correlations.push({
        aspect: 'no_overeating',
        questionnaireAnswer: overeating,
        psychoMetric: 'I/C',
        psychoValue: `I=${I}, C=${C}`,
        score: 90,
        status: 'confirmed',
        note: 'Добър самоконтрол потвърждава липсата на преяждане'
      });
    }
  }
  
  // 2. Корелация: Емоционални тригери vs Невротизъм
  const triggers = initialAnswers.foodTriggers || [];
  const N = scores.N || 0;
  
  if (triggers.includes('Напрежение') || triggers.includes('Тъга')) {
    if (N >= 60) {
      correlations.push({
        aspect: 'emotional_triggers',
        questionnaireAnswer: triggers.filter(t => t === 'Напрежение' || t === 'Тъга'),
        psychoMetric: 'N',
        psychoValue: N,
        score: 90,
        status: 'confirmed',
        note: 'Висока емоционална реактивност потвърждава емоционалното хранене'
      });
    } else {
      dissonances.push({
        aspect: 'emotional_triggers_low_N',
        questionnaireAnswer: triggers.filter(t => t === 'Напрежение' || t === 'Тъга'),
        psychoMetric: 'N',
        psychoValue: N,
        score: 40,
        status: 'dissonance',
        note: 'Ниска емоционална реактивност не съответства на емоционални тригери. Възможен копинг механизъм или временна фаза',
        action: 'explore_coping_mechanisms'
      });
    }
  }
  
  // 3. Корелация: Социални тригери vs Екстраверсия
  const E = scores.E || 0;
  if (triggers.includes('Социални събития')) {
    if (E >= 65) {
      correlations.push({
        aspect: 'social_eating',
        questionnaireAnswer: 'Социални събития',
        psychoMetric: 'E',
        psychoValue: E,
        score: 92,
        status: 'confirmed',
        note: 'Висока екстраверсия потвърждава социалното хранене'
      });
    } else {
      dissonances.push({
        aspect: 'social_eating_low_E',
        questionnaireAnswer: 'Социални събития',
        psychoMetric: 'E',
        psychoValue: E,
        score: 45,
        status: 'dissonance',
        note: 'Ниска екстраверсия не съответства на социални тригери. Възможно социален натиск или специфични ситуации',
        action: 'explore_social_context'
      });
    }
  }
  
  // 4. Визуален профил корелация (simplified version)
  const visualScore = psychoProfile.visualTest ? 75 : 0; // Simplified - може да се разшири
  
  // Изчисляване на средни стойности
  const personalityScores = correlations
    .filter(c => c.aspect !== 'visual_profile')
    .map(c => c.score);
  
  const avgPersonalityScore = personalityScores.length > 0
    ? personalityScores.reduce((sum, s) => sum + s, 0) / personalityScores.length
    : 50;
  
  // Тотален score: 70% личностен, 30% визуален
  const totalScore = (avgPersonalityScore * 0.7) + (visualScore * 0.3);
  
  let interpretation = '';
  if (totalScore >= 90) {
    interpretation = 'Висока корелация - психопрофилът пълно потвърждава отговорите от въпросника';
  } else if (totalScore >= 70) {
    interpretation = 'Добра корелация - психопрофилът подкрепя отговорите';
  } else if (totalScore >= 50) {
    interpretation = 'Умерена корелация - частично съответствие';
  } else if (totalScore >= 30) {
    interpretation = 'Ниска корелация - възможен дисонанс, изисква внимание';
  } else {
    interpretation = 'Много ниска корелация - значителен дисонанс, изисква преразглеждане';
  }
  
  return {
    lastUpdated: new Date().toISOString(),
    correlationScore: Math.round(totalScore * 10) / 10,
    personalityScore: Math.round(avgPersonalityScore * 10) / 10,
    visualScore,
    interpretation,
    correlations,
    dissonances
  };
}
// ------------- END FUNCTION: calculatePsychoCorrelation -------------
```

#### 1.2. Създаване на адаптационна функция

```javascript
// ------------- START FUNCTION: generatePsychoAdaptations -------------
/**
 * Генерира адаптационни стратегии базирани на психопрофила
 * @param {Object} psychoProfile - Психологически профил
 * @param {Object} correlationResult - Резултат от корелацията
 * @returns {Object} Адаптационни стратегии
 */
function generatePsychoAdaptations(psychoProfile, correlationResult) {
  if (!psychoProfile || !psychoProfile.personalityTest) {
    return null;
  }
  
  const scores = psychoProfile.personalityTest.scores;
  const C = scores.C || 50;
  const E = scores.E || 50;
  const A = scores.A || 50;
  const N = scores.N || 50;
  const I = scores.I || 50;
  const O = scores.O || 50;
  const R = scores.R || 50;
  
  // 1. Структура на хранене
  let structure = 'balanced';
  if (C >= 70) {
    structure = 'strict';
  } else if (C <= 49) {
    structure = 'minimal';
  }
  
  // 2. AI комуникационна честота
  let aiFrequency = 'medium';
  if (E >= 65 && A >= 60) {
    aiFrequency = 'high';
  } else if (E <= 39) {
    aiFrequency = 'low';
  }
  
  // Корекция за ниска дисциплина
  if (C <= 40 && aiFrequency === 'low') {
    aiFrequency = 'medium'; // Увеличаваме подкрепата
  }
  
  // 3. AI тон
  let aiTone = 'balanced_professional';
  if (A >= 60 && N >= 60) {
    aiTone = 'warm_supportive';
  } else if (A <= 40 && E >= 60) {
    aiTone = 'direct_challenging';
  } else if (A >= 60 && N <= 40) {
    aiTone = 'friendly_informative';
  }
  
  // 4. Тип мотивация
  let motivationType = 'balanced';
  if (C >= 60 && O >= 60) {
    motivationType = 'achievement_based';
  } else if (E >= 65 && A >= 60) {
    motivationType = 'social_recognition';
  } else if (N >= 65 && A >= 60) {
    motivationType = 'emotional_support';
  } else if (I >= 65 && R >= 65) {
    motivationType = 'excitement_challenge';
  } else if (O <= 40 && C >= 60) {
    motivationType = 'routine_stability';
  }
  
  // 5. Coping стратегии
  const copingStrategies = [];
  
  if (I >= 65) {
    copingStrategies.push('impulse_control_10sec_rule');
    copingStrategies.push('prepared_healthy_snacks');
  }
  
  if (N >= 60) {
    copingStrategies.push('stress_breathing_technique');
    copingStrategies.push('emotional_awareness_journal');
  }
  
  if (E >= 65) {
    copingStrategies.push('social_eating_plan_ahead');
    copingStrategies.push('one_plate_rule');
  }
  
  if (C <= 40) {
    copingStrategies.push('habit_stacking');
    copingStrategies.push('visual_reminders');
  }
  
  return {
    structure,
    aiFrequency,
    aiTone,
    motivationType,
    copingStrategies
  };
}
// ------------- END FUNCTION: generatePsychoAdaptations -------------
```

### Фаза 2: Интеграция в processSingleUserPlan (Приоритет: Висок)

**Оценка на време:** 2-3 дни

#### 2.1. Добавяне в processSingleUserPlan

**Място:** В `processSingleUserPlan`, след зареждане на `psychoTestsProfile` от final_plan

```javascript
// В processSingleUserPlan функцията, около ред 6180-6200

// След зареждането на psychoTestsProfile
const psychoTestsData = safeGet(initialAnswers, 'psychTests', null);
let psychoCorrelation = null;
let psychoAdaptations = null;

if (psychoTestsData && psychoTestsData.personalityTest) {
  await addLog('Анализ на корелация между въпросник и психопрофил', { 
    checkpoint: true, 
    reason: 'psycho_correlation' 
  });
  
  try {
    psychoCorrelation = calculatePsychoCorrelation(initialAnswers, psychoTestsData);
    
    if (psychoCorrelation) {
      await addLog(
        `Корелационен score: ${psychoCorrelation.correlationScore}% (${psychoCorrelation.interpretation})`, 
        { checkpoint: true }
      );
      
      // Запазване на корелация в KV
      await env.USER_METADATA_KV.put(
        `${userId}_psych_correlation`,
        JSON.stringify(psychoCorrelation),
        { expirationTtl: 60 * 60 * 24 * 365 }
      );
      
      // Генериране на адаптации
      psychoAdaptations = generatePsychoAdaptations(psychoTestsData, psychoCorrelation);
      
      if (psychoAdaptations) {
        await addLog('Адаптационни стратегии генерирани', { checkpoint: true });
      }
      
      // Логване на дисонанси ако има
      if (psychoCorrelation.dissonances && psychoCorrelation.dissonances.length > 0) {
        await addLog(
          `⚠️ Открити ${psychoCorrelation.dissonances.length} несъответствия между въпросник и психопрофил`, 
          { checkpoint: true }
        );
      }
    }
  } catch (corrErr) {
    console.error(`PROCESS_USER_PLAN_WARN (${userId}): Грешка при психо корелация - ${corrErr.message}`);
    await addLog(`Предупреждение: Психо корелацията не успя - ${corrErr.message}`, { checkpoint: true });
  }
}
```

#### 2.2. Добавяне към plan builder

```javascript
// След генерирането на psychoAdaptations, добави към planBuilder

if (psychoTestsData) {
  planBuilder.psychoTestsProfile = psychoTestsData;
}

if (psychoCorrelation) {
  planBuilder.psychoCorrelation = psychoCorrelation;
}

if (psychoAdaptations) {
  planBuilder.psychoAdaptations = psychoAdaptations;
}
```

### Фаза 3: Обогатяване на AI промпт (Приоритет: Среден)

**Оценка на време:** 1-2 дни

#### 3.1. Актуализиране на prompt_unified_plan_generation_v2

**Файл:** `kv/DIET_RESOURCES/prompt_unified_plan_generation_v2`

Добави в края на промпта, преди финалните инструкции:

```
{{#if psychoCorrelation}}

═══════════════════════════════════════════════════════════
ПСИХОЛОГИЧЕСКИ ПРОФИЛ И КОРЕЛАЦИОНЕН АНАЛИЗ
═══════════════════════════════════════════════════════════

## Корелационен score: {{psychoCorrelation.correlationScore}}%

{{psychoCorrelation.interpretation}}

{{#if psychoCorrelation.dissonances.length}}
⚠️ ВАЖНО: Открити {{psychoCorrelation.dissonances.length}} несъответствия:

{{#each psychoCorrelation.dissonances}}
- {{this.aspect}}: {{this.note}}
  → Действие: {{this.action}}
{{/each}}

При несъответствия:
- Даване на приоритет на психопрофила (той е по-обективен)
- Включване на механизми за самонаблюдение
- Деликатно адресиране на потенциалните слепи точки
{{/if}}

{{#if psychoAdaptations}}

## Препоръчани адаптации

### Структура на хранене
Ниво: {{psychoAdaptations.structure}}
{{#if (eq psychoAdaptations.structure 'strict')}}
- Фиксирани часове на хранене
- Детайлен план
- Точни порции
{{else if (eq psychoAdaptations.structure 'minimal')}}
- Широки прозорци за хранене
- Общи принципи
- Фокус върху навици, не правила
{{else}}
- Гъвкави прозорци (±30 мин)
- Общи насоки
- Толеранс към отклонения
{{/if}}

### AI комуникация
Честота: {{psychoAdaptations.aiFrequency}}
Тон: {{psychoAdaptations.aiTone}}
Тип мотивация: {{psychoAdaptations.motivationType}}

### Coping стратегии
{{#each psychoAdaptations.copingStrategies}}
- {{this}}
{{/each}}

ИНСТРУКЦИИ ЗА ГЕНЕРИРАНЕ:
- Адаптирай структурата на плана според {{psychoAdaptations.structure}}
- Използвай тон {{psychoAdaptations.aiTone}} в комуникацията
- Включи стратегии за справяне с идентифицираните рискове
- Персонализирай мотивацията според {{psychoAdaptations.motivationType}}

{{/if}}

{{/if}}
```

### Фаза 4: API endpoints (Приоритет: Нисък - опционално)

**Оценка на време:** 1 ден

#### 4.1. GET /api/getPsychCorrelation

```javascript
// В worker.js fetch handler
else if (method === 'GET' && path === '/api/getPsychCorrelation') {
  responseBody = await handleGetPsychCorrelationRequest(request, env);
}

// Handler функция
async function handleGetPsychCorrelationRequest(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  if (!userId) {
    return { success: false, message: "Missing userId", statusHint: 400 };
  }
  
  const correlationStr = await env.USER_METADATA_KV.get(`${userId}_psych_correlation`);
  
  if (!correlationStr) {
    return { 
      success: false, 
      message: "No correlation data found", 
      statusHint: 404 
    };
  }
  
  return {
    success: true,
    data: safeParseJson(correlationStr, null)
  };
}
```

### Фаза 5: Тестване (Приоритет: Висок)

**Оценка на време:** 2-3 дни

#### 5.1. Unit тестове

**Файл:** `tests/psychoCorrelation.spec.js` (нов файл)

```javascript
import { describe, it, expect } from '@jest/globals';

// Mock функциите за тестване
function calculatePsychoCorrelation(initialAnswers, psychoProfile) {
  // Copy from worker.js
}

describe('Psycho Correlation', () => {
  it('should detect high correlation when overeating matches high impulsivity', () => {
    const initialAnswers = {
      overeatingFrequency: 'Често'
    };
    
    const psychoProfile = {
      personalityTest: {
        scores: { I: 70, C: 50, N: 50, E: 50, O: 50, A: 50, R: 50 }
      }
    };
    
    const result = calculatePsychoCorrelation(initialAnswers, psychoProfile);
    
    expect(result).not.toBeNull();
    expect(result.correlationScore).toBeGreaterThan(70);
    expect(result.correlations.length).toBeGreaterThan(0);
    expect(result.correlations[0].status).toBe('confirmed');
  });
  
  it('should detect dissonance when no overeating claimed but high impulsivity', () => {
    const initialAnswers = {
      overeatingFrequency: 'Никога'
    };
    
    const psychoProfile = {
      personalityTest: {
        scores: { I: 75, C: 35, N: 50, E: 50, O: 50, A: 50, R: 50 }
      }
    };
    
    const result = calculatePsychoCorrelation(initialAnswers, psychoProfile);
    
    expect(result).not.toBeNull();
    expect(result.dissonances.length).toBeGreaterThan(0);
    expect(result.dissonances[0].status).toBe('dissonance');
  });
  
  // Добави повече тестове...
});
```

## Чеклист за имплементация

- [ ] Фаза 1: Основна корелационна логика
  - [ ] Имплементирай `calculatePsychoCorrelation`
  - [ ] Имплементирай `generatePsychoAdaptations`
  - [ ] Тествай функциите локално
- [ ] Фаза 2: Интеграция в processSingleUserPlan
  - [ ] Добави корелационен анализ в processSingleUserPlan
  - [ ] Добави адаптации към plan builder
  - [ ] Тествай на тестов потребител
- [ ] Фаза 3: Обогатяване на AI промпт
  - [ ] Актуализирай prompt_unified_plan_generation_v2
  - [ ] Sync KV ресурси (`npm run sync-kv`)
  - [ ] Тествай генериране на план с психопрофил
- [ ] Фаза 4: API endpoints (опционално)
  - [ ] Имплементирай GET /api/getPsychCorrelation
  - [ ] Тествай endpoint
- [ ] Фаза 5: Тестване
  - [ ] Създай unit тестове
  - [ ] Направи integration тестове
  - [ ] Мануално тестване с различни профили
  - [ ] Deploy в production

## Забележки

- Фазите могат да се изпълняват паралелно
- Фаза 4 е опционална и може да се пропусне първоначално
- Фокусирай се на Фаза 1-3 за MVP имплементация
- Тестването е критично - не пропускай Фаза 5

---

**Автор:** GitHub Copilot  
**Дата:** 2024-12-16  
**Версия:** 1.0.0
