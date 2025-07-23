// utils.js - Помощни Функции

/**
 * Безопасно достъпва дълбоко вложена стойност в обект.
 * @param {Object} obj - Обектът, от който се чете.
 * @param {string|string[]} path - Пътят до стойността (низ с точки или масив).
 * @param {*} [defaultValue=null] - Стойност по подразбиране при липса на ключ.
 * @returns {*} Намерената стойност или defaultValue.
 */
export const safeGet = (obj, path, defaultValue = null) => {
    try {
        const keys = Array.isArray(path) ? path : String(path).split('.');
        let result = obj;
        for (const key of keys) {
            if (result === undefined || result === null) return defaultValue;
            result = result[key];
        }
        return result ?? defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

/**
 * Парсира число от низ, като връща стойност по подразбиране при грешка.
 * @param {string|number|null} val - Стойността за парсване.
 * @param {*} [defaultVal=null] - Стойност по подразбиране.
 * @returns {number|null} Парсираното число или defaultVal.
 */
export const safeParseFloat = (val, defaultVal = null) => {
  if (val === null || val === undefined || String(val).trim() === '') return defaultVal;
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? defaultVal : num;
};

export const capitalizeFirstLetter = (string) => {
    if (!string || typeof string !== 'string') return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};

export const escapeHtml = (text) => {
    if (text === undefined || text === null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Преобразува File обект към base64 низ без data префикс.
 * @param {File} file - Изображението за конвертиране.
 * @returns {Promise<string>} Обещание с base64 съдържанието.
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result || '';
            resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Преобразува File обект към Data URL (data:image/...) с Base64 съдържание.
 * @param {File} file - Изображението за конвертиране.
 * @returns {Promise<string>} Обещание с пълния Data URL.
 */
export function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Чете File обект като текст.
 * @param {File} file - Файлът за прочитане.
 * @returns {Promise<string>} Обещание със съдържанието като текст.
 */
export function fileToText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Пресмята цвят на прогрес бар спрямо процент завършеност.
 * 0% -> червено, 50% -> оранжево, 100% -> зелено.
 * @param {number} percent Процентът на запълване.
 * @returns {string} RGB(A) низ за използване като цвят.
 */
export function getProgressColor(percent) {
    const clamp = Math.max(0, Math.min(100, Number(percent)));
    const hexToRgb = (hex) => {
        const clean = hex.replace('#', '');
        const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    };
    const mix = (c1, c2, f) => ({
        r: Math.round(c1.r + (c2.r - c1.r) * f),
        g: Math.round(c1.g + (c2.g - c1.g) * f),
        b: Math.round(c1.b + (c2.b - c1.b) * f)
    });
    const danger = hexToRgb('#e74c3c');
    const warning = hexToRgb('#f39c12');
    const success = hexToRgb('#2ecc71');
    let rgb;
    if (clamp <= 50) {
        rgb = mix(danger, warning, clamp / 50);
    } else {
        rgb = mix(warning, success, (clamp - 50) / 50);
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
}

/**
 * Прилага стил на прогрес елемент според зададения процент.
 * Задава ширина, фон и лек глоу ефект.
 * @param {HTMLElement} el Елементът на прогрес бара.
 * @param {number} percent Процентът на запълване.
 */
export function applyProgressStyles(el, percent) {
    if (!el) return;
    const pct = Math.max(0, Math.min(100, Number(percent)));
    const color = getProgressColor(pct);
    el.style.width = `${pct}%`;
    el.style.backgroundColor = color;
    el.style.boxShadow = `0 0 6px ${color}`;
}
