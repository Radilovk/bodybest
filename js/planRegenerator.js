import { apiEndpoints } from './config.js';

function openModal(modal) {
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  const first = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (first || modal).focus();
}

function closeModal(modal) {
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

export function setupPlanRegeneration({ regenBtn, regenProgress, getUserId }) {
  const modal = document.getElementById('priorityGuidanceModal');
  const input = document.getElementById('priorityGuidanceInput');
  const confirm = document.getElementById('priorityGuidanceConfirm');
  const cancel = document.getElementById('priorityGuidanceCancel');
  const closeBtn = document.getElementById('priorityGuidanceClose');
  if (!regenBtn || !modal || !confirm || !input) return;

  const hide = () => closeModal(modal);

  regenBtn.addEventListener('click', () => {
    input.value = '';
    openModal(modal);
  });
  cancel?.addEventListener('click', hide);
  closeBtn?.addEventListener('click', hide);

  confirm.addEventListener('click', async () => {
    const userId = getUserId?.();
    if (!userId) return;
    hide();
    const priorityGuidance = input.value.trim();
    if (regenProgress) regenProgress.classList.remove('hidden');
    try {
      await fetch(apiEndpoints.regeneratePlan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // "reason" се изисква от бекенда; използваме указанията или стандартен текст.
        body: JSON.stringify({ userId, priorityGuidance, reason: priorityGuidance || 'Админ регенерация' })
      });
    } catch (err) {
      console.error('regeneratePlan error:', err);
      if (regenProgress) regenProgress.classList.add('hidden');
      alert('Грешка при стартиране на генерирането.');
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const resp = await fetch(`${apiEndpoints.planStatus}?userId=${userId}`);
        const data = await resp.json();
        if (resp.ok && data.success) {
          if (data.planStatus === 'ready') {
            clearInterval(intervalId);
            if (regenProgress) regenProgress.classList.add('hidden');
            alert('Планът е обновен.');
          } else if (data.planStatus === 'error') {
            clearInterval(intervalId);
            if (regenProgress) regenProgress.classList.add('hidden');
            alert(`Грешка при генерирането: ${data.error || ''}`);
          }
        }
      } catch (err) {
        console.error('planStatus polling error:', err);
      }
    }, 3000);
  });
}
