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
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  const input = document.getElementById('priorityGuidanceInput');
  input.value = 'причина';
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u1', reason: 'причина', priorityGuidance: '' })
  }));
});

test('деактивира и реактивира бутона', async () => {
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  document.getElementById('priorityGuidanceConfirm').click();
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

  setupPlanRegeneration({ regenBtn: regenBtn1, regenProgress: regenProgress1, getUserId: () => 'u1' });
  setupPlanRegeneration({ regenBtn: regenBtn2, regenProgress: regenProgress2, getUserId: () => 'u2' });

  regenBtn1.click();
  regenBtn2.click();
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    body: JSON.stringify({ userId: 'u2', reason: 'Админ регенерация', priorityGuidance: '' })
  }));
});

test('изпраща reason и priorityGuidance при отделни полета', async () => {
  document.body.innerHTML = `
    <button id="regen"></button>
    <div id="regenProgress" class="hidden"></div>
    <div id="priorityGuidanceModal" aria-hidden="true">
      <textarea id="priorityGuidanceInput"></textarea>
      <textarea id="regenReasonInput"></textarea>
      <button id="priorityGuidanceConfirm"></button>
      <button id="priorityGuidanceCancel"></button>
      <button id="priorityGuidanceClose"></button>
    </div>
  `;
  ({ setupPlanRegeneration } = await import('../planRegenerator.js'));
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  document.getElementById('regenReasonInput').value = 'причина';
  document.getElementById('priorityGuidanceInput').value = 'приоритет';
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    body: JSON.stringify({ userId: 'u1', reason: 'причина', priorityGuidance: 'приоритет' })
  }));
});
