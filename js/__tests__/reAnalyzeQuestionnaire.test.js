import { jest } from '@jest/globals'
import * as worker from '../../worker.js'

const originalFetch = global.fetch

afterEach(() => { global.fetch = originalFetch })

test('handleReAnalyzeQuestionnaireRequest loads answers and triggers analysis', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: { response: '{"ok":1}' } })
  })
  const env = {
    ANALYSIS_PAGE_URL: 'https://app.example.com/analyze.html',
    USER_METADATA_KV: {
      get: jest.fn(key => {
        if (key === 'email_to_uuid_a@ex.bg') return Promise.resolve('u1')
        if (key === 'u1_initial_answers') return Promise.resolve('{"name":"A","email":"a@ex.bg"}')
        return Promise.resolve(null)
      }),
      put: jest.fn()
    },
    RESOURCES_KV: {
      get: jest.fn(key => {
        if (key === 'prompt_questionnaire_analysis') return 'Analyze %%ANSWERS_JSON%%'
        if (key === 'model_questionnaire_analysis') return '@cf/test-model'
        return null
      })
    },
    CF_ACCOUNT_ID: 'acc',
    CF_AI_TOKEN: 't'
  }
  const req = { json: async () => ({ email: 'a@ex.bg' }) }
  const res = await worker.handleReAnalyzeQuestionnaireRequest(req, env)
  expect(res.success).toBe(true)
  expect(res.userId).toBe('u1')
  expect(res.link).toBe('https://app.example.com/analyze.html?userId=u1')
  expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_analysis_status', 'pending')
})
