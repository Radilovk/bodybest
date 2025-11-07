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

test('skips analysis email when config flag is disabled in RESOURCES_KV', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  const env = {
    USER_METADATA_KV: {
      get: jest.fn(async key => key === 'email_to_uuid_cfg@x.bg' ? 'u1' : null),
      put: jest.fn()
    },
    RESOURCES_KV: {
      get: jest.fn(key => key === 'send_questionnaire_email' ? '0' : null)
    }
  }
  const req = { 
    json: async () => ({ 
      email: 'cfg@x.bg', 
      name: 'Петър',
      gender: 'м',
      age: 30,
      height: 175,
      weight: 75,
      goal: 'загуба на тегло',
      medicalConditions: ['нямам']
    }) 
  }
  const res = await handleSubmitQuestionnaire(req, env)
  expect(res.success).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
})
