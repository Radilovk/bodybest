import { apiEndpoints } from './config.js';

async function ensureLoggedIn() {
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
const detailsSection = document.getElementById('clientDetails');
const profileForm = document.getElementById('profileForm');
const queriesList = document.getElementById('queriesList');
const newQueryText = document.getElementById('newQueryText');
const sendQueryBtn = document.getElementById('sendQuery');
const statsOutput = document.getElementById('statsOutput');
const showStatsBtn = document.getElementById('showStats');
let currentUserId = null;

async function loadClients() {
    try {
        const resp = await fetch(apiEndpoints.listClients);
        const data = await resp.json();
        if (resp.ok && data.success) {
            clientsList.innerHTML = '';
            clientsCount.textContent = `Общ брой клиенти: ${data.clients.length}`;
            data.clients.forEach(c => {
                const li = document.createElement('li');
                const btn = document.createElement('button');
                btn.textContent = `${c.name} (${c.userId})`;
                btn.addEventListener('click', () => showClient(c.userId));
                li.appendChild(btn);
                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'CSV';
                exportBtn.style.marginLeft = '5px';
                exportBtn.addEventListener('click', () => exportProfileCsv(c.userId));
                li.appendChild(exportBtn);
                clientsList.appendChild(li);
            });
            statsOutput.textContent = JSON.stringify({ clients: data.clients.length }, null, 2);
        }
    } catch (err) {
        console.error('Error loading clients:', err);
    }
}

showStatsBtn.addEventListener('click', () => {
    const sec = document.getElementById('statsSection');
    sec.classList.toggle('hidden');
});

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
            await loadQueries();
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
        height: parseInt(profileForm.height.value, 10) || null
    };
    try {
        const resp = await fetch(apiEndpoints.updateProfile, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        alert(data.message || (data.success ? 'Успешно записан профил.' : 'Грешка при запис.'));
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
