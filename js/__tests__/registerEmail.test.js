import { jest } from '@jest/globals'
import { webcrypto } from 'crypto'

// Make crypto available in the test environment
global.crypto = webcrypto

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
  
  const kvStore = new Map()
  const env = {
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
      put: jest.fn(async (key, val) => {
        kvStore.set(key, val)
      })
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
  const kvStore = new Map()
  const env = {
    USER_METADATA_KV: {
      get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
      put: jest.fn(async (key, val) => {
        kvStore.set(key, val)
      })
    }
  }
  const req = {
    json: async () => ({ email: 'u@e.bg', password: '12345678', confirm_password: '12345678' })
  }
  const res = await handleRegisterRequest(req, env)
  console.log('Result:', JSON.stringify(res, null, 2))
  expect(res.success).toBe(true)
})

test('skips welcome email when flag disabled', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  
  const kvStore = new Map()
  const env = {
    SEND_WELCOME_EMAIL: '0',
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
      put: jest.fn(async (key, val) => {
        kvStore.set(key, val)
      })
    }
  }
  const req = {
    json: async () => ({ email: 'x@y.bg', password: '12345678', confirm_password: '12345678' })
  }
  const res = await handleRegisterRequest(req, env)
  expect(res.success).toBe(true)
  expect(global.fetch).not.toHaveBeenCalled()
})

test('registration succeeds even when email sending fails', async () => {
  // Mock fetch to fail
  global.fetch = jest.fn().mockRejectedValue(new Error('Email service unavailable'))
  
  const kvStore = new Map()
  const env = {
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
      put: jest.fn(async (key, val) => {
        kvStore.set(key, val)
      })
    }
  }
  const req = {
    json: async () => ({ email: 'test@example.com', password: '12345678', confirm_password: '12345678' })
  }
  // Registration should succeed even if email fails
  const res = await handleRegisterRequest(req, env)
  expect(res.success).toBe(true)
  expect(res.message).toBe('Регистрацията успешна!')
})

test('registration succeeds when email times out', async () => {
  // Mock fetch to timeout (takes longer than EMAIL_TIMEOUT_MS)
  global.fetch = jest.fn().mockImplementation(() => 
    new Promise((_, reject) => {
      const error = new Error('Email sending timeout after 10 seconds')
      error.name = 'AbortError'
      setTimeout(() => reject(error), 100)
    })
  )
  
  const kvStore = new Map()
  const env = {
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
      put: jest.fn(async (key, val) => {
        kvStore.set(key, val)
      })
    }
  }
  const req = {
    json: async () => ({ email: 'timeout@example.com', password: '12345678', confirm_password: '12345678' })
  }
  // Registration should succeed even if email times out
  const res = await handleRegisterRequest(req, env)
  expect(res.success).toBe(true)
  expect(res.message).toBe('Регистрацията успешна!')
})
