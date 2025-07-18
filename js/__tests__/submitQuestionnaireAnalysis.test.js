import { jest } from '@jest/globals'
import * as worker from '../../worker.js'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('submit questionnaire workflow', () => {
  test('stores answers, sets status and saves analysis', async () => {
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
          if (key === 'prompt_initial_analysis') return 'Analyze %%ANSWERS_JSON%%'
          if (key === 'model_chat') return '@cf/test-model'
          return null
        })
      },
      AI: { run: jest.fn().mockResolvedValue({ response: '{"score":1}' }) }
    }
    kvStore['email_to_uuid_user@example.com'] = 'u1'
    const req = { json: async () => ({ email: 'user@example.com', name: 'Иван' }) }
    const res = await worker.handleSubmitQuestionnaire(req, env)
    expect(res.success).toBe(true)
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_initial_answers', expect.any(String))
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('plan_status_u1', 'pending', { metadata: { status: 'pending' } })
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_analysis', '{"score":1}')
    expect(global.fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object))
  })
})
