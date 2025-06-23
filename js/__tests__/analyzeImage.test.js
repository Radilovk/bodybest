import { jest } from '@jest/globals';
import { handleAnalyzeImageRequest } from '../../worker.js';

const originalFetch = global.fetch;

describe('handleAnalyzeImageRequest', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('validates input fields', async () => {
    const request = { json: async () => ({}) };
    const res = await handleAnalyzeImageRequest(request, {});
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('returns AI response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token', RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) } };
    const request = { json: async () => ({ userId: 'u1', imageData: 'imgdata', mimeType: 'image/png' }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.aiResponse).toBe('ok');
    const expectedUrl =
      'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/stabilityai/clip';
    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: 'imgdata' })
      })
    );
  });

  test('sends multi-modal payload when prompt provided for cf model', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token', RESOURCES_KV: { get: jest.fn().mockResolvedValue('@cf/llava') } };
    const request = { json: async () => ({ userId: 'u1', imageData: 'imgdata', mimeType: 'image/jpeg', prompt: 'describe' }) };
    await handleAnalyzeImageRequest(request, env);
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.messages[0].content[1].text).toBe('describe');
  });

  test('uses model from KV when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('@cf/custom') }
    };
    const request = { json: async () => ({ userId: 'u1', imageData: 'img', mimeType: 'image/png' }) };
    await handleAnalyzeImageRequest(request, env);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('@cf/custom');
  });

  test('calls Gemini vision API when provider is gemini', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    });
    const env = {
      GEMINI_API_KEY: 'k',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('gemini-pro-vision') }
    };
    const request = { json: async () => ({ userId: 'u1', imageData: 'img', mimeType: 'image/png', prompt: 'describe' }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.aiResponse).toBe('ok');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].inlineData.data).toBe('img');
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
    expect(body.contents[0].parts[1].text).toBe('describe');
  });
});
