/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let populateDashboardDetailedAnalytics;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="analyticsCardsContainer">
      <div class="card analytics-card">
        <iframe id="macroAnalyticsCardFrame"></iframe>
      </div>
    </div>
    <div id="detailedAnalyticsContent"></div>
    <div id="dashboardTextualAnalysis"></div>
    <div id="detailedAnalyticsAccordion"><div class="accordion-header" aria-expanded="false"><svg class="arrow"></svg></div></div>
  `;
  const selectors = {
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    detailedAnalyticsContent: document.getElementById('detailedAnalyticsContent'),
    dashboardTextualAnalysis: document.getElementById('dashboardTextualAnalysis'),
    detailedAnalyticsAccordion: document.getElementById('detailedAnalyticsAccordion')
  };
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors,
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showToast: jest.fn(),
    closeModal: jest.fn(),
    displayPlanModChatTypingIndicator: jest.fn(),
    openModal: jest.fn(),
    showLoading: jest.fn()
  }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../config.js', () => ({ generateId: () => 'id-1' }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    currentIntakeMacros: {},
    planHasRecContent: false,
    loadCurrentIntake: jest.fn()
  }));
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    calculatePlanMacros: jest.fn(),
    getNutrientOverride: jest.fn(),
    addMealMacros: jest.fn(),
    scaleMacros: jest.fn()
  }));
  ({ populateDashboardDetailedAnalytics } = await import('../populateUI.js'));
});

test('запазва макро iframe и добавя нови карти', () => {
  const data = {
    detailed: [
      {
        label: 'Тест',
        currentValueText: '10',
        initialValueText: '0',
        expectedValueText: '20',
        currentValueNumeric: 5
      }
    ]
  };
  populateDashboardDetailedAnalytics(data);
  const frame = document.getElementById('macroAnalyticsCardFrame');
  expect(frame).not.toBeNull();
  const cards = document.querySelectorAll('#analyticsCardsContainer .analytics-card');
  expect(cards.length).toBe(2);
  expect(cards[0].contains(frame)).toBe(true);
});
