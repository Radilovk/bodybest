// auth.js - Аутентикация
import { showToast } from './uiHandlers.js';
import { selectors } from './uiElements.js';
import { resetAppState } from './app.js'; // Function from app.js to clear state

export function handleLogout() {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('activeTabId'); // Also clear active tab
    resetAppState(); // Call app.js to clear its global state variables

    showToast("Излизане от системата...", false, 1500);
    setTimeout(() => {
        if(selectors.appWrapper) selectors.appWrapper.style.display = 'none';
        if(selectors.planPendingState) selectors.planPendingState.classList.add('hidden');
        window.location.href = 'index.html';
    }, 1500);
}
