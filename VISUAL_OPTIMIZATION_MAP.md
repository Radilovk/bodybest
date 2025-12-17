# 📊 Визуална карта на оптимизациите

## 🗺️ Архитектура ПРЕДИ оптимизация

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser)                    │
├─────────────────────────────────────────────────────────────┤
│  Dashboard Load:                                             │
│  ├─ GET /api/checkPlanPrerequisites  ────┐                  │
│  ├─ GET /api/getPlan                  ────┼── 4 API calls   │
│  ├─ GET /api/getAnalytics             ────┤                  │
│  └─ GET /api/getDailyLog              ────┘                  │
│                                                              │
│  Tab Switching (x10):                                        │
│  ├─ GET /api/getAnalytics (x10)       ────── 30 API calls   │
│  └─ GET /api/getPlan (x5)             ────                   │
│                                                              │
│  Status Polling (5 min):                                     │
│  └─ GET /api/analysisStatus (x30)     ────── 30 API calls   │
│                                                              │
│  Total per 30min session: 71 API calls                      │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER                        │
├─────────────────────────────────────────────────────────────┤
│  API Endpoints:                                              │
│  ├─ /api/checkPlanPrerequisites                             │
│  ├─ /api/getPlan                                             │
│  ├─ /api/getAnalytics                                        │
│  ├─ /api/getDailyLog                                         │
│  ├─ /api/analysisStatus                                      │
│  └─ ... (60+ endpoints)                                      │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────┐
│                    USER_METADATA_KV                          │
├─────────────────────────────────────────────────────────────┤
│  Storage per user: ~140KB                                    │
│                                                              │
│  ✅ НЕОБХОДИМИ (~83KB):                                      │
│  ├─ credential_{userId}           (500B)                     │
│  ├─ {userId}_profile             (2KB)                       │
│  ├─ {userId}_initial_answers     (10KB)                      │
│  ├─ {userId}_analysis            (15KB)                      │
│  ├─ {userId}_final_plan          (50KB)                      │
│  └─ {userId}_log_* (30 days)     (90KB)                      │
│                                                              │
│  🔴 ИЗЛИШНИ (~57KB):                                         │
│  ├─ {userId}_analysis_macros     (2KB)  ← дублира final_plan│
│  ├─ {userId}_logs (aggregated)   (50KB) ← дублира _log_*    │
│  └─ {userId}_plan_log            (5KB)  ← рядко използван   │
│                                                              │
│  ⚠️ ЛИПСВАЩИ:                                                │
│  └─ {userId}_psych_tests         (0KB)  ← критично!         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Архитектура СЛЕД оптимизация

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  Dashboard Load:                                             │
│  ├─ POST /api/getDashboardData                               │
│  │   (combined: prerequisites + plan + analytics + log)      │
│  └─ ✅ 1 API call instead of 4                               │
│                                                              │
│  Tab Switching (x10):                                        │
│  ├─ Cache hit (90% of time)        ────── 3 API calls       │
│  └─ Smart invalidation                                       │
│                                                              │
│  Status Updates:                                             │
│  └─ WebSocket connection           ────── 0 polling calls   │
│                                                              │
│  Logging:                                                    │
│  ├─ localStorage (instant)                                   │
│  └─ Batch sync every 30s           ────── 1 API call        │
│                                                              │
│  Total per 30min session: 8 API calls (-89%)                │
│                                                              │
│  LocalStorage Cache:                                         │
│  ├─ Profile (5 min TTL)                                      │
│  ├─ Analytics (15 min TTL)                                   │
│  ├─ Plan (30 min TTL)                                        │
│  └─ Daily logs (instant write)                               │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE WORKER (Optimized)              │
├─────────────────────────────────────────────────────────────┤
│  New Endpoints:                                              │
│  ├─ POST /api/getDashboardData  (combined)                   │
│  ├─ WS   /status                 (WebSocket)                 │
│  └─ POST /api/savePsychTests     (new)                       │
│                                                              │
│  Optimized:                                                  │
│  ├─ Combined responses                                       │
│  ├─ Smart caching headers                                    │
│  └─ Batch operations                                         │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────┐
│              USER_METADATA_KV (Optimized)                    │
├─────────────────────────────────────────────────────────────┤
│  Storage per user: ~97KB (-31%)                              │
│                                                              │
│  ✅ НЕОБХОДИМИ (~83KB):                                      │
│  ├─ credential_{userId}           (500B)                     │
│  ├─ {userId}_profile             (2KB)                       │
│  ├─ {userId}_initial_answers     (5KB)   ← compressed       │
│  ├─ {userId}_analysis            (8KB)   ← optimized        │
│  ├─ {userId}_final_plan          (50KB)                      │
│  └─ {userId}_log_* (v2 format)   (54KB)  ← -40% size        │
│                                                              │
│  ✅ ДОБАВЕНИ (~14KB):                                        │
│  ├─ {userId}_psych_tests         (8KB)   ← НОВО!            │
│  ├─ {userId}_behavior_patterns   (4KB)   ← НОВО!            │
│  └─ {userId}_context             (2KB)   ← НОВО!            │
│                                                              │
│  🗑️ ПРЕМАХНАТИ (~57KB):                                      │
│  ├─ {userId}_analysis_macros     (0KB)   ✅ removed         │
│  ├─ {userId}_logs                (0KB)   ✅ removed         │
│  └─ {userId}_plan_log            (0KB)   ✅ removed         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Log Structure Evolution

