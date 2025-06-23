/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let setupRegistration;

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
  const utils = await import('../messageUtils.js');
  setupRegistration('#reg', '#msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(utils.showMessage).toHaveBeenCalled();
});
