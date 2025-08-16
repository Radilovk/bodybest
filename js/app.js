// app.js - Основен Файл на Приложението
import { isLocalDevelopment, apiEndpoints } from './config.js';
import { debugLog, enableDebug } from './logger.js';
import { safeParseFloat, escapeHtml, fileToDataURL, normalizeDailyLogs, getLocalDate } from './utils.js';
import { selectors, initializeSelectors, loadInfoTexts } from './uiElements.js';
import { getMetricDescription } from './metricUtils.js';
import {
    initializeTheme,
    loadAndApplyColors,
    activateTab,
    openModal, closeModal,
    showLoading, showToast, updateTabsOverflowIndicator
} from './uiHandlers.js';
import {
    populateUI,
    populateProgressHistory,
    populateDashboardMacros,
    setMacroExceedThreshold,
    updateAnalyticsSections
} from './populateUI.js';
import { activeTooltip, setActiveTooltip } from './tooltipState.js';
// КОРЕКЦИЯ: Премахваме handleDelegatedClicks от импорта тук
import { setupStaticEventListeners, setupDynamicEventListeners, initializeCollapsibleCards } from './eventListeners.js';
import { loadProductMacros, calculateCurrentMacros, calculatePlanMacros } from './macroUtils.js';
import {
    displayMessage as displayChatMessage,
    displayTypingIndicator as displayChatTypingIndicator, scrollToChatBottom,
    setAutomatedChatPending
} from './chat.js';
import { initializeAchievements } from './achievements.js';
import { openPlanModificationChat } from './planModChat.js';
export { openPlanModificationChat };

// Активираме дебъг режима само при локална разработка
enableDebug(isLocalDevelopment);

function showPlanModificationConfirm(initialMessage) {
    if (!selectors.chatMessages) return;
    const existing = selectors.chatMessages.querySelector('.plan-mod-confirm-btn');
    existing?.parentElement?.remove();
    const wrapper = document.createElement('div');
    const btn = document.createElement('button');
    btn.textContent = 'Потвърди промяната';
    btn.classList.add('plan-mod-confirm-btn');
    btn.addEventListener('click', () => {
        wrapper.remove();
        openPlanModificationChat(currentUserId, initialMessage);
    });
    wrapper.appendChild(btn);
    selectors.chatMessages.appendChild(wrapper);
    scrollToChatBottom();
}


function normalizeText(input) {
    if (input === undefined || input === null) return '';
    if (typeof input === 'string') return input;
    if (Array.isArray(input)) return input.map(normalizeText).join(', ');
    if (typeof input === 'object') return Object.values(input).map(normalizeText).join(', ');
    return String(input);
}

async function checkAdminQueries(userId) {
    try {
        const resp = await fetch(`${apiEndpoints.getAdminQueries}?userId=${userId}`);
        const data = await resp.json();
        if (resp.ok && data.success && Array.isArray(data.queries) && data.queries.length > 0) {
            data.queries.forEach(q => {
                if (!selectors.chatMessages) return;
                const wrapper = document.createElement('div');
                wrapper.className = 'message bot';
                const span = document.createElement('span');
                span.innerHTML = `Администратор: ${escapeHtml(q.message)}`;
                wrapper.appendChild(span);
                const btn = document.createElement('button');
                btn.textContent = 'Отговори';
                btn.className = 'admin-reply-btn';
                btn.addEventListener('click', () => {
                    const msg = window.prompt('Вашият отговор до администратора:');
                    if (msg) sendReplyToAdmin(msg);
                });
                wrapper.appendChild(document.createElement('br'));
                wrapper.appendChild(btn);
                selectors.chatMessages.appendChild(wrapper);
                chatHistory.push({ text: `Администратор: ${q.message}`, sender: 'bot', isError: false });
            });
            if (!selectors.chatWidget?.classList.contains('visible')) {
                if (selectors.chatFab) selectors.chatFab.classList.add('notification');
                triggerAssistantWiggle();
                setAutomatedChatPending(true);
            }
        }
    } catch (err) {
        console.error('Error fetching admin queries:', err);
    }
}

async function sendReplyToAdmin(msg) {
    if (!currentUserId) return;
    try {
        const resp = await fetch(apiEndpoints.addClientReply, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, message: msg })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            displayChatMessage('Грешка при изпращане на отговора.', 'bot', true);
        } else {
            displayChatMessage(`Вие: ${escapeHtml(msg)}`, 'user');
        }
    } catch (err) {
        console.error('Error sending admin reply:', err);
        displayChatMessage('Грешка при изпращане на отговора.', 'bot', true);
    }
}

