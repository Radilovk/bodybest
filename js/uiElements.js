// uiElements.js - Селектори и UI текстове
import { showLoading } from './uiHandlers.js'; // Needed for error in initializeSelectors

export const selectors = {};

export function initializeSelectors() {
    const selDefs = {
        appWrapper: 'appWrapper', loadingOverlay: 'loadingOverlay', loadingOverlayText: 'loadingOverlayText', planPendingState: 'planPendingState',
        headerTitle: 'headerTitle', menuToggle: 'menu-toggle', mainMenu: 'main-menu', menuClose: 'main-menu .menu-close',
        menuOverlay: 'menu-overlay',
        themeToggleMenu: 'theme-toggle-menu', logoutButton: 'logoutButton', menuContactLink: 'menu-contact-link', menuPersonalizationLink: 'menu-personalization-link', menuFeedbackBtn: 'menu-feedback-btn',
        tabsContainer: '.tabs[role="tablist"]', tabButtons: '.tabs button[role="tab"]',
        goalProgressBar: 'goalProgressBar', goalProgressFill: 'goalProgressFill', goalProgressText: 'goalProgressText',
        engagementProgressBar: 'engagementProgressBar', engagementProgressFill: 'engagementProgressFill', engagementProgressText: 'engagementProgressText',
        healthProgressBar: 'healthProgressBar', healthProgressFill: 'healthProgressFill', healthProgressText: 'healthProgressText',
        goalCard: 'goalCard', engagementCard: 'engagementCard', healthCard: 'healthCard', streakCard: 'streakCard',
        detailedAnalyticsAccordion: 'detailedAnalyticsAccordion', detailedAnalyticsContent: 'detailedAnalyticsContent',
        dashboardTextualAnalysis: 'dashboardTextualAnalysis',
        dailyPlanTitle: 'dailyPlanTitle', dailyMealList: 'dailyMealList',
        dailyTracker: 'dailyTracker', addNoteBtn: 'add-note-btn', dailyNote: 'daily-note', saveLogBtn: 'saveLogBtn', dailyLogDate: 'dailyLogDate',
        openExtraMealModalBtn: 'openExtraMealModalBtn',
        profilePersonalData: 'profilePersonalData', profileGoals: 'profileGoals', profileConsiderations: 'profileConsiderations',
        weeklyPlanTbody: 'weeklyPlanTbody', additionalGuidelines: 'additionalGuidelines',
        recFoodAllowedContent: 'recFoodAllowedContent', recFoodLimitContent: 'recFoodLimitContent', userAllergiesNote: 'userAllergiesNote',
        userAllergiesList: 'userAllergiesList', recHydrationContent: 'recHydrationContent', recCookingMethodsContent: 'recCookingMethodsContent',
        recStrategiesContent: 'recStrategiesContent', recSupplementsContent: 'recSupplementsContent',
        recFoodAllowedCard: 'recFoodAllowedCard', recFoodLimitCard: 'recFoodLimitCard',
        recHydrationCard: 'recHydrationCard', recCookingMethodsCard: 'recCookingMethodsCard', recSupplementsCard: 'recSupplementsCard',
        welcomeScreenModal: 'welcomeScreenModal',
        instructionsModal: 'instructionsModal',
        showIntroVideoBtn: 'showIntroVideoBtn',
        extraMealEntryModal: 'extraMealEntryModal', extraMealFormContainer: 'extraMealFormContainer',
        adaptiveQuizModal: 'adaptiveQuizWrapper',
        adaptiveQuizContainer: 'adaptiveQuizWrapper',
        planModificationBtn: 'planModificationBtn',
        planModInProgressIcon: 'planModInProgressIcon',
        planModChatModal: 'planModChatModal',
        planModChatMessages: 'planModChatMessages',
        planModChatInput: 'planModChatInput',
        planModChatSend: 'planModChatSend',
        planModChatClose: 'planModChatClose',
        planModChatClear: 'planModChatClear',
        infoModal: 'infoModal', infoModalTitle: 'infoModalTitle', infoModalBody: 'infoModalBody',
        feedbackModal: 'feedbackModal',
        feedbackForm: 'feedbackForm',
        progressHistoryCard: 'progressHistoryCard',
        streakGrid: 'streakGrid',
        streakCount: 'streakCount',
        achievementShareBtn: 'achievementShareBtn',
        analyticsCardsContainer: 'analyticsCardsContainer',
        tooltipTracker: 'tooltip-tracker',
        toast: 'toast', chatFab: 'chat-fab', chatWidget: 'chat-widget', chatClose: 'chat-close',
        chatClear: 'chat-clear',
        chatMessages: 'chat-messages', chatInput: 'chat-input', chatSend: 'chat-send',
        chatImageInput: 'chat-image', chatUploadBtn: 'chat-upload'
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
                'feedbackForm', 'tooltipTracker', 'planModificationBtn', 'planModInProgressIcon',
                'planModChatModal', 'planModChatMessages', 'planModChatInput',
                'planModChatSend', 'planModChatClose', 'planModChatClear',
                'streakGrid', 'streakCount', 'analyticsCardsContainer', 'achievementShareBtn',
                'goalCard', 'engagementCard', 'healthCard', 'streakCard',
                'recFoodAllowedCard', 'recFoodLimitCard', 'recHydrationCard',
                'recCookingMethodsCard', 'recSupplementsCard'
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

export let trackerInfoTexts = {};
export let detailedMetricInfoTexts = {};
export let mainIndexInfoTexts = {};

let textsLoaded = false;
let loadPromise;

export async function loadInfoTexts() {
    if (textsLoaded) return;
    if (!loadPromise) {
        loadPromise = Promise.all([
            fetch('data/trackerInfoTexts.json').then(r => r.json()),
            fetch('data/detailedMetricInfoTexts.json').then(r => r.json()),
            fetch('data/mainIndexInfoTexts.json').then(r => r.json())
        ])
            .then(([tracker, detailed, main]) => {
                trackerInfoTexts = tracker;
                detailedMetricInfoTexts = detailed;
                mainIndexInfoTexts = main;
                textsLoaded = true;
            })
            .catch(err => {
                console.error('Failed to load UI texts', err);
            });
    }
    return loadPromise;
}
