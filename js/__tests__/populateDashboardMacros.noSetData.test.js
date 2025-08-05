/** @jest-environment jsdom */
import { jest } from '@jest/globals';

afterEach(() => {
  jest.resetModules();
});

function setupMocks(selectors) {
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../utils.js', () => ({
    safeGet: () => {},
    safeParseFloat: () => {},
    capitalizeFirstLetter: () => {},
    escapeHtml: () => {},
    applyProgressFill: () => {},
    getCssVar: () => '',
    formatDateBgShort: () => ''
  }));
  jest.unstable_mockModule('../config.js', () => ({
    generateId: () => 'id',
    standaloneMacroUrl: 'macroAnalyticsCardStandalone.html',
    apiEndpoints: { dashboard: '/api/dashboardData' }
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    todaysPlanMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    currentIntakeMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    planHasRecContent: false,
    loadCurrentIntake: jest.fn(),
    currentUserId: 'u1',
    handleSaveLog: jest.fn(),
    handleFeedbackFormSubmit: jest.fn(),
    handleChatSend: jest.fn(),
    handleChatInputKeypress: jest.fn(),
    _handlePrevQuizQuestion: jest.fn(),
    _handleNextQuizQuestion: jest.fn(),
    _handleSubmitQuizAnswersClientSide: jest.fn(),
    _handleTriggerAdaptiveQuizClientSide: jest.fn(),
    activeTooltip: null,
    setChatModelOverride: jest.fn(),
    setChatPromptOverride: jest.fn(),
    recalculateCurrentIntakeMacros: jest.fn(),
    resetAppState: jest.fn(),
    stopPlanStatusPolling: jest.fn(),
    stopAdminQueriesPolling: jest.fn()
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    toggleMenu: jest.fn(),
    closeMenu: jest.fn(),
    handleOutsideMenuClick: jest.fn(),
    handleMenuKeydown: jest.fn(),
    toggleTheme: jest.fn(),
    activateTab: jest.fn(),
    handleTabKeydown: jest.fn(),
    closeModal: jest.fn(),
    openModal: jest.fn(),
    openInfoModalWithDetails: jest.fn(),
    toggleDailyNote: jest.fn(),
    openMainIndexInfo: jest.fn(),
    openInstructionsModal: jest.fn(),
    handleTrackerTooltipShow: jest.fn(),
    handleTrackerTooltipHide: jest.fn(),
    showToast: jest.fn(),
    showLoading: jest.fn()
  }));
  jest.unstable_mockModule('../auth.js', () => ({ handleLogout: jest.fn() }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    ensureMacroAnalyticsElement: jest.fn(() => {
      let el = document.querySelector('macro-analytics-card');
      if (!el) {
        el = document.createElement('macro-analytics-card');
        // липсва setData
        const container = document.getElementById('macroAnalyticsCardContainer');
        if (container) container.appendChild(el);
      }
      return el;
    }),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn()
  }));
}

test('логва предупреждение, когато macro-analytics-card не е зареден', async () => {
  document.body.innerHTML = `
    <div id="macroMetricsPreview"></div>
    <div id="analyticsCardsContainer"></div>
  `;
  const selectors = {
    macroMetricsPreview: document.getElementById('macroMetricsPreview'),
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: null,
  };
  setupMocks(selectors);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { populateDashboardMacros } = await import('../populateUI.js');
  await populateDashboardMacros({ calories: 1000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 });
  expect(warnSpy).toHaveBeenCalledWith('macro-analytics-card не е зареден');
  warnSpy.mockRestore();
});
