/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleAdaptiveQuizBtnClick;

beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
  ({ handleAdaptiveQuizBtnClick } = await import('../eventListeners.js'));
});

describe('handleAdaptiveQuizBtnClick', () => {
  test('does not trigger when quiz modal is visible', () => {
    document.body.innerHTML = `<div id="adaptiveQuizWrapper" class="visible"></div>`;
    const fn = jest.fn();
    handleAdaptiveQuizBtnClick(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  test('triggers when quiz modal is hidden', () => {
    document.body.innerHTML = `<div id="adaptiveQuizWrapper"></div>`;
    const fn = jest.fn();
    handleAdaptiveQuizBtnClick(fn);
    expect(fn).toHaveBeenCalled();
  });
});
