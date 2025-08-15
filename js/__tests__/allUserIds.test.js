import { jest } from '@jest/globals'
import { webcrypto } from 'crypto'
import { TextEncoder } from 'util'

let handleListClientsRequest, handleDeleteClientRequest

beforeEach(async () => {
  jest.resetModules()
  global.crypto = webcrypto
  global.TextEncoder = TextEncoder
  ;({ handleListClientsRequest, handleDeleteClientRequest } = await import('../../worker.js'))
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('handleListClientsRequest използва all_user_ids', async () => {
  const store = {
    all_user_ids: JSON.stringify(['u1']),
    'u1_initial_answers': JSON.stringify({ name: 'Иван', submissionDate: '2024-01-02' }),
    'u1_profile': JSON.stringify({ email: 'ivan@example.com' }),
    'plan_status_u1': 'ready',
    'u1_current_status': JSON.stringify({ adminTags: ['vip'], lastUpdated: '2024-01-10' })
  }
  const env = {
    USER_METADATA_KV: {
      get: jest.fn(async key => store[key] || null)
    }
  }
  const res = await handleListClientsRequest({}, env)
  expect(res.success).toBe(true)
  expect(res.clients).toEqual([
    {
      userId: 'u1',
      name: 'Иван',
      email: 'ivan@example.com',
      registrationDate: '2024-01-02',
      status: 'ready',
      tags: ['vip'],
      lastUpdated: '2024-01-10'
    }
  ])
})

test('handleListClientsRequest пада назад към list при липсващ индекс', async () => {
  const store = {
    'u1_initial_answers': JSON.stringify({ name: 'Иван', submissionDate: '2024-01-02' }),
    'u1_profile': JSON.stringify({ email: 'ivan@example.com' }),
    'plan_status_u1': 'ready',
    'u1_current_status': JSON.stringify({ adminTags: ['vip'], lastUpdated: '2024-01-10' })
  }
  const env = {
    USER_METADATA_KV: {
      get: jest.fn(async key => store[key] || null),
      list: jest.fn(async () => ({ keys: [{ name: 'u1_initial_answers' }] })),
      put: jest.fn(async (key, val) => { store[key] = val })
    }
  }
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  const res = await handleListClientsRequest({}, env)
  expect(env.USER_METADATA_KV.list).toHaveBeenCalled()
  expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('all_user_ids', JSON.stringify(['u1']))
  expect(JSON.parse(store.all_user_ids)).toEqual(['u1'])
  expect(logSpy).toHaveBeenCalledWith('Rebuilt all_user_ids index with 1 entries')
  logSpy.mockRestore()
  expect(res.success).toBe(true)
  expect(res.clients).toEqual([
    {
      userId: 'u1',
      name: 'Иван',
      email: 'ivan@example.com',
      registrationDate: '2024-01-02',
      status: 'ready',
      tags: ['vip'],
      lastUpdated: '2024-01-10'
    }
  ])
})

test('handleDeleteClientRequest премахва userId и ключове', async () => {
  const store = {
    all_user_ids: JSON.stringify(['u1', 'u2']),
    'credential_u1': JSON.stringify({ userId: 'u1', email: 'x@y.bg' }),
    'email_to_uuid_x@y.bg': 'u1',
    'u1_profile': 'p',
    'u1_initial_answers': 'a',
    'plan_status_u1': 's',
    'u1_current_status': 'c'
  }
  const env = {
    USER_METADATA_KV: {
      get: jest.fn(async key => store[key] || null),
      put: jest.fn(async (key, val) => { store[key] = val }),
      delete: jest.fn(async key => { delete store[key] })
    }
  }
  const req = { json: async () => ({ userId: 'u1' }) }
  const res = await handleDeleteClientRequest(req, env)
  expect(res.success).toBe(true)
  expect(JSON.parse(store['all_user_ids'])).toEqual(['u2'])
  expect(store['credential_u1']).toBeUndefined()
  expect(store['email_to_uuid_x@y.bg']).toBeUndefined()
  expect(store['u1_profile']).toBeUndefined()
})
