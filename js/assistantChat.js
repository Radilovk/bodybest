const workerBaseUrl = window.location.hostname === 'localhost' ||
      window.location.hostname.includes('replit') ||
      window.location.hostname.includes('preview')
      ? '/api'
      : 'https://openapichatbot.radilov-k.workers.dev';

const chatEndpoint = `${workerBaseUrl}/api/chat`;

function addMessage(text, sender = 'bot', isError = false) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}` + (isError ? ' error' : '');
    msg.textContent = text;
    document.getElementById('chat-messages').appendChild(msg);
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const userIdEl = document.getElementById('userId');
    const inputEl = document.getElementById('chat-input');
    const userId = userIdEl.value.trim();
    const message = inputEl.value.trim();
    if (!userId || !message) return;

    addMessage(message, 'user');
    inputEl.value = '';
    inputEl.focus();

    try {
        const res = await fetch(chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message })
        });
        const data = await res.json();
        if (res.ok && data.success) addMessage(data.reply, 'bot');
        else addMessage(data.message || 'Грешка при заявката.', 'bot', true);
    } catch (err) {
        addMessage('Неуспешна връзка с Cloudflare Worker.', 'bot', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chat-send').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
});
