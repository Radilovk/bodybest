// eventListeners.js - Настройване на Event Listeners
import { selectors } from './uiElements.js';
import {
    toggleMenu, closeMenu, handleOutsideMenuClick, handleMenuKeydown,
    toggleTheme, activateTab, handleTabKeydown, closeModal, openModal,
    openInfoModalWithDetails, toggleDailyNote, openMainIndexInfo,
    openInstructionsModal,
    handleTrackerTooltipShow, handleTrackerTooltipHide, showToast
} from './uiHandlers.js';
import { handleLogout } from './auth.js';
import { openExtraMealModal } from './extraMealForm.js';
import { apiEndpoints } from './config.js';
import {
    macroChartInstance,
    progressChartInstance,
    macroExceedThreshold
} from './populateUI.js';
import {
    handleSaveLog, handleFeedbackFormSubmit, // from app.js
    handleChatSend, handleChatInputKeypress, // from app.js / chat.js
    todaysMealCompletionStatus,
    activeTooltip, currentUserId,
    setChatModelOverride, setChatPromptOverride,
    autoSaveCompletedMeals,
    updateMacrosAndAnalytics,
    fullDashboardData,
    ensureFreshDailyIntake
} from './app.js';
import {
    clearPlanModChat,
    handlePlanModChatSend,
    handlePlanModChatInputKeypress,
    handlePlanModModalClose,
    openPlanModificationChat
} from './planModChat.js';
import { toggleChatWidget, closeChatWidget, clearChat } from './chat.js';
import * as chatUpload from './chat.js';
import { computeSwipeTargetIndex } from './swipeUtils.js';
import { handleAchievementClick } from './achievements.js';
import { openMealAlternativesModal } from './mealAlternatives.js';

// Guard to prevent attaching static listeners multiple times
let staticListenersSet = false;

let touchStartX = null;
const SWIPE_THRESHOLD = 50;

/**
 * Проверява за смяна на деня при връщане към приложението
 */
function handleVisibilityChange() {
    if (!document.hidden && typeof ensureFreshDailyIntake === 'function') {
        // Потребителят се върна към страницата - проверяваме за смяна на деня
        ensureFreshDailyIntake();
        // Опреснете интерфейса ако е необходимо
        if (typeof updateMacrosAndAnalytics === 'function' && fullDashboardData) {
            updateMacrosAndAnalytics();
        }
    }
}

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

export function ensureMacroAnalyticsElement() {
    let el = selectors.macroAnalyticsCardContainer?.querySelector('macro-analytics-card');
    const threshold = String(macroExceedThreshold);
    if (!el) {
        el = document.createElement('macro-analytics-card');
        el.setAttribute('exceed-threshold', threshold);
        selectors.macroAnalyticsCardContainer.appendChild(el);
    } else if (el.getAttribute('exceed-threshold') !== threshold) {
        el.setAttribute('exceed-threshold', threshold);
    }
    macroChartInstance?.resize();
    progressChartInstance?.resize();
    return el;
}


