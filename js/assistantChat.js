import { apiEndpoints, cloudflareAccountId, cloudflareAiToken } from './config.js';

const chatEndpoint = apiEndpoints.chat;
const chatHistory = [];

function saveHistory() {
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}
let typingEl = null;

function scrollChatToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

function clearChat() {
    document.getElementById('chat-messages').innerHTML = '';
    chatHistory.length = 0;
    sessionStorage.removeItem('chatHistory');
}

function addMessage(text, sender = 'bot', isError = false) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}` + (isError ? ' error' : '');
    msg.textContent = text;
    document.getElementById('chat-messages').appendChild(msg);
    scrollChatToBottom();
}

function showTyping() {
    if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.className = 'typing-indicator';
        typingEl.textContent = 'Асистентът пише...';
        document.getElementById('chat-messages').appendChild(typingEl);
        scrollChatToBottom();
    }
}

function hideTyping() {
    if (typingEl) {
        typingEl.remove();
        typingEl = null;
    }
}

async function sendMessage() {
    const userIdEl = document.getElementById('userId');
    const inputEl = document.getElementById('chat-input');
    const userId = userIdEl.value.trim();
    const message = inputEl.value.trim();
    if (!userId || !message) return;

    addMessage(message, 'user');
    chatHistory.push({ text: message, sender: 'user', isError: false });
    saveHistory();
    inputEl.value = '';
    inputEl.focus();
    showTyping();

    try {
        const messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...chatHistory.slice(-10).map(h => ({ role: h.sender === 'user' ? 'user' : 'assistant', content: h.text })),
            { role: 'user', content: message }
        ];
        const res = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cloudflareAiToken}`
            },
            body: JSON.stringify({ messages })
        });
        const data = await res.json();
        if (res.ok && data.result?.response) {
            addMessage(data.result.response, 'bot');
            chatHistory.push({ text: data.result.response, sender: 'bot', isError: false });
            saveHistory();
        } else {
            const msg = data.errors?.[0]?.message || 'Грешка при заявката.';
            addMessage(msg, 'bot', true);
            chatHistory.push({ text: msg, sender: 'bot', isError: true });
            saveHistory();
        }
    } catch (err) {
        const msg = 'Неуспешна връзка с Cloudflare AI.';
        addMessage(msg, 'bot', true);
        chatHistory.push({ text: msg, sender: 'bot', isError: true });
        saveHistory();
    } finally {
        hideTyping();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const userIdInput = document.getElementById('userId');
    let savedId = sessionStorage.getItem('userId');

    if (!savedId) {
        savedId = cloudflareAccountId;
        sessionStorage.setItem('userId', savedId);
    }

    userIdInput.value = savedId;
    userIdInput.disabled = true;

    const storedHistory = sessionStorage.getItem('chatHistory');
    if (storedHistory) {
        try {
            const parsed = JSON.parse(storedHistory);
            parsed.forEach(h => {
                addMessage(h.text, h.sender, h.isError);
                chatHistory.push(h);
            });
        } catch { /* ignore parse errors */ }
    }

    document.getElementById('chat-send').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('chat-clear').addEventListener('click', clearChat);
});
