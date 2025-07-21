/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let attachEmailPreview;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <textarea id="t"></textarea>
    <div id="p"></div>
    <button id="showStats"></button>`;
  ({ attachEmailPreview } = await import('../admin.js'));
});

test('updates preview with sanitized HTML', () => {
  const textarea = document.getElementById('t');
  const preview = document.getElementById('p');
  textarea.value = '<p onclick="x()">Hi</p>';
  attachEmailPreview(textarea, preview);
  expect(preview.innerHTML).toBe('<p>Hi</p>');

  textarea.value = '<img src="x" onerror="alert(1)">';
  textarea.dispatchEvent(new Event('input'));
  expect(preview.innerHTML).toBe('<img src="x">');
});
