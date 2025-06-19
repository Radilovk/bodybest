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
const profileForm = document.getElementById('profileForm');
const regenBtn = document.getElementById('regeneratePlan');
const aiSummaryBtn = document.getElementById('aiSummary');
const notesField = document.getElementById('adminNotes');
const tagsField = document.getElementById('adminTags');
const saveNotesBtn = document.getElementById('saveNotes');
const queriesList = document.getElementById('queriesList');
const newQueryText = document.getElementById('newQueryText');
const sendQueryBtn = document.getElementById('sendQuery');
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
            statsOutput.textContent = JSON.stringify(stats, null, 2);
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
        const matchText = `${c.name} ${c.userId}`.toLowerCase();
        const matchesSearch = matchText.includes(search);
        const matchesStatus = filter === 'all' || c.status === filter;
        return matchesSearch && matchesStatus;
    });
    clientsCount.textContent = `Общ брой клиенти: ${list.length}`;
    list.forEach(c => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.textContent = `${c.name} (${c.userId}) - ${c.status}`;
        btn.addEventListener('click', () => showClient(c.userId));
        li.appendChild(btn);
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'CSV';
        exportBtn.style.marginLeft = '5px';
        exportBtn.addEventListener('click', () => exportProfileCsv(c.userId));
        li.appendChild(exportBtn);
        clientsList.appendChild(li);
    });
}

showStatsBtn.addEventListener('click', () => {
    const sec = document.getElementById('statsSection');
    sec.classList.toggle('hidden');
});

if (clientSearch) clientSearch.addEventListener('input', renderClients);
if (statusFilter) statusFilter.addEventListener('change', renderClients);

async function exportProfileCsv(userId) {
    try {
        const resp = await fetch(`${apiEndpoints.getProfile}?userId=${userId}`);
        const data = await resp.json();
        if (resp.ok && data.success) {
            const rows = [ ['userId', 'name', 'age', 'height'],
                [userId, data.name || '', data.age || '', data.height || ''] ];
            const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${userId}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        console.error('Error exporting CSV:', err);
    }
}

async function showClient(userId) {
    try {
        const resp = await fetch(`${apiEndpoints.getProfile}?userId=${userId}`);
        const data = await resp.json();
        if (resp.ok && data.success) {
            currentUserId = userId;
            detailsSection.classList.remove('hidden');
            document.getElementById('clientName').textContent = data.name || 'Клиент';
            profileForm.name.value = data.name || '';
            profileForm.age.value = data.age || '';
            profileForm.height.value = data.height || '';
            profileForm.email.value = data.email || '';
            profileForm.weight.value = data.weight || '';
            await loadQueries();
        }
        const dashResp = await fetch(`${apiEndpoints.dashboard}?userId=${userId}`);
        const dashData = await dashResp.json();
        if (dashResp.ok && dashData.success) {
            if (initialAnswersPre) initialAnswersPre.textContent = JSON.stringify(dashData.initialAnswers || {}, null, 2);
            if (planMenuPre) {
                const menu = dashData.planData?.week1Menu || {};
                planMenuPre.textContent = JSON.stringify(menu, null, 2);
            }
            if (dailyLogsPre) dailyLogsPre.textContent = JSON.stringify(dashData.dailyLogs || [], null, 2);
            if (dashboardPre) dashboardPre.textContent = JSON.stringify(dashData, null, 2);
            if (notesField) notesField.value = dashData.currentStatus?.adminNotes || '';
            if (tagsField) tagsField.value = (dashData.currentStatus?.adminTags || []).join(',');
            profileForm.weight.value = dashData.currentStatus?.weight || profileForm.weight.value;
            currentPlanData = dashData.planData || null;
            currentDashboardData = dashData;
        }
    } catch (err) {
        console.error('Error loading profile:', err);
    }
}

profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentUserId) return;
    const payload = {
        userId: currentUserId,
        name: profileForm.name.value,
        age: parseInt(profileForm.age.value, 10) || null,
        height: parseInt(profileForm.height.value, 10) || null,
        email: profileForm.email.value || undefined
    };
    try {
        const resp = await fetch(apiEndpoints.updateProfile, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        alert(data.message || (data.success ? 'Успешно записан профил.' : 'Грешка при запис.'));
        const statusPayload = {
            userId: currentUserId,
            weight: parseFloat(profileForm.weight.value) || null,
            adminNotes: notesField.value,
            adminTags: (tagsField.value || '').split(',').map(t => t.trim()).filter(Boolean)
        };
        await fetch(apiEndpoints.updateStatus, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(statusPayload)
        });
    } catch (err) {
        alert('Грешка при изпращане');
    }
});

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

document.addEventListener('DOMContentLoaded', async () => {
    await ensureLoggedIn();
    await loadClients();
});
