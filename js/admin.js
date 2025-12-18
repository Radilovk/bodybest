import { apiEndpoints } from './config.js';
import { loadConfig, saveConfig } from './adminConfig.js';
import { labelMap, statusMap } from './labelMap.js';
import { fileToDataURL, fileToText, applyProgressFill } from './utils.js';
import { loadTemplateInto } from './templateLoader.js';
import { sanitizeHTML } from './htmlSanitizer.js';
import { loadMaintenanceFlag, setMaintenanceFlag } from './maintenanceMode.js';
import { renderTemplate } from '../utils/templateRenderer.js';
import { ensureChart } from './chartLoader.js';
import { setupPlanRegeneration } from './planRegenerator.js';
import { cachedFetch } from './requestCache.js';
import { initAdminLogsPeriodSelector, initAdminAnalyticsPeriodSelector, getCurrentLogsPeriod, getCurrentAnalyticsPeriod, formatPeriodText } from './adminAnalyticsPeriodSelector.js';

// AI model configuration keys
const AI_MODEL_KEYS = [
    'model_plan_generation',
    'model_chat',
    'model_principle_adjustment',
    'model_image_analysis',
    'model_questionnaire_analysis',
    'model_nutrient_lookup'
];

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
    } catch {
        window.location.href = 'login.html';
    }
}

const clientsList = document.getElementById('clientsList');
const clientsCount = document.getElementById('clientsCount');
const clientSearch = document.getElementById('clientSearch');
const clientSuggestions = document.getElementById('clientSuggestions');
const statusFilter = document.getElementById('statusFilter');
const tagFilterSelect = document.getElementById('tagFilter');
const detailsSection = document.getElementById('clientDetails');
const regenBtn = document.getElementById('regeneratePlan');
const regenProgress = document.getElementById('regenProgress');
const aiSummaryBtn = document.getElementById('aiSummary');
const deleteClientBtn = document.getElementById('deleteClient');
const notesField = document.getElementById('adminNotes');
const tagsField = document.getElementById('adminTags');
const saveNotesBtn = document.getElementById('saveNotes');
const queriesList = document.getElementById('queriesList');
const newQueryText = document.getElementById('newQueryText');
const sendQueryBtn = document.getElementById('sendQuery');
const clientRepliesList = document.getElementById('clientRepliesList');
const feedbackList = document.getElementById('feedbackList');
const kvDataDiv = document.getElementById('kvData');
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
const profileMacroThreshold = document.getElementById('profileMacroThreshold');
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
const nutrientModelInput = document.getElementById('nutrientModel');
const nutrientPromptInput = document.getElementById('nutrientPrompt');
const nutrientHints = document.getElementById('nutrientHints');
const testNutrientBtn = document.getElementById('testNutrientModel');


const modelOptionsList = document.getElementById('modelOptions');
let availableModels = new Set(JSON.parse(localStorage.getItem('aiModelHistory') || '[]'));

function populateModelOptions() {
    if (!modelOptionsList) return;
    modelOptionsList.innerHTML = '';
    for (const m of availableModels) {
        if (!m) continue;
        const opt = document.createElement('option');
        opt.value = m;
        modelOptionsList.appendChild(opt);
    }
}

function recordSuccessfulModel(modelName) {
    if (!modelName) return;
    availableModels.add(modelName);
    localStorage.setItem('aiModelHistory', JSON.stringify(Array.from(availableModels)));
    populateModelOptions();
}

populateModelOptions();
const emailSettingsForm = document.getElementById('emailSettingsForm');
const fromEmailNameInput = document.getElementById('fromEmailName');
const emailTypesContainer = document.getElementById('emailTypesContainer');
const emailFieldsetTemplate = document.getElementById('emailFieldsetTemplate');
const testEmailForm = document.getElementById('testEmailForm');
const testEmailToInput = document.getElementById('testEmailTo');
const testEmailSubjectInput = document.getElementById('testEmailSubject');
const testEmailBodyInput = document.getElementById('testEmailBody');
const testEmailSection = document.getElementById('testEmailSection');
const testEmailPreview = document.getElementById('testEmailPreview');
const testImageForm = document.getElementById('testImageForm');

