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
 * Определя цвят за прогрес бар според процента.
 * @param {number} percent - Стойност между 0 и 100.
 * @returns {string} CSS цвят.
 */
export function getProgressColor(percent) {
    const p = Number(percent);
    if (isNaN(p)) return 'var(--color-danger)';
    if (p >= 80) return 'var(--color-success)';
    if (p >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
}
