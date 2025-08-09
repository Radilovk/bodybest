/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let admin;

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
    <div id="adminProfileContainer"></div>
  `;
  global.alert = jest.fn();
});

test('попълва липсващите полета от KV initial_answers', async () => {
  global.fetch = jest.fn(url => {
    if (url.includes('getProfile')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    if (url.includes('dashboard')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    if (url.includes('listUserKv')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          kv: {
            'u1_initial_answers': JSON.stringify({ name: 'Иван', email: 'ivan@example.com', phone: '0888' })
          }
        })
      });
    }
    if (url.includes('getAdminQueries') || url.includes('peekAdminQueries')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, queries: [] }) });
    }
    if (url.includes('getClientReplies') || url.includes('peekClientReplies')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, replies: [] }) });
    }
    if (url.includes('getFeedbackMessages')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, feedback: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
  });
  admin = await import('../admin.js');
  await admin.showClient('u1');
  expect(document.getElementById('profileName').value).toBe('Иван');
  expect(document.getElementById('profileEmail').value).toBe('ivan@example.com');
  expect(document.getElementById('profilePhone').value).toBe('0888');
  expect(document.getElementById('clientName').textContent).toBe('Иван');
});
