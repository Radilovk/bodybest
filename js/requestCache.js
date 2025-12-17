// Request Cache Utility - Предотвратява дублирани заявки и кешира резултати
// Използва се за оптимизация на API заявките и намаляване на натоварването на backend

/**
 * Cache за съхранение на резултати от fetch заявки
 * @type {Map<string, {data: any, timestamp: number, promise?: Promise<any>}>}
 */
const cache = new Map();

/**
 * Map за следене на текущи заявки (за deduplication)
 * @type {Map<string, Promise<any>>}
 */
const pendingRequests = new Map();

/**
 * Конфигурация по подразбиране
 */
const DEFAULT_CONFIG = {
  ttl: 60000, // 1 минута кеш по подразбиране
  maxSize: 100, // Максимален брой записи в кеша
};

/**
 * Генерира уникален ключ за кеша на базата на URL и опции
 * @param {string} url - URL на заявката
 * @param {RequestInit} [options] - Опции на fetch заявката
 * @returns {string} - Уникален ключ за кеша
 */
function getCacheKey(url, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  // Включваме Authorization header в ключа, за да избегнем cache collision между потребители
  const authHeader = options.headers?.Authorization || options.headers?.authorization || '';
  return `${method}:${url}:${authHeader}:${body}`;
}

/**
 * Проверява дали кешираният запис е валиден
 * @param {Object} entry - Запис от кеша
 * @param {number} ttl - Time to live в милисекунди
 * @returns {boolean} - Дали записът е валиден
 */
function isValid(entry, ttl) {
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < ttl;
}

/**
 * Почиства остарели записи от кеша
 * Извиква се автоматично при достигане на определен размер
 */
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 10; // Почистване на всеки 10 заявки

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    // Използваме TTL от 5 минути за cleanup
    if (now - entry.timestamp > 300000) {
      cache.delete(key);
    }
  }
  
  // Ограничаваме размера на кеша
  if (cache.size > DEFAULT_CONFIG.maxSize) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, cache.size - DEFAULT_CONFIG.maxSize);
    toDelete.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Извършва fetch заявка с кеширане и deduplication
 * @param {string} url - URL за заявка
 * @param {Object} options - Опции
 * @param {RequestInit} [options.fetchOptions] - Опции за fetch
 * @param {number} [options.ttl] - Time to live в милисекунди
 * @param {boolean} [options.skipCache] - Пропускане на кеша
 * @returns {Promise<any>} - Promise с резултата от заявката
 */
export async function cachedFetch(url, options = {}) {
  const { fetchOptions = {}, ttl = DEFAULT_CONFIG.ttl, skipCache = false } = options;
  const cacheKey = getCacheKey(url, fetchOptions);
  
  // Ако skipCache е true, правим директна заявка
  if (skipCache) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
  
  // Проверяваме кеша
  const cached = cache.get(cacheKey);
  if (cached && isValid(cached, ttl)) {
    return cached.data;
  }
  
  // Проверяваме дали има pending заявка за същия ресурс (deduplication)
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    // Връщаме копие на pending promise за да не споделяме същата инстанция
    return pending.catch(err => {
      // Ако pending заявката е неуспешна, я преизвикваме за този caller
      pendingRequests.delete(cacheKey);
      throw err;
    });
  }
  
  // Правим нова заявка
  const requestPromise = (async () => {
    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Кешираме резултата
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
      
      // Детерминирано почистване на всеки N заявки
      cleanupCounter++;
      if (cleanupCounter >= CLEANUP_INTERVAL) {
        cleanupCounter = 0;
        cleanup();
      }
      
      return data;
    } catch (error) {
      // При грешка премахваме pending заявката, за да може следваща да опита отново
      pendingRequests.delete(cacheKey);
      throw error;
    } finally {
      // Винаги почистваме pending заявката след приключване
      pendingRequests.delete(cacheKey);
    }
  })();
  
  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Изчиства кеша за конкретен URL или целия кеш
 * @param {string} [url] - URL за изчистване (ако не е посочен, изчиства целия кеш)
 */
