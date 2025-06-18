/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let closePlanModificationChat;
let appState;
let closeModalMock;
const focusMock = jest.fn();

beforeEach(async () => {
  jest.resetModules();
  closeModalMock = jest.fn();
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
    showToast: jest.fn(),
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
  jest.unstable_mockModule('../config.js', () => ({
    isLocalDevelopment: false,
    workerBaseUrl: '',
    apiEndpoints: {},
    generateId: jest.fn()
  }));
  global.fetch = jest.fn(() => Promise.resolve({ json: async () => ({}) }));
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: { planModificationBtn: { focus: focusMock } },
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
  }));
  appState = await import('../app.js');
  ({ closePlanModificationChat } = await import('../planModChat.js'));
  appState.setPlanModChatModelOverride('m');
  appState.setPlanModChatPromptOverride('p');
});

test('resets overrides and focuses button', () => {
  closePlanModificationChat();
  expect(closeModalMock).toHaveBeenCalledWith('planModChatModal');
  expect(appState.planModChatModelOverride).toBe(null);
  expect(appState.planModChatPromptOverride).toBe(null);
  expect(focusMock).toHaveBeenCalled();
});
