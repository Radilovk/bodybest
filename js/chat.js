
// chat.js - Логика за Чат
import { selectors } from './uiElements.js';
import { chatHistory, currentUserId, handleChatImageUpload } from './app.js'; // Access chatHistory and userId
import { apiEndpoints, initialBotMessage } from './config.js';
import { escapeHtml } from './utils.js';

export let automatedChatPending = false;
export function setAutomatedChatPending(val) { automatedChatPending = val; }

export function toggleChatWidget(skipInit = false) {
    if (!selectors.chatWidget || !selectors.chatFab) return;
    const isVisible = selectors.chatWidget.classList.toggle('visible');
    selectors.chatFab.setAttribute('aria-expanded', isVisible.toString());
    if (isVisible && automatedChatPending && currentUserId) {
        selectors.chatFab.classList.remove('notification');
        automatedChatPending = false;
        fetch(apiEndpoints.recordFeedbackChat, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        }).catch(() => {});
    }
    if (isVisible) {
        if(selectors.chatInput) selectors.chatInput.focus();
        if (selectors.chatMessages) {
            if (!skipInit && chatHistory.length === 0 && selectors.chatMessages.children.length === 0) {
                 displayMessage(initialBotMessage, 'bot');
                 chatHistory.push({ text: initialBotMessage, sender: 'bot', isError: false });
            } else if (selectors.chatMessages.children.length === 0 && chatHistory.length > 0) {
                // Repopulate if widget was closed and reopened without history wipe
                 chatHistory.forEach(msg => displayMessage(msg.text, msg.sender, msg.isError));
            }
            scrollToChatBottom();
        }
    }
}

export function closeChatWidget() {
    if (!selectors.chatWidget || !selectors.chatFab) return;
    selectors.chatWidget.classList.remove('visible');
    selectors.chatFab.setAttribute('aria-expanded', 'false');
    if (selectors.chatFab) selectors.chatFab.focus();
}

export function clearChat() {
    if (!selectors.chatMessages) return;
    selectors.chatMessages.innerHTML = '';
    chatHistory.length = 0;
}

export function displayMessage(text, sender = 'bot', isError = false) {
    if (!selectors.chatMessages) return;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    if (isError) messageDiv.classList.add('error');
    text = escapeHtml(text);
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    messageDiv.innerHTML = text.replace(/\n/g, '<br>');
    selectors.chatMessages.appendChild(messageDiv); scrollToChatBottom();
}

export function displayTypingIndicator(show) {
    if (!selectors.chatMessages) return;
    let indicator = selectors.chatMessages.querySelector('.typing-indicator');
    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.classList.add('message', 'bot', 'typing-indicator');
            indicator.textContent = 'Асистентът пише...';
            selectors.chatMessages.appendChild(indicator);
        }
    } else indicator?.remove();
    scrollToChatBottom();
}

export function scrollToChatBottom() { if (selectors.chatMessages) selectors.chatMessages.scrollTop = selectors.chatMessages.scrollHeight; }

export function openChatImageDialog() {
    selectors.chatImageInput?.click();
}

export function handleChatImageSelected() {
    const file = selectors.chatImageInput?.files[0];
    if (file) handleChatImageUpload(file);
}

// handleChatSend and handleChatInputKeypress remain in app.js as they modify chatHistory and call API
