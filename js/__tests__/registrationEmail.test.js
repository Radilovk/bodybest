import { jest } from '@jest/globals';

let handleRegisterRequest, sendWelcomeEmailMock;

beforeEach(async () => {
  jest.resetModules();
  sendWelcomeEmailMock = jest.fn();
  jest.unstable_mockModule('../../mailer.js', () => ({
    sendWelcomeEmail: sendWelcomeEmailMock
  }));
  ({ handleRegisterRequest } = await import('../../worker.js'));
});

afterEach(() => {
  global.fetch = undefined;
});

test('calls sendWelcomeEmail after successful registration', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'ok', file: 'cred.json' })
  });
  const env = {
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn()
    },
    RESOURCES_KV: {
      get: jest.fn().mockResolvedValue('<p>tmpl</p>')
    },
    'тут_ваш_php_api_url_secret_name': 'https://api',
    'тут_ваш_php_api_token_secret_name': 'tok',
  };
  const request = {
    json: async () => ({ email: 'a@b.com', password: '12345678', confirm_password: '12345678' })
  };
  const res = await handleRegisterRequest(request, env);
  expect(res.success).toBe(true);
  expect(sendWelcomeEmailMock).toHaveBeenCalledWith('a@b.com', 'a@b.com', '<p>tmpl</p>', env);
});
