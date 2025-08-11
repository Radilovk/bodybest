import { jest } from '@jest/globals';
let sendEmailUniversal;

beforeEach(async () => {
  jest.resetModules();
  ({ sendEmailUniversal } = await import('../../utils/emailSender.js'));
});

afterEach(() => {
  jest.resetModules();
});

test('uses MAILER_ENDPOINT_URL when provided', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await sendEmailUniversal('a@b.bg', 'S', 'B', { MAILER_ENDPOINT_URL: 'https://api.mail/send' });
  expect(fetch).toHaveBeenCalledWith('https://api.mail/send', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: 'a@b.bg', subject: 'S', message: 'B', body: 'B' })
  }));
  fetch.mockRestore();
});

test('falls back to process.env variables', async () => {
  process.env.MAILER_ENDPOINT_URL = 'https://env.mail/send';
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await sendEmailUniversal('e@m.bg', 'S', 'B');
  expect(fetch).toHaveBeenCalledWith('https://env.mail/send', expect.any(Object));
  fetch.mockRestore();
  delete process.env.MAILER_ENDPOINT_URL;
});

test('uses MAIL_PHP_URL when endpoint missing', async () => {
  process.env.MAIL_PHP_URL = 'https://my.mail/php';
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await sendEmailUniversal('x@y.z', 'Sub', 'Body');
  expect(fetch).toHaveBeenCalledWith('https://my.mail/php', expect.any(Object));
  fetch.mockRestore();
  delete process.env.MAIL_PHP_URL;
});

test('falls back to default PHP endpoint when none configured', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  await sendEmailUniversal('n@a.bg', 'S', 'B');
  expect(fetch).toHaveBeenCalledWith(
    'https://radilovk.github.io/bodybest/mailer/mail.php',
    expect.any(Object)
  );
  fetch.mockRestore();
});
