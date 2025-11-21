// offlineLogSync.js - Offline-first Log Synchronization
// Осигурява локално записване на логове и batch синхронизация със сървъра

/**
 * Клас за управление на offline логване и синхронизация
 */
export class OfflineLogSync {
  /**
   * @param {Object} config - Конфигурация
   * @param {string} config.storageKey - Ключ за localStorage
   * @param {number} config.syncInterval - Интервал за автоматична синхронизация (ms)
   * @param {number} config.maxBatchSize - Максимален брой логове в един batch
   * @param {Function} config.onSyncSuccess - Callback при успешна синхронизация
   * @param {Function} config.onSyncError - Callback при грешка
   */
  constructor(config = {}) {
    this.storageKey = config.storageKey || 'bodybest_pending_logs';
    this.syncInterval = config.syncInterval || 30000; // 30 секунди
    this.maxBatchSize = config.maxBatchSize || 50;
    this.onSyncSuccess = config.onSyncSuccess || (() => {});
    this.onSyncError = config.onSyncError || (() => {});
    this.onSyncStatusChange = config.onSyncStatusChange || (() => {});
    this.syncTimer = null;
    this.isSyncing = false;
    
    // Retry with exponential backoff
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
    this.baseRetryDelay = 5000; // 5 секунди
    this.maxRetryDelay = 60000; // 1 минута
    this.retryTimer = null;
  }

