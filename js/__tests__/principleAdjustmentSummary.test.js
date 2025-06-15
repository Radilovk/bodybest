import { jest } from '@jest/globals';
import * as mod from '../../worker.js';

const userId = 'u1';

const env = {
  USER_METADATA_KV: {
    get: jest.fn(async (key) => {
      if (key === `${userId}_initial_answers`) return JSON.stringify({ goal: 'отслабване', name: 'Test' });
      if (key === `${userId}_final_plan`) return JSON.stringify({ principlesWeek2_4: 'Old principles' });
      if (key === `${userId}_current_status`) return JSON.stringify({ weight: 70 });
      if (key === `${userId}_chat_history`) return '[]';
      if (key === `${userId}_last_adaptive_quiz_ts`) return null;
      return null;
    }),
    list: jest.fn().mockResolvedValue({ keys: [] }),
    put: jest.fn(),
    delete: jest.fn()
  },
  RESOURCES_KV: {
    get: jest.fn(async (key) => {
      if (key === 'prompt_principle_adjustment') return 'PROMPT';
      if (key === 'model_plan_generation') return 'model';
      return null;
    })
  },
  GEMINI_API_KEY: 'fake-key'
};

describe('handlePrincipleAdjustment', () => {
  test('creates summary when AI response lacks summary', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"updatedPrinciples":"Принцип 1\\nПринцип 2"}' }]
            },
            finishReason: 'STOP'
          }
        ]
      })
    });
    await mod.handlePrincipleAdjustment(userId, env);
    const putCalls = env.USER_METADATA_KV.put.mock.calls;
    const hasSummary = putCalls.some(c => c[0] === `${userId}_ai_update_pending_ack`);
    expect(hasSummary).toBe(true);
    global.fetch = originalFetch;
  });
});

describe('createUserConcernsSummary', () => {
  test('summarizes notes and extra meals', () => {
    const logs = [
      JSON.stringify({ note: 'Чувствам глад', extraMeals: [{}, {}] }),
      null
    ];
    const chat = [
      { role: 'user', parts: [{ text: 'Трудно ми е да спазвам плана' }] }
    ];
    const res = mod.createUserConcernsSummary(logs, chat);
    expect(res).toContain('Чувствам');
    expect(res).toContain('2');
    expect(res).toContain('Трудно');
  });
});
