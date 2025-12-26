// uiHandlers.js - Управление на UI елементи (Меню, Тема, Табове, Модали, Tooltips и др.)
import { selectors } from './uiElements.js';
import { loadConfig } from './adminConfig.js';
import { activeTooltip, setActiveTooltip } from './tooltipState.js';
import { trackerInfoTexts, detailedMetricInfoTexts, mainIndexInfoTexts } from './uiElements.js';
import { colorGroups } from './themeConfig.js';
import { capitalizeFirstLetter, safeGet, escapeHtml } from './utils.js';
import { showLoading } from './loading.js';
import { toggleTheme, initializeTheme, applyTheme, updateThemeButtonText } from './themeControls.js';
export { showLoading, toggleTheme, initializeTheme, applyTheme, updateThemeButtonText };

// Продължителност на анимацията при скриване/показване на модали
const MODAL_TRANSITION_MS = 300;

// Variable to hold the toast timeout ID, managed locally within this module
let toastTimeoutUiHandlers;

const colorInfoTexts = {};
colorGroups.forEach(group => {
    group.items.forEach(item => {
        if (item.description) {
            colorInfoTexts[item.var] = {
                title: item.label || item.var,
                text: item.description
            };
        }
    });
});


export function toggleMenu() {
    if (!selectors.mainMenu || !selectors.menuToggle || !selectors.menuOverlay) return;
    const isOpen = selectors.mainMenu.classList.toggle('menu-open');
    selectors.menuToggle.setAttribute('aria-expanded', isOpen.toString());
    selectors.menuOverlay.classList.toggle('visible', isOpen);
    if (isOpen && selectors.menuClose) selectors.menuClose.focus();
    else if (!isOpen && selectors.menuToggle) selectors.menuToggle.focus();
}

export function closeMenu() {
    if (!selectors.mainMenu || !selectors.menuToggle || !selectors.menuOverlay || !selectors.mainMenu.classList.contains('menu-open')) return;
    selectors.mainMenu.classList.remove('menu-open');
    selectors.menuToggle.setAttribute('aria-expanded', 'false');
    selectors.menuOverlay.classList.remove('visible');
    if (selectors.menuToggle) selectors.menuToggle.focus();
}

export function handleOutsideMenuClick(event) {
    if (!selectors.mainMenu || !selectors.menuToggle || !selectors.menuOverlay) return;
    if (selectors.mainMenu.classList.contains('menu-open') &&
        !selectors.mainMenu.contains(event.target) &&
        !selectors.menuToggle.contains(event.target) &&
        event.target !== selectors.menuOverlay) {
        closeMenu();
    }
}

export function handleMenuKeydown(event) {
    if (event.key === 'Escape' && selectors.mainMenu?.classList.contains('menu-open')) closeMenu();
}

export async function loadAndApplyColors() {
    try {
        const { colors = {} } = await loadConfig(['colors']);
        for (const [key, val] of Object.entries(colors)) {
            if (!val) continue;
            document.documentElement.style.setProperty(`--${key}`, val);
            document.body.style.setProperty(`--${key}`, val);
        }
    } catch (err) {
        console.warn('Неуспешно зареждане на цветовата конфигурация', err);
    }
}

export function activateTab(activeTabButton) {
    if (!activeTabButton || !selectors.tabButtons || selectors.tabButtons.length === 0) return;
    selectors.tabButtons.forEach(button => {
        const panelId = button.getAttribute('aria-controls'); const panel = document.getElementById(panelId);
        const isSelected = (button === activeTabButton);
        button.setAttribute('aria-selected', isSelected.toString()); button.setAttribute('tabindex', isSelected ? '0' : '-1');
        if (panel) { panel.classList.toggle('active-tab-content', isSelected); panel.setAttribute('aria-hidden', (!isSelected).toString()); }
    });
    if (document.activeElement !== activeTabButton) activeTabButton.focus();
    sessionStorage.setItem('activeTabId', activeTabButton.id);
}

export function updateTabsOverflowIndicator() {
    if (!selectors.tabsContainer) return;
    const nav = selectors.tabsContainer;

    function refresh() {
        const hasOverflow = nav.scrollWidth > nav.clientWidth + 1;
        const atEnd = nav.scrollLeft >= nav.scrollWidth - nav.clientWidth - 1;
        nav.classList.toggle('has-overflow', hasOverflow && !atEnd);
    }

    nav.addEventListener('scroll', refresh);
    window.addEventListener('resize', refresh);
    refresh();
}

