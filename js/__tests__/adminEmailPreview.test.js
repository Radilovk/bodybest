/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let attachEmailPreview, attachSubjectPreview;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <textarea id="t"></textarea>
    <div id="p"></div>
    <input id="s">
    <div id="sp"></div>
    <button id="showStats"></button>`;
  ({ attachEmailPreview, attachSubjectPreview } = await import('../admin.js'));
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

test('subject preview replaces placeholders', () => {
  const input = document.getElementById('s');
  const preview = document.getElementById('sp');
  input.value = 'Hi {{name}}';
  attachSubjectPreview(input, preview, { name: 'Иван' });
  expect(preview.textContent).toBe('Hi Иван');
  input.value = 'Bye {{name}}';
  input.dispatchEvent(new Event('input'));
  expect(preview.textContent).toBe('Bye Иван');
});
