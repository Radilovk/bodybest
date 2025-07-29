import { apiEndpoints } from './config.js';

/**
 * Зарежда стойността на режима за поддръжка.
 * @returns {Promise<boolean>} true ако е включен.
 */
export async function loadMaintenanceFlag() {
    const resp = await fetch(apiEndpoints.getMaintenanceMode);
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
    return data.enabled === true || data.enabled === '1';
}

/**
 * Записва режима за поддръжка.
 * @param {boolean} enabled
 * @returns {Promise<object>} Отговорът от API.
 */
export async function setMaintenanceFlag(enabled) {
    const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
    const resp = await fetch(apiEndpoints.setMaintenanceMode, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: enabled ? 1 : 0 })
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
    return data;
}
