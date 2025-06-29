import worker from '../../worker.js';

describe('fetch handler for /api/runImageModel', () => {
  test('GET returns 405', async () => {
    const req = new Request('https://example.com/api/runImageModel', { method: 'GET' });
    const res = await worker.fetch(req, {}, {});
    expect(res.status).toBe(405);
  });
});
