import { jest } from '@jest/globals';
import { handleLogRequest } from '../worker.js';

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
      })
    }
  };
}

function createRequest(payload) {
  return {
    json: jest.fn(() => Promise.resolve(JSON.parse(JSON.stringify(payload))))
  };
}

describe('handleLogRequest', () => {
  test('не извършва повторни KV записи при идентични данни', async () => {
    const env = createEnv();
    const payload = {
      userId: 'user-1',
      date: '2024-06-01',
      weight: '70',
      data: { mood: 'great' }
    };

    const firstResponse = await handleLogRequest(createRequest(payload), env);
    expect(firstResponse.success).toBe(true);
    expect(firstResponse.updated).toBe(true);

    const putCallsAfterFirst = env.USER_METADATA_KV.put.mock.calls.map(args => [...args]);
    expect(putCallsAfterFirst.length).toBeGreaterThan(0);
    const storeSnapshotAfterFirst = Array.from(env.__store.entries());
    const statusKey = `${payload.userId}_current_status`;
    expect(env.__store.has(statusKey)).toBe(true);
    const statusAfterFirst = JSON.parse(env.__store.get(statusKey));
    expect(env.__store.get(`${payload.userId}_lastActive`)).toBe(payload.date);

    const secondResponse = await handleLogRequest(createRequest(payload), env);
    expect(secondResponse.success).toBe(true);
    expect(secondResponse.updated).toBe(false);

    expect(env.USER_METADATA_KV.put.mock.calls).toEqual(putCallsAfterFirst);
    expect(Array.from(env.__store.entries())).toEqual(storeSnapshotAfterFirst);
    expect(JSON.parse(env.__store.get(statusKey))).toEqual(statusAfterFirst);
  });
});
