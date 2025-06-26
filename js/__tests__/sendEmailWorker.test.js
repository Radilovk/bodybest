import { jest } from '@jest/globals';

let handleSendEmailRequest;

beforeEach(async () => {
  jest.resetModules();
  ({ handleSendEmailRequest } = await import('../../sendEmailWorker.js'));
});

afterEach(() => {
  jest.resetModules();
});

test('rejects invalid JSON', async () => {
  const req = { json: async () => { throw new Error('bad'); } };
  const res = await handleSendEmailRequest(req);
  expect(res.status).toBe(400);
});

test('rejects missing fields', async () => {
  const req = { json: async () => ({}) };
  const res = await handleSendEmailRequest(req);
  expect(res.status).toBe(400);
});

test('calls MailChannels on valid input', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const req = { json: async () => ({ to: 'a@b.bg', subject: 'S', text: 'B' }) };
  const res = await handleSendEmailRequest(req);
  expect(fetch).toHaveBeenCalledWith('https://api.mailchannels.net/tx/v1/send', expect.any(Object));
  expect(res.status).toBe(200);
  fetch.mockRestore();
});
