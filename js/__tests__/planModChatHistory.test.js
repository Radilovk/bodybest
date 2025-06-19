/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let clearPlanModChat, planModChatHistory;
let app;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = '<div id="planModChatMessages"></div>';
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    toggleMenu: jest.fn(),
    closeMenu: jest.fn(),
    handleOutsideMenuClick: jest.fn(),
    handleMenuKeydown: jest.fn(),
    initializeTheme: jest.fn(),
    applyTheme: jest.fn(),
    toggleTheme: jest.fn(),
    updateThemeButtonText: jest.fn(),
    activateTab: jest.fn(),
    handleTabKeydown: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    openInfoModalWithDetails: jest.fn(),
    openMainIndexInfo: jest.fn(),
    toggleDailyNote: jest.fn(),
    showTrackerTooltip: jest.fn(),
    hideTrackerTooltip: jest.fn(),
    handleTrackerTooltipShow: jest.fn(),
    handleTrackerTooltipHide: jest.fn(),
    showLoading: jest.fn(),
    showToast: jest.fn(),
    updateTabsOverflowIndicator: jest.fn()
  }));
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: {
      planModChatMessages: document.getElementById('planModChatMessages'),
    },
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {},
    loadInfoTexts: jest.fn(() => Promise.resolve()),
  }));
  jest.unstable_mockModule('../chat.js', () => ({
    toggleChatWidget: jest.fn(),
    closeChatWidget: jest.fn(),
    clearChat: jest.fn(),
    displayMessage: jest.fn(),
    displayTypingIndicator: jest.fn(),
    scrollToChatBottom: jest.fn(),
    setAutomatedChatPending: jest.fn(),
  }));
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
  ({ clearPlanModChat, planModChatHistory } = await import('../planModChat.js'));
  app = await import('../app.js');
});

test('main chat history is preserved when clearing plan modification chat', () => {
  app.chatHistory.push({ text: 'hi', sender: 'user', isError: false });
  planModChatHistory.push({ text: 'pm', sender: 'user', isError: false });
  clearPlanModChat();
  expect(app.chatHistory.length).toBe(1);
  expect(planModChatHistory.length).toBe(0);
});
