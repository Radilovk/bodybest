/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen', planStatus: '/status' }
}));

let setupPlanRegeneration;

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, planStatus: 'ready' }) });
  document.body.innerHTML = `
    <button id="regen"></button>
    <div id="regenProgress" class="hidden"></div>
    <div id="priorityGuidanceModal" aria-hidden="true">
      <textarea id="priorityGuidanceInput"></textarea>
      <button id="priorityGuidanceConfirm"></button>
      <button id="priorityGuidanceCancel"></button>
      <button id="priorityGuidanceClose"></button>
    </div>
  `;
  ({ setupPlanRegeneration } = await import('../planRegenerator.js'));
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('изпраща reason при потвърждение', async () => {
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  const modal = document.getElementById('priorityGuidanceModal');
  const input = document.getElementById('priorityGuidanceInput');
  const confirm = document.getElementById('priorityGuidanceConfirm');
  const cancel = document.getElementById('priorityGuidanceCancel');
  const closeBtn = document.getElementById('priorityGuidanceClose');
  setupPlanRegeneration({
    regenBtn,
    regenProgress,
    getUserId: () => 'u1',
    modal,
    input,
    confirm,
    cancel,
    closeBtn
  });
  regenBtn.click();
  input.value = 'причина';
  confirm.click();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u1', reason: 'причина' })
  }));
});

test('деактивира и реактивира бутона', async () => {
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  const modal = document.getElementById('priorityGuidanceModal');
  const input = document.getElementById('priorityGuidanceInput');
  const confirm = document.getElementById('priorityGuidanceConfirm');
  const cancel = document.getElementById('priorityGuidanceCancel');
  const closeBtn = document.getElementById('priorityGuidanceClose');
  setupPlanRegeneration({
    regenBtn,
    regenProgress,
    getUserId: () => 'u1',
    modal,
    input,
    confirm,
    cancel,
    closeBtn
  });
  regenBtn.click();
  confirm.click();
  await Promise.resolve();
  expect(regenBtn.disabled).toBe(true);
  jest.advanceTimersByTime(3000);
  await Promise.resolve();
  await Promise.resolve();
  expect(regenBtn.disabled).toBe(false);
});

test('изпраща заявка само за последно избран userId', async () => {
  const regenBtn1 = document.getElementById('regen');
  const regenProgress1 = document.getElementById('regenProgress');
  const regenBtn2 = document.createElement('button');
  regenBtn2.id = 'regen2';
  document.body.appendChild(regenBtn2);
  const regenProgress2 = document.createElement('div');
  regenProgress2.id = 'regenProgress2';
  regenProgress2.classList.add('hidden');
  document.body.appendChild(regenProgress2);
  const modal = document.getElementById('priorityGuidanceModal');
  const input = document.getElementById('priorityGuidanceInput');
  const confirm = document.getElementById('priorityGuidanceConfirm');
  const cancel = document.getElementById('priorityGuidanceCancel');
  const closeBtn = document.getElementById('priorityGuidanceClose');

  setupPlanRegeneration({
    regenBtn: regenBtn1,
    regenProgress: regenProgress1,
    getUserId: () => 'u1',
    modal,
    input,
    confirm,
    cancel,
    closeBtn
  });
  setupPlanRegeneration({
    regenBtn: regenBtn2,
    regenProgress: regenProgress2,
    getUserId: () => 'u2',
    modal,
    input,
    confirm,
    cancel,
    closeBtn
  });

  regenBtn1.click();
  regenBtn2.click();
  confirm.click();
  await Promise.resolve();

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    body: JSON.stringify({ userId: 'u2', reason: 'Админ регенерация' })
  }));
});
