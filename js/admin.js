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
const tagFilterSelect = document.getElementById('tagFilter');
const detailsSection = document.getElementById('clientDetails');
const regenBtn = document.getElementById('regeneratePlan');
const aiSummaryBtn = document.getElementById('aiSummary');
const notesField = document.getElementById('adminNotes');
const tagsField = document.getElementById('adminTags');
const saveNotesBtn = document.getElementById('saveNotes');
const queriesList = document.getElementById('queriesList');
const newQueryText = document.getElementById('newQueryText');
const sendQueryBtn = document.getElementById('sendQuery');
const clientRepliesList = document.getElementById('clientRepliesList');
const feedbackList = document.getElementById('feedbackList');
const statsOutput = document.getElementById('statsOutput');
const showStatsBtn = document.getElementById('showStats');
const sortOrderSelect = document.getElementById('sortOrder');
const initialAnswersPre = document.getElementById('initialAnswers');
const planMenuPre = document.getElementById('planMenu');
const dailyLogsPre = document.getElementById('dailyLogs');
const exportPlanBtn = document.getElementById('exportPlan');
const openFullProfileLink = document.getElementById('openFullProfile');
const toggleFullProfileBtn = document.getElementById('toggleFullProfile');
const fullProfileFrame = document.getElementById('fullProfileFrame');
const dashboardPre = document.getElementById('dashboardData');
const dashboardSummaryDiv = document.getElementById('dashboardSummary');
const exportDataBtn = document.getElementById('exportData');
const exportCsvBtn = document.getElementById('exportCsv');
const profileForm = document.getElementById('profileForm');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const aiConfigForm = document.getElementById('aiConfigForm');
const planModelInput = document.getElementById('planModel');
const chatModelInput = document.getElementById('chatModel');
const modModelInput = document.getElementById('modModel');
const adminTokenInput = document.getElementById('adminToken');
const presetSelect = document.getElementById('aiPresetSelect');
const savePresetBtn = document.getElementById('savePreset');
const applyPresetBtn = document.getElementById('applyPreset');
const presetNameInput = document.getElementById('presetName');
const testPlanBtn = document.getElementById('testPlanModel');
const testChatBtn = document.getElementById('testChatModel');
const testModBtn = document.getElementById('testModModel');
const clientNameHeading = document.getElementById('clientName');
const closeProfileBtn = document.getElementById('closeProfile');
const notificationsList = document.getElementById('notificationsList');
const notificationsSection = document.getElementById('notificationsSection');
const notificationDot = document.getElementById('notificationIndicator');
const queriesDot = document.getElementById('queriesDot');
const repliesDot = document.getElementById('repliesDot');
const feedbackDot = document.getElementById('feedbackDot');
const statusChartCanvas = document.getElementById('statusChart');
const weightChartCanvas = document.getElementById('weightChart');
const toggleWeightChartBtn = document.getElementById('toggleWeightChart');
let statusChart = null;
let weightChart = null;
let currentUserId = null;
let currentPlanData = null;
let currentDashboardData = null;
let allClients = [];
// set of userIds с непрочетени съобщения/обратна връзка
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

        const clients = data.clients || [];
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
        if (currentUserId) updateSectionDots(currentUserId);
    } catch (err) {
        console.error('Error checking notifications:', err);
    }
}

function renderValue(val) {
    if (Array.isArray(val)) {
        const ul = document.createElement('ul');
        val.forEach(item => {
            const li = document.createElement('li');
            if (item && typeof item === 'object') {
                li.appendChild(renderValue(item));
            } else {
                li.textContent = item;
            }
            ul.appendChild(li);
        });
        return ul;
    }
    if (val && typeof val === 'object') {
        return renderObjectAsList(val);
    }
    const span = document.createElement('span');
    span.textContent = val;
    return span;
}