// ==========================================================================
// ГЛОБАЛНИ ПРОМЕНЛИВИ ЗА СЪСТОЯНИЕТО НА ПРИЛОЖЕНИЕТО
// ==========================================================================
export let currentUserId = null;
export function setCurrentUserId(val) { currentUserId = val; }
export let fullDashboardData = {};
export let chatHistory = [];
export let todaysMealCompletionStatus = {}; // Updated by populateUI and eventListeners
export let todaysExtraMeals = []; // Extra meals logged for today
export let todaysPlanMacros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }; // Cached plan macros for today
export let currentIntakeMacros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }; // Calculated current macro intake
export let chatModelOverride = null; // Optional model override for next chat message
export let chatPromptOverride = null; // Optional prompt override for next chat message

export function setChatModelOverride(val) { chatModelOverride = val; }
export function setChatPromptOverride(val) { chatPromptOverride = val; }

// Управление на интервал за проверка на статус на плана
let planStatusInterval = null;
let planStatusTimeout = null;
let adminQueriesInterval = null; // Интервал за проверка на администраторски съобщения
let lastSavedDailyLogSerialized = null; // Кеш на последно записания дневен лог

export { activeTooltip, setActiveTooltip };

export function triggerAssistantWiggle() {
    const icon = selectors.chatFab?.querySelector('.assistant-icon');
    if (!icon) return;
    icon.classList.add('wiggle');
    function handleEnd() {
        icon.classList.remove('wiggle');
    }
    icon.addEventListener('animationend', handleEnd, { once: true });
}

// Функция за нулиране на глобалното състояние при изход
export function resetAppState() {
    currentUserId = null;
    fullDashboardData = {};
    chatHistory = [];
    todaysMealCompletionStatus = {};
    todaysPlanMacros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    setActiveTooltip(null);
    chatPromptOverride = null;
    lastSavedDailyLogSerialized = null;
}

// Нулира дневния прием при смяна на деня
export function resetDailyIntake() {
    todaysMealCompletionStatus = {};
    todaysExtraMeals = [];
    currentIntakeMacros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

export function ensureFreshDailyIntake() {
    const todayDateStr = getLocalDate();
    const lastDate = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('lastDashboardDate') : null;
    if (lastDate !== todayDateStr) {
        resetDailyIntake();
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('lastDashboardDate', todayDateStr);
        }
    }
}

// Функция за създаване на тестови данни

function createTestData() {
    return {
        success: true,
        planStatus: "ready",
        userName: "Тестов Потребител",
        analytics: {
            current: { goalProgress: 65, engagementScore: 78, overallHealthScore: 72 },
            detailed: [{ label: "BMI", initialValueText: "28.5", expectedValueText: "24.0", currentValueText: "26.2", key: "bmi", infoTextKey: "bmi_info" }],
            textualAnalysis: "Вашият напредък е стабилен. Продължавайте със силната работа!",
        },
        planData: {
            week1Menu: {
                monday: [{
                    meal_name: "Закуска",
                    items: [
                        { name: "Овесена каша", grams: "50г" },
                        { name: "Банан", grams: "1 бр." }
                    ]
                }]
            },
            allowedForbiddenFoods: {
                main_allowed_foods: ["Пилешко месо", "Риба", "Бобови"],
                main_forbidden_foods: ["Сладкиши", "Газирани напитки"],
                detailed_allowed_suggestions: ["Комбинирайте зеленчуци с белтъчини", "Използвайте зехтин"],
                detailed_limit_suggestions: ["Избягвайте преработени меса"],
                dressing_flavoring_ideas: ["Лимонов сок", "Билки"]
            },
            hydrationCookingSupplements: {
                hydration_recommendations: {
                    daily_liters: "2.5 л",
                    tips: ["Пийте вода през целия ден", "Избягвайте подсладени напитки"],
                    suitable_drinks: ["вода", "билков чай"],
                    unsuitable_drinks: ["алкохол", "газирани напитки"]
                },
                cooking_methods: {
                    recommended: ["Печене", "Готвене на пара"],
                    limit_or_avoid: ["Пържене"],
                    fat_usage_tip: "Използвайте минимално количество зехтин"
                },
                supplement_suggestions: [
                    {
                        supplement_name: "Витамин D",
                        reasoning: "за поддържане на имунната система",
                        dosage_suggestion: "1000 IU дневно",
                        caution: "Консултирайте се с лекар"
                    },
                    {
                        supplement_name: "Рибено масло",
                        reasoning: "омега-3 мастни киселини",
                        dosage_suggestion: "1 капсула дневно"
                    }
                ]
            },
            psychologicalGuidance: {
                coping_strategies: ["Правете кратки разходки", "Дишайте дълбоко"],
                motivational_messages: ["Продължавайте все така!"],
                habit_building_tip: "Записвайте храната си в дневник",
                self_compassion_reminder: "Бъдете добри към себе си"
            },
            additionalGuidelines: [
                { title: "Общи насоки", content: "Пийте повече вода" },
                { title: "Здравословни навици", content: "Ограничете захарта" }
            ]
        },
        dailyLogs: [],
        currentStatus: { weight: 75.5 },
        initialData: { weight: 80.0, height: 175 },
        initialAnswers: { goal: "отслабване", age: "30", gender: "жена" }
    };
}