export function clearCache(url) {
  if (url) {
    // Изчистваме всички записи, които съдържат този URL
    for (const key of cache.keys()) {
      if (key.includes(url)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

/**
 * Дебъг функция за преглед на кеша
 * @returns {Object} - Информация за кеша
 */
export function getCacheStats() {
  return {
    size: cache.size,
    pending: pendingRequests.size,
    entries: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
    })),
  };
}

/**
 * Persistent Cache клас с localStorage поддръжка
 * Използва се за кеширане на dashboard и profile данни
 */
export class PersistentCache {
  /**
   * @param {string} storageKey - Ключ за localStorage
   * @param {number} defaultTTL - TTL по подразбиране в милисекунди (5 минути)
   */
  constructor(storageKey = 'bodybest_cache', defaultTTL = 300000) {
    this.storageKey = storageKey;
    this.defaultTTL = defaultTTL;
    this.memoryCache = new Map();
    this.loadFromStorage();
  }

  /**
   * Зарежда кеша от localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      const now = Date.now();

      // Зареждаме само валидните записи
      Object.entries(data).forEach(([key, entry]) => {
        if (entry.expiry > now) {
          this.memoryCache.set(key, entry);
        }
      });
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
      // При грешка изчистваме локалния кеш
      try {
        localStorage.removeItem(this.storageKey);
      } catch {
        // Игнорираме грешки при изчистване
      }
    }
  }

  /**
   * Записва кеша в localStorage
   */
  saveToStorage() {
    try {
      const data = Object.fromEntries(this.memoryCache);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
      
      // Ако localStorage е пълен, почистваме стари записи
      if (error.name === 'QuotaExceededError') {
        this.cleanupExpired();
        // Опитваме отново
        try {
          const data = Object.fromEntries(this.memoryCache);
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (retryError) {
          console.warn('Failed to save cache even after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Задава стойност в кеша
   * @param {string} key - Ключ
   * @param {any} value - Стойност
   * @param {number} ttl - Time to live в милисекунди
   */
  set(key, value, ttl = this.defaultTTL) {
    const entry = {
      value,
      expiry: Date.now() + ttl,
      timestamp: Date.now()
    };
    
    this.memoryCache.set(key, entry);
    this.saveToStorage();
  }

  /**
   * Извлича стойност от кеша
   * @param {string} key - Ключ
   * @returns {any} Кешираната стойност или null ако не е намерена/изтекла
   */
  get(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiry < now) {
      // Изтекъл запис - изчистваме го
      this.memoryCache.delete(key);
      this.saveToStorage();
      return null;
    }

    return entry.value;
  }

  /**
   * Проверява дали има кеширана стойност
   * @param {string} key - Ключ
   * @returns {boolean} True ако има валиден кеш
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Премахва запис от кеша
   * @param {string} key - Ключ
   */
  delete(key) {
    const deleted = this.memoryCache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
  }

  /**
   * Invalidate записи, които съдържат даден pattern в ключа
   * @param {string} pattern - Pattern за търсене в ключовете
   */
  invalidate(pattern) {
    let hasChanges = false;
    
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      this.saveToStorage();
    }
  }

  /**
   * Изчиства всички изтекли записи
   */
  cleanupExpired() {
    const now = Date.now();
    let hasChanges = false;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiry < now) {
        this.memoryCache.delete(key);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.saveToStorage();
    }
  }

  /**
   * Изчиства целия кеш
   */
  clear() {
    this.memoryCache.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear cache storage:', error);
    }
  }

  /**
   * Връща статистика за кеша
   * @returns {Object} Статистика
   */
  getStats() {
    const entries = Array.from(this.memoryCache.entries());
    const now = Date.now();
    
    return {
      size: this.memoryCache.size,
      validEntries: entries.filter(([, entry]) => entry.expiry > now).length,
      expiredEntries: entries.filter(([, entry]) => entry.expiry <= now).length,
      totalSize: JSON.stringify(Object.fromEntries(this.memoryCache)).length,
      entries: entries.map(([key, entry]) => ({
        key,
        age: now - entry.timestamp,
        ttl: entry.expiry - now,
        expired: entry.expiry <= now
      }))
    };
  }
}

/**
 * Създава и връща инстанция на PersistentCache за dashboard данни
 * @returns {PersistentCache}
 */
export function getDashboardCache() {
  return new PersistentCache('bodybest_dashboard_cache', 300000); // 5 минути TTL
}

/**
 * Създава и връща инстанция на PersistentCache за profile данни
 * @returns {PersistentCache}
 */
export function getProfileCache() {
  return new PersistentCache('bodybest_profile_cache', 300000); // 5 минути TTL
}

/**
 * Създава и връща инстанция на PersistentCache за analytics данни
 * @returns {PersistentCache}
 */
export function getAnalyticsCache() {
  return new PersistentCache('bodybest_analytics_cache', 900000); // 15 минути TTL
}
