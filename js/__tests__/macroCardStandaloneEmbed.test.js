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
    <iframe id="macroAnalyticsCardFrame"></iframe>
  `;
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors: {}, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../config.js', () => ({
    generateId: () => 'id-1',
    apiEndpoints: { dashboard: '/api/dashboardData' }
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

test('не създава iframe при разгръщане', () => {
  const header = document.querySelector('.accordion-header');
  handleAccordionToggle.call(header);
  const iframe = document.querySelector('#macroCardIframe');
  expect(iframe).toBeNull();
});

test('слушателят за съобщения променя височината', async () => {
  await import('../populateUI.js');
  const frame = document.getElementById('macroAnalyticsCardFrame');
  const newHeight = 420;
  const evt = new MessageEvent('message', {
    data: { type: 'macro-card-height', height: newHeight },
    source: frame.contentWindow,
  });
  window.dispatchEvent(evt);
  expect(frame.style.height).toBe(`${newHeight}px`);
});
