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
    this.syncTimer = null;
    this.isSyncing = false;
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
   * Синхронизира pending логове със сървъра
   * @param {string} apiEndpoint - API endpoint за batch sync
   * @returns {Promise<Object>} Резултат от синхронизацията
   */
  async syncPendingLogs(apiEndpoint = '/api/batch-log') {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }
    
    if (!navigator.onLine) {
      return { success: false, message: 'Offline - sync postponed' };
    }

    const pending = this.getPendingLogs();
    if (pending.length === 0) {
      return { success: true, synced: 0 };
    }

    this.isSyncing = true;
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
        remaining: this.getPendingLogs().length
      };

      if (errors.length > 0) {
        this.onSyncError(finalResult);
      }

      return finalResult;
    } finally {
      this.isSyncing = false;
    }
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
