/**
 * Send an email via MailChannels.
 * Exported so other modules can reuse the same logic.
 * @param {string} to recipient address
 * @param {string} subject email subject line
 * @param {string} text plain text body
 */
export async function sendEmail(to, subject, text, env = {}) {
  const fromEmail = env.FROM_EMAIL || 'info@mybody.best';
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail },
    subject,
    content: [{ type: 'text/plain', value: text }]
  };
  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('Failed to send');
}

export async function handleSendEmailRequest(request, env = {}) {
  try {
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
      'Access-Control-Allow-Headers': 'Content-Type',
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
