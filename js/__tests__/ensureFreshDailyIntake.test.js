/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { getLocalDate } from '../utils.js';

test('ensureFreshDailyIntake изчиства вчерашните extraMeals', async () => {
  jest.resetModules();
  const app = await import('../app.js');
  const yesterday = getLocalDate(new Date(Date.now() - 86400000));
  sessionStorage.setItem('lastDashboardDate', yesterday);
  app.todaysExtraMeals.push({ calories: 100 });
  app.todaysMealCompletionStatus.sample = true;

  app.ensureFreshDailyIntake();

  expect(app.todaysExtraMeals).toEqual([]);
  expect(app.todaysMealCompletionStatus).toEqual({});
  expect(sessionStorage.getItem('lastDashboardDate')).toBe(getLocalDate());
});
