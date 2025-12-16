# Documentation Index - Индекс на документацията

> Навигационен индекс към цялата документация в проекта.

## 🎯 Начало тук

### За нови разработчици
1. **[QUICK_START.md](./QUICK_START.md)** ⭐ - Старт за 5-10 минути
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Разбери цялата архитектура
3. **[README.md](./README.md)** - Main документация

### За опитни разработчици
1. **[MODULE_MAP.md](./MODULE_MAP.md)** - Бърза reference на всички модули
2. **[FILE_STRUCTURE.md](./FILE_STRUCTURE.md)** - Намери конкретен файл
3. **[docs/DEV_GUIDE_BG.md](./docs/DEV_GUIDE_BG.md)** - Кратки команди

---

## 📚 Core Документация

### Архитектура и структура
| Документ | Описание | Редове | Време |
|----------|----------|--------|-------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Цялостна архитектура, технологичен стек, потоци от данни | ~1000 | 30 мин |
| **[MODULE_MAP.md](./MODULE_MAP.md)** | Детайлна карта на 50+ модули с API и примери | ~1300 | 20 мин |
| **[FILE_STRUCTURE.md](./FILE_STRUCTURE.md)** | Пълна структура на ~200 файла в проекта | ~1100 | 15 мин |
| **[QUICK_START.md](./QUICK_START.md)** | Бърз старт за работа за 5-10 минути | ~400 | 5 мин |

**Общо:** ~3800 реда документация

---

## 🗺️ Навигация по теми

### Frontend Development
```
QUICK_START.md
  └─ Frontend setup
     └─ MODULE_MAP.md
        └─ UI Components секция
           └─ Конкретен модул (напр. themeControls.js)
              └─ Source code (js/themeControls.js)
```