### V1 (Current) - 3KB per day
```json
{
  "date": "2024-12-17",
  "meals": {
    "breakfast": {
      "consumed": true,
      "time": "08:30",
      "items": [{
        "name": "Овесена каша",
        "quantity": "200g",
        "calories": 350,
        "protein_grams": 12,
        "carbs_grams": 58,
        "fat_grams": 8
      }]
    },
    "snack1": { "consumed": false },
    "lunch": { ... },
    "snack2": { "consumed": false },
    "dinner": { ... }
  },
  "extraMeals": [...],
  "water_intake": 2.5,
  "weight_kg": 75.3,
  "exercise": "Тренировка - 60 мин",
  "sleep_hours": 7.5,
  "mood": "Добро",
  "energy_level": 4,
  "notes": "..."
}
```

### V2 (Optimized) - 1.8KB per day (-40%)
```json
{
  "v": 2,
  "d": "2024-12-17",
  "m": {
    "b": {"t":"08:30","i":[{"n":"Овесена каша","q":"200g","c":350,"p":12,"cb":58,"f":8}]},
    "l": {...},
    "d": {...}
  },
  "x": [...],
  "w": 2.5,
  "wg": 75.3,
  "e": {"t":1,"d":60},
  "s": 7.5,
  "mo": 4,
  "en": 4,
  "n": "..."
}
```

### V2 + LZ-String - 0.8KB per day (-73%)
```
Compressed binary representation
```

---

## 🔄 API Call Flow Comparison

### ПРЕДИ - 71 calls per 30min session
```
Login
  └─ POST /api/login                          [1]
  └─ GET  /api/getProfile                     [2]

Dashboard Load
  ├─ GET  /api/checkPlanPrerequisites         [3]
  ├─ GET  /api/getPlan                        [4]
  ├─ GET  /api/getAnalytics                   [5]
  └─ GET  /api/getDailyLog                    [6]

Tab Switch to Profile
  └─ GET  /api/getProfile                     [7] ← cache miss

Tab Switch to Dashboard (x3)
  ├─ GET  /api/getAnalytics                   [8,11,14]
  └─ No cache

Tab Switch to Week Plan (x2)
  └─ GET  /api/getPlan                        [9,12]

Tab Switch to Recommendations (x2)
  └─ GET  /api/getPlan                        [10,13]

Tab Switch to Dashboard (x3)
  └─ GET  /api/getAnalytics                   [15,18,21]

Tab Switch to Profile (x2)
  └─ GET  /api/getProfile                     [16,19]

Tab Switch to Week Plan (x3)
  └─ GET  /api/getPlan                        [17,20,22]

Tab Switch to Dashboard (x4)
  └─ GET  /api/getAnalytics                   [23,26,29,32]

Logging (x5)
  ├─ Already offline-first                    [24,27,30,33,35]
  └─ Batch sync

Status Polling (5 minutes @ 10s interval)
  └─ GET  /api/analysisStatus (x30)           [36-65]

Tab Switch to Dashboard (x3)
  └─ GET  /api/getAnalytics                   [66,68,70]

Tab Switch to Profile
  └─ GET  /api/getProfile                     [67]

Tab Switch to Week
  └─ GET  /api/getPlan                        [69]

Tab Switch to Dashboard
  └─ GET  /api/getAnalytics                   [71]

═══════════════════════════════════════════════════════════
TOTAL: 71 API calls
```

### СЛЕД - 8 calls per 30min session (-89%)
```
Login
  └─ POST /api/login                          [1]
  └─ GET  /api/getProfile → cache 5min        [2]

Dashboard Load
  └─ POST /api/getDashboardData               [3]
      (combined: prereq + plan + analytics + log)
      └─ cache: analytics 15min, plan 30min

Tab Switches (x10)
  ├─ Cache hits (9x)                          [✓ cached]
  └─ Cache miss (1x)                          [4]
      └─ GET  /api/getAnalytics

Logging (x5)
  └─ localStorage + 1 batch sync              [5]

Status Updates
  └─ WebSocket (0 polling)                    [0]

Profile Update
  └─ Cache invalidation triggered             [6,7]
      ├─ GET /api/getProfile
      └─ POST /api/getDashboardData

═══════════════════════════════════════════════════════════
TOTAL: 8 API calls (-89%)
```

---

## 🎨 Персонализация - Data Flow

