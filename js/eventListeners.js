// eventListeners.js - Настройване на Event Listeners
import { selectors } from './uiElements.js';
import {
    toggleMenu, closeMenu, handleOutsideMenuClick, handleMenuKeydown,
    toggleTheme, activateTab, handleTabKeydown, closeModal,
    openInfoModalWithDetails, toggleDailyNote, openMainIndexInfo,
    handleTrackerTooltipShow, handleTrackerTooltipHide, showToast
} from './uiHandlers.js';
import { handleLogout } from './auth.js';
import { openExtraMealModal } from './extraMealForm.js';
import { apiEndpoints } from './config.js';
import {
    handleSaveLog, handleFeedbackFormSubmit, // from app.js
    handleChatSend, handleChatInputKeypress, // from app.js / chat.js
    _handlePrevQuizQuestion, _handleNextQuizQuestion, _handleSubmitQuizAnswersClientSide, // from app.js
    _handleTriggerAdaptiveQuizClientSide, // from app.js
    todaysMealCompletionStatus, activeTooltip, currentUserId, // from app.js
    openPlanModificationChat
} from './app.js';
import { toggleChatWidget, closeChatWidget, clearChat } from './chat.js';
import { computeSwipeTargetIndex } from './swipeUtils.js';
import { handleAchievementClick } from './achievements.js';

let touchStartX = null;
const SWIPE_THRESHOLD = 50;

