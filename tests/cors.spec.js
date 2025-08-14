import backend from '../worker-backend.js';
import sendEmailWorker from '../sendEmailWorker.js';

class SimpleResponse {
  constructor(body, init = {}) {
    this.status = init.status || 200;
    this.headers = init.headers || {};
    this.body = body;
  }
  async text() { return this.body; }
}
globalThis.Response = SimpleResponse;

function makeRequest(url) {
  return {
    url,
    method: 'POST',
    headers: { get: () => 'https://evil.com' }
  };
}

test('backend rejects disallowed origin', async () => {
  const resp = await backend.fetch(makeRequest('https://example.com/nutrient-lookup'), {});
  expect(resp.status).toBe(403);
});

test('sendEmailWorker rejects disallowed origin', async () => {
  const resp = await sendEmailWorker.fetch(makeRequest('https://example.com/api/sendEmail'), {});
  expect(resp.status).toBe(403);
});