export function handleTabKeydown(e) {
    const key = e.key; const currentTab = e.currentTarget;
    if(!selectors.tabButtons || selectors.tabButtons.length === 0) return;
    const tabButtonsArray = Array.from(selectors.tabButtons);
    let currentIndex = tabButtonsArray.indexOf(currentTab); if (currentIndex === -1) return;
    let newIndex = currentIndex;
    if (key === 'ArrowRight') newIndex = (currentIndex + 1) % tabButtonsArray.length;
    else if (key === 'ArrowLeft') newIndex = (currentIndex - 1 + tabButtonsArray.length) % tabButtonsArray.length;
    else if (key === 'Home') newIndex = 0; else if (key === 'End') newIndex = tabButtonsArray.length - 1;
    else return;
    e.preventDefault(); activateTab(tabButtonsArray[newIndex]);
}

let modalQueue = [];

function openModalInternal(modalId) {
    const modal = document.getElementById(modalId); if (!modal) return;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (firstFocusable || modal).focus();
}

export function openModal(modalId) {
    const visibleModal = document.querySelector('.modal.visible');
    if (visibleModal) { modalQueue.push(modalId); return; }
    openModalInternal(modalId);
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId); if (!modal) return;
    modal.classList.remove("visible"); modal.setAttribute("aria-hidden", "true");

    const handleTransitionEnd = () => {
        modal.removeEventListener('transitionend', handleTransitionEnd);
        if (modalQueue.length > 0) {
            const next = modalQueue.shift();
            openModalInternal(next);
        }
    };
    const fallbackTimer = setTimeout(handleTransitionEnd, MODAL_TRANSITION_MS);
    modal.addEventListener('transitionend', () => {
        clearTimeout(fallbackTimer);
        handleTransitionEnd();
    }, { once: true });
}

export function openInfoModalWithDetails(key, type, dashboardData = {}) {
    let title = "Информация", body = "Няма налична информация.";
    const currentFullDashboardData = dashboardData;

    if (type === 'recipe') {
        const recipe = safeGet(currentFullDashboardData, ['recipeData', key]);
        if (recipe) { title = recipe.title || "Рецепта"; body = recipe.body || "Няма описание."; }
        else body = `Рецепта с ключ "${key}" не е намерена.`;
    } else if (type === 'detailedMetricInfo') {
        const metricData = safeGet(currentFullDashboardData, 'analytics.detailed', []).find(m => (m.infoTextKey || m.key + '_info') === key);
        title = metricData?.label || "Инфо за показател";
        body = detailedMetricInfoTexts[key] || metricData?.infoText || "Няма допълнителна информация.";
    } else if (type === 'trackerMetricInfo') {
        const metricInfo = trackerInfoTexts[key];
        title = metricInfo?.general?.split('\n')[0] || capitalizeFirstLetter(key);
        body = metricInfo?.general || "Няма описание за тази метрика.";
        if (metricInfo?.levels) {
            body += "\n\nСтойности:\n" + Object.values(metricInfo.levels).join("\n");
        }
    } else if (type === 'colorVar') {
        const info = colorInfoTexts[key];
        title = info?.title || key;
        body = info?.text || 'Няма допълнителна информация.';
    }
    const escapedTitle = escapeHtml(title);
    const escapedBody = escapeHtml(body).replace(/\n/g, '<br>');
    if (selectors.infoModalTitle) selectors.infoModalTitle.innerHTML = escapedTitle;
    if (selectors.infoModalBody) selectors.infoModalBody.innerHTML = escapedBody;
    openModal('infoModal');
}

export function openMainIndexInfo(key) {
    const info = mainIndexInfoTexts[key] || {};
    const title = info.title || 'Информация';
    const body = info.text || 'Няма налична информация.';
    const escapedTitle = escapeHtml(title);
    const escapedBody = escapeHtml(body).replace(/\n/g, '<br>');
    if (selectors.infoModalTitle) selectors.infoModalTitle.innerHTML = escapedTitle;
    if (selectors.infoModalBody) selectors.infoModalBody.innerHTML = escapedBody;
    openModal('infoModal');
}

export function openInstructionsModal() {
    openModal('instructionsModal');
}

export function toggleDailyNote() {
    if (!selectors.dailyNote || !selectors.addNoteBtn) return;
    const isHidden = selectors.dailyNote.classList.toggle('hidden');
    const icon = '<i class="bi bi-pencil-square"></i>';
    const baseText = "бележка за деня";
    selectors.addNoteBtn.innerHTML = `${icon} <span>${isHidden ? `Добави ${baseText}` : `Скрий ${baseText}`}</span>`;
    if (!isHidden) selectors.dailyNote.focus();
}

export function showToast(message, isError = false, duration = 3000) {
    if (!selectors.toast) return;
    selectors.toast.textContent = message;
    selectors.toast.className = 'toast show' + (isError ? ' error' : ''); // Ensure 'toast' class is always present
    clearTimeout(toastTimeoutUiHandlers);
    toastTimeoutUiHandlers = setTimeout(() => {
        if (selectors.toast) { // Check if toast element still exists
            selectors.toast.className = 'toast'; // Reset to base class
        }
    }, duration);
}