**Теми:**
- UI Components → [MODULE_MAP.md](./MODULE_MAP.md#ui-components)
- Themes → [ARCHITECTURE.md](./ARCHITECTURE.md#themes-система)
- Offline Logging → [README.md](./README.md#offline-first-architecture-phase-2)

---

### Backend Development
```
ARCHITECTURE.md
  └─ Backend архитектура
     └─ Worker структура
        └─ API Endpoints
           └─ Конкретен endpoint
              └─ worker.js source
```

**Теми:**
- Worker Architecture → [ARCHITECTURE.md](./ARCHITECTURE.md#backend-архитектура)
- API Endpoints → [ARCHITECTURE.md](./ARCHITECTURE.md#api-endpoints)
- KV Storage → [ARCHITECTURE.md](./ARCHITECTURE.md#съхранение-на-данни-kv)

---

### AI Integration
```
ARCHITECTURE.md
  └─ AI Services
     └─ docs/AI_PLAN_MODIFICATION_BG.md
        └─ Конкретни промптове
           └─ kv/DIET_RESOURCES/prompt_*.txt
```

**Теми:**
- AI Models → [ARCHITECTURE.md](./ARCHITECTURE.md#ai-модели)
- Plan Generation → [docs/AI_PLAN_MODIFICATION_BG.md](./docs/AI_PLAN_MODIFICATION_BG.md)
- Analytics → [docs/ANALYTICS_FORMULAS_BG.md](./docs/ANALYTICS_FORMULAS_BG.md)

---

### Deployment & DevOps
```
README.md
  └─ Deployment section
     └─ wrangler.toml
        └─ GitHub Actions (.github/workflows/deploy.yml)
```

**Теми:**
- Setup → [QUICK_START.md](./QUICK_START.md#2-setup-на-околната-среда-10-минути)
- Deployment → [README.md](./README.md#deployment-to-cloudflare)
- Scripts → [FILE_STRUCTURE.md](./FILE_STRUCTURE.md#scripts)

---

## 📖 Допълнителна документация

### Implementation & Technical
| Документ | Описание |
|----------|----------|
| [PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md) | Phase 2 offline-first implementation |
| [PHASE2_COMPLETION_REPORT.md](./PHASE2_COMPLETION_REPORT.md) | Completion report |
| [BACKEND_OPTIMIZATION_ANALYSIS.md](./BACKEND_OPTIMIZATION_ANALYSIS.md) | Backend optimization analysis |
| [OPTIMIZATIONS.md](./docs/OPTIMIZATIONS.md) | Performance optimizations |

### AI & Planning
| Документ | Описание |
|----------|----------|
| [docs/AI_PLAN_MODIFICATION_BG.md](./docs/AI_PLAN_MODIFICATION_BG.md) | AI plan modification logic |
| [docs/ANALYTICS_FORMULAS_BG.md](./docs/ANALYTICS_FORMULAS_BG.md) | Analytics formulas |
| [docs/QUESTIONNAIRE_ANALYSIS_CORRELATION.md](./docs/QUESTIONNAIRE_ANALYSIS_CORRELATION.md) | Questionnaire analysis |
| [docs/PLAN_PROPOSAL_OPTIMIZATION_BG.md](./docs/PLAN_PROPOSAL_OPTIMIZATION_BG.md) | Plan proposal optimization |

### Psychological Tests & Personalization ⭐ NEW
| Документ | Описание |
|----------|----------|
| **[docs/PSYCHOMETRIC_PLAN_ADAPTATION_PROPOSAL_BG.md](./docs/PSYCHOMETRIC_PLAN_ADAPTATION_PROPOSAL_BG.md)** | 🎯 **ГЛАВЕН ДОКУМЕНТ** - Пълно предложение за адаптация на final_plan базирана на психометрични тестове |
| [docs/PSYCHOMETRIC_QUICK_REFERENCE_BG.md](./docs/PSYCHOMETRIC_QUICK_REFERENCE_BG.md) | Бърз справочник за разработчици - 16 типа, корелации, примери |
| [docs/psycho_tests_to_final_plan.md](./docs/psycho_tests_to_final_plan.md) | Автоматично запазване на психопрофил във final_plan |
| [docs/PSYCHO_TEST_IMPROVEMENTS.md](./docs/PSYCHO_TEST_IMPROVEMENTS.md) | Подобрения на психологическите тестове |

### Examples & References
| Документ | Описание |
|----------|----------|
| [docs/final_plan_kv_example.md](./docs/final_plan_kv_example.md) | Plan JSON structure example |
| [docs/questionnaire_kv_example.md](./docs/questionnaire_kv_example.md) | Questionnaire example |
| [docs/image_analysis_template_bg.md](./docs/image_analysis_template_bg.md) | Image analysis template |

### Setup & Configuration
| Документ | Описание |
|----------|----------|
| [CPANEL_EMAIL_SETUP.md](./CPANEL_EMAIL_SETUP.md) | cPanel email setup |
| [AI_PLAN_CONSENT_README_BG.md](./AI_PLAN_CONSENT_README_BG.md) | AI consent setup |
| [docs/product_data_sync.md](./docs/product_data_sync.md) | Product data sync |

### Project Management
| Документ | Описание |
|----------|----------|
| [AGENTS.md](./AGENTS.md) | Instructions for AI agents |
| [CLEANUP_ANALYSIS.md](./CLEANUP_ANALYSIS.md) | Code cleanup analysis |
| [ANALYSIS_COVERAGE.md](./ANALYSIS_COVERAGE.md) | Analysis coverage report |
| [docs/change-log.md](./docs/change-log.md) | Project changelog |

---

## 🔍 Търсене по теми

### Ако търсиш...

**"Къде е логиката за X?"**
→ [MODULE_MAP.md](./MODULE_MAP.md) - Пълен списък на модули

**"Как работи X?"**
→ [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектурни обяснения

**"Къде се намира файл Y?"**
→ [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) - Пълна структура

**"Как да започна?"**
→ [QUICK_START.md](./QUICK_START.md) - Бърз старт

**"Как да deploy-на?"**
→ [README.md](./README.md#deployment-to-cloudflare)

**"Как работи offline logging?"**
→ [README.md](./README.md#offline-first-architecture-phase-2)

**"Как да добавя AI модел?"**
→ [README.md](./README.md#конфигуриране-на-ai-модели)

**"Как работи theme системата?"**
→ [MODULE_MAP.md](./MODULE_MAP.md#jsthemecontrolsjs)

**"Какви са API endpoints?"**
→ [ARCHITECTURE.md](./ARCHITECTURE.md#api-endpoints)

**"Как е организиран worker.js?"**
→ [ARCHITECTURE.md](./ARCHITECTURE.md#main-worker-workerjs)

---

## 📊 Статистика на документацията

### Размер
- **Core документи:** 4 файла, ~3800 реда
- **Допълнителни:** 20+ файла
- **Общо:** 25+ markdown документа

### Покритие
- ✅ Architecture - 100%
- ✅ Frontend modules - 100%
- ✅ Backend workers - 100%
- ✅ File structure - 100%
- ✅ Quick start - 100%
- ✅ Setup guides - 100%
- ✅ API reference - 100%

### Качество
- 📝 Детайлни описания
- 💡 Практични примери
- 🔗 Cross-references
- 📊 Диаграми
- 🇧🇬 Български език
- ⚡ Бързи референции

---

## 🎓 Learning Path

### Beginner Path (1-2 часа)
1. [QUICK_START.md](./QUICK_START.md) - 10 мин
2. [README.md](./README.md) - Основни секции - 20 мин
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - Overview секции - 30 мин
4. Практика - Направи първа промяна - 30 мин

### Intermediate Path (3-4 часа)
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - Изцяло - 60 мин
2. [MODULE_MAP.md](./MODULE_MAP.md) - Интересни модули - 60 мин
3. [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) - Преглед - 30 мин
4. Source code exploration - 60 мин

### Advanced Path (1-2 дни)
1. Прочети всички core документи
2. Прочети допълнителните docs/
3. Прегледай целия source code
4. Експериментирай с промени
5. Допринеси към документацията

---

## 🔄 Актуализиране на документацията

### Кога да актуализираш

**ARCHITECTURE.md:**
- Нов модул/компонент
- Промяна в архитектурата
- Нова технология

**MODULE_MAP.md:**
- Нов JavaScript модул
- Промяна в API на модул
- Нови експорти

**FILE_STRUCTURE.md:**
- Нов файл/директория
- Преструктуриране
- Важна промяна в naming

**QUICK_START.md:**
- Промяна в setup процеса
- Нова best practice
- Често срещан въпрос

### Как да актуализираш

1. Edit markdown файла
2. Update версията и датата в края
3. Check cross-references
4. Commit с описателно съобщение
5. Update този индекс ако е нужно

---

## 📞 Нужда от помощ?

1. **Провери този индекс** - Намери подходящия документ
2. **Използвай search** - `git grep "keyword"`
3. **Провери examples** - Има ги в MODULE_MAP и README
4. **Питай в issues** - Създай issue в GitHub
5. **Прочети кода** - Кодът е документация

---

**Documentation maintained with ❤️ by the BodyBest team**

**Последна актуализация:** 2024-12-08  
**Версия:** 1.0.0
