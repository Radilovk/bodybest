export function createStepProgress({ barSelector, currentSelector = null, totalSelector = null, totalSteps = 1 }) {
  const bar = typeof barSelector === 'string' ? document.querySelector(barSelector) : barSelector;
  const currentEl = currentSelector ? (typeof currentSelector === 'string' ? document.querySelector(currentSelector) : currentSelector) : null;
  const totalEl = totalSelector ? (typeof totalSelector === 'string' ? document.querySelector(totalSelector) : totalSelector) : null;
  let total = totalSteps;
  let step = 0;
  if (totalEl) totalEl.textContent = String(total);

  const update = (newStep) => {
    step = Math.max(0, Math.min(newStep, total));
    if (bar) {
      const percent = total > 0 ? (step / total) * 100 : 0;
      bar.style.width = `${percent}%`;
    }
    if (currentEl) currentEl.textContent = String(step + 1);
  };

  const setTotal = (steps) => {
    total = steps;
    if (totalEl) totalEl.textContent = String(total);
    update(step);
  };

  return { update, setTotal };
}
