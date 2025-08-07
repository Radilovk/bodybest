/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let admin;

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = '<button id="showStats"></button>';
  global.alert = jest.fn();
});

test('показва статуса при неуспешен getProfile', async () => {
  global.fetch = jest.fn(input => {
    const url = typeof input === 'string' ? input : input.url || '';
    if (url.includes('getProfile')) {
      return Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ success: false, status: 401, message: 'Not authorized' })
      });
    }
    if (url.includes('dashboard')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    if (url.includes('listUserKv')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, kv: {} }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
  });
  admin = await import('../admin.js');
  await admin.showClient('u1');
  expect(alert).toHaveBeenCalled();
  expect(alert.mock.calls[0][0]).toContain('401');
});
