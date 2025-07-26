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
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_analysis_status', 'ready')
    expect(global.fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object))
  })

  test('skips analysis email when flag is off', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '{"ok":true}' } })
    })
    const env = {
      SEND_ANALYSIS_EMAIL: '0',
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
    const mailCall = global.fetch.mock.calls.find(c => c[0] === 'https://mail.example.com')
    expect(mailCall).toBeUndefined()
  })

  test('warns when ANALYSIS_EMAIL_BODY lacks link placeholder', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '{"ok":true}' } })
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const env = {
      MAILER_ENDPOINT_URL: 'https://mail.example.com',
      ANALYSIS_PAGE_URL: 'https://app.example.com/analyze.html',
      ANALYSIS_EMAIL_BODY: '<p>Hello {{name}}</p>',
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
    expect(warnSpy).toHaveBeenCalledWith('ANALYSIS_EMAIL_BODY missing {{link}} placeholder')
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_analysis_status', 'ready')
    warnSpy.mockRestore()
  })

  test('warns when ANALYSIS_EMAIL_BODY lacks name placeholder', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '{"ok":true}' } })
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const env = {
      MAILER_ENDPOINT_URL: 'https://mail.example.com',
      ANALYSIS_PAGE_URL: 'https://app.example.com/analyze.html',
      ANALYSIS_EMAIL_BODY: '<p><a href="{{link}}">see</a></p>',
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
    expect(warnSpy).toHaveBeenCalledWith('ANALYSIS_EMAIL_BODY missing {{name}} placeholder')
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_analysis_status', 'ready')
    warnSpy.mockRestore()
  })

  test('adds userId to ANALYSIS_PAGE_URL with existing query', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { response: '{"ok":true}' } })
    })
    const env = {
      MAILER_ENDPOINT_URL: 'https://mail.example.com',
      ANALYSIS_PAGE_URL: 'https://app.example.com/analyze.html?utm=1',
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
    const emailCall = global.fetch.mock.calls.find(c => c[0] === 'https://mail.example.com')
    const callBody = JSON.parse(emailCall[1].body)
    expect(callBody.message).toContain('https://app.example.com/analyze.html?utm=1&userId=u1')
  })

  test('handleGetInitialAnalysisRequest returns parsed analysis', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn().mockResolvedValue('{"a":1}') } }
    const req = { url: 'https://x/api/getInitialAnalysis?userId=u1' }
    const res = await worker.handleGetInitialAnalysisRequest(req, env)
    expect(res.success).toBe(true)
    expect(res.analysis).toEqual({ a: 1 })
  })

  test('handleAnalysisStatusRequest returns stored status', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn().mockResolvedValue('ready') } }
    const req = { url: 'https://x/api/analysisStatus?userId=u1' }
    const res = await worker.handleAnalysisStatusRequest(req, env)
    expect(res.success).toBe(true)
    expect(res.analysisStatus).toBe('ready')
  })
})
