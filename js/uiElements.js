// uiElements.js - Селектори и UI текстове
import { showLoading } from './loading.js'; // Needed for error in initializeSelectors

export const selectors = {};

export function initializeSelectors() {
    const selDefs = {
        appWrapper: 'appWrapper', loadingOverlay: 'loadingOverlay', loadingOverlayText: 'loadingOverlayText', planPendingState: 'planPendingState',
        headerTitle: 'headerTitle', menuToggle: 'menu-toggle', mainMenu: 'main-menu', menuClose: 'main-menu .menu-close',
        menuOverlay: 'menu-overlay',
        themeToggleMenu: 'theme-toggle-menu', logoutButton: 'logoutButton', menuContactLink: 'menu-contact-link', menuFeedbackBtn: 'menu-feedback-btn',
        tabsContainer: '.tabs[role="tablist"]', tabButtons: '.tabs button[role="tab"]',
        goalName: 'goalName', goalProgressBar: 'goalProgressBar', goalProgressFill: 'goalProgressFill', goalProgressText: 'goalProgressText',
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
        planModInProgressIcon: 'planModInProgressIcon',
        planModificationBtn: 'planModificationBtn',
        planModChatModal: 'planModChatModal',
        planModChatMessages: 'planModChatMessages',
        planModChatInput: 'planModChatInput',
        planModChatSend: 'planModChatSend',
        planModChatClose: 'planModChatClose',
        planModChatClear: 'planModChatClear',
        planModChatTitle: 'planModChatTitle',
        planModChatClient: 'planModChatClient',
        infoModal: 'infoModal', infoModalTitle: 'infoModalTitle', infoModalBody: 'infoModalBody',
        feedbackModal: 'feedbackModal',
        feedbackForm: 'feedbackForm',
        progressHistoryCard: 'progressHistoryCard',
        streakGrid: 'streakGrid',
        achievementShareBtn: 'achievementShareBtn',
        analyticsCardsContainer: 'analyticsCardsContainer',
        macroAnalyticsCardContainer: 'macroAnalyticsCardContainer',
        macroMetricsGrid: 'macroMetricsGrid',
        macroMetricsPreview: 'macroMetricsPreview',
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
                'feedbackForm', 'tooltipTracker', 'planModInProgressIcon',
                'planModificationBtn',
                'planModChatModal', 'planModChatMessages', 'planModChatInput',
                'planModChatSend', 'planModChatClose', 'planModChatClear',
                'planModChatTitle', 'planModChatClient',
                'streakGrid', 'analyticsCardsContainer', 'achievementShareBtn',
                'goalCard', 'engagementCard', 'healthCard', 'streakCard',
                'macroAnalyticsCardContainer', 'macroMetricsGrid',
                'macroMetricsPreview',
                'recFoodAllowedCard', 'recFoodLimitCard', 'recHydrationCard',
                'recCookingMethodsCard', 'recSupplementsCard',
                'headerTitle' // No longer used, previously removed from UI
            ];
            if (!optionalOrDynamic.includes(key)) {
                console.warn(`HTML element not found: ${key} (selector: '${selectorValue}')`);
                if (criticalSelectors.includes(key)) {
                    missingCriticalCount++;
                    console.error(`CRITICAL SELECTOR MISSING: ${key}`);
                }
            }
        }
    }

    // Адаптивният въпросник е премахнат, така че няма специални селектори

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

export function initializePlanModChatSelectors() {
    const ids = [
        'planModChatModal',
        'planModChatMessages',
        'planModChatInput',
        'planModChatSend',
        'planModChatClose',
        'planModChatClear'
    ];
    ids.forEach(id => {
        selectors[id] = document.getElementById(id);
    });
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