const emailTypes = [
    {
        keyPrefix: 'welcome',
        legend: 'Приветствен имейл (след регистрация)',
        subjectPlaceholder: 'Добре дошли в BodyBest!',
        bodyPlaceholder: 'Здравейте {{name}}, благодарим за регистрацията...',
        sendLabel: 'Изпращай приветствен имейл',
        sampleVars: { name: 'Иван' }
    },
    {
        keyPrefix: 'questionnaire',
        legend: 'Потвърждение след въпросник',
        subjectPlaceholder: 'Благодарим за попълнения въпросник',
        bodyPlaceholder: 'Получихме отговорите и започваме обработка...',
        sendLabel: 'Изпращай имейл след въпросник',
        sampleVars: { name: 'Иван' }
    },
    {
        keyPrefix: 'contact',
        legend: 'Имейл при контакт',
        subjectPlaceholder: 'Благодарим за връзката',
        bodyPlaceholder: 'Здравейте {{name}}, получихме вашето съобщение...',
        sendLabel: 'Изпращай имейл при контакт',
        sampleVars: { name: 'Иван', form_label: 'форма за контакт' }
    },
    {
        keyPrefix: 'analysis',
        legend: 'Имейл при готов анализ',
        subjectPlaceholder: 'Вашият анализ е готов',
        bodyPlaceholder: 'Здравейте {{name}}, анализът ви е готов.',
        sendLabel: 'Изпращай имейл при готов анализ',
        sampleVars: { name: 'Иван', link: 'https://example.com' }
    }
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function generateEmailFieldsets() {
    if (!emailTypesContainer || !emailFieldsetTemplate) return;
    emailTypes.forEach(({ keyPrefix, legend, subjectPlaceholder, bodyPlaceholder, sendLabel }) => {
        const clone = emailFieldsetTemplate.content.cloneNode(true);
        const fieldset = clone.querySelector('fieldset');
        fieldset.querySelector('legend').textContent = legend;
        const subjectInput = fieldset.querySelector('[data-subject]');
        subjectInput.id = `${keyPrefix}EmailSubject`;
        const subjectPreview = fieldset.querySelector('[data-subject-preview]');
        subjectPreview.id = `${keyPrefix}EmailSubjectPreview`;
        subjectInput.placeholder = subjectPlaceholder;
        const bodyTextarea = fieldset.querySelector('[data-body]');
        bodyTextarea.id = `${keyPrefix}EmailBody`;
        bodyTextarea.placeholder = bodyPlaceholder;
        const previewDiv = fieldset.querySelector('[data-preview]');
        previewDiv.id = `${keyPrefix}EmailPreview`;
        const sendCheckbox = fieldset.querySelector('[data-send]');
        sendCheckbox.id = `send${cap(keyPrefix)}Email`;
        const sendLabelSpan = fieldset.querySelector('[data-send-label]');
        sendLabelSpan.textContent = sendLabel;
        const extraDiv = fieldset.querySelector('[data-extra]');
        if (keyPrefix === 'contact') {
            const extraLabel = document.createElement('label');
            extraLabel.innerHTML = 'Етикет на формата:<br><input id="contactFormLabel" type="text" placeholder="форма за контакт">';
            extraDiv.appendChild(extraLabel);
        }
        emailTypesContainer.appendChild(clone);
    });
}

function initEmailPreviews() {
    emailTypes.forEach(({ keyPrefix, sampleVars }) => {
        const subject = document.getElementById(`${keyPrefix}EmailSubject`);
        const subjectPreview = document.getElementById(`${keyPrefix}EmailSubjectPreview`);
        attachSubjectPreview(subject, subjectPreview, sampleVars);
        const body = document.getElementById(`${keyPrefix}EmailBody`);
        const preview = document.getElementById(`${keyPrefix}EmailPreview`);
        attachEmailPreview(body, preview, sampleVars);
    });
    attachEmailPreview(testEmailBodyInput, testEmailPreview, { name: 'Иван' });
}
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
const notificationFetchState = {
    snapshot: null,
    inFlight: null,
    skipNextTick: false
};

function parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (value == null) return 0;
    const parsed = Date.parse(typeof value === 'string' ? value : String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
}
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
setupPlanRegeneration({
    regenBtn,
    regenProgress,
    getUserId: () => currentUserId
});
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
    'gpt-3.5-turbo': { tokens: 'до 8192', temperature: 'препоръчително 0.3' },
    'command-r-plus': { tokens: 'до 8192', temperature: 'препоръчително 0.3' },
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
        const html = renderTemplate(textarea.value, sample);
        previewElem.innerHTML = sanitizeHTML(html);
    };
    textarea.addEventListener('input', update);
    update();
}

