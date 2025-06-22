import { jest } from '@jest/globals';
import { handleAnalyzeImageRequest } from '../../worker.js';

const originalFetch = global.fetch;

describe('handleAnalyzeImageRequest', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns description from AI', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'desc' } })
    });
    const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token' };
    const request = { json: async () => ({ userId: 'u1', imageData: 'img' }) };

    const res = await handleAnalyzeImageRequest(request, env);

    expect(res.success).toBe(true);
    expect(res.description).toBe('desc');
    const expectedUrl =
      'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/stabilityai/clip';
    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({ method: 'POST' })
    );
  });
});
