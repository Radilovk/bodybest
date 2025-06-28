import { jest } from '@jest/globals';

let handleSendEmailRequest, sendEmail;

beforeEach(async () => {
  jest.resetModules();
  ({ handleSendEmailRequest, sendEmail } = await import('../../sendEmailWorker.js'));
});

afterEach(() => {
  jest.resetModules();
});

test('rejects invalid JSON', async () => {
  const req = { json: async () => { throw new Error('bad'); } };
  const res = await handleSendEmailRequest(req, {});
  expect(res.status).toBe(400);
});

test('rejects missing fields', async () => {
  const req = { json: async () => ({}) };
  const res = await handleSendEmailRequest(req, {});
  expect(res.status).toBe(400);
});

test('rejects invalid token', async () => {
  const req = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer bad' : null) },
    json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAIL_PHP_URL: 'https://mybody.best/mail_smtp.php' };
  const res = await handleSendEmailRequest(req, env);
  expect(res.status).toBe(403);
});

test('calls PHP endpoint on valid input', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  const req = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' })
  };
  const env = { MAIL_PHP_URL: 'https://mybody.best/mail_smtp.php', WORKER_ADMIN_TOKEN: 'secret', FROM_EMAIL: 'info@mybody.best' };
  const res = await handleSendEmailRequest(req, env);
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mail_smtp.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 'a@b.bg', subject: 'S', body: 'B', from: 'info@mybody.best' })
    })
  );
  expect(res.status).toBe(200);
  fetch.mockRestore();
});

test('sendEmail forwards data to PHP endpoint', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  await sendEmail('t@e.com', 'Hi', 'Body', { MAIL_PHP_URL: 'https://mybody.best/mail_smtp.php', FROM_EMAIL: 'info@mybody.best' });
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mail_smtp.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 't@e.com', subject: 'Hi', body: 'Body', from: 'info@mybody.best' })
    })
  );
  fetch.mockRestore();
});

test('sendEmail throws when backend reports failure', async () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: false, error: 'bad' }),
    clone: () => ({ text: async () => '{"success":false}' })
  });
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('bad');
  expect(errSpy).toHaveBeenCalledWith('sendEmail failed response:', { success: false, error: 'bad' });
  errSpy.mockRestore();
  fetch.mockRestore();
});

test('sendEmail throws on invalid JSON response', async () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => { throw new SyntaxError('bad json'); },
    clone: () => ({ text: async () => 'not-json' })
  });
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('Invalid JSON response from email service');
  expect(errSpy).toHaveBeenCalledWith('Failed to parse JSON from sendEmail response:', 'not-json');
  errSpy.mockRestore();
  fetch.mockRestore();
});

test('rate limit TTL never below 60 seconds', async () => {
  const now = Date.now();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  const put = jest.fn();
  const req = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ to: 't@e.com', subject: 'S', text: 'B' })
  };
  const env = {
    MAIL_PHP_URL: 'https://mybody.best/mail_smtp.php',
    WORKER_ADMIN_TOKEN: 'secret',
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(JSON.stringify({ ts: now - 59000, count: 1 })),
      put
    }
  };
  await handleSendEmailRequest(req, env);
  expect(put.mock.calls[0][2].expirationTtl).toBe(60);
  fetch.mockRestore();
});
