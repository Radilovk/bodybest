import { jest } from '@jest/globals';
import { setPlanStatus } from '../worker.js';

describe('Registration Plan Status', () => {
  test('updatePlanUserArrays does not add pending_inputs to pending queue', async () => {
    const kvStore = new Map();
    kvStore.set('pending_plan_users', JSON.stringify(['user1', 'user2']));
    kvStore.set('ready_plan_users', JSON.stringify(['user3']));
    
    const env = {
      USER_METADATA_KV: {
        get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
        put: jest.fn(async (key, val) => {
          kvStore.set(key, val);
        })
      }
    };
    
    // Set status to pending_inputs
    await setPlanStatus('new_user', 'pending_inputs', env);
    
    // Get the updated queues
    const pendingUsers = JSON.parse(kvStore.get('pending_plan_users'));
    const readyUsers = JSON.parse(kvStore.get('ready_plan_users'));
    
    // new_user should NOT be in either queue
    expect(pendingUsers).toEqual(['user1', 'user2']);
    expect(readyUsers).toEqual(['user3']);
  });
  
  test('setPlanStatus with pending adds user to pending queue', async () => {
    const kvStore = new Map();
    kvStore.set('pending_plan_users', JSON.stringify(['user1']));
    kvStore.set('ready_plan_users', JSON.stringify([]));
    
    const env = {
      USER_METADATA_KV: {
        get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
        put: jest.fn(async (key, val) => {
          kvStore.set(key, val);
        })
      }
    };
    
    // Set status to pending (this should add to queue)
    await setPlanStatus('user2', 'pending', env);
    
    // Get the updated queue
    const pendingUsers = JSON.parse(kvStore.get('pending_plan_users'));
    
    // user2 should be added to pending queue
    expect(pendingUsers).toContain('user2');
    expect(pendingUsers.length).toBe(2);
  });
});
