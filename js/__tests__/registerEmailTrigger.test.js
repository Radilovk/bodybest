import { jest } from '@jest/globals';

const PHP_FILE_MANAGER_API_URL_SECRET_NAME = 'тут_ваш_php_api_url_secret_name';
const PHP_API_STATIC_TOKEN_SECRET_NAME = 'тут_ваш_php_api_token_secret_name';

let fetchHandler, sendWelcomeEmail;

beforeEach(async () => {
  jest.resetModules();
  const emailMock = jest.fn();
  jest.unstable_mockModule('../../mailer.js', () => ({
    sendWelcomeEmail: emailMock
  }));
  const mod = await import('../../worker.js');
  fetchHandler = mod.default.fetch;
  ({ sendWelcomeEmail } = await import('../../mailer.js'));
  sendWelcomeEmail.mockClear();
});

test('registration triggers sendWelcomeEmail', async () => {
  const env = {
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined)
    },
    RESOURCES_KV: {
      get: jest.fn().mockResolvedValue('<p>welcome</p>')
    },
    [PHP_FILE_MANAGER_API_URL_SECRET_NAME]: 'https://php.test',
    [PHP_API_STATIC_TOKEN_SECRET_NAME]: 'token'
  };

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'ok', file: 'f.json' })
  });

  const req = new Request('https://x/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      password: '12345678',
      confirm_password: '12345678'
    })
  });

  await fetchHandler(req, env, {});

  expect(sendWelcomeEmail).toHaveBeenCalledWith(
    'user@example.com',
    'user@example.com',
    '<p>welcome</p>',
    env
  );
});
