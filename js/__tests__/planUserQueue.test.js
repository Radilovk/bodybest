import { jest } from '@jest/globals';
import * as workerModule from '../../worker.js';
const worker = workerModule.default;
const { setPlanStatus } = workerModule;

describe('управление на опашките за план', () => {
  let env;
  beforeEach(() => {
    const store = {
      pending_plan_users: JSON.stringify([]),
      ready_plan_users: JSON.stringify([]),
      'u1_initial_answers': '{}'
    };
    env = {
      USER_METADATA_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
        list: jest.fn(({ prefix }) => {
          const keys = Object.keys(store).filter(k => k.startsWith(prefix)).map(k => ({ name: k }));
          return Promise.resolve({ keys });
        })
      },
      MAX_PROCESS_PER_RUN_PLAN_GEN: '1',
      MAX_PROCESS_PER_RUN_PRINCIPLES: '1'
    };
    env.store = store; // expose for assertions
  });

  test('setPlanStatus прехвърля userId между масивите', async () => {
    await setPlanStatus('u1', 'pending', env);
    expect(env.store.pending_plan_users).toBe(JSON.stringify(['u1']));
    await setPlanStatus('u1', 'ready', env);
    expect(env.store.pending_plan_users).toBe(JSON.stringify([]));
    expect(env.store.ready_plan_users).toBe(JSON.stringify(['u1']));
    await setPlanStatus('u1', 'processing', env);
    expect(env.store.ready_plan_users).toBe(JSON.stringify([]));
  });

  test('scheduled обработва първия pending и обновява остатъка', async () => {
    env.store.pending_plan_users = JSON.stringify(['u1','u2']);
    const ctx = { waitUntil: () => {} };
    jest.spyOn(workerModule, 'processSingleUserPlan').mockResolvedValue();
    jest.spyOn(workerModule, 'processPendingUserEvents').mockResolvedValue(0);
    jest.spyOn(workerModule, 'handlePrincipleAdjustment').mockResolvedValue();
    await worker.scheduled({ scheduledTime: Date.now() }, env, ctx);
    expect(workerModule.processSingleUserPlan).toHaveBeenCalledWith('u1', env);
    expect(JSON.parse(env.store.pending_plan_users)).toEqual(['u2']);
  });
});
