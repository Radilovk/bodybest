import { jest } from '@jest/globals'

let handleRegisterRequest

beforeEach(async () => {
  jest.resetModules()
  ;({ handleRegisterRequest } = await import('../../worker.js'))
})

afterEach(() => {
  if (global.fetch && typeof global.fetch.mockRestore === 'function') {
    global.fetch.mockRestore()
  }
})

test('sends welcome email when mailer configured', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'ok', file: 'f' }) })
    .mockResolvedValueOnce({ ok: true })
  const env = {
    'тут_ваш_php_api_url_secret_name': 'https://php.example.com',
    'тут_ваш_php_api_token_secret_name': 'tok',
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn()
    }
  }
  const req = {
    json: async () => ({ email: 'u@e.bg', password: '12345678', confirm_password: '12345678' })
  }
  const res = await handleRegisterRequest(req, env)
  expect(res.success).toBe(true)
  expect(global.fetch.mock.calls[1][0]).toBe('https://mail.example.com')
})
