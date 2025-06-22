/** @jest-environment jsdom */
import { jest } from '@jest/globals';

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="allowedFoodsContainer"></div>
    <div id="forbiddenFoodsContainer"></div>
    <div id="principlesSection"></div>
    <div id="hydrationContainer"></div>
    <div id="cookingMethodsContainer"></div>
  `;
  jest.unstable_mockModule('https://cdn.jsdelivr.net/npm/jsonrepair/+esm', () => ({ jsonrepair: jest.fn() }), { virtual: true });
});

test('fillAllowedFoods renders items', async () => {
  const { fillAllowedFoods } = await import('../clientProfile.js');
  fillAllowedFoods({ main_allowed_foods: ['Пиле', 'Риба'] });
  const html = document.getElementById('allowedFoodsContainer').innerHTML;
  expect(html).toContain('<li>Пиле</li>');
  expect(html).toContain('<li>Риба</li>');
});

test('fillPrinciples handles newline string', async () => {
  const { fillPrinciples } = await import('../clientProfile.js');
  fillPrinciples({ principlesWeek2_4: 'A\nB' });
  const html = document.getElementById('principlesSection').innerHTML;
  expect(html).toContain('A');
  expect(html).toContain('B');
});

test('fillHydration shows placeholder when no data', async () => {
  const { fillHydration } = await import('../clientProfile.js');
  fillHydration(null);
  expect(document.getElementById('hydrationContainer').textContent).toBe('Няма данни');
});

test('fillCookingMethods renders recommended text', async () => {
  const { fillCookingMethods } = await import('../clientProfile.js');
  fillCookingMethods({ recommended: ['Печене'], limit_or_avoid: ['Пържене'], fat_usage_tip: 'Малко мазнина' });
  const html = document.getElementById('cookingMethodsContainer').innerHTML;
  expect(html).toContain('Печене');
  expect(html).toContain('Пържене');
  expect(html).toContain('Малко мазнина');
});
