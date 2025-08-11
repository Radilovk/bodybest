/**
 * Send an email via a PHP endpoint.
 * Exported so other modules can reuse the same logic.
 * @param {string} to recipient address
 * @param {string} subject email subject line
 * @param {string} message plain text body
 */
const WORKER_ADMIN_TOKEN_SECRET_NAME = 'WORKER_ADMIN_TOKEN';
const MAIL_PHP_URL_VAR_NAME = 'MAIL_PHP_URL';
export const DEFAULT_MAIL_PHP_URL = 'https://radilovk.github.io/bodybest/mailer/mail.php';

async function recordUsage(env, identifier = '') {
  try {
    if (env.USER_METADATA_KV && typeof env.USER_METADATA_KV.put === 'function') {
      const key = `usage_sendEmail_${Date.now()}`;
      const entry = { ts: new Date().toISOString(), id: identifier };
      await env.USER_METADATA_KV.put(key, JSON.stringify(entry));
    }
  } catch (err) {
    console.error('Failed to record usage:', err.message);
  }
}

async function checkRateLimit(env, identifier, limit = 3, windowMs = 60000) {
  if (!env.USER_METADATA_KV ||
      typeof env.USER_METADATA_KV.get !== 'function' ||
      typeof env.USER_METADATA_KV.put !== 'function') {
    return false;
  }
  const key = `rl_sendEmail_${identifier}`;
  try {
    const now = Date.now();
    const existing = await env.USER_METADATA_KV.get(key);
    if (existing) {
      const data = JSON.parse(existing);
      if (now - data.ts < windowMs) {
        if (data.count >= limit) return true;
        data.count++;
        await env.USER_METADATA_KV.put(key, JSON.stringify(data), {
          expirationTtl: Math.ceil((windowMs - (now - data.ts)) / 1000)
        });
        return false;
      }
    }
    await env.USER_METADATA_KV.put(
      key,
      JSON.stringify({ ts: now, count: 1 }),
      { expirationTtl: Math.ceil(windowMs / 1000) }
    );
  } catch (err) {
    console.error('Failed to enforce rate limit:', err.message);
  }
  return false;
}

async function sendViaPhp(to, subject, message, env = {}) {
  const url = env[MAIL_PHP_URL_VAR_NAME] || DEFAULT_MAIL_PHP_URL;
  const fromName = env.FROM_NAME || '';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, message, body: message, fromName })
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`PHP mailer error ${resp.status}${text ? `: ${text}` : ''}`);
  }
}

export async function sendEmail(to, subject, message, env = {}) {
  return await sendViaPhp(to, subject, message, env);
}

export async function handleSendEmailRequest(request, env = {}) {
  try {
    const auth = request.headers?.get?.('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const identifier = token || request.headers?.get?.('CF-Connecting-IP') || '';
    const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
    if (expected && token !== expected) {
      console.warn('handleSendEmailRequest: missing or invalid WORKER_ADMIN_TOKEN');
      return {
        status: 403,
        body: { success: false, message: 'Missing or invalid WORKER_ADMIN_TOKEN' }
      };
    }

    if (await checkRateLimit(env, identifier)) {
      return { status: 429, body: { success: false, message: 'Too many requests' } };
    }

    await recordUsage(env, identifier);

    let data;
    try {
      data = await request.json();
    } catch {
      return { status: 400, body: { success: false, message: 'Invalid JSON' } };
    }
  const { to, subject, message } = data || {};
  if (
      typeof to !== 'string' || !to ||
      typeof subject !== 'string' || !subject ||
      typeof message !== 'string' || !message
    ) {
      return { status: 400, body: { success: false, message: 'Invalid input' } };
    }
    await sendEmail(to, subject, message, env);
    return { status: 200, body: { success: true } };
  } catch (err) {
    console.error('Error in handleSendEmailRequest:', err);
    return {
      status: 500,
      body: { success: false, message: err.message || 'Internal error' }
    };
  }
}

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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin'
    };

    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'POST' && url.pathname === '/api/sendEmail') {
      const { status, body } = await handleSendEmailRequest(request, env);
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
