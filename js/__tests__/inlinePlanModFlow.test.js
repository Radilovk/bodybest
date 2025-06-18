/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let app;
let selectors;
let showToastMock;
let displayMessageMock;

beforeEach(async () => {
  jest.resetModules();
  displayMessageMock = jest.fn();
  showToastMock = jest.fn();
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
    showToast: showToastMock,
    updateTabsOverflowIndicator: jest.fn()
  }));
  jest.unstable_mockModule('../chat.js', () => ({
    toggleChatWidget: jest.fn(),
    closeChatWidget: jest.fn(),
    clearChat: jest.fn(),
    displayMessage: displayMessageMock,
    displayTypingIndicator: jest.fn(),
    scrollToChatBottom: jest.fn(),
    setAutomatedChatPending: jest.fn()
  }));
  selectors = {
    chatInput: { value: '', disabled: false, focus: jest.fn() },
    chatSend: { disabled: false }
  };
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors,
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
  }));
  jest.unstable_mockModule('../config.js', () => ({
    isLocalDevelopment: false,
    workerBaseUrl: '',
    apiEndpoints: { chat: '/chat', getPlanModificationPrompt: '/prompt' },
    generateId: jest.fn()
  }));
  global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
  app = await import('../app.js');
  global.fetch.mockClear();
  app.setCurrentUserId('u1');
});

test('starts plan modification flow on marker', async () => {
  selectors.chatInput.value = 'hi';
  global.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, reply: 'bot\n[PLAN_MODIFICATION_REQUEST] c' })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ promptOverride: 'P', model: 'm' })
    });

  await app.handleChatSend();

  expect(global.fetch).toHaveBeenNthCalledWith(1, '/chat', expect.any(Object));
  expect(global.fetch).toHaveBeenNthCalledWith(2, '/prompt?userId=u1');
  expect(app.chatPromptOverride).toBe('P');
  expect(app.chatModelOverride).toBe('m');
  expect(app.planModFlowActive).toBe(true);
  expect(app.planModRequestHistory.length).toBe(2);
});

test('uses plan modification history and finishes on second marker', async () => {
  app.setPlanModFlowActive(true);
  app.planModRequestHistory.push(
    { text: 'u', sender: 'user', isError: false },
    { text: 'b', sender: 'bot', isError: false }
  );
  app.setChatPromptOverride('P');
  app.setChatModelOverride('m');
  selectors.chatInput.value = 'next';

  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, reply: 'done [PLAN_MODIFICATION_REQUEST]' })
  });

  await app.handleChatSend();

  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.history.length).toBe(3);
  expect(app.planModFlowActive).toBe(false);
  expect(app.planModRequestHistory.length).toBe(0);
});
