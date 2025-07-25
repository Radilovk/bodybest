import { apiEndpoints } from './config.js';

/**
 * Зарежда конфигурационни стойности от сървъра.
 * @param {string[]} [keys] - Списък от ключове за филтриране.
 * @returns {Promise<object>} Получената конфигурация.
 */
export async function loadConfig(keys) {
    const resp = await fetch(apiEndpoints.getAiConfig);
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
    const cfg = data.config || {};
    if (Array.isArray(keys) && keys.length) {
        const subset = {};
        for (const k of keys) subset[k] = cfg[k];
        return subset;
    }
    return cfg;
}

/**
 * Записва конфигурация в сървъра.
 * @param {object} updates - Ключове и стойности за обновяване.
 * @returns {Promise<object>} Отговорът от API.
 */
export async function saveConfig(updates) {
    const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
    const resp = await fetch(apiEndpoints.setAiConfig, {
        method: 'POST',
        headers,
        body: JSON.stringify({ updates })
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
    return data;
}
