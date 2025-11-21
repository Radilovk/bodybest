// syncStatusIndicator.js - UI component за sync status
// Визуален индикатор за online/offline/syncing/error states

/**
 * Sync Status Indicator
 * Показва текущото състояние на синхронизацията
 */
export class SyncStatusIndicator {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.position = options.position || 'bottom-right'; // top-left, top-right, bottom-left, bottom-right
    this.showLabel = options.showLabel !== false; // Default true
    this.autoHide = options.autoHide !== false; // Auto-hide when online
    this.autoHideDelay = options.autoHideDelay || 3000;
    
    this.currentStatus = 'unknown';
    this.pendingCount = 0;
    this.consecutiveFailures = 0;
    
    this.element = null;
    this.hideTimer = null;
    
    this.init();
  }

  /**
   * Инициализира UI елемента
   */
  init() {
    this.element = document.createElement('div');
    this.element.className = 'sync-status-indicator';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    
    this.updatePosition();
    this.render();
    
    this.container.appendChild(this.element);
    
    // Initially hidden until first status update
    this.element.style.opacity = '0';
  }

  /**
   * Обновява позицията според config
   */
  updatePosition() {
    this.element.classList.remove('top-left', 'top-right', 'bottom-left', 'bottom-right');
    this.element.classList.add(this.position);
  }

  /**
   * Обновява статуса
   * @param {string} status - 'online' | 'offline' | 'syncing' | 'error'
   * @param {Object} details - Допълнителни детайли
   */
  updateStatus(status, details = {}) {
    this.currentStatus = status;
    this.pendingCount = details.pendingCount || 0;
    this.consecutiveFailures = details.consecutiveFailures || 0;
    
    this.render();
    this.show();
    
    // Auto-hide when online and no pending items
    if (this.autoHide && status === 'online' && this.pendingCount === 0) {
      this.scheduleHide();
    } else {
      this.cancelHide();
    }
  }

  /**
   * Рендва съдържанието
   */
  render() {
    const config = this.getStatusConfig(this.currentStatus);
    
    let html = `
      <div class="sync-status-content">
        <div class="sync-status-icon ${config.iconClass}">
          ${config.icon}
        </div>
        ${this.showLabel ? `
          <div class="sync-status-label">
            ${config.label}
            ${this.pendingCount > 0 ? `<span class="sync-pending-count">(${this.pendingCount})</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
    
    // При error и множество failures, показваме допълнително съобщение
    if (this.currentStatus === 'error' && this.consecutiveFailures >= 3) {
      html += `
        <div class="sync-status-error-message">
          Синхронизацията се провали ${this.consecutiveFailures} пъти. 
          Проверете интернет връзката.
        </div>
      `;
    }
    
    this.element.innerHTML = html;
    this.element.className = `sync-status-indicator ${this.position} sync-status-${this.currentStatus}`;
    this.element.setAttribute('aria-label', config.ariaLabel);
  }

  /**
   * Връща конфигурация за дадения status
   * @param {string} status
   * @returns {Object}
   */
  getStatusConfig(status) {
    const configs = {
      online: {
        icon: '<i class="bi bi-cloud-check"></i>',
        iconClass: 'text-success',
        label: 'Онлайн',
        ariaLabel: 'Онлайн - синхронизирано'
      },
      offline: {
        icon: '<i class="bi bi-cloud-slash"></i>',
        iconClass: 'text-muted',
        label: 'Офлайн',
        ariaLabel: 'Офлайн режим - данните ще се синхронизират при връзка'
      },
      syncing: {
        icon: '<i class="bi bi-cloud-arrow-up sync-rotating"></i>',
        iconClass: 'text-info',
        label: 'Синхронизиране',
        ariaLabel: 'Синхронизиране на данни'
      },
      error: {
        icon: '<i class="bi bi-exclamation-triangle"></i>',
        iconClass: 'text-warning',
        label: 'Грешка при синхронизация',
        ariaLabel: 'Грешка при синхронизация - ще се опита отново'
      },
      unknown: {
        icon: '<i class="bi bi-question-circle"></i>',
        iconClass: 'text-muted',
        label: 'Проверка',
        ariaLabel: 'Проверка на състоянието'
      }
    };
    
    return configs[status] || configs.unknown;
  }

  /**
   * Показва индикатора
   */
  show() {
    this.element.style.opacity = '1';
    this.element.style.transform = 'translateY(0)';
  }

  /**
   * Скрива индикатора
   */
  hide() {
    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(10px)';
  }

  /**
   * Планира автоматично скриване
   */
  scheduleHide() {
    this.cancelHide();
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, this.autoHideDelay);
  }

  /**
   * Отменя планираното скриване
   */
  cancelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  /**
   * Премахва индикатора от DOM
   */
  destroy() {
    this.cancelHide();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

/**
 * Singleton инстанция
 */
let statusIndicatorInstance = null;

/**
 * Получава или създава singleton инстанция
 * @param {Object} options - Конфигурация
 * @returns {SyncStatusIndicator}
 */
export function getSyncStatusIndicator(options) {
  if (!statusIndicatorInstance) {
    statusIndicatorInstance = new SyncStatusIndicator(options);
  }
  return statusIndicatorInstance;
}

/**
 * Convenience функция за update на статуса
 * @param {string} status
 * @param {Object} details
 */
export function updateSyncStatus(status, details = {}) {
  const indicator = getSyncStatusIndicator();
  indicator.updateStatus(status, details);
}
