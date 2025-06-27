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
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
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
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ to: 'alt@example.com', subject: 'Hi', text: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object));
});

test('falls back to MailChannels when endpoint missing', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', FROM_EMAIL: 'info@mybody.best' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith('https://api.mailchannels.net/tx/v1/send', expect.any(Object));
});

test('rate limits repeated requests by token', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const makeReq = () => ({
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 'a@b.bg', subject: 's', body: 'b' })
  });
  const store = {};
  const env = {
    WORKER_ADMIN_TOKEN: 'secret',
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: async k => store[k],
      put: async (k, v) => { store[k] = v; }
    }
  };
  await handleSendTestEmailRequest(makeReq(), env);
  await handleSendTestEmailRequest(makeReq(), env);
  await handleSendTestEmailRequest(makeReq(), env);
  const res = await handleSendTestEmailRequest(makeReq(), env);
  expect(res.success).toBe(false);
  expect(res.statusHint).toBe(429);
});
