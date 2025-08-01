/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { MacroAnalyticsCard } from '../macroAnalyticsCardComponent.js';

describe('MacroAnalyticsCard accessibility', () => {
  beforeEach(() => {
    global.Chart = jest.fn(() => ({
      setActiveElements: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn()
    }));
  });

  test('sets ARIA attributes and reacts to keyboard', () => {
    document.body.innerHTML = '<macro-analytics-card></macro-analytics-card>';
    const el = document.querySelector('macro-analytics-card');
    const target = {
      calories: 2000,
      protein_grams: 120,
      protein_percent: 40,
      carbs_grams: 200,
      carbs_percent: 40,
      fat_grams: 44,
      fat_percent: 20
    };
    const current = {
      calories: 900,
      protein_grams: 60,
      carbs_grams: 80,
      fat_grams: 30
    };
    el.setAttribute('target-data', JSON.stringify(target));
    el.setAttribute('current-data', JSON.stringify(current));
    const buttons = el.shadowRoot.querySelectorAll('.macro-metric[role="button"]');
    expect(buttons).toHaveLength(3);
    const proteinButton = buttons[0];
    expect(proteinButton.getAttribute('aria-pressed')).toBe('false');
    proteinButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(proteinButton.getAttribute('aria-pressed')).toBe('true');
  });
});
