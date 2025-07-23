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
 * Изчислява крайния цвят на прогрес бар спрямо процента.
 * @param {number} percent Стойността в диапазона 0-100.
 * @returns {string} CSS rgb() низ за крайния цвят.
 */
export function getProgressColor(percent) {
    const stops = [
        { pct: 0, color: [231, 76, 60] },       // червено
        { pct: 50, color: [243, 156, 18] },     // оранжево
        { pct: 75, color: [255, 203, 0] },      // жълто
        { pct: 100, color: [46, 204, 113] }     // зелено
    ];
    const p = Math.max(0, Math.min(100, percent));
    for (let i = 1; i < stops.length; i++) {
        if (p <= stops[i].pct) {
            const lower = stops[i - 1];
            const upper = stops[i];
            const range = upper.pct - lower.pct;
            const t = range === 0 ? 0 : (p - lower.pct) / range;
            const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * t);
            const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * t);
            const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * t);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
    const c = stops[stops.length - 1].color;
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
