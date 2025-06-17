import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { openModal, showToast } from './uiHandlers.js';
import { escapeHtml } from './utils.js';
import * as appState from './app.js';

const planModificationPrompt = 'Моля, опишете накратко желаните от вас промени в плана.';

export function clearPlanModChat() {
  if (selectors.planModChatMessages) selectors.planModChatMessages.innerHTML = '';
  appState.chatHistory.length = 0;
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
  appState.chatHistory.push({ text: messageText, sender: 'user', isError: false });

  selectors.planModChatInput.value = '';
  selectors.planModChatInput.disabled = true;
  selectors.planModChatSend.disabled = true;
  displayPlanModChatTypingIndicator(true);
  try {
    const payload = { userId: appState.currentUserId, message: messageText, history: appState.chatHistory.slice(-10) };
    if (appState.chatModelOverride) payload.model = appState.chatModelOverride;
    if (appState.chatPromptOverride) payload.promptOverride = appState.chatPromptOverride;
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
      appState.setChatModelOverride(null);
      appState.setChatPromptOverride(null);
    } else {
      botReply = cleaned;
    }
    displayPlanModChatMessage(botReply, 'bot');
    appState.chatHistory.push({ text: botReply, sender: 'bot', isError: false });
  } catch (e) {
    const errorMsg = `Грешка при комуникация с асистента: ${e.message}`;
    displayPlanModChatMessage(errorMsg, 'bot', true);
    appState.chatHistory.push({ text: errorMsg, sender: 'bot', isError: true });
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

export async function openPlanModificationChat(userIdOverride = null) {
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
    }
  } catch (err) {
    console.warn('Failed to fetch plan modification prompt:', err);
    showToast('Грешка при зареждане на промпта за промени', true);
    promptError = true;
  }
  displayPlanModChatTypingIndicator(false);
  appState.setChatModelOverride(modelFromPrompt);
  appState.setChatPromptOverride(promptOverride);
  if (!promptError) {
    const initialMsg = promptOverride || planModificationPrompt;
    displayPlanModChatMessage(initialMsg, 'bot');
    appState.chatHistory.push({ text: initialMsg, sender: 'bot', isError: false });
  }
  if (selectors.planModChatInput) selectors.planModChatInput.focus();
}
