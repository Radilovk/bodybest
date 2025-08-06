import { apiEndpoints } from './config.js';

/**
 * Стартира генериране на план.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.reason]
 * @param {string} [params.priorityGuidance]
 * @returns {Promise<any>} резултатът от сървъра
 */
export async function startPlanGeneration({ userId, reason = '', priorityGuidance = '' }) {
  const payload = { userId, reason, priorityGuidance };
  const resp = await fetch(apiEndpoints.regeneratePlan, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'Request failed');
  if (!data.success) {
    const err = new Error(data.precheck?.message || data.message || 'Грешка при стартиране на генерирането.');
    err.precheck = Boolean(data.precheck);
    throw err;
  }
  return data;
}
