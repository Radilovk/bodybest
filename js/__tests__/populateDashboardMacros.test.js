/** @jest-environment jsdom */
import { jest } from '@jest/globals';

class DummyMacroCard extends HTMLElement {
  constructor() {
    super();
    this.setData = jest.fn();
  }
}
customElements.define('macro-analytics-card', DummyMacroCard);

global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));

let populateDashboardMacros;
let selectors;
let appState;
beforeAll(async () => {
  appState = await import('../app.js');
  ({ populateDashboardMacros } = await import('../populateUI.js'));
  ({ selectors } = await import('../uiElements.js'));
});

function setupDom() {
  document.body.innerHTML = '<div id="macroMetricsPreview"></div><div id="analyticsCardsContainer"></div>';
  selectors.macroMetricsPreview = document.getElementById('macroMetricsPreview');
  selectors.analyticsCardsContainer = document.getElementById('analyticsCardsContainer');
}

test('placeholder shown when macros missing and populates after migration', async () => {
  setupDom();
  await populateDashboardMacros(null);
  expect(selectors.macroMetricsPreview.classList.contains('hidden')).toBe(true);

  const macros = {
    calories: 1800,
    protein_percent: 30,
    carbs_percent: 40,
    fat_percent: 30,
    protein_grams: 135,
    carbs_grams: 180,
    fat_grams: 60
  };
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const dayMenu = [
    { id: 'z-01', meal_name: 'Протеинов шейк' },
    { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
  ];
  appState.fullDashboardData.planData = { week1Menu: { [currentDayKey]: dayMenu } };
  await populateDashboardMacros(macros);
  expect(selectors.macroMetricsPreview.classList.contains('hidden')).toBe(false);
  expect(selectors.macroMetricsPreview.textContent).toContain('1800');
  const card = document.getElementById('macroAnalyticsCard');
  expect(card.setData).toHaveBeenCalledWith({
    target: macros,
    plan: { calories: 850, protein: 72, carbs: 70, fat: 28 },
    current: appState.currentIntakeMacros
  });
});
