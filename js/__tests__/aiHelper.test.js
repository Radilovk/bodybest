import { jest } from '@jest/globals';
import { handleAiHelperRequest } from '../../worker.js';

describe('handleAiHelperRequest', () => {
  test('fails without userId', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn() } };
    const request = { json: async () => ({}) };
    const res = await handleAiHelperRequest(request, env);
    expect(res.success).toBe(false);
  });

  test('returns AI response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'summary' } })
    });
    const env = {
      USER_METADATA_KV: {
        get: jest.fn().mockResolvedValue('{"note":"ok"}')
      },
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token'
    };
    const request = { json: async () => ({ userId: 'u1', lookbackDays: 1 }) };
    const res = await handleAiHelperRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.aiResponse).toBe('summary');
  });
});
