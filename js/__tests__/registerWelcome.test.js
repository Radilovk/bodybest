import { jest } from '@jest/globals';

let handleRegisterRequest, sendWelcomeEmailMock;

beforeEach(async () => {
  jest.resetModules();
  sendWelcomeEmailMock = jest.fn().mockResolvedValue(undefined);
  jest.unstable_mockModule('../../mailer.js', () => ({ sendWelcomeEmail: sendWelcomeEmailMock }));
  ({ handleRegisterRequest } = await import('../../worker.js'));
});

test('welcome email is sent on successful registration', async () => {
  const env = {
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValueOnce(null),
      put: jest.fn()
    },
    'тут_ваш_php_api_url_secret_name': 'https://php.example.com',
    'тут_ваш_php_api_token_secret_name': 'tok'
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'ok', file: 'f' })
  });
  const req = {
    json: async () => ({ email: 'a@b.com', password: '12345678', confirm_password: '12345678' })
  };
  const res = await handleRegisterRequest(req, env);
  expect(res.success).toBe(true);
  expect(sendWelcomeEmailMock).toHaveBeenCalledWith('a@b.com', 'a');
  expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(expect.stringMatching(/^welcome_email_ts_/), expect.any(String));
});
