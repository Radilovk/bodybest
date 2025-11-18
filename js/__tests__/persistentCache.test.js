// persistentCache.test.js - Тестове за PersistentCache
import { jest } from '@jest/globals';
import { PersistentCache, getDashboardCache, getProfileCache } from '../requestCache.js';

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

describe('PersistentCache', () => {
  let cache;

  beforeEach(() => {
    localStorage.clear();
    cache = new PersistentCache('test_cache', 1000); // 1 секунда TTL за тестове
  });

  describe('set and get', () => {
    test('трябва да запази и извлече стойност', () => {
      cache.set('key1', 'value1');
      const value = cache.get('key1');

      expect(value).toBe('value1');
    });

    test('трябва да работи с обекти', () => {
      const data = { name: 'Test', age: 25 };
      cache.set('user', data);
      const retrieved = cache.get('user');

      expect(retrieved).toEqual(data);
    });

    test('трябва да работи с масиви', () => {
      const data = [1, 2, 3, 4, 5];
      cache.set('numbers', data);
      const retrieved = cache.get('numbers');

      expect(retrieved).toEqual(data);
    });

    test('трябва да върне null за несъществуващ ключ', () => {
      const value = cache.get('nonexistent');
      expect(value).toBe(null);
    });
  });

  describe('TTL (time to live)', () => {
    test('трябва да изтрие стойността след изтичане на TTL', (done) => {
      cache.set('key1', 'value1', 100); // 100ms TTL

      expect(cache.get('key1')).toBe('value1');

      setTimeout(() => {
        expect(cache.get('key1')).toBe(null);
        done();
      }, 150);
    });

    test('трябва да използва default TTL ако не е посочен', () => {
      cache.set('key1', 'value1');
      const entry = cache.memoryCache.get('key1');

      const expectedExpiry = entry.timestamp + cache.defaultTTL;
      expect(entry.expiry).toBe(expectedExpiry);
    });

    test('трябва да позволява различни TTL за различни ключове', (done) => {
      cache.set('short', 'value1', 50);
      cache.set('long', 'value2', 200);

      setTimeout(() => {
        expect(cache.get('short')).toBe(null);
        expect(cache.get('long')).toBe('value2');
        done();
      }, 100);
    });
  });

  describe('has', () => {
    test('трябва да провери дали има валиден кеш', () => {
      expect(cache.has('key1')).toBe(false);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    test('трябва да върне false за изтекъл кеш', (done) => {
      cache.set('key1', 'value1', 50);
      expect(cache.has('key1')).toBe(true);

      setTimeout(() => {
        expect(cache.has('key1')).toBe(false);
        done();
      }, 100);
    });
  });

  describe('delete', () => {
    test('трябва да изтрие запис от кеша', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
    });

    test('трябва да работи при опит за изтриване на несъществуващ ключ', () => {
      expect(() => cache.delete('nonexistent')).not.toThrow();
    });
  });

  describe('invalidate', () => {
    test('трябва да изтрие записи съдържащи pattern', () => {
      cache.set('dashboard:user1', { data: 1 });
      cache.set('dashboard:user2', { data: 2 });
      cache.set('profile:user1', { data: 3 });

      cache.invalidate('dashboard:');

      expect(cache.has('dashboard:user1')).toBe(false);
      expect(cache.has('dashboard:user2')).toBe(false);
      expect(cache.has('profile:user1')).toBe(true);
    });

    test('трябва да работи при липса на съвпадения', () => {
      cache.set('key1', 'value1');
      cache.invalidate('nonexistent');

      expect(cache.has('key1')).toBe(true);
    });
  });

  describe('cleanupExpired', () => {
    test('трябва да изчисти изтеклите записи', (done) => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 200);
      cache.set('key3', 'value3', 200);

      setTimeout(() => {
        cache.cleanupExpired();

        expect(cache.has('key1')).toBe(false);
        expect(cache.has('key2')).toBe(true);
        expect(cache.has('key3')).toBe(true);
        done();
      }, 100);
    });

    test('не трябва да променя кеша ако няма изтекли записи', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      const sizeBefore = cache.memoryCache.size;
      cache.cleanupExpired();
      const sizeAfter = cache.memoryCache.size;

      expect(sizeBefore).toBe(sizeAfter);
    });
  });

  describe('clear', () => {
    test('трябва да изчисти целия кеш', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.memoryCache.size).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    test('трябва да запази данните в localStorage', () => {
      cache.set('key1', 'value1');

      const stored = localStorage.getItem('test_cache');
      expect(stored).toBeDefined();
      
      const parsed = JSON.parse(stored);
      expect(parsed.key1).toBeDefined();
      expect(parsed.key1.value).toBe('value1');
    });

    test('трябва да зареди данните от localStorage', () => {
      cache.set('key1', 'value1');

      // Създаваме нова инстанция
      const cache2 = new PersistentCache('test_cache', 1000);
      
      expect(cache2.get('key1')).toBe('value1');
    });

    test('трябва да пропусне изтеклите записи при зареждане', (done) => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 1000);

      setTimeout(() => {
        // Създаваме нова инстанция
        const cache2 = new PersistentCache('test_cache', 1000);

        expect(cache2.get('key1')).toBe(null);
        expect(cache2.get('key2')).toBe('value2');
        done();
      }, 100);
    });

    test('трябва да обработи невалиден JSON в localStorage', () => {
      localStorage.setItem('test_cache', 'invalid json');

      const cache2 = new PersistentCache('test_cache', 1000);
      expect(cache2.memoryCache.size).toBe(0);
    });

    test('трябва да почисти localStorage при clear', () => {
      cache.set('key1', 'value1');
      expect(localStorage.getItem('test_cache')).not.toBe(null);

      cache.clear();
      expect(localStorage.getItem('test_cache')).toBe(null);
    });
  });

  describe('getStats', () => {
    test('трябва да върне статистика за кеша', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.entries.length).toBe(2);
    });

    test('трябва да брои изтеклите записи правилно', (done) => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 200);

      setTimeout(() => {
        const stats = cache.getStats();

        expect(stats.size).toBe(2);
        expect(stats.validEntries).toBe(1);
        expect(stats.expiredEntries).toBe(1);
        done();
      }, 100);
    });
  });

  describe('quota exceeded handling', () => {
    test('трябва да обработи QuotaExceededError', () => {
      const originalSetItem = localStorage.setItem;
      let callCount = 0;

      // Mock localStorage.setItem да хвърля грешка първия път
      localStorage.setItem = jest.fn((key, value) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        originalSetItem.call(localStorage, key, value);
      });

      // Не трябва да хвърля грешка
      expect(() => cache.set('key1', 'value1')).not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });
});

describe('Cache factory functions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getDashboardCache трябва да създаде инстанция с правилни настройки', () => {
    const cache = getDashboardCache();

    expect(cache).toBeInstanceOf(PersistentCache);
    expect(cache.storageKey).toBe('bodybest_dashboard_cache');
    expect(cache.defaultTTL).toBe(300000); // 5 минути
  });

  test('getProfileCache трябва да създаде инстанция с правилни настройки', () => {
    const cache = getProfileCache();

    expect(cache).toBeInstanceOf(PersistentCache);
    expect(cache.storageKey).toBe('bodybest_profile_cache');
    expect(cache.defaultTTL).toBe(600000); // 10 минути
  });

  test('различните кешове трябва да използват различни ключове', () => {
    const dashCache = getDashboardCache();
    const profCache = getProfileCache();

    dashCache.set('data', 'dashboard');
    profCache.set('data', 'profile');

    expect(dashCache.get('data')).toBe('dashboard');
    expect(profCache.get('data')).toBe('profile');
  });
});