export function setupStaticEventListeners() {
    if (staticListenersSet) {
        console.warn('setupStaticEventListeners called more than once');
        return;
    }
    if (selectors.menuToggle) selectors.menuToggle.addEventListener('click', toggleMenu);
    if (selectors.menuClose) selectors.menuClose.addEventListener('click', closeMenu);
    if (selectors.menuOverlay) selectors.menuOverlay.addEventListener('click', closeMenu);
    document.addEventListener('click', handleOutsideMenuClick);
    if (selectors.mainMenu) selectors.mainMenu.addEventListener('keydown', handleMenuKeydown);
    if (selectors.themeToggleMenu) selectors.themeToggleMenu.addEventListener('click', toggleTheme);
    if (selectors.menuFeedbackBtn) selectors.menuFeedbackBtn.addEventListener('click', () => {
        openModal('feedbackModal');
        closeMenu();
    });
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
    if (selectors.showIntroVideoBtn) selectors.showIntroVideoBtn.addEventListener('click', openInstructionsModal);

    if (selectors.goalCard) selectors.goalCard.addEventListener('click', () => openMainIndexInfo('goalProgress'));
    if (selectors.engagementCard) selectors.engagementCard.addEventListener('click', () => openMainIndexInfo('engagement'));
    if (selectors.healthCard) selectors.healthCard.addEventListener('click', () => openMainIndexInfo('overallHealth'));
    if (selectors.streakCard) selectors.streakCard.addEventListener('click', (e) => {
        if (e.target.closest('.achievement-medal')) return;
        openMainIndexInfo('successes');
    });


    if (selectors.detailedAnalyticsAccordion) {
        const header = selectors.detailedAnalyticsAccordion.querySelector('.accordion-header');
        const accContent = selectors.detailedAnalyticsContent;
        const preview = selectors.macroMetricsPreview;
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
             header.addEventListener('click', function() {
                const isOpen = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', !isOpen); this.classList.toggle('open', !isOpen);
                const arrow = this.querySelector('.arrow'); if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
                if (accContent) { accContent.style.display = isOpen ? 'none' : 'block'; accContent.classList.toggle('open-active', !isOpen); }
                if (preview) preview.style.display = isOpen ? 'grid' : 'none';
                selectors.detailedAnalyticsAccordion.classList.toggle('index-card', isOpen);
                if (!isOpen) ensureMacroAnalyticsElement();
             });
             header.addEventListener('keydown', function(e) {
                if(e.key === 'Enter' || e.key === ' ') {
                    const isOpen = this.getAttribute('aria-expanded') === 'true';
                    this.setAttribute('aria-expanded', !isOpen); this.classList.toggle('open', !isOpen);
                    const arrow = this.querySelector('.arrow'); if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
                    if (accContent) { accContent.style.display = isOpen ? 'none' : 'block'; accContent.classList.toggle('open-active', !isOpen); }
                    if (preview) preview.style.display = isOpen ? 'grid' : 'none';
                    selectors.detailedAnalyticsAccordion.classList.toggle('index-card', isOpen);
                    if (!isOpen) ensureMacroAnalyticsElement();
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
            if (modalId === 'planModChatModal') handlePlanModModalClose();
            return;
        }
        if (event.target.classList.contains('modal') && event.target.classList.contains('visible')) {
            const modalId = event.target.id;
            closeModal(modalId);
            if (modalId === 'planModChatModal') {
                setChatModelOverride(null);
                setChatPromptOverride(null);
                handlePlanModModalClose();
            }
            if (modalId === 'infoModal') acknowledgeAiUpdate();
        }
    });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const visibleModal = document.querySelector('.modal.visible');
            if (visibleModal) {
                const modalId = visibleModal.id;
                closeModal(modalId);
                if (modalId === 'planModChatModal') {
                    setChatModelOverride(null);
                    setChatPromptOverride(null);
                    handlePlanModModalClose();
                }
                if (modalId === 'infoModal') acknowledgeAiUpdate();
            }
            if (activeTooltip) handleTrackerTooltipHide(); // Call hide from uiHandlers
        }
    });
    if (selectors.chatFab) selectors.chatFab.addEventListener('click', () => toggleChatWidget());
    if (selectors.chatClose) selectors.chatClose.addEventListener('click', closeChatWidget);
    if (selectors.chatClear) selectors.chatClear.addEventListener('click', clearChat);
    if (selectors.chatSend) selectors.chatSend.addEventListener('click', handleChatSend);
    if (selectors.chatInput) selectors.chatInput.addEventListener('keypress', handleChatInputKeypress);
    if (selectors.chatUploadBtn) selectors.chatUploadBtn.addEventListener('click', chatUpload.openChatImageDialog);
    if (selectors.chatImageInput) selectors.chatImageInput.addEventListener('change', chatUpload.handleChatImageSelected);

    if (selectors.planModChatClose) selectors.planModChatClose.addEventListener('click', () => {
        setChatModelOverride(null);
        setChatPromptOverride(null);
        closeModal('planModChatModal');
        handlePlanModModalClose();
    });
    if (selectors.planModChatClear) selectors.planModChatClear.addEventListener('click', clearPlanModChat);
    if (selectors.planModChatSend) selectors.planModChatSend.addEventListener('click', handlePlanModChatSend);
    if (selectors.planModChatInput) selectors.planModChatInput.addEventListener('keypress', handlePlanModChatInputKeypress);
    
    // Бутон за отваряне на модала за заявка за промяна на плана
    if (selectors.planModificationBtn) selectors.planModificationBtn.addEventListener('click', openPlanModificationChat);

    if (selectors.feedbackForm) selectors.feedbackForm.addEventListener('submit', handleFeedbackFormSubmit);

    document.body.addEventListener('closeExtraMealModalEvent', () => {
        closeModal('extraMealEntryModal');
    });

    // Слушател за проверка на деня при връщане към приложението
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Слушател за обновяване на UI при избор на алтернативно хранене
    window.addEventListener('mealAlternativeSelected', async (event) => {
        const { mealIndex, dayKey, alternative } = event.detail;
        console.log('Meal alternative selected:', { mealIndex, dayKey, alternative });
        
        try {
            // Get plan data from localStorage (already updated by mealAlternatives.js)
            const planData = JSON.parse(localStorage.getItem('planData') || '{}');
            
            // Find the meal card element and update it
            const mealCards = document.querySelectorAll('.meal-card');
            let targetCard = null;
            
            // Find the card by matching data attributes
            for (const card of mealCards) {
                const cardMealData = card.dataset.mealData ? JSON.parse(card.dataset.mealData) : null;
                if (cardMealData && parseInt(card.dataset.index) === mealIndex) {
                    targetCard = card;
                    break;
                }
            }
            
            if (targetCard) {
                // Update the card's meal data
                targetCard.dataset.mealData = JSON.stringify(alternative);
                
                // Update the meal name
                const mealNameEl = targetCard.querySelector('.meal-name');
                if (mealNameEl) {
                    const checkIcon = mealNameEl.querySelector('.check-icon');
                    mealNameEl.textContent = alternative.meal_name || 'Хранене';
                    if (checkIcon) {
                        mealNameEl.appendChild(checkIcon); // Re-add check icon
                    }
                }
                
                // Update the items list
                const mealItemsEl = targetCard.querySelector('.meal-items');
                if (mealItemsEl && alternative.items) {
                    const itemsHtml = alternative.items.map(item => {
                        const name = item.name || 'Продукт';
                        const grams = item.grams ? `<span class="caption">(${item.grams}g)</span>` : '';
                        return `• ${name} ${grams}`;
                    }).join('<br>');
                    mealItemsEl.innerHTML = itemsHtml || '<em class="text-muted">Няма продукти.</em>';
                }
                
                console.log('UI updated successfully for meal card');
            } else {
                console.warn('Target meal card not found, UI not updated');
            }
            
            // Recalculate and update macros
            if (typeof updateMacrosAndAnalytics === 'function') {
                await updateMacrosAndAnalytics();
                console.log('Macros and analytics updated');
            }
            
        } catch (error) {
            console.error('Error updating UI after meal alternative selection:', error);
        }
    });

    staticListenersSet = true;
}

