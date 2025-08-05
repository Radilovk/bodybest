/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleAccordionToggle;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="detailedAnalyticsAccordion">
      <div class="accordion-header" aria-expanded="false"></div>
      <div class="accordion-content"></div>
    </div>
  `;
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors: {}, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../config.js', () => ({
    generateId: () => 'id-1',
    apiEndpoints: { dashboard: '/api/dashboardData' },
    standaloneMacroUrl: 'macroAnalyticsCardStandalone.html'
  }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    ensureMacroAnalyticsElement: jest.fn(),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn(),
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    todaysPlanMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    currentIntakeMacros: {},
    planHasRecContent: false,
    loadCurrentIntake: jest.fn(),
    currentUserId: 'u1'
  }));
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
  jest.unstable_mockModule('../macroUtils.js', () => ({ calculatePlanMacros: jest.fn(), getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), scaleMacros: jest.fn() }));
  const mod = await import('../populateUI.js');
  handleAccordionToggle = mod.handleAccordionToggle;
});

test('не създава macro-analytics-card при разгръщане', () => {
  const header = document.querySelector('.accordion-header');
  handleAccordionToggle.call(header);
  const card = document.querySelector('macro-analytics-card');
  expect(card).toBeNull();
});

