import { jest } from '@jest/globals';
import { handleRequestPasswordReset, handlePerformPasswordReset } from '../../worker.js';

function createStore(initial = {}) {
  const store = { ...initial };
  return {
    get: jest.fn(async key => store[key] || null),
    put: jest.fn(async (key, value) => { store[key] = String(value); }),
    delete: jest.fn(async key => { delete store[key]; }),
    _store: store
  };
}

test('handleRequestPasswordReset stores token and emails link', async () => {
  const kv = createStore({ 'email_to_uuid_user@x.bg': 'u1' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  const env = { USER_METADATA_KV: kv, MAILER_ENDPOINT_URL: 'https://mail.test' };
  const req = { json: async () => ({ email: 'user@x.bg' }) };
  const res = await handleRequestPasswordReset(req, env);
  expect(res.success).toBe(true);
  const putCall = kv.put.mock.calls[0];
  expect(putCall[0]).toMatch(/^pwreset_/);
  const token = putCall[0].replace('pwreset_', '');
  expect(global.fetch.mock.calls[0][1].body).toContain(token);
});

test('handlePerformPasswordReset updates password and deletes token', async () => {
  const kv = createStore({
    'pwreset_tok123': 'u1',
    'credential_u1': JSON.stringify({ userId: 'u1', passwordHash: 'old' })
  });
  const env = { USER_METADATA_KV: kv };
  const req = { json: async () => ({ token: 'tok123', password: 'Newpass123', confirm_password: 'Newpass123' }) };
  const res = await handlePerformPasswordReset(req, env);
  expect(res.success).toBe(true);
  expect(kv._store['pwreset_tok123']).toBeUndefined();
  expect(JSON.parse(kv._store['credential_u1']).passwordHash).not.toBe('old');
});

test('handleRequestPasswordReset sets token expiration', async () => {
  const kv = createStore({ 'email_to_uuid_a@b.bg': 'u1' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  const env = { USER_METADATA_KV: kv, MAILER_ENDPOINT_URL: 'https://mail.test' };
  const req = { json: async () => ({ email: 'a@b.bg' }) };
  await handleRequestPasswordReset(req, env);
  const putArgs = kv.put.mock.calls[0];
  expect(putArgs[2]).toEqual({ expirationTtl: 3600 });
  global.fetch.mockRestore();
});

test('handlePerformPasswordReset fails for invalid token', async () => {
  const kv = createStore({
    'credential_u1': JSON.stringify({ userId: 'u1', passwordHash: 'old' })
  });
  const env = { USER_METADATA_KV: kv };
  const req = { json: async () => ({ token: 'missing', password: 'Newpass123', confirm_password: 'Newpass123' }) };
  const res = await handlePerformPasswordReset(req, env);
  expect(res.success).toBe(false);
  expect(res.message).toBe('Невалиден или изтекъл токен.');
  expect(JSON.parse(kv._store['credential_u1']).passwordHash).toBe('old');
});
