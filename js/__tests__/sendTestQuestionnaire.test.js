/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let send;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="testQuestForm">
      <input id="testQuestUserId">
      <textarea id="testQuestData"></textarea>
      <pre id="testQuestResult"></pre>
    </form>
    <button id="showStats"></button>
    <button id="sendQuery"></button>`;

  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { testQuestionnaireAnalysis: '/api/testQuestionnaireAnalysis' }
  }));

  const mod = await import('../admin.js');
  send = mod.sendTestQuest;
});

afterEach(() => {
  global.fetch && global.fetch.mockRestore();
});

test('sendTestQuest posts provided data', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  document.getElementById('testQuestUserId').value = 'u1';
  document.getElementById('testQuestData').value = '{"a":1}';
  await send();
  expect(global.fetch).toHaveBeenCalledWith('/api/testQuestionnaireAnalysis', expect.objectContaining({
    method: 'POST',
    headers: expect.any(Object),
    body: JSON.stringify({ userId: 'u1', answers: { a: 1 } })
  }));
});
