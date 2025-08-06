/** @jest-environment node */
import { jest } from '@jest/globals';
import { handleListUserKvRequest, handleUpdateKvRequest } from '../../worker.js';

test('lists user KV entries', async () => {
  const list = jest.fn().mockResolvedValue({ keys: [{ name: 'user1_a' }, { name: 'user1_b' }] });
  const get = jest.fn().mockImplementation(async key => (key === 'user1_a' ? '1' : '2'));
  const env = { USER_METADATA_KV: { list, get, put: jest.fn() } };
  const req = new Request('https://example.com/api/listUserKv?userId=user1');
  const res = await handleListUserKvRequest(req, env);
  expect(list).toHaveBeenCalledWith({ prefix: 'user1_' });
  expect(res).toEqual({ success: true, kv: { user1_a: '1', user1_b: '2' } });
});

test('updates KV entry', async () => {
  const put = jest.fn();
  const env = { USER_METADATA_KV: { put } };
  const req = new Request('https://example.com/api/updateKv', {
    method: 'POST',
    body: JSON.stringify({ key: 'user1_c', value: '3' })
  });
  const res = await handleUpdateKvRequest(req, env);
  expect(put).toHaveBeenCalledWith('user1_c', '3');
  expect(res.success).toBe(true);
});
