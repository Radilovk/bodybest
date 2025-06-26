/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let sendImage;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <input id="userId" value="u1">
    <textarea id="chat-input"></textarea>
    <input id="chat-image" type="file">
    <div id="chat-messages"></div>
    <button id="chat-send"></button>
    <button id="chat-clear"></button>
    <button id="chat-upload"></button>`;

  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { chat: '/chat', analyzeImage: '/img' },
    cloudflareAccountId: 'c'
  }));
  jest.unstable_mockModule('../utils.js', () => ({
    fileToDataURL: jest.fn(async () => 'data:image/png;base64,imgdata')
  }));

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, result: 'ok' })
  });

  const mod = await import('../assistantChat.js');
  sendImage = mod.sendImage;
});

test('adds image preview and updates status', async () => {
  const file = new File(['x'], 'a.png', { type: 'image/png' });
  await sendImage(file);
  const img = document.querySelector('#chat-messages .message.user.image img');
  const status = document.querySelector('#chat-messages .upload-status');
  expect(img).not.toBeNull();
  expect(status.textContent).toBe('Изпратено');
});
