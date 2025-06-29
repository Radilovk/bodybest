/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let send;
let confirmSend;
let sendQuery;
let mod;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="testEmailForm">
      <input id="testEmailTo">
      <input id="testEmailSubject">
      <textarea id="testEmailBody"></textarea>
    </form>
    <textarea id="newQueryText"></textarea>
    <ul id="queriesList"></ul>
    <button id="showStats"></button>
    <button id="sendQuery"></button>`;

  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: {
      sendTestEmail: '/api/sendTestEmail',
      addAdminQuery: '/api/addAdminQuery'
    }
  }));

  mod = await import('../admin.js');
  send = mod.sendTestEmail;
  confirmSend = mod.confirmAndSendTestEmail;
  sendQuery = mod.sendAdminQuery;
});

afterEach(() => {
  global.fetch && global.fetch.mockRestore();
});

test('sendTestEmail posts form data', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  document.getElementById('testEmailTo').value = 'a@b.bg';
  document.getElementById('testEmailSubject').value = 'Sub';
  document.getElementById('testEmailBody').value = 'Body';
  await send();
  expect(global.fetch).toHaveBeenCalledWith('/api/sendTestEmail', expect.objectContaining({
    method: 'POST',
    headers: expect.any(Object),
    body: JSON.stringify({ recipient: 'a@b.bg', subject: 'Sub', body: 'Body' })
  }));
});

test('alert shown on error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, message: 'err' }) });
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  document.getElementById('testEmailTo').value = 'x';
  document.getElementById('testEmailSubject').value = 's';
  document.getElementById('testEmailBody').value = 'b';
  await send();
  expect(alertSpy).toHaveBeenCalled();
  alertSpy.mockRestore();
});

test('confirmation wrapper calls sendTestEmail when confirmed', async () => {
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  document.getElementById('testEmailTo').value = 'a@b.bg';
  document.getElementById('testEmailSubject').value = 'Sub';
  document.getElementById('testEmailBody').value = 'Body';
  await confirmSend();
  expect(confirmSpy).toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('confirmation wrapper aborts when cancelled', async () => {
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
  global.fetch = jest.fn();
  document.getElementById('testEmailTo').value = 'a@b.bg';
  document.getElementById('testEmailSubject').value = 'Sub';
  document.getElementById('testEmailBody').value = 'Body';
  await confirmSend();
  expect(confirmSpy).toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('logs snippet when response is not JSON', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'text/plain' },
    text: async () => 'plain text error body'
  });
  const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  document.getElementById('testEmailTo').value = 'a@b.bg';
  document.getElementById('testEmailSubject').value = 'Sub';
  document.getElementById('testEmailBody').value = 'Body';
  await send();
  expect(logSpy).toHaveBeenCalledWith(
    'Non-JSON response from sendTestEmail:',
    'plain text error body'
  );
  expect(alertSpy).toHaveBeenCalled();
  logSpy.mockRestore();
  alertSpy.mockRestore();
});

test('sendAdminQuery posts message and refreshes list on success', async () => {
  mod.setCurrentUserId('u123');
  document.getElementById('newQueryText').value = 'Hi there';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true })
  });
  const result = await sendQuery();
  expect(global.fetch).toHaveBeenCalledWith('/api/addAdminQuery', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u123', message: 'Hi there' })
  }));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(document.getElementById('newQueryText').value).toBe('');
  expect(result).toBe(true);
});

test('sendAdminQuery alerts on failure', async () => {
  mod.setCurrentUserId('u123');
  document.getElementById('newQueryText').value = 'Oops';
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ success: false, message: 'err' })
  });
  const result = await sendQuery();
  expect(alertSpy).toHaveBeenCalledWith('err');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(result).toBe(false);
  alertSpy.mockRestore();
});
