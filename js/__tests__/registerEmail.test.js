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
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true })
  const env = {
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
  expect(global.fetch.mock.calls[0][0]).toBe('https://mail.example.com')
})

test('works without PHP API configuration', async () => {
  const env = {
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
})

test('skips welcome email when flag disabled', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  const env = {
    SEND_WELCOME_EMAIL: '0',
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn()
    }
  }
  const req = {
    json: async () => ({ email: 'x@y.bg', password: '12345678', confirm_password: '12345678' })
  }
  const res = await handleRegisterRequest(req, env)
  expect(res.success).toBe(true)
  expect(global.fetch).not.toHaveBeenCalled()
})
