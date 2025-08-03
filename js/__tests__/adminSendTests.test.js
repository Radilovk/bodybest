/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('sendTestEmail and admin query', () => {
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
      body: JSON.stringify({ recipient: 'a@b.bg', subject: 'Sub', body: 'Body', fromName: '' })
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
});

describe('sendTestImage', () => {
  let send;
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <form id="testImageForm">
        <input id="testImageFile" type="file">
        <input id="testImagePrompt">
        <pre id="testImageResult"></pre>
      </form>
      <button id="showStats"></button>
      <button id="sendQuery"></button>`;
    jest.unstable_mockModule('../config.js', () => ({
      apiEndpoints: { analyzeImage: '/api/analyzeImage' }
    }));
    jest.unstable_mockModule('../utils.js', () => ({
      fileToDataURL: jest.fn(async () => 'data:image/png;base64,imgdata'),
      fileToText: jest.fn(),
      applyProgressFill: jest.fn()
    }));
    const mod = await import('../admin.js');
    send = mod.sendTestImage;
  });
  afterEach(() => {
    global.fetch && global.fetch.mockRestore();
  });

  test('sendTestImage posts selected file', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, result: 'ok' }) });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(document.getElementById('testImageFile'), 'files', { value: [file] });
    document.getElementById('testImagePrompt').value = 'desc';
    await send();
    expect(global.fetch).toHaveBeenCalledWith('/api/analyzeImage', expect.objectContaining({
      method: 'POST',
      headers: expect.any(Object),
      body: JSON.stringify({ userId: 'admin-test', image: 'data:image/png;base64,imgdata', prompt: 'desc' })
    }));
  });
});

describe('sendTestQuestionnaire', () => {
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
      apiEndpoints: { submitQuestionnaire: '/api/submitQuestionnaire', reAnalyzeQuestionnaire: '/api/reAnalyzeQuestionnaire' }
    }));
    jest.unstable_mockModule('../utils.js', () => ({
      fileToText: jest.fn(async () => '{"a":1}'),
      fileToDataURL: jest.fn(),
      applyProgressFill: jest.fn()
    }));
    const mod = await import('../admin.js');
    send = mod.sendTestQuestionnaire;
  });
  afterEach(() => {
    global.fetch && global.fetch.mockRestore();
  });

  test('sendTestQuestionnaire posts parsed JSON with userId only', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const file = new File(['{"a":1}'], 'data.json', { type: 'application/json' });
    Object.defineProperty(document.getElementById('testQFile'), 'files', { value: [file] });
    document.getElementById('testQEmail').value = '';
    document.getElementById('testQClient').value = 'u1';
    await send();
    expect(global.fetch).toHaveBeenCalledWith('/api/submitQuestionnaire', expect.objectContaining({
      method: 'POST',
      headers: expect.any(Object),
      body: JSON.stringify({ a: 1, email: '', userId: 'u1' })
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
    expect(link.getAttribute('href')).toBe('https://radilovk.github.io/bodybest/reganalize/analyze.html?userId=u5');
  });

  test('calls reAnalyzeQuestionnaire when no JSON is provided', async () => {
    const data = { success: true, userId: 'u1' };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data });
    document.getElementById('testQClient').value = 'u1';
    await send();
    expect(global.fetch).toHaveBeenCalledWith('/api/reAnalyzeQuestionnaire', expect.any(Object));
    const link = document.getElementById('openTestQAnalysis');
    expect(link.classList.contains('hidden')).toBe(false);
    expect(link.getAttribute('href')).toBe('https://radilovk.github.io/bodybest/reganalize/analyze.html?userId=u1');
  });
});
