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

test('loadCurrentIntake не презаписва подаденото състояние', async () => {
  jest.resetModules();
  const app = await import('../app.js');
  Object.assign(app.fullDashboardData, { planData: { week1Menu: {} } });
  app.todaysMealCompletionStatus.sample = true;
  app.todaysExtraMeals.length = 0;
  app.todaysExtraMeals.push({ calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 1 });
  app.loadCurrentIntake(app.todaysMealCompletionStatus, app.todaysExtraMeals);
  expect(app.todaysMealCompletionStatus).toEqual({ sample: true });
  expect(app.currentIntakeMacros).toEqual({
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
    fiber: 1,
  });
});

test('recalculateCurrentIntakeMacros преизчислява макросите', async () => {
  jest.resetModules();
  const app = await import('../app.js');
  Object.assign(app.fullDashboardData, { planData: { week1Menu: {} } });
  app.todaysMealCompletionStatus.sample = true;
  app.todaysExtraMeals.length = 0;
  app.todaysExtraMeals.push({ calories: 50, protein: 2, carbs: 5, fat: 1, fiber: 1 });
  app.recalculateCurrentIntakeMacros();
  expect(app.currentIntakeMacros).toEqual({
    calories: 50,
    protein: 2,
    carbs: 5,
    fat: 1,
    fiber: 1,
  });
});