  /**
   * Генерира уникален ID за лог запис
   * @returns {string} Уникален ID
   */
  generateId() {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Добавя лог запис в локалното хранилище
   * @param {Object} logData - Данни за логване
   * @returns {Promise<Object>} Резултат с success флаг
   */
  async addLog(logData) {
    try {
      const pending = this.getPendingLogs();
      const logEntry = {
        ...logData,
        id: this.generateId(),
        timestamp: Date.now(),
        syncStatus: 'pending'
      };
      
      pending.push(logEntry);
      this.savePendingLogs(pending);
      
      // Опитай незабавна синхронизация ако е online (но не чакаме резултата)
      if (navigator.onLine && !this.isSyncing) {
        // Използваме setTimeout да избегнем race conditions в тестовете
        setTimeout(() => {
          this.syncPendingLogs().catch(err => {
            console.warn('Immediate sync failed, will retry:', err);
          });
        }, 0);
      }
      
      return { success: true, id: logEntry.id, synced: false };
    } catch (error) {
      console.error('Error adding log to offline storage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Извлича всички pending логове от localStorage
   * @returns {Array} Масив с pending логове
   */
  getPendingLogs() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      const logs = JSON.parse(stored);
      return Array.isArray(logs) ? logs : [];
    } catch (error) {
      console.warn('Failed to parse pending logs:', error);
      return [];
    }
  }

  /**
   * Записва pending логове в localStorage
   * @param {Array} logs - Масив с логове
   */
  savePendingLogs(logs) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save pending logs:', error);
      // Ако localStorage е пълен, опитай да почистиш старите записи
      if (error.name === 'QuotaExceededError') {
        this.cleanupOldLogs();
        // Опитай отново
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(logs));
        } catch (retryError) {
          console.error('Failed to save even after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Почиства най-старите логове при недостиг на място
   */
  cleanupOldLogs() {
    const logs = this.getPendingLogs();
    if (logs.length === 0) return;
    
    // Запази само последните 100 записа
    const toKeep = logs.slice(-100);
    this.savePendingLogs(toKeep);
  }

  /**
   * Премахва синхронизираните логове
   * @param {Array<string>} ids - IDs на логовете за премахване
   */
  removeSyncedLogs(ids) {
    const pending = this.getPendingLogs();
    const filtered = pending.filter(log => !ids.includes(log.id));
    this.savePendingLogs(filtered);
  }

  /**
   * Разделя масив на части (chunks)
   * @param {Array} array - Масив за разделяне
   * @param {number} size - Размер на всяка част
   * @returns {Array<Array>} Масив от части
   */
  chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Изчислява retry delay с exponential backoff
   * @returns {number} Delay в милисекунди
   */
  getRetryDelay() {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, this.consecutiveFailures - 1),
      this.maxRetryDelay
    );
    return delay;
  }

  /**
   * Синхронизира pending логове със сървъра
   * @param {string} apiEndpoint - API endpoint за batch sync
   * @returns {Promise<Object>} Резултат от синхронизацията
   */
  async syncPendingLogs(apiEndpoint = '/api/batch-log') {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }
    
    if (!navigator.onLine) {
      this.onSyncStatusChange('offline');
      return { success: false, message: 'Offline - sync postponed' };
    }

    const pending = this.getPendingLogs();
    if (pending.length === 0) {
      this.consecutiveFailures = 0;
      this.onSyncStatusChange('online');
      return { success: true, synced: 0 };
    }

    this.isSyncing = true;
    this.onSyncStatusChange('syncing');
    
    let totalSynced = 0;
    let errors = [];

    try {
      // Разделяме логовете на batch-ове
      const batches = this.chunk(pending, this.maxBatchSize);
      
      for (const batch of batches) {
        try {
          // Извличаме само необходимите данни за API-то
          const logsToSync = batch.map(log => {
            // eslint-disable-next-line no-unused-vars
            const { id, timestamp, syncStatus, ...logData } = log;
            return { ...logData, _offlineId: id };
          });

          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': sessionStorage.getItem('authToken') || ''
            },
            body: JSON.stringify({ logs: logsToSync })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          
          if (result.success) {
            // Премахваме успешно синхронизираните
            const syncedIds = batch.map(log => log.id);
            this.removeSyncedLogs(syncedIds);
            totalSynced += batch.length;
            
            this.onSyncSuccess({ 
              count: batch.length, 
              total: totalSynced 
            });
          } else {
            errors.push(result.message || 'Sync failed');
          }
        } catch (error) {
          console.warn('Batch sync failed:', error);
          errors.push(error.message);
          // Спираме при грешка, ще опитаме по-късно
          break;
        }
      }

      const finalResult = {
        success: errors.length === 0,
        synced: totalSynced,
        errors: errors.length > 0 ? errors : undefined,
        remaining: this.getPendingLogs().length,
        consecutiveFailures: this.consecutiveFailures
      };

      if (errors.length > 0) {
        this.consecutiveFailures++;
        this.onSyncStatusChange('error');
        this.onSyncError(finalResult);
        
        // Schedule retry with exponential backoff
        this.scheduleRetry(apiEndpoint);
      } else {
        this.consecutiveFailures = 0;
        this.onSyncStatusChange(pending.length > totalSynced ? 'syncing' : 'online');
      }

      return finalResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Планира retry с exponential backoff
   * @param {string} apiEndpoint - API endpoint за retry
   */
  scheduleRetry(apiEndpoint) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    const delay = this.getRetryDelay();
    console.log(`Scheduling retry in ${delay}ms (attempt ${this.consecutiveFailures}/${this.maxConsecutiveFailures})`);
    
    this.retryTimer = setTimeout(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncPendingLogs(apiEndpoint).catch(err => {
          console.warn('Retry sync failed:', err);
        });
      }
    }, delay);
  }

  /**
   * Стартира автоматична периодична синхронизация
   */
  startAutoSync(apiEndpoint) {
    if (this.syncTimer) {
      return; // Вече е стартиран
    }

    this.syncTimer = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncPendingLogs(apiEndpoint).catch(err => {
          console.warn('Auto sync failed:', err);
        });
      }
    }, this.syncInterval);

    // Синхронизирай веднага при стартиране
    if (navigator.onLine) {
      this.syncPendingLogs(apiEndpoint).catch(err => {
        console.warn('Initial sync failed:', err);
      });
    }
  }

  /**
   * Спира автоматичната синхронизация
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Проверява дали има consecutive failures над лимита
   * @returns {boolean} True ако е над лимита
   */
  hasExceededFailureLimit() {
    return this.consecutiveFailures >= this.maxConsecutiveFailures;
  }

  /**
   * Ресетва consecutive failures counter
   */
  resetFailureCounter() {
    this.consecutiveFailures = 0;
  }

  /**
   * Проверява дали има pending логове
   * @returns {boolean} True ако има pending логове
   */
  hasPendingLogs() {
    return this.getPendingLogs().length > 0;
  }

  /**
   * Връща броя на pending логовете
   * @returns {number} Брой pending логове
   */
  getPendingCount() {
    return this.getPendingLogs().length;
  }

  /**
   * Изчиства всички pending логове (използвай внимателно!)
   */
  clearAllPending() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear pending logs:', error);
    }
  }

  /**
   * Експортира pending логове (за debugging)
   * @returns {Object} Информация за pending логовете
   */
  exportPendingLogs() {
    const logs = this.getPendingLogs();
    return {
      count: logs.length,
      totalSize: JSON.stringify(logs).length,
      oldestTimestamp: logs.length > 0 ? logs[0].timestamp : null,
      newestTimestamp: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
      logs: logs
    };
  }
}

// Singleton инстанция за споделено използване
let defaultInstance = null;

/**
 * Получава default инстанцията на OfflineLogSync
 * @param {Object} config - Конфигурация (само при първото извикване)
 * @returns {OfflineLogSync} Инстанция на OfflineLogSync
 */
export function getOfflineLogSync(config) {
  if (!defaultInstance) {
    defaultInstance = new OfflineLogSync(config);
  }
  return defaultInstance;
}

/**
 * Ресетва default инстанцията (за testing)
 */
export function resetOfflineLogSync() {
  if (defaultInstance) {
    defaultInstance.stopAutoSync();
    defaultInstance = null;
  }
}
