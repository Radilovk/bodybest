import { jest } from '@jest/globals';
import { createKvMonitor, persistKvUsageMetrics, handleKvUsageMetricsRequest } from '../worker.js';

describe('kv usage monitoring', () => {
  test('createKvMonitor брои KV операциите и уважава runWithoutCounting', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async () => null),
        put: jest.fn(async () => undefined)
      }
    };

    const monitor = createKvMonitor(env);
    const wrapped = monitor.env;

    await wrapped.USER_METADATA_KV.get('test-key');
    await wrapped.USER_METADATA_KV.put('test-key', 'value');
    await monitor.runWithoutCounting(() => wrapped.USER_METADATA_KV.get('skip-key'));

    const snapshot = monitor.getSnapshot();
    expect(snapshot.totalOperations).toBe(2);
    expect(snapshot.byMethod.get).toBe(1);
    expect(snapshot.byMethod.put).toBe(1);
    expect(snapshot.byNamespace.USER_METADATA_KV.total).toBe(2);
  });

  test('persistKvUsageMetrics натрупва данните по дни', async () => {
    const store = new Map();
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async key => store.get(key) ?? null),
        put: jest.fn(async (key, value) => {
          store.set(key, value);
        })
      }
    };

    const counts = {
      totalOperations: 3,
      requests: 1,
      byMethod: { total: 3, get: 2, put: 1 },
      byNamespace: {
        USER_METADATA_KV: { total: 3, get: 2, put: 1, list: 0, delete: 0 }
      },
      extraMetrics: { 'AI токени - общо': 40 }
    };

    const day = new Date('2024-04-20T10:00:00Z');
    await persistKvUsageMetrics(env, 'GET /api/demo', counts, day, { includeZero: true });
    await persistKvUsageMetrics(env, 'GET /api/demo', counts, day, { includeZero: true });

    const stored = JSON.parse(store.get('kv_usage_2024-04-20'));
    expect(stored.handlers['GET /api/demo'].totalOperations).toBe(6);
    expect(stored.handlers['GET /api/demo'].byMethod.get).toBe(4);
    expect(stored.handlers['GET /api/demo'].extraMetrics['AI токени - общо']).toBe(80);
    expect(stored.handlers['GET /api/demo'].requests).toBe(2);
  });

  test('handleKvUsageMetricsRequest връща агрегирани стойности за периода', async () => {
    const store = new Map();
    store.set('kv_usage_2024-04-19', JSON.stringify({
      date: '2024-04-19',
      handlers: {
        'GET /api/foo': {
          handler: 'GET /api/foo',
          requests: 2,
          totalOperations: 8,
          byMethod: { total: 8, get: 6, put: 2 },
          byNamespace: {
            USER_METADATA_KV: { total: 8, get: 6, put: 2, list: 0, delete: 0 }
          },
          extraMetrics: { 'AI токени - общо': 20 }
        }
      },
      lastUpdated: '2024-04-19T12:00:00Z'
    }));
    store.set('kv_usage_2024-04-20', JSON.stringify({
      date: '2024-04-20',
      handlers: {
        'GET /api/foo': {
          handler: 'GET /api/foo',
          requests: 1,
          totalOperations: 5,
          byMethod: { total: 5, get: 3, put: 2 },
          byNamespace: {
            USER_METADATA_KV: { total: 5, get: 3, put: 2, list: 0, delete: 0 }
          },
          extraMetrics: { 'AI токени - общо': 15 }
        },
        'GET /api/bar': {
          handler: 'GET /api/bar',
          requests: 1,
          totalOperations: 2,
          byMethod: { total: 2, get: 2 },
          byNamespace: {
            RESOURCES_KV: { total: 2, get: 2, put: 0, list: 0, delete: 0 }
          },
          extraMetrics: {}
        }
      },
      lastUpdated: '2024-04-20T09:00:00Z'
    }));

    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async key => store.get(key) ?? null)
      }
    };

    const requestLike = { url: 'https://example.com/api/kvUsage?from=2024-04-19&to=2024-04-20' };
    const result = await handleKvUsageMetricsRequest(requestLike, env);

    expect(result.success).toBe(true);
    expect(result.summary.totalOperations).toBe(15);
    expect(result.summary.totalRequests).toBe(4);
    expect(result.summary.namespaceTotals.USER_METADATA_KV.total).toBe(13);
    expect(result.summary.namespaceTotals.RESOURCES_KV.total).toBe(2);
    expect(result.summary.extraMetrics['AI токени - общо']).toBe(35);
    expect(result.handlers[0].handler).toBe('GET /api/foo');
    expect(result.handlers[0].totalOperations).toBe(13);
    expect(result.handlers[0].averagePerRequest).toBeCloseTo(13 / 3);
  });
});
