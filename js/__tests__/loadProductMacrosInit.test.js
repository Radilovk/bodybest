/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('initializeApp продължава при грешка в loadProductMacros', async () => {
  const loadProductMacros = jest.fn().mockRejectedValue(new Error('missing'));

  jest.unstable_mockModule('../macroUtils.js', () => ({ loadProductMacros, calculateCurrentMacros: jest.fn(), calculatePlanMacros: jest.fn(), calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0 })) }));
  jest.unstable_mockModule('../config.js', () => ({ isLocalDevelopment: false, apiEndpoints: {} }));
  jest.unstable_mockModule('../logger.js', () => ({ debugLog: jest.fn(), enableDebug: jest.fn() }));
  jest.unstable_mockModule('../utils.js', () => ({
    safeParseFloat: jest.fn(),
    escapeHtml: jest.fn(),
    fileToDataURL: jest.fn(),
    normalizeDailyLogs: jest.fn()
  }));
  const initializeSelectors = jest.fn();
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: { tabButtons: [] },
    initializeSelectors,
    loadInfoTexts: jest.fn()
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    initializeTheme: jest.fn(),
    loadAndApplyColors: jest.fn(),
    activateTab: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    showLoading: jest.fn(),
    showToast: jest.fn(),
    updateTabsOverflowIndicator: jest.fn()
  }));
  jest.unstable_mockModule('../populateUI.js', () => ({ populateUI: jest.fn(), populateProgressHistory: jest.fn(), populateDashboardMacros: jest.fn(), setMacroExceedThreshold: jest.fn() }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn()
  }));
  jest.unstable_mockModule('../chat.js', () => ({
    displayMessage: jest.fn(),
    displayTypingIndicator: jest.fn(),
    scrollToChatBottom: jest.fn(),
    setAutomatedChatPending: jest.fn()
  }));
  jest.unstable_mockModule('../achievements.js', () => ({ initializeAchievements: jest.fn() }));
  jest.unstable_mockModule('../planModChat.js', () => ({ openPlanModificationChat: jest.fn() }));

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  await import('../app.js');

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, planStatus: 'ready', planData: {}, dashboardData: {}, dailyLogs: [], planMenu: {}, progressHistory: [] })
  });

  sessionStorage.setItem('userId', '123');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 0));

  expect(loadProductMacros).toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalled();
  expect(initializeSelectors).toHaveBeenCalled();
});
