/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let app;
let closeModalMock;
let showToastMock;
let planModChatMessages;

beforeEach(async () => {
  jest.resetModules();
  closeModalMock = jest.fn();
  showToastMock = jest.fn();
  planModChatMessages = document.createElement('div');
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
    closeModal: closeModalMock,
    openInfoModalWithDetails: jest.fn(),
    openMainIndexInfo: jest.fn(),
    toggleDailyNote: jest.fn(),
    showTrackerTooltip: jest.fn(),
    hideTrackerTooltip: jest.fn(),
    handleTrackerTooltipShow: jest.fn(),
    handleTrackerTooltipHide: jest.fn(),
    showLoading: jest.fn(),
    showToast: showToastMock,
    updateTabsOverflowIndicator: jest.fn()
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
  const planModChatModal = document.createElement('div');
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: {
      chatWidget: { classList: { contains: () => true } },
      chatInput: null,
      planModChatModal,
      planModChatMessages,
      planModChatInput: { disabled: false },
      planModChatSend: { disabled: false }
    },
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {},
    loadInfoTexts: jest.fn(() => Promise.resolve())
  }));
  jest.unstable_mockModule('../config.js', () => ({
    isLocalDevelopment: false,
    workerBaseUrl: '',
    apiEndpoints: { getPlanModificationPrompt: '/prompt' },
    generateId: jest.fn()
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ message: 'fail' })
  });

  app = await import('../app.js');
});

test('modal closes and typing indicator hides on fetch failure', async () => {
  await app.openPlanModificationChat('u1');
  expect(showToastMock).toHaveBeenCalledWith('fail', true);
  expect(closeModalMock).toHaveBeenCalledWith('planModChatModal');
  expect(planModChatMessages.querySelector('.typing-indicator')).toBeNull();
});
