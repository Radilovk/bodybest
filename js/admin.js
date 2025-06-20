import { apiEndpoints } from './config.js';

async function ensureLoggedIn() {
    if (localStorage.getItem('adminSession') === 'true') {
        return;
    }
    try {
        const resp = await fetch('session_check.php');
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            window.location.href = 'login.html';
        }
    } catch (err) {
        window.location.href = 'login.html';
    }
}

const clientsList = document.getElementById('clientsList');
const clientsCount = document.getElementById('clientsCount');
const clientSearch = document.getElementById('clientSearch');
const statusFilter = document.getElementById('statusFilter');
const detailsSection = document.getElementById('clientDetails');
const regenBtn = document.getElementById('regeneratePlan');
const aiSummaryBtn = document.getElementById('aiSummary');
const notesField = document.getElementById('adminNotes');
const tagsField = document.getElementById('adminTags');
const saveNotesBtn = document.getElementById('saveNotes');
const queriesList = document.getElementById('queriesList');
const newQueryText = document.getElementById('newQueryText');
const sendQueryBtn = document.getElementById('sendQuery');
const feedbackList = document.getElementById('feedbackList');
const statsOutput = document.getElementById('statsOutput');
const showStatsBtn = document.getElementById('showStats');
const initialAnswersPre = document.getElementById('initialAnswers');
const planMenuPre = document.getElementById('planMenu');
const dailyLogsPre = document.getElementById('dailyLogs');
const exportPlanBtn = document.getElementById('exportPlan');
const dashboardPre = document.getElementById('dashboardData');
const exportDataBtn = document.getElementById('exportData');
let currentUserId = null;
let currentPlanData = null;
let currentDashboardData = null;
let allClients = [];

function renderObjectAsList(obj) {
    const dl = document.createElement('dl');
    Object.entries(obj || {}).forEach(([key, val]) => {
        const dt = document.createElement('dt');
        dt.textContent = key;
        const dd = document.createElement('dd');
        dd.textContent = typeof val === 'object' ? JSON.stringify(val) : val;
        dl.appendChild(dt);
        dl.appendChild(dd);
    });
    return dl;
}

function capitalizeDay(day) {
    const days = { monday: 'Понеделник', tuesday: 'Вторник', wednesday: 'Сряда',
        thursday: 'Четвъртък', friday: 'Петък', saturday: 'Събота', sunday: 'Неделя' };
    return days[day] || day;
}

function displayInitialAnswers(data) {
    if (!initialAnswersPre) return;
    initialAnswersPre.innerHTML = '';
    if (!data || Object.keys(data).length === 0) {
        initialAnswersPre.textContent = 'Няма данни';
        return;
    }
    initialAnswersPre.appendChild(renderObjectAsList(data));
}

function displayPlanMenu(menu) {
    if (!planMenuPre) return;
    planMenuPre.innerHTML = '';
    if (!menu || Object.keys(menu).length === 0) {
        planMenuPre.textContent = 'Няма меню';
        return;
    }
    const table = document.createElement('table');
    table.className = 'menu-table';
    table.innerHTML = '<thead><tr><th>Ден</th><th>Хранене</th><th>Продукти</th></tr></thead>';
    const tbody = document.createElement('tbody');
    Object.entries(menu).forEach(([day, meals]) => {
        (meals || []).forEach(meal => {
            const tr = document.createElement('tr');
            const items = (meal.items || []).map(i => `${i.name}${i.grams ? ` (${i.grams})` : ''}`).join('<br>');
            tr.innerHTML = `<td>${capitalizeDay(day)}</td><td>${meal.meal_name || ''}</td><td>${items}</td>`;
            tbody.appendChild(tr);
        });
    });
    table.appendChild(tbody);
    planMenuPre.appendChild(table);
}

