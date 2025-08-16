import { jest } from '@jest/globals';
import { _withKvListCounting, _maybeSendKvListTelemetry } from '../../worker.js';

describe('kv list telemetry', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('counts list calls and sends telemetry every 15 minutes', async () => {
    const env = {
      TEST_KV: { list: async () => ({ keys: [] }) },
      MONITORING_ENDPOINT: 'https://example.com/telemetry'
    };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}), text: async () => '' }));

    const wrapped = _withKvListCounting(env);
    await wrapped.TEST_KV.list();
    await wrapped.TEST_KV.list();
    await _maybeSendKvListTelemetry(wrapped);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.kv_list_counts.TEST_KV).toBe(2);

    global.fetch.mockClear();
    await _maybeSendKvListTelemetry(wrapped);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
