/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('adds cards for todaysExtraMeals', async () => {
  document.body.innerHTML = '<ul id="dailyMealList"></ul>';
  const selectors = { dailyMealList: document.getElementById('dailyMealList') };
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    ensureMacroAnalyticsElement: jest.fn(),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn(),
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: { userName: 'Иван', analytics: {}, planData: {}, dailyLogs: [], currentStatus: {}, initialData: {}, initialAnswers: {} },
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [{ foodDescription: 'Смути', quantityEstimate: '250 мл' }],
    todaysPlanMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    currentIntakeMacros: {},
    planHasRecContent: false,
    loadCurrentIntake: jest.fn(),
    resetDailyIntake: jest.fn(),
    updateMacrosAndAnalytics: jest.fn(),
    ensureFreshDailyIntake: jest.fn(),
    currentUserId: 'u1',
  }));
  const { populateUI } = await import('../populateUI.js');
  await populateUI();
  const cards = document.querySelectorAll('#dailyMealList .extra-meal');
  expect(cards).toHaveLength(1);
  expect(cards[0].querySelector('.meal-name').textContent).toBe('Смути');
});
