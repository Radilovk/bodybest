# Синхронизация на продуктовите данни

Файловете `kv/DIET_RESOURCES/product_measure.json` и `kv/DIET_RESOURCES/product_macros.json` трябва да съдържат един и същ набор от продукти. Всеки продукт може да има поле `aliases` с масив от синоними (например "ябълка", "ябълки"). Сравнението е без значение на регистъра.

## Пример за добавяне
1. Добавете името, `aliases` и мерките в `product_measure.json`.
2. Добавете същото име и `aliases` (ако има) с макросите в `product_macros.json`.
3. Уверете се, че имената и синонимите съвпадат точно:
   ```json
   { "name": "киноа", "aliases": ["quinoa"], "measures": [...] }
   { "name": "киноа", "aliases": ["quinoa"], "calories": ... }
   ```

## Проверка
Изпълнете:

```
npm run lint
npm test -- js/__tests__/productDataConsistency.test.js
```

Тестът `productDataConsistency` ще сигнализира при липсващи или излишни имена.
