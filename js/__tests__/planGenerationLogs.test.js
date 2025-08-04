import { jest } from '@jest/globals';
import * as mod from '../../worker.js';

const userId = 'u1';

function iso(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

describe('processSingleUserPlan log metrics', () => {
  test('injects recent log data in prompt', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => {
          if (key === `${userId}_initial_answers`) {
            return JSON.stringify({ name: 'A', email: 'a@a.bg', goal: 'цел', weight: 80 });
          }
          if (key === `${userId}_final_plan`) return null;
          if (key === `${userId}_current_status`) return JSON.stringify({ weight: 70 });
          if (key === `${userId}_log_${iso(0)}`) return JSON.stringify({ weight: 70, mood: 4, energy: 3 });
          if (key === `${userId}_log_${iso(6)}`) return JSON.stringify({ weight: 71 });
          return null;
        }),
        put: jest.fn(),
        delete: jest.fn(),
        list: jest.fn(async () => ({
          keys: [
            { name: `${userId}_log_${iso(0)}` },
            { name: `${userId}_log_${iso(6)}` }
          ]
        }))
      },
      RESOURCES_KV: {
        get: jest.fn(async (key) => {
          if (key === 'question_definitions') return '[]';
          if (['base_diet_model','allowed_meal_combinations','eating_psychology'].includes(key)) return '';
          if (key === 'recipe_data') return '{}';
          if (key === 'model_plan_generation') return 'model';
          if (key === 'prompt_unified_plan_generation_v2') {
            return '{"profileSummary":"Weight %%RECENT_WEIGHT_KG%% diff %%WEIGHT_CHANGE_LAST_7_DAYS%% mood %%AVG_MOOD_LAST_7_DAYS%% energy %%AVG_ENERGY_LAST_7_DAYS%%","caloriesMacros":{"fiber_percent":10,"fiber_grams":30},"week1Menu":{},"principlesWeek2_4":[],"detailedTargets":{}}';
          }
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

    expect(sentPrompt).toContain('70.0');
    expect(sentPrompt).toContain('-1.0');
    expect(sentPrompt).toContain('4.0');
    expect(sentPrompt).toContain('3.0');
    const putCalls = env.USER_METADATA_KV.put.mock.calls;
    const finalPlanCall = putCalls.find(c => c[0] === 'u1_final_plan');
    expect(finalPlanCall).toBeDefined();
    const savedPlan = JSON.parse(finalPlanCall[1]);
    expect(savedPlan.caloriesMacros).toEqual({ fiber_percent: 10, fiber_grams: 30 });
  });
});
