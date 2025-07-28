import { jest } from '@jest/globals'
import * as worker from '../../worker.js'

afterEach(() => {
  global.fetch && global.fetch.mockRestore()
})

describe('analysis status ready when ctx missing', () => {
  test('handleSubmitQuestionnaire sets ready status without ctx', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    const kvStore = {}
    const env = {
      MAILER_ENDPOINT_URL: 'https://mail.example.com',
      USER_METADATA_KV: {
        get: jest.fn(key => kvStore[key] ?? null),
        put: jest.fn((key, val) => { kvStore[key] = val; return Promise.resolve() })
      },
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'prompt_questionnaire_analysis') return 'Analyze %%ANSWERS_JSON%%'
          if (key === 'model_questionnaire_analysis') return '@cf/test-model'
          return null
        })
      },
      AI: { run: jest.fn().mockResolvedValue({ response: '{"score":1}' }) }
    }
    kvStore['email_to_uuid_a@b.bg'] = 'u1'
    const req = { json: async () => ({ email: 'a@b.bg', name: 'A' }) }
    const res = await worker.handleSubmitQuestionnaire(req, env)
    expect(res.success).toBe(true)
    expect(kvStore['u1_analysis_status']).toBe('ready')
  })

  test('handleSubmitDemoQuestionnaire sets ready status without ctx', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    const kvStore = {}
    const env = {
      MAILER_ENDPOINT_URL: 'https://mail.example.com',
      USER_METADATA_KV: {
        get: jest.fn(key => kvStore[key] ?? null),
        put: jest.fn((key, val) => { kvStore[key] = val; return Promise.resolve() })
      },
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'prompt_questionnaire_analysis') return 'Analyze %%ANSWERS_JSON%%'
          if (key === 'model_questionnaire_analysis') return '@cf/test-model'
          return null
        })
      },
      AI: { run: jest.fn().mockResolvedValue({ response: '{"score":1}' }) }
    }
    kvStore['email_to_uuid_a@b.bg'] = 'u1'
    const req = { json: async () => ({ email: 'a@b.bg', name: 'A' }) }
    const res = await worker.handleSubmitDemoQuestionnaire(req, env)
    expect(res.success).toBe(true)
    expect(kvStore['u1_analysis_status']).toBe('ready')
  })
})
