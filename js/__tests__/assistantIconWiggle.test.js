/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let triggerAssistantWiggle;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `<button id="chat-fab"><img class="assistant-icon"></button>`;
  const selectors = { chatFab: document.getElementById('chat-fab') };
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors,
    initializeSelectors: jest.fn(),
    loadInfoTexts: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({ isLocalDevelopment: false, apiEndpoints: {} }));
  jest.unstable_mockModule('../utils.js', () => ({ safeParseFloat: jest.fn(), escapeHtml: jest.fn(), fileToDataURL: jest.fn() }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    initializeTheme: jest.fn(),
    activateTab: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    showLoading: jest.fn(),
    showToast: jest.fn(),
    updateTabsOverflowIndicator: jest.fn()
  }));
  jest.unstable_mockModule('../populateUI.js', () => ({ populateUI: jest.fn() }));
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
  jest.unstable_mockModule('../adaptiveQuiz.js', () => ({
    openAdaptiveQuizModal: jest.fn(),
    renderCurrentQuizQuestion: jest.fn(),
    showQuizValidationMessage: jest.fn(),
    hideQuizValidationMessage: jest.fn()
  }));
  jest.unstable_mockModule('../planModChat.js', () => ({ openPlanModificationChat: jest.fn() }));
  const mod = await import('../app.js');
  triggerAssistantWiggle = mod.triggerAssistantWiggle;
});

test('wiggle class toggles on animation end', () => {
  const icon = document.querySelector('.assistant-icon');
  triggerAssistantWiggle();
  expect(icon.classList.contains('wiggle')).toBe(true);
  icon.dispatchEvent(new Event('animationend'));
  expect(icon.classList.contains('wiggle')).toBe(false);
});
