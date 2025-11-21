// highContrastMode.js - High contrast mode toggle
// Добавя опция за високо контрастна палитра

/**
 * High Contrast Mode Manager
 * Управлява high contrast настройки
 */
export class HighContrastMode {
  constructor() {
    this.storageKey = 'bodybest_high_contrast';
    this.isEnabled = this.loadSetting();
  }

  /**
   * Зарежда настройката от localStorage
   * @returns {boolean}
   */
  loadSetting() {
    try {
      return localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Запазва настройката
   * @param {boolean} enabled
   */
  saveSetting(enabled) {
    try {
      localStorage.setItem(this.storageKey, enabled ? 'true' : 'false');
    } catch (error) {
      console.warn('Could not save high contrast setting:', error);
    }
  }

  /**
   * Проверява дали е enabled
   * @returns {boolean}
   */
  isHighContrastEnabled() {
    return this.isEnabled;
  }

  /**
   * Enable high contrast mode
   */
  enable() {
    this.isEnabled = true;
    this.saveSetting(true);
    this.apply();
    this.dispatchChangeEvent();
  }

  /**
   * Disable high contrast mode
   */
  disable() {
    this.isEnabled = false;
    this.saveSetting(false);
    this.apply();
    this.dispatchChangeEvent();
  }

  /**
   * Toggle high contrast mode
   * @returns {boolean} New state
   */
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  /**
   * Прилага high contrast CSS
   */
  apply() {
    if (this.isEnabled) {
      document.body.classList.add('high-contrast-mode');
      this.applyHighContrastOverrides();
    } else {
      document.body.classList.remove('high-contrast-mode');
      this.removeHighContrastOverrides();
    }
  }

  /**
   * Прилага CSS overrides за high contrast
   */
  applyHighContrastOverrides() {
    // Проверяваме дали style element вече съществува
    let styleEl = document.getElementById('high-contrast-overrides');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'high-contrast-overrides';
      document.head.appendChild(styleEl);
    }

    // High contrast CSS overrides
    styleEl.textContent = `
      body.high-contrast-mode {
        /* Увеличаваме contrast на основните цветове */
        --text-color-primary: ${this.getHighContrastColor('text-primary')};
        --text-color-secondary: ${this.getHighContrastColor('text-secondary')};
        --text-color-muted: ${this.getHighContrastColor('text-muted')};
        
        /* По-силни border colors */
        --border-color: ${this.getHighContrastColor('border')};
        --border-color-soft: ${this.getHighContrastColor('border-soft')};
        
        /* По-четлив contrast между bg и cards */
        --card-bg: ${this.getHighContrastColor('card-bg')};
        
        /* Vivid-подобни accent colors */
        --primary-color: ${this.getHighContrastColor('primary')};
        --secondary-color: ${this.getHighContrastColor('secondary')};
        --accent-color: ${this.getHighContrastColor('accent')};
      }
      
      body.high-contrast-mode .btn,
      body.high-contrast-mode button {
        border: 2px solid currentColor !important;
        font-weight: 600 !important;
      }
      
      body.high-contrast-mode .card,
      body.high-contrast-mode [class*="card"] {
        border: 2px solid var(--border-color) !important;
      }
      
      body.high-contrast-mode a {
        text-decoration: underline !important;
        font-weight: 500 !important;
      }
      
      body.high-contrast-mode :focus,
      body.high-contrast-mode :focus-visible {
        outline: 3px solid var(--primary-color) !important;
        outline-offset: 2px !important;
      }
    `;
  }

  /**
   * Премахва CSS overrides
   */
  removeHighContrastOverrides() {
    const styleEl = document.getElementById('high-contrast-overrides');
    if (styleEl) {
      styleEl.remove();
    }
  }

  /**
   * Връща high contrast цвят според текущата тема
   * @param {string} type - Тип на цвета
   * @returns {string} CSS color value
   */
  getHighContrastColor(type) {
    const isDark = document.body.classList.contains('dark-theme');
    const isVivid = document.body.classList.contains('vivid-theme');
    
    // Vivid theme вече има добър contrast
    if (isVivid) {
      return ''; // Използваме default стойностите
    }
    
    // High contrast палитра
    const lightModeColors = {
      'text-primary': '#000000',
      'text-secondary': '#1a1a1a',
      'text-muted': '#333333',
      'border': '#000000',
      'border-soft': '#333333',
      'card-bg': '#ffffff',
      'primary': '#0066cc',
      'secondary': '#cc6600',
      'accent': '#990099'
    };
    
    const darkModeColors = {
      'text-primary': '#ffffff',
      'text-secondary': '#e0e0e0',
      'text-muted': '#cccccc',
      'border': '#ffffff',
      'border-soft': '#cccccc',
      'card-bg': '#1a1a1a',
      'primary': '#66b3ff',
      'secondary': '#ffaa66',
      'accent': '#ff66ff'
    };
    
    const colors = isDark ? darkModeColors : lightModeColors;
    return colors[type] || '';
  }

  /**
   * Dispatch custom event при промяна
   */
  dispatchChangeEvent() {
    const event = new CustomEvent('high-contrast-change', {
      detail: { enabled: this.isEnabled }
    });
    window.dispatchEvent(event);
  }

  /**
   * Инициализира high contrast mode
   */
  init() {
    if (this.isEnabled) {
      this.apply();
    }
  }
}

/**
 * Singleton инстанция
 */
let highContrastInstance = null;

/**
 * Получава singleton инстанция
 * @returns {HighContrastMode}
 */
export function getHighContrastMode() {
  if (!highContrastInstance) {
    highContrastInstance = new HighContrastMode();
  }
  return highContrastInstance;
}

/**
 * Инициализира high contrast mode
 */
export function initHighContrastMode() {
  const hcMode = getHighContrastMode();
  hcMode.init();
  return hcMode;
}

/**
 * Toggle high contrast
 * @returns {boolean} New state
 */
export function toggleHighContrast() {
  return getHighContrastMode().toggle();
}

/**
 * Проверява дали е enabled
 * @returns {boolean}
 */
export function isHighContrastEnabled() {
  return getHighContrastMode().isHighContrastEnabled();
}
