/** @jest-environment node */
import { jest } from '@jest/globals';
import { handleLogRequest, handleDashboardDataRequest } from '../../worker.js';

const makeRequest = (body) => ({ json: async () => body });

describe('daily log', () => {
  test('връща последните 100 дни по дата', async () => {
    const store = {
      'u1_initial_answers': JSON.stringify({ name: 'U', weight: '70', height: '170', goal: 'lose' }),
      'u1_final_plan': JSON.stringify({ caloriesMacros: { p: 1 } }),
      'plan_status_u1': 'ready',
      'u1_current_status': '{}',
      'u1_profile': '{}'
    };
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => store[key] || null),
        put: jest.fn(async (key, val) => { store[key] = val; }),
        list: jest.fn(async ({ prefix }) => ({
          keys: Object.keys(store)
            .filter(k => k.startsWith(prefix))
            .reverse()
            .map(name => ({ name }))
        }))
      },
      RESOURCES_KV: { get: jest.fn(async () => '{}') }
    };
    const base = new Date('2020-01-01');
    for (let i = 0; i < 101; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      await handleLogRequest(makeRequest({ userId: 'u1', date: dateStr, data: { note: String(i) } }), env);
    }
    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleDashboardDataRequest(request, env);
    expect(res.dailyLogs).toHaveLength(100);
    const latest = new Date(base); latest.setDate(base.getDate() + 100);
    const oldest = new Date(base); oldest.setDate(base.getDate() + 1);
    expect(res.dailyLogs[0].date).toBe(latest.toISOString().split('T')[0]);
    expect(res.dailyLogs[99].date).toBe(oldest.toISOString().split('T')[0]);
  });
});
