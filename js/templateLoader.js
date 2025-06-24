import { sanitizeHTML } from './htmlSanitizer.js';

export async function loadTemplateInto(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const resolved = new URL(url, window.location.href);
    if (resolved.origin !== window.location.origin) {
      throw new Error('Cross-origin template load blocked.');
    }
    const resp = await fetch(resolved);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.text();
    container.innerHTML = sanitizeHTML(raw);
  } catch (err) {
    console.error('Template load error:', err);
  }
}
