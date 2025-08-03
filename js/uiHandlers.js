// uiHandlers.js - Управление на UI елементи (Меню, Тема, Табове, Модали, Tooltips и др.)
import { selectors } from './uiElements.js';
import { loadConfig } from './adminConfig.js';
import {
    fullDashboardData,
    activeTooltip, // state from app.js that this module will modify
    setActiveTooltip // function from app.js to update activeTooltip state
} from './app.js';
import { trackerInfoTexts, detailedMetricInfoTexts, mainIndexInfoTexts } from './uiElements.js';
import { colorGroups } from './themeConfig.js';
import { capitalizeFirstLetter, safeGet, escapeHtml } from './utils.js';

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

let systemThemeMediaQuery;

function handleSystemThemeChange(e) {
    const pref = localStorage.getItem('theme') || 'system';
    if (pref === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
        updateThemeButtonText();
    }
}

const themes = ['light', 'dark', 'vivid'];

export function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    systemThemeMediaQuery = systemThemeMediaQuery || window.matchMedia('(prefers-color-scheme: dark)');
    const systemTheme = systemThemeMediaQuery.matches ? 'dark' : 'light';
    if (!systemThemeMediaQuery.onchange) {
        systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
    }
    let theme = savedTheme === 'system' ? systemTheme : savedTheme;
    if (!themes.includes(theme)) theme = 'light';
    applyTheme(theme);
    updateThemeButtonText();
}

export function applyTheme(theme) {
    document.body.classList.remove('light-theme', 'dark-theme', 'vivid-theme');
    const cls = theme === 'dark' ? 'dark-theme' : theme === 'vivid' ? 'vivid-theme' : 'light-theme';
    document.body.classList.add(cls);
    document.dispatchEvent(new Event('themechange'));
    document.dispatchEvent(new Event('progressChartThemeChange'));
}

export function toggleTheme() {
    const current = document.body.classList.contains('dark-theme')
        ? 'dark'
        : document.body.classList.contains('vivid-theme')
        ? 'vivid'
        : 'light';
    const idx = themes.indexOf(current);
    const nextTheme = themes[(idx + 1) % themes.length];
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
    updateThemeButtonText();
}

export function updateThemeButtonText() {
    if (!selectors.themeToggleMenu) return;
    const themeTextSpan = selectors.themeToggleMenu.querySelector('.theme-text');
    const themeIconSpan = selectors.themeToggleMenu.querySelector('.menu-icon');
    const current = document.body.classList.contains('dark-theme')
        ? 'dark'
        : document.body.classList.contains('vivid-theme')
        ? 'vivid'
        : 'light';
    const nextTheme = themes[(themes.indexOf(current) + 1) % themes.length];
    const labels = { light: 'Светла Тема', dark: 'Тъмна Тема', vivid: 'Ярка Тема' };
    const icons = {
        light: '<i class="bi bi-moon"></i>',
        dark: '<i class="bi bi-palette-fill"></i>',
        vivid: '<i class="bi bi-sun"></i>'
    };
    if (current === 'vivid') {
        if (themeTextSpan) themeTextSpan.textContent = 'Цветна Тема';
        if (themeIconSpan) themeIconSpan.innerHTML = '<i class="bi bi-palette"></i>';
    } else {
        if (themeTextSpan) themeTextSpan.textContent = labels[nextTheme];
        if (themeIconSpan) themeIconSpan.innerHTML = icons[nextTheme];
    }
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
    if (modalId === 'adaptiveQuizWrapper') {
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
            const first = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            (first || modal).focus();
        });
    } else {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        (firstFocusable || modal).focus();
    }
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
        if (modalId === "adaptiveQuizWrapper") {
            modal.style.display = "none";
        }
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

export function openInfoModalWithDetails(key, type) {
    let title = "Информация", body = "Няма налична информация.";
    const currentFullDashboardData = fullDashboardData; // Accessing from app.js import

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
    selectors.addNoteBtn.innerHTML = `${icon} ${isHidden ? `Добави ${baseText}` : `Скрий ${baseText}`}`;
    if (!isHidden) selectors.dailyNote.focus();
}

export function showTrackerTooltip(targetElement, text) {
    if (!selectors.tooltipTracker) {
        const tooltipEl = document.createElement('div');
        tooltipEl.id = 'tooltip-tracker';
        tooltipEl.className = 'tooltip-tracker';
        document.body.appendChild(tooltipEl);
        selectors.tooltipTracker = tooltipEl;
    }
    selectors.tooltipTracker.textContent = text;
    const targetRect = targetElement.getBoundingClientRect();
    selectors.tooltipTracker.style.left = `${targetRect.left + window.scrollX}px`;
    selectors.tooltipTracker.style.top = `${targetRect.top + window.scrollY - selectors.tooltipTracker.offsetHeight - 5}px`;
    selectors.tooltipTracker.classList.add('visible');
    setActiveTooltip(selectors.tooltipTracker); // Update global state via app.js function
}

export function hideTrackerTooltip() {
    const currentActiveTooltip = activeTooltip; // Access global state from app.js
    if (currentActiveTooltip) {
        currentActiveTooltip.classList.remove('visible');
        setActiveTooltip(null); // Update global state via app.js function
    }
}

export function handleTrackerTooltipShow(event) {
    const infoBtn = event.target.closest('.metric-info-btn');
    const targetLabel = event.target.closest('label[data-tooltip-key]');
    let elementForTooltip = null;
    let tooltipKey = null;

    if (infoBtn && infoBtn.parentElement.matches('label[data-tooltip-key]')) {
        elementForTooltip = infoBtn.parentElement;
        tooltipKey = elementForTooltip.dataset.tooltipKey;
    } else if (targetLabel && !infoBtn) {
        elementForTooltip = targetLabel;
        tooltipKey = targetLabel.dataset.tooltipKey;
    }

    if (elementForTooltip && tooltipKey) {
        const metricInfo = trackerInfoTexts[tooltipKey];
        const tooltipText = (typeof metricInfo === 'object' ? metricInfo.general : metricInfo) || elementForTooltip.textContent;
        if (tooltipText) {
            showTrackerTooltip(elementForTooltip, tooltipText.replace(/\n/g, ' '));
        }
    }
}

export function handleTrackerTooltipHide(event) {
    const infoBtn = event.target.closest('.metric-info-btn');
    const targetLabel = event.target.closest('label[data-tooltip-key]');
    if (infoBtn || targetLabel) {
        hideTrackerTooltip();
    }
}

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
