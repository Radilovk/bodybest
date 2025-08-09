/** @jest-environment node */
import { jest } from '@jest/globals';

test('nutrient lookup caches with TTL', async () => {
  const mod = await import('../../worker-backend.js');
  const put = jest.fn();
  const env = {
    USER_METADATA_KV: { get: jest.fn().mockResolvedValue(null), put },
    NUTRITION_API_URL: 'https://api/'
  };
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ calories: 1, protein_g: 1, carbohydrates_total_g: 1, fat_total_g: 1, fiber_g: 1 }]
  });
  const req = new Request('https://example.com/nutrient-lookup', {
    method: 'POST',
    body: JSON.stringify({ food: 'apple' })
  });
  await mod.default.fetch(req, env);
  expect(put).toHaveBeenCalledWith(expect.stringContaining('nutrient_cache_'), expect.any(String), { expirationTtl: 86400 });
  const saved = JSON.parse(put.mock.calls[0][1]);
  expect(saved).toEqual({ calories: 1, protein: 1, carbs: 1, fat: 1, fiber: 1 });
  global.fetch = originalFetch;
});
