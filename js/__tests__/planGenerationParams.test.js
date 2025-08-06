/** @jest-environment jsdom */
import { jest } from '@jest/globals';
const startPlanGenerationMock = jest.fn();

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen', planStatus: '/status' }
}));
jest.unstable_mockModule('../planGeneration.js', () => ({
  startPlanGeneration: startPlanGenerationMock
}));

let regeneratePlan, setupPlanRegeneration;

beforeEach(async () => {
  jest.resetModules();
  startPlanGenerationMock.mockReset();
  startPlanGenerationMock.mockResolvedValue({ success: true });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, planStatus: 'ready' }) });
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
  ({ regeneratePlan } = await import('../questionnaireCore.js'));
  ({ setupPlanRegeneration } = await import('../planRegenerator.js'));
});

test('questionnaireCore и planRegenerator подават еднакви параметри', async () => {
  const params = { userId: 'u1', reason: 'причина', priorityGuidance: 'приоритет' };
  await regeneratePlan(params);
  const firstCall = startPlanGenerationMock.mock.calls[0][0];

  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  document.getElementById('regenReasonInput').value = 'причина';
  document.getElementById('priorityGuidanceInput').value = 'приоритет';
  document.getElementById('priorityGuidanceConfirm').click();
  await Promise.resolve();
  const secondCall = startPlanGenerationMock.mock.calls[1][0];

  expect(firstCall).toEqual(secondCall);
});