export function initializeCollapsibleCards() {
    const cards = document.querySelectorAll('#recs-panel .collapsible-card');
    cards.forEach(card => {
        const header = card.querySelector('h4');
        const content = card.querySelector('.collapsible-content');
        if (!header || !content) return;
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        const toggle = () => {
            const isOpen = card.classList.toggle('open');
            header.setAttribute('aria-expanded', isOpen);
        };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
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

    const infoButton = target.closest('button.info, button.metric-info-btn, button.info-btn');
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
        } else if (infoButton.classList.contains('info-btn')) {
            type = infoButton.dataset.type || 'colorVar';
            key = infoButton.dataset.key;
        }
        if (type && key) openInfoModalWithDetails(key, type, fullDashboardData);
        return;
    }

    // Handle alternatives button click
    const alternativesBtn = target.closest('.alternatives-btn');
    if (alternativesBtn) {
        event.preventDefault();
        event.stopPropagation();
        
        const mealCard = alternativesBtn.closest('.meal-card');
        if (!mealCard) {
            console.error('Meal card not found for alternatives button');
            return;
        }
        
        const mealIndex = parseInt(alternativesBtn.dataset.mealIndex, 10);
        const dayKey = alternativesBtn.dataset.day;
        const mealDataStr = mealCard.dataset.mealData;
        
        if (!mealDataStr) {
            console.error('Meal data not found on card');
            return;
        }
        
        try {
            const mealData = JSON.parse(mealDataStr);
            openMealAlternativesModal(mealData, mealIndex, dayKey);
        } catch (error) {
            console.error('Error parsing meal data:', error);
            showToast('Грешка при зареждане на данни за храненето', true, 3000);
        }
        return;
    }
    
    const ratingSquare = target.closest('.rating-square');
    if (ratingSquare) {
        // Ensure this rating square is part of the daily log
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
                s.classList.remove('filled');
                for(let i=1; i<=5; i++) s.classList.remove(`level-${i}`);
                if (sValue <= selectedValue) s.classList.add('filled', `level-${selectedValue}`);
            });
            metricRatingDiv.classList.toggle('active', selectedValue > 0);
        }
    }

    const mealCard = target.closest('.meal-card');
    if (mealCard && !target.closest('button')) {
        event.stopPropagation();
        const day = mealCard.dataset.day;
        const index = mealCard.dataset.index;
        if (day && index !== undefined) {
            const isCompleted = mealCard.classList.toggle('completed');
            todaysMealCompletionStatus[`${day}_${index}`] = isCompleted;
            updateMacrosAndAnalytics();
            autoSaveCompletedMeals();
            showToast(`Храненето е ${isCompleted ? 'отбелязано' : 'размаркирано'}.`, false, 2000);
        }
        return;
    }

    const medal = target.closest('.achievement-medal');
    if (medal) {
        event.stopPropagation();
        handleAchievementClick(event);
        return;
    }
}
