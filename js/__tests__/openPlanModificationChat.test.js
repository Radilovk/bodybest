/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let app;
let showToastMock;

beforeEach(async () => {
  jest.resetModules();
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
    displayMessage: jest.fn(),
    displayTypingIndicator: jest.fn(),
    scrollToChatBottom: jest.fn(),
    setAutomatedChatPending: jest.fn()
  }));
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: {
      chatWidget: { classList: { contains: () => true } },
      chatInput: null
    },
    initializeSelectors: jest.fn(),
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
  }));
  jest.unstable_mockModule('../config.js', () => ({
    isLocalDevelopment: false,
    workerBaseUrl: '',
    apiEndpoints: { getPlanModificationPrompt: '/prompt' },
    generateId: jest.fn()
  }));
  global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
  app = await import('../app.js');
});

test('shows toast on fetch error', async () => {
  await app.openPlanModificationChat('u1');
  expect(showToastMock).toHaveBeenCalledWith('Грешка при зареждане на промпта за промени', true);
});

test('shows toast on server error status', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ message: 'srv' })
  });
  await app.openPlanModificationChat('u1');
  expect(showToastMock).toHaveBeenCalledWith('srv', true);
});
