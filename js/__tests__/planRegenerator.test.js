/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const startPlanGenerationMock = jest.fn();

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen', planLog: '/log', updateKv: '/kv' }
}));
jest.unstable_mockModule('../planGeneration.js', () => ({
  startPlanGeneration: startPlanGenerationMock
}));

let setupPlanRegeneration;

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  startPlanGenerationMock.mockReset();
  startPlanGenerationMock.mockResolvedValue({ success: true });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, logs: [], status: 'ready' }) });
  document.body.innerHTML = `
    <button id="regen"></button>
    <div id="regenProgress" class="hidden"></div>
    <div id="regenLogModal" aria-hidden="true">
      <div class="modal-body" id="regenLogBody"></div>
      <button id="regenLogClose"></button>
    </div>
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
  expect(startPlanGenerationMock).toHaveBeenCalledWith({ userId: 'u1', reason: 'причина', priorityGuidance: '' });
});

test('показва съобщение при липсващи prerequisites', async () => {
  startPlanGenerationMock.mockRejectedValueOnce(Object.assign(new Error('Липсват данни'), { precheck: true }));
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  await Promise.resolve();
  expect(regenProgress.textContent).toBe('Липсват данни');
});

test('деактивира и реактивира бутона', async () => {
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  await Promise.resolve();
  expect(regenBtn.disabled).toBe(true);
  jest.advanceTimersByTime(3000);
  await Promise.resolve();
  await Promise.resolve();
  expect(regenBtn.disabled).toBe(false);
});

test('отваря и затваря лог модала', async () => {
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  const modal = document.getElementById('regenLogModal');
  expect(modal.classList.contains('visible')).toBe(true);
  jest.advanceTimersByTime(3000);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(modal.classList.contains('visible')).toBe(false);
  expect(document.getElementById('regenLogBody').textContent).toBe('');
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

  expect(startPlanGenerationMock).toHaveBeenCalledTimes(1);
  expect(startPlanGenerationMock).toHaveBeenCalledWith({ userId: 'u2', reason: 'Админ регенерация', priorityGuidance: '' });
});

test('изпраща reason и priorityGuidance при отделни полета', async () => {
  document.body.innerHTML = `
    <button id="regen"></button>
    <div id="regenProgress" class="hidden"></div>
    <div id="regenLogModal" aria-hidden="true">
      <div class="modal-body" id="regenLogBody"></div>
      <button id="regenLogClose"></button>
    </div>
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
  expect(startPlanGenerationMock).toHaveBeenCalledWith({ userId: 'u1', reason: 'причина', priorityGuidance: 'приоритет' });
});
