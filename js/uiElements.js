// uiElements.js - Селектори и UI текстове
import { showLoading } from './uiHandlers.js'; // Needed for error in initializeSelectors

export const selectors = {};

export function initializeSelectors() {
    const selDefs = {
        appWrapper: 'appWrapper', loadingOverlay: 'loadingOverlay', loadingOverlayText: 'loadingOverlayText', planPendingState: 'planPendingState',
        headerTitle: 'headerTitle', menuToggle: 'menu-toggle', mainMenu: 'main-menu', menuClose: 'main-menu .menu-close',
        menuOverlay: 'menu-overlay',
        themeToggleMenu: 'theme-toggle-menu', logoutButton: 'logoutButton', menuContactLink: 'menu-contact-link', menuPersonalizationLink: 'menu-personalization-link',
        tabsContainer: '.tabs[role="tablist"]', tabButtons: '.tabs button[role="tab"]',
        goalProgressBar: 'goalProgressBar', goalProgressMask: 'goalProgressMask', goalProgressText: 'goalProgressText',
        engagementProgressBar: 'engagementProgressBar', engagementProgressMask: 'engagementProgressMask', engagementProgressText: 'engagementProgressText',
        healthProgressBar: 'healthProgressBar', healthProgressMask: 'healthProgressMask', healthProgressText: 'healthProgressText',
        goalCard: 'goalCard', engagementCard: 'engagementCard', healthCard: 'healthCard', streakCard: 'streakCard',
        detailedAnalyticsAccordion: 'detailedAnalyticsAccordion', detailedAnalyticsContent: 'detailedAnalyticsContent',
        dashboardTextualAnalysis: 'dashboardTextualAnalysis',
        dailyPlanTitle: 'dailyPlanTitle', dailyMealList: 'dailyMealList',
        dailyTracker: 'dailyTracker', addNoteBtn: 'add-note-btn', dailyNote: 'daily-note', saveLogBtn: 'saveLogBtn', dailyLogDate: 'dailyLogDate',
        openExtraMealModalBtn: 'openExtraMealModalBtn',
        profilePersonalData: 'profilePersonalData', profileGoals: 'profileGoals', profileConsiderations: 'profileConsiderations',
        weeklyPlanTbody: 'weeklyPlanTbody', weeklyPrinciplesFocus: 'weeklyPrinciplesFocus',
        recFoodAllowedContent: 'recFoodAllowedContent', recFoodLimitContent: 'recFoodLimitContent', userAllergiesNote: 'userAllergiesNote',
        userAllergiesList: 'userAllergiesList', recHydrationContent: 'recHydrationContent', recCookingMethodsContent: 'recCookingMethodsContent',
        recStrategiesContent: 'recStrategiesContent', recSupplementsContent: 'recSupplementsContent',
        welcomeScreenModal: 'welcomeScreenModal', extraMealEntryModal: 'extraMealEntryModal', extraMealFormContainer: 'extraMealFormContainer',
        adaptiveQuizModal: 'adaptiveQuizWrapper',
        adaptiveQuizContainer: 'adaptiveQuizWrapper',
        triggerAdaptiveQuizBtn: 'triggerAdaptiveQuizBtn',
        infoModal: 'infoModal', infoModalTitle: 'infoModalTitle', infoModalBody: 'infoModalBody',
        feedbackModal: 'feedbackModal',
        feedbackFab: 'feedback-fab',
        feedbackForm: 'feedbackForm',
        progressHistoryCard: 'progressHistoryCard',
        streakGrid: 'streakGrid',
        streakCount: 'streakCount',
        analyticsCardsContainer: 'analyticsCardsContainer',
        tooltipTracker: 'tooltip-tracker',
        toast: 'toast', chatFab: 'chat-fab', chatWidget: 'chat-widget', chatClose: 'chat-close',
        chatMessages: 'chat-messages', chatInput: 'chat-input', chatSend: 'chat-send'
    };
    let missingCriticalCount = 0;
    const criticalSelectors = ['appWrapper', 'loadingOverlay', 'tabsContainer', 'dailyTracker', 'mainMenu', 'dailyMealList', 'saveLogBtn'];

    for (const key in selDefs) {
        const selectorValue = selDefs[key];
        if (selectorValue.startsWith('.') || selectorValue.includes(' ') || selectorValue.includes('[')) {
            if (key === 'tabButtons') selectors[key] = document.querySelectorAll(selectorValue);
            else selectors[key] = document.querySelector(selectorValue);
        } else {
            selectors[key] = document.getElementById(selectorValue);
        }
        if (!selectors[key] || (key === 'tabButtons' && selectors[key].length === 0)) {
            const optionalOrDynamic = [
                'menuClose', 'extraMealFormContainer', 'userAllergiesNote', 'userAllergiesList',
                'feedbackForm', 'tooltipTracker', 'triggerAdaptiveQuizBtn',
                'streakGrid', 'streakCount', 'analyticsCardsContainer',
                'goalCard', 'engagementCard', 'healthCard', 'streakCard'
            ];
            if (!optionalOrDynamic.includes(key) && key !== 'adaptiveQuizModal' && key !== 'adaptiveQuizContainer') {
                console.warn(`HTML element not found: ${key} (selector: '${selectorValue}')`);
                if (criticalSelectors.includes(key)) {
                    missingCriticalCount++;
                    console.error(`CRITICAL SELECTOR MISSING: ${key}`);
                }
            }
        }
    }

    if (selectors.adaptiveQuizContainer) {
        selectors.quizLoadingIndicator = selectors.adaptiveQuizContainer.querySelector('#quizLoadingIndicator');
        selectors.quizErrorState = selectors.adaptiveQuizContainer.querySelector('#quizErrorState');
        selectors.quizQuestionContainer = selectors.adaptiveQuizContainer.querySelector('#quizQuestionContainer');
        selectors.quizNavigation = selectors.adaptiveQuizContainer.querySelector('.aq-navigation-hybrid');
        if (selectors.quizNavigation) {
            selectors.prevQuestionBtn = selectors.quizNavigation.querySelector('#prevQuestionBtn');
            selectors.nextQuestionBtn = selectors.quizNavigation.querySelector('#nextQuestionBtn');
            selectors.submitQuizBtn = selectors.quizNavigation.querySelector('#submitQuizBtn');
        }
        const headerElement = selectors.adaptiveQuizContainer.querySelector('.aq-header-hybrid');
        if (headerElement) {
            selectors.adaptiveQuizGeneralTitle = headerElement.querySelector('#adaptiveQuizGeneralTitle');
            selectors.adaptiveQuizGeneralDescription = headerElement.querySelector('#adaptiveQuizGeneralDescription');
            selectors.quizProgressBar = headerElement.querySelector('#quizProgressBar');
        }
        selectors.questionTemplate = selectors.adaptiveQuizContainer.querySelector('#questionTemplate');
    } else {
        console.warn("Основният контейнер за адаптивния въпросник ('adaptiveQuizWrapper') не е намерен. Специфичните селектори за въпросника няма да бъдат инициализирани.");
    }

    if (missingCriticalCount > 0) {
         const errorMsg = `CRITICAL ERROR: ${missingCriticalCount} essential HTML element(s) are missing. Functionality will be severely impaired. Please check your HTML structure.`;
         console.error(errorMsg);
         if(selectors.loadingOverlayText) selectors.loadingOverlayText.textContent = "Критична грешка в структурата на страницата. Моля, свържете се с поддръжка.";
         if(selectors.appWrapper) selectors.appWrapper.style.display = 'none';
         if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
         if(selectors.loadingOverlay && !selectors.loadingOverlay.classList.contains('hidden')) { /* Keep loading overlay visible with error */ }
         else if (selectors.loadingOverlay) { showLoading(true, "Критична грешка в структурата!"); } // showLoading is from uiHandlers.js
         throw new Error(errorMsg);
    }
    if (selectors.mainMenu) selectors.menuClose = selectors.mainMenu.querySelector('.menu-close');
}

