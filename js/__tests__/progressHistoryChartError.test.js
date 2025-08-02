/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('показва toast при грешка в Chart.js', async () => {
  jest.resetModules();
  document.body.innerHTML = '<div id="progressHistoryCard"></div>';
  const showToast = jest.fn();
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: { progressHistoryCard: document.getElementById('progressHistoryCard') },
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast }));
  jest.unstable_mockModule('../chartLoader.js', () => ({
    ensureChart: jest.fn(async () => { throw new Error('fail'); })
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {
      userName: '',
      analytics: { current: {}, streak: {} },
      planData: {},
      dailyLogs: [{ date: '2024-01-02', data: { weight: 80 } }],
      currentStatus: {},
      initialData: { weight: 81 },
      initialAnswers: {}
    },
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    currentIntakeMacros: {},
    planHasRecContent: false
  }));
  const { populateUI } = await import('../populateUI.js');
  await populateUI();
  expect(showToast).toHaveBeenCalledWith('Графиката не може да се зареди.', true, 4000);
  expect(document.getElementById('progressHistoryCard').innerHTML).toContain('Графиката не може да се зареди.');
});
