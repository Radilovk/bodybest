# Пример: преизчисляване на калории

Следният код показва как некоректно въведени калории се коригират спрямо макронутриентите.

```js
import { recalculateCalories } from '../js/macroUtils.js';

const meal = { calories: 57, protein: 10, carbs: 20, fat: 10 };
const corrected = recalculateCalories(meal);
// corrected: { calories: 210, protein: 10, carbs: 20, fat: 10 }
```

Функцията пресмята калориите от протеин, въглехидрати, мазнини, фибри и алкохол и връща обект с актуализирани калории.
