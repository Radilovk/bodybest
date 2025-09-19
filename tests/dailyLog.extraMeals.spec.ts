import { jest } from '@jest/globals';
import { handleLogExtraMealRequest, getUserLogDates } from '../worker.js';

function createEnv() {
  const store = new Map();
  return {
    __store: store,
    USER_METADATA_KV: {
      get: jest.fn(key => Promise.resolve(store.has(key) ? store.get(key) : null)),
      put: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      delete: jest.fn(key => {
        store.delete(key);
        return Promise.resolve();
      }),
      list: jest.fn(() => Promise.resolve({ keys: [] }))
    }
  };
}

function createRequest(payload) {
  return {
    json: jest.fn(() => Promise.resolve(JSON.parse(JSON.stringify(payload))))
  };
}

describe('dailyLog extra meals flow', () => {
  test('индексът се обновява и getUserLogDates не листва', async () => {
    const env = createEnv();
    const userId = 'user-extra';
    const payload = {
      userId,
      foodDescription: 'салата',
      quantityEstimate: 'малка порция',
      mealTimeSpecific: '2024-06-02T18:30:00.000Z'
    };

    const response = await handleLogExtraMealRequest(createRequest(payload), env);
    expect(response.success).toBe(true);
    expect(response.savedDate).toBe('2024-06-02');

    const indexKey = `${userId}_logs_index`;
    expect(env.__store.has(indexKey)).toBe(true);
    const storedIndex = JSON.parse(env.__store.get(indexKey));
    expect(Array.isArray(storedIndex)).toBe(true);
    expect(storedIndex).toContain('2024-06-02');
    expect(storedIndex.length).toBe(1);

    env.USER_METADATA_KV.list.mockClear();

    const dates = await getUserLogDates(env, userId);
    expect(dates).toContain('2024-06-02');
    expect(env.USER_METADATA_KV.list).not.toHaveBeenCalled();
  });
});
