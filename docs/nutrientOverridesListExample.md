# Пример за използване на списъка с макроси

Функцията `getNutrientOverride()` чете стойности от `kv/DIET_RESOURCES/nutrient_overrides.json` и може автоматично да попълва макронутриентите при извънредно хранене.

```js
import { getNutrientOverride } from '../js/macroUtils.js';

const macros = getNutrientOverride('ябълка');
console.log(macros); // { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 }
```

Получените стойности могат директно да се добавят към текущия прием или да се визуализират в UI компоненти.
