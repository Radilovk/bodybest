import { jest } from '@jest/globals';
import { handleGetAchievementsRequest } from '../../worker.js';

describe('handleGetAchievementsRequest emoji sanitization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('replaces HTML in emoji with random medal and updates DB', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn().mockResolvedValue(JSON.stringify([{ title: 't', message: 'm', emoji: '<svg></svg>' }])),
        put: jest.fn().mockResolvedValue(undefined)
      }
    };
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleGetAchievementsRequest(request, env);
    expect(res.success).toBe(true);
    expect(res.achievements[0].emoji).toBe('🥇');
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_achievements', JSON.stringify([{ title: 't', message: 'm', emoji: '🥇' }]));
  });
});
