
// chat.js - Логика за Чат
import { selectors } from './uiElements.js';
import { apiEndpoints } from './config.js';
import { currentUserId, chatHistory } from './app.js';

export function toggleChatWidget() {
    if (!selectors.chatWidget || !selectors.chatFab) return;
    const isVisible = selectors.chatWidget.classList.toggle('visible');
    selectors.chatFab.setAttribute('aria-expanded', isVisible.toString());
    if (isVisible) {
        if(selectors.chatInput) selectors.chatInput.focus();
        if (selectors.chatMessages) {
            if (chatHistory.length === 0 && selectors.chatMessages.children.length === 0) {
                 const initialBotMessage = "Здравейте! Аз съм вашият виртуален асистент MyBody.Best. Как мога да ви помогна днес?";
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

export function displayMessage(text, sender = 'bot', isError = false) {
    if (!selectors.chatMessages) return;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    if (isError) messageDiv.classList.add('error');
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

export async function handleChatSend() {
    if (!selectors.chatInput || !selectors.chatSend) return;
    const messageText = selectors.chatInput.value.trim();
    if (!messageText || !currentUserId) return;

    displayMessage(messageText, 'user');
    chatHistory.push({ text: messageText, sender: 'user', isError: false });

    selectors.chatInput.value = '';
    selectors.chatInput.disabled = true;
    selectors.chatSend.disabled = true;
    displayTypingIndicator(true);
    try {
        const payload = { userId: currentUserId, message: messageText, history: chatHistory.slice(-10) };
        const response = await fetch(apiEndpoints.chat, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
        displayMessage(result.reply, 'bot');
        chatHistory.push({ text: result.reply, sender: 'bot', isError: false });
    } catch (e) {
        const errorMsg = `Грешка при комуникация с асистента: ${e.message}`;
        displayMessage(errorMsg, 'bot', true);
        chatHistory.push({ text: errorMsg, sender: 'bot', isError: true });
    } finally {
        displayTypingIndicator(false);
        if(selectors.chatInput) { selectors.chatInput.disabled = false; selectors.chatInput.focus(); }
        if(selectors.chatSend) selectors.chatSend.disabled = false;
    }
}

export function handleChatInputKeypress(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleChatSend(); } }
