import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

describe('processSingleUserPlan', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  test('инициализира last_adaptive_quiz_ts при генериране на план', async () => {
    const kvStore = new Map();
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); }),
      delete: jest.fn(key => { kvStore.delete(key); return Promise.resolve(); }),
      list: jest.fn(() => Promise.resolve({ keys: [] }))
    };
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          question_definitions: '[]',
          base_diet_model: '',
          allowed_meal_combinations: '',
          eating_psychology: '',
          recipe_data: '{}',
          model_plan_generation: 'gpt-test',
          prompt_unified_plan_generation_v2: 'prompt'
        };
        return Promise.resolve(data[key]);
      })
    };
    kvStore.set('u1_initial_answers', JSON.stringify({ email: 'test@exam.com' }));

    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      GEMINI_API_KEY: 'g',
      OPENAI_API_KEY: 'o'
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  profileSummary: 'ps',
                  caloriesMacros: { plan: {}, recommendation: {} },
                  week1Menu: {},
                  principlesWeek2_4: [],
                  detailedTargets: {}
                })
              }
            }
          ]
        }),
        text: async () => ''
      })
    );

    await worker.processSingleUserPlan('u1', env);
    const ts = kvStore.get('u1_last_adaptive_quiz_ts');
    expect(ts).toBeDefined();
    expect(Number(ts)).not.toBeNaN();
    const readyTs = kvStore.get('u1_plan_ready_ts');
    expect(readyTs).toBeDefined();
    expect(Number(readyTs)).not.toBeNaN();
  });
});
