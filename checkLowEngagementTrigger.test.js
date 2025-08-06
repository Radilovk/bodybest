import { jest } from '@jest/globals';
import { checkLowEngagementTrigger } from './worker.js';

describe('checkLowEngagementTrigger', () => {
  test('връща false при нов план', async () => {
    const userId = 'u1';
    const now = Date.now();
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => {
          if (key === `${userId}_last_significant_update_ts`) {
            return String(now - 24 * 60 * 60 * 1000); // 1 ден
          }
          return null;
        }),
        list: jest.fn(async () => ({ keys: [] })),
      },
    };
    await expect(checkLowEngagementTrigger(userId, env)).resolves.toBe(false);
  });

  test('връща false при липса на дневници', async () => {
    const userId = 'u2';
    const now = Date.now();
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => {
          if (key === `${userId}_last_significant_update_ts`) {
            return String(now - 10 * 24 * 60 * 60 * 1000); // 10 дни
          }
          return null;
        }),
        list: jest.fn(async () => ({ keys: [] })),
      },
    };
    await expect(checkLowEngagementTrigger(userId, env)).resolves.toBe(false);
  });

  test('връща true при стари дневници', async () => {
    const userId = 'u3';
    const now = Date.now();
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => {
          if (key === `${userId}_last_significant_update_ts`) {
            return String(now - 30 * 24 * 60 * 60 * 1000); // 30 дни
          }
          const eightDaysAgo = new Date();
          eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
          if (key === `${userId}_log_${eightDaysAgo.toISOString().split('T')[0]}`) {
            return 'exists';
          }
          return null;
        }),
        list: jest.fn(async () => ({ keys: [{ name: 'dummy' }] })),
      },
    };
    await expect(checkLowEngagementTrigger(userId, env)).resolves.toBe(true);
  });
});
