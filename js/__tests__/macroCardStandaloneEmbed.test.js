/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleAccordionToggle;
let standaloneMacroUrl;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="detailedAnalyticsAccordion">
      <div class="accordion-header" aria-expanded="false"></div>
      <div class="accordion-content"></div>
    </div>
    <macro-analytics-card id="macroAnalyticsCard" target-data='{"calories":1}' plan-data='{}' current-data='{}'></macro-analytics-card>
  `;
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors: {}, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../config.js', () => ({ generateId: () => 'id-1', standaloneMacroUrl: 'macroAnalyticsCardStandalone.html' }));
  jest.unstable_mockModule('../app.js', () => ({ fullDashboardData: {}, todaysMealCompletionStatus: {}, todaysExtraMeals: [], currentIntakeMacros: {}, planHasRecContent: false }));
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
  jest.unstable_mockModule('../macroUtils.js', () => ({ calculatePlanMacros: jest.fn(), getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), scaleMacros: jest.fn() }));
  const mod = await import('../populateUI.js');
  handleAccordionToggle = mod.handleAccordionToggle;
  ({ standaloneMacroUrl } = await import('../config.js'));
});

test('заменя макро картата с iframe при разгръщане', () => {
  const header = document.querySelector('.accordion-header');
  handleAccordionToggle.call(header);
  const iframe = document.querySelector('#macroCardIframe');
  expect(iframe).not.toBeNull();
  expect(iframe.src).toContain(standaloneMacroUrl);
});
