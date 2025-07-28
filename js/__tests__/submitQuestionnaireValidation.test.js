import { jest } from '@jest/globals';
import { handleSubmitQuestionnaire, handleSubmitDemoQuestionnaire } from '../../worker.js';

const makeEnv = () => ({
  USER_METADATA_KV: {
    get: jest.fn(async key => (key === 'email_to_uuid_a@b.bg' ? 'u1' : null)),
    put: jest.fn()
  }
});

const baseData = {
  email: 'a@b.bg',
  gender: 'Мъж',
  age: 30,
  height: 180,
  weight: 80,
  goal: 'Поддържане',
  medicalConditions: ['Нямам']
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  if (global.fetch && global.fetch.mockRestore) global.fetch.mockRestore();
});

describe('questionnaire field validation', () => {
  const fields = ['gender', 'age', 'height', 'weight', 'goal', 'medicalConditions'];

  test.each(fields)('handleSubmitQuestionnaire fails when %s is missing', async field => {
    const data = { ...baseData };
    delete data[field];
    const env = makeEnv();
    const req = { json: async () => data };
    const res = await handleSubmitQuestionnaire(req, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test.each(fields)('handleSubmitQuestionnaire fails when %s is empty', async field => {
    const data = { ...baseData, [field]: field === 'medicalConditions' ? [] : '' };
    const env = makeEnv();
    const req = { json: async () => data };
    const res = await handleSubmitQuestionnaire(req, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test.each(fields)('handleSubmitDemoQuestionnaire fails when %s is missing', async field => {
    const data = { ...baseData };
    delete data[field];
    const env = makeEnv();
    const req = { json: async () => data };
    const res = await handleSubmitDemoQuestionnaire(req, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test.each(fields)('handleSubmitDemoQuestionnaire fails when %s is empty', async field => {
    const data = { ...baseData, [field]: field === 'medicalConditions' ? [] : '' };
    const env = makeEnv();
    const req = { json: async () => data };
    const res = await handleSubmitDemoQuestionnaire(req, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });
});
