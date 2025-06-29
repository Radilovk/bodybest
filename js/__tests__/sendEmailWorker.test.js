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
    json: async () => ({ to: 'a@b.bg', subject: 'S', message: 'B' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret' };
  const res = await handleSendEmailRequest(req, env);
  expect(res.status).toBe(403);
});

test('calls PHP endpoint on valid input', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' }),
    headers: { get: () => 'application/json' }
  });
  const req = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ to: 'a@b.bg', subject: 'S', message: 'B' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret' };
  const res = await handleSendEmailRequest(req, env);
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mailer/mail.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 'a@b.bg', subject: 'S', message: 'B' }),
      headers: { 'Content-Type': 'application/json' }
    })
  );
  expect(res.status).toBe(200);
  fetch.mockRestore();
});


test('sendEmail forwards data to PHP endpoint', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' }),
    headers: { get: () => 'application/json' }
  });
  await sendEmail('t@e.com', 'Hi', 'Body', {});
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mailer/mail.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 't@e.com', subject: 'Hi', message: 'Body' }),
      headers: { 'Content-Type': 'application/json' }
    })
  );
  fetch.mockRestore();
});


test('sendEmail throws when backend reports failure', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
  await expect(sendEmail('x@y.z', 'S', 'B', {})).rejects.toThrow('PHP mailer error 500');
  fetch.mockRestore();
});

