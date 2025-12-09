export default {
  async fetch(request, env) {
    const defaultAllowedOrigins = [
      'https://radilovk.github.io',
      'https://radilov-k.github.io',
      'http://localhost:5173',
      'http://localhost:3000',
      'null'
    ];
    const allowedOrigins = Array.from(new Set(
      (env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
        : [])
        .concat(defaultAllowedOrigins)
    ));
    const requestOrigin = request.headers.get('Origin');
    const originToSend = requestOrigin === null
      ? 'null'
      : allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    const corsHeaders = {
      'Access-Control-Allow-Origin': originToSend,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Vary': 'Origin'
    };
    const { pathname } = new URL(request.url);

    if (pathname === '/settings') {
      if (request.method === 'GET') {
        const data = await env.SETTINGS.get('chat', 'json');
        return new Response(JSON.stringify(data || {}), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        await env.SETTINGS.put('chat', JSON.stringify(body));
        return new Response('OK', {
          headers: corsHeaders
        });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (pathname === '/nutrient-lookup') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
      }
      const food = (body.food || '').trim();
      if (!food) {
        return new Response(JSON.stringify({ error: 'Missing food' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const quantity = (body.quantity || '').trim();
      const foodQuery = [quantity, food].filter(Boolean).join(' ');
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(foodQuery));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const cacheKey = `nutrient_cache_${hash}`;
      let cached = await env.USER_METADATA_KV.get(cacheKey, 'json');
      if (!cached) {
        cached = await lookupNutrients(foodQuery, env);
        await env.USER_METADATA_KV.put(cacheKey, JSON.stringify(cached), { expirationTtl: 86400 });
      }
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const messages = data.messages || [];
    const model = data.model || env.MODEL;

    if (!env.CF_ACCOUNT_ID || !env.CF_AI_TOKEN || !model) {
        return new Response(JSON.stringify({ error: 'Missing Worker secrets' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`;

    const payload = { messages };
    if (data.file) {
      payload.file = data.file;
    }
    if (data.temperature !== undefined) {
      payload.temperature = data.temperature;
    }
    if (data.max_tokens !== undefined) {
      payload.max_tokens = data.max_tokens;
    }

    let response;
    try {
        response = await fetch(cfEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CF_AI_TOKEN}`,
            'Content-Type': 'application/json'
          },
        body: JSON.stringify(payload)
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Request failed' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const result = await response.text();
    return new Response(result, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// AI system prompt for nutrition data extraction with validation
const NUTRITION_AI_SYSTEM_PROMPT = `You are a nutrition assistant that validates food descriptions and provides nutritional information.

CRITICAL: You must ALWAYS respond with valid JSON only, no other text.

Your task:
1. Analyze if the input describes a real food/drink item
2. Check if the quantity/measure is clear and reasonable
3. If valid, calculate nutritional values
4. If invalid, explain the specific problem

Response format (MUST be valid JSON):
- For VALID food with clear quantity:
  {"success": true, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number}

- For INVALID input (unclear food, non-food item, unclear quantity, etc.):
  {"success": false, "error": "Bulgarian language error message explaining the specific problem"}

Error message examples in Bulgarian:
- "Не мога да разпозная храната. Моля, опишете по-ясно какво сте консумирали."
- "Количеството не е ясно. Моля, посочете конкретна мярка (напр. '100 гр', '2 парчета', '1 чаша')."
- "Това не изглежда като хранителен продукт. Моля, въведете храна или напитка."
- "Описанието е твърде неясно. Моля, бъдете по-конкретни за продукта и количеството."

Rules:
- All nutritional values must be non-negative numbers
- Reject non-food items (furniture, electronics, etc.)
- Reject unclear quantities like "малко", "доста", "няколко" without specific measure
- Accept both precise ("150 гр") and approximate ("2 средни ябълки") quantities
- Return ONLY JSON, no markdown, no explanations outside the JSON`;

/**
 * Attempts to extract JSON from text that might contain additional content
 * Uses a bracket-matching approach to handle nested objects and arrays
 * @param {string} text - Text that may contain JSON
 * @returns {object|null} Parsed JSON object or null
 */
function extractJsonFromText(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Not direct JSON, try to extract
  }
  
  // Find first opening brace
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;
  
  // Match brackets to find the complete JSON object
  let depth = 0;
  let endIdx = -1;
  
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  if (endIdx === -1) return null;
  
  // Extract and parse the JSON substring
  const jsonStr = text.substring(startIdx, endIdx);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function lookupNutrients(query, env) {
  if (env.NUTRITION_API_URL) {
    try {
      const url = `${env.NUTRITION_API_URL}${encodeURIComponent(query)}`;
      const headers = env.NUTRITION_API_KEY ? { 'X-Api-Key': env.NUTRITION_API_KEY } : {};
      const apiResp = await fetch(url, { headers });
      if (apiResp.ok) {
        const arr = await apiResp.json();
        const item = Array.isArray(arr) ? arr[0] : arr;
        if (item) {
          return {
            calories: Number(item.calories) || 0,
            protein: Number(item.protein_g) || 0,
            carbs: Number(item.carbohydrates_total_g || item.carbs_g) || 0,
            fat: Number(item.fat_total_g || item.fat_g) || 0,
            fiber: Number(item.fiber_g || item.fiber) || 0
          };
        }
      }
    } catch (e) {
      console.error('Nutrient API error', e);
    }
  }
  if (env.CF_ACCOUNT_ID && env.CF_AI_TOKEN && env.MODEL) {
    try {
      const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${env.MODEL}`;
      const messages = [
        { 
          role: 'system', 
          content: NUTRITION_AI_SYSTEM_PROMPT
        },
        { 
          role: 'user', 
          content: `Provide nutritional information for: ${query}. Return only JSON, no other text.` 
        }
      ];
      const resp = await fetch(cfEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_AI_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
      });
      
      if (!resp.ok) {
        console.error('AI API returned error:', resp.status, resp.statusText);
        return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      }
      
      const text = await resp.text();
      
      try {
        const parsed = JSON.parse(text);
        const data = parsed.result || parsed;
        const payload = data.output || data.response || data;
        
        // Try to extract JSON if payload is a string
        let obj;
        if (typeof payload === 'string') {
          obj = extractJsonFromText(payload);
          if (!obj) {
            // Log only in development/debug mode - avoid exposing user data
            if (env.DEBUG_MODE) {
              console.error('Failed to extract JSON from AI response. Length:', payload.length);
            }
            return { 
              success: false, 
              error: 'Неуспешно обработване на AI отговора. Моля, опитайте отново или въведете данните ръчно.' 
            };
          }
        } else {
          obj = payload;
        }
        
        // Check if AI returned an error response
        if (obj.success === false) {
          // AI identified a problem with the input
          return {
            success: false,
            error: obj.error || 'Неуспешна валидация на входните данни.'
          };
        }
        
        // Validate that we have the required fields
        const result = {
          success: true,
          calories: Number(obj.calories) || 0,
          protein: Number(obj.protein) || 0,
          carbs: Number(obj.carbs) || 0,
          fat: Number(obj.fat) || 0,
          fiber: Number(obj.fiber) || 0
        };
        
        // Check if all values are zero - this might indicate unclear input
        const allZero = Object.values(result).filter(v => typeof v === 'number').every(v => v === 0);
        if (allZero) {
          console.error('AI returned all zero values for query:', query);
          return {
            success: false,
            error: 'Не мога да определя хранителната стойност. Моля, проверете дали описанието и количеството са ясни.'
          };
        }
        
        return result;
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, 'Text:', text);
        return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      }
    } catch (e) {
      console.error('AI nutrient lookup error', e);
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
  }
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}
