/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let send;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="testQuestionnaireForm">
      <input id="testQEmail">
      <select id="testQClient"><option value="u1">User 1</option></select>
      <input id="testQUserId">
      <input id="testQFile" type="file">
      <textarea id="testQText"></textarea>
      <pre id="testQResult"></pre>
    </form>
    <a id="openTestQAnalysis" class="hidden"></a>
    <button id="showStats"></button>
    <button id="sendQuery"></button>`;

  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { submitQuestionnaire: '/api/submitQuestionnaire' }
  }));
  jest.unstable_mockModule('../utils.js', () => ({
    fileToText: jest.fn(async () => '{"a":1}'),
    fileToDataURL: jest.fn()
  }));

  const mod = await import('../admin.js');
  send = mod.sendTestQuestionnaire;
});

afterEach(() => {
  global.fetch && global.fetch.mockRestore();
});

test('sendTestQuestionnaire posts parsed JSON with userId', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  const file = new File(['{"a":1}'], 'data.json', { type: 'application/json' });
  Object.defineProperty(document.getElementById('testQFile'), 'files', { value: [file] });
  document.getElementById('testQEmail').value = 'a@b.bg';
  document.getElementById('testQClient').value = 'u1';
  await send();
  expect(global.fetch).toHaveBeenCalledWith('/api/submitQuestionnaire', expect.objectContaining({
    method: 'POST',
    headers: expect.any(Object),
    body: JSON.stringify({ a: 1, email: 'a@b.bg', userId: 'u1' })
  }));
});

test('response renders in #testQResult and link is shown', async () => {
  const responseData = { success: true, userId: 'u5' };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => responseData });
  document.getElementById('testQEmail').value = 'a@b.bg';
  document.getElementById('testQText').value = '{"a":1}';
  await send();
  const text = document.getElementById('testQResult').textContent;
  expect(text.startsWith(JSON.stringify(responseData, null, 2))).toBe(true);
  const link = document.getElementById('openTestQAnalysis');
  expect(link.classList.contains('hidden')).toBe(false);
  expect(link.getAttribute('href')).toBe('analysis.html?userId=u5');
});