export function attachSubjectPreview(inputElem, previewElem, sample = {}) {
    if (!inputElem || !previewElem) return;
    const update = () => {
        const text = renderTemplate(inputElem.value, sample);
        previewElem.textContent = text;
    };
    inputElem.addEventListener('input', update);
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

async function requestNotificationSnapshot(force = false) {
    if (!force && notificationFetchState.skipNextTick) {
        notificationFetchState.skipNextTick = false;
        return null;
    }
    if (notificationFetchState.inFlight) {
        return notificationFetchState.inFlight;
    }
    const fetchPromise = (async () => {
        try {
            const resp = await fetch(apiEndpoints.peekAdminNotifications);
            const data = await resp.json();
            if (!resp.ok || !data.success || !Array.isArray(data.clients)) {
                throw new Error('Invalid admin notifications payload');
            }
            notificationFetchState.snapshot = data.clients;
            notificationFetchState.skipNextTick = false;
            return notificationFetchState.snapshot;
        } catch (error) {
            notificationFetchState.skipNextTick = true;
            console.error('Error requesting admin notifications snapshot:', error);
            return null;
        } finally {
            notificationFetchState.inFlight = null;
        }
    })();
    notificationFetchState.inFlight = fetchPromise;
    return fetchPromise;
}

async function ensureNotificationSnapshot(options = {}) {
    const { force = false } = options;
    if (!force && notificationFetchState.snapshot && !notificationFetchState.inFlight) {
        return notificationFetchState.snapshot;
    }
    const result = await requestNotificationSnapshot(force);
    if (result) {
        return result;
    }
    return notificationFetchState.snapshot;
}

async function checkForNotifications() {
    if (!notificationDot) return;
    try {
        const snapshot = await requestNotificationSnapshot();
        const clients = Array.isArray(snapshot)
            ? snapshot
            : (Array.isArray(notificationFetchState.snapshot) ? notificationFetchState.snapshot : null);
        if (!Array.isArray(clients)) return;

        unreadClients.clear();
        unreadByClient.clear();

        let hasNew = false;
        const storedTs = Number(localStorage.getItem('lastFeedbackTs')) || 0;
        let latestTs = storedTs;

        for (const client of clients) {
            if (!client || !client.userId) continue;
            const queries = Array.isArray(client.queries) ? client.queries : [];
            const replies = Array.isArray(client.replies) ? client.replies : [];
            const feedback = Array.isArray(client.feedback) ? client.feedback : [];
            const planChangeRequests = Array.isArray(client.planChangeRequests) ? client.planChangeRequests : [];
            const flags = { 
                queries: queries.length > 0, 
                replies: replies.length > 0, 
                feedback: false,
                planChangeRequests: planChangeRequests.length > 0
            };
            let userHasNew = flags.queries || flags.replies || flags.planChangeRequests;

            for (const fb of feedback) {
                if (!fb) continue;
                const ts = parseTimestamp(fb.timestamp ?? fb.ts);
                if (ts > storedTs) {
                    flags.feedback = true;
                    userHasNew = true;
                    if (ts > latestTs) latestTs = ts;
                }
            }

            if (!flags.feedback && client.latestFeedbackTs) {
                const ts = parseTimestamp(client.latestFeedbackTs);
                if (ts > storedTs) {
                    flags.feedback = true;
                    userHasNew = true;
                    if (ts > latestTs) latestTs = ts;
                }
            }

            if (userHasNew) {
                unreadClients.add(client.userId);
                unreadByClient.set(client.userId, flags);
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

async function displayDailyLogs(logs, isError = false) {
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
    await updateWeightChart(logs);
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
            applyProgressFill(fill, pct);
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
    
    // Add period indicator
    const periodDays = analytics.periodDays || 7;
    const periodText = formatPeriodText(periodDays);
    const periodIndicator = document.createElement('p');
    periodIndicator.style.fontSize = '0.9rem';
    periodIndicator.style.color = '#666';
    periodIndicator.style.marginBottom = '0.5rem';
    periodIndicator.textContent = `Период: ${periodText}`;
    analyticsSummaryDiv.appendChild(periodIndicator);
    
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
            updateClientSuggestions();
            const stats = {
                clients: allClients.length,
                ready: allClients.filter(c => c.status === 'ready').length,
                pending: allClients.filter(c => c.status === 'pending').length,
                processing: allClients.filter(c => c.status === 'processing').length
            };
            if (statsOutput) statsOutput.textContent = JSON.stringify(stats, null, 2);
            await updateStatusChart(stats);
        }
    } catch (err) {
        console.error('Error loading clients:', err);
        alert('Грешка при зареждане на клиентите. Проверете връзката с API.');
    }
}

async function renderClients() {
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
    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'client-card';
        empty.textContent = 'Няма намерени клиенти.';
        clientsList?.appendChild(empty);
        return;
    }
    await Promise.all(list.map(async c => {
        const card = document.createElement('div');
        card.className = 'client-card';
        const btn = document.createElement('button');
        btn.className = 'client-open';
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
        card.appendChild(btn);

        const needsPlan =
            c.status === 'pending' ||
            c.status === 'error' ||
            c.status === 'unknown' ||
            c.status === 'processing';
        if (needsPlan) {
            const regen = document.createElement('button');
            regen.className = 'regen-plan-btn button-small';
            regen.textContent = 'Нов план';
            regen.title = 'Генерирай нов план';
            const progress = document.createElement('span');
            progress.className = 'regen-progress hidden';
            progress.setAttribute('aria-live', 'polite');
            card.appendChild(regen);
            card.appendChild(progress);
            regen.addEventListener('click', e => e.stopPropagation());
            setupPlanRegeneration({
                regenBtn: regen,
                regenProgress: progress,
                getUserId: () => c.userId
            });
        }

        clientsList?.appendChild(card);
    }));
}

function updateClientSuggestions() {
    if (!clientSuggestions) return;
    const search = (clientSearch.value || '').toLowerCase();
    clientSuggestions.innerHTML = '';
    if (!search) return;
    const suggestions = [];
    for (const c of allClients) {
        if (c.name && c.name.toLowerCase().includes(search)) {
            suggestions.push(c.name);
        }
        if (c.email && c.email.toLowerCase().includes(search)) {
            suggestions.push(c.email);
        }
        if (suggestions.length >= 5) break;
    }
    suggestions.slice(0, 5).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        clientSuggestions.appendChild(opt);
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

async function updateStatusChart(stats) {
    if (!statusChartCanvas) return;
    const Chart = await ensureChart();
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

async function updateWeightChart(logs) {
    if (!weightChartCanvas) return;
    const Chart = await ensureChart();
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

/**
 * Handles deletion of a plan change notification
 * @param {Object} notification - The notification object with userId and id
 * @param {HTMLElement} listItem - The list item element to remove
 */
async function handleDeleteNotification(notification, listItem) {
    if (!confirm('Сигурни ли сте, че искате да изтриете тази нотификация?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/deletePlanChangeNotification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: notification.userId,
                notificationId: notification.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Remove the notification from the UI
            listItem.remove();
            
            // If no more notifications, show empty state
            if (notificationsList.children.length === 0) {
                const emptyLi = document.createElement('li');
                emptyLi.textContent = 'Няма нови известия.';
                notificationsList.appendChild(emptyLi);
                // Keep section visible to show the empty state message
            }
        } else {
            alert(result.message || 'Грешка при изтриване на нотификацията.');
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
        alert('Грешка при изтриване на нотификацията.');
    }
}

async function loadNotifications(options = {}) {
    if (!notificationsList || !notificationsSection) return;
    notificationsList.innerHTML = '';
    try {
        const storedTs = Number(localStorage.getItem('lastFeedbackTs')) || 0;
        const snapshot = await ensureNotificationSnapshot(options);
        const clients = Array.isArray(snapshot)
            ? snapshot
            : (Array.isArray(notificationFetchState.snapshot) ? notificationFetchState.snapshot : []);

        if (!Array.isArray(clients)) {
            const li = document.createElement('li');
            li.textContent = 'Известията не могат да се заредят в момента.';
            notificationsList.appendChild(li);
            notificationsSection.classList.remove('hidden');
            return;
        }

        const items = [];
        for (const client of clients) {
            if (!client || !client.userId) continue;
            const name = client.name || client.userId;
            const queries = Array.isArray(client.queries) ? client.queries : [];
            const replies = Array.isArray(client.replies) ? client.replies : [];
            const feedback = Array.isArray(client.feedback) ? client.feedback : [];
            const planChangeRequests = Array.isArray(client.planChangeRequests) ? client.planChangeRequests : [];

            queries.forEach(q => {
                if (!q || !q.message) return;
                const ts = parseTimestamp(q.ts ?? q.timestamp);
                items.push({ userId: client.userId, name, text: q.message, ts, type: 'query' });
            });

            replies.forEach(r => {
                if (!r || !r.message) return;
                const ts = parseTimestamp(r.ts ?? r.timestamp);
                items.push({ userId: client.userId, name, text: r.message, ts, type: 'reply' });
            });

            feedback.forEach(fb => {
                if (!fb || !fb.message) return;
                const ts = parseTimestamp(fb.timestamp ?? fb.ts);
                if (ts === 0 || ts > storedTs) {
                    items.push({ userId: client.userId, name, text: fb.message, ts, type: 'feedback' });
                }
            });

            planChangeRequests.forEach(pcr => {
                // Note: requestText is mapped to message in the backend (handlePeekAdminNotificationsRequest)
                if (!pcr || !pcr.message) return;
                const ts = parseTimestamp(pcr.ts ?? pcr.timestamp);
                items.push({ 
                    userId: client.userId, 
                    name, 
                    text: pcr.message, 
                    ts, 
                    type: 'plan_change_request',
                    status: pcr.status || 'pending',
                    id: pcr.id // Include ID for deletion
                });
            });
        }

        items.sort((a, b) => b.ts - a.ts);

        if (items.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Няма нови известия.';
            notificationsList.appendChild(li);
            notificationsSection.classList.add('hidden');
            return;
        }

        items.forEach(it => {
            const li = document.createElement('li');
            
            // Add special styling for plan change requests
            if (it.type === 'plan_change_request') {
                li.classList.add('notification-plan-change');
                const icon = document.createElement('span');
                icon.textContent = '📝 ';
                icon.style.marginRight = '5px';
                li.appendChild(icon);
            }
            
            const textNode = document.createTextNode(`${it.name || it.userId}: ${it.text}`);
            li.appendChild(textNode);
            
            // Add delete button for plan change requests
            if (it.type === 'plan_change_request' && it.id) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '✕';
                deleteBtn.className = 'notification-delete-btn';
                deleteBtn.title = 'Изтрий нотификацията';
                deleteBtn.setAttribute('aria-label', 'Изтрий нотификацията');
                
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent opening client profile
                    await handleDeleteNotification(it, li);
                });
                
                li.appendChild(deleteBtn);
            }
            
            li.addEventListener('click', () => showClient(it.userId));
            notificationsList.appendChild(li);
        });
        notificationsSection.classList.remove('hidden');
    } catch (err) {
        console.error('Error loading notifications:', err);
        const li = document.createElement('li');
        li.textContent = 'Известията не могат да се заредят в момента.';
        notificationsList.appendChild(li);
        notificationsSection.classList.remove('hidden');
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
        setCurrentUserId(null);
    });
}

function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

const debouncedRenderClients = debounce(renderClients, 300);

if (clientSearch) {
    clientSearch.addEventListener('input', () => {
        updateClientSuggestions();
        debouncedRenderClients();
    });
}
if (statusFilter) statusFilter.addEventListener('change', renderClients);
if (sortOrderSelect) sortOrderSelect.addEventListener('change', renderClients);
if (tagFilterSelect) tagFilterSelect.addEventListener('change', renderClients);


async function showClient(userId) {
    if (adminProfileContainer) {
        adminProfileContainer.innerHTML = '';
        history.replaceState(null, '', `?userId=${encodeURIComponent(userId)}`);
        await loadTemplateInto('editclient.html', 'adminProfileContainer');
        
        const mod = await import('./editClient.js');
        try {
            await mod.initEditClient(userId);
        } catch (err) {
            console.error('initEditClient error', err);
            alert('Липсва визуализация на плана.');
        }
        setupProfileCardNav();
    }
    try {
        // ОПТИМИЗАЦИЯ: използваме cachedFetch за да избегнем многократни заявки
        const [data, dashData] = await Promise.all([
            cachedFetch(`${apiEndpoints.getProfile}?userId=${userId}`, { ttl: 60000 }), // 1 минута
            cachedFetch(`${apiEndpoints.dashboard}?userId=${userId}`, { ttl: 30000 })   // 30 секунди
        ]);

        let initialAnswers = dashData?.initialAnswers || {};
        let userKv = {};
        let profileData = data?.success ? { ...data } : {};

        const profileStatus = data?.status ?? 'unknown';
        const profileMessage = data?.message ?? 'Няма съобщение';
        if (!data || !data.success) {
            alert(`Профилът върна ${profileStatus}: ${profileMessage}`);
        }

        const dashStatus = dashData?.status ?? 'unknown';
        const dashMessage = dashData?.message ?? 'Няма съобщение';
        if (!dashData || !dashData.success) {
            alert(`Таблото върна ${dashStatus}: ${dashMessage}`);
        }

        if (kvDataDiv) kvDataDiv.innerHTML = '';
        try {
            const kvResp = await fetch(`${apiEndpoints.listUserKv}?userId=${userId}`);
            const kvData = await kvResp.json().catch(() => ({}));
            const kvStatus = kvData.status ?? kvResp.status;
            const kvMessage = kvData.message ?? kvResp.statusText;
            if (kvResp.ok && kvData.success) {
                userKv = kvData.kv || {};
                const iaStr = userKv[`${userId}_initial_answers`];
                if (iaStr) {
                    try { initialAnswers = JSON.parse(iaStr); } catch {}
                }
                const profileStr = userKv[`${userId}_profile`];
                if (profileStr) {
                    try {
                        profileData = { ...JSON.parse(profileStr), ...profileData };
                    } catch {}
                }
                Object.entries(userKv).forEach(([fullKey, val]) => {
                    const detailsEl = document.createElement('details');
                    const summaryEl = document.createElement('summary');
                    summaryEl.textContent = fullKey.replace(`${userId}_`, '');
                    const textarea = document.createElement('textarea');
                    textarea.value = val || '';
                    const btn = document.createElement('button');
                    btn.textContent = 'Запази';
                    btn.addEventListener('click', async () => {
                        const ok = await saveKvEntry(fullKey, textarea.value);
                        if (ok) {
                            btn.textContent = 'Запазено';
                            setTimeout(() => (btn.textContent = 'Запази'), 1000);
                        }
                    });
                    detailsEl.append(summaryEl, textarea, btn);
                    kvDataDiv?.appendChild(detailsEl);
                });
            } else {
                if (kvDataDiv) kvDataDiv.textContent = 'Грешка при зареждане на KV данни';
                alert(`KV върна ${kvStatus}: ${kvMessage}`);
            }
        } catch (err) {
            console.error('Error loading KV data:', err);
            if (kvDataDiv) kvDataDiv.textContent = 'Грешка при зареждане на KV данни';
            alert(`KV върна грешка: ${err.message}`);
        }

        let hasError = false;
        if (data?.success) {
            setCurrentUserId(userId);
            detailsSection.classList.remove('hidden');
            resetTabs();
            openDetailsSections();
            const clientInfo = allClients.find(c => c.userId === userId);
            const regDate = clientInfo?.registrationDate ? new Date(clientInfo.registrationDate).toLocaleDateString('bg-BG') : '';
            const name = clientInfo?.name || profileData.name || initialAnswers.name || userId;
            clientNameHeading.textContent = regDate ? `${name} - ${regDate}` : name;
            window.activeUserId = userId;
            window.activeClientName = name;
            const emailVal = profileData.email || userKv[`${userId}_email`] || initialAnswers.email || '';
            const phoneVal = profileData.phone || userKv[`${userId}_phone`] || initialAnswers.phone || '';
            const macroThresholdVal = profileData.macroExceedThreshold ?? '';
            if (profileName) profileName.value = profileData.name || initialAnswers.name || '';
            if (profileEmail) profileEmail.value = emailVal;
            if (profilePhone) profilePhone.value = phoneVal;
            if (profileMacroThreshold) profileMacroThreshold.value = macroThresholdVal;
            if (openFullProfileLink) openFullProfileLink.href = `clientProfile.html?userId=${encodeURIComponent(userId)}`;
            if (openUserDataLink) openUserDataLink.href = `Userdata.html?userId=${encodeURIComponent(userId)}`;
            try {
                await loadQueries(true);
            } catch (err) {
                console.error('loadQueries error', err);
            }
            try {
                await loadFeedback();
            } catch (err) {
                console.error('loadFeedback error', err);
            }
            try {
                await loadClientReplies(true);
            } catch (err) {
                console.error('loadClientReplies error', err);
            }
            unreadClients.delete(userId);
            unreadByClient.delete(userId);
            updateSectionDots(userId);
            renderClients();
        } else {
            hasError = true;
        }
        if (dashData?.success) {
            displayInitialAnswers(dashData.initialAnswers || {}, false);
            const menu = dashData.planData?.week1Menu || {};
            displayPlanMenu(menu, false);
            await displayDailyLogs(dashData.dailyLogs || [], false);
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
            
            // Initialize period selectors for admin panel
            initAdminLogsPeriodSelector(async (period) => {
                try {
                    const logs = dashData.dailyLogs || [];
                    const filteredLogs = period === 'all' ? logs : logs.slice(0, period);
                    await displayDailyLogs(filteredLogs, false);
                } catch (error) {
                    console.error("Error filtering logs:", error);
                }
            });
            
            initAdminAnalyticsPeriodSelector(async (period) => {
                try {
                    // Reload dashboard data with the specified period
                    const url = `${apiEndpoints.dashboard}?userId=${userId}&period=${period}`;
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    if (data.success && data.analytics) {
                        displayDashboardSummary(data);
                    } else {
                        console.error("Failed to load analytics:", data.message);
                        alert('Грешка при обновяване на аналитиката: ' + (data.message || 'Неизвестна грешка'));
                    }
                } catch (error) {
                    console.error("Error refreshing analytics:", error);
                    alert('Грешка при обновяване на аналитиката: ' + error.message);
                }
            });
        } else {
            displayInitialAnswers(null, true);
            displayPlanMenu(null, true);
            await displayDailyLogs(null, true);
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
    await loadNotifications({ force: true });
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

if (deleteClientBtn) {
    deleteClientBtn.addEventListener('click', async () => {
        if (!currentUserId) return;
        if (!confirm('Сигурни ли сте, че искате да изтриете профила?')) return;
        try {
            const resp = await fetch(apiEndpoints.deleteClient, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.success) {
                alert(data.message || 'Грешка при изтриване.');
                return;
            }
            alert('Профилът е изтрит.');
            closeProfileBtn?.click();
            await loadClients();
        } catch (err) {
            console.error('Error deleting client:', err);
            alert('Грешка при изтриване на профила.');
        }
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
                    phone: profilePhone.value.trim(),
                    macroExceedThreshold: profileMacroThreshold.value ? parseFloat(profileMacroThreshold.value) : undefined
                })
            });
            alert('Профилът е обновен.');
        } catch (err) {
            console.error('Error updating profile:', err);
        }
    });
}

