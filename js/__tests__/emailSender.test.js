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
    body: JSON.stringify({ to: 'a@b.bg', subject: 'S', message: 'B' })
  }));
  fetch.mockRestore();
});
