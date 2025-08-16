import { selectors } from './uiElements.js';

export function showLoading(show, message = "Зареждане...") {
    if (!selectors.loadingOverlay || !selectors.loadingOverlayText) return;
    selectors.loadingOverlayText.textContent = message;
    if (show) {
        selectors.loadingOverlay.classList.remove('hidden');
    } else {
        setTimeout(() => {
            selectors.loadingOverlay.classList.add('hidden');
        }, 150);
    }
}
