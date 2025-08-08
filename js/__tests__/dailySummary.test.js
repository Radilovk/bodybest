/** @jest-environment node */
import { jest } from '@jest/globals';
import { handleLogRequest } from '../../worker.js';

const makeRequest = (body) => ({ json: async () => body });

describe('daily logs', () => {
  test('запазва само последните 100 дни', async () => {
    const store = {};
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async key => store[key] || null),
        put: jest.fn(async (key, val) => { store[key] = val; }),
        delete: jest.fn(async key => { delete store[key]; }),
        list: jest.fn(async ({ prefix }) => ({
          keys: Object.keys(store).filter(k => k.startsWith(prefix)).map(name => ({ name }))
        }))
      }
    };
    const start = new Date();
    start.setDate(start.getDate() - 101);
    for (let i = 0; i < 101; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      await handleLogRequest(makeRequest({ userId: 'u1', date: dateStr, data: { note: String(i) } }), env);
    }
    const keys = Object.keys(store).filter(k => k.startsWith('u1_log_')).sort();
    expect(keys).toHaveLength(100);
    const firstDateStr = start.toISOString().split('T')[0];
    expect(store[`u1_log_${firstDateStr}`]).toBeUndefined();
  });
});
