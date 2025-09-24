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

  test('записва AI токени при успешен CF отговор', async () => {
    const metricsEnv = {
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'token',
      __kvMetrics: { recordExtraMetric: jest.fn() }
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          response: 'ok',
          usage: { input_tokens: 10, output_tokens: 20 }
        }
      })
    });

    const res = await callModel(model, 'hi', metricsEnv);

    expect(res).toBe('ok');
    const recorder = metricsEnv.__kvMetrics.recordExtraMetric;
    expect(recorder).toHaveBeenCalledWith('AI заявки', 1);
    expect(recorder).toHaveBeenCalledWith('AI токени - вход', 10);
    expect(recorder).toHaveBeenCalledWith('AI токени - изход', 20);
    expect(recorder).toHaveBeenCalledWith('AI токени - общо', 30);
    expect(recorder).toHaveBeenCalledWith('AI токени - провайдър cloudflare', 30);
    expect(recorder).toHaveBeenCalledWith(`AI токени - модел ${model}`, 30);
  });
});

describe('callModel with command-r-plus model', () => {
  const model = 'command-r-plus';
  const env = { 'command-r-plus': 'key' };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('uses Cohere chat endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'ok' })
    });

    const res = await callModel(model, 'hi', env);

    expect(res).toBe('ok');
    const expectedUrl = 'https://api.cohere.ai/v1/chat';
    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('throws if API key missing', async () => {
    await expect(callModel(model, 'hi', {})).rejects.toThrow('Missing command-r-plus API key.');
  });
});

describe('AI токен метрики за OpenAI', () => {
  const env = {
    OPENAI_API_KEY: 'key',
    __kvMetrics: { recordExtraMetric: jest.fn() }
  };

  afterEach(() => {
    global.fetch = originalFetch;
    env.__kvMetrics.recordExtraMetric.mockReset();
  });

  test('callModel записва токените от usage полето', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 100, prompt_tokens: 40, completion_tokens: 60 }
      })
    });

    const result = await callModel('gpt-3.5-turbo', 'hi', env);

    expect(result).toBe('ok');
    const recorder = env.__kvMetrics.recordExtraMetric;
    expect(recorder).toHaveBeenCalledWith('AI заявки', 1);
    expect(recorder).toHaveBeenCalledWith('AI токени - общо', 100);
    expect(recorder).toHaveBeenCalledWith('AI токени - вход', 40);
    expect(recorder).toHaveBeenCalledWith('AI токени - изход', 60);
    expect(recorder).toHaveBeenCalledWith('AI токени - провайдър openai', 100);
    expect(recorder).toHaveBeenCalledWith('AI токени - модел gpt-3.5-turbo', 100);
  });
});
