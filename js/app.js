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
    showLoading, showToast
} from './uiHandlers.js';
import { populateUI } from './populateUI.js';
// КОРЕКЦИЯ: Премахваме handleDelegatedClicks от импорта тук
import { setupStaticEventListeners, setupDynamicEventListeners } from './eventListeners.js';
import { handleLogout as performLogout } from './auth.js';
import { toggleChatWidget, closeChatWidget } from './chat.js';
import { loadDashboardData } from './dataLoader.js';
import { openExtraMealModal } from './extraMealForm.js';

// ==========================================================================
// ГЛОБАЛНИ ПРОМЕНЛИВИ ЗА СЪСТОЯНИЕТО НА ПРИЛОЖЕНИЕТО
// ==========================================================================
export let currentUserId = null;
export let fullDashboardData = {};
let toastTimeoutApp; // Managed by app.js, uiHandlers.js has its own for its showToast
export let chatHistory = [];
export let todaysMealCompletionStatus = {}; // Updated by populateUI and eventListeners
export let activeTooltip = null; // Managed by uiHandlers via setActiveTooltip

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



// ==========================================================================
// ИНИЦИАЛИЗАЦИЯ НА ПРИЛОЖЕНИЕТО
// ==========================================================================
function initializeApp() {
    try {
        console.log("initializeApp starting from app.js...");
        initializeSelectors();
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
        console.log("initializeApp finished successfully.");
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

    console.log("Feedback to send:", feedbackData);
    showLoading(true, "Изпращане на обратна връзка...");
    setTimeout(() => {
        showLoading(false);
        showToast("Благодарим за обратната връзка!", false);
        closeModal('feedbackModal');
        selectors.feedbackForm.reset();
    }, 1500);
}

// ==========================================================================
// СТАРТ НА ПРИЛОЖЕНИЕТО
// ==========================================================================
document.addEventListener('DOMContentLoaded', initializeApp);