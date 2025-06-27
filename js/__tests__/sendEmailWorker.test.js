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
  const resp = {
    ok: true,
    json: async () => ({ success: true }),
    text: async () => JSON.stringify({ success: true }),
    clone() { return { json: this.json }; }
  };
  global.fetch = jest.fn().mockResolvedValue(resp);
  const req = { json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' }) };
  const res = await handleSendEmailRequest(req, { MAIL_PHP_URL: 'https://mybody.best/mail.php' });
  expect(fetch).toHaveBeenCalledWith('https://mybody.best/mail.php', expect.any(Object));
  expect(res.status).toBe(200);
  fetch.mockRestore();
});

test('sendEmail forwards data to PHP endpoint', async () => {
  const resp = {
    ok: true,
    json: async () => ({ success: true }),
    text: async () => JSON.stringify({ success: true }),
    clone() { return { json: this.json }; }
  };
  global.fetch = jest.fn().mockResolvedValue(resp);
  await sendEmail('t@e.com', 'Hi', 'Body', { MAIL_PHP_URL: 'https://mybody.best/mail.php' });
  expect(fetch).toHaveBeenCalledWith('https://mybody.best/mail.php', expect.any(Object));
  fetch.mockRestore();
});

test('sendEmail throws when backend reports failure', async () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const resp = {
    ok: true,
    json: async () => ({ success: false, error: 'bad' }),
    text: async () => JSON.stringify({ success: false, error: 'bad' }),
    clone() { return { json: this.json }; }
  };
  global.fetch = jest.fn().mockResolvedValue(resp);
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('bad');
  expect(errSpy).toHaveBeenCalledWith('sendEmail failed response:', { success: false, error: 'bad' });
  errSpy.mockRestore();
  fetch.mockRestore();
});

test('sendEmail throws descriptive error on non-JSON response', async () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const resp = {
    ok: true,
    json: async () => { throw new Error('parse'); },
    text: async () => 'not-json',
    clone() { return { json: this.json }; }
  };
  global.fetch = jest.fn().mockResolvedValue(resp);
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('Invalid JSON response from mailer');
  expect(errSpy).toHaveBeenCalledWith('Failed to parse JSON response:', 'not-json');
  errSpy.mockRestore();
  fetch.mockRestore();
});
