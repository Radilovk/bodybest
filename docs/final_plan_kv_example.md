# Пример за KV запис `final_plan`

Информацията за генерирания план се съхранява в `USER_METADATA_KV` под ключ `<userId>_final_plan`. Този запис представлява завършен персонализиран план в JSON формат.

## Основни полета

- `profileSummary` – кратък преглед на целта, медицинските особености и предпочитанията на потребителя.
- `caloriesMacros` – обект с две части: `plan` и `recommendation`, всяка с калории и макронутриенти (включително фибри).
- `allowedForbiddenFoods` – списък с основни позволени и ограничени храни, включително допълнителни предложения.
- `week1Menu` – меню по дни за първата седмица.
- `principlesWeek2_4` – принципи и насоки за седмици 2‑4.
- `hydrationCookingSupplements` – препоръки за хидратация, методи на готвене и възможни добавки.
- `psychologicalGuidance` – стратегии и мотивиращи съобщения.
- `detailedTargets` – конкретни количествени и описателни цели.
- `generationMetadata` – технически данни за генерирането (timestamp, използван модел и др.).

Пълният примерен запис може да се види във файла [`final_plan_template.json`](final_plan_template.json). Структурата следва camelCase именуване и съдържа текст на български език.

Примерна секция `caloriesMacros`:

```json
"caloriesMacros": {
  "plan": {
    "calories": 1800,
    "protein_grams": 135,
    "carbs_grams": 180,
    "fat_grams": 60,
    "fiber_percent": 10,
    "fiber_grams": 30
  },
  "recommendation": {
    "calories": 1900,
    "protein_grams": 140,
    "carbs_grams": 190,
    "fat_grams": 65,
    "fiber_percent": 12,
    "fiber_grams": 35
  }
}
```

## Макро записи

За проследяване на промените се използва същият ключ като при първоначалния анализ:

- `<userId>_analysis_macros` – сравнение „План vs Препоръка“ с флаг `status: "final"`.

```json
// <userId>_analysis_macros
{
  "status": "final",
  "data": {
    "plan": {
      "calories": 1800,
      "protein_grams": 135,
      "carbs_grams": 180,
      "fat_grams": 60,
      "fiber_percent": 10,
      "fiber_grams": 30
    },
    "recommendation": {
      "calories": 1900,
      "protein_grams": 140,
      "carbs_grams": 190,
      "fat_grams": 65,
      "fiber_percent": 12,
      "fiber_grams": 35
    }
  }
}
```

Всички стойности са в **kcal** и **грамове**.