function planHasRecContent(plan) {
    if (!plan) return false;
    const aff = plan.allowedForbiddenFoods || {};
    const hcs = plan.hydrationCookingSupplements || {};
    const psych = plan.psychologicalGuidance || {};

    const foodArrays = ['main_allowed_foods', 'main_forbidden_foods', 'detailed_allowed_suggestions', 'detailed_limit_suggestions', 'dressing_flavoring_ideas'];
    const hasFoodData = foodArrays.some(key => Array.isArray(aff[key]) && aff[key].length > 0);

    const hyd = hcs.hydration_recommendations || {};
    const hasHydrationData = hyd.daily_liters ||
        ['tips', 'suitable_drinks', 'unsuitable_drinks'].some(k => Array.isArray(hyd[k]) && hyd[k].length > 0);

    const cook = hcs.cooking_methods || {};
    const hasCookingData = ['recommended', 'limit_or_avoid'].some(k => Array.isArray(cook[k]) && cook[k].length > 0) || cook.fat_usage_tip;

    const hasSuppData = Array.isArray(hcs.supplement_suggestions) && hcs.supplement_suggestions.length > 0;

    const hasPsychData = ['coping_strategies', 'motivational_messages'].some(k => Array.isArray(psych[k]) && psych[k].length > 0) ||
        psych.habit_building_tip || psych.self_compassion_reminder;

    const guidelineFields = [plan.principlesWeek2_4, plan.additionalGuidelines];
    const hasGuidelineData = guidelineFields.some(g => {
        if (Array.isArray(g)) return g.length > 0;
        return typeof g === 'string' && g.trim() !== '';
    });

    return hasFoodData || hasHydrationData || hasCookingData || hasSuppData || hasPsychData || hasGuidelineData;
}

export { planHasRecContent };

// ==========================================================================
// ИНИЦИАЛИЗАЦИЯ НА ПРИЛОЖЕНИЕТО
// ==========================================================================
/**
 * Инициализира потребителския интерфейс и зарежда данните на таблото.
 * Извиква се при събитието DOMContentLoaded.
 */
async function initializeApp() {
    if (!document.getElementById('appWrapper')) {
        debugLog('initializeApp пропуснат: липсва #appWrapper');
        return;
    }
    try {
        debugLog("initializeApp starting from app.js...");
        try {
            await loadProductMacros();
        } catch (err) {
            console.warn("Неуспешно зареждане на продуктови макроси:", err);
        }
        initializeSelectors();
        triggerAssistantWiggle();
        await loadInfoTexts();
        if (!document.getElementById('planModInProgressIcon') && selectors.planModificationBtn) {
            const icon = document.createElement('svg');
            icon.id = 'planModInProgressIcon';
            icon.classList.add('icon', 'spinner', 'hidden');
            icon.style.width = '24px';
            icon.style.height = '24px';
            icon.style.marginLeft = '0.5rem';
            icon.innerHTML = '<use href="#icon-spinner"></use>';
            selectors.planModificationBtn.insertAdjacentElement('afterend', icon);
            selectors.planModInProgressIcon = icon;
        }
        updateTabsOverflowIndicator();
        showLoading(true, "Инициализация на таблото...");
        currentUserId = sessionStorage.getItem('userId');

        if (!currentUserId && isLocalDevelopment) {
            debugLog("Local development mode - creating test user");
            currentUserId = 'test_user_' + Date.now();
            sessionStorage.setItem('userId', currentUserId);
            sessionStorage.setItem('userEmail', 'test@example.com');
            sessionStorage.setItem('planStatus', 'ready');
        }

        if (!currentUserId) {
            console.warn("User ID not found in session storage. Redirecting to login.");
            window.location.href = 'index.html';
            return;
        }
        setupStaticEventListeners(); // from eventListeners.js
        initializeCollapsibleCards();
        initializeTheme(); // from uiHandlers.js
        loadAndApplyColors();
        loadDashboardData();
        debugLog("initializeApp finished successfully.");
    } catch (error) {
        console.error("Критична грешка при инициализация:", error.message, error.stack);
        if(selectors.loadingOverlayText && !selectors.loadingOverlayText.textContent.includes("Критична грешка")) {
             selectors.loadingOverlayText.textContent = "Грешка при стартиране. Моля, презаредете.";
        }
        if(selectors.appWrapper) selectors.appWrapper.style.display = 'none';
        if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
    }
}

