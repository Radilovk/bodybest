/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let setupRegistration;
let showMessage;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="reg"><input type="email"><input type="password"><input type="password"><button type="submit">Ok</button></form>
    <div id="msg"></div>`;
  jest.unstable_mockModule('../messageUtils.js', () => ({
    showMessage: jest.fn(),
    hideMessage: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({ workerBaseUrl: 'https://api' }));
  ({ setupRegistration } = await import('../register.js'));
  ({ showMessage } = await import('../messageUtils.js'));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
});

test('sends request on valid input', async () => {
  const form = document.getElementById('reg');
  form.querySelector('input[type="email"]').value = 'a@b.com';
  const pw = form.querySelectorAll('input[type="password"]');
  pw[0].value = '12345678';
  pw[1].value = '12345678';
  setupRegistration('#reg', '#msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(global.fetch).toHaveBeenCalledWith('https://api/api/register', expect.any(Object));
});

test('shows error on invalid email', async () => {
  const form = document.getElementById('reg');
  form.querySelector('input[type="email"]').value = 'bad';
  const pw = form.querySelectorAll('input[type="password"]');
  pw[0].value = '12345678';
  pw[1].value = '12345678';
  setupRegistration('#reg', '#msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(global.fetch).not.toHaveBeenCalled();
  const { showMessage } = await import('../messageUtils.js');
  expect(showMessage).toHaveBeenCalledWith(
    document.getElementById('msg'),
    'Невалиден e-mail адрес.',
    true
  );
});

test('shows message for empty fields', async () => {
  const form = document.getElementById('reg');
  setupRegistration('#reg', '#msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(showMessage).toHaveBeenCalledWith(document.getElementById('msg'), 'Моля, попълнете всички полета.', true);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('shows message for short password', async () => {
  const form = document.getElementById('reg');
  form.querySelector('input[type="email"]').value = 'a@b.com';
  const pw = form.querySelectorAll('input[type="password"]');
  pw[0].value = '123';
  pw[1].value = '123';
  setupRegistration('#reg', '#msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(showMessage).toHaveBeenCalledWith(document.getElementById('msg'), 'Паролата трябва да е поне 8 знака.', true);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('shows message for mismatched passwords', async () => {
  const form = document.getElementById('reg');
  form.querySelector('input[type="email"]').value = 'a@b.com';
  const pw = form.querySelectorAll('input[type="password"]');
  pw[0].value = '12345678';
  pw[1].value = '87654321';
  setupRegistration('#reg', '#msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(showMessage).toHaveBeenCalledWith(document.getElementById('msg'), 'Паролите не съвпадат.', true);
  expect(global.fetch).not.toHaveBeenCalled();
});
