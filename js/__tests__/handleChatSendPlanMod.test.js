/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleChatSend;
let openPlanModificationChatMock;
let selectors;
let chatMessages;

beforeEach(async () => {
  jest.resetModules();
  openPlanModificationChatMock = jest.fn();

  jest.unstable_mockModule('../planModChat.js', () => ({
    openPlanModificationChat: openPlanModificationChatMock,
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
  chatMessages = document.createElement('div');
  selectors = {
    chatInput: { value: 'hi', disabled: false, focus: jest.fn() },
    chatSend: { disabled: false },
    chatMessages
  };
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
    applyTheme: jest.fn(),
    toggleTheme: jest.fn(),
    updateThemeButtonText: jest.fn(),
    activateTab: jest.fn(),
    handleTabKeydown: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    openInstructionsModal: jest.fn(),
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
  jest.unstable_mockModule('../config.js', () => ({
    isLocalDevelopment: false,
    workerBaseUrl: '',
    apiEndpoints: { chat: '/chat' },
    generateId: jest.fn()
  }));

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, reply: 'ok\n[PLAN_MODIFICATION_REQUEST] change' })
  });

  const app = await import('../app.js');
  handleChatSend = app.handleChatSend;
  app.setCurrentUserId('u1');
});

test('does not open plan modification chat without confirmation', async () => {
  await handleChatSend();
  expect(openPlanModificationChatMock).not.toHaveBeenCalled();
});

test('confirmation button is not duplicated', async () => {
  await handleChatSend();
  selectors.chatInput.value = 'hi';
  await handleChatSend();
  const btns = chatMessages.querySelectorAll('.plan-mod-confirm-btn');
  expect(btns).toHaveLength(1);
});
