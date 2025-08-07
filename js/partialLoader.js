import { loadTemplateInto } from './templateLoader.js';

export function loadPartial(name, containerId) {
  return loadTemplateInto(`partials/${name}`, containerId);
}
