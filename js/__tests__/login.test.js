import { jest } from '@jest/globals';

const importConfig = async (hostname) => {
  jest.resetModules();
  global.window = { location: { hostname } };
  return import('../config.js');
};

test('login endpoint in local development', async () => {
  const { apiEndpoints } = await importConfig('localhost');
  expect(apiEndpoints.login).toBe('/api/login');
});

test('login endpoint in production', async () => {
  const { apiEndpoints } = await importConfig('example.com');
  expect(apiEndpoints.login).toBe(
    'https://openapichatbot.radilov-k.workers.dev/api/login'
  );
});
