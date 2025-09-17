import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const processSingleUserPlanMock = jest.fn().mockResolvedValue(undefined);
const handlePrincipleAdjustmentMock = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule('../worker.js', async () => {
  const original = await import('../worker.js');
  return {
    ...original,
    processSingleUserPlan: processSingleUserPlanMock,
    handlePrincipleAdjustment: handlePrincipleAdjustmentMock
  };
});

const workerModule = await import('../worker.js');
const worker = workerModule.default;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scheduled cron execution', () => {
  test('пропуска записите при липса на дейност', async () => {
    const store = {
      pending_plan_users: JSON.stringify([]),
      ready_plan_users: JSON.stringify([])
    };
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, value) => {
          store[key] = value;
          return Promise.resolve();
        }),
        list: jest.fn(() => Promise.resolve({ keys: [], list_complete: true })),
        delete: jest.fn(key => {
          delete store[key];
          return Promise.resolve();
        })
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const scheduledTime = Date.UTC(2024, 0, 1, 12);

    await worker.scheduled({ scheduledTime }, env, ctx);

    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalled();
  });

  test('агрегира метриките по дни само при дейност', async () => {
    const scheduledDay = Date.UTC(2024, 0, 2, 12);
    const dateKey = new Date(scheduledDay).toLocaleDateString('en-CA');
    const metricsKey = `cron_metrics_${dateKey}`;
    const store = {
      pending_plan_users: JSON.stringify(['u1']),
      ready_plan_users: JSON.stringify([]),
      'u1_initial_answers': JSON.stringify({ some: 'data' })
    };
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, value) => {
          store[key] = value;
          return Promise.resolve();
        }),
        list: jest.fn(() => Promise.resolve({ keys: [], list_complete: true })),
        delete: jest.fn(key => {
          delete store[key];
          return Promise.resolve();
        })
      }
    };
    const ctx = { waitUntil: jest.fn() };

    await worker.scheduled({ scheduledTime: scheduledDay }, env, ctx);

    expect(store[metricsKey]).toBeDefined();
    const aggregatedFirst = JSON.parse(store[metricsKey]);
    expect(aggregatedFirst).toMatchObject({
      date: dateKey,
      runs: 1,
      planProcessed: 1,
      eventsProcessed: 0,
      principlesProcessed: 0,
      lastTs: new Date(scheduledDay).toISOString()
    });
    expect(typeof aggregatedFirst.planMs).toBe('number');
    expect(typeof aggregatedFirst.eventsMs).toBe('number');
    expect(typeof aggregatedFirst.principlesMs).toBe('number');

    store.pending_plan_users = JSON.stringify(['u1']);

    const secondRunTime = Date.UTC(2024, 0, 2, 18);
    await worker.scheduled({ scheduledTime: secondRunTime }, env, ctx);

    const aggregatedSecond = JSON.parse(store[metricsKey]);
    expect(aggregatedSecond.runs).toBe(2);
    expect(aggregatedSecond.planProcessed).toBe(2);
    expect(aggregatedSecond.lastTs).toBe(new Date(secondRunTime).toISOString());
  });
});
