/** @jest-environment jsdom */
import { apiEndpoints } from '../config.js';

describe('admin delete notification endpoint config', () => {
  test('deletePlanChangeNotification endpoint is defined in config', () => {
    expect(apiEndpoints.deletePlanChangeNotification).toBeDefined();
    expect(apiEndpoints.deletePlanChangeNotification).toContain('/api/deletePlanChangeNotification');
  });

  test('deletePlanChangeNotification endpoint uses workerBaseUrl', () => {
    // In production, should contain the worker URL
    // In local development with USE_LOCAL_PROXY=false, should still have the full URL
    expect(apiEndpoints.deletePlanChangeNotification).toMatch(
      /openapichatbot\.radilov-k\.workers\.dev\/api\/deletePlanChangeNotification/
    );
  });

  test('all API endpoints use consistent pattern', () => {
    // Verify that deletePlanChangeNotification follows the same pattern as other endpoints
    const sampleEndpoint = apiEndpoints.listClients;
    const deleteEndpoint = apiEndpoints.deletePlanChangeNotification;
    
    // Both should either have the full URL or be relative
    const sampleHasWorkerUrl = sampleEndpoint.includes('openapichatbot.radilov-k.workers.dev');
    const deleteHasWorkerUrl = deleteEndpoint.includes('openapichatbot.radilov-k.workers.dev');
    
    expect(sampleHasWorkerUrl).toBe(deleteHasWorkerUrl);
  });
});
