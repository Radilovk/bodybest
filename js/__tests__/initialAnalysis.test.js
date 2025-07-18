import { jest } from '@jest/globals'
import * as worker from '../../worker.js'

const originalFetch = global.fetch

describe('initial analysis handlers', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  test('handleAnalyzeInitialAnswers saves result and sends email', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '{"ok":true}' } })
    })
    const env = {
      MAILER_ENDPOINT_URL: 'https://mail.example.com',
      ANALYSIS_PAGE_URL: 'https://app.example.com/analyze.html',
      USER_METADATA_KV: {
        get: jest.fn(key => key === 'u1_initial_answers' ? Promise.resolve('{"name":"A","email":"a@ex.bg"}') : Promise.resolve(null)),
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
    await worker.handleAnalyzeInitialAnswers('u1', env)
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_analysis', '{"ok":true}')
    expect(global.fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object))
  })

  test('handleGetInitialAnalysisRequest returns parsed analysis', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn().mockResolvedValue('{"a":1}') } }
    const req = { url: 'https://x/api/getInitialAnalysis?userId=u1' }
    const res = await worker.handleGetInitialAnalysisRequest(req, env)
    expect(res.success).toBe(true)
    expect(res.analysis).toEqual({ a: 1 })
  })
})
