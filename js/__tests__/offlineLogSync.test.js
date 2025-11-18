// offlineLogSync.test.js - Тестове за offline log синхронизация
import { jest } from '@jest/globals';
import { OfflineLogSync, getOfflineLogSync, resetOfflineLogSync } from '../offlineLogSync.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true
});

describe('OfflineLogSync', () => {
  let sync;

  beforeEach(() => {
    localStorage.clear();
    fetch.mockClear();
    navigator.onLine = true;
    sync = new OfflineLogSync({ 
      storageKey: 'test_logs',
      syncInterval: 1000,
      maxBatchSize: 10
    });
  });

  afterEach(() => {
    if (sync) {
      sync.stopAutoSync();
    }
  });

  describe('addLog', () => {
    test('трябва да добави лог в localStorage', async () => {
      const logData = {
        userId: 'test_user',
        date: '2025-11-18',
        note: 'Test note'
      };

      const result = await sync.addLog(logData);

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.synced).toBe(false);

      const pending = sync.getPendingLogs();
      expect(pending.length).toBe(1);
      expect(pending[0].userId).toBe('test_user');
      expect(pending[0].note).toBe('Test note');
    });

    test('трябва да генерира уникални ID-та', async () => {
      await sync.addLog({ userId: 'user1' });
      await sync.addLog({ userId: 'user2' });

      const pending = sync.getPendingLogs();
      expect(pending.length).toBe(2);
      expect(pending[0].id).not.toBe(pending[1].id);
    });

    test('трябва да маркира логовете като pending', async () => {
      await sync.addLog({ userId: 'test_user' });

      const pending = sync.getPendingLogs();
      expect(pending[0].syncStatus).toBe('pending');
    });
  });

  describe('getPendingLogs', () => {
    test('трябва да върне празен масив при липса на логове', () => {
      const pending = sync.getPendingLogs();
      expect(pending).toEqual([]);
    });

    test('трябва да върне всички pending логове', async () => {
      await sync.addLog({ userId: 'user1' });
      await sync.addLog({ userId: 'user2' });
      await sync.addLog({ userId: 'user3' });

      const pending = sync.getPendingLogs();
      expect(pending.length).toBe(3);
    });

    test('трябва да обработи невалиден JSON', () => {
      localStorage.setItem('test_logs', 'invalid json');
      const pending = sync.getPendingLogs();
      expect(pending).toEqual([]);
    });
  });

  describe('syncPendingLogs', () => {
    test('трябва да синхронизира pending логове успешно', async () => {
      // Disable immediate sync for this test
      navigator.onLine = false;
      await sync.addLog({ userId: 'test_user', note: 'Test' });
      navigator.onLine = true;

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await sync.syncPendingLogs('/api/batch-log');

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(sync.getPendingLogs().length).toBe(0);
    });

    test('не трябва да синхронизира при offline', async () => {
      navigator.onLine = false;
      await sync.addLog({ userId: 'test_user' });

      const result = await sync.syncPendingLogs('/api/batch-log');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Offline - sync postponed');
      expect(sync.getPendingLogs().length).toBe(1);
    });

    test('трябва да разделя големи batch-ове', async () => {
      // Disable immediate sync
      navigator.onLine = false;
      
      // Mock успешен отговор за всеки batch
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Добавяме 25 лога (ще се разделят на 3 batch-a по 10, 10, 5)
      for (let i = 0; i < 25; i++) {
        await sync.addLog({ userId: 'test_user', note: `Log ${i}` });
      }

      navigator.onLine = true;
      const result = await sync.syncPendingLogs('/api/batch-log');

      expect(result.success).toBe(true);
      expect(result.synced).toBe(25);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    test('трябва да спре синхронизацията при грешка', async () => {
      // Disable immediate sync
      navigator.onLine = false;

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockRejectedValueOnce(new Error('Network error'));

      // Добавяме 15 лога (2 batch-a)
      for (let i = 0; i < 15; i++) {
        await sync.addLog({ userId: 'test_user', note: `Log ${i}` });
      }

      navigator.onLine = true;
      const result = await sync.syncPendingLogs('/api/batch-log');

      expect(result.success).toBe(false);
      expect(result.synced).toBe(10); // Само първия batch е синхронизиран
      expect(result.errors).toBeDefined();
      expect(sync.getPendingLogs().length).toBe(5); // Останалите 5 остават
    });

    test('не трябва да стартира нова синхронизация докато тече друга', async () => {
      // Disable immediate sync
      navigator.onLine = false;
      await sync.addLog({ userId: 'test_user' });
      navigator.onLine = true;

      // Mock бавен отговор
      fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => 
            resolve({ ok: true, json: async () => ({ success: true }) }), 
            100
          )
        )
      );

      const promise1 = sync.syncPendingLogs('/api/batch-log');
      const promise2 = sync.syncPendingLogs('/api/batch-log');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.message).toBe('Sync already in progress');
    });
  });

  describe('removeSyncedLogs', () => {
    test('трябва да премахне синхронизираните логове', async () => {
      await sync.addLog({ userId: 'user1' });
      await sync.addLog({ userId: 'user2' });
      await sync.addLog({ userId: 'user3' });

      const pending = sync.getPendingLogs();
      const idsToRemove = [pending[0].id, pending[2].id];

      sync.removeSyncedLogs(idsToRemove);

      const remaining = sync.getPendingLogs();
      expect(remaining.length).toBe(1);
      expect(remaining[0].userId).toBe('user2');
    });
  });

  describe('hasPendingLogs & getPendingCount', () => {
    test('трябва да проверява наличието на pending логове', async () => {
      expect(sync.hasPendingLogs()).toBe(false);
      expect(sync.getPendingCount()).toBe(0);

      await sync.addLog({ userId: 'test_user' });

      expect(sync.hasPendingLogs()).toBe(true);
      expect(sync.getPendingCount()).toBe(1);
    });
  });

  describe('autoSync', () => {
    test('трябва да стартира автоматична синхронизация', async () => {
      // Disable auto sync in addLog
      navigator.onLine = false;
      await sync.addLog({ userId: 'test_user' });
      
      navigator.onLine = true;
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      sync.startAutoSync('/api/batch-log');
      
      // Wait a bit for initial sync
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fetch).toHaveBeenCalled();
      sync.stopAutoSync();
    });

    test('не трябва да стартира нов таймер ако вече е стартиран', () => {
      sync.startAutoSync('/api/batch-log');
      const timer1 = sync.syncTimer;
      
      sync.startAutoSync('/api/batch-log');
      const timer2 = sync.syncTimer;

      expect(timer1).toBe(timer2);
      sync.stopAutoSync();
    });
  });

  describe('cleanupOldLogs', () => {
    test('трябва да запази само последните 100 записа', async () => {
      // Disable auto sync
      navigator.onLine = false;
      
      // Manually build the pending logs array
      const logs = [];
      for (let i = 0; i < 150; i++) {
        logs.push({
          userId: 'test_user',
          note: `Log ${i}`,
          id: `log-${i}`,
          timestamp: Date.now() + i,
          syncStatus: 'pending'
        });
      }
      sync.savePendingLogs(logs);

      sync.cleanupOldLogs();

      const remaining = sync.getPendingLogs();
      expect(remaining.length).toBe(100);
      // Проверяваме че са останали последните
      expect(remaining[99].note).toBe('Log 149');
    });
  });

  describe('clearAllPending', () => {
    test('трябва да изчисти всички pending логове', async () => {
      await sync.addLog({ userId: 'user1' });
      await sync.addLog({ userId: 'user2' });

      sync.clearAllPending();

      expect(sync.getPendingLogs().length).toBe(0);
    });
  });

  describe('exportPendingLogs', () => {
    test('трябва да експортира информация за логовете', async () => {
      // Disable auto sync
      navigator.onLine = false;
      await sync.addLog({ userId: 'user1' });
      await sync.addLog({ userId: 'user2' });

      const exported = sync.exportPendingLogs();

      expect(exported.count).toBe(2);
      expect(exported.totalSize).toBeGreaterThan(0);
      expect(exported.oldestTimestamp).toBeDefined();
      expect(exported.newestTimestamp).toBeDefined();
      expect(exported.logs.length).toBe(2);
    });
  });
});

describe('getOfflineLogSync singleton', () => {
  beforeEach(() => {
    resetOfflineLogSync();
    localStorage.clear();
  });

  afterEach(() => {
    resetOfflineLogSync();
  });

  test('трябва да върне singleton инстанция', () => {
    const instance1 = getOfflineLogSync();
    const instance2 = getOfflineLogSync();

    expect(instance1).toBe(instance2);
  });

  test('трябва да използва конфигурацията от първото извикване', () => {
    const instance1 = getOfflineLogSync({ storageKey: 'custom_key' });
    const instance2 = getOfflineLogSync({ storageKey: 'other_key' });

    expect(instance1.storageKey).toBe('custom_key');
    expect(instance2.storageKey).toBe('custom_key'); // Използва първата конфигурация
  });

  test('resetOfflineLogSync трябва да изчисти инстанцията', () => {
    const instance1 = getOfflineLogSync();
    resetOfflineLogSync();
    const instance2 = getOfflineLogSync();

    expect(instance1).not.toBe(instance2);
  });
});
