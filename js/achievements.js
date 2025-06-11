// achievements.js - управление на похвали и медали
import { selectors } from './uiElements.js';
import { openModal } from './uiHandlers.js';
import { apiEndpoints } from './config.js';

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

function renderAchievements() {
    if (!selectors.streakGrid) return;
    selectors.streakGrid.innerHTML = '';
    achievements.forEach((a, index) => {
        const el = document.createElement('div');
        el.className = 'achievement-medal';
        el.textContent = '🏅';
        el.dataset.index = index;
        selectors.streakGrid.appendChild(el);
    });
    if (selectors.streakCount) selectors.streakCount.textContent = achievements.length;
}

export function createAchievement(title, message) {
    achievements.push({ date: Date.now(), title, message });
    if (achievements.length > 7) achievements.shift();
    saveAchievements();
    renderAchievements();
    const body = document.getElementById('achievementModalBody');
    const modalTitle = document.getElementById('achievementModalTitle');
    if (body) body.textContent = message;
    if (modalTitle) modalTitle.textContent = title;
    openModal('achievementModal');
    localStorage.setItem('lastPraiseDate', String(Date.now()));
}

export function handleAchievementClick(e) {
    const medal = e.target.closest('.achievement-medal');
    if (!medal) return;
    const index = parseInt(medal.dataset.index, 10);
    const ach = achievements[index];
    if (!ach) return;
    const body = document.getElementById('achievementModalBody');
    const modalTitle = document.getElementById('achievementModalTitle');
    if (body) body.textContent = ach.message;
    if (modalTitle) modalTitle.textContent = ach.title;
    openModal('achievementModal');
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
