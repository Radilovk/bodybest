import * as workerModule from '../../worker.js';

const { calculateAnalyticsIndexes, clearResourceCache } = workerModule;

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
    const logEntries = [{ date: dateStr, data: { health_tone: 3, activity: 4, completedMealsStatus: {} } }];

    const result = await calculateAnalyticsIndexes('user', {}, finalPlan, logEntries, {}, {});
    const expected = Math.round(((0) * 0.4) + (((2 / 5) * 100) * 0.4) + (((1 / 7) * 100) * 0.2));
    expect(result.current.engagementScore).toBe(expected);
  });

  test('produces deterministic textual summary for mixed metrics', async () => {
    const baseDate = new Date();
    const finalPlan = { week1Menu: {} };
    const logEntries = [];

    for (let offset = 0; offset < 5; offset++) {
      const entryDate = new Date(baseDate);
      entryDate.setDate(baseDate.getDate() - offset);
      const dayKey = daysOrder[entryDate.getDay()];
      const dateStr = entryDate.toISOString().split('T')[0];

      finalPlan.week1Menu[dayKey] = ['meal1', 'meal2'];
      logEntries.push({
        date: dateStr,
        data: {
          health_tone: 5,
          activity: 4.5,
          stress: 1.8,  // Lower stress is better
          sleep: 5,
          hydration: 2,
          completedMealsStatus: {
            [`${dayKey}_0`]: true,
            [`${dayKey}_1`]: true
          }
        }
      });
    }

    const initialAnswers = { goal: 'отслабване', weight: 82, height: 178, lossKg: 6 };
    const currentStatus = { weight: 79 };

    const result = await calculateAnalyticsIndexes('user', initialAnswers, finalPlan, logEntries, currentStatus, {});
    const summary = result.textualAnalysis;

    expect(summary).toContain('Целта Ви е отслабване');
    expect(summary).toContain('Качество на Съня');
    expect(summary).toContain('Хидратация');
  });

  test('falls back to default textual summary when helper has no data', () => {
    const helperResult = workerModule.buildDeterministicAnalyticsSummary({}, [], 'unknown');
    expect(helperResult).toBe('');
    const fallbackText = helperResult || 'Няма достатъчно данни за текстов анализ.';
    expect(fallbackText).toBe('Няма достатъчно данни за текстов анализ.');
  });
});

