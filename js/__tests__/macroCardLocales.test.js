/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('loadLocale', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('falls back to bg and caches result', async () => {
    const fetchMock = jest.fn((url) => {
      if (url.includes('macroCard.de.json')) return Promise.resolve({ ok: false });
      if (url.includes('macroCard.bg.json')) return Promise.resolve({ ok: true, json: async () => ({ title: 'bg' }) });
      return Promise.resolve({ ok: true, json: async () => ({ title: 'en' }) });
    });
    global.fetch = fetchMock;
    const { loadLocale } = await import('../macroCardLocales.js');
    const first = await loadLocale('de');
    expect(first).toEqual({ title: 'bg' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = await loadLocale('de');
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
