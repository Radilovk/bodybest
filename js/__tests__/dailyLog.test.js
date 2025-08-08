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

  test('обединява частични записи за една дата', async () => {
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
        list: jest.fn(async ({ prefix }) => ({ keys: Object.keys(store).filter(k => k.startsWith(prefix)).map(name => ({ name })) }))
      },
      RESOURCES_KV: { get: jest.fn(async () => '{}') }
    };
    const dateStr = '2020-01-02';
    await handleLogRequest(makeRequest({ userId: 'u1', date: dateStr, note: 'първи', totals: { a: 1 }, extraMeals: [{ id: 1 }] }), env);
    await handleLogRequest(makeRequest({ userId: 'u1', date: dateStr, weight: '80', totals: { b: 2 }, extraMeals: [{ id: 2 }] }), env);
    const stored = JSON.parse(store[`u1_log_${dateStr}`]);
    expect(stored.totals).toEqual({ a: 1, b: 2 });
    expect(stored.extraMeals).toHaveLength(2);
    expect(stored.log.note).toBe('първи');
    expect(stored.log.weight).toBe('80');
  });

  test('валидира оценки и записва описания', async () => {
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
        list: jest.fn(async ({ prefix }) => ({ keys: Object.keys(store).filter(k => k.startsWith(prefix)).map(name => ({ name })) }))
      },
      RESOURCES_KV: { get: jest.fn(async () => '{}') }
    };
    const dateStr = '2020-01-03';
    await handleLogRequest(makeRequest({ userId: 'u1', date: dateStr, data: { mood: 4, energy: 2, sleep: 7 } }), env);
    const stored = JSON.parse(store[`u1_log_${dateStr}`]);
    expect(stored.log.mood).toBe('Добре/Позитивно (4)');
    expect(stored.log.energy).toBe('По-ниска от обичайното (2)');
    expect(stored.log.sleep).toBeUndefined();
    const invalidKey = Object.keys(store).find(k => k.startsWith('u1_invalid_rating_log_'));
    expect(invalidKey).toBeTruthy();
  });
});
