import worker from '../../worker.js';

// Test GET request for analyzeImage returns 405

test('GET /api/analyzeImage returns 405 via worker.fetch', async () => {
  const req = new Request('https://example.com/api/analyzeImage', { method: 'GET' });
  const res = await worker.fetch(req, {});
  expect(res.status).toBe(405);
  const json = await res.json();
  expect(json).toEqual({ success: false, message: 'Method Not Allowed' });
});
