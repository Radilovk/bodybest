/**
 * safeStorage.test.js
 * Tests за SafeStorage quota handling
 */

import { SafeStorage, safeSetItem, safeGetItem, safeRemoveItem } from '../safeStorage.js';

describe('SafeStorage Quota Handling', () => {
  let storage;
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      data: {},
      getItem(key) {
        return this.data[key] || null;
      },
      setItem(key, value) {
        // Simulate quota exceeded for large values
        if (JSON.stringify(value).length > 100) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          error.code = 22;
          throw error;
        }
        this.data[key] = value;
      },
      removeItem(key) {
        delete this.data[key];
      },
      clear() {
        this.data = {};
      },
      get length() {
        return Object.keys(this.data).length;
      },
      hasOwnProperty(key) {
        return key in this.data;
      }
    };

    global.localStorage = mockLocalStorage;
    storage = new SafeStorage();

    // Mock IndexedDB availability
    global.indexedDB = {
      open: jest.fn()
    };

    // Reset quota warning flag
    storage.quotaWarningShown = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Operations', () => {
    test('should set and get items successfully', () => {
      const result = storage.setItem('test', 'value');
      expect(result.success).toBe(true);

      const value = storage.getItem('test');
      expect(value).toBe('value');
    });

    test('should handle JSON serialization', () => {
      const data = { name: 'John', age: 30 };
      storage.setItem('user', data);

      const retrieved = storage.getItem('user');
      expect(retrieved).toEqual(data);
    });

    test('should return default value for missing keys', () => {
      const value = storage.getItem('missing', 'default');
      expect(value).toBe('default');
    });

    test('should remove items', () => {
      storage.setItem('test', 'value');
      expect(storage.getItem('test')).toBe('value');

      const result = storage.removeItem('test');
      expect(result.success).toBe(true);
      expect(storage.getItem('test')).toBeNull();
    });
  });

  describe('Quota Exceeded Handling', () => {
    test('should catch QuotaExceededError', () => {
      const largeData = 'x'.repeat(150); // Exceeds mock quota
      
      const result = storage.setItem('large', largeData);
      
      // Should not throw, but return error
      expect(result.success).toBe(false);
      expect(result.error).toBe('quota_exceeded');
    });

    test('should attempt eviction on quota error for non-critical data', () => {
      // Add some non-critical entries
      mockLocalStorage.data = {
        'noncritical1': JSON.stringify({ timestamp: Date.now() - 10000, data: 'old' }),
        'noncritical2': JSON.stringify({ timestamp: Date.now() - 5000, data: 'newer' }),
        'theme': 'dark', // Critical key
        'authToken': 'token123' // Critical key
      };

      // Mock setItem to succeed on second attempt (after eviction)
      let callCount = 0;
      const originalSetItem = mockLocalStorage.setItem.bind(mockLocalStorage);
      mockLocalStorage.setItem = jest.fn((key, value) => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        // Second call succeeds
        mockLocalStorage.data[key] = value;
      });

      const largeData = 'x'.repeat(150);
      const result = storage.setItem('newData', largeData, { critical: false });

      // Should succeed after eviction
      expect(result.success).toBe(true);
      expect(result.evicted).toBeGreaterThan(0);
    });

    test('should not evict critical keys', () => {
      const evicted = storage.evictOldEntries('currentKey');
      
      // Should not remove critical keys
      expect(mockLocalStorage.data['theme']).toBeDefined();
      expect(mockLocalStorage.data['authToken']).toBeDefined();
    });

    test('should evict oldest entries first', () => {
      // Add entries with different timestamps
      mockLocalStorage.data = {
        'old1': JSON.stringify({ timestamp: 1000, data: 'oldest' }),
        'old2': JSON.stringify({ timestamp: 2000, data: 'old' }),
        'new1': JSON.stringify({ timestamp: 3000, data: 'newer' }),
        'new2': JSON.stringify({ timestamp: 4000, data: 'newest' })
      };

      storage.evictOldEntries('test');

      // Should remove oldest entries first
      // At least old1 should be removed
      expect(mockLocalStorage.data['old1']).toBeUndefined();
    });
  });

  describe('IndexedDB Fallback', () => {
    test('should attempt IndexedDB fallback when available', async () => {
      storage.indexedDBAvailable = true;

      // Mock IndexedDB open
      const mockDB = {
        objectStoreNames: {
          contains: () => false
        },
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            put: jest.fn(() => ({
              onsuccess: null,
              onerror: null
            }))
          }))
        }))
      };

      global.indexedDB.open = jest.fn(() => ({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      }));

      const result = await storage.fallbackToIndexedDB('key', 'value');
      
      // Should attempt IndexedDB
      expect(global.indexedDB.open).toHaveBeenCalled();
    });

    test('should return error when IndexedDB is unavailable', async () => {
      storage.indexedDBAvailable = false;

      const largeData = 'x'.repeat(150);
      const result = storage.setItem('large', largeData, { critical: false });

      expect(result.success).toBe(false);
    });
  });

  describe('Storage Size Estimation', () => {
    test('should estimate storage size', () => {
      mockLocalStorage.data = {
        'key1': 'value1',
        'key2': 'value2value2',
        'key3': 'value3value3value3'
      };

      const sizeInfo = storage.estimateStorageSize();

      expect(sizeInfo.used).toBeGreaterThan(0);
      expect(sizeInfo.usedKB).toBeDefined();
      expect(sizeInfo.percentage).toBeDefined();
    });

    test('should handle empty storage', () => {
      mockLocalStorage.data = {};

      const sizeInfo = storage.estimateStorageSize();

      expect(sizeInfo.used).toBe(0);
      expect(sizeInfo.usedKB).toBe('0');
    });
  });

  describe('Warning Events', () => {
    test('should dispatch quota warning event', (done) => {
      window.addEventListener('storage-quota-warning', (event) => {
        expect(event.detail.message).toBeDefined();
        expect(event.detail.failed).toBeDefined();
        done();
      });

      storage.showQuotaWarning(2, false);
    });

    test('should show warning only once per session', () => {
      const events = [];
      window.addEventListener('storage-quota-warning', (event) => {
        events.push(event);
      });

      storage.showQuotaWarning(1, false);
      storage.showQuotaWarning(2, false);
      storage.showQuotaWarning(3, false);

      // Should only fire once
      expect(events.length).toBe(1);
    });
  });

  describe('Convenience Functions', () => {
    test('safeSetItem should work', () => {
      const result = safeSetItem('test', 'value');
      expect(result.success).toBe(true);
    });

    test('safeGetItem should work', () => {
      mockLocalStorage.data['test'] = 'value';
      const value = safeGetItem('test');
      expect(value).toBe('value');
    });

    test('safeRemoveItem should work', () => {
      mockLocalStorage.data['test'] = 'value';
      const result = safeRemoveItem('test');
      expect(result.success).toBe(true);
      expect(mockLocalStorage.data['test']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle getItem errors gracefully', () => {
      mockLocalStorage.getItem = jest.fn(() => {
        throw new Error('Storage error');
      });

      const value = storage.getItem('test', 'default');
      expect(value).toBe('default');
    });

    test('should handle JSON parse errors', () => {
      mockLocalStorage.data['invalid'] = '{invalid json}';

      const value = storage.getItem('invalid');
      // Should return as string if JSON parse fails
      expect(typeof value).toBe('string');
    });

    test('should handle removeItem errors', () => {
      mockLocalStorage.removeItem = jest.fn(() => {
        throw new Error('Remove error');
      });

      const result = storage.removeItem('test');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Critical Data Protection', () => {
    test('should not evict critical data even on quota error', () => {
      mockLocalStorage.data = {
        'theme': 'dark',
        'authToken': 'token123',
        'userId': 'user456'
      };

      storage.evictOldEntries('test');

      // Critical keys should still exist
      expect(mockLocalStorage.data['theme']).toBe('dark');
      expect(mockLocalStorage.data['authToken']).toBe('token123');
      expect(mockLocalStorage.data['userId']).toBe('user456');
    });

    test('should mark critical items explicitly', () => {
      const largeData = 'x'.repeat(150);
      
      // Mock to always fail
      mockLocalStorage.setItem = jest.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const result = storage.setItem('critical', largeData, { 
        critical: true,
        showWarning: false
      });

      // Should fail but not attempt eviction for critical data
      expect(result.success).toBe(false);
    });
  });
});
