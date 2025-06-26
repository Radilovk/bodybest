export async function handleSendEmailRequest(request) {
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
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'info@mybody.best' },
      subject,
      content: [{ type: 'text/plain', value: text }]
    };
    const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      return { status: 500, body: { success: false, message: 'Failed to send' } };
    }
    return { status: 200, body: { success: true } };
  } catch (err) {
    console.error('Error in handleSendEmailRequest:', err);
    return { status: 500, body: { success: false, message: 'Internal error' } };
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/sendEmail') {
      const { status, body } = await handleSendEmailRequest(request);
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  }
};
