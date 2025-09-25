import { jest } from '@jest/globals';
import { selectors } from '../uiElements.js';
import {
  startAdminQueriesPolling,
  stopAdminQueriesPolling,
  setCurrentUserId,
  checkAdminQueries
} from '../app.js';
import { toggleChatWidget } from '../chat.js';

const originalFetch = global.fetch;
const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
let visibilityState = 'visible';

Object.defineProperty(document, 'visibilityState', {
  configurable: true,
  get: () => visibilityState
});

function setVisibility(state) {
  visibilityState = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('admin query polling behaviour', () => {
  beforeEach(() => {
    localStorage.clear();
    if (typeof sessionStorage !== 'undefined' && sessionStorage.clear) {
      sessionStorage.clear();
    }
    visibilityState = 'visible';
    selectors.chatMessages = document.createElement('div');
    selectors.chatWidget = document.createElement('div');
    selectors.chatFab = document.createElement('button');
    selectors.chatInput = document.createElement('input');
    selectors.chatFab.appendChild(document.createElement('span')).classList.add('assistant-icon');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, queries: [] })
    });
    setCurrentUserId('test-user');
    stopAdminQueriesPolling();
  });

  afterEach(() => {
    jest.useRealTimers();
    stopAdminQueriesPolling();
    setCurrentUserId(null);
    selectors.chatMessages = null;
    selectors.chatWidget = null;
    selectors.chatFab = null;
    selectors.chatInput = null;
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor);
    } else {
      delete document.visibilityState;
    }
    global.fetch = originalFetch;
  });

  test('по подразбиране планира проверка веднъж на 24 часа', () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    startAdminQueriesPolling();
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    const intervalValue = timeoutSpy.mock.calls[0][1];
    expect(intervalValue).toBe(24 * 60 * 60000);
  });

  test('не позволява интервал под 24 часа', () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    startAdminQueriesPolling({ intervalMinutes: 0.5 });
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    const intervalValue = timeoutSpy.mock.calls[0][1];
    expect(intervalValue).toBe(24 * 60 * 60000);
  });

  test('спира, когато разделът е скрит, и възобновява с незабавна проверка', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    startAdminQueriesPolling({ intervalMinutes: 60 });
    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    expect(clearSpy).toHaveBeenCalled();

    timeoutSpy.mockClear();
    global.fetch.mockClear();
    setVisibility('visible');
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(global.fetch).toHaveBeenCalled();
  });

  test('отварянето на чата прави незабавна проверка', async () => {
    global.fetch.mockClear();
    selectors.chatWidget.classList.remove('visible');
    toggleChatWidget();
    await Promise.resolve();
    expect(global.fetch).toHaveBeenCalled();
  });

  test('не изпраща повторна заявка преди да изтече интервалът (24 часа)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z'));
    await checkAdminQueries('test-user');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch.mockClear();
    await checkAdminQueries('test-user');
    expect(global.fetch).not.toHaveBeenCalled();

    jest.setSystemTime(new Date('2025-01-02T00:01:00Z'));
    await checkAdminQueries('test-user');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
