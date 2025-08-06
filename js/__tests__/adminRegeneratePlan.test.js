/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../clientProfile.js', () => ({ initClientProfile: jest.fn() }));
jest.unstable_mockModule('../templateLoader.js', () => ({
  loadTemplateInto: async () => {}
}));
jest.unstable_mockModule('../config.js', () => ({
  apiEndpoints: { regeneratePlan: '/regen' }
}));

let admin;

beforeEach(async () => {
  global.fetch = jest.fn();
  jest.resetModules();
  document.body.innerHTML = `
    <ul id="clientsList"></ul>
    <span id="clientsCount"></span>
    <input id="clientSearch" />
    <select id="statusFilter"><option value="all">all</option></select>
    <button id="showStats"></button>
  `;
  admin = await import('../admin.js');
});

test('показва бутон за нов план при статус "в процес"', () => {
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  admin.renderClients();
  const btn = document.querySelector('.regen-plan-btn');
  expect(btn).not.toBeNull();
  expect(btn.textContent).toContain('Нов план');
});

test('праща reason при клик върху бутона', async () => {
  admin.allClients.length = 0;
  admin.allClients.push({ userId: 'u1', name: 'Test', status: 'processing', tags: [] });
  admin.renderClients();
  const btn = document.querySelector('.regen-plan-btn');
  await btn.click();
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledWith('/regen', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u1', reason: 'Админ регенерация' })
  }));
});
