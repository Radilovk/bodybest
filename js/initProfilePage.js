import { loadTemplateInto } from './templateLoader.js';
import { loadPartial } from './partialLoader.js';
import { initClientProfile } from './clientProfile.js';
import { initializeSelectors } from './uiElements.js';
import { setupStaticEventListeners } from './eventListeners.js';
import { setCurrentUserId } from './app.js';

function getUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('userId');
}

async function initPage() {
  await loadTemplateInto('profileTemplate.html', 'profileContainer');
  await loadPartial('planModChatModal.html', 'planModChatModalContainer');

  initializeSelectors();
  setupStaticEventListeners();

  const userId = getUserId();
  setCurrentUserId(userId);

  initClientProfile();
}

initPage();
