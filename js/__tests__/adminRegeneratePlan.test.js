/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../clientProfile.js', () => ({ initClientProfile: jest.fn() }));
jest.unstable_mockModule('../templateLoader.js', () => ({
  loadTemplateInto: async () => {}
}));
jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen', checkPlanPrerequisites: '/check', planStatus: '/status' }
}));

let admin;
let showClient;

beforeEach(async () => {
  global.fetch = jest.fn();
  jest.resetModules();
  jest.useFakeTimers();
  document.body.innerHTML = `
    <ul id="clientsList"></ul>
    <span id="clientsCount"></span>
    <input id="clientSearch" />
    <select id="statusFilter"><option value="all">all</option></select>
    <button id="showStats"></button>
    <div id="priorityGuidanceModal" aria-hidden="true">
      <textarea id="priorityGuidanceInput"></textarea>
      <button id="priorityGuidanceConfirm"></button>
      <button id="priorityGuidanceCancel"></button>
      <button id="priorityGuidanceClose"></button>
    </div>
    <div id="clientDetails" class="hidden"></div>
    <h2 id="clientName"></h2>
    <button id="regeneratePlan"></button>
    <div id="regenProgress"></div>
    <div id="msg"></div>
  `;
  admin = await import('../admin.js');
  showClient = admin.showClient;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('показва бутон за нов план при статус "в процес"', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, ok: true }) });
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  await admin.renderClients();
  const btn = document.querySelector('.regen-plan-btn');
  expect(btn).not.toBeNull();
  expect(btn.textContent).toContain('Нов план');
});

test('не показва бутон при липсващи prerequisites', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, ok: false }) });
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  await admin.renderClients();
  const btn = document.querySelector('.regen-plan-btn');
  const msg = document.querySelector('.regen-missing-msg');
  expect(btn).toBeNull();
  expect(msg.textContent).toContain('липсват данни');
});

test('праща reason при клик върху бутона', async () => {
  global.fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, ok: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    .mockResolvedValue({ ok: true, json: async () => ({ success: true, planStatus: 'ready' }) });
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  await admin.renderClients();
  const btn = document.querySelector('.regen-plan-btn');
  btn.click();
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  jest.advanceTimersByTime(3000);
  await Promise.resolve();
  expect(fetch).toHaveBeenNthCalledWith(2, '/regen', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u1', reason: 'Админ регенерация', priorityGuidance: '' })
  }));
});

test('деактивира бутона при липсващ email', async () => {
  global.fetch = jest.fn(url => {
    if (url.includes('/check')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, ok: false, missing: ['email'], message: 'Липсват: email' })
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
  });
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'ready', tags: [] });
  await showClient('u1');
  expect(document.body.textContent.toLowerCase()).toContain('липсват: email');
  expect(document.getElementById('regeneratePlan').disabled).toBe(true);
});
