import { jest } from '@jest/globals';
import {
  handleContactFormRequest,
  handleGetContactRequestsRequest,
  handleValidateIndexesRequest
} from '../../worker.js';

function createStore(initial = {}) {
  const store = { ...initial };
  return {
    list: jest.fn(async ({ prefix } = {}) => ({
      keys: Object.keys(store)
        .filter(k => !prefix || k.startsWith(prefix))
        .map(name => ({ name }))
    })),
    get: jest.fn(async key => store[key] || null),
    put: jest.fn(async (key, value) => { store[key] = String(value); }),
    _store: store
  };
}

test('saves contact request and lists via index', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const kv = createStore();
  const env = {
    CONTACT_REQUESTS_KV: kv,
    RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) },
    USER_METADATA_KV: { get: jest.fn().mockResolvedValue(null), put: jest.fn() },
    WORKER_ADMIN_TOKEN: 'secret',
    MAIL_PHP_URL: 'https://php.example.com/mailer.php'
  };
  const reqSave = {
    headers: { get: h => (h === 'CF-Connecting-IP' ? '1.1.1.1' : null) },
    json: async () => ({ email: 'a@b.com', name: 'A', message: 'Hi' })
  };
  const saveRes = await handleContactFormRequest(reqSave, env);
  expect(saveRes.success).toBe(true);
  const idx = JSON.parse(kv._store.contactRequests_index);
  expect(idx.length).toBe(1);

  const reqList = { headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) } };
  kv.list.mockClear();
  const listRes = await handleGetContactRequestsRequest(reqList, env);
  expect(kv.list).not.toHaveBeenCalled();
  expect(listRes.requests[0].email).toBe('a@b.com');
});

test('validateIndexes rebuilds indexes', async () => {
  const resKv = createStore({ aiPreset_demo: '{}' });
  const contactKv = createStore({ contact_1: '{}' });
  const env = {
    RESOURCES_KV: resKv,
    CONTACT_REQUESTS_KV: contactKv,
    WORKER_ADMIN_TOKEN: 'secret'
  };
  const req = { headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) } };
  const res = await handleValidateIndexesRequest(req, env);
  expect(res.success).toBe(true);
  expect(JSON.parse(resKv._store.aiPresets_index)).toEqual(['aiPreset_demo']);
  expect(JSON.parse(contactKv._store.contactRequests_index)).toEqual(['contact_1']);
});

afterEach(() => {
  if (global.fetch && typeof global.fetch.mockRestore === 'function') {
    global.fetch.mockRestore();
  } else {
    global.fetch = undefined;
  }
});

