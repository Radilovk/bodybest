# Пример: скалиране на макроси

Следният код показва как 150 г пилешко месо се превръщат в макроси.

```js
import { scaleMacros } from '../js/macroUtils.js';

const chicken100g = { calories: 110, protein: 21, carbs: 0, fat: 2.4 };
const result = scaleMacros(chicken100g, 150);
// result: { calories: 165, protein: 31.5, carbs: 0, fat: 3.6 }
```

Получаваме **165 ккал, 31.5 г протеин, 3.6 г мазнини**.
