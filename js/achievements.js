// achievements.js - управление на похвали и медали
import { selectors } from './uiElements.js';
import { openModal } from './uiHandlers.js';
import { apiEndpoints } from './config.js';

const medalEmojis = ['🥇','🥈','🥉','🏅','🎖️','🏆','🏵️'];

let achievements = [];
let currentUserId = null;

export async function initializeAchievements(userId) {
    currentUserId = userId || null;
    achievements = JSON.parse(localStorage.getItem('achievements') || '[]');
    if (currentUserId) {
        try {
            const res = await fetch(`${apiEndpoints.getAchievements}?userId=${currentUserId}`);
            const data = await res.json();
            if (res.ok && data.success && Array.isArray(data.achievements)) {
                achievements = data.achievements;
                saveAchievements();
            }
        } catch (err) { console.warn('Неуспешно зареждане на постижения:', err); }
    }
    ensureEmojis();
    renderAchievements();

    const last = achievements.length > 0 ? achievements[achievements.length - 1] : null;
    const diffDays = last ? (Date.now() - last.date) / (1000 * 60 * 60 * 24) : Infinity;
    if (diffDays >= 3 && currentUserId) {
        fetchPraiseAndCreate(currentUserId);
    }
}

function saveAchievements() {
    localStorage.setItem('achievements', JSON.stringify(achievements));
}

function ensureEmojis() {
    achievements.forEach((a, idx) => {
        if (!a.emoji) a.emoji = medalEmojis[idx % medalEmojis.length];
    });
    saveAchievements();
}

function updateAchievementModal(emoji, title, message) {
    const body = document.getElementById('achievementModalBody');
    const modalTitle = document.getElementById('achievementModalTitle');
    const medalSpan = document.getElementById('achievementMedalEmoji');
    if (body) body.textContent = message;
    if (modalTitle) modalTitle.textContent = title;
    if (medalSpan) medalSpan.textContent = emoji;
    openModal('achievementModal');
}

function renderAchievements(newIndex = -1) {
    if (!selectors.streakGrid) return;
    selectors.streakGrid.innerHTML = '';
    achievements.forEach((a, index) => {
        const el = document.createElement('div');
        el.className = 'achievement-medal';
        if (index === newIndex) el.classList.add('new');
        el.textContent = a.emoji || medalEmojis[index % medalEmojis.length];
        el.dataset.index = index;
        selectors.streakGrid.appendChild(el);
    });
}

export function createAchievement(title, message) {
    const emoji = medalEmojis[achievements.length % medalEmojis.length];
    achievements.push({ date: Date.now(), title, message, emoji });
    if (achievements.length > 7) achievements.shift();
    saveAchievements();
    renderAchievements(achievements.length - 1);
    updateAchievementModal(emoji, title, message);
    localStorage.setItem('lastPraiseDate', String(Date.now()));
}

export function handleAchievementClick(e) {
    const medal = e.target.closest('.achievement-medal');
    if (!medal) return;
    const index = parseInt(medal.dataset.index, 10);
    const ach = achievements[index];
    if (!ach) return;
    updateAchievementModal(ach.emoji || medalEmojis[index % medalEmojis.length], ach.title, ach.message);
}

async function fetchPraiseAndCreate(userId) {
    try {
        const response = await fetch(apiEndpoints.generatePraise, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await response.json();
        if (response.ok && data.success && data.title && data.message) {
            createAchievement(data.title, data.message);
        }
    } catch (err) {
        console.warn('Грешка при извличане на похвала:', err);
    }
}
