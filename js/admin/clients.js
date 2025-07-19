import { apiEndpoints } from '../config.js';
import { labelMap, statusMap } from '../labelMap.js';
import {
    unreadClients,
    unreadByClient,
    updateSectionDots,
    checkForNotifications,
    loadNotifications
} from './notifications.js';

const clientsList = document.getElementById('clientsList');
const clientsCount = document.getElementById('clientsCount');
const clientSearch = document.getElementById('clientSearch');
const statusFilter = document.getElementById('statusFilter');
const tagFilterSelect = document.getElementById('tagFilter');
const detailsSection = document.getElementById('clientDetails');
const queriesList = document.getElementById('queriesList');
const clientRepliesList = document.getElementById('clientRepliesList');
const feedbackList = document.getElementById('feedbackList');
const statsOutput = document.getElementById('statsOutput');
const sortOrderSelect = document.getElementById('sortOrder');
const initialAnswersPre = document.getElementById('initialAnswers');
const planMenuPre = document.getElementById('planMenu');
const dailyLogsPre = document.getElementById('dailyLogs');
const openFullProfileLink = document.getElementById('openFullProfile');
const openUserDataLink = document.getElementById('openUserData');
const fullProfileFrame = document.getElementById('fullProfileFrame');
const dashboardPre = document.getElementById('dashboardData');
const copyDashboardJsonBtn = document.getElementById('copyDashboardJson');
const profileSummaryDiv = document.getElementById('profileSummary');
const statusSummaryDiv = document.getElementById('statusSummary');
const analyticsSummaryDiv = document.getElementById('analyticsSummary');
const planSummaryDiv = document.getElementById('planSummary');
const exportPlanBtn = document.getElementById('exportPlan');
const exportDataBtn = document.getElementById('exportData');
const exportCsvBtn = document.getElementById('exportCsv');
const generatePraiseBtn = document.getElementById('generatePraise');
const regenBtn = document.getElementById('regeneratePlan');
const profileForm = document.getElementById('profileForm');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const notesField = document.getElementById('adminNotes');
const tagsField = document.getElementById('adminTags');
const saveNotesBtn = document.getElementById('saveNotes');
const newQueryText = document.getElementById('newQueryText');
const sendQueryBtn = document.getElementById('sendQuery');
const clientNameHeading = document.getElementById('clientName');
const closeProfileBtn = document.getElementById('closeProfile');
const statusChartCanvas = document.getElementById('statusChart');
const weightChartCanvas = document.getElementById('weightChart');
const toggleWeightChartBtn = document.getElementById('toggleWeightChart');
let statusChart = null;
let weightChart = null;
let currentUserId = null;
function setCurrentUserId(val) {
    currentUserId = val;
}
let currentPlanData = null;
let currentDashboardData = null;
let allClients = [];

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
        dt.textContent = labelMap[key] || key;
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
                    itemsTd.appendChild(document.createTextNode(', '));
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
        dailyLogsPre.textContent = 'Няма записани логове';
        return;
    }
    logs.forEach(l => {
        const div = document.createElement('div');
        div.textContent = `${l.date}: ${JSON.stringify(l.data)}`;
        dailyLogsPre.appendChild(div);
    });
}

function renderAnalyticsCurrent(cur) {
    if (!analyticsSummaryDiv) return;
    analyticsSummaryDiv.textContent = JSON.stringify(cur, null, 2);
}

function renderDetailedMetrics(metrics) {
    if (!statusSummaryDiv) return;
    statusSummaryDiv.textContent = JSON.stringify(metrics, null, 2);
}

function displayDashboardSummary(data) {
    if (profileSummaryDiv) profileSummaryDiv.textContent = data.profileSummary || '';
    if (planSummaryDiv) planSummaryDiv.textContent = data.planData?.profileSummary || '';
    if (statusSummaryDiv) renderDetailedMetrics(data.currentStatus || {});
    if (analyticsSummaryDiv) renderAnalyticsCurrent(data.analyticsCurrent || {});
    if (data.planData?.profileSummary && planSummaryDiv) {
        const p = document.createElement('p');
        p.textContent = data.planData.profileSummary;
        planSummaryDiv.appendChild(p);
    }
}