export const trackerInfoTexts = {
    weight: {
        general: "Текущо тегло (кг):\nВъведете вашето тегло за деня. Редовното следене помага за оценка на напредъка."
    },
    mood: {
        general: "Настроение (1-5):\nОценете вашето общо настроение за деня.",
        levels: { 1: "1: Тъжно/Депресирано", 2: "2: Не много добре", 3: "3: Неутрално", 4: "4: Добре/Позитивно", 5: "5: Щастливо/Отлично" }
    },
    energy: {
        general: "Енергия (1-5):\nОценете вашето общо ниво на енергия.",
        levels: { 1: "1: Много ниска/Изтощен", 2: "2: По-ниска от обичайното", 3: "3: Средна/Нормална", 4: "4: По-висока от обичайното", 5: "5: Много висока/Енергичен" }
    },
    calmness: {
        general: "Спокойствие (1-5):\nОценете вашето ниво на спокойствие/стрес.",
        levels: { 1: "1: Много стресиран/Напрегнат", 2: "2: Умерен стрес", 3: "3: Неутрално/Нормално", 4: "4: Сравнително спокоен", 5: "5: Много спокоен/Релаксиран" }
    },
    hydration: {
        general: "Хидратация (субективно, 1-5):\nОценете колко добре се чувствате хидратирани.",
        levels: { 1: "1: Много жаден/Дехидратиран", 2: "2: Леко жаден", 3: "3: Нормално", 4: "4: Добре хидратиран", 5: "5: Отлично хидратиран" }
    },
    sleep: {
        general: "Качество на съня (нощен, 1-5):\nОценете качеството на вашия сън от изминалата нощ.",
        levels: { 1: "1: Много лошо/Не спах", 2: "2: Лошо/Накъсано", 3: "3: Средно/Задоволително", 4: "4: Добро/Сравнително добре", 5: "5: Отлично/Освежаващо" }
    }
};

