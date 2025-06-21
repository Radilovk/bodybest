import { jest } from '@jest/globals';
import { callModel } from '../../worker.js';

const originalFetch = global.fetch;

describe('callModel with CF provider', () => {
  const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token' };
  const model = '@cf/test-model';

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('sends temperature and max_tokens to fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });

    const res = await callModel(model, 'hi', env, { temperature: 0.5, maxTokens: 42 });

    expect(res).toBe('ok');
    const expectedUrl = 'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/test-model';
    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
          temperature: 0.5,
          max_tokens: 42
        })
      }
    );
  });

  test('throws error from callCfAi', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ errors: [{ message: 'bad' }] })
    });

    await expect(callModel(model, 'hi', env)).rejects.toThrow('CF AI error: bad');
  });
});