function renderObjectAsList(obj) {
    const dl = document.createElement('dl');
    Object.entries(obj || {}).forEach(([key, val]) => {
        const dt = document.createElement('dt');
        dt.textContent = key;
        const dd = document.createElement('dd');
        dd.appendChild(renderValue(val));
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

function displayInitialAnswers(data, isError = false) {
    if (!initialAnswersPre) return;
    initialAnswersPre.innerHTML = '';
    if (isError) {
        initialAnswersPre.textContent = 'Грешка при зареждане';
        return;
    }
    if (!data || Object.keys(data).length === 0) {
        initialAnswersPre.textContent = 'Няма данни';
        return;
    }
    initialAnswersPre.appendChild(renderObjectAsList(data));
}

function displayPlanMenu(menu, isError = false) {
    if (!planMenuPre) return;
    planMenuPre.innerHTML = '';
    if (isError) {
        planMenuPre.textContent = 'Грешка при зареждане';
        return;
    }
    if (!menu || Object.keys(menu).length === 0) {
        planMenuPre.textContent = 'Няма меню';
        return;
    }
    const table = document.createElement('table');
    table.className = 'menu-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Ден', 'Хранене', 'Продукти'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    Object.entries(menu).forEach(([day, meals]) => {
        (meals || []).forEach(meal => {
            const tr = document.createElement('tr');
            const dayTd = document.createElement('td');
            dayTd.textContent = capitalizeDay(day);
            const mealTd = document.createElement('td');
            mealTd.textContent = meal.meal_name || '';
            const itemsTd = document.createElement('td');
            (meal.items || []).forEach((i, idx, arr) => {
                const span = document.createElement('span');
                span.textContent = `${i.name}${i.grams ? ` (${i.grams})` : ''}`;
                itemsTd.appendChild(span);
                if (idx < arr.length - 1) {
                    itemsTd.appendChild(document.createElement('br'));
                }
            });
            tr.appendChild(dayTd);
            tr.appendChild(mealTd);
            tr.appendChild(itemsTd);
            tbody.appendChild(tr);
        });
    });
    table.appendChild(tbody);
    planMenuPre.appendChild(table);
}

function displayDailyLogs(logs, isError = false) {
    if (!dailyLogsPre) return;
    dailyLogsPre.innerHTML = '';
    if (isError) {
        dailyLogsPre.textContent = 'Грешка при зареждане';
        return;
    }
    if (!Array.isArray(logs) || logs.length === 0) {
        dailyLogsPre.textContent = 'Няма записани дневници';
        return;
    }
    const table = document.createElement('table');
    table.className = 'menu-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Дата', 'Тегло', 'Бележка'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    logs.forEach(l => {
        const tr = document.createElement('tr');
        const weight = l.data?.weight || '';
        const note = l.data?.note || '';
        const dateTd = document.createElement('td');
        dateTd.textContent = l.date;
        const weightTd = document.createElement('td');
        weightTd.textContent = weight;
        const noteTd = document.createElement('td');
        noteTd.textContent = note;
        tr.appendChild(dateTd);
        tr.appendChild(weightTd);
        tr.appendChild(noteTd);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    dailyLogsPre.appendChild(table);
    updateWeightChart(logs);
}

function displayDashboardSummary(data) {
    if (!dashboardSummaryDiv) return;
    dashboardSummaryDiv.innerHTML = '';
    if (!data) {
        dashboardSummaryDiv.textContent = 'Няма данни';
        return;
    }
    const profileSec = document.createElement('section');
    profileSec.innerHTML = '<h3>Профил</h3>';
    profileSec.appendChild(renderObjectAsList(data.initialAnswers || {}));
    const statusSec = document.createElement('section');
    statusSec.innerHTML = '<h3>Текущ статус</h3>';
    statusSec.appendChild(renderObjectAsList(data.currentStatus || {}));
    const analyticsSec = document.createElement('section');
    analyticsSec.innerHTML = '<h3>Анализ</h3>';
    analyticsSec.appendChild(renderObjectAsList(data.analytics || {}));
    dashboardSummaryDiv.appendChild(profileSec);
    dashboardSummaryDiv.appendChild(statusSec);
    dashboardSummaryDiv.appendChild(analyticsSec);
}

async function loadClients() {
    try {
        const resp = await fetch(apiEndpoints.listClients);
        const data = await resp.json();
        if (resp.ok && data.success) {
            const withStatus = await Promise.all(
                data.clients.map(async c => {
                    try {
                        const dResp = await fetch(`${apiEndpoints.dashboard}?userId=${c.userId}`);
                        const dData = await dResp.json();
                        return {
                            ...c,
                            status: dData.planStatus || 'unknown',
                            tags: dData.currentStatus?.adminTags || [],
                            lastUpdated: dData.currentStatus?.lastUpdated || ''
                        };
                    } catch {
                        return { ...c, status: 'unknown', tags: [] };
                    }
                })
            );
            allClients = withStatus;
            updateTagFilterOptions();
            renderClients();
            const stats = {
                clients: withStatus.length,
                ready: withStatus.filter(c => c.status === 'ready').length,
                pending: withStatus.filter(c => c.status === 'pending').length,
                processing: withStatus.filter(c => c.status === 'processing').length
            };
            if (statsOutput) statsOutput.textContent = JSON.stringify(stats, null, 2);
            updateStatusChart(stats);
        }
    } catch (err) {
        console.error('Error loading clients:', err);
        alert('Грешка при зареждане на клиентите. Проверете връзката с API.');
    }
}

function renderClients() {
    const search = (clientSearch.value || '').toLowerCase();
    const filter = statusFilter.value;
    const tagFilter = tagFilterSelect ? tagFilterSelect.value : 'all';
    const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'name';
    if (clientsList) clientsList.innerHTML = '';
    const list = allClients.filter(c => {
        const matchText = `${c.userId} ${c.name || ''} ${c.email || ''}`.toLowerCase();
        const matchesSearch = matchText.includes(search);
        const matchesStatus = filter === 'all' || c.status === filter;
        const matchesTag = tagFilter === 'all' || (c.tags || []).includes(tagFilter);
        return matchesSearch && matchesStatus && matchesTag;
    });
    list.sort((a, b) => {
        if (sortOrder === 'date') {
            const aTs = a.registrationDate ? Date.parse(a.registrationDate) : 0;
            const bTs = b.registrationDate ? Date.parse(b.registrationDate) : 0;
            return aTs - bTs;
        }
        return (a.name || '').localeCompare(b.name || '');
    });
    if (clientsCount) clientsCount.textContent = `Общ брой клиенти: ${list.length}`;
    list.forEach(c => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        const dateText = c.registrationDate ? ` - ${new Date(c.registrationDate).toLocaleDateString('bg-BG')}` : '';
        const lastText = c.lastUpdated ? ` (обновено ${new Date(c.lastUpdated).toLocaleDateString('bg-BG')})` : '';
        btn.textContent = `${c.name}${dateText}${lastText}`;
        const statusEl = document.createElement('span');
        statusEl.className = `status-badge status-${c.status}`;
        statusEl.textContent = c.status;
        btn.appendChild(statusEl);
        (c.tags || []).forEach(t => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag-badge';
            tagEl.textContent = t;
            btn.appendChild(tagEl);
        });
        if (unreadClients.has(c.userId)) {
            const dot = document.createElement('span');
            dot.classList.add('notification-dot');
            btn.appendChild(dot);
        }
        btn.addEventListener('click', () => showClient(c.userId));
        li.appendChild(btn);
        clientsList?.appendChild(li);
    });
}

function updateTagFilterOptions() {
    if (!tagFilterSelect) return;
    const tags = new Set();
    allClients.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
    const current = tagFilterSelect.value;
    tagFilterSelect.innerHTML = '<option value="all">Всички етикети</option>';
    Array.from(tags).sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tagFilterSelect.appendChild(opt);
    });
    if (current && Array.from(tags).includes(current)) tagFilterSelect.value = current;
}

function updateStatusChart(stats) {
    if (!statusChartCanvas || typeof Chart === 'undefined') return;
    if (statusChart) statusChart.destroy();
    const ctx = statusChartCanvas.getContext('2d');
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['ready', 'processing', 'pending'],
            datasets: [{
                data: [stats.ready, stats.processing, stats.pending],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

function updateWeightChart(logs) {
    if (!weightChartCanvas || typeof Chart === 'undefined') return;
    const weights = logs
        .filter(l => l.data && l.data.weight)
        .map(l => ({ date: l.date, weight: Number(l.data.weight) }));
    if (weights.length === 0) {
        if (weightChart) weightChart.destroy();
        return;
    }
    const ctx = weightChartCanvas.getContext('2d');
    if (weightChart) weightChart.destroy();
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weights.map(w => w.date),
            datasets: [{
                label: 'Тегло',
                data: weights.map(w => w.weight),
                borderColor: '#007bff',
                fill: false
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}

function setupTabs() {
    const buttons = document.querySelectorAll('#clientTabs .tab-btn');
    const panels = document.querySelectorAll('.client-tab');
    if (buttons.length === 0) return;
    const activate = (btn) => {
        const target = btn.getAttribute('data-target');
        buttons.forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
        panels.forEach(p => {
            const active = p.id === target;
            p.classList.toggle('active-tab-content', active);
            p.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
    };
    buttons.forEach(b => b.addEventListener('click', () => activate(b)));
    activate(buttons[0]);
}

function resetTabs() {
    const buttons = document.querySelectorAll('#clientTabs .tab-btn');
    const panels = document.querySelectorAll('.client-tab');
    if (buttons.length === 0) return;
    buttons.forEach((b, idx) => b.setAttribute('aria-selected', idx === 0 ? 'true' : 'false'));
    panels.forEach((p, idx) => {
        const active = idx === 0;
        p.classList.toggle('active-tab-content', active);
        p.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
}

function openDetailsSections() {
    const detailElems = document.querySelectorAll('#clientDetails details');
    detailElems.forEach(d => {
        d.open = true;
    });
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
        for (const c of data.clients) {
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
            li.addEventListener('click', () => showClient(it.userId));
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

showStatsBtn.addEventListener('click', () => {
    const sec = document.getElementById('statsSection');
    sec.classList.toggle('hidden');
});

if (toggleWeightChartBtn) {
    toggleWeightChartBtn.addEventListener('click', () => {
        weightChartCanvas?.classList.toggle('hidden');
    });
}

if (toggleFullProfileBtn) {
    toggleFullProfileBtn.addEventListener('click', () => {
        const isHidden = fullProfileFrame?.classList.toggle('hidden');
        if (isHidden) {
            toggleFullProfileBtn.textContent = 'Покажи пълен профил';
        } else {
            toggleFullProfileBtn.textContent = 'Скрий пълен профил';
        }
    });
}

if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => {
        detailsSection.classList.add('hidden');
        resetTabs();
        sessionStorage.removeItem('activeTabId');
        currentUserId = null;
    });
}

if (clientSearch) clientSearch.addEventListener('input', renderClients);
if (statusFilter) statusFilter.addEventListener('change', renderClients);
if (sortOrderSelect) sortOrderSelect.addEventListener('change', renderClients);
if (tagFilterSelect) tagFilterSelect.addEventListener('change', renderClients);

async function showClient(userId) {
    if (fullProfileFrame) fullProfileFrame.classList.add('hidden');
    if (toggleFullProfileBtn) toggleFullProfileBtn.textContent = 'Покажи пълен профил';
    try {
        const [profileResp, dashResp] = await Promise.all([
            fetch(`${apiEndpoints.getProfile}?userId=${userId}`),
            fetch(`${apiEndpoints.dashboard}?userId=${userId}`)
        ]);
        const [data, dashData] = await Promise.all([
            profileResp.json().catch(() => ({})),
            dashResp.json().catch(() => ({}))
        ]);
        let hasError = false;
        if (profileResp.ok && data.success) {
            currentUserId = userId;
            detailsSection.classList.remove('hidden');
            resetTabs();
            openDetailsSections();
            const clientInfo = allClients.find(c => c.userId === userId);
            const regDate = clientInfo?.registrationDate ? new Date(clientInfo.registrationDate).toLocaleDateString('bg-BG') : '';
            const name = clientInfo?.name || data.name || userId;
            clientNameHeading.textContent = regDate ? `${name} - ${regDate}` : name;
            if (profileName) profileName.value = data.name || '';
            if (profileEmail) profileEmail.value = data.email || '';
            if (profilePhone) profilePhone.value = data.phone || '';
            if (openFullProfileLink) openFullProfileLink.href = `clientProfile.html?userId=${encodeURIComponent(userId)}`;
            if (fullProfileFrame) fullProfileFrame.src = `clientProfile.html?userId=${encodeURIComponent(userId)}`;
            await Promise.all([
                loadQueries(true),
                loadFeedback(),
                loadClientReplies(true)
            ]);
            unreadClients.delete(userId);
            unreadByClient.delete(userId);
            updateSectionDots(userId);
            renderClients();
        } else {
            hasError = true;
        }
        if (dashResp.ok && dashData.success) {
            displayInitialAnswers(dashData.initialAnswers || {}, false);
            const menu = dashData.planData?.week1Menu || {};
            displayPlanMenu(menu, false);
            displayDailyLogs(dashData.dailyLogs || [], false);
            displayDashboardSummary(dashData);
            if (dashboardPre) dashboardPre.textContent = JSON.stringify(dashData, null, 2);
            if (notesField) notesField.value = dashData.currentStatus?.adminNotes || '';
            if (tagsField) tagsField.value = (dashData.currentStatus?.adminTags || []).join(',');
            currentPlanData = dashData.planData || null;
            currentDashboardData = dashData;
            const clientInfo = allClients.find(c => c.userId === userId);
            if (clientInfo) {
                clientInfo.tags = dashData.currentStatus?.adminTags || [];
                clientInfo.lastUpdated = dashData.currentStatus?.lastUpdated || '';
                updateTagFilterOptions();
                renderClients();
            }
        } else {
            displayInitialAnswers(null, true);
            displayPlanMenu(null, true);
            displayDailyLogs(null, true);
            hasError = true;
        }
        if (hasError) {
            alert('Грешка при зареждане на данните за клиента');
        }
    } catch (err) {
        console.error('Error loading profile:', err);
        alert('Грешка при зареждане на данните за клиента');
    }
    await loadNotifications();
    updateSectionDots(userId);
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
        const summary = data.aiResponse?.result || data.aiResponse;
        alert(summary || 'Няма данни');
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

if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (!currentDashboardData) return;
        const logs = currentDashboardData.dailyLogs || [];
        let csv = 'Дата,Тегло,Бележка\n';
        logs.forEach(l => {
            const note = (l.data?.note || '').replace(/\n/g, ' ');
            csv += `${l.date},${l.data?.weight || ''},${note}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUserId || 'logs'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUserId) return;
        try {
            await fetch(apiEndpoints.updateProfile, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    name: profileName.value.trim(),
                    email: profileEmail.value.trim(),
                    phone: profilePhone.value.trim()
                })
            });
            alert('Профилът е обновен.');
        } catch (err) {
            console.error('Error updating profile:', err);
        }
    });
}

async function loadQueries(markRead = false) {
    if (!currentUserId) return;
    try {
        const endpoint = markRead ? apiEndpoints.getAdminQueries : apiEndpoints.peekAdminQueries;
        const resp = await fetch(`${endpoint}?userId=${currentUserId}`);
        const data = await resp.json();
        if (queriesList) queriesList.innerHTML = '';
        if (resp.ok && data.success) {
            data.queries.forEach(q => {
                const li = document.createElement('li');
                li.textContent = q.message;
                queriesList?.appendChild(li);
            });
            await checkForNotifications();
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
        if (feedbackList) feedbackList.innerHTML = '';
        if (resp.ok && data.success) {
            let latestTs = Number(localStorage.getItem('lastFeedbackTs')) || 0;
            data.feedback.forEach(f => {
                const li = document.createElement('li');
                const date = new Date(f.timestamp).toLocaleDateString('bg-BG');
                const rating = f.rating ? ` (${f.rating})` : '';
                li.textContent = `${date}: ${f.message}${rating}`;
                feedbackList?.appendChild(li);
                const ts = Date.parse(f.timestamp);
                if (ts && ts > latestTs) latestTs = ts;
            });
            localStorage.setItem('lastFeedbackTs', String(latestTs));
            await checkForNotifications();
        }
    } catch (err) {
        console.error('Error loading feedback:', err);
    }
}

async function loadClientReplies(markRead = false) {
    if (!currentUserId) return;
    try {
        const endpoint = markRead ? apiEndpoints.getClientReplies : apiEndpoints.peekClientReplies;
        const resp = await fetch(`${endpoint}?userId=${currentUserId}`);
        const data = await resp.json();
        if (clientRepliesList) clientRepliesList.innerHTML = '';
        if (resp.ok && data.success) {
            data.replies.forEach(r => {
                const li = document.createElement('li');
                const date = new Date(r.ts || r.timestamp).toLocaleDateString('bg-BG');
                li.textContent = `${date}: ${r.message}`;
                clientRepliesList?.appendChild(li);
            });
            await checkForNotifications();
        }
    } catch (err) {
        console.error('Error loading client replies:', err);
    }
}

function loadAdminToken() {
    if (!adminTokenInput) return;
    adminTokenInput.value = localStorage.getItem('adminToken') || '';
}

async function loadAiConfig() {
    if (!aiConfigForm) return;
    try {
        const resp = await fetch(apiEndpoints.getAiConfig);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        const cfg = data.config || {};
        planModelInput.value = cfg.model_plan_generation || '';
        chatModelInput.value = cfg.model_chat || '';
        modModelInput.value = cfg.model_principle_adjustment || '';
    } catch (err) {
        console.error('Error loading AI config:', err);
        alert('Грешка при зареждане на AI конфигурацията.');
    }
}

async function saveAiConfig() {
    if (!aiConfigForm) return;
    const payload = {
        updates: {
            model_plan_generation: planModelInput.value.trim(),
            model_chat: chatModelInput.value.trim(),
            model_principle_adjustment: modModelInput.value.trim()
        }
    };
    try {
        let adminToken = '';
        if (adminTokenInput) {
            adminToken = adminTokenInput.value.trim();
            localStorage.setItem('adminToken', adminToken);
        } else {
            adminToken = localStorage.getItem('adminToken') || '';
        }
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.setAiConfig, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            const error = new Error(data.message || 'Error');
            error.status = resp.status;
            throw error;
        }
        alert('AI конфигурацията е записана.');
        await loadAiConfig();
    } catch (err) {
        console.error('Error saving AI config:', err, 'Status:', err.status);
        if (err.message && err.message.includes('Невалиден токен')) {
            alert('Невалиден токен. Моля, въведете правилния токен и проверете секретa на Worker-а.');
        } else {
            alert('Грешка при записване на AI конфигурацията.');
        }
    }
}

async function loadAiPresets() {
    if (!presetSelect) return;
    try {
        const resp = await fetch(apiEndpoints.listAiPresets);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        presetSelect.innerHTML = '<option value="">--Изберете--</option>';
        (data.presets || []).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            presetSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Error loading presets:', err);
    }
}

async function applySelectedPreset() {
    const name = presetSelect?.value;
    if (!name) return;
    try {
        const resp = await fetch(`${apiEndpoints.getAiPreset}?name=${encodeURIComponent(name)}`);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        const cfg = data.config || {};
        planModelInput.value = cfg.planModel || cfg.model_plan_generation || '';
        chatModelInput.value = cfg.chatModel || cfg.model_chat || '';
        modModelInput.value = cfg.modModel || cfg.model_principle_adjustment || '';
    } catch (err) {
        console.error('Error applying preset:', err);
        alert('Грешка при зареждане на пресета.');
    }
}

async function saveCurrentPreset() {
    const name = presetNameInput?.value.trim();
    if (!name) {
        alert('Въведете име за пресета.');
        return;
    }
    const payload = {
        name,
        config: {
            model_plan_generation: planModelInput.value.trim(),
            model_chat: chatModelInput.value.trim(),
            model_principle_adjustment: modModelInput.value.trim()
        }
    };
    try {
        const adminToken = localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.saveAiPreset, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            const error = new Error(data.message || 'Error');
            error.status = resp.status;
            throw error;
        }
        presetNameInput.value = '';
        alert('Пресетът е записан.');
        await loadAiPresets();
    } catch (err) {
        console.error('Error saving preset:', err, 'Status:', err.status);
        if (err.message && err.message.includes('Невалиден токен')) {
            alert('Невалиден токен. Моля, въведете правилния токен и проверете секретa на Worker-а.');
        } else {
            alert('Грешка при запис на пресета.');
        }
    }
}

async function testAiModel(modelName) {
    if (!modelName) {
        alert('Моля, въведете име на модел.');
        return;
    }
    try {
        const adminToken = adminTokenInput ? adminTokenInput.value.trim() : (localStorage.getItem('adminToken') || '');
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.testAiModel, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: modelName })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            alert(data.message || 'Неуспешен тест.');
        } else {
            alert('Връзката е успешна.');
        }
    } catch (err) {
        console.error('Error testing AI model:', err);
        alert('Грешка при тестване на модела.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Инициализира табовете веднага
    setupTabs();

    // Стартира асинхронните операции в отделен IIFE,
    // за да не блокират работата на интерфейса
    (async () => {
        await ensureLoggedIn();
        await loadClients();
        await checkForNotifications();
        await loadNotifications();
        loadAdminToken();
        await loadAiConfig();
        await loadAiPresets();
        setInterval(checkForNotifications, 60000);
        setInterval(loadNotifications, 60000);
    })();
});

if (aiConfigForm) {
    aiConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAiConfig();
    });
    savePresetBtn?.addEventListener('click', saveCurrentPreset);
    applyPresetBtn?.addEventListener('click', applySelectedPreset);
    testPlanBtn?.addEventListener('click', () => testAiModel(planModelInput.value.trim()));
    testChatBtn?.addEventListener('click', () => testAiModel(chatModelInput.value.trim()));
    testModBtn?.addEventListener('click', () => testAiModel(modModelInput.value.trim()));
}

export {
    allClients,
    loadClients,
    renderClients,
    showNotificationDot,
    checkForNotifications,
    showClient,
    unreadClients
};
