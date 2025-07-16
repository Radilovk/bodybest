/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import { showMessage, hideMessage } from '../messageUtils.js';

describe('messageUtils', () => {
  test('showMessage sets text and success style', () => {
    const el = document.createElement('div');
    el.scrollIntoView = jest.fn();
    showMessage(el, 'done', false);
    expect(el.textContent).toBe('done');
    expect(el.className).toBe('message success animate-success');
    expect(el.style.display).toBe('block');
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  test('hideMessage clears element', () => {
    const el = document.createElement('div');
    el.scrollIntoView = jest.fn();
    showMessage(el, 'err');
    hideMessage(el);
    expect(el.textContent).toBe('');
    expect(el.style.display).toBe('none');
    expect(el.className).toBe('message');
  });
});
