import { apiEndpoints } from './config.js';

let activeUserId;
let activeRegenBtn;
let activeRegenProgress;
let detachLast;

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

export function setupPlanRegeneration({
  regenBtn,
  regenProgress,
  getUserId,
  modal,
  input,
  confirm,
  cancel,
  closeBtn
}) {
  if (!regenBtn || !modal || !confirm || !input) return;

  const hide = () => closeModal(modal);

  regenBtn.addEventListener('click', () => {
    detachLast?.();
    activeUserId = getUserId?.();
    activeRegenBtn = regenBtn;
    activeRegenProgress = regenProgress;
    input.value = '';
    openModal(modal);

    let onConfirm;
    let onCancel;

    const cleanup = () => {
      confirm.removeEventListener('click', onConfirm);
      cancel?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      if (detachLast === cleanup) detachLast = null;
    };

    onConfirm = async () => {
      if (!activeUserId || !activeRegenBtn) return;
      hide();
      const reason = input.value.trim();
      if (activeRegenProgress) {
        activeRegenProgress.textContent = 'Генериране…';
        activeRegenProgress.classList.remove('hidden');
      }
      activeRegenBtn.disabled = true;
      try {
        const resp = await fetch(apiEndpoints.regeneratePlan, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: activeUserId, reason: reason || 'Админ регенерация' })
        });
        if (!resp.ok) throw new Error('Request failed');
      } catch (err) {
        console.error('regeneratePlan error:', err);
        if (activeRegenProgress) {
          activeRegenProgress.textContent = 'Грешка';
          setTimeout(() => activeRegenProgress.classList.add('hidden'), 2000);
        }
        activeRegenBtn.disabled = false;
        alert('Грешка при стартиране на генерирането.');
        cleanup();
        return;
      }

      const userId = activeUserId;
      const btn = activeRegenBtn;
      const progress = activeRegenProgress;
      const intervalId = setInterval(async () => {
        try {
          const resp = await fetch(`${apiEndpoints.planStatus}?userId=${userId}`);
          const data = await resp.json();
          if (resp.ok && data.success) {
            if (data.planStatus === 'ready') {
              clearInterval(intervalId);
              if (progress) {
                progress.textContent = 'Готово';
                setTimeout(() => progress.classList.add('hidden'), 2000);
              }
              btn.disabled = false;
              alert('Планът е обновен.');
            } else if (data.planStatus === 'error') {
              clearInterval(intervalId);
              if (progress) {
                progress.textContent = 'Грешка';
                setTimeout(() => progress.classList.add('hidden'), 2000);
              }
              btn.disabled = false;
              alert(`Грешка при генерирането: ${data.error || ''}`);
            }
          }
        } catch (err) {
          console.error('planStatus polling error:', err);
        }
      }, 3000);

      cleanup();
    };

    onCancel = () => {
      hide();
      cleanup();
    };

    detachLast = cleanup;
    confirm.addEventListener('click', onConfirm);
    cancel?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
  });
}