### СЕГА (Базова персонализация)
```
User
  │
  ├─ Регистрация
  │   └─ Profile данни (възраст, тегло, височина, пол)
  │
  ├─ Въпросник
  │   └─ initial_answers → analysis (AI)
  │
  ├─ Психо тестове
  │   ├─ Визуален тест      → localStorage only ❌
  │   └─ Личностен тест     → localStorage only ❌
  │
  └─ План генериране
      └─ AI използва само: profile + analysis
         (❌ БЕЗ psych данни!)
```

### СЛЕД (Напреднала персонализация)
```
User
  │
  ├─ Регистрация
  │   └─ Profile данни
  │
  ├─ Въпросник
  │   └─ initial_answers → analysis (AI)
  │
  ├─ Психо тестове
  │   ├─ Визуален тест      → sync to backend ✅
  │   └─ Личностен тест     → sync to backend ✅
  │       │
  │       └─ psychTests в KV
  │
  ├─ Поведенчески patterns
  │   └─ Auto-detect от логове → behavior_patterns
  │
  ├─ Контекст
  │   └─ Lifestyle questionnaire → context
  │
  └─ План генериране (Обогатен AI)
      └─ AI използва:
         ├─ profile (базови данни)
         ├─ analysis (от въпросник)
         ├─ psychTests (психологически профил) ✅ НОВО
         ├─ behavior_patterns (реални навици) ✅ НОВО
         └─ context (lifestyle) ✅ НОВО
         
      → Много по-персонализиран план!
      → Адаптиран chat стил!
      → Проактивни съвети!
```

---

## 🚀 Implementation Timeline

```
SPRINT 1 (Week 1) - Quick Wins ⚡
═══════════════════════════════════════════════════════════
Day 1-2: Remove Duplicated Data
  ├─ Delete analysis_macros writes
  ├─ Delete _logs aggregated
  └─ Limit plan_log history
  
Day 3-4: Profile & Analytics Caching
  ├─ Implement PersistentCache with TTL
  ├─ Smart invalidation on updates
  └─ localStorage management
  
Day 5: Combined Dashboard API
  ├─ New endpoint: /api/getDashboardData
  ├─ Update frontend to use it
  └─ Remove old individual calls

Result: -89% API calls, -31% storage
───────────────────────────────────────────────────────────

SPRINT 2 (Week 2) - Personalization 🎯
═══════════════════════════════════════════════════════════
Day 1-3: Psych Tests Integration
  ├─ New endpoint: /api/savePsychTests
  ├─ Update psy/*.html to sync
  └─ KV storage schema
  
Day 4-5: AI Prompt Adaptation
  ├─ Update prompts with psych section
  ├─ Modify plan generation
  └─ Personalize chat assistant
  
Day 6-7: Log Structure v2
  ├─ Create v2 format
  ├─ Migration script
  └─ Update read/write logic

Result: Advanced personalization, -40% log size
───────────────────────────────────────────────────────────

SPRINT 3 (Optional) - Advanced 🚀
═══════════════════════════════════════════════════════════
Day 1-3: LZ-String Compression
  ├─ Add library
  ├─ Compress logs > 7 days
  └─ Background migration
  
Day 4-5: Weekly Aggregates
  ├─ Cron job for aggregation
  ├─ Update analytics queries
  └─ Fallback logic

Result: +30-50% additional gains
═══════════════════════════════════════════════════════════
```

---

## 📈 Metrics Dashboard

### Storage Optimization
```
┌────────────────────────────────────────────────────────┐
│ Storage per User                                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ПРЕДИ: ████████████████████████ 140KB                 │
│                                                         │
│  СЛЕД:  █████████████            97KB (-31%)           │
│                                                         │
│  Спестяване: ███████ 43KB                              │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### API Calls Reduction
```
┌────────────────────────────────────────────────────────┐
│ API Calls per 30min Session                            │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ПРЕДИ: ████████████████████████████████████████ 71    │
│                                                         │
│  СЛЕД:  ████                                     8     │
│                                                         │
│  Намаление: 89%                                        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Load Time Improvement
```
┌────────────────────────────────────────────────────────┐
│ Dashboard Load Time                                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ПРЕДИ: ████████████████████████████ 2.5s              │
│                                                         │
│  СЛЕД:  ████████                     0.8s (-68%)       │
│                                                         │
│  По-бързо с: 1.7 секунди                               │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Log Size Evolution
```
┌────────────────────────────────────────────────────────┐
│ Daily Log Size                                          │
├────────────────────────────────────────────────────────┤
│                                                         │
│  v1 (current):    ████████████████ 3.0KB               │
│                                                         │
│  v2 (optimized):  ██████████       1.8KB (-40%)        │
│                                                         │
│  v2 + LZ-String:  ████             0.8KB (-73%)        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

**Документ създаден:** 2024-12-17  
**За пълни детайли:** COMPREHENSIVE_DATA_OPTIMIZATION_ANALYSIS.md