// ==========================================================================
// ЗАРЕЖДАНЕ И ОБНОВЯВАНЕ НА ДАННИ
// ==========================================================================
export function loadCurrentIntake(status = null, extraMeals = null) {
    try {
        ensureFreshDailyIntake();
        currentIntakeMacros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

        const todayStr = getLocalDate();
        const todayLog = fullDashboardData?.dailyLogs?.find(l => l.date === todayStr)?.data;
        if (todayLog) {
            const completed = todayLog.completedMealsStatus || {};
            Object.keys(todaysMealCompletionStatus).forEach(k => delete todaysMealCompletionStatus[k]);
            Object.assign(todaysMealCompletionStatus, completed);
            todaysExtraMeals = Array.isArray(todayLog.extraMeals) ? todayLog.extraMeals : [];
        } else {
            resetDailyIntake();
            status = null;
            extraMeals = null;
        }

        status = status || todaysMealCompletionStatus;
        extraMeals = extraMeals || todaysExtraMeals;

        currentIntakeMacros = calculateCurrentMacros(
            fullDashboardData.planData?.week1Menu || {},
            status,
            extraMeals
        );
    } catch (err) {
        console.error('Error loading current intake:', err);
    }
}

export function recalculateCurrentIntakeMacros() {
    try {
        ensureFreshDailyIntake();
        currentIntakeMacros = calculateCurrentMacros(
            fullDashboardData.planData?.week1Menu || {},
            todaysMealCompletionStatus,
            todaysExtraMeals
        );
    } catch (err) {
        console.error('Error recalculating current intake:', err);
    }
}

export function updateMacrosAndAnalytics() {
    recalculateCurrentIntakeMacros();
    // Използваме вече кешираните дневни макроси,
    // за да избегнем презаписване с глобални стойности
    populateDashboardMacros();
    refreshAnalytics();
}

/**
 * Зарежда данни за таблото от бекенда и обновява интерфейса.
 * @returns {Promise<void>}
 */
