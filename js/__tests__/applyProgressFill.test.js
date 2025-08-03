/** @jest-environment jsdom */
import { applyProgressFill, getProgressColor } from '../utils.js';

test('applyProgressFill задава цвят и ширина', () => {
  const el = document.createElement('div');
  applyProgressFill(el, 55);
  expect(el.style.getPropertyValue('--progress-color')).toBe(getProgressColor(55));
  expect(el.style.width).toBe('55%');
});
