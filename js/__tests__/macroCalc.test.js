/** @jest-environment jsdom */
import { __testExports } from '../editClient.js';

const { calcMacroGrams, calcMacroPercent } = __testExports;

test('calcMacroGrams calculates grams from calories and percent', () => {
  expect(calcMacroGrams(2000, 40, 4)).toBe(200);
});

test('calcMacroPercent calculates percent from grams', () => {
  expect(calcMacroPercent(2000, 200, 4)).toBe(40);
});
