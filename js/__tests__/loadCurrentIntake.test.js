/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('loadCurrentIntake агрегира макросите от логовете', async () => {
  jest.resetModules();
  const app = await import('../app.js');
  const todayStr = new Date().toISOString().split('T')[0];
  Object.assign(app.fullDashboardData, {
    planData: { week1Menu: {} },
    dailyLogs: [
      {
        date: todayStr,
        data: {
          completedMealsStatus: { sample: true },
          extraMeals: [{ calories: 200, protein: 10, carbs: 20, fat: 5, fiber: 1 }],
        },
      },
    ],
  });
  app.loadCurrentIntake();
  expect(app.todaysMealCompletionStatus).toEqual({ sample: true });
  expect(app.todaysExtraMeals).toHaveLength(1);
  expect(app.currentIntakeMacros).toEqual({
    calories: 200,
    protein: 10,
    carbs: 20,
    fat: 5,
    fiber: 1,
  });
});
