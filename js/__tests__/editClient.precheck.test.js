/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { checkPlanPrerequisites: '/check', regeneratePlan: '/regen' }
}));
jest.unstable_mockModule('../planRegenerator.js', () => ({
  setupPlanRegeneration: jest.fn()
}));

let initEditClient;
beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn();
  document.body.innerHTML = `
    <button id="regeneratePlan"></button>
    <div id="regenProgress" class="hidden"></div>
  `;
  // prevent auto-init via location search
  delete window.location;
  window.location = new URL('http://example.com/');
  ({ initEditClient } = await import('../editClient.js'));
});

test('деактивира бутона при липсващи предпоставки', async () => {
  fetch.mockResolvedValueOnce({
    json: async () => ({ ok: false, message: 'Липсват първоначални отговори.' })
  });
  await initEditClient('u1');
  const btn = document.getElementById('regeneratePlan');
  const msg = document.getElementById('regenProgress');
  expect(btn.disabled).toBe(true);
  expect(msg.textContent).toBe('Липсват първоначални отговори.');
  expect(msg.classList.contains('hidden')).toBe(false);
});
