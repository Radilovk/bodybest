/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let loadConfig, saveConfig;

beforeEach(async () => {
  jest.resetModules();
  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { getAiConfig: '/get', setAiConfig: '/set' }
  }));
  ({ loadConfig, saveConfig } = await import('../adminConfig.js'));
});

afterEach(() => {
  global.fetch && global.fetch.mockRestore();
  sessionStorage.clear();
  localStorage.clear();
});

test('loadConfig returns full config', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, config: { a: 1 } }) });
  const cfg = await loadConfig();
  expect(global.fetch).toHaveBeenCalledWith('/get');
  expect(cfg).toEqual({ a: 1 });
});

test('loadConfig can filter keys', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, config: { a: 1, b: 2 } }) });
  const res = await loadConfig(['b']);
  expect(res).toEqual({ b: 2 });
});

test('saveConfig posts updates with token', async () => {
  sessionStorage.setItem('adminToken', 't');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  await saveConfig({ a: 2 });
  expect(global.fetch).toHaveBeenCalledWith('/set', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({ updates: { a: 2 } })
  }));
});
