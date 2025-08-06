/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen', planStatus: '/status' }
}));

let setupPlanRegeneration;

beforeEach(async () => {
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
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u1', priorityGuidance: '', reason: 'Админ регенерация' })
  }));
});
