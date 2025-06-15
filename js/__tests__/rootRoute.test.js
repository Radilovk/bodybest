import worker from '../../worker.js';

describe('root route', () => {
  test('responds with usage message', async () => {
    const req = new Request('https://example.com/', {
      method: 'GET',
      headers: { Origin: 'http://localhost:5173' }
    });
    const res = await worker.fetch(req, {}, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Използвайте /api/<endpoint>');
  });
});
