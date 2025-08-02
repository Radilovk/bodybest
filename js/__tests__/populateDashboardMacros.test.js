/** @jest-environment jsdom */
import { jest } from '@jest/globals';

class DummyMacroCard extends HTMLElement {
  setData() {}
}
customElements.define('macro-analytics-card', DummyMacroCard);

global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));

let populateDashboardMacros;
let selectors;
beforeAll(async () => {
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
  await populateDashboardMacros(macros);
  expect(selectors.macroMetricsPreview.classList.contains('hidden')).toBe(false);
  expect(selectors.macroMetricsPreview.textContent).toContain('1800');
});
