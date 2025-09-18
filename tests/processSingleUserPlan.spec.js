import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const { processSingleUserPlan } = await import('../worker.js');

const USER_ID = 'user-log';
const LOG_KEY = `${USER_ID}_plan_log`;

const createEnv = (store) => ({
  USER_METADATA_KV: {
    get: jest.fn(key => Promise.resolve(store[key] ?? null)),
    put: jest.fn(async (key, value) => {
      store[key] = value;
    }),
    delete: jest.fn(key => {
      delete store[key];
      return Promise.resolve();
    }),
    list: jest.fn(() => Promise.resolve({ keys: [] }))
  },
  RESOURCES_KV: {
    get: jest.fn(async (key) => {
      if (key === 'model_plan_generation') {
        return 'gpt-test';
      }
      if (key === 'prompt_unified_plan_generation_v2') {
        return null;
      }
      return null;
    })
  },
  OPENAI_API_KEY: 'test-openai-key'
});

describe('processSingleUserPlan logging', () => {
  let store;
  let env;

  beforeEach(() => {
    store = {
      pending_plan_users: JSON.stringify([]),
      ready_plan_users: JSON.stringify([]),
      [`${USER_ID}_initial_answers`]: JSON.stringify({ name: 'Test User' })
    };
    env = createEnv(store);
  });

  test('буферираният лог се записва само при чекпойнт и финал', async () => {
    await processSingleUserPlan(USER_ID, env);

    const logWrites = env.USER_METADATA_KV.put.mock.calls.filter(([key]) => key === LOG_KEY);
    expect(logWrites).toHaveLength(4);

    const finalPayload = logWrites[logWrites.length - 1][1];
    const parsedLog = JSON.parse(finalPayload);

    expect(parsedLog).toHaveLength(3);
    expect(parsedLog[0]).toContain('Старт на генериране на плана');
    expect(parsedLog[1]).toContain('Прекъснато:');
    expect(parsedLog[2]).toContain('Процесът приключи');
  });

  test('fallback запис се създава при неуспешен flush', async () => {
    let logWriteCount = 0;
    env.USER_METADATA_KV.put.mockImplementation(async (key, value) => {
      if (key === LOG_KEY) {
        logWriteCount += 1;
        if (logWriteCount === 3) {
          throw new Error('kv down');
        }
      }
      store[key] = value;
    });

    await processSingleUserPlan(USER_ID, env);

    expect(store[`${LOG_KEY}_critical`]).toBeDefined();
    const fallback = JSON.parse(store[`${LOG_KEY}_critical`]);
    expect(fallback.error).toBe('kv down');
    expect(fallback.reason).toBe('precheck-failed');
    expect(fallback.lastEntry).toContain('Прекъснато:');

    const finalLog = JSON.parse(store[LOG_KEY]);
    expect(finalLog).toHaveLength(3);
    expect(finalLog[2]).toContain('Процесът приключи');
  });
});
