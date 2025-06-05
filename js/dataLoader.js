// dataLoader.js - Зареждане и обработка на данни
import { isLocalDevelopment, apiEndpoints } from './config.js';
import { selectors } from './uiElements.js';
import { showLoading, showToast, openModal, activateTab } from './uiHandlers.js';
import { populateUI } from './populateUI.js';
import { setupDynamicEventListeners } from './eventListeners.js';
import { currentUserId, chatHistory, fullDashboardData, todaysMealCompletionStatus } from './app.js';
import { openAdaptiveQuizModal as _openAdaptiveQuizModal } from './adaptiveQuiz.js';

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
        planData: { week1Menu: { monday: [{ meal_name: "Закуска", items: [{ name: "Овесена каша", grams: "50г" }, { name: "Банан", grams: "1 бр." }] }] }},
        dailyLogs: [],
        currentStatus: { weight: 75.5 },
        initialData: { weight: 80.0, height: 175 },
        initialAnswers: { goal: "отслабване", age: "30", gender: "жена" }
    };
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
            if (pElements.length > 0) pElements[0].textContent = "Благодарим ви за попълнения въпросник! Вашият персонализиран план MyBody.Best се изготвя.";
            if (pElements.length > 1) pElements[1].textContent = "Моля, проверете отново по-късно. Ще бъдете уведомени (ако сте позволили известия) или опитайте да презаредите страницата след известно време.";
        }
    }
    showLoading(false);
}

export async function loadDashboardData() {
    console.log("loadDashboardData starting for user:", currentUserId);
    if (!currentUserId) {
         showPlanPendingState("Грешка: Потребителска сесия не е намерена. Моля, <a href='index.html' style='color: var(--primary-color); text-decoration: underline;'>влезте отново</a>.");
         showLoading(false);
         return;
    }
    showLoading(true, "Зареждане на вашето персонализирано табло...");
    Object.keys(todaysMealCompletionStatus).forEach(key => delete todaysMealCompletionStatus[key]);

    try {
        if (currentUserId.includes('test_user') || window.location.hostname.includes('replit')) {
            const data = createTestData();
            console.log("Using test data for development:", data);
            fullDashboardData = data;
            chatHistory = [];

            if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
            if(selectors.appWrapper) selectors.appWrapper.style.display = 'block';

            populateUI();
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
        if (!response.ok) throw new Error(`Грешка от сървъра: ${response.status} ${response.statusText}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Неуспешно зареждане на данни от сървъра.');

        console.log("Data received from worker:", data);
        fullDashboardData = data;

        if (data.planStatus === "pending" || data.planStatus === "processing") { showPlanPendingState(); return; }
        if (data.planStatus === "error") { showPlanPendingState(`Възникна грешка при генерирането на вашия план: ${data.message || 'Свържете се с поддръжка.'}`); return; }

        if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
        if(selectors.appWrapper) selectors.appWrapper.style.display = 'block';

        const welcomeSeenKey = `welcomeScreenSeen_${currentUserId}`;
        if (data.planStatus === "ready" && data.isFirstLoginWithReadyPlan && !localStorage.getItem(welcomeSeenKey)) {
            localStorage.setItem(welcomeSeenKey, 'true');
            openModal('welcomeScreenModal');
        }

        if (data.aiUpdateSummary) {
            const { title, introduction, changes, encouragement } = data.aiUpdateSummary;
            let summaryHtml = `<h3>${title || 'Важни Актуализации'}</h3>`;
            if (introduction) summaryHtml += `<p>${introduction.replace(/\n/g, '<br>')}</p>`;
            if (changes && Array.isArray(changes) && changes.length > 0) {
                summaryHtml += `<ul>${changes.map(ch => `<li>${String(ch).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
            }
            if (encouragement) summaryHtml += `<p>${encouragement.replace(/\n/g, '<br>')}</p>`;

            if (selectors.infoModalTitle) selectors.infoModalTitle.textContent = title || 'Информация';
            if (selectors.infoModalBody) selectors.infoModalBody.innerHTML = summaryHtml;
            openModal('infoModal');
            fetch(apiEndpoints.acknowledgeAiUpdate, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({userId: currentUserId})
            }).catch(err => console.warn("Failed to acknowledge AI update:", err));
        }

        populateUI();
        setupDynamicEventListeners();

        const activeTabId = sessionStorage.getItem('activeTabId') || selectors.tabButtons[0]?.id;
        const activeTabButton = activeTabId ? document.getElementById(activeTabId) : (selectors.tabButtons && selectors.tabButtons[0]);

        if (activeTabButton && Array.from(selectors.tabButtons).includes(activeTabButton)) {
            activateTab(activeTabButton);
        } else if (selectors.tabButtons && selectors.tabButtons.length > 0) {
            activateTab(selectors.tabButtons[0]);
        }

        if (fullDashboardData.showAdaptiveQuiz === true) {
            _openAdaptiveQuizModal();
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
