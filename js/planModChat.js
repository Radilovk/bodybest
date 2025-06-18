import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { openModal, showToast } from './uiHandlers.js';
import { escapeHtml } from './utils.js';
import { currentUserId, setChatModelOverride, setChatPromptOverride, chatModelOverride, chatPromptOverride, stripPlanModSignature, pollPlanStatus } from './app.js';

export let planModChatHistory = [];

const planModificationPrompt = 'Моля, опишете накратко желаните от вас промени в плана.';

export function clearPlanModChat() {
  if (selectors.planModChatMessages) selectors.planModChatMessages.innerHTML = '';
  planModChatHistory.length = 0;
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
      indicator.textContent = 'Асистентът пише...';
      selectors.planModChatMessages.appendChild(indicator);
    }
  } else {
    indicator?.remove();
  }
  scrollToPlanModChatBottom();
}

export function scrollToPlanModChatBottom() {
  if (selectors.planModChatMessages)
    selectors.planModChatMessages.scrollTop = selectors.planModChatMessages.scrollHeight;
}

export async function handlePlanModChatSend() {
  if (!selectors.planModChatInput || !selectors.planModChatSend) return;
  const messageText = selectors.planModChatInput.value.trim();
  if (!messageText || !currentUserId) return;

  displayPlanModChatMessage(messageText, 'user');
  planModChatHistory.push({ text: messageText, sender: 'user', isError: false });

  selectors.planModChatInput.value = '';
  selectors.planModChatInput.disabled = true;
  selectors.planModChatSend.disabled = true;
  displayPlanModChatTypingIndicator(true);
  try {
    const payload = { userId: currentUserId, message: messageText, history: planModChatHistory.slice(-10), source: 'planModChat' };
    if (chatModelOverride) payload.model = chatModelOverride;
    if (chatPromptOverride) payload.promptOverride = chatPromptOverride;
    const response = await fetch(apiEndpoints.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
    let botReply = result.reply || '';
    const cleaned = stripPlanModSignature(botReply);
    if (cleaned !== botReply) {
      botReply = cleaned;
      pollPlanStatus();
      setChatModelOverride(null);
      setChatPromptOverride(null);
    } else {
      botReply = cleaned;
    }
    displayPlanModChatMessage(botReply, 'bot');
    planModChatHistory.push({ text: botReply, sender: 'bot', isError: false });
  } catch (e) {
    const errorMsg = `Грешка при комуникация с асистента: ${e.message}`;
    displayPlanModChatMessage(errorMsg, 'bot', true);
    planModChatHistory.push({ text: errorMsg, sender: 'bot', isError: true });
  } finally {
    displayPlanModChatTypingIndicator(false);
    selectors.planModChatInput.disabled = false;
    selectors.planModChatInput.focus();
    selectors.planModChatSend.disabled = false;
  }
}

export function handlePlanModChatInputKeypress(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handlePlanModChatSend();
  }
}

export async function openPlanModificationChat(userIdOverride = null, initialMessage = null) {
  const uid = userIdOverride || currentUserId;
  if (!uid) {
    showToast('Моля, влезте първо.', true);
    return;
  }
  clearPlanModChat();
  openModal('planModChatModal');
  displayPlanModChatTypingIndicator(true);
  let promptOverride = null;
  let modelFromPrompt = null;
  try {
    const respPrompt = await fetch(`${apiEndpoints.getPlanModificationPrompt}?userId=${uid}`);
    if (!respPrompt.ok) {
      let message = 'Грешка при зареждане на промпта за промени';
      try {
        const data = await respPrompt.json();
        if (data && data.message) message = data.message;
      } catch (e) {
        // ignore JSON parse errors
      }
      showToast(message, true);
      return;
    }
    const dataPrompt = await respPrompt.json();
    if (dataPrompt && dataPrompt.prompt) promptOverride = dataPrompt.prompt;
    if (dataPrompt && dataPrompt.model) modelFromPrompt = dataPrompt.model;
  } catch (err) {
    console.warn('Failed to fetch plan modification prompt:', err);
    showToast('Грешка при зареждане на промпта за промени', true);
  }
  displayPlanModChatTypingIndicator(false);
  setChatModelOverride(modelFromPrompt);
  setChatPromptOverride(promptOverride);
  displayPlanModChatMessage(planModificationPrompt, 'bot');
  planModChatHistory.push({ text: planModificationPrompt, sender: 'bot', isError: false });

  if (initialMessage) {
    displayPlanModChatMessage(initialMessage, 'user');
    planModChatHistory.push({ text: initialMessage, sender: 'user', isError: false });
    selectors.planModChatInput && (selectors.planModChatInput.disabled = true);
    selectors.planModChatSend && (selectors.planModChatSend.disabled = true);
    displayPlanModChatTypingIndicator(true);
    try {
      const payload = { userId: uid, message: initialMessage, history: planModChatHistory.slice(-10), source: 'planModChat' };
      if (chatModelOverride) payload.model = chatModelOverride;
      if (chatPromptOverride) payload.promptOverride = chatPromptOverride;
      const response = await fetch(apiEndpoints.chat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
      let botReply = result.reply || '';
      const cleaned = stripPlanModSignature(botReply);
      if (cleaned !== botReply) {
        botReply = cleaned;
        pollPlanStatus();
        setChatModelOverride(null);
        setChatPromptOverride(null);
      } else {
        botReply = cleaned;
      }
      displayPlanModChatMessage(botReply, 'bot');
      planModChatHistory.push({ text: botReply, sender: 'bot', isError: false });
    } catch (err) {
      const errorMsg = `Грешка при комуникация с асистента: ${err.message}`;
      displayPlanModChatMessage(errorMsg, 'bot', true);
      planModChatHistory.push({ text: errorMsg, sender: 'bot', isError: true });
    } finally {
      displayPlanModChatTypingIndicator(false);
      selectors.planModChatInput && (selectors.planModChatInput.disabled = false);
      selectors.planModChatSend && (selectors.planModChatSend.disabled = false);
    }
  }

  if (selectors.planModChatInput) selectors.planModChatInput.focus();
}
