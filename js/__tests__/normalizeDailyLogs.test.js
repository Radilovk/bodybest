/** @jest-environment node */
import { normalizeDailyLogs } from '../utils.js';

describe('normalizeDailyLogs', () => {
  test('премества weight и completedMealsStatus в data', () => {
    const input = [{
      date: '2024-01-01',
      weight: 80,
      completedMealsStatus: { breakfast: true },
      extraMeals: [{ foodDescription: 'Смути' }],
      data: { note: 'hi' }
    }];
    const result = normalizeDailyLogs(input);
    expect(result).toEqual([
      {
        date: '2024-01-01',
        data: {
          note: 'hi',
          weight: 80,
          completedMealsStatus: { breakfast: true },
          extraMeals: [{ foodDescription: 'Смути' }]
        }
      }
    ]);
  });

  test('запазва вече нормализирани записи', () => {
    const input = [{
      date: '2024-01-02',
      data: {
        note: 'ok',
        weight: 70,
        completedMealsStatus: { lunch: false },
        extraMeals: [{ foodDescription: 'Сок' }]
      }
    }];
    expect(normalizeDailyLogs(input)).toEqual(input);
  });
});

