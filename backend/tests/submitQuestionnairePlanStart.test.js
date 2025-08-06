import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

describe('handleSubmitQuestionnaire', () => {
  test('стартира генериране на план веднага', async () => {
    const kvStore = new Map();
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); })
    };
    kvStore.set('email_to_uuid_test@example.com', 'u1');
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          prompt_questionnaire_analysis: 'tpl',
          model_questionnaire_analysis: '@cf/mock'
        };
        return Promise.resolve(data[key]);
      })
    };
    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      send_analysis_email: '0',
      AI: { run: jest.fn(async () => ({ response: '{}' })) }
    };
    const ctx = { waitUntil: jest.fn() };

    const request = {
      json: async () => ({
        email: 'test@example.com',
        gender: 'm',
        age: 30,
        height: 170,
        weight: 70,
        goal: 'lose',
        medicalConditions: ['none']
      })
    };

    await worker.handleSubmitQuestionnaire(request, env, ctx);

    expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
    expect(USER_METADATA_KV.put).toHaveBeenCalledWith('u1_last_significant_update_ts', expect.any(String));
  });
});
