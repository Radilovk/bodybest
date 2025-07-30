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
export let progressColorStops = [
    { pct: 0, color: [231, 76, 60] },       // червено
    { pct: 50, color: [243, 156, 18] },     // оранжево
    { pct: 75, color: [255, 203, 0] },      // жълто
    { pct: 100, color: [46, 204, 113] }     // зелено
];

export function setProgressColorStops(stops) {
    if (Array.isArray(stops) && stops.length > 0) {
        progressColorStops = stops;
    }
}

export function getProgressColor(percent) {
    const stops = progressColorStops;
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

/**
 * Анимира плавно запълването на елемент от 0 до подадения процент.
 * @param {HTMLElement} el Елементът, представляващ запълването.
 * @param {number} percent Процент за крайна широчина.
 */
export function animateProgressFill(el, percent) {
    if (!el) return;
    const target = Math.max(0, Math.min(100, percent));
    el.style.setProperty("--target-width", `${target}%`);
    el.style.width = `${target}%`;
    el.classList.add("animate-progress");
    el.addEventListener("animationend", () => {
        el.classList.remove("animate-progress");
    }, { once: true });
}

/**
 * Взема стойност на CSS променлива от :root.
 * @param {string} name Името на променливата (например '--primary-color').
 * @param {string} [fallback=''] Резервна стойност при липса.
 * @returns {string} Стойността на променливата или fallback.
 */
export function getCssVar(name, fallback = '') {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(name);
    return val ? val.trim() : fallback;
}

/**
 * Олекотява hex цвят със зададен процент.
 * При невалиден вход връща fallback или оригиналния низ.
 * @param {string} color Цветът (#rrggbb или #rgb).
 * @param {number} [percent=0.1] Степен на олекотяване 0-1.
 * @param {string} [fallback] Резервен цвят при грешка.
 * @returns {string} Новият цвят или подаденият оригинал/fallback.
 */
export function lightenColor(color, percent = 0.1, fallback) {
    if (typeof color !== 'string') return fallback ?? color;
    const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return fallback ?? color;

    let hex = match[1];
    if (hex.length === 3) {
        hex = hex.split('').map((ch) => ch + ch).join('');
    }

    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    const p = Math.max(0, Math.min(1, percent));
    const nr = Math.min(255, Math.round(r + (255 - r) * p));
    const ng = Math.min(255, Math.round(g + (255 - g) * p));
    const nb = Math.min(255, Math.round(b + (255 - b) * p));

    return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}


/**
 * Преобразува hex цвят към RGB обект.
 * @param {string} hex Стойност като #rrggbb или #rgb.
 * @returns {{r:number,g:number,b:number}|null} RGB компонентите или null.
 */
export function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

/**
 * Изчислява относителната яркост на RGB цвят.
 * @param {string|{r:number,g:number,b:number}} color Hex низ или RGB обект.
 * @returns {number|null} Яркост от 0 до 1 или null при невалиден вход.
 */
export function calcLuminance(color) {
    const rgb = typeof color === 'string' ? hexToRgb(color) : color;
    if (!rgb) return null;
    const conv = v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = conv(rgb.r);
    const g = conv(rgb.g);
    const b = conv(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Изчислява контрастното съотношение между два цвята.
 * @param {string|{r:number,g:number,b:number}} c1 Първият цвят.
 * @param {string|{r:number,g:number,b:number}} c2 Вторият цвят.
 * @returns {number|null} Съотношение или null при грешка.
 */
export function contrastRatio(c1, c2) {
    const L1 = calcLuminance(c1);
    const L2 = calcLuminance(c2);
    if (L1 === null || L2 === null) return null;
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}
