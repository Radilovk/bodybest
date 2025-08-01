import { apiEndpoints } from './config.js';
import { loadConfig, saveConfig } from './adminConfig.js';
import { labelMap, statusMap } from './labelMap.js';
import { fileToDataURL, fileToText, getProgressColor, animateProgressFill } from './utils.js';
import { loadTemplateInto } from './templateLoader.js';
import { sanitizeHTML } from './htmlSanitizer.js';
import { loadMaintenanceFlag, setMaintenanceFlag } from './maintenanceMode.js';

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
const maintenanceBtn = document.getElementById('toggleMaintenance');
const maintenanceStatus = document.getElementById('maintenanceStatus');
const sortOrderSelect = document.getElementById('sortOrder');
const initialAnswersPre = document.getElementById('initialAnswers');
const planMenuPre = document.getElementById('planMenu');
const dailyLogsPre = document.getElementById('dailyLogs');
const exportPlanBtn = document.getElementById('exportPlan');
const openFullProfileLink = document.getElementById('openFullProfile');
const openUserDataLink = document.getElementById('openUserData');
const adminProfileContainer = document.getElementById('adminProfileContainer');
const dashboardPre = document.getElementById('dashboardData');
const copyDashboardJsonBtn = document.getElementById('copyDashboardJson');
const profileSummaryDiv = document.getElementById('profileSummary');
const statusSummaryDiv = document.getElementById('statusSummary');
const analyticsSummaryDiv = document.getElementById('analyticsSummary');
const planSummaryDiv = document.getElementById('planSummary');
const exportDataBtn = document.getElementById('exportData');
const exportCsvBtn = document.getElementById('exportCsv');
const generatePraiseBtn = document.getElementById('generatePraise');
const profileForm = document.getElementById('profileForm');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const aiConfigForm = document.getElementById('aiConfigForm');
const planModelInput = document.getElementById('planModel');
const chatModelInput = document.getElementById('chatModel');
const modModelInput = document.getElementById('modModel');
const imageModelInput = document.getElementById('imageModel');
const planPromptInput = document.getElementById('planPrompt');
const planTokensInput = document.getElementById('planTokens');
const planTemperatureInput = document.getElementById('planTemperature');
const chatPromptInput = document.getElementById('chatPrompt');
const chatTokensInput = document.getElementById('chatTokens');
const chatTemperatureInput = document.getElementById('chatTemperature');
const modPromptInput = document.getElementById('modPrompt');
const modTokensInput = document.getElementById('modTokens');
const modTemperatureInput = document.getElementById('modTemperature');
const imageTokensInput = document.getElementById('imageTokens');
const imageTemperatureInput = document.getElementById('imageTemperature');
const imagePromptInput = document.getElementById('imagePrompt');
const planHints = document.getElementById('planHints');
const chatHints = document.getElementById('chatHints');
const modHints = document.getElementById('modHints');
const imageHints = document.getElementById('imageHints');
const adminTokenInput = document.getElementById('adminToken');
const presetSelect = document.getElementById('aiPresetSelect');
const savePresetBtn = document.getElementById('savePreset');
const applyPresetBtn = document.getElementById('applyPreset');
const presetNameInput = document.getElementById('presetName');
const testPlanBtn = document.getElementById('testPlanModel');
const testChatBtn = document.getElementById('testChatModel');
const testModBtn = document.getElementById('testModModel');
const testImageBtn = document.getElementById('testImageModel');
const analysisModelInput = document.getElementById('analysisModel');
const analysisPromptInput = document.getElementById('analysisPrompt');
const testAnalysisBtn = document.getElementById('testAnalysisModel');
const emailSettingsForm = document.getElementById('emailSettingsForm');
const fromEmailNameInput = document.getElementById('fromEmailName');
const welcomeEmailSubjectInput = document.getElementById('welcomeEmailSubject');
const welcomeEmailBodyInput = document.getElementById('welcomeEmailBody');
const questionnaireEmailSubjectInput = document.getElementById('questionnaireEmailSubject');
const questionnaireEmailBodyInput = document.getElementById('questionnaireEmailBody');
const analysisEmailSubjectInput = document.getElementById('analysisEmailSubject');
const analysisEmailBodyInput = document.getElementById('analysisEmailBody');
const contactEmailSubjectInput = document.getElementById('contactEmailSubject');
const contactEmailBodyInput = document.getElementById('contactEmailBody');
const sendQuestionnaireEmailCheckbox = document.getElementById('sendQuestionnaireEmail');
const sendWelcomeEmailCheckbox = document.getElementById('sendWelcomeEmail');
const sendAnalysisEmailCheckbox = document.getElementById('sendAnalysisEmail');
const sendContactEmailCheckbox = document.getElementById('sendContactEmail');
const testEmailForm = document.getElementById('testEmailForm');
const testEmailToInput = document.getElementById('testEmailTo');
const testEmailSubjectInput = document.getElementById('testEmailSubject');
const testEmailBodyInput = document.getElementById('testEmailBody');
const testEmailSection = document.getElementById('testEmailSection');
const welcomeEmailPreview = document.getElementById('welcomeEmailPreview');
const questionnaireEmailPreview = document.getElementById('questionnaireEmailPreview');
const analysisEmailPreview = document.getElementById('analysisEmailPreview');
const contactEmailPreview = document.getElementById('contactEmailPreview');
const testEmailPreview = document.getElementById('testEmailPreview');
const testImageForm = document.getElementById('testImageForm');
const testImageFileInput = document.getElementById('testImageFile');
const testImagePromptInput = document.getElementById('testImagePrompt');
const testImageResultPre = document.getElementById('testImageResult');
const testQuestionnaireForm = document.getElementById('testQuestionnaireForm');
const testQEmailInput = document.getElementById('testQEmail');
const testQClientSelect = document.getElementById('testQClient');
const testQUserIdInput = document.getElementById('testQUserId');
const testQFileInput = document.getElementById('testQFile');
const testQTextArea = document.getElementById('testQText');
const testQResultPre = document.getElementById('testQResult');
const openTestQAnalysisLink = document.getElementById('openTestQAnalysis');
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
function setCurrentUserId(val) {
    currentUserId = val;
}
let profileNavObserver = null;
let currentPlanData = null;
let currentDashboardData = null;
let allClients = [];
const originalSearch = window.location.search;
// set of userIds с непрочетени съобщения/обратна връзка
const unreadClients = new Set();
const unreadByClient = new Map();

