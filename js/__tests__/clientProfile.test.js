/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const jsonrepairMockPath = new URL('../testHelpers/jsonrepairMock.js', import.meta.url).pathname;

let mod;

const originalFetch = global.fetch;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <input id="nameInput">
    <input id="fullnameInput">
    <input id="ageInput">
    <input id="phoneInput">
    <input id="emailInput">
    <input id="heightInput">
    <span id="userName"></span>
    <span id="userGoalHeader"></span>
    <span id="userHeightHeader"></span>
    <div id="demographicsInfo"></div>
    <div id="adminNotes"></div>
    <ul id="adminTags"></ul>
    <textarea id="planJson"></textarea>
    <button id="savePlanBtn"></button>
    <button id="saveProfileBtn"></button>
  `;
  window.history.pushState({}, '', '/?userId=1');

  const clientProfilePath = path.join(path.dirname(jsonrepairMockPath), '../clientProfile.js');
  const src = await fs.promises.readFile(clientProfilePath, 'utf8');
  const patched = src
    .replace("https://cdn.jsdelivr.net/npm/jsonrepair/+esm", jsonrepairMockPath)
    .replace('./config.js', '../config.js')
    .replace('./labelMap.js', '../labelMap.js')
    .replace('./planEditor.js', '../planEditor.js')
    + '\nexport { fillProfile, fillAdminNotes };';
  const tempPath = path.join(path.dirname(jsonrepairMockPath), 'clientProfile.patched.js');
  await fs.promises.writeFile(tempPath, patched);
  mod = await import(pathToFileURL(tempPath) + '?' + Date.now());

  global.fetch = jest.fn(url => {
    if (url.includes('getProfile')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          name: 'Ivan',
          fullname: 'Ivan Ivanov',
          age: 30,
          phone: '0888',
          email: 'ivan@example.com',
          height: 180
        })
      });
    }
    if (url.includes('dashboard')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          currentStatus: { adminNotes: 'Бележки', adminTags: ['t1', 't2'] },
          initialAnswers: { sleep: 'Добре', nested: { foo: 'bar' } },
          planData: {}
        })
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  const tempPath = path.join(path.dirname(jsonrepairMockPath), 'clientProfile.patched.js');
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
});

test('fillProfile populates form inputs', async () => {
  jest.unstable_mockModule('../labelMap.js', () => ({ labelMap: {}, statusMap: {} }));
  mod.fillProfile({
    name: 'Ivan',
    fullname: 'Ivan Ivanov',
    age: 30,
    phone: '0888',
    email: 'ivan@example.com',
    height: 180
  });
  expect(document.getElementById('nameInput').value).toBe('Ivan');
  expect(document.getElementById('fullnameInput').value).toBe('Ivan Ivanov');
  expect(document.getElementById('ageInput').value).toBe('30');
  expect(document.getElementById('phoneInput').value).toBe('0888');
  expect(document.getElementById('emailInput').value).toBe('ivan@example.com');
  expect(document.getElementById('heightInput').value).toBe('180');
});

test('admin notes render and initial answers fill blanks', async () => {
  jest.unstable_mockModule('../labelMap.js', () => ({ labelMap: {}, statusMap: {} }));
  mod.fillAdminNotes({ adminNotes: 'Бележки', adminTags: ['t1', 't2'] });
  mod.fillProfile({ age: 25 }, { name: 'Init', fullname: 'Init Name' });
  expect(document.getElementById('adminNotes').textContent).toBe('Бележки');
  const tagTexts = Array.from(document.querySelectorAll('#adminTags li')).map(li => li.textContent);
  expect(tagTexts).toEqual(['t1', 't2']);
  expect(document.getElementById('nameInput').value).toBe('Init');
  expect(document.getElementById('userName').textContent).toBe('Init');
  expect(document.getElementById('demographicsInfo').textContent).toContain('Init Name');
});
