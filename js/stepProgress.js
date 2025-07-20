export function updateStepProgress(barEl, currentStep, totalSteps, currentLabelEl, totalLabelEl) {
  if (barEl && totalSteps > 0) {
    const percent = Math.round((Math.max(0, currentStep) / totalSteps) * 100);
    barEl.style.width = `${Math.min(100, percent)}%`;
  }
  if (currentLabelEl) currentLabelEl.textContent = currentStep;
  if (totalLabelEl) totalLabelEl.textContent = totalSteps;
}
