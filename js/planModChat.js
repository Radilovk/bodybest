import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { openModal, showToast, closeModal } from './uiHandlers.js';
import { escapeHtml } from './utils.js';
import * as appState from './app.js';

const planModificationPrompt = 'Моля, опишете накратко желаните от вас промени в плана.';

export function clearPlanModChat() {
  if (selectors.planModChatMessages) selectors.planModChatMessages.innerHTML = '';
  appState.planModChatHistory.length = 0;
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
  if (!messageText || !appState.currentUserId) return;

  displayPlanModChatMessage(messageText, 'user');
  appState.planModChatHistory.push({ text: messageText, sender: 'user', isError: false });

  selectors.planModChatInput.value = '';
  selectors.planModChatInput.disabled = true;
  selectors.planModChatSend.disabled = true;
  displayPlanModChatTypingIndicator(true);
  try {
    const payload = { userId: appState.currentUserId, message: messageText, history: appState.planModChatHistory.slice(-10) };
    if (appState.planModChatModelOverride) payload.model = appState.planModChatModelOverride;
    if (appState.planModChatPromptOverride) payload.promptOverride = appState.planModChatPromptOverride;
    const response = await fetch(apiEndpoints.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
    let botReply = result.reply || '';
    const cleaned = appState.stripPlanModSignature(botReply);
    if (cleaned !== botReply) {
      botReply = cleaned;
      appState.pollPlanStatus();
      appState.setPlanModChatModelOverride(null);
      appState.setPlanModChatPromptOverride(null);
    } else {
      botReply = cleaned;
    }
    displayPlanModChatMessage(botReply, 'bot');
    appState.planModChatHistory.push({ text: botReply, sender: 'bot', isError: false });
  } catch (e) {
    const errorMsg = `Грешка при комуникация с асистента: ${e.message}`;
    displayPlanModChatMessage(errorMsg, 'bot', true);
    appState.planModChatHistory.push({ text: errorMsg, sender: 'bot', isError: true });
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

export async function openPlanModificationChat(userIdOverride = null, forceRefresh = false) {
  const uid = userIdOverride || appState.currentUserId;
  if (!uid) {
    showToast('Моля, влезте първо.', true);
    return;
  }
  clearPlanModChat();
  openModal('planModChatModal');
  displayPlanModChatTypingIndicator(true);
  let promptOverride = null;
  let modelFromPrompt = null;
  let promptError = false;
  const cached = sessionStorage.getItem('planModPrompt');
  if (cached && !forceRefresh) {
    try {
      const data = JSON.parse(cached);
      if (data.promptOverride) promptOverride = data.promptOverride;
      if (data.model) modelFromPrompt = data.model;
    } catch (e) {
      console.warn('Invalid cached plan modification prompt:', e);
      sessionStorage.removeItem('planModPrompt');
    }
  }
  if (!promptOverride && !modelFromPrompt || forceRefresh) {
    try {
      const respPrompt = await fetch(apiEndpoints.getPlanModificationPrompt);
      if (!respPrompt.ok) {
        let errorText;
        try {
          errorText = (await respPrompt.text()) || `HTTP ${respPrompt.status}`;
        } catch {
          errorText = `HTTP ${respPrompt.status}`;
        }
        showToast(errorText, true);
        promptError = true;
      } else {
        const dataPrompt = await respPrompt.json();
        if (dataPrompt && dataPrompt.promptOverride)
          promptOverride = dataPrompt.promptOverride;
        if (dataPrompt && dataPrompt.model) modelFromPrompt = dataPrompt.model;
        try {
          sessionStorage.setItem('planModPrompt', JSON.stringify({
            promptOverride,
            model: modelFromPrompt
          }));
        } catch (e) {
          console.warn('Unable to store plan modification prompt:', e);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch plan modification prompt:', err);
      showToast('Грешка при зареждане на промпта за промени', true);
      promptError = true;
    }
  }
  displayPlanModChatTypingIndicator(false);
  appState.setPlanModChatModelOverride(modelFromPrompt);
  appState.setPlanModChatPromptOverride(promptOverride);
  if (!promptError) {
    const initialMsg = promptOverride || planModificationPrompt;
    displayPlanModChatMessage(initialMsg, 'bot');
    appState.planModChatHistory.push({ text: initialMsg, sender: 'bot', isError: false });
  }
  if (selectors.planModChatInput) selectors.planModChatInput.focus();
}

export function closePlanModChat() {
  appState.setPlanModChatModelOverride(null);
  appState.setPlanModChatPromptOverride(null);
  closeModal('planModChatModal');
}
