/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('uiHandlers escapeHtml usage', () => {
  test('openInfoModalWithDetails escapes HTML content', async () => {
    jest.resetModules();
    const selectors = {
      infoModalTitle: document.createElement('div'),
      infoModalBody: document.createElement('div')
    };
    document.body.appendChild(selectors.infoModalTitle);
    document.body.appendChild(selectors.infoModalBody);
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'infoModal' }));

    jest.unstable_mockModule('../uiElements.js', () => ({
      selectors,
      trackerInfoTexts: {},
      detailedMetricInfoTexts: {},
      mainIndexInfoTexts: {},
      loadInfoTexts: jest.fn(() => Promise.resolve())
    }));

    jest.unstable_mockModule('../app.js', () => ({
      fullDashboardData: { recipeData: { r1: { title: 'T <b>', body: 'B <i>\nline' } } },
      activeTooltip: null,
      setActiveTooltip: jest.fn(),
      todaysMealCompletionStatus: {},
      todaysExtraMeals: [],
      currentIntakeMacros: {},
      planHasRecContent: false
    }));

    const { openInfoModalWithDetails } = await import('../uiHandlers.js');
    openInfoModalWithDetails('r1', 'recipe');

    expect(selectors.infoModalTitle.innerHTML).toBe('T &lt;b&gt;');
    expect(selectors.infoModalBody.innerHTML).toBe('B &lt;i&gt;<br>line');
  });

  test('openMainIndexInfo escapes HTML content', async () => {
    jest.resetModules();
    const selectors = {
      infoModalTitle: document.createElement('div'),
      infoModalBody: document.createElement('div')
    };
    document.body.appendChild(selectors.infoModalTitle);
    document.body.appendChild(selectors.infoModalBody);
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'infoModal' }));

    jest.unstable_mockModule('../uiElements.js', () => ({
      selectors,
      trackerInfoTexts: {},
      detailedMetricInfoTexts: {},
      mainIndexInfoTexts: { m1: { title: 'Title <b>', text: 'Body <i>' } },
      loadInfoTexts: jest.fn(() => Promise.resolve())
    }));

    jest.unstable_mockModule('../app.js', () => ({
      fullDashboardData: {},
      activeTooltip: null,
      setActiveTooltip: jest.fn(),
      todaysMealCompletionStatus: {},
      todaysExtraMeals: [],
      currentIntakeMacros: {},
      planHasRecContent: false
    }));

    const { openMainIndexInfo } = await import('../uiHandlers.js');
    openMainIndexInfo('m1');

    expect(selectors.infoModalTitle.innerHTML).toBe('Title &lt;b&gt;');
    expect(selectors.infoModalBody.innerHTML).toBe('Body &lt;i&gt;');
  });
});

