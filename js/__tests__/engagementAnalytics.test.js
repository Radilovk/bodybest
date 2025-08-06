import { calculateAnalyticsIndexes } from '../../worker.js';

const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

describe('calculateAnalyticsIndexes engagement score', () => {
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
});