export async function loadDashboardData() {
    debugLog("loadDashboardData starting for user:", currentUserId);
    if (!currentUserId) {
         showPlanPendingState("Грешка: Потребителска сесия не е намерена. Моля, <a href='index.html' style='color: var(--primary-color); text-decoration: underline;'>влезте отново</a>.");
         showLoading(false);
         return;
    }
    showLoading(true, "Зареждане на вашето персонализирано табло...");
    Object.keys(todaysMealCompletionStatus).forEach(key => delete todaysMealCompletionStatus[key]); // Clear previous

    try {
        if (currentUserId.includes('test_user') || isLocalDevelopment) {
            const data = createTestData();
            debugLog("Using test data for development:", data);
            fullDashboardData = data;
            setMacroExceedThreshold(data.macroExceedThreshold);
            fullDashboardData.dailyLogs = normalizeDailyLogs(fullDashboardData.dailyLogs);
            const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const currentDayKey = dayNames[new Date().getDay()];
            const dayMenu = fullDashboardData.planData?.week1Menu?.[currentDayKey] || [];
            todaysPlanMacros = calculatePlanMacros(dayMenu, true, true);
            loadCurrentIntake();
            chatHistory = []; // Reset chat history for test user on reload

            if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
            if(selectors.appWrapper) selectors.appWrapper.style.display = 'block';

            await populateUI();
            scheduleEndOfDaySave();
            initializeAchievements(currentUserId);
            setupDynamicEventListeners();
            await checkAdminQueries(currentUserId);
            startAdminQueriesPolling();

            const activeTabId = sessionStorage.getItem('activeTabId') || selectors.tabButtons[0]?.id;
            const activeTabButton = activeTabId ? document.getElementById(activeTabId) : (selectors.tabButtons && selectors.tabButtons[0]);

            if (activeTabButton && Array.from(selectors.tabButtons).includes(activeTabButton)) {
                activateTab(activeTabButton);
            } else if (selectors.tabButtons && selectors.tabButtons.length > 0) {
                activateTab(selectors.tabButtons[0]);
            }

            showToast("Тестов режим активиран успешно.", false, 2000);
            showLoading(false);
            return;
        }

        const response = await fetch(`${apiEndpoints.dashboard}?userId=${currentUserId}`);
        const jsonClone = response.clone();
        let data = {};
        let rawText = '';
        try {
            data = await jsonClone.json();
        } catch (err) {
            console.error('Error parsing dashboard response JSON:', err);
            rawText = await response.text().catch(() => '');
            if (rawText) {
                try {
                    data = JSON.parse(rawText);
                } catch {
                    data.message = rawText;
                }
            }
        }
        if (!response.ok) {
            const serverMsg = data.message || rawText || `${response.status} ${response.statusText}`;
            throw new Error(`Грешка от сървъра: ${serverMsg}`);
        }
        debugLog('Received planData', data.planData);
        if (!data.success) throw new Error(data.message || 'Неуспешно зареждане на данни от сървъра.');

        debugLog("Data received from worker:", data);
        fullDashboardData = data;
        setMacroExceedThreshold(data.macroExceedThreshold);
        // chatHistory = []; // Do not reset chat history on normal data load, only for test user or logout

        if (data.planStatus === "pending" || data.planStatus === "processing") {
            showPlanPendingState(); return;
        }
        if (data.planStatus === "error") {
            showPlanPendingState(`Възникна грешка при генерирането на вашия план: ${data.message || 'Свържете се с поддръжка.'}`); return;
        }

        fullDashboardData.dailyLogs = normalizeDailyLogs(fullDashboardData.dailyLogs);
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const currentDayKey = dayNames[new Date().getDay()];
        const dayMenu = fullDashboardData.planData?.week1Menu?.[currentDayKey] || [];
        todaysPlanMacros = calculatePlanMacros(dayMenu, true, true);
        loadCurrentIntake();
        await populateDashboardMacros(fullDashboardData.planData?.caloriesMacros);

        if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
        if(selectors.appWrapper) selectors.appWrapper.style.display = 'block';

        const welcomeSeenKey = `welcomeScreenSeen_${currentUserId}`;
        if (data.planStatus === "ready" && data.isFirstLoginWithReadyPlan && !localStorage.getItem(welcomeSeenKey)) {
            localStorage.setItem(welcomeSeenKey, 'true');
            openModal('welcomeScreenModal');
        }

        if (data.aiUpdateSummary) {
            const { title, introduction, changes, encouragement } = data.aiUpdateSummary;
            let summaryHtml = '';
            if (introduction) summaryHtml += `<p>${escapeHtml(normalizeText(introduction)).replace(/\n/g, '<br>')}</p>`;
            if (changes && Array.isArray(changes)) {
                if (changes.length > 0) {
                    summaryHtml += `<ul>${changes.map(ch => `<li>${escapeHtml(normalizeText(ch)).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
                } else {
                    summaryHtml += '<p>Няма съществени промени – планът е обновен без значителни разлики.</p>';
                }
            }
            if (encouragement) summaryHtml += `<p>${escapeHtml(normalizeText(encouragement)).replace(/\n/g, '<br>')}</p>`;

            if (selectors.infoModalTitle) selectors.infoModalTitle.textContent = normalizeText(title) || 'Информация';
            if (selectors.infoModalBody) selectors.infoModalBody.innerHTML = summaryHtml || '<p>Няма детайли.</p>';
            openModal('infoModal');
        }

        if (data.triggerAutomatedFeedbackChat) {
            setAutomatedChatPending(true);
            if (selectors.chatFab) selectors.chatFab.classList.add('notification');
            triggerAssistantWiggle();
        }

        await populateUI();
        scheduleEndOfDaySave();
        await populateProgressHistory(fullDashboardData.dailyLogs, fullDashboardData.initialData);

        const plan = fullDashboardData.planData;
        const hasRecs = planHasRecContent(plan);
        if (!hasRecs) {
            showToast("Препоръките не са налични.", true);
        }

        initializeAchievements(currentUserId);
        setupDynamicEventListeners();
        await checkAdminQueries(currentUserId);
        startAdminQueriesPolling();

        const activeTabId = sessionStorage.getItem('activeTabId') || selectors.tabButtons[0]?.id;
        const activeTabButton = activeTabId ? document.getElementById(activeTabId) : (selectors.tabButtons && selectors.tabButtons[0]);

        if (activeTabButton && Array.from(selectors.tabButtons).includes(activeTabButton)) {
            activateTab(activeTabButton);
        } else if (selectors.tabButtons && selectors.tabButtons.length > 0) {
            activateTab(selectors.tabButtons[0]);
        }

        showToast("Данните са заредени успешно.", false, 2000);
    } catch (error) {
        console.error("Error loading/processing dashboard data:", error);
        showToast(`Грешка при зареждане: ${error.message}`, true, 7000);
        showPlanPendingState(`Възникна грешка: ${error.message}. Опитайте да презаредите страницата или <a href='index.html' style='color: var(--primary-color); text-decoration: underline;'>влезте отново</a>.`);
        if (currentUserId) {
            await checkAdminQueries(currentUserId);
            startAdminQueriesPolling();
        }
    } finally {
        showLoading(false);
    }
}

function showPlanPendingState(customMessage) {
    if (selectors.appWrapper) selectors.appWrapper.style.display = 'none';
    if (selectors.planPendingState) {
        selectors.planPendingState.classList.remove('hidden');
        const pElements = selectors.planPendingState.querySelectorAll('p');
        if (customMessage) {
            if (pElements.length > 1) pElements[1].innerHTML = customMessage;
            else if (pElements.length > 0) pElements[0].innerHTML = customMessage;
        } else {
             if (pElements.length > 0) pElements[0].textContent = "Вашият персонализиран план MyBody.Best се генерира.";
             if (pElements.length > 1) pElements[1].textContent = "Моля, проверете отново по-късно. Ще бъдете уведомени (ако сте позволили известия) или опитайте да презаредите страницата след известно време.";
        }
    }
    showLoading(false);
}

export function stopPlanStatusPolling() {
    if (planStatusInterval) {
        clearInterval(planStatusInterval);
        planStatusInterval = null;
    }
    if (planStatusTimeout) {
        clearTimeout(planStatusTimeout);
        planStatusTimeout = null;
    }
    window.removeEventListener('beforeunload', stopPlanStatusPolling);
    if (selectors.planModInProgressIcon) selectors.planModInProgressIcon.classList.add('hidden');
    if (selectors.planModificationBtn) selectors.planModificationBtn.classList.remove('hidden');
    if (selectors.chatFab) selectors.chatFab.classList.remove('planmod-processing');
}

export function startAdminQueriesPolling(intervalMs = 60000) {
    if (adminQueriesInterval) {
        clearInterval(adminQueriesInterval);
    }
    adminQueriesInterval = setInterval(() => {
        if (currentUserId) checkAdminQueries(currentUserId);
    }, intervalMs);
}

export function stopAdminQueriesPolling() {
    if (adminQueriesInterval) {
        clearInterval(adminQueriesInterval);
        adminQueriesInterval = null;
    }
}

export function pollPlanStatus(intervalMs = 30000, maxDurationMs = 300000) {
    if (!currentUserId) return;
    stopPlanStatusPolling();
    if (selectors.planModInProgressIcon) selectors.planModInProgressIcon.classList.remove('hidden');
    if (selectors.planModificationBtn) selectors.planModificationBtn.classList.add('hidden');
    if (selectors.chatFab) selectors.chatFab.classList.add('planmod-processing');
    showPlanPendingState();
    showToast('Обновявам плана...', false, 3000);

    async function checkStatus() {
        try {
            const resp = await fetch(`${apiEndpoints.planStatus}?userId=${currentUserId}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                if (data.planStatus === 'ready') {
                    stopPlanStatusPolling();
                    if (selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
                    if (selectors.planModInProgressIcon) selectors.planModInProgressIcon.classList.add('hidden');
                    if (selectors.planModificationBtn) selectors.planModificationBtn.classList.remove('hidden');
                    await loadDashboardData();
                    showToast('Планът е обновен.', false, 4000);
                } else if (data.planStatus === 'error') {
                    stopPlanStatusPolling();
                    if (selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
                    if (selectors.planModInProgressIcon) selectors.planModInProgressIcon.classList.add('hidden');
                    if (selectors.planModificationBtn) selectors.planModificationBtn.classList.remove('hidden');
                    showToast(`Грешка при обновяване: ${data.error || ''}`, true, 6000);
                }
            }
        } catch (err) {
            console.error('pollPlanStatus error:', err);
        }
    }

    checkStatus();
    planStatusInterval = setInterval(checkStatus, intervalMs);
    planStatusTimeout = setTimeout(stopPlanStatusPolling, maxDurationMs);
    window.addEventListener('beforeunload', stopPlanStatusPolling);
}

// ==========================================================================
// ФУНКЦИИ ЗА УПРАВЛЕНИЕ НА ДАННИ (ЗАПИС)
// ==========================================================================
export async function refreshAnalytics(skipUiUpdate = false) {
    if (!currentUserId) return;
    try {
        const resp = await fetch(`${apiEndpoints.dashboard}?userId=${currentUserId}`);
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.analytics) {
            fullDashboardData.analytics = data.analytics;
            if (!skipUiUpdate) {
                updateAnalyticsSections(data.analytics);
            }
        }
    } catch (err) {
        console.error('Failed to refresh analytics', err);
    }
}

export async function autoSaveCompletedMeals() {
    if (!currentUserId) return;
    const payload = {
        userId: currentUserId,
        date: getLocalDate(),
        data: { completedMealsStatus: { ...todaysMealCompletionStatus } }
    };
    try {
        const response = await fetch(apiEndpoints.log, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

        const savedDate = result.savedDate || payload.date;
        const savedData = result.savedData || payload.data;
        const idx = (fullDashboardData.dailyLogs || []).findIndex(l => l.date === savedDate);
        if (idx > -1) {
            fullDashboardData.dailyLogs[idx].data = {
                ...fullDashboardData.dailyLogs[idx].data,
                ...savedData
            };
        } else {
            if (!fullDashboardData.dailyLogs) fullDashboardData.dailyLogs = [];
            fullDashboardData.dailyLogs.push({ date: savedDate, data: savedData });
        }
    } catch (err) {
        showToast(`Грешка при авто-запис: ${err.message}`, true);
    }
}

function collectDailyLogPayload({ suppressMessages = false } = {}) {
    const logPayload = { userId: currentUserId, date: getLocalDate(), data: {} };
    const weightInputElement = document.getElementById('dailyLogWeightInput');

    if (weightInputElement) {
        const weightValueStr = weightInputElement.value;
        if (weightValueStr && weightValueStr.trim() !== '') {
            const weightValue = safeParseFloat(weightValueStr);
            if (weightValue !== null && !isNaN(weightValue) && weightValue >= 20 && weightValue <= 300) {
                logPayload.data.weight = weightValue;
            } else if (!suppressMessages) {
                showToast("Моля, въведете валидно тегло (число между 20 и 300), ако желаете да го запишете.", true, 4000);
            }
        }
    } else {
        if (!suppressMessages) {
            console.warn("Weight input element ('dailyLogWeightInput') not found in log. Skipping weight save.");
        }
    }

    logPayload.data.note = selectors.dailyNote?.value.trim() || "";
    logPayload.data.completedMealsStatus = { ...todaysMealCompletionStatus };
    selectors.dailyTracker?.querySelectorAll('.metric-rating:not(.daily-log-weight-metric) input[type="hidden"]').forEach(input => {
        const metricKey = input.id.replace('-rating-input', '');
        const metricValue = parseInt(input.value);
        logPayload.data[metricKey] = metricValue;
        logPayload.data[`${metricKey}Description`] = getMetricDescription(metricKey, metricValue);
    });

    return logPayload;
}

function hasDataToSave(logPayload) {
    let hasData = !!logPayload.data.note ||
                  Object.keys(logPayload.data.completedMealsStatus).length > 0 ||
                  logPayload.data.weight !== undefined;

    if (!hasData) {
        for (const key in logPayload.data) {
            if (key !== 'note' && key !== 'completedMealsStatus' && key !== 'weight' &&
                logPayload.data[key] !== null && logPayload.data[key] !== undefined) {
                hasData = true;
                break;
            }
        }
    }
    return hasData;
}

function hasLogChanged(logPayload) {
    const serialized = JSON.stringify(logPayload);
    return serialized !== lastSavedDailyLogSerialized;
}

function cacheLastLog(logPayload) {
    lastSavedDailyLogSerialized = JSON.stringify(logPayload);
}

export async function autoSaveDailyLog() {
    if (!currentUserId) return;
    const logPayload = collectDailyLogPayload({ suppressMessages: true });
    if (!hasDataToSave(logPayload) || !hasLogChanged(logPayload)) return;
    try {
        const response = await fetch(apiEndpoints.log, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logPayload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

        const savedDate = result.savedDate || logPayload.date;
        const savedData = result.savedData || logPayload.data;
        const idx = (fullDashboardData.dailyLogs || []).findIndex(l => l.date === savedDate);
        if (idx > -1) {
            fullDashboardData.dailyLogs[idx].data = {
                ...fullDashboardData.dailyLogs[idx].data,
                ...savedData
            };
        } else {
            if (!fullDashboardData.dailyLogs) fullDashboardData.dailyLogs = [];
            fullDashboardData.dailyLogs.push({ date: savedDate, data: savedData });
        }
        cacheLastLog({ userId: logPayload.userId, date: savedDate, data: savedData });
    } catch (err) {
        console.error('Auto-save failed', err);
    }
}

export function calcMsToMidnight(now = new Date()) {
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return next.getTime() - now.getTime();
}

let endOfDaySaveTimeout = null;
export function scheduleEndOfDaySave(saveFn = autoSaveDailyLog) {
    if (endOfDaySaveTimeout) clearTimeout(endOfDaySaveTimeout);
    const delay = calcMsToMidnight();
    endOfDaySaveTimeout = setTimeout(async () => {
        endOfDaySaveTimeout = null;
        await saveFn();
        scheduleEndOfDaySave(saveFn);
    }, delay);
}

export async function handleSaveLog() { // Exported for eventListeners.js
    const logPayload = collectDailyLogPayload();

    if (!hasDataToSave(logPayload)) { showToast("Няма нови данни за запис.", false, 2000); return; }
    if (!hasLogChanged(logPayload)) { showToast("Няма промени за запис.", false, 2000); return; }

    showLoading(true, "Запазване на лога...");
    try {
        const response = await fetch(apiEndpoints.log, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logPayload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

        const logIdx = (fullDashboardData.dailyLogs || []).findIndex(l => l.date === result.savedDate);
        if (logIdx > -1) {
            fullDashboardData.dailyLogs[logIdx].data = { ...fullDashboardData.dailyLogs[logIdx].data, ...(result.savedData || logPayload.data) };
        } else {
            if(!fullDashboardData.dailyLogs) fullDashboardData.dailyLogs = [];
            fullDashboardData.dailyLogs.push({date: result.savedDate, data: result.savedData || logPayload.data});
        }
        fullDashboardData.dailyLogs = normalizeDailyLogs(fullDashboardData.dailyLogs);
        if (fullDashboardData.dailyLogs) {
            fullDashboardData.dailyLogs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        if (logPayload.data.weight !== undefined) {
            if (!fullDashboardData.currentStatus) fullDashboardData.currentStatus = {};
            if (result.savedData?.weight !== undefined) {
                fullDashboardData.currentStatus.weight = result.savedData.weight;
            } else if (logPayload.data.weight !== undefined) {
                const parsedWeight = safeParseFloat(logPayload.data.weight);
                if (parsedWeight !== null && !isNaN(parsedWeight) && parsedWeight > 0) {
                    fullDashboardData.currentStatus.weight = parsedWeight;
                }
            }
        }
        cacheLastLog({ userId: logPayload.userId, date: result.savedDate, data: result.savedData || logPayload.data });
        await refreshAnalytics(true);
        updateAnalyticsSections(fullDashboardData.analytics);
        await populateUI();
        initializeAchievements(currentUserId);
        showToast(result.message || "Логът е запазен!", false);
    } catch (error) {
        showToast(`Грешка при запис на лог: ${error.message}`, true);
    } finally { showLoading(false); }
}

export async function handleFeedbackFormSubmit(event) { // Exported for eventListeners.js
    event.preventDefault();
    if (!selectors.feedbackForm) return;
    const formData = new FormData(selectors.feedbackForm);
    const feedbackData = {
        userId: currentUserId,
        timestamp: new Date().toISOString(),
        type: formData.get('feedbackType'),
        message: formData.get('feedbackMessage'),
        rating: formData.get('feedbackRating')
    };

    debugLog("Feedback to send:", feedbackData);
    showLoading(true, "Изпращане на обратна връзка...");
    try {
        const response = await fetch(apiEndpoints.submitFeedback, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }
        showToast(result.message || "Благодарим за обратната връзка!", false);
        closeModal('feedbackModal');
        selectors.feedbackForm.reset();
    } catch (error) {
        showToast(`Грешка при изпращане: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}


// ==========================================================================
// ЧАТ ФУНКЦИИ (API комуникация и управление на историята)
// ==========================================================================

export function stripPlanModSignature(reply) {
    const sig = '[PLAN_MODIFICATION_REQUEST]';
    const idx = reply.lastIndexOf(sig);
    return idx !== -1 ? reply.substring(0, idx).trim() : reply;
}
export async function handleChatSend() { // Exported for eventListeners.js
    if (!selectors.chatInput || !selectors.chatSend) return;
    const messageText = selectors.chatInput.value.trim();
    if (!messageText || !currentUserId) return;

    displayChatMessage(messageText, 'user'); // from chat.js
    chatHistory.push({ text: messageText, sender: 'user', isError: false });

    selectors.chatInput.value = ''; selectors.chatInput.disabled = true; selectors.chatSend.disabled = true;
    displayChatTypingIndicator(true); // from chat.js
    try {
        const payload = { userId: currentUserId, message: messageText, history: chatHistory.slice(-10) }; // Send some history context
        if (chatModelOverride) payload.model = chatModelOverride;
        if (chatPromptOverride) payload.promptOverride = chatPromptOverride;
        const response = await fetch(apiEndpoints.chat, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

        let botReply = result.reply || '';
        const cleaned = stripPlanModSignature(botReply);
        if (cleaned !== botReply) {
            botReply = cleaned;
            showPlanModificationConfirm(messageText);
        } else {
            botReply = cleaned;
        }

        displayChatMessage(botReply, 'bot'); // from chat.js
        chatHistory.push({ text: botReply, sender: 'bot', isError: false });

    } catch (e) {
        const errorMsg = `Грешка при комуникация с асистента: ${e.message}`;
        displayChatMessage(errorMsg, 'bot', true); // from chat.js
        chatHistory.push({ text: errorMsg, sender: 'bot', isError: true });
    } finally {
        displayChatTypingIndicator(false); // from chat.js
        if(selectors.chatInput) { selectors.chatInput.disabled = false; selectors.chatInput.focus(); }
        if(selectors.chatSend) selectors.chatSend.disabled = false;
    }
}

export async function handleChatImageUpload(file) { // Exported for chat.js
    if (!file || !currentUserId) return;

    displayChatMessage('Изпратено изображение', 'user');
    chatHistory.push({ text: '[image]', sender: 'user', isError: false });

    selectors.chatUploadBtn?.setAttribute('disabled', 'true');
    displayChatTypingIndicator(true);

    try {
        const image = await fileToDataURL(file);
        const prompt = selectors.chatInput?.value.trim() || '';
        const response = await fetch(apiEndpoints.analyzeImage, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, image, prompt })
        });
        const result = await response.json();
        const text = result.result || result.message || 'Грешка';
        const isError = !response.ok || !result.success;
        displayChatMessage(text, 'bot', isError);
        chatHistory.push({ text, sender: 'bot', isError });
    } catch (e) {
        const msg = `Грешка при изпращане на изображението: ${e.message}`;
        displayChatMessage(msg, 'bot', true);
        chatHistory.push({ text: msg, sender: 'bot', isError: true });
    } finally {
        displayChatTypingIndicator(false);
        selectors.chatUploadBtn?.removeAttribute('disabled');
        if (selectors.chatImageInput) selectors.chatImageInput.value = '';
    }
}
export function handleChatInputKeypress(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleChatSend();}} // Exported for eventListeners

// ==========================================================================
// СТАРТ НА ПРИЛОЖЕНИЕТО
// ==========================================================================
document.addEventListener('DOMContentLoaded', initializeApp);
