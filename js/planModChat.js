import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { openModal, showToast, closeModal } from './uiHandlers.js';
import { escapeHtml } from './utils.js';
import { currentUserId, loadDashboardData } from './app.js';
import { clearCache } from './requestCache.js';

export let planModChatHistory = [];
export let planModChatContext = null;
let isSending = false;

// Timing constants for UI feedback and data reloading
const MODAL_CLOSE_DELAY_MS = 1500;
const DASHBOARD_RELOAD_DELAY_MS = 2000;

// Mapping of backend change keys to user-friendly display names
const CHANGE_DISPLAY_NAMES = {
  caloriesMacros: 'калории и макроси',
  week1Menu: 'седмично меню',
  allowedForbiddenFoods: 'позволени/забранени храни',
  principlesWeek2_4: 'принципи за седмици 2-4',
  hydrationCookingSupplements: 'хидратация и добавки',
  psychologicalGuidance: 'психологическо ръководство',
  detailedTargets: 'детайлни цели',
  profileSummary: 'профилно резюме'
};

const planModificationPrompt = 'Моля, опишете накратко желаните от вас промени в плана.';
const planModGuidance = [
  'Напишете конкретно коя част от плана искате да се промени (напр. “повече протеин на обяд”).',
  'Добавете релевантни ограничения – алергии, предпочитани продукти, часове за хранене.',
  'Избягвайте крайни режими. Заявки в конфликт със здравословните принципи или BMI няма да бъдат приложени.'
];

export function clearPlanModChat() {
  if (selectors.planModChatMessages) selectors.planModChatMessages.innerHTML = '';
  planModChatHistory.length = 0;
  planModChatContext = null;
  if (selectors.planModChatInput) selectors.planModChatInput.value = '';
}

function renderGuidance() {
  if (!selectors.planModChatMessages) return;
  const wrapper = document.createElement('div');
  wrapper.classList.add('plan-mod-guidance');
  const intro = document.createElement('p');
  intro.textContent = 'Попълнете свободен текст. Заявката ще бъде разгледана и при липса на здравословен конфликт AI ще редактира плана без пълно регенериране.';
  wrapper.appendChild(intro);

  const list = document.createElement('ul');
  planModGuidance.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  wrapper.appendChild(list);

  const note = document.createElement('p');
  note.classList.add('plan-mod-note');
  note.textContent = 'Заявките, които противоречат на медицински препоръки или BMI, се коригират или отказват.';
  wrapper.appendChild(note);

  selectors.planModChatMessages.innerHTML = '';
  selectors.planModChatMessages.appendChild(wrapper);
}

export function displayPlanModChatMessage(text, sender = 'bot', isError = false) {
  if (!selectors.planModChatMessages) return;
  const div = document.createElement('div');
  div.classList.add('message', sender);
  if (isError) div.classList.add('error');
  text = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  div.innerHTML = text.replace(/\n/g, '<br>');
  selectors.planModChatMessages.appendChild(div);
  scrollToPlanModChatBottom();
}

export function displayPlanModChatTypingIndicator(show) {
  if (!selectors.planModChatMessages) return;
  let indicator = selectors.planModChatMessages.querySelector('.typing-indicator');
  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.classList.add('message', 'bot', 'typing-indicator');
      indicator.textContent = 'Обработваме заявката...';
      selectors.planModChatMessages.appendChild(indicator);
    }
  } else {
    indicator?.remove();
  }
  scrollToPlanModChatBottom();
}

export function scrollToPlanModChatBottom() {
  if (selectors.planModChatMessages) {
    selectors.planModChatMessages.scrollTop = selectors.planModChatMessages.scrollHeight;
  }
}

async function submitPlanChangeRequest(messageText, userId) {
  displayPlanModChatMessage(messageText, 'user');
  displayPlanModChatTypingIndicator(true);
  isSending = true;
  try {
    const response = await fetch(apiEndpoints.submitPlanChangeRequest, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, requestText: messageText })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
    
    // Show confirmation with details about what was changed
    let confirmation = result.message || 'Заявката е приета. Ще актуализираме плана, ако няма здравословен конфликт.';
    if (result.appliedChanges && result.appliedChanges.length > 0) {
      const changesText = result.appliedChanges
        .map(key => CHANGE_DISPLAY_NAMES[key] || key)
        .join(', ');
      confirmation += `\n\n✅ Променени секции: ${changesText}`;
    }
    
    displayPlanModChatMessage(confirmation, 'bot');
    showToast('Заявката е изпратена успешно. Презареждане на плана...', false);
    if (selectors.planModChatInput) selectors.planModChatInput.value = '';
    
    // Изчистваме кеша и презареждаме dashboard данните, за да покажем обновения план
    clearCache(apiEndpoints.dashboard);
    
    // Затваряме модала и презареждаме данните последователно
    await new Promise(resolve => setTimeout(resolve, MODAL_CLOSE_DELAY_MS));
    closeModal('planModChatModal');
    
    // Презареждаме dashboard данните
    await new Promise(resolve => setTimeout(resolve, DASHBOARD_RELOAD_DELAY_MS - MODAL_CLOSE_DELAY_MS));
    try {
      await loadDashboardData();
      const successMsg = result.appliedChanges && result.appliedChanges.length > 0
        ? `Планът е актуализиран успешно! Променени: ${result.appliedChanges.length} секции.`
        : 'Планът е актуализиран успешно!';
      showToast(successMsg, false, 3000);
    } catch (error) {
      console.error('Грешка при презареждане на dashboard:', error);
      showToast('Планът е актуализиран, но има грешка при презареждането. Моля, презаредете страницата.', true, 5000);
    }
  } catch (e) {
    const errorMsg = `Грешка при изпращане: ${e.message}`;
    displayPlanModChatMessage(errorMsg, 'bot', true);
    showToast(errorMsg, true);
  } finally {
    displayPlanModChatTypingIndicator(false);
    selectors.planModChatInput.disabled = false;
    selectors.planModChatInput.focus();
    selectors.planModChatSend.disabled = false;
    isSending = false;
  }
}

export async function handlePlanModChatSend() {
  if (isSending) return;
  if (!selectors.planModChatInput || !selectors.planModChatSend) return;
  const messageText = selectors.planModChatInput.value.trim();
  if (!messageText) {
    showToast('Моля, опишете накратко желаните промени.', true);
    return;
  }
  if (!currentUserId) {
    showToast('Моля, влезте първо.', true);
    return;
  }
  selectors.planModChatInput.disabled = true;
  selectors.planModChatSend.disabled = true;
  await submitPlanChangeRequest(messageText, currentUserId);
}

export function handlePlanModChatInputKeypress(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handlePlanModChatSend();
  }
}

export async function openPlanModificationChat(
  userIdOverride = null,
  _initialMessage = null,
  context = null,
  clientName = null
) {
  const uid = userIdOverride || currentUserId;
  if (!uid) {
    showToast('Моля, влезте първо.', true);
    return;
  }
  clearPlanModChat();
  planModChatContext = context;
  if (selectors.planModChatClient) {
    selectors.planModChatClient.textContent = clientName ? `- ${clientName}` : '';
  }
  openModal('planModChatModal');
  renderGuidance();
  displayPlanModChatMessage(planModificationPrompt, 'bot');
  planModChatHistory.push({ text: planModificationPrompt, sender: 'bot', isError: false });
  if (selectors.planModChatInput) {
    selectors.planModChatInput.disabled = false;
    selectors.planModChatInput.focus();
  }
  if (selectors.planModChatSend) selectors.planModChatSend.disabled = false;
}
