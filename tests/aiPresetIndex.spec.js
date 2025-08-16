import { jest } from '@jest/globals';
import { handleSaveAiPreset, handleListAiPresets, resetAiPresetIndexCache } from '../worker.js';

describe('ai preset index', () => {
  beforeEach(() => resetAiPresetIndexCache());
  test('handleSaveAiPreset добавя нов пресет в индекса', async () => {
    const store = {};
    const env = {
      RESOURCES_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
        list: jest.fn(() => Promise.resolve({ keys: [] }))
      },
      WORKER_ADMIN_TOKEN: 't'
    };
    const request = {
      headers: new Map([['Authorization', 'Bearer t']]),
      json: async () => ({ name: 'p1', config: { a: 1 } })
    };
    await handleSaveAiPreset(request, env);
    expect(JSON.parse(store.aiPreset_index)).toEqual(['p1']);
    await handleSaveAiPreset(request, env);
    expect(JSON.parse(store.aiPreset_index)).toEqual(['p1']);
  });

  test('handleListAiPresets използва индекса, когато е наличен', async () => {
    const store = { aiPreset_index: JSON.stringify(['a']) };
    const env = {
      RESOURCES_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
        list: jest.fn(() => Promise.resolve({ keys: [] }))
      }
    };
    const res = await handleListAiPresets({}, env);
    expect(res.presets).toEqual(['a']);
    expect(env.RESOURCES_KV.list).not.toHaveBeenCalled();
  });

  test('handleListAiPresets регенерира индекса при липса', async () => {
    const store = {};
    const env = {
      RESOURCES_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
        list: jest.fn(() => Promise.resolve({ keys: [{ name: 'aiPreset_a' }, { name: 'aiPreset_b' }] }))
      }
    };
    const res = await handleListAiPresets({}, env);
    expect(res.presets).toEqual(['a', 'b']);
    expect(JSON.parse(store.aiPreset_index)).toEqual(['a', 'b']);
    expect(env.RESOURCES_KV.list).toHaveBeenCalledTimes(1);
  });
});
