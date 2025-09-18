import { jest } from '@jest/globals';
import { getCachedResource, clearResourceCache } from '../worker.js';

describe('resourceCache', () => {
  beforeEach(() => {
    clearResourceCache();
  });

  test('повторното четене не прави нов kv.get', async () => {
    const kv = { get: jest.fn(() => Promise.resolve('value-1')) };

    const first = await getCachedResource('prompt_chat', kv, 1000);
    const second = await getCachedResource('prompt_chat', kv, 1000);

    expect(first).toBe('value-1');
    expect(second).toBe('value-1');
    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  test('изчистването на кеша форсира нов kv.get', async () => {
    const kv = {
      get: jest
        .fn()
        .mockResolvedValueOnce('initial')
        .mockResolvedValueOnce('updated')
    };

    const first = await getCachedResource('model_chat', kv, 1000);
    clearResourceCache('model_chat');
    const second = await getCachedResource('model_chat', kv, 1000);

    expect(first).toBe('initial');
    expect(second).toBe('updated');
    expect(kv.get).toHaveBeenCalledTimes(2);
  });
});
