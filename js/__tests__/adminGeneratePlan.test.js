/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const startPlanGenerationMock = jest.fn();

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: {
    checkPlanPrerequisites: '/check',
    regeneratePlan: '/regen',
    planStatus: '/status'
  }
}));
jest.unstable_mockModule('../planGeneration.js', () => ({
  startPlanGeneration: startPlanGenerationMock
}));

let initEditClient;
beforeEach(async () => {
  jest.resetModules();
  startPlanGenerationMock.mockReset();
  startPlanGenerationMock.mockResolvedValue({ success: true });
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ json: async () => ({ success: true, planStatus: 'pending' }) });
  global.alert = jest.fn();
  document.body.innerHTML = `
    <button id="generatePlan"></button>
    <button id="regeneratePlan"></button>
    <div id="regenProgress" class="hidden"></div>
  `;
  delete window.location;
  window.location = new URL('http://example.com/');
  ({ initEditClient } = await import('../editClient.js'));
});

test('активира "Създай план" и стартира генериране при липса на план', async () => {
  await initEditClient('u1');
  const btn = document.getElementById('generatePlan');
  expect(btn.disabled).toBe(false);
  btn.click();
  await Promise.resolve();
  expect(startPlanGenerationMock).toHaveBeenCalledWith({ userId: 'u1' });
});
