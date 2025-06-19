/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let setupStaticEventListeners;
let selectors;
let app;

beforeEach(async () => {
  jest.resetModules();

  selectors = {
    planModChatClose: document.createElement('button'),
    planModChatModal: document.createElement('div'),
    menuToggle: null,
    menuClose: null,
    menuOverlay: null,
    mainMenu: null,
    themeToggleMenu: null,
    logoutButton: null,
    tabsContainer: null,
    tabButtons: [],
    addNoteBtn: null,
    saveLogBtn: null,
    openExtraMealModalBtn: null,
    planModificationBtn: null,
    detailedAnalyticsAccordion: null,
    goalCard: null,
    engagementCard: null,
    healthCard: null,
    streakCard: null,
    dailyTracker: null,
    chatFab: null,
    chatClose: null,
    chatClear: null,
    chatSend: null,
    chatInput: null,
    planModChatClear: null,
    planModChatSend: null,
    planModChatInput: null,
    feedbackFab: null,
    feedbackForm: null,
    prevQuestionBtn: null,
    nextQuestionBtn: null,
    submitQuizBtn: null
  };
  selectors.planModChatModal.id = 'planModChatModal';
  selectors.planModChatModal.className = 'modal visible';

  document.body.innerHTML = '';
  document.body.appendChild(selectors.planModChatModal);
  document.body.appendChild(selectors.planModChatClose);

  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors,
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {},
    loadInfoTexts: jest.fn(() => Promise.resolve())
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    toggleMenu: jest.fn(),
    closeMenu: jest.fn(),
    handleOutsideMenuClick: jest.fn(),
    handleMenuKeydown: jest.fn(),
    initializeTheme: jest.fn(),
    toggleTheme: jest.fn(),
    activateTab: jest.fn(),
    handleTabKeydown: jest.fn(),
    closeModal: jest.fn(),
    openInfoModalWithDetails: jest.fn(),
    toggleDailyNote: jest.fn(),
    openMainIndexInfo: jest.fn(),
    updateTabsOverflowIndicator: jest.fn(),
    showTrackerTooltip: jest.fn(),
    hideTrackerTooltip: jest.fn(),
    handleTrackerTooltipShow: jest.fn(),
    handleTrackerTooltipHide: jest.fn(),
    showToast: jest.fn(),
    showLoading: jest.fn(),
    applyTheme: jest.fn(),
    updateThemeButtonText: jest.fn(),
    openModal: jest.fn()
  }));
  jest.unstable_mockModule('../auth.js', () => ({ handleLogout: jest.fn() }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../planModChat.js', () => ({
    openPlanModificationChat: jest.fn(),
    clearPlanModChat: jest.fn(),
    handlePlanModChatSend: jest.fn(),
    handlePlanModChatInputKeypress: jest.fn()
  }));
  jest.unstable_mockModule('../chat.js', () => ({
    toggleChatWidget: jest.fn(),
    closeChatWidget: jest.fn(),
    clearChat: jest.fn(),
    displayMessage: jest.fn(),
    displayTypingIndicator: jest.fn(),
    scrollToChatBottom: jest.fn(),
    setAutomatedChatPending: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({
    isLocalDevelopment: false,
    workerBaseUrl: '',
    apiEndpoints: {},
    cloudflareAccountId: 'c',
    generateId: jest.fn()
  }));
  jest.unstable_mockModule('../swipeUtils.js', () => ({ computeSwipeTargetIndex: jest.fn() }));
  jest.unstable_mockModule('../achievements.js', () => ({
    handleAchievementClick: jest.fn(),
    initializeAchievements: jest.fn()
  }));

  window.matchMedia = window.matchMedia || (() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }));

  app = await import('../app.js');
  ({ setupStaticEventListeners } = await import('../eventListeners.js'));

  app.setChatModelOverride('x');
  app.setChatPromptOverride('y');
  setupStaticEventListeners();
});

test('close button clears overrides', () => {
  selectors.planModChatClose.dispatchEvent(new Event('click'));
  expect(app.chatModelOverride).toBeNull();
  expect(app.chatPromptOverride).toBeNull();
});

test('escape key clears overrides', () => {
  app.setChatModelOverride('a');
  app.setChatPromptOverride('b');
  const evt = new KeyboardEvent('keydown', { key: 'Escape' });
  document.dispatchEvent(evt);
  expect(app.chatModelOverride).toBeNull();
  expect(app.chatPromptOverride).toBeNull();
});

test('overlay click clears overrides', () => {
  app.setChatModelOverride('m');
  app.setChatPromptOverride('p');
  selectors.planModChatModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(app.chatModelOverride).toBeNull();
  expect(app.chatPromptOverride).toBeNull();
});
