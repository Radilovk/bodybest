import { jest } from "@jest/globals";
import { handleLogExtraMealRequest } from '../../worker.js';

describe('handleLogExtraMealRequest', () => {
  test('returns success and stores data', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn().mockResolvedValue(null), put: jest.fn() } };
    const request = { json: async () => ({ userId: 'test1', foodDescription: 'Apple', quantityEstimate: 'малко' }) };
    const res = await handleLogExtraMealRequest(request, env);
    expect(res.success).toBe(true);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
  });

  test('fails without userId', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn(), put: jest.fn() } };
    const request = { json: async () => ({ foodDescription: 'Apple', quantityEstimate: 'малко' }) };
    const res = await handleLogExtraMealRequest(request, env);
    expect(res.success).toBe(false);
  });
});
