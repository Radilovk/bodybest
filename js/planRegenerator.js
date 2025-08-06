import { apiEndpoints } from './config.js';

let activeUserId;
let activeRegenBtn;
let activeRegenProgress;
let confirmListenerAdded = false;

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
  const priorityInput = document.getElementById('priorityGuidanceInput');
  const reasonInput = document.getElementById('regenReasonInput');
  const confirm = document.getElementById('priorityGuidanceConfirm');
  const cancel = document.getElementById('priorityGuidanceCancel');
  const closeBtn = document.getElementById('priorityGuidanceClose');
  if (!regenBtn || !modal || !confirm || (!priorityInput && !reasonInput)) return;

  const hide = () => closeModal(modal);

  regenBtn.addEventListener('click', () => {
    activeUserId = getUserId?.();
    activeRegenBtn = regenBtn;
    activeRegenProgress = regenProgress;
    if (priorityInput) priorityInput.value = '';
    if (reasonInput) reasonInput.value = '';
    openModal(modal);
  });
  cancel?.addEventListener('click', hide);
  closeBtn?.addEventListener('click', hide);

  if (!confirmListenerAdded) {
    confirmListenerAdded = true;
    confirm.addEventListener('click', async () => {
      if (!activeUserId || !activeRegenBtn) return;
      hide();
      const reason = (reasonInput ? reasonInput.value : priorityInput?.value || '').trim();
      const priorityGuidance = reasonInput ? (priorityInput?.value.trim() || '') : '';
      if (activeRegenProgress) {
        activeRegenProgress.textContent = 'Генериране…';
        activeRegenProgress.classList.remove('hidden');
      }
      activeRegenBtn.disabled = true;
      try {
        const resp = await fetch(apiEndpoints.regeneratePlan, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: activeUserId, reason: reason || 'Админ регенерация', priorityGuidance })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error('Request failed');
        if (!data.success) {
          const msg = data.precheck?.message || data.message || 'Грешка при стартиране на генерирането.';
          if (activeRegenProgress) {
            activeRegenProgress.textContent = msg;
            setTimeout(() => activeRegenProgress.classList.add('hidden'), 4000);
          }
          activeRegenBtn.disabled = false;
          return;
        }
      } catch (err) {
        console.error('regeneratePlan error:', err);
        if (activeRegenProgress) {
          activeRegenProgress.textContent = 'Грешка';
          setTimeout(() => activeRegenProgress.classList.add('hidden'), 2000);
        }
        activeRegenBtn.disabled = false;
        alert('Грешка при стартиране на генерирането.');
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
    });
  }
}