export const detailedMetricInfoTexts = {
    sleep_quality_info: "Този показател отразява колко добре сте спали, като се взимат предвид часове сън, прекъсвания и субективно усещане за отпочиналост. Качественият сън е ключов за възстановяването и хормоналния баланс.",
    stress_level_info: "Показва нивото на възприеман стрес и напрежение. Хроничният стрес може да повлияе негативно на здравето и придържането към програмата.",
    energy_level_info: "Отразява общото ви усещане за енергия и жизненост през деня. Свързан е с храненето, съня и физическата активност.",
    hydration_status_info: "Показва колко добре сте хидратирани. Адекватната хидратация е важна за всички телесни функции.",
    bmi_info: "Индексът на телесна маса (BMI) е съотношение между тегло и ръст, което дава обща представа за телесната композиция. Не е перфектен измерител, но е добър ориентир.",
    meal_adherence_info: "Процентът на спазени планирани хранения. Високата стойност показва добро придържане към хранителната част на програмата.",
    log_consistency_info: "Колко редовно попълвате своя дневен лог. Редовното водене на дневник помага за осъзнатост и проследяване на напредъка.",
    emotional_eating_control_info: "Отчита способността ви да управлявате храненето, породено от емоции, а не от физически глад. Развиването на този контрол е важно за дългосрочен успех."
};

export const mainIndexInfoTexts = {
    goalProgress: { title: "Напредък към Цел", text: "Индикаторът показва колко сте близо до зададената цел." },
    engagement: { title: "Ангажираност", text: "Отразява колко редовно използвате програмата и попълвате дневника." },
    overallHealth: { title: "Общо Здраве", text: "Комбинирана оценка на ключови показатели като сън, стрес и хранене." },
    successes: { title: "Моите успехи", text: "Показва поредицата от дни и събрани постижения." }
};
