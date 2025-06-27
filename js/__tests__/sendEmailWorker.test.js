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
  const res = await handleSendEmailRequest(req, { FROM_EMAIL: 'info@mybody.best' });
  expect(res.status).toBe(400);
});

test('rejects missing fields', async () => {
  const req = { json: async () => ({}) };
  const res = await handleSendEmailRequest(req, { FROM_EMAIL: 'info@mybody.best' });
  expect(res.status).toBe(400);
});

test('calls PHP endpoint on valid input', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  const req = { json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' }) };
  const res = await handleSendEmailRequest(req, { MAIL_PHP_URL: 'https://mybody.best/mail.php' });
  expect(fetch).toHaveBeenCalledWith('https://mybody.best/mail.php', expect.any(Object));
  expect(res.status).toBe(200);
  fetch.mockRestore();
});

test('sendEmail forwards data to PHP endpoint', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  await sendEmail('t@e.com', 'Hi', 'Body', { MAIL_PHP_URL: 'https://mybody.best/mail.php' });
  expect(fetch).toHaveBeenCalledWith('https://mybody.best/mail.php', expect.any(Object));
  fetch.mockRestore();
});

test('sendEmail throws on unsuccessful PHP response', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
  await expect(sendEmail('t@e.com', 'Hi', 'Body', { MAIL_PHP_URL: 'https://mybody.best/mail.php' })).rejects.toThrow();
  fetch.mockRestore();
});
