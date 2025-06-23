/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let sendMessage, sendImage;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <input id="userId" value="u1">
    <input id="chat-input">
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
    fileToBase64: jest.fn(async () => 'imgdata')
  }));

  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ message: 'CF AI error: Model Agreement required' })
  });

  const mod = await import('../assistantChat.js');
  sendMessage = mod.sendMessage;
  sendImage = mod.sendImage;
});

test('shows agreement hint on message error', async () => {
  document.getElementById('chat-input').value = 'hi';
  await sendMessage();
  expect(document.getElementById('chat-messages').textContent)
    .toContain('Моделът изисква потвърждение');
});

test('shows agreement hint on image error', async () => {
  const file = new File(['x'], 'a.png');
  await sendImage(file);
  expect(document.getElementById('chat-messages').textContent)
    .toContain('Моделът изисква потвърждение');
});
