/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let send;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="testQuestionnaireForm">
      <input id="testQEmail">
      <input id="testQFile" type="file">
      <textarea id="testQText"></textarea>
      <pre id="testQResult"></pre>
    </form>
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

test('sendTestQuestionnaire posts parsed JSON', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  const file = new File(['{"a":1}'], 'data.json', { type: 'application/json' });
  Object.defineProperty(document.getElementById('testQFile'), 'files', { value: [file] });
  document.getElementById('testQEmail').value = 'a@b.bg';
  await send();
  expect(global.fetch).toHaveBeenCalledWith('/api/submitQuestionnaire', expect.objectContaining({
    method: 'POST',
    headers: expect.any(Object),
    body: JSON.stringify({ a: 1, email: 'a@b.bg' })
  }));
});
