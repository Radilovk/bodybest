/**
 * Send an email via MailChannels.
 * Exported so other modules can reuse the same logic.
 * @param {string} to recipient address
 * @param {string} subject email subject line
 * @param {string} text plain text body
 */
import { parseJsonSafe } from './utils/parseJsonSafe.js';
const WORKER_ADMIN_TOKEN_SECRET_NAME = 'WORKER_ADMIN_TOKEN';
const FROM_EMAIL_VAR_NAME = 'FROM_EMAIL';
const MAILCHANNELS_KEY_VAR_NAME = 'MAILCHANNELS_KEY';
const MAILCHANNELS_DOMAIN_VAR_NAME = 'MAILCHANNELS_DOMAIN';

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
          expirationTtl: Math.max(
            60,
            Math.ceil((windowMs - (now - data.ts)) / 1000)
          )
        });
        return false;
      }
    }
    await env.USER_METADATA_KV.put(
      key,
      JSON.stringify({ ts: now, count: 1 }),
      { expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)) }
    );
  } catch (err) {
    console.error('Failed to enforce rate limit:', err.message);
  }
  return false;
}

async function sendViaMailChannels(to, subject, text, env = {}) {
  const from = env[FROM_EMAIL_VAR_NAME] || `no-reply@${env[MAILCHANNELS_DOMAIN_VAR_NAME] || 'example.com'}`;
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from },
    subject,
    content: [{ type: 'text/plain', value: text }]
  };
  if (env[MAILCHANNELS_DOMAIN_VAR_NAME]) {
    payload.mail_from = { email: `no-reply@${env[MAILCHANNELS_DOMAIN_VAR_NAME]}` };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (env[MAILCHANNELS_KEY_VAR_NAME]) {
    headers.Authorization = `Bearer ${env[MAILCHANNELS_KEY_VAR_NAME]}`;
  }
  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const contentType = resp.headers.get('content-type') || '';
  let result = null;
  if (contentType.includes('application/json')) {
    try {
      result = await parseJsonSafe(resp, 'MailChannels response');
    } catch {
      throw new Error('Invalid JSON response from MailChannels');
    }
  } else if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '[unavailable]');
    console.error('Unexpected MailChannels response:', bodyText);
    throw new Error(`MailChannels error ${resp.status}`);
  }

  if (!resp.ok || result?.errors) {
    console.error('sendEmail failed response:', result);
    throw new Error(result?.errors?.[0]?.message || result?.message || 'Failed to send');
  }
}

export async function sendEmail(to, subject, text, env = {}) {
  return await sendViaMailChannels(to, subject, text, env);
}

export async function handleSendEmailRequest(request, env = {}) {
  try {
    const auth = request.headers?.get?.('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const identifier = token || request.headers?.get?.('CF-Connecting-IP') || '';
    const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
    if (expected && token !== expected) {
      return { status: 403, body: { success: false, message: 'Invalid token' } };
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
    const { to, subject, text } = data || {};
    if (
      typeof to !== 'string' || !to ||
      typeof subject !== 'string' || !subject ||
      typeof text !== 'string' || !text
    ) {
      return { status: 400, body: { success: false, message: 'Invalid input' } };
    }
    await sendEmail(to, subject, text, env);
    return { status: 200, body: { success: true } };
  } catch (err) {
    console.error('Error in handleSendEmailRequest:', err);
    return { status: 500, body: { success: false, message: 'Internal error' } };
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
