/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let submitHandler;

beforeEach(async () => {
  jest.resetModules();

  document.body.innerHTML = `
    <form id="aiConfigForm">
      <input id="planModel" />
      <textarea id="planPrompt"></textarea>
      <input id="planTokens" />
      <input id="planTemperature" />
      <input id="chatModel" />
      <textarea id="chatPrompt"></textarea>
      <input id="chatTokens" />
      <input id="chatTemperature" />
      <input id="modModel" />
      <textarea id="modPrompt"></textarea>
      <input id="modTokens" />
      <input id="modTemperature" />
      <input id="imageModel" />
      <input id="imageTokens" />
      <input id="imageTemperature" />
      <input id="adminToken" />
    </form>
    <button id="showStats"></button>
    <button id="sendQuery"></button>
  `;
  localStorage.clear();
  localStorage.setItem('adminToken', 'secret');

  const form = document.getElementById('aiConfigForm');
  form.addEventListener = (evt, handler) => {
    if (evt === 'submit') submitHandler = handler;
  };

  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: {
      setAiConfig: '/api/setAiConfig',
      getAiConfig: '/api/getAiConfig'
    }
  }));

  await import('../admin.js');
  document.getElementById('adminToken').value = 'newSecret';
});

afterEach(() => {
  global.fetch && global.fetch.mockRestore();
  localStorage.clear();
});

test('saveAiConfig sends updates payload with Authorization header', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, config: {} }) });

  document.getElementById('planModel').value = 'pm';
  document.getElementById('planPrompt').value = 'pp';
  document.getElementById('planTokens').value = '1';
  document.getElementById('planTemperature').value = '0.1';
  document.getElementById('chatModel').value = 'cm';
  document.getElementById('chatPrompt').value = 'cp';
  document.getElementById('chatTokens').value = '2';
  document.getElementById('chatTemperature').value = '0.2';
  document.getElementById('modModel').value = 'mm';
  document.getElementById('modPrompt').value = 'mp';
  document.getElementById('modTokens').value = '3';
  document.getElementById('modTemperature').value = '0.3';
  document.getElementById('imageModel').value = 'im';
  document.getElementById('imageTokens').value = '4';
  document.getElementById('imageTemperature').value = '0.4';

  await submitHandler(new Event('submit'));

  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('/api/setAiConfig');
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer newSecret');
  const body = JSON.parse(options.body);
  expect(body).toEqual({
    updates: {
      model_plan_generation: 'pm',
      model_chat: 'cm',
      model_principle_adjustment: 'mm',
      model_image_analysis: 'im',
      prompt_unified_plan_generation_v2: 'pp',
      plan_token_limit: '1',
      plan_temperature: '0.1',
      prompt_chat: 'cp',
      chat_token_limit: '2',
      chat_temperature: '0.2',
      prompt_plan_modification: 'mp',
      mod_token_limit: '3',
      mod_temperature: '0.3',
      image_token_limit: '4',
      image_temperature: '0.4'
    }
  });
  expect(localStorage.getItem('adminToken')).toBe('newSecret');
});
