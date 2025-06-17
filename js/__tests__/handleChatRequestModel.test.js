import { jest } from '@jest/globals';
import { handleChatRequest } from '../../worker.js';

describe('handleChatRequest model option', () => {
  const baseEnv = {
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

  test('uses provided model when present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })
    });
    const request = { json: async () => ({ userId: 'u1', message: 'm', model: 'override' }) };
    const res = await handleChatRequest(request, { ...baseEnv });
    expect(res.success).toBe(true);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('override');
  });

  test('uses promptOverride when supplied', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })
    });
    const request = { json: async () => ({ userId: 'u1', message: 'm', promptOverride: 'Override %%USER_MESSAGE%%' }) };
    const res = await handleChatRequest(request, { ...baseEnv });
    expect(res.success).toBe(true);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toContain('Override m');
  });
});
