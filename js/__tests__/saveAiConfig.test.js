/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let submitHandler;

beforeEach(async () => {
  jest.resetModules();

  document.body.innerHTML = `
    <form id="aiConfigForm">
      <input id="planModel" />
      <input id="chatModel" />
      <input id="modModel" />
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
  document.getElementById('chatModel').value = 'cm';
  document.getElementById('modModel').value = 'mm';

  await submitHandler(new Event('submit'));

  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('/api/setAiConfig');
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer secret');
  const body = JSON.parse(options.body);
  expect(body).toEqual({
    updates: {
      model_plan_generation: 'pm',
      model_chat: 'cm',
      model_principle_adjustment: 'mm'
    }
  });
});
