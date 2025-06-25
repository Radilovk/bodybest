import { jest } from '@jest/globals';

let handleSendTestEmailRequest, sendEmailMock;

beforeEach(async () => {
  jest.resetModules();
  sendEmailMock = jest.fn().mockResolvedValue();
  jest.unstable_mockModule('../../mailer.js', () => ({ sendEmail: sendEmailMock }));
  ({ handleSendTestEmailRequest } = await import('../../worker.js'));
});

afterEach(() => {
  jest.resetModules();
});

test('rejects invalid token', async () => {
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer bad' : null) },
    json: async () => ({ recipient: 'test@example.com', subject: 's', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret' };
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

test('sends email on valid data', async () => {
  const request = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ recipient: 'test@example.com', subject: 'Hi', body: 'b' })
  };
  const env = { WORKER_ADMIN_TOKEN: 'secret' };
  const res = await handleSendTestEmailRequest(request, env);
  expect(res.success).toBe(true);
  expect(sendEmailMock).toHaveBeenCalledWith('test@example.com', 'Hi', 'b');
});
