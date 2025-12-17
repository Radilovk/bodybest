/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('plan modification form (non-chat)', () => {
  let planModModule;
  let selectors;
  let showToast;
  let openModal;
  let planModChatInput;
  let planModChatSend;
  let planModChatMessages;
  let mockUserId = 'u1';

  beforeEach(async () => {
    jest.resetModules();
    planModChatInput = document.createElement('textarea');
    planModChatSend = document.createElement('button');
    planModChatMessages = document.createElement('div');

    selectors = {
      planModChatModal: document.createElement('div'),
      planModChatMessages,
      planModChatInput,
      planModChatSend,
      planModChatClient: document.createElement('span')
    };

    showToast = jest.fn();
    openModal = jest.fn();

    jest.unstable_mockModule('../uiElements.js', () => ({
      selectors
    }));
    jest.unstable_mockModule('../uiHandlers.js', () => ({
      openModal,
      showToast
    }));
    jest.unstable_mockModule('../config.js', () => ({
      apiEndpoints: { submitPlanChangeRequest: '/api/submitPlanChangeRequest' }
    }));
    jest.unstable_mockModule('../app.js', () => ({
      get currentUserId() {
        return mockUserId;
      }
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'updated' })
    });

    planModModule = await import('../planModChat.js');
  });

  test('openPlanModificationChat shows guidance and enables form', async () => {
    await planModModule.openPlanModificationChat();
    expect(openModal).toHaveBeenCalledWith('planModChatModal');
    expect(planModChatMessages.textContent).toContain('Заявката');
    expect(planModChatInput.disabled).toBe(false);
    expect(planModChatSend.disabled).toBe(false);
  });

  test('handlePlanModChatSend posts free-text request', async () => {
    planModChatInput.value = 'Искам повече протеин';
    await planModModule.handlePlanModChatSend();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/submitPlanChangeRequest',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mockUserId, requestText: 'Искам повече протеин' })
      })
    );
  });

  test('handlePlanModChatSend guards empty input', async () => {
    planModChatInput.value = '   ';
    await planModModule.handlePlanModChatSend();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
  });
});
