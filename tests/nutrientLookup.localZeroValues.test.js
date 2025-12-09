/**
 * Test for the scenario where local database has products with all zeros (e.g., water, unsweetened tea)
 * Backend should skip local database lookup for such products and use AI instead
 */

import { jest } from '@jest/globals';

describe('handleNutrientLookupRequest - local database with zero values', () => {
  let env;
  let handleNutrientLookupRequest;

  beforeEach(async () => {
    // Mock environment with RESOURCES_KV containing water/tea with all zeros
    env = {
      RESOURCES_KV: {
        get: jest.fn((key) => {
          if (key === 'product_macros') {
            return Promise.resolve(JSON.stringify([
              {
                name: 'вода / чай (неподсладен)',
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber: 0,
                category: 'НАПИТКИ'
              },
              {
                name: 'ябълка',
                calories: 52,
                protein: 0.3,
                carbs: 14,
                fat: 0.2,
                fiber: 2.4,
                category: 'ПЛОДОВЕ'
              }
            ]));
          }
          if (key === 'model_nutrient_lookup') {
            return Promise.resolve('@cf/meta/llama-3.1-8b-instruct');
          }
          return Promise.resolve(null);
        })
      },
      CF_ACCOUNT_ID: 'test-account',
      CF_AI_TOKEN: 'test-token'
    };

    // Mock fetch for AI calls
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          result: {
            response: JSON.stringify({
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0
            })
          }
        }))
      })
    );

    // Import the function (assuming it's exported for testing or we test via worker)
    const workerModule = await import('../worker.js');
    handleNutrientLookupRequest = workerModule.handleNutrientLookupRequest;
  });

  test('should skip local database for all-zero products and use AI', async () => {
    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'вода',
        quantity: '200'
      }))
    };

    const result = await handleNutrientLookupRequest(request, env);

    // Should have called AI (fetch) instead of using local database
    expect(global.fetch).toHaveBeenCalled();
    
    // Even though local DB would return all zeros, AI might provide context
    // The key point is that we DON'T return local all-zeros data
    expect(result).toBeDefined();
  });

  test('should use local database for products with non-zero values', async () => {
    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'ябълка',
        quantity: '100'
      }))
    };

    const result = await handleNutrientLookupRequest(request, env);

    // Should NOT have called AI - should use local database
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Should return values from local database
    expect(result.calories).toBe(52);
    expect(result.protein).toBe(0.3);
    expect(result.fiber).toBe(2.4);
  });
});
