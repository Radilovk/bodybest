import { jest } from '@jest/globals';

let handleSendTestEmailRequest;

beforeEach(async () => {
  jest.resetModules();
  ({ handleSendTestEmailRequest } = await import('../../worker.js'));
});

afterEach(() => {
  jest.resetModules();
  if (global.fetch && typeof global.fetch.mockRestore === 'function') {
    global.fetch.mockRestore();
  }
});

test('rejects invalid token', async () => {
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer bad' : null) },
    json: async () => ({ recipient: 'test@example.com', subject: 's', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(false);
  expect(res.statusHint).toBe(403);
});

test('rejects missing fields', async () => {
  const request = {
    headers: { get: () => null },
    json: async () => ({})
  };
  const env = {};
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(false);
  expect(res.statusHint).toBe(400);
});

test('rejects invalid json', async () => {
  const request = {
    headers: { get: () => null },
    json: async () => { throw new Error('bad json'); }
  };
  const env = {};
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(false);
  expect(res.statusHint).toBe(400);
});

test('sends email on valid data', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' }),
    headers: { get: () => 'application/json' }
  });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 'test@example.com', subject: 'Hi', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object));
});

test('supports alternate field names', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' }),
    headers: { get: () => 'application/json' }
  });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ to: 'alt@example.com', subject: 'Hi', text: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object));
});

test('uses MailChannels when MAILER_ENDPOINT_URL missing', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' }),
    headers: { get: () => 'application/json' }
  });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAILCHANNELS_DOMAIN: 'mybody.best', FROM_EMAIL: 'info@mybody.best' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith('https://api.mailchannels.net/tx/v1/send', expect.any(Object));
});

test('records usage in USER_METADATA_KV', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' }),
    headers: { get: () => 'application/json' }
  });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  const env = {
    WORKER_ADMIN_TOKEN: 'secret',
    FROM_EMAIL: 'info@mybody.best',
    USER_METADATA_KV: { put: jest.fn() },
    MAILCHANNELS_DOMAIN: 'mybody.best'
  };
  await handleSendTestEmailRequest(request, env);
  expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
    expect.stringMatching(/^usage_sendTestEmail_/),
    expect.any(String)
  );
  expect(fetch).toHaveBeenCalledWith(
    'https://api.mailchannels.net/tx/v1/send',
    expect.objectContaining({
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 't@e.com' }] }],
        from: { email: 'info@mybody.best' },
        subject: 's',
        content: [{ type: 'text/plain', value: 'b' }],
        mail_from: { email: 'no-reply@mybody.best' }
      })
    })
  );
});

test('rate limits excessive requests', async () => {
  const now = Date.now();
  const env = {
    WORKER_ADMIN_TOKEN: 'secret',
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(JSON.stringify({ ts: now, count: 3 })),
      put: jest.fn()
    }
  };
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(false);
  expect(res.statusHint).toBe(429);
});

test('rate limit TTL never below 60 seconds', async () => {
  const now = Date.now();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const put = jest.fn();
  const env = {
    WORKER_ADMIN_TOKEN: 'secret',
    MAILER_ENDPOINT_URL: 'https://mybody.best/mail_smtp.php',
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(JSON.stringify({ ts: now - 59000, count: 1 })),
      put
    }
  };
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  await handleSendTestEmailRequest(request, env);
  expect(put.mock.calls[0][2].expirationTtl).toBe(60);
  fetch.mockRestore();
});
