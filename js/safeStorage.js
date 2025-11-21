// safeStorage.js - Safe localStorage wrapper with quota handling
// Осигурява безопасно записване в localStorage с fallback механизми

/**
 * Safe Storage Helper
 * Wraps localStorage operations with error handling and quota management
 */
export class SafeStorage {
  constructor() {
    this.storageType = 'localStorage';
    this.quotaWarningShown = false;
    this.indexedDBAvailable = this.checkIndexedDBSupport();
  }

  /**
   * Проверява дали IndexedDB е наличен
   * @returns {boolean}
   */
  checkIndexedDBSupport() {
    try {
      return typeof indexedDB !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Оценява размера на данните в localStorage
   * @returns {Object} Обект с size и percentage
   */
  estimateStorageSize() {
    let totalSize = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += key.length + (localStorage.getItem(key)?.length || 0);
        }
      }
      // Предполагаме ~5MB лимит (varies by browser)
      const estimatedLimit = 5 * 1024 * 1024;
      return {
        used: totalSize,
        usedKB: (totalSize / 1024).toFixed(2),
        percentage: ((totalSize / estimatedLimit) * 100).toFixed(1),
        estimatedLimit
      };
    } catch (error) {
      console.warn('Could not estimate storage size:', error);
      return { used: 0, usedKB: '0', percentage: '0', estimatedLimit: 0 };
    }
  }

  /**
   * Безопасно записва данни в localStorage
   * @param {string} key - Ключ
   * @param {*} value - Стойност (ще бъде serialized)
   * @param {Object} options - Опции
   * @returns {Object} Резултат с success флаг
   */
  setItem(key, value, options = {}) {
    const { 
      critical = false, // Дали данните са критични
      showWarning = true // Дали да показва warning UI
    } = options;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return { success: true };
    } catch (error) {
      console.error(`SafeStorage: Failed to set item "${key}":`, error);

      // Handle QuotaExceededError
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        console.warn('localStorage quota exceeded');
        
        // Опитай да почистиш най-старите некритични записи
        if (!critical) {
          const evicted = this.evictOldEntries(key);
          if (evicted > 0) {
            // Опитай отново след cleanup
            try {
              const serialized = typeof value === 'string' ? value : JSON.stringify(value);
              localStorage.setItem(key, serialized);
              
              if (showWarning) {
                this.showQuotaWarning(evicted);
              }
              
              return { success: true, evicted };
            } catch (retryError) {
              console.error('Failed even after eviction:', retryError);
            }
          }
        }

        // Ако IndexedDB е наличен, опитай там
        if (this.indexedDBAvailable && !critical) {
          return this.fallbackToIndexedDB(key, value);
        }

        if (showWarning) {
          this.showQuotaWarning(0, true);
        }

        return { 
          success: false, 
          error: 'quota_exceeded',
          message: 'Локалното хранилище е пълно'
        };
      }

      return { 
        success: false, 
        error: error.name,
        message: error.message
      };
    }
  }

  /**
   * Извлича данни от localStorage
   * @param {string} key - Ключ
   * @param {*} defaultValue - Default стойност
   * @returns {*} Стойност или defaultValue
   */
  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      
      // Опитай да parse-нем като JSON
      try {
        return JSON.parse(item);
      } catch {
        // Ако не е JSON, върни като string
        return item;
      }
    } catch (error) {
      console.warn(`SafeStorage: Failed to get item "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Премахва запис от localStorage
   * @param {string} key - Ключ
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      console.error(`SafeStorage: Failed to remove item "${key}":`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Изтрива най-старите некритични записи
   * @param {string} currentKey - Текущият ключ който се опитваме да запишем
   * @returns {number} Брой изтрити записи
   */
  evictOldEntries(currentKey) {
    const criticalKeys = [
      'theme',
      'authToken',
      'userId',
      'colorThemes',
      'bodybest_onboarding_complete'
    ];

    const candidates = [];
    
    try {
      // Събираме всички некритични записи със timestamps
      for (let key in localStorage) {
        if (!localStorage.hasOwnProperty(key)) continue;
        if (criticalKeys.includes(key)) continue;
        if (key === currentKey) continue;
        
        try {
          const value = localStorage.getItem(key);
          let timestamp = Date.now();
          
          // Опитай да извлечем timestamp от данните
          try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.timestamp) {
              timestamp = parsed.timestamp;
            }
          } catch {
            // Не е JSON или няма timestamp
          }
          
          candidates.push({ key, timestamp });
        } catch {
          // Skip този запис
        }
      }

      // Сортираме по timestamp (най-старите първи)
      candidates.sort((a, b) => a.timestamp - b.timestamp);

      // Изтриваме до 30% от некритичните записи
      const toEvict = Math.max(1, Math.floor(candidates.length * 0.3));
      let evicted = 0;

      for (let i = 0; i < toEvict && i < candidates.length; i++) {
        try {
          localStorage.removeItem(candidates[i].key);
          evicted++;
        } catch {
          // Skip
        }
      }

      console.log(`SafeStorage: Evicted ${evicted} old entries`);
      return evicted;
    } catch (error) {
      console.error('SafeStorage: Error during eviction:', error);
      return 0;
    }
  }

  /**
   * Fallback към IndexedDB за по-големи данни
   * @param {string} key - Ключ
   * @param {*} value - Стойност
   * @returns {Promise<Object>} Резултат
   */
  async fallbackToIndexedDB(key, value) {
    console.log(`SafeStorage: Falling back to IndexedDB for key "${key}"`);
    
    try {
      // Simple IndexedDB fallback
      const dbName = 'bodybest_overflow';
      const storeName = 'storage';
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const putRequest = store.put(value, key);
          
          putRequest.onsuccess = () => {
            console.log(`SafeStorage: Successfully stored "${key}" in IndexedDB`);
            resolve({ success: true, storage: 'indexedDB' });
          };
          
          putRequest.onerror = () => {
            reject(putRequest.error);
          };
        };
      });
    } catch (error) {
      console.error('SafeStorage: IndexedDB fallback failed:', error);
      return { success: false, error: 'indexeddb_failed' };
    }
  }

  /**
   * Показва UI warning при quota проблеми
   * @param {number} evictedCount - Брой изтрити записи
   * @param {boolean} failed - Дали операцията е неуспешна
   */
  showQuotaWarning(evictedCount, failed = false) {
    // Показваме само веднъж на сесия
    if (this.quotaWarningShown) return;
    this.quotaWarningShown = true;

    const message = failed 
      ? 'Локалният кеш е пълен и не може да се запише нова информация.'
      : `Локалният кеш е пълен – изтрити са ${evictedCount} най-стари записа.`;

    // Dispatch custom event което UI може да слуша
    const event = new CustomEvent('storage-quota-warning', {
      detail: { message, evictedCount, failed }
    });
    window.dispatchEvent(event);

    // Също така показваме browser alert (може да се премахне ако има custom UI)
    console.warn('SafeStorage:', message);
  }

  /**
   * Изчиства всички данни (използвай внимателно!)
   */
  clear() {
    try {
      localStorage.clear();
      return { success: true };
    } catch (error) {
      console.error('SafeStorage: Failed to clear storage:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton инстанция
let safeStorageInstance = null;

/**
 * Получава singleton инстанция на SafeStorage
 * @returns {SafeStorage}
 */
export function getSafeStorage() {
  if (!safeStorageInstance) {
    safeStorageInstance = new SafeStorage();
  }
  return safeStorageInstance;
}

/**
 * Convenience функции за директно използване
 */
export const safeSetItem = (key, value, options) => {
  return getSafeStorage().setItem(key, value, options);
};

export const safeGetItem = (key, defaultValue) => {
  return getSafeStorage().getItem(key, defaultValue);
};

export const safeRemoveItem = (key) => {
  return getSafeStorage().removeItem(key);
};

export const getStorageSize = () => {
  return getSafeStorage().estimateStorageSize();
};
