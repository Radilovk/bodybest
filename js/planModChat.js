import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { openModal, showToast } from './uiHandlers.js';
import { escapeHtml } from './utils.js';
import { currentUserId, loadDashboardData } from './app.js';
import { clearCache } from './requestCache.js';

export let planModChatHistory = [];
export let planModChatContext = null;
let isSending = false;
let planModificationPending = false; // Flag to track if we need to reload dashboard on modal close

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

/**
 * Проверява дали има pending plan modification и презарежда dashboard данните
 * Тази функция се извиква при затваряне на planModChatModal
 */
export async function handlePlanModModalClose() {
  if (planModificationPending) {
    planModificationPending = false;
    showToast('Презареждане на актуализирания план...', false);
    
    try {
      await loadDashboardData();
      showToast('Планът е актуализиран успешно! Проверете промените в секция "План".', false, 4000);
    } catch (error) {
      console.error('Грешка при презареждане на dashboard:', error);
      showToast('Планът е актуализиран, но има грешка при презареждането. Моля, презаредете страницата.', true, 5000);
    }
  }
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
    if (!response.ok || !result.success) {
      // Check if full regeneration is required
      if (result.requiresFullRegeneration) {
        displayPlanModChatMessage(result.message, 'bot');
        showToast('За тази промяна е необходимо пълно регенериране на плана.', true, 5000);
        return;
      }
      throw new Error(result.message || `HTTP ${response.status}`);
    }
    
    // Show confirmation with details about what was changed
    let confirmation = result.message || 'Заявката е приета. Ще актуализираме плана, ако няма здравословен конфликт.';
    
    // Add modification type info
    if (result.modificationType === 'PARTIAL_MODIFICATION') {
      confirmation = '✨ Частична промяна на плана\n\n' + confirmation;
    }
    
    if (result.appliedChanges && result.appliedChanges.length > 0) {
      const changesText = result.appliedChanges
        .map(key => CHANGE_DISPLAY_NAMES[key] || key)
        .join(', ');
      confirmation += `\n\n✅ Променени секции (${result.appliedChanges.length}): ${changesText}`;
    }
    
    // Добавяме инструкция за затваряне на модала
    confirmation += '\n\n📌 Моля, затворете този прозорец за да видите обновения план.';
    
    displayPlanModChatMessage(confirmation, 'bot');
    if (selectors.planModChatInput) {
      selectors.planModChatInput.value = '';
      selectors.planModChatInput.disabled = true;
    }
    if (selectors.planModChatSend) {
      selectors.planModChatSend.disabled = true;
    }
    
    // Показваме съобщение че трябва да затворят модала
    showToast('Промените са запазени! Затворете прозореца за да видите актуализирания план.', false, 5000);
    
    // Изчистваме кеша незабавно, за да сме сигурни че следващото зареждане ще вземе новите данни
    clearCache(apiEndpoints.dashboard);
    
    // Set flag so we reload dashboard when modal closes
    planModificationPending = true;
    
    // НЕ затваряме модала автоматично - потребителят трябва да прочете отговора и да го затвори сам
    // Когато затвори модала (чрез event listener), данните ще се презаредят автоматично
    
  } catch (e) {
    const errorMsg = `Грешка при изпращане: ${e.message}`;
    displayPlanModChatMessage(errorMsg, 'bot', true);
    showToast(errorMsg, true);
    
    // Re-enable input controls on error so user can retry
    if (selectors.planModChatInput) {
      selectors.planModChatInput.disabled = false;
      selectors.planModChatInput.focus();
    }
    if (selectors.planModChatSend) {
      selectors.planModChatSend.disabled = false;
    }
  } finally {
    displayPlanModChatTypingIndicator(false);
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
  
  // Ensure input and send button are enabled when opening modal
  if (selectors.planModChatInput) {
    selectors.planModChatInput.disabled = false;
    selectors.planModChatInput.focus();
  }
  if (selectors.planModChatSend) {
    selectors.planModChatSend.disabled = false;
  }
}