const modelHints = {
    '@cf/llava-hf/llava-v1.6b': { tokens: 'до 4096', temperature: 'препоръчително 0.2' },
    '@cf/stabilityai/clip': { tokens: 'до 77', temperature: 'препоръчително 0.2' },
    'gpt-3.5-turbo': { tokens: 'до 4096', temperature: 'по подразбиране 0.7' },
    'gemini-pro': { tokens: 'до 2048', temperature: 'по подразбиране 0.2' }
};

function updateHints(modelInput, descElem) {
    const hints = modelHints[modelInput.value.trim()] || {};
    const parts = [];
    if (hints.tokens) parts.push(`Token limit: ${hints.tokens}`);
    if (hints.temperature) parts.push(`Temperature: ${hints.temperature}`);
    descElem.textContent = parts.join(' • ');
}

export function attachEmailPreview(textarea, previewElem, sample = {}) {
    if (!textarea || !previewElem) return;
    const update = () => {
        let html = textarea.value;
        for (const [key, val] of Object.entries(sample)) {
            const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            html = html.replace(re, val);
        }
        previewElem.innerHTML = sanitizeHTML(html);
    };
    textarea.addEventListener('input', update);
    update();
}

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

function renderAnalyticsCurrent(cur) {
    const dl = document.createElement('dl');
    const fields = {
        goalProgress: cur.goalProgress,
        engagementScore: cur.engagementScore,
        overallHealthScore: cur.overallHealthScore
    };
    Object.entries(fields).forEach(([k, val]) => {
        const dt = document.createElement('dt');
        dt.textContent = labelMap[k] || k;
        const dd = document.createElement('dd');
        const pct = typeof val === 'number' ? Math.round(val) : null;
        dd.textContent = pct != null ? `${pct}%` : 'Няма данни';
        if (pct != null) {
            const pbContainer = document.createElement('div');
            pbContainer.className = 'progress-bar-container';
            const pb = document.createElement('div');
            pb.className = 'progress-bar';
            const fill = document.createElement('div');
            fill.className = 'progress-fill';
            fill.style.setProperty('--progress-end-color', getProgressColor(pct));
            animateProgressFill(fill, pct);
            pb.appendChild(fill);
            pbContainer.appendChild(pb);
            dd.appendChild(pbContainer);
        }
        dl.appendChild(dt);
        dl.appendChild(dd);
    });
    return dl;
}

