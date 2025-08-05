/** @jest-environment jsdom */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../clientProfile.js', () => ({ initClientProfile: jest.fn() }));
jest.unstable_mockModule('../templateLoader.js', () => ({
  loadTemplateInto: async () => {}
}));

let admin;

beforeEach(async () => {
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
