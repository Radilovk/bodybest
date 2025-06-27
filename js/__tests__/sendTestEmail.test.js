/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let send;
let confirmSend;
let mod;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="testEmailForm">
      <input id="testEmailTo">
      <input id="testEmailSubject">
      <textarea id="testEmailBody"></textarea>
    </form>
    <button id="showStats"></button>
    <button id="sendQuery"></button>`;

  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { sendTestEmail: '/api/sendTestEmail' }
  }));

  mod = await import('../admin.js');
  send = mod.sendTestEmail;
  confirmSend = mod.confirmAndSendTestEmail;
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
