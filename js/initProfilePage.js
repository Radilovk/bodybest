import { loadTemplateInto } from './templateLoader.js';
import { initClientProfile } from './clientProfile.js';

loadTemplateInto('profileTemplate.html', 'profileContainer').then(() => {
  initClientProfile();
});
