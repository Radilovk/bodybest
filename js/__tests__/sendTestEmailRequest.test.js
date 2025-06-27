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
    clone: () => ({ text: async () => '{}' })
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
    clone: () => ({ text: async () => '{}' })
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

test('uses PHP mail endpoint when MAILER_ENDPOINT_URL missing', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAIL_PHP_URL: 'https://mybody.best/mail.php' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith('https://mybody.best/mail.php', expect.any(Object));
});

test('records usage in USER_METADATA_KV', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  const env = {
    WORKER_ADMIN_TOKEN: 'secret',
    FROM_EMAIL: 'info@mybody.best',
    USER_METADATA_KV: { put: jest.fn() },
    MAIL_PHP_URL: 'https://mybody.best/mail.php'
  };
  await handleSendTestEmailRequest(request, env);
  expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
    expect.stringMatching(/^usage_sendTestEmail_/),
    expect.any(String)
  );
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mail.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 't@e.com', subject: 's', body: 'b', from: 'info@mybody.best' })
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
