import { apiEndpoints, cloudflareAccountId } from './config.js';
import { fileToDataURL } from './utils.js';

const chatEndpoint = apiEndpoints.chat;
const chatHistory = [];

const MODEL_AGREEMENT_HINT =
    'Моделът изисква потвърждение. Изпратете `agree` като първо съобщение.';

function handleModelAgreement(data) {
    if (data?.message &&
        data.message.toLowerCase().includes('model agreement') &&
        !sessionStorage.getItem('modelAgreement')) {
        addMessage(MODEL_AGREEMENT_HINT, 'bot', true);
        chatHistory.push({ text: MODEL_AGREEMENT_HINT, sender: 'bot', isError: true });
        saveHistory();
        return true;
    }
    return false;
}

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

function openImageDialog() {
    document.getElementById('chat-image')?.click();
}

async function sendImage(file) {
    const userId = document.getElementById('userId').value.trim();
    if (!userId || !file) return;
    const msgContainer = document.createElement('div');
    msgContainer.className = 'message user image';
    const imgEl = document.createElement('img');
    imgEl.src = (typeof URL !== 'undefined' && URL.createObjectURL)
        ? URL.createObjectURL(file)
        : '';
    imgEl.alt = 'Изображение за изпращане';
    const statusEl = document.createElement('span');
    statusEl.className = 'upload-status';
    statusEl.textContent = 'Изпращане...';
    msgContainer.appendChild(imgEl);
    msgContainer.appendChild(statusEl);
    document.getElementById('chat-messages').appendChild(msgContainer);
    scrollChatToBottom();
    chatHistory.push({ text: '[image]', sender: 'user', isError: false });
    saveHistory();
    showTyping();
    try {
        const image = await fileToDataURL(file);
        const prompt = document.getElementById('chat-input').value.trim();
        const res = await fetch(apiEndpoints.analyzeImage, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, image, prompt })
        });
        const data = await res.json();
        if (handleModelAgreement(data)) {
            statusEl.textContent = 'Изпратено';
            return;
        } else {
            statusEl.textContent = 'Изпратено';
            const text = data.result || data.message || 'Грешка';
            addMessage(text, 'bot', !res.ok || !data.success);
            chatHistory.push({ text, sender: 'bot', isError: !res.ok || !data.success });
            saveHistory();
        }
    } catch (e) {
        statusEl.textContent = 'Грешка';
        addMessage('Грешка при изпращане на изображението.', 'bot', true);
        chatHistory.push({ text: 'Грешка при изпращане на изображението.', sender: 'bot', isError: true });
        saveHistory();
    } finally {
        hideTyping();
        document.getElementById('chat-image').value = '';
    }
}

async function sendMessage() {
    const userIdEl = document.getElementById('userId');
    const inputEl = document.getElementById('chat-input');
    const userId = userIdEl.value.trim();
    const message = inputEl.value.trim();
    if (!userId || !message) return;
    if (message.toLowerCase() === 'agree') {
        sessionStorage.setItem('modelAgreement', 'true');
    }

    addMessage(message, 'user');
    chatHistory.push({ text: message, sender: 'user', isError: false });
    saveHistory();
    inputEl.value = '';
    inputEl.focus();
    showTyping();

    try {
        const res = await fetch(chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message, history: chatHistory.slice(-10) })
        });
        const data = await res.json();
        if (handleModelAgreement(data)) {
            return;
        } else if (res.ok && data.success) {
            addMessage(data.reply, 'bot');
            chatHistory.push({ text: data.reply, sender: 'bot', isError: false });
            saveHistory();
        } else {
            const msg = data.message || 'Грешка при заявката.';
            addMessage(msg, 'bot', true);
            chatHistory.push({ text: msg, sender: 'bot', isError: true });
            saveHistory();
        }
    } catch (err) {
        const msg = 'Неуспешна връзка с Cloudflare Worker.';
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
    document.getElementById('chat-upload').addEventListener('click', openImageDialog);
    document.getElementById('chat-image').addEventListener('change', e => {
        if (e.target.files[0]) sendImage(e.target.files[0]);
    });
});

export { sendMessage, sendImage, clearChat };
