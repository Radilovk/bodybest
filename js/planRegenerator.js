import { apiEndpoints } from './config.js';
import { startPlanGeneration } from './planGeneration.js';

let activeUserId;
let activeRegenBtn;
let activeRegenProgress;
let confirmListenerAdded = false;
let displayedLogs = 0;

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

const logModal = document.getElementById('regenLogModal');
const logBody = document.getElementById('regenLogBody');
const logClose = document.getElementById('regenLogClose');
if (logClose && logModal && logBody) {
  logClose.addEventListener('click', () => {
    closeModal(logModal);
    logBody.textContent = '';
  });
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
      displayedLogs = 0;
      if (logBody) logBody.textContent = '';
      if (logModal) openModal(logModal);
      try {
        await startPlanGeneration({
          userId: activeUserId,
          reason: reason || 'Админ регенерация',
          priorityGuidance
        });
      } catch (err) {
        console.error('regeneratePlan error:', err);
        if (activeRegenProgress) {
          activeRegenProgress.textContent = err.message || 'Грешка';
          setTimeout(() => activeRegenProgress.classList.add('hidden'), 4000);
        }
        activeRegenBtn.disabled = false;
        if (!err.precheck) alert('Грешка при стартиране на генерирането.');
        if (logModal) closeModal(logModal);
        if (logBody) logBody.textContent = '';
        return;
      }

      const userId = activeUserId;
      const btn = activeRegenBtn;
      const progress = activeRegenProgress;
      const intervalId = setInterval(async () => {
        try {
          const resp = await fetch(`${apiEndpoints.planLog}?userId=${userId}`);
          const data = await resp.json();
          if (resp.ok && data.success) {
            const logs = data.logs || [];
            if (logBody) {
              for (let i = displayedLogs; i < logs.length; i++) {
                const div = document.createElement('div');
                div.textContent = logs[i];
                logBody.appendChild(div);
              }
              displayedLogs = logs.length;
              logBody.scrollTop = logBody.scrollHeight;
            }
            if (data.status === 'ready' || data.status === 'error') {
              clearInterval(intervalId);
              if (progress) {
                progress.textContent = data.status === 'ready' ? 'Готово' : 'Грешка';
                setTimeout(() => progress.classList.add('hidden'), 2000);
              }
              btn.disabled = false;
              if (data.status === 'ready') alert('Планът е обновен.');
              else alert(`Грешка при генерирането: ${data.error || ''}`);
              if (logModal) closeModal(logModal);
              if (logBody) logBody.textContent = '';
              try {
                await fetch(apiEndpoints.updateKv, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ key: `${userId}_plan_log`, value: '[]' })
                });
              } catch (e) {
                console.error('clear plan log error:', e);
              }
            }
          }
        } catch (err) {
          console.error('planLog polling error:', err);
        }
      }, 3000);
    });
  }
}
