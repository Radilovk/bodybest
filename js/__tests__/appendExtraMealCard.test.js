/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('appendExtraMealCard', () => {
  test('вмъква картата преди първата невършена', async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <ul id="dailyMealList">
        <li class="meal-card completed"></li>
        <li class="meal-card"></li>
        <li class="meal-card"></li>
      </ul>
    `;
    const selectors = { dailyMealList: document.getElementById('dailyMealList') };
    jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {}, mainIndexInfoTexts: {}, initializeSelectors: jest.fn(), loadInfoTexts: jest.fn() }));
    const { appendExtraMealCard } = await import('../populateUI.js');

    appendExtraMealCard('Тест', '100');

    const list = selectors.dailyMealList;
    expect(list.children).toHaveLength(4);
    expect(list.children[1].classList.contains('extra-meal')).toBe(true);
  });

  test('добавя картата накрая, ако всички са изпълнени', async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <ul id="dailyMealList">
        <li class="meal-card completed"></li>
        <li class="meal-card completed"></li>
      </ul>
    `;
    const selectors = { dailyMealList: document.getElementById('dailyMealList') };
    jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {}, mainIndexInfoTexts: {}, initializeSelectors: jest.fn(), loadInfoTexts: jest.fn() }));
    const { appendExtraMealCard } = await import('../populateUI.js');

    appendExtraMealCard('Тест', '100');

    const list = selectors.dailyMealList;
    expect(list.children).toHaveLength(3);
    expect(list.lastElementChild.classList.contains('extra-meal')).toBe(true);
  });
});
