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
    const request = { json: async () => ({ userId: 'u1', imageData: 'imgdata', mimeType: 'image/png', prompt: 'hi' }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.result).toBe('ok');
    const expectedUrl =
      'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/stabilityai/clip';
    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[0].content[0].image_url.url)
      .toBe('data:image/png;base64,imgdata');
    expect(body.messages[0].content[1].text).toBe('hi');
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
    const request = { json: async () => ({ userId: 'u1', imageData: 'img', mimeType: 'image/png', prompt: 'desc' }) };
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
    const request = { json: async () => ({ userId: 'u1', imageData: 'img', mimeType: 'image/png', prompt: 'desc' }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.result).toBe('ok');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].inlineData.data).toBe('img');
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
    expect(body.contents[0].parts[1].text).toBe('desc');
  });

  test('uses default gemini prompt when none provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    });
    const env = {
      GEMINI_API_KEY: 'k',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('gemini-pro-vision') }
    };
    const request = { json: async () => ({ userId: 'u1', imageData: 'img', mimeType: 'image/png' }) };
    await handleAnalyzeImageRequest(request, env);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[1].text).toBe('Опиши съдържанието на това изображение.');
  });

  test('sends prompt-image payload for llava models', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('@cf/llava-hf/llava-1.5-7b-hf') }
    };
    const request = { json: async () => ({ userId: 'u1', imageData: 'img', mimeType: 'image/png', prompt: 'desc' }) };
    await handleAnalyzeImageRequest(request, env);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      prompt: 'desc',
      image: 'data:image/png;base64,img'
    });
  });
});
