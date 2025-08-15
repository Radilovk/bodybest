import { jest } from '@jest/globals';
import { getUserLogDates } from '../worker.js';

describe('getUserLogDates', () => {
  test('fallback към KV.list увеличава log_index_fallbacks', async () => {
    const store = {
      'u1_log_2024-05-15': '1',
      'u1_log_2024-05-14': '1',
      log_index_fallbacks: '2'
    };
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
        list: jest.fn(({ prefix }) => {
          const keys = Object.keys(store)
            .filter(k => k.startsWith(prefix))
            .map(name => ({ name }));
          return Promise.resolve({ keys });
        })
      }
    };
    const dates = await getUserLogDates(env, 'u1');
    expect(dates.sort()).toEqual(['2024-05-14', '2024-05-15']);
    expect(env.USER_METADATA_KV.list).toHaveBeenCalledTimes(1);
    expect(store.log_index_fallbacks).toBe('3');
  });
});
