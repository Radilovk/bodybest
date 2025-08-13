import { jest } from '@jest/globals';
import { handleSaveAiPreset, handleListAiPresets, handleGetAiPreset } from '../../worker.js';

function createStore(initial = {}) {
  const store = { ...initial };
  return {
    list: jest.fn(async ({ prefix } = {}) => ({ keys: Object.keys(store).filter(k => !prefix || k.startsWith(prefix)).map(name => ({ name })) })),
    get: jest.fn(async key => store[key] || null),
    put: jest.fn(async (key, value) => { store[key] = String(value); }),
    _store: store
  };
}

test('save preset and retrieve it', async () => {
  const kv = createStore();
  const env = { RESOURCES_KV: kv, WORKER_ADMIN_TOKEN: 'secret' };
  const reqSave = {
    headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
    json: async () => ({ name: 'test', config: { model_plan_generation: 'm1' } })
  };
  const saveRes = await handleSaveAiPreset(reqSave, env);
  expect(saveRes.success).toBe(true);
  expect(kv._store['aiPreset_test']).toBe(JSON.stringify({ model_plan_generation: 'm1' }));
  expect(JSON.parse(kv._store.aiPresets_index)).toContain('aiPreset_test');

  const listRes = await handleListAiPresets({}, env);
  expect(listRes.success).toBe(true);
  expect(listRes.presets).toContain('test');

  const getRes = await handleGetAiPreset({ url: 'https://x/api/getAiPreset?name=test' }, env);
  expect(getRes.success).toBe(true);
  expect(getRes.config.model_plan_generation).toBe('m1');
});