async function acknowledgeAiUpdate() {
    if (!currentUserId) return;
    try {
        const resp = await fetch(apiEndpoints.acknowledgeAiUpdate, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        if (!resp.ok) {
            const msg = await resp.text().catch(() => '');
            console.warn('Неуспешно потвърждение на AI обновление:', msg || resp.status);
        }
    } catch (err) {
        console.warn('Неуспешно потвърждение на AI обновление:', err);
    }
}

export function handleAdaptiveQuizBtnClick(triggerFn = _handleTriggerAdaptiveQuizClientSide) {
    const modal = document.getElementById('adaptiveQuizWrapper');
    if (modal && modal.classList.contains('visible')) return;
    triggerFn();
}


export function setupStaticEventListeners() {
    if (selectors.menuToggle) selectors.menuToggle.addEventListener('click', toggleMenu);
    if (selectors.menuClose) selectors.menuClose.addEventListener('click', closeMenu);
    if (selectors.menuOverlay) selectors.menuOverlay.addEventListener('click', closeMenu);
    document.addEventListener('click', handleOutsideMenuClick);
    if (selectors.mainMenu) selectors.mainMenu.addEventListener('keydown', handleMenuKeydown);
    if (selectors.themeToggleMenu) selectors.themeToggleMenu.addEventListener('click', toggleTheme);
    if (selectors.logoutButton) selectors.logoutButton.addEventListener('click', handleLogout);
    if (selectors.tabsContainer && selectors.tabButtons && selectors.tabButtons.length > 0) {
        selectors.tabButtons.forEach(button => {
            button.addEventListener('click', () => activateTab(button));
            button.addEventListener('keydown', handleTabKeydown);
        });
        selectors.tabsContainer.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        selectors.tabsContainer.addEventListener('touchend', e => {
            if (touchStartX === null) return;
            const diff = e.changedTouches[0].clientX - touchStartX;
            const buttons = Array.from(selectors.tabButtons);
            const currentIndex = buttons.findIndex(btn => btn.getAttribute('aria-selected') === 'true');
            const newIndex = computeSwipeTargetIndex(currentIndex, diff, SWIPE_THRESHOLD, buttons.length);
            if (newIndex !== currentIndex) activateTab(buttons[newIndex]);
            touchStartX = null;
        });
    }
    if (selectors.addNoteBtn) selectors.addNoteBtn.addEventListener('click', toggleDailyNote);
    if (selectors.saveLogBtn) selectors.saveLogBtn.addEventListener('click', handleSaveLog);
    if (selectors.openExtraMealModalBtn) selectors.openExtraMealModalBtn.addEventListener('click', openExtraMealModal);
    if (selectors.triggerAdaptiveQuizBtn) selectors.triggerAdaptiveQuizBtn.addEventListener('click', openPlanModificationChat);

    if (selectors.goalCard) selectors.goalCard.addEventListener('click', () => openMainIndexInfo('goalProgress'));
    if (selectors.engagementCard) selectors.engagementCard.addEventListener('click', () => openMainIndexInfo('engagement'));
    if (selectors.healthCard) selectors.healthCard.addEventListener('click', () => openMainIndexInfo('overallHealth'));
    if (selectors.streakCard) selectors.streakCard.addEventListener('click', (e) => {
        if (e.target.closest('.achievement-medal')) return;
        openMainIndexInfo('successes');
    });


    if (selectors.detailedAnalyticsAccordion) {
        const header = selectors.detailedAnalyticsAccordion.querySelector('.accordion-header');
        if (header) {
            // Assuming handleAccordionToggle is imported or available globally if needed outside populateUI
            // For now, it's used by renderAccordionGroup in populateUI.js
            // If this specific accordion needs it directly, it should be handled
            // by a function that can be imported or passed.
            // For simplicity, let's assume populateUI.js handles its own accordions.
            // If this is a separate accordion instance, it needs its own handler or use a generic one.
            // Let's assume handleAccordionToggle from populateUI.js can be used if it's made more generic
            // or this specific one can be handled here.
            // Re-using the logic from populateUI's handleAccordionToggle:
             const accContent = header.nextElementSibling;
             header.addEventListener('click', function() {
                const isOpen = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', !isOpen); this.classList.toggle('open', !isOpen);
                const arrow = this.querySelector('.arrow'); if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
                if (accContent) { accContent.style.display = isOpen ? 'none' : 'block'; accContent.classList.toggle('open-active', !isOpen); }
             });
             header.addEventListener('keydown', function(e) {
                if(e.key === 'Enter' || e.key === ' ') {
                    const isOpen = this.getAttribute('aria-expanded') === 'true';
                    this.setAttribute('aria-expanded', !isOpen); this.classList.toggle('open', !isOpen);
                    const arrow = this.querySelector('.arrow'); if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
                    if (accContent) { accContent.style.display = isOpen ? 'none' : 'block'; accContent.classList.toggle('open-active', !isOpen); }
                }
            });
        }
    }

    document.addEventListener('click', function(event) {
        const closeBtn = event.target.closest('[data-modal-close]');
        if (closeBtn) {
            const modalId = closeBtn.dataset.modalClose;
            closeModal(modalId);
            if (modalId === 'infoModal') acknowledgeAiUpdate();
            return;
        }
        if (event.target.classList.contains('modal') && event.target.classList.contains('visible')) {
            const modalId = event.target.id;
            closeModal(modalId);
            if (modalId === 'infoModal') acknowledgeAiUpdate();
        }
    });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const visibleModal = document.querySelector('.modal.visible');
            if (visibleModal) {
                const modalId = visibleModal.id;
                closeModal(modalId);
                if (modalId === 'infoModal') acknowledgeAiUpdate();
            }
            if (activeTooltip) handleTrackerTooltipHide(); // Call hide from uiHandlers
        }
    });
    if (selectors.chatFab) selectors.chatFab.addEventListener('click', toggleChatWidget);
    if (selectors.chatClose) selectors.chatClose.addEventListener('click', closeChatWidget);
    if (selectors.chatClear) selectors.chatClear.addEventListener('click', clearChat);
    if (selectors.chatSend) selectors.chatSend.addEventListener('click', handleChatSend);
    if (selectors.chatInput) selectors.chatInput.addEventListener('keypress', handleChatInputKeypress);

    if (selectors.feedbackFab) selectors.feedbackFab.addEventListener('click', () => openModal('feedbackModal')); // openModal from uiHandlers
    if (selectors.feedbackForm) selectors.feedbackForm.addEventListener('submit', handleFeedbackFormSubmit);

    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    prefersDarkScheme.addEventListener('change', e => {
        const pref = localStorage.getItem('theme') || 'system';
        if (pref === 'system') applyTheme(e.matches ? 'dark' : 'light'); // applyTheme from uiHandlers
        updateThemeButtonText(); // updateThemeButtonText from uiHandlers
    });
    document.body.addEventListener('closeExtraMealModalEvent', () => {
        closeModal('extraMealEntryModal');
    });

    if (selectors.prevQuestionBtn) selectors.prevQuestionBtn.addEventListener('click', _handlePrevQuizQuestion);
    if (selectors.nextQuestionBtn) selectors.nextQuestionBtn.addEventListener('click', _handleNextQuizQuestion);
    if (selectors.submitQuizBtn) selectors.submitQuizBtn.addEventListener('click', _handleSubmitQuizAnswersClientSide);

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('rating-square')) {
            const container = e.target.closest('.rating-squares');
            if (container && container.closest('#adaptiveQuizWrapper')) { // Ensure it's within the quiz
                container.querySelectorAll('.rating-square').forEach(square => {
                    square.classList.remove('selected'); // This class might be specific to extra meal form
                });
                // 'filled' class is used in quiz, handled by render logic
            }
        }
    });

    document.addEventListener('click', function(e) {
        const modal = document.getElementById('adaptiveQuizWrapper');
        if (e.target === modal && modal && modal.classList.contains('visible')) {
            closeModal('adaptiveQuizWrapper');
        }
    });

    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('adaptiveQuizWrapper');
        if (e.key === 'Escape' && modal && modal.classList.contains('visible')) {
            closeModal('adaptiveQuizWrapper');
        }
    });

    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-modal-close="adaptiveQuizWrapper"]')) {
            closeModal('adaptiveQuizWrapper');
        }
    });
}

