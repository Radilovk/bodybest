import { jest } from '@jest/globals';
import { handleAnalyzeImageRequest } from '../../worker.js';

const validPng = 'iVBORw0KGgoA';

const originalFetch = global.fetch;
const originalBuffer = global.Buffer;

describe('handleAnalyzeImageRequest', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    global.Buffer = originalBuffer;
  });

  test('returns 400 on invalid JSON', async () => {
    const request = { json: jest.fn().mockRejectedValue(new SyntaxError('bad')) };
    const res = await handleAnalyzeImageRequest(request, {});
    expect(res.success).toBe(false);
    expect(res.message).toBe('Невалиден JSON.');
    expect(res.statusHint).toBe(400);
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
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}`, prompt: 'hi' }) };
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
    expect(body).toEqual({
      prompt: 'hi',
      image: `data:image/png;base64,${validPng}`
    });
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
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}`, prompt: 'desc' }) };
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
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}`, prompt: 'desc' }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.result).toBe('ok');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].inlineData.data).toBe(validPng);
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
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    await handleAnalyzeImageRequest(request, env);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[1].text).toBe('Опиши съдържанието на това изображение.');
  });

  test('sends prompt-image payload for cf models', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('@cf/llava-hf/llava-1.5-7b-hf') }
    };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}`, prompt: 'desc' }) };
    await handleAnalyzeImageRequest(request, env);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      prompt: 'desc',
      image: `data:image/png;base64,${validPng}`
    });
  });

  test('uses env.AI.run when available', async () => {
    const aiRun = jest.fn().mockResolvedValue({ response: 'ok' });
    const env = {
      AI: { run: aiRun },
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('@cf/llava-hf/llava-1.5-7b-hf') }
    };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}`, prompt: 'desc' }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.result).toBe('ok');
    expect(aiRun).toHaveBeenCalledWith('@cf/llava-hf/llava-1.5-7b-hf', { prompt: 'desc', image: `data:image/png;base64,${validPng}` });
  });

  test('fails when both CF secrets missing', async () => {
    const env = { RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) } };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Липсват CF_AI_TOKEN и CF_ACCOUNT_ID.');
    expect(res.statusHint).toBe(500);
  });

  test('fails when only CF_AI_TOKEN missing', async () => {
    const env = { CF_ACCOUNT_ID: 'acc', RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) } };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Липсва CF_AI_TOKEN.');
    expect(res.statusHint).toBe(500);
  });

  test('fails when only CF_ACCOUNT_ID missing', async () => {
    const env = { CF_AI_TOKEN: 't', RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) } };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Липсва CF_ACCOUNT_ID.');
    expect(res.statusHint).toBe(500);
  });

  test('fails when GEMINI_API_KEY missing', async () => {
    const env = { RESOURCES_KV: { get: jest.fn().mockResolvedValue('gemini-pro-vision') } };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Липсва GEMINI_API_KEY.');
    expect(res.statusHint).toBe(500);
  });

  test('rejects non-image data URL', async () => {
    const request = { json: async () => ({ userId: 'u1', image: 'data:text/plain;base64,ZWxv' }) };
    const res = await handleAnalyzeImageRequest(request, {});
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('rejects mimeType not starting with image/', async () => {
    const request = { json: async () => ({ userId: 'u1', image: 'ZWxv', mimeType: 'application/pdf' }) };
    const res = await handleAnalyzeImageRequest(request, {});
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('extracts mimeType from data URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token', RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) } };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    await handleAnalyzeImageRequest(request, env);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.image).toBe(`data:image/png;base64,${validPng}`);
  });

  test('returns 400 on invalid base64', async () => {
    const request = { json: async () => ({ userId: 'u1', image: 'invalid&&' }) };
    const res = await handleAnalyzeImageRequest(request, {});
    expect(res.success).toBe(false);
    expect(res.message).toBe('Невалиден формат на изображението.');
    expect(res.statusHint).toBe(400);
  });

  test('rejects data with invalid image header', async () => {
    const b64 = Buffer.from('hello').toString('base64');
    const request = { json: async () => ({ userId: 'u1', image: b64, mimeType: 'image/png' }) };
    const res = await handleAnalyzeImageRequest(request, {});
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('handles undefined Buffer and detects mimeType', async () => {
    global.Buffer = undefined;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    });
    const env = {
      GEMINI_API_KEY: 'k',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue('gemini-pro-vision') }
    };
    const request = { json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` }) };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(true);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
  });

  test('returns friendly message on Cloudflare decode error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ errors: [{ message: 'failed to decode u8' }] })
    });
    const env = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) }
    };
    const request = {
      json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` })
    };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Невалидни или повредени данни на изображението.');
    expect(res.statusHint).toBe(400);
  });

  test('records usage in USER_METADATA_KV', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: 'ok' } })
    });
    const env = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) },
      USER_METADATA_KV: { put: jest.fn() }
    };
    const request = {
      headers: { get: () => null },
      json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` })
    };
  await handleAnalyzeImageRequest(request, env);
  expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
    expect.stringMatching(/^usage_analyzeImage_/),
    expect.any(String)
  );
  });

  test('rate limits excessive requests', async () => {
    const now = Date.now();
    const env = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) },
      USER_METADATA_KV: {
        get: jest.fn().mockResolvedValue(JSON.stringify({ ts: now, count: 3 })),
        put: jest.fn()
      }
    };
    const request = {
      headers: { get: () => 'Bearer tok' },
      json: async () => ({ userId: 'u1', image: `data:image/png;base64,${validPng}` })
    };
    const res = await handleAnalyzeImageRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(429);
  });
});
