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
  return `${method}:${url}:${body}`;
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
 */
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
    return pending;
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
      
      // Периодично почистване
      if (Math.random() < 0.1) {
        cleanup();
      }
      
      return data;
    } finally {
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
