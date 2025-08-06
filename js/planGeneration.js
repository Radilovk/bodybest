import { apiEndpoints } from './config.js';

/**
 * Стартира изцяло нов план без допълнителни проверки или приоритети.
 * @param {Object} params
 * @param {string} params.userId
 * @returns {Promise<any>} резултатът от сървъра
 */
export async function startPlanGeneration({ userId }) {
  const resp = await fetch(apiEndpoints.regeneratePlan, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.message || 'Грешка при стартиране на генерирането.');
  }
  return data;
}
