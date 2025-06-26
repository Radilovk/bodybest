/** @jest-environment jsdom */
import { jest } from '@jest/globals';

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
    fileToDataURL: jest.fn(async () => 'data:image/png;base64,imgdata')
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