function renderDetailedMetrics(metrics) {
    const table = document.createElement('table');
    table.className = 'menu-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Показател</th><th>Начална</th><th>Целева</th><th>Текуща</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    metrics.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.label || ''}</td>
            <td>${m.initialValueText ?? ''}</td>
            <td>${m.expectedValueText ?? ''}</td>
            <td>${m.currentValueText ?? ''}</td>`;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

function displayDashboardSummary(data) {
    if (!profileSummaryDiv || !statusSummaryDiv || !analyticsSummaryDiv || !planSummaryDiv) return;

    profileSummaryDiv.innerHTML = '';
    statusSummaryDiv.innerHTML = '';
    analyticsSummaryDiv.innerHTML = '';
    planSummaryDiv.innerHTML = '';

    if (!data) {
        const msg = 'Няма данни';
        profileSummaryDiv.textContent = msg;
        statusSummaryDiv.textContent = msg;
        analyticsSummaryDiv.textContent = msg;
        planSummaryDiv.textContent = msg;
        return;
    }

    profileSummaryDiv.appendChild(
        renderObjectAsList(data.initialAnswers || {})
    );
    statusSummaryDiv.appendChild(
        renderObjectAsList(data.currentStatus || {})
    );

    const analytics = data.analytics;
    if (!analytics) {
        analyticsSummaryDiv.textContent = 'Няма данни';
        return;
    }
    analyticsSummaryDiv.appendChild(renderAnalyticsCurrent(analytics.current || {}));
    if (analytics.textualAnalysis) {
        const p = document.createElement('p');
        p.textContent = analytics.textualAnalysis;
        analyticsSummaryDiv.appendChild(p);
    }
    if (Array.isArray(analytics.detailed) && analytics.detailed.length > 0) {
        analyticsSummaryDiv.appendChild(renderDetailedMetrics(analytics.detailed));
    }
    if (analytics.streak) {
        const p = document.createElement('p');
        p.textContent = `${labelMap.streak || 'streak'}: ${analytics.streak.currentCount || 0} дни`;
        analyticsSummaryDiv.appendChild(p);
    }

    if (data.planData?.caloriesMacros) {
        planSummaryDiv.appendChild(renderObjectAsList(data.planData.caloriesMacros));
    }
    if (data.planData?.profileSummary) {
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
            allClients = clientsArr.map(c => ({
                ...c,
                status: c.status || 'unknown',
                tags: c.tags || [],
                lastUpdated: c.lastUpdated || ''
            }));
            updateTagFilterOptions();
            populateTestQClientOptions();
            renderClients();
            const stats = {
                clients: allClients.length,
                ready: allClients.filter(c => c.status === 'ready').length,
                pending: allClients.filter(c => c.status === 'pending').length,
                processing: allClients.filter(c => c.status === 'processing').length
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
    if (!testQClientSelect) return;
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

function setupProfileCardNav() {
    const nav = document.getElementById('profileCardNav');
    const toggleBtn = document.getElementById('profileCardNavToggle');
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll('a[data-target]'));
    if (links.length === 0) return;
    const sections = links
        .map(l => document.getElementById(l.getAttribute('data-target')))
        .filter(Boolean);
    const activate = (link) => {
        links.forEach(l => l.classList.toggle('active', l === link));
    };
    const closeMenu = () => {
        nav.classList.remove('open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    };
    links.forEach(l => {
        l.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = l.getAttribute('data-target');
            const section = document.getElementById(targetId);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
                activate(l);
                closeMenu();
            }
        });
    });
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = nav.classList.toggle('open');
            toggleBtn.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('open') && !nav.contains(e.target) && e.target !== toggleBtn) {
                closeMenu();
            }
        });
    }
    if (profileNavObserver) {
        profileNavObserver.disconnect();
    }
    profileNavObserver = new IntersectionObserver((entries) => {
        const visible = entries.find(e => e.isIntersecting);
        if (visible) {
            const link = links.find(l => l.getAttribute('data-target') === visible.target.id);
            if (link) activate(link);
        }
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(sec => profileNavObserver.observe(sec));
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


if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => {
        detailsSection.classList.add('hidden');
        resetTabs();
        sessionStorage.removeItem('activeTabId');
        if (adminProfileContainer) adminProfileContainer.innerHTML = '';
        history.replaceState(null, '', originalSearch);
        currentUserId = null;
    });
}

if (clientSearch) clientSearch.addEventListener('input', renderClients);
if (statusFilter) statusFilter.addEventListener('change', renderClients);
if (sortOrderSelect) sortOrderSelect.addEventListener('change', renderClients);
if (tagFilterSelect) tagFilterSelect.addEventListener('change', renderClients);


async function showClient(userId) {
    if (adminProfileContainer) {
        adminProfileContainer.innerHTML = '';
        history.replaceState(null, '', `?userId=${encodeURIComponent(userId)}`);
        await loadTemplateInto('editclient.html', 'adminProfileContainer');
        const mod = await import('./editClient.js');
        await mod.initEditClient(userId);
        setupProfileCardNav();
    }
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

function loadAdminToken() {
    if (!adminTokenInput) return;
    const stored = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
    if (stored) {
        adminTokenInput.value = stored;
        sessionStorage.setItem('adminToken', stored);
        localStorage.removeItem('adminToken');
    } else {
        adminTokenInput.value = '';
    }
}

async function loadAiConfig() {
    if (!aiConfigForm) return;
    try {
        const cfg = await loadConfig();
        planModelInput.value = cfg.model_plan_generation || '';
        chatModelInput.value = cfg.model_chat || '';
        modModelInput.value = cfg.model_principle_adjustment || '';
        if (imageModelInput) imageModelInput.value = cfg.model_image_analysis || '';
        if (imagePromptInput) imagePromptInput.value = cfg.prompt_image_analysis || '';
        if (analysisModelInput) analysisModelInput.value = cfg.model_questionnaire_analysis || '';
        if (analysisPromptInput) analysisPromptInput.value = cfg.prompt_questionnaire_analysis || '';
        if (planPromptInput) planPromptInput.value = cfg.prompt_unified_plan_generation_v2 || '';
        if (planTokensInput) planTokensInput.value = cfg.plan_token_limit || '';
        if (planTemperatureInput) planTemperatureInput.value = cfg.plan_temperature || '';
        if (chatPromptInput) chatPromptInput.value = cfg.prompt_chat || '';
        if (chatTokensInput) chatTokensInput.value = cfg.chat_token_limit || '';
        if (chatTemperatureInput) chatTemperatureInput.value = cfg.chat_temperature || '';
        if (modPromptInput) modPromptInput.value = cfg.prompt_plan_modification || '';
        if (modTokensInput) modTokensInput.value = cfg.mod_token_limit || '';
        if (modTemperatureInput) modTemperatureInput.value = cfg.mod_temperature || '';
        if (imageTokensInput) imageTokensInput.value = cfg.image_token_limit || '';
        if (imageTemperatureInput) imageTemperatureInput.value = cfg.image_temperature || '';
        if (welcomeEmailSubjectInput) welcomeEmailSubjectInput.value = cfg.welcome_email_subject || '';
        if (welcomeEmailBodyInput) welcomeEmailBodyInput.value = cfg.welcome_email_body || '';
        updateHints(planModelInput, planHints);
        updateHints(chatModelInput, chatHints);
        updateHints(modModelInput, modHints);
        updateHints(imageModelInput, imageHints);
    } catch (err) {
        console.error('Error loading AI config:', err);
        alert('Грешка при зареждане на AI конфигурацията.');
    }
}

async function saveAiConfig() {
    if (!aiConfigForm) return;
    const updates = {
            model_plan_generation: planModelInput.value.trim(),
            model_chat: chatModelInput.value.trim(),
            model_principle_adjustment: modModelInput.value.trim(),
            model_image_analysis: imageModelInput ? imageModelInput.value.trim() : '',
            prompt_image_analysis: imagePromptInput ? imagePromptInput.value.trim() : '',
            model_questionnaire_analysis: analysisModelInput ? analysisModelInput.value.trim() : '',
            prompt_questionnaire_analysis: analysisPromptInput ? analysisPromptInput.value.trim() : '',
            prompt_unified_plan_generation_v2: planPromptInput ? planPromptInput.value.trim() : '',
            plan_token_limit: planTokensInput ? planTokensInput.value.trim() : '',
            plan_temperature: planTemperatureInput ? planTemperatureInput.value.trim() : '',
            prompt_chat: chatPromptInput ? chatPromptInput.value.trim() : '',
            chat_token_limit: chatTokensInput ? chatTokensInput.value.trim() : '',
            chat_temperature: chatTemperatureInput ? chatTemperatureInput.value.trim() : '',
            prompt_plan_modification: modPromptInput ? modPromptInput.value.trim() : '',
            mod_token_limit: modTokensInput ? modTokensInput.value.trim() : '',
            mod_temperature: modTemperatureInput ? modTemperatureInput.value.trim() : '',
            image_token_limit: imageTokensInput ? imageTokensInput.value.trim() : '',
            image_temperature: imageTemperatureInput ? imageTemperatureInput.value.trim() : '',
            welcome_email_subject: welcomeEmailSubjectInput ? welcomeEmailSubjectInput.value.trim() : '',
            welcome_email_body: welcomeEmailBodyInput ? welcomeEmailBodyInput.value.trim() : ''
    };
    try {
        if (adminTokenInput) {
            const adminToken = adminTokenInput.value.trim();
            sessionStorage.setItem('adminToken', adminToken);
            localStorage.removeItem('adminToken');
        }
        await saveConfig(updates);
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

async function loadEmailSettings() {
    try {
        const cfg = await loadConfig([
            'from_email_name',
            'welcome_email_subject',
            'welcome_email_body',
            'questionnaire_email_subject',
            'questionnaire_email_body',
            'contact_email_subject',
            'contact_email_body',
            'analysis_email_subject',
            'analysis_email_body',
            'send_questionnaire_email',
            'send_welcome_email',
            'send_contact_email',
            'send_analysis_email'
        ])
        if (fromEmailNameInput) fromEmailNameInput.value = cfg.from_email_name || ''
        if (welcomeEmailSubjectInput) welcomeEmailSubjectInput.value = cfg.welcome_email_subject || ''
        if (welcomeEmailBodyInput) {
            welcomeEmailBodyInput.value = cfg.welcome_email_body || ''
            if (welcomeEmailPreview) welcomeEmailPreview.innerHTML = sanitizeHTML(welcomeEmailBodyInput.value)
        }
        if (questionnaireEmailSubjectInput) questionnaireEmailSubjectInput.value = cfg.questionnaire_email_subject || ''
        if (questionnaireEmailBodyInput) {
            questionnaireEmailBodyInput.value = cfg.questionnaire_email_body || ''
            if (questionnaireEmailPreview) questionnaireEmailPreview.innerHTML = sanitizeHTML(questionnaireEmailBodyInput.value)
        }
        if (contactEmailSubjectInput) contactEmailSubjectInput.value = cfg.contact_email_subject || ''
        if (contactEmailBodyInput) {
            contactEmailBodyInput.value = cfg.contact_email_body || ''
            if (contactEmailPreview) contactEmailPreview.innerHTML = sanitizeHTML(contactEmailBodyInput.value)
        }
        if (analysisEmailSubjectInput) analysisEmailSubjectInput.value = cfg.analysis_email_subject || ''
        if (analysisEmailBodyInput) {
            analysisEmailBodyInput.value = cfg.analysis_email_body || ''
            if (analysisEmailPreview) analysisEmailPreview.innerHTML = sanitizeHTML(analysisEmailBodyInput.value)
        }
        if (sendQuestionnaireEmailCheckbox) {
            const val = cfg.send_questionnaire_email
            sendQuestionnaireEmailCheckbox.checked = val !== '0' && val !== 'false'
        }
        if (sendWelcomeEmailCheckbox) {
            const val = cfg.send_welcome_email
            sendWelcomeEmailCheckbox.checked = val !== '0' && val !== 'false'
        }
        if (sendContactEmailCheckbox) {
            const val = cfg.send_contact_email
            sendContactEmailCheckbox.checked = val !== '0' && val !== 'false'
        }
        if (sendAnalysisEmailCheckbox) {
            const val = cfg.send_analysis_email
            sendAnalysisEmailCheckbox.checked = val !== '0' && val !== 'false'
        }
    } catch (err) {
        console.error('Error loading email settings:', err)
    }
}

async function saveEmailSettings() {
    if (!emailSettingsForm) return
    const updates = {
            from_email_name: fromEmailNameInput ? fromEmailNameInput.value.trim() : '',
            welcome_email_subject: welcomeEmailSubjectInput ? welcomeEmailSubjectInput.value.trim() : '',
            welcome_email_body: welcomeEmailBodyInput ? welcomeEmailBodyInput.value.trim() : '',
            questionnaire_email_subject: questionnaireEmailSubjectInput ? questionnaireEmailSubjectInput.value.trim() : '',
            questionnaire_email_body: questionnaireEmailBodyInput ? questionnaireEmailBodyInput.value.trim() : '',
            contact_email_subject: contactEmailSubjectInput ? contactEmailSubjectInput.value.trim() : '',
            contact_email_body: contactEmailBodyInput ? contactEmailBodyInput.value.trim() : '',
            analysis_email_subject: analysisEmailSubjectInput?.value.trim() || '',
            analysis_email_body: analysisEmailBodyInput?.value.trim() || '',
            send_questionnaire_email: sendQuestionnaireEmailCheckbox && sendQuestionnaireEmailCheckbox.checked ? '1' : '0',
            send_welcome_email: sendWelcomeEmailCheckbox && sendWelcomeEmailCheckbox.checked ? '1' : '0',
            send_contact_email: sendContactEmailCheckbox && sendContactEmailCheckbox.checked ? '1' : '0',
            send_analysis_email: sendAnalysisEmailCheckbox && sendAnalysisEmailCheckbox.checked ? '1' : '0'
    }
    try {
        await saveConfig(updates)
        alert('Имейл настройките са записани.')
    } catch (err) {
        console.error('Error saving email settings:', err)
        alert('Грешка при запис на имейл настройките.')
    }
}


let testEmailTemplateLoaded = false

async function loadTestEmailTemplate() {
    if (testEmailTemplateLoaded || !testEmailBodyInput) return
    try {
        const resp = await fetch('data/testEmailTemplate.html')
        testEmailBodyInput.value = await resp.text()
        if (testEmailPreview) testEmailPreview.innerHTML = sanitizeHTML(testEmailBodyInput.value)
        testEmailTemplateLoaded = true
    } catch (err) {
        console.error('Error loading test email template:', err)
    }
}

async function sendTestEmail() {
    if (!testEmailForm) return;
    const recipient = testEmailToInput ? testEmailToInput.value.trim() : '';
    const subject = testEmailSubjectInput ? testEmailSubjectInput.value.trim() : '';
    const body = testEmailBodyInput ? testEmailBodyInput.value : '';
    const fromName = fromEmailNameInput ? fromEmailNameInput.value.trim() : '';
    if (!recipient || !subject || !body) {
        alert('Моля попълнете всички полета.');
        return;
    }
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.sendTestEmail, {
            method: 'POST',
            headers,
            body: JSON.stringify({ recipient, subject, body, fromName })
        });

        const ct = resp.headers.get('Content-Type') || '';
        let data;
        let raw = '';
        if (ct.includes('application/json')) {
            data = await resp.json();
        } else {
            raw = await resp.text();
        }

        if (!ct.includes('application/json')) {
            console.error('Non-JSON response from sendTestEmail:', raw.slice(0, 200));
            throw new Error('Unexpected server response');
        }

        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        alert('Имейлът е изпратен успешно.');
    } catch (err) {
        console.error('Error sending test email:', err);
        alert('Грешка при изпращане.');
    }
}

async function confirmAndSendTestEmail() {
    if (window.confirm('Изпращане на тестов имейл?')) {
        await sendTestEmail();
    }
}

async function sendTestImage() {
    if (!testImageForm || !testImageFileInput?.files?.[0]) return;
    const file = testImageFileInput.files[0];
    const prompt = testImagePromptInput ? testImagePromptInput.value.trim() : '';
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const image = await fileToDataURL(file);
        const resp = await fetch(apiEndpoints.analyzeImage, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: 'admin-test', image, prompt })
        });
        const data = await resp.json();
        if (testImageResultPre) testImageResultPre.textContent = JSON.stringify(data, null, 2);
        if (!resp.ok || !data.success) {
            alert(data.message || 'Неуспешен анализ.');
        }
    } catch (err) {
        console.error('Error analyzing image:', err);
        alert('Грешка при анализа.');
    } finally {
        if (testImageFileInput) testImageFileInput.value = '';
    }
}

async function sendTestQuestionnaire() {
    if (!testQuestionnaireForm) return;
    const email = testQEmailInput ? testQEmailInput.value.trim() : '';
    if (openTestQAnalysisLink) openTestQAnalysisLink.classList.add('hidden');
    const selectedId = testQClientSelect ? testQClientSelect.value : '';
    const manualId = testQUserIdInput ? testQUserIdInput.value.trim() : '';
    const userId = manualId || selectedId;
    let jsonStr = '';

    if (testQFileInput?.files?.[0]) {
        try {
            jsonStr = await fileToText(testQFileInput.files[0]);
        } catch {
            jsonStr = '';
        }
    } else if (testQTextArea) {
        jsonStr = testQTextArea.value.trim();
    }

    if (!jsonStr) {
        if (!email && !userId) {
            alert('Необходим е имейл или userId.');
            return;
        }
        try {
            const resp = await fetch(apiEndpoints.reAnalyzeQuestionnaire, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, userId })
            });
            const data = await resp.json();
            if (testQResultPre) testQResultPre.textContent = JSON.stringify(data, null, 2);
            if (resp.ok && data.success && data.userId) {
                if (openTestQAnalysisLink) {
                    openTestQAnalysisLink.classList.remove('hidden');
                    openTestQAnalysisLink.href = `https://radilovk.github.io/bodybest/reganalize/analyze.html?userId=${encodeURIComponent(data.userId)}`;
                }
            } else if (!resp.ok || !data.success) {
                alert(data.message || 'Грешка при стартиране на анализа.');
            }
        } catch (err) {
            console.error('Error triggering analysis:', err);
            alert('Грешка при заявката.');
        }
        return;
    }

    let payload;
    try {
        payload = JSON.parse(jsonStr);
    } catch {
        alert('Невалиден JSON.');
        return;
    }
    payload.email = email;
    if (userId) payload.userId = userId;

    try {
        const resp = await fetch(apiEndpoints.submitQuestionnaire, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (testQResultPre) testQResultPre.textContent = JSON.stringify(data, null, 2);

        if (resp.ok && data.success && data.userId) {
            if (openTestQAnalysisLink) {
                openTestQAnalysisLink.classList.remove('hidden');
                openTestQAnalysisLink.href = `https://radilovk.github.io/bodybest/reganalize/analyze.html?userId=${encodeURIComponent(data.userId)}`;
            }
            try {
                const stResp = await fetch(`${apiEndpoints.analysisStatus}?userId=${encodeURIComponent(data.userId)}`);
                const stData = await stResp.json();
                if (testQResultPre) testQResultPre.textContent += `\nStatus: ${JSON.stringify(stData)}`;
                if (stData.analysisStatus === 'ready') {
                    const anResp = await fetch(`${apiEndpoints.getInitialAnalysis}?userId=${encodeURIComponent(data.userId)}`);
                    const anData = await anResp.json();
                    if (testQResultPre) testQResultPre.textContent += `\nAnalysis: ${JSON.stringify(anData)}`;
                }
            } catch (err) {
                console.warn('Error fetching analysis:', err);
            }
        } else if (!resp.ok || !data.success) {
            alert(data.message || 'Грешка при изпращането.');
        }
    } catch (err) {
        console.error('Error sending questionnaire:', err);
        alert('Грешка при изпращане.');
    } finally {
        if (testQFileInput) testQFileInput.value = '';
    }
}

