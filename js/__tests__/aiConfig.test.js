import { jest } from '@jest/globals';
import { handleGetAiConfig, handleSetAiConfig, handleChatRequest } from '../../worker.js';

function createStore(initial = {}) {
  const store = { ...initial };
  return {
    list: jest.fn(async () => ({ keys: Object.keys(store).map(name => ({ name })) })),
    get: jest.fn(async key => store[key] || null),
    put: jest.fn(async (key, value) => { store[key] = String(value); }),
    _store: store
  };
}

describe('AI config handlers', () => {
  test('handleGetAiConfig returns all KV values', async () => {
    const kv = createStore({ model_chat: 'base' });
    const env = { RESOURCES_KV: kv };
    const res = await handleGetAiConfig({}, env);
    expect(res.success).toBe(true);
    expect(res.config).toEqual({ model_chat: 'base' });
  });

  test('handleSetAiConfig updates values and subsequent chat uses them', async () => {
    const kv = createStore({
      recipe_data: '{}',
      prompt_chat: 'Say %%USER_MESSAGE%%',
      model_chat: 'old-model'
    });
    const env = {
      RESOURCES_KV: kv,
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key.endsWith('_initial_answers')) return Promise.resolve('{"name":"U","goal":"gain"}');
          if (key.endsWith('_final_plan')) return Promise.resolve(JSON.stringify({
            profileSummary: 's',
            caloriesMacros: { calories: 1800, protein_grams: 1, carbs_grams: 1, fat_grams: 1 },
            allowedForbiddenFoods: { main_allowed_foods: [], main_forbidden_foods: [] },
            hydrationCookingSupplements: { hydration_recommendations: { daily_liters: '2' }, cooking_methods: { recommended: [] }, supplement_suggestions: [] },
            week1Menu: { sunday: [] }
          }));
          if (key.startsWith('plan_status_')) return Promise.resolve('ready');
          if (key.endsWith('_chat_history')) return Promise.resolve('[]');
          if (key.endsWith('_current_status')) return Promise.resolve('{}');
          return Promise.resolve(null);
        }),
        put: jest.fn().mockResolvedValue(undefined)
      },
      GEMINI_API_KEY: 'key',
      WORKER_ADMIN_TOKEN: 'secret'
    };

    const reqSet = {
      headers: { get: () => 'Bearer secret' },
      json: async () => ({ updates: { model_chat: 'new-model' } })
    };

    const setRes = await handleSetAiConfig(reqSet, env);
    expect(setRes.success).toBe(true);
    expect(kv._store.model_chat).toBe('new-model');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })
    });
    const reqChat = { json: async () => ({ userId: 'u1', message: 'm' }) };
    const chatRes = await handleChatRequest(reqChat, env);
    expect(chatRes.success).toBe(true);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('new-model');
    global.fetch.mockRestore();
  });
});
