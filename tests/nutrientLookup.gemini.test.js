/**
 * Test for Gemini API fallback in nutrient lookup
 * When Cloudflare AI is not configured, the system should fall back to Gemini API
 */

import { jest } from '@jest/globals';

describe('handleNutrientLookupRequest - Gemini API fallback', () => {
  let env;
  let handleNutrientLookupRequest;
  let originalFetch;

  beforeEach(async () => {
    // Save original fetch
    originalFetch = global.fetch;
    
    // Mock environment with RESOURCES_KV but WITHOUT Cloudflare AI credentials
    env = {
      RESOURCES_KV: {
        get: jest.fn((key) => {
          if (key === 'model_nutrient_lookup') {
            return Promise.resolve('gemini-2.0-flash-exp');
          }
          if (key === 'prompt_nutrient_lookup') {
            return Promise.resolve('You are a nutrition data expert providing nutritional information for Bulgarian foods.\n\nIMPORTANT: Return ONLY a valid JSON object, nothing else. No explanations, no markdown, no additional text.\n\nFormat: {"calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number}');
          }
          if (key === 'product_macros') {
            return Promise.resolve(JSON.stringify([])); // Empty local database
          }
          return Promise.resolve(null);
        })
      },
      GEMINI_API_KEY: 'test-gemini-key',
      // Note: NO CF_ACCOUNT_ID or CF_AI_TOKEN - should fallback to Gemini
    };

    // Helper function to safely check if URL is a Gemini API call
    const isGeminiApiUrl = (url) => {
      try {
        if (typeof url !== 'string') return false;
        const urlObj = new URL(url);
        return urlObj.hostname === 'generativelanguage.googleapis.com';
      } catch {
        return false;
      }
    };

    // Mock global fetch for Gemini API calls
    global.fetch = jest.fn((url) => {
      // Check if it's a Gemini API call
      if (isGeminiApiUrl(url)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    calories: 290,
                    protein: 5,
                    carbs: 51,
                    fat: 7,
                    fiber: 2
                  })
                }]
              }
            }]
          })
        });
      }
      // Fallback for other fetch calls
      return originalFetch(url);
    });

    // Import the worker module
    const workerModule = await import('../worker.js');
    handleNutrientLookupRequest = workerModule.handleNutrientLookupRequest;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  test('should use Gemini API when Cloudflare AI is not configured', async () => {
    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'шоколадов мъфин',
        quantity: '80'
      }))
    };

    const result = await handleNutrientLookupRequest(request, env);

    // Helper to safely check Gemini API URLs
    const isGeminiApiUrl = (url) => {
      try {
        if (typeof url !== 'string') return false;
        const urlObj = new URL(url);
        return urlObj.hostname === 'generativelanguage.googleapis.com';
      } catch {
        return false;
      }
    };

    // Should have called Gemini API (fetch with generativelanguage.googleapis.com)
    expect(global.fetch).toHaveBeenCalled();
    const geminiCalls = global.fetch.mock.calls.filter(call => isGeminiApiUrl(call[0]));
    expect(geminiCalls.length).toBeGreaterThan(0);
    
    // Should return nutrition data from Gemini
    expect(result).toBeDefined();
    expect(result.calories).toBe(290);
    expect(result.protein).toBe(5);
    expect(result.carbs).toBe(51);
    expect(result.fat).toBe(7);
    expect(result.fiber).toBe(2);
  });

  test('should return error when neither CF AI nor Gemini is configured', async () => {
    // Environment without any AI configuration
    const envNoAI = {
      RESOURCES_KV: {
        get: jest.fn((key) => {
          if (key === 'model_nutrient_lookup') {
            return Promise.resolve('gemini-2.0-flash-exp');
          }
          if (key === 'product_macros') {
            return Promise.resolve(JSON.stringify([]));
          }
          return Promise.resolve(null);
        })
      }
      // No GEMINI_API_KEY, no CF_ACCOUNT_ID, no CF_AI_TOKEN
    };

    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'мъфин',
        quantity: '80'
      }))
    };

    const result = await handleNutrientLookupRequest(request, envNoAI);

    // Should return 503 error
    expect(result.success).toBe(false);
    expect(result.statusHint).toBe(503);
    expect(result.error).toBe('AI not configured');
    expect(result.message).toContain('AI услугата не е конфигурирана');
  });

  test('should handle Gemini API errors gracefully', async () => {
    // Helper to safely check Gemini API URLs
    const isGeminiApiUrl = (url) => {
      try {
        if (typeof url !== 'string') return false;
        const urlObj = new URL(url);
        return urlObj.hostname === 'generativelanguage.googleapis.com';
      } catch {
        return false;
      }
    };

    // Mock Gemini to throw an error
    global.fetch = jest.fn((url) => {
      if (isGeminiApiUrl(url)) {
        return Promise.reject(new Error('Gemini API Error: Rate limit exceeded'));
      }
      return originalFetch(url);
    });

    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'пица',
        quantity: '2 парчета'
      }))
    };

    const result = await handleNutrientLookupRequest(request, env);

    // Should return error response
    expect(result.success).toBe(false);
    expect(result.error).toBe('Gemini lookup error');
    expect(result.statusHint).toBe(500);
  });

  test('should extract JSON from Gemini response with explanatory text', async () => {
    // Helper to safely check Gemini API URLs
    const isGeminiApiUrl = (url) => {
      try {
        if (typeof url !== 'string') return false;
        const urlObj = new URL(url);
        return urlObj.hostname === 'generativelanguage.googleapis.com';
      } catch {
        return false;
      }
    };

    // Mock Gemini to return JSON with explanatory text (common scenario)
    global.fetch = jest.fn((url) => {
      if (isGeminiApiUrl(url)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            candidates: [{
              content: {
                parts: [{
                  text: 'Here is the nutritional information:\n\n{"calories": 143, "protein": 12.5, "carbs": 1.1, "fat": 9.5, "fiber": 0}\n\nThis is for 100g of eggs.'
                }]
              }
            }]
          })
        });
      }
      return originalFetch(url);
    });

    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'яйца',
        quantity: '100'
      }))
    };

    const result = await handleNutrientLookupRequest(request, env);

    // Should successfully extract JSON and return nutrition data
    expect(result.calories).toBe(143);
    expect(result.protein).toBe(12.5);
    expect(result.carbs).toBe(1.1);
    expect(result.fat).toBe(9.5);
    expect(result.fiber).toBe(0);
  });

  test('should return error when Gemini returns all zeros', async () => {
    // Helper to safely check Gemini API URLs
    const isGeminiApiUrl = (url) => {
      try {
        if (typeof url !== 'string') return false;
        const urlObj = new URL(url);
        return urlObj.hostname === 'generativelanguage.googleapis.com';
      } catch {
        return false;
      }
    };

    // Mock Gemini to return all zeros (indicates it couldn't recognize the food)
    global.fetch = jest.fn((url) => {
      if (isGeminiApiUrl(url)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    fiber: 0
                  })
                }]
              }
            }]
          })
        });
      }
      return originalFetch(url);
    });

    const request = {
      json: jest.fn(() => Promise.resolve({
        food: 'непозната храна xyz123',
        quantity: '100'
      }))
    };

    const result = await handleNutrientLookupRequest(request, env);

    // Should return error instead of misleading zeros
    expect(result.success).toBe(false);
    expect(result.error).toBe('Gemini returned all zeros');
    expect(result.statusHint).toBe(422);
    expect(result.message).toContain('не може да разпознае храната');
  });
});
