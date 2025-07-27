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

test('sends analysis email on questionnaire submit', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  const env = {
    MAILER_ENDPOINT_URL: 'https://mail.example.com',
    ANALYSIS_PAGE_URL: 'https://app.example.com/analyze.html',
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

test('works without explicit mail configuration', async () => {
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
  expect(fetch).toHaveBeenCalled()
})

test('ignores SEND_QUESTIONNAIRE_EMAIL flag', async () => {
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
  expect(fetch).toHaveBeenCalled()
})
