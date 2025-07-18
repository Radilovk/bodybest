import { jest } from '@jest/globals';

const importConfig = async (hostname) => {
  jest.resetModules();
  global.window = { location: { hostname } };
  return import('../config.js');
};

test.each(['localhost', '127.0.0.1'])('login endpoint in local development (%s)', async (host) => {
  const { apiEndpoints } = await importConfig(host);
  expect(apiEndpoints.login).toBe('/api/login');
});

test('login endpoint in production', async () => {
  const { apiEndpoints } = await importConfig('example.com');
  expect(apiEndpoints.login).toBe(
    'https://openapichatbot.radilov-k.workers.dev/api/login'
  );
});
