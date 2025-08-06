/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const startPlanGenerationMock = jest.fn();

jest.unstable_mockModule('../clientProfile.js', () => ({ initClientProfile: jest.fn() }));
jest.unstable_mockModule('../templateLoader.js', () => ({ loadTemplateInto: async () => {} }));
jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen' }
}));
jest.unstable_mockModule('../planGeneration.js', () => ({
  startPlanGeneration: startPlanGenerationMock
}));

let admin;

beforeEach(async () => {
  jest.resetModules();
  startPlanGenerationMock.mockReset();
  startPlanGenerationMock.mockResolvedValue({ success: true });
  global.alert = jest.fn();
  document.body.innerHTML = `
    <ul id="clientsList"></ul>
    <span id="clientsCount"></span>
    <input id="clientSearch" />
    <select id="statusFilter"><option value="all">all</option></select>
    <button id="showStats"></button>
    <div id="regenProgress" class="hidden"></div>
  `;
  admin = await import('../admin.js');
});

test('показва бутон и стартира нов план', async () => {
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  await admin.renderClients();
  await Promise.resolve();
  const btn = document.querySelector('.regen-plan-btn');
  expect(btn).not.toBeNull();
  btn.click();
  await Promise.resolve();
  expect(startPlanGenerationMock).toHaveBeenCalledWith({ userId: 'u1' });
});