function displayDailyLogs(logs) {
    if (!dailyLogsPre) return;
    dailyLogsPre.innerHTML = '';
    if (!Array.isArray(logs) || logs.length === 0) {
        dailyLogsPre.textContent = 'Няма записани дневници';
        return;
    }
    const table = document.createElement('table');
    table.className = 'menu-table';
    table.innerHTML = '<thead><tr><th>Дата</th><th>Тегло</th><th>Бележка</th></tr></thead>';
    const tbody = document.createElement('tbody');
    logs.forEach(l => {
        const tr = document.createElement('tr');
        const weight = l.data?.weight || '';
        const note = l.data?.note || '';
        tr.innerHTML = `<td>${l.date}</td><td>${weight}</td><td>${note}</td>`;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    dailyLogsPre.appendChild(table);
}

async function loadClients() {
    try {
        const resp = await fetch(apiEndpoints.listClients);
        const data = await resp.json();
        if (resp.ok && data.success) {
            const withStatus = await Promise.all(
                data.clients.map(async c => {
                    try {
                        const sResp = await fetch(`${apiEndpoints.planStatus}?userId=${c.userId}`);
                        const sData = await sResp.json();
                        return { ...c, status: sData.planStatus || 'unknown' };
                    } catch {
                        return { ...c, status: 'unknown' };
                    }
                })
            );
            allClients = withStatus;
            renderClients();
            const stats = {
                clients: withStatus.length,
                ready: withStatus.filter(c => c.status === 'ready').length,
                pending: withStatus.filter(c => c.status === 'pending').length,
                processing: withStatus.filter(c => c.status === 'processing').length
            };
            statsOutput.innerHTML = `<ul>
                <li>Общо: ${stats.clients}</li>
                <li>Готови: ${stats.ready}</li>
                <li>В изработка: ${stats.processing}</li>
                <li>Чакат: ${stats.pending}</li>
            </ul>`;
        }
    } catch (err) {
        console.error('Error loading clients:', err);
    }
}

function renderClients() {
    const search = (clientSearch.value || '').toLowerCase();
    const filter = statusFilter.value;
    clientsList.innerHTML = '';
    const list = allClients.filter(c => {
        const matchText = `${c.userId} ${c.name || ''} ${c.email || ''}`.toLowerCase();
        const matchesSearch = matchText.includes(search);
        const matchesStatus = filter === 'all' || c.status === filter;
        return matchesSearch && matchesStatus;
    });
    clientsCount.textContent = `Общ брой клиенти: ${list.length}`;
    list.forEach(c => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.classList.add(`status-${c.status}`);
        btn.textContent = `${c.name || c.userId} (${c.userId})`;
        btn.title = c.email || '';
        btn.addEventListener('click', () => showClient(c.userId));
        li.appendChild(btn);
        clientsList.appendChild(li);
    });
}

showStatsBtn.addEventListener('click', () => {
    const sec = document.getElementById('statsSection');
    sec.classList.toggle('hidden');
});

if (clientSearch) clientSearch.addEventListener('input', renderClients);
if (statusFilter) statusFilter.addEventListener('change', renderClients);

async function showClient(userId) {
    try {
        const resp = await fetch(`${apiEndpoints.getProfile}?userId=${userId}`);
        const data = await resp.json();
        currentUserId = userId;
        detailsSection.classList.remove('hidden');
        document.getElementById('clientName').textContent = (resp.ok && data.success && data.name) ? data.name : userId;
        const emailEl = document.getElementById('clientEmail');
        if (emailEl) emailEl.textContent = (resp.ok && data.success && data.email) ? data.email : '';
        if (resp.ok && data.success) {
            await loadQueries();
            await loadFeedback();
        }
        const dashResp = await fetch(`${apiEndpoints.dashboard}?userId=${userId}`);
        const dashData = await dashResp.json();
        if (dashResp.ok && dashData.success) {
            displayInitialAnswers(dashData.initialAnswers || {});
            const menu = dashData.planData?.week1Menu || {};
            displayPlanMenu(menu);
            displayDailyLogs(dashData.dailyLogs || []);
            if (dashboardPre) dashboardPre.textContent = JSON.stringify(dashData, null, 2);
            if (notesField) notesField.value = dashData.currentStatus?.adminNotes || '';
            if (tagsField) tagsField.value = (dashData.currentStatus?.adminTags || []).join(',');
            currentPlanData = dashData.planData || null;
            currentDashboardData = dashData;
        }
    } catch (err) {
        console.error('Error loading profile:', err);
    }
}


sendQueryBtn.addEventListener('click', async () => {
    if (!currentUserId) return;
    const msg = newQueryText.value.trim();
    if (!msg) return;
    try {
        const resp = await fetch(apiEndpoints.addAdminQuery, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, message: msg })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            newQueryText.value = '';
            await loadQueries();
        } else {
            alert(data.message || 'Грешка при изпращане.');
        }
    } catch (err) {
        console.error('Error sending query:', err);
    }
});

if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
        if (!currentUserId) return;
        await fetch(apiEndpoints.updateStatus, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, plan_status: 'pending' })
        });
        alert('Заявката за нов план е изпратена.');
    });
}

if (aiSummaryBtn) {
    aiSummaryBtn.addEventListener('click', async () => {
        if (!currentUserId) return;
        const resp = await fetch(apiEndpoints.aiHelper, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await resp.json();
        alert(data.aiResponse?.result || 'Няма данни');
    });
}

if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', async () => {
        if (!currentUserId) return;
        await fetch(apiEndpoints.updateStatus, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUserId,
                adminNotes: notesField.value,
                adminTags: (tagsField.value || '').split(',').map(t => t.trim()).filter(Boolean)
            })
        });
        alert('Бележките са записани');
    });
}

if (exportPlanBtn) {
    exportPlanBtn.addEventListener('click', () => {
        if (!currentPlanData) return;
        const blob = new Blob([JSON.stringify(currentPlanData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUserId || 'plan'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
        if (!currentDashboardData) return;
        const blob = new Blob([JSON.stringify(currentDashboardData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUserId || 'data'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

async function loadQueries() {
    if (!currentUserId) return;
    try {
        const resp = await fetch(`${apiEndpoints.getAdminQueries}?userId=${currentUserId}`);
        const data = await resp.json();
        queriesList.innerHTML = '';
        if (resp.ok && data.success) {
            data.queries.forEach(q => {
                const li = document.createElement('li');
                li.textContent = q.message;
                queriesList.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Error loading queries:', err);
    }
}

async function loadFeedback() {
    if (!currentUserId) return;
    try {
        const resp = await fetch(`${apiEndpoints.getFeedbackMessages}?userId=${currentUserId}`);
        const data = await resp.json();
        feedbackList.innerHTML = '';
        if (resp.ok && data.success) {
            data.feedback.forEach(f => {
                const li = document.createElement('li');
                const date = new Date(f.timestamp).toLocaleDateString('bg-BG');
                const rating = f.rating ? ` (${f.rating})` : '';
                li.textContent = `${date}: ${f.message}${rating}`;
                feedbackList.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Error loading feedback:', err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await ensureLoggedIn();
    await loadClients();
});
