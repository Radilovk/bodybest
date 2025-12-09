# Инструкции за конфигуриране на Nutrient Lookup с Gemini API

## Проблем
При опит за добавяне на несъществуваща в предложенията храна в extra meal се получава грешка 503:
```
"status": 503
"message": "AI услугата не е конфигурирана"
```

## Причина
Endpoint-ът `/nutrient-lookup` беше хардкодиран да използва само Cloudflare AI, но:
1. Вие искате да използвате Gemini 2.0 Flash
2. Конфигурацията липсва в Cloudflare KV store

## Решение
Кодът вече е актуализиран да поддържа Gemini API като fallback. Трябва само да конфигурирате Worker-а.

## Стъпки за конфигуриране

### 1. Качване на конфигурацията в KV Store

Изпълнете следната команда за да качите конфигурацията от `kv/DIET_RESOURCES/` в Cloudflare KV:

```bash
npm run sync-kv
```

Тази команда ще качи:
- `model_nutrient_lookup` → `gemini-2.0-flash-exp`
- `prompt_nutrient_lookup` → Оптимизиран промпт за хранителни данни

**Важно:** Трябва да сте влезли в Wrangler и да имате права за писане в KV store.

### 2. Конфигуриране на Gemini API Key

Уверете се, че имате `GEMINI_API_KEY` в Worker secrets:

```bash
# Проверете текущите secrets
wrangler secret list

# Ако липсва, добавете го
wrangler secret put GEMINI_API_KEY
```

След изпълнение на командата, въведете вашият Gemini API ключ.

### 3. Deploy на Worker-а

```bash
npm run deploy
```

Това ще:
1. Deploy-не актуализирания `worker.js` с Gemini поддръжка
2. Стартира миграцията на макроси

## Как работи новият код

### Приоритет на AI провайдърите:
1. **Локална база данни** → Ако храната е в `product_macros.json`
2. **Cloudflare AI** → Ако има `CF_ACCOUNT_ID` + `CF_AI_TOKEN` + `model_nutrient_lookup`
3. **Gemini API** → Ако има `GEMINI_API_KEY` + `model_nutrient_lookup`
4. **Грешка 503** → Ако нито едно не е конфигурирано

### Конфигурация в KV

След `npm run sync-kv`, в `RESOURCES_KV` ще има:

```
model_nutrient_lookup: "gemini-2.0-flash-exp"
prompt_nutrient_lookup: "You are a nutrition data expert..."
```

## Проверка

След deploy, тествайте endpoint-а:

```bash
curl -X POST https://openapichatbot.radilov-k.workers.dev/nutrient-lookup \
  -H "Content-Type: application/json" \
  -d '{"food": "шоколадов мъфин", "quantity": "80"}'
```

Очакван отговор:
```json
{
  "calories": 232,
  "protein": 4,
  "carbs": 41,
  "fat": 6,
  "fiber": 1.6
}
```

## Алтернативни конфигурации

### Вариант А: Използване само на Cloudflare AI

Ако предпочитате да използвате Cloudflare AI вместо Gemini:

1. Редактирайте `kv/DIET_RESOURCES/model_nutrient_lookup`:
   ```
   @cf/meta/llama-3.1-8b-instruct
   ```

2. Качете конфигурацията:
   ```bash
   npm run sync-kv
   ```

3. Уверете се, че имате:
   - `CF_ACCOUNT_ID` в `wrangler.toml`
   - `CF_AI_TOKEN` в Worker secrets

### Вариант Б: Използване на двата (препоръчително)

Конфигурирайте и двата провайдъра за максимална надеждност:

1. Cloudflare AI като primary (по-бърз)
2. Gemini API като fallback (по-надежден за български храни)

## Troubleshooting

### Грешка: "wrangler: command not found"

```bash
npm install -g wrangler
wrangler login
```

### Грешка: "Insufficient permissions"

Уверете се, че сте влезли с правилния Cloudflare акаунт:

```bash
wrangler whoami
wrangler login
```

### Endpoint-ът все още връща 503

1. Проверете дали конфигурацията е качена:
   ```bash
   wrangler kv:key get model_nutrient_lookup --binding RESOURCES_KV
   ```

2. Проверете дали Gemini API ключът е зададен:
   ```bash
   wrangler secret list
   ```

3. Проверете Worker logs:
   ```bash
   wrangler tail
   ```

## Допълнителна информация

- **Документация за Gemini API**: https://ai.google.dev/docs
- **Cloudflare Workers AI**: https://developers.cloudflare.com/workers-ai/
- **Sync KV скрипт**: `scripts/sync-kv.js`

## Контакт

Ако имате проблеми, проверете:
1. Worker logs: `wrangler tail`
2. Browser console при тестване от UI
3. Network tab за детайли за грешките
