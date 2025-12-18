// mealAlternatives.js - Логика за генериране и избор на алтернативни хранения

import { apiEndpoints } from './config.js';
import { showToast } from './uiHandlers.js';

/**
 * Отваря модален прозорец за показване на алтернативни хранения
 * @param {Object} mealData - Данни за текущото хранене
 * @param {number} mealIndex - Индекс на хранението в дневния план
 * @param {string} dayKey - Ден от седмицата (напр. 'monday')
 * @param {number} retryCount - Вътрешен брояч за опити (по подразбиране 0)
 */
export async function openMealAlternativesModal(mealData, mealIndex, dayKey, retryCount = 0) {
    const modal = document.getElementById('mealAlternativesModal');
    const loadingDiv = document.getElementById('mealAlternativesLoading');
    const alternativesList = document.getElementById('mealAlternativesList');
    const modalTitle = document.getElementById('mealAlternativesModalTitle');
    
    if (!modal || !loadingDiv || !alternativesList || !modalTitle) {
        console.error('Meal alternatives modal elements not found');
        showToast('Грешка: Не може да се отвори прозорецът за алтернативи', true, 3000);
        return;
    }
    
    // Update title
    modalTitle.textContent = `Алтернативи за ${mealData.meal_name || 'хранене'}`;
    
    // Show modal with loading state
    loadingDiv.style.display = 'block';
    alternativesList.style.display = 'none';
    alternativesList.innerHTML = '';
    
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Update loading message if retrying
    if (retryCount > 0) {
        const loadingText = loadingDiv.querySelector('p');
        if (loadingText) {
            loadingText.textContent = `Генериране на алтернативи... (опит ${retryCount + 1})`;
        }
    }
    
    try {
        // Get user ID
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            throw new Error('Потребител не е намерен. Моля, влезте отново.');
        }
        
        // Validate meal data
        if (!mealData || !mealData.meal_name) {
            throw new Error('Невалидни данни за храненето');
        }
        
        // Get today's menu from localStorage
        const planData = JSON.parse(localStorage.getItem('planData') || '{}');
        const todayMenu = planData.week1_menu?.[dayKey] || [];
        
        // Call API to generate alternatives with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(apiEndpoints.generateMealAlternatives, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                mealIndex,
                dayKey,
                currentMeal: mealData,
                todayMenu
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP грешка: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Не могат да бъдат генерирани алтернативи');
        }
        
        if (!result.alternatives || result.alternatives.length === 0) {
            throw new Error('AI моделът не генерира алтернативи. Моля, опитайте отново.');
        }
        
        // Hide loading, show alternatives
        loadingDiv.style.display = 'none';
        alternativesList.style.display = 'block';
        
        // Render alternatives with event handlers attached
        renderAlternativesWithEventHandlers(result.alternatives, mealData, mealIndex, dayKey);
        
    } catch (error) {
        console.error('Error generating meal alternatives:', error);
        loadingDiv.style.display = 'none';
        alternativesList.style.display = 'block';
        
        // Determine if we should show retry button
        const canRetry = retryCount < 2 && error.name !== 'AbortError';
        const isNetworkError = error.message.includes('Failed to fetch') || error.name === 'AbortError';
        
        let errorMessage = error.message;
        if (isNetworkError) {
            errorMessage = 'Проблем с мрежовата връзка. Моля, проверете интернет връзката си.';
        }
        
        alternativesList.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: var(--color-danger);">
                <svg class="icon" style="width: 3rem; height: 3rem; margin-bottom: 1rem;">
                    <use href="#icon-warning-triangle"></use>
                </svg>
                <p><strong>Грешка при генериране</strong></p>
                <p style="margin: 1rem 0;">${errorMessage}</p>
                ${canRetry ? `
                    <button class="button-primary retry-alternatives-btn" style="margin-right: 0.5rem;">
                        <svg class="icon" style="width: 1em; height: 1em; margin-right: 0.5rem;">
                            <use href="#icon-refresh"></use>
                        </svg>
                        Опитай отново
                    </button>
                ` : ''}
                <button class="button-secondary close-alternatives-modal-btn">
                    Затвори
                </button>
            </div>
        `;
        
        // Add event listeners for error buttons
        if (canRetry) {
            const retryBtn = alternativesList.querySelector('.retry-alternatives-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    openMealAlternativesModal(mealData, mealIndex, dayKey, retryCount + 1);
                });
            }
        }
        
        const closeBtn = alternativesList.querySelector('.close-alternatives-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            });
        }
    }
}

/**
 * Рендира алтернативните хранения в списъка и прикачва event handlers
 * @param {Array} alternatives - Масив с алтернативи
 * @param {Object} originalMeal - Оригиналното хранене
 * @param {number} mealIndex - Индекс на хранението
 * @param {string} dayKey - Ден от седмицата
 */
function renderAlternativesWithEventHandlers(alternatives, originalMeal, mealIndex, dayKey) {
    const alternativesList = document.getElementById('mealAlternativesList');
    
    alternativesList.innerHTML = `
        <div class="alternatives-intro" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--color-info-bg); border-radius: var(--radius-md); border-left: 4px solid var(--color-info);">
            <p style="margin: 0; font-size: var(--fs-sm); color: var(--text-color-secondary);">
                <svg class="icon" style="width: 1em; height: 1em; vertical-align: middle; margin-right: 0.5rem;">
                    <use href="#icon-info"></use>
                </svg>
                Изберете една от алтернативите, за да замените <strong>${originalMeal.meal_name || 'храненето'}</strong>.
                Макронутриентите са подобни, но продуктите и ястията са различни.
            </p>
        </div>
        <div class="alternatives-grid">
            ${alternatives.map((alt, index) => renderAlternativeCard(alt, index)).join('')}
        </div>
    `;
    
    // Attach click handlers
    const selectButtons = alternativesList.querySelectorAll('.select-alternative-btn');
    selectButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<svg class="icon spinner" style="width: 1em; height: 1em;"><use href="#icon-spinner"></use></svg> Замяна...';
            
            try {
                await selectAlternative(alternatives[index], originalMeal, mealIndex, dayKey);
            } catch {
                // Error is already handled and displayed in selectAlternative
                // Re-enable button for retry
                btn.disabled = false;
                btn.innerHTML = '<svg class="icon" style="width: 1em; height: 1em; margin-right: 0.5rem;"><use href="#icon-check"></use></svg> Избери това';
            }
        });
    });
}

/**
 * Рендира една карта с алтернатива
 * @param {Object} alternative - Данни за алтернативата
 * @param {number} altIndex - Индекс на алтернативата
 * @returns {string} HTML string
 */
function renderAlternativeCard(alternative, altIndex) {
    const items = alternative.items || [];
    const macros = alternative.macros || {};
    
    const itemsHtml = items.map(item => {
        const name = item.name || 'Продукт';
        const grams = item.grams ? `<span class="caption">(${item.grams}g)</span>` : '';
        return `<div class="alternative-item">• ${name} ${grams}</div>`;
    }).join('');
    
    const macrosHtml = `
        <div class="alternative-macros">
            <div class="macro-item">
                <span class="macro-label">Калории:</span>
                <span class="macro-value">${macros.calories || 0} kcal</span>
            </div>
            <div class="macro-item">
                <span class="macro-label">Протеини:</span>
                <span class="macro-value">${macros.protein_grams || 0}g</span>
            </div>
            <div class="macro-item">
                <span class="macro-label">Въглехидрати:</span>
                <span class="macro-value">${macros.carbs_grams || 0}g</span>
            </div>
            <div class="macro-item">
                <span class="macro-label">Мазнини:</span>
                <span class="macro-value">${macros.fat_grams || 0}g</span>
            </div>
        </div>
    `;
    
    return `
        <div class="alternative-card card" data-alt-index="${altIndex}">
            <div class="alternative-header">
                <h4 class="alternative-name">${alternative.meal_name || `Алтернатива ${altIndex + 1}`}</h4>
                <div class="alternative-badge">Опция ${altIndex + 1}</div>
            </div>
            <div class="alternative-items">
                ${itemsHtml}
            </div>
            ${macrosHtml}
            <button 
                class="button-primary select-alternative-btn" 
                data-alt-index="${altIndex}"
                style="width: 100%; margin-top: 1rem;"
            >
                <svg class="icon" style="width: 1em; height: 1em; margin-right: 0.5rem;">
                    <use href="#icon-check"></use>
                </svg>
                Избери това
            </button>
        </div>
    `;
}

/**
 * Замяна на оригиналното хранене с избраната алтернатива
 * @param {Object} alternative - Избраната алтернатива
 * @param {Object} originalMeal - Оригиналното хранене  
 * @param {number} mealIndex - Индекс на хранението
 * @param {string} dayKey - Ден от седмицата
 */
export async function selectAlternative(alternative, originalMeal, mealIndex, dayKey) {
    try {
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            throw new Error('Потребител не е намерен. Моля, влезте отново.');
        }
        
        // Validate inputs
        if (!alternative || !alternative.meal_name) {
            throw new Error('Невалидна алтернатива');
        }
        
        if (typeof mealIndex !== 'number' || !dayKey) {
            throw new Error('Невалидни параметри');
        }
        
        // Get plan data from localStorage
        const planDataStr = localStorage.getItem('planData');
        if (!planDataStr) {
            throw new Error('Планът не е намерен в локалното хранилище');
        }
        
        const planData = JSON.parse(planDataStr);
        
        if (!planData.week1_menu || !planData.week1_menu[dayKey]) {
            throw new Error(`Не е намерено меню за ${dayKey}`);
        }
        
        if (!Array.isArray(planData.week1_menu[dayKey]) || mealIndex >= planData.week1_menu[dayKey].length) {
            throw new Error('Невалиден индекс на хранене');
        }
        
        // Store the original meal for potential rollback
        const originalMealData = { ...planData.week1_menu[dayKey][mealIndex] };
        
        // Replace meal in the plan
        planData.week1_menu[dayKey][mealIndex] = {
            ...alternative,
            // Preserve any additional properties from original
            recipeKey: alternative.recipeKey || originalMeal.recipeKey || null
        };
        
        // Update localStorage first for instant UI feedback
        localStorage.setItem('planData', JSON.stringify(planData));
        
        // Trigger UI refresh immediately
        window.dispatchEvent(new CustomEvent('mealAlternativeSelected', {
            detail: { mealIndex, dayKey, alternative }
        }));
        
        // Update backend (API call to save the modified plan)
        try {
            const response = await fetch(apiEndpoints.updatePlanData, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    planData
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP грешка: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Грешка при запазване на промяната');
            }
            
            console.log('Meal alternative saved successfully to backend');
            
        } catch (backendError) {
            // If backend update fails, rollback localStorage
            console.error('Backend update failed, rolling back:', backendError);
            planData.week1_menu[dayKey][mealIndex] = originalMealData;
            localStorage.setItem('planData', JSON.stringify(planData));
            
            // Trigger UI refresh with original data
            window.dispatchEvent(new CustomEvent('mealAlternativeSelected', {
                detail: { mealIndex, dayKey, alternative: originalMealData }
            }));
            
            throw new Error(`Запазването не успя: ${backendError.message}`);
        }
        
        // Close modal
        const modal = document.getElementById('mealAlternativesModal');
        if (modal) {
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
        
        // Show success message
        showToast(`Храненето е заменено успешно с "${alternative.meal_name}"`, false, 3000);
        
        // Force UI refresh after a short delay if event handler doesn't work
        setTimeout(() => {
            // Check if the UI has been updated
            const mealCard = document.querySelector(`.meal-card[data-index="${mealIndex}"]`);
            if (mealCard) {
                const mealNameEl = mealCard.querySelector('.meal-name');
                if (mealNameEl) {
                    // Get text content, removing any child elements (like check icon)
                    const textNodes = Array.from(mealNameEl.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE)
                        .map(node => node.textContent.trim())
                        .filter(text => text.length > 0);
                    const currentMealName = textNodes.join(' ');
                    
                    if (currentMealName !== alternative.meal_name) {
                        // UI not updated automatically, reload page
                        console.log('UI not updated, reloading page');
                        window.location.reload();
                    }
                }
            }
        }, 500);
        
    } catch (error) {
        console.error('Error selecting alternative:', error);
        showToast(`Грешка: ${error.message}`, true, 4000);
        
        // Re-throw to allow caller to handle if needed
        throw error;
    }
}

/**
 * Setup event listeners за modal
 */
export function setupMealAlternativesListeners() {
    const alternativesList = document.getElementById('mealAlternativesList');
    
    if (alternativesList) {
        // Event listener for alternative selection is added during render
        // (see renderAlternativesWithContext function)
    }
    
    // Close modal when clicking close button
    const closeButtons = document.querySelectorAll('[data-modal-close="mealAlternativesModal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('mealAlternativesModal');
            if (modal) {
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close modal when clicking outside
    const modal = document.getElementById('mealAlternativesModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        });
    }
}
