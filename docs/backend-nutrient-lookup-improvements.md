# Backend Improvements for PR #2031 - Nutrient Lookup System

## Проблем / Problem

PR #2031 въведе система за автоматично изчисляване на макроси чрез AI в frontend-а, но backend-ът (`worker-backend.js`) използваше много опростен prompt и не проверяваше локалната база данни `product_macros.json` преди да извика AI модела.

PR #2031 introduced a system for automatic macro calculation through AI in the frontend, but the backend (`worker-backend.js`) used a very simplified prompt and didn't check the local `product_macros.json` database before calling the AI model.

## Решение / Solution

### 1. Нов специализиран prompt за хранителни стойности

Създаден е нов файл `kv/DIET_RESOURCES/prompt_nutrient_lookup.txt` който:
- Предоставя контекст за 135+ български храни в базата данни
- Дава конкретни примери за формат на отговор
- Включва правила за мащабиране на количества
- Насочва AI модела към по-точни отговори

A new file `kv/DIET_RESOURCES/prompt_nutrient_lookup.txt` was created which:
- Provides context about 135+ Bulgarian foods in the database
- Gives concrete examples of response format
- Includes rules for quantity scaling
- Guides the AI model toward more accurate responses

### 2. Подобрена логика в `lookupNutrients` функцията

Новата логика следва 3-степенна стратегия:

The new logic follows a 3-tier strategy:

#### Стъпка 1: Локална база данни / Step 1: Local Database

```javascript
// Проверява product_macros.json чрез RESOURCES_KV
// Checks product_macros.json through RESOURCES_KV
if (env.RESOURCES_KV) {
  const products = JSON.parse(await env.RESOURCES_KV.get('product_macros'));
  // Търси съвпадение / Search for match
  // Мащабира макросите според количеството / Scale macros by quantity
}
```

#### Стъпка 2: Външен Nutrition API / Step 2: External Nutrition API

```javascript
// Ако не е намерено локално, опитва външен API (ако е конфигуриран)
// If not found locally, tries external API (if configured)
if (env.NUTRITION_API_URL) {
  const apiResp = await fetch(env.NUTRITION_API_URL + query);
  // ...
}
```

#### Стъпка 3: AI модел със специализиран prompt / Step 3: AI Model with Specialized Prompt

```javascript
// Зарежда специализирания prompt от RESOURCES_KV
// Loads specialized prompt from RESOURCES_KV
const promptTemplate = await env.RESOURCES_KV.get('prompt_nutrient_lookup');
const systemPrompt = promptTemplate.replace('%%FOOD_QUERY%%', query);

// Извиква AI модела / Calls AI model
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: query }
];
```

### 3. Мащабиране на количества / Quantity Scaling

Системата автоматично разпознава и мащабира количества:
- "ябълка 150гр" → мащабира x1.5
- "домат 200g" → мащабира x2
- "банан" (без количество) → използва 100г като база

The system automatically recognizes and scales quantities:
- "ябълка 150гр" → scales x1.5
- "домат 200g" → scales x2
- "банан" (no quantity) → uses 100g as base

### 4. Кеширане / Caching

Резултатите продължават да се кешират в `USER_METADATA_KV` за 24 часа, независимо от източника на данните.

Results continue to be cached in `USER_METADATA_KV` for 24 hours, regardless of data source.

## Ползи / Benefits

1. **По-бързи отговори**: Локалната база данни връща резултат мигновено
2. **По-точни данни**: 135+ български храни с проверени хранителни стойности
3. **По-малко AI заявки**: Намалява разходите и латентността
4. **По-добри AI отговори**: Специализираният prompt дава по-точни резултати когато AI е необходим
5. **Кеширане**: Повтарящите се заявки се обслужват от кеша

1. **Faster responses**: Local database returns results instantly
2. **More accurate data**: 135+ Bulgarian foods with verified nutritional values
3. **Fewer AI calls**: Reduces costs and latency
4. **Better AI responses**: Specialized prompt gives more accurate results when AI is needed
5. **Caching**: Repeated queries are served from cache

## Конфигурация / Configuration

За пълна функционалност, backend-ът изисква следните environment variables:

For full functionality, the backend requires the following environment variables:

### Задължителни за AI fallback / Required for AI fallback:
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `CF_AI_TOKEN` - Cloudflare AI API token
- `MODEL` - AI model name (напр. / e.g. "@cf/meta/llama-3-8b-instruct")

### Опционални / Optional:
- `NUTRITION_API_URL` - External nutrition API URL
- `NUTRITION_API_KEY` - External nutrition API key

### KV Namespaces:
- `RESOURCES_KV` - За достъп до DIET_RESOURCES (product_macros.json, prompts)
- `USER_METADATA_KV` - За кеширане на резултати

## Тестване / Testing

Системата може да се тества ръчно:

The system can be tested manually:

```bash
curl -X POST https://your-worker.workers.dev/nutrient-lookup \
  -H "Content-Type: application/json" \
  -d '{"food": "ябълка", "quantity": "150"}'
```

Очакван отговор / Expected response:
```json
{
  "calories": 78,
  "protein": 0.45,
  "carbs": 21,
  "fat": 0.3,
  "fiber": 3.6
}
```

## Бъдещи подобрения / Future Improvements

1. Добавяне на повече продукти в `product_macros.json`
2. Fuzzy matching за по-добро разпознаване на продукти
3. Поддръжка за синоними (напр. "ябълка" = "apple")
4. Логване на AI заявки за анализ и подобрение на prompt-а
5. A/B тестване на различни prompt варианти

1. Add more products to `product_macros.json`
2. Fuzzy matching for better product recognition
3. Support for synonyms (e.g. "ябълка" = "apple")
4. Logging of AI requests for analysis and prompt improvement
5. A/B testing of different prompt variants
