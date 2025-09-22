import { calculateAnalyticsIndexes, clearResourceCache } from '../../worker.js';

const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

describe('calculateAnalyticsIndexes engagement score', () => {
  beforeEach(() => {
    clearResourceCache();
  });

  test('returns positive score when index data is logged', async () => {
    const today = new Date();
    const dayKey = daysOrder[today.getDay()];
    const dateStr = today.toISOString().split('T')[0];

    const finalPlan = { week1Menu: { [dayKey]: ['meal1'] } };
    const logEntries = [{ date: dateStr, data: { mood: 3, energy: 4, completedMealsStatus: {} } }];
    const env = { RESOURCES_KV: { get: async () => null } };

    const result = await calculateAnalyticsIndexes('user', {}, finalPlan, logEntries, {}, env);
    const expected = Math.round(((0) * 0.4) + (((2 / 5) * 100) * 0.4) + (((1 / 7) * 100) * 0.2));
    expect(result.current.engagementScore).toBe(expected);
  });

  test('reuses cached analytics prompt and model between calls', async () => {
    const today = new Date();
    const dayKey = daysOrder[today.getDay()];
    const dateStr = today.toISOString().split('T')[0];

    const finalPlan = { week1Menu: { [dayKey]: ['meal1'] } };
    const logEntries = [{ date: dateStr, data: { mood: 3, energy: 4, completedMealsStatus: {} } }];

    const getMock = jest.fn(async (key) => {
      if (key === 'prompt_analytics_textual_summary') return 'Резюме: %%USER_GOAL%%';
      if (key === 'model_plan_generation') return 'gpt-4o-mini';
      return null;
    });

    const env = { RESOURCES_KV: { get: getMock } };

    await calculateAnalyticsIndexes('user', {}, finalPlan, logEntries, {}, env);
    await calculateAnalyticsIndexes('user', {}, finalPlan, logEntries, {}, env);

    const promptCalls = getMock.mock.calls.filter(([key]) => key === 'prompt_analytics_textual_summary').length;
    const modelCalls = getMock.mock.calls.filter(([key]) => key === 'model_plan_generation').length;

    expect(promptCalls).toBe(1);
    expect(modelCalls).toBe(1);
  });
});

