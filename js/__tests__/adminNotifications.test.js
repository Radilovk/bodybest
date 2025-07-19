/** @jest-environment jsdom */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../clientProfile.js', () => ({ initClientProfile: jest.fn() }));
jest.unstable_mockModule('../templateLoader.js', () => ({
  loadTemplateInto: async (url, id) => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = '<div id="tmpl">ok</div><button id="savePlanBtn"></button><button id="saveProfileBtn"></button>';
    }
  }
}));

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
  localStorage.clear();
});

function setupFetchWithNotifications(clients, now) {
  global.fetch = jest.fn(url => {
    if (url.includes('listClients')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, clients }) });
    }
    if (url.includes('peekAdminQueries')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, queries: [{ message: 'q1' }] }) });
    }
    if (url.includes('peekClientReplies')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, replies: [] }) });
    }
    if (url.includes('getFeedbackMessages')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, feedback: [{ message: 'f1', timestamp: now }] }) });
    }
    if (url.includes('planStatus')) {
      return Promise.resolve({ ok: true, json: async () => ({ planStatus: 'ready' }) });
    }
    if (url.includes('profileTemplate.html')) {
      return Promise.resolve({
        ok: true,
        text: async () => '<button id="savePlanBtn"></button><button id="saveProfileBtn"></button><div id="tmpl">ok</div>'
      });
    }
    if (url.includes('getProfile') || url.includes('dashboard')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
  });
}

async function importAdmin() {
  admin = await import('../admin.js');
}

describe('admin notifications', () => {
  test('adds notification indicator for users with new items', async () => {
    const clients = [{ userId: 'u1', name: 'User 1' }];
    const now = new Date().toISOString();
    setupFetchWithNotifications(clients, now);
    await importAdmin();
    await admin.loadClients();
    await admin.checkForNotifications();
    expect(admin.unreadClients.has('u1')).toBe(true);
    expect(document.getElementById('notificationIndicator').classList.contains('hidden')).toBe(false);
    const dot = document.querySelector('#clientsList .notification-dot');
    expect(dot).not.toBeNull();
  });

  test('opening client clears notification indicator', async () => {
    const clients = [{ userId: 'u2', name: 'User 2' }];
    const now = new Date().toISOString();
    setupFetchWithNotifications(clients, now);
    await importAdmin();
    await admin.loadClients();
    admin.unreadClients.add('u2');
    admin.renderClients();
    await admin.showClient('u2');
    expect(document.getElementById('adminProfileContainer').innerHTML).toContain('ok');
    expect(admin.unreadClients.has('u2')).toBe(false);
    const dot = document.querySelector('#clientsList .notification-dot');
    expect(dot).toBeNull();
  });
});