async function loadQueries() {
    if (!currentUserId) return;
    try {
        const endpoint = apiEndpoints.peekAdminQueries;
        if (!endpoint) return;
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
        }
    } catch (err) {
        console.error('Error loading client replies:', err);
    }
}

async function saveKvEntry(key, value) {
    try {
        const resp = await fetch(apiEndpoints.updateKv, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        const data = await resp.json().catch(() => ({}));
        return resp.ok && data.success;
    } catch (err) {
        console.error('Error saving KV entry:', err);
        return false;
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
        if (nutrientModelInput) nutrientModelInput.value = cfg.model_nutrient_lookup || '';
        if (nutrientPromptInput) nutrientPromptInput.value = cfg.prompt_nutrient_lookup || '';
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
        updateHints(planModelInput, planHints);
        updateHints(chatModelInput, chatHints);
        updateHints(modModelInput, modHints);
        updateHints(imageModelInput, imageHints);
        updateHints(nutrientModelInput, nutrientHints);
        AI_MODEL_KEYS.forEach(k => { if (cfg[k]) availableModels.add(cfg[k]); });
        populateModelOptions();
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
            model_nutrient_lookup: nutrientModelInput ? nutrientModelInput.value.trim() : '',
            prompt_nutrient_lookup: nutrientPromptInput ? nutrientPromptInput.value.trim() : '',
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
            welcome_email_subject: '',
            welcome_email_body: ''
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
        const keys = ['from_email_name', 'contact_form_label'];
        emailTypes.forEach(({ keyPrefix }) => {
            keys.push(`${keyPrefix}_email_subject`);
            keys.push(`${keyPrefix}_email_body`);
            keys.push(`send_${keyPrefix}_email`);
        });
        const cfg = await loadConfig(keys);
        if (fromEmailNameInput) fromEmailNameInput.value = cfg.from_email_name || '';
        emailTypes.forEach(({ keyPrefix, sampleVars }) => {
            const subjectInput = document.getElementById(`${keyPrefix}EmailSubject`);
            const bodyInput = document.getElementById(`${keyPrefix}EmailBody`);
            const preview = document.getElementById(`${keyPrefix}EmailPreview`);
            const subjectPreview = document.getElementById(`${keyPrefix}EmailSubjectPreview`);
            const sendCheckbox = document.getElementById(`send${cap(keyPrefix)}Email`);
            if (subjectInput) subjectInput.value = cfg[`${keyPrefix}_email_subject`] || '';
            if (subjectPreview && subjectInput) {
                subjectPreview.textContent = renderTemplate(subjectInput.value, sampleVars);
            }
            if (bodyInput) {
                bodyInput.value = cfg[`${keyPrefix}_email_body`] || '';
                if (preview) preview.innerHTML = sanitizeHTML(bodyInput.value);
            }
            if (sendCheckbox) {
                const val = cfg[`send_${keyPrefix}_email`];
                sendCheckbox.checked = val !== '0' && val !== 'false';
            }
        });
        const contactLabel = document.getElementById('contactFormLabel');
        if (contactLabel) contactLabel.value = cfg.contact_form_label || '';
    } catch (err) {
        console.error('Error loading email settings:', err);
    }
}

async function saveEmailSettings() {
    if (!emailSettingsForm) return;
    const updates = {
        from_email_name: fromEmailNameInput ? fromEmailNameInput.value.trim() : '',
        contact_form_label: document.getElementById('contactFormLabel')?.value.trim() || ''
    };
    emailTypes.forEach(({ keyPrefix }) => {
        const subjectInput = document.getElementById(`${keyPrefix}EmailSubject`);
        const bodyInput = document.getElementById(`${keyPrefix}EmailBody`);
        const sendCheckbox = document.getElementById(`send${cap(keyPrefix)}Email`);
        updates[`${keyPrefix}_email_subject`] = subjectInput?.value.trim() || '';
        updates[`${keyPrefix}_email_body`] = bodyInput?.value.trim() || '';
        updates[`send_${keyPrefix}_email`] = sendCheckbox && sendCheckbox.checked ? '1' : '0';
    });
    try {
        await saveConfig(updates);
        alert('Имейл настройките са записани.');
    } catch (err) {
        console.error('Error saving email settings:', err);
        alert('Грешка при запис на имейл настройките.');
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
        alert(err.message || 'Грешка при изпращане.');
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
            recordSuccessfulModel(modelName);
        }
    } catch (err) {
        console.error('Error testing AI model:', err);
        alert('Грешка при тестване на модела.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Инициализира табовете веднага
    setupTabs();

    generateEmailFieldsets();
    initEmailPreviews();

    // Стартира асинхронните операции паралелно,
    // за да не блокират работата на интерфейса
    (async () => {
        await ensureLoggedIn();
        loadAdminToken();
        await Promise.all([
            loadClients(),
            checkForNotifications(),
            loadNotifications(),
            loadAiConfig(),
            loadAiPresets(),
            emailSettingsForm ? loadEmailSettings() : Promise.resolve(),
            testEmailSection?.open ? loadTestEmailTemplate() : Promise.resolve()
        ]);
        // ОПТИМИЗАЦИЯ: Премахнато автоматично polling на всеки час
        // Нотификациите се зареждат само при първоначално отваряне на страницата
        // При необходимост потребителят може да обнови страницата ръчно
        // Това спестява 24 заявки на ден при отворен админ панел
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
    testNutrientBtn?.addEventListener('click', () => testAiModel(nutrientModelInput.value.trim()));
    planModelInput?.addEventListener('input', () => updateHints(planModelInput, planHints));
    chatModelInput?.addEventListener('input', () => updateHints(chatModelInput, chatHints));
    modModelInput?.addEventListener('input', () => updateHints(modModelInput, modHints));
    imageModelInput?.addEventListener('input', () => updateHints(imageModelInput, imageHints));
    nutrientModelInput?.addEventListener('input', () => updateHints(nutrientModelInput, nutrientHints));
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
