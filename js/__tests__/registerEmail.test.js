import { jest } from '@jest/globals'

let handleRegisterRequest, PHP_FILE_API_URL, PHP_FILE_API_TOKEN

beforeEach(async () => {
  jest.resetModules()
  ;({ handleRegisterRequest, PHP_FILE_API_URL, PHP_FILE_API_TOKEN } = await import('../../worker.js'))
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
    [PHP_FILE_API_URL]: 'https://php.example.com',
    [PHP_FILE_API_TOKEN]: 'tok',
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
