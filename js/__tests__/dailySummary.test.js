/** @jest-environment node */
import { jest } from '@jest/globals';
import { handleLogRequest } from '../../worker.js';

const makeRequest = (body) => ({ json: async () => body });

describe('daily summary', () => {
  test('запазва само последните 100 дни', async () => {
    const store = {};
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => store[key] || null),
        put: jest.fn(async (key, val) => { store[key] = val; })
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
    const historyStr = await env.USER_METADATA_KV.get('u1_daily_summary');
    const history = JSON.parse(historyStr);
    expect(history).toHaveLength(100);
  });
});
