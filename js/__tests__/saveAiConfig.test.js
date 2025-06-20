/** @jest-environment jsdom */
import { jest } from '@jest/globals';

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="notificationIndicator" class="hidden"></div>
    <ul id="clientsList"></ul>
    <span id="clientsCount"></span>
    <input id="clientSearch" />
    <select id="statusFilter"><option value="all">all</option></select>
    <button id="showStats"></button>
    <button id="sendQuery"></button>
    <div id="clientDetails" class="hidden"></div>
    <h2 id="clientName"></h2>
    <input id="profileName" />
    <input id="profileEmail" />
    <input id="profilePhone" />
    <ul id="queriesList"></ul>
    <ul id="clientRepliesList"></ul>
    <ul id="feedbackList"></ul>
    <pre id="dashboardData"></pre>
    <form id="aiConfigForm">
      <input id="planToken" />
      <input id="planModel" />
      <input id="chatToken" />
      <input id="chatModel" />
      <input id="modToken" />
      <input id="modModel" />
      <button type="submit">Save</button>
    </form>
  `;
  window.WORKER_ADMIN_TOKEN = 'admintoken';
  localStorage.clear();
});

afterEach(() => {
  delete window.WORKER_ADMIN_TOKEN;
  if (global.fetch) {
    global.fetch.mockRestore();
  }
});

test('saveAiConfig sends updates with Authorization header', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true })
  });
  await import('../admin.js');
  const form = document.getElementById('aiConfigForm');
  document.getElementById('planToken').value = 'pt';
  document.getElementById('planModel').value = 'pm';
  document.getElementById('chatToken').value = 'ct';
  document.getElementById('chatModel').value = 'cm';
  document.getElementById('modToken').value = 'mt';
  document.getElementById('modModel').value = 'mm';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [, options] = global.fetch.mock.calls[0];
  expect(JSON.parse(options.body)).toEqual({ updates: {
    planToken: 'pt',
    planModel: 'pm',
    chatToken: 'ct',
    chatModel: 'cm',
    modToken: 'mt',
    modModel: 'mm'
  }});
  expect(options.headers.Authorization).toBe('Bearer admintoken');
});
