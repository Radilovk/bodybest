/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../clientProfile.js', () => ({ initClientProfile: jest.fn() }));
jest.unstable_mockModule('../templateLoader.js', () => ({
  loadTemplateInto: async () => {}
}));
jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen', checkPlanPrerequisites: '/check', planLog: '/log', updateKv: '/kv' }
}));

let admin;

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
    <div id="regenLogModal" aria-hidden="true">
      <div class="modal-body" id="regenLogBody"></div>
      <button id="regenLogClose"></button>
    </div>
    <div id="regenProgress" class="hidden"></div>
  `;
  admin = await import('../admin.js');
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
  await Promise.resolve();
  const btn = document.querySelector('.regen-plan-btn');
  expect(btn).not.toBeNull();
  expect(btn.textContent).toContain('Нов план');
});

test('не показва бутон при липсващи prerequisites', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, ok: false }) });
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  await admin.renderClients();
  await Promise.resolve();
  const btn = document.querySelector('.regen-plan-btn');
  const msg = document.querySelector('.regen-missing-msg');
  expect(btn).toBeNull();
  expect(msg.textContent).toContain('липсват данни');
});

test('праща reason при клик върху бутона и управлява лог модала', async () => {
  global.fetch.mockImplementation((url) => {
    if (url.startsWith('/check')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, ok: true }) });
    }
    if (url === '/regen') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    if (url.startsWith('/log')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, logs: [], status: 'ready' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
  });
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  await admin.renderClients();
  await Promise.resolve();
  const btn = document.querySelector('.regen-plan-btn');
  btn.click();
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  const modal = document.getElementById('regenLogModal');
  expect(modal.classList.contains('visible')).toBe(true);
  await jest.advanceTimersByTimeAsync(3000);
  expect(modal.classList.contains('visible')).toBe(false);
  expect(document.getElementById('regenLogBody').textContent).toBe('');
  expect(fetch).toHaveBeenNthCalledWith(2, '/regen', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u1', reason: 'Админ регенерация', priorityGuidance: '' })
  }));
});
