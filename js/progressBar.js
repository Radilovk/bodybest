export function updateProgressBar(element, value) {
  if (!element) return;
  const fill = element.querySelector('.progress-fill') || element;
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  fill.style.width = `${percent}%`;
  element.setAttribute('aria-valuenow', String(Math.round(percent)));
}
