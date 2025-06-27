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

test('calls PHP endpoint on valid input', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  const req = { json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' }) };
  const env = { MAIL_PHP_URL: 'https://mybody.best/mail.php', FROM_EMAIL: 'admin@example.com' };
  const res = await handleSendEmailRequest(req, env);
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mail.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 'a@b.bg', subject: 'S', body: 'B', from: 'admin@example.com' })
    })
  );
  expect(res.status).toBe(200);
  fetch.mockRestore();
});

test('sendEmail forwards data to PHP endpoint', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  await sendEmail('t@e.com', 'Hi', 'Body', { MAIL_PHP_URL: 'https://mybody.best/mail.php', FROM_EMAIL: 'admin@example.com' });
  expect(fetch).toHaveBeenCalledWith(
    'https://mybody.best/mail.php',
    expect.objectContaining({
      body: JSON.stringify({ to: 't@e.com', subject: 'Hi', body: 'Body', from: 'admin@example.com' })
    })
  );
  fetch.mockRestore();
});

test('sendEmail throws when backend reports failure', async () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false, error: 'bad' }) });
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('bad');
  expect(errSpy).toHaveBeenCalledWith('sendEmail failed response:', { success: false, error: 'bad' });
  errSpy.mockRestore();
  fetch.mockRestore();
});