async function refreshMaintenanceStatus() {
    if (!maintenanceBtn) return;
    try {
        const enabled = await loadMaintenanceFlag();
        maintenanceBtn.dataset.enabled = enabled ? '1' : '0';
        if (maintenanceStatus) maintenanceStatus.textContent = enabled ? 'включен' : 'изключен';
    } catch (err) {
        console.error('Error loading maintenance mode:', err);
    }
}

async function toggleMaintenanceMode() {
    if (!maintenanceBtn) return;
    const enabled = maintenanceBtn.dataset.enabled === '1';
    try {
        await setMaintenanceFlag(!enabled);
        maintenanceBtn.dataset.enabled = enabled ? '0' : '1';
        if (maintenanceStatus) maintenanceStatus.textContent = !enabled ? 'включен' : 'изключен';
    } catch (err) {
        console.error('Error toggling maintenance mode:', err);
        alert('Грешка при промяна на режима.');
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
        if (imageModelInput) imageModelInput.value = cfg.imageModel || cfg.model_image_analysis || '';
        if (imagePromptInput) imagePromptInput.value = cfg.imagePrompt || cfg.prompt_image_analysis || '';
        if (analysisModelInput) analysisModelInput.value = cfg.analysisModel || cfg.model_questionnaire_analysis || '';
        if (analysisPromptInput) analysisPromptInput.value = cfg.analysisPrompt || cfg.prompt_questionnaire_analysis || '';
        if (planPromptInput) planPromptInput.value = cfg.planPrompt || cfg.prompt_unified_plan_generation_v2 || '';
        if (planTokensInput) planTokensInput.value = cfg.planTokens || cfg.plan_token_limit || '';
        if (planTemperatureInput) planTemperatureInput.value = cfg.planTemperature || cfg.plan_temperature || '';
        if (chatPromptInput) chatPromptInput.value = cfg.chatPrompt || cfg.prompt_chat || '';
        if (chatTokensInput) chatTokensInput.value = cfg.chatTokens || cfg.chat_token_limit || '';
        if (chatTemperatureInput) chatTemperatureInput.value = cfg.chatTemperature || cfg.chat_temperature || '';
        if (modPromptInput) modPromptInput.value = cfg.modPrompt || cfg.prompt_plan_modification || '';
        if (modTokensInput) modTokensInput.value = cfg.modTokens || cfg.mod_token_limit || '';
        if (modTemperatureInput) modTemperatureInput.value = cfg.modTemperature || cfg.mod_temperature || '';
        if (imageTokensInput) imageTokensInput.value = cfg.imageTokens || cfg.image_token_limit || '';
        if (imageTemperatureInput) imageTemperatureInput.value = cfg.imageTemperature || cfg.image_temperature || '';
        updateHints(planModelInput, planHints);
        updateHints(chatModelInput, chatHints);
        updateHints(modModelInput, modHints);
        updateHints(imageModelInput, imageHints);
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
            model_principle_adjustment: modModelInput.value.trim(),
            model_image_analysis: imageModelInput ? imageModelInput.value.trim() : '',
            prompt_image_analysis: imagePromptInput ? imagePromptInput.value.trim() : '',
            model_questionnaire_analysis: analysisModelInput ? analysisModelInput.value.trim() : '',
            prompt_questionnaire_analysis: analysisPromptInput ? analysisPromptInput.value.trim() : '',
            prompt_unified_plan_generation_v2: planPromptInput ? planPromptInput.value.trim() : '',
            plan_token_limit: planTokensInput ? planTokensInput.value.trim() : '',
            plan_temperature: planTemperatureInput ? planTemperatureInput.value.trim() : '',
            prompt_chat: chatPromptInput ? chatPromptInput.value.trim() : '',
            chat_token_limit: chatTokensInput ? chatTokensInput.value.trim() : '',
            chat_temperature: chatTemperatureInput ? chatTemperatureInput.value.trim() : '',
            prompt_plan_modification: modPromptInput ? modPromptInput.value.trim() : '',
            mod_token_limit: modTokensInput ? modTokensInput.value.trim() : '',
            mod_temperature: modTemperatureInput ? modTemperatureInput.value.trim() : '',
            image_token_limit: imageTokensInput ? imageTokensInput.value.trim() : '',
            image_temperature: imageTemperatureInput ? imageTemperatureInput.value.trim() : ''
        }
    };
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
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
        const adminToken = adminTokenInput ? adminTokenInput.value.trim() : (sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '');
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

    attachEmailPreview(welcomeEmailBodyInput, welcomeEmailPreview, { name: 'Иван' });
    attachEmailPreview(questionnaireEmailBodyInput, questionnaireEmailPreview, { name: 'Иван' });
    attachEmailPreview(analysisEmailBodyInput, analysisEmailPreview, { name: 'Иван', link: 'https://example.com' });
    attachEmailPreview(contactEmailBodyInput, contactEmailPreview, { name: 'Иван' });
    attachEmailPreview(testEmailBodyInput, testEmailPreview, { name: 'Иван' });

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
        if (emailSettingsForm) await loadEmailSettings();
        if (testEmailSection?.open) await loadTestEmailTemplate();
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
    testImageBtn?.addEventListener('click', () => testAiModel(imageModelInput.value.trim()));
    testAnalysisBtn?.addEventListener('click', () => testAiModel(analysisModelInput.value.trim()));
    planModelInput?.addEventListener('input', () => updateHints(planModelInput, planHints));
    chatModelInput?.addEventListener('input', () => updateHints(chatModelInput, chatHints));
    modModelInput?.addEventListener('input', () => updateHints(modModelInput, modHints));
    imageModelInput?.addEventListener('input', () => updateHints(imageModelInput, imageHints));
}

if (emailSettingsForm) {
    emailSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEmailSettings();
    });
}


if (testEmailSection) {
    testEmailSection.addEventListener('toggle', () => {
        if (testEmailSection.open) loadTestEmailTemplate();
    });
}

if (testEmailForm) {
    testEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await confirmAndSendTestEmail();
    });
}

if (testImageForm) {
    testImageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendTestImage();
    });
}

if (testQuestionnaireForm) {
    testQuestionnaireForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendTestQuestionnaire();
    });
}

if (maintenanceBtn) {
    maintenanceBtn.addEventListener('click', toggleMaintenanceMode);
    refreshMaintenanceStatus();
}

export {
    allClients,
    loadClients,
    loadQueries,
    renderClients,
    showNotificationDot,
    checkForNotifications,
    showClient,
    setCurrentUserId,
    unreadClients,
    sendTestEmail,
    confirmAndSendTestEmail,
    loadTestEmailTemplate,
    sendTestImage,
    sendTestQuestionnaire,
    sendAdminQuery,
    loadEmailSettings,
    saveEmailSettings
};
