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

/**
 * Attempts to extract JSON from text that might contain additional content
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
  
  // Look for JSON object pattern {...}
  const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Invalid JSON
    }
  }
  
  return null;
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
          content: 'You are a nutrition assistant. Return ONLY a valid JSON object with nutritional information. Do not include any explanatory text, just the JSON. The JSON must have this exact structure: {"calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number}. All values must be positive numbers, never zero unless the food truly has zero of that nutrient.' 
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
      console.log('AI response text:', text);
      
      try {
        const parsed = JSON.parse(text);
        const data = parsed.result || parsed;
        const payload = data.output || data.response || data;
        
        // Try to extract JSON if payload is a string
        let obj;
        if (typeof payload === 'string') {
          obj = extractJsonFromText(payload);
          if (!obj) {
            console.error('Failed to extract JSON from AI response:', payload);
            return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
          }
        } else {
          obj = payload;
        }
        
        // Validate that we have the required fields and they are not all zero
        const result = {
          calories: Number(obj.calories) || 0,
          protein: Number(obj.protein) || 0,
          carbs: Number(obj.carbs) || 0,
          fat: Number(obj.fat) || 0,
          fiber: Number(obj.fiber) || 0
        };
        
        // Check if all values are zero - this indicates AI failure
        const allZero = Object.values(result).every(v => v === 0);
        if (allZero) {
          console.error('AI returned all zero values for query:', query);
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
