/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('handleChatSend plan modification', () => {
  let handleChatSend;
  let selectors;
  let chatMessages;
  beforeEach(async () => {
    jest.resetModules();
    
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
      updateTabsOverflowIndicator: jest.fn(),
      loadAndApplyColors: jest.fn()
    }));
    jest.unstable_mockModule('../config.js', () => ({
      isLocalDevelopment: false,
      workerBaseUrl: '',
      apiEndpoints: { chat: '/chat' },
      generateId: jest.fn(),
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html'
    }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reply: 'ok\n[PLAN_MODIFICATION_REQUEST]change' })
    });
    const app = await import('../app.js');
    handleChatSend = app.handleChatSend;
    app.setCurrentUserId('u1');
  });

  test('does not open plan modification chat without confirmation', async () => {
    await handleChatSend();
    // Should not fetch the plan modification prompt automatically
    const calls = global.fetch.mock.calls.map(c => c[0]);
    expect(calls.some(url => String(url).includes('getPlanModificationPrompt'))).toBe(false);
  });

  test('confirmation button is not duplicated', async () => {
    await handleChatSend();
    selectors.chatInput.value = 'hi';
    await handleChatSend();
    const btns = chatMessages.querySelectorAll('.plan-mod-confirm-btn');
    expect(btns).toHaveLength(1);
  });
});

describe('plan modification chat modal close/reset', () => {
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
      menuFeedbackBtn: null,
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
      loadAndApplyColors: jest.fn(),
      showToast: jest.fn(),
      showLoading: jest.fn(),
      applyTheme: jest.fn(),
      updateThemeButtonText: jest.fn(),
      openModal: jest.fn(),
      openInstructionsModal: jest.fn()
    }));
    jest.unstable_mockModule('../auth.js', () => ({ handleLogout: jest.fn() }));
    jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
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
      generateId: jest.fn(),
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html'
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
});

describe('plan modification chat history', () => {
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
      openInstructionsModal: jest.fn(),
      openInfoModalWithDetails: jest.fn(),
      openMainIndexInfo: jest.fn(),
      toggleDailyNote: jest.fn(),
      showTrackerTooltip: jest.fn(),
      hideTrackerTooltip: jest.fn(),
      handleTrackerTooltipShow: jest.fn(),
      handleTrackerTooltipHide: jest.fn(),
      loadAndApplyColors: jest.fn(),
      showLoading: jest.fn(),
      showToast: jest.fn(),
      updateTabsOverflowIndicator: jest.fn()
    }));
    jest.unstable_mockModule('../uiElements.js', () => ({
      selectors: {
        planModChatMessages: document.getElementById('planModChatMessages')
      },
      initializeSelectors: jest.fn(),
      trackerInfoTexts: {},
      detailedMetricInfoTexts: {},
      loadInfoTexts: jest.fn(() => Promise.resolve())
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
});

describe('planModPrompt fail modal close', () => {
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
      openInstructionsModal: jest.fn(),
      openInfoModalWithDetails: jest.fn(),
      openMainIndexInfo: jest.fn(),
      toggleDailyNote: jest.fn(),
      showTrackerTooltip: jest.fn(),
      hideTrackerTooltip: jest.fn(),
      handleTrackerTooltipShow: jest.fn(),
      handleTrackerTooltipHide: jest.fn(),
      loadAndApplyColors: jest.fn(),
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
      generateId: jest.fn(),
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html'
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
});

describe('openPlanModificationChat errors', () => {
  let app;
  let showToastMock;
  let closeModalMock;
  beforeEach(async () => {
    jest.resetModules();
    showToastMock = jest.fn();
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
      openInstructionsModal: jest.fn(),
      openInfoModalWithDetails: jest.fn(),
      openMainIndexInfo: jest.fn(),
      toggleDailyNote: jest.fn(),
      showTrackerTooltip: jest.fn(),
      hideTrackerTooltip: jest.fn(),
      handleTrackerTooltipShow: jest.fn(),
      handleTrackerTooltipHide: jest.fn(),
      loadAndApplyColors: jest.fn(),
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
      detailedMetricInfoTexts: {},
      loadInfoTexts: jest.fn(() => Promise.resolve())
    }));
    jest.unstable_mockModule('../config.js', () => ({
      isLocalDevelopment: false,
      workerBaseUrl: '',
      apiEndpoints: { getPlanModificationPrompt: '/prompt' },
      generateId: jest.fn(),
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html'
    }));
    global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
    app = await import('../app.js');
  });

  test('shows toast on fetch error', async () => {
    await app.openPlanModificationChat('u1');
    expect(showToastMock).toHaveBeenCalledWith('Грешка при зареждане на промпта за промени', true);
  });

  test('modal closes on fetch error', async () => {
    await app.openPlanModificationChat('u1');
    expect(closeModalMock).toHaveBeenCalledWith('planModChatModal');
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
});

describe('openPlanModificationChat context', () => {
  let app;
  beforeEach(async () => {
    jest.resetModules();
    const planModChatMessages = document.createElement('div');
    const selectors = {
      chatWidget: { classList: { contains: () => true } },
      chatInput: null,
      planModChatMessages,
      planModChatInput: { value: 'hello', disabled: false, focus: jest.fn() },
      planModChatSend: { disabled: false }
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
      loadAndApplyColors: jest.fn(),
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
      apiEndpoints: { getPlanModificationPrompt: '/prompt', chat: '/chat' },
      generateId: jest.fn(),
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html'
    }));
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ prompt: 'p' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, reply: 'ok' }) });
    app = await import('../app.js');
  });

  test('sends userIdOverride and context', async () => {
    await app.openPlanModificationChat('uX', 'start', 'admin');
    const payload = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(payload.userId).toBe('uX');
    expect(payload.context).toBe('admin');
  });
});
