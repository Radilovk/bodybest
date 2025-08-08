import { loadTemplateInto } from './templateLoader.js';
import { loadPartial } from './partialLoader.js';
import { initClientProfile } from './clientProfile.js';
import { openPlanModificationChat, clearPlanModChat, handlePlanModChatSend, handlePlanModChatInputKeypress } from './planModChat.js';
import { selectors } from './uiElements.js';
import { closeModal } from './uiHandlers.js';
import { setCurrentUserId } from './app.js';

function getUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('userId');
}

async function initPage() {
  await loadTemplateInto('profileTemplate.html', 'profileContainer');
  await loadPartial('planModChatModal.html', 'planModChatModalContainer');

  selectors.planModChatModal = document.getElementById('planModChatModal');
  selectors.planModChatMessages = document.getElementById('planModChatMessages');
  selectors.planModChatInput = document.getElementById('planModChatInput');
  selectors.planModChatSend = document.getElementById('planModChatSend');
  selectors.planModChatClose = document.getElementById('planModChatClose');
  selectors.planModChatClear = document.getElementById('planModChatClear');
  selectors.planModChatTitle = document.getElementById('planModChatTitle');
  selectors.planModChatClient = document.getElementById('planModChatClient');

  const btn = document.getElementById('planModBtn');
  if (btn) {
    const userId = getUserId();
    setCurrentUserId(userId);
    btn.addEventListener('click', () => openPlanModificationChat(userId, null, 'admin'));
  }

  selectors.planModChatClose?.addEventListener('click', () => closeModal('planModChatModal'));
  selectors.planModChatClear?.addEventListener('click', clearPlanModChat);
  selectors.planModChatSend?.addEventListener('click', handlePlanModChatSend);
  selectors.planModChatInput?.addEventListener('keypress', handlePlanModChatInputKeypress);

  initClientProfile();
}

initPage();
