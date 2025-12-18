// mealAlternatives.js - Логика за генериране и избор на алтернативни хранения

import { apiEndpoints } from './config.js';
import { showToast } from './uiHandlers.js';

/**
 * Отваря модален прозорец за показване на алтернативни хранения
 * @param {Object} mealData - Данни за текущото хранене
 * @param {number} mealIndex - Индекс на хранението в дневния план
 * @param {string} dayKey - Ден от седмицата (напр. 'monday')
 */
export async function openMealAlternativesModal(mealData, mealIndex, dayKey) {
    const modal = document.getElementById('mealAlternativesModal');
    const loadingDiv = document.getElementById('mealAlternativesLoading');
    const alternativesList = document.getElementById('mealAlternativesList');
    const modalTitle = document.getElementById('mealAlternativesModalTitle');
    
    if (!modal || !loadingDiv || !alternativesList || !modalTitle) {
        console.error('Meal alternatives modal elements not found');
        return;
    }
    
    // Update title
    modalTitle.textContent = `Алтернативи за ${mealData.meal_name || 'хранене'}`;
    
    // Show modal with loading state
    loadingDiv.style.display = 'block';
    alternativesList.style.display = 'none';
    alternativesList.innerHTML = '';
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    try {
        // Get user ID
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            throw new Error('Потребител не е намерен');
        }
        
        // Get today's menu from localStorage or API
        const planData = JSON.parse(localStorage.getItem('planData') || '{}');
        const todayMenu = planData.week1_menu?.[dayKey] || [];
        
        // Call API to generate alternatives
        const response = await fetch(apiEndpoints.generateMealAlternatives || `${apiEndpoints.chat.replace('/chat', '/generateMealAlternatives')}`, {
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
            })
        });
        
        const result = await response.json();
        
        if (!result.success || !result.alternatives || result.alternatives.length === 0) {
            throw new Error(result.message || 'Не могат да бъдат генерирани алтернативи');
        }
        
        // Hide loading, show alternatives
        loadingDiv.style.display = 'none';
        alternativesList.style.display = 'block';
        
        // Render alternatives
        renderAlternatives(result.alternatives, mealData, mealIndex, dayKey);
        
    } catch (error) {
        console.error('Error generating meal alternatives:', error);
        loadingDiv.style.display = 'none';
        alternativesList.style.display = 'block';
        alternativesList.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: var(--color-danger);">
                <svg class="icon" style="width: 3rem; height: 3rem; margin-bottom: 1rem;">
                    <use href="#icon-warning-triangle"></use>
                </svg>
                <p><strong>Грешка при генериране</strong></p>
                <p>${error.message}</p>
                <button class="button-secondary" onclick="document.getElementById('mealAlternativesModal').classList.remove('show'); document.body.style.overflow = '';">
                    Затвори
                </button>
            </div>
        `;
    }
}

/**
 * Рендира алтернативните хранения в списъка
 * @param {Array} alternatives - Масив с алтернативи
 * @param {Object} originalMeal - Оригиналното хранене
 * @param {number} mealIndex - Индекс на хранението
 * @param {string} dayKey - Ден от седмицата
 */
function renderAlternatives(alternatives, originalMeal, mealIndex, dayKey) {
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
            ${alternatives.map((alt, index) => renderAlternativeCard(alt, index, originalMeal, mealIndex, dayKey)).join('')}
        </div>
    `;
}

/**
 * Рендира една карта с алтернатива
 * @param {Object} alternative - Данни за алтернативата
 * @param {number} altIndex - Индекс на алтернативата
 * @param {Object} originalMeal - Оригиналното хранене
 * @param {number} mealIndex - Индекс на хранението
 * @param {string} dayKey - Ден от седмицата
 * @returns {string} HTML string
 */
function renderAlternativeCard(alternative, altIndex, originalMeal, mealIndex, dayKey) {
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
            throw new Error('Потребител не е намерен');
        }
        
        // Get plan data from localStorage
        const planData = JSON.parse(localStorage.getItem('planData') || '{}');
        
        if (!planData.week1_menu || !planData.week1_menu[dayKey]) {
            throw new Error('Планът не е намерен');
        }
        
        // Replace meal in the plan
        planData.week1_menu[dayKey][mealIndex] = {
            ...alternative,
            // Preserve any additional properties from original
            recipeKey: alternative.recipeKey || originalMeal.recipeKey
        };
        
        // Update localStorage
        localStorage.setItem('planData', JSON.stringify(planData));
        
        // Update backend (API call to save the modified plan)
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
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Грешка при запазване на промяната');
        }
        
        // Close modal
        const modal = document.getElementById('mealAlternativesModal');
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
        
        // Show success message
        showToast(`Храненето е заменено успешно с "${alternative.meal_name}"`, false, 3000);
        
        // Reload the UI to reflect changes
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('Error selecting alternative:', error);
        showToast(`Грешка: ${error.message}`, true, 3000);
    }
}

/**
 * Setup event listeners за modal
 */
export function setupMealAlternativesListeners() {
    const alternativesList = document.getElementById('mealAlternativesList');
    
    if (alternativesList) {
        // Delegate click events for alternative selection
        alternativesList.addEventListener('click', (e) => {
            const selectBtn = e.target.closest('.select-alternative-btn');
            if (selectBtn) {
                const altIndex = parseInt(selectBtn.dataset.altIndex, 10);
                const alternativeCard = selectBtn.closest('.alternative-card');
                
                // Get alternative data from DOM
                const mealName = alternativeCard.querySelector('.alternative-name').textContent;
                
                // This is a simplified approach - in real implementation, 
                // we'd store the full alternative data on the button or card
                console.log('Selected alternative index:', altIndex);
                
                // The actual selection logic will be handled through a stored alternatives array
                // which we'll add to the global scope when rendering
            }
        });
    }
    
    // Close modal when clicking close button
    const closeButtons = document.querySelectorAll('[data-modal-close="mealAlternativesModal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('mealAlternativesModal');
            if (modal) {
                modal.classList.remove('show');
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
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        });
    }
}

// Store alternatives globally for selection
let currentAlternativesData = null;
let currentMealContext = null;

/**
 * Updates the render function to store alternatives data
 */
function renderAlternativesWithContext(alternatives, originalMeal, mealIndex, dayKey) {
    // Store for later use
    currentAlternativesData = alternatives;
    currentMealContext = { originalMeal, mealIndex, dayKey };
    
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
            ${alternatives.map((alt, index) => renderAlternativeCard(alt, index, originalMeal, mealIndex, dayKey)).join('')}
        </div>
    `;
    
    // Attach click handlers
    const selectButtons = alternativesList.querySelectorAll('.select-alternative-btn');
    selectButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<svg class="icon spinner" style="width: 1em; height: 1em;"><use href="#icon-spinner"></use></svg> Замяна...';
            
            await selectAlternative(alternatives[index], originalMeal, mealIndex, dayKey);
        });
    });
}

// Export the updated render function
export { renderAlternativesWithContext as renderAlternatives };
