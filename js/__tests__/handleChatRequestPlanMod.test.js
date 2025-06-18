import { jest } from '@jest/globals';
import { handleChatRequest } from '../../worker.js';

describe('handleChatRequest plan modification marker', () => {
  const env = {
    USER_METADATA_KV: {
      list: jest.fn().mockResolvedValue({ keys: [] }),
      get: jest.fn(key => {
        if (key.endsWith('_initial_answers')) return Promise.resolve('{"name":"U","goal":"gain","weight":"70"}');
        if (key.endsWith('_final_plan')) return Promise.resolve(JSON.stringify({
          profileSummary: 's',
          caloriesMacros: { calories: 1800, protein_grams: 1, carbs_grams: 1, fat_grams: 1 },
          allowedForbiddenFoods: { main_allowed_foods: [], main_forbidden_foods: [] },
          hydrationCookingSupplements: { hydration_recommendations: { daily_liters: '2' }, cooking_methods: { recommended: [] }, supplement_suggestions: [] },
          week1Menu: { sunday: [] },
          principlesWeek2_4: []
        }));
        if (key.startsWith('plan_status_')) return Promise.resolve('ready');
        if (key.endsWith('_chat_history')) return Promise.resolve('[]');
        if (key.endsWith('_current_status')) return Promise.resolve('{}');
        return Promise.resolve(null);
      }),
      put: jest.fn().mockResolvedValue(undefined)
    },
    RESOURCES_KV: {
      get: jest.fn(key => {
        if (key === 'recipe_data') return Promise.resolve('{}');
        if (key === 'prompt_chat') return Promise.resolve('Say %%USER_MESSAGE%%');
        if (key === 'model_chat') return Promise.resolve('base-model');
        return Promise.resolve(null);
      })
    },
    GEMINI_API_KEY: 'key'
  };

  afterEach(() => {
    global.fetch && global.fetch.mockRestore();
  });

  test('does not create event without planModChat source', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok\n[PLAN_MODIFICATION_REQUEST] change' }] } }] })
    });
    const request = { json: async () => ({ userId: 'u1', message: 'm' }) };
    const res = await handleChatRequest(request, { ...env });
    expect(res.success).toBe(true);
    const keys = env.USER_METADATA_KV.put.mock.calls.map(c => c[0]);
    expect(keys.some(k => k.startsWith('event_planMod_u1_'))).toBe(false);
  });

  test('creates event when source is planModChat', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok\n[PLAN_MODIFICATION_REQUEST] change' }] } }] })
    });
    const request = { json: async () => ({ userId: 'u1', message: 'm', source: 'planModChat' }) };
    const res = await handleChatRequest(request, { ...env });
    expect(res.success).toBe(true);
    const keys = env.USER_METADATA_KV.put.mock.calls.map(c => c[0]);
    expect(keys.some(k => k.startsWith('event_planMod_u1_'))).toBe(true);
  });

  test('populates USER_REQUEST correctly', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'reply' }] } }] })
    });
    const req1 = { json: async () => ({ userId: 'u1', message: 'first', source: 'planModChat', history: [] }) };
    await handleChatRequest(req1, { ...env });
    let body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt1 = body.contents[0].parts[0].text;
    expect(prompt1).toContain('first');
    global.fetch.mockClear();

    const req2 = { json: async () => ({ userId: 'u1', message: 'second', source: 'planModChat', history: [] }) };
    await handleChatRequest(req2, { ...env });
    body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt2 = body.contents[0].parts[0].text;
    expect(prompt2).toContain('second');
    expect(prompt1).not.toBe(prompt2);
  });
});
