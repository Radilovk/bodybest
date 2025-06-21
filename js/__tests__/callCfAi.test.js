import { jest } from '@jest/globals';
import { callCfAi } from '../../worker.js';

const originalFetch = global.fetch;

describe('callCfAi', () => {
  const model = 'test-model';
  const payload = { msg: 'hi', temperature: 0.5, max_tokens: 10 };
  const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token' };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('sends correct request body and returns result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });

    const res = await callCfAi(model, payload, env);

    expect(res).toBe('ok');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/test-model',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
  });

  test('throws error on failed response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ errors: [{ message: 'bad' }] })
    });

    await expect(callCfAi(model, payload, env)).rejects.toThrow(
      'CF AI error: bad'
    );
  });
});
