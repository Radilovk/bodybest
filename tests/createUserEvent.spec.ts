import { jest } from '@jest/globals';
import { createUserEvent } from '../worker.js';

describe('createUserEvent - pending план модификации', () => {
  test('връща съобщение и пропуска list при активен pending флаг', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async key => (key === 'pending_plan_mod_user-1' ? '{}' : null)),
        list: jest.fn(async () => ({ keys: [] })),
        put: jest.fn(),
        delete: jest.fn()
      }
    };

    const result = await createUserEvent('planMod', 'user-1', { причина: 'адаптация' }, env);

    expect(result).toEqual({
      success: false,
      message: 'Вече има чакаща заявка за промяна на плана.'
    });
    expect(env.USER_METADATA_KV.list).not.toHaveBeenCalled();
    expect(env.USER_METADATA_KV.get).toHaveBeenCalledWith('pending_plan_mod_user-1');
  });
});
