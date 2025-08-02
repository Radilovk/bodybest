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
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(food));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const cacheKey = `nutrient_cache_${hash}`;
      let cached = await env.USER_METADATA_KV.get(cacheKey, 'json');
      if (!cached) {
        cached = await lookupNutrients(food, env);
        await env.USER_METADATA_KV.put(cacheKey, JSON.stringify(cached));
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
    } catch (err) {
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
    } catch (err) {
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

async function lookupNutrients(food, env) {
  if (env.NUTRITION_API_URL) {
    try {
      const url = `${env.NUTRITION_API_URL}${encodeURIComponent(food)}`;
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
            fat: Number(item.fat_total_g || item.fat_g) || 0
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
        { role: 'system', content: 'Give nutrition data as JSON {calories, protein, carbs, fat} for the given food.' },
        { role: 'user', content: food }
      ];
      const resp = await fetch(cfEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_AI_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
      });
      const text = await resp.text();
      try {
        const parsed = JSON.parse(text);
        const data = parsed.result || parsed;
        const payload = data.output || data.response || data;
        const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
        return {
          calories: Number(obj.calories) || 0,
          protein: Number(obj.protein) || 0,
          carbs: Number(obj.carbs) || 0,
          fat: Number(obj.fat) || 0
        };
      } catch {
        return { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
    } catch (e) {
      console.error('AI nutrient lookup error', e);
    }
  }
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}
