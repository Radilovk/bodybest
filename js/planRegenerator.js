import { startPlanGeneration } from './planGeneration.js';

/**
 * Настройва бутон за създаване на изцяло нов план.
 * @param {Object} options
 * @param {HTMLButtonElement} options.regenBtn
 * @param {HTMLElement} [options.regenProgress] - елемент за съобщения
 * @param {Function} options.getUserId - връща текущия userId
 */
export function setupPlanRegeneration({ regenBtn, regenProgress, getUserId }) {
  if (!regenBtn || typeof getUserId !== 'function') return;

  regenBtn.addEventListener('click', async () => {
    const userId = getUserId();
    if (!userId) return;
    regenBtn.disabled = true;
    if (regenProgress) {
      regenProgress.textContent = 'Генериране…';
      regenProgress.classList.remove('hidden');
    }
    try {
      const result = await startPlanGeneration({ userId });
      const msg = result?.message || 'Готово';
      if (regenProgress) regenProgress.textContent = msg;
      alert(msg);
    } catch (err) {
      console.error('regeneratePlan error:', err);
      if (regenProgress) regenProgress.textContent = 'Грешка';
      alert('Грешка при генериране на плана.');
    } finally {
      regenBtn.disabled = false;
      if (regenProgress) setTimeout(() => regenProgress.classList.add('hidden'), 2000);
    }
  });
}
