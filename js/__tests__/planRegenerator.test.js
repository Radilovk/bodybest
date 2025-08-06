/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const startPlanGenerationMock = jest.fn();

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen' }
}));
jest.unstable_mockModule('../planGeneration.js', () => ({
  startPlanGeneration: startPlanGenerationMock
}));

let setupPlanRegeneration;

beforeEach(async () => {
  jest.resetModules();
  startPlanGenerationMock.mockReset();
  startPlanGenerationMock.mockResolvedValue({ success: true });
  global.alert = jest.fn();
  document.body.innerHTML = `
    <button id="regen"></button>
    <div id="regenProgress" class="hidden"></div>
  `;
  ({ setupPlanRegeneration } = await import('../planRegenerator.js'));
});

test('стартира нов план и управлява състоянието на бутона', async () => {
  const regenBtn = document.getElementById('regen');
  const regenProgress = document.getElementById('regenProgress');
  setupPlanRegeneration({ regenBtn, regenProgress, getUserId: () => 'u1' });
  regenBtn.click();
  expect(regenBtn.disabled).toBe(true);
  await Promise.resolve();
  expect(startPlanGenerationMock).toHaveBeenCalledWith({ userId: 'u1' });
  expect(regenBtn.disabled).toBe(false);
});
