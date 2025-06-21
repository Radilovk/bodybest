import { jest } from '@jest/globals';
import { handleTestAiModelRequest } from '../../worker.js';

const originalFetch = global.fetch;

describe('handleTestAiModelRequest', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns 400 when model is missing', async () => {
    const env = {};
    const request = {
      headers: { get: () => null },
      json: async () => ({})
    };
    const res = await handleTestAiModelRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('returns 403 on invalid token', async () => {
    const env = { WORKER_ADMIN_TOKEN: 'secret' };
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer wrong' : null) },
      json: async () => ({ model: 'gpt-test' })
    };
    const res = await handleTestAiModelRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(403);
  });

  test('succeeds with valid model', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = {
      WORKER_ADMIN_TOKEN: 'secret',
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token'
    };
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ model: '@cf/meta/llama-3-8b-instruct' })
    };
    const res = await handleTestAiModelRequest(request, env);
    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });
});
