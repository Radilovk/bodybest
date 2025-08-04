import { jest } from '@jest/globals';
import * as mod from '../../worker.js';

const userId = 'u1';

// Removed unused iso helper

describe('processSingleUserPlan with pending modification', () => {
  test('includes pending modification in prompt and clears key', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === `${userId}_initial_answers`) {
            return Promise.resolve(JSON.stringify({ name: 'A', email: 'a@a.bg', goal: 'цел' }));
          }
          if (key === `${userId}_final_plan`) return Promise.resolve(null);
          if (key === `${userId}_current_status`) return Promise.resolve(JSON.stringify({ weight: 70 }));
          if (key === `pending_plan_mod_${userId}`) return Promise.resolve(JSON.stringify({ request: 'без яйца' }));
          if (key.startsWith(`${userId}_log_`)) return Promise.resolve(null);
          return Promise.resolve(null);
        }),
        put: jest.fn(),
        delete: jest.fn(),
      },
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'question_definitions') return '[]';
          if (['base_diet_model','allowed_meal_combinations','eating_psychology'].includes(key)) return '';
          if (key === 'recipe_data') return '{}';
          if (key === 'model_plan_generation') return 'model';
          if (key === 'prompt_unified_plan_generation_v2') return '{"profileSummary":"X","caloriesMacros":{"fiber_percent":10,"fiber_grams":30},"week1Menu":{},"principlesWeek2_4":[],"detailedTargets":{}}';
          return null;
        })
      },
      GEMINI_API_KEY: 'key'
    };

    const originalFetch = global.fetch;
    let sentPrompt = '';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"profileSummary":"ok","caloriesMacros":{"fiber_percent":10,"fiber_grams":30},"week1Menu":{},"principlesWeek2_4":[],"detailedTargets":{}}' }] } }] })
    });

    await mod.processSingleUserPlan(userId, env);

    if (global.fetch.mock.calls.length > 0) {
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      sentPrompt = body.contents[0].parts[0].text;
    }

    global.fetch = originalFetch;

    expect(sentPrompt).toContain('без яйца');
    expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith(`pending_plan_mod_${userId}`);
  });
});
