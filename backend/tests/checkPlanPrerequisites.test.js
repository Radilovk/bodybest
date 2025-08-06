import { jest } from '@jest/globals';
import { handleCheckPlanPrerequisitesRequest } from '../../worker.js';

test('връща ok при налични prerequisites', async () => {
  const env = {
    USER_METADATA_KV: { get: jest.fn(async key => (key === 'u1_initial_answers' ? '{"a":1}' : null)), put: jest.fn() },
    RESOURCES_KV: { get: jest.fn(async () => '@cf/model') }
  };
  const request = { url: 'https://example.com/api/checkPlanPrerequisites?userId=u1' };
  const res = await handleCheckPlanPrerequisitesRequest(request, env);
  expect(res.success).toBe(true);
  expect(res.ok).toBe(true);
});

test('връща грешка при липсващи отговори', async () => {
  const env = {
    USER_METADATA_KV: { get: jest.fn(async () => null), put: jest.fn() },
    RESOURCES_KV: { get: jest.fn(async () => '@cf/model') }
  };
  const request = { url: 'https://example.com/api/checkPlanPrerequisites?userId=u1' };
  const res = await handleCheckPlanPrerequisitesRequest(request, env);
  expect(res.success).toBe(true);
  expect(res.ok).toBe(false);
  expect(res.message).toBe('Липсват първоначални отговори.');
});
