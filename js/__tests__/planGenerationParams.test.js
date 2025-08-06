/** @jest-environment jsdom */
import { jest } from '@jest/globals';
const startPlanGenerationMock = jest.fn();

jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen' }
}));
jest.unstable_mockModule('../planGeneration.js', () => ({
  startPlanGeneration: startPlanGenerationMock
}));

let regeneratePlan, setupPlanRegeneration;

beforeEach(async () => {
  jest.resetModules();
  startPlanGenerationMock.mockReset();
  startPlanGenerationMock.mockResolvedValue({ success: true });
  global.alert = jest.fn();
  document.body.innerHTML = `<button id="regen"></button>`;
  ({ regeneratePlan } = await import('../questionnaireCore.js'));
  ({ setupPlanRegeneration } = await import('../planRegenerator.js'));
});

test('questionnaireCore и planRegenerator подават еднакви параметри', async () => {
  await regeneratePlan({ userId: 'u1' });
  const firstCall = startPlanGenerationMock.mock.calls[0][0];

  const regenBtn = document.getElementById('regen');
  setupPlanRegeneration({ regenBtn, getUserId: () => 'u1' });
  regenBtn.click();
  await Promise.resolve();
  const secondCall = startPlanGenerationMock.mock.calls[1][0];

  expect(firstCall).toEqual(secondCall);
});
