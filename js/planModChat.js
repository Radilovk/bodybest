import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { openModal, showToast } from './uiHandlers.js';
import { escapeHtml } from './utils.js';
import { currentUserId } from './app.js';

export let planModChatHistory = [];
export let planModChatContext = null;
let isSending = false;

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
 * Handles modal close event
 * No longer needs to reload dashboard since changes are made by admin
 */
export async function handlePlanModModalClose() {
  // Modal closed, no action needed
}

function renderGuidance() {
  if (!selectors.planModChatMessages) return;
  const wrapper = document.createElement('div');
  wrapper.classList.add('plan-mod-guidance');
  const intro = document.createElement('p');
  intro.textContent = 'Попълнете свободен текст. Заявката ще бъде изпратена до администратора за преглед и одобрение.';
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
  note.textContent = 'Администраторът ще прегледа заявката и ще направи промените ръчно, за да гарантира безопасност и съответствие с медицинските препоръки.';
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
      throw new Error(result.message || `HTTP ${response.status}`);
    }
    
    // Show confirmation that the request was submitted to admin
    const confirmation = result.message || 'Вашата заявка за промяна на плана е изпратена успешно! Администраторът ще я прегледа и ще направи необходимите промени.';
    
    displayPlanModChatMessage(confirmation, 'bot');
    if (selectors.planModChatInput) {
      selectors.planModChatInput.value = '';
      selectors.planModChatInput.disabled = true;
    }
    if (selectors.planModChatSend) {
      selectors.planModChatSend.disabled = true;
    }
    
    // Show toast notification
    showToast('Заявката е изпратена! Администраторът ще я обработи.', false, 4000);
    
    // No need to reload dashboard or set planModificationPending flag
    // since changes will only be made by admin, not automatically
    
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
