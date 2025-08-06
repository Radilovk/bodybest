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
    const reason = input.value.trim();
    if (regenProgress) {
      regenProgress.textContent = 'Генериране…';
      regenProgress.classList.remove('hidden');
    }
    regenBtn.disabled = true;
    try {
      const resp = await fetch(apiEndpoints.regeneratePlan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: reason || 'Админ регенерация' })
      });
      if (!resp.ok) throw new Error('Request failed');
    } catch (err) {
      console.error('regeneratePlan error:', err);
      if (regenProgress) {
        regenProgress.textContent = 'Грешка';
        setTimeout(() => regenProgress.classList.add('hidden'), 2000);
      }
      regenBtn.disabled = false;
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
            if (regenProgress) {
              regenProgress.textContent = 'Готово';
              setTimeout(() => regenProgress.classList.add('hidden'), 2000);
            }
            regenBtn.disabled = false;
            alert('Планът е обновен.');
          } else if (data.planStatus === 'error') {
            clearInterval(intervalId);
            if (regenProgress) {
              regenProgress.textContent = 'Грешка';
              setTimeout(() => regenProgress.classList.add('hidden'), 2000);
            }
            regenBtn.disabled = false;
            alert(`Грешка при генерирането: ${data.error || ''}`);
          }
        }
      } catch (err) {
        console.error('planStatus polling error:', err);
      }
    }, 3000);
  });
}
