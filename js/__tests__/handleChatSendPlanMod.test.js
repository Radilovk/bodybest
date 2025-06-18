/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleChatSend;
let openPlanModificationChatMock;
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
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: {
      chatInput: { value: 'hi', disabled: false, focus: jest.fn() },
      chatSend: { disabled: false },
      chatMessages
    },
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
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

test('opens plan modification chat on confirmation click and removes wrapper', async () => {
  await handleChatSend();
  const btn = chatMessages.querySelector('.plan-mod-confirm-btn');
  expect(btn).not.toBeNull();
  const wrapper = btn.parentElement;
  btn.dispatchEvent(new Event('click'));
  expect(openPlanModificationChatMock).toHaveBeenCalledWith('u1', 'hi');
  expect(chatMessages.contains(wrapper)).toBe(false);
});
