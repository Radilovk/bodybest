import { jest } from '@jest/globals';
import { callModel, callGeminiVisionAPI } from '../../worker.js';

const originalFetch = global.fetch;

describe('Gemini API retry logic', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('callModel retries on overload and succeeds', async () => {
    jest.useFakeTimers();
    const responses = [
      { ok: false, status: 503, json: async () => ({ error: { message: 'overloaded', status: 'UNAVAILABLE' } }) },
      { ok: false, status: 429, json: async () => ({ error: { message: 'overloaded', status: 'RESOURCE_EXHAUSTED' } }) },
      { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) }
    ];
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    const env = { GEMINI_API_KEY: 'k' };

    const promise = callModel('gemini-pro', 'hi', env);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(3);
    const result = await promise;
    expect(result).toBe('ok');
  });

  test('callGeminiVisionAPI fails after retries', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'model overloaded', status: 'UNAVAILABLE' } })
    });

    const promise = callGeminiVisionAPI('img', 'image/png', 'k', 'hi', {}, 'gemini-pro-vision');

    await promise.catch(() => {});
    expect(global.fetch).toHaveBeenCalledTimes(3);
    await expect(promise).rejects.toThrow(/overload/i);
  });
});
