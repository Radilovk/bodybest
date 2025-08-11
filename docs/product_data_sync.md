# Синхронизация на продуктовите данни

Файловете `kv/DIET_RESOURCES/product_measure.json` и `kv/DIET_RESOURCES/product_macros.json` трябва да съдържат един и същ набор от имена на продукти и синоними/варианти (например "ябълка", "ябълки"). Сравнението е без значение на регистъра.

## Пример за добавяне
1. Добавете името и мерките в `product_measure.json` (включете синоними като отделен запис).
2. Добавете същото име и макросите в `product_macros.json`.
3. Уверете се, че имената съвпадат точно:
   ```json
   { "name": "киноа", "measures": [...] }
   { "name": "киноа", "calories": ... }
   { "name": "киноа (сварена)", "measures": [...] }
   { "name": "киноа (сварена)", "calories": ... }
   ```

## Проверка
Изпълнете:

```
npm run lint
npm test -- js/__tests__/productDataConsistency.test.js
```

Тестът `productDataConsistency` ще сигнализира при липсващи или излишни имена.
