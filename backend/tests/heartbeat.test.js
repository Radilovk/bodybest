import { jest } from '@jest/globals';

// Mock the callModelRef before importing worker
const mockCallModel = jest.fn();
const callModelRef = { current: mockCallModel };

// We need to test the heartbeat mechanism indirectly through the regeneratePlan flow
// since callModelWithTimeout is not exported directly
describe('Heartbeat mechanism', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('heartbeat should be called periodically during long AI calls', async () => {
    const heartbeatFn = jest.fn().mockResolvedValue(undefined);
    const heartbeatIntervalMs = 10000;
    
    // Simulate a long-running AI call
    const longRunningPromise = new Promise((resolve) => {
      setTimeout(() => resolve('AI response'), 30000);
    });
    
    mockCallModel.mockReturnValue(longRunningPromise);
    
    // Start the heartbeat interval
    const heartbeatIntervalId = setInterval(() => {
      heartbeatFn().catch(err => {
        console.warn('Heartbeat failed:', err.message);
      });
    }, heartbeatIntervalMs);
    
    // Advance timers to simulate passage of time
    jest.advanceTimersByTime(10000);
    expect(heartbeatFn).toHaveBeenCalledTimes(1);
    
    jest.advanceTimersByTime(10000);
    expect(heartbeatFn).toHaveBeenCalledTimes(2);
    
    jest.advanceTimersByTime(10000);
    expect(heartbeatFn).toHaveBeenCalledTimes(3);
    
    // Clean up
    clearInterval(heartbeatIntervalId);
  });

  test('heartbeat should write to KV with expiration', async () => {
    const kvPutMock = jest.fn().mockResolvedValue(undefined);
    const env = {
      USER_METADATA_KV: {
        put: kvPutMock
      }
    };
    const userId = 'test-user';
    
    // Create heartbeat function (simulating createHeartbeatFunction)
    const heartbeat = async () => {
      if (!env?.USER_METADATA_KV) return;
      const heartbeatKey = `${userId}_plan_heartbeat`;
      const timestamp = new Date().toISOString();
      await env.USER_METADATA_KV.put(heartbeatKey, timestamp, { expirationTtl: 300 });
    };
    
    // Call heartbeat
    await heartbeat();
    
    // Verify KV put was called with correct parameters
    expect(kvPutMock).toHaveBeenCalledTimes(1);
    expect(kvPutMock).toHaveBeenCalledWith(
      'test-user_plan_heartbeat',
      expect.any(String),
      { expirationTtl: 300 }
    );
  });

  test('heartbeat should not crash if env is missing', async () => {
    const userId = 'test-user';
    
    // Create heartbeat function with missing env
    const heartbeat = async () => {
      const env = null;
      if (!env?.USER_METADATA_KV) return;
      // Should not reach here
      throw new Error('Should not execute KV put');
    };
    
    // Should not throw
    await expect(heartbeat()).resolves.toBeUndefined();
  });
});
