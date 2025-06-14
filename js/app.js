// app.js - Основен Файл на Приложението
import { isLocalDevelopment, workerBaseUrl, apiEndpoints, generateId } from './config.js';
import { safeGet, safeParseFloat, capitalizeFirstLetter } from './utils.js';
import { selectors, initializeSelectors, trackerInfoTexts, detailedMetricInfoTexts } from './uiElements.js';
import {
    toggleMenu, closeMenu, handleOutsideMenuClick, handleMenuKeydown,
    initializeTheme, applyTheme, toggleTheme, updateThemeButtonText,
    activateTab, handleTabKeydown,
    openModal, closeModal, openInfoModalWithDetails,
    toggleDailyNote,
    showTrackerTooltip, hideTrackerTooltip, handleTrackerTooltipShow, handleTrackerTooltipHide,
    showLoading, showToast, updateTabsOverflowIndicator
} from './uiHandlers.js';
import { populateUI } from './populateUI.js';
// КОРЕКЦИЯ: Премахваме handleDelegatedClicks от импорта тук
import { setupStaticEventListeners, setupDynamicEventListeners } from './eventListeners.js';
import { handleLogout as performLogout } from './auth.js';
import {
    toggleChatWidget, closeChatWidget, displayMessage as displayChatMessage,
    displayTypingIndicator as displayChatTypingIndicator, scrollToChatBottom,
    setAutomatedChatPending
} from './chat.js';
import { openExtraMealModal } from './extraMealForm.js';
import { initializeAchievements } from './achievements.js';
import {
    openAdaptiveQuizModal as _openAdaptiveQuizModal,
    renderCurrentQuizQuestion,
    showQuizValidationMessage,
    hideQuizValidationMessage,
    getSummaryFromLastCompletedQuiz, // For potential use in app.js
    getSummaryFromPreviousQuizzes // For potential use in app.js
} from './adaptiveQuiz.js';

// ==========================================================================
// ГЛОБАЛНИ ПРОМЕНЛИВИ ЗА СЪСТОЯНИЕТО НА ПРИЛОЖЕНИЕТО
// ==========================================================================
export let currentUserId = null;
export let fullDashboardData = {};
let toastTimeoutApp; // Managed by app.js, uiHandlers.js has its own for its showToast
export let chatHistory = [];
export let todaysMealCompletionStatus = {}; // Updated by populateUI and eventListeners
export let activeTooltip = null; // Managed by uiHandlers via setActiveTooltip

// Управление на интервал за проверка на статус на плана
let planStatusInterval = null;
let planStatusTimeout = null;

// Променливи за адаптивния въпросник - управлявани от app.js
export let currentQuizData = null;
export let userQuizAnswers = {};
export let currentQuestionIndex = 0;

// Setters for quiz state, to be called from adaptiveQuiz.js or other modules
export function setCurrentQuizData(data) { currentQuizData = data; }
export function setUserQuizAnswers(answers) { userQuizAnswers = answers; }
export function setCurrentQuestionIndex(index) { currentQuestionIndex = index; }
export function setActiveTooltip(tooltip) { activeTooltip = tooltip; }

// Функция за нулиране на глобалното състояние при изход
export function resetAppState() {
    currentUserId = null;
    fullDashboardData = {};
    chatHistory = [];
    todaysMealCompletionStatus = {};
    activeTooltip = null;
    currentQuizData = null;
    userQuizAnswers = {};
    currentQuestionIndex = 0;
    // Не нулираме toastTimeoutApp, тъй като showToast управлява своя.
}

// Функция за създаване на тестови данни

