import { jest } from '@jest/globals';
import { processPendingUserEvents } from '../../worker.js';

describe('planMod updates foodPreference', () => {
  test('updates initial_answers and regenerates plan when vegan keyword present', async () => {
    const initialAnswers = { name: 'Test', foodPreference: 'Нямам' };
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u1_1' }] }),
        get: jest.fn(key => {
          if (key === 'event_planMod_u1_1') {
            return Promise.resolve(JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: { description: 'Искам веган режим' } }));
          }
          if (key === 'u1_initial_answers') {
            return Promise.resolve(JSON.stringify(initialAnswers));
          }
          return Promise.resolve(null);
        }),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await processPendingUserEvents(env, ctx, 5);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_initial_answers', JSON.stringify({ ...initialAnswers, foodPreference: 'Веган режим' }));
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  test('updates foodPreference when description contains "gluten free"', async () => {
    const initialAnswers = { name: 'Test', foodPreference: 'Нямам' };
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u2_1' }] }),
        get: jest.fn(key => {
          if (key === 'event_planMod_u2_1') {
            return Promise.resolve(JSON.stringify({ type: 'planMod', userId: 'u2', createdTimestamp: 1, payload: { description: 'Prefer gluten free meals' } }));
          }
          if (key === 'u2_initial_answers') {
            return Promise.resolve(JSON.stringify(initialAnswers));
          }
          return Promise.resolve(null);
        }),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await processPendingUserEvents(env, ctx, 5);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u2_initial_answers', JSON.stringify({ ...initialAnswers, foodPreference: 'Безглутенов режим' }));
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });
});
