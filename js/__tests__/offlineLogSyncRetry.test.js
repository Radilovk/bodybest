/**
 * offlineLogSyncRetry.test.js
 * Tests за retry механизъм с exponential backoff
 */

import { OfflineLogSync } from '../offlineLogSync.js';

describe('OfflineLogSync Retry and Backoff', () => {
  let syncManager;
  let mockFetch;

  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    // Mock navigator.onLine
    Object.defineProperty(global.navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Create sync manager
    syncManager = new OfflineLogSync({
      storageKey: 'test_logs',
      syncInterval: 1000,
      maxBatchSize: 10
    });
  });

  afterEach(() => {
    syncManager.stopAutoSync();
    jest.clearAllMocks();
  });

  describe('Exponential Backoff', () => {
    test('should calculate correct retry delays', () => {
      syncManager.consecutiveFailures = 1;
      expect(syncManager.getRetryDelay()).toBe(5000); // 5s

      syncManager.consecutiveFailures = 2;
      expect(syncManager.getRetryDelay()).toBe(10000); // 10s

      syncManager.consecutiveFailures = 3;
      expect(syncManager.getRetryDelay()).toBe(20000); // 20s

      syncManager.consecutiveFailures = 4;
      expect(syncManager.getRetryDelay()).toBe(40000); // 40s

      syncManager.consecutiveFailures = 10;
      expect(syncManager.getRetryDelay()).toBe(60000); // Max 60s
    });

    test('should not exceed max retry delay', () => {
      syncManager.consecutiveFailures = 100;
      const delay = syncManager.getRetryDelay();
      expect(delay).toBeLessThanOrEqual(60000);
    });
  });

  describe('Consecutive Failures Tracking', () => {
    test('should track consecutive failures', async () => {
      // Mock localStorage to return pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' },
        { id: 'log2', data: 'test2' }
      ]));

      // Mock fetch to fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await syncManager.syncPendingLogs();

      expect(result.success).toBe(false);
      expect(syncManager.consecutiveFailures).toBe(1);
    });

    test('should reset failures on success', async () => {
      syncManager.consecutiveFailures = 3;

      // Mock localStorage to return pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await syncManager.syncPendingLogs();

      expect(result.success).toBe(true);
      expect(syncManager.consecutiveFailures).toBe(0);
    });

    test('should increment failures on each error', async () => {
      // Mock localStorage to return pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // First failure
      mockFetch.mockRejectedValueOnce(new Error('Error 1'));
      await syncManager.syncPendingLogs();
      expect(syncManager.consecutiveFailures).toBe(1);

      // Second failure
      mockFetch.mockRejectedValueOnce(new Error('Error 2'));
      await syncManager.syncPendingLogs();
      expect(syncManager.consecutiveFailures).toBe(2);

      // Third failure
      mockFetch.mockRejectedValueOnce(new Error('Error 3'));
      await syncManager.syncPendingLogs();
      expect(syncManager.consecutiveFailures).toBe(3);
    });
  });

  describe('Failure Limit Detection', () => {
    test('should detect when failure limit is exceeded', () => {
      syncManager.consecutiveFailures = 2;
      expect(syncManager.hasExceededFailureLimit()).toBe(false);

      syncManager.consecutiveFailures = 3;
      expect(syncManager.hasExceededFailureLimit()).toBe(true);

      syncManager.consecutiveFailures = 5;
      expect(syncManager.hasExceededFailureLimit()).toBe(true);
    });

    test('should allow manual reset of failure counter', () => {
      syncManager.consecutiveFailures = 5;
      expect(syncManager.hasExceededFailureLimit()).toBe(true);

      syncManager.resetFailureCounter();
      expect(syncManager.consecutiveFailures).toBe(0);
      expect(syncManager.hasExceededFailureLimit()).toBe(false);
    });
  });

  describe('Status Change Callbacks', () => {
    test('should call onSyncStatusChange with correct statuses', async () => {
      const statusChanges = [];
      
      syncManager = new OfflineLogSync({
        onSyncStatusChange: (status) => {
          statusChanges.push(status);
        }
      });

      // Mock pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // Successful sync
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await syncManager.syncPendingLogs();

      expect(statusChanges).toContain('syncing');
      expect(statusChanges).toContain('online');
    });

    test('should call onSyncStatusChange with error on failure', async () => {
      const statusChanges = [];
      
      syncManager = new OfflineLogSync({
        onSyncStatusChange: (status) => {
          statusChanges.push(status);
        }
      });

      // Mock pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // Failed sync
      mockFetch.mockRejectedValue(new Error('Network error'));

      await syncManager.syncPendingLogs();

      expect(statusChanges).toContain('syncing');
      expect(statusChanges).toContain('error');
    });

    test('should call onSyncStatusChange with offline when no connection', async () => {
      const statusChanges = [];
      
      syncManager = new OfflineLogSync({
        onSyncStatusChange: (status) => {
          statusChanges.push(status);
        }
      });

      // Set offline
      global.navigator.onLine = false;

      await syncManager.syncPendingLogs();

      expect(statusChanges).toContain('offline');
    });
  });

  describe('Error Callback', () => {
    test('should call onSyncError with failure details', async () => {
      let errorResult = null;
      
      syncManager = new OfflineLogSync({
        onSyncError: (result) => {
          errorResult = result;
        }
      });

      // Mock pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // Failed sync
      mockFetch.mockRejectedValue(new Error('Network error'));

      await syncManager.syncPendingLogs();

      expect(errorResult).not.toBeNull();
      expect(errorResult.success).toBe(false);
      expect(errorResult.consecutiveFailures).toBe(1);
      expect(errorResult.errors).toBeDefined();
    });

    test('should include consecutiveFailures in error result', async () => {
      let errorResult = null;
      
      syncManager = new OfflineLogSync({
        onSyncError: (result) => {
          errorResult = result;
        }
      });

      syncManager.consecutiveFailures = 2;

      // Mock pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // Failed sync
      mockFetch.mockRejectedValue(new Error('Network error'));

      await syncManager.syncPendingLogs();

      expect(errorResult.consecutiveFailures).toBe(3);
    });
  });

  describe('Retry Scheduling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should schedule retry after failure', async () => {
      // Mock pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await syncManager.syncPendingLogs('/api/batch-log');

      expect(syncManager.retryTimer).not.toBeNull();
    });

    test('should clear existing retry timer when scheduling new one', async () => {
      // Mock pending logs
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'log1', data: 'test1' }
      ]));

      // Set up an existing timer
      const oldTimer = setTimeout(() => {}, 1000);
      syncManager.retryTimer = oldTimer;

      // Fail sync
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await syncManager.syncPendingLogs('/api/batch-log');

      // Should have cleared old timer and created new one
      expect(syncManager.retryTimer).not.toBe(oldTimer);
    });
  });

  describe('Cleanup', () => {
    test('should clear retry timer when stopping auto sync', () => {
      syncManager.retryTimer = setTimeout(() => {}, 1000);
      
      syncManager.stopAutoSync();
      
      expect(syncManager.retryTimer).toBeNull();
    });
  });
});
