import { jest } from '@jest/globals'

let handleSubmitQuestionnaire

beforeEach(async () => {
  jest.resetModules()
  ;({ handleSubmitQuestionnaire } = await import('../../worker.js'))
})

afterEach(() => {
  if (global.fetch && typeof global.fetch.mockRestore === 'function') {
    global.fetch.mockRestore()
  }
})

test('sends confirmation email when configured', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  const env = {
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    USER_METADATA_KV: {
      get: jest.fn(async key => key === 'email_to_uuid_user@site.bg' ? 'u1' : null),
      put: jest.fn()
    }
  }
  const req = { json: async () => ({ email: 'user@site.bg', name: 'Иван' }) }
  const res = await handleSubmitQuestionnaire(req, env)
  expect(res.success).toBe(true)
  expect(fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object))
})

test('works without email configuration', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  const env = {
    USER_METADATA_KV: {
      get: jest.fn(async key => key === 'email_to_uuid_x@x.bg' ? 'u1' : null),
      put: jest.fn()
    }
  }
  const req = { json: async () => ({ email: 'x@x.bg' }) }
  const res = await handleSubmitQuestionnaire(req, env)
  expect(res.success).toBe(true)
  expect(fetch).toHaveBeenCalledWith('https://mybody.best/mailer/mail.php', expect.any(Object))
})

test('skips confirmation email when disabled', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  const env = {
    SEND_QUESTIONNAIRE_EMAIL: '0',
    USER_METADATA_KV: {
      get: jest.fn(async key => key === 'email_to_uuid_a@b.bg' ? 'u1' : null),
      put: jest.fn()
    }
  }
  const req = { json: async () => ({ email: 'a@b.bg' }) }
  const res = await handleSubmitQuestionnaire(req, env)
  expect(res.success).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
})
