import { apiEndpoints } from '../config.js';
import { renderClients } from './clients.js';

const notificationsList = document.getElementById('notificationsList');
const notificationsSection = document.getElementById('notificationsSection');
const notificationDot = document.getElementById('notificationIndicator');
const queriesDot = document.getElementById('queriesDot');
const repliesDot = document.getElementById('repliesDot');
const feedbackDot = document.getElementById('feedbackDot');

const unreadClients = new Set();
const unreadByClient = new Map();

function showNotificationDot(show) {
    if (!notificationDot) return;
    notificationDot.classList.toggle('hidden', !show);
}

function toggleDot(dotElem, show) {
    if (!dotElem) return;
    dotElem.classList.toggle('hidden', !show);
}

function updateSectionDots(userId) {
    const flags = unreadByClient.get(userId) || {};
    toggleDot(queriesDot, !!flags.queries);
    toggleDot(repliesDot, !!flags.replies);
    toggleDot(feedbackDot, !!flags.feedback);
}

async function checkForNotifications() {
    if (!notificationDot) return;
    try {
        const resp = await fetch(apiEndpoints.listClients);
        const data = await resp.json();
        if (!resp.ok || !data.success) return;

        const clients = Array.isArray(data.clients) ? data.clients : [];
        let hasNew = false;
        const storedTs = Number(localStorage.getItem('lastFeedbackTs')) || 0;
        let latestTs = storedTs;

        unreadClients.clear();
        unreadByClient.clear();

        for (const c of clients) {
            let userHasNew = false;
            const flags = { queries: false, replies: false, feedback: false };
            const [qResp, rResp, fResp] = await Promise.all([
                fetch(`${apiEndpoints.peekAdminQueries}?userId=${c.userId}`),
                fetch(`${apiEndpoints.peekClientReplies}?userId=${c.userId}`),
                fetch(`${apiEndpoints.getFeedbackMessages}?userId=${c.userId}`)
            ]);
            const qData = await qResp.json().catch(() => ({}));
            const rData = await rResp.json().catch(() => ({}));
            const fData = await fResp.json().catch(() => ({}));

            if (qResp.ok && qData.success && Array.isArray(qData.queries) && qData.queries.length > 0) {
                userHasNew = true;
                flags.queries = true;
            }
            if (rResp.ok && rData.success && Array.isArray(rData.replies) && rData.replies.length > 0) {
                userHasNew = true;
                flags.replies = true;
            }
            if (fResp.ok && fData.success && Array.isArray(fData.feedback)) {
                for (const f of fData.feedback) {
                    const ts = Date.parse(f.timestamp);
                    if (ts && ts > storedTs) {
                        userHasNew = true;
                        flags.feedback = true;
                        if (ts > latestTs) latestTs = ts;
                    }
                }
            }
            if (userHasNew) {
                unreadClients.add(c.userId);
                unreadByClient.set(c.userId, flags);
                hasNew = true;
            }
        }

        if (latestTs > storedTs) {
            localStorage.setItem('lastFeedbackTs', String(latestTs));
        }
        showNotificationDot(hasNew);
        renderClients();
    } catch (err) {
        console.error('Error checking notifications:', err);
    }
}

async function loadNotifications() {
    if (!notificationsList || !notificationsSection) return;
    notificationsList.innerHTML = '';
    try {
        const resp = await fetch(apiEndpoints.listClients);
        const data = await resp.json();
        if (!resp.ok || !data.success) return;
        const storedTs = Number(localStorage.getItem('lastFeedbackTs')) || 0;
        const items = [];
        const clients = Array.isArray(data.clients) ? data.clients : [];
        for (const c of clients) {
            const [qResp, rResp, fResp] = await Promise.all([
                fetch(`${apiEndpoints.peekAdminQueries}?userId=${c.userId}`),
                fetch(`${apiEndpoints.peekClientReplies}?userId=${c.userId}`),
                fetch(`${apiEndpoints.getFeedbackMessages}?userId=${c.userId}`)
            ]);
            const qData = await qResp.json().catch(() => ({}));
            const rData = await rResp.json().catch(() => ({}));
            const fData = await fResp.json().catch(() => ({}));
            if (qResp.ok && qData.success) {
                (qData.queries || []).forEach(q => {
                    items.push({ userId: c.userId, name: c.name, text: q.message });
                });
            }
            if (rResp.ok && rData.success) {
                (rData.replies || []).forEach(r => {
                    items.push({ userId: c.userId, name: c.name, text: r.message });
                });
            }
            if (fResp.ok && fData.success) {
                (fData.feedback || []).forEach(f => {
                    const ts = Date.parse(f.timestamp);
                    if (!ts || ts > storedTs) {
                        items.push({ userId: c.userId, name: c.name, text: f.message });
                    }
                });
            }
        }
        items.forEach(it => {
            const li = document.createElement('li');
            li.textContent = `${it.name || it.userId}: ${it.text}`;
            li.addEventListener('click', () => import('./clients.js').then(m => m.showClient(it.userId)));
            notificationsList.appendChild(li);
        });
        if (items.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Няма нови известия.';
            notificationsList.appendChild(li);
        }
        notificationsSection.classList.toggle('hidden', items.length === 0);
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

export {
    unreadClients,
    unreadByClient,
    showNotificationDot,
    updateSectionDots,
    checkForNotifications,
    loadNotifications
};