export function setupDynamicEventListeners() {
    document.body.removeEventListener('click', handleDelegatedClicks);
    document.body.addEventListener('click', handleDelegatedClicks);

    if (selectors.dailyTracker) {
        selectors.dailyTracker.removeEventListener('mouseover', handleTrackerTooltipShow);
        selectors.dailyTracker.addEventListener('mouseover', handleTrackerTooltipShow);
        selectors.dailyTracker.removeEventListener('mouseout', handleTrackerTooltipHide);
        selectors.dailyTracker.addEventListener('mouseout', handleTrackerTooltipHide);
        selectors.dailyTracker.removeEventListener('focusin', handleTrackerTooltipShow);
        selectors.dailyTracker.addEventListener('focusin', handleTrackerTooltipShow);
        selectors.dailyTracker.removeEventListener('focusout', handleTrackerTooltipHide);
        selectors.dailyTracker.addEventListener('focusout', handleTrackerTooltipHide);
    }
}

function handleDelegatedClicks(event) {
    const target = event.target;
    if (target.closest('.modal-content') && !target.closest('[data-modal-close]')) return;

    const infoButton = target.closest('button.info, button.metric-info-btn');
    if (infoButton) {
        event.stopPropagation();
        let type = null; let key = null;
        if (infoButton.classList.contains('info')) { type = infoButton.dataset.type || 'recipe'; key = infoButton.dataset.key; }
        else if (infoButton.classList.contains('metric-info-btn')) {
            const label = infoButton.closest('label[data-tooltip-key]');
            if (label) {
                type = 'trackerMetricInfo';
                key = label.dataset.tooltipKey;
            }
        }
        if (type && key) openInfoModalWithDetails(key, type);
        return;
    }
    const completeButton = target.closest('button.complete');
    if (completeButton) {
        event.stopPropagation();
        const day = completeButton.dataset.day; const index = completeButton.dataset.index;
        const mealItemLi = completeButton.closest('li');
        if (mealItemLi && day && index !== undefined) {
            const isCompleted = mealItemLi.classList.toggle('completed');
            todaysMealCompletionStatus[`${day}_${index}`] = isCompleted; // Modifies global state from app.js
            showToast(`Храненето е ${isCompleted ? 'отбелязано' : 'размаркирано'}.`, false, 2000);
        }
        return;
    }
    const ratingSquare = target.closest('.rating-square');
    if (ratingSquare) {
        // Ensure this rating square is part of the daily log, not the adaptive quiz
        const dailyTrackerContext = ratingSquare.closest('#dailyTracker .metric-rating');
        if (dailyTrackerContext) {
            event.stopPropagation();
            const squaresContainer = ratingSquare.closest('.rating-squares'); if (!squaresContainer) return;
            const metricKey = squaresContainer.dataset.metricKey; const selectedValue = parseInt(ratingSquare.dataset.value);
            const metricRatingDiv = squaresContainer.closest('.metric-rating'); if (!metricRatingDiv) return;
            const valueDisplay = metricRatingDiv.querySelector(`#${metricKey}-value`);
            const hiddenInput = metricRatingDiv.querySelector(`#${metricKey}-rating-input`);
            if (valueDisplay) valueDisplay.textContent = selectedValue;
            if (hiddenInput) hiddenInput.value = selectedValue;
            squaresContainer.querySelectorAll('.rating-square').forEach(s => {
                const sValue = parseInt(s.dataset.value);
                s.classList.remove('filled'); for(let i=1; i<=5; i++) s.classList.remove(`level-${i}`);
                if (sValue <= selectedValue) s.classList.add('filled', `level-${sValue}`);
            });
        }
    }

    const medal = target.closest('.achievement-medal');
    if (medal) {
        event.stopPropagation();
        handleAchievementClick(event);
        return;
    }
}
