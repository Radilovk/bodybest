import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

const userId = 'u1';

describe('AI config usage', () => {
  test('processSingleUserPlan uses plan config', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === `${userId}_initial_answers`) return Promise.resolve('{"name":"A","email":"a@a.bg"}');
          if (key === `${userId}_final_plan`) return Promise.resolve(null);
          if (key.endsWith('_current_status')) return Promise.resolve('{}');
          return Promise.resolve(null);
        }),
        put: jest.fn(),
        delete: jest.fn()
      },
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'question_definitions') return '[]';
          if (['base_diet_model','allowed_meal_combinations','eating_psychology'].includes(key)) return '';
          if (key === 'recipe_data') return '{}';
          if (key === 'model_plan_generation') return 'model';
          if (key.startsWith('prompt_generate_')) return 'tpl';
          if (key === 'plan_token_limit') return '123';
          if (key === 'plan_temperature') return '0.25';
          return null;
        })
      },
      GEMINI_API_KEY: 'k'
    };

    const spy = jest.spyOn(worker, 'callModel').mockResolvedValue('{}');

    await worker.processSingleUserPlan(userId, env);

    expect(spy).toHaveBeenCalled();
    spy.mock.calls.forEach(c => {
      expect(c[3]).toEqual({ temperature: 0.25, maxTokens: 123 });
    });
    spy.mockRestore();
  });

  test('handleChatRequest uses chat config', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key.endsWith('_initial_answers')) return Promise.resolve('{"name":"U","goal":"gain"}');
          if (key.endsWith('_final_plan')) return Promise.resolve('{"profileSummary":"s","caloriesMacros":{},"allowedForbiddenFoods":{},"hydrationCookingSupplements":{},"week1Menu":{}}');
          if (key.startsWith('plan_status_')) return Promise.resolve('ready');
          if (key.endsWith('_chat_history')) return Promise.resolve('[]');
          if (key.endsWith('_current_status')) return Promise.resolve('{}');
          return Promise.resolve(null);
        }),
        put: jest.fn()
      },
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'recipe_data') return '{}';
          if (key === 'prompt_chat') return 'Say %%USER_MESSAGE%%';
          if (key === 'model_chat') return 'base-model';
          if (key === 'chat_token_limit') return '55';
          if (key === 'chat_temperature') return '0.8';
          return null;
        })
      },
      GEMINI_API_KEY: 'key'
    };

    const spy = jest.spyOn(worker, 'callModel').mockResolvedValue('ok');
    const request = { json: async () => ({ userId, message: 'm' }) };
    await worker.handleChatRequest(request, env);
    expect(spy).toHaveBeenCalledWith('base-model', expect.any(String), env, { temperature: 0.8, maxTokens: 55 });
    spy.mockRestore();
  });
});