function createTestData() {
    return {
        success: true,
        planStatus: "ready",
        userName: "Тестов Потребител",
        showAdaptiveQuiz: false,
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
function initializeApp() {
    try {
        if (isLocalDevelopment) console.log("initializeApp starting from app.js...");
        initializeSelectors();
        updateTabsOverflowIndicator();
        showLoading(true, "Инициализация на таблото...");
        currentUserId = sessionStorage.getItem('userId');

        if (!currentUserId && isLocalDevelopment) {
            console.log("Local development mode - creating test user");
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
        initializeTheme(); // from uiHandlers.js
        loadDashboardData();
        if (isLocalDevelopment) console.log("initializeApp finished successfully.");
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
// ЗАРЕЖДАНЕ И ОБРАБОТКА НА ДАННИ
// ==========================================================================
/**
 * Зарежда данни за таблото от бекенда и обновява интерфейса.
 * Използва се и от модула adaptiveQuiz.js след изпращане на тест.
 * @returns {Promise<void>}
 */
export async function loadDashboardData() { // Exported for adaptiveQuiz.js to call after submit
    if (isLocalDevelopment) console.log("loadDashboardData starting for user:", currentUserId);
    if (!currentUserId) {
         showPlanPendingState("Грешка: Потребителска сесия не е намерена. Моля, <a href='index.html' style='color: var(--primary-color); text-decoration: underline;'>влезте отново</a>.");
         showLoading(false);
         return;
    }
    showLoading(true, "Зареждане на вашето персонализирано табло...");
    Object.keys(todaysMealCompletionStatus).forEach(key => delete todaysMealCompletionStatus[key]); // Clear previous

    try {
        if (currentUserId.includes('test_user') || window.location.hostname.includes('replit')) {
            const data = createTestData();
            if (isLocalDevelopment) console.log("Using test data for development:", data);
            fullDashboardData = data;
            chatHistory = []; // Reset chat history for test user on reload

            if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
            if(selectors.appWrapper) selectors.appWrapper.style.display = 'block';

            populateUI();
            initializeAchievements(currentUserId);
            setupDynamicEventListeners();

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
        if (isLocalDevelopment) {
            console.log('Received planData', data.planData);
        }
        if (!data.success) throw new Error(data.message || 'Неуспешно зареждане на данни от сървъра.');

        if (isLocalDevelopment) console.log("Data received from worker:", data);
        fullDashboardData = data;
        // chatHistory = []; // Do not reset chat history on normal data load, only for test user or logout

        if (data.planStatus === "pending" || data.planStatus === "processing") {
            showPlanPendingState(); return;
        }
        if (data.planStatus === "error") {
            showPlanPendingState(`Възникна грешка при генерирането на вашия план: ${data.message || 'Свържете се с поддръжка.'}`); return;
        }

        if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
        if(selectors.appWrapper) selectors.appWrapper.style.display = 'block';

        const welcomeSeenKey = `welcomeScreenSeen_${currentUserId}`;
        if (data.planStatus === "ready" && data.isFirstLoginWithReadyPlan && !localStorage.getItem(welcomeSeenKey)) {
            localStorage.setItem(welcomeSeenKey, 'true');
            openModal('welcomeScreenModal');
        }

        if (data.aiUpdateSummary) {
            const { title, introduction, changes, encouragement } = data.aiUpdateSummary;
            if (selectors.aiUpdateModalTitle) selectors.aiUpdateModalTitle.textContent = title || '📣 Информация за Актуализация';
            let summaryHtml = '';
            if (introduction) summaryHtml += `<p>${introduction.replace(/\n/g, '<br>')}</p>`;
            if (changes && Array.isArray(changes) && changes.length > 0) {
                summaryHtml += `<ul>${changes.map(ch => `<li>${String(ch).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
            }
            if (encouragement) summaryHtml += `<p>${encouragement.replace(/\n/g, '<br>')}</p>`;

            if (selectors.aiUpdateModalBody) selectors.aiUpdateModalBody.innerHTML = summaryHtml;
            openModal('aiUpdateNotificationModal');
            fetch(apiEndpoints.acknowledgeAiUpdate, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({userId: currentUserId})
            }).catch(err => console.warn('Failed to acknowledge AI update:', err));
        }

        if (data.triggerAutomatedFeedbackChat) {
            setAutomatedChatPending(true);
            if (selectors.chatFab) selectors.chatFab.classList.add('notification');
        }

        populateUI();

        const plan = fullDashboardData.planData;
        const hasRecs = planHasRecContent(plan);
        if (!hasRecs) {
            showToast("Препоръките не са налични.", true);
        }

        initializeAchievements(currentUserId);
        setupDynamicEventListeners();

        const activeTabId = sessionStorage.getItem('activeTabId') || selectors.tabButtons[0]?.id;
        const activeTabButton = activeTabId ? document.getElementById(activeTabId) : (selectors.tabButtons && selectors.tabButtons[0]);

        if (activeTabButton && Array.from(selectors.tabButtons).includes(activeTabButton)) {
            activateTab(activeTabButton);
        } else if (selectors.tabButtons && selectors.tabButtons.length > 0) {
            activateTab(selectors.tabButtons[0]);
        }

        if (fullDashboardData.showAdaptiveQuiz === true) {
            _openAdaptiveQuizModal(); // From adaptiveQuiz.js
        }

        showToast("Данните са заредени успешно.", false, 2000);
    } catch (error) {
        console.error("Error loading/processing dashboard data:", error);
        showToast(`Грешка при зареждане: ${error.message}`, true, 7000);
        showPlanPendingState(`Възникна грешка: ${error.message}. Опитайте да презаредите страницата или <a href='index.html' style='color: var(--primary-color); text-decoration: underline;'>влезте отново</a>.`);
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
             if (pElements.length > 0) pElements[0].textContent = "Благодарим ви за попълнения въпросник! Вашият персонализиран план MyBody.Best се генерира.";
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
}

export function pollPlanStatus(intervalMs = 30000, maxDurationMs = 300000) {
    if (!currentUserId) return;
    stopPlanStatusPolling();
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
                    await loadDashboardData();
                    showToast('Планът е обновен.', false, 4000);
                } else if (data.planStatus === 'error') {
                    stopPlanStatusPolling();
                    if (selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
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
export async function handleSaveLog() { // Exported for eventListeners.js
    const logPayload = { userId: currentUserId, date: new Date().toISOString().split('T')[0], data: {} };
    const weightInputElement = document.getElementById('dailyLogWeightInput');

    if (weightInputElement) {
        const weightValueStr = weightInputElement.value;
        if (weightValueStr && weightValueStr.trim() !== '') {
            const weightValue = safeParseFloat(weightValueStr);
            if (weightValue !== null && !isNaN(weightValue) && weightValue >= 20 && weightValue <= 300) {
                logPayload.data.weight = weightValue;
            } else {
                showToast("Моля, въведете валидно тегло (число между 20 и 300), ако желаете да го запишете.", true, 4000);
            }
        }
    } else {
        console.warn("Weight input element ('dailyLogWeightInput') not found in log. Skipping weight save.");
    }

    logPayload.data.note = selectors.dailyNote?.value.trim() || "";
    logPayload.data.completedMealsStatus = { ...todaysMealCompletionStatus };
    selectors.dailyTracker?.querySelectorAll('.metric-rating:not(.daily-log-weight-metric) input[type="hidden"]').forEach(input => {
        logPayload.data[input.id.replace('-rating-input', '')] = parseInt(input.value);
    });

    let hasDataToSave = !!logPayload.data.note ||
                        Object.keys(logPayload.data.completedMealsStatus).length > 0 ||
                        logPayload.data.weight !== undefined;

    if(!hasDataToSave) {
        for(const key in logPayload.data) {
            if(key!=='note' && key!=='completedMealsStatus' && key!=='weight' &&
               logPayload.data[key]!==null && logPayload.data[key]!==undefined) {
                hasDataToSave=true;
                break;
            }
        }
    }

    if (!hasDataToSave) { showToast("Няма нови данни за запис.", false, 2000); return; }

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
        populateUI();
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

    if (isLocalDevelopment) console.log("Feedback to send:", feedbackData);
    showLoading(true, "Изпращане на обратна връзка...");
    setTimeout(() => {
        showLoading(false);
        showToast("Благодарим за обратната връзка!", false);
        closeModal('feedbackModal');
        selectors.feedbackForm.reset();
    }, 1500);
}


// ==========================================================================
// АДАПТИВЕН ВЪПРОСНИК - ЛОГИКА И API КОМУНИКАЦИЯ (Остават в app.js)
// ==========================================================================

export async function _generateAdaptiveQuizClientSide(userId, context = {}) { // Prefixed to avoid clash if adaptiveQuiz.js also defines it
    if (isLocalDevelopment) console.log("generateAdaptiveQuizClientSide (app.js) called for user:", userId, "with context:", context);
    if (!userId) throw new Error("Липсва потребителско ID за генериране на въпросник.");

    if (userId.includes('test_user') || window.location.hostname.includes('replit')) {
        if (isLocalDevelopment) console.log("Generating test quiz data (app.js)");
        return {
            quizId: 'test_quiz_' + Date.now(),
            quizTitle: "Тестов Въпросник от App.js",
            quizDescription: "Това е тестов въпросник за разработка от App.js",
            questions: [
                { id: "q1_app", text: "Как се чувствате днес (App)?", answerType: "скала_1_5", required: true, options: { min: 1, max: 5, minLabel: "Зле", maxLabel: "Отлично" }},
                { id: "q2_app", text: "Колко чаши вода пихте вчера (App)?", answerType: "number", required: true, placeholder: "Въведете брой чаши" },
                { id: "q3_app", text: "Какви са главните ви предизвикателства (App)?", answerType: "еднозначен_избор_от_списък", required: false, options: ["Време", "Мотивация", "Знания", "Активност"] }
            ]
        };
    }

    try {
        let queryString = `userId=${userId}`;
        if (context.trigger) queryString += `&trigger=${encodeURIComponent(context.trigger)}`;
        if (context.specificFocus) queryString += `&focus=${encodeURIComponent(context.specificFocus)}`;
        const response = await fetch(`${apiEndpoints.getAdaptiveQuiz}?${queryString}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Сървърна грешка: ${response.status}` }));
            throw new Error(errorData.message || `Грешка от сървъра: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success || !result.showQuiz || !result.quizData) {
            throw new Error(result.message || "Неуспешно зареждане или генериране на въпросник от сървъра.");
        }
        if (isLocalDevelopment) console.log("Quiz data received from worker (app.js):", result.quizData);
        return result.quizData;
    } catch (error) {
        console.error("Error in generateAdaptiveQuizClientSide (app.js):", error);
        throw error;
    }
}

export async function _submitAdaptiveQuizClientSide(userId, quizId, submittedAnswers) { // Prefixed
    if (isLocalDevelopment) console.log("submitAdaptiveQuizClientSide (app.js) called for quiz:", quizId, "answers:", submittedAnswers);
    if (!userId || !quizId || !submittedAnswers) {
        throw new Error("Липсват необходими данни за подаване на въпросника.");
    }

    if (userId.includes('test_user') || window.location.hostname.includes('replit')) {
        if (isLocalDevelopment) console.log("Simulating quiz analysis for test user (app.js)");
        return {
            success: true,
            message: "Тестовият въпросник (App.js) беше подаден успешно!",
            aiUpdateSummary: { title: "Анализ (App.js) завършен", introduction: "Благодарим за отговорите!", changes: ["Актуализиран план според вашите нужди"], encouragement: "Продължавайте силната работа!" }
        };
    }

    const payload = { userId: userId, quizId: quizId, answers: submittedAnswers };
    try {
        const response = await fetch(apiEndpoints.submitAdaptiveQuiz, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Сървърна грешка при подаване: ${response.status}` }));
            throw new Error(errorData.message || `Грешка от сървъра при подаване на отговорите: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || "Неуспешна обработка на отговорите от сървъра.");
        }
        if (isLocalDevelopment) console.log("Quiz submit result from worker (app.js):", result);
        return result;
    } catch (error) {
        console.error("Error in submitAdaptiveQuizClientSide (app.js):", error);
        throw error;
    }
}

// Event handlers for quiz navigation, to be attached in eventListeners.js
export function _handlePrevQuizQuestion() {
    if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
        renderCurrentQuizQuestion(false); // from adaptiveQuiz.js
    }
}

export function _handleNextQuizQuestion() {
    const currentQ = currentQuizData.questions[currentQuestionIndex];
    if (currentQ.required) {
        const answer = userQuizAnswers[currentQ.id];
        let isEmpty = false;
        if (Array.isArray(answer)) { isEmpty = answer.length === 0; }
        else { isEmpty = (answer === null || String(answer).trim() === ''); }

        if (isEmpty) {
            showQuizValidationMessage('Моля, отговорете на този въпрос, преди да продължите.'); // from adaptiveQuiz.js
            const currentCard = selectors.quizQuestionContainer.querySelector('.aq-question-card-hybrid');
            const inputAreaInCard = currentCard?.querySelector('.question-input-area');
            const firstInputInArea = inputAreaInCard?.querySelector('input:not([type="hidden"]), textarea, .rating-square[tabindex="0"], select');
            if (firstInputInArea) firstInputInArea.focus();
            return;
        }
    }
    hideQuizValidationMessage(); // from adaptiveQuiz.js
    if (currentQuestionIndex < currentQuizData.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        renderCurrentQuizQuestion(true); // from adaptiveQuiz.js
    }
}

export async function _handleSubmitQuizAnswersClientSide() {
    for (let i = 0; i < currentQuizData.questions.length; i++) {
        const q = currentQuizData.questions[i];
        if (q.required) {
            const answer = userQuizAnswers[q.id];
            let isEmpty = false;
            if (Array.isArray(answer)) { isEmpty = answer.length === 0; }
            else { isEmpty = (answer === null || String(answer).trim() === ''); }
            if (isEmpty) {
                showToast(`Моля, отговорете на всички задължителни въпроси. Въпрос "${q.text.substring(0,30)}..." е пропуснат.`, true, 4000);
                setCurrentQuestionIndex(i);
                renderCurrentQuizQuestion(true); // from adaptiveQuiz.js
                return;
            }
        }
    }

    showLoading(true, "Обработка на вашите отговори...");
    try {
        await _submitAdaptiveQuizClientSide(currentUserId, currentQuizData.quizId, userQuizAnswers);
        showToast("Въпросникът е успешно подаден!", false, 2000);

        setTimeout(() => {
            if (selectors.adaptiveQuizModal) {
                closeModal('adaptiveQuizWrapper');
            }
        }, 1500);

        showPlanPendingState();
        pollPlanStatus();

        setCurrentQuizData(null);
        setUserQuizAnswers({});
        setCurrentQuestionIndex(0);
    } catch (error) {
        console.error("Error submitting quiz answers:", error);
        showToast(`Грешка при подаване на въпросника: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}

export async function _handleTriggerAdaptiveQuizClientSide() { // Exported for eventListeners.js
    if (!currentUserId) { showToast("Моля, влезте първо.", true); return; }
    _openAdaptiveQuizModal(); // from adaptiveQuiz.js
}

// ==========================================================================
// ЧАТ ФУНКЦИИ (API комуникация и управление на историята)
// ==========================================================================
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
        const response = await fetch(apiEndpoints.chat, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

        let botReply = result.reply || '';
        const sig = '[PLAN_MODIFICATION_REQUEST]';
        const sigIdx = botReply.indexOf(sig);
        if (sigIdx !== -1) {
            botReply = botReply.substring(0, sigIdx).trim();
            pollPlanStatus();
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
export function handleChatInputKeypress(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleChatSend();}} // Exported for eventListeners

// ==========================================================================
// СТАРТ НА ПРИЛОЖЕНИЕТО
// ==========================================================================
document.addEventListener('DOMContentLoaded', initializeApp);