async function loadClients() {
    try {
        const resp = await fetch(apiEndpoints.listClients);
        const data = await resp.json();
        if (resp.ok && data.success) {
            const clientsArr = Array.isArray(data.clients) ? data.clients : [];
            const withStatus = await Promise.all(
                clientsArr.map(async c => {
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
            populateTestQClientOptions();
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
    const tagFilterValues = tagFilterSelect ? Array.from(tagFilterSelect.selectedOptions).map(o => o.value) : [];
    const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'name';
    if (clientsList) clientsList.innerHTML = '';
    const list = allClients.filter(c => {
        const matchText = `${c.userId} ${c.name || ''} ${c.email || ''}`.toLowerCase();
        const matchesSearch = matchText.includes(search);
        const matchesStatus = filter === 'all' || c.status === filter;
        const selectedTags = tagFilterValues.filter(t => t !== 'all');
        const matchesTag = selectedTags.length === 0 || selectedTags.every(t => (c.tags || []).includes(t));
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
        statusEl.textContent = statusMap[c.status] || c.status;
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
    const current = Array.from(tagFilterSelect.selectedOptions).map(o => o.value);
    tagFilterSelect.innerHTML = '<option value="all">Всички етикети</option>';
    Array.from(tags).sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (current.includes(t)) opt.selected = true;
        tagFilterSelect.appendChild(opt);
    });
    if (current.includes('all')) tagFilterSelect.querySelector('option[value="all"]').selected = true;
}

function populateTestQClientOptions() {
    if (!tagFilterSelect || !document.getElementById('testQClient')) return;
    const testQClientSelect = document.getElementById('testQClient');
    testQClientSelect.innerHTML = '<option value="">--</option>';
    allClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.userId;
        opt.textContent = `${c.name} (${c.userId})`;
        testQClientSelect.appendChild(opt);
    });
}

function updateStatusChart(stats) {
    if (!statusChartCanvas || typeof Chart === 'undefined') return;
    if (statusChart) statusChart.destroy();
    const ctx = statusChartCanvas.getContext('2d');
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [statusMap.ready, statusMap.processing, statusMap.pending],
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

async function showClient(userId) {
    if (fullProfileFrame) fullProfileFrame.classList.remove('hidden');
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
            if (openUserDataLink) openUserDataLink.href = `Userdata.html?userId=${encodeURIComponent(userId)}`;
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
            if (dashboardPre) {
                dashboardPre.textContent = JSON.stringify(dashData, null, 2);
                dashboardPre.classList.remove('hidden');
            }
            if (copyDashboardJsonBtn) copyDashboardJsonBtn.classList.remove('hidden');
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
            if (dashboardPre) {
                dashboardPre.textContent = '';
                dashboardPre.classList.add('hidden');
            }
            if (copyDashboardJsonBtn) copyDashboardJsonBtn.classList.add('hidden');
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

async function sendAdminQuery() {
    if (!currentUserId) return false;
    const msg = newQueryText.value.trim();
    if (!msg) return false;
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
            return true;
        }
        alert(data.message || 'Грешка при изпращане.');
    } catch (err) {
        console.error('Error sending query:', err);
    }
    return false;
}

async function generatePraise() {
    if (!currentUserId) return;
    try {
        const resp = await fetch(apiEndpoints.generatePraise, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            const title = data.title || 'Похвала';
            const msg = data.message || '';
            alert(`${title}\n${msg}`.trim());
        } else {
            alert('Неуспешно генериране на похвала.');
        }
    } catch (err) {
        console.error('Error generating praise:', err);
        alert('Грешка при генериране на похвала.');
    }
}

if (sendQueryBtn) {
    sendQueryBtn.addEventListener('click', sendAdminQuery);
}

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

if (generatePraiseBtn) {
    generatePraiseBtn.addEventListener('click', generatePraise);
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
                adminTags: Array.from(
                    new Set(
                        (tagsField.value || '')
                            .split(',')
                            .map(t => t.trim())
                            .filter(Boolean)
                    )
                )
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

if (copyDashboardJsonBtn) {
    copyDashboardJsonBtn.addEventListener('click', () => {
        if (dashboardPre && dashboardPre.textContent) {
            navigator.clipboard.writeText(dashboardPre.textContent).catch(() => alert('Неуспешно копиране'));
        }
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
            const list = Array.isArray(data.queries) ? data.queries : [];
            list.forEach(q => {
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
            const list = Array.isArray(data.feedback) ? data.feedback : [];
            list.forEach(f => {
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
            const list = Array.isArray(data.replies) ? data.replies : [];
            list.forEach(r => {
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
if (toggleWeightChartBtn) {
    toggleWeightChartBtn.addEventListener('click', () => {
        weightChartCanvas?.classList.toggle('hidden');
    });
}

export {
    loadClients,
    renderClients,
    showClient,
    loadQueries,
    loadFeedback,
    loadClientReplies,
    setCurrentUserId,
    allClients,
    updateStatusChart,
    setupTabs,
    updateWeightChart,
    sendAdminQuery
};
