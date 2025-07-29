/** @jest-environment node */
import { jest } from '@jest/globals';
import { handleGetMaintenanceMode, handleSetMaintenanceMode } from '../../worker.js';

function createStore(initial = {}) {
  const store = { ...initial };
  return {
    get: jest.fn(async key => store[key] || null),
    put: jest.fn(async (key, val) => { store[key] = String(val); }),
    _store: store
  };
}

test('getMaintenanceMode reads flag', async () => {
  const kv = createStore({ maintenance_mode: '1' });
  const env = { RESOURCES_KV: kv, MAINTENANCE_MODE: '0' };
  const res = await handleGetMaintenanceMode({}, env);
  expect(res.success).toBe(true);
  expect(res.enabled).toBe(true);
});

test('setMaintenanceMode validates token and stores value', async () => {
  const kv = createStore();
  const env = { RESOURCES_KV: kv, WORKER_ADMIN_TOKEN: 's' };
  const bad = { headers: { get: () => '' }, json: async () => ({ enabled: true }) };
  const badRes = await handleSetMaintenanceMode(bad, env);
  expect(badRes.success).toBe(false);
  const good = { headers: { get: h => h === 'Authorization' ? 'Bearer s' : null }, json: async () => ({ enabled: true }) };
  const goodRes = await handleSetMaintenanceMode(good, env);
  expect(goodRes.success).toBe(true);
  expect(kv._store['maintenance_mode']).toBe('1');
});

test('admin panel allowed during maintenance', async () => {
  const { default: worker } = await import('../../worker.js');
  const kv = createStore({ maintenance_mode: '1' });
  const env = { RESOURCES_KV: kv, MAINTENANCE_MODE: '0' };
  const req = { url: 'https://x/admin.html', method: 'GET', headers: { get: () => null } };
  const res = await worker.fetch(req, env);
  expect(res.status).not.toBe(503);
  const text = await res.text();
  expect(text).not.toContain('обновяваме сайта');
});
