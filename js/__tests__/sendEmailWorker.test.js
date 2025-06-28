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
  const env = { WORKER_ADMIN_TOKEN: 'secret', MAILCHANNELS_KEY: 'k' };
  const res = await handleSendEmailRequest(req, env);
  expect(res.status).toBe(403);
});

test('calls MailChannels endpoint on valid input', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  const req = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' })
  };
  const env = { MAILCHANNELS_KEY: 'k', MAILCHANNELS_DOMAIN: 'mybody.best', WORKER_ADMIN_TOKEN: 'secret', FROM_EMAIL: 'info@mybody.best' };
  const res = await handleSendEmailRequest(req, env);
  expect(fetch).toHaveBeenCalledWith(
    'https://api.mailchannels.net/tx/v1/send',
    expect.objectContaining({
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'a@b.bg' }] }],
        from: { email: 'info@mybody.best' },
        subject: 'S',
        content: [{ type: 'text/plain', value: 'B' }],
        mail_from: { email: 'no-reply@mybody.best' }
      })
    })
  );
  expect(res.status).toBe(200);
  fetch.mockRestore();
});

test('sendEmail forwards data to MailChannels endpoint', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    clone: () => ({ text: async () => '{}' })
  });
  await sendEmail('t@e.com', 'Hi', 'Body', { MAILCHANNELS_KEY: 'k', MAILCHANNELS_DOMAIN: 'mybody.best', FROM_EMAIL: 'info@mybody.best' });
  expect(fetch).toHaveBeenCalledWith(
    'https://api.mailchannels.net/tx/v1/send',
    expect.objectContaining({
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 't@e.com' }] }],
        from: { email: 'info@mybody.best' },
        subject: 'Hi',
        content: [{ type: 'text/plain', value: 'Body' }],
        mail_from: { email: 'no-reply@mybody.best' }
      })
    })
  );
  fetch.mockRestore();
});

test('sendEmail throws when backend reports failure', async () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ errors: [{ message: 'bad' }] }),
    clone: () => ({ text: async () => '{"errors":[{"message":"bad"}]}' })
  });
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('bad');
  expect(errSpy).toHaveBeenCalledWith('sendEmail failed response:', { errors: [{ message: 'bad' }] });
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
  await expect(sendEmail('x@y.z', 'S', 'B')).rejects.toThrow('Invalid JSON response from MailChannels');
  expect(errSpy).toHaveBeenCalledWith('Failed to parse JSON from MailChannels response:', 'not-json');
  errSpy.mockRestore();
  fetch.mockRestore();
});
