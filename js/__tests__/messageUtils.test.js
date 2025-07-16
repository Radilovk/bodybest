/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import { showMessage, hideMessage } from '../messageUtils.js';

test('showMessage sets text and styles', () => {
  const el = document.createElement('div');
  el.scrollIntoView = jest.fn();
  showMessage(el, 'ok', false);
  expect(el.textContent).toBe('ok');
  expect(el.className).toBe('message success animate-success');
  expect(el.style.display).toBe('block');
});

test('hideMessage clears element', () => {
  const el = document.createElement('div');
  el.scrollIntoView = jest.fn();
  showMessage(el, 'err');
  hideMessage(el);
  expect(el.textContent).toBe('');
  expect(el.className).toBe('message');
  expect(el.style.display).toBe('none');
});
