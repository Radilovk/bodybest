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

async function lookupNutrients(query, env) {
  // Helper function to extract quantity from query - handles multiple formats
  function parseQuantityFromQuery(queryStr) {
    // Match quantities in various formats: гр, гр., g, g., грам, kg, кг
    const quantityMatch = queryStr.match(/(\d+(?:[.,]\d+)?)\s*(гр\.?|g\.?|грам[а]?|kg|кг)/i);
    if (quantityMatch) {
      let quantity = parseFloat(quantityMatch[1].replace(',', '.'));
      const unit = quantityMatch[2].toLowerCase();
      // Convert kg to grams
      if (unit.startsWith('kg') || unit.startsWith('кг')) {
        quantity *= 1000;
      }
      return quantity;
    }
    return 100; // Default to 100g
  }

  // Helper function to scale nutrient values
  function scaleNutrient(value, scale) {
    return Number((value * scale).toFixed(2)) || 0;
  }

  // Helper function to match product name with query
  // Prioritizes exact matches, then word boundary matches
  function findBestProductMatch(products, queryLower) {
    // Remove quantity information from query for matching
    const cleanQuery = queryLower.replace(/\d+(?:[.,]\d+)?\s*(гр\.?|g\.?|грам[а]?|kg|кг)/i, '').trim();
    
    // Try exact match first
    for (const product of products) {
      if (product.name && product.name.toLowerCase() === cleanQuery) {
        return product;
      }
    }
    
    // Try word boundary match (product name appears as whole word in query)
    const words = cleanQuery.split(/\s+/);
    for (const product of products) {
      if (product.name) {
        const productNameLower = product.name.toLowerCase();
        // Check if product name matches any combination of consecutive words
        for (let i = 0; i < words.length; i++) {
          for (let j = i + 1; j <= words.length; j++) {
            const wordGroup = words.slice(i, j).join(' ');
            if (wordGroup === productNameLower) {
              return product;
            }
          }
        }
      }
    }
    
    // Fallback: simple contains match (less precise)
    for (const product of products) {
      if (product.name) {
        const productNameLower = product.name.toLowerCase();
        if (cleanQuery.includes(productNameLower)) {
          return product;
        }
      }
    }
    
    return null;
  }

  // First, try to load from local product_macros database if RESOURCES_KV is available
  if (env.RESOURCES_KV) {
    try {
      const productMacrosJson = await env.RESOURCES_KV.get('product_macros');
      if (productMacrosJson) {
        const products = JSON.parse(productMacrosJson);
        const queryLower = query.toLowerCase().trim();
        
        const product = findBestProductMatch(products, queryLower);
        if (product) {
          // Found a match in local database - return scaled values if quantity is specified
          const quantity = parseQuantityFromQuery(query);
          const scale = quantity / 100;
          
          return {
            calories: scaleNutrient(product.calories, scale),
            protein: scaleNutrient(product.protein, scale),
            carbs: scaleNutrient(product.carbs, scale),
            fat: scaleNutrient(product.fat, scale),
            fiber: scaleNutrient(product.fiber, scale)
          };
        }
      }
    } catch (e) {
      console.error('Error checking local product database', e);
      // Continue to external APIs if local lookup fails
    }
  }

  // If not found in local database, try external nutrition API
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

  // Finally, fall back to AI model with specialized prompt
  if (env.CF_ACCOUNT_ID && env.CF_AI_TOKEN && env.MODEL) {
    try {
      // Try to load specialized nutrient lookup prompt
      let systemPrompt = 'Give nutrition data as JSON {calories, protein, carbs, fat, fiber} for the given food.';
      
      if (env.RESOURCES_KV) {
        try {
          const promptTemplate = await env.RESOURCES_KV.get('prompt_nutrient_lookup');
          if (promptTemplate) {
            // Sanitize query comprehensively to prevent injection
            // Only allow alphanumeric, spaces, and common food-related punctuation
            const sanitizedQuery = query
              .replace(/[^\p{L}\p{N}\s.,\-()\/]/gu, '') // Remove special chars, keep letters, numbers, and basic punctuation
              .slice(0, 200); // Limit length to prevent prompt overflow
            systemPrompt = promptTemplate.replace('%%FOOD_QUERY%%', sanitizedQuery);
          }
        } catch (e) {
          console.warn('Could not load specialized prompt, using default', e);
        }
      }

      const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${env.MODEL}`;
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
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
          fat: Number(obj.fat) || 0,
          fiber: Number(obj.fiber) || 0
        };
      } catch {
        return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      }
    } catch (e) {
      console.error('AI nutrient lookup error', e);
    }
  }
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}
